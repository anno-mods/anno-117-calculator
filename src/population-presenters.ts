import { ko } from './util';
import { PopulationGroup, PopulationLevel } from './population';
import { Island } from './world';
import { isAggregateModeFor, sumAcrossRealIslands } from './aggregate';

/**
 * Looks up the PopulationLevel with the given guid on a specific island, if present.
 * Population levels can be region-exclusive, so a real island may legitimately not
 * have a given tier - callers treat a missing level as a zero contribution (union
 * display), not an error.
 */
function findPopulationLevel(island: Island, guid: number): PopulationLevel | undefined {
    return island.assetsMap.get(guid) as PopulationLevel | undefined;
}

/**
 * Presenter for a single PopulationLevel (population tier), used for both normal
 * per-island rendering and the "All Islands" aggregate view.
 *
 * Mirrors FactoryPresenter's shape (src/presenters.ts): built once per population
 * level, shares the single `window.view.island` observable passed in by the caller,
 * and resolves the currently-selected island's own instance of this level via
 * `island().assetsMap.get(guid)` (the same guid-keyed lookup convention used
 * everywhere else in the presenter layer).
 *
 * Replaces the generic `Template` class for this one surface only (see
 * templates/population-tile.html and src/main.ts) - `Template` continues to be used
 * unchanged for consumers, publicServices, and publicRecipeBuildings.
 */
export class PopulationLevelPresenter {
    public populationLevel: PopulationLevel;
    public island: KnockoutObservable<Island>;
    public instance: KnockoutComputed<PopulationLevel | null>;

    // Delegated / copied properties (mirrors what Template used to expose)
    public guid: number;
    public icon: string | undefined;
    public name: KnockoutComputed<string>;

    public hotkey: KnockoutComputed<string | null>;
    public visible: KnockoutComputed<boolean>;
    public residents: KnockoutComputed<number>;

    /**
     * Read-only sum of `residences[0].buildings.constructed()` across the user's real
     * islands for this population level's guid. Only meaningful (and only bound by the
     * template) while `isAggregateMode()` is true - the underlying per-island
     * observable can't sensibly two-way-bind to a derived sum.
     */
    public aggregateBuildingsConstructed: KnockoutComputed<number>;

    /**
     * Creates a new PopulationLevelPresenter instance
     * @param populationLevel - The reference PopulationLevel (from the All-Islands
     *   pseudo-island's own populationGroups) this presenter wraps
     * @param island - The shared, single `window.view.island` observable - NOT a
     *   per-instance observable, so every presenter reacts to the same island switch
     */
    constructor(populationLevel: PopulationLevel, island: KnockoutObservable<Island>) {
        if (!populationLevel) {
            throw new Error('PopulationLevelPresenter populationLevel is required');
        }
        if (!island) {
            throw new Error('PopulationLevelPresenter island is required');
        }

        this.populationLevel = populationLevel;
        this.island = island;

        this.guid = populationLevel.guid;
        this.icon = populationLevel.icon;
        this.name = populationLevel.name;

        this.instance = ko.computed(() => findPopulationLevel(this.island(), this.guid) ?? null);

        this.hotkey = ko.pureComputed(() => this.instance()?.hotkey() ?? null);

        this.visible = ko.pureComputed(() => this.instance()?.visible() ?? false);

        this.residents = ko.pureComputed(() => {
            if (this.isAggregateMode()) {
                return sumAcrossRealIslands(realIsland => {
                    const level = findPopulationLevel(realIsland, this.guid);
                    return level ? level.residents() : 0;
                });
            }

            return this.instance()?.residents() ?? 0;
        });

        this.aggregateBuildingsConstructed = ko.pureComputed(() => sumAcrossRealIslands(realIsland => {
            const level = findPopulationLevel(realIsland, this.guid);
            return level ? level.residences[0].buildings.constructed() : 0;
        }));
    }

    /**
     * True when the currently-selected island is the All-Islands pseudo-island AND the
     * `aggregateAllIslands` setting is on - the single condition every aggregate
     * branch above (and the template's if/ifnot gating) keys off.
     */
    isAggregateMode(): boolean {
        const island = this.island();
        return !!island && isAggregateModeFor(island);
    }
}

/**
 * Presenter for a PopulationGroup (ordered collection of population tiers), created
 * once per group. Mirrors CategoryPresenter's shape (src/presenters.ts): holds a
 * plain, stable array of `PopulationLevelPresenter` built once in the constructor -
 * this array (and `window.view.template.populationGroups`, the array of
 * PopulationGroupPresenter itself) must never be rebuilt or swapped, only the
 * per-item computed properties re-evaluate on island switch.
 */
export class PopulationGroupPresenter {
    public populationGroup: PopulationGroup;
    public island: KnockoutObservable<Island>;
    public instance: KnockoutComputed<PopulationGroup | null>;

    public guid: number;
    public name: KnockoutComputed<string>;

    public populationLevels: PopulationLevelPresenter[];

    /**
     * Creates a new PopulationGroupPresenter instance
     * @param populationGroup - The reference PopulationGroup to present
     * @param island - The shared `window.view.island` observable
     */
    constructor(populationGroup: PopulationGroup, island: KnockoutObservable<Island>) {
        if (!populationGroup) {
            throw new Error('PopulationGroupPresenter populationGroup is required');
        }
        if (!island) {
            throw new Error('PopulationGroupPresenter island is required');
        }

        this.populationGroup = populationGroup;
        this.island = island;

        this.guid = populationGroup.guid;
        this.name = populationGroup.name;
        this.instance = ko.computed(() => (this.island().assetsMap.get(this.guid) as PopulationGroup | undefined) ?? null);

        this.populationLevels = populationGroup.populationLevels.map(level => new PopulationLevelPresenter(level, island));
    }
}
