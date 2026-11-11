// planImport (U7): reads a file and assembles the island, trade and effects parts into one import plan with a
// complete key map of raw top-level localStorage keys (KTD1). Pure: no storage, no DOM. The atomic writer (U8)
// writes the key map; the report dialog (U10) shows the report; U11 compares against `computed`.

import { planCalculator } from "./import-calculator";
import { planEffects } from "./import-effects";
import { planIslands } from "./import-islands";
import { planTrade } from "./import-trade";
import { readExchange } from "./reader";
import {
    DocumentExt,
    ImportContext,
    ImportPlan,
    ImportPlanReport,
    ImportPlanResult,
    IslandExt,
    PlanProblem,
    ReadOk,
    ReportEntry,
} from "./types";

export const EXCHANGE_EXT_KEY = "exchange.ext";
const ISLAND_NAME_KEY = "islandName"; // plain text, not JSON (world.ts:298)

// Document-scope captured fields the plan keeps elsewhere: `account` and `unlocatedItems` have their own keys of
// the top-level ext, and `trade.routes` is kept whole with all its unknown keys.
function keptElsewhere(pointer: string): boolean {
    return pointer === "/account" || pointer === "/unlocatedItems" || pointer === "/trade/routes" || pointer.startsWith("/trade/routes/");
}

function documentReport(read: ReadOk): ReportEntry[] {
    const out: ReportEntry[] = [];
    for (const u of read.unknown) {
        if (u.scope !== "document" || keptElsewhere(u.pointer)) continue;
        if (u.kind === "unknown") {
            out.push({ kind: "carried-through", code: "unknown-field", message: `${u.pointer} is not part of the format; kept and written back on export.`, detail: { pointer: u.pointer } });
        } else {
            out.push({ kind: "not-mapped", code: "unmodelled-key", message: `${u.pointer} is kept but not applied by the calculator.`, detail: { pointer: u.pointer } });
        }
    }
    return out;
}

function validateJson(keyMap: Record<string, string>): PlanProblem[] {
    const problems: PlanProblem[] = [];
    for (const key of Object.keys(keyMap)) {
        if (key === ISLAND_NAME_KEY) continue;
        try {
            JSON.parse(keyMap[key]);
        } catch (e) {
            problems.push({ pointer: key, code: "invalid-json", message: `The value planned for ${JSON.stringify(key)} is not valid JSON: ${e instanceof Error ? e.message : String(e)}` });
        }
    }
    return problems;
}

export function planImport(text: string, ctx: ImportContext): ImportPlanResult {
    const read = readExchange(text);
    if ("error" in read) return read;

    const islands = planIslands(read, ctx);
    const trade = planTrade(islands, read, ctx);
    const fx = planEffects(islands, read, ctx);
    const calc = planCalculator(islands, read);

    const keyMap: Record<string, string> = {};
    let preservedImports = trade.document.preservedImports.length;
    let capturedFields = 0;

    // Island stores: the calculator-only raw keys, then the island part, the trade additions and the material
    // additions (the core mapping wins); ext merged from all of them.
    for (const ip of islands.islands) {
        const t = trade.islands[ip.key];
        const m = fx.islands[ip.key];
        const c = calc.islands[ip.key];
        const store: Record<string, unknown> = { ...(c?.store ?? {}), ...ip.store, ...(t?.store ?? {}), ...(m?.store ?? {}) };
        const ext: IslandExt = { ...ip.ext, guids: [...ip.ext.guids, ...(t?.ext.guids ?? [])], preservedImports: t?.ext.preservedImports ?? [] };
        if (t?.ext.minimumStock !== undefined) ext.minimumStock = t.ext.minimumStock;
        if (m?.ext.materials !== undefined) ext.materials = m.ext.materials;
        if (c?.extra !== undefined) ext.calculator = c.extra;
        store[EXCHANGE_EXT_KEY] = ext;
        keyMap[ip.key] = JSON.stringify(store);
        preservedImports += ext.preservedImports?.length ?? 0;
        capturedFields += ext.captured.length + ext.guids.length;
    }

    const captured = read.unknown
        .filter((u) => u.scope === "document" && !keptElsewhere(u.pointer))
        .map((u) => ({ pointer: u.pointer, kind: u.kind, value: u.value }));
    capturedFields += captured.length;

    const documentExt: DocumentExt = {
        orphans: islands.orphans,
        captured,
        preservedImports: trade.document.preservedImports,
        fileIslandIds: read.doc.islands.map((i) => i.id),
    };
    if (calc.extra !== undefined) documentExt.calculator = calc.extra;
    if (islands.document.account !== undefined) documentExt.account = islands.document.account;
    if (islands.document.unlocatedItems !== undefined) documentExt.unlocatedItems = islands.document.unlocatedItems;
    if (trade.document.trade !== undefined) documentExt.trade = trade.document.trade;
    if (fx.ext.research) documentExt.research = fx.ext.research;
    if (fx.ext.effects) documentExt.effects = fx.ext.effects;
    if (fx.ext.settings) documentExt.settings = fx.ext.settings;

    const names = islands.islands.map((i) => i.key);
    keyMap["tradeRoutes"] = JSON.stringify([...trade.tradeRoutes, ...calc.routes]);
    keyMap["sessionSettings"] = JSON.stringify(fx.sessionSettings);
    keyMap["globalEffects"] = JSON.stringify(fx.globalEffects);
    // DLC keys and the need consumption option; DLCs the island data switches on (mythical items) win over a listed "0".
    // The calculator-only settings of ext.calculator sit below both.
    keyMap["calculatorSettings"] = JSON.stringify({ ...calc.settings, ...fx.calculatorSettings, ...islands.settingsKeys });
    for (const k of Object.keys(calc.keyMap)) keyMap[k] = calc.keyMap[k];
    keyMap["islandNames"] = JSON.stringify(names);
    if (names.length) keyMap[ISLAND_NAME_KEY] = names[0];
    keyMap[EXCHANGE_EXT_KEY] = JSON.stringify(documentExt);

    const entries = [...islands.report, ...trade.report, ...fx.report, ...calc.report, ...documentReport(read)];
    const report: ImportPlanReport = {
        carriedThrough: entries.filter((e) => e.kind === "carried-through"),
        notMapped: entries.filter((e) => e.kind === "not-mapped"),
        approximated: entries.filter((e) => e.kind === "approximated"),
        notProvided: entries.filter((e) => e.kind === "not-provided"),
        counts: {
            islands: islands.islands.length,
            orphans: islands.orphans.length,
            tradeRoutes: trade.tradeRoutes.length,
            preservedImports,
            capturedFields,
        },
        orphans: islands.orphans.map((o) => (o.session === undefined ? { id: o.id } : { id: o.id, session: o.session })),
    };

    const problems: PlanProblem[] = [...read.problems, ...validateJson(keyMap)];
    const plan: ImportPlan = { keyMap, report, orphans: islands.orphans, problems };
    if (read.computed !== undefined) plan.computed = read.computed;
    return plan;
}
