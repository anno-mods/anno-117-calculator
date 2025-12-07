import { NamedElement, EPSILON, ko, dummyObservableArray, dummyComputed, getForcedDefaultSupplier } from './util';
import {  AssetsMap } from './types';
import { ProductConfig, BuildingBuffConfig, PatronsConfig, EffectConfig, ItemConfig, ProductFilterConfig } from './types.config';
import { Workforce } from './population';
import { Region, Constructible, isConstructible, Island } from './world';

import type { Factory } from './factories';
import { AppliedBuff, ExtraGoodProduction } from './buffs';
import { Supplier, PassiveTradeSupplier, ExtraGoodSupplier } from './suppliers';
import { TradeList, TradeRoute } from './trade';
export { AppliedBuff, ExtraGoodProduction };


declare const view: any;
declare const $: any;

/**
 * Represents a product that can be produced by factories
 * Manages production relationships and factory assignments
 * Now includes supplier management for flexible sourcing
 */
export class Product extends NamedElement {
    public guid: number;
    public isAbstract: boolean;
    public isConstructionMaterial: boolean;
    public factories: Factory[];
    public availableFactories: KnockoutObservableArray<Factory>;
    public extraGoodProductionList?: ExtraGoodProductionList;
    public extraGoodSuppliers?: ExtraGoodSupplier[]; // Suppliers for extra goods production (one per factory)

    // === DEMAND TRACKING ===
    public demands: KnockoutObservableArray<Demand>; // All consumers demanding this product
    public totalDemand: KnockoutComputed<number>; // Total demand from all consumers and trade routes
    public totalDemandNoRoutes: KnockoutComputed<number>; // Total demand from all consumers
    public totalDefaultProduction: KnockoutComputed<number>; // Production from non-default suppliers
    public totalCurrentProduction: KnockoutComputed<number>; // Production from all suppliers
    public excessProduction: KnockoutObservable<number>; // Excess when non-default suppliers exceed demand
    public demandCalculationSubscription!: KnockoutComputed<void>; // Updates supplier demands based on total demand

    // === SUPPLIER MANAGEMENT ===
    public passiveTradeSupplier!: PassiveTradeSupplier; // Passive trade supplier
    public tradeList!: TradeList; // TradeList - manages trade routes for this product (initialized in initSuppliers)
    public availableSuppliers: KnockoutComputed<Supplier[]>; // All available suppliers (factories + extra goods)
    public defaultSupplier: KnockoutObservable<Supplier | null>; // User-selected default supplier
    public defaultSupplierSet: KnockoutObservable<boolean>;
    public defaultSupplierSubscription!: KnockoutComputed<void>; // Ensures that the default supplier is unset if it is no longer available
    public island?: Island; // Island reference for supplier management
    public isHighlightedAsMissing: KnockoutComputed<boolean>;

    public notes: KnockoutObservable<string>;

    /**
     * Creates a new Product instance
     * @param config - Configuration object for the product
     * @param assetsMap - Map of all available assets
     */
    constructor(config: ProductConfig, _assetsMap: AssetsMap) {
        // Validate required parameters
        if (!config.name) {
            throw new Error('Product name is required');
        }
        if (!config.guid) {
            throw new Error('Product GUID is required');
        }


        // Prepare config for parent constructor
        const parentConfig = {
            guid: config.guid,
            name: config.name,
            locaText: config.locaText || {},
            iconPath: config.iconPath || "",
        };
        
        super(parentConfig);
        this.guid = config.guid;

        this.isAbstract = config.isAbstract || false;
        this.isConstructionMaterial = config.isConstructionMaterial || false;

        this.factories = [];
        this.availableFactories = dummyObservableArray("Product.availableFactories");

        // Initialize extra good production list for tracking item-based production
        this.extraGoodProductionList = new ExtraGoodProductionList();

        // Initialize demand tracking
        this.demands = ko.observableArray([]);
        this.excessProduction = ko.observable(0);

        // Will be initialized properly in initSuppliers after suppliers are created
        this.totalDemand = dummyComputed("product.totalDemand");
        this.totalDemandNoRoutes = dummyComputed("product.totalDemandNoRoutes");
        this.totalDefaultProduction = dummyComputed("product.nonDefaultSupplierProduction");
        this.totalCurrentProduction = dummyComputed("product.currentSupplierProduction");

        // Initialize supplier management (will be fully set up in initSuppliers)
        this.defaultSupplier = ko.observable(null);
        this.defaultSupplierSet = ko.observable(false);
        this.availableSuppliers = dummyComputed("Product.availableSuppliers");
        this.availableFactories = dummyObservableArray("Product.availableFactories"); // throws if used before initialization in initSuppliers
        
        this.isHighlightedAsMissing = ko.pureComputed(() => {
            const supplier = this.defaultSupplier();
            
            if (supplier === null) {
                return this.totalDemand() > this.totalCurrentProduction();
            }

            // Check Factory suppliers
            if(supplier.type === "factory")
                return (supplier as Factory).isHighlightedAsMissing();

            // Check TradeRoute suppliers - delegate to source island
            if(supplier.type === "trade_route")
                return (supplier as TradeRoute).isHighlightedAsMissing();

            // Other supplier types (passive_trade, extra_good) never show warning
            return false;
         });

        this.notes = ko.observable("");
    }

    addFactory(factory: Factory){
        this.factories.push(factory);
    }

    /**
     * Adds a demand to this product's demand tracking
     * @param demand - The demand to add
     */
    addDemand(demand: Demand): void {
        this.demands.push(demand);
    }

    /**
     * Removes a demand from this product's demand tracking
     * @param demand - The demand to remove
     */
    removeDemand(demand: Demand): void {
        this.demands.remove(demand);
    }

    /**
     * Initializes supplier management for this product
     * Creates PassiveTradeSupplier and ExtraGoodSupplier instances
     * One ExtraGoodSupplier is created per factory that produces this product as extra good
     * @param island - The island this product belongs to
     */
    initSuppliers(island: Island): void {
        this.island = island;

        this.availableFactories = ko.pureComputed(() => this.factories.filter((f: Factory) => f.available()));
 

        // Create trade list for managing trade routes
        this.tradeList = new TradeList(island, this);

        // Create passive trade supplier
        this.passiveTradeSupplier = new PassiveTradeSupplier(this, island);

        // Create extra good suppliers if there are extra good production entries
        if (this.extraGoodProductionList && this.extraGoodProductionList.entries.length > 0) {
            // Group entries by factory
            const entriesByFactory = new Map<Factory, ExtraGoodProduction[]>();

            for (const entry of this.extraGoodProductionList.entries) {
                if (entry && entry.factory && entry.product === this) {
                    const factory = entry.factory;
                    if (!entriesByFactory.has(factory)) {
                        entriesByFactory.set(factory, []);
                    }
                    entriesByFactory.get(factory)!.push(entry);
                }
            }

            // Create one ExtraGoodSupplier per factory
            this.extraGoodSuppliers = [];
            for (const [factory, entries] of entriesByFactory.entries()) {
                if (factory.product.guid == this.guid)
                    continue; // Skip self-effecting production

                const supplier = new ExtraGoodSupplier(factory, this, island);
                supplier.productionList = entries;
                this.extraGoodSuppliers.push(supplier);
                factory.addExtraGoodSupplier(supplier);
            }
        }


        // includes suppliers that cannot be set as default suppliers (e.g. import trade routes that create cycles)
        this.availableSuppliers = ko.pureComputed(() => {
            const suppliers: Supplier[] = [];

            // Add available factories
            for (const factory of this.factories) {
                if (factory.available()) {
                    suppliers.push(factory);
                }
            }

            // Add all extra good suppliers if available
            if (this.extraGoodSuppliers) {
                for (const supplier of this.extraGoodSuppliers) {
                    if (supplier.canSupply()) {
                        suppliers.push(supplier);
                    }
                }
            }

            // Add available trade routes
            for (const route of this.tradeList.routes()) {
                if (!route.isExport(this.tradeList)) {
                    suppliers.push(route);
                }
            }

            return suppliers;
        });

        this.defaultSupplierSubscription = ko.computed(() => {
            if(!this.defaultSupplierSet() || !this.defaultSupplier()?.canSupply())
                this.resetDefaultSupplier();
        });

        // Set up demand calculation
        this.totalDemand = ko.pureComputed(() => {
            let sum = 0;
            for (const demand of this.demands()) {
                sum += demand.amount();
            }
            // Add trade route export demands (products leaving this island)
            if (this.tradeList) {
                sum += this.tradeList.inputAmount();
            }
            return sum;
        });

        this.totalDemandNoRoutes = ko.pureComputed(() => {
            let sum = 0;
            for (const demand of this.demands()) {
                sum += demand.amount();
            }
            return sum;
        });

        this.totalDefaultProduction = ko.pureComputed(() => {
            let sum = 0;

            // Sum production from all suppliers except the default one
            for (const supplier of this.availableSuppliers()) {
                sum += supplier.defaultProduction();
            }

            return sum;
        });

        this.totalCurrentProduction = ko.pureComputed(() => {
            let sum = 0;

            for (const supplier of this.availableSuppliers()) {
                sum += supplier.currentProduction();
            }
            
            sum += this.passiveTradeSupplier.currentProduction();

            return sum;
        });

        // Update supplier demands when total demand or supplier production changes
        this.demandCalculationSubscription = ko.computed(() => {
            const total = this.totalDemand();
            const defaultProd = this.totalDefaultProduction();
            const defaultSupp = this.defaultSupplier();
            
            if (defaultSupp === null) {
                this.excessProduction(0);
            } else if (defaultProd >= total) {
                // Non-default suppliers produce more than needed
                this.excessProduction(defaultProd - total);
                defaultSupp.setDemand(0);
            } else {
                // Default supplier needs to fill the gap
                this.excessProduction(0);
                const remaining = total - defaultProd + defaultSupp.defaultProduction();
                defaultSupp.setDemand(remaining);
            }
        });

    }

    /**
     * Overwrite the current default supplier with the one used by default - a factory in the region (if available) or passive trade
     * @returns 
     */
    resetDefaultSupplier(){
        this.defaultSupplierSet(true);
        
        const guid = getForcedDefaultSupplier(this.island?.region.id, this.guid);
        if (guid != null){
            for (const factory of this.factories) {
                if (factory.canSupply() && factory.guid == guid){
                    this.updateDefaultSupplier(factory);
                    return;
                }
            }
        }


        for (const factory of this.factories) {
            if (factory.canSupply()) {
                this.updateDefaultSupplier(factory);
                return;
            }
        }
        
        this.updateDefaultSupplier(null);
    }

    /**
     * Unsets the current default supplier and sets the new one. Unsetting the old one resets updates the demand enforced by it.
     * Setting the demand for the new one is handled by the product demand calculation.
     * @param supplier The new default supplier
     * @returns 
     */
    updateDefaultSupplier(supplier: Supplier|null){
        const prevSupplier = this.defaultSupplier()
        if(supplier == prevSupplier)
            return;

        this.defaultSupplier(supplier);
        prevSupplier?.unsetAsDefaultSupplier();
        // when unsetting it first, going from trade route to default supplier sets demand to zero.
    }

    /**
     * Checks whether the chain of default suppliers ends at the island the passed product belongs to
     */
    isSuppliedFrom(product: Product){
        var sourceSupplier = this.defaultSupplier();
        var count = 0;
        while(sourceSupplier instanceof TradeRoute) {
            var p = sourceSupplier.fromIslandProduct;

            if (p == product)
                return true;

            sourceSupplier = p.defaultSupplier();

            if(++count >= 1000)
                throw new Error(`Ended in infinite loop while checking cycle in supplier chain graph 
                    for product ${this.guid} from island "${this.island?.name()}": ${this}`);
        }

        return false;
    }
}



/**
 * Represents a meta product that groups other products
 * Used for organizing products into categories
 */
export class MetaProduct extends NamedElement {
    public isAbstract: boolean;

    /**
     * Creates a new MetaProduct instance
     * @param config - Configuration object for the meta product
     * @param assetsMap - Map of all available assets
     */
    constructor(config: ProductConfig, _assetsMap: AssetsMap) {
        // Validate required parameters
        if (!config.name) {
            throw new Error('MetaProduct name is required');
        }
        if (!config.guid) {
            throw new Error('MetaProduct GUID is required');
        }

        // Prepare config for parent constructor
        const parentConfig = {
            guid: config.guid,
            name: config.name,
            locaText: config.locaText || {},
            iconPath: config.iconPath || "",
            dlcs: []
        };
        
        super(parentConfig);
        
        // Explicit assignments
        this.isAbstract = config.isAbstract || true;
    }
}



/**
 * Represents a demand for a product from a consumer
 * Demand resolution now delegated to Product.defaultSupplier
 */
export class Demand {
    public consumer: Constructible;
    private consumerAmount: KnockoutObservable<number>;
    public amount: KnockoutObservable<number>;
    public amountSubscription: KnockoutComputed<void>;
    public product: Product;
    public factor: KnockoutComputed<number>;

    /**
     * Creates a new Demand instance
     * @param product - The product being demanded
     * @param consumer - The consumer creating the demand
     * @param assetsMap - Map of all available assets
     * @param observableFactor - Observable factor for demand scaling
     */
    constructor(product: Product, consumer: Constructible,  _assetsMap: AssetsMap, observableFactor: KnockoutComputed<number>) {

        this.product = product;
        this.consumer = consumer;
        this.factor = observableFactor;

        this.consumerAmount = ko.observable(0); // set by consumer when calling updateAmount
        this.amount = ko.observable(0);
        this.amountSubscription = ko.computed(() => {
            const adjustedAmount = this.consumerAmount() * this.factor();
            if (Math.abs(this.amount() - adjustedAmount) >= EPSILON) {
                return this.amount(adjustedAmount);
            }
        });

        // Register this demand with the product
        product.addDemand(this);
    }

    /**
     * Updates the amount of this demand
     * @param amount - The new amount
     */
    updateAmount(amount: number): void {
        this.consumerAmount(amount);
    }
}


/**
 * Represents a category of products
 * Groups related products together for organization
 */
export class ProductCategory extends NamedElement {
    public guid: number;
    public products: Product[];

    /**
     * Creates a new ProductCategory instance
     * @param config - Configuration object for the category
     * @param assetsMap - Map of all available assets
     */
    constructor(config: ProductFilterConfig, _assetsMap: AssetsMap) {
        // Validate required parameters
        if (!config.guid) {
            throw new Error('ProductCategory GUID is required');
        }
        if (!config.products || !Array.isArray(config.products)) {
            throw new Error('ProductCategory products array is required');
        }

        // Prepare config for parent constructor
        const parentConfig = {
            guid: config.guid,
            locaText: config.locaText || {},
            iconPath: config.iconPath || "",
            dlcs: []
        };
        
        super(parentConfig);
        this.guid = config.guid;
        
        // Explicit assignments
        this.guid = config.guid;

        this.products = config.products.map((p: number) => {
            const product = _assetsMap.get(p);
            if (!product) {
                throw new Error(`Product with GUID ${p} not found in assetsMap`);
            }
            return product;
        }).filter((p: any) => p != null && p instanceof Product);
    }
}

/**
 * Represents a buff that can be applied to buildings/factories
 * Provides modifiers for productivity, workforce, and additional outputs
 */
export class Buff extends NamedElement {
    public guid: number;
    public isStackable: boolean;
    public workforceModifierInPercent: number;
    public baseProductivityUpgrade: number;
    public productivityUpgrade: number;
    public fuelDurationPercent: number;
    public replaceInputs: {
        oldInput: Product;
        newInput: Product;
    }[];
    public replaceWorkforce?: {
        newWorkforce: Workforce;
        oldWorkforce: Workforce;
    };
    public workforceMaintenanceFactorUpgrade: number;
    public additionalOutputs: {
        product?: Product;
        forceProductSameAsFactoryOutput: boolean;
        additionalOutputCycle: number;
        amount: number;
    }[];
    public additionalWorkforces?: Workforce[];

    /**
     * Creates a new Buff instance
     * @param config - Configuration object for the buff
     * @param assetsMap - Map of all available assets
     */
    constructor(config: BuildingBuffConfig, _assetsMap: AssetsMap) {
        // Validate required parameters
        if (!config.guid) {
            throw new Error('Buff GUID is required');
        }
        if (!config.name) {
            throw new Error('Buff name is required');
        }
        
        super(config);
        this.guid = config.guid;
        this.isStackable = config.isStackable;
        this.workforceModifierInPercent = config.workforceModifierInPercent;
        this.baseProductivityUpgrade = config.baseProductivityUpgrade;
        this.productivityUpgrade = config.productivityUpgrade;
        this.fuelDurationPercent = config.fuelDurationPercent;
        this.workforceMaintenanceFactorUpgrade = config.workforceMaintenanceFactorUpgrade;
        
        // Look up workforce replacements
        if (config.replaceWorkforce.oldWorkforce != 0){
            const newWorkforce = _assetsMap.get(config.replaceWorkforce.newWorkforce);
            if (!newWorkforce) {
                throw new Error(`New workforce with GUID ${config.replaceWorkforce.newWorkforce} not found in assetsMap`);
            }
            const oldWorkforce = _assetsMap.get(config.replaceWorkforce.oldWorkforce);
            if (!oldWorkforce) {
                throw new Error(`Old workforce with GUID ${config.replaceWorkforce.oldWorkforce} not found in assetsMap`);
            }
            this.replaceWorkforce = {
                newWorkforce: newWorkforce as Workforce,
                oldWorkforce: oldWorkforce as Workforce
            };
        }
        
        this.replaceInputs = []
        if (config.replaceInputs) {
            config.replaceInputs.map((output) => {
                const oldInput = _assetsMap.get(output.oldInput);
                if (!oldInput) {
                    throw new Error(`Product with GUID ${output.oldInput} not found in assetsMap`);
                }
                const newInput = _assetsMap.get(output.newInput);
                if (!newInput) {
                    throw new Error(`Product with GUID ${output.newInput} not found in assetsMap`);
                }
                return {
                    oldInput: oldInput,
                    newInput: newInput
                };
            });
        }

        // Look up products for additionalOutputs
        this.additionalOutputs = [];
        if (config.additionalOutputs) {
            this.additionalOutputs = config.additionalOutputs.map(output => {
                const product = _assetsMap.get(output.product);
                if (!product && !output.forceProductSameAsFactoryOutput) {
                    throw new Error(`Product with GUID ${output.product} not found in assetsMap`);
                }
                return {
                    product: product as Product,
                    forceProductSameAsFactoryOutput: output.forceProductSameAsFactoryOutput,
                    additionalOutputCycle: output.additionalOutputCycle,
                    amount: output.amount
                };
            }).filter(a => a != null);
        }
        
        // Look up workforce for additionalWorkforces
        if (config.additionalWorkforces) {
            this.additionalWorkforces = config.additionalWorkforces.map(workforceId => {
                const workforce = _assetsMap.get(workforceId);
                if (!workforce) {
                    throw new Error(`Workforce with GUID ${workforceId} not found in assetsMap`);
                }
                return workforce as Workforce;
            });
        }
    }
}

/**
 * Represents a patron that provides effects to buildings
 * Manages patron-specific bonuses and modifications
 */
export class Patron extends NamedElement {
    public guid: number;
    public localEffects?: {
        effect: Effect;
        milestones: any[];
    }[];
    public wonder?: Effect;

    /**
     * Creates a new Patron instance
     * @param config - Configuration object for the patron
     * @param assetsMap - Map of all available assets
     */
    constructor(config: PatronsConfig, _assetsMap: AssetsMap) {
        // Validate required parameters
        if (!config.guid) {
            throw new Error('Patron GUID is required');
        }
        if (!config.name) {
            throw new Error('Patron name is required');
        }

        super(config);
        this.guid = config.guid;
        
        // Look up effects for localEffects
        if (config.localEffects) {
            this.localEffects = config.localEffects.map(localEffect => {
                const effect = _assetsMap.get(localEffect.effect);
                if (!effect) {
                    throw new Error(`Effect with GUID ${localEffect.effect} not found in assetsMap`);
                }
                return {
                    effect: effect as Effect,
                    milestones: localEffect.milestones
                };
            });
        }
        
        // Look up wonder object
        if (config.wonder) {
            const wonder = _assetsMap.get(config.wonder);
            if (!wonder) {
                throw new Error(`Wonder with GUID ${config.wonder} not found in assetsMap`);
            }
            this.wonder = wonder;
        }
    }
}

/**
 * Represents an effect that can be applied to buildings
 * Manages effect-specific buffs and targeting
 */
export class Effect extends NamedElement {

    public guid: number;
    public buffGuids: number[];
    public buffs: Buff[];
    public targets: Constructible[];
    public targetGuids?: number[];
    public targetsIsAllProduction: boolean;
    public effectScope: string;
    public excludeEffectSourceGUID: boolean;
    public isStackable: boolean;
    public effectDuration?: number; // duration of the event in seconds
    public source?: string; // source type: 'module', 'tech', 'festival', 'veneration-effect', 'session-event', 'island-event'

    public scaling: KnockoutObservable<number>;

    /**
     * Creates a new Effect instance
     * @param config - Configuration object for the effect
     * @param assetsMap - Map of all available assets
     */
    constructor(config: EffectConfig, _assetsMap: AssetsMap) {
        // Validate required parameters
        if (!config.guid) {
            throw new Error('Effect GUID is required');
        }
        if (!config.name) {
            throw new Error('Effect name is required');
        }
        if (!config.buffs || !Array.isArray(config.buffs)) {
            throw new Error('Effect buffs array is required');
        }

        
        super(config);
        this.guid = config.guid;
        this.effectScope = config.effectScope;
        this.targetsIsAllProduction = config.targetsIsAllProduction;
        this.excludeEffectSourceGUID = config.excludeEffectSourceGUID;
        this.buffGuids = config.buffs;
        this.buffs = []; // only for displaying
        this.targets = [];
        if(config.targets)
            this.targetGuids = config.targets;

        if(config.effectDuration > 0)
            this.effectDuration = config.effectDuration;

        if(config.source)
            this.source = config.source;

        this.scaling = ko.observable(0);
        this.isStackable = false;

    }

    /**
     * Returns the localized source text based on the source type
     * Maps source enum to appropriate translation from params.js
     * Includes duration in brackets if available (e.g., "Festival (2h)")
     */
    getSourceText(): string {
        if (!this.source) {
            return '';
        }

        // Map source enum to params.js translation keys
        const sourceKeyMap: Record<string, string> = {
            'module': 'silo', // Using outputStorage as placeholder - need to find correct module translation
            'tech': 'discovery',
            'festival': 'festival',
            'veneration-effect': 'venerationEffects',
            'session-event': 'sessionEvent',
            'island-event': 'islandEvent'
        };

        const translationKey = sourceKeyMap[this.source];
        let sourceText = this.source; // fallback to raw source value

        // Access the translation from window.view.texts (params.js translations)
        const texts = (window as any).view?.texts;
        if (translationKey && texts && texts[translationKey]) {
            sourceText = texts[translationKey].name();
        }

        // Add duration in brackets if available
        if (this.effectDuration && this.effectDuration > 0) {
            const hours = this.effectDuration / 3600;
            const formatNumber = (window as any).formatNumber;
            const formattedHours = formatNumber ? formatNumber(hours) : hours.toString();
            return `${sourceText} (${formattedHours}h)`;
        }

        return sourceText;
    }

    // for session and global buffs this method is called mutliple times on the same object
    applyBuffs(assetsMap: AssetsMap) {
        if(this.targetGuids == null)
            return;

        // Look up buffs
        const buffs = this.buffGuids.map(buffId => {
            const buff = assetsMap.get(buffId);
            if (!buff) {
                throw new Error(`Buff with GUID ${buffId} not found in assetsMap`);
            }
            if (buff.isStackable)
                this.isStackable = true;
            return buff as Buff;
        });
        if (this.buffs.length == 0)
            this.buffs = buffs;
        
        // Look up targets (Residences or Consumers/Constructibles)

        const targets = this.targetGuids.map(targetId => assetsMap.get(targetId) ).filter(t => isConstructible(t));
        if (this.targets.length == 0)
            this.targets = targets;

        for (const target of targets)
            for (const buff of buffs)
                new AppliedBuff(this, buff, target, assetsMap) // constructor stores created object in target
    }
}

/**
 * Represents an item that can be equipped to factories
 * Provides bonuses and modifications to factory production
 */
export class Item extends NamedElement {
    public guid: number;
    public additionalOutputs: Map<Product, number>;
    public replacements?: Map<Product, Product>;
    public replacementArray?: {old: Product, new: Product}[];
    public factories: Constructible[];
    public extraGoods?: Product[];
    public availableExtraGoods?: KnockoutComputed<Product[]>;
    public replacingWorkforce?: Workforce;
    public equipments: AppliedBuff[];
    public availableEquipments: KnockoutObservableArray<AppliedBuff>;
    public checked: KnockoutComputed<boolean>;
    public visible: KnockoutComputed<boolean>;

    /**
     * Creates a new Item instance
     * @param config - Configuration object for the item
     * @param assetsMap - Map of all available assets
     * @param region - The region this item belongs to
     */
    constructor(config: ItemConfig, _assetsMap: AssetsMap, _region: Region) {
        // Validate required parameters
        if (!config.name) {
            throw new Error('Item name is required');
        }
        if (!config.guid) {
            throw new Error('Item GUID is required');
        }
        if (!config.targets || !Array.isArray(config.targets)) {
            throw new Error('Item targets array is required');
        }

       
        super(config);
        
        // Explicit assignments
        this.guid = config.guid;
        this.additionalOutputs = new Map<Product, number>();

        this.factories = (config.targets || []).map((f: number) => _assetsMap.get(f)).filter((f: any) => isConstructible(f)); // ignore not considered buildings, e.g. warehouse

        this.equipments = [];
        for (const b of config.buffs){
            const buff = _assetsMap.get(b);
            if (!buff) {
                throw new Error(`Buff with GUID ${b} not found in assetsMap for item ${this.name()} ${this.guid}`);
            }

            for (const f of this.factories){
                this.equipments.push(new AppliedBuff(this, buff, f, _assetsMap, false));
            }

        }
        this.availableEquipments = ko.pureComputed(() => this.equipments.filter((e: AppliedBuff) => e.available()));

        this.checked = ko.pureComputed({
            read: () => {
                for (var eq of this.equipments)
                    if (!eq.scaling())
                        return false;

                return true;
            },
            write: (checked: boolean) => {
                this.equipments.forEach(e => e.scaling(checked ? 1 : 0));
            }
        });

        this.visible = ko.computed(() => {
            if (!this.available() || this.availableEquipments().length == 0)
                return false;

            if (this.availableExtraGoods && this.availableExtraGoods().length == 0)
                return false;

            if (!view.island || !view.island())
                return true;

            var region = view.island().region;
            if (!region)
                return true;

            for (var f of this.factories)
                if (f.island.region === region)
                    return true;

            return false;
        });
    }
}


/**
 * Represents an item equipped to a specific factory
 * Manages the relationship between items and factories
 */
export class AqueductBuff {
    public target: Constructible;
    public buff: Buff;
    public baseProductivityUpgrade: KnockoutObservable<number>;
    public productivityUpgrade: KnockoutObservable<number>;
    public available: KnockoutComputed<boolean>;
    public visible: KnockoutComputed<boolean>;
    public scaling: KnockoutObservable<number>;


    /**
     * Creates a new EquippedItem instance
     * @param config - Configuration object for the equipped item
     * @param assetsMap - Map of all available assets
     */
    constructor(buff: Buff, factory: Constructible, _assetsMap: AssetsMap) {
        // Validate required parameters
        if (!buff) {
            throw new Error('AppliedBuff buff is required');
        }
        if (!factory) {
            throw new Error('AppliedBuff factory is required');
        }
        
        // Explicit assignments
        this.target = factory;
        this.buff = buff;
        this.scaling = ko.observable(0); // indicates wheter item/effect is not applied (0), applied (1), multiple times applied (> 1); child class updates this value

        this.baseProductivityUpgrade = ko.pureComputed(() => {
            return this.scaling() * this.buff.baseProductivityUpgrade;
        });

        this.productivityUpgrade = ko.pureComputed(() => {
            return this.scaling() * this.buff.productivityUpgrade;
        });

 
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

    }
}




/**
 * Manages a list of all extra goods production for a product
 * Simple array to collect all ExtraGoodProduction entries for this product
 */
export class ExtraGoodProductionList {
    public entries:  ExtraGoodProduction[];

    /**
     * Creates a new ExtraGoodProductionList instance
     * No parameters needed - will be populated as ExtraGoodProduction entries are created
     */
    constructor() {
        this.entries = [];
    }

    /**
     * Returns entries that have non-zero production
     */
    nonZero(): ExtraGoodProduction[] {
        return this.entries.filter((i: ExtraGoodProduction) => i.amount && i.amount() > 0);
    }

    /**
     * Returns total amount from all entries
     */
    amount(): number {
        let total = 0;
        for (const i of this.entries) {
            if (i.amount && typeof i.amount === 'function') {
                total += i.amount();
            }
        }
        return total;
    }
} 