---
title: "refactor: Need attribute totals in the population level dialog"
type: refactor
date: 2026-11-16
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# refactor: Need attribute totals in the population level dialog - Plan

## Goal Capsule

- **Objective:** Every attribute column of the needs table in the population level dialog shows a total over the level's residences, calculated the same way as the Population column (residents) today.
- **Product authority:** The scope confirmed in the brainstorm dialogue of 2026-11-16 (full parity, see Product Contract). No requirements document exists.
- **Open blockers:** none.

## Summary

Population is the only attribute that is multiplied by the number of residences: `ResidenceNeed.residents` = constructed buildings x (need residents + villa-item bonus) x supply share, 0 while the need is unchecked or gated, summed by `PopulationLevelNeed.residents`. All other attributes show the raw per-residence value of the need. After this refactor one calculation serves all attributes, for cells, the totals row and the All-Islands aggregate view.

## Problem Frame

The needs table mixes two meanings in one row: the Population cell is a total, the other attribute cells are per-residence values. Totals of non-Population attributes do not react to building counts, the need checkbox, gating or supply coverage, and villa items that add values for those attributes (`Buff.needAttributes` entries) do not affect them.

## Product Contract

### Requirements

- R1. For each need and attribute A, the value of the need is the sum over the residences of the level of `constructed buildings x (base value of A + villa-item bonus for A on that need) x supply share`.
- R2. The value is 0 while the need is unchecked or its gating effect is inactive.
- R3. Population uses the same calculation and keeps its numbers.
- R4. The totals row of the needs table sums the values of R1 per attribute column, all attribute columns alike.
- R5. In All-Islands aggregate mode the value is the sum of R1 over the real islands that have the level; the table stays read-only.
- R6. A non-Population cell whose value is 0 renders blank, which includes unchecked or gated needs and levels without constructed buildings. Population cells keep their current rendering.
- R7. Which attribute columns render stays data-driven (an attribute with a raw value other than 0 on a visible need) and does not change when a need is unchecked.

### Scope Boundaries

- The villa-items dialog keeps its raw per-item values: they are not per-residence totals.
- The consumption amount (t/min) of a need is unchanged.
- No new texts; i18n is untouched.
- A villa-item bonus for an attribute whose raw value is 0 on every visible need of the level adds no column. Not requested, because R7 keeps the columns data-driven and stable under item state; the bonus still counts in totals of columns that render.

### Key Decisions

- Full parity over a buildings-only multiplier, so attributes react to coverage and items the same way residents do (confirmed in the brainstorm).

## Planning Contract

### Key Technical Decisions

- **KTD1. One per-residence method, parameterized by attribute id.** `ResidenceNeed.attributeAmount(attributeId)` holds the formula; `residents` becomes `attributeAmount('Population')`. Rationale: the formula exists once, so the two paths cannot drift. A plain method (not one computed per attribute) is enough, because callers read it inside their own computeds and register the dependencies there. `residents` stays a `KnockoutComputed<number>` (`ko.pureComputed(() => this.attributeAmount('Population'))`), because `consumption.ts`, `population.ts`, `views.ts` and `exchange/computed.ts` call it as `residents()`.
- **KTD2. Generalize `AppliedBuff.needPopulation(productGuid)` into `needAttribute(productGuid, attributeId)`** and remove the Population-only method. The scaling x coverage factor stays identical, so Population numbers do not change. Rationale: `Buff.needAttributes` entries already carry a `Record<string, number>` of attributes.
- **KTD3. `Need` keeps a `Record<string, number>` of its raw values by attribute id**, built from `config.needAttributes` in the constructor, and `attributeValue(id)` reads it. `Need.attributes` is keyed by `NamedElement` (resolved through `literalsMap`), so the id lookup needs neither the map scan nor `literalsMap` during island construction. `Need.residents` stays as is.
- **KTD4. `PopulationLevelNeed.attributeTotal(attributeId)` sums over residences and returns 0 when unchecked.** `residents` stays a `pureComputed` over `attributeTotal('Population')`. In the presenter one private `totalFor(attributeId)` holds the aggregate branch (`sumPopulationLevelNeedAcrossRealIslands` with `attributeTotal`) and the instance branch; `residents` and every cell `total` call it, so the branch exists once.
- **KTD5. Cells expose raw value and total separately.** `NeedAttributeCell.value` keeps the raw per-residence value (it decides column relevance and is what existing specs read); a new `total()` carries R1. One helper `formatAttributeTotal(attribute, total)` in `src/views.ts` formats a total for cells and the totals row: Population unsigned, other attributes signed, `''` for a non-Population total of 0 (R6).
- **KTD6. `needTotals` sums `cell.total()` per column and formats through `formatAttributeTotal`.** The `checked()` filter and the Population special case are removed: totals are 0 for unchecked needs by construction, and the aggregate case needs no extra branch. A Population total of 0 stays blank in the totals row, as today.
- No new observables are added to arrays that a bootstrap `foreach` iterates (AGENTS.md aggregation invariants).

## Implementation Units

### U1. Model: per-attribute amounts on residence and level needs

- **Goal:** One calculation for all attributes in the model layer.
- **Requirements:** R1, R2, R3
- **Dependencies:** none
- **Files:** `src/buffs.ts`, `src/consumption.ts`, `tests/computed/need-attribute-totals.spec.ts` (new), `tests/computed/hippodrome-need-gating.spec.ts` (gated assertion), `tests/computed/mythical-item-consumption-modifier.spec.ts` (stub rename)
- **Approach:**
  1. `buffs.ts`: replace `needPopulation` by `needAttribute(productGuid, attributeId)` summing `entry.attributes[attributeId] ?? 0` for matching entries, times `scaling() * coverage()`.
  2. `consumption.ts` `Need`: keep the raw values by attribute id and add `attributeValue(id)` (KTD3).
  3. `ResidenceNeed`: add `attributeAmount(attributeId)` = 0 when unchecked or `gatingEffectInactive()`, else constructed x (base + sum of `needAttribute` over `residence.buffs()`) x `supplyShare()`. `residents` stays a `pureComputed` over `attributeAmount('Population')`.
  4. `PopulationLevelNeed`: add `attributeTotal(attributeId)` summing over `allResidences()`; `residents` stays a `pureComputed` over `attributeTotal('Population')`.
  5. Update the `needPopulation` stubs of the mythical-item spec to the new name.
- **Execution note:** Add the parity test first (Population total equals the old `residents()` for several building counts), then generalize.
- **Patterns to follow:** init-order trap of `gatingEffect` (`src/AGENTS.md`, gated needs): `attributeAmount` is evaluated during island construction, so it must not read `assetsMap`.
- **Test scenarios:**
  - Population parity: for each visible need of a level with constructed buildings set to 7, `attributeTotal('Population')` equals `residents()` and equals constructed x `need.residents` for a goods need.
  - Non-Population attribute: total equals buildings x raw value for a need with a value for that attribute; scales when `constructed` changes.
  - Unchecked need: total is 0; checking it again restores the value (one assertion in the new spec).
  - Gated need (Hippodrome horse need 174983 on Equites): one added assertion in `hippodrome-need-gating.spec.ts` that every attribute total is 0 while the effect is off and positive once it is on and the need is checked; the gating scenarios themselves stay in that spec.
  - Supply share: a public need (2750 on level 1499) with a patched `publicCoverage` of 50 yields half the total for a non-Population attribute.
  - Villa-item bonus: patch an item buff `needAttributes` entry with a non-Population attribute for a need; the total rises by buildings x bonus x scaling x coverage; Population unchanged for that entry.
  - Zero buildings: total is 0.
- **Verification:** the new spec and `mythical-item-consumption-modifier`, `hippodrome-need-gating`, `base-needs-not-locked` pass.

### U2. Presenter and template: cells, totals row, aggregate mode

- **Goal:** The dialog renders the totals of R1 in cells and in the totals row, in both modes.
- **Requirements:** R4, R5, R6, R7
- **Dependencies:** U1
- **Files:** `src/views.ts`, `templates/need-attribute-cells.html`, `tests/computed/population-needs-attributes.spec.ts`, `tests/binding/population-needs-attributes.spec.ts`
- **Approach:**
  1. `src/views.ts`: add `formatAttributeTotal(attribute, total)` (KTD5). `NeedAttributeCell` gets `total(): number`; `text()` calls the helper.
  2. `PopulationLevelNeedPresenter`: add the private `totalFor(attributeId)` (KTD4); `residents` and each cell `total` call it. Reuse the aggregate guard already used by `residents`.
  3. `ResidencePresenter.needTotals`: sum `cell.total()` per attribute over the visible needs and format with `formatAttributeTotal` (KTD6).
  4. `need-attribute-cells.html`: the non-Population branch renders its span unconditionally, since `text()` is `''` for a total of 0; the `ko if:` gate stays only on the Population icon branch.
  5. `needColumns` and `attributeValue(attribute)` stay raw-based (R7).
- **Patterns to follow:** aggregate branching inside existing computeds (`src/aggregate.ts` contract); gate with `if:`, never `visible:`.
- **Test scenarios:**
  - Computed: with constructed buildings 7, each non-Population cell `total()` equals 7 x raw value; `value` still equals the raw config value (existing AE13 expectations hold).
  - Computed: totals row equals the sum of the cell totals for every attribute column, including after a need is unchecked.
  - Binding: non-Population cell text equals the signed total (`+N` / `-N`) instead of the raw value; update the cell assertion of the row test, which reads the fixture's 4 constructed Liberti residences, to expect 4 x raw.
  - Binding: the totals-row test compares the displayed totals with the sum of `cell.total()` per column formatted through `formatAttributeTotal`, replacing its raw-value and `checked()` based expectation (it would otherwise pass without verifying R4).
  - Binding: unchecking a need blanks its non-Population cells and keeps the column rendered; its Population cell keeps rendering.
  - Binding, aggregate mode: two real islands with different building counts show the sum in the cells; checkbox count stays 0; tile array identity unchanged; no binding errors.
- **Verification:** both `population-needs-attributes` specs and `population-need-gating` pass; `npm run type-check` clean.

### U3. Documentation

- **Goal:** Agent docs describe the new contract.
- **Requirements:** all
- **Dependencies:** U2
- **Files:** `src/AGENTS.md`, `tests/AGENTS.md`
- **Approach:** In "Needs table" of `src/AGENTS.md` replace "every other attribute the raw values" and the cell description with the totals contract (R1, R2, R6) and name `attributeAmount` / `attributeTotal` / `AppliedBuff.needAttribute`; in "Residence items (villa items) and coverage" replace the mention of `needPopulation` with `needAttribute`; in the formulas of `tests/AGENTS.md` add the attribute formula next to "Residence Residents".
- **Test expectation:** none -- documentation only.

## Verification Contract

1. `npm run type-check`
2. `npm run build`, then, one invocation at a time: `npx playwright test tests/computed/need-attribute-totals.spec.ts tests/computed/population-needs-attributes.spec.ts tests/computed/mythical-item-consumption-modifier.spec.ts tests/computed/hippodrome-need-gating.spec.ts tests/binding/population-needs-attributes.spec.ts tests/binding/population-need-gating.spec.ts --reporter=list --workers=1`
3. Manual check in the browser: open a level in the population dialog, change the building count, uncheck a need, switch to All Islands with aggregation on.

## Definition of Done

- R1 to R7 hold and the Verification Contract passes.
- Population numbers are identical before and after for the same state.
- No `as any` in production code; no `visible:` bindings added.
- `dist/calculator.bundle.js` is not committed (release-only).

## Risks

- **Silent change of displayed numbers:** non-Population cells change meaning from per-residence to total. Mitigation: R6 and the doc update in U3; the confirmed scope covers it.
- **Eager evaluation during island construction:** `attributeAmount` runs before `assetsMap` exists. Mitigation: it reads only observables and fields already resolved (see U1 pattern note).
