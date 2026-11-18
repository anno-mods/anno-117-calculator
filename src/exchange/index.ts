import { EffectsPlan, ExchangeApi, ExchangeTables, ImportPlanResult, IslandsPlan, ReadOk, ScopedImportResult, ScopeSelection, TradePlan } from "./types";
import { planEffects } from "./import-effects";
import { planIslands } from "./import-islands";
import { planImport } from "./plan";
import { planTrade } from "./import-trade";
import { reservedKeys, uniqueName } from "./names";
import * as keys from "./keys";
import { buildDiscoveries, buildSpecificEffects, buildWritableEffects } from "./discoveries";
import { applyImport, snapshot } from "./writer";
import { buildDocument, exportDocument } from "./exporter";
import { computeSummary } from "./computed";
import { readExchange } from "./reader";
import { buildMaterials, buildMythicalItemEffects, makeClassifier } from "./materials";
import { assignIslandIds, fileIslandRefs, matchIslands, readStoredIslands } from "./matching";
import { keptRouteCandidates, mergeScoped } from "./merge";
import { deriveImports, hasShipRoutes } from "./derive-routes";
import { buildScopeLookups, classify, effectiveSelection, isDeviceSetting, isFullReplacement } from "./scopes";
import { clearSnapshot, hasSnapshot, restoreSnapshot, saveSnapshot } from "./undo";

// Tables are derived from window.params on demand; params.js is loaded before the bundle and never changes at runtime.
function tables(): ExchangeTables {
    const params = window.params;
    const discoveries = buildDiscoveries(params.techs);
    const specificEffects = buildSpecificEffects(params.effects);
    return {
        discoveries,
        specificEffects,
        writableEffects: buildWritableEffects(discoveries, specificEffects),
        materials: buildMaterials(params.products, params.factories),
        mythicalItemEffects: buildMythicalItemEffects(params.effects),
    };
}

function classifyItemOrEffect(guid: number): "item" | "effect" | "unknown" {
    return makeClassifier(window.params.items, window.params.effects)(guid);
}

// Plans an import of the ticked scopes. Five ticks with both keep toggles off take the unchanged full path (KTD1).
// Otherwise the islands are matched against the stored calculator islands, the whole file is planned and the result is
// merged into the stored data: the key map of the returned plan is everything the calculator holds after the import.
function planScopedImport(text: string, selection: ScopeSelection): ScopedImportResult {
    const sel = effectiveSelection(selection);
    const params = window.params;
    if (isFullReplacement(sel)) {
        const plan = planImport(text, { params, recalcRoutes: sel.recalcRoutes });
        return "error" in plan ? plan : { ...plan, skipped: [] };
    }
    const read = readExchange(text);
    if ("error" in read) return read;

    assignIslandIds();
    const stored = readStoredIslands();
    const matches = matchIslands(fileIslandRefs(read.doc.islands), stored, {
        defaultSession: params.sessions.length ? params.sessions[0].guid : undefined,
        knownSessions: new Set<number>(params.sessions.map((s: { guid: number }) => s.guid)),
    });
    const storedKeys = snapshot(window.localStorage);
    const plan = planImport(text, {
        params,
        scope: sel,
        matches,
        storedIslandNames: stored.map((s) => s.name),
        recalcRoutes: sel.recalcRoutes,
        keptRoutes: keptRouteCandidates(storedKeys, sel, matches),
    });
    if ("error" in plan) return plan;
    const merged = mergeScoped(storedKeys, plan, sel, matches, buildScopeLookups(params));
    return { ...plan, keyMap: merged.keyMap, skipped: merged.skipped };
}

// Narrow test and debug entry point (KTD12). Later units register their functions here.
export const exchange: ExchangeApi = {
    uniqueName,
    reservedKeys,
    // Island id (KTD3) by island name; assigned lazily on first read. null for an unknown island.
    islandId: (islandName: string): string | null => {
        const island = window.view?.islands?.().find((i: { name(): string }) => i.name() === islandName);
        return island ? island.exchangeIslandId : null;
    },
    keys,
    parseFactoryScalingKey: (key: string) => keys.parseFactoryScalingKey(key, classifyItemOrEffect),
    classifyItemOrEffect,
    tables,
    readExchange,
    planIslands: (read: ReadOk): IslandsPlan => planIslands(read, { params: window.params }),
    planTrade: (islands: IslandsPlan, read: ReadOk, opts): TradePlan => planTrade(islands, read, { params: window.params, ...opts }),
    deriveImports,
    hasShipRoutes,
    planEffects: (islands: IslandsPlan, read: ReadOk): EffectsPlan => planEffects(islands, read, { params: window.params }),
    planImport: (text: string): ImportPlanResult => planImport(text, { params: window.params }),
    planScopedImport,
    applyImport,
    buildDocument,
    exportDocument,
    computeSummary,
    mergeScoped: (stored, plan, selection, matches) => mergeScoped(new Map(Object.entries(stored)), plan, effectiveSelection(selection), matches, buildScopeLookups(window.params)),
    classifyKey: (kind, key) => classify(kind, key, buildScopeLookups(window.params)),
    isDeviceSetting,
    assignIslandIds,
    readStoredIslands,
    matchIslands,
    undo: { saveSnapshot, hasSnapshot, clearSnapshot, restoreSnapshot, snapshot: () => snapshot(window.localStorage) },
};

declare global {
    interface Window {
        exchange: ExchangeApi;
    }
}

window.exchange = exchange;
