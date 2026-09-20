// Game connector: syncs live Anno 117 game data (via anno-117-pipe's local server) into the
// calculator's own persistent island/factory building counts.
// (docs/plans/2026-09-20-001-feat-game-connector-plan.md, U1-U6).
//
// KTD1: standalone module. Does not import from or modify src/statistics-feed.ts,
// src/statistics-params.ts, or src/statistics.ts - those back the separate, frozen-scope Live
// Statistics page. The one deliberate exception is KTD2: resolveSession() is imported from
// src/statistics-params.ts because it is a pure, side-effect-free params.sessions[].guid lookup
// with no coupling to statistics feature state - reusing it avoids a second implementation of the
// same lookup drifting from this one.
//
// KTD7/KTD-P2 resolved: reuses the existing GET /statistics SSE endpoint (anno-117-pipe's
// StatisticsServer, port 53117) rather than a dedicated /game-connector endpoint - confirmed live
// against the running server that its payload already carries every field this connector needs
// (buildingsByGuid, averageProductivity, sessionGuid) under lowerCamelCase JSON key names, distinct
// from the PascalCase C++ struct field names in docs/pipe-live-data-integration.md §3. This is a
// second, independent EventSource consumer of that same stream - it does not import or share any
// code with src/statistics-feed.ts's own client (KTD1 still holds).

import { ko } from './util';
import { resolveSession } from './statistics-params';
import { Island, Session } from './world';
import { Factory } from './factories';

declare const window: any;

export type GameConnectorState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

/**
 * KTD5-equivalent retry bound for this connector's own connection lifecycle (mirrors the
 * statistics page's MAX_CONSECUTIVE_RECONNECT_FAILURES shape - independent implementation, KTD1).
 */
const MAX_CONSECUTIVE_RECONNECT_FAILURES = 5;

/**
 * KTD7/KTD-P2: the existing statistics SSE endpoint, reused rather than a dedicated
 * /game-connector endpoint - see the module header comment.
 */
export const GAME_CONNECTOR_ENDPOINT = 'http://127.0.0.1:53117/statistics';

/**
 * Raw shape of one `entries[]` element in an incoming report, before validation/coercion.
 * Field names match `BuildStatisticsPayload()`'s JSON output (anno-117-pipe's
 * `src/statistics_server.cpp`), confirmed live - lowerCamelCase, not the PascalCase
 * `ProductionEntryData` C++ struct field names in docs/pipe-live-data-integration.md §3.
 */
interface GameConnectorEntryPayload {
    productGuid?: unknown;
    buildingsByGuid?: unknown;
    averageProductivity?: unknown;
}

/**
 * Raw shape of one incoming area report, as broadcast on GET /statistics. Field names confirmed
 * live against the running server (`docs/live-statistics-server-handoff.md` §5's payload shape).
 */
interface GameConnectorReportPayload {
    sessionGuid?: unknown;
    islandId?: unknown;
    areaIndex?: unknown;
    areaName?: unknown;
    entries?: unknown;
}

export interface GameConnectorEntry {
    readonly productGuid: number;
    /** Building/factory-type GUID -> constructed count (protocol v2's BuildingGUIDtoAmount). */
    readonly buildingGuidToAmount: Map<number, number>;
    /** Product-level average productivity (R5); `null` when the raw field was missing/invalid. */
    readonly averageProductivity: number | null;
}

export interface GameConnectorReport {
    readonly sessionGUID: number;
    readonly islandID: number;
    readonly areaIndex: number;
    readonly areaName: string;
    readonly entries: GameConnectorEntry[];
}

function toFiniteNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseEntry(raw: unknown): GameConnectorEntry | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const payload = raw as GameConnectorEntryPayload;

    const productGuid = toFiniteNumber(payload.productGuid);
    if (productGuid === null) {
        return null;
    }

    const buildingGuidToAmount = new Map<number, number>();
    const rawMap = payload.buildingsByGuid;
    if (rawMap && typeof rawMap === 'object') {
        for (const key of Object.keys(rawMap as Record<string, unknown>)) {
            const guid = Number(key);
            const amount = toFiniteNumber((rawMap as Record<string, unknown>)[key]);
            if (Number.isFinite(guid) && amount !== null) {
                buildingGuidToAmount.set(guid, Math.trunc(amount));
            }
        }
    }

    return {
        productGuid,
        buildingGuidToAmount,
        averageProductivity: toFiniteNumber(payload.averageProductivity)
    };
}

/**
 * R14-style defensive parsing (independent of statistics-feed.ts's own copy, per KTD1): a report
 * missing any of the hard identity fields, or with a blank areaName, is dropped entirely rather
 * than partially applied. A report with no valid entries still parses (an empty sync is valid).
 */
function parseReport(raw: unknown): GameConnectorReport | null {
    if (!raw || typeof raw !== 'object') {
        return null;
    }
    const payload = raw as GameConnectorReportPayload;

    const sessionGUID = toFiniteNumber(payload.sessionGuid);
    const islandID = toFiniteNumber(payload.islandId);
    const areaIndex = toFiniteNumber(payload.areaIndex);
    if (sessionGUID === null || islandID === null || areaIndex === null) {
        return null;
    }

    const areaName = typeof payload.areaName === 'string' ? payload.areaName.trim() : '';
    if (!areaName) {
        return null;
    }

    const rawEntries = Array.isArray(payload.entries) ? payload.entries : [];
    const entries: GameConnectorEntry[] = [];
    for (const rawEntry of rawEntries) {
        const entry = parseEntry(rawEntry);
        if (entry) {
            entries.push(entry);
        }
    }

    return { sessionGUID, islandID, areaIndex, areaName, entries };
}

/**
 * KTD2: resolves the live, runtime `Session` instance for a report's `sessionGUID`. Uses
 * `resolveSession()` (imported, not reimplemented) purely as the params.sessions[].guid existence
 * check; the actual object `IslandManager.create()` needs is a separate lookup against
 * `window.view.sessions` (the live Session instances), since `resolveSession()` itself only
 * returns a display-only { guid, name, icon } struct, not a Session.
 */
function resolveLiveSession(sessionGUID: number): Session | null {
    const resolved = resolveSession(sessionGUID);
    if (!resolved) {
        return null;
    }
    const sessions: Session[] = window.view.sessions;
    return sessions.find(s => s.guid === resolved.guid) ?? null;
}

function findIslandByStoredIdentity(report: GameConnectorReport): Island | null {
    const islands: Island[] = window.view.islands();
    for (const island of islands) {
        if (island.isAllIslands()) {
            continue;
        }
        const identity = island.getGameConnectorIdentity();
        if (!identity) {
            continue;
        }
        if (identity.islandID === report.islandID &&
            identity.areaIndex === report.areaIndex &&
            island.session.guid === report.sessionGUID) {
            return island;
        }
    }
    return null;
}

function findIslandByName(report: GameConnectorReport): Island | null {
    const islands: Island[] = window.view.islands();
    return islands.find(i => !i.isAllIslands() && i.name() === report.areaName) ?? null;
}

/**
 * Game connector: SSE client + connection-state machine + R2 island matching + R4/R5 write path.
 *
 * `connect()`/`disconnect()` are only ever called from the explicit navbar control (U5) - never
 * automatically - mirroring StatisticsFeed's own KTD1 contract, independently implemented here.
 */
export class GameConnector {
    public readonly state: KnockoutObservable<GameConnectorState> = ko.observable('disconnected');
    /** R3: area names colliding within the most recent tick; empty when nothing collided. */
    public readonly duplicateNames: KnockoutObservableArray<string> = ko.observableArray([]);

    private readonly url: string;
    private eventSource: EventSource | undefined;
    private hasEverOpened = false;
    private consecutiveErrorsSinceLastOpen = 0;
    /** Factories this connector has written syncedAverageProductivity to; cleared on disconnect. */
    private readonly touchedFactories = new Set<Factory>();

    constructor(url: string = GAME_CONNECTOR_ENDPOINT) {
        this.url = url;
    }

    connect(): void {
        if (this.eventSource) {
            return; // already connecting/connected - idempotent, not a re-dial.
        }
        this.state('connecting');
        const source = new EventSource(this.url);
        source.onopen = () => this.handleOpen();
        source.onmessage = (event: MessageEvent) => this.handleMessage(event);
        source.onerror = () => this.handleError();
        this.eventSource = source;
    }

    /**
     * R4: disconnecting has no effect on `buildings.constructed` (sync always wins while
     * connected; the input stays exactly as editable as any manual island's). Only the transient
     * productivity bracket clears, for every factory this connector has ever written to.
     */
    disconnect(): void {
        this.eventSource?.close();
        this.eventSource = undefined;
        this.hasEverOpened = false;
        this.consecutiveErrorsSinceLastOpen = 0;
        this.state('disconnected');

        for (const factory of this.touchedFactories) {
            factory.syncedAverageProductivity(null);
        }
        this.touchedFactories.clear();
    }

    /** Convenience for the navbar control (U5): connect if idle, disconnect otherwise. */
    toggle(): void {
        if (this.state() === 'disconnected' || this.state() === 'offline') {
            this.connect();
        } else {
            this.disconnect();
        }
    }

    private handleOpen(): void {
        this.markAlive();
        this.state('connected');
    }

    private markAlive(): void {
        this.hasEverOpened = true;
        this.consecutiveErrorsSinceLastOpen = 0;
    }

    private handleError(): void {
        if (!this.hasEverOpened) {
            this.giveUp();
            return;
        }

        this.consecutiveErrorsSinceLastOpen++;
        if (this.consecutiveErrorsSinceLastOpen >= MAX_CONSECUTIVE_RECONNECT_FAILURES) {
            this.giveUp();
        } else {
            this.state('reconnecting');
        }
    }

    /**
     * Reaching Offline means this class has given up on the current connection attempt. Close the
     * stale EventSource so a later connect() (always reachable via the toggle() control) actually
     * opens a fresh connection instead of being swallowed by connect()'s existing-connection guard.
     */
    private giveUp(): void {
        this.eventSource?.close();
        this.eventSource = undefined;
        this.hasEverOpened = false;
        this.consecutiveErrorsSinceLastOpen = 0;
        this.state('offline');
    }

    private handleMessage(event: MessageEvent): void {
        this.markAlive();
        this.state('connected');

        let raw: unknown;
        try {
            raw = JSON.parse(event.data);
        } catch {
            return; // malformed message: ignore entirely, still counts as proof the feed is alive.
        }

        const rawReports = Array.isArray(raw) ? raw : [raw];
        const reports: GameConnectorReport[] = [];
        for (const rawReport of rawReports) {
            const report = parseReport(rawReport);
            if (report) {
                reports.push(report);
            }
        }

        this.processTick(reports);
    }

    /**
     * R3: within one tick's batch, group by areaName. A name shared by 2+ reports with distinct
     * (sessionGUID, islandID) is excluded from matching entirely for this tick; the same island's
     * own re-report (identical identity) is not a collision with itself.
     */
    private processTick(reports: GameConnectorReport[]): void {
        const byName = new Map<string, GameConnectorReport[]>();
        for (const report of reports) {
            const group = byName.get(report.areaName);
            if (group) {
                group.push(report);
            } else {
                byName.set(report.areaName, [report]);
            }
        }

        const collidingNames: string[] = [];
        const acceptedReports: GameConnectorReport[] = [];
        for (const [areaName, group] of byName) {
            const distinctIdentities = new Set(group.map(r => `${r.sessionGUID}:${r.islandID}`));
            if (distinctIdentities.size > 1) {
                collidingNames.push(areaName);
            } else {
                acceptedReports.push(group[0]);
            }
        }

        this.duplicateNames(collidingNames);

        for (const report of acceptedReports) {
            this.syncReport(report);
        }
    }

    /** R2: matching order - stored identity, then name, then auto-create (KTD2/KTD3/KTD4). */
    private resolveIsland(report: GameConnectorReport): Island | null {
        const byIdentity = findIslandByStoredIdentity(report);
        if (byIdentity) {
            return byIdentity;
        }

        const byName = findIslandByName(report);
        if (byName) {
            byName.setGameConnectorIdentity(report.islandID, report.areaIndex);
            return byName;
        }

        const session = resolveLiveSession(report.sessionGUID);
        if (!session) {
            console.warn(`GameConnector: unresolved sessionGUID ${report.sessionGUID} - skipping report for "${report.areaName}"`);
            return null;
        }

        window.view.islandManager.create(report.areaName, session);
        const created: Island | undefined = window.view.islands()
            .find((i: Island) => !i.isAllIslands() && i.name() === report.areaName);
        if (!created) {
            return null; // defensive; IslandManager.create() should always succeed given a valid session
        }
        created.setGameConnectorIdentity(report.islandID, report.areaIndex);
        return created;
    }

    /** R4/R5: writes constructed counts and the productivity bracket for one matched report. */
    private syncReport(report: GameConnectorReport): void {
        const island = this.resolveIsland(report);
        if (!island) {
            return;
        }

        for (const entry of report.entries) {
            for (const [buildingGuid, count] of entry.buildingGuidToAmount) {
                const asset = island.assetsMap.get(buildingGuid);
                if (!(asset instanceof Factory)) {
                    continue; // unknown/future building type - silently skipped (R4)
                }
                asset.buildings.constructed(count);
                asset.syncedAverageProductivity(entry.averageProductivity);
                this.touchedFactories.add(asset);
            }
        }
    }
}
