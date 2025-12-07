import { ALL_ISLANDS, NamedElement, Option, ko, BuildingsCalc } from './util';
import { texts } from './i18n';
import { 
 
    AssetsMap, 
    LiteralsMap,
} from './types';
import { 
    EffectConfig,
    ParamsConfig,
    RegionConfig, 
    SessionConfig, 

} from './types.config';

import { Workforce, ResidenceBuilding, PopulationLevel, PopulationGroup } from './population';
import { Product, MetaProduct, Item, ProductCategory, AppliedBuff, Buff, Effect, Patron } from './production';
import { PublicConsumerBuilding, Factory, Consumer } from './factories';
import { ResidenceEffectView } from './views';
import { Need, NeedCategory, RecipeList, } from './consumption';
import { ExtraGoodSupplier } from './suppliers';

declare const $: any;
declare const view: any;
declare const window: any;
declare const params: any;
declare const localStorage: any;


/**
 * Manages persistent storage for island data
 * Handles saving and loading of configuration data to/from localStorage
 */
export class Storage {
    public key: string;
    public json: Record<string, any>;
    public map: Map<string, any>;
    public savingScheduled: boolean;
    public length: number;

    /**
     * Creates a new Storage instance
     * @param key - The localStorage key for this storage instance
     */
    constructor(key: string) {
        // Validate required parameters
        if (!key) {
            throw new Error('Storage key is required');
        }

        // Explicit assignments
        this.key = key;
        var text = localStorage.getItem(key);
        this.json = text ? JSON.parse(text) : {};
        this.map = new Map();

        this.savingScheduled = false;

        this.length = 0;
        for (var attr in this.json) {
            this.length = this.length + 1;
            this.map.set(attr, this.json[attr]);
        }
    }

    /**
     * Sets an item in the storage
     * @param itemKey - The key for the item
     * @param value - The value to store
     */
    setItem(itemKey: string, value: any): void {
        this.map.set(itemKey, value);

        if (this.json[itemKey] == null)
            this.length = this.length + 1;

        this.json[itemKey] = value;
        this.save();
    }

    /**
     * Gets an item from the storage
     * @param itemKey - The key for the item
     * @returns The stored value
     */
    getItem(itemKey: string): any {
        return this.map.get(itemKey);
    }

    /**
     * Removes an item from the storage
     * @param itemKey - The key for the item to remove
     */
    removeItem(itemKey: string): void {
        this.map.delete(itemKey);

        if (this.json[itemKey] != null)
            this.length = this.length - 1;

        delete this.json[itemKey];
        this.save();
    }

    /**
     * Gets the key at the specified index
     * @param index - The index of the key to retrieve
     * @returns The key at the specified index or null
     */
    getKey(index: number): string | null {
        var i = 0;
        for (let attr in this.json)
            if (i++ == index)
                return attr;

        return null;
    }

    /**
     * Updates the storage key and migrates data
     * @param key - The new key for this storage
     */
    updateKey(key: string): void {
        localStorage.removeItem(this.key);
        this.key = key;
        this.save();
    }

    /**
     * Clears all data from the storage
     */
    clear(): void {
        this.json = {}
        this.map = new Map();
        this.save();
        this.length = 0;
    }

    /**
     * Saves the current data to localStorage
     * Uses debouncing to prevent excessive writes
     */
    save(): void {
        if (this.savingScheduled)
            return;

        this.savingScheduled = true;
        setTimeout(() => {
            this.savingScheduled = false;
            localStorage.setItem(this.key, JSON.stringify(this.json, null, 4));            
        }, 0);
    }
}

/**
 * Represents a region in the game: all sessions of a region have the same products, factories, residences.
 */
export class Region extends NamedElement {
    public guid: number;

    constructor(config: RegionConfig) {
        // Use locaText.englisch as the name if available, otherwise use a fallback
        const regionConfig = {
            ...config,
            name: config.name || config.locaText?.english || 'Unknown Region'
        };
        
        super(regionConfig);
        this.guid = regionConfig.guid;
    }
}

export class Session extends NamedElement {
    public region: Region;
    public islands: KnockoutObservableArray<Island>;
    public workforce: Workforce[] = [];
    public effects: Effect[] = [];
    
    constructor(config: SessionConfig, effectsConfig: EffectConfig[], assetsMap: AssetsMap, sessionStorage: Storage | undefined) {
        // Validate config before calling super
        if (!config) {
            throw new Error('Session config is required');
        }
        if (!config.guid) {
            console.error('Session config missing guid:', config);
            throw new Error('Session config.guid is required');
        }
        
        // Use locaText.englisch as the name if available, otherwise use a fallback
        const sessionConfig = {
            ...config,
            name: config.locaText?.english || config.name || 'Unknown Session'
        };
        
        super(sessionConfig);
        const region = assetsMap.get(config.region);
        if (!region) {
            throw new Error(`Region with GUID ${config.region} not found in assetsMap`);
        }
        this.region = region as Region;
        this.islands = ko.observableArray([]);

        this.effects = effectsConfig.filter(e => e.effectScope.endsWith("Session")).map(e => new Effect(e, assetsMap))

        // Set up persistence for session effects
        if (sessionStorage) {
            for (const effect of this.effects) {
                const storageKey = `session.${this.guid}.effect.${effect.guid}.scaling`;
                
                // Load saved scaling value
                const savedValue = sessionStorage.getItem(storageKey);
                if (savedValue != null) {
                    effect.scaling(parseFloat(savedValue));
                }
                
                // Subscribe to changes for automatic saving
                effect.scaling.subscribe((val: number) => {
                    sessionStorage.setItem(storageKey, val.toString());
                });
            }
        }
    }
    
        /**
     * Adds an island to this session
     * @param {Island} isl - The island to add
     */
    addIsland(island: Island): void {
        this.islands.push(island);
    }

        /**
     * Removes an island from this session
     * @param {Island} isl - The island to remove
     */
        deleteIsland(isl: Island): void {
            this.islands.remove(isl);
        }
}

export class IslandManager {
    public allIslands: Island;
    public showIslandOnCreation: Option;
    public activateAllNeeds: Option;
    public islandNameInput: KnockoutObservable<string>;
    public availableSessions: KnockoutComputed<Session[]>;
    public metaSession: Session;
    public sessionInput: KnockoutObservable<Session>;
    public renameIsland: KnockoutObservable<Island>;
    public islandExists: KnockoutObservable<boolean>;
    public params: ParamsConfig;
    public currentIslandSubscription: KnockoutComputed<void>;

    constructor(params: ParamsConfig, isFirstRun: boolean) {
        // Explicit assignments
        const islandKey = "islandName";
        const islandsKey = "islandNames";

        // Create the showIslandOnCreation option
        this.showIslandOnCreation = new (require('./util').Option)({
            name: "Show Island on Creation",
            guid: "showIslandOnCreation",
            locaText: texts.showIslandOnCreation
        });
        this.showIslandOnCreation.checked(true);

        // Create the activateAllNeeds option
        this.activateAllNeeds = new (require('./util').Option)({
            name: "Activate all needs",
            guid: "activateAllNeeds",
            locaText: texts.activateAllNeeds
        });
        // Set initial value: false for start mode (first run), true otherwise
        this.activateAllNeeds.checked(true);

        // Create other required properties
        this.islandNameInput = ko.observable();
        this.availableSessions = ko.pureComputed(() => window.view.sessions.filter((s: Session) => s.available()));
        this.metaSession = window.view.sessions[0];
        var romanSession = null;
        this.availableSessions().forEach(session => {
            if (session.region.id == "Meta")
                this.metaSession = session;
            if (session.region.id == "Roman")
                romanSession = session;
        });
        if(romanSession == null)
            throw new Error("No roman session!")

        this.sessionInput = ko.observable(romanSession);
        this.renameIsland = ko.observable();
        this.params = params;
        
        var islandNames = [];
        if (localStorage && localStorage.getItem(islandsKey))
            islandNames = JSON.parse(localStorage.getItem(islandsKey) || '[]')

        var islandName = localStorage.getItem(islandKey);
        view.islands = ko.observableArray();
        view.island = ko.observable();

        view.island.subscribe((isl: Island) => window.document.title = isl.name());

        for (var name of islandNames) {
            var island = new Island(params, new Storage(name), false, null);
            view.islands.push(island);

            if (name == islandName)
                view.island(island);
        }

        this.sortIslands();

        var allIslands = new Island(params, new Storage(ALL_ISLANDS), isFirstRun, this.metaSession);
        if (isFirstRun)
            allIslands.activateAllNeeds(true);
        
        this.allIslands = allIslands;
        view.islands.unshift(allIslands);
        if (!view.island())
            view.island(allIslands);


        view.islands.subscribe((islands: Island[]) => {
            let islandNames = JSON.stringify(islands.filter(i => !i.isAllIslands()).map(i => i.name()));
            localStorage.setItem(islandsKey, islandNames);
        });

        this.currentIslandSubscription = ko.computed(() => {
            if(view.island().isAllIslands()) {
                localStorage.setItem(islandKey, ALL_ISLANDS);
            } else {
                var name = view.island().name();
                localStorage.setItem(islandKey, name);
            }
        });


        // Create islandExists computed
        this.islandExists = ko.computed(() => {
            const name = this.islandNameInput();
            if (!name || name === 'All Islands' || name === window.view.texts?.allIslands?.name?.())
                return true;
            return false; // Simplified for now
        });
        

    }

        /**
     * Creates a new island with the specified name and session
     * @param {string} name - The name for the new island
     * @param {Session} session - The session to create the island in
     */
        create(name: string, session: Session) {
            if (name == null) {
                if (this.islandExists())
                    return;
    
                name = this.islandNameInput();
            }
    
    
            var island = new Island(this.params, new Storage(name), true, session);
            island.activateAllNeeds(this.activateAllNeeds.checked());

            view.islands.push(island);
            this.sortIslands();
    
            if (this.showIslandOnCreation.checked())
                view.island(island);
    

            if (name == this.islandNameInput())
                this.islandNameInput("");
        }
    
        /**
         * Deletes an island and cleans up associated data
         * @param {Island} island - The island to delete
         */
        delete(island: Island) {
            if (island == null)
                island = view.island();
    
            if (island.name() == ALL_ISLANDS || island.isAllIslands())
                return;
    
            if (view.island() == island)
                view.island(view.islands()[0]);
    
            if (view.tradeManager) {
                view.tradeManager.islandDeleted(island);
            }
    
            for (var a of island.assetsMap.values())
                if (a instanceof NamedElement)
                    a.delete();
    
            view.islands.remove(island);
            island.session.deleteIsland(island);
            if (localStorage)
                localStorage.removeItem(island.name());
    
        }
    
        /**
         * Renames an island
         * @param {Island} island - The island to rename
         * @param {string} name - The new name for the island
         */
        rename(island: Island, name: string) {
            if (this.islandExists())
                return;
    
            island.name(name);
            this.sortIslands();   
            this.islandNameInput("");
        }
    
        /**
         * Starts the rename process for an island
         * @param {Island} island - The island to rename
         */
        startRename(island: Island) {
            if (island.isAllIslands())
                return;
    
            this.renameIsland(island);
            this.islandNameInput(island.name());
            $('#island-rename-dialog').modal("show");
        }
    

    
        /**
         * Compares two names and returns a similarity score
         * @param {string} name1 - The first name to compare
         * @param {string} name2 - The second name to compare
         * @returns {number} A similarity score between 0 and 1, or NaN if not similar
         */
        compareNames(name1: string, name2: string) {
            var totalLength = Math.max(name1.length, name2.length);
            var minLcsLength = totalLength - Math.round(-0.677 + 1.51 * Math.log(totalLength));
            var lcsLength = this.lcsLength(name1, name2);
    
            if (lcsLength >= minLcsLength)
                return lcsLength / totalLength;
            else
                return NaN;
        }
    
        /**
         * Sorts the islands by session and name
         */
        sortIslands() {
            view.islands.sort((a: Island, b: Island) => {
                if (a.isAllIslands() || a.name() == ALL_ISLANDS)
                    return -Infinity;
                else if (b.isAllIslands() || b.name() == ALL_ISLANDS)
                    return Infinity;
    
                var sIdxA = view.sessions.indexOf(a.session);
                var sIdxB = view.sessions.indexOf(b.session);
    
                if (sIdxA == sIdxB) {
                    return a.name().localeCompare(b.name());
                } else {
                    return sIdxA - sIdxB;
                }
            });
        }
    

    
        /**
         * Calculates the length of the longest common subsequence between two strings
         * Used for fuzzy name matching
         * @param {string} X - The first string
         * @param {string} Y - The second string
         * @returns {number} The length of the longest common subsequence
         */
        lcsLength(X: string, Y: string) {
            var m = X.length, n = Y.length;
    
            // lookup table stores solution to already computed sub-problems
            // i.e. lookup[i][j] stores the length of LCS of substring
            // X[0..i-1] and Y[0..j-1]
            var lookup = [];
            for (var i = 0; i <= m; i++)
                lookup.push(new Array(n + 1).fill(0));
    
            // fill the lookup table in bottom-up manner
            for (var i = 1; i <= m; i++) {
                for (var j = 1; j <= n; j++) {
                    // if current character of X and Y matches
                    if (X[i - 1] == Y[j - 1])
                        lookup[i][j] = lookup[i - 1][j - 1] + 1;
    
                    // else if current character of X and Y don't match
                    else
                        lookup[i][j] = Math.max(lookup[i - 1][j], lookup[i][j - 1]);
                }
            }
    
            // LCS will be last entry in the lookup table
            return lookup[m][n];
        }
}

/**
 * Represents an island in the game world
 * Manages all buildings, population, and production on a single island
 */
export class Island {
    public name: KnockoutObservable<string>;
    public isAllIslands: () => boolean;
    public storage: Storage;
    public session: Session;
    public region: Region;
    public sessionExtendedName: KnockoutComputed<string>;
    public needCategories: NeedCategory[];
    public populationLevels: PopulationLevel[];
    public populationGroups: PopulationGroup[];
    public residenceBuildings: ResidenceBuilding[];
    public publicServices: PublicConsumerBuilding[];
    public publicRecipeBuildings: PublicConsumerBuilding[];
    public consumers: Consumer[];
    public factories: Factory[];
    public categories: ProductCategory[];
    public multiFactoryProducts: Product[];
    public items: Item[];
    public replaceInputItems: Item[];
    public extraGoodItems: Item[];
    public recipeLists: RecipeList[];
    public workforce: Workforce[];

    public allEffects: Effect[];
    public availableEffects: KnockoutObservableArray<Effect>;
    
    public availablePatrons: Patron[];
    public selectedPatron: KnockoutObservable<Patron | null>;
    public devotion: KnockoutObservable<number>;
    public availablePatronEffects: KnockoutComputed<Effect[]>;
    public patronEffects: Effect[];

    public assetsMap: AssetsMap;
    public literalsMap: LiteralsMap;
    public products: Product[];
    public top2Population: KnockoutComputed<PopulationLevel[]>;
    public top5Factories: KnockoutComputed<Factory[]>;
    public workforceSectionVisible: KnockoutComputed<boolean>;
    public publicBuildingsSectionVisible: KnockoutComputed<boolean>;
    [key:string]: any;

    /**
     * Creates a new Island instance
     * @param params - Configuration parameters for the island
     * @param localStorage - Storage instance or localStorage object
     * @param isNew - Whether this is a newly created island
     * @param session - The session this island belongs to
     */
    constructor(params: ParamsConfig, localStorage: Storage, isNew: boolean, session: Session | null) {
        // Validate required parameters
        if (!params) {
            throw new Error('Island params is required');
        }
        if (!localStorage) {
            throw new Error('Island localStorage is required');
        }

        // Explicit assignments
        if (localStorage.key == ALL_ISLANDS) {
            this.name = ko.computed(() => window.view.texts.allIslands.name());
            this.isAllIslands = function () { return true; };
        } else {
            this.name = ko.observable(localStorage.key);
            this.name.subscribe(() => this.storage.updateKey(this.name()));
            this.isAllIslands = function () { return false; };
        }
        this.storage = localStorage;

        if (session){
            this.session = session;
            this.storage.setItem("session", this.session.guid);
        }  else { 
            const sessionGuid = this.storage.getItem("session");
            if (sessionGuid) {
                const session = view.assetsMap.get(sessionGuid);
                if (!session) {
                    throw new Error(`Session with GUID ${sessionGuid} not found in assetsMap`);
                }
                this.session = session;
            } else {
                this.session = window.view.sessions[0];
            }
        }
        this.region = this.session.region;

        

        var assetsMap = new Map() as AssetsMap;
        for (var key of view.assetsMap.keys())
            assetsMap.set(key, view.assetsMap.get(key));

        for (var effect of this.session.effects)
            assetsMap.set(effect.guid, effect);

        var literalsMap = new Map() as LiteralsMap;
        for (var key of view.literalsMap.keys())
            literalsMap.set(key, view.literalsMap.get(key));

        this.sessionExtendedName = ko.pureComputed(() => {
            if (!this.session)
                return this.name();

            return `${this.session.name()} - ${this.name()}`;
        });

        // procedures to persist inputs
        var persistBool: (obj: any, attributeName: string, storageName?: string) => void;
        var persistInt: (obj: any, attributeName: string, storageName?: string) => void;
        var persistFloat: (obj: any, attributeName: string, storageName?: string) => void;
        var persistString: (obj: any, attributeName: string, storageName?: string) => void;
        var persistBuildings: (obj: any) => void;

        if (localStorage) {
            persistBool = (obj: any, attributeName: string, storageName?: string) => {
                var attr = obj[attributeName];
                if (attr) {
                    let id = storageName ? storageName : (obj.guid + "." + attributeName);
                    if (localStorage.getItem(id) != null)
                        attr(parseInt(localStorage.getItem(id)));

                    attr.subscribe((val: boolean) => localStorage.setItem(id, val ? "1" : "0"));
                }
            }

            persistInt = (obj: any, attributeName: string, storageName?: string) => {
                var attr = obj[attributeName];
                if (attr) {
                    let id = storageName ? storageName : (obj.guid + "." + attributeName);
                    if (localStorage.getItem(id) != null)
                        attr(parseInt(localStorage.getItem(id)));

                    attr.subscribe((val: any) => {
                        val = parseInt(val);

                        if (val == null || !isFinite(val) || isNaN(val))
                            return;

                        localStorage.setItem(id, val.toString());
                    });

                }
            }

            persistFloat = (obj: any, attributeName: string, storageName?: string) => {
                var attr = obj[attributeName];
                if (attr) {
                    let id = storageName ? storageName : (obj.guid + "." + attributeName);
                    if (localStorage.getItem(id) != null)
                        attr(parseFloat(localStorage.getItem(id)));

                    attr.subscribe((val: any) => {
                        val = parseFloat(val);

                        if (val == null || !isFinite(val) || isNaN(val))
                            return;

                        localStorage.setItem(id, val.toString());
                    });
                }
            }

            persistString = (obj: any, attributeName: string, storageName?: string) => {
                var attr = obj[attributeName];
                if (attr) {
                    let id = storageName ? storageName : (obj.guid + "." + attributeName);
                    if (localStorage.getItem(id) != null)
                        attr(localStorage.getItem(id));

                    attr.subscribe((val: string) => localStorage.setItem(id, val));
                }
            }

            persistBuildings = (obj: any) => {
                for (let attr of ["constructed", "planned"]){
                    persistInt(obj.buildings as BuildingsCalc, attr, obj.guid + ".buildings." + attr);
                }
                persistBool(obj.buildings as BuildingsCalc, "fullyUtilizeConstructed", obj.guid + ".buildings.fullyUtilizeConstructed");
            }

        } else {
            persistBool = persistInt = persistFloat = persistString = persistBuildings = () => { };
        }

        // objects
        this.categories = [];
        this.products = [];
        this.needCategories = [];
        this.populationLevels = [];
        this.populationGroups = [];
        this.residenceBuildings = [];
        this.publicServices = [];
        this.publicRecipeBuildings = [];
        this.consumers = [];
        this.factories = [];
        this.multiFactoryProducts = [];
        this.items = [];
        this.replaceInputItems = [];
        this.extraGoodItems = [];
        this.recipeLists = [];
        this.workforce = [];
        
        // Initialize patron-related properties
        this.availablePatrons = [];
        this.selectedPatron = ko.observable(null);
        this.devotion = ko.observable(0);

        let products: Product[] = [];
        for (let product of params.products) {
            if (product.isAbstract) {
                let p = new MetaProduct(product, assetsMap);
                assetsMap.set(p.guid as number, p);
            } else {
                let p = new Product(product, assetsMap);

                products.push(p);
                assetsMap.set(p.guid, p);
                // Note: ExtraGoodSupplier will be created later during initSuppliers()
            }
        }



        for (let needCategory of (params.needCategories || [])) {
            const n = new NeedCategory(needCategory);
            this.needCategories.push(n);
            literalsMap.set(n.id, n);
        }

        for (let need of (params.needs || [])) {
            const n = new Need(need, assetsMap, literalsMap);
            assetsMap.set(n.guid, n);
        }

        for (let workforce of params.workforce) {
            let w = new Workforce(workforce, assetsMap);
            assetsMap.set(w.guid, w);
            this.workforce.push(w);
        }

        // for (let consumer of (params.publicServices || [])) {
        //    if (this.region.id != 'Meta' && consumer.associatedRegions.indexOf(this.region.id || '') == -1)
        //        continue;
        //     let f = new PublicConsumerBuilding(consumer, assetsMap, literalsMap, this);
        //     assetsMap.set(f.guid, f);
        //     this.consumers.push(f);
        //     this.publicServices.push(f);
        // }

        // for (let consumer of (params.publicRecipeBuildings || [])) {
        //    if (this.region.id != 'Meta' && consumer.associatedRegions.indexOf(this.region.id || '') == -1)
        //        continue;
        //     let f = new PublicConsumerBuilding(consumer, assetsMap, literalsMap, this);
        //     assetsMap.set(f.guid, f);
        //     this.consumers.push(f);
        //     this.publicRecipeBuildings.push(f);
        // }

        // for (let list of (params.recipeLists || [])) {
        //     if (!list.region || !this.region || list.region === this.region.guid)
        //         this.recipeLists.push(new RecipeList(list, assetsMap, this));
        // }

        for (let buff of (params.buildingBuffs || [])) {
            let b = new Buff(buff, assetsMap);
            assetsMap.set(b.guid, b);
        }

        for (let factory of params.factories) {

            if (this.region.id != 'Meta' && factory.associatedRegions.indexOf(this.region.id || '') == -1)
                continue;

            let f = new Factory(factory, assetsMap, literalsMap, this, params.modules);
            assetsMap.set(f.guid, f);
            this.consumers.push(f);
            this.factories.push(f);

            if (f.aqueductBuff){
                persistFloat(f.aqueductBuff, "scaling", `${f.guid}.aqueductBuff.checked`)
            }
            // Note: extraGoodProductionList moved to Product - persistence moved to product loop

            // Persist module checked state
            for (const module of f.modules) {
                persistBool(module, "checked", `${f.guid}.module[${module.guid}].checked`);
            }
        }


        this.allEffects = [];
        // Set up island effects
        for (let effect of (params.effects || [])) {
            if (!assetsMap.has(effect.guid)){              
            
                const e = new Effect(effect, assetsMap);
                assetsMap.set(e.guid, e);
            }
            
            const e = assetsMap.get(effect.guid) as Effect;
            if(e.effectScope != "ModuleOwner"){
                e.applyBuffs(assetsMap);
                this.allEffects.push(e);
            }
        }
        this.availableEffects = ko.pureComputed(() => {
            // For meta session (All Islands), show all effects
            if (this.isAllIslands()) {
                return this.allEffects.filter(e => e.available() && this.patronEffects.indexOf(e) == -1);
            }

            // For regular islands, only show effects that have targets in this island's session
            return this.allEffects.filter(e => {
                if (!e.available() || this.patronEffects.indexOf(e) != -1) {
                    return false;
                }

                // If effect targets all production, it's always relevant
                if (e.targetsIsAllProduction) {
                    return true;
                }

                // Check if any target is in this island's session (same region)
                const hasTargetsInSession = e.targets.some(target => {
                    // Check if target's associated regions include this island's region
                    return target.associatedRegions.some(region => region.guid === this.session.region.guid);
                });

                return hasTargetsInSession;
            });
        });

        // Set up persistence for island effects
        for (const effect of this.allEffects) {
            persistFloat(effect, "scaling", `island.effect.${effect.guid}.scaling`);
        }
        
        // Set up patrons
        this.patronEffects = [];
        for (let patron of (params.patrons || [])) {
            let p = new Patron(patron, assetsMap);
            assetsMap.set(p.guid, p);
            this.availablePatrons.push(p);
            p.localEffects?.forEach(group => this.patronEffects.push(group.effect))
        }
        
        // Set up computed property for available patron effects based on current patron and devotion
        this.availablePatronEffects = ko.computed(() => {
            const patron = this.selectedPatron();
            const devotionLevel = this.devotion();
            
            // Reset all patron effects scaling to 0 when no patron or no devotion
            for (const effect of this.patronEffects) {
                effect.scaling(0);
            }
            
            if (!patron || !patron.localEffects || devotionLevel <= 0) return [];
            
            const effects: Effect[] = [];
            for (const localEffect of patron.localEffects) {
                // Find the highest milestone that the devotion level meets (milestones are ordered ascending)
                const achievedMilestones = localEffect.milestones.filter((m: any) => devotionLevel >= m.devotion);
                if (achievedMilestones.length === 0) continue; // No milestone achieved
                
                const milestone = achievedMilestones[achievedMilestones.length - 1]; // Take the last (highest) one
                
                const effect = localEffect.effect;
                // Set the effect scaling based on milestone
                effect.scaling(milestone.buffScaling);
                effects.push(effect);
            }
            return effects;
        });


        for (let item of (params.items || [])) {
            let i = new Item(item, assetsMap, this.region);
            if (!i.factories.length)
                continue;  // Affects no factories in this region

            assetsMap.set(i.guid, i);
            this.items.push(i);

            if (i.replacements)
                this.replaceInputItems.push(i);

            if (i.additionalOutputs)
                this.extraGoodItems.push(i);

            if (localStorage) {

                for (var equip of i.equipments) {
                    let id = `${equip.target.guid}[${i.guid}].scaling`;
                    persistFloat(equip, "scaling", id);
                }

            }
        }

        this.extraGoodItems.sort((a, b) => (a ).name().localeCompare((b ).name()));
        view.settings.language.subscribe(() => {
            this.extraGoodItems.sort((a, b) => a.name().localeCompare(b.name()));
        });


        this.consumers.forEach(f => {
            f.initDemands(assetsMap);
        });

        // Initialize suppliers for all products
        products.forEach(p => {
            p.initSuppliers(this);
        });

        products.forEach(p => {
            if (p.factories.length > 1)
                this.multiFactoryProducts.push(p);


            if (localStorage) {
                persistString(p, "notes");
                persistFloat(p.passiveTradeSupplier, "userSetAmount", "passiveTrade.userSetAmount");

                // Restore default supplier from localStorage
                const typeKey = p.guid + ".defaultSupplier.type";
                const idKey = p.guid + ".defaultSupplier.id";
                const supplierType = localStorage.getItem(typeKey);
                const supplierId = localStorage.getItem(idKey);

                if (supplierType && supplierId) {
                    if (supplierType === 'null') {
                        p.defaultSupplier(null);
                    }
                    else if (supplierType === 'factory') {
                        const factory = assetsMap.get(parseInt(supplierId));
                        if (factory && p.factories.includes(factory)) {
                            p.defaultSupplier(factory);
                        }
                    } else if (supplierType === 'extra_good') {
                        // Find extra good supplier for this factory
                        const factoryGuid = parseInt(supplierId);
                        if (p.extraGoodSuppliers) {
                            for (const supplier of p.extraGoodSuppliers) {
                                if (supplier.factory.guid == factoryGuid) {
                                    p.defaultSupplier(supplier);
                                    break;
                                }
                            }
                        }
                    } else if (supplierType === 'passive_trade') {
                        if (p.passiveTradeSupplier) {
                            p.defaultSupplier(p.passiveTradeSupplier);
                        }
                    }
                    // Note: Trade routes will be handled by TradeManager
                }

                // Subscribe to changes for persistence
                p.defaultSupplier.subscribe((supplier: any) => {
                    if (!supplier) {
                        localStorage.setItem(typeKey, 'null');
                        localStorage.setItem(idKey, 'null');

                    } else if (supplier.type === 'factory') {
                        localStorage.setItem(typeKey, 'factory');
                        localStorage.setItem(idKey, supplier.guid.toString());

                    } else if (supplier.type === 'extra_good') {                        
                        localStorage.setItem(typeKey, 'extra_good');
                        localStorage.setItem(idKey, (supplier as ExtraGoodSupplier).factory.guid.toString());

                    } else if (supplier.type === 'passive_trade') {
                        localStorage.setItem(typeKey, 'passive_trade');
                        localStorage.setItem(idKey, 'passive');
                    }
                    // Note: Trade routes handled by TradeManager
                });

                
                if (isNew) // persist initial values, in case initialization logic changes with newer calculator version
                    p.defaultSupplier.notifySubscribers(p.defaultSupplier());
            }
        });

        // Persist patron selection and devotion - effects buffs are applied with other effects
        if (localStorage) {
            // Persist selected patron by GUID
            if (localStorage.getItem("selectedPatron") != null) {
                const patronGuid = parseInt(localStorage.getItem("selectedPatron"));
                const patron = this.availablePatrons.find(p => p.guid === patronGuid);
                if (patron) {
                    this.selectedPatron(patron);
                }
            }
            this.selectedPatron.subscribe((patron: Patron | null) => {
                localStorage.setItem("selectedPatron", patron ? patron.guid.toString() : "");
            });
            
            // Persist devotion level
            persistInt(this, "devotion", "devotion");
        
        }

        for (let level of params.populationLevels) {
            let l = new PopulationLevel(level, assetsMap, this);
            assetsMap.set(l.guid, l);
            this.populationLevels.push(l);
        }

        for (var building of (params.residenceBuildings || [])) {
            var b = new ResidenceBuilding(building, assetsMap, this);
            assetsMap.set(b.guid, b);
            this.residenceBuildings.push(b);
        }

        for (let group of params.populationGroups) {
            

            let g = new PopulationGroup(group, assetsMap, literalsMap);
            assetsMap.set(g.guid, g);
            this.populationGroups.push(g);
        }

        for (var b of this.residenceBuildings) {
            if (b.upgradedBuildingGuid) {
                const upgradedBuilding = assetsMap.get(parseInt(b.upgradedBuildingGuid));
                if (!upgradedBuilding) {
                    throw new Error(`Upgraded building with GUID ${b.upgradedBuildingGuid} not found in assetsMap`);
                }
                b.upgradedBuilding = upgradedBuilding;
            }

            b.initDemands(assetsMap);
        }

//        for (let l of this.populationLevels)
//            l.initBans(assetsMap);  // must be executed before loading the values for residence buildings

        // for (let effect of (params.residenceEffects || [])) {
        //     let e = new ResidenceEffect(effect, assetsMap);
        //     assetsMap.set(e.guid, e);
        //     if (localStorage)
        //         localStorage.removeItem(`${e.guid}.checked`);
        // }

        for (let b of this.residenceBuildings) {
            {
                let id = `${b.guid}.effectCoverage`;
                if (localStorage.getItem(id) != null)
                    b.applyEffects(JSON.parse(localStorage.getItem(id)));

                b.effectCoverage.subscribe(() => {
                    localStorage.setItem(id, JSON.stringify(b.serializeEffects()));
                });
            }
            persistBuildings(b);
        }

        for (let r of this.residenceBuildings) {
            persistString(r, "notes");
        }

        // Persist population-level needs instead of residence-level needs
        for (let populationLevel of this.populationLevels) {
            for (let need of populationLevel.needs) {
                persistBool(need, "checked", `${populationLevel.guid}[${need.need.guid}].checked`);
                persistString(need, "notes", `${populationLevel.guid}[${need.need.guid}].notes`);
            }
        }


        for (var category of params.productFilters) {
            let c = new ProductCategory(category, assetsMap);
            assetsMap.set(c.guid, c);
            this.categories.push(c);
        }

        for (let p of this.categories[1].products) {
            for (let b of p.factories) {
                if (b && typeof b.editable === 'function') {
                    b.editable(true);
                }
            }
        }

        for (let b of this.publicRecipeBuildings) {
            b.recipeName = ko.computed(() => {
                return b.name().split(':').slice(-1)[0].trim();
            });
        }

        for (let f of this.consumers) {
            persistBuildings(f);
        }

        this.workforce = this.workforce.filter(w => w.demands().length);

        this.assetsMap = assetsMap;
        this.literalsMap = literalsMap;
        this.products = products;

        this.top2Population = ko.computed(() => {
            var comp = (a: PopulationLevel, b: PopulationLevel) => b.residents() - a.residents();

            return [...this.populationLevels].sort(comp).slice(0, 2).filter(l => l.residents());
        });

        this.top5Factories = ko.computed(() => {
            var useBuildings = view.settings.missingBuildingsHighlight.checked();
            var comp = useBuildings
                ? (a: Factory, b: Factory) => b.buildings.constructed() - a.buildings.constructed()
                : (a: Factory, b: Factory) => b.buildings.required() - a.buildings.required();

            return [...this.factories].sort(comp).slice(0, 5).filter(f => useBuildings ? f.buildings.constructed() : f.buildings.required());
        });

        if (this.session)
            this.session.addIsland(this);

        this.workforceSectionVisible = ko.pureComputed(() => {
            for (var w of this.workforce)
                if (w.visible())
                    return true;

            return false;
        });

        this.publicBuildingsSectionVisible = ko.pureComputed(() => {
            for (var service of this.publicServices)
                if (service.visible())
                    return true;

            for (var recipeBuilding of this.publicRecipeBuildings)
                if (recipeBuilding.visible())
                    return true;

            for (var recipeList of this.recipeLists)
                if (recipeList.visible())
                    return true;

            return false;
        });
    }
    

    /**
     * Prepares the residence effect view for this island
     */
    prepareResidenceEffectView(): void {
        view.selectedResidenceEffectView(new ResidenceEffectView(this.residenceBuildings));
    }
    
    /**
     * Deletes an island (stub method for interface compatibility)
     * @param island - The island to delete
     */
    deleteIsland(_island: Island): void {
        // Implementation handled by IslandManager
    }

    activateAllNeeds(activate: boolean): void {
        // Apply activateAllNeeds setting for new islands
        for (let populationLevel of this.populationLevels) {
            for (let need of populationLevel.needs) {
                need.checked(activate);
            }
        }
                
    }
} 

export interface Constructible extends NamedElement{
    associatedRegions: Region[];
    buildings: BuildingsCalc,
    island: Island
    addBuff(appliedBuff: AppliedBuff) : void;
  }

/**
 * Type guard function to check if an object implements the Constructible interface
 * @param obj - The object to check
 * @returns True if the object implements Constructible interface
 */
export function isConstructible(obj: any): obj is Constructible {
    return obj && 
           typeof obj === 'object' &&
           'buildings' in obj &&
           'island' in obj &&
           typeof obj.addBuff === 'function' &&
           typeof obj.available === 'function' &&
           typeof obj.name === 'function';
}