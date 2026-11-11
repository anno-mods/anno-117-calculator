// Import plan for discoveries, effects, settings and construction materials (U7, R39, R44, R50, KTD10, CD7).
// Pure: no storage, no DOM. Produces the content of the three SubStorage keys `globalEffects`, `sessionSettings`
// and `calculatorSettings`, additions to the island stores, the document-level parts kept in the top-level
// `exchange.ext`, and report lines. Values follow the loaders: effect scalings are numbers (main.ts:474,
// world.ts:254), DLC flags and the need consumption id are strings (main.ts:394, :431).

import * as keys from "./keys";
import {
    AREA_BUFF_GUIDS,
    NILE_FLOOD_EFFECT,
    NILE_FLOOD_SESSION,
    VOLCANO_EFFECTS,
    VOLCANO_SESSIONS,
    buildDiscoveries,
} from "./discoveries";
import { buildMaterials } from "./materials";
import {
    EffectsExt,
    EffectsPlan,
    ExchangeIsland,
    GuidKey,
    ImportContext,
    IslandsPlan,
    ReadOk,
    ReportEntry,
    ReportKind,
    ResearchExt,
    SettingsExt,
} from "./types";

type Scales = Record<GuidKey, number>;

const DEFAULT_RESEARCH_BASIS = "researched";
const NEED_CONSUMPTION_KEY = "settings.needConsumption";

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNumber(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}

type EffectClass = "ok" | "area-buff" | "unknown" | "wrong-scope";

class EffectsPlanner {
    private readonly result: EffectsPlan = {
        globalEffects: {},
        sessionSettings: {},
        calculatorSettings: {},
        islands: {},
        ext: {},
        basis: DEFAULT_RESEARCH_BASIS,
        report: [],
    };
    private readonly effectInfo = new Map<number, { scope: string; dlcUnlocks: number[] }>();
    private readonly sessionGuids = new Set<number>();
    private readonly sessionRegion = new Map<number, string>(); // session guid -> region id
    private readonly dlcIdByGuid = new Map<number, string>();
    private readonly areaBuffs = new Set<number>(AREA_BUFF_GUIDS);
    // Keys of `sessionSettings` the file states as specific effects (they win over `settings.volcano` and `settings.seasons`).
    private readonly specificSession = new Set<string>();
    // DLC id -> effect GUIDs that switch it on at load (DLC.used, util.ts:424)
    private readonly dlcUse = new Map<string, number[]>();
    private readonly research: ResearchExt = {};
    private readonly effectsExt: EffectsExt = {};
    private readonly settingsExt: SettingsExt = {};

    constructor(
        private readonly islands: IslandsPlan,
        private readonly read: ReadOk,
        private readonly ctx: ImportContext,
    ) {
        const p = ctx.params;
        for (const e of p.effects) this.effectInfo.set(e.guid, { scope: e.effectScope, dlcUnlocks: e.dlcUnlocks ?? [] });
        const regionIds = new Map<number, string>(p.regions.map((r) => [r.guid, r.id]));
        for (const s of p.sessions) {
            this.sessionGuids.add(s.guid);
            const region = regionIds.get(s.region);
            if (region !== undefined) this.sessionRegion.set(s.guid, region);
        }
        for (const d of p.dlcs) this.dlcIdByGuid.set(d.guid as number, d.id);
    }

    private add(kind: ReportKind, code: string, message: string, detail?: Record<string, unknown>, island?: string): void {
        const e: ReportEntry = { kind, code, message };
        if (island !== undefined) e.island = island;
        if (detail) e.detail = detail;
        this.result.report.push(e);
    }

    run(): EffectsPlan {
        this.researchEffects();
        this.specificGlobal();
        this.specificBySession();
        this.volcano();
        this.seasons();
        this.dlcs();
        this.difficulty();
        this.materials();
        this.finish();
        return this.result;
    }

    // ---- effect GUID checks ----

    private classify(guid: number, scope: "global" | "session"): EffectClass {
        if (this.areaBuffs.has(guid)) return "area-buff";
        const info = this.effectInfo.get(guid);
        if (!info) return "unknown";
        // main.ts:441 keeps Meta and ModuleOwner effects in globalEffects; world.ts:245 keeps Session effects per session.
        const ok = scope === "global" ? info.scope.endsWith("Meta") || info.scope === "ModuleOwner" : info.scope.endsWith("Session");
        return ok ? "ok" : "wrong-scope";
    }

    private noteDlc(effect: number, value: number): void {
        if (value <= 0) return;
        const info = this.effectInfo.get(effect);
        for (const dlc of info?.dlcUnlocks ?? []) {
            const id = this.dlcIdByGuid.get(dlc);
            if (id === undefined) continue;
            const list = this.dlcUse.get(id) ?? [];
            if (!list.includes(effect)) list.push(effect);
            this.dlcUse.set(id, list);
        }
    }

    // ---- research (R39, R44) ----

    private researchEffects(): void {
        const r = this.read.doc.research;
        if (!r) return;
        const basis = typeof r.basis === "string" ? r.basis : DEFAULT_RESEARCH_BASIS;
        this.result.basis = basis;
        if (r.basis !== undefined) this.research.basis = r.basis;
        const table = buildDiscoveries(this.ctx.params.techs);
        const known = new Map(table.map((d) => [d.tech, d]));
        const researched = new Set<number>(Array.isArray(r.researched) ? r.researched : []);
        const counts: Scales = isPlainObject(r.counts) ? (r.counts as Scales) : {};

        for (const d of table) {
            let scale = 0;
            const counted = counts[String(d.tech)];
            if (d.repeatable && isNumber(counted)) scale = counted;
            else if (researched.has(d.tech)) scale = 1;
            if (scale <= 0) continue;
            for (const effect of d.effects) {
                this.result.globalEffects[keys.globalEffectStoredKey(effect)] = scale;
                this.noteDlc(effect, scale);
            }
        }

        const unmatched = [...researched].filter((g) => !known.has(g));
        const unmatchedCounts: Scales = {};
        for (const key of Object.keys(counts)) {
            const d = known.get(parseInt(key, 10));
            if (!d || !d.repeatable) unmatchedCounts[key] = counts[key];
        }
        if (unmatched.length) this.research.unmatched = unmatched;
        if (Object.keys(unmatchedCounts).length) this.research.unmatchedCounts = unmatchedCounts;
        if (Array.isArray(r.queue) && r.queue.length) this.research.queue = r.queue;
        if (isNumber(r.knowledgePerMinute)) this.research.knowledgePerMinute = r.knowledgePerMinute;
        if (unmatched.length || Object.keys(unmatchedCounts).length || this.research.queue || this.research.knowledgePerMinute !== undefined) {
            this.add(
                "not-mapped",
                "research-not-mapped",
                `${unmatched.length} researched discoveries have no counterpart in the calculator; they and the research queue are kept and written back on export.`,
                { unmatched, queue: this.research.queue?.length ?? 0 },
            );
        }
        if (basis === "applied") {
            this.add(
                "approximated",
                "research-basis-applied",
                "The research lists describe what the exporting tool applies, not what the player researched; their effect scales are applied as settings (R44).",
            );
        }
    }

    // ---- specific effects (R39): they win over research and over the volcano and seasons settings ----

    private specificGlobal(): void {
        const given = this.read.doc.effects?.global;
        if (!given) return;
        for (const key of Object.keys(given)) {
            const guid = parseInt(key, 10);
            const value = given[key];
            const cls = this.classify(guid, "global");
            if (cls === "ok") {
                this.result.globalEffects[keys.globalEffectStoredKey(guid)] = value;
                this.noteDlc(guid, value);
            } else {
                this.keepEffect(cls, guid, value, "global");
            }
        }
    }

    private specificBySession(): void {
        const given = this.read.doc.effects?.bySession;
        if (!given) return;
        for (const sessionKey of Object.keys(given)) {
            const session = parseInt(sessionKey, 10);
            const effects = given[sessionKey];
            if (!this.sessionGuids.has(session)) {
                const bucket = this.sessionBucket(sessionKey);
                Object.assign(bucket, effects);
                this.add("carried-through", "unknown-guid", `Session ${session} is not in the calculator's data; its effects are kept and written back on export.`, {
                    pointer: `/effects/bySession/${sessionKey}`,
                    guid: session,
                });
                continue;
            }
            for (const key of Object.keys(effects)) {
                const guid = parseInt(key, 10);
                const cls = this.classify(guid, "session");
                if (cls === "ok") {
                    const storageKey = keys.sessionEffectScaling(session, guid);
                    this.result.sessionSettings[storageKey] = effects[key];
                    this.specificSession.add(storageKey);
                    this.noteDlc(guid, effects[key]);
                } else {
                    this.keepEffect(cls, guid, effects[key], "session", sessionKey);
                }
            }
        }
    }

    private sessionBucket(sessionKey: string): Scales {
        const by = (this.effectsExt.bySession ??= {});
        return (by[sessionKey] ??= {});
    }

    // An effect entry the calculator cannot write: kept with its value, reported.
    private keepEffect(cls: Exclude<EffectClass, "ok">, guid: number, value: number, scope: "global" | "session", sessionKey?: string): void {
        if (scope === "global") (this.effectsExt.global ??= {})[String(guid)] = value;
        else if (sessionKey !== undefined) this.sessionBucket(sessionKey)[String(guid)] = value;
        const pointer = scope === "global" ? `/effects/global/${guid}` : `/effects/bySession/${sessionKey}/${guid}`;
        if (cls === "area-buff") {
            this.add("not-mapped", "area-buff-ignored", `Effect ${guid} is a dormant area buff of a discovery; it is never written and is kept in the file's ext.`, { pointer, guid });
        } else if (cls === "unknown") {
            this.add("carried-through", "unknown-guid", `Effect ${guid} is not in the calculator's data; kept and written back on export.`, { pointer, guid });
        } else {
            this.add("not-mapped", "effect-scope-mismatch", `Effect ${guid} has another scope in the calculator than the ${scope} entry it sits in; kept, not applied.`, { pointer, guid });
        }
    }

    // ---- volcano (CD7, conversion rules) ----

    private volcano(): void {
        const v = this.read.doc.settings?.volcano;
        if (!v) return;
        this.settingsExt.volcano = v;
        if (v.enabled === false) return;
        const level = v.level;
        const unlocked = v.effects;
        if (!isNumber(level) || !Array.isArray(unlocked)) {
            this.add("not-provided", "volcano-incomplete", "settings.volcano has no level or no list of unlocked effects; no volcano effect is derived from it.");
            return;
        }
        const disagree: { session: number; effect: number; setting: number; effectValue: number }[] = [];
        for (const session of VOLCANO_SESSIONS) {
            if (!this.sessionGuids.has(session)) continue;
            for (const effect of VOLCANO_EFFECTS) {
                const value = unlocked.includes(effect) ? level : 0;
                const storageKey = keys.sessionEffectScaling(session, effect);
                if (this.specificSession.has(storageKey)) {
                    const stated = this.result.sessionSettings[storageKey];
                    if (stated !== value) disagree.push({ session, effect, setting: value, effectValue: stated });
                } else {
                    this.result.sessionSettings[storageKey] = value;
                    this.noteDlc(effect, value);
                }
            }
        }
        if (disagree.length) {
            this.add(
                "approximated",
                "volcano-effects-disagree",
                "settings.volcano and the volcano effects of effects.bySession differ; the calculator applies the effects and keeps the setting (CD7).",
                { differences: disagree },
            );
        }
    }

    // ---- seasons (CD7, conversion rules) ----

    private seasons(): void {
        const s = this.read.doc.settings?.seasons;
        if (!s) return;
        this.settingsExt.seasons = s;
        const average = s.mode === "average" || (s.mode === undefined && (s.phase === undefined || s.phase === null));
        let derived: number | undefined;
        if (s.enabled === true) {
            if (average) {
                derived = 1;
            } else {
                this.add(
                    "not-mapped",
                    "seasons-phase-mode",
                    "The seasons are set to one phase; the calculator only models the average of the seasons, so the Nile flood effect is not written.",
                    { phase: s.phase ?? null, mode: s.mode ?? null },
                );
            }
        } else if (s.enabled === false) {
            derived = 0;
        }
        if (derived === undefined || !this.sessionGuids.has(NILE_FLOOD_SESSION)) return;
        const storageKey = keys.sessionEffectScaling(NILE_FLOOD_SESSION, NILE_FLOOD_EFFECT);
        if (this.specificSession.has(storageKey)) {
            const stated = this.result.sessionSettings[storageKey];
            if ((stated > 0 ? 1 : 0) !== derived) {
                this.add(
                    "approximated",
                    "seasons-effect-disagree",
                    "settings.seasons and the Nile flood effect of effects.bySession differ; the calculator applies the effect and keeps the setting (CD7).",
                    { setting: derived, effectValue: stated },
                );
            }
        } else if (derived > 0) {
            this.result.sessionSettings[storageKey] = derived;
            this.noteDlc(NILE_FLOOD_EFFECT, derived);
        }
    }

    // ---- DLCs and difficulty ----

    private dlcs(): void {
        const listed = this.read.doc.settings?.dlcs;
        if (!listed) {
            this.add("not-provided", "dlcs-not-provided", "The file lists no DLCs; the calculator keeps its own DLC choice.");
            return;
        }
        const numbers = new Set<number>(listed);
        for (const n of [1, 2, 3]) {
            const dlc = this.ctx.params.dlcs.find((d) => d.id.startsWith(`DLC0${n}_`));
            if (dlc) this.result.calculatorSettings[dlc.id] = numbers.has(n) ? "1" : "0";
        }
        const unknown = [...numbers].filter((n) => n < 1 || n > 3);
        if (unknown.length) {
            this.settingsExt.dlcsUnknown = unknown;
            this.add("carried-through", "dlcs-unknown", `DLC numbers ${unknown.join(", ")} are not DLCs of this calculator; kept and written back on export.`, { dlcs: unknown });
        }
    }

    private difficulty(): void {
        const d = this.read.doc.settings?.difficulty;
        if (!d) return;
        const rest: Record<string, unknown> = { ...d };
        const id = d.needConsumption;
        if (typeof id === "string" && this.ctx.params.needConsumptions.some((o) => o.id === id)) {
            this.result.calculatorSettings[NEED_CONSUMPTION_KEY] = id;
            delete rest.needConsumption;
        } else if (id !== undefined) {
            this.add("not-mapped", "need-consumption-unknown", `Need consumption ${JSON.stringify(id)} is not an option of the calculator; kept, not applied.`, { value: id });
        }
        if (Object.keys(rest).length) {
            this.settingsExt.difficulty = rest;
            this.add("carried-through", "planner-settings", "The remaining difficulty settings are kept and written back on export.", { keys: Object.keys(rest) });
        }
    }

    // ---- construction materials (R50) ----

    private materials(): void {
        const table = buildMaterials(this.ctx.params.products, this.ctx.params.factories);
        const defaultSession = this.ctx.params.sessions.length ? this.ctx.params.sessions[0].guid : undefined;
        for (const ip of this.islands.islands) {
            const file: ExchangeIsland = ip.file;
            const materials = file.materials;
            const out: EffectsPlan["islands"][string] = { store: {}, ext: {} };
            this.result.islands[ip.key] = out;
            if (!isPlainObject(materials)) continue;

            const counts = new Map<string, number>();
            const rest: Record<string, unknown> = {};
            let enabled: boolean | undefined;
            for (const k of Object.keys(materials)) {
                const v = materials[k];
                if (k === "enabled" && typeof v === "boolean") enabled = v;
                else if (k === "counts" && isPlainObject(v)) {
                    for (const c of Object.keys(v)) {
                        if (/^\d+$/.test(c) && isNumber(v[c])) counts.set(c, v[c] as number);
                        else rest[c] = v[c];
                    }
                } else if (/^\d+$/.test(k) && isNumber(v)) counts.set(k, v);
                else rest[k] = v;
            }

            const region = this.sessionRegion.get(file.session ?? (defaultSession as number));
            const unmapped: Record<string, unknown> = { ...rest };
            for (const [product, count] of counts) {
                const factory = region === undefined ? undefined : table.find((m) => m.product === parseInt(product, 10))?.endFactories[region];
                if (factory === undefined) {
                    unmapped[product] = count;
                    continue;
                }
                const entry = file.buildings?.[String(factory)];
                if (entry?.built === undefined) out.store[keys.buildingsConstructed(factory)] = count;
                else if (entry.built !== count) {
                    this.add(
                        "approximated",
                        "materials-difference",
                        `Material ${product} is ${count} by materials and ${entry.built} by the buildings entry of its end factory ${factory}; the buildings entry is used (R50).`,
                        { product, factory, materials: count, buildings: entry.built },
                        ip.id,
                    );
                }
                if (entry?.fullyUtilize === undefined) out.store[keys.buildingsFullyUtilize(factory)] = enabled === false ? "0" : "1";
            }
            if (Object.keys(unmapped).length) {
                out.ext.materials = unmapped;
                this.add(
                    "carried-through",
                    "materials-not-mapped",
                    "Some entries of materials have no end factory in the island's region; they are kept and written back on export.",
                    { entries: Object.keys(unmapped) },
                    ip.id,
                );
            }
        }
    }

    // ---- result ----

    private finish(): void {
        // The dormant area buffs are never written, whatever produced the key (KTD10).
        for (const g of this.areaBuffs) {
            delete this.result.globalEffects[keys.globalEffectStoredKey(g)];
            for (const s of this.sessionGuids) delete this.result.sessionSettings[keys.sessionEffectScaling(s, g)];
        }
        for (const [dlc, effects] of this.dlcUse) {
            this.add("approximated", "dlc-enabled", `${dlc} is switched on at load because of effect ${effects.join(", ")}.`, { dlc, effects });
        }
        if (Object.keys(this.research).length) this.result.ext.research = this.research;
        if (Object.keys(this.effectsExt).length) this.result.ext.effects = this.effectsExt;
        if (Object.keys(this.settingsExt).length) this.result.ext.settings = this.settingsExt;
    }
}

export function planEffects(islands: IslandsPlan, read: ReadOk, ctx: ImportContext): EffectsPlan {
    return new EffectsPlanner(islands, read, ctx).run();
}
