// Hand-written types of the Anno 117 exchange format (spec 1.0, vendor/anno117-exchange).
// Every object is open: unknown content stays typed as Record<string, unknown> and is preserved.
// GUID-keyed maps use decimal GUID strings as keys.

export type Guid = number;
export type GuidKey = string;
export type Ext = Record<string, Record<string, unknown>>;

export interface Generator {
    name: string;
    version?: string;
    [key: string]: unknown;
}

export interface Source {
    kind?: string;
    file?: string;
    savegameFormatVersion?: string | number;
    gameVersion?: string;
    saveTime?: string;
    [key: string]: unknown;
}

export interface ExchangeSettings {
    dlcs?: number[];
    difficulty?: Record<string, unknown>;
    volcano?: Record<string, unknown>;
    seasons?: Record<string, unknown>;
    map?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface Fleet {
    effects?: Record<GuidKey, number>;
    ships?: Record<string, unknown>[];
    [key: string]: unknown;
}

export interface ExchangeEffects {
    global?: Record<GuidKey, number>;
    bySession?: Record<GuidKey, Record<GuidKey, number>>;
    [key: string]: unknown;
}

export interface Research {
    researched?: Guid[];
    counts?: Record<GuidKey, number>;
    queue?: Guid[];
    knowledgePerMinute?: number;
    basis?: "researched" | "applied" | string;
    [key: string]: unknown;
}

export interface ItemRecord {
    item: Guid;
    instance?: number | string;
    slot?: number;
    count?: number;
    boosted?: boolean;
    boostConditionMet?: boolean;
    mythicEffect?: Guid;
    ext?: Ext;
    [key: string]: unknown;
}

export interface ItemHolder {
    kind?: "building" | "ship" | string;
    guid?: Guid;
    instance?: number | string;
    position?: Record<string, unknown>;
    rotation?: number;
    enabledSockets?: number[] | number;
    route?: string;
    items?: ItemRecord[];
    carried?: ItemRecord[];
    [key: string]: unknown;
}

export interface Account {
    items?: ItemRecord[];
    transferItems?: Guid[];
    racers?: Record<string, unknown>[];
    race?: { wins?: number; losses?: number; [key: string]: unknown };
    [key: string]: unknown;
}

export interface RouteSlot {
    product: Guid;
    mode: "load" | "unload" | string;
    slot?: number;
    amount?: number;
    [key: string]: unknown;
}

export interface RouteStation {
    island?: string;
    slots?: RouteSlot[];
    ext?: Ext;
    [key: string]: unknown;
}

export interface RouteShip {
    type?: Guid;
    slots?: number;
    count?: number;
    modules?: unknown;
    [key: string]: unknown;
}

export interface TradeRoute {
    id: string;
    name?: string;
    manual?: boolean;
    stations?: RouteStation[];
    ships?: RouteShip[];
    [key: string]: unknown;
}

export interface Supplier {
    island?: string;
    governor?: Guid;
    share?: number;
    amount?: number;
    default?: boolean;
    [key: string]: unknown;
}

export interface TradeImport {
    island: string;
    product: Guid;
    amount?: number;
    basis?: "planned" | "measured" | "entered" | string;
    suppliers?: Supplier[];
    [key: string]: unknown;
}

export interface Trade {
    routes?: TradeRoute[];
    imports?: TradeImport[];
    governorHarbours?: Record<string, unknown>[];
    visits?: Record<string, unknown>[];
    [key: string]: unknown;
}

export interface HistorySeries {
    island?: string;
    product?: Guid;
    kind?: string;
    clock?: string;
    unit?: string;
    start?: number;
    step?: number;
    values?: number[];
    points?: { t: number; v: number }[];
    [key: string]: unknown;
}

export interface ComputedIsland {
    residents?: Record<GuidKey, number>;
    buildingsRequired?: Record<GuidKey, number>;
    imports?: Record<GuidKey, number>;
    [key: string]: unknown;
}

export interface Computed {
    islands?: Record<string, ComputedIsland>;
    [key: string]: unknown;
}

export interface GameIsland {
    sessionGuid: Guid;
    islandId: number;
    areaIndex: number;
    areaKey?: number;
    name?: string;
    [key: string]: unknown;
}

export interface BuildingEntry {
    built?: number;
    planned?: number;
    fullyUtilize?: boolean;
    [key: string]: unknown;
}

export interface ItemChoice {
    item: Guid;
    boosted?: boolean;
    [key: string]: unknown;
}

export interface FactoryEntry {
    items?: ItemChoice[];
    effects?: Guid[];
    aqueduct?: boolean;
    modules?: Record<GuidKey, boolean>;
    manualProductivity?: number;
    [key: string]: unknown;
}

export interface ProductEntry {
    producer?: Guid | "none";
    notes?: string;
    [key: string]: unknown;
}

export interface ModuleAttachment {
    building: Guid;
    instance: number | string;
    module: Guid;
    moduleInstance: number | string;
    [key: string]: unknown;
}

export interface Coverage {
    default?: number;
    byLevel?: Record<GuidKey, number>;
    byResidence?: Record<GuidKey, number>;
    [key: string]: unknown;
}

export interface ExchangeIsland {
    id: string;
    name?: string;
    session?: Guid;
    gameIsland?: GameIsland;
    islandFile?: string;
    islandSize?: string;
    fertilities?: Record<GuidKey, boolean>;
    fertilitiesComplete?: boolean;
    patron?: Guid;
    devotion?: number;
    buildings?: Record<GuidKey, BuildingEntry>;
    residencesByLevel?: Record<GuidKey, number>;
    population?: Record<GuidKey, number>;
    disabledNeeds?: Record<GuidKey, Guid[]>;
    needNotes?: Record<GuidKey, Record<GuidKey, string>>;
    products?: Record<GuidKey, ProductEntry>;
    factories?: Record<GuidKey, FactoryEntry>;
    itemHolders?: ItemHolder[];
    itemStorage?: ItemRecord[];
    moduleAttachments?: ModuleAttachment[];
    effects?: Record<GuidKey, number>;
    appliedEffects?: Record<string, unknown>[];
    rangeBuffs?: Record<GuidKey, number>;
    residenceItems?: ItemChoice[];
    islandItems?: ItemChoice[];
    villaCoverage?: number;
    residenceEffects?: Coverage;
    publicCoverages?: Record<GuidKey, Coverage>;
    notes?: Record<GuidKey, string>;
    harbour?: Record<string, unknown>;
    position?: Record<string, unknown>;
    materials?: Record<string, unknown>;
    romanization?: Record<string, unknown>;
    wonders?: Record<string, unknown>;
    extraDemand?: Record<string, unknown>;
    minimumStock?: Record<GuidKey, number>;
    layout?: Record<string, unknown>;
    ext?: Ext;
    [key: string]: unknown;
}

export interface ExchangeDocument {
    format: "anno117-exchange";
    formatVersion: string;
    generator: Generator;
    source?: Source;
    name?: string;
    settings?: ExchangeSettings;
    fleet?: Fleet;
    effects?: ExchangeEffects;
    research?: Research;
    dominantPatron?: Guid;
    trade?: Trade;
    history?: HistorySeries[];
    live?: Record<string, unknown>;
    account?: Account;
    unlocatedItems?: ItemRecord[];
    computed?: Computed;
    islands: ExchangeIsland[];
    ext?: Ext;
    [key: string]: unknown;
}

// The functions registered on window.exchange by later units (KTD12) are added here as they land.
export interface ExchangeApi {
    [name: string]: unknown;
}
