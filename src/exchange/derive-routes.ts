// Supplier sets derived from savegame route data (R18, KTD7). Pure: no storage, no DOM.
//
// Implements the candidate trade derivation of the format specification (spec/format.md, "Candidate trade derivation"):
// per route with ships and per product a station is a source (loads, never unloads), a sink (unloads) or a relay (does
// both, counted as a sink). Every unload slot is served by every source of the product; sources that load the same
// slot index serve it, else all sources do. The weight of a (sink, supplier) pair is the unloaded amount divided by the
// number of serving sources, times the ship count; a supplier's share is its weight over the sum for the island and
// product. The share only provisionally picks the residual (default) supplier, the largest share, ties by the smallest
// island id (R54): the amounts and the final default come from the allocation after the import (src/trade-allocation.ts).
// The result carries no amounts.
//
// `hasShipRoutes` is the single place that decides whether the re-calculation toggle has an effect (OQ3): the file's
// `trade.routes` hold at least one route with at least one ship. No source signal is read.

import { RouteSlot, RouteStation, Supplier, Trade, TradeImport, TradeRoute } from "./types";

function isObj(v: unknown): v is Record<string, unknown> {
    return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Ships of a route: the sum of `count` of its ship entries (an entry without `count` is one ship).
export function shipCount(route: TradeRoute): number {
    if (!Array.isArray(route.ships)) return 0;
    let total = 0;
    for (const s of route.ships) {
        if (!isObj(s)) continue;
        const c = typeof s.count === "number" && Number.isFinite(s.count) ? s.count : 1;
        if (c > 0) total += c;
    }
    return total;
}

export function hasShipRoutes(doc: { trade?: Pick<Trade, "routes"> }): boolean {
    const routes = doc.trade?.routes;
    return Array.isArray(routes) && routes.some((r) => isObj(r) && shipCount(r) > 0);
}

export interface Stop {
    index: number;
    island: string;
    slots: RouteSlot[];
}

export function stopsOf(route: TradeRoute): { stops: Stop[]; length: number } | undefined {
    if (!Array.isArray(route.stations)) return undefined;
    const stops: Stop[] = [];
    route.stations.forEach((st: RouteStation, index) => {
        if (!isObj(st) || typeof st.island !== "string") return; // a station without island id is neither sink nor source
        const slots = Array.isArray(st.slots) ? st.slots.filter((s): s is RouteSlot => isObj(s) && typeof s.product === "number") : [];
        stops.push({ index, island: st.island, slots });
    });
    return { stops, length: route.stations.length };
}

// Net amount of a product the recorded visits name for one route stop; undefined when no visit record exists for the stop.
export function visitNet(visits: Record<string, unknown>[], route: string, island: string, product: number): number | undefined {
    let found = false;
    let net = 0;
    for (const v of visits) {
        if (!isObj(v) || v.route !== route || v.island !== island) continue;
        found = true;
        const goods = isObj(v.goods) ? v.goods : {};
        const n = goods[String(product)];
        if (typeof n === "number" && Number.isFinite(n)) net += n;
    }
    return found ? net : undefined;
}

interface Pair {
    island: string;
    product: number;
    weights: Map<string, number>;
}

export interface StopPair {
    product: number;
    sink: Stop;
    source: Stop;
    slot: RouteSlot;
    /** Number of source islands serving this unload slot. */
    servers: number;
}

// Load-to-unload pairs of one route: every source of the product serves each unload slot of a sink, so a route that
// collects a good at several islands yields one pair per source. Sources that load the same slot index serve the slot;
// when none does, all sources of the product serve it. `servers` is the number of sources serving the slot.
export function pairsOf(route: TradeRoute, visits: Record<string, unknown>[] = []): StopPair[] {
    const out: StopPair[] = [];
    const parsed = stopsOf(route);
    if (!parsed || parsed.stops.length === 0) return out;
    const { stops } = parsed;
    const routeId = typeof route.id === "string" ? route.id : "";

    const products = new Set<number>();
    for (const s of stops) for (const sl of s.slots) products.add(sl.product);

    for (const product of products) {
        const handlers = stops.filter((s) => s.slots.some((sl) => sl.product === product && (sl.mode === "load" || sl.mode === "unload")));
        const loads = (s: Stop): RouteSlot[] => s.slots.filter((sl) => sl.product === product && sl.mode === "load");
        const unloads = (s: Stop): RouteSlot[] => s.slots.filter((sl) => sl.product === product && sl.mode === "unload");

        const sources: Stop[] = [];
        const sinks: Stop[] = [];
        const everyStopBoth = handlers.length > 0 && handlers.every((s) => loads(s).length > 0 && unloads(s).length > 0);
        for (const s of handlers) {
            if (everyStopBoth) {
                // Roles that slot modes cannot tell come from the signs of the recorded net amounts.
                const net = visitNet(visits, routeId, s.island, product);
                if (net !== undefined && net > 0) sinks.push(s);
                else if (net !== undefined && net < 0) sources.push(s);
                continue;
            }
            const hasLoad = loads(s).length > 0;
            const hasUnload = unloads(s).length > 0;
            if (hasLoad && !hasUnload) {
                sources.push(s);
            } else if (hasUnload) {
                // A relay passes goods on and is no supplier. When its recorded visits name no net amount of the
                // product it is a pure relay and gets no entry.
                if (hasLoad) {
                    const net = visitNet(visits, routeId, s.island, product);
                    if (net !== undefined && net === 0) continue;
                }
                sinks.push(s);
            }
        }
        if (sources.length === 0) continue;

        for (const sink of sinks) {
            for (const slot of unloads(sink)) {
                const wanted = typeof slot.slot === "number" ? slot.slot : undefined;
                const candidates = sources.filter((src) => src !== sink && src.island !== sink.island);
                if (candidates.length === 0) continue;
                const sameSlot = wanted === undefined ? [] : candidates.filter((src) => loads(src).some((l) => l.slot === wanted));
                const pool = sameSlot.length > 0 ? sameSlot : candidates;
                // One pair per source island: a source visited at several stops is one supplier.
                const islands = new Set<string>();
                const servers = pool.filter((src) => !islands.has(src.island) && islands.add(src.island));
                for (const source of servers) out.push({ product, sink, source, slot, servers: servers.length });
            }
        }
    }
    return out;
}

export function deriveImports(routes: TradeRoute[], visits: Record<string, unknown>[] = []): TradeImport[] {
    const pairs = new Map<string, Pair>();

    for (const route of routes) {
        if (!isObj(route)) continue;
        const ships = shipCount(route);
        if (ships <= 0) continue;
        for (const { product, sink, source, slot, servers } of pairsOf(route, visits)) {
            const amount = (typeof slot.amount === "number" && Number.isFinite(slot.amount) && slot.amount > 0 ? slot.amount : 1) / Math.max(1, servers);
            const key = `${sink.island}|${product}`;
            let pair = pairs.get(key);
            if (!pair) pairs.set(key, (pair = { island: sink.island, product, weights: new Map() }));
            pair.weights.set(source.island, (pair.weights.get(source.island) ?? 0) + amount * ships);
        }
    }

    const out: TradeImport[] = [];
    for (const pair of pairs.values()) {
        let sum = 0;
        for (const w of pair.weights.values()) sum += w;
        if (sum <= 0) continue;
        const suppliers: Supplier[] = [...pair.weights].map(([island, w]) => ({ island, share: w / sum }));
        let top = suppliers[0];
        for (const s of suppliers) {
            const a = s.share as number;
            const b = top.share as number;
            if (a > b + 1e-12 || (Math.abs(a - b) <= 1e-12 && (s.island as string) < (top.island as string))) top = s;
        }
        top.default = true;
        out.push({ island: pair.island, product: pair.product, basis: "planned", suppliers });
    }
    return out;
}
