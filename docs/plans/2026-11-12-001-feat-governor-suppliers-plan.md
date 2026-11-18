---
title: Governor Suppliers - Plan
type: feat
date: 2026-11-12
topic: governor-suppliers
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
execution: code
product_contract_source: ce-brainstorm
---

# Governor Suppliers - Plan

## Goal Capsule

- **Objective:** The calculator uses the t/min a governor delivers to an island when it imports a savegame exchange file, and returns governor suppliers, governor harbours and unknown supplier fields unchanged on export. Today it keeps governor suppliers and applies none of them.
- **Product authority:** This plan owns the calculator's behavior for `trade.imports[].suppliers[]` entries naming a governor, for `trade.governorHarbours[]`, and its answers to the two questions of Taludas in the format issue (comment 6825300752, 2026-11-12, https://github.com/anno-mods/anno-117-savegame-exchange-format/issues/1). The meaning of `amount` and any new `max` field belongs to the format spec repository; this plan states the calculator's position and does not decide for the spec.
- **Open blockers:** None for implementation. OQ1 (meaning of `amount`) must be answered in the issue thread before the calculator exports or interprets a supplier `max`; R9 holds under either answer.
- **Sources read:** the issue comment; `c:\dev\anno-117-exchange-format\spec\format.md` and `schema\anno117-exchange.schema.json`; the planner export in `c:\dev\Anno-117-Planner\paxplanner\model\exchange_export.py`, its plan `docs\plans\2026-11-07-001-feat-calculator-exchange-format-plan.md` and `README.md`; the calculator files named in Context & Research; the dialog mockups (https://claude.ai/artifact/SCQPogPpKRmREHC1cMbGdk).

---

## Product Contract

**Product Contract preservation:** R1-R5, R7-R9 and AE1-AE6 unchanged. R6 states that the original list position is guaranteed while the entry's routes and default supplier are unchanged since the import; after a route edit the governor suppliers are appended after the island suppliers (see U3), and identity and unknown fields are retained in every case. KD1 and one Problem bullet are rewritten because the carrier named in them cannot hold a per-product amount (see KD1).

### Problem

A governor is an NPC whose main harbour the player collects goods from. The planner models it as a supplier next to islands. When the planner exports a plan, an island's import of a product can list `{governor: <GUID>, amount}` beside island suppliers. Taludas reports that governor suppliers and residence items account for most of the remaining demand differences between the planner and the calculator on a shared test plan.

What the calculator does with such an entry today:

- It classifies a supplier with a numeric `governor` and no `island` as a governor supplier (`src/exchange/import-trade.ts:163`), keeps it in the preserved copy of the entry (`import-trade.ts:199`, `:284`) and reports "kept and not applied; the calculator models no governor supplier" (`import-trade.ts:205-211`). No route and no supply is written for it.
- A governor can never become the residual supplier through the island route logic: the residual choice by `share` skips governors (`import-trade.ts:290`), and a governor flagged `default` produces a report line and no default (`import-trade.ts:212-216`).
- On export the preserved entry returns only while routes, default supplier and shared passive amount equal what the import wrote (`src/exchange/exporter.ts:828-846`); otherwise it is dropped with a report line (`exporter.ts:788-792`).
- `trade.governorHarbours[]` is read as opaque objects (`src/exchange/reader.ts:145`, `types.ts:142`), preserved (`import-trade.ts:341`), reported as "kept unchanged and not applied" (`import-trade.ts:353-355`) and written back after pruning entries that name deleted islands (`exporter.ts:822`).
- Island suppliers import their `amount` as the route's user-set amount, which is a floor (`import-trade.ts:256`, `:42-44`); the exporter writes that floor back as `amount` (`exporter.ts:765-766`).
- The calculator has one mechanism that adds supply to a product without a production chain: the passive-trade supplier (`src/production.ts:260`, `src/suppliers.ts:44-108`). Its `userSetAmount` exists per product in memory, but it is persisted under the single island-store key `passiveTrade.userSetAmount` (`src/world.ts:1101`, `persistFloat` with an explicit `storageName`, `world.ts:720-736`), so every product of an island reads one value at load. While the passive supplier is the product's default supplier, `currentProduction()` returns the demand it was given, not `userSetAmount` (`suppliers.ts:70-75`).
- Only a Latium-style region exists as an asset with a GUID (`session.region.guid`, `src/AGENTS.md`, "Effect Filtering by Session").

What the format and the planner say:

- Spec: a supplier is `{island}` or `{governor}` with optional `share`, `amount` ("a minimum the user entered, t/min") and `default` (`spec/format.md:144-148`, schema `suppliers` at lines 397-410). A governor harbour carries `governor`, `region` (integer), `position`, `goods[]` `{product, rate}` and `stockLimits` (schema lines 414-429). The spec does not say whether `region` is a region or a session GUID.
- Planner (earlier export, in the checkout): never flags a governor as default; a governor that covers the rest is recorded in its own `ext` as `governorResidual` (`exchange_export.py:373-375`). It writes `region` from the session via a rules lookup and also writes `session` on each harbour (`exchange_export.py:390-391`). Per the issue comment, it now writes the delivered amount in `amount` and keeps the cap in `ext.planner.supplierCaps`, and when it reads another tool's file it still treats `amount` as a cap.
- Planner plan R46 states the calculator "keeps governor suppliers and harbours as preserved data, writes no route entry for them and restores them on export" (planner plan line 99). This plan replaces that position for suppliers with an amount.

### Actors

- **Calculator user** importing a planner file and expecting demand to match the planner's.
- **Planner user** reading a calculator export.
- **Format maintainer (Taludas)** who needs the calculator's answers to settle the spec.
- **Calculator maintainer** who owns import and export behavior.

### Requirements

**Import: apply governor supply**
- R1. A governor supplier with a positive `amount` on an import entry supplies that many t/min of the product to the receiving island, and the island's production demand for the product drops accordingly. Several governors on one entry supply the sum of their amounts.
- R2. A governor supplier without `amount`, or with an amount of zero, supplies nothing; it stays preserved. This follows the spec rule that an unentered amount is zero (`spec/format.md:154-155`).
- R3. A governor supply does not change which supplier is the product's default on the island, does not create a route, and does not count toward the cycle and duplicate checks of island routes.
- R4. A governor supplier flagged `default`, or an import entry whose residual supplier is a governor, keeps today's behavior: no default route, the product's default supplier stays as it is, and the report says so. Its positive `amount` is still applied under R1.
- R5. Each applied governor supply appears in `ImportPlan.report` as an approximation (code `governor-supply-applied`): governor GUID, product, receiving island and applied amount. A governor supplier that is not applied (R2, R4 default semantics) keeps today's "not applied" entry. Report entries serve tests and diagnostics only; no UI shows an import report (plan 2026-11-14-001 R5). The export report dialog stays and shows the export entries of R8.

**Round trip**
- R6. Every governor supplier, with its identity and all of its fields including unknown ones, always returns in the exported `trade.imports[]` entry it came from, as long as the receiving island and the product still exist, also after a route, default or passive edit and after a partial Trade import (plan 2026-11-14-001 R17a). Only its list-position claim is conditional: the original position holds while the entry's routes, default and passive amount equal the import; otherwise the governor suppliers follow the island suppliers (KTD5).
- R7. `trade.governorHarbours[]` returns unchanged, including unknown fields and the value of `region`. The calculator reads no field of a harbour and writes none it did not receive. Entries naming a deleted island are pruned as today.
- R8. Only amounts are invalidated by edits, never identities: if the user changes the product's governor-supplied amount after import, the exported governor suppliers keep their GUIDs and unknown fields, and their `amount` values are not exported (the changed total cannot be split among several governors without inventing a split). A governor `amount` is not exported when (a) the stored governor supply of the product differs from the imported value (`restore.governorSupply`) or (b) the default supplier of the product differs from the one the import set. Editing the route set of the product (adding, removing or changing routes of island suppliers) or its passive amount invalidates the list-position claim of R6 and no governor amount. The export report names the product and island. See OQ2.
- R9. The calculator does not rewrite the meaning of `amount`: it applies a supplier `amount` as received and exports a supplier `amount` it did not receive only for island suppliers, as today (floor the user set). A `max`-like field on a supplier is preserved unchanged and not applied. See OQ1.

### Scope Boundaries and Non-Goals

- Not a governor model: no governor catalogue, no governor stock, no governor trade budget, no governor ships. Not requested, because the file already carries the delivered amount and the planner states that routes do not feed back into production (`README.md` "Trade routes don't feed back").
- Not a governor route: no `tradeRoutes` entry, no ship or fleet calculation, no harbour position. Not requested, because the calculator's route list is island-to-island (`import-trade.ts:230-259`).
- No cap on island supplier routes. Not requested, because a stored route has no cap field: `StoredTradeRoute` is `{productGUID, from, to, userSetAmount, isDefaultSupplier}` (`src/exchange/types.ts:516-522`).
- Residence items are out of this plan. The calculator reads `residenceItems` as an opaque list (`reader.ts:77`, `types.ts:248`) and models items per factory, not per residence (`src/AGENTS.md` "Item Tri-State Boost": one state per `(item, factory)`). Plan 2026-11-12-002 owns them. See OQ3.
- No change by this plan to how island suppliers import or export, to the residual rule for islands, or to `visits` and `routes`. Plan 2026-11-14-001 owns those (R18-R22, including R19a: island supplier amounts import as floor 0 with the file's value kept).
- No repair of the shared `passiveTrade.userSetAmount` key. Not requested, because governor supply does not use it (KD1); the defect is recorded in OQ6.

### Acceptance Examples

- AE1 (R1, R5). Island "Roma" imports Bread with suppliers `[{island: "Ostia", amount: 2}, {governor: 777, amount: 4}]`. After import Roma's Bread production demand is lower by 4 t/min beyond what the Ostia route supplies, and `ImportPlan.report` holds one approximation entry naming governor 777, Bread, Roma, 4 t/min.
- AE2 (R2). The same entry with `{governor: 777}` and no amount: no demand change; the supplier is still in the preserved data; `ImportPlan.report` keeps the "not applied" entry.
- AE3 (R3, R4). `[{governor: 777, amount: 4, default: true}]` only: Roma's Bread default supplier is unchanged, no route exists, demand drops by 4, `ImportPlan.report` says the default was not applied.
- AE4 (R6). Import and immediately export: the Bread entry for Roma lists the Ostia and governor 777 suppliers in the original order with the original fields.
- AE5 (R8). After AE1, (a) the user sets Roma's Bread governor-supplied amount to 6, or (b) the user makes another supplier the default of Bread on Roma: in both cases the export lists governor 777 without `amount`, and the report names Bread and Roma. If the user only adds a route for a different supplier pair of Roma's Bread, or changes the floor of an existing route, with supply and default unchanged, the export lists governor 777 with its original `amount`.
- AE6 (R7). A file with a harbour `{governor: 777, region: 3225, session: 5, goods: ...}` exports the same object.

### Key Decisions

- KD1. **Governor `amount` is applied as additional supply on the receiving island and product, held in a dedicated per-product observable `Product.governorSupply` (t/min) that is summed into the product's production next to the passive supplier.** Reason: the passive-trade amount cannot carry it. Its stored key is one value for all products of an island (`world.ts:1101`), so a governor amount written there would apply to every product at the next load, and while the passive supplier is the default its `userSetAmount` is ignored (`suppliers.ts:70-75`). A dedicated observable keeps R3 (no route, no default change) and gives R8 an unambiguous edit target. The demand effect follows from the existing wiring: `demandCalculationSubscription` sets the default supplier's demand to `totalDemand - totalProductionWithoutDefaultSupplier` (`production.ts:286-294`), so adding the governor supply to `totalProductionWithoutDefaultSupplier` lowers upstream demand exactly as a route floor does.
- KD2. **Governor `region` is the region asset GUID, with the session carried in a separate `session` field.** The calculator answers Taludas this way: the field name says region, the planner writes a region from a session lookup and writes `session` alongside (`exchange_export.py:390-391`), and regions have GUIDs in the calculator's data (`src/AGENTS.md`). The calculator needs neither value, so this is a spec recommendation, not calculator behavior (R7).
- KD3. **Residence items are answered as "not in this plan"**, with the reason in Scope Boundaries.
- KD4. **A supplier `max` is preserved and not applied** until OQ1 is settled (R9), because the calculator has no per-supplier cap to apply it to.
- KD5. **Governor supply stays on the file's supplier entries.** Island supplier routes are derived from savegame route data when the player ticks "Re-calculate routes from savegame data" and the file carries ship-carrying routes (plan 2026-11-14-001, R18-R21). That derivation has no governor input: `visits` and `governorHarbours` hold no delivered amount, and the planner's savegame conversion has no governor logic. Governor suppliers therefore keep R1-R9 of this plan under every route source. Plan 2026-11-14-001 R20 states the same. The import scope for them is Trade routes and suppliers.

### Outstanding Questions

- OQ1. **What does supplier `amount` mean when a writer derives it?** Spec: a minimum the user entered. Planner: now the delivered amount, cap in `ext.planner.supplierCaps`, read back as a cap when foreign. Calculator: a floor on export (`exporter.ts:765`); on import a floor of 0 with the file's value kept, once plan 2026-11-14-001 R19a applies (`import-trade.ts:256` today). A governor `amount` is applied as received (R9). Three readings of one field. Recommendation: ask the spec to define `amount` as "t/min the writer plans to move" and add the optional `max` Taludas proposes (name to be fixed by the spec) for the cap; the calculator then applies `amount` as it does today and preserves `max`. R9 holds under any answer.
- OQ2. **What happens to the preserved governor entry when the user edits the supply?** Today the whole preserved entry is dropped (`exporter.ts:788-792`), which would delete the governor from the file. Recommendation: R8, keep the governor identity and unknown fields, drop only the amounts, and report. Alternative: keep today's drop and accept lost governors.
- OQ3. **Does the calculator get residence items?** Plan 2026-11-12-002 owns the answer; this plan makes no assumption about its outcome.
- OQ4. **Schema mismatch to raise in the issue.** The planner writes harbour `goods` as a map and a `limits` key (`exchange_export.py:392-393`) where the schema defines `goods[]` `{product, rate}` and `stockLimits`. The calculator preserves both shapes unchanged (R7) and reads neither. Recommendation: report it to the spec maintainer; no calculator change.
- OQ5. **Source of island routes.** The calculator text "does not derive routes" (`docs/exchange-format.md:149`) changes under plan 2026-11-14-001. `trade.imports` stay the input by default; the reference derivation (`format.md:157-185`) applies on request (plan 2026-11-14-001 R18). Ask on issue 1 whether the derivation should become the default for savegame sources.
- OQ6. **Shared passive-trade key.** `passiveTrade.userSetAmount` is one stored value for all products of an island (`world.ts:1101`; `docs/exchange-format.md:96` states it; plan 2026-11-14-001 R8 and Appendix A list it as "one value per island" under Trade routes and suppliers). Setting a passive amount on one product shows on all products after the next load. Separate defect, outside this plan. Recommendation: a follow-up that scopes the key per product (`<guid>.passiveTrade.userSetAmount`) with a decision on the legacy value (copy to every product to keep today's numbers, or drop it). Plan 2026-11-14-001 already classifies both keys under Trade, so the follow-up needs no classifier change, and its keep-mode rule treats the shared key as an island-level value (R21).
- OQ7. **Does a governor supply make a built local producer fully utilized (R51)?** `localProducer` (`import-trade.ts:317-331`) runs when a route or passive default was written. A governor amount is a fixed supply, not "the import covers the rest". Recommendation: do not apply R51 for governor supply; compare the shared planner test plan with `tests/exchange/xt-driver.spec.ts` after U2 and revisit if the residual differences point at local producers.
- OQ8. **Trading tab layout.** The mockup shows one trader row with a governor chip and the passive stepper. KD1 separates the amounts, so the plan uses a second row for the governor supply with its own stepper (U4). Recommendation: the second row, because the passive stepper edits a different number. A conditional "edited after import" sentence (mockup) needs the imported value, which lives in `exchange.ext`; the plan uses a static tooltip instead (U4). Needs the maintainer's confirmation of both.
- OQ9. **Round trip of an edited amount inside the calculator's own files.** R8 drops edited amounts from the standard part of the file, so a calculator-to-calculator round trip would reset the edit. Recommendation: U5, a raw `ext.calculator.store` key that wins on import for the calculator's own files. Optional; U1-U4 and U6 stand without it.

---

## Planning Contract

### Context & Research

Verified by reading the files (line numbers as of the working tree on 2026-11-14):

- `src/exchange/import-trade.ts`: `TradePlanner.processImport` (169-285) classifies suppliers, builds `reasons`, writes routes and default keys into `result.islands[key].store`, and calls `preserve(...)` when `reasons` is non-empty; a governor always sets reason `governor-supplier` (205-211), so an entry with a governor is always preserved. The ambiguous-default branch (188-195) returns before anything is written. `finish()` (424-439) fills `restore.routes` and `restore.defaultSupplier`; `restore.passiveUserSetAmount` is initialized to 0 in `preserve` (150) and never written elsewhere in this file.
- `src/exchange/types.ts`: `PreservedImport`/`TradeRestore` (534-555), `TradeIslandPlan.store` is a plain key map merged into the island store (557-567), `StoredTradeRoute` (516-522).
- `src/exchange/exporter.ts`: `tradeBlock` (744-824) builds groups from routes, places held entries (`holds`, 828-846) and generates the rest; `pruneEntry` (849-865) removes only island references; raw island-store keys not claimed through `handled` are written to `islands[].ext.calculator.store` (AGENTS note in `src/AGENTS.md` "Exchange exporter"; the `handled` set is used at 347-348, 372-379, 479-480). The loop that decides raw export was not read in full (unverified: exact location; U3 reads it before editing).
- `src/exchange/import-calculator.ts`: raw `ext.calculator.store` keys are copied into the plan except protected prefixes (73); "core mappings win over these raw keys" (header comment, line 8). The merge order between this plan and the trade plan was not read (unverified; matters for U5 only).
- `src/exchange/computed.ts:47-56`: `imports` per product = route output + passive `currentProduction()`.
- `src/production.ts`: `totalCurrentProduction` (253-263), `totalProductionWithoutDefaultSupplier` (266-275), `excessProduction` pureComputed (283), `demandCalculationSubscription` (286-294), `initSuppliers` creates `passiveTradeSupplier` (155-165).
- `src/suppliers.ts:44-108`: `PassiveTradeSupplier`; `createFloatInput(0, 0)` imported from `./util`.
- `src/world.ts:1089-1156`: per-product persistence in the Island constructor after `initSuppliers`; `persistFloat(obj, attr, storageName)` at 720-736 writes the observable value to the island `Storage` and reads it back once at construction.
- `src/presenters.ts`: `nonRouteProductionFor` (602-613, aggregate mode) and `tradingAmountFormatted` (904-906) sum the passive supplier next to other supply.
- `templates/product-config-dialog.html:153-168`: the Trading table has the "Traders" row with `btn-default-supplier` and `trade-route-amount` bound to `passiveTradeSupplier`; the `trade-route-amount` component (`src/components.ts:244-278`) requires a `supplier` with `product` and `userSetAmount` observables and renders `isDefaultSupplier()`; a governor row cannot reuse it unchanged.
- Existing tests: `tests/exchange/import-trade.spec.ts` (governor cases at 201-240 assert today's "kept, not applied" and must change), `tests/exchange/exporter.spec.ts`, `tests/exchange/roundtrip.spec.ts`, `tests/exchange/computed.spec.ts`, `tests/exchange/xt-driver.spec.ts`, `tests/computed/all-islands-aggregation-products.spec.ts` (passive supplier pattern at 177-191).
- Instruction files read: `AGENTS.md`, `src/AGENTS.md`, `templates/AGENTS.md`, `docs/exchange-format.md`. `tests/AGENTS.md` was not read for this revision (unverified: fixture and helper conventions; U-tests follow the neighbouring specs and `tests/helpers/exchange.ts` named in `docs/exchange-format.md`).

No external research: the work is internal to a verified exchange pipeline and the format questions go to the spec repository.

### Key Technical Decisions

- KTD1. **Carrier:** `Product.governorSupply`, a `createFloatInput(0, 0)` observable created in `initSuppliers` beside `passiveTradeSupplier`, persisted per product under the island-store key `<productGuid>.governorSupply` (a new `keys.governorSupply(product)` in `src/exchange/keys.ts`, next to `defaultSupplierType`). Reason: KD1.
- KTD2. **Production sums:** add `governorSupply()` to `totalCurrentProduction` and to `totalProductionWithoutDefaultSupplier` unconditionally, whether or not the passive or any other supplier is the default. `excessProduction` follows through `totalCurrentProduction`. A governor amount above the remaining demand shows as excess production, the same as a route floor.
- KTD3. **Import writes the sum, the exporter reads the file's entries.** `import-trade.ts` writes `out.store[keys.governorSupply(product)] = sum` for the receiving island and extends `TradeRestore` with `governorSupply: number` (the sum written). The exporter compares the stored value to `restore.governorSupply` and the product's default supplier to the default of the import snapshot to detect R8.
- KTD4. **Which entries apply.** Governor amounts apply only when the entry reaches the point where today's code builds `reasons` (after the ambiguous-default return), the product is known and the receiver exists. A second import entry for the same island and product does not add its governor amounts; it reports through the existing `duplicate-import-entry` code. Reason: consistent with the duplicate-route rule at `import-trade.ts:233-236`.
- KTD5. **Export when the held entry no longer holds (route set, default or passive amount edited).** The generated entry for the pair gets the preserved governor suppliers appended after the island suppliers, whole objects with unknown fields, `default` removed (the default is regenerated from routes; two defaults would be an ambiguous-default on the next import, `import-trade.ts:188-195`), and `amount` removed only when the stored supply differs from `restore.governorSupply` or the product's default supplier differs from the snapshot default (R8); an edit of the route set or the passive amount moves the entry but keeps the amount. Non-governor preserved suppliers (non-player, self) keep today's drop.
- KTD6. **Raw key stays out of the exchange file.** The exporter claims `<guid>.governorSupply` through `handled` so it does not appear in `ext.calculator.store` (except U5). Otherwise a stale raw copy would resurrect an amount after R8 stripped it.
- KTD7. **Epsilon:** the stored value and `restore.governorSupply` compare equal within 1e-9. The input rounds through `createFloatInput`, so exact equality of a value the user retyped is not guaranteed.
- KTD8. **UI row visibility:** the governor row appears in the Trading table while `governorSupply() > 0`. Setting it to 0 hides the row; the supply is then 0 and the export drops the amounts (R8). No UI creates a governor supply from nothing.

### High-Level Technical Design

Production wiring after U1 (existing nodes plain, new node marked):

```
tradeList routes ─────────────┐
extra goods / factories ──────┤ availableSuppliers() ─┬─> totalCurrentProduction ──> excessProduction
passiveTradeSupplier ─────────┤                       │
governorSupply()  [new] ──────┴───────────────────────┘
                                                      │ (non-default only)
availableSuppliers() minus default + governorSupply() ┴─> totalProductionWithoutDefaultSupplier
                                                           └─> remaining = max(0, totalDemand - that) -> defaultSupplier.setDemand
```

Export decision per (receiving island, product) with a preserved governor entry:

```
holds(routes, default, passive)?
  yes -> emit original entry
         if stored governorSupply != restore.governorSupply or default supplier != snapshot default: strip amount of governor suppliers, report
  no  -> emit generated island entry
         append governor suppliers (no default flag; amount stripped when supply or default supplier changed)
         existing non-governor preserved suppliers: dropped, existing report
```

### Implementation Units

### U1. Governor supply on the product

- **Goal:** A per-product, persisted governor supply that lowers the default supplier's demand and appears in production and import figures.
- **Requirements:** R1, R3; KD1, KTD1, KTD2.
- **Dependencies:** none.
- **Files:** `src/production.ts` (observable, both sums), `src/exchange/keys.ts` (key function), `src/exchange/scopes.ts` (Trade row for `<p>.governorSupply`), `src/world.ts` (persist beside line 1101), `src/presenters.ts` (`nonRouteProductionFor`, `tradingAmountFormatted`), `src/exchange/computed.ts` (imports figure), `tests/computed/governor-supply.spec.ts` (new).
- **Approach:** Create `governorSupply` in `Product.initSuppliers` with `createFloatInput(0, 0)` (import from `./util`, as `suppliers.ts:1`). Declare it on the class with the other supplier fields (near `production.ts:42`). Persist with `persistFloat(p, "governorSupply", keys-equivalent string)` in the per-product block at `world.ts:1099-1101`; use the literal `${p.guid}.governorSupply` there (world.ts does not import the exchange keys; mirror the literal and keep both in one comment). Add the term to `totalCurrentProduction` and `totalProductionWithoutDefaultSupplier`. Add it to the two presenter sums and to `computed.ts:53` so the exchange summary counts it as an import. The Island constructor's init order is unaffected: the observable exists after `initSuppliers` and before the persistence block.
- **Patterns to follow:** `PassiveTradeSupplier.userSetAmount` creation and its persistence line; `Product.excessProduction` as pureComputed.
- **Test scenarios:**
  - Happy path: an island with Bread demand 10 and a factory as default supplier; set `governorSupply(4)`: the factory's demand is 6 and the Bread tile's total production is unchanged at 10.
  - Default unchanged (R3): `defaultSupplier()` is the same object before and after.
  - Passive is default: passive supplier default, `governorSupply(4)`, demand 10: passive `amount()` is 6; no change to `passiveTrade.userSetAmount`.
  - Excess: `governorSupply(12)` with demand 10: `excessProduction()` is 2 and the factory demand is 0.
  - Zero and negative input: `createFloatInput` floor 0 keeps the value at 0.
  - Persistence: set 4 on product A only, reload the island from the same storage: A reads 4, product B reads 0 (the property the passive key lacks).
  - Aggregate mode (aggregation on, All Islands selected): the product tile's total production equals the sum over real islands including the governor supply (pattern: `tests/computed/all-islands-aggregation-products.spec.ts:177-191`).
  - Exchange summary: `computeSummary` imports for the product includes 4 (`tests/exchange/computed.spec.ts`).
- **Verification:** the new spec and the existing computed and aggregation specs pass when run serially; type-check clean.

### U2. Import applies governor amounts

- **Goal:** `planTrade` writes the governor supply and reports it; today's governor tests change to the new behavior.
- **Requirements:** R1, R2, R3, R4, R5; KTD3, KTD4.
- **Dependencies:** U1.
- **Files:** `src/exchange/import-trade.ts`, `src/exchange/types.ts` (`TradeRestore.governorSupply`), `src/exchange/keys.ts`, `tests/exchange/import-trade.spec.ts`.
- **Approach:** In `processImport`, after `governors` is computed, sum `amountOf(c.s)` over governor suppliers (reuse the helper at line 42). When the sum is positive, write `out.store[keys.governorSupply(e.product)]` and add one `approximated` report entry per governor with a positive amount (code `governor-supply-applied`; detail: governor, product, island, amount). The existing `not-mapped` `governor-supplier` line stays for governors with amount 0 only (R2, AE2); the `governor-default` line stays (R4). `preserve()` initializes `restore.governorSupply` to 0; `processImport` sets it to the sum right after `preserve` is called (the `kept` object is returned). Track applied pairs in a `Set` (`product|receiver.key`) for KTD4. Do not call `localProducer` for governor supply (OQ7). Do not touch `defaults`, `routeKeys` or `residual` (R3). The `non-player-passive` branch at 267 is unaffected: it tests island suppliers and `residual.kind`, not governor amounts.
- **Technical design:** none; the change is an additive branch.
- **Patterns to follow:** `this.add("approximated", ...)` calls at `import-trade.ts:249-252`, `:271-274`.
- **Test scenarios:**
  - Covers AE1. Entry `[{island:'a', amount:2}, {governor:777, amount:4}]` for B: the store holds `<BREAD>.governorSupply = 4`, one route A to B (its floor follows the island-supplier rule in force, plan 2026-11-14-001 R19a), `ImportPlan.report` has one `governor-supply-applied` with governor 777, 4 t/min.
  - Covers AE2. `{governor:777}` without amount: no store key, report keeps `governor-supplier`, entry preserved.
  - Covers AE3. `[{governor:777, amount:4, default:true}]`: store key 4, no route, no `<BREAD>.defaultSupplier.*` keys, reports `governor-default` and the applied line.
  - Two governors 3 and 1.5 on one entry: key 4.5, two report lines.
  - Ambiguous default (governor default plus island default): nothing written (existing test at lines 219-227 stays, plus an assertion that no governor key exists).
  - Duplicate entries for the same island and product with governor amounts: the first applies, the second reports `duplicate-import-entry` and adds nothing.
  - Unknown product and unavailable receiver: no key (existing branches 170-182).
  - Update the tests at lines 201-240 that assert today's "no key" and `governor-supplier` expectations; the harbours assertion (237) stays.
- **Verification:** `tests/exchange/import-trade.spec.ts` passes; the plan result's `restore.governorSupply` equals the written sum.

### U3. Export returns governors and handles edited amounts

- **Goal:** R6, R7, R8 on export, plus claiming the new key.
- **Requirements:** R6, R7, R8, R9; KTD5, KTD6, KTD7; AE4, AE5, AE6.
- **Dependencies:** U2.
- **Files:** `src/exchange/exporter.ts`, `tests/exchange/exporter.spec.ts`, `tests/exchange/roundtrip.spec.ts`.
- **Approach:** (1) In the per-island store loop, add `<guid>.governorSupply` to `handled` (read the raw-export loop first; unverified location). (2) In `tradeBlock`, after `holds()` returns true for a kept entry, read the stored value and compare with `kept.restore.governorSupply` (KTD7) and compare the product's default supplier with the snapshot default. When either differs, clone the entry, delete `amount` from each supplier with a numeric `governor`, and `this.note(...)` a report entry (new code `governor-amount-not-exported`, naming product and island). (3) When `holds()` is false and the kept entry has governor suppliers, remember them in a map keyed `${b.name}|${product}`; when the generated entry for that key is built (`entry` at 807), append clones of those suppliers with `default` deleted and, if the stored value differs from `restore.governorSupply` or the default supplier differs from the snapshot default, `amount` deleted. A pair with governor suppliers and no generated group (no routes left) is emitted as an entry with only the governors. (4) Leave the `import-entry-dropped` note for the non-governor remainder. Harbours (822) need no code change; add the test.
- **Patterns to follow:** `this.note("entry-pruned", ...)` usage at 852; `clone` helper.
- **Test scenarios:**
  - Covers AE4. Import AE1 file and export: the Bread entry lists Ostia then governor 777 in original order with original `amount`, `share` and an unknown field (`ext`) on the governor.
  - Covers AE5. After import set `governorSupply` to 6: the governor supplier is present without `amount`, unknown fields intact; report holds `governor-amount-not-exported` with product and island; the Ostia supplier still exports its floor.
  - Set to 0: same as AE5 (amounts dropped, governor kept).
  - Covers AE5 (b). After import another supplier becomes the default of the product with the governor supply unchanged: the governor supplier is present without `amount`, unknown fields intact, and the report holds `governor-amount-not-exported`.
  - Covers AE5, unchanged case. A route is added for a different supplier pair, or the floor of an existing route is changed, with governor supply and default supplier unchanged: the governor keeps its `amount`.
  - Route edited after import (Ostia floor changed) with governor supply and default supplier unchanged: entry is generated, governor appended after Ostia with its `amount`, no `default` flag.
  - Governor flagged default plus a route edit: governor appended without `default`; re-import of the export does not report `ambiguous-default`.
  - Island deleted that was a supplier: pruned as today and governor stays (`pruneEntry` keeps governors).
  - Covers AE6. Harbours `{governor:777, region:3225, session:5, goods:{...}, limits:{...}, futureField:1}` export equal; a harbour naming a deleted island is pruned (existing test pattern).
  - No raw copy: the exported `islands[].ext.calculator.store` has no `<guid>.governorSupply` key.
  - Round trip: import, export, import the export, `computeSummary` equal before and after, for a governor with amount (add to `tests/exchange/roundtrip.spec.ts`).
- **Verification:** exporter, roundtrip and conformance specs pass serially; the export of the AE1 file validates against the schema through the helper in `tests/helpers/exchange.ts`.

### U4. Trading tab row for governor supply

- **Goal:** The player sees and can edit the governor supply on the product's Trading tab; the edit consequence is visible.
- **Requirements:** R1, R8 (edit point), KTD8, OQ8.
- **Dependencies:** U1.
- **Files:** `templates/product-config-dialog.html` (new row after line 168), `src/components.ts` (a small `governor-supply-amount` component or reuse `number-input-increment` as in `trade-route-amount`), `src/presenters.ts` (a `governorSupply` accessor on `ProductPresenter` if the template needs the island-resolved instance), `src/i18n.ts` (keys `governorSupply` and `governorSupplyHint`, 12 languages via `/translate`), `tests/binding/governor-supply-row.spec.ts` (new).
- **Approach:** Row visible while `$data.instance().governorSupply() > 0`, inside `<!-- ko ifEditable: true -->`; the aggregated view shows no row (the total is already in the tile and tab figures through U1). Row content: governor icon, label from `$root.texts.governorSupply`, stepper bound to `governorSupply` with the same markup as `trade-route-amount` (lines 266-272), unit `t/min`, and an info icon whose title is `governorSupplyHint` ("Changing this amount keeps the governor in the export but not its amount."). No default-supplier button. Bind the amount through the presenter's island-resolved instance (`$data.instance()`), not a captured product, per the presenter rules in `src/AGENTS.md`. Add `debug:` bindings per `templates/AGENTS.md`. The governor icon file is not verified: reuse an existing icon from `icons/` and decide at implementation (mockup icons are stand-ins). The row does not show the governor GUID: the product holds only the sum and the calculator has no governor catalogue.
- **Patterns to follow:** the Traders row (`product-config-dialog.html:155-168`); `ifEditable` gating per `templates/AGENTS.md`.
- **Test scenarios:**
  - Row hidden while `governorSupply` is 0; appears after `governorSupply(4)` with value 4 in the input.
  - Editing the input to 6 updates `governorSupply()` and the factory demand (binding spec).
  - Setting 0 hides the row.
  - With aggregation on and All Islands selected the row is absent and no binding error is thrown (`collectErrors` helper).
  - Dark mode: row has no hard-coded light colors (visual check, not automated).
  - Translation completeness: `npm run check-translations` passes (run by the implementer).
- **Verification:** binding spec passes serially; manual check of the dialog in light and dark mode.

### U5. Own round trip of an edited amount (optional)

- **Goal:** A calculator-to-calculator export keeps an amount the user changed after import, without putting an invented split into the standard fields.
- **Requirements:** R8 (reconciled with R9); OQ9.
- **Dependencies:** U3.
- **Files:** `src/exchange/exporter.ts`, `src/exchange/import-calculator.ts` and/or `src/exchange/import-trade.ts` (precedence), `tests/exchange/roundtrip.spec.ts`.
- **Approach:** Do not mark `<guid>.governorSupply` handled when the stored value is above 0 and differs from the sum of governor `amount` values the export writes for that pair; the existing raw path then writes it to `islands[].ext.calculator.store`. On import, for this one key a raw value wins over the entry sum (an exception to "core mappings win" at `import-calculator.ts:8`). The merge order of the trade plan and the calculator plan is not verified; if the calculator plan is applied before the trade plan, apply the exception in the merge step that combines the two. Skip this unit if the merge turns out to need more than a conditional in one place.
- **Test scenarios:**
  - Import AE1, set supply 6, export, import: `governorSupply` is 6 again and the export of that import again lacks the governor `amount`.
  - Unchanged supply: no raw key in the export.
  - A foreign reader ignores the key (schema validation passes with the key present).
- **Verification:** roundtrip spec passes; conformance fixtures unchanged.

### U6. Documentation

- **Goal:** The docs state the new behavior.
- **Requirements:** R1-R9.
- **Dependencies:** U1-U4.
- **Files:** `docs/exchange-format.md` (the "Trade" mapping paragraph at lines 83-88: governor amounts become `<product>.governorSupply`; "What is preserved but not applied" at line 96: governor suppliers are applied when they carry an amount, harbours stay preserved), `src/AGENTS.md` ("Exchange exporter": governor supply key, KTD5 merge rule, key claimed through `handled`; a one-line note that `passiveTrade.userSetAmount` is one stored value per island), `scripts/AGENTS.md` and `tests/AGENTS.md` only if a new test convention appears.
- **Test expectation:** none -- documentation.
- **Verification:** the statements match the code after U1-U4.

---

## System-Wide Impact

- **Demand and tiles:** every consumer of `totalCurrentProduction`, `excessProduction` and `totalProductionWithoutDefaultSupplier` sees the governor supply. Searched for passive-supplier sums outside production.ts (`presenters.ts:611`, `:905`, `computed.ts:53`); other readers of `passiveTradeSupplier.currentProduction()` were not found in `src`, but `src/statistics*` and `src/views.ts:231` were not read (unverified: they may read production through the product sums only).
- **Storage:** a new island-store key per product. Old saves have none and read 0.
- **Statistics page and live feed:** unaffected unless they read the product sums; not verified.
- **Aggregate mode:** the sums in `ProductPresenter` use real islands' products, so U1 covers it; the row is gated with `ifEditable`.

## Risks & Dependencies

- **Plan 2026-11-14-001 (import scopes).** Assumed interface: the Trade routes and suppliers scope applies island-store keys of the trade plan (`TradePlan.islands[key].store`, including `<guid>.governorSupply`) and the snapshot rule of its R17a refreshes `restore` as built by `planTrade`, which now includes `restore.governorSupply`. Its R8, R21 and Appendix A list `<product>.governorSupply` under Trade and its R17a includes `restore.governorSupply` in the snapshot comparison; this plan adds the matching `scopes.ts` row in U1. Order across plans: "Sequence across plans" in that plan (this plan is step 3, before its U8). Its R19a (island supplier amount imported as floor 0, value kept in `exchange.ext`) does not touch governor amounts (its R20 and KD8 say so). If that plan changes `holds()` or the `restore` shape, U3 needs only the signature `holds(kept, receiver, store, routes, names)` and the `kept.restore.governorSupply` field. If a partial import leaves a governor key in place while replacing routes, the governor entry is judged by `holds()` and KTD5 as usual.
- **Plan 2026-11-12-004 (factory effect UX).** Edits `templates/factory-config-section.html`, not the Trading table in `templates/product-config-dialog.html`; shared files are `src/i18n.ts`, `src/components.ts`, `src/presenters.ts` (different members). Plans 002 and 003 add i18n keys too; key ownership is listed in plan 2026-11-14-001, "Sequence across plans". No functional dependency.
- **Plan 2026-11-12-002 (residence items).** None; governor supply and residence items are independent (KD3).
- **Risk: planner comparison.** The demand differences Taludas sees may remain because of residence items or R51 (OQ7). Mitigation: compare with `tests/exchange/xt-driver.spec.ts` after U2.
- **Risk: stale expectation in existing tests.** `tests/exchange/import-trade.spec.ts:201-240` asserts the old behavior; U2 updates them.
- **Risk: `createFloatInput` rounding** makes equality checks fragile; KTD7 uses an epsilon.

## Verification Contract

- `npm run type-check` and `npm run build` pass (build is mandatory before tests, per `AGENTS.md`).
- Specs run serially, never concurrently: `tests/computed/governor-supply.spec.ts`, `tests/exchange/import-trade.spec.ts`, `tests/exchange/exporter.spec.ts`, `tests/exchange/roundtrip.spec.ts`, `tests/exchange/computed.spec.ts`, `tests/exchange/conformance.spec.ts`, `tests/binding/governor-supply-row.spec.ts`, and the aggregation product specs under `tests/computed/`; use `--reporter=list --workers=1`.
- `npm run check-translations` passes.
- Not run during planning: no builds or tests were executed for this plan.

## Definition of Done

- AE1-AE6 hold in tests (U2: AE1-AE3; U3: AE4-AE6).
- R1-R9 each trace to a unit and a scenario; U5 is either done or recorded as skipped with the reason.
- No `as any` casts; `dist/calculator.bundle.js` is not committed (release-only rule in `AGENTS.md`).
- `docs/exchange-format.md` and `src/AGENTS.md` describe the shipped behavior (U6).
- OQ1, OQ4, OQ5 are posted to the format issue thread by the maintainer; OQ6-OQ9 have a recorded decision.

## Sources & Research

- Issue comment 6825300752 and spec/schema/planner files listed in the Goal Capsule.
- Calculator files in Context & Research.
- Mockup, section "Trading tab: where governor supply shows" (https://claude.ai/artifact/SCQPogPpKRmREHC1cMbGdk); its statement that plan 001 stores governor supply in the passive-trade amount no longer applies (KD1, OQ8).
- Sibling plans: `docs/plans/2026-11-14-001-feat-import-scopes-plan.md` (R17a, R19a, R20, tables at lines 58 and 148).
