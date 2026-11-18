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
    villaCoverage?: number | Coverage;
    residenceEffects?: Record<GuidKey, Record<GuidKey, number>> | Coverage;
    publicCoverages?: Record<GuidKey, Record<GuidKey, number>> | Coverage;
    publicCoverage?: number;
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

import type { ApplyOptions, ApplyResult } from "./writer";
import type { UndoOptions, UndoResult } from "./undo";

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
    planTrade(islands: IslandsPlan, read: ReadOk, opts?: Pick<ImportContext, "recalcRoutes" | "keptRoutes">): TradePlan;
    // Route derivation of derive-routes.ts: supplier sets from savegame routes, and the gate of the re-calculation toggle.
    deriveImports(routes: TradeRoute[], visits?: Record<string, unknown>[]): TradeImport[];
    hasShipRoutes(doc: { trade?: Pick<Trade, "routes"> }): boolean;
    planEffects(islands: IslandsPlan, read: ReadOk): EffectsPlan;
    planImport(text: string): ImportPlanResult;
    // Plans an import of the ticked scopes and merges it into the stored data (scopes.ts, merge.ts).
    planScopedImport(text: string, selection: ScopeSelection): ScopedImportResult;
    applyImport(plan: ImportPlan, opts?: ApplyOptions): ApplyResult;
    // The pure merge over a stored snapshot given as an object (tests).
    mergeScoped(stored: Record<string, string>, plan: ImportPlan, selection: ScopeSelection, matches: IslandMatch[]): MergeResult;
    // Scope of a stored island key ("island"), top-level key ("top"), calculatorSettings key ("setting") or an
    // exchange.ext pointer ("ext-island", "ext-document"); null when the key has none.
    classifyKey(kind: "island" | "top" | "setting" | "ext-island" | "ext-document", key: string): ImportScope | null;
    isDeviceSetting(key: string): boolean;
    assignIslandIds(): string[];
    readStoredIslands(): StoredIslandRecord[];
    matchIslands(fileIslands: FileIslandRefRecord[], stored: StoredIslandRecord[], opts?: { defaultSession?: number; knownSessions?: Set<number> }): IslandMatch[];
    undo: {
        saveSnapshot(map: Map<string, string>, opts?: UndoOptions): UndoResult;
        hasSnapshot(opts?: UndoOptions): boolean;
        clearSnapshot(opts?: UndoOptions): void;
        restoreSnapshot(opts?: UndoOptions): UndoResult;
        snapshot(): Map<string, string>;
    };
    // U9: reads localStorage (after flushing pending debounced saves) and returns the exchange document.
    buildDocument(): ExchangeDocument;
    exportDocument(): ExportResult;
    // U11 registers this; buildDocument adds its result as `computed` when present.
    computeSummary?(): Computed;
}

// Result of exportDocument (U9). `report` lists what the export dropped or approximated because the user changed the
// data the preserved copy depended on (codes: module-attachments-dropped, import-entry-dropped, entry-pruned,
// preserved-field-dropped, item-boost-dropped, governor-amount-not-exported); kind is "approximated" for every entry.
export interface ExportResult {
    document: ExchangeDocument;
    report: ReportEntry[];
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
    // Added by the trade unit (U6): original import entries of the island, `minimumStock` of the file.
    preservedImports?: PreservedImport[];
    minimumStock?: Record<GuidKey, number>;
    // Added by the effects unit (U7): `materials` of the file when it holds content the calculator cannot place.
    materials?: Record<string, unknown>;
    // Added by the calculator-state import (U9): keys of the file's `islands[].ext.calculator` the calculator does not
    // know (everything but `store`), written back unchanged.
    calculator?: Record<string, unknown>;
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
    // Name of the matched calculator island (scoped import); `key` equals it while Islands is unticked.
    matchedTo?: string;
}

export interface OrphanIsland {
    id: string;
    session?: number;
    island: ExchangeIsland;
}

export interface IslandsPlan {
    islands: IslandPlan[];
    // File islands without a calculator match while Islands is unticked: planned for counting, written nowhere.
    skipped: SkippedIsland[];
    orphans: OrphanIsland[];
    // All report lines: islands, orphans and the document-scope item places.
    report: ReportEntry[];
    // calculatorSettings keys the island data requires (DLC id -> "1"); merged by the settings unit.
    settingsKeys: Record<string, string>;
    // Document-scope parts preserved by the writer and exporter units.
    document: { account?: unknown; unlocatedItems?: unknown };
}

// ---- Import plan for trade and suppliers (U6) ----

// A route entry as the app stores it in the top-level localStorage key `tradeRoutes` (src/trade.ts TradeRouteConfig).
// `from` supplies `to`; both are final island store keys.
export interface StoredTradeRoute {
    productGUID: Guid;
    from: string;
    to: string;
    userSetAmount: number;
    isDefaultSupplier: boolean;
}

// Why an import entry is kept in the ext although routes may have been written for it.
export type PreservedImportReason =
    | "ambiguous-default"
    | "cycle"
    | "governor-supplier"
    | "non-player-supplier"
    | "self-supplier"
    | "unknown-product"
    | "receiver-unavailable"
    // An island supplier carried a planned amount that the import did not write as a floor (R19a); the entry keeps it.
    | "amount-kept";

// What the import wrote for one receiving island and product (CD10): the exporter restores a preserved entry
// only while the stored state still equals this.
export interface TradeRestore {
    // Receiving island store key, or the file island id when the receiver has no store.
    island: string;
    product: Guid;
    // Routes written for (island, product), in tradeRoutes order, without `productGUID`.
    routes: Omit<StoredTradeRoute, "productGUID">[];
    // `<product>.defaultSupplier.type/.id` the import wrote for the product on the island; null when it wrote none.
    defaultSupplier: { type: string; id: string } | null;
    // Value the import relies on for the shared `passiveTrade.userSetAmount` key. The import never writes it; 0 means absent or 0.
    passiveUserSetAmount: number;
    // Sum of the governor amounts the import wrote to `<product>.governorSupply` (t/min); 0 when it wrote none. Entries
    // saved before the field existed lack it and read as 0.
    governorSupply?: number;
}

export interface PreservedImport {
    reasons: PreservedImportReason[];
    // The original import entry of the file, whole.
    entry: TradeImport;
    // The suppliers of the entry that the import did not write as routes (governor, non-player, self).
    preserved: Supplier[];
    restore: TradeRestore;
}

export interface TradeIslandPlan {
    // Store keys to add to the island store of IslandPlan.store.
    store: Record<string, unknown>;
    ext: {
        preservedImports: PreservedImport[];
        // `minimumStock` of the island record, unchanged.
        minimumStock?: Record<GuidKey, number>;
        // Product entries/producers params does not know, with their location in the island record (like IslandExt.guids).
        guids: AbsentGuidEntry[];
    };
}

export interface TradePlan {
    tradeRoutes: StoredTradeRoute[];
    // By island store key; one entry for every island of the IslandsPlan.
    islands: Record<string, TradeIslandPlan>;
    // Document-scope parts, preserved unchanged: trade.routes, visits, governorHarbours, and import entries whose
    // receiving island has no store.
    document: {
        trade?: { routes?: TradeRoute[]; visits?: Record<string, unknown>[]; governorHarbours?: Record<string, unknown>[] };
        preservedImports: PreservedImport[];
    };
    report: ReportEntry[];
}

// ---- Import plan for discoveries, effects, settings and materials (U7) ----

// What the importer keeps of the document-level effect, research and settings blocks that it does not write to storage.
// Content of the `research`, `effects` and `settings` keys of the top-level `exchange.ext`.
export interface ResearchExt {
    // Discoveries (and counts) the calculator has no counterpart for, as in the file.
    unmatched?: Guid[];
    unmatchedCounts?: Record<GuidKey, number>;
    queue?: Guid[];
    knowledgePerMinute?: number;
    basis?: string;
}

export interface EffectsExt {
    // Entries of `effects.global` the calculator cannot write (unknown GUID, wrong scope, dormant area buff).
    global?: Record<GuidKey, number>;
    // Same for `effects.bySession`: unknown session, unknown effect or an effect of another scope.
    bySession?: Record<GuidKey, Record<GuidKey, number>>;
}

export interface SettingsExt {
    // `settings.volcano` and `settings.seasons` as given: the calculator applies the specific effects only (CD7).
    volcano?: Record<string, unknown>;
    seasons?: Record<string, unknown>;
    // `settings.difficulty` without the need consumption id when that id was written.
    difficulty?: Record<string, unknown>;
    // DLC numbers that no entry of params.dlcs maps.
    dlcsUnknown?: number[];
}

export interface EffectsPlan {
    // `<effect>.scaling` -> scale: content of the top-level key `globalEffects`.
    globalEffects: Record<string, number>;
    // `session.<session>.effect.<effect>.scaling` -> scale: content of the top-level key `sessionSettings`.
    sessionSettings: Record<string, number>;
    // Content of the key `volcano.unlocked` of `sessionSettings`; absent when the file states no unlocked volcano effect.
    volcanoUnlocked?: number[];
    // DLC keys ("1"/"0") and `settings.needConsumption`: content of the top-level key `calculatorSettings`.
    calculatorSettings: Record<string, string>;
    // Additions to the island stores by island store key (construction materials, R50).
    islands: Record<string, { store: Record<string, unknown>; ext: { materials?: Record<string, unknown> } }>;
    // Document-scope parts kept in the top-level `exchange.ext`.
    ext: { research?: ResearchExt; effects?: EffectsExt; settings?: SettingsExt };
    // research.basis as read: absent is "researched".
    basis: string;
    report: ReportEntry[];
}

// ---- The complete import plan (U7) ----

export interface PlanProblem {
    pointer: string;
    code: ReadProblemCode | "invalid-json";
    message: string;
}

export interface ImportPlanReport {
    carriedThrough: ReportEntry[];
    notMapped: ReportEntry[];
    approximated: ReportEntry[];
    notProvided: ReportEntry[];
    counts: {
        // islands written as stores
        islands: number;
        // islands kept in exchange.ext.orphans
        orphans: number;
        tradeRoutes: number;
        // import entries kept whole in an ext (island and document level)
        preservedImports: number;
        // fields kept in an island ext or in the top-level ext because the calculator does not model them
        capturedFields: number;
    };
    orphans: { id: string; session?: number }[];
}

// Top-level localStorage key `exchange.ext`.
export interface DocumentExt {
    orphans: OrphanIsland[];
    account?: unknown;
    unlocatedItems?: unknown;
    // Document-level captured fields (unknown and unmodelled), pointer as in the file.
    captured: CapturedField[];
    trade?: { routes?: TradeRoute[]; visits?: Record<string, unknown>[]; governorHarbours?: Record<string, unknown>[] };
    // Import entries whose receiving island has no store.
    preservedImports: PreservedImport[];
    research?: ResearchExt;
    effects?: EffectsExt;
    settings?: SettingsExt;
    // Ids of the file's islands[] at import time (U9): the exporter prunes references to the ones that are gone (KTD15)
    // and keeps references to ids that never named an island of the file (non-player suppliers).
    fileIslandIds?: string[];
    // Keys of the file's top-level `ext.calculator` the calculator does not know, written back unchanged (U9).
    calculator?: Record<string, unknown>;
    [key: string]: unknown;
}

// Shape of the calculator's own `ext.calculator` blocks (U9). Document level: raw calculator-only state. Island
// level: `store` holds the island-store keys that have no counterpart in the core format, by raw storage key.
export interface CalculatorDocumentExt {
    collapsibleStates?: Record<string, unknown>;
    darkMode?: boolean;
    statisticsCollections?: Record<string, unknown>;
    allIslands?: Record<string, unknown>;
    routes?: StoredTradeRoute[];
    settings?: Record<string, unknown>;
    areaBuffs?: Record<GuidKey, number>;
    [key: string]: unknown;
}

export interface CalculatorIslandExt {
    store?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface ImportPlan {
    // Raw top-level localStorage keys -> value. Every value is a string; all are JSON text except `islandName`.
    keyMap: Record<string, string>;
    report: ImportPlanReport;
    orphans: OrphanIsland[];
    // The file's `computed` block; undefined when the file has none. Kept for tests and the export round trip.
    computed?: Computed;
    // The planned islands in plan order (file id and final store key).
    islands?: PlannedIsland[];
    // File islands left out because no calculator island matched (scoped import with Islands unticked).
    skipped?: SkippedIsland[];
    // Problems of the reader (coerced or dropped values) and of the key map validation (KTD1).
    problems: PlanProblem[];
}

export type ImportPlanResult = ImportPlan | ReadError;

export type ImportParams = Pick<
    ParamsConfig,
    | "sessions"
    | "regions"
    | "fertilities"
    | "patrons"
    | "dlcs"
    | "effects"
    | "items"
    | "factories"
    | "modules"
    | "residenceBuildings"
    | "products"
    | "techs"
    | "needConsumptions"
    | "buildingBuffs"
    | "publicServices"
>;

// ---- Import scopes ----

export type ImportScope = "islands" | "residences" | "production" | "trade" | "modifiers";

// The five scope ticks and the three toggles of the Download dialog. The toggles only act while their scope is ticked.
export interface ScopeSelection {
    islands: boolean;
    residences: boolean;
    production: boolean;
    trade: boolean;
    modifiers: boolean;
    // Calculator islands that are not in the file stay with all their data (only with Islands ticked).
    keepIslands: boolean;
    // Calculator routes the file does not replace stay (only with Trade ticked).
    keepRoutes: boolean;
    // Derive island supplier sets from the file's savegame route data (only with Trade ticked).
    recalcRoutes: boolean;
}

// Result of matching one file island against the stored calculator islands (R10).
export interface IslandMatch {
    fileId: string;
    // Name (= storage key) of the matched calculator island; null without a match.
    calcName: string | null;
    by: "id" | "triple" | "name" | null;
}

// Shapes of src/exchange/matching.ts as seen through window.exchange.
export interface StoredIslandRecord {
    name: string;
    id: string | undefined;
    session: number | undefined;
    triple: { islandId: number; areaIndex: number } | undefined;
}

export interface FileIslandRefRecord {
    id: string;
    name: string;
    session: number | undefined;
    gameIsland: { sessionGuid: number | undefined; islandId: number; areaIndex: number } | undefined;
}

// A file island that no calculator island matched while Islands is unticked, or a stored store the merge could not read.
export interface SkippedIsland {
    id: string;
    name: string;
    // Number of planned values that were not written.
    values: number;
    reason: "unmatched" | "invalid-store";
}

export interface ImportContext {
    params: ImportParams;
    // Partial selection of a scoped import; absent for a full import. Planning stays a pure function of the file.
    scope?: ScopeSelection;
    // Matches of the file islands against the stored calculator islands (scoped import only).
    matches?: IslandMatch[];
    // Names of the stored calculator islands (scoped import only); kept islands reserve their names.
    storedIslandNames?: string[];
    // Derive the island supplier sets from the file's savegame routes where they carry ships (R18). Effective only with Trade ticked.
    recalcRoutes?: boolean;
    // Stored calculator routes that survive the import (keep routes on): they take part in the default-supplier cycle and
    // duplicate checks. Names are stored island names; the planner maps matched islands to their plan keys. The planner drops
    // the routes of every (product, receiver) pair the file produces a route set for (R21).
    keptRoutes?: StoredTradeRoute[];
}

// A planned island: file island id and the final key of its store.
export interface PlannedIsland {
    id: string;
    key: string;
}

export interface MergeResult {
    // Every top-level key the calculator holds after the import.
    keyMap: Record<string, string>;
    skipped: SkippedIsland[];
}

export type ScopedImportResult = (ImportPlan & { skipped: SkippedIsland[] }) | ReadError;
