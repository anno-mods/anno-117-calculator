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
- **Import Exchange File** reads a file, shows the report and the replacement scope (all stored data is replaced) and asks
  for confirmation. Cancel changes nothing. After Confirm the data is replaced and the page reloads once. After the reload the
  report dialog lists values of the file's `computed` block that differ from the calculator's own result by more than
  1 % or 0.1 units (residents per level, required buildings per factory, imported goods); this does not block anything.

Without a file dialog, `window.exchange` is the entry point for tests and debugging: `readExchange`, `planImport`,
`applyImport`, `buildDocument`, `exportDocument`, `computeSummary`, `islandId`, `uniqueName`, `tables`.

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
| `exchange.computed` | sessionStorage, one reload | The file's `computed` block for the comparison after the reload; removed when read. |

On export the preserved data returns to its original location in the document; only extension data stays under `ext`.
Edits win: a value the user changed in the calculator replaces the preserved copy, and preserved entries that name a
deleted island (route stations, visits, history, live, supplier references) are removed and counted. Deleting an island
deletes its preserved data with its store.

## Import

`planImport(text)` is a pure function: it reads the file, builds the complete map of raw localStorage keys and the report,
and touches no storage. `applyImport(plan)` replaces the stored data atomically:

1. the previous localStorage content is snapshotted in memory;
2. every JSON string of the key map is validated;
3. the storage is cleared and written in one pass (island stores as compact JSON);
4. any exception (quota exceeded, invalid JSON) restores the snapshot byte for byte and reports the failure, nothing reloads;
5. `location.reload()` runs once, last.

Device preferences survive an import: the `language` setting and `darkMode.checked` are merged back.
`versionCalculator` is always written, so an import never looks like a first run.

Islands get unique display names; a name that collides with another island or a reserved storage key gets a numeric suffix
and the original name stays in the island's `exchange.ext`. An island whose session GUID the calculator does not know
(a later DLC region) is not written as a store, because the app would not start; it stays in the top-level
`exchange.ext.orphans` with all its data and is written back on export.

### Report

The report has four lists: carried through (kept and written back), not mapped (kept, not applied), approximated (applied
with a difference) and not provided (absent in the file). Typical entries: unknown GUIDs, item records per place,
per-instance module attachments, governor suppliers, `routes` and `imports` that disagree (`imports` wins), a local
producer fully utilized because of a received good, DLCs switched on because of the file's content.

### Mapping rules worth knowing

- Needs: only `disabledNeeds` entries are written (`<level>[<need>].checked` = "0"). Every other need keeps its default (on).
  A DLC switched on after the import turns the unlisted needs of that DLC on and keeps a listed need off.
- DLCs: `settings.dlcs` writes the DLC keys. A file without `settings.dlcs` still gets the DLC at load when an island has a
  count for a building of that DLC, a researched item or an active effect of it (`DLC.used`); the report names the DLC and
  the first re-export lists it in `settings.dlcs`. Counts of residence buildings are not checked for a DLC.
- Trade: `imports` become trade routes by the residual-supplier rule (default flag, else largest share, ties by the lexically
  smallest island id). An `amount` becomes `userSetAmount`, which is a floor under the supplier's import (the calculator
  supplies `max(userSetAmount, amount)`), so a surplus over the demand counts as excess production. `routes`, `visits` and
  `minimumStock` are preserved and never turned into imports. A local producer of a received good is fully utilized unless the
  file states `fullyUtilize: false`; the export states `fullyUtilize: false` explicitly for a producer the user left partly
  utilized, so a round trip does not switch it on.
- Construction materials: an end factory of a material is fully utilized (explicit `fullyUtilize` on export).
- Discoveries and effects come from a table built from `params.techs` and `params.effects`; the four dormant area-buff keys are
  never written.
- Residences: a per-building count wins over a per-level count; populations are preserved.

## What is preserved but not applied

- Governor suppliers and harbours (the calculator's `passiveTrade.userSetAmount` is one value shared by all products), the
  recorded `visits`, `routes` and `history` / `live` series, `effectCoverage` per residence building (`residenceEffects`),
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
- Other specs: `entry`, `island-id`, `tables`, `reader`, `import-islands`, `import-trade`, `import-effects`, `plan`, `writer`,
  `exporter`, `ui`, `computed` cover one unit each.

The oracle of the savegame repository (`scripts/calculator_config/run_calc.js` and `cmp_runtime.py`) loads two config dumps into
the calculator and prints computed values per island; it checks the config updater, not the exchange import.

## Limits

- The calculator does not derive imports from `routes`; the rule for relays and order-dependent routes belongs to the file's writer.
- `products[p].producer` is read as given (the config updater of the savegame repository decides it).
- The app runs the hand-written reader only; the conformance tests run the full schema.
