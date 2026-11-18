// Allocation of one destination's demand across several supplying islands (one-shot after an import, and on request).
//
// An imported game route that collects a good at several islands yields one calculator route per source. Only one of
// them can be the default supplier (it covers whatever the others do not); the others need fixed amounts (floors,
// `TradeRoute.userSetAmount`). The floors come from what each source can give:
//   surplus = max(0, built capacity of the product on the source - the source's own demand without routes)
// - supply covers demand (sum of surplus >= demand): every non-default source gets demand * surplus / sum of surplus,
//   the default (largest surplus) is the residual and carries its own share;
// - demand exceeds supply: every non-default source gets its full surplus, the default (largest surplus) absorbs the
//   shortfall, which the source-production indicator then shows.
// Ties in the surplus keep the current default, then go to the alphabetically first island name; a source that would
// close a cycle of default suppliers is skipped as default. The surplus does not depend on the export routes, so the allocation does not feed
// back into itself.

import type { Factory } from './factories';
import type { Product } from './production';
import type { TradeRoute } from './trade';

export interface ShareSource {
    key: string;
    /** Tons per minute the source can give to this destination. */
    surplus: number;
}

export interface ShareResult {
    key: string;
    /** Fixed amount (t/min) of a non-default route; 0 for the default. */
    floor: number;
    isDefault: boolean;
}

const EPS = 1e-9;

/** `canBeDefault` excludes sources that must not become the default supplier (a cycle); the first allowed source wins. */
export function allocateShares(
    demand: number,
    sources: ShareSource[],
    canBeDefault: (key: string) => boolean = () => true,
    preferred?: string,
    keepPreferred = false,
): ShareResult[] {
    // Equal surplus keeps the preferred (current) default, then the alphabetically first island.
    const rank = (k: string): number => (k === preferred ? 0 : 1);
    const sorted = [...sources].sort((a, b) => b.surplus - a.surplus || rank(a.key) - rank(b.key) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    const total = sorted.reduce((sum, s) => sum + Math.max(0, s.surplus), 0);
    const need = Math.max(0, demand);
    // keepPreferred: the default supplier stays where the user put it; only the floors of the others follow the surplus.
    const kept = keepPreferred ? sorted.find((s) => s.key === preferred && canBeDefault(s.key)) : undefined;
    const top = kept ?? sorted.find((s) => canBeDefault(s.key)) ?? sorted[0];
    return sorted.map((s) => {
        if (s === top) return { key: s.key, floor: 0, isDefault: true };
        const surplus = Math.max(0, s.surplus);
        const floor = total <= EPS ? 0 : total >= need ? (need * surplus) / total : surplus;
        return { key: s.key, floor, isDefault: false };
    });
}

/**
 * What an island can supply of the product in t/min without any trade: the built capacity of its factories
 * (constructed buildings, boost and extra-good factor) plus the output of its extra-good suppliers. Demand plays no part.
 */
export function builtCapacity(product: Product): number {
    let sum = 0;
    for (const f of product.factories as Factory[]) {
        if (!f.available()) continue;
        sum += (f.buildings.constructed() * f.boost() * 60 * f.extraGoodFactor()) / f.cycleTime;
    }
    for (const s of product.availableSuppliers()) if (s.type === 'extra_good') sum += s.currentProduction();
    return sum;
}

export interface SharesOptions {
    /** Leave groups alone that carry a floor set by hand (a group is untouched while every route floor is 0). */
    untouchedOnly: boolean;
    /** Keep the current default supplier of every group and update only the floors of the other routes. */
    keepDefault?: boolean;
}

/** Groups of two or more island routes into one destination and product, keyed by the destination's product. */
function groupsOf(routes: TradeRoute[], minSize = 2): Map<Product, TradeRoute[]> {
    const groups = new Map<Product, TradeRoute[]>();
    for (const r of routes) {
        if (!r.active() || r.from.isAllIslands() || r.to.isAllIslands()) continue;
        const list = groups.get(r.toIslandProduct) ?? [];
        list.push(r);
        groups.set(r.toIslandProduct, list);
    }
    for (const [p, list] of groups) if (list.length < minSize) groups.delete(p);
    return groups;
}

/**
 * The default supplier is a built factory of the destination: the routes only cover what its built capacity cannot, as
 * fixed amounts split by the surplus of their sources. Returns whether a group was touched.
 */
function setFactoryFloors(dest: Product, group: TradeRoute[], factory: Factory, options: SharesOptions): boolean {
    if (factory.buildings.constructed() <= 0) return false;
    if (options.untouchedOnly && group.some((r) => r.userSetAmount() > 0)) return false;
    const capacity = (factory.buildings.constructed() * factory.boost() * 60 * factory.extraGoodFactor()) / factory.cycleTime;
    const others = dest.totalCurrentProduction() - factory.currentProduction() - group.reduce((sum, r) => sum + r.currentProduction(), 0);
    const need = Math.max(0, dest.totalDemand() - others - capacity);
    const surplus = group.map((r) => Math.max(0, builtCapacity(r.fromIslandProduct) - r.fromIslandProduct.totalDemandNoRoutes()));
    const total = surplus.reduce((a, b) => a + b, 0);
    group.forEach((r, i) => {
        const floor = total <= EPS ? 0 : total <= need ? surplus[i] : (need * surplus[i]) / total;
        r.userSetAmount(floor);
        r.setDemand(floor);
    });
    return true;
}

/**
 * Sets the floors and the default supplier of every multi-source group whose default supplier is one of its routes.
 * Returns the number of groups changed. A group whose default supplier is a factory or passive trade is a hand-made
 * structure and stays as it is.
 */
export function recomputeShares(routes: TradeRoute[], options: SharesOptions): number {
    let changed = 0;
    for (const [dest, group] of groupsOf(routes, 1)) {
        const supplier = dest.defaultSupplier();
        if (supplier && supplier.type === 'factory') {
            if (setFactoryFloors(dest, group, supplier as Factory, options)) changed++;
            continue;
        }
        const current = supplier as TradeRoute | null;
        if (group.length < 2 || !current || !group.includes(current)) continue;
        if (options.untouchedOnly && group.some((r) => r.userSetAmount() > 0)) continue;

        const others = dest.totalCurrentProduction() - group.reduce((sum, r) => sum + r.currentProduction(), 0);
        const demand = Math.max(0, dest.totalDemand() - others);
        const byName = new Map(group.map((r) => [r.from.name(), r]));
        const sources = group.map((r) => ({
            key: r.from.name(),
            surplus: Math.max(0, builtCapacity(r.fromIslandProduct) - r.fromIslandProduct.totalDemandNoRoutes()),
        }));
        const result = allocateShares(demand, sources, (key) => !(byName.get(key) as TradeRoute).fromIslandProduct.isSuppliedFrom(dest), current.from.name(), options.keepDefault === true);
        const next = byName.get(result.find((x) => x.isDefault)?.key as string) as TradeRoute;

        if (next !== current) {
            // The previous default is deleted when it loses the role with floor 0; a floor keeps it for the swap.
            const keep = current.userSetAmount();
            current.userSetAmount(keep > 0 ? keep : 1);
            next.setAsDefaultSupplier();
        }
        for (const x of result) {
            const route = byName.get(x.key) as TradeRoute;
            route.userSetAmount(x.floor);
            if (!x.isDefault) route.setDemand(x.floor);
        }
        changed++;
    }
    return changed;
}
