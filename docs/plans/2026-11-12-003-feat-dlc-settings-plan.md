---
title: DLC Settings - Plan
type: feat
date: 2026-11-12
topic: dlc-settings
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: ce-brainstorm
---

# DLC Settings - Plan

## Goal Capsule

- **Objective:** State what DLC-dependent configuration (owned DLCs, the volcano level and its unlocked effects, DLC-gated content) the calculator holds, what the user can set, and how that state crosses the savegame exchange format without loss or silent override.
- **Product authority:** The exchange-format spec (`c:\dev\anno-117-exchange-format\spec\format.md`, `spec\conversion-rules.md`) owns the file semantics; the calculator owns what its settings dialog offers and how it applies imported values. Issue anno-mods/anno-117-savegame-exchange-format#1 (original post 2026-11-09, Taludas comment 2026-11-12) is the open request.
- **Open blockers:** None. Open questions are listed with a recommendation each; none blocks the units below (OQ5 gates one half of U2).

---

## Product Contract

### Problem

The issue asks for fixed DLC identifiers and, in Taludas's five additions, for the volcano value semantics (`effects.bySession` carries the active level, `settings.volcano.durations` the share of time).

The DLC identifier question is already settled by the spec: `settings.dlcs` lists owned DLC numbers 1 Prophecies of Ash (GUID 67902), 2 The Hippodrome (67903), 3 Dawn of the Delta (67904), and the calculator keys are `DLC01_Prophecies_of_Ash`, `DLC02_The_Hippodrome`, `DLC03_Dawn_of_Delta` (`c:\dev\anno-117-exchange-format\spec\format.md:44`; same ids in `js/params.js:18669,18689,18709`). The planner uses the same numbers (`c:\dev\Anno-117-Planner\paxplanner\model\gamedata.py` `DLCS`, assumption: imported by `cli.py:27` as `DLCS = (1, 2, 3)`).

What remains open is the calculator's own behaviour at the edges: which values it reads as DLC state, which it keeps, and which control the user has. The calculator already round-trips both settings (see Existing Behavior). The gaps are:

1. The calculator has no volcano control of its own. The volcano level lives only as per-session effect scalings; view mode "Master" sets all three to 5 (`src/views.ts:138-147`), otherwise the user edits individual effects.
2. The calculator treats a volcano effect scale as always active at that level. The planner's `settings.volcano.durations` and `phase` describe time shares the calculator does not model (`c:\dev\Anno-117-Planner\paxplanner\model\project.py:58-65`).
3. The import loop for owned DLCs is fixed to numbers 1 to 3 (`src/exchange/import-effects.ts:334`); a DLC added to `params.dlcs` later is not imported.
4. On import the calculator switches DLCs off that the file omits (`src/exchange/import-effects.ts:335-336`); the planner leaves its DLC switches untouched and only reports (`c:\dev\Anno-117-Planner\paxplanner\model\exchange_import.py:498-500`).

### Existing Behavior (verified)

- DLCs are options built from `params.dlcs`, shown as checkboxes in the settings dialog, persisted as `"1"`/`"0"` under their id in `calculatorSettings` (`src/main.ts:500-512`, `templates/settings-dialog.html:60-69`).
- A DLC is locked on while anything depending on it is non-zero (`DLC.used`), and checks itself when something dependent is loaded non-zero (`src/util.ts:407-439`). A building, item or effect tied to exactly one DLC registers with it (`src/util.ts:337-355`, `src/factories.ts:119,426`, `src/production.ts:808,908,989`; invariant in `src/AGENTS.md:105`). The three volcano effects each list exactly one DLC (67902, `js/params.js:23022` and the same field of the other two), so any non-zero volcano scale forces Prophecies of Ash on and locks its checkbox.
- DLC-gated products, factories and needs are hidden until the DLC is on (`docs/releas_notes_2.0.md:7`; `src/util.ts:337-340` `available`).
- Views "Plan" and "Master" switch all DLCs on (`src/views.ts:109-112,130-132`).
- Export writes `settings.dlcs` from the stored flags and keeps numbers outside 1 to 3 (`src/exchange/exporter.ts:666-679`). Import writes `"1"`/`"0"` for DLCs 1 to 3 and keeps other numbers for write-back (`src/exchange/import-effects.ts:327-343`). A DLC that the island data requires (DLC-tied buildings, items, effects) wins over a listed `"0"` (`src/exchange/plan.ts:110`, `src/exchange/import-islands.ts:473-477`, `src/exchange/import-effects.ts:431-433`).
- Volcano: the three effects Obsidian Gathering 145095, Obsidian Mining 148043 and Fertile Soil 145099 (internal name "VolcanoEffect Phase04 AshBloom", English name "Fertile Soil", `js/params.js:23063-23079`) are session effects written in the Latium (3245) and Meta (37135) sessions (`src/exchange/discoveries.ts:15-19`). Export derives `settings.volcano.level` (largest scale) and `effects` (those above 0) and preserves every other key of a stored `settings.volcano` (`src/exchange/exporter.ts:704-727`). Import applies `level` to each listed effect and 0 to the others unless `effects.bySession` states the effect, in which case the effect wins and the disagreement is reported (`src/exchange/import-effects.ts:249-283`; spec CD7, `spec\conversion-rules.md:10-11`). Unknown volcano keys such as `durations` and `phase` are kept in `ext.settings` (`src/exchange/types.ts:603-604`, `src/exchange/import-effects.ts:252`).
- Session effects exist for every session and persist as `session.<session>.effect.<effect>.scaling` in the `sessionSettings` SubStorage (`src/world.ts:259-276`).
- Reader accepts `settings.dlcs` as integers and `settings.volcano` as an open object (`src/exchange/reader.ts:102`).

### Actors

- Calculator player: toggles DLCs, sets volcano effect levels, imports and exports plans.
- Planner user (Taludas's tool): exchanges plans with the calculator through the same file.
- Spec maintainers (NiHoel, Taludas): own the format; need a calculator answer on the issue.

### Requirements

**DLC identity**
- R1. The calculator identifies DLCs in the file by the spec's numbers (1, 2, 3 today) and maps each number to the DLC that `params.dlcs` lists for it, for every DLC in `params.dlcs`, not a fixed list of three.
- R2. A DLC number the calculator does not know is kept and written back unchanged (already true, `src/exchange/import-effects.ts:338-342`; must stay true).
- R3. Export writes `settings.dlcs` whenever the calculator has any stored DLC flag, and omits it when it has none, so an absent list still states nothing about ownership (spec `format.md:44`).

**DLC import semantics**
- R4. A DLC the file lists is switched on. A DLC that the file's island data requires is on regardless of the list (existing rule, kept).
- R5. A DLC the file omits while the island data does not require it is switched off by an import that has Modifiers ticked, which includes every full import (OQ1). An import with Modifiers unticked never switches a DLC off; plan 2026-11-14-001 R13 states this rule for all imports once.
- R6. Every DLC switched on by content rather than by the list is recorded once per DLC with the content that caused it (existing report code `dlc-enabled`, kept) in `ImportPlan.report`. These entries serve tests and diagnostics; no UI shows them (plan 2026-11-14-001 R5).

**Volcano**
- R7. The calculator keeps reading and writing the volcano level as the scale of the three volcano effects in the Latium and Meta sessions, and keeps `settings.volcano` keys it does not model (`durations`, `phase`, `enabled`, unknown keys) byte-identical across a round trip (existing, kept).
- R8. A scale of a volcano effect in `effects.bySession` means the active level, and is applied in full while the effect is on. The time share is carried only by `settings.volcano.durations`, which the calculator does not apply (Taludas addition 2; decision KD2).
- R9. When the file's `settings.volcano` and `effects.bySession` disagree, the calculator applies the effects, keeps the setting, and reports the disagreement (spec CD7, existing).
- R10. The user can see the volcano level the calculator applies and change it for all volcano effects at once, without editing three effects in two sessions (OQ2 decides the form).
- R11. A volcano effect is available to the user only while its DLC (Prophecies of Ash) is on, following the DLC-lock invariant in `src/AGENTS.md:105`.
- R11a. The volcano level control is a single selector for levels 0 to 5, shown next to the DLC list in the settings dialog and hidden while Prophecies of Ash is off. It writes the level to every effect of the unlocked set and leaves the others at 0; level 0 sets every scale to 0 and keeps the set (OQ2, OQ3; KTD3 defines the set).
- R11c. The level is the shared scale of the three volcano effects, as the savegame stores it (session 3245, `SessionEffectManager` effects of the human participant; level is 1 plus the overdrive factor). A file or save never carries level 0; the calculator's selector keeps 0 as "volcano effects off". On import, an effect scale above 5 is clamped to 5 and kept in the preserved data. Levels 4 and 5 need the technology 145106 in the game; the calculator does not enforce that.
- R11b. Code and templates that are specific to individual DLCs (the volcano level selector, any later DLC-specific setting) live in one separate source file and one separate template file, not spread over the data-driven code. Reason: they are edited by hand with every DLC, while the rest of the code reads `params.dlcs` and needs no change. The settings dialog includes that template and calls that file; nothing else in `src/` or `templates/` names a DLC. The file layout is in KTD1.

**Exchange coverage**
- R12. The calculator documents, next to the issue answer, which DLC-dependent data it reads, writes, keeps or ignores: owned DLCs, volcano level, volcano unlocks, DLC-gated buildings, items, needs and regions.
- R13. DLC-gated regions and sessions that the calculator does not know stay preserved as orphans on import (existing: `docs/exchange-format.md:66`); this plan adds no new region handling.

### Scope Boundaries

Not requested, because they belong to another owner or need a model that does not exist:

- Modelling eruption phases, durations or time share in the calculator's production math. The calculator has no phase model; `durations` and `phase` stay planner-owned (spec `conversion-rules.md:11`).
- Seasons (Nile flood), wonder effects and supplier caps from Taludas's other additions; separate plans. The Nile flood block of `ViewMode.master()` stays where it is.
- A fixed registry of DLC identifiers beyond numbers 1 to 3, because the spec states that no list of DLCs is closed (`schema\anno117-exchange.schema.json:5`).
- Changing which content a DLC gates (extraction data, `docs/goods_per_dlc.csv`).
- Per-island DLC settings; DLC ownership is account-wide.
- Moving the exchange mapping of the volcano (`src/exchange/discoveries.ts`, `import-effects.ts`, `exporter.ts`) into the DLC-specific file. Those files map a file format, are data-driven by effect GUID tables, and R11b concerns the UI and view-model layer.

### Acceptance Examples

- AE1 (R1, R2). File `settings.dlcs: [1, 3, 7]`: DLC01 and DLC03 flags become `"1"`, DLC02 becomes `"0"` unless OQ1 says otherwise, 7 is reported as carried through and appears again in the export.
- AE2 (R4, R6). File lists `[1]` and contains a Hippodrome-tied building with count above 0: DLC02 is on and the report names the building.
- AE3 (R7, R8). File has `settings.volcano: {level: 5, effects: [145095, 148043], durations: {"1": 12}}`: Obsidian Gathering and Mining are 5 in sessions 3245 and 37135, Fertile Soil is 0, and export writes `durations` back unchanged.
- AE4 (R9). `effects.bySession` gives Obsidian Gathering 3 while `settings.volcano.level` is 5: the calculator applies 3, keeps level 5 in the preserved setting, and the report lists the difference.
- AE5 (R3). A calculator profile with no stored DLC flag exports no `settings.dlcs`.
- AE6 (R11). With Prophecies of Ash off, the volcano control from R10 is unavailable and no volcano effect applies.

### Key Decisions

- KD1. **DLC identifiers need no new format content.** The spec's numbers and ids already answer the issue's identifier question; the calculator's work is to follow the list in `params.dlcs` (R1) instead of a hard-coded range. Source: `c:\dev\anno-117-exchange-format\spec\format.md:44`.
- KD2. **The calculator applies the volcano scale at full time share.** Taludas states that `bySession` values are the active level and durations carry the time share, so the calculator reading scale as level is correct and needs no weighting. The planner's own export writes the level, not a time-weighted scale (`c:\dev\Anno-117-Planner\paxplanner\model\exchange_export.py:112-117`); its engine comment "scale < 1 = active part of the time" (`paxplanner\model\engine.py:658`) concerns its internal effect model (assumption: not file semantics).
- KD3. **Effects win over `settings.volcano` in the calculator** (CD7), because the calculator models effects and the planner models the setting. Neither overwrites the other's block.
- KD4. **DLC state stays derived-plus-explicit**: the user's checkbox and the content lock keep their existing relation (`DLC.used` forces on); this plan adds no second source of truth for DLC ownership.

### Outstanding Questions

- OQ1. **Should import switch a DLC off that the file omits and no content requires?** The calculator does today (`import-effects.ts:335-336`); the planner does not (`exchange_import.py:498-500`, rule PD3). Recommendation: keep it, because the spec states an omitted DLC is not owned (`format.md:44`) and an import is a state replacement. Interaction with the scoped import (`docs/plans/2026-11-14-001-feat-import-scopes-plan.md`, R13, KD4): `settings.dlcs` is applied only with Modifiers ticked, so this rule holds for every import with Modifiers ticked (a full import always) and an import without Modifiers never switches a DLC off. Alternative: leave the user's own DLC choice, matching the planner; this loses fidelity when the file's owner has fewer DLCs. The plan implements the recommendation (U1); the alternative would remove the `0` branch of one loop.
- OQ2. **What form does the volcano control take (R10)?** Decided: (a) a single level selector next to the DLC list in the settings dialog, writing to all three effects in both sessions, levels 0 to 5, hidden while the DLC is off (R11a). The Master view mode already sets a uniform level, so one selector matches existing use. The selector and its template sit in the DLC-specific file (R11b). Rejected: (b) per-effect editing only with a read-only derived level.
- OQ3. **Does the calculator unlock-list (`effects`) need its own user control?** Decided: no. The selector from OQ2 applies the level to every effect of the unlocked set and leaves the others at 0; level 0 is not "locked", it sets the scales to 0 and keeps the set. KTD3 states how the set is stored and filled.
- OQ4. **Issue reply.** The calculator answers on issue #1 that DLC numbers 1 to 3 are sufficient and the volcano value is the active level (R8). Assumption: the maintainers accept this; the open item is whether the spec wants `settings.dlcs` to gain a name list. Recommendation: no, as numbers are already stable.
- OQ5. **What does export write for the volcano when every volcano effect is 0 and a preserved `settings.volcano` exists?** Today `volcanoSetting` writes `level: 0` and `effects: []` into the preserved block (`src/exchange/exporter.ts:716-724`), while R11c says a file never carries level 0. Options: (c) leave the preserved block untouched when every effect is 0 (smallest change: no new flag in either direction; the block then still says level 5 while the effects say 0, which CD7 already allows); (a) keep the preserved block unchanged and add `enabled: false`; the import already treats `enabled: false` as "derive no volcano effect" (`import-effects.ts:253`) but also does not write 0 to the effects; (b) keep today's `level: 0`. Recommendation: (a), plus the import writing 0 to the three effects in both sessions for `enabled: false` so a switched-off volcano round-trips. The spec text (`conversion-rules.md:10`) does not say; if the maintainers disagree, the answer belongs on issue #1 (OQ4). U2 implements the recommendation.
- OQ6. **Lock reason on the DLC checkbox.** The UX mock shows a lock icon with the reason ("In use: 2 buildings built") next to a DLC that `DLC.used` holds on; today the checkbox is only greyed out (`templates/settings-dialog.html:61,64`). This is generic DLC behavior, not volcano-specific, and no requirement asks for it. Recommendation: defer to a follow-up; with the volcano selector the lock is explained for the volcano case by the selector sitting directly below the checked and disabled DLC.
- OQ7. **Where is the original value of a clamped scale kept?** R11c keeps it "in the preserved data". For `settings.volcano.level` that is the existing preserved block. For a clamped `effects.bySession` value the exporter lets the calculator's own value win over preserved ext (`src/AGENTS.md`, "Exchange exporter"), so a preserved 7 would not return on export. Recommendation: the report entry carries the original value (`detail`), and the export writes the clamped 5. Decide at implementation only if the maintainers want byte-identical return.

### Dependencies and Assumptions

- Assumption: `params.dlcs` will keep the id pattern `DLC0<n>_...` for future DLCs (the exporter and importer already rely on it, `src/exchange/exporter.ts:674`, `src/exchange/import-effects.ts:335`).
- Verified: Master view mode sets the three volcano effects to 5 in the sessions whose region is Roman or Meta (`src/views.ts:138-147`). Whether `session.region.id == "Roman"` covers only session 3245 is not verified; U3 uses the session GUIDs of the exchange tables.
- Sibling plans (not edited here; assumed interfaces in KTD7): `2026-11-12-001`, `-002`, `-004` and `2026-11-14-001`.
- UX mock: https://claude.ai/artifact/SCQPogPpKRmREHC1cMbGdk, section `#settings` (read for this plan).

---

## Planning Contract

**Product Contract preservation:** unchanged in scope. Three statements changed from assumption to verified fact (Fertile Soil name, level 5 in Master, the one-DLC lock of the volcano effects), and R11a, R11b, R11c and OQ1 to OQ3 gained cross-references to KTD1 to KTD3 and to the scoped import. No requirement was added, dropped or reworded in meaning.

### Key Technical Decisions

- KTD1. **File layout for DLC-specific code (R11b).**
  - `src/dlc-settings.ts` holds one class, `DlcSettings`, and everything that names a DLC or its content in view-model code: the volcano level model (effects and sessions, level read/write, mixed state, `applyAll(level)` for Master) and the hook list `extras` that tells the settings dialog which DLC rows carry extra UI. Later DLC-specific settings are added as further members of this class.
  - `templates/dlc-settings.html` holds the markup for those extras, one block per DLC, each guarded by `<!-- ko if: $parent... === ... -->` on the DLC object. It is loaded by the existing template loader (`src/util.ts:19,37`, name `dlc-settings`, no registration needed).
  - Generic seam in `templates/settings-dialog.html`: the DLC list item ends with one virtual element `<!-- ko template: { name: 'dlc-settings', data: $data } --><!-- /ko -->`, bound with the DLC object as `$data`. The dialog names no DLC. In `dlc-settings.html` the volcano block tests `$root.dlcSettings.volcano.dlc === $data`.
  - `src/main.ts` creates `window.view.dlcSettings = new DlcSettings(window.view)` after sessions exist (`src/main.ts:623-627`) and before bindings are applied (unverified: exact applyBindings line; check at implementation). The line names no DLC.
  - `ViewMode.master()` (`src/views.ts:138-147`) replaces its volcano loop with `window.view.dlcSettings.applyAll(5)`; the Nile flood loop below it stays.
  - i18n keys cannot live in the new file: UI strings need 12 languages and sit in `src/i18n.ts` (`src/AGENTS.md`, "Internationalization"). This file is the one exception to "nothing else names a DLC": the keys are named by function (`volcanoLevel`, `volcanoLevelDiffers`), not by DLC id.
  - Exchange code keeps its own volcano tables in `src/exchange/discoveries.ts` (`VOLCANO_EFFECTS`, `VOLCANO_SESSIONS`); `src/dlc-settings.ts` imports those two constants instead of copying the GUIDs.
- KTD2. **Level model.** `DlcSettings.volcano.level` is a `ko.pureComputed` with read and write.
  - Read: collect the scalings of the three effects in sessions 3245 and 37135. No scale above 0: `0`. All non-zero scales equal: that value. Otherwise `null` (mixed; no button pressed, the differences list is shown).
  - Write `n`: `n == 0` sets every scale to 0 and leaves the unlocked set unchanged. `n > 0` sets `n` on every effect of the unlocked set and 0 on the others; when the set is empty it sets `n` on all three and the set becomes all three (KTD3). Both sessions get the same values, matching the export (`spec\conversion-rules.md:10`).
  - Read reads the live `Effect.scaling` observables of `window.view.sessions` (`src/world.ts:259`); persistence already exists, so the model keeps no storage of its own.
- KTD3. **Unlocked set stored apart from the scales (OQ3).** The scales alone cannot hold the unlock state, because level 0 sets them to 0. `DlcSettings` holds a persisted set of unlocked volcano effect GUIDs, stored in `sessionSettings` under the key `volcano.unlocked` (list of GUIDs; the SubStorage value format is checked at implementation). Rules: a scale above 0 in either session (selector, Master mode, import, manual edit) adds its effect to the set; an import whose file states at least one volcano effect above 0 (`effects.bySession`, or `settings.volcano.effects` when `enabled` is false) replaces the set with those effects; level 0 sets the scales to 0 and keeps the set; the next non-zero pick applies to the set. A fresh profile has no set, so its first pick unlocks all three (Master mode does the same). The behavior is stated in the selector's title text.
- KTD4. **DLC lock gives AE6 without extra code.** The volcano effects register their scaling with Prophecies of Ash (`src/production.ts:989`, `lockDLCIfSet`), so a non-zero scale makes `DLC.used()` true, which forces the DLC on and disables its checkbox. With the DLC off every scale is 0, and the selector is hidden by `dlc.checked()`. The selector shows only `visible: dlc.checked` through `ko if` (not `visible:`), because a hidden control's bindings still evaluate (`templates/AGENTS.md`, aggregate gating).
- KTD5. **Selector as a Bootstrap button group.** Six buttons `0`..`5` with `aria-pressed`, a leading icon of the first volcano effect (`icon_2d_finding_obsidian.png` via `Effect.icon`, so no new asset) carrying a localized `title`, and the group labelled by `aria-label`. Icon-first rule: the icon is the label and its tooltip names the three effects; digits are values, not text labels. The mixed state shows one text sentence (`volcanoLevelDiffers`) followed by one icon, name and value per effect (text required: a consequence, per the mock). Dark mode via existing `bg-dark` button styles; add a style rule in `style.css` only if the group renders unreadably (check at implementation).
- KTD6. **DLC list from `params.dlcs` in the importer.** Replace the `[1, 2, 3]` loop by a pass over `params.dlcs`, taking each number from the id with the exporter's pattern (`/^DLC0*(\d+)_/`, `src/exchange/exporter.ts:674`). One shared helper `dlcNumber(id)` (location: `src/exchange/keys.ts`, next to `sessionEffectScaling`; exports there are unverified) serves both exporter and importer; the exporter's inline regex and the importer's `startsWith("DLC0<n>_")` string build are removed, so no second copy remains. "Unknown" becomes: a listed number that no entry of `params.dlcs` maps to. A DLC id without a number pattern is not exchangeable and is left untouched.
- KTD7. **Assumed interfaces with sibling plans.**
  - `2026-11-14-001` (import scopes): reads the DLC keys of `result.calculatorSettings` by matching them against `params.dlcs` ids, not against a fixed 1-3 list, and drops `"0"` values when Modifiers is unticked (its R13, KD4). Volcano scales (`sessionSettings`, keys `session.<session>.effect.<effect>.scaling`) follow Modifiers; the clamp (U2) applies to every import that has Modifiers ticked. The level selector and `ViewMode.master()` write the same keys outside the import path. The volcano keys sit in `sessionSettings` under Modifiers (its scope table, "Modifiers" row: `settings.volcano`, `effects`, `settings.dlcs`); the key `volcano.unlocked` (KTD3) is a Modifiers key as well and is added to that row's key patterns. Both plans edit `src/exchange/import-effects.ts`; U1 and U2 are small, local edits to `dlcs()`, `volcano()` and `specificBySession()` and land after import-scopes U1-U6, without changing the function names (merge order: that plan, "Sequence across plans"; this plan is step 2 for U1-U2, U3-U5 later without shared exchange files).
  - `2026-11-12-002` (residence items, Hippodrome content) and any later DLC plan: add their DLC-specific controls as members of `DlcSettings` and blocks in `templates/dlc-settings.html`. This plan provides the seam (KTD1) and the first use.
  - `2026-11-12-001` (governor suppliers) and `-004` (factory effect UX): no code overlap. `-004` shares the UX mock; its effects-dialog link is unaffected.
- KTD8. **Reports stay in the import result.** `dlc-enabled`, the new `dlc-not-listed` entry (U1) and `volcano-level-clamped` (U2) are produced in `ImportPlan.report` only. The import-scopes plan removes the on-screen report (`docs/plans/2026-11-14-001-feat-import-scopes-plan.md`, R5, KD7); R6 is met by the result entries (asserted in tests and available to the diagnostic tooling), not by a dialog.

**Considered smaller and kept:** a bare function instead of the `DlcSettings` class (kept: R11b asks for a home for later DLC settings, and the template seam needs one object on `window.view`); a text-only mixed state (kept: the UX mock shows rows with values); folding `dlc-not-listed` into an existing report entry (kept: R5 makes a switched-off DLC a state change that deserves its own code in `ImportPlan.report`).

### High-Level Technical Design

Level selector data flow (directional):

```
settings dialog (DLC row, checked + used)
   -> template 'dlc-settings' (data = DLC)
      -> if $root.dlcSettings.volcano.dlc === $data and dlc.checked()
         -> six buttons ->  level(n)  [write]
                              |
          DlcSettings.volcano.level
            read : scalings of 3 effects x {3245, 37135} -> 0 | v | null(mixed)
            write: targets = unlocked set (persisted), empty -> all three
                   n==0 -> every scale 0, set unchanged
                   else -> targets = n, others = 0, in both sessions
                              |
                  Effect.scaling (observable) -> sessionSettings storage (existing)
                              |
                  DLC.used -> forces Prophecies of Ash on, disables checkbox
```

Importer DLC flow (directional):

```
settings.dlcs [1,3,7]
   for each params.dlcs entry d: n = dlcNumber(d.id)
       listed(n) ? "1" : "0"    -> calculatorSettings[d.id]
                                   "0" also -> report dlc-not-listed
   numbers without a params entry -> ext.settings.dlcsUnknown (kept)
   content-required DLCs (items, effects, buildings) win over "0" (existing)
```

### System-Wide Impact

- **Settings dialog:** one added virtual template element per DLC row; no layout change for DLCs without extras.
- **Master view mode:** behavior preserved for the volcano effects (all three at 5); the write now goes through `DlcSettings.applyAll(5)`.
- **Export:** unknown-number list is filtered by `params.dlcs` so a number that a later release maps to a DLC no longer stays forced on (U1).
- **Persistence:** one key, `volcano.unlocked` in `sessionSettings` (KTD3); the volcano level is derived from the existing session-effect keys.
- **Aggregate mode:** the selector writes session effects, which are global to sessions and independent of the selected island; it is shown and editable in All-Islands aggregate mode too (assumption; the settings dialog has no aggregate gating today, `templates/settings-dialog.html`).

---

## Implementation Units

### U1. DLC identity by `params.dlcs` in import and export

- **Goal:** Import and export follow the DLC list of `params.dlcs` for any number of DLCs; omitted DLCs are switched off and recorded; numbers the calculator does not map stay preserved.
- **Requirements:** R1, R2, R3, R4, R5 (OQ1), R6; AE1, AE2, AE5.
- **Dependencies:** none.
- **Files:**
  - Modify `src/exchange/import-effects.ts` (`dlcs()`, lines 327-343)
  - Modify `src/exchange/exporter.ts` (settings block, lines 666-679)
  - Modify `src/exchange/keys.ts` (add `dlcNumber`; exports unverified, adjust location if `keys` is not a plain module)
  - Test `tests/exchange/import-effects.spec.ts`, `tests/exchange/exporter.spec.ts`, `tests/exchange/roundtrip.spec.ts`
- **Approach:**
  - `dlcs()` iterates `ctx.params.dlcs`, writes `"1"` for listed and `"0"` for unlisted numbers, keeps `dlcsUnknown` for numbers without a params entry, and adds one `approximated` entry `dlc-not-listed` (detail: DLC ids written `"0"`) when at least one DLC is switched off by the list.
  - The `dlcs-not-provided` path (no list) stays as is.
  - The exporter skips `dlcsUnknown` numbers that `params.dlcs` now maps, so the stored flag decides.
  - Pattern to follow: existing `dlcs()` and the exporter's `dlcIds`/regex handling.
- **Execution note:** Extend the existing `tests/exchange/import-effects.spec.ts` DLC test (line 168) rather than adding a parallel spec.
- **Test scenarios:**
  - Covers AE1. `settings.dlcs: [1, 3, 7]`: `DLC01` and `DLC03` are `"1"`, `DLC02` is `"0"`, `dlcsUnknown` is `[7]`, the report has `dlcs-unknown` and `dlc-not-listed` naming DLC02; export lists `[1, 3, 7]`.
  - Covers AE2. `settings.dlcs: [1]` with a DLC02 building above 0: DLC02 flag is `"1"` after the plan (content wins), report has `dlc-enabled` naming the building.
  - `settings.dlcs: []`: all three flags `"0"`, `dlcsUnknown` absent.
  - Params with a fourth entry `DLC04_...` (test injects it into the plan context): `[4]` writes `DLC04` `"1"` and is not in `dlcsUnknown`.
  - Stored `ext.settings.dlcsUnknown: [4]` while `params.dlcs` maps 4 and the stored `DLC04` flag is `"0"`: export omits 4.
  - Covers AE5. No stored DLC flag and no `dlcsUnknown`: export has no `settings.dlcs`.
  - A `params.dlcs` id without the number pattern is not written by import and not listed by export.
- **Verification:** the listed scenarios pass and the existing DLC tests in the three exchange specs pass unchanged; type check passes.

### U2. Volcano scale clamp and level-0 export

- **Goal:** Imported volcano scales never exceed 5; export does not write level 0 into a preserved setting; an import fills the unlocked set and an export at level 0 keeps its membership; the three decisions R8, R9, R11c stay as implemented.
- **Requirements:** R7, R8, R9, R11c; AE3, AE4. OQ5 and OQ7 decide details.
- **Dependencies:** none for the clamp; the exporter half waits for OQ5 (recommendation applied if no answer).
- **Files:**
  - Modify `src/exchange/import-effects.ts` (`volcano()` lines 249-283, `specificBySession()` lines 198-226)
  - Modify `src/exchange/exporter.ts` (`volcanoSetting`, lines 708-727)
  - Modify `src/exchange/keys.ts` (`volcano.unlocked` key builder; the set is read by the importer and exporter from the sessionSettings storage)
  - Test `tests/exchange/import-effects.spec.ts`, `tests/exchange/exporter.spec.ts`
- **Approach:**
  - Clamp with `Math.min(5, value)` at the two write sites for `VOLCANO_EFFECTS` only (derived value in `volcano()` and the stated value in `specificBySession()`); other effects keep their value. Add a `approximated` entry `volcano-level-clamped` with the original in `detail` (OQ7).
  - Clamped comparison in the disagreement check uses the clamped values on both sides.
  - Exporter, per OQ5(a): with a preserved complete setting and no effect above 0, set `enabled: false` and leave `level`/`effects` as preserved; import with `enabled: false` writes 0 to the three effects in both sessions (unless `effects.bySession` states them).
  - Unlocked set (KTD3): import stores the effects above 0 (from `effects.bySession`, or from `settings.volcano.effects` when `enabled` is false) as `volcano.unlocked`. Export at level 0 with a non-empty set writes the three effects at scale 0 into `effects.bySession` (the schema's `guidNumberMap` accepts 0; the spec reads scales above 0 as unlocked, `spec\conversion-rules.md:10`, so another reader treats them as locked) and writes `settings.volcano` with `enabled: false` and `effects` set to the stored set (OQ5(a)), so a calculator round trip keeps membership. The same scales at 0 are written for effects outside the set.
  - `durations`, `phase` and unknown keys are untouched by construction (`clone(preserved)`); the round-trip scenario is a regression guard.
- **Execution note:** Add the failing clamp and `enabled: false` cases first; the existing volcano tests at `tests/exchange/import-effects.spec.ts:102-130` pin the unchanged behavior.
- **Test scenarios:**
  - Covers AE3. `{level: 5, effects: [145095, 148043], durations: {"1": 12}}`: sessions 3245 and 37135 hold 5, 5, 0 for the three effects; export returns `durations` unchanged.
  - Covers AE4. bySession Gathering 3 with setting level 5: applied 3, preserved level 5, `volcano-effects-disagree` entry.
  - `level: 7`, `effects: [145095]`: stored scale 5, entry `volcano-level-clamped` with original 7 and the effect GUID; preserved `settings.volcano.level` is still 7.
  - bySession Gathering 9: stored 5, entry as above, another effect (Nile flood 155616 with 9) is not clamped.
  - All three effects 0 with a preserved block `{level: 5, effects: [...], durations}`: export writes `enabled: false`, keeps `level`, `effects`, `durations`; no `level: 0` appears.
  - Import of `{enabled: false, level: 3, effects: [145095]}`: all three effects are 0 in both sessions.
  - Stored effects all 0, empty set and no preserved block: export has no `settings.volcano`; already pinned by the existing exporter spec, not added again.
  - Set {Gathering, Mining} and all scales 0 (after `level(0)`): export writes the three effects at 0 in both sessions, `settings.volcano` with `enabled: false` and `effects` [145095, 148043], and no `level: 0`; importing that export restores the set and `level(3)` writes 3, 3, 0.
  - Import with Gathering 5, Mining 5, Fertile Soil 0 in `effects.bySession`: `volcano.unlocked` holds Gathering and Mining.
- **Verification:** import and export specs pass; a file with a clamped value round-trips with the clamped scale and the report entry.

### U3. `DlcSettings` module, startup wiring, Master mode

- **Goal:** One module owns the volcano level model; the app creates it at startup; Master mode uses it.
- **Requirements:** R10, R11, R11a, R11b, R11c; AE6.
- **Dependencies:** none (parallel to U1, U2).
- **Files:**
  - Create `src/dlc-settings.ts`
  - Modify `src/main.ts` (create `window.view.dlcSettings` after the sessions loop, near line 627)
  - Modify `src/views.ts` (`master()`, lines 138-147)
  - Test `tests/computed/dlc-settings-volcano.spec.ts` (new)
- **Approach:**
  - Class `DlcSettings` with `volcano: { dlc: DLC; level: KnockoutComputed<number | null>; effects: ...; differences: KnockoutComputed<{effect: Effect; value: number}[]> }`, `applyAll(level)`, and `extras` as KTD1 states. The DLC is taken from the first volcano effect's single DLC (`effect.dlcs[0]`), so the file contains no DLC GUID.
  - The unlocked set (KTD3) is a persisted observable array in `sessionSettings` (`volcano.unlocked`); `DlcSettings` subscribes to the six volcano scalings and adds an effect to the set when one becomes above 0.
  - Session and effect lookup by `VOLCANO_SESSIONS` and `VOLCANO_EFFECTS` from `src/exchange/discoveries.ts`. If a session or effect is missing in params (older params), the volcano member is `undefined` and its template block does not render.
  - `master()` calls `applyAll(5)` after the DLC loop; effects keep their previous behavior of 5 on all three. After this edit `master()` holds no volcano GUID and no region-id filter; the effect and session lookup exists once, in `DlcSettings`, from the exchange constants.
  - Add the type of `window.view.dlcSettings` to the existing view typing (location unverified; follow how `window.view.exchangeReport` is typed).
- **Patterns to follow:** `ExchangeReportDialog` view-model (`src/exchange/report-dialog.ts`) for a view-model object on `window.view`; `Session` effect persistence for the underlying scalings.
- **Execution note:** Test-first at the model level (computed spec).
- **Test scenarios:**
  - Fresh profile: `level()` is 0 for all effects 0; DLC checked or not.
  - Covers AE6. DLC unchecked: all scalings 0, `level()` 0; the DLC is unchecked and `used()` false.
  - `level(3)` from all zero: three effects are 3 in both sessions; `view.dlcsGuidMap.get(67902).used()` is true and `checked()` is true (lock).
  - Import-like state Gathering 5, Mining 5, Fertile Soil 0 (set {Gathering, Mining}): `level()` is 5; `level(2)` writes 2, 2, 0; Fertile Soil stays 0 (OQ3).
  - Mixed state Gathering 3, Mining 5: `level()` is `null`, `differences()` lists both with values; `level(4)` writes 4 to both and leaves Fertile Soil 0.
  - `level(0)` from any state sets all six scalings to 0 and unlocks the DLC checkbox (`used()` false) but keeps the unlocked set; afterwards `level(3)` applies to the set (start Gathering 5, Mining 5, Fertile Soil 0: `level(0)` then `level(3)` writes 3, 3, 0). A fresh profile without a set: `level(3)` writes 3, 3, 3 and stores all three.
  - Persistence of the set: after `level(0)` and a reload the key `volcano.unlocked` still holds the two GUIDs and `level(3)` writes 3, 3, 0. A manual scale above 0 on a third effect adds it to the set.
  - Write the level scenarios above as one table of (start state, call, expected scalings, expected set).
  - Persistence: after `level(3)` the `sessionSettings` keys `session.3245.effect.145095.scaling` and the Meta equivalents hold 3 (read from storage, per `tests/AGENTS.md`), and a reload restores `level()` 3.
  - `applyAll(5)` writes 5 to all three effects in both sessions regardless of earlier unlocks; Master mode produces the same scalings as before the refactor (compare with a stored fixture or the previous inline loop's expected values).
  - Values not in sessions 3245 and 37135 (for example the same effect in Albion's session) are not touched by `level(n)`.
- **Verification:** the computed spec passes; the existing computed specs that load a Master-mode profile pass unchanged; type check passes.

### U4. Settings dialog template, i18n and styling

- **Goal:** The user sees the selector under the Prophecies of Ash checkbox only while that DLC is on, and the mixed state is explained.
- **Requirements:** R10, R11, R11a, R11b; AE6.
- **Dependencies:** U3.
- **Files:**
  - Create `templates/dlc-settings.html`
  - Modify `templates/settings-dialog.html` (DLC `<li>`, lines 61-68)
  - Modify `src/i18n.ts` (keys `volcanoLevel`, `volcanoLevelDiffers`; 12 languages)
  - Modify `style.css` only if needed (KTD5)
  - Test `tests/binding/dlc-settings-volcano.spec.ts` (new)
- **Approach:**
  - Seam: one virtual `template` element at the end of each DLC `<li>`, `data: $data`; keep `debug:` binding labels per `templates/AGENTS.md` ("DLC Settings", "Volcano Level").
  - Block in `dlc-settings.html`: icon (`Effect.icon`) with `title` from `$root.texts.volcanoLevel`, then a button group over `[0..5]` with `aria-pressed` bound to `level() === $data` and `click` writing `level($data)`, inside `<!-- ko if: dlc.checked() -->`. Mixed note: `<!-- ko if: level() === null -->` with the sentence and `foreach: differences` rows (effect icon, `effect.name()`, value).
  - Text only for the mixed sentence; every icon has a `title` (UX rule, `templates/AGENTS.md`).
  - Translate with `/translate` for both keys; run the translation check.
- **Patterns to follow:** `icon-checkbox`/`inline-list-centered` layout classes, `<collapsible>` is not used (no extra nesting; the mock allows two levels: dialog and the control).
- **Test scenarios:**
  - Dialog open, Prophecies of Ash on: six buttons visible, the one for the current level has `aria-pressed="true"`.
  - Covers AE6. Prophecies of Ash off: the selector is not in the DOM (`ko if`), no binding error is reported (`BindingDetector`).
  - Click `3`: three effects are 3; the DLC checkbox becomes disabled; clicking `0` re-enables it and the selector disappears after the user unchecks the DLC.
  - Mixed state seeded in storage: no button pressed, the sentence and three rows (Gathering, Mining, Fertile Soil with values) render; clicking `4` clears the note.
  - Each icon in the block has a non-empty `title`.
- **Verification:** binding spec passes without Knockout binding errors; translation check passes for both keys; manual look at the dialog in light and dark mode.

### U5. Documentation and the issue answer

- **Goal:** R12: the DLC-dependent data are documented, and the DLC-specific file layout is recorded where agents look.
- **Requirements:** R12, R13 (unchanged), R11b.
- **Dependencies:** U1 to U4.
- **Files:**
  - Modify `docs/exchange-format.md` (extend the existing DLC lines around 66 and 80-82 so that owned DLCs, volcano level, volcano unlocks, DLC-gated buildings, items, needs and regions are each stated as read, written, kept or ignored; no second table)
  - Modify `src/AGENTS.md` (short section "DLC-specific code: `src/dlc-settings.ts` and `templates/dlc-settings.html`", the rule from R11b and the i18n exception)
  - Modify `templates/AGENTS.md` (one line pointing at the seam in `settings-dialog.html`)
  - Modify `tests/AGENTS.md` (spec names added under the exchange and DLC test lists)
- **Approach:** state the facts: DLC numbers per spec, import follows `params.dlcs`, omitted DLCs are switched off and recorded, clamp at 5, level is the active scale, `durations`/`phase` kept and not applied. Draft the issue #1 answer (OQ4) from the same table and hand it to the maintainer to post; posting is outside this plan.
- **Test expectation:** none -- documentation only.
- **Verification:** the table lists every item named in R12; links and file names in it match the files above.

---

## Sequencing

```
U1 ─┐
U2 ─┼─> U5
U3 ─> U4 ─┘
```

U1, U2 and U3 are independent. U4 needs U3. U5 closes after all code units. Ordering against the other plans: import-scopes plan, "Sequence across plans" (U1 and U2 after that plan's U1-U6; KTD7).

## Risks and Mitigations

- **Merge friction in `import-effects.ts`** with the import-scopes plan. Mitigation: keep U1/U2 edits inside the existing methods, names unchanged; sequencing note above. `src/i18n.ts` keys are owned per plan (list in the import-scopes plan).
- **Template seam with a `ko template` inside a `foreach`** could rebind on DLC changes. Mitigation: the block's `if` uses `dlc.checked()` and a stable DLC reference; binding spec covers toggling the DLC and the level repeatedly.
- **Master mode regression** from replacing its volcano loop. Mitigation: U3 asserts the same six scalings after Master mode.
- **Scale range outside the selector** (effects dialog may allow other values; unverified). Mitigation: the model treats any non-equal non-zero values as mixed; it never assumes the 0-5 range on read.
- **Old params without volcano effects**: the volcano member is `undefined` and the block does not render (U3).

## Verification Contract

- Type check and production build pass.
- Translation check passes for the two new keys in all 12 languages.
- Exchange specs (`tests/exchange/import-effects.spec.ts`, `exporter.spec.ts`, `roundtrip.spec.ts`) pass, run one invocation at a time after a build.
- `tests/computed/dlc-settings-volcano.spec.ts`, `tests/binding/dlc-settings-volcano.spec.ts` and the existing `tests/computed/dlc-unlocks.spec.ts` pass.
- Manual: open the settings dialog with Prophecies of Ash on and off, pick levels, import a file with `settings.volcano` and a level above 5, export and compare `durations`.

## Definition of Done

- U1 to U5 landed; every R and AE of the Product Contract maps to a unit above (R1-R6 and AE1, AE2, AE5 in U1; R7-R9, R11c, AE3, AE4 in U2; R10, R11, R11a, R11b, AE6 in U3 and U4; R12 in U5; R13 unchanged).
- The settings dialog and `ViewMode.master()` name no DLC outside `src/dlc-settings.ts` and `templates/dlc-settings.html`, other than the i18n keys.
- OQ1 to OQ7 each carry their recommendation, and the maintainer-owned ones (OQ4, OQ5, OQ7) are posted or answered before release.
- `dist/calculator.bundle.js` is not committed (project rule: only with a release).
