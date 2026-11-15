// Undo of the last import (U5, R5a, KTD9): one snapshot of all stored data in sessionStorage. It survives the reload
// that follows an import, is dropped when the tab or session ends and is overwritten by the next import's snapshot.
// It is never written to localStorage, so it is neither exported nor counted twice against the quota.
// All functions are synchronous and never throw.

import { mergeDevicePreferences, restore, snapshot, StorageLike } from "./writer";

export const UNDO_SNAPSHOT_KEY = "exchange.undoSnapshot";

export interface UndoResult {
    ok: boolean;
    error?: string;
}

export interface UndoOptions {
    // Storage that holds the snapshot; default window.sessionStorage.
    session?: StorageLike;
    // Storage that is replaced; default window.localStorage.
    storage?: StorageLike;
    // false: do not reload after a restore (tests inspect the restored state).
    reload?: boolean;
}

function describe(e: unknown): string {
    return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

function sessionOf(opts: UndoOptions): StorageLike | undefined {
    try {
        return opts.session ?? window.sessionStorage;
    } catch {
        return undefined;
    }
}

// Stores `map` (a snapshot of the whole localStorage) as the undo record.
export function saveSnapshot(map: Map<string, string>, opts: UndoOptions = {}): UndoResult {
    try {
        const session = sessionOf(opts);
        if (!session) return { ok: false, error: "sessionStorage is not available" };
        session.removeItem(UNDO_SNAPSHOT_KEY);
        session.setItem(UNDO_SNAPSHOT_KEY, JSON.stringify(Object.fromEntries(map)));
        return { ok: true };
    } catch (e) {
        try {
            sessionOf(opts)?.removeItem(UNDO_SNAPSHOT_KEY);
        } catch {
            // nothing to clean up
        }
        return { ok: false, error: describe(e) };
    }
}

export function loadSnapshot(opts: UndoOptions = {}): Map<string, string> | null {
    try {
        const text = sessionOf(opts)?.getItem(UNDO_SNAPSHOT_KEY);
        if (text === null || text === undefined) return null;
        const parsed: unknown = JSON.parse(text);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
        const map = new Map<string, string>();
        for (const [k, v] of Object.entries(parsed)) if (typeof v === "string") map.set(k, v);
        return map;
    } catch {
        return null;
    }
}

export function hasSnapshot(opts: UndoOptions = {}): boolean {
    return loadSnapshot(opts) !== null;
}

export function clearSnapshot(opts: UndoOptions = {}): void {
    try {
        sessionOf(opts)?.removeItem(UNDO_SNAPSHOT_KEY);
    } catch {
        // nothing to clear
    }
}

// Restores all stored data from before the last import, except device preferences, and reloads. A failing write
// restores the data as it was before the Undo.
export function restoreSnapshot(opts: UndoOptions = {}): UndoResult {
    const snap = loadSnapshot(opts);
    if (!snap) return { ok: false, error: "There is no import to undo" };
    let storage: StorageLike;
    try {
        storage = opts.storage ?? window.localStorage;
    } catch (e) {
        return { ok: false, error: describe(e) };
    }
    let before: Map<string, string>;
    try {
        before = snapshot(storage);
    } catch (e) {
        return { ok: false, error: describe(e) };
    }
    try {
        const keyMap: Record<string, string> = Object.fromEntries(snap);
        mergeDevicePreferences(keyMap, before);
        storage.clear();
        for (const k of Object.keys(keyMap)) storage.setItem(k, keyMap[k]);
    } catch (e) {
        const message = describe(e);
        try {
            restore(storage, before);
        } catch (e2) {
            return { ok: false, error: `${message}; the previous data could not be restored: ${describe(e2)}` };
        }
        return { ok: false, error: message };
    }
    clearSnapshot(opts);
    if (opts.reload !== false) location.reload();
    return { ok: true };
}
