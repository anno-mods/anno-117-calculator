# Exchange format import and export

The calculator exports and imports the tool-neutral Anno 117 exchange format next to its own config dump
(`Anno117CalculatorConfig.json`). The dump export and the old import (`#config-selector`) work as before and stay the way
to move a plain localStorage copy. The exchange format is for sharing with other tools (planner, layout tool, savegame
pipeline).

Code: `src/exchange/*`. Tests: `tests/exchange/*`. Specification, schema and fixtures: `vendor/anno117-exchange/`.

## Using it

Download dialog (navigation bar), row below the config buttons:

- **Export Exchange File** writes `anno117-exchange` JSON read from localStorage (flushed first). Entries the export
  dropped or approximated because the user changed data that a preserved copy depended on are listed in a report dialog.
- **Import Exchange File** imports at once with the scopes ticked under the button: Islands, Residences, Production
  buildings, Trade routes and suppliers, Modifiers. A sentence under the checkboxes names what the next import replaces,
  merges with the calculator's own entries and leaves alone. The icon toggles "keep my other islands" and "keep my other
  routes" keep the calculator-only entries of their scope; "re-calculate routes from savegame data" derives the supplier
  sets from the file's route data (see "Mapping rules", Trade) and is ignored while Trade is unticked. The ticks and toggles are device preferences (`calculatorSettings` keys
  `settings.importScope.<name>`): stored, restored on start, never exported or imported. No confirmation and no report are
  shown. The page reloads once and opens the Download dialog with an Undo button, which restores all stored data from
  before the import except device preferences (the label says that later edits are lost). A file that cannot be read at all
  is the only case that shows a message.
- Which scope owns a stored key is decided by `src/exchange/scopes.ts` (island-store keys, top-level keys,
  `calculatorSettings` keys and `exchange.ext` pointers), not by planner module. Keys without a scope (UI state, unknown
  keys) are never touched by a partial import. File islands are matched to calculator islands by `exchange.islandId`, by the
  game-island triple, then by name together with the session (`src/exchange/matching.ts`); with Islands unticked, only
  matched islands are imported and the others are counted in `MergeResult.skipped`. Five ticks and both keep toggles off
  take the unchanged clear-and-rewrite path; every other selection is planned for the whole file and merged by
  `src/exchange/merge.ts`. The factory fully-utilize key (`<factory>.buildings.fullyUtilizeConstructed`) belongs to Trade
  and is only overlaid, never removed, and written only where the island holds the factory.

Without a file dialog, `window.exchange` is the entry point for tests and debugging: `readExchange`, `planImport`,
`planScopedImport`, `mergeScoped`, `applyImport`, `buildDocument`, `exportDocument`, `computeSummary`, `islandId`,
`uniqueName`, `tables`, `planIslands`, `planTrade`, `planEffects`, `deriveImports`, `hasShipRoutes`, `classifyKey`,
`isDeviceSetting`, `assignIslandIds`, `readStoredIslands`, `matchIslands`, `undo` (`saveSnapshot`, `hasSnapshot`,
`clearSnapshot`, `restoreSnapshot`, `snapshot`).

## Vendored specification

`vendor/anno117-exchange/` holds the schema (`schema/anno117-exchange.schema.json`), the shared fixtures (`fixtures/valid`,
`fixtures/invalid`), `fixtures/MANIFEST.json` and `VERSION` (the specification commit). It is copied from the specification
repository with its `scripts/vendor.py`; do not edit it by hand. The bundle carries no schema validator: the runtime reader
(`src/exchange/reader.ts`) checks the envelope (format marker, major version, required keys, duplicate island ids) and
coerces or drops values of the wrong type with a problem entry. The full JSON Schema runs only in the tests, through the dev
dependency `ajv`.

A file with a newer major version is rejected. A newer minor version, unknown keys at any level, unknown generators,
unknown source kinds and unknown GUIDs are accepted and kept.

## Stored data the feature adds

| Key | Where | Content |
| --- | --- | --- |
| `exchange.islandId` | island store | Stable opaque island id. Assigned on first export (or on import from the file), kept on rename, removed with the island. |
| `exchange.ext` | island store | Island-level data the calculator does not model or does not know: unknown fields, `itemHolders`, `itemStorage`, `moduleAttachments`, unknown GUID entries, preserved import entries, minimum stock, `materials`, original name, `ext.calculator`. |
| `exchange.ext` | top-level localStorage key | Document-level data: unknown fields, islands that cannot be loaded (`orphans`), `account`, `unlocatedItems`, `trade.routes`, `visits`, governor harbours, `history`, `live`, `research`, `effects`, `settings` leftovers. |
| `exchange.justImported` | sessionStorage, one reload | Set by a committed import that reloads; the bootstrap removes it and opens the Download dialog. |
| `exchange.undoSnapshot` | sessionStorage, tab session | All stored data from before the last import, for Undo. Never in localStorage, never exported; the next import replaces it. |

On export the preserved data returns to its original location in the document; only extension data stays under `ext`.
Edits win: a value the user changed in the calculator replaces the preserved copy, and preserved entries that name a
deleted island (route stations, visits, history, live, supplier references) are removed and counted. Deleting an island
deletes its preserved data with its store.

## Import

`planImport(text)` is a pure function: it reads the file, builds the complete map of raw localStorage keys and the report
(`ImportPlan.report`, read by tests and diagnostics; no dialog shows it), and touches no storage. The file is always
planned as a whole. `planScopedImport(text, selection)` is what the Download dialog calls: with five ticks and both keep
toggles off it returns the `planImport` result unchanged (clear-and-rewrite); with any other selection it matches the
file's islands to the stored ones (`matching.ts`), plans the whole file with that context and lets `mergeScoped`
(`merge.ts`) choose, key by key, the stored or the planned value by the scope that `scopes.ts` assigns to the key. The
returned key map is everything the calculator holds after the import; `skipped` lists the file islands that were not
imported. Merge rules worth knowing:

- Islands unticked: only file islands that match a stored island are imported, the others are skipped. With Islands ticked
  and "keep my other islands" on, the calculator-only islands stay.
- The aggregate store `All Islands` is overwritten only when all five scopes are ticked.
- Calculator settings: a DLC flag `"1"` is applied with any selection (the planned content needs the DLC); a DLC flag
  `"0"`, `settings.volcano`, difficulty and the other Modifiers keys of `calculatorSettings` only with Modifiers ticked.
  `globalEffects` and `sessionSettings` (including the volcano level scales and `volcano.unlocked`) are replaced as a
  whole with Modifiers ticked and untouched otherwise.
- `exchange.ext` is merged per member: preserved content of a scope returns with its scope, and the `restore` snapshots of
  preserved import entries are refreshed when routes or the passive amount are kept next to them.

`applyImport(plan)` replaces the stored data atomically:

1. the previous localStorage content is snapshotted in memory;
2. every JSON string of the key map is validated;
3. the storage is cleared and written in one pass (island stores as compact JSON);
4. any exception (quota exceeded, invalid JSON) restores the snapshot byte for byte and reports the failure, nothing reloads;
5. the sessionStorage flag `exchange.justImported` is set (only when the page reloads, or with `markImported: true`);
6. `location.reload()` runs once, last.

Before `applyImport`, the change listener of `#exchange-selector` (`main.ts`) stores a snapshot of all stored data under
`exchange.undoSnapshot` in sessionStorage (`undo.ts`). If the snapshot or the import fails, the record is removed and
Undo is not offered. Undo (`restoreSnapshot`) writes the snapshot back, keeps the device preferences of the moment, drops
the record and reloads; later edits are lost.

Device preferences survive an import and an undo: the `language` setting, the scope ticks and toggles
(`settings.importScope.*`, `isDeviceSetting`) and `darkMode.checked` are merged back. `versionCalculator` is always
written, so an import never looks like a first run.

Islands get unique display names; a name that collides with another island or a reserved storage key gets a numeric suffix
and the original name stays in the island's `exchange.ext`. An island whose session GUID the calculator does not know
(a later DLC region) is not written as a store, because the app would not start; it stays in the top-level
`exchange.ext.orphans` with all its data and is written back on export.

### Report

`ImportPlan.report` has four lists: carried through (kept and written back), not mapped (kept, not applied), approximated
(applied with a difference) and not provided (absent in the file). Typical entries: unknown GUIDs, item records per place,
per-instance module attachments, governor suppliers, `routes` and `imports` that disagree (`imports` wins), a local
producer fully utilized because of a received good, DLCs switched on because of the file's content (`dlc-enabled`), DLCs
written `"0"` because the list omits them (`dlc-not-listed`), volcano scales clamped to 5 (`volcano-level-clamped`). An
import shows none of them; tests and diagnostics read them. The only dialog is the export report, which lists entries the
export dropped or approximated. A file that cannot be read at all is the one import message (Download dialog).

### Mapping rules worth knowing

- Needs: only `disabledNeeds` entries are written (`<level>[<need>].checked` = "0"). Every other need keeps its default (on).
  A DLC switched on after the import turns the unlisted needs of that DLC on and keeps a listed need off.
- DLCs (owned DLCs, DLC-gated content): the file identifies a DLC by its number (`settings.dlcs`: 1 Prophecies of Ash, 2 The
  Hippodrome, 3 Dawn of the Delta); the calculator maps each number to the entry of `params.dlcs` whose id matches
  `DLC<nn>_...` (`dlcNumber` in `keys.ts`), for every DLC in the params, not a fixed list. Import writes `"1"` for a listed DLC
  and `"0"` for one the list omits (`dlc-not-listed`); a number without a params entry is kept in `ext.settings` and written
  back on export, unless a later params release maps it, then the stored flag decides. A file without `settings.dlcs`
  leaves the calculator's own DLC choice. A DLC that the file's content needs is on whatever the list says: a count for a
  building of that DLC, a researched item or an active effect of it (`DLC.used`, report `dlc-enabled`); the first
  re-export lists it. With Modifiers unticked an import never switches a DLC off (see "Import"). Export writes
  `settings.dlcs` whenever any DLC flag is stored, and omits it otherwise, so an absent list states nothing about
  ownership. Counts of residence buildings are not checked for a DLC. Needs of a DLC: see "Needs". Regions and sessions of
  a DLC the calculator does not know are kept as orphans (see "Import"); no further region handling exists.
- Volcano (volcano level, unlocked volcano effects): the level is the shared scale of Obsidian Gathering 145095, Obsidian
  Mining 148043 and Fertile Soil 145099 in the Latium (3245) and Meta (37135) sessions, the same keys
  `session.<session>.effect.<effect>.scaling` the effects dialog edits. A scale in `effects.bySession` is the active level
  at full time share; `settings.volcano.durations`, `phase` and unknown keys are kept byte for byte and not applied. A
  `settings.volcano` `level` is written to the effects it lists and 0 to the others, unless `effects.bySession` states the
  effect (then the effect wins and `volcano-effects-disagree` is reported); `enabled: false` writes 0 to all three. A
  scale above 5 is written as 5 and reported (`volcano-level-clamped`); other effects are not clamped. The effects the
  file states above 0 (or the list of a switched-off setting) become the unlocked set, stored as `volcano.unlocked` in
  `sessionSettings`. Export derives `level` (largest scale) and `effects` (those above 0) and never writes level 0: with
  every scale 0 it writes `enabled: false`, keeps a preserved `level` and `durations`, and lists the stored unlocked set as
  `effects`; the three effects are then exported with scale 0 so that a calculator round trip keeps the set.
  The settings dialog has one level selector (0 to 5) under Prophecies of Ash while that DLC is on
  (`src/dlc-settings.ts`, `templates/dlc-settings.html`): level 0 sets all scales to 0 and keeps the set, a higher level
  applies to the unlocked set and leaves the other effects at 0, and a profile without a set unlocks all three. Any scale
  above 0 adds its effect to the set. Mixed scales show no pressed level and one row per effect. Master view mode sets all
  three effects to 5.
- Trade: `imports` become trade routes by the residual-supplier rule (default flag, else largest share, ties by the lexically
  smallest island id). The `amount` of an island supplier is a floor (`userSetAmount`, the calculator supplies
  `max(userSetAmount, amount)`, so a surplus over the demand counts as excess production) only in an entry with
  `basis: "entered"`. In every other entry the amount is a planner cap or share: the route gets floor 0 and the entry is kept
  in `exchange.ext` (`amount-kept`), so export writes the planned amount again while routes, default supplier and passive
  amount equal the import; a floor the user sets afterwards exports as `amount` and the export report names the dropped
  entry (`import-entry-dropped`). `routes`, `visits` and `minimumStock` are preserved. With the toggle "Re-calculate routes
  from savegame data" and at least one ship on the file's `routes` (`hasShipRoutes`, no source signal is read) the supplier
  sets, residual suppliers and floors come from the route data (`derive-routes.ts`, the candidate derivation of the
  specification, no amounts); governor, non-player and passive suppliers and the entered amounts of `basis: "entered"`
  entries still come from `imports`. A route that collects a good at several islands gives the receiver one route per
  source island. After the import reloads the page, `src/trade-allocation.ts` splits the receiver's demand across these
  routes once: the source that can give most (built capacity plus extra goods, minus its own demand without routes)
  stays or becomes the default supplier, every other source gets a floor of demand times its share of the summed
  surplus, or its full surplus when the demand exceeds the summed surplus. Groups with a floor set by hand are left alone;
  the button "Recompute shares" in the trade routes dialog updates the floors of every multi-source group, replaces
  hand-set floors and keeps each group's default supplier. A producer named in `products[].producer` that the island has
  built (`buildings[].built > 0`) stays the default supplier; an import of that product is written as an ordinary route
  (`factory-default-kept`), because a factory that is not the default supplier would not run and neither would its extra
  goods. The allocation then gives such a route a fixed amount only for the demand the factory's built capacity cannot
  cover, split across the routes by the surplus of their sources. Routes the calculator keeps (keep my other routes) take part in the default-supplier
  cycle check; a route of a (product, receiver) pair the file produces is replaced. A partial Trade import that leaves
  routes or a passive amount next to a preserved entry refreshes the entry's snapshot, so the export keeps the entry and
  lists the kept routes next to its suppliers. A local producer of a received good is fully utilized unless the
  file states `fullyUtilize: false`; the export states `fullyUtilize: false` explicitly for a producer the user left partly
  utilized, so a round trip does not switch it on.
- Governor supply: the `amount` of governor suppliers (`{governor: <GUID>, amount}`) of an import entry is summed into
  `<product>.governorSupply` (t/min, per product and island). It counts as production next to the passive supplier, so the
  default supplier's demand drops by it; it creates no route, never changes the default supplier and takes no part in the
  residual-supplier choice. A governor without `amount` supplies nothing. Each applied governor appears in the report as
  `governor-supply-applied`. On export the governor suppliers return in the entry they came from, with identity and unknown
  fields, always; the original list position holds while routes, default supplier and passive amount equal the import,
  otherwise the governor suppliers follow the island suppliers (without a `default` flag). When the governor supply of the
  product differs from the imported value, or the product's default supplier changed, their `amount` is not exported
  (`governor-amount-not-exported` in the export report), because a changed total cannot be split among governors. The
  Trading tab of the product dialog shows a governor supply row while the value is positive. A supplier `max` and
  `governorHarbours` are preserved unchanged and not applied.
- Construction materials: an end factory of a material is fully utilized (explicit `fullyUtilize` on export).
- Discoveries and effects come from a table built from `params.techs` and `params.effects`; the four dormant area-buff keys are
  never written.
- Range effects: each `islands[].appliedEffects` entry writes the per-building state `<type>[<effect>].scaling` (1 for
  `applied: true`, 0 for `false`) for a building-sourced effect that targets the type; a fractional `share` is applied by the
  flag and reported (`applied-effect-approximated`), other entries are reported (`applied-effect-not-applied`). The list stays
  kept whole, so `scale` and `method` return on export. `wonders` are kept and written back unchanged; the calculator has no
  wonder rank. Unknown effect GUIDs are kept. Effect 183157 (island event, Meta scope) is listed by no discovery: it is applied
  when `effects.global` states it and is never derived from `research.researched`, which explains its absence when only
  research is imported.
- Residences: a per-building count wins over a per-level count; `population` (residents per level, informational) is preserved and
  sets nothing.
- Residence items (`residenceItems`): an entry whose item is a villa item of the calculator (`isVillaItem` in
  `src/residence-items.ts`: allocation Villa, a residence target, a consumption or residents buff) stores the island state
  `residenceItem.<item>.state` (1, or 2 for `boosted: true` when the item has a boosted variant; a boost without a variant is
  written as 1 and reported). An item that has an island-wide effect (`heroicEffect`) also switches that island effect on
  (`island.effect.<effect>.scaling` = 1) unless the file states the effect itself; setting the item to Off never switches it
  off. A repeated item keeps the first entry as state. Entries of items the calculator does not know, of items that are no villa
  item and repeated entries are preserved at their list index and reported (`unknown-guid`, `residence-item-not-applied`,
  `residence-item-duplicate`). Export writes the stored states as `residenceItems` and returns the preserved entries.
- Coverage fields. `villaCoverage` (number, or `default` of an object) is stored as `villaCoverage` (0..100, default 100) and
  scales the radius buffs of residence items; export writes `{default: n}`; `byLevel` and `byResidence` are preserved and not
  applied. `residenceEffects` (`{level: {effect: percent}}`) is the share of a level's residences in range of an area effect
  (an effect of source `building` with residence targets): the leaf is stored as `<level>[<effect>].coverage` and multiplies the
  buff values of that effect on that level's residences, never the effect's 0/1 scaling. For an effect the file lists, the levels
  it does not list get 0, and the island effect is switched on when any level is above 0 unless `effects` states it (the report
  names an override). Export lists every level of the effect that has a stored share. `publicCoverages`
  (`{level: {public building: percent}}`) is stored as `<level>[<building>].publicCoverage` and `publicCoverage` as
  `publicCoverage`; the supply of a public need (a need with `isBuilding`) is multiplied by the largest listed share of the
  buildings that provide it (`params.publicServices[].providedNeeds`), else by `publicCoverage` (default 100). Values outside
  0..100 are clamped and reported. A leaf without an effect, building or level in the calculator's data, a non-number, and the
  spec shape (`default`, `byLevel`, `byResidence` at the top) are preserved at their pointer and reported
  (`area-effect-not-applied`, `public-coverage-not-applied`); without `params.publicServices` every leaf of `publicCoverages`
  is preserved.

## What is preserved but not applied

- Governor suppliers without an `amount`, a supplier `max`, and governor harbours (the calculator's
  `passiveTrade.userSetAmount` is one value shared by all products), the
  recorded `visits`, `routes` and `history` / `live` series, `<residence>.effectCoverage` per residence building (raw under `ext.calculator.store`),
  per-instance `moduleAttachments` (the calculator has a module state per factory type, `<factory>.module[<m>].checked`, which
  is applied), `planned` counts (carried one to one, no effect on a result).
- Item records in every place (`itemHolders[].items`, `itemHolders[].carried`, `itemStorage`, `account.*`, `unlocatedItems`) are
  preserved verbatim and counted per place. Possession is not application: item records are never derived from
  `factories[f].items`, and `factories[f].items` are never derived from item records. A repeated item `instance` id is reported
  and every record is kept.
- The one effect applied from an item record: for each socketed item of a building holder (`kind` absent or `building`) with
  `mythicEffect: E` and `boostConditionMet: true`, `island.effect.<E>.scaling` is 1, the effect's DLC is switched on and the report names
  it. Every other mythical-item effect of that island that the file knows is written 0; an `effects[E]` entry sets the same key and
  the larger value wins. A ship holder's `mythicEffect` is preserved and reported as not applied. An unknown effect GUID stays in the
  record and is reported.
- Module attachments are written back on export only while the type-level module state still equals the value the import wrote.
- Device preferences (`language`, dark mode) are never part of an exchange file.

## Tests

The tests run in the bundle through `window.exchange`; build before every run and run the suite serially:

```
npm run type-check
npm run build
npx playwright test tests/exchange --reporter=list --workers=1
```

- `tests/helpers/exchange.ts`: `seedOnce` seeds `versionCalculator` and an empty `islandNames` once per browser tab
  (marked in `sessionStorage`, so a reload keeps the imported state; `ConfigLoader.loadConfigObject` re-seeds on every
  navigation and cannot be used for flows that reload). Also `openApp`, `importText` (planImport, applyImport with
  `reload: false`, page reload), `exportDoc`, `summaryByName` / `summaryDifferences` (computed values keyed by island name),
  `collectErrors` and the `ajv` schema validator.
- `conformance.spec.ts` iterates `vendor/anno117-exchange/fixtures/MANIFEST.json`. A valid fixture validates, imports, starts
  the app without errors and exports a schema-valid file. An invalid fixture is rejected according to its class: envelope
  (reader error with the manifest code), schema (JSON Schema failure at the manifest path and keyword) or semantic (the
  manifest code as reader error or problem).
- `roundtrip.spec.ts` holds the integration scenarios: Cinis sawmills, the default-route floor, DLC switched on after import,
  DLC enabled by a building count, the mythical-item effect, history and `minimumStock`, item records, the old import path and
  the round trips below.
- The old import path is driven through the real `#config-selector` input (`setInputFiles`).
- Round trips compare `computeSummary()` before and after export and import: the old sample dump
  `tests/fixtures/Anno117CalculatorConfig.json` always, and the Marcia 69 game (23 islands including the user island Monument Demand, 369 trade routes) when
  `Marcia 69 updated.json` of the repository `anno-117-savegame-exchange-format` is found (`data/processed/calculator_configs/`
  next to this repository, or `ANNO_EXCHANGE_REPO`); otherwise that scenario is skipped. That file is an old-format dump, so the
  scenario loads it through the old import, exports it, imports the export and checks that no computed value changes and that
  the Listening Weasel Nome Gold pair keeps import 0 and local output 4.8 t/min.
- Scoped import: `scopes` (classifier; fails and names any island-store key a planner writes without a scope row),
  `matching`, `merge` (a stored calculator is built with `importText`, then `planScopedImport(text, selection)` is diffed
  against localStorage), `undo` and `import-scopes-ui` (Download dialog block, persistence, Undo button).
  `importText(page, text, selection?)` runs the scoped path when it gets a selection. The undo snapshot lives in
  `sessionStorage`, which survives the reload of a test page; a real import sets `exchange.justImported`, so the Download
  dialog is open after it.
- Route derivation: `derive-routes` checks every vendored `trade-*.json` fixture against `deriveImports`; the Marcia 73
  planner export (repository root, or `MARCIA73_EXPORT`) drives scenarios in `roundtrip.spec.ts` and is skipped without it.
- Residence and effect coverage: `residence-items`, `heroic-effect-write`, `area-effect-coverage`, `public-coverage`;
  `coal-import` covers the coal supplier import.
- Cross-tool drivers `cross-tool`, `xt-driver` and `xt-diag` are skipped without their environment variables.
- Other specs: `entry`, `island-id`, `tables`, `reader`, `import-islands`, `import-trade`, `import-effects`, `plan`, `writer`,
  `exporter`, `ui`, `computed` cover one unit each. The volcano level selector is tested outside this folder
  (`tests/computed/dlc-settings-volcano.spec.ts`, `tests/binding/dlc-settings-volcano.spec.ts`).

The oracle of the savegame repository (`scripts/calculator_config/run_calc.js` and `cmp_runtime.py`) loads two config dumps into
the calculator and prints computed values per island; it checks the config updater, not the exchange import.

## Limits

- Supplier sets follow `imports`. Only with "re-calculate routes from savegame data" and at least one ship on the file's
  `routes` does the calculator derive them from `routes` (the candidate derivation with every source of a good serving
  every unload slot, no amounts); the rule
  for relays and order-dependent routes belongs to the file's writer. The derived sets differ from the planner's `imports`
  for part of the entries, which is why the toggle is off by default.
- `products[p].producer` is read as given (the config updater of the savegame repository decides it).
- The app runs the hand-written reader only; the conformance tests run the full schema.
