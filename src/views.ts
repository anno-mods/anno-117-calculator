import { ACCURACY, BuildingsCalc, formatNumber, ko, NamedElement } from './util';
import { PopulationGroup, PopulationLevel, ResidenceBuilding, Workforce } from './population';
import { ResidenceEffectCoverage, ResidenceEffect, ResidenceNeed, NeedCategory, Need, PopulationLevelNeed } from './consumption';
import { ProductCategory, Product, Demand } from './production';
import { Consumer, Factory, Module } from './factories';
import { TradeRoute } from './trade';
import { ExtraGoodSupplier, PassiveTradeSupplier } from './suppliers';


declare const $: any;
declare const view: any;
declare const window: any;



/**
 * Manages dark mode functionality for the application
 * Handles theme switching and CSS class management
 */
export class DarkMode {
    public checked: any;
    public classAdditions: Record<string, string>;

    /**
     * Creates a new DarkMode instance
     * Initializes dark mode state and loads saved preference
     */
    constructor() {
        // Explicit assignments
        this.checked = ko.observable(false);

        this.classAdditions = {
            "body": "bg-dark",
            //".ui-fieldset legend, body": "text-light",
            //".form-control": "text-light bg-dark bg-darker",
            //".custom-select": "text-light bg-dark bg-darker",
            //".input-group-text, .modal-content": "bg-dark text-light",
            //".btn-default": "btn-dark btn-outline-light",
            //".btn-light": "btn-dark",
            //".ui-fchain-item": "bg-dark",
            //".card": "bg-dark"
        };

        this.checked.subscribe(() => this.apply());

        if (localStorage) {
            let id = "darkMode.checked";
            const stored = localStorage.getItem(id);
            if (stored != null)
                this.checked(parseInt(stored));

            this.checked.subscribe((val: boolean) => localStorage.setItem(id, val ? "1" : "0"));
        }
    }

    /**
     * Toggles the dark mode state
     */
    toggle(): void {
        this.checked(!this.checked());
    }

    /**
     * Applies or removes dark mode CSS classes based on current state
     */
    apply(): void {
        if (this.checked())
            Object.keys(this.classAdditions).forEach((key) => $(key).addClass(this.classAdditions[key]));
        else
            Object.keys(this.classAdditions).reverse()
                .forEach((key) => $(key).removeClass(this.classAdditions[key]));
    }
}

/**
 * Manages different view modes for the application
 * Provides preset configurations for different user scenarios
 */
export class ViewMode {
    /**
     * Creates a new ViewMode instance
     */
    constructor() {
        // No explicit assignments needed for this constructor
    }

    /**
     * Applies settings for the "Start" view mode
     * Enables missing buildings highlight and other beginner-friendly features
     */
    start(): void {
        view.settings.missingBuildingsHighlight.checked(true);
        view.islandManager.activateAllNeeds.checked(false);
        //view.settings.needUnlockConditions.checked(true);

        setTimeout(() => $('#island-management-dialog').modal('show'), 250);
    }

    /**
     * Applies settings for the "Plan" view mode
     * Enables decimal precision and configures DLC settings for planning
     */
    plan(): void {
        view.settings.decimalsForBuildings.checked(true);

        for (const effect of window.view.globalEffects) {
            effect.scaling(1);
        }

        for (var dlc of view.dlcs.values()) {
            dlc.checked(true);
        }

        for (var dlcIndex of [0, 2, 8, 11]) {
            var d = view.dlcsMap.get("dlc" + dlcIndex);
            if (d)
                d.checked(false);
        }
    }

    /**
     * Applies settings for the "Master" view mode
     * Enables all options and DLCs for advanced users
     */
    master(): void {
        for (var option of view.settings.options)
            option.checked(true);

        //view.settings.hideProductionBoost.checked(false);

        for (const effect of window.view.globalEffects) {
            effect.scaling(1);
        }

        for (var dlc of view.dlcs.values()) {
            dlc.checked(true);
        }
    }
}

/**
 * Template system for creating hierarchical data structures
 * Manages parent-child relationships between assets and their instances
 */
export class Template {
    public attributeName: string;
    public index: number;
    public name: string;
    public recipeName: string;
    public guid: number;
    public getRegionExtendedName: any;
    public editable: boolean;
    public region: string;
    public hotkey: string;
    public templates: Template[];
    public parentInstance: any;
    public instance: KnockoutObservable<NamedElement>;
    [key: string]: any; // Index signature for dynamic properties

    /**
     * Creates a new Template instance
     * @param asset - The asset to create a template for
     * @param parentInstance - The parent instance
     * @param attributeName - The name of the attribute in the parent
     * @param index - The index of this template in the parent's array
     */
    constructor(asset: any, parentInstance: any, attributeName: string, index: number) {
        // Validate required parameters
        if (!asset) {
            throw new Error('Template asset is required');
        }
        if (!parentInstance) {
            throw new Error('Template parentInstance is required');
        }
        if (!attributeName) {
            throw new Error('Template attributeName is required');
        }
        if (typeof index !== 'number') {
            throw new Error('Template index is required and must be a number');
        }

        // Explicit assignments
        this.attributeName = attributeName;
        this.index = index;

        this.name = asset.name;
        this.recipeName = asset.recipeName;
        this.guid = asset.guid;
        this.getRegionExtendedName = asset.getRegionExtendedName;
        this.editable = asset.editable;
        this.region = asset.region;
        this.hotkey = asset.hotkey;

        this.templates = [];
        this.parentInstance = ko.observable(parentInstance);

        this.instance = ko.computed(() => {
            var p = this.parentInstance();

            var inst = p[this.attributeName][this.index];

            this.templates.forEach(t => t.parentInstance(inst));

            return inst;
        });

        for (var attr in asset) {
            var val = asset[attr];

            if (val instanceof Array) {
                this[attr] = val.map((a: any, index: number) => {
                    if (Template.applicable(asset)) {
                        var t = new Template(a, this.instance(), attr, index);
                        this.templates.push(t);
                        return t;
                    } else
                        return a;
                });
            }
            else if (!ko.isObservable(val) && !ko.isComputed(val) && asset.hasOwnProperty(attr))
                this[attr] = val;

        }
    }

    /**
     * Checks if an asset type is applicable for templating
     * @param asset - The asset to check
     * @returns True if the asset can be templated
     */
    static applicable(asset: any): boolean {
        return asset instanceof PopulationGroup ||
            asset instanceof PopulationLevel ||
            asset instanceof ResidenceBuilding ||
            asset instanceof Workforce ||
            asset instanceof ProductCategory ||
            asset instanceof Product ||
            asset instanceof Demand;
    }
}

/**
 * Manages the display of production chains
 * Creates hierarchical tree structures for visualizing factory dependencies
 */
export class ProductionChainView {
    public factory: KnockoutObservable<Consumer | null> | KnockoutObservable<Product>;
    public amount: KnockoutObservable<number> | null;
    public tree: any;
    public breadth: KnockoutObservable<number>;

    /**
     * Creates a new ProductionChainView instance
     * @param factory - The factory to create a chain for
     * @param amount - Optional amount to base calculations on
     */
    constructor(factory: KnockoutObservable<Consumer | null> | KnockoutObservable<Product>, amount: KnockoutObservable<number> | null = null) {
        // Validate required parameters
        if (!factory) {
            throw new Error('ProductionChainView factory is required');
        }

        // Explicit assignments
        this.factory = factory;
        this.amount = amount;

        this.tree = ko.pureComputed(() => {
            if(this.factory() == null)
                return null;

            let traverse = (consumer: Factory | Consumer | Product, amount: number): any => {
                    if (amount < ACCURACY)
                        return null;

                    var regionIcon = null;

                    if (!(consumer instanceof Factory || consumer instanceof Product)){
                        if (window.view.island().region.id == "Meta" )
                            regionIcon = consumer.associatedRegions[0].icon;
                        return {
                            'amount': amount,
                            'product': consumer,
                            'regionIcon': regionIcon,
                            'buildings': amount * consumer.cycleTime / 60 / consumer.boost(),
                            'children': consumer.inputDemands().map((d) => {
                                const supplier = d.product.defaultSupplier();
                                if (supplier && supplier.type === 'factory') {
                                    return traverse(supplier as any, amount * d.factor());
                                }
                                return null;
                            }).filter((d) => d)
                        }; 
                    }

                    var icon = null;
                    
                    if (consumer instanceof Product && consumer.defaultSupplier()?.type != "factory"){
                        const supplier = consumer.defaultSupplier();
                        if (supplier == null){
                            icon = "./icons/icon_not_obtaining.png"
                            amount = 0;
                        }
                        if (supplier instanceof TradeRoute){
                            icon = "./icons/icon_trade_routes_0.webp"
                        }
                        if (supplier instanceof ExtraGoodSupplier) {
                            icon = "./icons/icon_extra_goods.webp"
                        } 
                        if (supplier instanceof PassiveTradeSupplier){
                            icon = "./icons/icon_trade_routes_0.webp"
                        }

                        if(!icon){
                            console.log(supplier);
                            throw new Error(`Unhadeled supplier ${supplier?.type}`);
                        }

                        return {
                            'amount': amount,
                            'product': consumer,
                            'regionIcon': regionIcon,
                            'children': [],
                            'icon': icon
                        }
                    }
                    
                    const factory = consumer instanceof Factory ? consumer : consumer.defaultSupplier();

                    if (!(factory instanceof Factory)){
                        console.log(factory);
                        throw new Error(`Expected factory ${factory?.type}`);
                    }

                    if (window.view.island().region.id == "Meta" )
                        regionIcon = factory.associatedRegions[0].icon;

                    var inputAmount = amount / (factory.extraGoodFactor?.() || 1);
                    const buildings = inputAmount * factory.cycleTime / 60 / factory.boost();
                    var children = factory.inputDemands().map((d) => {
                        return traverse(d.product, inputAmount * d.factor());
                    }).filter((d) => d);

                    var buildingDemands = factory.modules.flatMap(m => m.checked() ? m.inputDemands() : []);
                    for (const d of buildingDemands) {
                        children.push(traverse(d.product, buildings * d.factor() * 60 / (d.consumer as Module).cycleTime));
                    }

                    if (factory.inputDemandFuel) {
                        children.push(traverse(factory.inputDemandFuel.product, buildings * factory.inputDemandFuel.factor()));
                    }
 

                    return {
                        'amount': amount,
                        'product': factory.getProduct(),
                        'regionIcon': regionIcon,
                        'buildings': buildings,
                        'children': children
                    };           

            };

            var amount = this.amount;
            const consumer = this.factory() as Consumer;
            if (amount == null){
                if (consumer instanceof Product)
                    amount = consumer.totalDemand;
                else if (consumer instanceof Factory)
                    amount = consumer.outputAmount;
                else 
                    amount = consumer.throughput;
            }
            return traverse(consumer, amount());
             
        });

        this.breadth = ko.pureComputed(() => {
            if (this.tree() == null)
                return 0;

            var traverse = (node: any): number => Math.max(1, (node.children || []).map((n: any) => traverse(n)).reduce((a: number, b: number) => a + b, 0));

            return traverse(this.tree());
        })
    }
}

/**
 * Aggregates residence effect coverage data
 * Manages multiple coverage instances for the same residence effect
 */
class ResidenceEffectAggregate {
    public totalResidences: any;
    public residenceEffect: ResidenceEffect;
    public coverage: ResidenceEffectCoverage[];
    public averageCoverage: any;

    /**
     * Creates a new ResidenceEffectAggregate instance
     * @param totalResidences - Total number of residences
     * @param residenceEffectCoverage - The initial coverage
     */
    constructor(totalResidences: any, residenceEffectCoverage: ResidenceEffectCoverage) {
        // Validate required parameters
        if (!totalResidences) {
            throw new Error('ResidenceEffectAggregate totalResidences is required');
        }
        if (!residenceEffectCoverage) {
            throw new Error('ResidenceEffectAggregate residenceEffectCoverage is required');
        }

        // Explicit assignments
        this.totalResidences = totalResidences;
        this.residenceEffect = residenceEffectCoverage.residenceEffect;

        this.coverage = [residenceEffectCoverage];
    }

    /**
     * Adds another coverage instance to this aggregate
     * @param residenceEffectCoverage - The coverage to add
     */
    add(residenceEffectCoverage: ResidenceEffectCoverage): void {
        this.coverage.push(residenceEffectCoverage);
    }

    /**
     * Finalizes the aggregate by computing average coverage
     */
    finishInitialization(): void {
        this.averageCoverage = ko.pureComputed(() => {
            var sum = 0;
            this.coverage.forEach(coverage => { sum += coverage.residence.buildings.constructed() * coverage.coverage(); });

            return sum / this.totalResidences();
        });
    }
}

/**
 * Manages the display and editing of residence effects
 * Provides interface for applying effects to residences
 */
export class ResidenceEffectView {
    public heading: string;
    public residences: ResidenceBuilding[];
    public percentCoverage: KnockoutObservable<number>;
    public totalResidences: KnockoutComputed<number>;
    public consumedProducts: Set<Product>;
    public allEffects: ResidenceEffect[];
    public aggregates: KnockoutObservableArray<ResidenceEffectAggregate>;
    public unusedEffects: KnockoutObservableArray<ResidenceEffect>;
    public need: PopulationLevelNeed | ResidenceNeed | null;
    public productionChain: ProductionChainView | null;
    public selectedEffect: KnockoutObservable<ResidenceEffect>;
    public region: string | null = null;

    /**
     * Creates a new ResidenceEffectView instance
     * @param residences - Array of residences to manage effects for
     * @param heading - Optional heading for the view
     * @param need - Optional specific need to focus on
     */
    constructor(residences: ResidenceBuilding[], heading: string | null = null, need: PopulationLevelNeed | ResidenceNeed | null = null) {
        // Validate required parameters
        if (!residences || !Array.isArray(residences)) {
            throw new Error('ResidenceEffectView residences array is required');
        }

        // Explicit assignments
        this.heading = heading || window.view.texts.goodsConsumption.name;
        this.residences = residences.filter(r => r.available());
        this.percentCoverage = ko.observable(100);

        this.totalResidences = ko.pureComputed(() => {
            var sum = 0;
            this.residences.forEach(r => { sum += r.buildings.constructed(); });
            return sum;
        });

        var effects = new Set<ResidenceEffect>();
        var aggregatesMap = new Map<ResidenceEffect, ResidenceEffectAggregate>();
        this.consumedProducts = new Set();
        this.residences.forEach(r => {
            r.needsMap.forEach((n) => {
                this.consumedProducts.add(n.need.product);
            });

            r.allEffects.forEach((e: ResidenceEffect) => {
                if (e.available() && (need == null || e.effectsPerNeed.has(need.need.product.guid)))
                    effects.add(e);
            });

            r.effectCoverage().forEach((c: ResidenceEffectCoverage) => {
                var e = c.residenceEffect;
                if (aggregatesMap.has(e)) {
                    aggregatesMap.get(e)!.add(c);
                } else {
                    aggregatesMap.set(e, new ResidenceEffectAggregate(this.totalResidences, c));
                }
            })
        });

        this.allEffects = [...effects];        
        
        this.aggregates = ko.observableArray([]);
        aggregatesMap.forEach((a, e) => {
            a.finishInitialization();
            effects.delete(e);
            this.aggregates.push(a);
        });
        this.unusedEffects = ko.observableArray([...effects]);

        this.need = need;
        if (this.need) 
            this.productionChain = new ProductionChainView(ko.observable(this.need.product), this.need.amount);
        else 
            this.productionChain = null;
        

        this.sort();
        this.selectedEffect = ko.observable(this.unusedEffects()[0]);
        view.settings.language.subscribe(() => {
            this.sort();
        })
    }

    /**
     * Creates a new residence effect coverage
     * Applies the selected effect to the residences
     */
    create(): void {
        var e = this.selectedEffect();
        var a: ResidenceEffectAggregate | null = null;
        e.residences.forEach((r: ResidenceBuilding) => {
            if (this.residences.indexOf(r) == -1)
                return;

            var c = new ResidenceEffectCoverage(r, e);
            r.addEffectCoverage(c);

            if (a == null) {
                a = new ResidenceEffectAggregate(this.totalResidences, c);
            } else {
                a.add(c);
            }
        });

        if (a != null) {
            this.unusedEffects.remove(e);
            this.aggregates.push(a);
            this.sort();
        }
    }

    /**
     * Deletes a residence effect aggregate
     * Removes the effect coverage from all affected residences
     * @param aggregate - The aggregate to delete
     */
    delete(aggregate: ResidenceEffectAggregate): void {
        aggregate.coverage.forEach(coverage => {
            coverage.residence.removeEffectCoverage(coverage);
        });

        this.unusedEffects.push(aggregate.residenceEffect);
        this.aggregates.remove(aggregate);
        this.sort();
        this.selectedEffect(aggregate.residenceEffect);
        this.percentCoverage(aggregate.coverage[0].coverage() * 100);
    }

    /**
     * Sorts the effects and aggregates by priority
     */
    sort(): void {
        this.aggregates.sort((a: ResidenceEffectAggregate, b: ResidenceEffectAggregate) => a.residenceEffect.compare(b.residenceEffect));
        this.unusedEffects.sort((a: ResidenceEffect, b: ResidenceEffect) => a.compare(b));
    }


}

/**
 * Manages the collapsed state of a collapsible section
 * Tracks whether a section is expanded or collapsed
 */
class Collapsible {
    public id: string;
    public collapsed: any;

    /**
     * Creates a new Collapsible instance
     * @param id - Unique identifier for the collapsible section
     * @param collapsed - Initial collapsed state
     */
    constructor(id: string, collapsed: boolean) {
        // Validate required parameters
        if (!id) {
            throw new Error('Collapsible id is required');
        }

        // Explicit assignments
        this.id = id;
        this.collapsed = ko.observable(!!collapsed);
    }
}

/**
 * Manages the state of all collapsible sections in the application
 * Handles persistence and retrieval of collapsed states
 */
export class CollapsibleStates {
    public key: string;
    public collapsibles: any;
    public collapsiblesSubscription: any;

    /**
     * Creates a new CollapsibleStates instance
     * Initializes from localStorage if available
     */
    constructor() {
        // Explicit assignments
        this.key = "collapsibleStates";
        this.collapsibles = ko.observableArray([]);

        if (localStorage) {
            try {
                let json = JSON.parse(localStorage.getItem(this.key) || '{}');
                for (var id in json)
                    this.collapsibles.push(new Collapsible(id, parseInt(json[id]) !== 0))
            } catch (e) {
                console.error(e);
            }

            this.collapsiblesSubscription = ko.computed(() => {
                var json: Record<string, number> = {};
                for (var c of this.collapsibles())
                    json[c.id] = c.collapsed() ? 1 : 0;

                localStorage.setItem(this.key, JSON.stringify(json));
            });
        }
    }

    /**
     * Gets or creates a collapsible state for the given ID
     * @param id - The unique identifier for the collapsible section
     * @param collapsed - Default collapsed state if creating new
     * @returns The collapsible state object
     */
    get(id: string, collapsed: boolean): Collapsible {
        for (var existingCollapsible of this.collapsibles())
            if (existingCollapsible.id == id)
                return existingCollapsible;

        var newCollapsible = new Collapsible(id, collapsed);
        this.collapsibles.push(newCollapsible);
        return newCollapsible;
    }
} 

class PopulationLevelNeedPresenter {
    public parent: NeedCategoryPresenter;
    public guid: number;
    public id: string;
    public residentsPerResidence: number;
    private instance: KnockoutObservable<PopulationLevelNeed | undefined>;
    public name: KnockoutObservable<string>;
    public visible: KnockoutComputed<boolean>;
    public amount: KnockoutComputed<number>;
    public checked: KnockoutComputed<boolean>;
    public isInactive: KnockoutComputed<boolean>;
    public product: KnockoutObservable<Product>;
    public residents: KnockoutComputed<number>;

    constructor(parent: NeedCategoryPresenter, need: Need){
        this.parent = parent;
        this.guid = need.guid;
        this.id = "residence-" + this.guid;
        this.residentsPerResidence = need.residents;
        this.instance = ko.observable();
        this.name = ko.pureComputed(() => need.product.name());
        this.visible =  ko.pureComputed(() => !!this.instance());
        this.product = ko.pureComputed(() => need.product);
        this.amount = ko.pureComputed(() => {
            let inst = this.instance();
            if(inst == null)
                return 0;

            return inst.amount();
        });
        this.checked = ko.pureComputed({
            read: () => this.instance()?.checked(),
            write: (checked: boolean) => {
                if(this.instance())
                    this.instance()?.checked(checked);

            }
        });
        this.isInactive =  ko.pureComputed(() => false);
        this.residents = ko.pureComputed(() => {
            let inst = this.instance();
            if(inst == null)
                return 0;

            return inst.residents();
        });
    }

    update(need?: PopulationLevelNeed){
        this.instance(need);
    }
    
    prepareResidenceEffectView(): void {
        window.view.selectedResidenceEffectView(new ResidenceEffectView([this.parent.parent.residence()], this.name(), this.instance()));
    }
}

class NeedCategoryPresenter {
    public parent: ResidencePresenter;
    public id: string;
    public name: KnockoutObservable<string>;
    public visible: KnockoutComputed<boolean>;
    public checked: KnockoutComputed<boolean>;
    public populationLevelNeeds: KnockoutObservableArray<PopulationLevelNeedPresenter>;
    public visiblePopulationLevelNeeds: KnockoutObservableArray<PopulationLevelNeedPresenter>;

    constructor(parent: ResidencePresenter, needCategory: NeedCategory){
        this.parent = parent;
        this.id = "residence-" + needCategory.id;

        this.name = ko.pureComputed(() => needCategory.name());
        this.populationLevelNeeds = ko.observableArray();
        this.visible = ko.pureComputed(() => this.populationLevelNeeds().filter(n => n.visible()).length > 0);
        this.visiblePopulationLevelNeeds = ko.pureComputed(() => this.populationLevelNeeds().filter(n => n.visible()));

        this.checked = ko.pureComputed({
            read: () => {
                for (var n of this.visiblePopulationLevelNeeds())
                    if (!n.checked())
                        return false;

                return true;
            },
            write: (checked: boolean) => {
                for (var n of this.visiblePopulationLevelNeeds())
                    n.checked(checked);
            }
        })
    }

    addNeed(need: PopulationLevelNeedPresenter){
        this.populationLevelNeeds.push(need);
    }
}

export class ResidencePresenter{
    public instance: KnockoutObservable<PopulationLevel>;
    public residence: KnockoutObservable<ResidenceBuilding>;
    public buildings: KnockoutObservable<BuildingsCalc>;
    public name: KnockoutObservable<string>;
    public residents: KnockoutObservable<string>;
    private populationLevelNeeds: PopulationLevelNeedPresenter[];
    public needCategories: NeedCategoryPresenter[];
    public visibleNeedCategories: KnockoutObservableArray<NeedCategoryPresenter>;
    public effectCoverage: KnockoutObservableArray<ResidenceEffectCoverage>;


    constructor(needCategories: NeedCategory[], populationLevel: PopulationLevel){
        // As long as we only have one residence per population level, we can use the first one
        this.instance = ko.observable(populationLevel);
        this.residence = ko.pureComputed(() => this.instance() ? this.instance().residences[0] : null);
        this.name = ko.pureComputed(() => this.instance() ? this.instance().name() : "");
        this.residents = ko.pureComputed(() => this.instance() ? formatNumber(this.instance().residents()) : "0");
        this.buildings = ko.pureComputed(() => this.instance() ? this.instance().residences[0].buildings : null);
        this.populationLevelNeeds = [];
        this.needCategories = [];
        this.effectCoverage = ko.pureComputed(() => this.residence() ? this.residence().effectCoverage() : []);

        for (let category of needCategories){
            let presCat = new NeedCategoryPresenter(this, category);
            for (let need of category.needs){
                let presNeed = new PopulationLevelNeedPresenter(presCat, need);
                presCat.addNeed(presNeed);
                this.populationLevelNeeds.push(presNeed);
            }
            this.needCategories.push(presCat);
        }

        this.instance.subscribe(populationLevel => {
            if(!(populationLevel instanceof PopulationLevel))
                return;

            for (var presNeed of this.populationLevelNeeds){
                presNeed.update(populationLevel.needsMap.get(presNeed.guid));
            }
        });

        this.visibleNeedCategories = ko.pureComputed(() => this.needCategories.filter(n => n.visible()));

    }

    update(populationLevel: PopulationLevel){
        this.instance(populationLevel);
    }

    /**
     * Prepares the residence effect view for this residence building
     */
    prepareResidenceEffectView(): void {
        window.view.selectedResidenceEffectView(new ResidenceEffectView([this.residence()], this.name()));
    }
}