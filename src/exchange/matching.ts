// Island matching (U2): assigns file islands to stored calculator islands (R10, KD3) and holds the island id
// assignment that import matching and export share (KTD5).
// Order of the rules, each calculator island matched at most once, each rule over all file islands before the next:
//   1. `exchange.islandId` equals the file island id
//   2. game-island triple (session, island id, area index)
//   3. exact name with the same session
// A session mismatch is no match. An island with a session the calculator does not know (orphan) never matches.

import * as keys from "./keys";
import { ALL_ISLANDS } from "../util";
import { generateExchangeIslandId, Storage } from "../world";
import { ExchangeIsland, FileIslandRefRecord, IslandMatch, StoredIslandRecord } from "./types";

type Json = Record<string, unknown>;

export type StoredIsland = StoredIslandRecord;

// What the matcher reads of a file island.
export type FileIslandRef = FileIslandRefRecord;

export interface MatchOptions {
    // Session of an island that names none (the calculator's first session).
    defaultSession?: number;
    // Sessions the calculator knows; a file island of another session is an orphan and is never matched.
    knownSessions?: Set<number>;
}

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

function readJson(key: string): unknown {
    const text = localStorage.getItem(key);
    if (text === null) return undefined;
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

// The name the planner gives a file island before the collision suffix: name, else gameIsland.name, else id.
export function wantedName(isl: ExchangeIsland): string {
    if (isl.name !== undefined && isl.name !== "") return isl.name;
    if (isl.gameIsland?.name !== undefined && isl.gameIsland.name !== "") return isl.gameIsland.name;
    return isl.id;
}

export function fileIslandRefs(islands: ExchangeIsland[]): FileIslandRef[] {
    return islands.map((isl) => ({
        id: isl.id,
        name: wantedName(isl),
        session: isl.session,
        gameIsland: isl.gameIsland ? { sessionGuid: isl.gameIsland.sessionGuid ?? isl.session, islandId: isl.gameIsland.islandId, areaIndex: isl.gameIsland.areaIndex } : undefined,
    }));
}

// Assigns missing island ids through the live islands (their Storage keeps the id), flushes the pending saves and
// returns the island names in the stored order (the All Islands pseudo island excluded).
export function assignIslandIds(): string[] {
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

// Reads the stored calculator islands. Call assignIslandIds first so every island has an id.
export function readStoredIslands(): StoredIsland[] {
    const out: StoredIsland[] = [];
    for (const name of assignIslandIds()) {
        const store = readJson(name);
        if (!isObj(store)) continue;
        const islandId = toInt(store[keys.gameConnectorIslandId]);
        const areaIndex = toInt(store[keys.gameConnectorAreaIndex]);
        const id = store["exchange.islandId"];
        out.push({
            name,
            id: typeof id === "string" && id !== "" ? id : undefined,
            session: toInt(store["session"]),
            triple: islandId !== undefined && areaIndex !== undefined ? { islandId, areaIndex } : undefined,
        });
    }
    return out;
}

export function matchIslands(fileIslands: FileIslandRef[], stored: StoredIsland[], opts: MatchOptions = {}): IslandMatch[] {
    const sessionOf = (s: number | undefined): number | undefined => s ?? opts.defaultSession;
    const matches: IslandMatch[] = fileIslands.map((f) => ({ fileId: f.id, calcName: null, by: null }));
    const taken = new Set<string>();

    const eligible = (f: FileIslandRef): boolean => f.session === undefined || !opts.knownSessions || opts.knownSessions.has(f.session);
    const rule = (by: "id" | "triple" | "name", same: (f: FileIslandRef, s: StoredIsland) => boolean): void => {
        fileIslands.forEach((f, i) => {
            if (matches[i].calcName !== null || !eligible(f)) return;
            const hit = stored.find((s) => !taken.has(s.name) && same(f, s));
            if (!hit) return;
            taken.add(hit.name);
            matches[i] = { fileId: f.id, calcName: hit.name, by };
        });
    };

    rule("id", (f, s) => s.id !== undefined && s.id === f.id);
    rule("triple", (f, s) => {
        const g = f.gameIsland;
        if (!g || !s.triple) return false;
        return sessionOf(g.sessionGuid) === sessionOf(s.session) && g.islandId === s.triple.islandId && g.areaIndex === s.triple.areaIndex;
    });
    rule("name", (f, s) => f.name === s.name && sessionOf(f.session) === sessionOf(s.session));
    return matches;
}
