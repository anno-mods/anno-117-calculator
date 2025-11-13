import { NamedElement, ko } from './util';
import { ResidenceBuilding, PopulationLevel } from './population';
import { AssetsMap, LiteralsMap, ResidenceNeedConfig } from './types';
import { NeedCategoryConfig, NeedConfig } from './types.config';
import { Demand, Product } from './production';
import { Island, Region } from './world';
import { Factory } from './factories';
import { ResidenceEffectView } from './views';


declare const view: any;

/**
 * Need categories
 */
export class NeedCategory extends NamedElement{
    public id: string;
    public needs: Need[];

    constructor(config: NeedCategoryConfig){
        super(config);
        this.id = config.id;
        this.needs = [];
    }

    addNeed(need: Need){
        this.needs.push(need);
    }
}

/**
 * Base properties class for all needs in the game
 */
export class Need {
    public guid: number;
    public residents: number;
    public product: Product;
    public category: NeedCategory;
    public supplyWeight: number;
    public attributes: Map<NamedElement, number>;
    public available: KnockoutComputed<boolean>;


    /**
     * Creates a new Need instance
     * @param config - Configuration object for the need
     * @param assetsMap - Map of all available assets
     */
    constructor(config: NeedConfig, assetsMap: AssetsMap, literalsMap: LiteralsMap) {

        this.guid = config.guid;
        const product = assetsMap.get(config.needProduct);
        if (!product) {
            throw new Error(`Product with GUID ${config.needProduct} not found in assetsMap`);
        }
        this.product = product;
        this.category = literalsMap.get(config.needCategory) as NeedCategory;
        this.supplyWeight = config.supplyWeight;
        this.attributes = new Map()
        for (let attr in config.needAttributes){
            this.attributes.set(window.view.literalsMap.get(attr), config.needAttributes[attr]);
        }
        

        this.residents = config.needAttributes["Population"];
        this.available = ko.pureComputed(() => this.product.available());

        this.category.addNeed(this);
    }
}

/**
 * Represents a need for a population level
 * Aggregates Residence needs in terms of consumption and residents
 * Manages activation state for all residences of the same population tier
 */
export class PopulationLevelNeed {
    public populationLevel: PopulationLevel;
    public need: Need;
    public checked: KnockoutObservable<boolean>;
    public hidden: KnockoutComputed<boolean>;
    public notes: KnockoutObservable<string>;
    public available: KnockoutComputed<boolean>;
    public residents!: KnockoutComputed<number>;
    public amount!: KnockoutComputed<number>;

    /**
     * Creates a new PopulationLevelNeed instance
     * @param need - The need this population level need represents
     * @param populationLevel - The population level this need belongs to
     */
    constructor(need: Need, populationLevel: PopulationLevel) {
        // Validate required parameters
        if (!need) {
            throw new Error('PopulationLevelNeed need is required');
        }
        if (!populationLevel) {
            throw new Error('PopulationLevelNeed populationLevel is required');
        }

        this.populationLevel = populationLevel;
        this.need = need;
        
        this.checked = ko.observable(true); // Default to activated
        this.notes = ko.observable("");
        this.hidden = ko.computed(() => false);
        this.available = ko.pureComputed(() => this.need.available());
        
        // Calculate residents gained from this specific need
        this.residents = ko.pureComputed(() => {
            if (!this.checked()) return 0;
            
            // Sum residents from all residences for this specific need
            return this.populationLevel.allResidences().reduce((sum: number, residence: ResidenceBuilding) => {
                const residenceNeed = residence.needsMap.get(this.need.guid);
                return sum + (residenceNeed ? residenceNeed.residents() : 0);
            }, 0);
        });

        // Calculate residents gained from this specific need
        this.amount = ko.pureComputed(() => {
            if (!this.checked()) return 0;
            
            // Sum residents from all residences for this specific need
            return this.populationLevel.allResidences().reduce((sum: number, residence: ResidenceBuilding) => {
                const residenceNeed = residence.needsMap.get(this.need.guid);
                return sum + (residenceNeed ? residenceNeed.amount() : 0);
            }, 0);
        });

        this.checked.subscribe(checked => {
            this.populationLevel.allResidences().forEach(r => r.needsMap.get(this.need.guid)?.checked(checked));
        })
    }

    /**
     * Gets the name of this need
     */
    name(): string {
        return this.need.product.name();
    }

    /**
     * Gets the product associated with this need
     */
    get product() {
        return this.need.product;
    }

    /**
     * Checks if this need is inactive (hidden or unavailable)
     */
    isInactive(): boolean {
        return this.hidden() || !this.available();
    }

    /**
     * Checks if this need is banned (not checked)
     */
    banned(): boolean {
        return !this.checked();
    }

    /**
     * Gets a unique ID for this need
     */
    get id(): string {
        return `${this.populationLevel.guid}-need-${this.need.guid}`;
    }
}

/**
 * Represents a need for a specific residence building
 * Manages the relationship between a residence and its consumption needs. Creates the demand.
 * Activation is handeled by PopulationLevelNeed
 */
export class ResidenceNeed {
    public residence: ResidenceBuilding; 
    public need: Need; 
    public needConsumptionRate: number;
    public checked: KnockoutComputed<boolean>; // Now computed from population level
    public amount: KnockoutComputed<number>;
    public residents: KnockoutComputed<number>;
    public available: KnockoutComputed<boolean>;
    public demand?: Demand;


    /**
     * Creates a new ResidenceNeed instance
     * @param residence - The residence building this need belongs to
     * @param need - The population need this residence need represents
     */
    constructor(config: ResidenceNeedConfig, residence: ResidenceBuilding, assetsMap: AssetsMap) {
        // Validate required parameters
        if (!residence) {
            throw new Error('ResidenceNeed residence is required');
        }

        // Explicit assignments
        this.residence = residence;
        const need = assetsMap.get(config.need);
        if (!need) {
            throw new Error(`Need with GUID ${config.need} not found in assetsMap`);
        }
        this.need = need;
        this.needConsumptionRate = config.needConsumptionRate || 0;

        this.checked = ko.observable(true); // set from populationLevelNeed which is constructed later({


        this.amount = ko.pureComputed(() => {
            if(!this.checked())
                return 0;
            
            return this.residence.buildings.constructed() * this.needConsumptionRate * window.view.settings.selectedNeedConsumptionSetting().consumptionFactor;
        });

        this.residents = ko.pureComputed(() => {
            if(!this.checked())
                return 0;

            return this.residence.buildings.constructed() * this.need.residents;
        })

        this.available = ko.pureComputed(() => this.need.available() && this.residence.available())
    }

    /**
     * Gets the name of this need
     */
    name(): string {
        return this.need.product.name();
    }

    /**
     * Gets the product associated with this need
     */
    get product() {
        return this.need.product;
    }

    /**
     * Checks if this need is inactive (hidden or unavailable)
     */
    isInactive(): boolean {
        return !this.available();
    }

    /**
     * Checks if this need is banned (not checked)
     */
    banned(): boolean {
        return !this.checked();
    }

    /**
     * Gets a unique ID for this need
     */
    get id(): string {
        return `${this.residence.guid}-need-${this.need.guid}`;
    }

    /**
     * Prepares the residence effect view for this need
     */
    prepareResidenceEffectView(): void {
        const populationLevelNeed = this.residence.populationLevel.getNeed(this.need.guid);
        if (populationLevelNeed) {
            // Create residence effect view using all residences of the population level
            const heading = `${this.residence.populationLevel.name()}: ${this.need.product.name}`;
            window.view.selectedResidenceEffectView(
                new ResidenceEffectView(
                    this.residence.populationLevel.allResidences(), 
                    heading, 
                    this
                )
            );
        }
    }

    initDemands(assetsMap: AssetsMap){
        if (!this.need.product.isAbstract){
            this.demand = new Demand(this.need.product, this.residence, assetsMap, ko.observable(1));
            this.demand.updateAmount(this.amount());
            this.amount.subscribe(val => (this.demand as Demand).updateAmount(val));
        }
    }
}




/**
 * Represents a single residence effect entry
 * Contains information about how a residence effect modifies consumption
 */
class ResidenceEffectEntry {
    public guid: number;
    public product: Product;
    public consumptionModifier: number;
    public residents: number;
    public suppliedBy: Product[];

    /**
     * Creates a new ResidenceEffectEntry instance
     * @param config - Configuration object for the effect entry
     * @param assetsMap - Map of all available assets
     */
    constructor(config: any, assetsMap: AssetsMap) {
        // Validate required parameters
        if (!config) {
            throw new Error('ResidenceEffectEntry config is required');
        }
        if (!config.guid) {
            throw new Error('ResidenceEffectEntry config.guid is required');
        }
        if (!assetsMap) {
            throw new Error('ResidenceEffectEntry assetsMap is required');
        }

        // Explicit assignments
        this.guid = parseInt(config.guid);
        const product = assetsMap.get(this.guid);
        if (!product) {
            throw new Error(`Product with GUID ${this.guid} not found in assetsMap`);
        }
        this.product = product;
        this.consumptionModifier = config.consumptionModifier || 0;
        this.residents = config.residents || 0;
        this.suppliedBy = (config.suppliedBy || []).map((e: any) => {
            const product = assetsMap.get(parseInt(e));
            if (!product) {
                throw new Error(`Product with GUID ${e} not found in assetsMap`);
            }
            return product;
        });
    }
}

/**
 * Represents a residence effect that modifies consumption and population
 * Contains multiple effect entries that apply to different products
 */
export class ResidenceEffect extends NamedElement {
    public guid: number;
    public allowStacking: boolean;
    public entries: ResidenceEffectEntry[];
    public effectsPerNeed: Map<number, ResidenceEffectEntry>;
    public residences: ResidenceBuilding[];
    public panoramaLevel?: number;

    /**
     * Creates a new ResidenceEffect instance
     * @param config - Configuration object for the effect
     * @param assetsMap - Map of all available assets
     */
    constructor(config: any, assetsMap: AssetsMap) {
        // Validate required parameters
        if (!config) {
            throw new Error('ResidenceEffect config is required');
        }
        if (!config.effects || !Array.isArray(config.effects)) {
            throw new Error('ResidenceEffect config.effects array is required');
        }
        if (!config.residences || !Array.isArray(config.residences)) {
            throw new Error('ResidenceEffect config.residences array is required');
        }
        if (!assetsMap) {
            throw new Error('ResidenceEffect assetsMap is required');
        }

        super(config);
        this.guid = config.guid;
        
        this.allowStacking = config.allowStacking || false;
        this.entries = config.effects.map((e: any) => new ResidenceEffectEntry(e, assetsMap));
        this.effectsPerNeed = new Map();

        for (var effect of this.entries) {
            this.effectsPerNeed.set(effect.guid, effect);
        }

        this.residences = [];
        for (var residence of config.residences) {
            let r = assetsMap.get(parseInt(residence));
            if (!r) {
                throw new Error(`Residence with GUID ${residence} not found in assetsMap`);
            }
            this.residences.push(r);
            r.addEffect(this);
        }
    }

    /**
     * Compares this residence effect with another for sorting
     * Expected usage: array.sort((a,b) => a.compare(b))
     * @param other - The other residence effect to compare with
     * @returns Comparison result for sorting
     */
    compare(other: ResidenceEffect): number {
        if (
            this.panoramaLevel != null &&
            other.panoramaLevel != null &&
            this.residences[0]?.populationLevel &&
            other.residences[0]?.populationLevel &&
            typeof this.residences[0].populationLevel !== 'string' &&
            typeof other.residences[0].populationLevel !== 'string'
        ) {
            const thisPop = this.residences[0].populationLevel as PopulationLevel;
            const otherPop = other.residences[0].populationLevel as PopulationLevel;
            return 10 * (otherPop.guid - thisPop.guid) + other.panoramaLevel - this.panoramaLevel;
        }

        if (this.panoramaLevel != null)
            return -1000;

        if (other.panoramaLevel != null)
            return 1000;

        return this.name().localeCompare(other.name());
    }
}

/**
 * Represents the coverage of a residence effect on a specific residence
 * Manages the percentage of a residence that is affected by an effect
 */
export class ResidenceEffectCoverage {
    public residence: ResidenceBuilding;
    public residenceEffect: ResidenceEffect;
    public coverage: KnockoutObservable<number>;

    /**
     * Creates a new ResidenceEffectCoverage instance
     * @param residence - The residence building
     * @param residenceEffect - The residence effect
     * @param coverage - The coverage percentage (0-1)
     */
    constructor(residence: ResidenceBuilding, residenceEffect: ResidenceEffect, coverage: number = 1) {
        // Validate required parameters
        if (!residence) {
            throw new Error('ResidenceEffectCoverage residence is required');
        }
        if (!residenceEffect) {
            throw new Error('ResidenceEffectCoverage residenceEffect is required');
        }

        // Explicit assignments
        this.residence = residence;
        this.residenceEffect = residenceEffect;
        this.coverage = ko.observable(coverage);
    }
}

/**
 * Represents the coverage of a specific residence effect entry
 * Links a residence effect coverage with a specific effect entry
 */
export class ResidenceEffectEntryCoverage {
    public residenceEffectCoverage: ResidenceEffectCoverage;
    public residenceEffectEntry: ResidenceEffectEntry;

    /**
     * Creates a new ResidenceEffectEntryCoverage instance
     * @param residenceEffectCoverage - The residence effect coverage
     * @param residenceEffectEntry - The residence effect entry
     */
    constructor(residenceEffectCoverage: ResidenceEffectCoverage, residenceEffectEntry: ResidenceEffectEntry) {
        // Validate required parameters
        if (!residenceEffectCoverage) {
            throw new Error('ResidenceEffectEntryCoverage residenceEffectCoverage is required');
        }
        if (!residenceEffectEntry) {
            throw new Error('ResidenceEffectEntryCoverage residenceEffectEntry is required');
        }

        // Explicit assignments
        this.residenceEffectCoverage = residenceEffectCoverage;
        this.residenceEffectEntry = residenceEffectEntry;
    }

    /**
     * Gets the number of residents affected by this effect entry
     * @returns Number of affected residents
     */
    getResidents(): number {
        return this.residenceEffectCoverage.coverage() * this.residenceEffectEntry.residents;
    }
}

/**
 * Manages a list of recipes for a specific building type
 * Handles recipe selection and creation for buildings that can produce multiple goods
 */
export class RecipeList extends NamedElement {
    public island: Island;
    public region?: Region;
    public recipeBuildings: Factory[];
    public unusedRecipes: KnockoutComputed<Factory[]>;
    public selectedRecipe: KnockoutObservable<Factory>;
    public canCreate: KnockoutComputed<boolean>;
    public visible: KnockoutComputed<boolean>;

    /**
     * Creates a new RecipeList instance
     * @param list - Configuration object for the recipe list
     * @param assetsMap - Map of all available assets
     * @param island - The island this recipe list belongs to
     */
    constructor(list: any, assetsMap: AssetsMap, island: Island) {
        // Validate required parameters
        if (!list) {
            throw new Error('RecipeList list is required');
        }
        if (!assetsMap) {
            throw new Error('RecipeList assetsMap is required');
        }
        if (!island) {
            throw new Error('RecipeList island is required');
        }

        super(list);
        
        // Explicit assignments
        this.island = island;
        this.region = list.region ? (() => {
            const region = assetsMap.get(parseInt(list.region));
            if (!region) {
                throw new Error(`Region with GUID ${list.region} not found in assetsMap`);
            }
            return region;
        })() : null;

        this.recipeBuildings = (list.recipeBuildings || []).map((r: number) => {
            var a = assetsMap.get(r);
            if (!a) {
                throw new Error(`Recipe building with GUID ${r} not found in assetsMap`);
            }
            a.recipeList = this;
            return a;
        });

        this.unusedRecipes = ko.computed(() => {
            var result = [];
            for (var recipe of this.recipeBuildings) {
                if (!recipe.buildings.constructed())
                    result.push(recipe);
            }

            return result;
        });
        this.selectedRecipe = ko.observable(this.recipeBuildings[0]);

        this.canCreate = ko.pureComputed(() => {
            return this.unusedRecipes().length && this.selectedRecipe();
        });

        this.visible = ko.pureComputed(() => {
            if (!this.available())
                return false;

            return this.unusedRecipes().length != 0;
        });
    }

    /**
     * Creates a new recipe building instance
     */
    create(): void {
        if (!this.canCreate())
            return;

        this.selectedRecipe().buildings.constructed(1);
    }
} 