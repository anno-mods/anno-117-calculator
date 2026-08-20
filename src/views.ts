import { ACCURACY, BuildingsCalc, formatNumber, ko } from './util';
import { PopulationLevel, ResidenceBuilding } from './population';
import { ResidenceEffectCoverage, ResidenceEffect, ResidenceNeed, NeedCategory, Need, PopulationLevelNeed } from './consumption';
import { Product, Effect } from './production';
import { AppliedBuff } from './buffs';
import { Consumer, Factory, Module } from './factories';
import { TradeRoute } from './trade';
import { ExtraGoodSupplier, PassiveTradeSupplier } from './suppliers';
import { Session, Island } from './world';
import { AggregateBuildingsCalc, isAggregating, sumAcrossRealIslands, sumBuildingsAcrossRealIslands } from './aggregate';


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
        view.settings.aggregateAllIslands.checked(true);

        setTimeout(() => $('#island-management-dialog').modal('show'), 250);
    }

    /**
     * Applies settings for the "Plan" view mode
     * Enables decimal precision and configures DLC settings for planning
     */
    plan(): void {
        view.settings.decimalsForBuildings.checked(true);

        // activate DLCs first so that all effects are available
        for (var dlc of view.dlcs.values()) {
            dlc.checked(true);
        }

        for (const effect of window.view.globalEffects) {
            effect.scaling(1);
        }

    }

    /**
     * Applies settings for the "Master" view mode
     * Enables all options and DLCs for advanced users
     */
    master(): void {
        for (var option of view.settings.options)
            option.checked(true);

        for (var dlc of view.dlcs.values()) {
            dlc.checked(true);
        }

        for (const effect of window.view.globalEffects) {
            effect.scaling(1);
        }

        //Vulcano effects
        for (const session of (window.view.sessions as Session[])){
            if (session.region.id != "Roman" && session.region.id != "Meta" )
                continue;

            for (const e of session.effects){
                if (e.guid == 145099 || e.guid == 145095 || e.guid == 148043)
                    e.scaling(5) // fertile soil and obsidian gathering / mining
            }
        }
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

/**
 * Looks up the PopulationLevel with the given guid on a specific island, if present.
 * Mirrors the equivalent helper in population-presenters.ts - kept as a local copy here
 * rather than exported/shared, since it is a one-line lookup and this file already avoids
 * further coupling to population-presenters.ts beyond the shared sumAcrossRealIslands helper.
 */
function findPopulationLevelOnIsland(island: Island, guid: number): PopulationLevel | undefined {
    return island.assetsMap.get(guid) as PopulationLevel | undefined;
}

/**
 * Sums a single PopulationLevelNeed's selected value (amount/residents) across the user's
 * real islands, for the need matching `needGuid` under the population level matching
 * `populationLevelGuid`. Used by PopulationLevelNeedPresenter's aggregate-mode branch
 * (ResidencePresenter.updateAggregate) - see AGENTS.md / plan KTD2.
 */
function sumPopulationLevelNeedAcrossRealIslands(populationLevelGuid: number, needGuid: number, selector: (need: PopulationLevelNeed) => number): number {
    return sumAcrossRealIslands(island => {
        const level = findPopulationLevelOnIsland(island, populationLevelGuid);
        if (!level) return 0;
        const need = level.needsMap.get(needGuid);
        if (!need) return 0;
        return selector(need);
    });
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
        // A need is shown only when available AND not hidden. hidden() gates conditional
        // (mythical-item / monument) needs behind their granting effect - see PopulationLevelNeed.hidden.
        this.visible =  ko.pureComputed(() => {
            const inst = this.instance();
            return inst ? inst.available() && !inst.hidden() : false;
        });
        this.product = ko.pureComputed(() => need.product);
        this.amount = ko.pureComputed(() => {
            // Aggregate mode (see ResidencePresenter.isAggregateMode): sum this need's amount
            // across every real island that has the target population level, rather than
            // reading the single repointed instance() (which is only one representative island).
            if (this.parent.parent.isAggregateMode()) {
                const populationLevelGuid = this.parent.parent.instance()?.guid;
                if (populationLevelGuid == null)
                    return 0;
                return sumPopulationLevelNeedAcrossRealIslands(populationLevelGuid, this.guid, n => n.amount());
            }

            let inst = this.instance();
            if(inst == null)
                return 0;

            return inst.amount();
        });
        // checked has no coherent single value across real islands in aggregate mode (different
        // islands can have different checked states for the same need) - left reading the
        // representative instance() unchanged. This is safe because R14 structurally removes the
        // checkbox bound to it in aggregate mode (population-level-config-dialog.html), so the
        // value is never surfaced to the user while aggregating.
        this.checked = ko.pureComputed({
            read: () => this.instance()?.checked() ?? false,
            write: (checked: boolean) => {
                this.instance()?.checked(checked);
            }
        });
        this.isInactive =  ko.pureComputed(() => false);
        this.residents = ko.pureComputed(() => {
            if (this.parent.parent.isAggregateMode()) {
                const populationLevelGuid = this.parent.parent.instance()?.guid;
                if (populationLevelGuid == null)
                    return 0;
                return sumPopulationLevelNeedAcrossRealIslands(populationLevelGuid, this.guid, n => n.residents());
            }

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

/**
 * Represents an effect that applies to a range of buildings (e.g. population buffs)
 * Handles checked, visible and available state for the UI
 */
export class RangeEffect {
    public appliedBuff: AppliedBuff;
    public isPatronEffect: boolean;
    public checked: KnockoutComputed<boolean>;
    public available: KnockoutComputed<boolean>;
    public visible: KnockoutComputed<boolean>;
    public totalPopulation: KnockoutComputed<number>;

    constructor(appliedBuff: AppliedBuff, isPatronEffect: boolean, buildings: KnockoutComputed<BuildingsCalc | null>) {
        this.appliedBuff = appliedBuff;
        this.isPatronEffect = isPatronEffect;

        const effect = this.appliedBuff.parent as Effect;
        this.checked = ko.pureComputed({
            read: () => effect.scaling() > 0,
            write: (val: boolean) => effect.scaling(val ? 1 : 0)
        });

        this.available = appliedBuff.available;
        this.visible = appliedBuff.visible;

        this.totalPopulation = ko.pureComputed(() => {
            const b = buildings();
            if (!b) return 0;
            return b.constructed() * this.appliedBuff.populationBonus();
        });
    }
}

/**
 * One row of the residence table in population-level-config-dialog.html. Every cell comes from an
 * aggregate-aware source, so the row cannot show one island's value underneath an aggregate total.
 */
export interface ResidenceRow {
    guid: number;
    name(): string;
    /** Aggregate sum while aggregating, this residence's own value otherwise. */
    residents(): number;
    /**
     * AggregateBuildingsCalc while aggregating, the residence's own BuildingsCalc otherwise.
     *
     * A KO computed rather than a plain function: it is handed to constructed-buildings-input as a
     * param, and that component resolves params with `ko.unwrap`, which returns a plain function
     * untouched instead of calling it.
     */
    buildings: KnockoutComputed<BuildingsCalc>;
    effectCoverage(): ResidenceEffectCoverage[];
    prepareResidenceEffectView(): void;
}

export class ResidencePresenter{
    public instance: KnockoutObservable<PopulationLevel>;
    public residence: KnockoutObservable<ResidenceBuilding>;
    public buildings: KnockoutComputed<BuildingsCalc | null>;
    public residenceRows: KnockoutComputed<ResidenceRow[]>;
    public name: KnockoutObservable<string>;
    public residents: KnockoutObservable<string>;
    private populationLevelNeeds: PopulationLevelNeedPresenter[];
    public needCategories: NeedCategoryPresenter[];
    public visibleNeedCategories: KnockoutObservableArray<NeedCategoryPresenter>;
    public effectCoverage: KnockoutObservableArray<ResidenceEffectCoverage>;
    public populationBuffs: KnockoutComputed<RangeEffect[]>;
    public populationBuffsId: string;
    public populationBuffsVisible: KnockoutComputed<boolean>;

    /**
     * True while this presenter is showing a read-only sum across the user's real islands
     * (opened via updateAggregate() from an aggregate population tile) rather than a single
     * real island's own PopulationLevel (opened via update()). Set false by update(), true by
     * updateAggregate() - see AGENTS.md / plan KTD2 for the rationale (this presenter instance
     * is shared and mutated in place, never wrapped/replaced, so existing .update() call sites
     * keep working unchanged).
     */
    private aggregateMode: KnockoutObservable<boolean>;

    constructor(needCategories: NeedCategory[], populationLevel: PopulationLevel){
        this.aggregateMode = ko.observable(false);

        // As long as we only have one residence per population level, we can use the first one
        this.instance = ko.observable(populationLevel);
        this.residence = ko.pureComputed(() => this.instance() ? this.instance().residences[0] : null);
        this.name = ko.pureComputed(() => this.instance() ? this.instance().name() : "");
        this.residents = ko.pureComputed(() => {
            if (this.aggregateMode()) {
                const guid = this.instance()?.guid;
                if (guid == null) return "0";
                return formatNumber(sumAcrossRealIslands(island => {
                    const level = findPopulationLevelOnIsland(island, guid);
                    return level ? level.residents() : 0;
                }));
            }

            return this.instance() ? formatNumber(this.instance().residents()) : "0";
        });
        // In aggregate mode this feeds RangeEffect.totalPopulation (see populationBuffs below) a
        // summed constructed-count across real islands, so a buff's *magnitude* reflects the whole
        // aggregate. Known limitation: populationBuffs itself still iterates only the representative
        // island's own residence.buffs(), so a buff active on a non-representative real island but
        // not on the representative one won't appear in the aggregate dialog at all (not just be
        // under-counted). Fully unioning the buff catalog across real islands is out of scope here.
        // Also read directly by population-level-config-dialog.html's read-only buildings-count
        // replacement for the residence-row table (which otherwise binds each row's *own*,
        // single-island ResidenceBuilding.buildings) - relies on the documented "one residence
        // per population level" assumption already made elsewhere in this class.
        this.buildings = ko.pureComputed(() => {
            if (this.aggregateMode()) {
                const guid = this.instance()?.guid;
                const constructed = guid == null ? 0 : sumAcrossRealIslands(island => {
                    const level = findPopulationLevelOnIsland(island, guid);
                    return level ? level.residences[0].buildings.constructed() : 0;
                });
                // Read-only aggregate BuildingsCalc: only .constructed() is ever read (by
                // RangeEffect.totalPopulation); required has no meaning for a summed residence
                // count, and utilized simply mirrors constructed.
                return new AggregateBuildingsCalc({
                    constructed: () => constructed,
                    required: () => 0,
                    utilized: () => constructed,
                });
            }

            return this.instance() ? this.instance().residences[0].buildings : null;
        });

        /**
         * Rows for the residence table in population-level-config-dialog.html. Built here rather
         * than iterating instance().allResidences() directly so every cell in the row comes from
         * the same aggregate-aware source as the dialog header - binding the raw ResidenceBuilding
         * made the row show one island's residents underneath an aggregate total, and gated the
         * effect-coverage cell on that one island's constructed count (so the coverage icons
         * vanished entirely whenever the representative island happened to have 0 constructed).
         *
         * Swapping this array is safe (unlike the bootstrap tile-grid arrays the Global Constraints
         * protect): the dialog is re-rendered when it opens.
         */
        this.residenceRows = ko.pureComputed(() => {
            const level = this.instance();
            if (!level) return [];

            const aggregate = this.aggregateMode();

            return level.allResidences().map((residence: ResidenceBuilding): ResidenceRow => {
                const residents = aggregate
                    ? () => sumAcrossRealIslands(island => {
                        const other = island.assetsMap.get(residence.guid) as ResidenceBuilding | undefined;
                        return other ? other.residents() : 0;
                    })
                    : () => residence.residents();

                // planned is deliberately left to AggregateBuildingsCalc's default - residence rows
                // never displayed a planned count and summing one here would change what they show.
                const sums = sumBuildingsAcrossRealIslands(residence.guid);
                const buildings = ko.pureComputed(() => aggregate
                    ? new AggregateBuildingsCalc({
                        constructed: sums.constructed,
                        required: sums.required,
                        utilized: sums.utilized,
                    })
                    : residence.buildings);

                return {
                    guid: residence.guid,
                    name: () => residence.name(),
                    residents,
                    buildings,
                    effectCoverage: () => ko.unwrap(residence.effectCoverage),
                    prepareResidenceEffectView: () => residence.prepareResidenceEffectView()
                };
            });
        });
        this.populationLevelNeeds = [];
        this.needCategories = [];
        this.effectCoverage = ko.pureComputed(() => this.residence() ? this.residence().effectCoverage() : []);

        this.populationBuffsId = "population-buffs-" + populationLevel.guid;

        this.populationBuffs = ko.pureComputed(() => {
            const residence = this.residence();
            if (!residence) return [];
            const patronEffects = residence.island.patronEffects;
            const seen = new Set<Effect>();
            const result: RangeEffect[] = [];
            for (const b of residence.buffs()) {
                if (b.buff.population === 0) continue;
                if (!(b.parent instanceof Effect)) continue;
                const effect = b.parent;
                if (seen.has(effect)) continue;
                seen.add(effect);
                const isPatronEffect = patronEffects.indexOf(effect) !== -1;
                result.push(new RangeEffect(b, isPatronEffect, this.buildings));
            }
            return result;
        });

        this.populationBuffsVisible = ko.pureComputed(() => this.populationBuffs().some(b => b.visible()));

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
        this.aggregateMode(false);
        this.instance(populationLevel);
    }

    /**
     * Single entry point for opening this dialog on a population level. Decides between the
     * editable single-island view and the read-only aggregate view itself, so no call site can
     * accidentally drop out of aggregate mode - which previously let a user edit one arbitrary
     * island's needs and building counts while All-Islands was selected.
     */
    open(populationLevel: PopulationLevel): void {
        if (isAggregating())
            this.updateAggregate(populationLevel.guid);
        else
            this.update(populationLevel);
    }

    /**
     * Repoints this shared presenter at a read-only, summed-across-real-islands view of the
     * population level matching `populationLevelGuid`, instead of a single real island's own
     * instance. Called from the aggregate population tile's sliders button
     * (templates/population-tile.html) when PopulationLevelPresenter.isAggregateMode() is true.
     *
     * `instance()` is still repointed to a genuine PopulationLevel (the first real island that
     * has this guid, falling back to the currently-selected island's own instance if none do -
     * both are structurally always present per the union-display convention, see
     * population-presenters.ts) so read-only template bindings that call instance().name/.guid/
     * etc. keep working. The actual aggregated numbers (residents/needs/population buffs) come
     * from the aggregateMode-branched computed properties above and on the nested
     * NeedCategoryPresenter/PopulationLevelNeedPresenter objects, not from instance() directly.
     */
    updateAggregate(populationLevelGuid: number): void {
        this.aggregateMode(true);

        const representative = this.findRepresentativePopulationLevel(populationLevelGuid);
        if (representative) {
            this.instance(representative);
        }
    }

    /**
     * True when this presenter is currently showing an aggregate (summed-across-real-islands)
     * view rather than a single real island's own data. Bound by
     * templates/population-level-config-dialog.html to structurally gate mutating controls
     * (need-activation checkboxes, population-buff checkboxes, the buildings-constructed input)
     * per R14/KTD4 - if:/ifnot:, not visible:, so their bound methods are never evaluated
     * against aggregate data.
     */
    isAggregateMode(): boolean {
        return !this.editable();
    }

    /**
     * False while this presenter shows read-only aggregate values. A plain method, not a computed -
     * see the note on isAggregateModeFor in src/aggregate.ts.
     *
     * Note this reads the presenter's OWN mode, not the global one: the dialog can be open on an
     * aggregate row while a real island is selected, so template sites that gate on this must not
     * be swapped for the global `ifEditable`/`ifAggregated` bindings.
     */
    editable(): boolean {
        return !this.aggregateMode();
    }

    /**
     * Finds a genuine PopulationLevel instance to point `instance()` at while in aggregate mode:
     * the first real island (in view.islands() order) that has this population level guid, or -
     * if no real island has it (e.g. zero real islands) - the currently-selected island's own
     * instance as a last-resort fallback (the All-Islands pseudo-island carries every
     * factory/product/population-level type in the union catalog, per the existing "Meta/
     * All-Islands shows everything unfiltered" convention, world.ts:898).
     */
    private findRepresentativePopulationLevel(populationLevelGuid: number): PopulationLevel | undefined {
        const islands: Island[] = window.view.islands ? window.view.islands() : [];
        for (const island of islands) {
            if (island.isAllIslands()) continue;
            const level = findPopulationLevelOnIsland(island, populationLevelGuid);
            if (level) return level;
        }

        const current: Island | undefined = window.view.island ? window.view.island() : undefined;
        return current ? findPopulationLevelOnIsland(current, populationLevelGuid) : undefined;
    }

    /**
     * Prepares the residence effect view for this residence building
     */
    prepareResidenceEffectView(): void {
        window.view.selectedResidenceEffectView(new ResidenceEffectView([this.residence()], this.name()));
    }
}