// Trade route analysis: evidence from the imported game routes, visits and storage history (exchange document data kept
// in `exchange.ext`) turned into per-route indicators. The evidence is static; the calculator's live route rate is
// multiplied in by the caller (KTD1, KTD2). Nothing here writes storage.
//
// Visit entries exist only for visits with a non-zero net amount and carry no ship instance and no station index,
// so every gap and every actual unload is an estimate (R9).

import { pairsOf, shipCount, stopsOf, Stop } from './exchange/derive-routes';
import type { HistorySeries, RouteShip, TradeRoute as GameRoute } from './exchange/types';

/** Game time is counted in milliseconds (KTD6). */
export const MS_PER_MINUTE = 60000;
export const MIN_GAPS = 2;
const GAP_WINDOW = 5;
const EPS = 1e-9;

type Visit = Record<string, unknown>;

export interface LiveSnapshot {
    clock?: string;
    timestamp?: number;
    islands?: Record<string, Record<string, { storage?: number } | number>>;
}

/** The exchange data the analysis consumes, in the exchange format's own types. */
export interface ExchangeData {
    routes: GameRoute[];
    visits: Visit[];
    history: HistorySeries[];
    live: LiveSnapshot | undefined;
    /** exchange island id -> product guid -> minimum stock */
    minimumStock: Map<string, Record<string, number>>;
    /** exchange island id -> calculator island name (islands that have a store) */
    islandNames: Map<string, string>;
}

export interface StoredIsland {
    name: string;
    item: (key: string) => unknown;
}

function isObj(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseMaybe(v: unknown): unknown {
    if (typeof v !== 'string') return v;
    try {
        return JSON.parse(v);
    } catch {
        return undefined;
    }
}

/**
 * The only code that knows where the document data sits: the top-level `exchange.ext` (`trade`, and `captured`
 * entries at `/history` and `/live`) and, per island, `exchange.islandId` and `exchange.ext.minimumStock`.
 * Absent members come back empty; this never throws.
 */
export function readExchangeData(extText: string | null | undefined, islands: StoredIsland[]): ExchangeData {
    const data: ExchangeData = { routes: [], visits: [], history: [], live: undefined, minimumStock: new Map(), islandNames: new Map() };
    try {
        const ext = parseMaybe(extText);
        if (isObj(ext)) {
            const trade = ext.trade;
            if (isObj(trade)) {
                if (Array.isArray(trade.routes)) data.routes = trade.routes.filter(isObj) as unknown as GameRoute[];
                if (Array.isArray(trade.visits)) data.visits = trade.visits.filter(isObj);
            }
            if (Array.isArray(ext.captured)) {
                for (const c of ext.captured) {
                    if (!isObj(c)) continue;
                    if (c.pointer === '/history' && Array.isArray(c.value)) data.history = c.value.filter(isObj) as HistorySeries[];
                    else if (c.pointer === '/live' && isObj(c.value)) data.live = c.value as LiveSnapshot;
                }
            }
        }
        for (const isl of islands) {
            const id = isl.item('exchange.islandId');
            if (typeof id !== 'string' || !id) continue;
            data.islandNames.set(id, isl.name);
            const iext = parseMaybe(isl.item('exchange.ext'));
            if (isObj(iext) && isObj(iext.minimumStock)) data.minimumStock.set(id, iext.minimumStock as Record<string, number>);
        }
    } catch (e) {
        console.warn('route-analysis: stored exchange data could not be read', e);
    }
    return data;
}

// ---- Evidence ----

export interface RouteEvidence {
    routeId: string;
    routeName: string;
    /** Longest of the latest gaps between visits at the destination, minutes; undefined when unusable. */
    gapMinutes?: number;
    gapCount: number;
    /** Tons per visit the route can unload of the product (slot amount capped by cargo, times ships). */
    capacity?: number;
    /** Mean positive net amount of the product per visit; for a stop that also loads it only while no visit netted negative (`netOnly`). */
    actualUnload?: number;
    /** The destination stop also loads the product. */
    relay: boolean;
    /** Ships of the game route (capacity and the minimum-stock cap count per ship). */
    ships: number;
    /** `actualUnload` is the net of a stop that also loads the product, so a lower bound of the unload. */
    netOnly?: boolean;
    /** Tons per minute delivered over the recorded visits (lower bound for a stop that also loads the product). */
    deliveredPerMin?: number;
    /** A reason that makes this route's values unavailable. */
    reason?: 'no-ships' | 'ship' | 'ambiguous' | 'clock' | 'gaps';
    /** Game route, destination and product: evidences of several sources with one key describe the same unload slots. */
    capacityKey: string;
    /** Number of source islands that serve the destination with the product on this game route. */
    sources: number;
}

export interface PairEvidence {
    key: string;
    source: string;
    dest: string;
    product: number;
    routes: RouteEvidence[];
}

export type Reason = 'no-evidence' | NonNullable<RouteEvidence['reason']>;

export function pairKey(source: string, dest: string, product: number): string {
    return `${source}|${dest}|${product}`;
}

function sameNumber(a: number, b: number): boolean {
    return Math.abs(a - b) < 1e-6;
}

function shipCapacity(route: GameRoute, unloadAtStop: number, thisUnload: number, slotSize: number): number | undefined {
    if (!Array.isArray(route.ships) || route.ships.length === 0) return undefined;
    let total = 0;
    for (const s of route.ships as RouteShip[]) {
        if (!isObj(s)) continue;
        const count = typeof s.count === 'number' && Number.isFinite(s.count) ? s.count : 1;
        if (count <= 0) continue;
        if (typeof s.slots !== 'number' || !(s.slots > 0) || !(slotSize > 0)) return undefined;
        const cargo = s.slots * slotSize;
        const share = unloadAtStop > cargo ? cargo / unloadAtStop : 1;
        total += count * thisUnload * share;
    }
    return total;
}

export class RouteAnalysis {
    private readonly pairs = new Map<string, PairEvidence>();
    private readonly byRoute = new Map<string, PairEvidence[]>();
    private readonly series = new Map<string, number[]>();

    constructor(public readonly data: ExchangeData) {
        this.indexHistory();
        this.build();
    }

    get hasRoutes(): boolean {
        return this.data.routes.length > 0;
    }

    evidence(source: string, dest: string, product: number): PairEvidence | undefined {
        return this.pairs.get(pairKey(source, dest, product));
    }

    /** Pair evidences of every source that serves the destination with the product. */
    evidenceToDest(dest: string, product: number): PairEvidence[] {
        return [...this.pairs.values()].filter((p) => p.dest === dest && p.product === product);
    }

    /** All pair evidences a game route contributes to. */
    pairsOfRoute(routeId: string): PairEvidence[] {
        return this.byRoute.get(routeId) ?? [];
    }

    allPairs(): PairEvidence[] {
        return [...this.pairs.values()];
    }

    minimumStock(island: string, product: number): number | undefined {
        const v = this.data.minimumStock.get(island)?.[String(product)];
        return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
    }

    /** Observed storage samples (history, then the live value) of a product on an island. */
    samples(island: string, product: number): number[] {
        return this.series.get(`${island}|${product}`) ?? [];
    }

    private indexHistory(): void {
        for (const h of this.data.history) {
            if (!isObj(h) || h.kind !== 'storage' || typeof h.island !== 'string' || typeof h.product !== 'number') continue;
            if (!Array.isArray(h.values)) continue;
            const key = `${h.island}|${h.product}`;
            const list = this.series.get(key) ?? [];
            for (const v of h.values) if (typeof v === 'number' && Number.isFinite(v)) list.push(v);
            this.series.set(key, list);
        }
        const live = this.data.live;
        if (live && isObj(live.islands)) {
            for (const [island, goods] of Object.entries(live.islands)) {
                if (!isObj(goods)) continue;
                for (const [guid, entry] of Object.entries(goods)) {
                    const v = isObj(entry) ? entry.storage : undefined;
                    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
                    const key = `${island}|${guid}`;
                    const list = this.series.get(key) ?? [];
                    list.push(v);
                    this.series.set(key, list);
                }
            }
        }
    }

    private build(): void {
        for (const route of this.data.routes) {
            if (!isObj(route)) continue;
            const routeId = String(route.id);
            const ships = shipCount(route);
            const parsed = stopsOf(route);
            const slotAmounts = (parsed?.stops ?? []).flatMap((s) => s.slots.map((sl) => (typeof sl.amount === 'number' ? sl.amount : 0)));
            const slotSize = slotAmounts.length ? Math.max(...slotAmounts) : 0;

            // Group the load-unload pairs by source island, destination island and product.
            // Every source of a product serves every unload slot of a sink, so the unload capacity of a sink belongs to
            // the game route and the destination, not to one source: all groups of a destination share one union of the
            // unload slots and one `capacityKey`.
            type SinkSlots = Map<number, { stop: Stop; amounts: Map<number | string, number> }>;
            const groups = new Map<string, { source: string; dest: string; product: number; sinks: SinkSlots }>();
            const unions = new Map<string, { sinks: SinkSlots; sources: Set<string> }>();
            for (const p of pairsOf(route, this.data.visits)) {
                const key = pairKey(p.source.island, p.sink.island, p.product);
                let g = groups.get(key);
                if (!g) groups.set(key, (g = { source: p.source.island, dest: p.sink.island, product: p.product, sinks: new Map() }));
                const unionKey = `${p.sink.island}|${p.product}`;
                let union = unions.get(unionKey);
                if (!union) unions.set(unionKey, (union = { sinks: new Map(), sources: new Set() }));
                union.sources.add(p.source.island);
                let sink = union.sinks.get(p.sink.index);
                if (!sink) union.sinks.set(p.sink.index, (sink = { stop: p.sink, amounts: new Map() }));
                const amount = typeof p.slot.amount === 'number' && p.slot.amount > 0 ? p.slot.amount : 0;
                sink.amounts.set(p.slot.slot ?? `i${sink.amounts.size}`, amount);
                g.sinks = union.sinks;
            }

            for (const g of groups.values()) {
                const union = unions.get(`${g.dest}|${g.product}`) as { sinks: SinkSlots; sources: Set<string> };
                const ev: RouteEvidence = {
                    routeId,
                    routeName: typeof route.name === 'string' ? route.name : routeId,
                    gapCount: 0,
                    relay: false,
                    ships,
                    capacityKey: `${routeId}|${g.dest}|${g.product}`,
                    sources: union.sources.size,
                };
                const stops = [...g.sinks.values()];
                const totals = stops.map((s) => [...s.amounts.values()].reduce((a, b) => a + b, 0));
                // The same island at several stops: the outcome must not differ between the mappings (AE3).
                if (totals.some((t) => !sameNumber(t, totals[0]))) ev.reason = 'ambiguous';
                // Stops of the route at the destination island that unload the product, whichever source serves them.
                // Visits carry no station index, so with n such stops the gap between two visits of the same stop is the
                // sum of n consecutive inter-visit gaps.
                const destStops = (parsed?.stops ?? []).filter((s) => s.island === g.dest && s.slots.some((sl) => sl.product === g.product && sl.mode === 'unload'));
                const destTotals = destStops.map((s) => s.slots.filter((sl) => sl.product === g.product && sl.mode === 'unload').reduce((a, sl) => a + (typeof sl.amount === 'number' ? sl.amount : 0), 0));
                if (destTotals.some((t) => !sameNumber(t, destTotals[0]))) ev.reason = 'ambiguous';
                const perCircuit = Math.max(1, destStops.length);
                ev.relay = stops.some((s) => s.stop.slots.some((sl) => sl.product === g.product && sl.mode === 'load'));

                if (!ev.reason) {
                    if (ships <= 0) ev.reason = 'no-ships';
                    else {
                        const stop = stops[0].stop;
                        const unloadAtStop = stop.slots.filter((sl) => sl.mode === 'unload').reduce((a, sl) => a + (typeof sl.amount === 'number' ? sl.amount : 0), 0);
                        const cap = shipCapacity(route, unloadAtStop, totals[0], slotSize);
                        if (cap === undefined) ev.reason = 'ship';
                        // Every stop of the route at the destination is visited once per circuit; the gap below is the circuit gap.
                        else ev.capacity = cap * stops.length;
                    }
                }

                const visits = this.data.visits.filter((v) => isObj(v) && String(v.route) === routeId && v.island === g.dest);
                const clocks = new Set(visits.map((v) => String(v.clock ?? 'game')));
                if (clocks.size > 1) ev.reason = ev.reason ?? 'clock';
                const times = [...new Set(visits.map((v) => v.time).filter((t): t is number => typeof t === 'number' && Number.isFinite(t)))].sort((a, b) => a - b);
                const gaps: number[] = [];
                for (let i = 1; i < times.length; i++) gaps.push((times[i] - times[i - 1]) / MS_PER_MINUTE);
                const windows: number[] = [];
                for (let i = 0; i + perCircuit <= gaps.length; i++) windows.push(gaps.slice(i, i + perCircuit).reduce((a, b) => a + b, 0));
                ev.gapCount = windows.length;
                if (windows.length >= MIN_GAPS) ev.gapMinutes = Math.max(...windows.slice(-GAP_WINDOW));
                else ev.reason = ev.reason ?? 'gaps';

                // Visit goods are net amounts (R8). A stop that only unloads gives the unload directly. A stop that also
                // loads the product gives a lower bound of the unload, usable only while no recorded visit netted
                // negative; the indicator then says so.
                const nets = visits
                    .map((v) => (isObj(v.goods) ? (v.goods as Record<string, unknown>)[String(g.product)] : undefined))
                    .filter((n): n is number => typeof n === 'number');
                const positive = nets.filter((n) => n > 0);
                if (positive.length && (!ev.relay || nets.every((n) => n >= 0))) {
                    ev.actualUnload = positive.reduce((a, b) => a + b, 0) / positive.length;
                    ev.netOnly = ev.relay;
                    // Delivered tons per minute over the visit window (mean unload per visit times visits per minute).
                    const span = times.length > 1 ? (times[times.length - 1] - times[0]) / MS_PER_MINUTE : 0;
                    if (span > 0) ev.deliveredPerMin = (ev.actualUnload * (times.length - 1)) / span;
                }

                const key = pairKey(g.source, g.dest, g.product);
                let pe = this.pairs.get(key);
                if (!pe) this.pairs.set(key, (pe = { key, source: g.source, dest: g.dest, product: g.product, routes: [] }));
                pe.routes.push(ev);
                const list = this.byRoute.get(routeId) ?? [];
                list.push(pe);
                this.byRoute.set(routeId, list);
            }
        }
    }
}

// ---- Indicators ----

export interface RouteIndicators {
    available: boolean;
    reason?: Reason;
    /** Tons that must be unloaded per visit: rate times the longest observed gap. */
    requiredOffload?: number;
    /** Tons per visit the matched game routes can unload (combined). */
    capacity?: number;
    /** Ships of the matched game routes (combined, each route counted once). */
    ships?: number;
    /** Required offload over capacity, percent. */
    utilization?: number | undefined;
    /** Mean unload per recorded visit, when it can be told from the net amounts. */
    actualUnload?: number;
    gapMinutes?: number;
    /** `actualUnload` is the net of a stop that also loads the product (lower bound of the unload). */
    unloadIsNet?: boolean;
    /** Red was suppressed: storage is not falling and the recorded deliveries cover the calculated rate. */
    supplied?: boolean;
    gameRoutes: number;
    red: boolean;
    /** Yellow state: the minimum stock of a loading station, or an observed empty storage. */
    yellow?: 'minimumStock' | 'pool' | 'storage';
    /** Pool above the minimum stock and the tons that must be loaded at the source (yellow `pool`/`minimumStock`). */
    stock?: { minimum: number; pool?: number; load?: number };
    /** Names of other routes that load the same good at the source (yellow `pool`). */
    competing: string[];
}

export interface IndicatorInput {
    analysis: RouteAnalysis;
    source: string | undefined;
    dest: string | undefined;
    product: number;
    rate: number;
    /** Other calculator routes loading the product at the same source island: label and rate. */
    siblings: { label: string; rate: number }[];
    /** Rates of every calculator route that supplies the destination with the product, this one included. */
    destRates: number[];
}

const NONE: RouteIndicators = { available: false, reason: 'no-evidence', gameRoutes: 0, red: false, competing: [] };

export function computeIndicators(input: IndicatorInput): RouteIndicators {
    const { analysis, source, dest, product, rate } = input;
    if (!source || !dest) return { ...NONE };
    const ev = analysis.evidence(source, dest, product);
    if (!ev || ev.routes.length === 0) return { ...NONE };

    // Every game route that serves the destination with the product is combined before the red state is decided (R10),
    // whichever source island it loads at.
    // Sources of one game route share its unload slots: each game route counts once.
    const byKey = new Map<string, RouteEvidence>();
    for (const r of analysis.evidenceToDest(dest, product).flatMap((p) => p.routes)) if (!byKey.has(r.capacityKey)) byKey.set(r.capacityKey, r);
    const served = [...byKey.values()];
    const bad = served.find((r) => r.reason);
    if (bad) return { ...NONE, reason: bad.reason as Reason, gameRoutes: ev.routes.length };

    const gap = Math.max(...served.map((r) => r.gapMinutes as number));
    // A relay stop that also loads the product ends every visit at its minimum stock: the island keeps at most that
    // much, so the minimum caps what one visit contributes (KTD9).
    const relayMin = analysis.minimumStock(dest, product);
    const capacity = served.reduce((a, r) => {
        const c = r.capacity as number;
        return a + (r.relay && relayMin !== undefined ? Math.min(c, relayMin * Math.max(1, r.ships)) : c);
    }, 0);
    const required = Math.max(0, rate) * gap;
    const totalRequired = input.destRates.reduce((a, r) => a + Math.max(0, r), 0) * gap;
    const ind: RouteIndicators = {
        available: true,
        requiredOffload: required,
        capacity,
        ships: served.reduce((a, r) => a + r.ships, 0),
        utilization: capacity > 0 ? (totalRequired / capacity) * 100 : undefined,
        gapMinutes: gap,
        gameRoutes: ev.routes.length,
        red: capacity > 0 ? totalRequired > capacity + EPS : totalRequired > EPS,
        competing: [],
    };
    // The recorded unload is the total at the destination; with several sources it is not this route's share.
    const unloads = ev.routes.map((r) => (r.sources > 1 ? undefined : r.actualUnload));
    if (unloads.every((u) => u !== undefined)) ind.actualUnload = (unloads as number[]).reduce((a, b) => a + b, 0);
    if (ind.actualUnload !== undefined && ev.routes.some((r) => r.netOnly)) ind.unloadIsNet = true;

    // Red is dropped when the game evidently supplies the destination: storage never empty and not falling, and the
    // recorded deliveries reach at least 80 percent of the calculated rate into the destination. The rate is then
    // overstated (for example production halted by full storage at the source), not the capacity too small.
    if (ind.red) {
        const delivered = served.every((r) => r.deliveredPerMin !== undefined) ? served.reduce((a, r) => a + (r.deliveredPerMin as number), 0) : undefined;
        const totalRate = input.destRates.reduce((a, r) => a + Math.max(0, r), 0);
        const samples = analysis.samples(dest, product);
        if (delivered !== undefined && totalRate > EPS && samples.length >= 6 && Math.min(...samples) > EPS) {
            const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
            const head = mean(samples.slice(0, 3));
            const tail = mean(samples.slice(-3));
            if (delivered >= 0.8 * totalRate && tail >= 0.98 * head) {
                ind.red = false;
                ind.supplied = true;
            }
        }
    }

    // Yellow (a): minimum stock limits loading only (KTD9).
    const destMin = ev.routes.some((r) => r.relay) ? analysis.minimumStock(dest, product) : undefined;
    const srcMin = analysis.minimumStock(source, product);
    if (destMin !== undefined && destMin + EPS < required) {
        ind.yellow = 'minimumStock';
        ind.stock = { minimum: destMin, load: required };
    } else if (srcMin !== undefined) {
        const samples = analysis.samples(source, product);
        if (samples.length > 0) {
            const pool = Math.max(0, Math.max(...samples) - srcMin);
            const combined = required + input.siblings.reduce((a, s) => a + Math.max(0, s.rate) * gap, 0);
            if (combined > pool + EPS) {
                ind.yellow = 'pool';
                ind.stock = { minimum: srcMin, pool, load: combined };
                ind.competing = input.siblings.map((s) => s.label);
            }
        }
    }

    // Yellow (b): storage dropped to zero and too few goods were unloaded.
    if (!ind.yellow && ind.actualUnload !== undefined && required > EPS) {
        const samples = analysis.samples(dest, product);
        if (samples.some((v) => v <= EPS) && ind.actualUnload + EPS < required) ind.yellow = 'storage';
    }
    return ind;
}
