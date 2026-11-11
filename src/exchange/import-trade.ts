// Import plan for trade and suppliers (U6): `trade.imports` -> `tradeRoutes` entries and default supplier keys,
// preserved parts (routes, visits, governor suppliers, harbours, minimum stock, original import entries) and report
// lines. Pure: no storage, no DOM (KTD1). Runs after planIslands, because `from`/`to` are the final unique island names.
//
// Stored route shape (src/trade.ts TradeRouteConfig): {productGUID, from, to, userSetAmount, isDefaultSupplier},
// `from` supplies `to`. The residual-supplier contract is KTD9 / R54, the local producer rule R51, the degradation
// of suppliers the calculator does not model R52, the precedence of `imports` over `routes` R49.

import * as keys from "./keys";
import {
    AbsentGuidEntry,
    ImportContext,
    IslandPlan,
    IslandsPlan,
    PreservedImport,
    PreservedImportReason,
    ReadOk,
    ReportEntry,
    ReportKind,
    StoredTradeRoute,
    Supplier,
    TradeImport,
    TradePlan,
    TradeRoute,
} from "./types";

type SupplierKind = "island" | "governor" | "unavailable" | "self";

interface Classified {
    s: Supplier;
    kind: SupplierKind;
}

// Value the default supplier keys hold for a degraded (non-player) supplier: world.ts:1138.
const PASSIVE_TYPE = "passive_trade";
const PASSIVE_ID = "passive";

function seg(key: string): string {
    return key.replace(/~/g, "~0").replace(/\//g, "~1");
}

function amountOf(s: Supplier): number {
    return typeof s.amount === "number" && Number.isFinite(s.amount) && s.amount > 0 ? s.amount : 0;
}

class TradePlanner {
    private readonly byId = new Map<string, IslandPlan>();
    private readonly products = new Set<number>();
    private readonly factoriesOf = new Map<number, number[]>();
    private readonly routes: StoredTradeRoute[] = [];
    private readonly routeKeys = new Set<string>();
    // product -> receiving island key -> supplying island key, for default routes only
    private readonly defaults = new Map<number, Map<string, string>>();
    private readonly result: TradePlan = { tradeRoutes: this.routes, islands: {}, document: { preservedImports: [] }, report: [] };
    private readonly pending: { island: IslandPlan; kept: PreservedImport }[] = [];
    private readonly utilized = new Set<string>();

    constructor(
        private readonly plan: IslandsPlan,
        private readonly read: ReadOk,
        ctx: ImportContext,
    ) {
        for (const isl of plan.islands) {
            this.byId.set(isl.id, isl);
            this.result.islands[isl.key] = { store: {}, ext: { preservedImports: [], guids: [] } };
        }
        for (const p of ctx.params.products) this.products.add(p.guid);
        for (const f of ctx.params.factories) {
            for (const o of f.outputs) {
                const list = this.factoriesOf.get(o.product) ?? [];
                if (!list.includes(f.guid)) list.push(f.guid);
                this.factoriesOf.set(o.product, list);
            }
        }
    }

    private add(kind: ReportKind, code: string, message: string, island?: string, detail?: Record<string, unknown>): void {
        const e: ReportEntry = { kind, code, message };
        if (island !== undefined) e.island = island;
        if (detail) e.detail = detail;
        this.result.report.push(e);
    }

    run(): TradePlan {
        for (const isl of this.plan.islands) this.minimumStock(isl);
        for (const isl of this.plan.islands) this.products_(isl);
        const trade = this.read.doc.trade;
        const imports = trade?.imports;
        (imports ?? []).forEach((e) => this.processImport(e));
        this.routeReport();
        this.finish();
        return this.result;
    }

    // ---- island-scope parts ----

    private minimumStock(isl: IslandPlan): void {
        const stock = isl.file.minimumStock;
        if (stock === undefined) return;
        this.result.islands[isl.key].ext.minimumStock = stock;
        const n = Object.keys(stock).length;
        if (n > 0) this.add("carried-through", "minimum-stock", `Minimum stock of ${n} goods is kept unchanged; the calculator does not apply it.`, isl.id, { goods: n });
    }

    // products[p].producer -> `<p>.defaultSupplier.type/.id` (KTD13), notes -> `<p>.notes`.
    private products_(isl: IslandPlan): void {
        const out = this.result.islands[isl.key];
        const entries = isl.file.products ?? {};
        for (const key of Object.keys(entries)) {
            const g = parseInt(key, 10);
            const entry = entries[key];
            if (!this.products.has(g)) {
                const kept: AbsentGuidEntry = { pointer: `/products/${seg(key)}`, value: entry };
                out.ext.guids.push(kept);
                this.add("carried-through", "unknown-guid", `Product ${g} is not in the calculator's data; kept and written back on export.`, isl.id, { pointer: kept.pointer, guid: g });
                continue;
            }
            if (entry.notes !== undefined) out.store[keys.productNotes(g)] = entry.notes;
            const producer = entry.producer;
            if (producer === undefined) continue;
            if (producer === "none") {
                out.store[keys.defaultSupplierType(g)] = "null";
                out.store[keys.defaultSupplierId(g)] = "null";
            } else if ((this.factoriesOf.get(g) ?? []).includes(producer)) {
                out.store[keys.defaultSupplierType(g)] = "factory";
                out.store[keys.defaultSupplierId(g)] = String(producer);
            } else {
                const pointer = `/products/${seg(key)}/producer`;
                out.ext.guids.push({ pointer, value: producer });
                this.add("carried-through", "unknown-guid", `Producer ${producer} of product ${g} is not a factory of that product in the calculator's data; kept and written back on export.`, isl.id, {
                    pointer,
                    guid: producer,
                });
            }
        }
    }

    // ---- imports ----

    private preserve(receiver: IslandPlan | undefined, entry: TradeImport, reasons: PreservedImportReason[], preserved: Supplier[]): PreservedImport {
        const kept: PreservedImport = {
            reasons,
            entry,
            preserved,
            restore: {
                island: receiver ? receiver.key : entry.island,
                product: entry.product,
                routes: [],
                defaultSupplier: null,
                passiveUserSetAmount: 0,
            },
        };
        if (receiver) {
            this.result.islands[receiver.key].ext.preservedImports.push(kept);
            this.pending.push({ island: receiver, kept });
        } else {
            this.result.document.preservedImports.push(kept);
        }
        return kept;
    }

    private classify(receiver: IslandPlan, s: Supplier): Classified {
        if (typeof s.governor === "number" && s.island === undefined) return { s, kind: "governor" };
        if (typeof s.island !== "string") return { s, kind: "unavailable" };
        if (s.island === receiver.id) return { s, kind: "self" };
        return { s, kind: this.byId.has(s.island) ? "island" : "unavailable" };
    }

    private processImport(e: TradeImport): void {
        const receiver = this.byId.get(e.island);
        if (!this.products.has(e.product)) {
            this.preserve(receiver, e, ["unknown-product"], []);
            this.add("carried-through", "unknown-guid", `Product ${e.product} of an import entry is not in the calculator's data; the entry is kept.`, e.island, { product: e.product });
            return;
        }
        if (!receiver) {
            this.preserve(undefined, e, ["receiver-unavailable"], []);
            this.add("not-mapped", "import-receiver-unavailable", `Island ${e.island} has no store in the calculator; its import of product ${e.product} is kept and written back on export.`, e.island, {
                product: e.product,
            });
            return;
        }
        const suppliers = Array.isArray(e.suppliers) ? e.suppliers : [];
        if (suppliers.length === 0) return;

        const cls = suppliers.map((s) => this.classify(receiver, s));
        const flagged = cls.filter((c) => c.s.default === true);
        if (flagged.length > 1) {
            this.preserve(receiver, e, ["ambiguous-default"], []);
            this.add("not-mapped", "ambiguous-default", `More than one supplier of product ${e.product} on ${receiver.name} is flagged default; the entry is kept and nothing is written.`, receiver.id, {
                product: e.product,
                suppliers: flagged.map((c) => c.s),
            });
            return;
        }

        const residual = this.residual(cls, flagged);
        const reasons: PreservedImportReason[] = [];
        const preserved = cls.filter((c) => c.kind !== "island").map((c) => c.s);
        const governors = cls.filter((c) => c.kind === "governor");
        const unavailable = cls.filter((c) => c.kind === "unavailable");
        const selfs = cls.filter((c) => c.kind === "self");
        const islandSuppliers = cls.filter((c) => c.kind === "island");

        if (governors.length) {
            reasons.push("governor-supplier");
            this.add("not-mapped", "governor-supplier", `${governors.length} governor supplier(s) of product ${e.product} on ${receiver.name} are kept and not applied; the calculator models no governor supplier.`, receiver.id, {
                product: e.product,
                governors: governors.map((c) => c.s.governor),
            });
        }
        if (residual && residual.kind === "governor") {
            this.add("not-mapped", "governor-default", `The residual supplier of product ${e.product} on ${receiver.name} is a governor; no default route is written and the product's default supplier is left as it is.`, receiver.id, {
                product: e.product,
                governor: residual.s.governor,
            });
        } else if (residual && residual.kind !== "island") {
            this.add("not-mapped", "residual-not-modelled", `The residual supplier of product ${e.product} on ${receiver.name} is not an island of the file; no default route is written and the product's default supplier is left as it is.`, receiver.id, {
                product: e.product,
                supplier: residual.s,
            });
        }
        if (selfs.length) {
            reasons.push("self-supplier");
            this.add("not-mapped", "self-supplier", `${receiver.name} is listed as its own supplier of product ${e.product}; the supplier is kept and not applied.`, receiver.id, { product: e.product });
        }

        let written = 0;
        let cycle = false;
        for (const c of islandSuppliers) {
            const from = this.byId.get(c.s.island as string) as IslandPlan;
            const routeKey = `${e.product}|${from.key}|${receiver.key}`;
            if (this.routeKeys.has(routeKey)) {
                this.add("not-mapped", "duplicate-import-entry", `${from.name} already supplies product ${e.product} to ${receiver.name}; the repeated supplier is ignored.`, receiver.id, { product: e.product, from: from.id });
                continue;
            }
            let isDefault = residual === c;
            if (isDefault) {
                const demand = this.defaultBlocked(e.product, from.key, receiver.key);
                if (demand === "duplicate") {
                    isDefault = false;
                    this.add("not-mapped", "duplicate-import-entry", `Product ${e.product} on ${receiver.name} already has a default route; ${from.name} is written as an ordinary route.`, receiver.id, {
                        product: e.product,
                        from: from.id,
                    });
                } else if (demand === "cycle") {
                    isDefault = false;
                    cycle = true;
                    this.add("approximated", "default-cycle", `Making ${from.name} the default supplier of product ${e.product} on ${receiver.name} would close a cycle of default routes; it is written as an ordinary route with its amount.`, receiver.id, {
                        product: e.product,
                        from: from.id,
                    });
                }
            }
            this.routeKeys.add(routeKey);
            this.routes.push({ productGUID: e.product, from: from.key, to: receiver.key, userSetAmount: amountOf(c.s), isDefaultSupplier: isDefault });
            if (isDefault) this.setDefault(e.product, from.key, receiver.key);
            written++;
        }
        if (cycle) reasons.push("cycle");

        // Non-player and unknown/orphan islands: passive-trade default when no island supplier remains (R52).
        const out = this.result.islands[receiver.key];
        let degraded = false;
        if (unavailable.length) {
            reasons.push("non-player-supplier");
            if (islandSuppliers.length === 0 && !(residual && residual.kind === "governor")) {
                degraded = true;
                out.store[keys.defaultSupplierType(e.product)] = PASSIVE_TYPE;
                out.store[keys.defaultSupplierId(e.product)] = PASSIVE_ID;
                this.add("approximated", "non-player-passive", `The supplier of product ${e.product} on ${receiver.name} is not an island of the calculator; it becomes the passive-trade default and the original supplier is kept.`, receiver.id, {
                    product: e.product,
                    suppliers: unavailable.map((c) => c.s),
                });
            } else {
                this.add("not-mapped", "non-player-kept", `A supplier of product ${e.product} on ${receiver.name} is not an island of the calculator; it is kept and not applied.`, receiver.id, {
                    product: e.product,
                    suppliers: unavailable.map((c) => c.s),
                });
            }
        }

        if (written > 0 || degraded) this.localProducer(receiver, e.product);
        if (reasons.length) this.preserve(receiver, e, reasons, preserved);
    }

    // The residual supplier of KTD9 / R54.
    private residual(cls: Classified[], flagged: Classified[]): Classified | undefined {
        if (flagged.length === 1) return flagged[0];
        const shared = cls.filter((c) => c.kind !== "governor" && typeof c.s.island === "string" && typeof c.s.share === "number");
        if (shared.length === 0) return undefined;
        shared.sort((a, b) => (b.s.share as number) - (a.s.share as number) || ((a.s.island as string) < (b.s.island as string) ? -1 : (a.s.island as string) > (b.s.island as string) ? 1 : 0));
        return shared[0];
    }

    // Checks whether `from` may become the default supplier of `to` for the product (Product.isSuppliedFrom).
    private defaultBlocked(product: number, from: string, to: string): "ok" | "duplicate" | "cycle" {
        const map = this.defaults.get(product);
        if (map?.has(to)) return "duplicate";
        let cur = from;
        for (let n = 0; n < 1000 && map; n++) {
            const next = map.get(cur);
            if (next === undefined) break;
            if (next === to) return "cycle";
            cur = next;
        }
        return "ok";
    }

    private setDefault(product: number, from: string, to: string): void {
        let map = this.defaults.get(product);
        if (!map) this.defaults.set(product, (map = new Map()));
        map.set(to, from);
    }

    // R51: a built local producer of the product is fully utilized unless the file states otherwise.
    private localProducer(receiver: IslandPlan, product: number): void {
        const buildings = receiver.file.buildings ?? {};
        for (const f of this.factoriesOf.get(product) ?? []) {
            const entry = buildings[String(f)];
            if (!entry || typeof entry.built !== "number" || entry.built <= 0 || entry.fullyUtilize === false) continue;
            this.result.islands[receiver.key].store[keys.buildingsFullyUtilize(f)] = "1";
            const id = `${receiver.key}|${f}`;
            if (this.utilized.has(id)) continue;
            this.utilized.add(id);
            this.add("approximated", "local-producer-utilized", `${receiver.name} builds factory ${f} for product ${product}; it is fully utilized and the import covers the rest of the demand.`, receiver.id, {
                factory: f,
                product,
            });
        }
    }

    // ---- routes, visits, harbours ----

    private routeReport(): void {
        const trade = this.read.doc.trade;
        if (!trade) return;
        const preserved: NonNullable<TradePlan["document"]["trade"]> = {};
        if (trade.routes !== undefined) preserved.routes = trade.routes;
        if (trade.visits !== undefined) preserved.visits = trade.visits;
        if (trade.governorHarbours !== undefined) preserved.governorHarbours = trade.governorHarbours;
        if (Object.keys(preserved).length) this.result.document.trade = preserved;

        const routes = trade.routes ?? [];
        const visits = trade.visits ?? [];
        const harbours = trade.governorHarbours ?? [];
        if (routes.length || visits.length) {
            this.add("carried-through", "routes-preserved", `${routes.length} routes and ${visits.length} visits are kept unchanged; the calculator derives no imports from them.`, undefined, {
                routes: routes.length,
                visits: visits.length,
            });
        }
        if (harbours.length) {
            this.add("carried-through", "governor-harbours", `${harbours.length} governor harbours are kept unchanged and not applied.`, undefined, { harbours: harbours.length });
        }
        if (routes.length === 0) return;

        for (const r of routes) {
            const stations = r.stations ?? [];
            if (!Array.isArray(r.ships) || r.ships.length === 0) {
                this.add("not-mapped", "route-without-ships", `Route ${r.id} has no ships and moves no goods; it produces no import.`, undefined, { route: r.id });
            } else if (!stations.some((s) => typeof s.island === "string")) {
                this.add("not-mapped", "route-non-player-only", `Route ${r.id} serves no island of the file; it produces no import.`, undefined, { route: r.id });
            }
        }
        if (trade.imports === undefined) {
            this.add("not-mapped", "routes-not-derived", `The file has routes and no imports; the calculator does not derive imports from routes, so no route is written.`, undefined, { routes: routes.length });
            return;
        }
        this.disagreement(routes, trade.imports);
    }

    // R49: imports is the plan input. The topology of the routes is compared with the imports only for roles that
    // follow unambiguously from the slot modes (islands that only load or only unload a product on a route).
    private disagreement(routes: TradeRoute[], imports: TradeImport[]): void {
        const importPairs = new Set<string>();
        for (const i of imports) for (const s of i.suppliers ?? []) if (typeof s.island === "string") importPairs.add(`${i.product}|${s.island}|${i.island}`);

        const derived = new Set<string>();
        const touched = new Set<string>(); // product|island served by a route with ships
        const onRoute = new Map<string, Set<string>>(); // product|route index -> islands handling the product
        routes.forEach((r, ri) => {
            if (!Array.isArray(r.ships) || r.ships.length === 0) return;
            const loads = new Map<number, Set<string>>();
            const unloads = new Map<number, Set<string>>();
            for (const st of r.stations ?? []) {
                if (typeof st.island !== "string") continue;
                for (const sl of st.slots ?? []) {
                    const target = sl.mode === "load" ? loads : sl.mode === "unload" ? unloads : undefined;
                    if (!target) continue;
                    const set = target.get(sl.product) ?? new Set<string>();
                    set.add(st.island);
                    target.set(sl.product, set);
                    touched.add(`${sl.product}|${st.island}`);
                    const k = `${sl.product}|${ri}`;
                    const handled = onRoute.get(k) ?? new Set<string>();
                    handled.add(st.island);
                    onRoute.set(k, handled);
                }
            }
            for (const [product, loaders] of loads) {
                const sinks = unloads.get(product) ?? new Set<string>();
                for (const a of loaders) if (!sinks.has(a)) for (const b of sinks) if (!loaders.has(b)) derived.add(`${product}|${a}|${b}`);
            }
        });

        const unconnected: string[] = [];
        for (const pair of importPairs) {
            const [product, supplier, receiver] = pair.split("|");
            let connected = false;
            for (const [k, islands] of onRoute) if (k.startsWith(product + "|") && islands.has(supplier) && islands.has(receiver)) connected = true;
            if (!connected) unconnected.push(pair);
        }
        const missing = [...derived].filter((p) => !importPairs.has(p));
        if (unconnected.length || missing.length) {
            this.add("not-mapped", "routes-imports-disagree", `The routes and the imports of the file disagree; the imports are used (R49).`, undefined, {
                importsWithoutRoute: unconnected,
                routeFlowsWithoutImport: missing,
            });
        }
    }

    // Final route set per preserved entry (CD10) and the default keys that stand after all entries.
    private finish(): void {
        const all = [...this.pending.map((p) => p.kept), ...this.result.document.preservedImports];
        const receivers = new Map<PreservedImport, IslandPlan | undefined>();
        for (const p of this.pending) receivers.set(p.kept, p.island);
        for (const kept of all) {
            const island = receivers.get(kept);
            if (!island) continue;
            kept.restore.routes = this.routes
                .filter((r) => r.productGUID === kept.restore.product && r.to === island.key)
                .map((r) => ({ from: r.from, to: r.to, userSetAmount: r.userSetAmount, isDefaultSupplier: r.isDefaultSupplier }));
            const store = this.result.islands[island.key].store;
            const type = store[keys.defaultSupplierType(kept.restore.product)];
            const id = store[keys.defaultSupplierId(kept.restore.product)];
            kept.restore.defaultSupplier = typeof type === "string" && typeof id === "string" ? { type, id } : null;
        }
    }
}

export function planTrade(islands: IslandsPlan, read: ReadOk, ctx: ImportContext): TradePlan {
    return new TradePlanner(islands, read, ctx).run();
}

