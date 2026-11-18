# Live Statistics Page - Island Selection - Design

**Status:** Approved, implementation in progress.
**Prior art:** `docs/plans/2026-08-10-001-feat-live-statistics-page-plan.md` (the original plan this corrects/extends).

## Correction to the original plan's assumption

The original plan (and the shipped U1-U5 implementation) assumed the `anno-117-pipe` SSE feed streams data for a single island per connection. That assumption is wrong: the pipe round-robins through **all** of the player's islands, sending one island's `AreaProductionStatistics` roughly every second, interleaved on the same stream (confirmed in `../anno-117-pipe/docs/example_responses.txt` - messages for `Juliana`, `Nusquam`, `Zycada`, `Cinis`, `Tiberia`, `Valerium`, `Aeterna`, `Cudslip`, `Cragmore`, `Argantum` arrive one after another on one connection, each with its own `areaName`/`sessionId`).

The shipped client (`src/statistics-feed.ts`) keys rows in one global `rowsByGuid: Map<number, RowViewModel>` by `productGuid` alone and overwrites `areaName`/`sessionIdentity` on every message. Today, rows from different islands with the same `productGuid` silently collide, and the header flickers between island names every second. This design fixes that and adds island selection.

## Decisions made during brainstorming

1. **Buffer all islands simultaneously**, not just the selected one. Switching islands is instant; memory cost is proportional to island count x product count, which is cheap for a player's realistic island count.
2. **Key islands by `areaName` alone** (not `areaName` + `sessionId`). Matches the pipe's own internal grouping (`calculator-integration.md`: "`areaName` - used today as the top-level grouping key"). Assumes island names are unique within a play session.
3. **Mirror the main calculator's own island switcher** (`index.html:136-142`, `$root.island`/`$root.islands`) for the selection UI, option labels, and ordering, rather than inventing a new pattern.
4. **Auto-select the first island seen**, then sticky - never reassigned by later-arriving islands. Matches `$root.island` never being silently reassigned in the main app.
5. **No persistence of the selection across reload.** This is the one deliberate divergence from the main calculator (which does persist `$root.island`): the approved plan's R3 ("MUST NOT persist ... other page state") already forbids it, and this design doesn't reopen R3.

## Data model (`src/statistics-feed.ts`)

Replace the single global `rowsByGuid`/`rows`/`areaName`/`sessionIdentity` with per-island state:

```typescript
export interface IslandFeedState {
    readonly areaName: string;
    sessionIdentity: KnockoutObservable<string | number | undefined>;
    rows: KnockoutObservableArray<RowViewModel>;
}
```

- `StatisticsFeed` gains `islands: KnockoutObservableArray<IslandFeedState>` (first-seen order, append-only - same "never reorder the underlying array" discipline the row array already follows) and a private `Map<string, IslandFeedState>` (`islandsByAreaName`) for O(1) lookup, mirroring the existing `rowsByGuid` pattern.
- Each `IslandFeedState` keeps its own private `rowsByGuid: Map<number, RowViewModel>` (not exposed) so entry-to-row resolution stays scoped per island.
- `handleMessage` finds-or-creates the `IslandFeedState` for `payload.areaName`; a message with no valid (non-empty string) `areaName` is dropped entirely - there's nothing to attribute it to. The per-entry coercion logic (`toNumberOrZero`/`toIntOrZero`, R14) is unchanged, just scoped to that island's own row map instead of a global one.
- `connectionState` stays feed-wide (unchanged) - it describes the SSE transport, not any one island.
- Newly-created `IslandFeedState`s are pushed to `islands` the same way new rows are pushed to an island's `rows` today: collected during message processing, pushed once after the loop (there is normally at most one new island per message, but the batching keeps the code path uniform with the existing row-batching rationale).

## Selection & ordering (`src/statistics.ts`)

- `StatisticsViewModel` gains `selectedAreaName: KnockoutObservable<string | undefined>`.
- Auto-select: a subscription on `feed.islands` selects the first island's `areaName` the moment the array goes from empty to non-empty. Once set, nothing else in this page ever reassigns it - only the viewer's own dropdown interaction does.
- `sortedIslands: KnockoutComputed<IslandFeedState[]>` - a `pureComputed` over `feed.islands()`, never mutating the underlying array (KTD8), sorted by:
  1. The index of the island's resolved session guid within `window.params.sessions` (mirrors `view.sessions.indexOf(...)` in `world.ts`'s `sortIslands()`); islands whose session doesn't resolve (KTD4) sort last - there is no "All Islands" pseudo-entry on this page, so no special-case needed for it.
  2. `areaName.localeCompare()` within the same session index (mirrors `world.ts`'s tiebreaker).
- Dropdown option label mirrors `sessionExtendedName()` (`world.ts:637`): `` `${resolvedSession.name} - ${areaName}` `` when `resolveSession(island.sessionIdentity())` resolves, else the raw `areaName` alone (KTD4's existing graceful-degrade pattern, reused as-is).
- `areaName`, `sessionInfo`, `categories`, and `filteredRows` all repoint from the removed feed-wide `rows`/`areaName`/`sessionIdentity` to the **selected** `IslandFeedState`'s own `rows`/`areaName`/`sessionIdentity` (looked up from `feed.islands()` by `selectedAreaName()`). When nothing is selected yet (before the first island arrives), these fall back to the same empty/undefined state the page renders today before any data has arrived.

## UI (`statistics.html`)

- New `<select class="custom-select" data-bind="value: selectedAreaName, options: sortedIslands, optionsText: ..., optionsValue: 'areaName', visible: feed.islands().length > 1">`, placed in the header row next to the existing Connect button/indicator - same control shape as `index.html:139`'s island `<select>`, including the `length > 1` visibility gate (`index.html:136`) so a single-island session shows no picker at all.

## Docs

- This spec file (written now).
- `../anno-117-pipe/docs/live-statistics-server-handoff.md`: correct the single-island framing throughout, and add a flagged (not resolved) data point to §3.1 - `example_responses.txt` shows `sessionId` varying *between islands within one continuous connection* (`1` for several islands, then `3` for later ones in the same capture), which sits oddly against that repo's own doc description of `sessionID` as "distinguishes reconnects within one game run." Flagged back to that repo to interpret, not resolved here.

## Testing

Existing `tests/computed/statistics-row-model.spec.ts` and `tests/computed/statistics-connection-state.spec.ts` cover the old single-island shape and need updating for per-island state (multiple islands' entries in the same test session must not collide; connection-state tests are unaffected since that stays feed-wide). New coverage needed: island discovery/ordering, auto-select-then-sticky behavior, and the dropdown's visibility gate - following the same `tests/computed/` (data model) / `tests/binding/` (template) split the original plan used.
