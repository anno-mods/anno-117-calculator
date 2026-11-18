// Statistics feed client and row view-model for the statistics page (U3).
//
// Wraps `EventSource` against the (not-yet-existing, see docs/pipe-live-data-integration.md and
// the plan's Risks & Dependencies) anno-117-pipe local server, and holds the live `numEntries`
// rows as one persistent Knockout observableArray (KTD8: never reassigned; rows are pushed once
// and updated in place, first-seen insertion order, never re-sorted or spliced-and-rebuilt -
// mirrors the "never swap the array a foreach iterates" invariant from src/AGENTS.md's Aggregate
// mode section).
//
// The real server does not exist yet, so the payload shape below is a working contract, not a
// binding one (plan's U3 directional sketch / Dependencies & Assumptions). Parsing is
// deliberately narrow and defensive: invalid or missing numeric fields coerce to zero (R14)
// rather than throwing or dropping the rest of the message/entry.

import { ko } from './util';
import { resolveProduct, ResolvedProduct } from './statistics-params';

export type ConnectionState = 'offline' | 'reconnecting' | 'live';

/**
 * KTD5: `Reconnecting` only applies after a previously live connection dropped, and is itself
 * bounded - after this many *consecutive* `onerror` events since the last successful open/message,
 * the state gives up and falls back to `Offline`. Kept small and named so it's easy to retune once
 * a real server's reconnect cadence is known.
 */
const MAX_CONSECUTIVE_RECONNECT_FAILURES = 5;

/**
 * Placeholder loopback endpoint - anno-117-pipe's local server does not exist yet. Exported so a
 * later unit (or a real deployment) can point this at the real server without touching this
 * file's internals; `StatisticsFeed`'s constructor also accepts an explicit URL for tests.
 */
export const DEFAULT_STATISTICS_FEED_URL = 'http://127.0.0.1:53117/statistics';

/**
 * Raw shape of one `entries[]` element in an incoming SSE message, before numeric coercion.
 * `delta`/`totalMaintenance`/`totalIncome`/`totalProfit`/`summedProductivity`/
 * `averageProductivity` match the server's extended `AreaProductionStatistics` entry shape
 * (docs/pipe-live-data-integration.md table 3) - read defensively like every other field here
 * (R14), never required.
 */
interface StatisticsEntryPayload {
    productGuid?: unknown;
    generation?: unknown;
    consumption?: unknown;
    delta?: unknown;
    perfectGeneration?: unknown;
    perfectConsumption?: unknown;
    buildings?: unknown;
    totalMaintenance?: unknown;
    totalIncome?: unknown;
    totalProfit?: unknown;
    summedProductivity?: unknown;
    averageProductivity?: unknown;
}

/**
 * Raw shape of one SSE `message` event's parsed `data`. `sessionGuid` is the pipe's protocol-v2
 * session/region identifier (numeric, matches `SessionConfig.guid` in params.js) - the sole
 * source of session identity on this page (session-grouping plan R1/R2). The legacy `sessionId`
 * field (a small per-connection reconnect counter, not a real session guid) plays no role in
 * session resolution and is not read at all. `sessionGuid`, `islandId`, and `areaIndex` together
 * are the wire protocol's hard identity triple: a message missing any of the three is dropped
 * entirely in `handleMessage`, same as a missing `areaName`. `sessionGuid` joined `islandId`/
 * `areaIndex` in the identity after real pipe data showed `islandId` alone is not globally
 * unique across sessions (see `IslandFeedState.sessionIdentity`'s doc).
 */
interface StatisticsMessagePayload {
    version?: unknown;
    areaName?: unknown;
    timeStamp?: unknown;
    sessionGuid?: unknown;
    islandId?: unknown;
    areaIndex?: unknown;
    entries?: unknown;
}

export interface RowViewModel {
    /** Stable identity, never reassigned once the row is created (KTD8). */
    readonly productGuid: number;
    /**
     * Resolved once at row creation, not re-derived on every update. `resolveProduct` depends
     * only on the static params dataset and the page's current language, and this page never
     * switches language after load (plan's Dependencies/Assumptions: "language switching is not
     * added to this page") - so a static snapshot is correct for this page's lifetime. If that
     * assumption ever changes, a row created before a hypothetical language switch would keep
     * displaying its original-language name; accepted limitation, not something this page needs
     * to guard against today.
     */
    readonly identity: ResolvedProduct;
    generation: KnockoutObservable<number>;
    consumption: KnockoutObservable<number>;
    delta: KnockoutObservable<number>;
    perfectGeneration: KnockoutObservable<number>;
    perfectConsumption: KnockoutObservable<number>;
    buildings: KnockoutObservable<number>;
    totalMaintenance: KnockoutObservable<number>;
    totalIncome: KnockoutObservable<number>;
    totalProfit: KnockoutObservable<number>;
    summedProductivity: KnockoutObservable<number>;
    averageProductivity: KnockoutObservable<number>;
}

export interface IslandFeedState {
    /**
     * Display-only: plays no role in identity, lookup, or persisted keys - `(sessionIdentity,
     * islandId, areaIndex)` is the hard identity key (see `StatisticsFeed`'s `islandsByIdentity`).
     * Mutable (not `readonly`) because a later message for the same identity can rename the island
     * without creating a duplicate - `handleMessage` updates this field in place.
     */
    areaName: string;
    /**
     * Found during implementation (session-grouping plan): `islandId` alone is NOT globally
     * unique - real pipe data shows `areaIndex` constant at `1` across every message, and
     * `islandId` values repeat across different sessions (e.g. two different players' islands
     * both reporting `islandId: 5`, one in session 3245, one in session 6627). Without
     * `sessionIdentity` (the numeric `sessionGuid`) in the identity key, a later island from a
     * different session silently overwrote an earlier one sharing the same `(islandId,
     * areaIndex)` pair - same underlying object, renamed and re-sessioned, the original vanishing
     * from every view. Part of the hard identity key now, same as `islandId`/`areaIndex`: required,
     * a finite number by construction (validated in `handleMessage`), fixed for this island's
     * lifetime, never reassigned after construction.
     */
    sessionIdentity: KnockoutObservable<number>;
    /**
     * Part of the hard identity key - required, finite numbers by construction (validated
     * in `handleMessage` before an `IslandFeedStateImpl` is ever created). Fixed for this island's
     * lifetime; kept as an observable only for template/read-site parity with `sessionIdentity`,
     * never reassigned after construction.
     */
    islandId: KnockoutObservable<number>;
    areaIndex: KnockoutObservable<number>;
    rows: KnockoutObservableArray<RowViewModel>;
}

export class IslandFeedStateImpl implements IslandFeedState {
    public areaName: string;
    public readonly sessionIdentity: KnockoutObservable<number>;
    public readonly islandId: KnockoutObservable<number>;
    public readonly areaIndex: KnockoutObservable<number>;
    public readonly rows: KnockoutObservableArray<RowViewModel>;
    public readonly rowsByGuid = new Map<number, RowViewModel>();

    constructor(areaName: string, sessionIdentity: number, islandId: number, areaIndex: number) {
        this.areaName = areaName;
        this.sessionIdentity = ko.observable(sessionIdentity);
        this.islandId = ko.observable(islandId);
        this.areaIndex = ko.observable(areaIndex);
        this.rows = ko.observableArray([]);
    }
}

function createRow(productGuid: number): RowViewModel {
    return {
        productGuid,
        identity: resolveProduct(productGuid),
        generation: ko.observable(0),
        consumption: ko.observable(0),
        delta: ko.observable(0),
        perfectGeneration: ko.observable(0),
        perfectConsumption: ko.observable(0),
        buildings: ko.observable(0),
        totalMaintenance: ko.observable(0),
        totalIncome: ko.observable(0),
        totalProfit: ko.observable(0),
        summedProductivity: ko.observable(0),
        averageProductivity: ko.observable(0)
    };
}

/**
 * R14: narrow, defensive numeric coercion. `NaN`, `undefined`, missing keys, and non-numeric
 * strings all become `0` - never throws, so one bad field can't abort processing of the rest of
 * its entry or of other entries in the same message.
 */
function toNumberOrZero(value: unknown): number {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
}

/** Same contract as `toNumberOrZero`, additionally truncated for count-like integer fields. */
function toIntOrZero(value: unknown): number {
    return Math.trunc(toNumberOrZero(value));
}

/**
 * SSE client + Knockout view-model for the statistics page's live rows and connection state.
 *
 * KTD1: `connect()` is never called automatically by this class or anywhere in this file - U5
 * wires the actual "Connect" button. Constructing a `StatisticsFeed` does nothing observable
 * until `connect()` is called explicitly.
 */
export class StatisticsFeed {
    public readonly connectionState: KnockoutObservable<ConnectionState> = ko.observable('offline');
    public readonly islands: KnockoutObservableArray<IslandFeedState> = ko.observableArray([]);

    private readonly url: string;
    private eventSource: EventSource | undefined;
    /** Keyed by `${sessionGuid}:${islandId}:${areaIndex}` (the hard identity triple) - never by
     * `areaName`. `sessionGuid` is required in the key because `islandId` alone repeats across
     * different sessions in real pipe data (see `IslandFeedState.sessionIdentity`'s doc). */
    private readonly islandsByIdentity = new Map<string, IslandFeedStateImpl>();

    /** Set once `onopen` (or, defensively, a first `onmessage`) has ever fired for the current `connect()` call. */
    private hasEverOpened = false;
    /** Consecutive `onerror` events since the last successful open/message; reset by either. */
    private consecutiveErrorsSinceLastOpen = 0;

    constructor(url: string = DEFAULT_STATISTICS_FEED_URL) {
        this.url = url;
    }

    /**
     * Opens the SSE connection. KTD1: must only be called from an explicit user action (U5's
     * "Connect" control) - never from a constructor, module top-level, or automatic retry beyond
     * what the browser's own `EventSource` already does internally.
     */
    public connect(): void {
        if (this.eventSource) {
            return; // already connected/connecting - connect() is idempotent, not a re-dial.
        }
        const source = new EventSource(this.url);
        source.onopen = () => this.handleOpen();
        source.onmessage = (event: MessageEvent) => this.handleMessage(event);
        source.onerror = () => this.handleError();
        this.eventSource = source;
    }

    private handleOpen(): void {
        this.markAlive();
    }

    /**
     * Records proof the connection is alive: resets the failure streak and marks that an open
     * connection has been seen at least once (governs the offline-vs-reconnecting branch in
     * `handleError`). Shared by `handleOpen` and `handleMessage` so that definition lives in
     * exactly one place.
     */
    private markAlive(): void {
        this.hasEverOpened = true;
        this.consecutiveErrorsSinceLastOpen = 0;
    }

    private handleMessage(event: MessageEvent): void {
        // A message is only possible on an open connection - treat it as equivalent proof even if
        // `onopen` was somehow missed (defensive; real EventSource always fires onopen first).
        this.markAlive();

        let payload: StatisticsMessagePayload;
        try {
            payload = JSON.parse(event.data) as StatisticsMessagePayload;
        } catch {
            // Malformed message: ignore it entirely rather than throwing. Existing rows and
            // connection state are left untouched (still counts as evidence the feed is alive,
            // but there is nothing valid to apply).
            return;
        }

        // (sessionGuid, islandId, areaIndex) is the hard identity key - no areaName fallback. A
        // message missing any of the three is dropped entirely, same treatment as the areaName
        // check below. sessionGuid joined the identity after real pipe data showed islandId alone
        // is not globally unique across sessions (see IslandFeedState.sessionIdentity's doc).
        const islandId = payload.islandId;
        const areaIndex = payload.areaIndex;
        const sessionGuid = payload.sessionGuid;
        if (typeof islandId !== 'number' || !Number.isFinite(islandId) ||
            typeof areaIndex !== 'number' || !Number.isFinite(areaIndex) ||
            typeof sessionGuid !== 'number' || !Number.isFinite(sessionGuid)) {
            return; // drop message entirely
        }

        const areaName = payload.areaName;
        if (typeof areaName !== 'string' || areaName.trim() === '') {
            return; // drop message entirely
        }

        const newIslands: IslandFeedStateImpl[] = [];
        const identityKey = `${sessionGuid}:${islandId}:${areaIndex}`;
        let island = this.islandsByIdentity.get(identityKey);
        if (!island) {
            island = new IslandFeedStateImpl(areaName, sessionGuid, islandId, areaIndex);
            this.islandsByIdentity.set(identityKey, island);
            newIslands.push(island);
        } else {
            // R3: areaName is display-only and can change without affecting identity/lookup.
            island.areaName = areaName;
        }

        // Collect newly-created rows and push them once, after the loop, instead of one push per
        // entry - `rows` has active Knockout subscribers (KTD8's foreach), so each push is a
        // separate synchronous recompute of every dependent computed. Batching collapses a
        // message that introduces N new products into one notification instead of N.
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        const newRows: RowViewModel[] = [];
        for (const rawEntry of entries) {
            this.applyEntry(island, rawEntry as StatisticsEntryPayload | null | undefined, newRows);
        }
        // append only - never reorder, never rebuild (KTD8). Chunked instead of one unbounded
        // `rows.push(...newRows)` spread, which can exceed the engine's argument-count ceiling on
        // a single message carrying an extreme number of never-before-seen products; the chunk
        // size is far above the real catalog size (~181 products), so a normal message still
        // produces exactly one push - one Knockout notification, per the batching rationale above.
        const PUSH_CHUNK_SIZE = 10000;
        for (let i = 0; i < newRows.length; i += PUSH_CHUNK_SIZE) {
            island.rows.push(...newRows.slice(i, i + PUSH_CHUNK_SIZE));
        }

        // Pushing new islands after processing the entries
        for (let i = 0; i < newIslands.length; i += PUSH_CHUNK_SIZE) {
            this.islands.push(...newIslands.slice(i, i + PUSH_CHUNK_SIZE));
        }

        // KTD5: Live = connection open and at least one message received.
        this.connectionState('live');
    }

    private applyEntry(island: IslandFeedStateImpl, entry: StatisticsEntryPayload | null | undefined, newRows: RowViewModel[]): void {
        const productGuid = toIntOrZero(entry ? entry.productGuid : undefined);

        let row = island.rowsByGuid.get(productGuid);
        if (!row) {
            row = createRow(productGuid);
            island.rowsByGuid.set(productGuid, row);
            newRows.push(row);
        }

        row.generation(toNumberOrZero(entry ? entry.generation : undefined));
        row.consumption(toNumberOrZero(entry ? entry.consumption : undefined));
        row.delta(toNumberOrZero(entry ? entry.delta : undefined));
        row.perfectGeneration(toNumberOrZero(entry ? entry.perfectGeneration : undefined));
        row.perfectConsumption(toNumberOrZero(entry ? entry.perfectConsumption : undefined));
        row.buildings(toIntOrZero(entry ? entry.buildings : undefined));
        row.totalMaintenance(toIntOrZero(entry ? entry.totalMaintenance : undefined));
        row.totalIncome(toNumberOrZero(entry ? entry.totalIncome : undefined));
        row.totalProfit(toIntOrZero(entry ? entry.totalProfit : undefined));
        row.summedProductivity(toNumberOrZero(entry ? entry.summedProductivity : undefined));
        row.averageProductivity(toNumberOrZero(entry ? entry.averageProductivity : undefined));
    }

    private handleError(): void {
        // KTD5: `Reconnecting` only applies after a previously live connection dropped. An
        // `onerror` before any prior open/message means the connection never succeeded at all,
        // so it lands directly in `Offline`, never `Reconnecting`.
        if (!this.hasEverOpened) {
            this.giveUp();
            return;
        }

        this.consecutiveErrorsSinceLastOpen++;
        if (this.consecutiveErrorsSinceLastOpen >= MAX_CONSECUTIVE_RECONNECT_FAILURES) {
            this.giveUp();
        } else {
            this.connectionState('reconnecting');
        }

        // R13/KTD5: a disconnect-shaped event never clears `rows` or the already-resolved
        // `areaName`/`sessionIdentity` - only `connectionState` changes here.
    }

    /**
     * Reaching Offline means this class has given up on the current connection attempt. Close
     * the stale `EventSource` and clear the reference so a later `connect()` call - the Connect
     * button is always clickable, KTD1 - actually opens a fresh connection instead of hitting
     * `connect()`'s `if (this.eventSource) return;` guard forever (code review finding: without
     * this, the Connect button became permanently inert after the first failed attempt).
     */
    private giveUp(): void {
        this.eventSource?.close();
        this.eventSource = undefined;
        this.hasEverOpened = false;
        this.consecutiveErrorsSinceLastOpen = 0;
        this.connectionState('offline');
    }
}
