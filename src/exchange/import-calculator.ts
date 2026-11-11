// Import plan for the calculator's own `ext.calculator` blocks (U9): calculator-only state that the exporter writes
// because the core format has no place for it, and that the importer restores. Pure: no storage, no DOM.
//
// Document level: collapsibleStates, statisticsCollections, the "All Islands" store, route entries that name the
// aggregate and calculator settings come back as the top-level keys they were read from. `darkMode` is a device
// preference and is never applied (R5, CP10); `areaBuffs` are dormant and never written (KTD10).
// Island level: `store` holds raw island-store keys (shared passiveTrade.userSetAmount, effectCoverage, default
// suppliers the core format cannot express, ...). Core mappings win over these raw keys.
// Every other key of the calculator's block is kept and returned unchanged (R13).

import { IslandsPlan, ReadOk, ReportEntry, StoredTradeRoute } from "./types";

const DOCUMENT_KNOWN = new Set(["collapsibleStates", "darkMode", "statisticsCollections", "allIslands", "routes", "settings", "areaBuffs"]);
// Raw keys of an island store the core mapping owns; a raw copy must never write them.
const PROTECTED_ISLAND_KEYS = /^(exchange\.|session$|gameConnector\.)/;
// Device preference inside calculatorSettings (main.ts): survives an import untouched.
const DEVICE_SETTINGS = new Set(["language"]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isRoute(v: unknown): v is StoredTradeRoute {
    if (!isPlainObject(v)) return false;
    return (
        typeof v.productGUID === "number" &&
        typeof v.from === "string" &&
        typeof v.to === "string" &&
        typeof v.userSetAmount === "number" &&
        typeof v.isDefaultSupplier === "boolean"
    );
}

export interface CalculatorImportPlan {
    // By island store key: raw store keys to add below the core mapping, and the unknown rest of ext.calculator.
    islands: Record<string, { store: Record<string, unknown>; extra?: Record<string, unknown> }>;
    // Raw top-level keys: collapsibleStates, statisticsCollections, "All Islands".
    keyMap: Record<string, string>;
    // Additions to calculatorSettings, below the DLC, difficulty and mythical-item keys of the core mapping.
    settings: Record<string, unknown>;
    // Route entries that name the aggregate, appended to tradeRoutes.
    routes: StoredTradeRoute[];
    // Unknown keys of the document-level block.
    extra?: Record<string, unknown>;
    report: ReportEntry[];
}

export function planCalculator(islands: IslandsPlan, read: ReadOk): CalculatorImportPlan {
    const plan: CalculatorImportPlan = { islands: {}, keyMap: {}, settings: {}, routes: [], report: [] };
    const drop = (message: string, detail?: Record<string, unknown>, island?: string): void => {
        const e: ReportEntry = { kind: "not-mapped", code: "calculator-state-dropped", message };
        if (island !== undefined) e.island = island;
        if (detail) e.detail = detail;
        plan.report.push(e);
    };

    for (const ip of islands.islands) {
        const out: CalculatorImportPlan["islands"][string] = { store: {} };
        plan.islands[ip.key] = out;
        const block = ip.file.ext?.calculator;
        if (!isPlainObject(block)) continue;
        const extra: Record<string, unknown> = {};
        for (const k of Object.keys(block)) {
            if (k !== "store") {
                extra[k] = block[k];
                continue;
            }
            const store = block[k];
            if (!isPlainObject(store)) {
                drop("ext.calculator.store of an island is not an object; it is ignored.", { pointer: "ext/calculator/store" }, ip.id);
                continue;
            }
            for (const key of Object.keys(store)) if (!PROTECTED_ISLAND_KEYS.test(key)) out.store[key] = store[key];
        }
        if (Object.keys(extra).length) out.extra = extra;
    }

    const block = read.doc.ext?.calculator;
    if (!isPlainObject(block)) return plan;
    const extra: Record<string, unknown> = {};
    for (const k of Object.keys(block)) {
        const v = block[k];
        if (!DOCUMENT_KNOWN.has(k)) {
            extra[k] = v;
            continue;
        }
        switch (k) {
            case "collapsibleStates":
            case "statisticsCollections":
                if (isPlainObject(v)) plan.keyMap[k] = JSON.stringify(v);
                else drop(`ext.calculator.${k} is not an object; it is ignored.`, { key: k });
                break;
            case "allIslands":
                if (isPlainObject(v)) plan.keyMap["All Islands"] = JSON.stringify(v);
                else drop("ext.calculator.allIslands is not an object; it is ignored.", { key: k });
                break;
            case "settings":
                if (isPlainObject(v)) {
                    // Object.fromEntries defines own properties, so a "__proto__" key neither hits the prototype nor vanishes.
                    plan.settings = Object.fromEntries([
                        ...Object.entries(plan.settings),
                        ...Object.entries(v).filter(([s]) => !DEVICE_SETTINGS.has(s)),
                    ]);
                } else {
                    drop("ext.calculator.settings is not an object; it is ignored.", { key: k });
                }
                break;
            case "routes":
                if (Array.isArray(v)) {
                    for (const r of v) {
                        if (isRoute(r)) plan.routes.push(r);
                        else drop("An entry of ext.calculator.routes is not a route; it is ignored.", { entry: r });
                    }
                } else {
                    drop("ext.calculator.routes is not a list; it is ignored.", { key: k });
                }
                break;
            default:
                // darkMode (device preference) and areaBuffs (dormant, never written)
                break;
        }
    }
    if (Object.keys(extra).length) plan.extra = extra;
    return plan;
}
