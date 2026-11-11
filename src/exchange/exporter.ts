// Exporter (U9): builds an exchange document from the calculator's stored state. It reads localStorage, not live
// Storage objects, after flushing the debounced saves of the live stores. Values are parsed as leniently as the app
// loaders do (parseInt/parseFloat, numbers and strings mixed). It exports what the user set, plus the explicit
// exceptions of KTD13 (construction-material end factories and module buildings carry fullyUtilize, disabledNeeds is
// always present). The preserved content of `exchange.ext` returns to its original core locations; whatever the
// user changed since the import wins over the preserved copy (R15).

import * as keys from "./keys";
import { AREA_BUFF_GUIDS, NILE_FLOOD_EFFECT, NILE_FLOOD_SESSION, VOLCANO_EFFECTS, VOLCANO_SESSIONS, buildDiscoveries } from "./discoveries";
import { buildMaterials, makeClassifier } from "./materials";
import { generateExchangeIslandId, Storage } from "../world";
import { ALL_ISLANDS, versionCalculator } from "../util";
import {
    BuildingEntry,
    DocumentExt,
    ExchangeDocument,
    ExchangeIsland,
    ExportResult,
    FactoryEntry,
    Guid,
    ImportParams,
    IslandExt,
    ItemChoice,
    PreservedImport,
    ReportEntry,
    Supplier,
    TradeImport,
} from "./types";

type Json = Record<string, unknown>;

const FORMAT = "anno117-exchange";
const FORMAT_VERSION = "1.0";
const EXTENSION = "calculator";
// Keys of calculatorSettings that are not part of `ext.calculator.settings`: device preference.
const DEVICE_SETTINGS = new Set(["language"]);
const NEED_CONSUMPTION_KEY = "settings.needConsumption";
// Pointer segments whose value is a list: a missing list is recreated as a list when a preserved entry returns into it.
const LIST_KEYS = new Set(["items", "effects"]);

const RE_BUILDING = /^(\d+)\.buildings\.(constructed|planned|fullyUtilizeConstructed)$/;
const RE_NEED_CHECKED = /^(\d+)\[(\d+)\]\.checked$/;
const RE_NEED_NOTES = /^(\d+)\[(\d+)\]\.notes$/;
const RE_SCALING = /^(\d+)\[(\d+)\]\.scaling$/;
const RE_AQUEDUCT = /^(\d+)\.aqueductBuff\.checked$/;
const RE_MODULE = /^(\d+)\.module\[(\d+)\]\.checked$/;
const RE_ISLAND_EFFECT = /^island\.effect\.(\d+)\.scaling$/;
const RE_FERTILITY = /^island\.fertility\.(\d+)\.checked$/;
const RE_NOTES = /^(\d+)\.notes$/;
const RE_DEFAULT_SUPPLIER = /^(\d+)\.defaultSupplier\.(type|id)$/;
const RE_GLOBAL_EFFECT = /^(\d+)\.scaling$/;
const RE_SESSION_EFFECT = /^session\.(\d+)\.effect\.(\d+)\.scaling$/;

// ---- lenient value parsing (the loaders use parseInt / parseFloat on whatever is stored) ----

function isObj(v: unknown): v is Json {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toInt(v: unknown): number | undefined {
    if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : undefined;
    if (typeof v === "string") {
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? undefined : n;
    }
    return undefined;
}

function toNum(v: unknown): number | undefined {
    if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
    if (typeof v === "string") {
        const n = parseFloat(v);
        return Number.isFinite(n) ? n : undefined;
    }
    return undefined;
}

function toFlag(v: unknown): boolean | undefined {
    if (typeof v === "boolean") return v;
    const n = toInt(v);
    return n === undefined ? undefined : n !== 0;
}

function readJson(key: string): unknown {
    const text = localStorage.getItem(key);
    if (text === null) return undefined;
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

function clone<T>(v: T): T {
    return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

// ---- JSON pointer restore: a preserved field returns to its original core location ----

function unescapeSegment(s: string): string {
    return s.replace(/~1/g, "/").replace(/~0/g, "~");
}

type RestoreResult = "set" | "exists" | "dropped";

// Puts `value` at `pointer` below `root`. Missing parent objects are created; a value the calculator's own data
// already holds at the location is not overwritten (edits win); a location below a list element that no longer
// exists is dropped. An entry of a list (an unknown GUID inside factories[f].items or .effects) is inserted at its
// original index.
function restoreAt(root: Json, pointer: string, value: unknown): RestoreResult {
    const segments = pointer.split("/").slice(1).map(unescapeSegment);
    if (segments.length === 0) return "dropped";
    let cur: unknown = root;
    for (let i = 0; i < segments.length - 1; i++) {
        const key = segments[i];
        if (Array.isArray(cur)) {
            const next: unknown = cur[Number(key)];
            if (typeof next !== "object" || next === null) return "dropped";
            cur = next;
            continue;
        }
        if (!isObj(cur)) return "dropped";
        let next = cur[key];
        if (next === undefined) {
            const following = segments[i + 1];
            next = LIST_KEYS.has(key) && /^\d+$/.test(following) ? [] : {};
            cur[key] = next;
        }
        if (typeof next !== "object" || next === null) return "dropped";
        cur = next;
    }
    const last = segments[segments.length - 1];
    if (Array.isArray(cur)) {
        const index = Number(last);
        if (!Number.isInteger(index) || index < 0) return "dropped";
        cur.splice(Math.min(index, cur.length), 0, value);
        return "set";
    }
    if (!isObj(cur)) return "dropped";
    if (cur[last] !== undefined) return "exists";
    cur[last] = value;
    return "set";
}

function sameRoute(
    expected: { from: string; userSetAmount: number; isDefaultSupplier: boolean },
    current: { from: string; amount: number; isDefault: boolean },
    islandNames: Set<string>,
): boolean {
    if (current.amount !== expected.userSetAmount || current.isDefault !== expected.isDefaultSupplier) return false;
    // A name that is no island any more was renamed (a deleted island takes its routes along and changes the count).
    return current.from === expected.from || !islandNames.has(expected.from);
}

interface Route {
    product: number;
    from: string;
    to: string;
    amount: number;
    isDefault: boolean;
}

interface BuiltIsland {
    name: string;
    id: string;
    store: Json;
    ext: IslandExt;
    out: ExchangeIsland;
}

class Exporter {
    private readonly params: ImportParams = window.params;
    private readonly report: ReportEntry[] = [];
    private readonly classify = makeClassifier(this.params.items, this.params.effects);
    private readonly moduleGuids = new Set<number>(this.params.modules.map((m) => m.guid));
    private readonly residences = new Set<number>(this.params.residenceBuildings.map((r) => r.guid));
    private readonly products = new Set<number>(this.params.products.map((p) => p.guid));
    private readonly effects = new Set<number>(this.params.effects.map((e) => e.guid));
    private readonly boostable = new Set<number>(this.params.items.filter((i) => (i.boostBuffs ?? []).length > 0).map((i) => i.guid));
    private readonly explicitFullyUtilize = new Set<number>();
    // product -> factories that output it (the import states R51 for them when the island receives the product)
    private readonly factoriesOf = new Map<number, number[]>();
    private readonly areaBuffs = new Set<number>(AREA_BUFF_GUIDS);
    private readonly defaultSession: number | undefined = this.params.sessions.length ? this.params.sessions[0].guid : undefined;

    private documentExt: DocumentExt = { orphans: [], captured: [], preservedImports: [] };
    private exportedIds = new Set<string>();

    constructor() {
        for (const m of buildMaterials(this.params.products, this.params.factories)) {
            for (const region of Object.keys(m.endFactories)) this.explicitFullyUtilize.add(m.endFactories[region]);
        }
        for (const m of this.moduleGuids) this.explicitFullyUtilize.add(m);
        for (const f of this.params.factories) {
            for (const o of f.outputs) this.factoriesOf.set(o.product, [...(this.factoriesOf.get(o.product) ?? []), f.guid]);
        }
    }

    private note(code: string, message: string, island?: string, detail?: Record<string, unknown>): void {
        const e: ReportEntry = { kind: "approximated", code, message };
        if (island !== undefined) e.island = island;
        if (detail) e.detail = detail;
        this.report.push(e);
    }

    // Puts a preserved value back and reports it when it cannot return.
    private restore(root: Json, pointer: string, value: unknown, island?: string): void {
        if (restoreAt(root, pointer, value) === "dropped") {
            this.note("preserved-field-dropped", `${pointer} cannot be written back: the entry it sat in no longer exists.`, island, { pointer });
        }
    }

    // ---- storage access ----

    // Assigns missing island ids through the live islands (their Storage keeps the id), flushes the pending saves and
    // returns the island names in the stored order.
    private prepare(): string[] {
        Storage.flushPending();
        const listed = readJson("islandNames");
        const names = Array.isArray(listed) ? listed.filter((n): n is string => typeof n === "string" && n !== ALL_ISLANDS) : [];
        let assigned = false;
        for (const name of names) {
            const store = readJson(name);
            if (isObj(store) && typeof store["exchange.islandId"] === "string" && store["exchange.islandId"] !== "") continue;
            const live = window.view?.islands?.().find((i: { name(): string; isAllIslands(): boolean }) => !i.isAllIslands() && i.name() === name);
            if (live) {
                void live.exchangeIslandId;
                assigned = true;
            } else if (isObj(store)) {
                // no live island (the state was replaced without a reload): write the id into the stored JSON
                store["exchange.islandId"] = generateExchangeIslandId();
                localStorage.setItem(name, JSON.stringify(store));
            }
        }
        if (assigned) Storage.flushPending();
        return names;
    }

    private readDocumentExt(): void {
        const ext = readJson("exchange.ext");
        if (!isObj(ext)) return;
        const e = ext as unknown as Partial<DocumentExt>;
        this.documentExt = {
            ...e,
            orphans: Array.isArray(e.orphans) ? e.orphans : [],
            captured: Array.isArray(e.captured) ? e.captured : [],
            preservedImports: Array.isArray(e.preservedImports) ? e.preservedImports : [],
        };
    }

    private readIslandExt(value: unknown): IslandExt {
        const empty: IslandExt = { originalName: "", captured: [], guids: [], moduleWritten: {} };
        if (!isObj(value)) return empty;
        const e = value as unknown as Partial<IslandExt>;
        return {
            ...e,
            originalName: typeof e.originalName === "string" ? e.originalName : "",
            captured: Array.isArray(e.captured) ? e.captured : [],
            guids: Array.isArray(e.guids) ? e.guids : [],
            moduleWritten: isObj(e.moduleWritten) ? (e.moduleWritten as Record<string, string>) : {},
        };
    }

    private readRoutes(): Route[] {
        const stored = readJson("tradeRoutes");
        const routes: Route[] = [];
        if (!Array.isArray(stored)) return routes;
        for (const r of stored) {
            if (!isObj(r)) continue;
            const product = toInt(r.productGUID);
            if (product === undefined || typeof r.from !== "string" || typeof r.to !== "string") continue;
            routes.push({ product, from: r.from, to: r.to, amount: toNum(r.userSetAmount) ?? 0, isDefault: toFlag(r.isDefaultSupplier) === true });
        }
        return routes;
    }

    // ---- entry point ----

    build(): ExchangeDocument {
        const names = this.prepare();
        this.readDocumentExt();
        const routes = this.readRoutes();
        const defaultTargets = new Set<string>(routes.filter((r) => r.isDefault).map((r) => `${r.product}|${r.to}`));
        const receivedTargets = new Set<string>(routes.map((r) => `${r.product}|${r.to}`));

        const built: BuiltIsland[] = [];
        for (const name of names) {
            const store = readJson(name);
            if (!isObj(store)) continue;
            built.push(this.exportIsland(name, store, defaultTargets, receivedTargets));
        }

        const doc: ExchangeDocument = {
            format: FORMAT,
            formatVersion: FORMAT_VERSION,
            generator: { name: "anno117-calculator", version: versionCalculator },
            source: { kind: "tool" },
            islands: built.map((b) => b.out),
        };
        // Orphans return as islands[] records with their original session and data (KTD5).
        for (const o of this.documentExt.orphans) if (isObj(o.island)) doc.islands.push(clone(o.island));

        this.exportedIds = new Set(doc.islands.map((i) => i.id));

        const root = doc as Json;
        this.documentScope(doc, built, routes);

        for (const c of this.documentExt.captured) {
            if (c.pointer === "/history" || c.pointer === "/live") continue;
            this.restore(root, c.pointer, clone(c.value));
        }
        this.restoreHistoryAndLive(doc);
        if (isObj(this.documentExt.account)) doc.account = clone(this.documentExt.account) as NonNullable<ExchangeDocument["account"]>;
        if (Array.isArray(this.documentExt.unlocatedItems)) doc.unlocatedItems = clone(this.documentExt.unlocatedItems) as NonNullable<ExchangeDocument["unlocatedItems"]>;

        this.calculatorBlock(doc, routes);

        const compute = window.exchange?.computeSummary;
        if (typeof compute === "function") doc.computed = compute();
        return doc;
    }

    exportResult(): ExportResult {
        const document = this.build();
        return { document, report: this.report };
    }

    // ---- island scope ----

    private exportIsland(name: string, store: Json, defaultTargets: Set<string>, receivedTargets: Set<string>): BuiltIsland {
        const ext = this.readIslandExt(store["exchange.ext"]);
        const id = String(store["exchange.islandId"]);
        const out: ExchangeIsland = { id, name };
        const handled = new Set<string>(["exchange.islandId", "exchange.ext"]);

        const session = toInt(store["session"]);
        if (session !== undefined) {
            out.session = session;
            handled.add("session");
        }
        const islandId = toInt(store[keys.gameConnectorIslandId]);
        const areaIndex = toInt(store[keys.gameConnectorAreaIndex]);
        if (islandId !== undefined && areaIndex !== undefined) {
            const sessionGuid = session ?? this.defaultSession;
            if (sessionGuid !== undefined) {
                out.gameIsland = { sessionGuid, islandId, areaIndex };
                handled.add(keys.gameConnectorIslandId);
                handled.add(keys.gameConnectorAreaIndex);
            }
        }

        const buildings: Record<string, BuildingEntry> = {};
        const disabledNeeds: Record<string, Guid[]> = {};
        const needNotes: Record<string, Record<string, string>> = {};
        const fertilities: Record<string, boolean> = {};
        const factories: Record<string, FactoryEntry> = {};
        const effects: Record<string, number> = {};
        const notes: Record<string, string> = {};
        const products: Record<string, { producer?: Guid | "none"; notes?: string }> = {};
        const defaults = new Map<number, { type?: string; id?: string }>();
        const factory = (g: number): FactoryEntry => (factories[String(g)] ??= {});

        for (const key of Object.keys(store)) {
            const v = store[key];
            let m: RegExpExecArray | null;
            if ((m = RE_BUILDING.exec(key))) {
                const entry = (buildings[m[1]] ??= {});
                if (m[2] === "fullyUtilizeConstructed") {
                    const f = toFlag(v);
                    if (f !== undefined) {
                        entry.fullyUtilize = f;
                        handled.add(key);
                    }
                } else {
                    const n = toInt(v);
                    if (n !== undefined && n >= 0) {
                        if (m[2] === "constructed") entry.built = n;
                        else entry.planned = n;
                        handled.add(key);
                    }
                }
            } else if ((m = RE_NEED_CHECKED.exec(key))) {
                const f = toFlag(v);
                if (f !== undefined) {
                    handled.add(key);
                    if (!f) (disabledNeeds[m[1]] ??= []).push(parseInt(m[2], 10));
                }
            } else if ((m = RE_NEED_NOTES.exec(key))) {
                if (typeof v === "string") {
                    handled.add(key);
                    if (v !== "") (needNotes[m[1]] ??= {})[m[2]] = v;
                }
            } else if ((m = RE_SCALING.exec(key))) {
                const target = parseInt(m[1], 10);
                const guid = parseInt(m[2], 10);
                const kind = this.classify(guid);
                const n = toInt(v);
                if (kind === "unknown" || n === undefined) continue;
                handled.add(key);
                if (kind === "item") {
                    if (n >= 1) {
                        const choice: ItemChoice = { item: guid };
                        if (n >= 2) {
                            if (this.boostable.has(guid)) choice.boosted = true;
                            else this.note("item-boost-dropped", `Item ${guid} has no boosted variant; it is exported as equipped.`, id, { factory: target, item: guid });
                        }
                        (factory(target).items ??= []).push(choice);
                    }
                } else if (n >= 1) {
                    (factory(target).effects ??= []).push(guid);
                }
            } else if ((m = RE_AQUEDUCT.exec(key))) {
                const n = toNum(v);
                if (n !== undefined) {
                    factory(parseInt(m[1], 10)).aqueduct = n > 0;
                    handled.add(key);
                }
            } else if ((m = RE_MODULE.exec(key))) {
                const f = toFlag(v);
                if (f !== undefined) {
                    (factory(parseInt(m[1], 10)).modules ??= {})[m[2]] = f;
                    handled.add(key);
                }
            } else if ((m = RE_ISLAND_EFFECT.exec(key))) {
                const n = toNum(v);
                if (n !== undefined && this.effects.has(parseInt(m[1], 10))) {
                    effects[m[1]] = n;
                    handled.add(key);
                }
            } else if ((m = RE_FERTILITY.exec(key))) {
                const f = toFlag(v);
                if (f !== undefined) {
                    fertilities[m[1]] = f;
                    handled.add(key);
                }
            } else if ((m = RE_DEFAULT_SUPPLIER.exec(key))) {
                const g = parseInt(m[1], 10);
                const entry = defaults.get(g) ?? {};
                if (m[2] === "type") entry.type = String(v);
                else entry.id = String(v);
                defaults.set(g, entry);
            } else if ((m = RE_NOTES.exec(key))) {
                const g = parseInt(m[1], 10);
                if (typeof v !== "string") continue;
                if (this.residences.has(g)) {
                    handled.add(key);
                    if (v !== "") notes[m[1]] = v;
                } else if (this.products.has(g)) {
                    handled.add(key);
                    if (v !== "") (products[m[1]] ??= {}).notes = v;
                }
            }
        }

        const patron = toInt(store["selectedPatron"]);
        if (store["selectedPatron"] !== undefined) {
            if (patron !== undefined) out.patron = patron;
            if (patron !== undefined || store["selectedPatron"] === "") handled.add("selectedPatron");
        }
        const devotion = toNum(store["devotion"]);
        if (devotion !== undefined && devotion >= 0) {
            out.devotion = devotion;
            handled.add("devotion");
        }

        // Default suppliers: only a factory or "none" that is the active default has a place in the core format.
        for (const [g, d] of defaults) {
            if (d.type === undefined || d.id === undefined) continue;
            if (defaultTargets.has(`${g}|${name}`)) continue; // a trade route is the effective default (KTD13)
            if (d.type === "factory") {
                const factoryGuid = parseInt(d.id, 10);
                if (Number.isNaN(factoryGuid)) continue;
                (products[String(g)] ??= {}).producer = factoryGuid;
            } else if (d.type === "null" && d.id === "null") {
                (products[String(g)] ??= {}).producer = "none";
            } else {
                continue;
            }
            handled.add(keys.defaultSupplierType(g));
            handled.add(keys.defaultSupplierId(g));
        }

        // R50, KTD13: end factories of construction materials and module buildings state fullyUtilize explicitly.
        for (const g of this.explicitFullyUtilize) {
            const entry = buildings[String(g)];
            if (entry && entry.fullyUtilize === undefined) entry.fullyUtilize = true;
        }

        // R51: the import of a received good fully utilizes a built local producer unless the file says otherwise, so a
        // producer the user left partly utilized states fullyUtilize false; otherwise a round trip would switch it on.
        for (const target of receivedTargets) {
            const cut = target.indexOf("|"); // the product is numeric; the island name may contain a bar
            if (target.slice(cut + 1) !== name) continue;
            const product = target.slice(0, cut);
            for (const f of this.factoriesOf.get(parseInt(product, 10)) ?? []) {
                const entry = buildings[String(f)];
                if (entry && typeof entry.built === "number" && entry.built > 0 && entry.fullyUtilize === undefined) entry.fullyUtilize = false;
            }
        }

        for (const key of Object.keys(buildings)) {
            if (Object.keys(buildings[key]).length === 0) delete buildings[key];
        }
        if (Object.keys(buildings).length) out.buildings = buildings;
        out.disabledNeeds = disabledNeeds;
        if (Object.keys(needNotes).length) out.needNotes = needNotes;
        if (Object.keys(notes).length) out.notes = notes;
        if (Object.keys(fertilities).length) out.fertilities = fertilities;
        for (const key of Object.keys(factories)) {
            if (Object.keys(factories[key]).length === 0) delete factories[key];
        }
        if (Object.keys(factories).length) out.factories = factories;
        if (Object.keys(effects).length) out.effects = effects;
        if (Object.keys(products).length) out.products = products;

        // Everything the core format has no place for goes to ext.calculator.store, key by key.
        const raw: Json = {};
        for (const key of Object.keys(store)) if (!handled.has(key)) raw[key] = store[key];

        this.restoreIslandExt(out, store, ext);

        const calc: Json = {};
        if (Object.keys(raw).length) calc.store = raw;
        if (isObj(ext.calculator)) for (const k of Object.keys(ext.calculator)) if (k !== "store") calc[k] = clone(ext.calculator[k]);
        if (Object.keys(calc).length) {
            const holder = (out.ext ??= {});
            holder[EXTENSION] = calc;
        }
        return { name, id, store, ext, out };
    }

    // The preserved island content returns to its original core locations (R13, R14, R55, R56).
    private restoreIslandExt(out: ExchangeIsland, store: Json, ext: IslandExt): void {
        const root = out as Json;
        // Unknown GUID entries first: their list indexes refer to the file's lists.
        for (const g of ext.guids) this.restore(root, g.pointer, clone(g.value), out.id);
        for (const c of ext.captured) {
            if (c.pointer === "/moduleAttachments") {
                const kept = this.keptAttachments(c.value, store, ext, out.id);
                if (kept.length) this.restore(root, c.pointer, kept, out.id);
            } else {
                this.restore(root, c.pointer, clone(c.value), out.id);
            }
        }
        if (ext.minimumStock !== undefined) this.restore(root, "/minimumStock", clone(ext.minimumStock), out.id);
        if (ext.materials !== undefined) this.restore(root, "/materials", clone(ext.materials), out.id);
        if (out.gameIsland && ext.gameIsland) {
            if (out.gameIsland.areaKey === undefined && ext.gameIsland.areaKey !== undefined) out.gameIsland.areaKey = ext.gameIsland.areaKey;
            if (out.gameIsland.name === undefined && ext.gameIsland.name !== undefined) out.gameIsland.name = ext.gameIsland.name;
        }
    }

    // KTD14: the attachments of a factory type return only while that type's module state is what the import wrote.
    private keptAttachments(value: unknown, store: Json, ext: IslandExt, island: string): unknown[] {
        const list = Array.isArray(value) ? value : [];
        const droppedFactories = new Set<number>();
        const kept = list.filter((a) => {
            if (!isObj(a)) return true;
            const f = toInt(a.building);
            const m = toInt(a.module);
            if (f === undefined || m === undefined) return true;
            const key = keys.moduleChecked(f, m);
            const written = ext.moduleWritten[key];
            const current = store[key];
            const same = (current === undefined ? undefined : toFlag(current)) === (written === undefined ? undefined : toFlag(written));
            if (!same) droppedFactories.add(f);
            return same;
        });
        const dropped = list.length - kept.length;
        if (dropped > 0) {
            this.note(
                "module-attachments-dropped",
                `${dropped} module attachments are not exported: the module state of factory ${[...droppedFactories].join(", ")} changed since the import.`,
                island,
                { count: dropped, factories: [...droppedFactories] },
            );
        }
        return clone(kept);
    }

    // ---- document scope ----

    private isGone(id: string): boolean {
        if (this.exportedIds.has(id)) return false;
        const known = this.documentExt.fileIslandIds;
        return known === undefined ? true : known.includes(id);
    }

    private documentScope(doc: ExchangeDocument, built: BuiltIsland[], routes: Route[]): void {
        this.settingsAndEffects(doc);
        this.tradeBlock(doc, built, routes);
    }

    private settingsAndEffects(doc: ExchangeDocument): void {
        const globalStore = readJson("globalEffects");
        const sessionStore = readJson("sessionSettings");
        const calcSettings = readJson("calculatorSettings");

        const global = new Map<number, number>();
        const globalOut: Record<string, number> = {};
        const areaBuffs: Record<string, number> = {};
        if (isObj(globalStore)) {
            for (const key of Object.keys(globalStore)) {
                const m = RE_GLOBAL_EFFECT.exec(key);
                const v = toNum(globalStore[key]);
                if (!m || v === undefined) continue;
                const guid = parseInt(m[1], 10);
                if (this.areaBuffs.has(guid)) areaBuffs[m[1]] = v;
                else {
                    global.set(guid, v);
                    globalOut[m[1]] = v;
                }
            }
        }
        const bySession: Record<string, Record<string, number>> = {};
        const sessionValues = new Map<string, number>(); // "<session>|<effect>"
        if (isObj(sessionStore)) {
            for (const key of Object.keys(sessionStore)) {
                const m = RE_SESSION_EFFECT.exec(key);
                const v = toNum(sessionStore[key]);
                if (!m || v === undefined) continue;
                (bySession[m[1]] ??= {})[m[2]] = v;
                sessionValues.set(`${m[1]}|${m[2]}`, v);
            }
        }
        // Effect entries the calculator could not write at import return unless the calculator holds its own value.
        const fx = this.documentExt.effects;
        if (fx?.global) for (const k of Object.keys(fx.global)) if (globalOut[k] === undefined) globalOut[k] = fx.global[k];
        if (fx?.bySession) {
            for (const s of Object.keys(fx.bySession)) {
                for (const k of Object.keys(fx.bySession[s])) {
                    const bucket = (bySession[s] ??= {});
                    if (bucket[k] === undefined) bucket[k] = fx.bySession[s][k];
                }
            }
        }
        const effects: Json = {};
        if (Object.keys(globalOut).length) effects.global = globalOut;
        if (Object.keys(bySession).length) effects.bySession = bySession;
        if (Object.keys(effects).length) doc.effects = effects;
        this.areaBuffValues = areaBuffs;

        // research (CD6: basis "applied"): a discovery is researched when all its effects are on
        const research: Json = { basis: "applied" };
        const researched: number[] = [];
        const counts: Record<string, number> = {};
        for (const d of buildDiscoveries(this.params.techs)) {
            if (d.effects.length === 0) continue;
            const values = d.effects.map((e) => global.get(e));
            if (values.some((v) => v === undefined || v <= 0)) continue;
            researched.push(d.tech);
            if (d.repeatable) counts[String(d.tech)] = Math.max(...(values as number[]));
        }
        const rx = this.documentExt.research;
        if (rx?.unmatched) for (const g of rx.unmatched) if (!researched.includes(g)) researched.push(g);
        if (rx?.unmatchedCounts) for (const k of Object.keys(rx.unmatchedCounts)) if (counts[k] === undefined) counts[k] = rx.unmatchedCounts[k];
        research.researched = researched;
        if (Object.keys(counts).length) research.counts = counts;
        if (rx?.queue) research.queue = clone(rx.queue);
        if (rx?.knowledgePerMinute !== undefined) research.knowledgePerMinute = rx.knowledgePerMinute;
        doc.research = research;

        // settings
        const settings: Json = {};
        const stored = isObj(calcSettings) ? calcSettings : {};
        const dlcNumbers: number[] = [];
        let dlcStored = false;
        const dlcIds = new Set<string>();
        for (const dlc of this.params.dlcs) {
            dlcIds.add(dlc.id);
            const flag = stored[dlc.id] === undefined ? undefined : toFlag(stored[dlc.id]);
            if (flag === undefined) continue;
            dlcStored = true;
            const m = /^DLC0*(\d+)_/.exec(dlc.id);
            if (flag && m) dlcNumbers.push(parseInt(m[1], 10));
        }
        const sx = this.documentExt.settings;
        for (const n of sx?.dlcsUnknown ?? []) if (!dlcNumbers.includes(n)) dlcNumbers.push(n);
        if (dlcStored || (sx?.dlcsUnknown ?? []).length) settings.dlcs = dlcNumbers.sort((a, b) => a - b);

        const difficulty: Json = isObj(sx?.difficulty) ? clone(sx?.difficulty as Json) : {};
        const consumption = stored[NEED_CONSUMPTION_KEY];
        if (typeof consumption === "string" && consumption !== "") difficulty.needConsumption = consumption;
        if (Object.keys(difficulty).length) settings.difficulty = difficulty;

        const volcano = this.volcanoSetting(sessionValues, sx?.volcano);
        if (volcano) settings.volcano = volcano;
        const seasons = this.seasonsSetting(sessionValues, sx?.seasons);
        if (seasons) settings.seasons = seasons;
        if (Object.keys(settings).length) doc.settings = settings;

        // calculator settings that are not DLC, difficulty or device preferences go to ext.calculator
        const rest: Json = {};
        for (const key of Object.keys(stored)) {
            if (dlcIds.has(key) || key === NEED_CONSUMPTION_KEY || DEVICE_SETTINGS.has(key)) continue;
            rest[key] = stored[key];
        }
        this.calculatorSettingsRest = rest;
    }

    private areaBuffValues: Record<string, number> = {};
    private calculatorSettingsRest: Json = {};

    // CD7: the calculator applies the volcano effects and the planner its setting; neither overwrites the other's
    // block. A preserved setting the import could not apply (no level or no effect list, or switched off) stays as it
    // is. A complete one is updated only when the stored effects no longer say what it says (the user edited them).
    // Without a preserved setting the level and the unlocked effects are derived from the stored effects.
    private volcanoSetting(values: Map<string, number>, preserved: Json | undefined): Json | undefined {
        const hasPreserved = isObj(preserved);
        const base: Json = hasPreserved ? clone(preserved) : {};
        const complete = typeof base.level === "number" && Array.isArray(base.effects) && base.enabled !== false;
        if (hasPreserved && !complete) return base;
        for (const session of VOLCANO_SESSIONS) {
            const levels = VOLCANO_EFFECTS.map((e) => values.get(`${session}|${e}`));
            if (!levels.some((v) => v !== undefined)) continue;
            const unlocked = VOLCANO_EFFECTS.filter((_e, i) => (levels[i] ?? 0) > 0);
            const level = Math.max(0, ...levels.map((v) => v ?? 0));
            const before = Array.isArray(base.effects) ? (base.effects as number[]) : undefined;
            const sameSet = before !== undefined && before.length === unlocked.length && unlocked.every((e) => before.includes(e));
            if (complete && base.level === level && sameSet) return base;
            if (!hasPreserved && unlocked.length === 0) return undefined;
            base.level = level;
            base.effects = sameSet ? before : unlocked;
            return base;
        }
        return hasPreserved ? base : undefined;
    }

    // Seasons in average mode are the Nile flood effect; a preserved phase mode stays as it is.
    private seasonsSetting(values: Map<string, number>, preserved: Json | undefined): Json | undefined {
        const hasPreserved = isObj(preserved);
        const base: Json = hasPreserved ? clone(preserved) : {};
        const v = values.get(`${NILE_FLOOD_SESSION}|${NILE_FLOOD_EFFECT}`);
        if (v === undefined) return hasPreserved ? base : undefined;
        const enabled = v > 0;
        if (!hasPreserved) return enabled ? { enabled: true, mode: "average" } : { enabled: false };
        if (base.enabled !== enabled) base.enabled = enabled;
        if (enabled && base.mode !== undefined && base.mode !== "average") base.mode = "average";
        return base;
    }

    // ---- trade ----

    private tradeBlock(doc: ExchangeDocument, built: BuiltIsland[], routes: Route[]): void {
        const nameToId = new Map<string, string>(built.map((b) => [b.name, b.id]));
        const names = new Set(nameToId.keys());

        // every route of a receiving island and product is a supplier (R54, KTD9)
        interface Group {
            island: string;
            name: string;
            product: number;
            suppliers: Supplier[];
            entered: boolean;
        }
        const groups = new Map<string, Group>();
        for (const r of routes) {
            const to = nameToId.get(r.to);
            const from = nameToId.get(r.from);
            if (to === undefined || from === undefined) continue;
            const key = `${r.to}|${r.product}`;
            const g = groups.get(key) ?? { island: to, name: r.to, product: r.product, suppliers: [], entered: false };
            const s: Supplier = { island: from };
            if (r.isDefault) s.default = true;
            if (r.amount > 0) {
                s.amount = r.amount;
                g.entered = true;
            }
            g.suppliers.push(s);
            groups.set(key, g);
        }

        // preserved import entries (governor and non-player suppliers, cycles, ambiguous defaults, R52, CD10)
        const heldByPair = new Map<string, TradeImport>();
        const heldOrder: string[] = [];
        for (const b of built) {
            const list = Array.isArray(b.ext.preservedImports) ? b.ext.preservedImports : [];
            for (const kept of list) {
                const pair = `${b.name}|${kept.restore.product}`;
                if (heldByPair.has(pair)) continue;
                if (this.holds(kept, b.name, b.store, routes, names)) {
                    const entry = this.pruneEntry(kept.entry);
                    if (entry) {
                        heldByPair.set(pair, entry);
                        heldOrder.push(pair);
                    }
                } else {
                    this.note(
                        "import-entry-dropped",
                        `The preserved supplier data of product ${kept.restore.product} on ${b.name} is not exported: the routes or the default supplier changed since the import.`,
                        b.id,
                        { product: kept.restore.product, reasons: kept.reasons },
                    );
                }
            }
        }

        const entries: TradeImport[] = [];
        const placed = new Set<string>();
        for (const [key, g] of groups) {
            const held = heldByPair.get(key);
            if (held) {
                entries.push(held);
                placed.add(key);
                continue;
            }
            const entry: TradeImport = { island: g.island, product: g.product, suppliers: g.suppliers };
            if (g.entered) entry.basis = "entered";
            entries.push(entry);
        }
        for (const pair of heldOrder) if (!placed.has(pair)) entries.push(heldByPair.get(pair) as TradeImport);
        for (const kept of this.documentExt.preservedImports) {
            const entry = this.pruneEntry(kept.entry);
            if (entry) entries.push(entry);
        }

        const trade: Json = {};
        if (entries.length) trade.imports = entries;
        const t = this.documentExt.trade;
        if (t?.routes !== undefined) trade.routes = this.pruneRoutes(clone(t.routes));
        if (t?.visits !== undefined) trade.visits = this.pruneByIsland(clone(t.visits), "visits");
        if (t?.governorHarbours !== undefined) trade.governorHarbours = this.pruneByIsland(clone(t.governorHarbours), "governorHarbours");
        if (Object.keys(trade).length) doc.trade = trade;
    }

    // CD10: a preserved entry returns only while the routes, the default supplier and the shared passive amount are
    // what the import wrote.
    private holds(kept: PreservedImport, receiver: string, store: Json, routes: Route[], names: Set<string>): boolean {
        const product = kept.restore.product;
        const current = routes.filter((r) => r.to === receiver && r.product === product && names.has(r.from));
        const expected = kept.restore.routes;
        if (current.length !== expected.length) return false;
        const used = new Set<number>();
        for (const e of expected) {
            const i = current.findIndex((c, idx) => !used.has(idx) && sameRoute(e, c, names));
            if (i < 0) return false;
            used.add(i);
        }
        const type = store[keys.defaultSupplierType(product)];
        const id = store[keys.defaultSupplierId(product)];
        const now = type !== undefined && id !== undefined ? { type: String(type), id: String(id) } : null;
        const was = kept.restore.defaultSupplier;
        if ((now === null) !== (was === null)) return false;
        if (now && was && (now.type !== was.type || now.id !== was.id)) return false;
        return (toNum(store["passiveTrade.userSetAmount"]) ?? 0) === kept.restore.passiveUserSetAmount;
    }

    // KTD15: references to islands of the file that are gone are removed from a preserved entry.
    private pruneEntry(entry: TradeImport): TradeImport | undefined {
        const copy = clone(entry);
        if (this.isGone(copy.island)) {
            this.note("entry-pruned", `An import entry of product ${copy.product} names a deleted island and is not exported.`, undefined, { place: "trade.imports", product: copy.product });
            return undefined;
        }
        if (Array.isArray(copy.suppliers)) {
            const before = copy.suppliers.length;
            copy.suppliers = copy.suppliers.filter((s) => !(typeof s.island === "string" && this.isGone(s.island)));
            const removed = before - copy.suppliers.length;
            if (removed > 0) {
                this.note("entry-pruned", `${removed} supplier references to deleted islands are not exported.`, undefined, { place: "trade.imports.suppliers", product: copy.product, count: removed });
                if (copy.suppliers.length === 0) return undefined;
            }
        }
        return copy;
    }

    private pruneRoutes(routes: unknown): unknown {
        if (!Array.isArray(routes)) return routes;
        let removed = 0;
        for (const r of routes) {
            if (!isObj(r) || !Array.isArray(r.stations)) continue;
            const before = (r.stations as unknown[]).length;
            r.stations = (r.stations as unknown[]).filter((s: unknown) => !(isObj(s) && typeof s.island === "string" && this.isGone(s.island)));
            removed += before - (r.stations as unknown[]).length;
        }
        if (removed > 0) this.note("entry-pruned", `${removed} route stations of deleted islands are not exported.`, undefined, { place: "trade.routes.stations", count: removed });
        return routes;
    }

    private pruneByIsland(list: unknown, place: string): unknown {
        if (!Array.isArray(list)) return list;
        const kept = list.filter((e: unknown) => !(isObj(e) && typeof e.island === "string" && this.isGone(e.island)));
        if (kept.length !== list.length) {
            this.note("entry-pruned", `${list.length - kept.length} entries of trade.${place} name deleted islands and are not exported.`, undefined, { place: `trade.${place}`, count: list.length - kept.length });
        }
        return kept;
    }

    private restoreHistoryAndLive(doc: ExchangeDocument): void {
        for (const c of this.documentExt.captured) {
            if (c.pointer === "/history" && Array.isArray(c.value)) {
                const list = clone(c.value);
                const kept = list.filter((h: unknown) => !(isObj(h) && typeof h.island === "string" && this.isGone(h.island)));
                if (kept.length !== list.length) {
                    this.note("entry-pruned", `${list.length - kept.length} history series of deleted islands are not exported.`, undefined, { place: "history", count: list.length - kept.length });
                }
                if (kept.length) doc.history = kept as NonNullable<ExchangeDocument["history"]>;
            } else if (c.pointer === "/live" && isObj(c.value)) {
                const live = clone(c.value);
                if (isObj(live.islands)) {
                    let removed = 0;
                    for (const id of Object.keys(live.islands)) {
                        if (this.isGone(id)) {
                            delete live.islands[id];
                            removed++;
                        }
                    }
                    if (removed > 0) this.note("entry-pruned", `${removed} live entries of deleted islands are not exported.`, undefined, { place: "live.islands", count: removed });
                }
                doc.live = live;
            }
        }
    }

    // ---- ext.calculator ----

    private calculatorBlock(doc: ExchangeDocument, routes: Route[]): void {
        const calc: Json = {};
        const collapsible = readJson("collapsibleStates");
        if (isObj(collapsible)) calc.collapsibleStates = collapsible;
        const dark = localStorage.getItem("darkMode.checked");
        if (dark !== null) {
            const f = toFlag(dark);
            if (f !== undefined) calc.darkMode = f;
        }
        const statistics = readJson("statisticsCollections");
        if (isObj(statistics)) calc.statisticsCollections = statistics;
        const all = readJson(ALL_ISLANDS);
        if (isObj(all) && Object.keys(all).length) calc.allIslands = all;

        // routes naming the aggregate cannot be file suppliers
        const aggregate = routes.filter((r) => r.from === ALL_ISLANDS || r.to === ALL_ISLANDS);
        if (aggregate.length) {
            const stored = readJson("tradeRoutes");
            const originals = Array.isArray(stored) ? stored : [];
            calc.routes = originals.filter((r) => isObj(r) && (r.from === ALL_ISLANDS || r.to === ALL_ISLANDS));
        }
        if (Object.keys(this.calculatorSettingsRest).length) calc.settings = this.calculatorSettingsRest;
        if (Object.keys(this.areaBuffValues).length) calc.areaBuffs = this.areaBuffValues;
        if (isObj(this.documentExt.calculator)) {
            for (const k of Object.keys(this.documentExt.calculator)) if (calc[k] === undefined) calc[k] = clone(this.documentExt.calculator[k]);
        }
        if (Object.keys(calc).length) {
            const holder = (doc.ext ??= {});
            holder[EXTENSION] = calc;
        }
    }
}

export function exportDocument(): ExportResult {
    return new Exporter().exportResult();
}

export function buildDocument(): ExchangeDocument {
    return exportDocument().document;
}
