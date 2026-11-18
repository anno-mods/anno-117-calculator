---
title: Import Scopes - Plan
type: feat
date: 2026-11-14
topic: import-scopes
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-brainstorm
execution: code
deepened: 2026-11-14
---

# Import Scopes - Plan

## Goal Capsule

- **Objective:** The Download dialog imports an exchange file in parts. Five checkboxes under the import button choose which parts a file replaces; the confirmation dialog and the import report are gone; the only follow-up is an Undo button. Island supplier routes come from the supplier settings of `trade.imports`; a persisted toggle next to the Trade scope derives them from the route data measured in a savegame instead.
- **Product authority:** The maintainer decides the five scopes, the two "keep" toggles, the route re-calculation toggle and the persistence of the choices. The exchange-format spec (`c:\dev\anno-117-exchange-format\spec\format.md`) owns file semantics. Plans 2026-11-12-001 (governor suppliers), -002 (residence items), -003 (DLC settings) and -004 (factory effect UX) own what the calculator does with their fields; this plan owns which scope applies them and the order of precedence for routes.
- **Open blockers:** None. OQ3 and OQ4 are questions to the format owners; the re-calculation toggle acts on any file with ship-carrying `trade.routes`, and U7 holds that test in one predicate.
- **Product Contract preservation:** R22 sits above R23-R26 and the Modifiers requirements have their own heading (IDs are cited by the sibling plans, for example R25); R5 states that the comparison with the file's computed values is removed.
- **Sources read:** `src/exchange/{plan,writer,import-islands,import-trade,import-effects,import-calculator,exporter,keys,index,types}.ts`, `src/main.ts` (import listener, report hand-off), `src/world.ts` (island deletion, island id), `templates/download-dialog.html`, `tests/exchange/*`, `tests/helpers/exchange.ts`, `docs/exchange-format.md` (not reread; listed under "Not verified"), the spec `format.md` (catalog and reference derivation), the sibling plans 001-004 (headings, requirements, open questions), and the UX mock (artifact `SCQPogPpKRmREHC1cMbGdk`, section `#report`). Planner repository files were not read in this pass.

---

## Product Contract

### Problem

Importing a file replaces every stored value of the calculator (`planImport` builds the complete key map, `applyImport` clears storage and rewrites it: `src/exchange/writer.ts:159-163`, `src/exchange/plan.ts:106-116`). A player who wants only the planner's modifiers, or only the trade routes of a savegame, has no way to say so, and the confirmation dialog that precedes the replacement shows a report the player cannot act on except by cancelling.

Three facts shape the design:

- **No island matching exists.** Islands are named from the file's `name`, `gameIsland.name` or `id` (`src/exchange/import-islands.ts:518-532`). `exchange.islandId` is copied from the file (`:191`). Calculator islands receive an id only lazily (`src/world.ts:1389-1397`).
- **The planner modules do not follow the five scopes.** The import key map merges the output of several planner modules (`src/exchange/plan.ts:76`), and a module writes keys of other scopes: the trade module writes `fullyUtilizeConstructed` (`src/exchange/import-trade.ts:322`), the effects module writes `buildings.constructed` (`src/exchange/import-effects.ts:398`, not rechecked), the island module writes DLC setting keys (`src/exchange/import-islands.ts:412`).
- **Routes are planned input today.** The calculator turns each island supplier entry of `trade.imports[]` into a route with a user-set floor (`src/exchange/import-trade.ts:256`). For a planner file those amounts are the planner's computed delivery. For a savegame file the measured data is `trade.routes` (stations, slots, ships), which the calculator keeps and does not use (`src/exchange/import-trade.ts:366-368`). The spec permits deriving suppliers from `trade.routes` only when `imports` are absent (`format.md:146-148`), so `imports` are the plan input. The planner's own savegame conversion derives suppliers from those routes and writes the result as supplier amounts (`convert.py:1007-1143`, `exchange_export.py:379-380`; planner repository, not reread).

### Actors

- **Calculator player** importing a planner file, a savegame-derived file, or both in turn.
- **Planner user** whose file carries planned suppliers.
- **Format maintainers** who need the calculator's reading of routes and sources.
- **Calculator maintainer** who owns import behavior.

### Requirements

**Scopes and persistence**
- R1. The Download dialog shows five checkboxes under the import button, in this order: Islands, Residences, Production buildings, Trade routes and suppliers, Modifiers. Choosing a file imports at once with the ticked scopes. No confirmation dialog opens.
- R2. Islands and Trade routes and suppliers each have a toggle "keep my other ..." that is available only while the scope is ticked. Islands: calculator islands that are not in the file stay with all their data. Routes: calculator routes that the file does not replace stay (R21). Off means the calculator-only entries are removed, which is today's behavior. Trade routes and suppliers has a third toggle, "Re-calculate routes from savegame data" (R18), also available only while the scope is ticked. All three are icon-only controls with a title.
- R3. The eight states (five ticks, three toggles) are stored in `calculatorSettings` and restored on start. Defaults: all five ticked, all three toggles off. They are device preferences: they are not exported and not imported, like `language` and `darkMode` (`src/exchange/import-calculator.ts:17,119`).
- R4. A sentence under the checkboxes names what the next import replaces, merges with the calculator's own entries, and leaves alone. It updates when a state changes. With the re-calculation toggle on it also says that the supplier sets of files with routes are derived from the routes.
- R5. An import shows no report and no summary of changes: the report dialog after the reload (`src/main.ts:370-386`) is removed, and so is the comparison with the file's computed values. After the reload that follows an import the Download dialog opens with one button under the checkboxes: "Undo import. Everything changed since then is lost." The export report dialog is unchanged. A file that cannot be read at all (not an exchange file, wrong format) is the only case that shows a message, because nothing was imported.
- R5a. Undo restores all stored data from before the most recent import, except device preferences (language, dark mode, the scope ticks and toggles), which are not part of the exchange or of the snapshot restore, and reloads. Before every import the calculator stores one snapshot of all stored data in `sessionStorage`. The snapshot survives the reload that follows the import and is dropped when the tab or session ends; the next import's snapshot replaces it, so only the last import can be undone. Because the snapshot holds all stored data from before the import, edits made after the import are lost by Undo; the button label says so, and the button's tooltip repeats the label. The snapshot is not exported. If writing the snapshot fails, the import still runs and the button is not shown. Without a snapshot the button is not shown.
- R6. Scopes that are not ticked leave the calculator's stored values, and their preserved `exchange.ext` parts, untouched. The factory fully-utilize setting written by the local producer rule (R17) belongs to Trade routes and suppliers, so it is written with Production unticked.

**Classification**
- R7. Each stored key is assigned to one scope by a classifier over raw storage keys and `exchange.ext` pointers, not by planner module. Keys that need a lookup to classify (`<g>.buildings.*`, `<f>[<x>].scaling`, `<f>.module[..]`) use the asset tables (`Lookups.residences`, factories, modules, `classify`; `src/exchange/import-islands.ts:53-98`).
- R8. Assignment (Appendix A lists the keys):
  - Islands: island list, id, name, session, game island and connector keys, position, orphans.
  - Residences: residence counts per level, disabled needs, need notes, residence effect coverage (`<res>.effectCoverage`, `<levelGuid>[<effectGuid>].coverage`), public coverage (`<levelGuid>[<buildingGuid>].publicCoverage`, `publicCoverage`), `villaCoverage` (plan 002).
  - Production buildings: factory and module counts and state (not `fullyUtilizeConstructed`, which is Trade), manual productivity, module attachments, end-factory materials, `products[p].notes`.
  - Trade routes and suppliers: `trade.*`, `visits`, `governorHarbours`, `products[p].producer`, default supplier keys (factory, route, extra good, passive trade), governor supply (`<productGuid>.governorSupply`, plan 001), the factory fully-utilize key written by the local producer rule (`<factoryGuid>.buildings.fullyUtilizeConstructed`, R17), `passiveTrade.userSetAmount` (one value per island) and its per-product successor `<productGuid>.passiveTrade.userSetAmount` (plan 001 OQ6).
  - Modifiers: items and item holders, residence items (`residenceItem.<itemGuid>.state`, plan 002), island items, effects, applied and range effects (per-target state `<targetGuid>[<effectGuid>].scaling`, plan 004), wonders, romanization, patron, devotion, research, volcano and seasons settings (volcano scales are `session.<session>.effect.<effect>.scaling` in `sessionSettings`, and the unlocked set is `volcano.unlocked`, plan 003), difficulty, owned DLCs (`calculatorSettings` keys equal to an id of `params.dlcs`), irrigation and island fertilities.
- R9. Keys without a scope (UI state such as `collapsibleStates`, `statisticsCollections`, `darkMode`, `language`) are never touched by a scoped import. `extraDemand`, `population`, `layout`, `account`, `history`, `live` and unknown fields stay preserved as today.

**Island matching**
- R10. A file island matches a calculator island by, in this order: `exchange.islandId`; the game-island triple (session, island id, area index; `src/statistics.ts:104` matches this way); exact name together with the same session. A session mismatch is no match, because fertilities and effect availability depend on the session region (`src/exchange/import-islands.ts:273`, not rechecked). Calculator islands without an id receive one before matching, as the exporter does (`src/exchange/exporter.ts:217-237`).
- R11. With Islands unticked, every other ticked scope applies to matched islands only. File islands without a match are skipped, never created, and counted with their number of skipped values in `MergeResult.skipped` (tests and diagnostics; no UI surface, R5).
- R12. With Islands ticked, the island list becomes the file's. Calculator islands without a match are removed with their data and routes (`src/world.ts:438-459`) unless the keep toggle is on. The All Islands pseudo island is never deleted and its store and aggregate routes are overwritten only when all five scopes are ticked (`src/world.ts:442`).

**DLCs**
- R13. DLC rule for every import, stated here once and referenced by plan 003 (R5, OQ1): a DLC is switched on whenever the content of a ticked scope needs it (buildings, items or effects tied to one DLC), without a message, and `DLC.used` keeps it on while stored content needs it. A DLC is switched off only by a `settings.dlcs` list that omits it, and the list is applied (listed numbers `"1"`, omitted numbers `"0"`) only with Modifiers ticked. A full import has Modifiers ticked and therefore switches omitted, unneeded DLCs off (003 R5); an import with Modifiers unticked never switches a DLC off. DLC keys are matched against the ids of `params.dlcs` through 003's `dlcNumber`, not against a fixed list. Volcano scales are Modifiers keys; the volcano level selector and `ViewMode.master()` of plan 003 write the same keys and are not import paths.

**Cross-scope dependencies**
- R14. Default suppliers and routes are written together under Trade routes and suppliers. The exporter omits `producer` when a default route exists (`src/exchange/exporter.ts:469`, not rechecked), so one scope owns both keys. The check that blocks a default supplier that would create a cycle also tests the kept routes (R2); on a duplicate (product, from, to) the file wins.
- R15. A supplier or receiver that names an island is resolved against the matched islands, so a valid supplier does not degrade to passive trade because its island was not imported. A supplier that is truly unmatched takes the existing preserve path (`src/exchange/import-trade.ts:176-182`).
- R16. Routes are keyed by island name (`src/trade.ts:294-326`, not rechecked). After matching they use the calculator's own island names, not the file's.
- R17. The rule that fully utilizes a local producer of an imported good (`src/exchange/import-trade.ts:316-331`) is part of the supplier scope: it is applied whenever Trade routes and suppliers is ticked, regardless of the Production tick, because it is derived from supplier data. The factory fully-utilize setting it writes (`<factoryGuid>.buildings.fullyUtilizeConstructed`) belongs to Trade in the key classifier. A factory that does not exist on the island is not created: the setting is written only where the resulting island store has `<factoryGuid>.buildings.constructed > 0`. With Trade unticked the rule is not applied.
- R17a. The per-island `exchange.ext` blob holds parts of all scopes. A scoped import merges it by pointer prefix and keeps the parts of unticked scopes. List-index pointers (`src/exchange/exporter.ts:110-142`) are restored only when the whole list was replaced. Preserved supplier entries (governor, cycle, non-player) always return with their identity and unknown fields. Only their amounts and their list-position claim are invalidated: the original list position returns only while routes, default and passive amount equal their snapshot (`src/exchange/exporter.ts:828-846`), otherwise governor suppliers are appended after the island suppliers (plan 001 KTD5); a governor amount returns while the stored governor supply equals `restore.governorSupply` and the default supplier of the product equals the snapshot default (a route-set or passive-amount edit does not invalidate it; plan 001 R8), and the kept amount of an island supplier (R19a) while routes, default and passive amount equal their snapshot. A partial Trade import that changes those values refreshes the snapshot and never removes the entry.

**Routes from savegame data**
- R18. A persisted toggle next to the Trade scope, "Re-calculate routes from savegame data" (default off, stored like the keep toggles, icon-only control with that title), makes the import derive the supplier sets of each island's imports, the residual (default) supplier and all floors from the file's `trade.routes` with the spec's reference derivation (`format.md:157-185`), instead of from `trade.imports[]`. The toggle is effective only for a file whose `trade.routes` carry at least one ship; for every other file it is ignored. Floors are 0, because the derivation yields no measured t/min. From `trade.imports[]`, the island suppliers of an import entry with `basis: "entered"` (`basis` is a field of the entry, not of its suppliers) carry their amounts as floors; the suppliers of every other entry follow R19a. The default is off because the spec permits deriving from `trade.routes` only when `imports` are absent (`format.md:146-148`): `imports` are the plan input.
- R19. With the toggle off, or for a file without routes or without ships, `trade.imports[]` are the input for the supplier set and the default supplier.
- R19a. The `amount` of an island supplier is imported as floor 0, and its value is kept in `exchange.ext` per supplier. Reason: the planner uses the amount as a cap (`engine.py:1495`, `min(wanted, remaining)`) and, for savegame imports, as a computed share of its own demand estimate (`convert.py:1107-1113`), so a floor would force flow the calculator's demand may not need. Export writes the kept value back unchanged while the route set and default of that import are unchanged (same snapshot rule as R17a), so a round trip loses nothing; a floor the player sets in the calculator exports as `amount` as before. The island suppliers of an import entry with `basis: "entered"` are floors (R18).
- R20. Governor suppliers, non-player suppliers and passive suppliers always come from `trade.imports[]` (plan 001), also with the re-calculation toggle on: neither `visits` nor `governorHarbours` carry a delivered amount.
- R21. When the file produces a route set for a (receiving island, product), it replaces all calculator routes for that pair, including calculator-only suppliers of the same pair. Pairs the file does not mention keep their calculator routes when "keep my other routes" is on and lose them when it is off (R2). Kept routes take part in the cycle and duplicate checks. The calculator has no `manuallySet` flag (`src/AGENTS.md` lists it as planned), so "calculator-only" means "not produced by the file". The governor supply `<productGuid>.governorSupply` of a matched island follows the plan for every (product, receiving island) the file has an import entry with a governor amount for, and stays otherwise; a governor-only entry replaces no route. The shared key `passiveTrade.userSetAmount` follows the plan when the plan writes it and stays otherwise; its one value per island is the defect recorded in plan 001 OQ6.
- R22. Export keeps writing `trade.imports[]` for every flow derived from routes and keeps `trade.routes` verbatim in `exchange.ext.trade`, as the spec requires for readers that do not derive.

**Modifiers**
- R23. `effects.global` is applied: each listed effect GUID takes its scale as the empire-wide effect, also when the same effect is not derivable from `research.researched`. The planner writes 5 global effects where the calculator-side reference has 20; the calculator derives effects from researched discoveries and, in the observed files, reproduced 19 of 20 (Open Sesame 183157 was not). The import shows no difference; the cause of the missing one is open.
- R23a. Items write the island effect of their `heroicEffect` (plan 002 R4, U11) when an import stores them as activated, through the same write for `factories[].items`, `residenceItems` and any other item entry. The written key is `island.effect.<heroicEffect>.scaling` and belongs to Modifiers like the item keys that cause it, so with Modifiers unticked neither the items nor the effect value change. Order inside the Modifiers part of one island: items first (`factories[].items`, `residenceItems`), then the effects the file states itself. An effect the file states wins over the item write: a key in the island's `effects`, an entry in `effects.global` or `effects.bySession`, or the `mythicEffect` of an item record (the measured `boostConditionMet` mapping of `import-islands.ts:373-404` is unchanged and wins, including a measured 0). The write sets 1 and never 0, so an item entry cannot switch an effect off. The classification of keys is unchanged: the effect state key stays under Modifiers.
- R24. Effect GUIDs the calculator does not know (observed: 95709, 137876, 153864 globally, 166463 per island) are kept and written back, never dropped.
- R25. `islands[].appliedEffects` (range effects per building type: `{type, effect, source, share, applied, method, scale}`, spec `format.md:86`) are applied as the per-target range-effect state defined by plan 2026-11-12-004 ("Range-Effect State Contract"): the island-store key `<type>[<effect>].scaling`, built with `keys.factoryEffectScaling`, holds the raw integer 0 or 1. `applied: true` writes 1 and `applied: false` writes 0; the write goes through `noteDlc` for the effect's DLC. A fractional `share` (above 0 and below 1) cannot be held, because the state is per building type; the entry is applied by `applied` and the approximation is recorded in `ImportPlan.report`. `scale` and `method` are kept in `exchange.ext` and not applied. An entry whose effect has no per-target state (not a range effect) or whose `type` is not one of the effect's targets is not applied and stays kept at its pointer. `appliedEffects` is applied after `factories[].effects[]`, and an entry states the pair's state, so it wins for the pairs it names.

- R26. `islands[].wonders` (splendour: per building GUID a `rank` and optionally a `coverage`) is a Modifiers field and is imported and exported in this order after R25: it is kept in `exchange.ext` at its pointer and written back unchanged, so a round trip loses nothing. The spec types the field only as a planner-side island input (`format.md:93`, schema `"wonders": {}`), so the planner's `{buildingGuid: {rank, coverage?}}` shape is read from the file, not validated. The calculator has no per-island wonder rank: `Effect.wonder` (`src/production.ts:787`) links a wonder-sourced effect and `GLOBAL_WONDER_EFFECTS` (`src/exchange/discoveries.ts:26`) lists two empire-wide wonder effects, neither takes a rank. Applying the rank rewards of the Amphitheatre (building 3621) and the Hippodrome (building 152714) is therefore out of scope until a calculator wonder model exists. The savegame holds splendour as AreaEffectManager effects 157677 and 157678 (Amphitheatre), 153890 and 157595 (Hippodrome) with the reward effects 159339, 156267, 155840 and 158187; the planner does not read or write them yet.

### Scope Boundaries

Not requested, because they belong to another owner or need data that is not in the files:

- Import of single fields or per-island choices; the five scopes are the granularity.
- Measured t/min per route. The converter reads only `ExecutionTime` of visits (`convert.py:155-182`); a time base, delivered amounts and ship speed are missing, so route amounts stay floors of 0 and demand sets the flow.
- Governor supply from the savegame, for the reason in R20.
- A change to the export, its report dialog, or the export scopes.
- Merging of individual fields inside a kept island: a kept island keeps all its data.

### Acceptance Examples

- AE1 (R10, R11). Islands unticked, Residences ticked, a file with six islands of which four match: the four islands receive their residence counts, the two others are counted as skipped with their value counts in `MergeResult.skipped`, and no island is created.
- AE2 (R2, R12). Islands ticked, keep off: two calculator islands that are not in the file disappear with their routes. With keep on, both stay and the island list has eight entries.
- AE3 (R3). Untick Production, switch the keep toggle for routes and the re-calculation toggle on, reload: the same states are shown.
- AE4 (R13). Modifiers unticked, Production ticked, a file with a Dawn of the Delta building: the DLC is on. A file whose `settings.dlcs` omits another DLC leaves that DLC as it was. With Modifiers ticked (also a full import) the same omission switches that DLC off unless ticked content needs it.
- AE5 (R18, R19). A file with ships on a route Roma-Ostia carrying Bread, and a `trade.imports[]` entry for Roma and Bread that lists Ostia and Capua: with the re-calculation toggle on, Roma's Bread supplier set, residual default and zero floors come from the route, and the Ostia supplier amount of an entry with `basis: "entered"` becomes a floor; with the toggle off, the supplier set is Ostia and Capua as the entry lists it. The same file without ships on any route imports `trade.imports[]` in both cases.
- AE6 (R19, R19a, R20). A planner file with a supplier Roma-Ostia for Bread at amount 0.38: the route is written with floor 0, the default supplier is as in the file, export writes 0.38 again, and a governor supplier is applied under plan 001.
- AE7 (R21). Routes on, keep on: Roma has a calculator route for Wine that the file does not mention and two Bread routes (from Ostia and from Capua); the file produces a Bread route set for Roma from Ostia. Both calculator Bread routes are replaced by the file's route; the Wine route stays.
- AE8 (R5, R5a). Edit a factory, import a file, edit another value, press Undo: the stored data equals the state after the first edit and before the import, except device preferences (a language or dark-mode change made after the import stays); the second edit is lost; no report was shown at any point. With the snapshot write failing, the import runs and no Undo button is shown.

- AE9 (R26). A file with `wonders: {"3621": {"rank": 3, "coverage": 80}, "152714": {"rank": 1}}` on a matched island, Modifiers ticked: after import the island's stored data carries no wonder effect, and export writes both entries back unchanged. With Modifiers unticked the stored `exchange.ext` part of `wonders` stays as it was.

### Key Decisions

- KD1. **The choice precedes the file.** The ticks and the sentence under them replace the confirmation dialog, so the replacement scope is visible before any file is chosen.
- KD2. **Classification by key, not by planner module** (R7), because the modules write keys of other scopes.
- KD3. **Matching by id, then game-island triple, then name and session** (R10). A name alone cannot be trusted: names get suffixes when two islands share one (`src/exchange/import-islands.ts:524`).
- KD4. **Only a ticked Modifiers scope switches a DLC off** (R13), so a partial import without Modifiers cannot lock content behind a DLC the player owns. Plan 003 R5 and OQ1 hold for every import with Modifiers ticked.
- KD5. **Supplier settings in `trade.imports[]` are the plan input; measured route data wins only on request** (R18, R19). Reason: the spec permits deriving from `trade.routes` only when `imports` are absent (`format.md:146-148`), and the planner's `imports` deviate from the reference derivation for about 15 percent of entries on two real saves (Marcia 69 and Marcia 73 planner exports), so the player who wants the measured routes ticks the toggle. `trade.imports[]` keep their role for what routes cannot express (R20) and for entered amounts.
- KD6. **Irrigation and island fertilities belong to Modifiers**, following the maintainer's list. Production holds only factory state. See OQ2.
- KD7. **Undo replaces the report** (R5a). Without the confirmation dialog the player cannot check before data is replaced; one snapshot, kept for the tab session, makes any import reversible, which is simpler than a report the player has to read and act on.
- KD8. **Supplier amounts are imported as floor 0** (R19a). Evidence: in two planner exports of the same island the same supplier pair carries 0.38 and 0.97 and the default role swaps between suppliers; the planner treats the amount as a cap.

### Outstanding Questions

- OQ2. **Does "irrigation" mean the island fertilities** (`fertilities`, `fertilitiesComplete`)? Fertilities are an island attribute that gates production. Recommendation: Modifiers, as listed by the maintainer. Alternative: Islands, so that a production import on a matched island does not need them.
- OQ3. **Does the re-calculation toggle need a source signal?** No: it acts on any file whose `trade.routes` carry at least one ship (R18, U7), so `source.kind`, `basis` and `generator.name` are not read. A signal is needed only if the derivation becomes the default for savegame sources (OQ4); the planner writes no `basis` for import entries, and the calculator itself writes `source.kind` `tool` (`src/exchange/exporter.ts:297`, not rechecked). Recommendation: ask Taludas on issue 1 which signal a converted savegame carries when OQ4 is answered with yes.
- OQ4. **Should the derivation become the default for savegame sources?** The spec permits deriving from `trade.routes` only when `imports` are absent (`format.md:146-148`), so `imports` are the plan input and the derivation (`format.md:157-185`) runs on request (R18). The planner's `imports` deviate from the derivation for about 15 percent of entries on two real saves. Ask the format owners on issue 1 whether the derivation should be the default for savegame sources.
- OQ5. **Aggregate store.** R12 never overwrites the All Islands store unless all five scopes are ticked. Alternative: never overwrite it in an import. Recommendation: keep R12; it matches today's full import.
- OQ6. **Reach of "keep off" for routes.** R2 removes every calculator route that is not produced by the file. With Islands unticked, that also removes routes between calculator islands that the file does not contain. Recommendation: with keep off, delete only routes whose receiving island is matched; routes of unmatched islands stay, because the file says nothing about them. Implemented as stated in R2 until the maintainer answers; the switch is one filter in U4.
- OQ7. **A supplier island that the file lists and the calculator cannot match** (R15). Recommendation: treat it like a non-player supplier today (kept in `exchange.ext`, passive-trade default when no island supplier remains), because the calculator has no such island to route from.

### Not verified

- Whether the savegame holds delivered amounts per visit (the converter reads only `ExecutionTime`).
- Whether the planner sets `source.kind` for a converted savegame, and whether island ids stay stable across its re-export (`id_map` remaps ids: `exchange_import.py:630`).
- Whether the savegame repository's writer emits document-level `routes` and `visits`.
- The `ext.planner.supplierCaps` field: named in the issue, not found in the planner code that was read.
- The planner writes `governorHarbours[].goods` as a map and a `limits` key (`exchange_export.py:392-393`) where the schema defines an array and `stockLimits` (schema 414-428).
- Planner-repository and `docs/exchange-format.md` references (`convert.py`, `engine.py`, `exchange_export.py`, `exchange_import.py`, `docs/exchange-format.md:149`) were taken from the earlier investigation and not reread.

---

## Planning Contract

### Verification Status of Code References

Rechecked in this pass and correct: `writer.ts:159-163`, `plan.ts:106-116` (the `tradeRoutes` write is at `:107`), `import-islands.ts:191,412,518-532`, `import-trade.ts:176-182,256,316-331,366-368`, `exporter.ts:217-237,828-846`, `world.ts:438-459,442,1389-1397`, `statistics.ts:104`, `main.ts:370-386`, `import-calculator.ts:17`, `index.ts` (API registration). Findings from the check: the device-preference set `DEVICE_SETTINGS` is duplicated (`exporter.ts:36`, `import-calculator.ts:17`); the scope settings must be added to both or to one shared constant (U5). Reading of `effects.global` already exists (`import-effects.ts:182-196`) and unknown GUIDs are kept (`keepEffect`, `:234`); R23 and R24 are therefore characterization and scope work, not new reading. `appliedEffects` and `rangeBuffs` are only kept (`reader.ts:75-76`), not applied.

### Overview

The import stays "plan the whole file, then write": `planImport` remains a pure function that builds the complete key map. Scoping is a pure merge over that result.

```
file text
  -> readExchange
  -> matchIslands(file islands, stored calculator islands)          [U2]
  -> planIslands / planTrade / planEffects / planCalculator
       with ctx: scope selection, matches, kept routes             [U3, U8]
  -> ImportPlan.keyMap (everything the file says, calculator names)
  -> mergeScoped(stored snapshot, plan, selection, matches)        [U4]
       = final key map: unticked scopes and unscoped keys from storage,
         ticked scopes from the plan
  -> UndoStore.save(snapshot); applyImport(finalPlan)              [U5]
  -> reload; dialog opens with the Undo button                     [U6]
```

All five ticked with both keep toggles off takes the unchanged full path (`mergeScoped` returns the plan's key map), so today's behavior is the regression anchor (KTD1).

### Key Technical Decisions

- KTD1. **Full path is the anchor.** All five ticked and both toggles off bypasses merging and keeps today's result, including the clear-and-rewrite of unscoped keys (their values come from `ext.calculator` of the file as today). R9 applies to partial selections only. Reason: the existing round-trip, roundtrip and conformance specs keep their meaning without edits.
- KTD2. **Merge instead of scoped planners.** The planners keep producing a complete plan; `src/exchange/merge.ts` selects per key. Reason: the planners cross-reference each other (trade needs island keys, effects need island plans), and splitting them by scope would duplicate the cross-references. Exceptions that need information the key does not carry travel as plan metadata (the DLC use of ticked content, U3).
- KTD3. **Replace semantics per scope on matched islands.** For a ticked scope the merge removes the stored keys of that scope on the island and writes the plan's keys of that scope. Keep mode for routes is an overlay: stored routes survive unless the file produces a route set for the same (product, receiving island), and per-product default keys follow the route set (R21).
- KTD4. **Island names follow the match.** A matched file island takes the calculator's name when Islands is unticked, so route keys (R16) and store keys need no remapping afterwards. With Islands ticked the file's name is used as today, and the names of kept calculator islands are added to the `taken` set of `uniqueName`.
- KTD5. **Island ids are assigned through one shared function.** The exporter's id assignment (`exporter.ts:217-237`) is extracted so import matching and export use the same code.
- KTD6. **Skipped values are counted, not reported.** The merge returns a count per skipped island for the developer console and the tests; no UI shows it (R5 removes the report; AE1's "not applied" is the count).
- KTD7. **Route derivation is its own pure module** (`src/exchange/derive-routes.ts`) producing `TradeImport[]`, so the existing `processImport` path (residual, default checks, cycle, passive degradation, preserved entries) is reused unchanged for both sources.
- KTD8. **Amounts are kept through the existing preserved-entry mechanism.** An import entry with an island supplier whose `basis` is not `entered` becomes a preserved entry with reason `amount-kept`; the exporter already returns a preserved entry whole while its route set, default and passive amount equal the snapshot (`exporter.ts:828-846`); otherwise it keeps the entry's identity and unknown fields, drops the kept amount and records a report note (R17a). Governor amounts follow their own rule: they are dropped only when the governor supply or the default supplier differs from the snapshot, not by a route-set edit (plan 001 R8). No new ext field is needed.
- KTD9. **The undo snapshot lives in `sessionStorage`** (key `exchange.undoSnapshot`), not in `localStorage` or IndexedDB. Reason: it must survive the reload after an import and be dropped when the tab or session ends, which `sessionStorage` does; a `localStorage` copy persists, doubles the quota use and would appear in the configuration export (`exportConfig` dumps all `localStorage` keys), which R5a forbids. Writing is synchronous; if it throws (quota, blocked storage), the import still runs and the Undo button is not shown.
- KTD10. **Debounced saves are flushed before the snapshot and before matching.** `Storage.flushPending()` (`src/world.ts:182`) runs first, otherwise an edit made less than one tick before the import is missing from the snapshot (and AE8 fails).

### Dependencies on Sibling Plans (assumed interfaces)

Not edited here; each is read-only input.

- **001 governor suppliers:** stores governor supply per product under the island-store key `<productGuid>.governorSupply` (001 KD1, KTD1), written by `planTrade` together with `restore.governorSupply` on the preserved entry; the import report code is `governor-supply-applied`. Both the key and the restore field are Trade (R8, R17a, R21, Appendix A). The shared key `passiveTrade.userSetAmount` is not used by governor supply; its per-island sharing is the defect of 001 OQ6, and the classifier lists the per-product successor key `<productGuid>.passiveTrade.userSetAmount` under Trade as well, so the follow-up needs no classifier change.
- **002 residence items:** Residences: `villaCoverage`, `<levelGuid>[<effectGuid>].coverage`, `<levelGuid>[<buildingGuid>].publicCoverage`, `publicCoverage`. Modifiers: `residenceItem.<itemGuid>.state`. The area-effect switch-on that 002 R15a writes (`island.effect.<guid>.scaling`, when any level of the effect is above 0) and the item write of 002 U11 (an item with `heroicEffect` stored as activated sets that effect to 1; R23a here) are Modifiers keys, so a Residences-only import stores the coverage and keeps the stored effect state. Order inside one island: `factories` (items), `residenceItems`, `residenceEffects`, `effects`; explicit `effects` values in the file and the measured `mythicEffect` of item records win over both writes. If 002 stores a key that the classifier patterns do not match, U1's coverage test fails and names the key.
- **003 DLC settings:** its R5 and OQ1 define the full-import behavior and R13 above extends it to scoped imports. DLC keys are matched against `params.dlcs` ids through 003's `dlcNumber` (003 KTD6). The `"0"` assignments are emitted by 003 U1's `dlcs()` and filtered by the merge (U4). Volcano scales (`sessionSettings`) and the unlocked set `volcano.unlocked` (003 KTD3) are Modifiers; 003 U2's clamp at 5 and `enabled: false` rule apply to every import that has Modifiers ticked. If 003 introduces a DLC-specific file, the DLC use detection in U3 (`dlcUse`) stays in `import-islands.ts` and reads `params.dlcs`.
- **004 factory effect UX:** defines the range-effect state that R25 writes ("Range-Effect State Contract": key `<targetGuid>[<effectGuid>].scaling`, raw 0/1, `keys.factoryEffectScaling`). The key and its persistence exist before 004 (per-building effect toggle plan 2026-09-19); U9 needs none of 004's UI.

### Sequence across plans

This section is the only statement of the merge order of plans 2026-11-12-001 to -004 and this plan; the other plans point here. Plans are named by their number (001 governor suppliers, 002 residence items, 003 DLC settings, 004 factory effect UX, SC this plan).

| Step | Units | Reason |
|---|---|---|
| 1 | SC U1-U6 | Creates the classifier (`scopes.ts`), the merge (`merge.ts`), the shared `assignIslandIds` and `isDeviceSetting`, and the scoped planner context. Every sibling plan adds its classifier rows on top. |
| 2 | 003 U1-U2 | Small edits to `dlcs()`, `volcano()`, `specificBySession()` and the exporter settings block, rebased onto step 1 with the function names unchanged. 003 U3-U5 (settings dialog, `DlcSettings`, docs) have no shared file with other plans except `src/i18n.ts` and the documentation files and can land at any point after step 1. |
| 3 | 001 U1-U6 | Needs the Trade rows of step 1. Must precede SC U8, whose AE6 asserts governor application and whose `holds()` snapshot includes `restore.governorSupply`. |
| 4 | SC U7, U8, U9 | U7 is pure and may land earlier. U8 follows step 3. U9 needs only U4 and the existing range-effect key (004's contract describes it). |
| 5 | 002 U1-U8, U11 | U4, U5, U8 add rows to `scopes.ts` and edit `import-islands.ts`, `exporter.ts`, `keys.ts` on top of steps 1 to 4; U11 (heroic-effect write, runs after U3 and before U4) edits `import-islands.ts` `effects()` and adds no classifier row (the effect key is Modifiers already); U7 (needs table) touches no exchange file. U10 follows when hand-off B is delivered; U9 documentation closes the plan. |
| 6 | 004 U1-U6 | Independent of 002; follows 001 and 002 only because both edit `production.ts`, `factories.ts`, `world.ts` and `presenters.ts` earlier. |
| 7 | SC U10 | Documentation of all exchange units. |

Files edited by more than one plan, in merge order:

| File | Plans |
|---|---|
| `src/exchange/import-islands.ts` | SC U3, 002 U11/U4/U8/U10 |
| `src/exchange/import-trade.ts` | SC U3, 001 U2, SC U8 |
| `src/exchange/import-effects.ts` | SC U3/U9, 003 U1/U2 (003 after SC U3 and before SC U9) |
| `src/exchange/exporter.ts` | SC U2/U5, 003 U1/U2, 001 U3, SC U8, 002 U5/U8/U10 |
| `src/exchange/keys.ts` | SC U1, 003 U1 (`dlcNumber`), 001 U1 (`governorSupply`), 002 U4/U8/U10 |
| `src/exchange/plan.ts`, `merge.ts`, `scopes.ts` | SC; sibling plans add `scopes.ts` rows in the unit that introduces the key (001 U1, 002 U4/U8/U10) |
| `src/exchange/types.ts`, `reader.ts`, `computed.ts` | SC U3/U5/U9, 001 U1/U2, 002 U2 |
| `src/production.ts`, `src/factories.ts`, `src/world.ts`, `src/presenters.ts` | 001 U1, 002 U3/U11, 004 U1/U2 (001 and 002 before 004) |
| `src/components.ts` | 001 U4, 004 U3 |
| `src/main.ts` | SC U6, 003 U3, 002 U6 |
| `src/i18n.ts` | SC U6, 003 U4, 001 U4, 002 U6/U7, 004 U5 (keys and owners below) |
| `style.css` | SC U6, 003 U4 (if needed), 002 U6/U7, 004 U4 |
| `templates/product-config-dialog.html` | 001 U4, 004 U7 (tab icon on lines 86-87; the rest of 004 edits `factory-config-section.html`, included at `product-config-dialog.html:106`) |
| `templates/settings-dialog.html` | 003 U4 only |
| `templates/effects-dialog.html`, `index.html`, `templates/population-level-config-dialog.html` | 002 U6/U7 only |
| `docs/exchange-format.md` | SC U10, 003 U5, 001 U6, 002 U9 (rows in different sections) |
| `src/AGENTS.md`, `tests/AGENTS.md`, `templates/AGENTS.md` | all plans, one section each |
| `tests/exchange/exporter.spec.ts`, `roundtrip.spec.ts` | 003 U1/U2, 001 U3, 002 U5/U8 |

New i18n keys, one owning plan per key (a plan that needs another plan's text reuses the key and adds none):

| Owner | Keys |
|---|---|
| SC U6 | `importScopeIslands`, `importScopeResidences`, `importScopeProduction`, `importScopeTrade`, `importScopeModifiers`, `importKeepIslands`, `importKeepRoutes`, `importRecalcRoutes`, `importWillReplace`, `importWillMerge`, `importLeavesAlone`, `importUndo` |
| 003 U4 | `volcanoLevel`, `volcanoLevelDiffers` |
| 001 U4 | `governorSupply`, `governorSupplyHint` |
| 002 U6 | `villaItems`, `villaItemsSearchPlaceholder`, `villaItemsOpen`, `villaCoverage`, `villaCoverageHint` (the column, sort and effect-note keys are listed in plan 002 U6) |
| 002 U7 | `needColSupplyWeight`, `needColDlc`, `needColSupplyBuilding`, `needColCoverage` |
| 004 U5 | `boostSources`, `rangeEffects`, `permanentEffects`, `boostSourcesGuidance`, `boostSourcesActiveCount`, `boostSourcesNet`, `rangeEffectNeedsBuilding`, `openEffectsDialog`, `openPatronDialog`, `boostBaseAddition`, `boostTimeLimitedEffects`, `boostSumOfUpgrades`, `productivityBreakdown` |

No key appears twice.
All text in these plans that mentions import report codes (`governor-supply-applied`, `residence-item-not-applied`, `dlc-enabled`, `dlc-not-listed`, `volcano-level-clamped`, `item-boost-approximated`, `appliedEffects` approximations and the like) refers to entries of `ImportPlan.report`. They serve tests and diagnostics; no UI shows them (R5).

### Implementation Units

U-IDs are stable plan-local identifiers. Order: U1, U2, U3, U4, U5, U6 form the scope feature; U7, U8 the route derivation; U9 the Modifiers items; U10 documentation. U7 and U9 can proceed in parallel with U5-U6 once U4 is done (U7 is pure and needs nothing); U8 follows plan 001 (see "Sequence across plans").

---

### U1. Scope model and key classifier

**Goal:** One module answers "which scope owns this key" for island-store keys, top-level keys and `exchange.ext` pointers.

**Requirements:** R7, R8, R9, Appendix A.

**Dependencies:** none.

**Files:**
- Create: `src/exchange/scopes.ts`
- Modify: `src/exchange/types.ts` (types `ImportScope`, `ScopeSelection`), `src/exchange/keys.ts` (pattern helpers for classifiable keys)
- Test: `tests/exchange/scopes.spec.ts`

**Approach:**
- `ImportScope = "islands" | "residences" | "production" | "trade" | "modifiers"`; `ScopeSelection` carries the five booleans and the three toggle flags (`keepIslands`, `keepRoutes`, `recalcRoutes`); `isFullReplacement(sel)` is true for five ticks and both keep flags off (KTD1). `recalcRoutes` does not enter it, because it changes the plan, not the merge.
- `classifyIslandKey(key, lookups)` returns a scope or `null` (unscoped). Patterns, using the builders of `keys.ts`: `<g>.buildings.*` is Residences when `g` is a residence GUID, Production when a factory or module GUID, except `<f>.buildings.fullyUtilizeConstructed` of a factory, which is Trade (R17); `<level>[<need>].checked|.notes` Residences; `<f>[<x>].scaling` via `parseFactoryScalingKey` (item or effect) Modifiers; `<f>.aqueductBuff.checked` Modifiers; `<f>.module[<m>].checked` Production; `island.effect.<g>.scaling` and `island.fertility.<g>.checked` Modifiers; `<p>.notes` Production; `<p>.defaultSupplier.type|id`, `<p>.governorSupply`, `passiveTrade.userSetAmount` and `<p>.passiveTrade.userSetAmount` Trade; `residenceItem.<i>.state` Modifiers; `villaCoverage`, `<level>[<effect>].coverage`, `<level>[<building>].publicCoverage` and `publicCoverage` Residences (the suffixes `.coverage` and `.publicCoverage` keep these apart from `<level>[<need>].checked|.notes` and `<f>[<x>].scaling`); `session`, `exchange.islandId`, `gameConnector.*` Islands. Remaining island-store keys (devotion, patron, wonders, romanization, coverage, manual productivity, materials, module attachments) are listed from the writes of `IslandPlanner` and `planEffects` (`this.store[...]`, `out.store[...]`) while implementing; each gets an entry in a table, not a regex.
- Implementation shape: one table-driven `classify(kind, key)` over three kinds (island key, top-level key including settings keys, ext pointer), not four independent functions. The ext merge in U4 reuses `restoreAt` (`exporter.ts:110`, exported for the purpose) for pointer handling; the classifier only decides the side. `keys.ts` gets a helper only where a table row needs one.
- Top-level rules, `classify("top", key)`: `tradeRoutes` Trade; `globalEffects`, `sessionSettings` Modifiers; `islandNames`, `islandName` Islands; `calculatorSettings` is split by setting key (`classifySettingKey`: keys equal to an id of `params.dlcs`, need-consumption id, `settings.volcano`/`seasons`/`difficulty` keys Modifiers; the import-scope keys and `language` device; the rest unscoped); `exchange.ext` is handled by pointer (U4); everything else unscoped.
- `classifyExtPointer(pointer)` maps `IslandExt` and `DocumentExt` members: `guids` entries by the first pointer segment (`/buildings/...` by GUID lookup, `/products/<p>/producer` Trade, `/effects` Modifiers, ...), `preservedImports`, `minimumStock`, `trade` Trade; `materials`, `moduleAttachments` Production; `research`, `effects`, `settings` Modifiers; `orphans`, `fileIslandIds` Islands; `calculator`, `captured`, `account`, `unlocatedItems` unscoped.
- Appendix A is the specification; the module's table mirrors it row by row.

**Patterns to follow:** `parseFactoryScalingKey` and `classifyItemOrEffect` (`src/exchange/index.ts`) for GUID-based classification; `Lookups` in `import-islands.ts:53-98`.

**Test scenarios:**
- Happy path: each key family of Appendix A classifies to the stated scope (table-driven, one row per family, using real GUIDs from `tests/AGENTS.md`: residence 3087, level 1499, factory 3089, module 77954, item 51339, effect 145095, product 2137).
- Edge: `<f>[<x>].scaling` with an unknown GUID returns `null`, never a scope.
- Edge: `3089.buildings.fullyUtilizeConstructed` (factory GUID) is Trade, `3089.buildings.constructed` is Production, and a residence's `3087.buildings.*` keys are Residences (residence and factory GUIDs differ).
- Coverage (integration): import a rich vendored fixture and the Marcia 69 and Marcia 73 planner files (skipped without them, like the existing Marcia scenario) with `planImport`; every key of every island store in the key map is classified or in an explicit unscoped allow-list. A new key written by a sibling plan fails this test and names the key.
- Error path: a malformed ext pointer classifies as unscoped, never throws.

**Verification:** the coverage scenario passes on every fixture of `vendor/anno117-exchange/fixtures/valid/`; Appendix A and the classifier table list the same families.

---

### U2. Island matching and shared id assignment

**Goal:** Match file islands to stored calculator islands (R10) with ids assigned beforehand.

**Requirements:** R10, KD3, KTD5.

**Dependencies:** none (parallel to U1).

**Files:**
- Create: `src/exchange/matching.ts`
- Modify: `src/exchange/exporter.ts` (`prepare()` calls the shared `assignIslandIds`), `src/exchange/types.ts`, `src/exchange/index.ts` (register `matchIslands` on `window.exchange` only for the specs that call it from the page)
- Test: `tests/exchange/matching.spec.ts`

**Approach:**
- `assignIslandIds(): string[]` is the body of `Exporter.prepare()` moved to a function (flush pending, assign through live islands, fall back to writing the id into the stored JSON) and returns the island names in stored order.
- `readStoredIslands(): StoredIsland[]` reads `islandNames` and each store: `{name, id, session, gameIsland?: {islandId, areaIndex}, store}`. The session GUID is the store key `session` (listed in the classifier's protected keys, `import-calculator.ts:15`); the game-island triple combines the session with `gameConnector.islandID` and `gameConnector.areaIndex` (`keys.ts:40-41`). The All Islands store is excluded.
- `matchIslands(fileIslands, stored): IslandMatch[]` applies the three rules in order, each calculator island matched at most once; the result lists, per file island, `{fileId, calcName | null, by: "id" | "triple" | "name"}`. An orphan island (unknown session) is never matched.
- The matcher is pure over its two inputs; reading storage is a separate function so tests can feed lists directly.

**Patterns to follow:** `Exporter.prepare()` (`exporter.ts:217-237`); the triple comparison in `src/statistics.ts:104`.

**Test scenarios:**
- Happy path: file id equals stored `exchange.islandId` -> match by id even when names differ.
- Happy path: no id match, game-island triple equal -> match by triple.
- Happy path: no triple (file has none), same name and same session -> match by name.
- Edge: same name, different session -> no match.
- Edge: two file islands with the same name and one calculator island -> the first gets it, the second is unmatched (each calculator island matched once).
- Edge: calculator island without id receives an id before matching and a second call returns the same id.
- Edge: file island with an unknown session (orphan) -> unmatched.
- Integration: after the export refactor `tests/exchange/island-id.spec.ts` and `exporter.spec.ts` pass unchanged.

**Verification:** the existing island-id and exporter specs pass without edits; matching specs cover AE1's four-of-six case.

---

### U3. Scope-aware planning inputs

**Goal:** The planners accept the matches and the selection, so names, skipped islands, supplier resolution and DLC use follow the scoped import.

**Requirements:** R11, R13, R15, R16, KTD4.

**Dependencies:** U1, U2.

**Files:**
- Modify: `src/exchange/types.ts` (`ImportContext` gains optional `scope`, `matches`, `storedIslandNames`, `recalcRoutes`; `IslandPlan` gains `skipped?: boolean` and `matchedTo?: string`), `src/exchange/import-islands.ts`, `src/exchange/import-trade.ts`, `src/exchange/import-effects.ts`, `src/exchange/plan.ts`, `src/exchange/index.ts`
- Test: `tests/exchange/plan.spec.ts` (extend), `tests/exchange/import-islands.spec.ts` (extend), `tests/exchange/import-trade.spec.ts` (extend)

**Approach:**
- `planIslands`: with Islands unticked, a matched island takes `matchedTo` as its key and a file island without a match is returned as `skipped` (its values are counted by the planner but written nowhere). With Islands ticked, matched islands use the file's name as today; the names of calculator islands that stay (keep on) seed `taken`.
- `planTrade`: `byId` contains matched, non-skipped islands only. A supplier or receiver naming a skipped island takes the existing unavailable path (OQ7). All routes use the plan keys, so R16 holds without remapping.
- DLC use: `noteDlc` in `import-islands.ts` and `import-effects.ts` counts only content of ticked scopes (buildings by residence/production scope, items and effects by Modifiers). `settingsKeys` for `"1"` therefore reflects ticked content (R13). The `"0"` assignments from `settings.dlcs` are emitted always and filtered by the merge (U4).
- Without `ctx.scope` all behavior is unchanged (full path).

**Patterns to follow:** `uniqueName` seeding (`import-islands.ts:501,519`); `byId` in `TradePlanner`.

**Test scenarios:**
- Covers AE1. Islands unticked, six file islands, four matches: the plan has four island plans with calculator names, two skipped with value counts, no store key for a skipped island.
- Edge: Islands ticked, keep on, a calculator island named like a file island that is not matched -> the file island gets a suffixed name (`uniqueName`), the calculator island keeps its name.
- Edge: a supplier names a skipped island -> degraded to the passive-trade default and kept in the preserved entry (OQ7).
- Covers AE4 (planning half). Production ticked, Modifiers unticked, a Dawn of the Delta building with `built > 0` -> `settingsKeys` holds the DLC as `"1"`; an item of the same DLC in the file does not add a key when Modifiers is unticked and no building needs it.
- Edge: no `ctx.scope` -> `plan.spec.ts` existing scenarios pass unchanged.

**Verification:** existing plan, import-islands and import-trade specs pass unchanged; the scoped scenarios above pass.

---

### U4. Scoped merge

**Goal:** Compute the final key map from the stored snapshot, the plan, the selection and the matches.

**Requirements:** R2, R6, R9, R11, R12, R13, R14, R17, R17a, R21, OQ5, OQ6.

**Dependencies:** U1, U2, U3.

**Files:**
- Create: `src/exchange/merge.ts`
- Modify: `src/exchange/types.ts`, `src/exchange/index.ts` (`window.exchange.planScopedImport(text, selection)` returning the final `ImportPlan` for the UI and tests)
- Test: `tests/exchange/merge.spec.ts`

**Approach:**
- `mergeScoped(stored: Map<string,string>, plan: ImportPlan, sel: ScopeSelection, matches): MergeResult` returns `{keyMap, skipped}`. When `isFullReplacement(sel)` it returns `plan.keyMap` (KTD1).
- Per island store (matched, non-skipped): start from the stored store; for each ticked scope except Islands, remove stored keys classified into that scope and add the plan's keys of that scope; Islands ticked replaces the Islands-classified keys (`session`, `gameConnector.*`, `exchange.islandId`). Unscoped keys of the stored store stay. `<f>.buildings.fullyUtilizeConstructed` classifies as Trade (U1) and is applied whenever Trade is ticked, regardless of the Production tick, and only where the resulting island store (stored when Production is unticked, the plan's otherwise) has `<f>.buildings.constructed > 0` (R17); with Trade unticked the plan's value is not applied.
- Islands: ticked and keep off -> the list is the plan's islands; ticked and keep on -> plan islands plus calculator islands that are not matched, stored unchanged; unticked -> the stored list. Islands removed by the replacement disappear with their store; the final `islandNames` and `islandName` follow the island list (the writer orders them, `writer.ts:70-90`). The All Islands store and aggregate routes are replaced only when all five are ticked (R12, OQ5).
- `tradeRoutes`: Trade unticked -> stored. Trade ticked, keep off -> the plan's routes (OQ6 filter: with the recommendation chosen, stored routes with an unmatched receiving island are added back). Keep on -> stored routes whose (product, receiving island) is not in the plan's produced set, plus the plan's routes (every stored route of a produced pair is dropped, whatever its supplier, R21); routes naming a deleted island are dropped. The plan's `restore` snapshots stay valid because for a replaced (product, receiver) only plan routes remain (R17a).
- Per-product default keys on a matched island in keep mode: keys of products the file produces a route set for follow the plan; keys of other products stay (R21).
- `calculatorSettings`: start from the stored settings; apply the plan's DLC, difficulty and Modifiers setting keys when Modifiers is ticked, except that a plan value `"0"` for a DLC is applied only with Modifiers ticked and a `"1"` is applied whenever the plan has it (R13). Scope toggles and `language` stay stored.
- `globalEffects`, `sessionSettings`: replaced when Modifiers is ticked, else stored.
- `exchange.ext` (island and document level): merge by pointer prefix with `classifyExtPointer`: unticked scopes keep the stored parts, ticked scopes take the plan's. A list whose pointers are index-based is taken from one side whole, never mixed (R17a).
- Device preferences are applied by the writer after the merge as today (`writer.ts:93-114`), extended in U5 for the scope settings.

**Patterns to follow:** `mergeDevicePreferences` (`writer.ts:93`) for settings merging; `restoreAt` (`exporter.ts:110`) for pointer handling.

**Test scenarios:**
- Covers AE1, AE2. Table-driven over selections on a two-island stored setup and a file with matched and unmatched islands: Islands unticked keeps the stored list; Islands ticked, keep off, drops two unmatched calculator islands with their stores and their routes; keep on keeps them (eight islands).
- Happy path: each single scope ticked with the other four unticked changes only keys of that scope (diff of final vs stored contains only keys the classifier assigns to the ticked scope, plus `exchange.ext`, `islandNames` unchanged).
- Covers AE7. Keep on: stored Wine route stays, stored Bread route is replaced by the plan's Bread route set; the default key of Bread follows the plan, the default key of Wine stays.
- Edge: keep on, file produces a Bread set for Roma from Ostia; stored Bread routes from Ostia to Roma and from Capua to Roma are both gone, stored Bread route from Ostia to Capua stays.
- Edge (R14): a kept default route Ostia->Roma and a plan default route that would close a cycle -> the plan route is written ordinary (covered in U8, asserted here through the merge result).
- Edge (R17): Trade ticked, Production unticked, file marks fuller utilization for factory 3174; stored island has the factory built -> `fullyUtilizeConstructed` set; stored island lacks it -> not set, and no factory is created. Trade unticked, Production ticked -> the rule's value is not applied.
- Edge (R13): Modifiers unticked, file `settings.dlcs` omits DLC02 -> stored DLC02 flag unchanged; ticked -> `"0"`.
- Edge (R9): `collapsibleStates`, `statisticsCollections`, `darkMode.checked` unchanged by any partial selection.
- Edge (R12): All Islands store unchanged unless all five are ticked.
- Integration: full selection -> final key map equals `plan.keyMap` (KTD1), asserted on two vendored fixtures.
- Error path: a stored store that is not valid JSON is kept as it is and reported through `skipped`, not thrown.

**Verification:** merge spec passes; the full-selection equality holds for every vendored valid fixture.

---

### U5. Undo snapshot, writer integration, removal of the computed hand-off

**Goal:** Store one snapshot before each import, restore it on Undo, and remove the hand-off of the file's computed values.

**Requirements:** R3 (device preferences), R5, R5a, KTD9, KTD10.

**Dependencies:** U4.

**Files:**
- Create: `src/exchange/undo.ts`
- Modify: `src/exchange/writer.ts` (remove `COMPUTED_SESSION_KEY` hand-off, add the "just imported" flag), `src/exchange/computed.ts` (remove `compareHandOff` and its types if no other caller; `computeSummary` stays for export), `src/exchange/exporter.ts` and `src/exchange/import-calculator.ts` (one shared `isDeviceSetting(key)` covering `language` and the import-scope keys, replacing both `DEVICE_SETTINGS` constants), `src/exchange/index.ts`
- Test: `tests/exchange/undo.spec.ts`, `tests/exchange/writer.spec.ts` (update), `tests/exchange/computed.spec.ts` (update)

**Approach:**
- `undo.ts` only stores and loads: `saveSnapshot(map)`, `loadSnapshot()`, `clearSnapshot()`, `hasSnapshot()` over one `sessionStorage` key (`exchange.undoSnapshot`, overwritten by each save: "dropped by the next import's snapshot"). The snapshot is taken with the writer's own `snapshot()` and written back with its `restore()` (both exported from `writer.ts`, no second implementation). All functions are synchronous and never throw; a failure returns `{ok:false, error}`.
- `restoreSnapshot()`: load the record, run it through `mergeDevicePreferences` (generalized to carry every device key, so language, dark mode and the scope settings survive), restore through `restore()`, clear the record, set the reload flag and reload. A write failure restores the pre-undo storage as `applyImport` does.
- The flag `exchange.justImported` replaces the `exchange.computed` key as the "just imported" signal because the computed key is absent whenever the file has no `computed` block.
- `applyImport` itself stays synchronous and atomic. The caller (U6) flushes pending saves, builds the snapshot from `localStorage`, calls `saveSnapshot`, then calls `applyImport(finalPlan)`. A failed save does not stop the import; `hasSnapshot()` is then false and the Undo button is not shown.
- The sessionStorage key `exchange.computed` is replaced by `exchange.justImported = "1"`, written by `applyImport` after a successful commit and consumed by U6 at start. The `plan.computed` field stays readable in `ImportPlan` (tests, export round-trip) but is no longer handed over.
- `showExchangeReportDialog` remains for the export report (R5).

**Patterns to follow:** atomic restore in `applyImport` (`writer.ts:164-173`); `seedOnce` marker in `sessionStorage` (`tests/helpers/exchange.ts`).

**Test scenarios:**
- Covers AE8. Edit a factory value in storage, import (reload suppressed), edit another value, restore -> storage equals the state before the import byte for byte except device preferences (language, dark mode, scope ticks and toggles keep their values from before the Undo); the second edit is gone.
- Happy path: the snapshot is still present after a page reload in the same tab (`sessionStorage`) and absent in a new tab.
- Happy path: second import overwrites the snapshot; Undo then returns to the state before the second import only.
- Edge: no snapshot -> `hasSnapshot()` false; Undo is a no-op returning `{ok:false}`.
- Edge: after Undo the snapshot is gone (`hasSnapshot()` false).
- Edge: language and dark mode changed after the import survive Undo.
- Error path: `saveSnapshot` fails (`sessionStorage.setItem` throws through a test hook) -> `{ok:false}` is returned, `applyImport` still runs, `hasSnapshot()` is false and the Undo button is not shown after the reload.
- Error path: write failure during restore (`failAfterWrites` hook as in `writer.spec.ts`) -> previous storage restored.
- Integration: `tests/exchange/writer.spec.ts` scenarios for clear/write/atomicity pass; the scenario that asserted the `exchange.computed` hand-off now asserts `exchange.justImported`.
- Integration: the exported configuration (`exportConfig`) contains no snapshot data, and `localStorage` holds no snapshot key.

**Verification:** undo and writer specs pass; `computed.spec.ts` keeps `computeSummary` scenarios and drops the hand-off comparison scenarios.

---

### U6. Download dialog UI and import listener

**Goal:** Five checkboxes, three toggles, the sentence, the Undo button, immediate import, persisted states.

**Requirements:** R1, R2, R3, R4, R5, R5a, R18 (toggle), mock `#report`.

**Dependencies:** U4, U5.

**Files:**
- Create: `src/exchange/import-scopes-ui.ts` (view model: observables, persistence, sentence, undo state)
- Modify: `templates/download-dialog.html`, `src/main.ts` (rewrite `installImportExchangeListener`, remove `showComputedDifferences` and its call at the end of bootstrap, open the dialog when `exchange.justImported` is set), `src/exchange/report-dialog.ts` and `templates/exchange-report-dialog.html` (remove import and differences modes, keep export mode and the invalid message), `src/i18n.ts` (keys below, 12 languages), `style.css` if the mock needs classes, `tests/helpers/exchange.ts` (`importText(page, text, selection?)`)
- Test: `tests/exchange/import-scopes-ui.spec.ts` (create), `tests/exchange/ui.spec.ts` (update)

**Approach:**
- View model on `window.view.importScopes`: eight `Option` instances (`src/util.ts:386`, with `checked`) for `islands`, `residences`, `production`, `trade`, `modifiers`, `keepIslands`, `keepRoutes`, `recalcRoutes`, persisted with the same pattern as the settings options (`src/main.ts:497-527`, `SubStorage("calculatorSettings")`, keys `settings.importScope.<name>`, `"1"`/`"0"`); the registration site of `view.settings` was not read. The three toggles are enabled only while their scope is ticked (the stored value stays; the effective selection treats it as off). `isDeviceSetting` (U5) excludes the keys from export and import.
- Sentence: one computed that lists, with the scope names already translated by their checkbox labels, "replaces: ...", "merges: ..." (scopes with a ticked keep toggle) and "leaves alone: ..." (unticked scopes plus UI state). With `recalcRoutes` effective it appends the route toggle's title text ("Re-calculate routes from savegame data") to the replace clause for Trade. Only three i18n fragments (the clause lead-ins) are added besides the scope names and toggle titles. The mock shows it as one paragraph under the checkboxes with `aria-live="polite"`.
- Template (mock `#report`): under the exchange row, a `div.scope` with `role="group"`, five rows (`label` with checkbox, icon and name), three icon-only toggle buttons (`aria-pressed`, `disabled` while the scope is unticked, `title` text "Keep my other islands", "Keep my other routes" and "Re-calculate routes from savegame data"; the third sits next to the Trade checkbox beside the keep-routes button), the sentence, then the Undo button bound to `importScopes.undoAvailable`. The Undo label is the i18n text "Undo import. Everything changed since then is lost." Use `<!-- ko if: ... -->` for the Undo button, not `visible:` (templates/AGENTS.md pitfall class).
- Listener: on file select: read text; `planScopedImport(text, selection)` (U4); on `error` set `exchangeReport.invalid` (existing message block `download-dialog.html:48-53` stays); else `Storage.flushPending()`, snapshot, `saveSnapshot` (a failure is ignored), `applyImport(plan)`. No dialog is opened. The selection passed to `planScopedImport` carries `recalcRoutes`. The input value is reset after reading as today.
- After reload: bootstrap checks `exchange.justImported`, consumes it, and opens `#download-dialog`; `undoAvailable` is set from `hasSnapshot()` (synchronous). The Undo button calls `restoreSnapshot()`.
- i18n keys (English text, each completed by the translate workflow for the 12 languages): `importScopeIslands`, `importScopeResidences`, `importScopeProduction`, `importScopeTrade`, `importScopeModifiers`, `importKeepIslands`, `importKeepRoutes`, `importRecalcRoutes`, three sentence lead-ins (`importWillReplace`, `importWillMerge`, `importLeavesAlone`), `importUndo`. Region names follow params.js translations where a game term exists (residences, production buildings) and i18n.ts otherwise.

**Patterns to follow:** `installImportExchangeListener` and `exportExchange` in `src/main.ts:327-429`; the Option persistence at `src/main.ts:497-527`; the mock's markup for the scope block.

**Test scenarios:**
- Happy path (binding): the dialog shows five checkboxes in the order of R1, all ticked, the three toggle buttons' disabled state matches ticks and each has a non-empty `title` and `aria-label`; unticking Islands disables its keep button, unticking Trade disables the routes keep and re-calculation buttons.
- Covers AE3. Untick Production, press the routes keep toggle and the re-calculation toggle, reload -> same states.
- Happy path: with the re-calculation toggle on, the sentence mentions the derivation from routes; with it off, it does not.
- Happy path: the sentence text changes when a checkbox changes (assert the sentence contains the name of an unticked scope in the "leaves alone" part).
- Integration: choosing a file imports with no dialog opened (`#exchange-report-dialog` never shown) and reloads; the Download dialog opens afterwards with the Undo button visible.
- Covers AE8 (UI half). The Undo button's text is exactly "Undo import. Everything changed since then is lost."; its `title` equals the label; press Undo -> storage equals the pre-import state except device preferences; the button is gone after the reload. With `sessionStorage.setItem` failing for the snapshot key, the import still runs and the button does not appear.
- Edge: a file that is not an exchange file shows the invalid message and imports nothing; no Undo button appears.
- Edge: with Islands unticked and Residences ticked, only residence keys change (assert through storage diff with a two-island setup).
- Edge: the scope settings are absent from an exported exchange document and ignored from an imported `ext.calculator.settings`.
- Edge: no binding errors (`BindingDetector`) in the dialog in light and dark mode.
- Integration: `tests/exchange/ui.spec.ts` scenarios that clicked Confirm in the report dialog now import directly; export report scenarios unchanged.

**Verification:** UI specs pass serially (`--workers=1`); `npm run check-translations` passes; `npm run type-check` passes.

---

### U7. Route derivation from savegame routes (pure)

**Goal:** Implement the spec's reference derivation and the predicate that gates the re-calculation toggle.

**Requirements:** R18, R20, KD5, KTD7, OQ3, OQ4.

**Dependencies:** none (pure); consumed by U8.

**Files:**
- Create: `src/exchange/derive-routes.ts`
- Modify: `src/exchange/types.ts` (types for derived imports if not covered by `TradeImport`)
- Test: `tests/exchange/derive-routes.spec.ts`

**Approach:**
- `hasShipRoutes(doc): boolean` is the single place that decides whether the re-calculation toggle has an effect: `trade.routes` holds at least one route with at least one ship. It reads no source signal (OQ3); adding one later changes this function only.
- `deriveImports(routes, visits, islandIds): TradeImport[]` follows `format.md:157-185`: skip routes without ships; per product source/sink/relay roles from slot modes; nearest preceding source in circuit order with wraparound and same-slot-index preference; weights = unload amount times ship count; share = weight over the sum per (island, product); residual supplier by R54 (largest share, ties by smallest island id) marked `default`; relays without a net amount of the product get no entry (visits); a station without island id is dropped; role from signs of net amounts when every stop both loads and unloads. Output entries carry `basis: "planned"` and no amounts.
- The conformance fixtures `vendor/anno117-exchange/fixtures/valid/trade-*.json` each hold routes and the expected `trade.imports`; they are the oracle.

**Patterns to follow:** the existing partial derivation in `import-trade.ts:375-421` (`disagreement`), which this replaces for savegame sources.

**Test scenarios:**
- Happy path: one test per conformance fixture (`trade-point-to-point`, distribution circuit with relays, relay net zero, manual one-slot route, cross-session distribution, multi-source collection, non-player station, same sink twice, loaded never unloaded, bidirectional circuit, shared supply, no ships): derived suppliers, default flag and shares equal the fixture's `trade.imports` (shares compared with tolerance).
- Edge: route with `ships: []` and with all counts 0 -> no entry.
- Edge: a station without `island` is neither sink nor source.
- Edge: ties in share -> smallest island id is the default.
- Edge: a good never unloaded -> no entry.
- Covers AE5 (derivation half). Roma-Ostia with Bread -> entry for Roma, product Bread, supplier Ostia, `default: true`, no amount.
- Error path: malformed route (missing `stations`) is skipped without throwing.
- `hasShipRoutes`: a planner file with ship-carrying routes (true), a savegame file with ships (true), routes with `ships: []` or all counts 0 (false), no `trade.routes` (false); `source.kind` and `generator.name` do not change the result.

**Verification:** all conformance fixtures derive their expected imports.

---

### U8. Trade planning from derived routes, amounts as floor 0, keep mode

**Goal:** `planTrade` consumes effective imports, writes floor 0 with the kept amount, and takes kept routes into the checks.

**Requirements:** R14, R17, R18, R19, R19a, R20, R21, R22.

**Dependencies:** U3, U4, U7.

**Files:**
- Modify: `src/exchange/import-trade.ts`, `src/exchange/types.ts` (`ImportContext.keptRoutes`, `PreservedImportReason` gains `amount-kept`), `src/exchange/exporter.ts` (only if the hold check needs a reason-specific message), `src/exchange/merge.ts` (compute the produced pair set before planning)
- Test: `tests/exchange/import-trade.spec.ts` (extend), `tests/exchange/roundtrip.spec.ts` (extend)

**Approach:**
- `effectiveImports(read, ctx.recalcRoutes)`: with the toggle on and `hasShipRoutes(doc)` (U7) the derived imports, with (a) supplier entries of `trade.imports[]` for the same (island, product) that are governor, non-player or passive appended unchanged (R20), (b) island suppliers of the file's import entries with `basis: "entered"` carrying their amount as floor. Otherwise (toggle off, or no ship-carrying routes) `trade.imports` as in the file. With the derivation active it replaces the `routes-not-derived` report entry and the `disagreement` comparison (`import-trade.ts:366-421`) for that file; otherwise both stay as today (routes present, imports authoritative).
- Floor rule: `amountOf` returns the amount only for entered entries; every other island supplier gets floor 0 and its entry becomes a preserved entry with reason `amount-kept` (KTD8) so export returns the planned amount while the snapshot holds. For derived entries nothing is preserved (no amounts exist).
- Kept routes: `ImportContext.keptRoutes` (stored routes that survive, computed by the merge from the produced pair set: pairs (product, receiver key) of the effective imports with at least one island supplier) seed `routeKeys` and the `defaults` map, so `defaultBlocked` sees them; a plan route equal to a kept route by (product, from, to) wins (R14).
- The local producer rule (`import-trade.ts:316-331`) runs whenever Trade is ticked and writes `<f>.buildings.fullyUtilizeConstructed` through the merge rules of U4 (R17).
- R22 holds because the exporter groups calculator routes into `trade.imports` and the document ext keeps `trade.routes`; a test asserts it.

**Patterns to follow:** `processImport`, `finish()` snapshots (`import-trade.ts:169-285,424-439`).

**Test scenarios:**
- Covers AE5. File with a route with ships, Roma/Ostia/Bread, plus an imports entry for Roma and Bread listing Ostia (`basis: "entered"`, amount 0.5) and Capua: toggle on -> supplier set and default from the route, floor 0 except the entered 0.5; toggle off -> supplier set Ostia and Capua from the entry.
- Edge (R18): toggle on and a file without ships on any route -> `trade.imports` is the input; toggle on and a governor supplier in the entry -> the governor entry is preserved next to the derived island suppliers (R20).
- Covers AE6. Planner file, supplier Roma-Ostia Bread amount 0.38: route written with `userSetAmount` 0, default as in the file, export writes `amount` 0.38 again (round trip), a governor supplier stays preserved and (with plan 001) applied.
- Edge: after import the player sets a floor of 0.2 on the route; export writes 0.2 as `amount` and reports the dropped preserved amount (`import-entry-dropped`).
- Edge: a file with `routes` and no ships on any route, toggle on -> `trade.imports` is the input (R19).
- Edge (R17): Trade ticked, Production unticked, an imported good with a local producer built on the island -> the factory's fully-utilize setting is written; the factory does not exist -> nothing is written and no factory is created.
- Edge (R14): kept default Ostia->Roma Bread, plan default Roma->Ostia Bread -> cycle detected through the kept route, plan route written ordinary.
- Edge (R14): duplicate (product, from, to) between a kept route and a plan route -> one route, the plan's.
- Integration (R22): import a fixture with ship-carrying routes (toggle on), export -> `trade.imports` contains every derived flow, `ext.trade.routes` equals the file's `trade.routes` verbatim.
- Integration: Marcia 73 and Marcia 69 planner exports (skipped without the files): 305/365 imports entries produce the observed 319/382 routes and 14/17 amounts are kept as floor 0 with the planned amount restored on export.

**Verification:** import-trade and roundtrip specs pass; the Marcia scenarios reproduce the counts above.

---

### U9. Modifiers: global effects, unknown GUIDs, range effects, wonders

**Goal:** Characterize and close the remaining Modifiers requirements.

**Requirements:** R23, R23a, R24, R25, R26.

**Dependencies:** U1, U4; R25 uses the range-effect state contract of plan 004 (existing key, no dependency on 004's UI).

**Files:**
- Modify: `src/exchange/import-effects.ts` (diagnosis result for R23; R25 mapping when the key exists), `src/exchange/reader.ts` (`appliedEffects` leaves KEPT only when R25 ships)
- Test: `tests/exchange/import-effects.spec.ts` (extend)

**Approach:**
- R23 and R24 are implemented (`specificGlobal`, `keepEffect`). The unit adds scenarios that pin them and diagnoses the missing effect 183157 in the Marcia 73 and Marcia 69 files: check `classify(183157, "global")` (scope string, `import-effects.ts:107-112`) and the dormant area-buff deletion in `finish()` (`:427-430`) as the two candidate causes (unverified hypothesis). Outcome is a fix or a documented non-goal in `docs/exchange-format.md`.
- R25 is implemented here: `planEffects` applies each `appliedEffects` entry to `keys.factoryEffectScaling(type, effect)` as R25 states (state contract of plan 004), after the `factories[].effects[]` pass, through `noteDlc`. Entries that cannot be applied and `scale`/`method` stay kept in `exchange.ext`; the classifier lists the `appliedEffects` and `rangeBuffs` ext pointers under Modifiers.
- R26: `wonders` stays KEPT in `reader.ts` and travels through `exchange.ext` at `/wonders` (classifier: Modifiers); no key is applied.

**Test scenarios:**
- Covers R23. `effects.global` with a GUID not derivable from `research.researched` -> applied as global effect scale.
- Covers R24. Unknown global GUIDs 95709, 137876, 153864 and island effect 166463 -> not in `globalEffects`, present in the ext and exported again.
- Edge: global effect of a DLC the player has off, Modifiers ticked -> DLC switched on (R13).
- Edge: Modifiers unticked -> `globalEffects` stored values unchanged (merge, U4).
- Marcia files (skipped without them): the diagnosis scenario asserts which of the two candidate causes holds.
- Covers R25. `appliedEffects` entry `{type: 3174, effect: 174824, applied: false}` writes 0 and `applied: true` writes 1 to `3174[174824].scaling` (DLC of the effect noted); `share: 0.5` with `applied: true` writes 1 and records an approximation in `ImportPlan.report`; an entry for an effect without per-target state (item-sourced effect 51635) or a `type` outside the effect's targets writes nothing and stays kept; an entry wins over a `factories[].effects[]` listing of the same pair.
- Covers R23a (merge half; the write itself is tested in plan 002 U11). A file with an item that has `heroicEffect` stored as activated and no `effects` entry: with Modifiers ticked the plan holds `island.effect.<heroicEffect>.scaling` = 1; with Modifiers unticked the stored value of that key and the stored item state are unchanged; with only Residences ticked the stored effect value is unchanged; a file that states the effect with value 0 keeps 0 with Modifiers ticked.
- Covers R26 and AE9. `wonders` with entries for 3621 (`rank` 3, `coverage` 80) and 152714 (`rank` 1): the island stores no wonder-effect key, export returns both entries byte for byte (JSON equality); with Modifiers unticked the stored ext part is unchanged.

**Verification:** import-effects spec passes; the diagnosis outcome is recorded in `docs/exchange-format.md`.

---

### U10. Documentation

**Goal:** Document the scopes, the merge, the undo and the route precedence where the maintainers look.

**Requirements:** all.

**Dependencies:** U1-U9.

**Files:**
- Modify: `docs/exchange-format.md` (scopes, matching, undo, route derivation, floor 0 and kept amounts), `src/AGENTS.md` (Exchange section: merge pipeline, classifier ownership, undo store), `tests/AGENTS.md` (exchange tests: new specs, `importText` selection parameter, `sessionStorage` snapshot note), `scripts/AGENTS.md` unchanged.

**Test expectation:** none -- documentation only.

**Verification:** the documented key families match Appendix A and `scopes.ts`.

---

## Verification Contract

- `npm run type-check` and `npm run build` pass; `npm run check-translations` passes after the new i18n keys.
- `npm run build ; npx playwright test tests/exchange --reporter=list --workers=1`, one invocation at a time (tests/AGENTS.md concurrency rule), passes, including the unchanged round-trip, conformance and exporter specs (KTD1 regression anchor).
- AE1-AE9 each have a covering scenario (marked "Covers AE<N>" above).
- Manual check in the UI, light and dark mode: scope block layout as in the mock section `#report`; Undo button after an import; no report dialog.

## Definition of Done

- All units U1-U10 delivered; every requirement R1-R26 traceable to a unit.
- Full import (five ticks, keeps off) produces the same stored data as before the change on every vendored valid fixture.
- A partial import changes only keys of ticked scopes (merge spec), and Undo restores the pre-import state (AE8).
- OQ6 and OQ7 are decided as recommended unless the maintainer answers otherwise; OQ3 and OQ4 are posted on the format issue by the maintainer.

## Risks

- **Classifier gaps.** A key written by a sibling plan that no pattern matches is silently unscoped. Mitigation: the coverage scenario in U1 fails on any unclassified island-store key of a rich plan.
- **Snapshot storage.** `sessionStorage` may be full or blocked (the snapshot is a copy of all stored data). Mitigation: the import still runs and the Undo button is not shown (R5a); a test hook covers the failure.
- **Keep-mode semantics.** Kept routes interact with default-supplier cycle checks across the island list. Mitigation: kept routes seed the same maps as plan routes (U8) and two merge scenarios cover the interaction.
- **Derived sets differ from planner imports.** With the toggle on, supplier sets follow the reference derivation, which deviates from the planner's `imports` for about 15 percent of entries on two real saves. Mitigation: the toggle is off by default, and OQ4 asks the format owners whether the derivation should become the default.

---

## Appendix A: Stored keys by scope

Evidence is from the investigation. "Kept" means read and written back without effect.

| Scope | Keys and fields | Evidence |
|---|---|---|
| Islands | `islands[].id/name/session/gameIsland`, `islandFile`, `islandSize`, `position`, `settings.map` (kept), orphan islands; island store keys `session`, `exchange.islandId`, `gameConnector.*`, `islandNames`, `islandName` | `import-islands.ts:187-201,505-516`; `world.ts:646,1379-1399`; `writer.ts:148-149` |
| Residences | `buildings[g].built/planned/fullyUtilize` for residence GUIDs, `residencesByLevel`, `disabledNeeds`, `needNotes`, `<res>.effectCoverage`, `residenceEffects`, `publicCoverages`; island-store keys of plan 002: `villaCoverage`, `<levelGuid>[<effectGuid>].coverage`, `<levelGuid>[<buildingGuid>].publicCoverage`, `publicCoverage` | `import-islands.ts:203-260,417-428`; `world.ts:749-753,1234-1253` |
| Production buildings | the same `buildings[g]` keys for factory and module GUIDs (except `<f>.buildings.fullyUtilizeConstructed`, Trade), `factories[f].modules`, `manualProductivity`, `moduleAttachments`, `materials`, `products[p].notes` | `import-islands.ts:333-347,439`; `import-effects.ts:364-421`; `import-trade.ts:118` |
| Trade routes and suppliers | `trade.imports`, `trade.routes`, `visits`, `governorHarbours`, `minimumStock`, `harbour` and `fleet` (kept), `products[p].producer`, default supplier keys, `<productGuid>.governorSupply` (plan 001, per product), `<factoryGuid>.buildings.fullyUtilizeConstructed` (local producer rule, R17), `passiveTrade.userSetAmount` (one value per island) and `<productGuid>.passiveTrade.userSetAmount` (per-product successor, plan 001 OQ6), `tradeRoutes` store key; report code `governor-supply-applied` | `import-trade.ts:97-136,169-285,335-371`; `world.ts:1101-1156`; `trade.ts:284-336`; `exporter.ts:466-481` |
| Modifiers | `factories[f].items/effects/aqueduct`, `effects` (global, `bySession`), `itemHolders` (mythic effect), the island effect key `island.effect.<guid>.scaling` also when an item entry sets it (plan 002 U11, R23a: items first, stated effects win), `residenceItems` (island-store key `residenceItem.<itemGuid>.state`, plan 002), `islandItems`, `appliedEffects` and `rangeBuffs` (applied through the island-store key `<targetGuid>[<effectGuid>].scaling`, raw 0/1 via `keys.factoryEffectScaling`: `applied` true is 1, false is 0, fractional `share` approximated, `scale` and `method` kept; plan 004), `wonders`, `romanization`, `patron`, `devotion`, `dominantPatron`, `research.*`, `settings.volcano`, `settings.seasons`, `settings.difficulty`, `settings.dlcs` (`calculatorSettings` keys equal to an id of `params.dlcs`, plan 003; unknown numbers in `ext.settings.dlcsUnknown`), volcano scales (`sessionSettings` keys `session.<session>.effect.<effect>.scaling`, plan 003) and the unlocked volcano effect set (`sessionSettings` key `volcano.unlocked`, plan 003), `fertilities` (KD6) | `import-islands.ts:262-332,357-415`; `import-effects.ts:130-360`; `world.ts:923-1067,1167-1179`; `main.ts:500-611` |
| No scope | `ext.calculator` UI state, `collapsibleStates`, `statisticsCollections`, `darkMode`, `language`, the import-scope settings, `extraDemand`, `population`, `layout`, `account`, `unlocatedItems`, `history`, `live` | `import-calculator.ts:17,88-119`; `reader.ts:58-101`; `plan.ts:25-29,87-104` |

Residence effect coverage is stored with the residence but needs its effect switched on (Modifiers) to act; the two scopes can be imported independently without inconsistency, because an effect without coverage uses the default of 100 and coverage without the effect does nothing. The same holds for `villaCoverage` (Residences) and residence items (Modifiers). The area-effect switch-on of plan 002 R15a (`island.effect.<guid>.scaling`) is a Modifiers key. The splendour effects held in `islands[].wonders` (R26) are Modifiers.
