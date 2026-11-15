import type { Island } from "../world";
import type { Computed, ComputedIsland } from "./types";

// The informational `computed` block (R17): computeSummary reads the island's computed observables at export time.

const EPS = 1e-9;

function finite(n: unknown): n is number {
    return typeof n === "number" && Number.isFinite(n);
}

function realIslands(): Island[] {
    const islands: Island[] = window.view.islands();
    return islands.filter((i) => !i.isAllIslands());
}

function islandSummary(island: Island): ComputedIsland {
    const residents: Record<string, number> = {};
    for (const level of island.populationLevels) {
        const v = level.residents();
        if (finite(v)) residents[String(level.guid)] = v;
    }

    const buildingsRequired: Record<string, number> = {};
    for (const factory of island.factories) {
        const v = factory.buildings.required();
        if (finite(v) && v > EPS) buildingsRequired[String(factory.guid)] = v;
    }

    // Goods the island receives from outside, t/min: over trade routes plus passive trade (a good nothing on the island
    // produces is supplied by passive trade).
    const imports: Record<string, number> = {};
    for (const product of island.products) {
        const list = product.tradeList;
        const routes = list ? list.outputAmount() : 0;
        const passive = product.passiveTradeSupplier ? product.passiveTradeSupplier.currentProduction() : 0;
        const governor = product.governorSupply ? product.governorSupply() : 0;
        const v = (finite(routes) ? routes : 0) + (finite(passive) ? passive : 0) + (finite(governor) ? governor : 0);
        if (v > EPS) imports[String(product.guid)] = v;
    }

    return { residents, buildingsRequired, imports };
}

export function computeSummary(): Computed {
    const islands: Record<string, ComputedIsland> = {};
    for (const island of realIslands()) islands[island.exchangeIslandId] = islandSummary(island);
    return { islands };
}
