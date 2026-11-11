// Hand-written types of the Anno 117 exchange format (spec 1.0, vendor/anno117-exchange).
// Every object is open: unknown content stays typed as Record<string, unknown> and is preserved.
// GUID-keyed maps use decimal GUID strings as keys.

import type { ParamsConfig } from "../types.config";

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

// The functions registered on window.exchange (KTD12). Later units add their members here.
export interface ExchangeApi {
    uniqueName(wanted: string, taken: Iterable<string>): string;
    reservedKeys(): { keys: string[]; prefixes: string[] };
    islandId(islandName: string): string | null;
    keys: ExchangeKeys;
    parseFactoryScalingKey(key: string): FactoryScalingKey | null;
    classifyItemOrEffect(guid: Guid): "item" | "effect" | "unknown";
    tables(): ExchangeTables;
    readExchange(text: string): ReadResult;
    planIslands(read: ReadOk): IslandsPlan;
}

// Result of readExchange (U4).
export type UnknownKind = "unknown" | "unmodelled";

// A field the calculator keeps without modelling it. `unknown`: not in the catalog. `unmodelled`: a catalog
// key the calculator does not model. `pointer` is the JSON Pointer of the original core location in the file,
// `value` is the same object as in `doc`, `scope` is the island id or "document".
export interface UnknownField {
    pointer: string;
    value: unknown;
    scope: string;
    kind: UnknownKind;
}

export type ReadProblemCode = "wrong-type" | "coerced" | "duplicate-instance" | "item-without-guid";

export interface ReadProblem {
    pointer: string;
    code: ReadProblemCode;
    message: string;
}

export interface ReadOk {
    doc: ExchangeDocument;
    unknown: UnknownField[];
    problems: ReadProblem[];
    // The file's `computed` block, kept for the comparison of U11; removed from `doc`.
    computed?: Computed;
}

export type ReadErrorCode =
    | "not-json"
    | "not-object"
    | "wrong-format"
    | "missing-formatVersion"
    | "invalid-formatVersion"
    | "unsupported-major"
    | "missing-generator-name"
    | "missing-islands"
    | "invalid-island"
    | "missing-island-id"
    | "duplicate-island-id";

export interface ReadError {
    error: string;
    code: ReadErrorCode;
}

export type ReadResult = ReadOk | ReadError;

// Storage key builders of src/exchange/keys.ts, as exposed on window.exchange.keys.
export interface ExchangeKeys {
    buildingsConstructed(g: Guid): string;
    buildingsPlanned(g: Guid): string;
    buildingsFullyUtilize(g: Guid): string;
    needChecked(level: Guid, need: Guid): string;
    needNotes(level: Guid, need: Guid): string;
    factoryItemScaling(factory: Guid, item: Guid): string;
    factoryEffectScaling(factory: Guid, effect: Guid): string;
    aqueductChecked(factory: Guid): string;
    moduleChecked(factory: Guid, module: Guid): string;
    islandEffectScaling(effect: Guid): string;
    islandFertilityChecked(fertility: Guid): string;
    productNotes(product: Guid): string;
    defaultSupplierType(product: Guid): string;
    defaultSupplierId(product: Guid): string;
    gameConnectorIslandId: string;
    gameConnectorAreaIndex: string;
    sessionEffectScaling(session: Guid, effect: Guid): string;
    globalEffectScaling(effect: Guid): string;
    globalEffectStoredKey(effect: Guid): string;
}

export interface FactoryScalingKey {
    target: Guid;
    guid: Guid;
    kind: "item" | "effect";
}

export interface DiscoveryEntry {
    tech: Guid;
    effects: Guid[];
    repeatable: boolean;
    dlcUnlocks: Guid[];
}

export interface SpecificEffects {
    session: Guid[];
    global: Guid[];
    neverWritable: Guid[];
}

export interface MaterialEntry {
    product: Guid;
    endFactories: Record<string, Guid>;
}

export interface MythicalItemEffect {
    effect: Guid;
    dlcUnlocks: Guid[];
}

// Plain-data snapshot of the mapping tables (U3), built from window.params.
export interface ExchangeTables {
    discoveries: DiscoveryEntry[];
    specificEffects: SpecificEffects;
    writableEffects: Guid[];
    materials: MaterialEntry[];
    mythicalItemEffects: MythicalItemEffect[];
}

// ---- Import plan for islands (U5) ----

// Where a line of the import report comes from. `carried-through`: kept in exchange.ext and written back on export.
// `not-mapped`: kept, but the calculator does not apply it. `approximated`: applied with a loss or a side effect.
// `not-provided`: the file does not say, the calculator keeps its own default.
export type ReportKind = "carried-through" | "not-mapped" | "approximated" | "not-provided";

export interface ReportEntry {
    kind: ReportKind;
    code: string;
    // File island id; absent for document-scope lines.
    island?: string;
    message: string;
    detail?: Record<string, unknown>;
}

// A captured field of an island. `pointer` is relative to the island record (e.g. "/population").
export interface CapturedField {
    pointer: string;
    kind: UnknownKind;
    value: unknown;
}

// A GUID-keyed entry (or a GUID inside a list) that params does not know, kept with its location in the island record.
export interface AbsentGuidEntry {
    pointer: string;
    value: unknown;
}

// Content of the island store key `exchange.ext`.
export interface IslandExt {
    // Display name the file gave the island (name, else gameIsland.name, else id), before the collision suffix.
    originalName: string;
    gameIsland?: { areaKey?: number; name?: string };
    captured: CapturedField[];
    guids: AbsentGuidEntry[];
    // Module `checked` values the import wrote (KTD14), by storage key.
    moduleWritten: Record<string, string>;
    [key: string]: unknown;
}

export interface IslandPlan {
    // File island id.
    id: string;
    // Display name after the collision suffix; equals `key`.
    name: string;
    // Top-level localStorage key of the island store.
    key: string;
    // Plain key map of the island store, values as the loaders expect them (counts and scalings numbers,
    // checked flags "1"/"0"). Includes `exchange.ext`.
    store: Record<string, unknown>;
    ext: IslandExt;
    report: ReportEntry[];
    // The island record of the file, for the trade and material units.
    file: ExchangeIsland;
}

export interface OrphanIsland {
    id: string;
    session?: number;
    island: ExchangeIsland;
}

export interface IslandsPlan {
    islands: IslandPlan[];
    orphans: OrphanIsland[];
    // All report lines: islands, orphans and the document-scope item places.
    report: ReportEntry[];
    // calculatorSettings keys the island data requires (DLC id -> "1"); merged by the settings unit.
    settingsKeys: Record<string, string>;
    // Document-scope parts preserved by the writer and exporter units.
    document: { account?: unknown; unlocatedItems?: unknown };
}

export type ImportParams = Pick<
    ParamsConfig,
    "sessions" | "regions" | "fertilities" | "patrons" | "dlcs" | "effects" | "items" | "factories" | "modules" | "residenceBuildings"
>;

export interface ImportContext {
    params: ImportParams;
}
