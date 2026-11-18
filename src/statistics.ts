// Entry point for statistics.html - live production statistics page.
//
// This page deliberately does NOT use the main calculator's template-loading/component-
// registration system (src/main.ts / src/components.ts) - that machinery exists for the main
// app's large dynamic tile grid. Here the tabs/table markup lives directly in statistics.html's
// <body> with plain Knockout data-bind attributes, and ko.applyBindings is called once, below.

import { ko, formatNumber } from './util';
import { currentLanguage, resolveProduct, resolveSession, ResolvedProduct, ResolvedSession } from './statistics-params';
import { ConnectionState, RowViewModel, StatisticsFeed, IslandFeedState } from './statistics-feed';

// jQuery/Bootstrap are loaded as plain global <script> tags by statistics.html (KTD2 - same
// pattern as index.html), not as a webpack import; mirrors main.ts:21's own `declare const $: any`.
declare const $: any;

/**
 * U2: value-identity key for one island, matching StatisticsFeed's own (sessionGuid, islandId,
 * areaIndex) identity triple (see statistics-feed.ts's `islandsByIdentity`). Compared by value
 * (`keysEqual` below), never by object identity - `checkedKeys`/`Collection.members` entries are
 * plain data, not references into `feed.islands()`. `sessionGuid` joined the key (session-grouping
 * plan, found during implementation) after real pipe data showed `islandId` alone repeats across
 * different sessions - without it, two different-session islands sharing an `(islandId,
 * areaIndex)` pair collided into the same checked/collection-membership entry.
 */
export interface IslandKey {
    sessionGuid: number;
    islandId: number;
    areaIndex: number;
}

/**
 * U2: in-memory shape only (no persistence - that's U4, no DOM - that's U5). "All Islands"
 * (R11) deliberately has NO entry here (KTD2) - its membership is always derived live from
 * `feed.islands()`, never stored as a `members` array.
 */
export interface Collection {
    id: string;
    name: string;
    members: IslandKey[];
}

/**
 * U2 (session-grouping plan): one resolved session's worth of arrived member islands, backing
 * `StatisticsViewModel.sessionGroups`. `islands` is a `KnockoutObservableArray` - deliberately not
 * a plain array, since `statistics.html`'s nested `foreach: $data.islands` (U4) needs its own
 * reactive signal to re-render when membership changes; a plain field reassignment gives the
 * *outer* `foreach: sessionGroups` binding nothing to react to when the `SessionGroup` object
 * itself is unchanged (found during implementation - the inner list silently never updated past
 * its first render). The `SessionGroup` object itself is still never reallocated once created for
 * a given `sessionGuid` (KTD4) - see `sessionGroupsByGuid`; only its `islands` observable's value
 * is written.
 */
export interface SessionGroup {
    readonly sessionGuid: number;
    readonly name: string;
    readonly icon: string | undefined;
    islands: KnockoutObservableArray<IslandFeedState>;
}

/**
 * KTD2: sentinel `activeCollectionId` value for the built-in, permanent "All Islands" collection
 * (R11) - it is never a real entry in `collections`, and its membership is always every island
 * currently known this session (`feed.islands()`), computed live rather than stored.
 */
export const ALL_ISLANDS_COLLECTION_ID = '__all-islands__';

/** U4/KTD1: dedicated localStorage key for this page's collections + active-selection blob -
 * distinct from the main calculator's SubStorage keys (checked against world.ts/trade.ts/
 * views.ts/main.ts, none use anything "statistics"-prefixed). */
const STATISTICS_COLLECTIONS_STORAGE_KEY = 'statisticsCollections';

/** U4/KTD1: on-disk shape written/read at STATISTICS_COLLECTIONS_STORAGE_KEY. All fields optional
 * on read - `JSON.parse` returns `any`, and this shape is read defensively (R14-style) rather than
 * trusted, since it's user-editable browser storage. */
interface PersistedCollection {
    id?: unknown;
    name?: unknown;
    members?: unknown;
}
interface PersistedActiveSelection {
    collectionId?: unknown;
    checked?: unknown;
}
interface PersistedBlob {
    collections?: unknown;
    active?: PersistedActiveSelection;
}

function isIslandKey(value: unknown): value is IslandKey {
    const key = value as { sessionGuid?: unknown; islandId?: unknown; areaIndex?: unknown } | null;
    return !!key && typeof key.sessionGuid === 'number' && typeof key.islandId === 'number' && typeof key.areaIndex === 'number';
}

/** U4: id generation for user-created collections - no existing helper in util.ts for this, so a
 * small monotonic-plus-timestamp scheme lives here (collision-safe enough for a single browser
 * session's worth of manually created collections). */
let nextCollectionIdSuffix = 0;
function generateCollectionId(): string {
    nextCollectionIdSuffix++;
    return `collection-${Date.now()}-${nextCollectionIdSuffix}`;
}

function keysEqual(a: IslandKey, b: IslandKey): boolean {
    return a.sessionGuid === b.sessionGuid && a.islandId === b.islandId && a.areaIndex === b.areaIndex;
}

function keyIndexOf(list: IslandKey[], key: IslandKey): number {
    return list.findIndex(k => keysEqual(k, key));
}

function islandToKey(island: IslandFeedState): IslandKey {
    return { sessionGuid: island.sessionIdentity(), islandId: island.islandId(), areaIndex: island.areaIndex() };
}

/**
 * U3/R8: shape produced by `filteredRows` once it merges every checked island's rows for the same
 * `productGuid`. Deliberately narrower than `RowViewModel` (statistics-feed.ts) - only the fields
 * `statistics.html`'s table actually renders (`identity`, `generation`, `consumption`,
 * `perfectGeneration`, `perfectConsumption`, `buildings`). `averageProductivity` is an average, not
 * a total - summing it across islands would be a meaningless number, and there is no table column
 * for it anyway - so it is left out entirely rather than carried through as a fake zero/sum.
 * `delta`/`totalMaintenance`/`totalIncome`/`totalProfit`/`summedProductivity` are similarly left
 * out: nothing in this unit's scope reads them from a merged row.
 */
interface MergedRowViewModel {
    readonly productGuid: number;
    readonly identity: ResolvedProduct;
    generation: KnockoutObservable<number>;
    consumption: KnockoutObservable<number>;
    perfectGeneration: KnockoutObservable<number>;
    perfectConsumption: KnockoutObservable<number>;
    buildings: KnockoutObservable<number>;
}

/**
 * KTD3: a plain summing function, mirroring src/aggregate.ts's `sumAcrossRealIslands` shape -
 * never a shared memoized `ko.pureComputed`. That file's own header comment explains why: a shared
 * memoized computed is one dependency-graph node that notifies every binding at once, which caused
 * a real stale-$data glitch inside `with:` blocks elsewhere in this codebase (see
 * src/AGENTS.md -> "Aggregate mode"). Called fresh inside each computed that needs a sum, so the
 * per-row observable reads register as dependencies of *that* computed's own graph, not of some
 * third node neither caller controls.
 *
 * `IslandFeedState` (statistics-feed.ts) doesn't expose its private `rowsByGuid` map on the public
 * interface, and this unit doesn't touch statistics-feed.ts - so this does a linear scan of
 * `island.rows()` per island per call rather than a map lookup. Row counts on this page are the
 * live product catalog (~181 products), so this is cheap relative to a real network tick.
 */
function sumAcrossCheckedIslands(islands: IslandFeedState[], productGuid: number, selector: (row: RowViewModel) => number): number {
    let sum = 0;
    for (const island of islands) {
        for (const row of island.rows()) {
            if (row.productGuid === productGuid) {
                sum += selector(row) || 0;
                break;
            }
        }
    }
    return sum;
}

if (typeof window.params === 'undefined') {
    console.error('[statistics] window.params is missing - ensure js/params.js is loaded before statistics.bundle.js');
} else {
    console.log('[statistics] statistics bundle loaded, params available');
}

// Exposed for Playwright tests and console debugging, mirroring window.debugKO/window.view in
// main.ts. Harmless in production: pure, read-only lookup functions, no state of their own.
(window as any).statisticsParams = { resolveProduct, resolveSession, currentLanguage };

// U3: the SSE client + live row/connection-state view-model. Constructing it does nothing
// observable by itself (KTD1) - `connect()` is only ever called from an explicit user action,
// wired up by U5's "Connect" control. Exposed on `window` for later units and for Playwright
// tests to drive via page.evaluate(), same pattern as `window.statisticsParams` above.
const feed = new StatisticsFeed();
(window as any).statisticsFeed = feed;

// templates reference formatNumber(...) directly (mirrors window.formatNumber set in main.ts for
// the main calculator's own templates - templates/product-tile.html's formatNumber($data...)
// pattern).
window.formatNumber = formatNumber;

/**
 * U4/U5: the page-level view-model - header, category tabs, filtered row table, and connection
 * indicator/Connect action. `selectedCategory`/`categories`/`filteredRows`/`connectionStateLabel`
 * are the only new reactive surface; `connectionState` is `feed.connectionState` itself (no
 * duplicate copy), and `feed.rows()` is never reassigned or mutated here (KTD8) - `filteredRows`
 * is a derived view.
 */
class StatisticsViewModel {
    public readonly feed: StatisticsFeed = feed;

    /**
     * U3/R8: resolves `checkedKeys()` to the actual `IslandFeedState` objects currently present in
     * `feed.islands()` (value match via `keysEqual`/`islandToKey`, never by array position). U4's
     * bootstrap/restore logic guarantees `checkedKeys` is populated whenever there's anything
     * meaningful to show (R24 first-visit auto-check, R19 restore-and-wait) - the pre-U4 fallback
     * to the old single-island `selectedAreaName`/`selectedIsland` sticky auto-select (U3's bridge)
     * is gone (U5), since it is now unreachable dead code.
     */
    public readonly checkedIslands: KnockoutComputed<IslandFeedState[]> = ko.pureComputed(() => {
        const keys = this.checkedKeys();
        const arrived = feed.islands();
        const resolved: IslandFeedState[] = [];
        for (const key of keys) {
            const island = arrived.find(candidate => keysEqual(islandToKey(candidate), key));
            if (island) {
                resolved.push(island);
            }
        }
        return resolved;
    });

    /**
     * U3 (implementation-time call - the plan's Approach note leaves multi-island header semantics
     * to this unit beyond "degrades gracefully to today's single-island label with exactly one
     * checked island"). Exactly one checked island: identical to today's behavior (regression
     * requirement). Zero checked islands: `undefined`, same as today's pre-selection state. More
     * than one: a count rather than concatenating every name (unreadable past a handful of
     * islands) or picking one arbitrarily (misrepresents the aggregate). U5 (final header UI) can
     * replace this with a richer summary if the design calls for one - this is a sensible
     * placeholder default, not a final design decision.
     */
    public readonly areaName: KnockoutComputed<string | undefined> = ko.pureComputed(() => {
        const islands = this.checkedIslands();
        if (islands.length === 1) {
            return islands[0].areaName;
        }
        if (islands.length === 0) {
            return undefined;
        }
        return `${islands.length} islands selected`;
    });

    /** U2: checked-island multi-select state (R5-R7) - the "what's shown" driver, DOM-bound (U5)
     * via `isIslandChecked`/`onIslandClick`. */
    public readonly checkedKeys: KnockoutObservableArray<IslandKey> = ko.observableArray([]);
    /** R9: at most one collection active at a time; ALL_ISLANDS_COLLECTION_ID or a real
     * `collections` entry's id, or undefined when no collection is active. */
    public readonly activeCollectionId: KnockoutObservable<string | undefined> = ko.observable(undefined);
    /** U2: seeded directly by tests/a future persistence-restore (U4); "All Islands" (R11) is
     * never an entry here (KTD2). */
    public readonly collections: KnockoutObservableArray<Collection> = ko.observableArray([]);

    /** U5/R14: two-way binding target for the "Create collection" text input. */
    public readonly newCollectionName: KnockoutObservable<string> = ko.observable('');

    /** Re-entrancy guard: true only while `onCollectionCheck` is itself assigning `checkedKeys`
     * to (de)activate a collection. Without this, that internal assignment would immediately
     * re-trigger the R12 subscription below and either corrupt a *different* previously-active
     * collection's membership (R9 collection switch) or instantly self-deactivate "All Islands"
     * right after activating it - neither is a user edit via R5/R6, so both must be suppressed. */
    private applyingCollectionSelection = false;

    /** U4/R19: frozen `IslandKey[]` snapshot from a persisted non-"All Islands" active selection,
     * resolved against `feed.islands()` as members arrive. `undefined` once there is nothing left
     * to progressively restore (never restoring, or fully resolved, or superseded by an explicit
     * user action - see the mutator methods below, each of which clears this so a later island
     * arrival can't silently overwrite a deliberate user choice with stale restored state). */
    private pendingRestoreSnapshot: IslandKey[] | undefined;

    /**
     * KTD6 refinement (found during implementation): `true` only immediately after an explicit
     * `onGroupToggle` "select" call has just made some group fully checked - the signal
     * `growCheckedGroupsOnArrival` needs to tell a deliberate "select this whole group" gesture
     * apart from a merely coincidental full match. Without it, R24's first-island bootstrap, or a
     * smaller persisted Collection whose restored membership happens to equal the arrived count so
     * far, would each trigger unwanted growth - the Collection case would regress KD3/R13's
     * "Collections are unaffected" guarantee (a saved 2-island collection pulling in an unrelated
     * 3rd island after reload). Reset to `false` by every other checkedKeys-establishing entry
     * point (`onIslandClick`, `onCollectionCheck`, the restore-write in
     * `resyncCheckedKeysFromFeed`, and R24's first-arrival bootstrap) and by `onGroupToggle`'s own
     * "unselect" branch. Not persisted - a fresh reload always starts `false`, so growth only
     * resumes once the user re-expresses the gesture explicitly in the new session.
     * `growCheckedGroupsOnArrival`'s own additions deliberately leave it untouched, so a legitimate
     * grow chain keeps propagating.
     */
    private checkedKeysExplicitlyFullFromGroupToggle = false;

    /** U4/KTD1: kept alive so the write-back `ko.computed` (built at the end of the constructor)
     * isn't garbage-collected - mirrors TradeManager's own `persistenceSubscription` field
     * (src/trade.ts). Public for the same reason TradeManager's is: nothing here reads it back,
     * it just needs to outlive the constructor. */
    public persistenceSubscription: KnockoutComputed<unknown> | undefined;

    /** U5: bound straight from feed.connectionState - no separate copy of the state machine here,
     * per the unit's "your call" note (this repo already has no precedent for hiding a feed's own
     * observable behind a duplicate view-model property when nothing needs to transform it). */
    public readonly connectionState: KnockoutObservable<ConnectionState> = feed.connectionState;

    constructor() {
        // U4/KTD1: read + parse the persisted blob once, synchronously, before any of
        // collections/activeCollectionId/checkedKeys are otherwise touched by restore logic -
        // mirrors TradeManager's own read-then-write-back-computed ordering (src/trade.ts).
        let persisted: PersistedBlob | undefined;
        let hadPersistedKey = false;
        if (localStorage) {
            const text = localStorage.getItem(STATISTICS_COLLECTIONS_STORAGE_KEY);
            hadPersistedKey = text !== null;
            if (text) {
                try {
                    persisted = JSON.parse(text) as PersistedBlob;
                } catch {
                    // R24: an unreadable blob is treated the same as "never written" - there is
                    // nothing valid to restore either way.
                    persisted = undefined;
                    hadPersistedKey = false;
                }
            }
        }

        // Restore `collections` (R16) BEFORE the write-back computed exists below, so its first
        // evaluation is a correct no-op re-save of what was just restored, not data loss.
        const persistedCollections = persisted && Array.isArray(persisted.collections) ? persisted.collections : [];
        for (const raw of persistedCollections as unknown[]) {
            const c = raw as PersistedCollection;
            if (c && typeof c.id === 'string' && typeof c.name === 'string' && Array.isArray(c.members)) {
                this.collections.push({ id: c.id, name: c.name, members: (c.members as unknown[]).filter(isIslandKey) });
            }
        }

        if (hadPersistedKey) {
            // R17/R19: a persisted active selection exists (even a genuinely empty one) - restore
            // it exactly, with no fallback auto-select. R24's auto-check below only applies when
            // there was no persisted key at all.
            // KTD2: `activeCollectionId` can no longer be the old `ALL_ISLANDS_COLLECTION_ID`
            // sentinel - a stale blob from before this plan (this feature has no released build
            // yet) restores as "no active collection" instead of a permanently-stuck state.
            const persistedActiveCollectionId = persisted?.active?.collectionId;
            const activeCollectionId = persistedActiveCollectionId === ALL_ISLANDS_COLLECTION_ID
                ? undefined
                : (typeof persistedActiveCollectionId === 'string' ? persistedActiveCollectionId : undefined);
            this.activeCollectionId(activeCollectionId);
            const checked = persisted?.active?.checked;
            this.pendingRestoreSnapshot = Array.isArray(checked) ? (checked as unknown[]).filter(isIslandKey) : [];
            // Covers the (unlikely at construction time) case where feed.islands() already has
            // entries; the subscription below covers every later arrival.
            this.resyncCheckedKeysFromFeed();
        } else {
            // R24: genuinely first visit - auto-check the first island to arrive this session,
            // with no collection active. Self-disposing, direct equivalent of the old single-
            // island sticky auto-select this replaces (see checkedIslands' bridge comment).
            const applyFirstArrival = (islands: IslandFeedState[]) => {
                if (islands.length > 0 && this.checkedKeys().length === 0) {
                    this.checkedKeysExplicitlyFullFromGroupToggle = false; // never a group-toggle gesture.
                    this.checkedKeys([islandToKey(islands[0])]);
                    return true;
                }
                return false;
            };
            if (!applyFirstArrival(feed.islands())) {
                const bootstrapSub = feed.islands.subscribe((newIslands) => {
                    if (applyFirstArrival(newIslands)) {
                        bootstrapSub.dispose();
                    }
                });
            }
        }

        // KTD6: run before the pendingRestoreSnapshot resync below, on every arrival batch -
        // grows "All Islands"/session groups that were already fully checked (R8's live-grow).
        feed.islands.subscribe((changes: any[]) => {
            const newlyArrived = changes.filter(c => c.status === 'added').map(c => c.value as IslandFeedState);
            this.growCheckedGroupsOnArrival(newlyArrived);
        }, null, 'arrayChange');

        // R19: keep `checkedKeys` in sync with arriving islands - a restored real-collection/
        // undefined selection's pending snapshot resolves progressively (R19) until superseded by
        // an explicit user action (see the mutator methods, which clear `pendingRestoreSnapshot`).
        // Non-self-disposing on purpose - covers both the reload-restore case and any later
        // restore-in-progress arrival.
        feed.islands.subscribe(() => this.resyncCheckedKeysFromFeed());

        // R12 (revised): any checked-island change made via R6 (Ctrl-click; R5 plain clicks
        // already deselect the active collection themselves in `onIslandClick`, so by the time
        // this fires `activeCollectionId` is already undefined for them) edits the active
        // collection's stored membership in place, or deselects "All Islands" as active. See
        // `syncActiveCollectionMembership`.
        this.checkedKeys.subscribe(() => {
            if (this.applyingCollectionSelection) {
                return;
            }
            this.syncActiveCollectionMembership();
        });

        // U4/KTD1: write-back computed, built LAST (after collections/activeCollectionId/
        // checkedKeys have been restored above) so its first evaluation is a no-op re-save.
        // Reads all three so it fires on any of their changes (R16/R17).
        if (localStorage) {
            this.persistenceSubscription = ko.computed(() => {
                const json = {
                    collections: this.collections()
                        .filter(c => c.id !== ALL_ISLANDS_COLLECTION_ID) // KTD2: sentinel, never persisted.
                        .map(c => ({ id: c.id, name: c.name, members: c.members.slice() })),
                    active: {
                        collectionId: this.activeCollectionId(),
                        checked: this.checkedKeys().slice()
                    }
                };
                localStorage.setItem(STATISTICS_COLLECTIONS_STORAGE_KEY, JSON.stringify(json));
                return json;
            });
        }
    }

    /**
     * KTD6: sentinel-free replacement for the old `resyncCheckedKeysFromFeed` All-Islands branch,
     * generalized to session groups too (KD2's stated parity). For each island in `newlyArrived`,
     * adds its key to `checkedKeys` when "All Islands" or its own resolved session was fully
     * checked using the arrived-island set as it stood immediately *before* this arrival (computed
     * by excluding `newlyArrived` itself from `feed.islands()`, not from any stored previous-tick
     * state) - keeping R8 ("checked exactly when every arrived member is checked") true as new
     * members stream in without the user re-clicking anything.
     *
     * Gated entirely on `checkedKeysExplicitlyFullFromGroupToggle` (found during implementation):
     * a "fully checked" state can also arise coincidentally - R24's first-island bootstrap, or a
     * smaller persisted Collection whose restored membership happens to equal the arrived count so
     * far - and neither is a reliable "the user meant everything" signal. Without this gate, R24's
     * single island would cascade into auto-checking every later arrival during the initial
     * connect burst, and a restored 2-island Collection could pull in an unrelated 3rd island,
     * regressing KD3/R13's "Collections are unaffected" guarantee. Also guarded against the same
     * vacuous-truth trap as `isGroupChecked` (KTD3): an empty "before" set is never treated as
     * "fully checked".
     */
    private growCheckedGroupsOnArrival(newlyArrived: IslandFeedState[]): void {
        if (newlyArrived.length === 0 || !this.checkedKeysExplicitlyFullFromGroupToggle) {
            return;
        }
        const newKeys = newlyArrived.map(islandToKey);
        const arrivedBefore = feed.islands().filter(i => keyIndexOf(newKeys, islandToKey(i)) === -1);
        const checkedBefore = this.checkedKeys();
        const allIslandsFullyCheckedBefore = arrivedBefore.length > 0
            && arrivedBefore.every(i => keyIndexOf(checkedBefore, islandToKey(i)) !== -1);

        const toAdd: IslandKey[] = [];
        for (const island of newlyArrived) {
            const key = islandToKey(island);
            let shouldAdd = allIslandsFullyCheckedBefore;
            if (!shouldAdd) {
                const resolved = resolveSession(island.sessionIdentity());
                if (resolved) {
                    const sameSessionBefore = arrivedBefore.filter(i => resolveSession(i.sessionIdentity())?.guid === resolved.guid);
                    shouldAdd = sameSessionBefore.length > 0
                        && sameSessionBefore.every(i => keyIndexOf(checkedBefore, islandToKey(i)) !== -1);
                }
            }
            if (shouldAdd && keyIndexOf(checkedBefore, key) === -1 && keyIndexOf(toAdd, key) === -1) {
                toAdd.push(key);
            }
        }

        for (const key of toAdd) {
            this.checkedKeys.push(key);
        }
    }

    /**
     * U4/R19: resolves a restored `pendingRestoreSnapshot` against currently-arrived islands,
     * clearing it once every snapshot member has arrived (nothing left to progressively resolve).
     * Guarded by `applyingCollectionSelection` so this never re-triggers the R12 merge
     * subscription. No-op when there is no pending snapshot. "All Islands"'s own live-grow
     * behavior no longer routes through here (KTD2) - see `growCheckedGroupsOnArrival`.
     */
    private resyncCheckedKeysFromFeed(): void {
        if (this.pendingRestoreSnapshot) {
            const arrivedKeys = feed.islands().map(islandToKey);
            const resolved = this.pendingRestoreSnapshot.filter(key => keyIndexOf(arrivedKeys, key) !== -1);
            // KTD6 interaction: add missing snapshot members rather than overwriting wholesale -
            // `growCheckedGroupsOnArrival` (which runs earlier in the same feed.islands tick) may
            // have already added a key outside this snapshot (e.g. a brand-new island joining
            // because "All Islands" happened to be fully checked from what's arrived of the
            // snapshot so far); a wholesale `this.checkedKeys(resolved)` would silently drop it.
            const current = this.checkedKeys();
            const merged = current.slice();
            for (const key of resolved) {
                if (keyIndexOf(merged, key) === -1) {
                    merged.push(key);
                }
            }
            if (merged.length !== current.length) {
                this.checkedKeysExplicitlyFullFromGroupToggle = false; // restore, never a group-toggle gesture.
                this.applyingCollectionSelection = true;
                try {
                    this.checkedKeys(merged);
                } finally {
                    this.applyingCollectionSelection = false;
                }
            }
            if (resolved.length === this.pendingRestoreSnapshot.length) {
                this.pendingRestoreSnapshot = undefined; // fully resolved - nothing left to sync.
            }
        }
    }

    /** KTD1: the only call site for feed.connect() in the whole page - wired to the Connect
     * button's click: binding in statistics.html. Never invoked from here or anywhere else
     * automatically (no $(document).ready auto-invoke, no constructor call). */
    public connect(): void {
        feed.connect();
    }

    /**
     * R5/R6/R20: click handler for one island's checkbox. `ctrl` is a plain boolean the (future,
     * U5) DOM caller computes from the triggering event (Ctrl/Cmd-click, or a keyboard-triggered
     * click per R20) - this function has no knowledge of the DOM event itself.
     *
     * Revised R12: only a Ctrl-click edits the active collection's stored membership in place
     * (or deselects "All Islands", which is never hand-edited per KD5). A plain click always
     * deselects whatever collection is active - regular or "All Islands" alike - leaving its
     * stored membership completely untouched, and selects just the clicked island.
     */
    public onIslandClick(key: IslandKey, ctrl: boolean): void {
        this.checkedKeysExplicitlyFullFromGroupToggle = false; // never a group-toggle gesture.
        // U4: an explicit user selection supersedes any still-pending restore snapshot - without
        // this, a later island arrival could silently overwrite this click with stale persisted
        // state (see `resyncCheckedKeysFromFeed`).
        this.pendingRestoreSnapshot = undefined;
        if (ctrl) {
            const current = this.checkedKeys();
            const isChecked = keyIndexOf(current, key) !== -1;
            if (isChecked) {
                if (current.length <= 1) {
                    // R7: would drop the checked count to zero - no-op instead. `checkedKeys`
                    // itself is deliberately untouched (the array value is genuinely unchanged),
                    // but the browser already natively toggled the clicked checkbox to unchecked
                    // before this handler ran - without a forced notify, `isIslandChecked`'s
                    // computed never re-runs (nothing it depends on changed), `notify: 'always'`
                    // never gets a chance to fire, and the DOM is left showing unchecked while the
                    // model still has this island checked. `valueHasMutated()` forces the
                    // re-evaluation/re-notify this veto needs without changing the actual value.
                    this.checkedKeys.valueHasMutated!();
                    return;
                }
                this.checkedKeys.remove(k => keysEqual(k, key));
            } else {
                this.checkedKeys.push(key);
            }
        } else {
            // R5 (revised): deselect any active collection up front so the R12 subscription's
            // `syncActiveCollectionMembership` sees `activeCollectionId === undefined` and no-ops
            // - a plain click never edits a collection's stored membership, it only ever exits it.
            this.activeCollectionId(undefined);
            // Full replacement - can never itself violate R7 (always exactly one key).
            this.checkedKeys([key]);
        }
    }

    /**
     * R9/R10: checks a user-created collection, selecting exactly its currently-arrived member
     * islands and making it active. No-op (AE14) if none of its members have arrived yet - leaves
     * the previous checked islands and active collection untouched. "All Islands" is no longer
     * reachable through this method (KTD2) - it moved to the independent `isGroupChecked`/
     * `onGroupToggle` model; a call with the old `ALL_ISLANDS_COLLECTION_ID` sentinel simply
     * matches no `collections` entry below and falls through the same not-found no-op as any
     * other unrecognized id.
     */
    public onCollectionCheck(collectionId: string): void {
        const arrivedKeys = feed.islands().map(islandToKey);
        const collection = this.collections().find(c => c.id === collectionId);
        if (!collection) {
            return;
        }
        const memberKeys = collection.members.filter(member => keyIndexOf(arrivedKeys, member) !== -1);

        if (memberKeys.length === 0) {
            // R10/AE14 zero-guard: `activeCollectionId` is deliberately untouched, but the same
            // DOM-sync problem as onIslandClick's R7 guard above applies here - the browser already
            // natively toggled this collection's checkbox to checked before this handler ran.
            // Force a re-notify so `isCollectionChecked`'s computed re-runs and corrects it back.
            this.activeCollectionId.valueHasMutated!();
            return;
        }

        // U4: same reasoning as onIslandClick above - an explicit collection check supersedes any
        // still-pending restore snapshot.
        this.pendingRestoreSnapshot = undefined;
        this.checkedKeysExplicitlyFullFromGroupToggle = false; // never a group-toggle gesture.

        this.applyingCollectionSelection = true;
        try {
            this.activeCollectionId(collectionId);
            this.checkedKeys(memberKeys);
        } finally {
            this.applyingCollectionSelection = false;
        }
    }

    /**
     * R18: unchecking the currently active user-created collection's own checkbox deactivates it
     * without changing `checkedKeys` at all. A no-op if `collectionId` isn't the currently active
     * one (that's a normal R10 switch, handled by `onCollectionCheck` instead) - which now also
     * covers the old `ALL_ISLANDS_COLLECTION_ID` sentinel automatically, since `activeCollectionId`
     * can no longer equal it (KTD2).
     */
    public onCollectionUncheck(collectionId: string): void {
        if (this.activeCollectionId() === collectionId) {
            // U4: same reasoning as onIslandClick/onCollectionCheck above.
            this.pendingRestoreSnapshot = undefined;
            this.activeCollectionId(undefined);
        }
    }

    /**
     * R14: creates a new named collection from the currently checked islands and makes it active.
     * Defense-in-depth no-op (U5 also disables the calling control) when there are zero checked
     * islands or the name is blank/whitespace-only. A blank-trimmed name is never stored - the
     * trimmed form is, so a name that's only cosmetically different from an existing one (e.g.
     * trailing spaces) is still allowed to duplicate (collections are identified by id, not name).
     * Doesn't touch `checkedKeys`, so it cannot trigger the R12 merge subscription and needs no
     * `applyingCollectionSelection` guard.
     */
    public createCollection(name: string): void {
        const trimmedName = name.trim();
        const members = this.checkedKeys();
        if (trimmedName === '' || members.length === 0) {
            return;
        }
        const id = generateCollectionId();
        this.collections.push({ id, name: trimmedName, members: members.slice() });
        this.activeCollectionId(id);
    }

    /**
     * R15: removes a user-created collection from storage/sidebar. Checked islands stay checked,
     * no longer tied to any collection name. `ALL_ISLANDS_COLLECTION_ID` is never a real entry in
     * `collections` (KTD2), so the `remove` predicate naturally can't match it - the explicit guard
     * below is just belt-and-suspenders against ever calling this with that sentinel.
     */
    public deleteCollection(id: string): void {
        if (id === ALL_ISLANDS_COLLECTION_ID) {
            return;
        }
        this.collections.remove(c => c.id === id);
        if (this.activeCollectionId() === id) {
            this.activeCollectionId(undefined);
        }
    }

    /** U5/R14: the "Create collection" button's click handler - reads the text input, delegates
     * to `createCollection` (which itself no-ops on a blank/whitespace name or empty
     * `checkedKeys()`), then clears the input on success so it doesn't carry over into the next
     * collection. Left as-is (not cleared) on a no-op, so the user can see/fix what they typed. */
    public submitCreateCollection(): void {
        const name = this.newCollectionName();
        const countBefore = this.collections().length;
        this.createCollection(name);
        if (this.collections().length > countBefore) {
            this.newCollectionName('');
        }
    }

    /**
     * R12's edit-in-place logic. Runs on every `checkedKeys` change (never via this class's own
     * collection-activation assignments - see `applyingCollectionSelection`), but only has an
     * effect for a Ctrl-click (R6): a plain click (R5) already deselects the active collection
     * itself in `onIslandClick` before touching `checkedKeys`, so `activeId` is already
     * `undefined` here by the time a plain click's change reaches this method. "All Islands" is no
     * longer a reachable `activeId` value at all (KTD2), so its own former branch here is gone.
     */
    private syncActiveCollectionMembership(): void {
        const activeId = this.activeCollectionId();
        if (activeId === undefined) {
            return;
        }

        const collection = this.collections().find(c => c.id === activeId);
        if (!collection) {
            return; // defensive: activeCollectionId doesn't resolve to a stored collection.
        }

        const arrivedKeys = feed.islands().map(islandToKey);
        const checked = this.checkedKeys();
        // R13/AE4/AE9: keep every member that hasn't arrived yet untouched, plus every arrived
        // member still checked; drop arrived members no longer checked; add newly checked keys.
        const merged = collection.members.filter(member => {
            const hasArrived = keyIndexOf(arrivedKeys, member) !== -1;
            return !hasArrived || keyIndexOf(checked, member) !== -1;
        });
        for (const key of checked) {
            if (keyIndexOf(merged, key) === -1) {
                merged.push(key);
            }
        }
        collection.members = merged;
    }

    /** Human-readable label for the compact indicator; kept alongside the css: state mapping in
     * statistics.html so both read from the same connectionState() and can't drift apart. */
    public readonly connectionStateLabel: KnockoutComputed<string> = ko.pureComputed(() => {
        switch (feed.connectionState()) {
            case 'live': return 'Live';
            case 'reconnecting': return 'Reconnecting';
            default: return 'Offline';
        }
    });

    /**
     * KTD4 graceful degrade: null when the server's session identifier has no params match - the
     * header then shows nothing beyond the raw areaName, no placeholder text.
     *
     * U3 (same implementation-time call as `areaName` above): a merged session identity across
     * islands from potentially different sessions doesn't resolve to anything meaningful, so both
     * the zero- and multi-checked cases fall back to `null` (KTD4's existing "no session"
     * contract). Only the single-checked-island case resolves a real session, matching today's
     * behavior exactly.
     */
    public readonly sessionInfo: KnockoutComputed<ResolvedSession | null> = ko.pureComputed(() => {
        const islands = this.checkedIslands();
        if (islands.length !== 1) {
            return null;
        }
        return resolveSession(islands[0].sessionIdentity());
    });

    /**
     * KTD4/R6: index of `guid` in `window.params.sessions`, or `Infinity` when unresolved -
     * extracted from the pre-session-grouping-plan `sortedIslands`' own inlined lookup, now shared
     * by `sessionGroups`' own ordering.
     */
    private resolveSessionIndexByGuid(guid: number): number {
        const idx = (window.params?.sessions || []).findIndex((s: any) => s.guid === guid);
        return idx === -1 ? Infinity : idx;
    }

    /**
     * KTD4: back `sessionGroups` with a persistent `Map<sessionGuid, SessionGroup>`, mirroring
     * `mergedRowsByGuid`'s identity-stability pattern below - a `SessionGroup` object, once created
     * for a guid, is never reallocated; only its `islands` observable's value is written. `foreach:
     * sessionGroups` in `statistics.html` (U4) diffs by object identity, so a fresh object per
     * session on every recompute would tear down and rebuild every session's DOM subtree on each
     * new island arrival - a routine, expected event on this live feed. `islands` itself must still
     * be a `KnockoutObservableArray`, not a plain field: the nested `foreach: $data.islands` inside
     * that same stable outer row needs its own reactive signal to notice a membership change, since
     * an unchanged outer object gives the outer `foreach` nothing to react to on its own.
     */
    private readonly sessionGroupsByGuid = new Map<number, SessionGroup>();

    /**
     * R4/R6: one entry per resolved session with at least one arrived member island, ordered by
     * that session's index in `window.params.sessions`. Replaces `sortedIslands` (KTD4) - the
     * flat, single-list sort this page rendered before session grouping existed.
     */
    public readonly sessionGroups: KnockoutComputed<SessionGroup[]> = ko.pureComputed(() => {
        const islands = feed.islands();
        const seenGuids = new Set<number>();
        for (const island of islands) {
            const resolved = resolveSession(island.sessionIdentity());
            if (!resolved) {
                continue;
            }
            seenGuids.add(resolved.guid);
            if (!this.sessionGroupsByGuid.has(resolved.guid)) {
                this.sessionGroupsByGuid.set(resolved.guid, {
                    sessionGuid: resolved.guid,
                    name: resolved.name,
                    icon: resolved.icon,
                    islands: ko.observableArray([])
                });
            }
        }

        for (const guid of this.sessionGroupsByGuid.keys()) {
            if (!seenGuids.has(guid)) {
                this.sessionGroupsByGuid.delete(guid); // R4: a group only exists with an arrived member.
            }
        }

        for (const guid of seenGuids) {
            const group = this.sessionGroupsByGuid.get(guid)!;
            const members = islands.filter(i => resolveSession(i.sessionIdentity())?.guid === guid);
            members.sort((a, b) => a.areaName.localeCompare(b.areaName));
            group.islands(members); // write the observable's value, never reallocate the SessionGroup object.
        }

        const result = Array.from(this.sessionGroupsByGuid.values());
        result.sort((a, b) => this.resolveSessionIndexByGuid(a.sessionGuid) - this.resolveSessionIndexByGuid(b.sessionGuid));
        return result;
    });

    /** R5/KD5: arrived islands with no resolved session, flat and unindented, sorted by areaName
     * (today's tiebreaker, preserved as the sole remaining sort key for this bucket). */
    public readonly ungroupedIslands: KnockoutComputed<IslandFeedState[]> = ko.pureComputed(() => {
        const list = feed.islands().filter(i => !resolveSession(i.sessionIdentity()));
        list.sort((a, b) => a.areaName.localeCompare(b.areaName));
        return list;
    });

    /**
     * U5/R4: "All Islands" (KTD2 sentinel, never a real `collections` entry) always first, followed
     * by every user-created collection in `collections()`'s own push order (creation order, stable
     * across deletes since `collections` is never reordered). `isAllIslands` lets U4's template
     * branch its row onto `isAllIslandsChecked`/`onAllIslandsToggle` instead of
     * `isCollectionChecked`/`onCollectionCheck`/`onCollectionUncheck` (KTD2: "All Islands" is no
     * longer reachable through the latter at all).
     */
    public readonly collectionsForDisplay: KnockoutComputed<{ id: string; name: string; deletable: boolean; isAllIslands: boolean }[]> = ko.pureComputed(() => {
        return [
            { id: ALL_ISLANDS_COLLECTION_ID, name: 'All Islands', deletable: false, isAllIslands: true },
            ...this.collections().map(c => ({ id: c.id, name: c.name, deletable: true, isAllIslands: false }))
        ];
    });

    /**
     * U5: DOM wiring helper for the sidebar's island checkboxes (see the plan's "real Knockout
     * wiring subtlety" note). Bound to the checkbox's `checked:` binding as a fresh writable
     * `ko.computed` per row (created once when the `foreach` binds that row, disposed with it) -
     * `read` reflects live membership in `checkedKeys()`; `write` is a deliberate no-op because the
     * real mutation happens in the row's own `click:` handler (`onIslandClick`), which receives the
     * actual DOM event and can compute the correct `ctrl` boolean - information a `checked:`
     * binding's `write` callback never receives.
     *
     * `.extend({notify: 'always'})` is required, not cosmetic: the browser applies its OWN native
     * checked-toggle to the DOM the instant the user clicks, before any of this runs. If the click
     * handler's model mutation happens to leave `read()`'s boolean unchanged from its pre-click
     * value (e.g. R5's replace-all re-selecting the sole already-checked island, or R7's zero-guard
     * veto), a plain `ko.computed` does NOT re-notify its own subscribers on an unchanged value - so
     * KO's `checked` binding never re-applies `element.checked`, and the native toggle is left
     * standing, silently out of sync with `checkedKeys()`. `notify: 'always'` forces a
     * re-notification (and therefore a DOM re-sync) on every recompute regardless of value
     * equality, which is exactly what a browser-driven control needs to be forcibly corrected.
     */
    public isIslandChecked(key: IslandKey): KnockoutComputed<boolean> {
        return ko.computed({
            read: () => keyIndexOf(this.checkedKeys(), key) !== -1,
            write: () => { /* no-op: click: handler owns the real mutation via onIslandClick */ }
        }).extend({ notify: 'always' });
    }

    /** U5: same shape/rationale as `isIslandChecked` above, for the Collections list - a
     * user-created collection row is "checked" exactly when it is the active collection. Real
     * mutation happens in the row's own `click:` handler (`onCollectionCheck`/`onCollectionUncheck`).
     * "All Islands" no longer goes through this method (KTD2) - see `isGroupChecked` instead. Same
     * `notify: 'always'` reasoning applies. */
    public isCollectionChecked(collectionId: string): KnockoutComputed<boolean> {
        return ko.computed({
            read: () => this.activeCollectionId() === collectionId,
            write: () => { /* no-op: click: handler owns the real mutation. */ }
        }).extend({ notify: 'always' });
    }

    /**
     * KTD3/R8: plain (non-observable) core logic shared by `isGroupChecked`, `isAllIslandsChecked`,
     * and `isSessionGroupChecked` - each wraps this in its own single `ko.computed` rather than
     * calling another method that itself returns a `ko.computed`. Nesting computeds that way
     * (calling `otherMethod(...)()` inside a `read` callback) would create a brand-new inner
     * computed - with its own live subscriptions to `checkedKeys`/`feed.islands` - on every single
     * recompute of the outer one, never disposed (found during self-review): an accumulating
     * subscription leak, not just wasted allocation. Checked exactly when every currently-arrived
     * key in `keys` is in `checkedKeys()` - `false` outright when `keys` has zero arrived members
     * (the vacuous-truth guard R8 calls for; `Array.every()` on an empty array is otherwise `true`).
     */
    private isKeysFullyChecked(keys: IslandKey[]): boolean {
        const arrivedKeys = feed.islands().map(islandToKey);
        const arrivedInGroup = keys.filter(key => keyIndexOf(arrivedKeys, key) !== -1);
        if (arrivedInGroup.length === 0) {
            return false;
        }
        const checked = this.checkedKeys();
        return arrivedInGroup.every(key => keyIndexOf(checked, key) !== -1);
    }

    /** KTD3/R8: same shape/rationale as `isIslandChecked` above, shared by "All Islands" and every
     * session heading - one computed per call site (the usual per-row-binding pattern), wrapping
     * `isKeysFullyChecked`. Real mutation happens in the row's own `click:` handler (`onGroupToggle`). */
    public isGroupChecked(keys: IslandKey[]): KnockoutComputed<boolean> {
        return ko.computed({
            read: () => this.isKeysFullyChecked(keys),
            write: () => { /* no-op: click: handler owns the real mutation via onGroupToggle */ }
        }).extend({ notify: 'always' });
    }

    /**
     * KTD3/R9-R12: click handler for a session heading or "All Islands" - `keys` is that group's
     * full member list (arrived or not; only arrived members ever participate below). If not
     * fully checked (per `isGroupChecked`'s own read logic), checks every arrived member not
     * already checked; if fully checked, unchecks every member, subject to R11's zero-guard (KD7:
     * absolute - a fully-checked group's own click can never itself empty the checked set, so once
     * it is the entirety of what's checked, this direction is permanently a no-op until the user
     * reduces selection some other way). Deactivates any active user Collection first (R12),
     * mirroring `onIslandClick`'s plain-click branch, so `syncActiveCollectionMembership` sees
     * `activeCollectionId() === undefined` and no-ops rather than treating this as a Collection
     * edit.
     */
    public onGroupToggle(keys: IslandKey[]): void {
        const arrivedKeys = feed.islands().map(islandToKey);
        const arrivedInGroup = keys.filter(key => keyIndexOf(arrivedKeys, key) !== -1);
        if (arrivedInGroup.length === 0) {
            return;
        }
        const checked = this.checkedKeys();
        const fullyChecked = arrivedInGroup.every(key => keyIndexOf(checked, key) !== -1);

        if (fullyChecked) {
            if (checked.length - arrivedInGroup.length <= 0) {
                // R11/KD7: would drop the checked count to zero - permanently a no-op for a
                // fully-checked group until the user reduces selection elsewhere. Same DOM-resync
                // escape as onIslandClick's own R7 guard - the browser already flipped the native
                // checkbox before this handler ran.
                this.checkedKeys.valueHasMutated!();
                return;
            }
            this.pendingRestoreSnapshot = undefined;
            this.activeCollectionId(undefined);
            this.checkedKeysExplicitlyFullFromGroupToggle = false; // no longer fully checked.
            this.checkedKeys.remove(k => keyIndexOf(arrivedInGroup, k) !== -1);
        } else {
            this.pendingRestoreSnapshot = undefined;
            this.activeCollectionId(undefined);
            const toAdd = arrivedInGroup.filter(key => keyIndexOf(checked, key) === -1);
            if (toAdd.length > 0) {
                this.checkedKeys.push(...toAdd); // single notification (mirrors handleMessage's batching).
            }
            // KTD6 refinement: this is the one deliberate "select this whole group" gesture that
            // arms growCheckedGroupsOnArrival - see checkedKeysExplicitlyFullFromGroupToggle's doc.
            this.checkedKeysExplicitlyFullFromGroupToggle = true;
        }
    }

    /**
     * U4: template-friendly wrapper around `isGroupChecked`/`onGroupToggle` for "All Islands"'s
     * row. Deliberately does NOT precompute a keys array and pass it into `isGroupChecked` -
     * `feed.islands()` is read live inside `read`/at call time instead, so the checkbox stays
     * correct as new islands arrive without needing the sidebar to re-bind the row (which never
     * happens for "All Islands," since it is one fixed row, not part of any `foreach`).
     */
    public isAllIslandsChecked(): KnockoutComputed<boolean> {
        return ko.computed({
            read: () => this.isKeysFullyChecked(feed.islands().map(islandToKey)),
            write: () => { /* no-op: click: handler owns the real mutation via onAllIslandsToggle */ }
        }).extend({ notify: 'always' });
    }

    public onAllIslandsToggle(): void {
        this.onGroupToggle(feed.islands().map(islandToKey));
    }

    /**
     * U4: template-friendly wrapper for a session heading's row, keyed by `sessionGuid` (a stable
     * primitive, safe to capture once at bind time) rather than a precomputed `IslandKey[]`. Looks
     * up the current `SessionGroup` from `sessionGroups()` fresh on every read/call - both
     * `sessionGroups()` and `group.islands()` are reactive reads, so this computed correctly
     * re-tracks both the group's own existence and its live membership.
     */
    public isSessionGroupChecked(sessionGuid: number): KnockoutComputed<boolean> {
        return ko.computed({
            read: () => {
                const group = this.sessionGroups().find(g => g.sessionGuid === sessionGuid);
                return group ? this.isKeysFullyChecked(group.islands().map(islandToKey)) : false;
            },
            write: () => { /* no-op: click: handler owns the real mutation via onSessionGroupToggle */ }
        }).extend({ notify: 'always' });
    }

    public onSessionGroupToggle(sessionGuid: number): void {
        const group = this.sessionGroups().find(g => g.sessionGuid === sessionGuid);
        if (group) {
            this.onGroupToggle(group.islands().map(islandToKey));
        }
    }

    /** "All" first, always present, followed by every distinct category actually represented
     * across every checked island's rows() (R8: union, not just one island), sorted by their order
     * in window.params.productFilters (except All is always first). Zero checked islands yields
     * just `['All']`, same fallback as the old zero-island case. */
    public readonly categories: KnockoutComputed<string[]> = ko.pureComputed(() => {
        const islands = this.checkedIslands();
        if (islands.length === 0) {
            return ['All'];
        }
        const seen: string[] = [];
        for (const island of islands) {
            for (const row of island.rows()) {
                const category = row.identity.category;
                if (seen.indexOf(category) === -1) {
                    seen.push(category);
                }
            }
        }

        const resolveLocaText = (locaText: any, fallbackName: string): string => {
            if (locaText) {
                const lang = currentLanguage();
                const localized = locaText[lang];
                if (localized) {
                    return localized;
                }
                const english = locaText['english'];
                if (english) {
                    return english;
                }
            }
            return fallbackName;
        };

        const params = window.params;
        const ordered = params && Array.isArray(params.productFilters)
            ? params.productFilters.map((f: any) => resolveLocaText(f.locaText, 'Other'))
            : [];

        seen.sort((a, b) => {
            const idxA = ordered.indexOf(a);
            const idxB = ordered.indexOf(b);
            const rankA = idxA === -1 ? Infinity : idxA;
            const rankB = idxB === -1 ? Infinity : idxB;
            return rankA - rankB;
        });

        return ['All', ...seen];
    });

    public readonly selectedCategory: KnockoutObservable<string> = ko.observable('All');

    /**
     * Backing store for `filteredRows` below - persists across recomputes (never cleared/replaced
     * as a whole) so a merged row's identity is stable across ticks. Code-review finding: an
     * earlier version built a brand-new `Map`/`MergedRowViewModel`/`ko.observable`s inside the
     * `pureComputed` itself; since `filteredRows` depends on every checked island's every row
     * observable, a single SSE tick updating one product's `generation()` on one island recomputed
     * the *entire* merged set with all-new object references, and `<tbody data-bind="foreach:
     * filteredRows">` diffs by object identity - so every row's DOM (including `<img>` icons) was
     * torn down and rebuilt on every tick instead of only the changed cells updating in place.
     * Mirrors this codebase's own KTD8/aggregate-mode invariant elsewhere: update values in place,
     * never swap the identity of what a `foreach` iterates unless membership itself changed.
     */
    private readonly mergedRowsByGuid = new Map<number, MergedRowViewModel>();

    /**
     * R8/KTD3: merges every checked island's rows() into one row per distinct `productGuid`,
     * summing generation/consumption/perfectGeneration/perfectConsumption/buildings across all
     * checked islands that report that guid (see `sumAcrossCheckedIslands`). `identity` is
     * re-resolved via `resolveProduct(guid)` (deterministic, same as `statistics-feed.ts`'s
     * `createRow`) rather than copied from a specific contributing row, since which row is "first"
     * no longer matters once rows are kept identity-stable. Derived view (KTD8) - never mutates any
     * island's own `rows()` array; existing `MergedRowViewModel`s are updated in place (their
     * observables re-set) rather than replaced, and `mergedRowsByGuid` is pruned only for guids no
     * longer present in any checked island (e.g. after narrowing the checked-island set).
     */
    public readonly filteredRows: KnockoutComputed<MergedRowViewModel[]> = ko.pureComputed(() => {
        const category = this.selectedCategory();
        const islands = this.checkedIslands();

        const guidsPresent = new Set<number>();
        for (const island of islands) {
            for (const row of island.rows()) {
                guidsPresent.add(row.productGuid);
            }
        }

        for (const guid of this.mergedRowsByGuid.keys()) {
            if (!guidsPresent.has(guid)) {
                this.mergedRowsByGuid.delete(guid);
            }
        }

        for (const guid of guidsPresent) {
            const generation = sumAcrossCheckedIslands(islands, guid, r => r.generation());
            const consumption = sumAcrossCheckedIslands(islands, guid, r => r.consumption());
            const perfectGeneration = sumAcrossCheckedIslands(islands, guid, r => r.perfectGeneration());
            const perfectConsumption = sumAcrossCheckedIslands(islands, guid, r => r.perfectConsumption());
            const buildings = sumAcrossCheckedIslands(islands, guid, r => r.buildings());

            const existing = this.mergedRowsByGuid.get(guid);
            if (existing) {
                existing.generation(generation);
                existing.consumption(consumption);
                existing.perfectGeneration(perfectGeneration);
                existing.perfectConsumption(perfectConsumption);
                existing.buildings(buildings);
            } else {
                this.mergedRowsByGuid.set(guid, {
                    productGuid: guid,
                    identity: resolveProduct(guid),
                    generation: ko.observable(generation),
                    consumption: ko.observable(consumption),
                    perfectGeneration: ko.observable(perfectGeneration),
                    perfectConsumption: ko.observable(perfectConsumption),
                    buildings: ko.observable(buildings)
                });
            }
        }

        let rows = Array.from(this.mergedRowsByGuid.values());
        if (category !== 'All') {
            rows = rows.filter(row => row.identity.category === category);
        }

        const getProductRank = (guid: number) => {
            const params = window.params;
            if (!params || !Array.isArray(params.productFilters)) {
                return Infinity;
            }
            for (let fIdx = 0; fIdx < params.productFilters.length; fIdx++) {
                const filter = params.productFilters[fIdx];
                if (Array.isArray(filter.products)) {
                    const pIdx = filter.products.indexOf(guid);
                    if (pIdx !== -1) {
                        return fIdx * 1000 + pIdx;
                    }
                }
            }
            return Infinity;
        };

        const sorted = rows.slice();
        sorted.sort((a, b) => {
            const rankA = getProductRank(a.productGuid);
            const rankB = getProductRank(b.productGuid);
            if (rankA !== rankB) {
                return rankA - rankB;
            }
            return a.productGuid - b.productGuid;
        });

        return sorted;
    });

    /** KTD7: each bar scales against that row's own perfect-reference value, clamped to [0,100],
     * 0 when the perfect reference is 0 or invalid (avoids a divide-by-zero / NaN width). */
    public barWidthPercent(current: number, perfectReference: number): number {
        if (!perfectReference || perfectReference <= 0) {
            return 0;
        }
        const percent = (current / perfectReference) * 100;
        return Math.max(0, Math.min(100, percent));
    }
}

const viewModel = new StatisticsViewModel();
(window as any).statisticsView = viewModel;

// The bundle's <script> tag is loaded from <head> (KTD2, mirrors index.html), which runs before
// <body> - and #statistics-root - exist. Defer DOM-dependent setup (applyBindings, the tab event
// listener) to $(document).ready(), same pattern as main.ts:692's own document-ready wrapper.
$(document).ready(() => {
    const root = document.getElementById('statistics-root');
    if (root) {
        ko.applyBindings(viewModel, root);
    } else {
        console.error('[statistics] #statistics-root not found - ko.applyBindings skipped');
    }

    // Bootstrap's own tab.js owns the click -> show/active DOM toggling for the category buttons
    // (data-toggle="tab"); a manual click: binding on those buttons would interfere with that (see
    // templates/AGENTS.md's explicit warning). Instead, listen for Bootstrap's own "shown.bs.tab"
    // event (delegated, so it also covers buttons added later as `categories` grows) and sync
    // `selectedCategory` from the activated button's `data-category` attribute.
    $(document).on('shown.bs.tab', '#statistics-category-tabs button[data-toggle="tab"]', (event: any) => {
        const category = $(event.target).attr('data-category');
        if (category) {
            viewModel.selectedCategory(category);
        }
    });
});
