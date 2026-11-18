// Import plan for island-scope data (U5): file islands -> island store key maps, orphans, report lines and
// the content of each island's `exchange.ext`. Pure: no storage, no DOM, no live Storage objects (KTD1).
// Value types follow the loaders of src/world.ts: counts, devotion, item and aqueduct scalings and effect scalings
// are numbers (persistInt/persistFloat); checked flags are "1"/"0" (persistBool, persistNeedChecked); notes and
// the patron are strings; `gameConnector.*` are real numbers.

import * as keys from "./keys";
import { isVillaItem } from "../residence-items";
import { wantedName } from "./matching";
import { uniqueName } from "./names";
import {
    AbsentGuidEntry,
    BuildingEntry,
    CapturedField,
    ExchangeDocument,
    ExchangeIsland,
    FactoryEntry,
    ImportContext,
    IslandExt,
    IslandPlan,
    IslandsPlan,
    ItemHolder,
    ItemRecord,
    OrphanIsland,
    ReadOk,
    ReportEntry,
    ReportKind,
    ScopeSelection,
    UnknownField,
} from "./types";

type Store = Record<string, unknown>;

const META_REGION = "Meta";

function seg(key: string): string {
    return key.replace(/~/g, "~0").replace(/\//g, "~1");
}

function isUnder(pointer: string, prefix: string): boolean {
    return pointer === prefix || pointer.startsWith(prefix + "/");
}

function guidOf(key: string): number {
    return parseInt(key, 10);
}

function records(list: unknown): ItemRecord[] {
    return Array.isArray(list) ? (list.filter((r) => typeof r === "object" && r !== null && !Array.isArray(r)) as ItemRecord[]) : [];
}

function quantity(list: ItemRecord[]): number {
    return list.reduce((sum, r) => sum + (typeof r.count === "number" && Number.isFinite(r.count) ? r.count : 1), 0);
}

class Lookups {
    sessions = new Map<number, number>(); // session guid -> region guid
    regionIds = new Map<number, string>();
    residenceByLevel = new Map<number, number>();
    residences = new Set<number>();
    // population levels that have a residence building
    residenceLevels = new Set<number>();
    // area effect (source "building" with residence targets) -> population levels of those targets
    areaEffects = new Map<number, Set<number>>();
    // public buildings of params.publicServices
    publicBuildings = new Set<number>();
    buildings = new Set<number>();
    // GUID of a building -> its single DLC (lockDLCIfSet: a count above 0 switches that DLC on at load)
    buildingDlc = new Map<number, number>();
    factories = new Set<number>();
    modules = new Set<number>();
    effects = new Map<number, { source: string; dlcUnlocks: number[] }>();
    mythical = new Set<number>();
    // villa: the item is a residence item (isVillaItem); heroic: GUID of its island-wide effect when that effect exists
    items = new Map<number, { boostable: boolean; dlcUnlocks: number[]; villa: boolean; heroic: number | undefined }>();
    patrons = new Set<number>();
    dlcIds = new Map<number, string>();
    fertilities: { guid: number; regions: string[] }[];
    defaultSession: number | undefined;

    constructor(ctx: ImportContext) {
        const p = ctx.params;
        for (const s of p.sessions) this.sessions.set(s.guid, s.region);
        for (const r of p.regions) this.regionIds.set(r.guid, r.id);
        const levelOfResidence = new Map<number, number>();
        for (const b of p.residenceBuildings) {
            levelOfResidence.set(b.guid, b.populationLevel);
            this.residenceLevels.add(b.populationLevel);
            this.residences.add(b.guid);
            this.buildings.add(b.guid);
            if (!this.residenceByLevel.has(b.populationLevel)) this.residenceByLevel.set(b.populationLevel, b.guid);
        }
        for (const f of p.factories) {
            this.factories.add(f.guid);
            this.buildings.add(f.guid);
            this.noteBuildingDlc(f.guid, f.dlcUnlocks);
        }
        for (const m of p.modules) {
            this.modules.add(m.guid);
            this.buildings.add(m.guid);
            this.noteBuildingDlc(m.guid, m.dlcUnlocks);
        }
        for (const e of p.effects) {
            this.effects.set(e.guid, { source: e.source, dlcUnlocks: e.dlcUnlocks ?? [] });
            if (e.source === "mythical-item") this.mythical.add(e.guid);
            if (e.source === "building") {
                const levels = new Set<number>();
                for (const t of e.targets ?? []) {
                    const level = levelOfResidence.get(t);
                    if (level !== undefined) levels.add(level);
                }
                if (levels.size) this.areaEffects.set(e.guid, levels);
            }
        }
        for (const s of p.publicServices ?? []) this.publicBuildings.add(s.guid);
        for (const i of p.items) {
            this.items.set(i.guid, {
                boostable: (i.boostBuffs ?? []).length > 0,
                dlcUnlocks: i.dlcUnlocks ?? [],
                villa: isVillaItem(i, p),
                heroic: i.heroicEffect && this.effects.has(i.heroicEffect) ? i.heroicEffect : undefined,
            });
        }
        for (const pa of p.patrons) this.patrons.add(pa.guid);
        for (const d of p.dlcs) this.dlcIds.set(d.guid, d.id);
        this.fertilities = p.fertilities.map((f) => ({ guid: f.guid, regions: f.regions }));
        this.defaultSession = p.sessions.length ? p.sessions[0].guid : undefined;
    }

    private noteBuildingDlc(guid: number, dlcUnlocks: number[] | undefined): void {
        // Same rule as UnlockableElement.lockDLCIfSet: only a building tied to exactly one DLC switches it on.
        if (dlcUnlocks && dlcUnlocks.length === 1) this.buildingDlc.set(guid, dlcUnlocks[0]);
    }

    regionIdOfSession(session: number | undefined): string | undefined {
        const sg = session ?? this.defaultSession;
        const region = sg === undefined ? undefined : this.sessions.get(sg);
        return region === undefined ? undefined : this.regionIds.get(region);
    }

    fertilitiesOfRegion(regionId: string | undefined): number[] {
        return this.fertilities
            .filter((f) => regionId === META_REGION || f.regions.length === 0 || (regionId !== undefined && f.regions.includes(regionId)))
            .map((f) => f.guid);
    }
}

class IslandPlanner {
    store: Store = {};
    ext: IslandExt;
    report: ReportEntry[] = [];
    // Pointers of absent GUID entries; captured fields below them are not repeated.
    private absent: string[] = [];
    // Island effects switched on by an equipped item (state Base or Boosted) with a heroicEffect (R4); evaluated in effects()
    private heroicWrites = new Set<number>();
    // Island effects switched on because residenceEffects lists a level above 0 (R15a); the file's own `effects` entry wins
    private areaSwitched = new Set<number>();
    // DLC id -> things that switch it on at load
    private dlcUse = new Map<string, { items: number[]; effects: number[]; buildings: number[] }>();
    settingsKeys: Record<string, string> = {};

    constructor(
        private readonly isl: ExchangeIsland,
        private readonly index: number,
        private readonly read: ReadOk,
        private readonly lk: Lookups,
        originalName: string,
        private readonly scope?: ScopeSelection,
    ) {
        this.ext = { originalName, captured: [], guids: [], moduleWritten: {} };
    }

    private add(kind: ReportKind, code: string, message: string, detail?: Record<string, unknown>): void {
        const e: ReportEntry = { kind, code, island: this.isl.id, message };
        if (detail) e.detail = detail;
        this.report.push(e);
    }

    private absentGuid(pointer: string, value: unknown, guid: number, what: string): void {
        const entry: AbsentGuidEntry = { pointer, value };
        this.ext.guids.push(entry);
        this.absent.push(pointer);
        this.add("carried-through", "unknown-guid", `${what} ${guid} is not in the calculator's data; kept and written back on export.`, { pointer, guid });
    }

    private dlcOf(guids: number[]): string[] {
        return guids.map((g) => this.lk.dlcIds.get(g)).filter((d): d is string => d !== undefined);
    }

    // With a partial selection only the content of ticked scopes counts as DLC use (R13): buildings by their own
    // scope, items and effects by Modifiers.
    private ticked(kind: "items" | "effects" | "buildings", guid: number): boolean {
        const s = this.scope;
        if (!s) return true;
        if (kind === "buildings") return this.lk.residences.has(guid) ? s.residences : s.production;
        return s.modifiers;
    }

    private noteDlc(dlcUnlocks: number[], kind: "items" | "effects" | "buildings", guid: number): void {
        if (!this.ticked(kind, guid)) return;
        for (const id of this.dlcOf(dlcUnlocks)) {
            let u = this.dlcUse.get(id);
            if (!u) this.dlcUse.set(id, (u = { items: [], effects: [], buildings: [] }));
            if (!u[kind].includes(guid)) u[kind].push(guid);
        }
    }

    // A count above 0 for a DLC-tied building switches the DLC on at load (DLC.used, lockDLCIfSet on `constructed`).
    private noteBuildingDlcUse(guid: number, built: number | undefined): void {
        const dlc = this.lk.buildingDlc.get(guid);
        if (dlc !== undefined && built !== undefined && built > 0) this.noteDlc([dlc], "buildings", guid);
    }

    plan(): void {
        this.identity();
        this.buildings();
        this.needs();
        this.fertilities();
        this.patronAndDevotion();
        this.factories();
        this.residenceItems();
        this.villaCoverage();
        this.residenceEffects();
        this.publicCoverages();
        this.effects();
        this.notes();
        this.captured();
        this.items();
        this.finishDlc();
        this.store["exchange.ext"] = this.ext;
    }

    private identity(): void {
        const isl = this.isl;
        if (isl.session !== undefined) this.store["session"] = isl.session;
        else this.add("not-provided", "session-not-provided", "The island has no session; the calculator uses its first session.");
        this.store["exchange.islandId"] = isl.id;
        const g = isl.gameIsland;
        if (g) {
            this.store[keys.gameConnectorIslandId] = g.islandId;
            this.store[keys.gameConnectorAreaIndex] = g.areaIndex;
            const extra: { areaKey?: number; name?: string } = {};
            if (g.areaKey !== undefined) extra.areaKey = g.areaKey;
            if (g.name !== undefined) extra.name = g.name;
            if (Object.keys(extra).length) this.ext.gameIsland = extra;
        }
    }

    private buildings(): void {
        const isl = this.isl;
        const entries: Record<string, BuildingEntry> = isl.buildings ?? {};
        for (const key of Object.keys(entries)) {
            const g = guidOf(key);
            const e = entries[key];
            if (!this.lk.buildings.has(g)) {
                this.absentGuid(`/buildings/${seg(key)}`, e, g, "Building");
                continue;
            }
            if (e.built !== undefined) this.store[keys.buildingsConstructed(g)] = e.built;
            this.noteBuildingDlcUse(g, e.built);
            if (e.planned !== undefined) this.store[keys.buildingsPlanned(g)] = e.planned;
            if (e.fullyUtilize !== undefined) this.store[keys.buildingsFullyUtilize(g)] = e.fullyUtilize ? "1" : "0";
        }
        // R24: a per-building count wins; a level count becomes the count of the level's residence building.
        const levels = isl.residencesByLevel ?? {};
        for (const key of Object.keys(levels)) {
            const level = guidOf(key);
            const building = this.lk.residenceByLevel.get(level);
            if (building === undefined) {
                this.absentGuid(`/residencesByLevel/${seg(key)}`, levels[key], level, "Population level");
                continue;
            }
            const byBuilding = entries[String(building)]?.built;
            const byLevel = levels[key];
            if (byBuilding === undefined) {
                this.store[keys.buildingsConstructed(building)] = byLevel;
                this.noteBuildingDlcUse(building, byLevel);
            } else if (byBuilding !== byLevel) {
                this.add(
                    "approximated",
                    "residence-count-difference",
                    `Level ${level} has ${byLevel} residences by level and ${byBuilding} by building; the per-building count ${byBuilding} is used.`,
                    { level, building, byBuilding, byLevel },
                );
            }
        }
    }

    private needs(): void {
        const isl = this.isl;
        if (isl.disabledNeeds === undefined) {
            this.add("not-provided", "disabled-needs-not-provided", "The island lists no disabledNeeds; every need is on.");
        } else {
            for (const level of Object.keys(isl.disabledNeeds)) {
                for (const need of isl.disabledNeeds[level]) {
                    this.store[keys.needChecked(guidOf(level), need)] = "0";
                }
            }
        }
        const notes = isl.needNotes ?? {};
        for (const level of Object.keys(notes)) {
            for (const need of Object.keys(notes[level])) {
                this.store[keys.needNotes(guidOf(level), guidOf(need))] = notes[level][need];
            }
        }
    }

    private fertilities(): void {
        const isl = this.isl;
        const given = isl.fertilities ?? {};
        for (const key of Object.keys(given)) {
            const g = guidOf(key);
            if (!this.lk.fertilities.some((f) => f.guid === g)) {
                this.absentGuid(`/fertilities/${seg(key)}`, given[key], g, "Fertility");
                continue;
            }
            this.store[keys.islandFertilityChecked(g)] = given[key] ? "1" : "0";
        }
        const relevant = this.lk.fertilitiesOfRegion(this.lk.regionIdOfSession(isl.session));
        const missing = relevant.filter((g) => given[String(g)] === undefined);
        if (isl.fertilitiesComplete === true) {
            for (const g of missing) this.store[keys.islandFertilityChecked(g)] = "0";
        } else if (missing.length) {
            this.add("not-provided", "fertilities-not-provided", `${missing.length} fertilities are not provided; the calculator keeps its defaults.`, { guids: missing });
        }
    }

    private patronAndDevotion(): void {
        const isl = this.isl;
        if (isl.patron !== undefined) {
            if (this.lk.patrons.has(isl.patron)) this.store["selectedPatron"] = String(isl.patron);
            else this.absentGuid("/patron", isl.patron, isl.patron, "Patron");
        }
        if (isl.devotion !== undefined) {
            this.store["devotion"] = isl.devotion;
            if (!Number.isInteger(isl.devotion)) {
                const loaded = parseInt(String(isl.devotion), 10);
                this.add("approximated", "devotion-truncated", `Devotion ${isl.devotion} is loaded as ${loaded} (whole numbers only).`, { value: isl.devotion, loaded });
            }
        }
    }

    private factories(): void {
        const factories = this.isl.factories ?? {};
        for (const key of Object.keys(factories)) {
            const f = guidOf(key);
            const entry: FactoryEntry = factories[key];
            const base = `/factories/${seg(key)}`;
            if (!this.lk.factories.has(f)) {
                this.absentGuid(base, entry, f, "Factory");
                continue;
            }
            (entry.items ?? []).forEach((choice, i) => {
                const item = this.lk.items.get(choice.item);
                if (!item) {
                    this.absentGuid(`${base}/items/${i}`, choice, choice.item, "Item");
                    return;
                }
                let state = 1;
                if (choice.boosted === true) {
                    if (item.boostable) state = 2;
                    else
                        this.add("approximated", "item-boost-approximated", `Item ${choice.item} has no boosted variant; it is written as equipped (1).`, {
                            factory: f,
                            item: choice.item,
                        });
                }
                this.store[keys.factoryItemScaling(f, choice.item)] = state;
                this.noteDlc(item.dlcUnlocks, "items", choice.item);
                if (item.heroic !== undefined) this.heroicWrites.add(item.heroic);
            });
            (entry.effects ?? []).forEach((effect, i) => {
                if (!this.lk.effects.has(effect)) {
                    this.absentGuid(`${base}/effects/${i}`, effect, effect, "Effect");
                    return;
                }
                this.store[keys.factoryEffectScaling(f, effect)] = 1;
            });
            if (entry.aqueduct !== undefined) this.store[keys.aqueductChecked(f)] = entry.aqueduct ? 1 : 0;
            const modules = entry.modules ?? {};
            for (const mk of Object.keys(modules)) {
                const m = guidOf(mk);
                if (!this.lk.modules.has(m)) {
                    this.absentGuid(`${base}/modules/${seg(mk)}`, modules[mk], m, "Module");
                    continue;
                }
                const key = keys.moduleChecked(f, m);
                const value = modules[mk] ? "1" : "0";
                this.store[key] = value;
                this.ext.moduleWritten[key] = value;
            }
            if (entry.manualProductivity !== undefined) {
                this.captureModelled(`${base}/manualProductivity`, entry.manualProductivity);
            }
        }
    }

    private captureModelled(pointer: string, value: unknown, code = "unmodelled-key", message = `${pointer} is kept but not applied by the calculator.`): void {
        this.ext.captured.push({ pointer, kind: "unmodelled", value });
        this.add("not-mapped", code, message, { pointer });
    }

    // Residence items (R1-R5a, R10): villa items store the shared state; an item without calculator data, or that is
    // no villa item, and a repeated item are kept at their pointer and reported. Nothing is shown on screen (KD7).
    private residenceItems(): void {
        const list = this.isl.residenceItems;
        if (!Array.isArray(list)) return;
        const seen = new Set<number>();
        list.forEach((choice, i) => {
            const pointer = `/residenceItems/${i}`;
            const item = this.lk.items.get(choice.item);
            if (!item) {
                this.absentGuid(pointer, choice, choice.item, "Item");
                return;
            }
            if (!item.villa) {
                this.captureModelled(pointer, choice, "residence-item-not-applied", `Item ${choice.item} is no residence item of the calculator; the entry is kept and not applied.`);
                return;
            }
            if (seen.has(choice.item)) {
                this.captureModelled(pointer, choice, "residence-item-duplicate", `Item ${choice.item} is listed more than once; the first entry sets its state, this entry is kept.`);
                return;
            }
            seen.add(choice.item);
            let state = 1;
            if (choice.boosted === true) {
                if (item.boostable) state = 2;
                else this.add("approximated", "item-boost-approximated", `Item ${choice.item} has no boosted variant; it is written as equipped (1).`, { item: choice.item });
            }
            this.store[keys.residenceItemState(choice.item)] = state;
            this.noteDlc(item.dlcUnlocks, "items", choice.item);
            if (item.heroic !== undefined) this.heroicWrites.add(item.heroic);
            this.add("approximated", "residence-item-applied", `Residence item ${choice.item} is applied with state ${state}.`, { item: choice.item, state });
        });
    }

    // Reads a level-and-GUID coverage map (residenceEffects, publicCoverages) leaf by leaf. `apply` stores a leaf the
    // calculator can hold and returns false for a leaf it cannot; every unapplied leaf is kept at its pointer and
    // reported with `code`. The spec shape keys (default, byLevel, byResidence) carry no dimension for the effect or
    // building and are kept whole. Returns the levels and GUIDs that were applied, per GUID.
    private coverageLeaves(
        field: "residenceEffects" | "publicCoverages",
        code: string,
        clampCode: string,
        holds: (level: number, guid: number) => boolean,
        what: string,
    ): Map<number, Map<number, number>> {
        const applied = new Map<number, Map<number, number>>();
        const given: unknown = this.isl[field];
        if (given === undefined) return applied;
        if (typeof given !== "object" || given === null || Array.isArray(given)) {
            this.captureModelled(`/${field}`, given, code, `/${field} is no level and GUID map; it is kept and not applied.`);
            return applied;
        }
        const top = given as Record<string, unknown>;
        for (const levelKey of Object.keys(top)) {
            const levelPointer = `/${field}/${seg(levelKey)}`;
            const leaves = top[levelKey];
            if (levelKey === "default" || levelKey === "byLevel" || levelKey === "byResidence") {
                this.captureModelled(levelPointer, leaves, code, `${levelPointer} is the spec shape of a coverage; it is kept and not applied.`);
                continue;
            }
            if (typeof leaves !== "object" || leaves === null || Array.isArray(leaves)) {
                this.captureModelled(levelPointer, leaves, code, `${levelPointer} is no map of ${what}; it is kept and not applied.`);
                continue;
            }
            const level = guidOf(levelKey);
            for (const guidKey of Object.keys(leaves)) {
                const pointer = `${levelPointer}/${seg(guidKey)}`;
                const value = (leaves as Record<string, unknown>)[guidKey];
                const guid = guidOf(guidKey);
                if (!holds(level, guid)) {
                    this.captureModelled(pointer, value, code, `${what} ${guidKey} on level ${levelKey} is not in the calculator's data; the value is kept and not applied.`);
                    continue;
                }
                if (typeof value !== "number" || !Number.isFinite(value)) {
                    this.captureModelled(pointer, value, code, `${pointer} is no number; it is kept and not applied.`);
                    continue;
                }
                const used = Math.min(100, Math.max(0, value));
                if (used !== value) {
                    this.add("approximated", clampCode,`${pointer} ${value} is outside 0 to 100; ${used} is used.`, { pointer, value, used });
                }
                let perLevel = applied.get(guid);
                if (!perLevel) applied.set(guid, (perLevel = new Map()));
                perLevel.set(level, used);
            }
        }
        return applied;
    }

    // residenceEffects (R15, R15a, R15b): the share of a level's residences in range of an area effect. For an effect
    // the file lists, the levels it does not list get 0 and the island effect is switched on when any level is above 0.
    private residenceEffects(): void {
        const applied = this.coverageLeaves("residenceEffects", "area-effect-not-applied", "area-effect-clamped", (level, g) => this.lk.areaEffects.get(g)?.has(level) === true, "Area effect");
        for (const [g, listed] of applied) {
            const levels = this.lk.areaEffects.get(g)!;
            let any = false;
            for (const level of levels) {
                const value = listed.get(level) ?? 0;
                this.store[keys.areaEffectCoverage(level, g)] = value;
                if (value > 0) any = true;
            }
            this.add("approximated", "area-effect-applied", `Area effect ${g} reaches the listed share of each level's residences.`, { effect: g, levels: Object.fromEntries([...levels].map((l) => [l, listed.get(l) ?? 0])) });
            if (!any) continue;
            this.store[keys.islandEffectScaling(g)] = 1;
            this.areaSwitched.add(g);
            this.noteDlc(this.lk.effects.get(g)?.dlcUnlocks ?? [], "effects", g);
        }
    }

    // publicCoverages and publicCoverage (R18): the share of a level's residences in range of a public building scales
    // the supply of the public needs the building provides; the scalar applies to buildings that are not listed.
    private publicCoverages(): void {
        const applied = this.coverageLeaves("publicCoverages", "public-coverage-not-applied", "public-coverage-clamped", (level, g) => this.lk.publicBuildings.has(g) && this.lk.residenceLevels.has(level), "Public building");
        for (const [g, listed] of applied) {
            for (const [level, value] of listed) this.store[keys.publicBuildingCoverage(level, g)] = value;
        }
        const scalar: unknown = this.isl.publicCoverage;
        if (scalar === undefined) return;
        if (typeof scalar !== "number" || !Number.isFinite(scalar)) {
            this.captureModelled("/publicCoverage", scalar, "public-coverage-not-applied", "/publicCoverage is no number; it is kept and not applied.");
            return;
        }
        const used = Math.min(100, Math.max(0, scalar));
        if (used !== scalar) this.add("approximated", "public-coverage-clamped", `publicCoverage ${scalar} is outside 0 to 100; ${used} is used.`, { value: scalar, used });
        this.store[keys.publicCoverageDefault] = used;
    }

    // villaCoverage (R7): a number or the `default` of an object, clamped to 0..100; byLevel, byResidence and any other
    // key of an object stay kept and unapplied.
    private villaCoverage(): void {
        const given: unknown = this.isl.villaCoverage;
        if (given === undefined) return;
        let value: unknown = given;
        if (typeof given === "object" && given !== null && !Array.isArray(given)) {
            const o = given as Record<string, unknown>;
            for (const key of Object.keys(o)) {
                if (key === "default") continue;
                const pointer = `/villaCoverage/${seg(key)}`;
                if (key === "byLevel" || key === "byResidence") {
                    this.captureModelled(pointer, o[key], "villa-coverage-not-applied", `${pointer} is kept and not applied; the calculator applies one coverage for all residences.`);
                } else {
                    this.ext.captured.push({ pointer, kind: "unknown", value: o[key] });
                    this.add("carried-through", "unknown-field", `${pointer} is not part of the format; kept and written back on export.`, { pointer });
                }
            }
            value = o.default;
            if (value === undefined) return;
        }
        if (typeof value !== "number" || !Number.isFinite(value)) {
            this.add("approximated", "villa-coverage-invalid", "villaCoverage is no number; the calculator keeps 100.", { value });
            return;
        }
        const used = Math.min(100, Math.max(0, value));
        if (used !== value) {
            this.add("approximated", "villa-coverage-clamped", `villaCoverage ${value} is outside 0 to 100; ${used} is used.`, { value, used });
        }
        this.store[keys.villaCoverage] = used;
        this.add("approximated", "villa-coverage-applied", `villaCoverage ${used} scales the radius effect of residence items.`, { value: used });
    }

    // Island effects as given, with the active mythicEffect of socketed building items on top (KTD16).
    private effects(): void {
        const isl = this.isl;
        const values = new Map<number, number>();
        const given = isl.effects ?? {};
        for (const key of Object.keys(given)) {
            const g = guidOf(key);
            if (!this.lk.effects.has(g)) {
                this.absentGuid(`/effects/${seg(key)}`, given[key], g, "Effect");
                continue;
            }
            values.set(g, given[key]);
            if (this.areaSwitched.has(g) && given[key] !== 1) {
                this.add("approximated", "area-effect-overridden", `Effect ${g} is stated as ${given[key]} in effects; that value wins over the switch-on by residenceEffects.`, { effect: g, value: given[key] });
            }
        }

        const holders: ItemHolder[] = Array.isArray(isl.itemHolders) ? isl.itemHolders : [];
        const mentioned = new Set<number>();
        const active = new Set<number>();
        const noteRecord = (rec: ItemRecord, pointer: string, applicable: boolean): void => {
            const e = rec.mythicEffect;
            if (typeof e !== "number") return;
            if (!this.lk.effects.has(e)) {
                this.add("carried-through", "unknown-guid", `Effect ${e} of an item record is not in the calculator's data; the record is kept.`, {
                    pointer: `${pointer}/mythicEffect`,
                    guid: e,
                });
                return;
            }
            mentioned.add(e);
            if (!applicable) {
                this.add("not-mapped", "mythic-ship-not-applied", `Effect ${e} of an item on a ship is kept and not applied.`, { effect: e, pointer });
            } else if (rec.boostConditionMet === true) {
                active.add(e);
            }
        };
        holders.forEach((h, hi) => {
            if (typeof h !== "object" || h === null) return;
            const building = h.kind === undefined || h.kind === "building";
            records(h.items).forEach((rec, ri) => noteRecord(rec, `/itemHolders/${hi}/items/${ri}`, building));
            records(h.carried).forEach((rec) => {
                const e = rec.mythicEffect;
                if (typeof e === "number" && this.lk.mythical.has(e)) mentioned.add(e);
            });
        });
        records(isl.itemStorage).forEach((rec) => {
            if (typeof rec.mythicEffect === "number" && this.lk.mythical.has(rec.mythicEffect)) mentioned.add(rec.mythicEffect);
        });
        for (const e of mentioned) {
            if (!this.lk.mythical.has(e)) continue;
            values.set(e, Math.max(values.get(e) ?? 0, active.has(e) ? 1 : 0));
        }

        // The one-way item write (R4): an item stored at Base or Boosted switches its island-wide effect on, unless the
        // file states that effect itself (island, global or session entry, or an item record naming it as mythicEffect).
        const effectsDoc = this.read.doc.effects;
        const statedElsewhere = (g: number): boolean =>
            effectsDoc?.global?.[String(g)] !== undefined ||
            Object.values(effectsDoc?.bySession ?? {}).some((perSession) => perSession?.[String(g)] !== undefined);
        for (const g of this.heroicWrites) {
            if (given[String(g)] !== undefined || mentioned.has(g) || statedElsewhere(g)) continue;
            values.set(g, 1);
        }

        for (const [g, v] of values) {
            this.store[keys.islandEffectScaling(g)] = v;
            const info = this.lk.effects.get(g);
            if (v > 0 && info) {
                this.noteDlc(info.dlcUnlocks, "effects", g);
                if (active.has(g) && this.ticked("effects", g)) for (const id of this.dlcOf(info.dlcUnlocks)) this.settingsKeys[id] = "1";
            }
        }
    }

    private notes(): void {
        const notes = this.isl.notes ?? {};
        for (const key of Object.keys(notes)) {
            const g = guidOf(key);
            if (!this.lk.residences.has(g)) {
                this.absentGuid(`/notes/${seg(key)}`, notes[key], g, "Residence building");
                continue;
            }
            // residence notes use the same storage shape as product notes: `<guid>.notes` (world.ts persistString)
            this.store[keys.productNotes(g)] = notes[key];
        }
    }

    // Everything the reader captured for this island, unless it sits below an absent GUID entry.
    private captured(): void {
        const prefix = `/islands/${this.index}`;
        const fields: UnknownField[] = this.read.unknown.filter((u) => u.pointer.startsWith(prefix + "/"));
        for (const u of fields) {
            const pointer = u.pointer.slice(prefix.length);
            if (this.absent.some((a) => isUnder(pointer, a))) continue;
            const field: CapturedField = { pointer, kind: u.kind, value: u.value };
            this.ext.captured.push(field);
            if (pointer === "/moduleAttachments") {
                const count = Array.isArray(u.value) ? u.value.length : 0;
                this.add("not-mapped", "module-attachments-per-instance", `${count} module attachments are per instance; they are kept, the calculator applies module state per factory type only.`, { count });
            } else if (pointer === "/itemHolders" || pointer === "/itemStorage") {
                // counted per place in items()
            } else if (pointer === "/appliedEffects") {
                // applied and reported per entry by planEffects (R25); the list stays kept whole
            } else if (u.kind === "unknown") {
                this.add("carried-through", "unknown-field", `${pointer} is not part of the format; kept and written back on export.`, { pointer });
            } else {
                this.add("not-mapped", "unmodelled-key", `${pointer} is kept but not applied by the calculator.`, { pointer });
            }
        }
    }

    // R56: item records are preserved; the report counts them per place.
    private items(): void {
        const holders: ItemHolder[] = Array.isArray(this.isl.itemHolders) ? this.isl.itemHolders : [];
        const items = holders.flatMap((h) => (h && typeof h === "object" ? records(h.items) : []));
        const carried = holders.flatMap((h) => (h && typeof h === "object" ? records(h.carried) : []));
        const storage = records(this.isl.itemStorage);
        const places: [string, ItemRecord[]][] = [
            ["itemHolders.items", items],
            ["itemHolders.carried", carried],
            ["itemStorage", storage],
        ];
        for (const [place, list] of places) {
            if (!list.length) continue;
            this.add("carried-through", "item-records", `${list.length} item records in ${place} are kept unchanged.`, {
                place,
                records: list.length,
                quantity: quantity(list),
            });
        }
    }

    private finishDlc(): void {
        for (const [dlc, use] of this.dlcUse) {
            // A partial import switches on every DLC its ticked content needs (R13); a full import leaves it to DLC.used at load.
            if (this.scope) this.settingsKeys[dlc] = "1";
            const what = [...use.items.map((g) => `item ${g}`), ...use.effects.map((g) => `effect ${g}`), ...use.buildings.map((g) => `building ${g}`)].join(", ");
            this.add("approximated", "dlc-enabled", `${dlc} is switched on because of ${what}.`, { dlc, items: use.items, effects: use.effects, buildings: use.buildings });
        }
    }
}

export function documentItemReport(doc: ExchangeDocument): ReportEntry[] {
    const out: ReportEntry[] = [];
    const place = (name: string, list: unknown, count?: number): void => {
        const n = count ?? (Array.isArray(list) ? list.length : 0);
        if (n > 0) out.push({ kind: "carried-through", code: "item-records", message: `${n} entries in ${name} are kept unchanged.`, detail: { place: name, records: n } });
    };
    const account = doc.account;
    if (account && typeof account === "object") {
        place("account.items", account.items);
        place("account.transferItems", account.transferItems);
        place("account.racers", account.racers);
        if (account.race !== undefined) place("account.race", account.race, 1);
    }
    place("unlocatedItems", doc.unlocatedItems);
    return out;
}

export function planIslands(read: ReadOk, ctx: ImportContext): IslandsPlan {
    const lk = new Lookups(ctx);
    const plan: IslandsPlan = { islands: [], skipped: [], orphans: [], report: [], settingsKeys: {}, document: {} };
    const taken = new Set<string>();
    const scope = ctx.scope;
    const matches = new Map<string, string | null>((ctx.matches ?? []).map((m) => [m.fileId, m.calcName]));
    // Islands unticked: only matched islands are planned, under the calculator's name (KTD4). Islands ticked: the file's
    // names are used and the names of calculator islands that stay are reserved.
    const matchedNames = new Set<string>([...matches.values()].filter((n): n is string => n !== null));
    if (scope && scope.islands && scope.keepIslands) {
        for (const n of ctx.storedIslandNames ?? []) if (!matchedNames.has(n)) taken.add(n);
    }

    read.doc.islands.forEach((isl: ExchangeIsland, index: number) => {
        const session = isl.session;
        if (session !== undefined && !lk.sessions.has(session)) {
            const orphan: OrphanIsland = { id: isl.id, session, island: isl };
            plan.orphans.push(orphan);
            plan.report.push({
                kind: "not-mapped",
                code: "orphan-island",
                island: isl.id,
                message: `Island ${isl.id} belongs to session ${session}, which this calculator does not know; it is kept and written back on export.`,
                detail: { session },
            });
            return;
        }

        const wanted = wantedName(isl);
        const calcName = matches.get(isl.id) ?? null;

        if (scope && !scope.islands) {
            const counted = new IslandPlanner(isl, index, read, lk, wanted, scope);
            counted.plan();
            if (calcName === null) {
                const values = Object.keys(counted.store).filter((k) => !k.startsWith("exchange.")).length;
                plan.skipped.push({ id: isl.id, name: wanted, values, reason: "unmatched" });
                return;
            }
            const matched: IslandPlan = { id: isl.id, name: calcName, key: calcName, store: counted.store, ext: counted.ext, report: counted.report, file: isl, matchedTo: calcName };
            plan.islands.push(matched);
            plan.report.push(...counted.report);
            Object.assign(plan.settingsKeys, counted.settingsKeys);
            return;
        }

        const key = uniqueName(wanted, taken);
        taken.add(key);

        const p = new IslandPlanner(isl, index, read, lk, wanted, scope);
        p.plan();
        if (key !== wanted) {
            p.report.unshift({
                kind: "approximated",
                code: "name-changed",
                island: isl.id,
                message: `Island name "${wanted}" is already used or reserved; the island is named "${key}".`,
                detail: { wanted, name: key },
            });
        }
        const result: IslandPlan = { id: isl.id, name: key, key, store: p.store, ext: p.ext, report: p.report, file: isl };
        if (calcName !== null) result.matchedTo = calcName;
        plan.islands.push(result);
        plan.report.push(...p.report);
        Object.assign(plan.settingsKeys, p.settingsKeys);
    });

    if (read.doc.account !== undefined) plan.document.account = read.doc.account;
    if (read.doc.unlocatedItems !== undefined) plan.document.unlocatedItems = read.doc.unlocatedItems;
    plan.report.push(...documentItemReport(read.doc));
    return plan;
}
