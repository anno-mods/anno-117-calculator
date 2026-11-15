// Scoped merge (U4): computes the final key map of a scoped import from the stored snapshot, the complete plan of the
// file, the selection and the island matches. Pure: no storage, no DOM. The planners stay unaware of scopes (KTD2); this
// module picks, per key, the stored value or the planned one.
//
// Per matched island store: for every ticked scope except Trade, the stored keys of that scope are removed and the
// planned keys of that scope are written (replace semantics, KTD3). Keys without a scope stay (R9). Trade is merged last
// because the factory fully-utilize setting depends on the factory counts that Production may have written (R17).
// The factory fully-utilize keys are classified Trade but are only overlaid, never removed: a stored setting for a
// factory the file does not mention stays.

import { ALL_ISLANDS } from "../util";
import { allScopesTicked, classify, classifyExtMember, isFullReplacement, ScopeLookups, tradeKeyProduct } from "./scopes";
import { ImportPlan, ImportScope, IslandMatch, MergeResult, ScopeSelection, SkippedIsland, StoredTradeRoute } from "./types";

type Json = Record<string, unknown>;

const EXT_KEY = "exchange.ext";
const FULLY_UTILIZE_SUFFIX = ".buildings.fullyUtilizeConstructed";

function isObj(v: unknown): v is Json {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseObj(text: string | undefined): Json | undefined {
    if (text === undefined) return undefined;
    try {
        const v: unknown = JSON.parse(text);
        return isObj(v) ? v : undefined;
    } catch {
        return undefined;
    }
}

function parseList(text: string | undefined): unknown[] {
    if (text === undefined) return [];
    try {
        const v: unknown = JSON.parse(text);
        return Array.isArray(v) ? v : [];
    } catch {
        return [];
    }
}

function isRoute(v: unknown): v is StoredTradeRoute {
    return isObj(v) && typeof v.productGUID === "number" && typeof v.from === "string" && typeof v.to === "string";
}

const routeId = (r: StoredTradeRoute): string => `${r.productGUID}|${r.from}|${r.to}`;
const pairId = (r: StoredTradeRoute): string => `${r.productGUID}|${r.to}`;

// ---- exchange.ext ----

interface ExtOptions {
    level: "island" | "document";
    sel: ScopeSelection;
    lk: ScopeLookups;
    // True when nothing is stored for the owner of this ext: unscoped planned content is written too.
    isNew: boolean;
    // Keep mode of Trade: stored preserved import entries that stay next to the planned ones.
    keepPreserved?: ((entry: Json) => boolean) | undefined;
    // Document level: stored `fileIslandIds` stay next to the planned ones.
    unionFileIds?: boolean;
}

function entryScope(level: "island" | "document", entry: unknown, lk: ScopeLookups): ImportScope | null {
    if (!isObj(entry) || typeof entry.pointer !== "string") return null;
    return classify(level === "island" ? "ext-island" : "ext-document", entry.pointer, lk);
}

// `captured` and `guids`: one list of entries each, classified by pointer. Entries of ticked scopes come from the plan,
// the rest from the store, so a list is never mixed within one scope.
function mergeExtList(member: string, stored: unknown, planned: unknown, o: ExtOptions): unknown[] {
    const s = Array.isArray(stored) ? stored : [];
    const p = Array.isArray(planned) ? planned : [];
    const keep = s.filter((e) => {
        const scope = entryScope(o.level, e, o.lk);
        return scope === null || !o.sel[scope];
    });
    const take = p.filter((e) => {
        const scope = entryScope(o.level, e, o.lk);
        return scope === null ? o.isNew : o.sel[scope];
    });
    void member;
    return [...keep, ...take];
}

function mergeExt(stored: Json | undefined, planned: Json | undefined, o: ExtOptions): Json {
    const s = stored ?? {};
    const p = planned ?? {};
    const result: Json = {};
    for (const m of new Set([...Object.keys(s), ...Object.keys(p)])) {
        if (m === "captured" || m === "guids") {
            result[m] = mergeExtList(m, s[m], p[m], o);
            continue;
        }
        const scope = classifyExtMember(o.level, m);
        const fromPlan = scope === null ? o.isNew : o.sel[scope];
        let value: unknown = fromPlan ? p[m] : s[m];
        if (m === "preservedImports" && fromPlan && o.keepPreserved) {
            const planProducts = new Set((Array.isArray(p[m]) ? (p[m] as unknown[]) : []).map((e) => (isObj(e) && isObj(e.entry) ? e.entry.product : undefined)));
            const kept = (Array.isArray(s[m]) ? (s[m] as unknown[]) : []).filter((e) => isObj(e) && isObj(e.entry) && !planProducts.has(e.entry.product) && o.keepPreserved?.(e.entry));
            value = [...kept, ...(Array.isArray(p[m]) ? (p[m] as unknown[]) : [])];
        } else if (m === "fileIslandIds" && o.unionFileIds) {
            value = [...new Set([...(Array.isArray(s[m]) ? (s[m] as unknown[]) : []), ...(Array.isArray(p[m]) ? (p[m] as unknown[]) : [])])];
        }
        if (value !== undefined) result[m] = value;
    }
    return result;
}

// ---- island stores ----

interface IslandMergeInfo {
    sel: ScopeSelection;
    lk: ScopeLookups;
    // Route pairs (`product|receiver`) the file produces a route set for.
    producedPairs: Set<string>;
}

function plannedProducts(planned: Json, key: string, info: IslandMergeInfo): Set<number> {
    const out = new Set<number>();
    for (const k of Object.keys(planned)) {
        const p = tradeKeyProduct(k);
        if (p !== null) out.add(p);
    }
    for (const pair of info.producedPairs) {
        const [product, to] = pair.split("|");
        if (to === key) out.add(parseInt(product, 10));
    }
    return out;
}

function mergeIslandStore(base: Json | undefined, planned: Json, key: string, info: IslandMergeInfo): Json {
    const { sel, lk } = info;
    const isNew = base === undefined;
    const result: Json = { ...(base ?? {}) };
    const plannedKeys = Object.keys(planned).filter((k) => k !== EXT_KEY);

    for (const scope of ["islands", "residences", "production", "modifiers"] as ImportScope[]) {
        if (!sel[scope]) continue;
        for (const k of Object.keys(result)) if (k !== EXT_KEY && classify("island", k, lk) === scope) delete result[k];
        for (const k of plannedKeys) if (classify("island", k, lk) === scope) result[k] = planned[k];
    }

    if (sel.trade) {
        const produced = plannedProducts(planned, key, info);
        for (const k of Object.keys(result)) {
            if (k === EXT_KEY || k.endsWith(FULLY_UTILIZE_SUFFIX) || classify("island", k, lk) !== "trade") continue;
            const product = tradeKeyProduct(k);
            if (!sel.keepRoutes || (product !== null && produced.has(product))) delete result[k];
        }
        for (const k of plannedKeys) {
            if (classify("island", k, lk) !== "trade") continue;
            if (k.endsWith(FULLY_UTILIZE_SUFFIX)) {
                // R17: only where the resulting store has the factory built; a factory is never created by this rule.
                const built = Number(result[`${k.slice(0, -FULLY_UTILIZE_SUFFIX.length)}.buildings.constructed`]);
                if (Number.isFinite(built) && built > 0) result[k] = planned[k];
            } else {
                result[k] = planned[k];
            }
        }
    }

    if (isNew) for (const k of plannedKeys) if (classify("island", k, lk) === null) result[k] = planned[k];

    const produced = plannedProducts(planned, key, info);
    const ext = mergeExt(isObj(base?.[EXT_KEY]) ? (base?.[EXT_KEY] as Json) : undefined, isObj(planned[EXT_KEY]) ? (planned[EXT_KEY] as Json) : undefined, {
        level: "island",
        sel,
        lk,
        isNew,
        keepPreserved: sel.keepRoutes ? (entry) => typeof entry.product === "number" && !produced.has(entry.product) : undefined,
    });
    result[EXT_KEY] = ext;
    return result;
}

// Rewrites the `restore` snapshot of every preserved import entry of an island store to the routes, default supplier and
// passive amount the store holds after the merge. Returns true when something changed. The governor supply is not part of
// it: the plan writes it together with the snapshot.
function refreshPreserved(store: Json, key: string, routes: StoredTradeRoute[]): boolean {
    const ext = store[EXT_KEY];
    if (!isObj(ext) || !Array.isArray(ext.preservedImports)) return false;
    let changed = false;
    for (const kept of ext.preservedImports) {
        if (!isObj(kept) || !isObj(kept.restore) || typeof kept.restore.product !== "number") continue;
        const restore = kept.restore;
        const product = restore.product as number;
        const current = routes
            .filter((r) => r.to === key && r.productGUID === product)
            .map((r) => ({ from: r.from, to: r.to, userSetAmount: r.userSetAmount, isDefaultSupplier: r.isDefaultSupplier }));
        const type = store[`${product}.defaultSupplier.type`];
        const id = store[`${product}.defaultSupplier.id`];
        const def = type !== undefined && id !== undefined ? { type: String(type), id: String(id) } : null;
        const passive = Number(store["passiveTrade.userSetAmount"]);
        const next = Number.isFinite(passive) ? passive : 0;
        if (JSON.stringify(restore.routes) !== JSON.stringify(current) || JSON.stringify(restore.defaultSupplier) !== JSON.stringify(def) || restore.passiveUserSetAmount !== next) {
            restore.routes = current;
            restore.defaultSupplier = def;
            restore.passiveUserSetAmount = next;
            changed = true;
        }
    }
    return changed;
}

// ---- kept routes (U8) ----

// The stored routes that can survive a keep-routes import: ordinary routes between islands that stay. The planner drops
// the ones of pairs the file produces a route set for and lets the rest take part in the cycle and duplicate checks.
export function keptRouteCandidates(stored: Map<string, string>, sel: ScopeSelection, matches: IslandMatch[]): StoredTradeRoute[] {
    if (!sel.trade || !sel.keepRoutes) return [];
    const claimed = new Set(matches.map((m) => m.calcName).filter((n): n is string => n !== null));
    const names = parseList(stored.get("islandNames")).filter((n): n is string => typeof n === "string");
    const removed = new Set<string>();
    if (sel.islands && !sel.keepIslands) for (const n of names) if (n !== ALL_ISLANDS && !claimed.has(n)) removed.add(n);
    return parseList(stored.get("tradeRoutes"))
        .filter(isRoute)
        .filter((r) => r.from !== ALL_ISLANDS && r.to !== ALL_ISLANDS && !removed.has(r.from) && !removed.has(r.to));
}

// ---- the merge ----

export function mergeScoped(stored: Map<string, string>, plan: ImportPlan, sel: ScopeSelection, matches: IslandMatch[], lk: ScopeLookups): MergeResult {
    const skipped: SkippedIsland[] = [...(plan.skipped ?? [])];
    if (isFullReplacement(sel)) return { keyMap: { ...plan.keyMap }, skipped };

    const out = new Map(stored);
    const all5 = allScopesTicked(sel);
    const calcOf = new Map(matches.map((m) => [m.fileId, m.calcName]));
    const planned = plan.islands ?? [];

    const storedNames = parseList(stored.get("islandNames")).filter((n): n is string => typeof n === "string");
    const storedIslands = storedNames.filter((n) => n !== ALL_ISLANDS);
    const claimed = new Set<string>();
    for (const p of planned) {
        const c = calcOf.get(p.id);
        if (c) claimed.add(c);
    }
    const removed = new Set<string>();
    if (sel.islands && !sel.keepIslands) for (const n of storedIslands) if (!claimed.has(n)) removed.add(n);

    // Route pairs the file produces a route set for (aggregate routes are handled separately, R12).
    const planRoutes = parseList(plan.keyMap["tradeRoutes"]).filter(isRoute);
    const producedPairs = new Set(planRoutes.filter((r) => r.from !== ALL_ISLANDS && r.to !== ALL_ISLANDS).map(pairId));
    const info: IslandMergeInfo = { sel, lk, producedPairs };

    const renames = new Map<string, string>();
    const newStores = new Map<string, string>();
    const replaced = new Set<string>();
    for (const p of planned) {
        const calc = calcOf.get(p.id) ?? null;
        let base: Json | undefined;
        if (calc !== null && stored.has(calc)) {
            base = parseObj(stored.get(calc));
            if (!base) {
                skipped.push({ id: p.id, name: calc, values: 0, reason: "invalid-store" });
                continue;
            }
            replaced.add(calc);
            if (calc !== p.key) renames.set(calc, p.key);
        }
        const store = parseObj(plan.keyMap[p.key]) ?? {};
        newStores.set(p.key, JSON.stringify(mergeIslandStore(base, store, p.key, info)));
    }
    for (const n of removed) out.delete(n);
    for (const n of replaced) out.delete(n);
    for (const [k, v] of newStores) out.set(k, v);

    // Island list.
    if (sel.islands) {
        const names: string[] = [];
        for (const n of storedNames) {
            if (n === ALL_ISLANDS || (sel.keepIslands && !claimed.has(n))) names.push(n);
        }
        for (const p of planned) if (!names.includes(p.key)) names.push(p.key);
        out.set("islandNames", JSON.stringify(names));
        if (names.length) out.set("islandName", names.find((n) => n !== ALL_ISLANDS) ?? names[0]);
    }

    // Routes: removed islands take their routes along, renamed islands keep theirs (R12, R16).
    let routes = parseList(stored.get("tradeRoutes"))
        .filter(isRoute)
        .filter((r) => !removed.has(r.from) && !removed.has(r.to))
        .map((r) => ({ ...r, from: renames.get(r.from) ?? r.from, to: renames.get(r.to) ?? r.to }));
    if (sel.trade) {
        const isAggregate = (r: StoredTradeRoute): boolean => r.from === ALL_ISLANDS || r.to === ALL_ISLANDS;
        const planRouteIds = new Set(planRoutes.map(routeId));
        const keptStored = routes.filter((r) => {
            if (isAggregate(r)) return !all5 && !planRouteIds.has(routeId(r));
            if (!sel.keepRoutes) return false;
            return !producedPairs.has(pairId(r)) && !planRouteIds.has(routeId(r));
        });
        routes = [...keptStored, ...planRoutes.filter((r) => all5 || !isAggregate(r))];
    }
    if (routes.length || stored.has("tradeRoutes") || sel.trade) out.set("tradeRoutes", JSON.stringify(routes));

    // R17a: the preserved entries the plan brought hold the state this import leaves behind. Routes that stay (keep mode)
    // and a stored passive amount differ from what the planner wrote, and the exporter would otherwise drop the entry.
    if (sel.trade) {
        for (const key of newStores.keys()) {
            const text = out.get(key);
            const store = text === undefined ? undefined : parseObj(text);
            if (!store || !refreshPreserved(store, key, routes)) continue;
            out.set(key, JSON.stringify(store));
        }
    }

    // The aggregate store is overwritten only when every scope is ticked (R12, OQ5).
    if (all5) {
        const all = plan.keyMap[ALL_ISLANDS];
        if (all !== undefined) out.set(ALL_ISLANDS, all);
        else out.delete(ALL_ISLANDS);
    }

    // Settings: DLC "1" is applied whenever the plan has it, everything else of Modifiers only with Modifiers ticked (R13).
    const settings = parseObj(stored.get("calculatorSettings")) ?? {};
    const plannedSettings = parseObj(plan.keyMap["calculatorSettings"]) ?? {};
    let settingsChanged = false;
    for (const k of Object.keys(plannedSettings)) {
        if (classify("setting", k, lk) !== "modifiers") continue;
        const v = plannedSettings[k];
        const apply = lk.dlcIds.has(k) && v === "1" ? true : sel.modifiers;
        if (apply && settings[k] !== v) {
            settings[k] = v;
            settingsChanged = true;
        }
    }
    if (settingsChanged || stored.has("calculatorSettings")) out.set("calculatorSettings", JSON.stringify(settings));

    if (sel.modifiers) {
        for (const k of ["globalEffects", "sessionSettings"]) {
            const v = plan.keyMap[k];
            if (v !== undefined) out.set(k, v);
        }
    }

    // Document-level exchange.ext.
    const docExt = mergeExt(parseObj(stored.get(EXT_KEY)), parseObj(plan.keyMap[EXT_KEY]), {
        level: "document",
        sel,
        lk,
        isNew: false,
        keepPreserved: sel.keepRoutes ? () => true : undefined,
        unionFileIds: sel.islands ? sel.keepIslands : sel.trade,
    });
    out.set(EXT_KEY, JSON.stringify(docExt));

    return { keyMap: Object.fromEntries(out), skipped };
}
