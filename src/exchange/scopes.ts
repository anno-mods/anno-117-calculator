// Scope model and key classifier of the scoped import (U1). One table-driven `classify(kind, key, lookups)` answers
// which of the five scopes owns a stored key, a `calculatorSettings` key or an `exchange.ext` pointer. It classifies
// by raw storage key, not by planner module, because the planner modules write keys of other scopes (KD2).
// Keys without a scope (UI state, unknown keys) return null: a scoped import never touches them (R9).

import { GuidClassifier } from "./keys";
import { makeClassifier } from "./materials";
import { ImportParams, ImportScope, ScopeSelection } from "./types";

export const SCOPES: ImportScope[] = ["islands", "residences", "production", "trade", "modifiers"];

// calculatorSettings keys that hold the scope ticks and toggles: `settings.importScope.<name>`.
export const IMPORT_SCOPE_SETTING_PREFIX = "settings.importScope.";
export const SCOPE_SETTING_NAMES = ["islands", "residences", "production", "trade", "modifiers", "keepIslands", "keepRoutes", "recalcRoutes"] as const;

export const DEFAULT_SELECTION: ScopeSelection = {
    islands: true,
    residences: true,
    production: true,
    trade: true,
    modifiers: true,
    keepIslands: true,
    keepRoutes: true,
    recalcRoutes: true,
};

// Device preferences inside calculatorSettings: never exported, never imported, never part of an undo restore (R3).
export function isDeviceSetting(key: string): boolean {
    return key === "language" || key.startsWith(IMPORT_SCOPE_SETTING_PREFIX);
}

// The toggles of an unticked scope are treated as off (the stored value stays in the settings).
export function effectiveSelection(sel: ScopeSelection): ScopeSelection {
    return {
        ...sel,
        keepIslands: sel.islands && sel.keepIslands,
        keepRoutes: sel.trade && sel.keepRoutes,
        recalcRoutes: sel.trade && sel.recalcRoutes,
    };
}

export function allScopesTicked(sel: ScopeSelection): boolean {
    return SCOPES.every((s) => sel[s]);
}

// Five ticks and both keep toggles off: the import takes the unchanged clear-and-rewrite path (KTD1). The route
// re-calculation toggle changes the plan, not the merge, so it does not enter.
export function isFullReplacement(sel: ScopeSelection): boolean {
    return allScopesTicked(sel) && !sel.keepIslands && !sel.keepRoutes;
}

export interface ScopeLookups {
    residences: Set<number>;
    factories: Set<number>;
    modules: Set<number>;
    products: Set<number>;
    dlcIds: Set<string>;
    itemOrEffect: GuidClassifier;
}

export function buildScopeLookups(params: ImportParams): ScopeLookups {
    return {
        residences: new Set(params.residenceBuildings.map((b) => b.guid)),
        factories: new Set(params.factories.map((f) => f.guid)),
        modules: new Set(params.modules.map((m) => m.guid)),
        products: new Set(params.products.map((p) => p.guid)),
        dlcIds: new Set(params.dlcs.map((d) => d.id)),
        itemOrEffect: makeClassifier(params.items, params.effects),
    };
}

export type KeyKind = "island" | "top" | "setting" | "ext-island" | "ext-document";

const RE_BUILDING = /^(\d+)\.buildings\.(constructed|planned|fullyUtilizeConstructed)$/;
const RE_NEED = /^\d+\[\d+\]\.(checked|notes)$/;
const RE_COVERAGE = /^\d+\[\d+\]\.(coverage|publicCoverage)$/;
const RE_SCALING = /^(\d+)\[(\d+)\]\.scaling$/;
const RE_AQUEDUCT = /^\d+\.aqueductBuff\.checked$/;
const RE_MODULE = /^\d+\.module\[\d+\]\.checked$/;
const RE_ISLAND_EFFECT = /^island\.effect\.\d+\.scaling$/;
const RE_FERTILITY = /^island\.fertility\.\d+\.checked$/;
const RE_NOTES = /^(\d+)\.notes$/;
const RE_EFFECT_COVERAGE = /^\d+\.effectCoverage$/;
const RE_DEFAULT_SUPPLIER = /^\d+\.defaultSupplier\.(type|id)$/;
const RE_PRODUCT_TRADE = /^\d+\.(governorSupply|passiveTrade\.userSetAmount)$/;
const RE_RESIDENCE_ITEM = /^residenceItem\.\d+\.state$/;

const ISLAND_IDENTITY_KEYS = new Set(["session", "exchange.islandId"]);
const TRADE_KEYS = new Set(["passiveTrade.userSetAmount"]);
const MODIFIER_KEYS = new Set(["selectedPatron", "devotion"]);
const RESIDENCE_KEYS = new Set(["villaCoverage", "publicCoverage"]);

function classifyIslandKey(key: string, lk: ScopeLookups): ImportScope | null {
    if (ISLAND_IDENTITY_KEYS.has(key) || key.startsWith("gameConnector.")) return "islands";
    if (TRADE_KEYS.has(key)) return "trade";
    if (MODIFIER_KEYS.has(key)) return "modifiers";
    if (RESIDENCE_KEYS.has(key)) return "residences";

    let m = RE_BUILDING.exec(key);
    if (m) {
        const g = parseInt(m[1], 10);
        if (lk.residences.has(g)) return "residences";
        if (m[2] === "fullyUtilizeConstructed" && lk.factories.has(g)) return "trade";
        if (lk.factories.has(g) || lk.modules.has(g)) return "production";
        return null;
    }
    if (RE_NEED.test(key) || RE_COVERAGE.test(key) || RE_EFFECT_COVERAGE.test(key)) return "residences";
    m = RE_SCALING.exec(key);
    if (m) return lk.itemOrEffect(parseInt(m[2], 10)) === "unknown" ? null : "modifiers";
    if (RE_AQUEDUCT.test(key) || RE_ISLAND_EFFECT.test(key) || RE_FERTILITY.test(key) || RE_RESIDENCE_ITEM.test(key)) return "modifiers";
    if (RE_MODULE.test(key)) return "production";
    m = RE_NOTES.exec(key);
    if (m) {
        const g = parseInt(m[1], 10);
        if (lk.residences.has(g)) return "residences";
        return lk.products.has(g) ? "production" : null;
    }
    if (RE_DEFAULT_SUPPLIER.test(key) || RE_PRODUCT_TRADE.test(key)) return "trade";
    return null;
}

function classifyTopKey(key: string): ImportScope | null {
    switch (key) {
        case "tradeRoutes":
            return "trade";
        case "globalEffects":
        case "sessionSettings":
            return "modifiers";
        case "islandNames":
        case "islandName":
            return "islands";
        default:
            return null;
    }
}

const SETTING_MODIFIER_PREFIXES = ["settings.volcano", "settings.seasons", "settings.difficulty"];

function classifySettingKey(key: string, lk: ScopeLookups): ImportScope | null {
    if (isDeviceSetting(key)) return null;
    if (lk.dlcIds.has(key) || key === "settings.needConsumption") return "modifiers";
    return SETTING_MODIFIER_PREFIXES.some((p) => key.startsWith(p)) ? "modifiers" : null;
}

function lookup(table: Record<string, ImportScope | null>, key: string): ImportScope | null {
    return Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null;
}

function segments(pointer: string): string[] | null {
    if (typeof pointer !== "string" || !pointer.startsWith("/")) return null;
    return pointer.split("/").slice(1).map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
}

const ISLAND_POINTER_HEAD: Record<string, ImportScope | null> = {
    id: "islands",
    name: "islands",
    session: "islands",
    gameIsland: "islands",
    islandFile: "islands",
    islandSize: "islands",
    position: "islands",
    residencesByLevel: "residences",
    disabledNeeds: "residences",
    needNotes: "residences",
    notes: "residences",
    residenceEffects: "residences",
    publicCoverages: "residences",
    villaCoverage: "residences",
    fertilities: "modifiers",
    fertilitiesComplete: "modifiers",
    patron: "modifiers",
    devotion: "modifiers",
    effects: "modifiers",
    appliedEffects: "modifiers",
    rangeBuffs: "modifiers",
    itemHolders: "modifiers",
    itemStorage: "modifiers",
    residenceItems: "modifiers",
    islandItems: "modifiers",
    wonders: "modifiers",
    romanization: "modifiers",
    moduleAttachments: "production",
    materials: "production",
    minimumStock: "trade",
    harbour: "trade",
    fleet: "trade",
};

// `pointer` is relative to the island record. A building GUID the calculator does not know is kept with Production.
function classifyIslandPointer(pointer: string, lk: ScopeLookups): ImportScope | null {
    const s = segments(pointer);
    if (!s || s.length === 0) return null;
    const head = s[0];
    if (head === "buildings") {
        if (s.length < 2) return null;
        const g = parseInt(s[1], 10);
        return lk.residences.has(g) ? "residences" : "production";
    }
    if (head === "factories") {
        if (s.length >= 3 && (s[2] === "items" || s[2] === "effects" || s[2] === "aqueduct")) return "modifiers";
        return "production";
    }
    if (head === "products") {
        return s.length >= 3 && s[2] === "notes" ? "production" : "trade";
    }
    return lookup(ISLAND_POINTER_HEAD, head);
}

const DOCUMENT_POINTER_HEAD: Record<string, ImportScope | null> = {
    trade: "trade",
    fleet: "trade",
    effects: "modifiers",
    research: "modifiers",
    dominantPatron: "modifiers",
};

function classifyDocumentPointer(pointer: string): ImportScope | null {
    const s = segments(pointer);
    if (!s || s.length === 0) return null;
    if (s[0] === "settings") return s[1] === "map" ? "islands" : "modifiers";
    return lookup(DOCUMENT_POINTER_HEAD, s[0]);
}

export function classify(kind: KeyKind, key: string, lk: ScopeLookups): ImportScope | null {
    try {
        switch (kind) {
            case "island":
                return classifyIslandKey(key, lk);
            case "top":
                return classifyTopKey(key);
            case "setting":
                return classifySettingKey(key, lk);
            case "ext-island":
                return classifyIslandPointer(key, lk);
            case "ext-document":
                return classifyDocumentPointer(key);
        }
    } catch {
        return null;
    }
}

// Members of `exchange.ext` that hold content of one scope as a whole. `captured` and `guids` are lists whose entries
// are classified by their pointer (see mergeExtList in merge.ts); a member not listed here is unscoped.
const ISLAND_EXT_MEMBERS: Record<string, ImportScope | null> = {
    originalName: "islands",
    gameIsland: "islands",
    moduleWritten: "production",
    materials: "production",
    preservedImports: "trade",
    minimumStock: "trade",
};

const DOCUMENT_EXT_MEMBERS: Record<string, ImportScope | null> = {
    orphans: "islands",
    fileIslandIds: "islands",
    trade: "trade",
    preservedImports: "trade",
    research: "modifiers",
    effects: "modifiers",
    settings: "modifiers",
};

export function classifyExtMember(level: "island" | "document", member: string): ImportScope | null {
    return lookup(level === "island" ? ISLAND_EXT_MEMBERS : DOCUMENT_EXT_MEMBERS, member);
}

// The product a Trade-scope island key belongs to (default supplier, governor supply, per-product passive amount), or null.
export function tradeKeyProduct(key: string): number | null {
    const m = /^(\d+)\.(defaultSupplier\.(type|id)|governorSupply|passiveTrade\.userSetAmount)$/.exec(key);
    return m ? parseInt(m[1], 10) : null;
}
