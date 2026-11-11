import type { Island } from "../world";
import type { Computed, ComputedIsland } from "./types";

// U11: the informational `computed` block (R17). computeSummary reads the island's computed observables at export
// time; compareComputed compares the file's block with the calculator's own after an import.

const EPS = 1e-9;

// A difference counts when it exceeds 1 % of the value or 0.1 units, whichever is larger (R17).
export const RELATIVE_TOLERANCE = 0.01;
export const ABSOLUTE_TOLERANCE = 0.1;

export type ComputedQuantity = "residents" | "buildingsRequired" | "imports";
const QUANTITIES: ComputedQuantity[] = ["residents", "buildingsRequired", "imports"];

export interface ComputedDifference {
    island: string; // island name as shown to the user
    quantity: ComputedQuantity;
    key: string; // GUID key of the level, factory or product
    label: string; // display name of the level, factory or product (the key when unknown)
    fileValue: number;
    calculatorValue: number;
}

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

    // Goods received over trade routes (the import of the island), t/min.
    const imports: Record<string, number> = {};
    for (const product of island.products) {
        const list = product.tradeList;
        if (!list) continue;
        const v = list.outputAmount();
        if (finite(v) && v > EPS) imports[String(product.guid)] = v;
    }

    return { residents, buildingsRequired, imports };
}

export function computeSummary(): Computed {
    const islands: Record<string, ComputedIsland> = {};
    for (const island of realIslands()) islands[island.exchangeIslandId] = islandSummary(island);
    return { islands };
}

export function exceedsTolerance(fileValue: number, calculatorValue: number): boolean {
    const allowed = Math.max(RELATIVE_TOLERANCE * Math.abs(fileValue), ABSOLUTE_TOLERANCE);
    return Math.abs(fileValue - calculatorValue) > allowed;
}

function labelOf(island: Island, key: string): string {
    const asset = island.assetsMap.get(Number(key)) as { name?: () => string } | undefined;
    const name = asset && typeof asset.name === "function" ? asset.name() : "";
    return name || key;
}

// Pure comparison of the file's block with the calculator's own summary. Quantities or islands the file lacks, or
// the calculator does not know, are skipped; a good absent on one side counts as 0.
export function compareComputed(file: Computed, own: Computed, island: (id: string) => Island | undefined): ComputedDifference[] {
    const out: ComputedDifference[] = [];
    const fileIslands = file.islands && typeof file.islands === "object" ? file.islands : {};
    for (const id of Object.keys(fileIslands)) {
        const theirs = fileIslands[id];
        const mine = own.islands ? own.islands[id] : undefined;
        const target = island(id);
        if (!theirs || typeof theirs !== "object" || !mine || !target) continue;
        for (const quantity of QUANTITIES) {
            const f = theirs[quantity];
            if (!f || typeof f !== "object") continue;
            const m = (mine[quantity] ?? {}) as Record<string, number>;
            for (const key of Object.keys(f)) {
                const fileValue = f[key];
                if (!finite(fileValue)) continue;
                const calculatorValue = finite(m[key]) ? m[key] : 0;
                if (exceedsTolerance(fileValue, calculatorValue))
                    out.push({ island: target.name(), quantity, key, label: labelOf(target, key), fileValue, calculatorValue });
            }
        }
    }
    return out;
}

// Compares the hand-off in sessionStorage with the calculator's results and removes the key. Returns the differences;
// a missing or unreadable hand-off yields none.
export function compareHandOff(storage: Pick<Storage, "getItem" | "removeItem">, key: string): ComputedDifference[] {
    let text: string | null = null;
    try {
        text = storage.getItem(key);
        storage.removeItem(key);
    } catch {
        return [];
    }
    if (!text) return [];
    let file: Computed;
    try {
        file = JSON.parse(text) as Computed;
    } catch {
        return [];
    }
    const islands = realIslands();
    return compareComputed(file, computeSummary(), (id) => islands.find((i) => i.exchangeIslandId === id));
}
