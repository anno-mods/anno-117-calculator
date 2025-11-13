import { ACCURACY, ko } from './util';
import { AssetsMap } from './types';
import { Workforce } from './population';
import { Constructible } from './world';
import { Product, Buff, Item, Effect } from './production';
import { Factory, Module } from './factories';

declare const view: any;

/**
 * Represents an item equipped to a specific factory
 * Manages the relationship between items and factories
 */
export class AppliedBuff {
    public parent: Item|Effect|Module;
    public target: Constructible;
    public buff: Buff;
    public replacements?: Map<Product, Product>;
    public replacementArray?: {old: Product, new: Product}[];
    public replacingWorkforce?: Workforce;
    public productivityUpgrade: KnockoutObservable<number>;
    public fuelDurationPercent: KnockoutObservable<number>;
    public workforceMaintenanceFactorUpgrade: KnockoutObservable<number>;
    public extraGoods?: ExtraGoodProduction[];
    public available: KnockoutComputed<boolean>;
    public visible: KnockoutComputed<boolean>;
    public scaling: KnockoutObservable<number>;


    /**
     * Creates a new EquippedItem instance
     * @param config - Configuration object for the equipped item
     * @param assetsMap - Map of all available assets
     * @param useParentScaling - use the sacling attribute from parent instead of creating a new observable
     */
    constructor(parent: Item|Effect|Module, buff: Buff, factory: Constructible, _assetsMap: AssetsMap, useParentScaling=true) {
        // Validate required parameters
        if (!parent) {
            throw new Error('AppliedBuff parent is required');
        }
        if (!buff) {
            throw new Error('AppliedBuff buff is required');
        }
        if (!factory) {
            throw new Error('AppliedBuff factory is required');
        }
        
        // Explicit assignments
        this.parent = parent;
        this.target = factory;
        this.buff = buff;
        if(useParentScaling){
            if (!(this.parent instanceof Effect)){
                throw new Error(`useParentScaling was set but parent with GUID ${this.parent.guid} was not an Effect`);
            }
            this.scaling = this.parent.scaling;
        }
        else
            this.scaling = ko.observable(0); // indicates wheter item/effect is not applied (0), applied (1), multiple times applied (> 1); child class updates this value

        if (this.buff.replaceWorkforce && 'connectedWorkforce' in this.target && (this.target as any).connectedWorkforce &&
            (this.target as any).connectedWorkforce.guid == this.buff.replaceWorkforce.oldWorkforce.guid) // better compare guids, if buff is global and uses a different instance of the same workforce
            this.replacingWorkforce = _assetsMap.get(this.buff.replaceWorkforce.newWorkforce.guid);

        if (this.buff.additionalOutputs && this.buff.additionalOutputs.length > 0 && 'getProduct' in this.target) {
            this.extraGoods = []
            for (let entry of this.buff.additionalOutputs) {
                try {


                    const product = entry.forceProductSameAsFactoryOutput ? (this.target as Factory).getProduct() : entry.product;
                    
                    if (!product) {
                        throw new Error(`Product with GUID ${product} not found in assetsMap`);
                    }

                    // ensure we use the local instance of the product if the buff is global
                    this.extraGoods!.push(new ExtraGoodProduction(this, entry.amount, entry.additionalOutputCycle,  _assetsMap.get(product.guid), _assetsMap));
                } catch (e) { }
            }
        }

        this.productivityUpgrade = ko.pureComputed(() => {
            return this.scaling() * this.buff.productivityUpgrade;
        });

        
        this.fuelDurationPercent = ko.pureComputed(() => {
            return this.scaling() * this.buff.fuelDurationPercent;
        });

        
        this.workforceMaintenanceFactorUpgrade = ko.pureComputed(() => {
            return this.scaling() * this.buff.workforceMaintenanceFactorUpgrade;
        });

        this.replacements = new Map();
        this.replacementArray = [];
        if (this.buff.replaceInputs) {

            this.buff.replaceInputs.forEach((r: any) => {
                if (!r.oldInput) {
                    throw new Error('ReplaceInputs must have OldInput and NewInput properties');
                }
                const oldProduct = _assetsMap.get(parseInt(r.OldInput));
                if (!oldProduct) {
                    throw new Error(`Old input product with GUID ${r.OldInput} not found in assetsMap`);
                }
                const newProduct = _assetsMap.get(parseInt(r.NewInput));
                if (!newProduct) {
                    throw new Error(`New input product with GUID ${r.NewInput} not found in assetsMap`);
                }
                this.replacementArray!.push({
                    old: oldProduct,
                    new: newProduct
                });
                this.replacements!.set(r.OldInput, r.NewInput);
            });
        }

        this.available = ko.pureComputed(() => {
            return this.target.available() && this.buff.available();
        });

        this.visible = ko.pureComputed(() => {
            if (!this.available())
                return false;

            if (!view.island || !view.island())
                return true;

            var region = view.island().region;
            if (!region)
                return true;

            return this.target.island.region === region;
        });

        this.target.addBuff(this);
    }
}

/**
 * Represents additional goods production from equipped items
 * Manages extra goods produced by factories with specific items
 */
export class ExtraGoodProduction {
    public item: AppliedBuff;
    public factory: Factory;
    public defaultAmount: number;
    public additionalOutputCycle: number;
    public product: Product;
    public amount: KnockoutComputed<number>;

    private amountHistory: [number, Date][];  

    /**
     * Creates a new ExtraGoodProduction instance
     * @param config - Configuration object for the extra good production
     * @param assetsMap - Map of all available assets
     */
    constructor(appliedBuff: AppliedBuff, defaultAmount: number, additionalOutputCycle: number, product: Product, _assetsMap: AssetsMap) {
        // Validate required parameters
        if (!appliedBuff) {
            throw new Error('ExtraGoodProduction item is required');
        }
        if (typeof defaultAmount !== 'number') {
            throw new Error('ExtraGoodProduction Amount is required and must be a number');
        }
        if (typeof additionalOutputCycle !== 'number') {
            throw new Error('ExtraGoodProduction AdditionalOutputCycle is required and must be a number');
        }

        // Explicit assignments
        this.item = appliedBuff;
        const factory = appliedBuff.target;
        if (! ('getProduct' in factory)){
            throw new Error('ExtraGoodProduction requires factory as buff target but got ' + appliedBuff.target.name())
        }
        this.factory = factory as Factory;
        this.defaultAmount = defaultAmount;
        this.additionalOutputCycle = additionalOutputCycle;


        this.product = product;

        // use the history to break the cycle: extra good (lumberjack) -> building materials need (timber) -> production (sawmill) -> production (lumberjack)
        // that cycles between two values by adding a damper
        // [[prev val, timestamp], [prev prev val, timestamp]]
        this.amountHistory = [];
        this.amount = ko.computed(() => {
            const val = this.item.scaling() * defaultAmount * this.factory.throughput() / this.additionalOutputCycle;

            if (this.amountHistory.length && Math.abs(val - this.amountHistory[0][0]) < ACCURACY)
                return this.amountHistory[0][0];

            const time = new Date();

            if (this.amountHistory.length >= 2) {
                // after initialization, we have this.amountHistory = [val, 0]
                // when the user manually sets it to 0, the wrong value is propagated
                // restrict to cycles triggered by automatic updates, i.e. update interval < 200 ms
                if (Math.abs(this.amountHistory[1][0] - val) < ACCURACY && this.amountHistory[1][0] !== 0 && time.getTime() - this.amountHistory[1][1].getTime() < 200)
                    return (val + this.amountHistory[0][0]) / 2;
            }

            this.amountHistory.unshift([val, time]);
            if (this.amountHistory.length > 2)
                this.amountHistory.pop();
            return val;
        });

        // Add to product's extra good production list
        if (this.product.extraGoodProductionList) {
            this.product.extraGoodProductionList.entries.push(this);
        }

        // If this factory produces extra of its own output, track it for boost calculation
        if (this.factory == this.product.factories.find(f => f == this.factory)) {
            this.factory.selfEffectingExtraGoods.push(this);
        }
    }
}