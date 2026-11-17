// applyImport (U8): replaces the stored data with an import plan atomically (KTD1, KTD2).
// Snapshot -> validate every JSON string -> clear -> write -> reload. Any exception restores the snapshot byte for
// byte and nothing is reloaded. The old import (main.ts installImportConfigListener) clears and writes without a safety net.

import { isDeviceSetting } from "./scopes";
import { ImportPlan } from "./types";
import { versionCalculator } from "../util";

const ISLAND_NAME_KEY = "islandName"; // plain text, not JSON (world.ts)
const ISLAND_NAMES_KEY = "islandNames";
const VERSION_KEY = "versionCalculator";
const SETTINGS_KEY = "calculatorSettings";
const DARK_MODE_KEY = "darkMode.checked"; // views.ts
// sessionStorage flag, set by a committed import and consumed by the bootstrap after the reload.
export const JUST_IMPORTED_KEY = "exchange.justImported";
export const JUST_IMPORTED_RECALC = "recalc";

// The subset of the Web Storage interface the writer uses; tests inject a fake.
export interface StorageLike {
    readonly length: number;
    key(index: number): string | null;
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
    clear(): void;
}

export interface ApplyOptions {
    // false: do not call location.reload() (tests inspect the written state). Default: reload on success.
    reload?: boolean;
    // Storage to replace; default window.localStorage.
    storage?: StorageLike;
    // Storage for the "just imported" flag; default window.sessionStorage.
    sessionStorage?: StorageLike;
    // Set the "just imported" flag. Default: true when the page reloads (the flag makes the bootstrap open the Download
    // dialog), false with reload: false.
    markImported?: boolean;
    // The import recalculated the routes: the flag then carries "recalc" and the allocation after the reload replaces
    // the floors of the multi-source groups instead of leaving the ones with floors alone.
    recalcRoutes?: boolean;
    // Test hook: the n-th write (1-based, counted over every setItem of the import) throws a QuotaExceededError.
    failAfterWrites?: number;
    // Session GUIDs in app order, for the island list order; default window.params.sessions.
    sessionOrder?: number[];
}

export interface ApplyResult {
    ok: boolean;
    error?: string;
    // The keys written to the storage, in write order. Empty on failure.
    written: string[];
    // Non-fatal problems after a committed import (e.g. the sessionStorage flag could not be written).
    warnings?: string[];
}

function quotaError(): Error {
    return new DOMException("The quota has been exceeded.", "QuotaExceededError");
}

function describe(e: unknown): string {
    return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

export function snapshot(storage: StorageLike): Map<string, string> {
    const snap = new Map<string, string>();
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key !== null) snap.set(key, storage.getItem(key) ?? "");
    }
    return snap;
}

export function restore(storage: StorageLike, snap: Map<string, string>): void {
    storage.clear();
    for (const [k, v] of snap) storage.setItem(k, v);
}

// Island list in the order of IslandManager.sortIslands (world.ts): session index, then name by localeCompare.
function orderedIslandNames(keyMap: Record<string, string>, sessionOrder: number[]): string[] {
    let names: string[] = [];
    try {
        const parsed: unknown = JSON.parse(keyMap[ISLAND_NAMES_KEY] ?? "[]");
        if (Array.isArray(parsed)) names = parsed.filter((n): n is string => typeof n === "string");
    } catch {
        names = [];
    }
    const sessionIndex = (name: string): number => {
        try {
            const store: unknown = JSON.parse(keyMap[name] ?? "{}");
            const guid = store && typeof store === "object" ? (store as Record<string, unknown>)["session"] : undefined;
            return sessionOrder.indexOf(Number(guid));
        } catch {
            return -1;
        }
    };
    const idx = new Map(names.map((n) => [n, sessionIndex(n)]));
    return [...names].sort((a, b) => (idx.get(a)! - idx.get(b)!) || a.localeCompare(b));
}

// Device preferences of the current browser survive an import and an undo: dark mode, the language and the scope
// ticks and toggles (isDeviceSetting).
export function mergeDevicePreferences(keyMap: Record<string, string>, snap: Map<string, string>): void {
    const dark = snap.get(DARK_MODE_KEY);
    if (dark !== undefined) keyMap[DARK_MODE_KEY] = dark;

    const device: Record<string, unknown> = {};
    try {
        const old: unknown = JSON.parse(snap.get(SETTINGS_KEY) ?? "{}");
        if (old && typeof old === "object" && !Array.isArray(old)) {
            for (const [k, v] of Object.entries(old)) {
                if (isDeviceSetting(k) && v !== undefined && v !== null && v !== "") device[k] = v;
            }
        }
    } catch {
        return;
    }
    if (Object.keys(device).length === 0) return;
    let settings: Record<string, unknown> = {};
    try {
        const planned: unknown = JSON.parse(keyMap[SETTINGS_KEY] ?? "{}");
        if (planned && typeof planned === "object" && !Array.isArray(planned)) settings = planned as Record<string, unknown>;
    } catch {
        settings = {};
    }
    keyMap[SETTINGS_KEY] = JSON.stringify(Object.assign(settings, device));
}

export function applyImport(plan: ImportPlan, opts: ApplyOptions = {}): ApplyResult {
    const raw: StorageLike = opts.storage ?? window.localStorage;
    const failAt = opts.failAfterWrites;
    let writes = 0;
    const out: StorageLike = {
        get length() { return raw.length; },
        key: (i) => raw.key(i),
        getItem: (k) => raw.getItem(k),
        removeItem: (k) => raw.removeItem(k),
        clear: () => raw.clear(),
        setItem: (k, v) => {
            writes++;
            if (failAt !== undefined && writes === failAt) throw quotaError();
            raw.setItem(k, v);
        },
    };

    // Nothing is touched before the snapshot and the validation.
    let snap: Map<string, string>;
    const keyMap: Record<string, string> = { ...plan.keyMap };
    try {
        snap = snapshot(raw);
        for (const key of Object.keys(keyMap)) {
            if (key === ISLAND_NAME_KEY) continue;
            try {
                JSON.parse(keyMap[key]);
            } catch (e) {
                return { ok: false, error: `The value planned for ${JSON.stringify(key)} is not valid JSON: ${describe(e)}`, written: [] };
            }
        }
        const sessionOrder = opts.sessionOrder ?? (window.params?.sessions ?? []).map((s: { guid: number }) => s.guid);
        const names = orderedIslandNames(keyMap, sessionOrder);
        keyMap[ISLAND_NAMES_KEY] = JSON.stringify(names);
        if (names.length) keyMap[ISLAND_NAME_KEY] = names[0];
        keyMap[VERSION_KEY] = versionCalculator;
        mergeDevicePreferences(keyMap, snap);
    } catch (e) {
        return { ok: false, error: describe(e), written: [] };
    }

    const session: StorageLike | undefined = opts.sessionStorage ?? (typeof window !== "undefined" ? window.sessionStorage : undefined);
    const written: string[] = [];
    try {
        out.clear();
        for (const key of Object.keys(keyMap)) {
            out.setItem(key, keyMap[key]);
            written.push(key);
        }
    } catch (e) {
        const message = describe(e);
        try {
            restore(raw, snap);
        } catch (e2) {
            return { ok: false, error: `${message}; the previous data could not be restored: ${describe(e2)}`, written: [] };
        }
        return { ok: false, error: message, written: [] };
    }

    // The "just imported" flag is advisory: a failure here must not undo the committed import.
    const warnings: string[] = [];
    if (session && (opts.markImported ?? opts.reload !== false)) {
        try {
            session.setItem(JUST_IMPORTED_KEY, opts.recalcRoutes ? JUST_IMPORTED_RECALC : "1");
        } catch (e) {
            warnings.push(`The just-imported flag could not be written: ${describe(e)}`);
        }
    }

    if (opts.reload !== false) location.reload();
    return warnings.length ? { ok: true, written, warnings } : { ok: true, written };
}
