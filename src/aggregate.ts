import { BuildingsCalc, EPSILON, ko } from './util';

/**
 * Minimal structural shape of an Island needed here. Declared structurally rather than imported
 * from world.ts, because world.ts imports util.ts - importing it back would risk a cycle.
 */
export interface IslandLike {
    isAllIslands(): boolean;
}

/**
 * True when `island` is the All-Islands pseudo-island AND the user has opted into
 * aggregateAllIslands.
 *
 * IMPORTANT: this is a plain function, never a ko.pureComputed. A shared memoized computed is a
 * single node in the dependency graph that notifies every binding at once, which produced a real
 * stale-$data glitch inside `with:` blocks (see templates/AGENTS.md). Called as a function, the
 * dependencies (island() and the setting observable) register in the *calling* binding's own
 * computed - semantically identical to writing the expression inline at each site.
 */
export function isAggregateModeFor(island: IslandLike): boolean {
    return island.isAllIslands() && window.view.settings.aggregateAllIslands.checked();
}

/**
 * isAggregateModeFor for the currently selected island. For template bindings and components that
 * have no presenter in scope. Same "plain function, never a computed" rule.
 */
export function isAggregating(): boolean {
    return isAggregateModeFor(window.view.island());
}

/**
 * Sums a per-island numeric selector across the user's real islands (skipping All-Islands itself).
 * Reads view.islands() live (never cached), so island add/remove reactivity falls out of Knockout's
 * own dependency tracking - no manual invalidation is needed.
 *
 * Generic over the island type so a caller that annotates its selector (`(island: Island) => ...`)
 * gets full member checking on `island`, while callers that don't keep the previous untyped
 * behaviour. `world.ts` is deliberately not imported here - it imports `util.ts`, which would be a
 * cycle risk - so `Island` cannot simply be named as the parameter type.
 */
export function sumAcrossRealIslands<TIsland = any>(selector: (island: TIsland) => number): number {
    let sum = 0;
    for (const island of window.view.islands()) {
        if (island.isAllIslands()) continue;
        sum += +selector(island) || 0;
    }
    return sum;
}

export interface AggregateDemandRow {
    consumer: any;
    module?: any;
    amount: () => number;
}

/**
 * Ordering for the aggregated consumer list in the product-config dialog: residences first (in
 * population-tier order, i.e. the island's own residenceBuildings order), then everything else by
 * localized name, then by descending amount.
 *
 * `indexOf` MUST be keyed on ResidenceBuilding.guid - the previous inline version looked up
 * `populationLevel.guid` on one side and `consumer.guid` on the other, so one side always fell
 * back to 0 and the comparator was not antisymmetric (sorting became engine-order and unstable).
 */
export function compareAggregateDemands(
    indexOf: (guid: number) => number | undefined,
    a: AggregateDemandRow,
    b: AggregateDemandRow
): number {
    const aIsResidence = isResidenceConsumer(a.consumer);
    const bIsResidence = isResidenceConsumer(b.consumer);

    if (aIsResidence && bIsResidence)
        return (indexOf(a.consumer.guid) ?? 0) - (indexOf(b.consumer.guid) ?? 0);

    if (aIsResidence) return -1000;
    if (bIsResidence) return 1000;

    if (a.consumer && b.consumer)
        return a.consumer.name().localeCompare(b.consumer.name());

    if (a.consumer) return -1000;
    if (b.consumer) return 1000;

    return b.amount() - a.amount();
}

/**
 * Duck-typed ResidenceBuilding check. `populationLevel` is present on ResidenceBuilding and on
 * nothing else that reaches this list, so aggregate.ts need not import world.ts (cycle risk).
 */
function isResidenceConsumer(consumer: any): boolean {
    return consumer != null && consumer.populationLevel != null;
}

export interface AggregateBuildingsSums {
    constructed: () => number;
    required: () => number;
    /** Sum of each real island's own buildings.utilized(), honouring per-island fullyUtilizeConstructed. */
    utilized?: () => number;
    planned?: () => number;
}

/**
 * Building metrics for one asset guid, summed across the real islands in a SINGLE pass.
 *
 * Prefer this over one `sumAcrossRealIslands` closure per metric: `constructed`, `required` and
 * `utilized` are read together on essentially every visible row (capacityUtilisation alone reads
 * two of them), so per-metric closures walked view.islands() and repeated the assetsMap lookup
 * three or four times per recompute. The shared pureComputed collapses that to one walk and
 * memoizes it until an underlying island observable changes.
 *
 * Returns the full AggregateBuildingsSums shape; callers hand AggregateBuildingsCalc only the
 * metrics they actually want and let it apply its own defaults for the rest.
 */
export function sumBuildingsAcrossRealIslands(guid: number): Required<AggregateBuildingsSums> {
    const sums = ko.pureComputed(() => {
        let constructed = 0, required = 0, utilized = 0, planned = 0;

        for (const island of window.view.islands()) {
            if (island.isAllIslands()) continue;

            const asset = island.assetsMap.get(guid) as { buildings?: BuildingsCalc } | undefined;
            if (!asset?.buildings) continue;

            constructed += +asset.buildings.constructed() || 0;
            required += +asset.buildings.required() || 0;
            utilized += +asset.buildings.utilized() || 0;
            planned += +asset.buildings.planned() || 0;
        }

        return { constructed, required, utilized, planned };
    });

    return {
        constructed: () => sums().constructed,
        required: () => sums().required,
        utilized: () => sums().utilized,
        planned: () => sums().planned,
    };
}

/**
 * A KO observable-shaped value that reads through to `read` and ignores writes.
 *
 * Writable (rather than a plain read-only pureComputed) so that any binding still using a two-way
 * `value:`/`checked:` binding degrades to inert instead of throwing "Cannot write a value to a
 * ko.computed unless you specify a write option".
 */
function readOnlyComputed<T>(read: () => T): KnockoutComputed<T> {
    return ko.pureComputed({
        read,
        write: (value: T) => {
            if (window.view?.debug?.enabled && window.view.debug.enabled())
                console.warn('[Aggregate] Ignored write to a read-only aggregate BuildingsCalc:', value);
        }
    });
}

/**
 * A BuildingsCalc whose values are read-only sums across the user's real islands.
 *
 * Replaces the two hand-rolled synthetic objects that previously lived in presenters.ts and
 * views.ts. Three things it fixes over those:
 *  1. `readOnly` is true, so UI components can render a display instead of an editable control
 *     without any template-level aggregate condition.
 *  2. Setters are explicit no-ops instead of silently writing to a throwaway object discarded on
 *     the next recompute (which made incConstructedBuildings() lose edits with no signal).
 *  3. `utilized` is the sum of each island's own utilized(), not a value re-derived from a summed
 *     `required` under one global fullyUtilizeConstructed flag - that flag is a per-island choice.
 *
 * Still allocated fresh on each recompute of the owning pureComputed: only that computed's bound
 * VALUE changes, never the presenter arrays templates iterate, so it cannot trigger a tile rebuild.
 */
export class AggregateBuildingsCalc extends BuildingsCalc {
    public readonly readOnly: boolean = true;

    constructor(sums: AggregateBuildingsSums) {
        super();

        const utilized = sums.utilized ?? sums.required;
        const planned = sums.planned ?? (() => 0);

        // Replace the base class's writable observables with read-through computeds. The base
        // class's own computeds call these through `this`, so reassigning here (after super())
        // is safe - they resolve at evaluation time, not construction time.
        this.constructed = readOnlyComputed(sums.constructed);
        this.required = readOnlyComputed(sums.required);
        this.planned = readOnlyComputed(planned);
        this.fullyUtilizeConstructed = readOnlyComputed(() => false);

        this.utilized = ko.pureComputed(utilized);
        this.capacityUtilisation = ko.pureComputed(() => {
            const u = this.utilized();
            if (u <= EPSILON) return 0;

            const c = this.constructed();
            if (c <= EPSILON) return 0;

            return Math.min(1, u / c);
        });
    }
}
