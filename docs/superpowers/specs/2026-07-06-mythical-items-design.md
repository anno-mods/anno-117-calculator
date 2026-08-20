# Mythical (Villa-allocation) Items — Design

## Context

Anno 117's playtest data introduces 30 `ItemWithBoost` assets with `Item.Rarity == "Mythic"` and `Item.Allocation == "Villa"`. All specialist items can be equipped in the Villa, but Mythic-rarity ones additionally carry an `Item.MythicEffect` — a separate `Effect` asset granting an island-wide ability, distinct from the item's normal per-building adjacency effect (which is already the same shape as the other ~154 items the calculator already models via `ItemConfig`/`targets`/per-factory equip checkboxes).

The calculator currently ships 16 Mythic items but only extracts their base adjacency buff — `Item.MythicEffect` is never read by the conversion pipeline, and there is no schema support for the mechanics these island-wide effects use.

## Scope

Of the 30 Mythic+Villa items, `Item.MythicEffect` resolves to one of two shapes:

- **26** via `EffectScope: ObjectsInArea` → a `BuildingBuff` on a specific residence tier (genuinely island-wide, residence-facing)
- **4** via `EffectScope: Area` → an `AreaBuff` (passive-trade sell bonuses, periodic limited-yield ore deposits, festival-duration bonus) — a structurally unrelated mechanism (no calculator precedent for trade/lode mechanics). **Out of scope.**

Of the 26 `ObjectsInArea` items, classified by whether they touch production/needs math (the calculator's existing relevance bar — it already ignores non-Population attribute bonuses everywhere else):

- **18 in scope** (production-relevant):
  - Adds a new need (`ResidenceUpgrade.AdditionalNeedsDemand`): 160497, 160507, 160516, 160519, 160531, 160534
  - Factory output/productivity bonus: 160054, 160060, 160081, 160500, 160510
  - Population bonus: 160054 (also output), 160090, 160525
  - Maintenance/workforce cost change: 160048, 160051, 160057, 160488, 160513
- **8 out of scope**: 6 stat-only items (flat Belief/Happiness/Prestige/Knowledge/FireSafety bonuses, no production interaction: 160066, 160072, 160078, 160087, 160093, 160522) and 2 outside the calculator's domain entirely (160075 unit-recruitment speed, 160491 public-order "Resolver" capacity). These still exist in-game and are equippable, but the calculator will not compute an effect for them (consistent with how non-Population attributes are invisible everywhere else in the app today).

**Additionally in scope**: wiring up `ConsumptionModifierInPercent`/`GoodConsumptionUpgrade` (reduced consumption) generically for all buffs, not just these 18. This field is already detected by the conversion notebook (`unhandeled_paths` in `conversion_calculator.ipynb`, logged as "not handled" and silently dropped) and has dead scaffolding on the TypeScript side (`ResidenceEffectEntry.consumptionModifier` in `consumption.ts:300`, `PublicConsumerBuilding.goodConsumptionUpgrade` in `factories.ts:453`, both never populated). None of the 18 items in scope actually use it, but the plumbing is being touched anyway and the gap affects other existing/future buffs.

## Architecture

### 1. Data extraction (`asset-extractor`, `assetextractor/conversion/calculator/conversion_calculator.ipynb`)

Extend the item-extraction cell (currently only reads `asset.Effect`, the base adjacency effect) to additionally follow `Item.MythicEffect` for the 18 in-scope GUIDs, resolving `Effect.Targets` (residence tier GUIDs) and `Effect.Buffs` (the `BuildingBuff` GUID) the same way existing tech/festival/patron effects are resolved into `EffectConfig` entries. Each is emitted as an `EffectConfig` (not an `ItemConfig` entry) with `source: 'mythical-item'`.

Rationale: `Item.MythicEffect` targets residence tiers island-wide and needs a single island-scoped on/off toggle — exactly the shape of the existing `Effect`/`AppliedBuff`/`Island.availableEffects` mechanism already used for tech, festival, veneration, and session-event effects (`world.ts:896`, `world.ts:546`). It is not a per-building equip like the existing `Item` class (`production.ts:923-1000`), so it does not belong in that pipeline.

### 2. New `BuildingBuffConfig` fields (`src/types.config.ts:230-260`)

```typescript
export interface BuildingBuffConfig {
  // ...existing fields...
  additionalNeedsDemand?: number[];       // need GUIDs this buff adds to the target residence
  providedNeedUpgrade?: number[];         // need GUIDs this buff satisfies for free
  consumptionModifierInPercent?: number;  // new: wires up the existing dead consumptionModifier stub
  goodConsumptionUpgrade?: { need: number; product: number; amountOrPercent: number }[];
}
```

Corresponding fields added to the runtime `Buff`/`AppliedBuff` classes (`production.ts`, `buffs.ts`), following the existing pattern for `baseProductivityUpgrade`/`productivityUpgrade` (scaled by `AppliedBuff.scaling()`).

### 3. New-need mechanism

`ResidenceBuilding.needsMap` is built once, statically, from `config.needsList` (`population.ts:85-91`) — there is no runtime path to inject a map entry, and none is being added. Instead, for the 6 `AdditionalNeedsDemand` items, the target need is added to the residence tier's static `needsList` at extraction time (`ResidenceBuildingConfig.needsList`, `types.config.ts:136-139`), tagged with a new per-entry field:

```typescript
needsList: {
  need: number;
  needConsumptionRate?: number;
  requiresItem?: number;  // guid of the mythical-item Effect that must be scaling()==1
}[];
```

At runtime, `PopulationLevelNeed`/`ResidenceNeed` visibility (`consumption.ts`) is extended: if `requiresItem` is set, the need's `hidden`/`available` computed additionally checks `residence.island.availableEffects().find(e => e.guid === requiresItem)?.scaling() === 1`, in addition to the existing DLC-availability check. This is modeled on the existing "need hidden until unlocked" shape (DLC-gated needs, the "Activate need" button from Release 2.0) but is a distinct mechanism — the trigger is a user-toggled `Effect.scaling`, not DLC ownership (`NamedElement.dlcUnlocks`/`available`, `util.ts:325-342`, which is DLC-specific and not reused as-is).

### 4. UI (`templates/effects-dialog.html`)

No new dialog. Extend the existing effects table (`effects-dialog.html:13-52`, driven by `Island.availableEffects`):
- Add a text search input filtering rows by `name()` (case-insensitive substring)
- Add a source filter (dropdown or button group) over the existing `source` field (`getSourceText()`, `production.ts:699-737`) so users can narrow to `mythical-item` among tech/festival/patron/session entries
- `mythical-item` added as a new source-to-translation-key mapping alongside `module`/`tech`/`festival`/`veneration-effect`/`session-event`/`island-event`

Persistence unchanged — reuses the existing island-effect pattern: `island.effect.${effectGuid}.scaling` (`AGENTS.md` "Island Effects" section).

## Out of scope for this pass

- The 4 `AreaBuff` items (passive trade, lode generation, festival duration) — different template family, no existing calculator precedent
- The 6 stat-only + 2 out-of-domain items — remain unequippable-with-effect in the calculator; no UI changes needed for them specifically since the search/filter list only shows entries the pipeline actually emits
- Villa slot count / attractiveness modeling — not modeled, per existing project scope (the calculator does not model building placement or slot capacity anywhere)
- The item's own per-building adjacency effect chain (the non-`MythicEffect` part) for these 18 items — same mechanism as the other ~154 items already shipped, no new work

## Testing plan

1. Re-run `conversion_calculator.ipynb` top to bottom — confirm the 18 items emit `EffectConfig` entries with `source: 'mythical-item'` in `params.js`. Ensure you use the runtime environment of the asset-extractor.
2. Confirm the 6 `AdditionalNeedsDemand` items' target residence tiers gain the new need in `needsList` with `requiresItem` set correctly
3. Open the calculator, toggle a `mythical-item` effect on in the effects dialog:
   - For a needs-adding item: verify the new need appears on matching residences and drives demand
   - For a productivity/population item: verify the existing buff-application path applies it correctly
4. Verify text search and source filter narrow the effects list correctly, including with 0 matches
5. Verify `consumptionModifierInPercent`/`goodConsumptionUpgrade` reduce demand correctly on an existing buff that sets them (need to find or synthesize a test fixture, since none of the 18 in-scope items use it)
6. Run existing Playwright suite (`npm run build ; npx playwright test --reporter=list`) to confirm no regressions in effects-dialog or population/needs tests

## Open questions / risks

- The 6 needs-adding items each target one specific residence tier (e.g. "Alderman Residence"). Need to confirm that tier's `ResidenceBuildingConfig.needsList` is the correct injection point across all regions where that tier appears, and that "All Islands" aggregation handles a conditionally-visible need correctly (existing DLC-gated needs already exercise this path, so risk should be low but needs a targeted test).
- `additionalNeedsDemand`/`providedNeedUpgrade` are structurally similar (both a need GUID list on a buff) — worth confirming during implementation whether they can share one runtime code path or need to stay distinct (provided-need-upgrade means "satisfy for free," not "add a new demand").
