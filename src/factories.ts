import { NamedElement, ACCURACY, EPSILON, ko, BuildingsCalc } from './util';
import { Workforce, WorkforceDemand } from './population';
import { Demand, Product, AqueductBuff, Item, Buff, ExtraGoodProduction } from './production';
import { AppliedBuff } from './buffs';
import {
    ConsumerConfig,
    AssetsMap,
    LiteralsMap,
} from './types';
import { Island, Region } from './world';
import { FactoryConfig, ModuleConfig } from './types.config';
import { ExtraGoodSupplier, Supplier } from './suppliers';


/**
 * Base class for all consumers in the game
 * Represents buildings that consume goods and require workforce
 * 
 * CONSUMER vs FACTORY DISTINCTION:
 * - Consumer: Base class for all buildings that consume resources (population buildings, public buildings, factories)
 * - Factory: Extends Consumer, specifically produces goods that other consumers can use
 * - PublicConsumerBuilding: Extends Consumer, provides services to population but doesn't produce goods
 * - Module: Extends Consumer, provides buffs to factories they're attached to
 */
export class Consumer extends NamedElement{
    // === BASIC PROPERTIES ===
    public guid: number;
    public isFactory: boolean;
    public island: Island;
    public associatedRegions: Region[];

    // === PRODUCTION CONFIGURATION ===
    public needsFuelInput: boolean;
    public defaultInputs: Map<Product, number>;
    public cycleTime: number;
    public maintenances: Map<Product|Workforce, number>;
    public connectedWorkforce?: Workforce;

    // === BUFF SYSTEM ===
    public items: AppliedBuff[];                            // Applied item effects
    public buffs: KnockoutObservableArray<AppliedBuff>;     // All applied effects (items + other sources)
    public aqueductBuff?: AqueductBuff;                     // Special aqueduct productivity buff
    public modules: Module[];                               // Attached modules (for factories)

    // === INPUT DEMAND SYSTEM ===
    public inputDemandsMap: Map<Product, Demand>;
    public inputDemands: KnockoutObservableArray<Demand>;
    public inputDemandFuel?: Demand;
    public workforceDemand!: WorkforceDemand;

    // === AMOUNT CALCULATION ===
    public boost: KnockoutObservable<number>;                    // Productivity multiplier from buffs
    public throughputByOutput: KnockoutObservable<number>;      // Required input based on desired output
    public throughputByExistingBuildings: KnockoutComputed<number>; // Required input based on constructed buildings
    public throughput: KnockoutComputed<number>;                // Final calculated input amount
    public useThroughputByExistingBuildings: KnockoutObservable<boolean>; // Whether to use existing buildings for calculation

    // === BUILDING MANAGEMENT ===
    public buildings: BuildingsCalc;       // Building count calculations (constructed/required/utilized)
    public editable: KnockoutObservable<boolean>; // Whether user can edit this consumer

    // === REACTIVE SUBSCRIPTIONS ===
    public boostSubscription!: KnockoutComputed<void>;           // Updates boost from buffs
    public buildingsSubscription!: KnockoutComputed<void>;       // Updates building requirements
    public inputDemandsSubscription!: KnockoutComputed<void>;    // Updates input demands based on replacements
    public workforceDemandSubscription?: KnockoutComputed<void>; // Updates workforce demand from buffs

    // === UI/DISPLAY ===
    public availableItems!: KnockoutComputed<AppliedBuff[]>;     // Items available for this consumer
    public product!: Product | null;                             // Primary product (for factories)


    /**
     * Creates a new Consumer instance
     * @param config - Configuration object for the consumer
     * @param assetsMap - Map of all available assets
     * @param island - The island this consumer belongs to
     */
    constructor(config: ConsumerConfig, assetsMap: AssetsMap, literalsMap: LiteralsMap, island: Island) {
        // Validate required parameters
        if (!config) {
            throw new Error('Consumer config is required');
        }
        if (!assetsMap) {
            throw new Error('Consumer assetsMap is required');
        }
        if (!island) {
            throw new Error('Consumer island is required');
        }

        super(config);
        this.guid = config.guid;
        
        // Explicit assignments
        this.isFactory = false;
        this.needsFuelInput = config.needsFuelInput;
        this.cycleTime = config.cycleTime;
        this.island = island;
        this.associatedRegions = [];
        for (var r of config.associatedRegions)
            this.associatedRegions.push(literalsMap.get(r) as Region);
 
        this.items = [];
        this.buffs = ko.observableArray([]);
        this.inputDemandsMap = new Map();
        this.inputDemands = ko.observableArray([]);

        // Initialize modules array
        this.modules = [];

        this.boost = ko.observable(1);
        this.editable = ko.observable(false);
        this.buildings = new BuildingsCalc();
        this.lockDLCIfSet(this.buildings.constructed);
        this.useThroughputByExistingBuildings = ko.pureComputed(() => this.editable() || this.buildings.fullyUtilizeConstructed());
        this.throughputByOutput = ko.observable(0);

        // Set up computed observables
        this.throughputByExistingBuildings = ko.computed(() => {
            return this.buildings.fullyUtilizeConstructed() ? this.buildings.constructed() * this.boost() * 60 /  this.cycleTime : 0 ;
        });

        this.throughput = ko.pureComputed(() => {
            let amount = this.throughputByOutput();
            if (this.useThroughputByExistingBuildings()) {
                amount = Math.max(amount, this.throughputByExistingBuildings());
            }
            return amount;
        });

        this.buildingsSubscription = ko.computed(() => {        
            this.buildings.required(this.throughput() / 60 * this.cycleTime / this.boost());
        }).extend({ deferred: true });
        this.lockDLCIfSet(this.buildings);

        this.defaultInputs = new Map();
        if (config.inputs) {
            for(var i of config.inputs){
                let product = assetsMap.get(i.product);
                if (!product) {
                    throw new Error(`Product with GUID ${i.product} not found in assetsMap`);
                }
                this.defaultInputs.set(product, i.amount);            
            }
        }

        this.maintenances = new Map();
        for(var i of config.maintenances){
            let product = assetsMap.get(i.product);
            if (!product) {
                throw new Error(`Product with GUID ${i.product} not found in assetsMap`);
            }
            this.maintenances.set(product, i.amount);    
            
            if (product instanceof Workforce)
                this.connectedWorkforce = product;
        }


        if (config.aqueductProductivityBuff != null){
            const buff = assetsMap.get(config.aqueductProductivityBuff);
            if (!buff) {
                throw new Error(`AqueductProductivityBuff with GUID ${config.aqueductProductivityBuff} not found in assetsMap`);
            }
            this.aqueductBuff = new AqueductBuff(buff, this, assetsMap);     
        }

        this.availableItems = ko.pureComputed(() => this.items.filter(i => i.available()));
    }


    /**
     * References products and sets up input demands
     * @param assetsMap - Map of all available assets
     */
    initDemands(assetsMap: AssetsMap): void {
        this.boostSubscription = ko.computed(() => {
            // Separate module buffs (multiplicative) from other buffs (additive)
            let additivePercentBuff = 0;
            let multiplicativeFactor = 1;

            // Unwrap observable array to track changes
            for (const buff of this.buffs()) {
                //if (this.isModuleBuff(buff)) {
                    // Module buffs are no longer multiplicative, but we keep the logic for now
                    //multiplicativeFactor *= (1 + buff.productivityUpgrade() / 100);
                //} else {
                    // Non-module buffs remain additive
                    additivePercentBuff += buff.productivityUpgrade();
                //}
            }

            // Add aqueduct buff to additive buffs
            if (this.aqueductBuff != null)
                additivePercentBuff += this.aqueductBuff.productivityUpgrade();

            // Combine additive and multiplicative factors
            const additiveFactor = Math.max(ACCURACY, additivePercentBuff / 100 + 1);
            const totalFactor = additiveFactor * multiplicativeFactor;

            this.boost(Math.max(ACCURACY, totalFactor));
        });

        this.inputDemandsSubscription = ko.computed(() => {
            if (!this.defaultInputs) {
                return;
            }

            const amount = this.throughput();

            const inputs = new Map() as Map<Product, number>;
            for (let product of this.defaultInputs.keys())
                inputs.set(product, this.defaultInputs.get(product) as number);

            const buffs = this.buffs().filter(item => item.replacements && item.scaling()).sort((a, b) => a.buff.guid as number - (b.buff.guid as number));
            
            for (const buff of buffs) {
                for (const replacement of buff.replacements || []) {
                    if (inputs.has(replacement[0])) {
                        const factor = inputs.get(replacement[0]) as number;
                        inputs.delete(replacement[0]);
                        if (replacement[1]) {
                            inputs.set(replacement[1], factor);
                        }
                    }
                }
            }

            const map = new Map();
            const demands = [];
            for (const p of inputs.keys()) {

                if (p.isAbstract) {
                    continue;
                }

                let d = this.inputDemandsMap.get(p);
                if (d) {
                    map.set(p, d);
                    demands.push(d);
                    this.inputDemandsMap.delete(p);
                    d.updateAmount(amount);
                } else {
                    d = new Demand(p, this,assetsMap, ko.observable(inputs.get(p)));
                    d.updateAmount(amount);
                    demands.push(d);
                    map.set(p, d);
                }
            }

            // Note: Demand-factory relationship removed - demands now resolved through Product.defaultSupplier

            this.inputDemandsMap = map;
            this.inputDemands.removeAll();
            for (const d of demands) this.inputDemands.push(d);
        });

        if (this.needsFuelInput){
            let product = assetsMap.get(window.view.constants.fuelProduct);
            if (!product) {
                throw new Error(`Fuel product with GUID ${window.view.constants.fuelProduct} not found in assetsMap`);
            }
            let cycleTime = window.view.constants.fuelProductionTime as number;

            const fuelFactor = ko.pureComputed(() => {
                const percentBuff = this.buffs().reduce((a:number, b: AppliedBuff)=> a+b.fuelDurationPercent() , 0);
                const factor = percentBuff / 100 + 1;

                return this.cycleTime / (factor * cycleTime) / this.boost();
            });
            this.inputDemandFuel = new Demand(product, this, assetsMap, fuelFactor);
            this.buildings.utilized.subscribe(buildings => this.inputDemandFuel!.updateAmount(buildings));
        }

        this.modules.forEach(m => m.initDemands(assetsMap));
        // demand for modules is updated when their number of constructed buildings is updated, see constructor of Module

        this.createWorkforceDemand();
    }

    /**
     * Creates workforce demand for this consumer
     * @param assetsMap - Map of all available assets
     * @returns The created workforce demand or null
     */
    createWorkforceDemand(): void {
        if (this.connectedWorkforce == null)
            return;


        this.workforceDemand = new WorkforceDemand(
            this, 
            this.connectedWorkforce,
            this.maintenances.get(this.connectedWorkforce) as number
        );

        this.workforceDemandSubscription = ko.computed(() => {
            // for workforce replacement, the last applied item matters
            const buffs = this.buffs().filter(item => item.replacingWorkforce && (item.replacingWorkforce as any) != this.connectedWorkforce && item.scaling()).sort((a, b) => b.parent.guid as number - (a.parent.guid as number));
            if (buffs.length && this.workforceDemand) {
                this.workforceDemand.updateWorkforce(buffs[0].replacingWorkforce);
            } else if (this.workforceDemand) {
                this.workforceDemand.updateWorkforce(null);
            }

            const percentBuff = this.buffs().reduce((a:number, b: AppliedBuff)=> a+b.workforceMaintenanceFactorUpgrade() , 0);
            const factor = Math.max(0, percentBuff / 100 + 1);
            this.workforceDemand.boost(factor);
        });
 
    }

    /**
     * Gets the extended name including region information
     * @returns The extended name
     */
    getRegionExtendedName(): string {
        if (this.product && this.product.factories.length <= 1) {
            return this.name();
        }

        return `${this.name()} (${this.associatedRegions[0].name() || 'Unknown Region'})`;
    }

    /**
     * Gets the icon for this consumer
     * @returns The icon path
     */
    getIcon(): string {
        return this.icon || '';
    }


    addBuff(appliedBuff: AppliedBuff){
        this.buffs.push(appliedBuff)

        if(appliedBuff.parent instanceof Item)
            this.items.push(appliedBuff);
    }

    /**
     * Determines if an applied buff comes from a module
     * @param appliedBuff - The applied buff to check
     * @returns True if the buff comes from a module
     */
    isModuleBuff(appliedBuff: AppliedBuff): boolean {
        return appliedBuff.parent instanceof Module;
    }
}

/**
 * Represents a module that can be attached to factories
 * Modules provide buffs to their parent factory when activated
 */
export class Module extends Consumer {
    // === MODULE-SPECIFIC PROPERTIES ===
    public factory: Factory;                               // Parent factory this module is attached to
    public checked: KnockoutObservable<boolean>;           // Whether module is activated
    public visible: KnockoutComputed<boolean>;             // Whether module is visible in UI

    // === BUFF MANAGEMENT ===
    public triggeredBuffsGuids: number[];                  // GUIDs of buffs this module provides
    public triggeredBuffs: AppliedBuff[];                  // Actual buff instances applied to factory

    // === REACTIVE SUBSCRIPTIONS ===
    public constructedSubscription: KnockoutComputed<void>; // Updates constructed buildings based on factory
    
    /**
     * Creates a new Module instance
     * @param config - Configuration object for the module
     * @param assetsMap - Map of all available assets
     * @param island - The island this module belongs to
     * @param factory - The factory this module is attached to
     */
    constructor(config: ModuleConfig, assetsMap: AssetsMap, literalsMap: LiteralsMap, factory: Factory) {
        super({...config, maintenances: []}, assetsMap, literalsMap, factory.island);

        // Module-specific initialization
        this.isFactory = false;
        this.factory = factory;
        this.triggeredBuffs = [];
        this.triggeredBuffsGuids = config.buffs

        this.checked = ko.observable(false);
        this.lockDLCIfSet(this.checked);
        this.visible = ko.pureComputed(() => this.available());

        // Enable throughput calculation based on utilized buildings (includes both constructed and required)
        this.buildings.fullyUtilizeConstructed(true);

        this.constructedSubscription = ko.computed(() => {
            this.buildings.constructed(this.checked() ? this.factory.buildings.utilized() : 0);
        })
    }

    applyBuffs(assetsMap: AssetsMap): void {
        // Create AppliedBuff if factory is provided and module has functional effects
        for (const buffGuid of this.triggeredBuffsGuids) {
            const buff = assetsMap.get(buffGuid) as Buff;
            if(buff != null){
                const appliedBuff = new AppliedBuff(
                    this,
                    buff,
                    this.factory,
                    assetsMap,
                    false // Don't use parent scaling - module controls scaling via checked state
                );
                // Set initial scaling based on current checked state
                appliedBuff.scaling(this.checked() ? 1 : 0);
                this.triggeredBuffs.push(appliedBuff);

                // Note: AppliedBuff constructor already calls this.factory.addBuff(appliedBuff) at line 139
            }
        }

        // Set up subscription to update buff scaling when module checked state changes
        this.checked.subscribe((checked: boolean) => {
            for (const triggeredBuff of this.triggeredBuffs) {
                triggeredBuff.scaling(checked ? 1 : 0);
            }
        });
    }
    
    getInputs(): Map<Product, number> {
        return this.defaultInputs || [];
    }
}

/**
 * Represents a public consumer building (schools, hospitals, fire stations, etc.)
 * These buildings provide services to population but don't produce goods for consumption chains
 */
export class PublicConsumerBuilding extends Consumer {
    // === PUBLIC BUILDING PROPERTIES ===
    public product: Product;                              // Associated product/service (if any)


    // === OPTIONAL RECIPE SYSTEM ===
    public goodConsumptionUpgrade?: Product;                     // Product used for consumption upgrades
    public recipeName?: KnockoutComputed<string>;                // Display name for recipe variants

    /**
     * Creates a new PublicConsumerBuilding instance
     * @param config - Configuration object for the building
     * @param assetsMap - Map of all available assets
     * @param island - The island this building belongs to
     */
    constructor(config: any, assetsMap: AssetsMap, literalsMap: LiteralsMap, island: Island) {
        super(config, assetsMap, literalsMap, island);

        // Explicit assignments
        this.product = config.product ? (() => {
            const product = assetsMap.get(parseInt(config.product));
            if (!product) {
                throw new Error(`Product with GUID ${config.product} not found in assetsMap`);
            }
            return product;
        })() : null;
    }

    /**
     * Checks if this public consumer building is visible
     * @returns True if the building is visible
     */
    visible(): boolean {
        return this.available();
    }
}



/**
 * Represents a factory that produces goods for consumption by other consumers
 * Extends Consumer to provide production chain functionality
 * Implements Supplier interface to participate in the supplier selection system
 *
 * KEY DIFFERENCE FROM CONSUMER:
 * - Consumer: Consumes resources (inputs) for internal use (population needs, public services)
 * - Factory: Consumes resources (inputs) to PRODUCE goods (outputs) that feed other consumers
 * - Factory outputs become inputs for other consumers in the production chain
 */
export class Factory extends Consumer implements Supplier {
    // === SUPPLIER INTERFACE ===
    public readonly type: 'factory' = 'factory';            // Supplier type identifier
    public readonly product!: Product;
    // island properties inherited from Consumer

    // === FACTORY IDENTIFICATION ===
    public isFactory: boolean;                              // Always true for Factory instances

    // === PRODUCTION OUTPUTS ===
    public outputs: Product[];                              // Products this factory produces

    // === DEMAND MANAGEMENT ===
 
    // Three sources of production demand:
    public demandFromProduct: KnockoutObservable<number>;   // Demand set via Supplier interface by Product
    public throughputByExtraGoodSupplier:  KnockoutObservable<number>;  // Demand generated because extra goods are default suppliers
    // filled by the extra goods from this factory
    private extraGoodSuppliers: KnockoutObservableArray<ExtraGoodSupplier>;
    public throughputByOutputSubscriptions: KnockoutComputed<void>;

    // === PRODUCTION CALCULATION ===
    public selfEffectingExtraGoods: ExtraGoodProduction[];                  // Extra good entries where factory produces extra of its own output
    public extraGoodFactor: KnockoutComputed<number>;        // Multiplier from extra goods affecting this factory
    public outputAmount: KnockoutComputed<number>;           // Total output produced
    public substitutableOutputAmount: KnockoutComputed<number>; // Output that can be substituted
    public overProduction: KnockoutComputed<number>;         // Excess production over demand
    public isHighlightedAsMissing: KnockoutComputed<boolean>;

    /**
     * Creates a new Factory instance
     * @param config - Configuration object for the factory
     * @param assetsMap - Map of all available assets
     * @param island - The island this factory belongs to
     * @param moduleConfigs - Optional module configurations from params
     */
    constructor(config: FactoryConfig, assetsMap: AssetsMap, literalsMap: LiteralsMap, island: Island, moduleConfigs?: ModuleConfig[]) {
        super(config, assetsMap, literalsMap, island);
        
        // Explicit assignments
        this.isFactory = true;
        this.outputs = []
        for (let entry of config.outputs) {
            const product = assetsMap.get(entry.product);
            if (!product) {
                throw new Error(`Product with GUID ${entry.product} not found in assetsMap`);
            }
            this.outputs.push(product);
        }
        var product = this.getProduct();
        if (product == null)
            throw new Error(`Factory with GUID ${this.guid} has no products`);
        this.product = product;

        if (this.product.isConstructionMaterial)
            this.buildings.fullyUtilizeConstructed(true);

        // Self-effecting extra goods will be populated when ExtraGoodProduction entries are created
        this.selfEffectingExtraGoods = [];


        // Initialize demand tracking
        this.demandFromProduct = ko.observable(0);
        this.extraGoodSuppliers = ko.observableArray();


        // Create Module instance if factory has additionalModule
        if (config.additionalModule && moduleConfigs) {
            const moduleConfig = moduleConfigs.find(m => m.guid === config.additionalModule);
            if (moduleConfig) {
                const module = new Module(moduleConfig, assetsMap, literalsMap, this);
                this.modules.push(module);
                
            }
        }

        this.extraGoodFactor = ko.computed(() => {
            let factor = 1;

            // Self-effecting extra goods boost this factory's production
            for (const e of this.selfEffectingExtraGoods) {
                factor += e.item.scaling() * e.defaultAmount / e.additionalOutputCycle;
            }

            return factor;
        });

        this.throughputByExtraGoodSupplier = ko.pureComputed(() => {
            var demand = 0;

            for (const supplier of this.extraGoodSuppliers()) {
                demand = Math.max(demand, supplier.throughput());
            }

            return demand;
        });

        // Calculate maximum demand from all three sources
        this.throughputByOutputSubscriptions = ko.computed(() => {
            let maxDemand = 0;

            // 1. Demand from product (set via Supplier interface)
            maxDemand = Math.max(maxDemand, this.demandFromProduct() / this.extraGoodFactor());

            // 2. Demand from fully utilized buildings
            // handled in this.output

            // 3. Maximum demand from all ExtraGoodSuppliers
            maxDemand = Math.max(maxDemand, this.throughputByExtraGoodSupplier());

            this.throughputByOutput(maxDemand);
        });

        // Factory produces the maximum of all demand sources
        this.outputAmount = ko.pureComputed(() => {
            const diff = this.throughput() * this.extraGoodFactor();
            return diff > EPSILON ? diff : 0;
        });

        this.substitutableOutputAmount = ko.pureComputed(() => {
            return Math.max(0, this.demandFromProduct() - Math.max(this.throughputByExtraGoodSupplier(), this.throughputByExistingBuildings()));
        });
        

        this.overProduction = ko.pureComputed(() => Math.max(0, this.outputAmount() - this.demandFromProduct()));

        this.isHighlightedAsMissing = ko.pureComputed(() => {
            if (!window.view.settings.missingBuildingsHighlight || !window.view.settings.missingBuildingsHighlight.checked())
                return false;

            if (!this.isDefaultSupplier())
                return false;

            return this.buildings.required() > this.buildings.constructed() + ACCURACY;

        });
 
        (this.getProduct() as Product).addFactory(this);
    }

    /**
     * Gets the output products for this factory
     * @returns Array of output products
     */
    getOutputs(): Product[] {
        return this.outputs || [];
    }

    /**
     * References products and sets up factory-specific relationships
     * @param assetsMap - Map of all available assets
     */
    initDemands(assetsMap: AssetsMap): void {
        super.initDemands(assetsMap);

        this.modules.forEach(m => m.applyBuffs(assetsMap));

        if (!this.icon && this.product)
            this.icon = this.product.icon as string;


        this.buildings.utilized.subscribe((b: number) => {
            if (this.workforceDemand)
                this.workforceDemand.updateAmount(b);

        });
    }

    /**
     * Gets the primary product produced by this factory
     * @returns The primary product or null
     */
    getProduct(): Product | null {
        return this.getOutputs()[0];
    }

    /**
     * Gets the icon for this factory
     * @returns The icon path
     */
    getIcon(): string {
        const product = this.getProduct();
        return product ? product.icon as string : super.getIcon();
    }


    /**
     * Adds a demand to this factory
     * @param demand - The demand to add
     */
    addExtraGoodSupplier(supplier: ExtraGoodSupplier): void {
        this.extraGoodSuppliers.push(supplier);
    }

    /**
     * Removes a demand from this factory
     * @param demand - The demand to remove
     */
    removeExtraGoodSupplier(supplier: ExtraGoodSupplier): void {
        this.extraGoodSuppliers.remove(supplier);
    }

    // === SUPPLIER INTERFACE IMPLEMENTATION ===

    /**
     * Returns the the production amount (Supplier interface) if this factory would NOT be the default supplier
     * Includes extra goods factor for accurate production calculation
     */
    defaultProduction(): number {
        return Math.max(this.throughputByExistingBuildings(), this.throughputByExtraGoodSupplier()) * this.extraGoodFactor();
    }

    currentProduction(): number {
        return this.outputAmount();
    }

    /**
     * Checks if this factory can supply the requested amount (Supplier interface)
     * @param amount - The requested amount
     * @returns True if factory is available and in correct region
     */
    canSupply(): boolean {
        return this.available();
    }

    isDefaultSupplier(): boolean {
        return this.product.defaultSupplier() === this;
    }

    setAsDefaultSupplier(): void {
        if (!this.canSupply())
            return;

        this.product.updateDefaultSupplier(this);
    }

    /**
     * Sets the demand for this factory to produce (Supplier interface)
     * @param amount - The requested production amount
     */
    setDemand(amount: number): void {
        this.demandFromProduct(amount);
    }

    unsetAsDefaultSupplier(): void {
        this.demandFromProduct(0);
    }


    // inputAmount is now handled as a computed property in the constructor
} 