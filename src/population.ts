import { NamedElement, ko, BuildingsCalc } from './util';
import { AppliedBuff, Product } from './production';
import { ResidenceNeed, PopulationLevelNeed, ResidenceEffectEntryCoverage, ResidenceEffectCoverage, ResidenceEffect, NeedCategory } from './consumption';
import { AssetsMap, LiteralsMap } from './types';
import { 
    PopulationLevelConfig, 
    WorkforceConfig,
    ResidenceBuildingConfig,
    PopulationGroupConfig,
} from './types.config';
import {    Island, 
    Region,
     Constructible } from './world';
import { Consumer } from './factories';
import { ResidenceEffectView } from './views';

declare const view: any;

export interface VisibleNeedCategory {
    readonly needCategory: NeedCategory;
    readonly visibleResidenceNeeds: ResidenceNeed[];
}

/**
 * Represents a residence building that houses population
 * Manages population counts, effects, and consumption needs
 */
export class ResidenceBuilding extends NamedElement implements Constructible{
    public guid: number;
    public populationLevel: PopulationLevel;
    public island: Island;
    public associatedRegions: Region[];
    public buildings: BuildingsCalc;
    public allEffects: Map<number, ResidenceEffect>;
    public effectCoverage: KnockoutObservableArray<ResidenceEffectCoverage>;
    public entryCoveragePerProduct: KnockoutComputed<Map<Product, ResidenceEffectEntryCoverage[]>>;
    public needsMap: Map<number, ResidenceNeed>;
    public residents: KnockoutComputed<number>;
    public visible: KnockoutComputed<boolean>;

    public upgradedBuildingGuid?: string;
    public upgradedBuilding?: ResidenceBuilding;

    /**
     * Creates a new ResidenceBuilding instance
     * @param config - Configuration object for the residence building
     * @param assetsMap - Map of all available assets
     * @param island - The island this residence belongs to
     */
    constructor(config: ResidenceBuildingConfig, assetsMap: AssetsMap, island: Island) {
        // Validate required parameters
        if (!config) {
            throw new Error('ResidenceBuilding config is required');
        }
        if (!assetsMap) {
            throw new Error('ResidenceBuilding assetsMap is required');
        }
        if (!island) {
            throw new Error('ResidenceBuilding island is required');
        }

        super(config);
        this.guid = config.guid;

        this.buildings = new BuildingsCalc();
        
        
        // Explicit assignments

        this.island = island;
        this.associatedRegions = config.associatedRegions.map(r => window.view.literalsMap.get(r));
        //this.upgradedBuildingGuids = config.possibleUpgrades;
        const populationLevel = assetsMap.get(config.populationLevel);
        if (!populationLevel) {
            throw new Error(`Population level with GUID ${config.populationLevel} not found in assetsMap`);
        }
        this.populationLevel = populationLevel;

        this.lockDLCIfSet(this.buildings.constructed);
        this.allEffects = new Map();
        this.effectCoverage = ko.observableArray([]);

        this.needsMap = new Map();
        
        config.needsList.forEach(needConfig => {
            let need = new ResidenceNeed(needConfig, this, assetsMap);

            this.needsMap.set(need.need.guid, need);
        });

        this.residents = ko.computed(() => {
            let sum = 0;

            for (const n of this.needsMap.values()) {
                if (!n.residents) {
                    console.log(n);
                }
                sum += n.residents();
            }

            return sum;
        });



        this.entryCoveragePerProduct = ko.pureComputed(() => {
            const result = new Map();
            for (const coverage of this.effectCoverage()) {
                for (const entry of coverage.residenceEffect.entries) {
                    if (result.has(entry.product)) {
                        result.get(entry.product).push(new ResidenceEffectEntryCoverage(coverage, entry));
                    } else {
                        result.set(entry.product, [new ResidenceEffectEntryCoverage(coverage, entry)]);
                    }
                }
            }
            return result;
        });

        this.visible = ko.pureComputed(() => this.available());

        this.populationLevel.addResidence(this);
    }

    /**
     * Initializes needs and sets up computed observables
     * @param needsMap - Map of all needs for this residence
     */
    initDemands(assetsMap: AssetsMap): void {
        for (const n of this.needsMap.values()) {
            n.initDemands(assetsMap);
        }
    }

    /**
     * Adds an effect to this residence
     * @param effect - The effect to add
     */
    addEffect(effect: ResidenceEffect): void {
        this.allEffects.set(effect.guid, effect);
    }

    /**
     * Adds effect coverage to this residence
     * @param effectCoverage - The effect coverage to add
     */
    addEffectCoverage(effectCoverage: ResidenceEffectCoverage): void {
        this.effectCoverage.push(effectCoverage);
        this.sortEffectCoverage();
    }

    /**
     * Removes effect coverage from this residence
     * @param effectCoverage - The effect coverage to remove
     */
    removeEffectCoverage(effectCoverage: ResidenceEffectCoverage): void {
        this.effectCoverage.remove(effectCoverage);
    }

    /**
     * Sorts effect coverage by priority
     */
    sortEffectCoverage(): void {
        this.effectCoverage.sort((a: ResidenceEffectCoverage, b: ResidenceEffectCoverage) => a.residenceEffect.compare(b.residenceEffect));
    }



    /**
     * Gets consumption entries for a specific need
     * @param need - The need to get entries for
     * @returns Array of consumption entries
     */
    getConsumptionEntries(need: Product | ResidenceNeed | PopulationLevelNeed): ResidenceEffectEntryCoverage[] {
        var product : Product | null = null;

        if (need instanceof Product)
            product = need;

        if (need instanceof ResidenceNeed)
            product = need.need.product;
        

        if (need instanceof PopulationLevelNeed)
            product = need.product;
        
        if (product == null)
            throw new Error("Argument passed to getConsumptionEntries must be Product | ResidenceNeed | PopulationLevelNeed")

        return this.entryCoveragePerProduct().get(product) || [];
    }

    /**
     * Serializes effects to JSON for storage
     * @returns Serialized effects data
     */
    serializeEffects(): Record<string, number> {
        const coverageMap: Record<string, number> = {};
        for (const coverage of this.effectCoverage()) {
            coverageMap[coverage.residenceEffect.guid] = coverage.coverage();
        }
        return coverageMap;
    }

    /**
     * Applies effects from JSON data
     * @param _json - Serialized effects data
     */
    applyEffects(_json: Record<string, string>): void {
        var coverage = [];
        for (var guid in _json) {
            var e = this.allEffects.get(parseInt(guid));

            if (e == null)
                continue;

            coverage.push(new ResidenceEffectCoverage(this, e, parseFloat(_json[guid])));
        }
        this.effectCoverage.removeAll();
        this.effectCoverage(coverage);
        this.sortEffectCoverage();
    }

    addBuff(_: AppliedBuff): void {
        // TODO:Use appliedBuffs instead of ResidenceEffectCoverage
    }

    /**
     * Gets visible need categories for this residence's population level
     */
    visibleNeedCategories(): VisibleNeedCategory[] {
        // This method should return need categories grouped by the population level needs
        const categories = new Map<number, VisibleNeedCategory>();
        
        for (const populationNeed of this.populationLevel.getVisibleNeeds()) {
            const category = populationNeed.need.category;
            if (category.guid && !categories.has(category.guid)) {
                categories.set(category.guid, {
                    needCategory: category,
                    visibleResidenceNeeds: []
                });
            }
            
            // Get the corresponding residence need for this population need
            const residenceNeed = this.needsMap.get(populationNeed.need.guid);
            if (residenceNeed) {
                var entry = categories.get(category.guid as number) as VisibleNeedCategory
                entry.visibleResidenceNeeds.push(residenceNeed);
            }
        }
        
        return Array.from(categories.values());
    }

    /**
     * Prepares the residence effect view for this residence
     */
    prepareResidenceEffectView(): void {
        const heading = this.populationLevel.name();
        window.view.selectedResidenceEffectView(
            new ResidenceEffectView(
                this.populationLevel.allResidences(), 
                heading, 
                null
            )
        );
    }
}

/**
 * Represents a population level with specific needs and requirements
 * Manages population counts, needs, and building requirements
 */
export class PopulationLevel extends NamedElement {
    public guid: number;
    public island: Island;
    
    public regions: Region[];
    public residences: ResidenceBuilding[];
    public allResidences: KnockoutObservableArray<ResidenceBuilding>;
    public notes: KnockoutObservable<string>;
    public residents: KnockoutComputed<number>;
    public visible: KnockoutComputed<boolean>;
    public canEditPerHouse?: KnockoutComputed<boolean>;
    public availableResidences?: KnockoutComputed<ResidenceBuilding[]>;
    public canEdit?: KnockoutComputed<boolean>;
    public hotkey: KnockoutObservable<string | null>;

    // Population-level need management
    public needsMap: Map<number, PopulationLevelNeed>;
    public needs: PopulationLevelNeed[];


    /**
     * Creates a new PopulationLevel instance
     * @param config - Configuration object for the population level
     * @param assetsMap - Map of all available assets
     * @param island - The island this population level belongs to
     */
    constructor(config: PopulationLevelConfig, assetsMap: AssetsMap, island: Island) {
        // Validate required parameters
        if (!config) {
            throw new Error('PopulationLevel config is required');
        }
        if (!assetsMap) {
            throw new Error('PopulationLevel assetsMap is required');
        }
        if (!island) {
            throw new Error('PopulationLevel island is required');
        }

        super(config);
        this.guid = config.guid;
        
        // Explicit assignments
        this.island = island;
        

        this.regions = config.associatedRegions.map(r => window.view.literalsMap.get(r));
        this.allResidences = ko.observableArray();
        this.notes = ko.observable("");
        this.residences = [];
        this.hotkey = ko.observable(null);

        // Initialize population-level need management
        this.needsMap = new Map();
        this.needs = [];

        // Skyscraper levels and special residences removed for simplified calculation
        // All population now uses the base residence building only

        this.availableResidences = ko.pureComputed(() => this.allResidences().filter(r => r.available()));

        this.canEdit = ko.pureComputed(() => {
            for (let i = 1; i < this.allResidences.length; i++) {
                if (this.allResidences()[i].buildings.constructed() > 0) {
                    return false;
                }
            }
            return true;
        });



        this.residents = ko.pureComputed(() => {
            let sum = 0;
            for (const r of this.allResidences()) {
                sum += r.residents();
            }
            return sum;
        });


        this.visible = ko.pureComputed(() => {
            if (!this.available()) {
                return false;
            }

            if (!window.view.island || !window.view.island()) {
                return true;
            }

            const region = (window.view.island() as Island).region;
            if (region.id == "Meta") {
                return true;
            }

            return this.regions.indexOf(region) != -1;
        });
    }

    addResidence(residence: ResidenceBuilding){
        this.allResidences.push(residence);
        this.residences = this.allResidences();

        // initialize population level needs as the union of all residence needs
        for (const residenceNeed of residence.needsMap.values()) {
            if (this.needsMap.has(residenceNeed.need.guid))
                continue;

            const populationLevelNeed = new PopulationLevelNeed(residenceNeed.need, this);
            this.needsMap.set(residenceNeed.need.guid, populationLevelNeed);
            this.needs.push(populationLevelNeed);
        }

    }

    /**
     * Gets a population-level need by GUID
     * @param needGuid - The GUID of the need to retrieve
     */
    getNeed(needGuid: number): PopulationLevelNeed | undefined {
        return this.needsMap.get(needGuid);
    }

    /**
     * Checks if a need is activated for this population level
     * @param needGuid - The GUID of the need to check
     */
    isNeedActivated(needGuid: number): boolean {
        const need = this.needsMap.get(needGuid);
        return need ? need.checked() : false;
    }

    /**
     * Gets all visible (available) population-level needs
     */
    getVisibleNeeds(): PopulationLevelNeed[] {
        return this.needs.filter(need => need.available() && !need.hidden());
    }



    // /**
    //  * Prepares the residence effect view for display
    //  * @param need - Optional specific need to focus on
    //  */
    // prepareResidenceEffectView(need: any = null): void {
    //     let heading = this.name();
    //     if (need) {
    //         heading = ko.pureComputed(() => this.name() + ": " + need.product.name());
    //     }
    //     window.view.selectedResidenceEffectView(new ResidenceEffectView(this.allResidences(), heading, need));
    // }
}

/**
 * Represents an ordered collection of population levels
 */
export class PopulationGroup extends NamedElement{
    public guid: number;
    public region: Region;
    public populationLevels: PopulationLevel[];

    public visible: KnockoutComputed<boolean>;

    constructor(config: PopulationGroupConfig, assetsMap: AssetsMap, literalsMap: LiteralsMap){
        super(config);
        this.guid = config.guid;

        this.region = literalsMap.get(config.region) as Region;
        this.populationLevels = config.populationLevels.map(guid => {
            const level = assetsMap.get(guid);
            if (!level) {
                throw new Error(`Population level with GUID ${guid} not found in assetsMap`);
            }
            return level;
        });

        this.visible = ko.pureComputed(() => {
            if (!this.available())
                return false;

            if (this.region.id != "Meta" && this.region.id != this.populationLevels[0].island.region.id)
                return false;

            return true;
        })
    }
}

/**
 * Represents a workforce that can be assigned to factories
 */
export class Workforce extends NamedElement{
    public guid: number;
    public demands: KnockoutObservableArray<WorkforceDemand>;
    public amount: KnockoutComputed<number>;
    public visible: KnockoutComputed<boolean>;

    /**
     * Creates a new Workforce instance
     * @param config - Configuration object for the workforce
     * @param assetsMap - Map of all available assets
     */
    constructor(config: WorkforceConfig, assetsMap: AssetsMap) {
        // Validate required parameters
        if (!config) {
            throw new Error('Workforce config is required');
        }
        if (!assetsMap) {
            throw new Error('Workforce assetsMap is required');
        }

        super(config);
        this.guid = config.guid;
        
        // Explicit assignments
        this.demands = ko.observableArray([]);

        this.amount = ko.pureComputed(() => {
            let sum = 0;
            for (const d of this.demands()) {
                sum += d.amount();
            }
            return sum;
        });

        this.visible = ko.pureComputed(() => {
            if (!this.available()) {
                return false;
            }
            return this.amount() != 0;
        });
    }

    /**
     * Adds a demand to this workforce
     * @param demand - The demand to add
     */
    add(demand: WorkforceDemand): void {
        this.demands.push(demand);
    }

    /**
     * Removes a demand from this workforce
     * @param demand - The demand to remove
     */
    remove(demand: WorkforceDemand): void {
        this.demands.remove(demand);
    }
}

/**
 * Manages the relationship between factories and their workforce requirements
 */
export class WorkforceDemand {
    public factory: Consumer;
    public amountPerBuilding: number;
    public boost: KnockoutObservable<number>;
    public amount: KnockoutObservable<number>;
    public workforce: KnockoutObservable<Workforce>;
    public defaultWorkforce: Workforce;
    public buildings: number;

    /**
     * Creates a new WorkforceDemand instance
     * @param factory - The factory that requires this workforce
     * @param workforce - The workforce type
     * @param amount - Amount of workforce per building
     */
    constructor(factory: Consumer, workforce: Workforce, amount: number) {
        // Validate required parameters
        if (!factory) {
            throw new Error('WorkforceDemand factory is required');
        }
        if (!workforce) {
            throw new Error('WorkforceDemand workforce is required');
        }

        // Explicit assignments
        this.factory = factory;
        this.amountPerBuilding = amount || 0;
        this.boost = ko.observable(1);
        this.amount = ko.observable(0);
        this.workforce = ko.observable(workforce);
        this.defaultWorkforce = workforce;
        this.buildings = 0;

        this.boost.subscribe(() => {
            this.updateAmount(this.buildings);
        });

        this.workforce().add(this);
    }

    /**
     * Updates the workforce assignment
     * @param workforce - The new workforce to assign
     */
    updateWorkforce(workforce: Workforce | null = null): void {
        if (workforce == null) {
            workforce = this.defaultWorkforce;
        }

        if (workforce !== this.workforce()) {
            this.workforce().remove(this);
            this.workforce(workforce);
            this.workforce().add(this);
        }
    }

    /**
     * Updates the amount based on the number of buildings
     * @param buildings - Number of buildings
     */
    updateAmount(buildings: number): void {
        this.buildings = buildings;

        const perBuilding = Math.ceil(this.amountPerBuilding * this.boost());
        this.amount(Math.ceil(buildings) * perBuilding);
    }
} 