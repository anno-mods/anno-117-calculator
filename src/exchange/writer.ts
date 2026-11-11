// applyImport (U8): replaces the stored data with an import plan atomically (KTD1, KTD2).
// Snapshot -> validate every JSON string -> clear -> write -> reload. Any exception restores the snapshot byte for
// byte and nothing is reloaded. The old import (main.ts installImportConfigListener) clears and writes without a safety net.

import { ImportPlan } from "./types";
import { versionCalculator } from "../util";

const ISLAND_NAME_KEY = "islandName"; // plain text, not JSON (world.ts)
const ISLAND_NAMES_KEY = "islandNames";
const VERSION_KEY = "versionCalculator";
const SETTINGS_KEY = "calculatorSettings";
const LANGUAGE_KEY = "language"; // inside calculatorSettings (main.ts, settingsStorage)
const DARK_MODE_KEY = "darkMode.checked"; // views.ts
export const COMPUTED_SESSION_KEY = "exchange.computed";

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
    // Storage for the `computed` hand-off (U11); default window.sessionStorage.
    sessionStorage?: StorageLike;
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
}

function quotaError(): Error {
    return new DOMException("The quota has been exceeded.", "QuotaExceededError");
}

function describe(e: unknown): string {
    return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

function snapshot(storage: StorageLike): Map<string, string> {
    const snap = new Map<string, string>();
    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key !== null) snap.set(key, storage.getItem(key) ?? "");
    }
    return snap;
}

function restore(storage: StorageLike, snap: Map<string, string>): void {
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

// Device preferences of the current browser survive an import (R5, CP10).
function mergeDevicePreferences(keyMap: Record<string, string>, snap: Map<string, string>): void {
    const dark = snap.get(DARK_MODE_KEY);
    if (dark !== undefined) keyMap[DARK_MODE_KEY] = dark;

    let language: unknown;
    try {
        const old: unknown = JSON.parse(snap.get(SETTINGS_KEY) ?? "{}");
        if (old && typeof old === "object") language = (old as Record<string, unknown>)[LANGUAGE_KEY];
    } catch {
        language = undefined;
    }
    if (language === undefined || language === null || language === "") return;
    let settings: Record<string, unknown> = {};
    try {
        const planned: unknown = JSON.parse(keyMap[SETTINGS_KEY] ?? "{}");
        if (planned && typeof planned === "object" && !Array.isArray(planned)) settings = planned as Record<string, unknown>;
    } catch {
        settings = {};
    }
    settings[LANGUAGE_KEY] = language;
    keyMap[SETTINGS_KEY] = JSON.stringify(settings);
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
        if (plan.computed !== undefined && session) session.setItem(COMPUTED_SESSION_KEY, JSON.stringify(plan.computed));
    } catch (e) {
        const message = describe(e);
        try {
            restore(raw, snap);
            session?.removeItem(COMPUTED_SESSION_KEY);
        } catch (e2) {
            return { ok: false, error: `${message}; the previous data could not be restored: ${describe(e2)}`, written: [] };
        }
        return { ok: false, error: message, written: [] };
    }

    if (opts.reload !== false) location.reload();
    return { ok: true, written };
}
