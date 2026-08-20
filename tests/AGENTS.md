# Testing Framework Knowledge

## Quick Reference: Helpers
- **ConfigLoader**: 
    - `loadConfig(page, fixturePath)`: Loads a JSON file into localStorage.
    - `loadConfigObject(page, configObject)`: Directly loads an object into localStorage.
    - `createIslandConfig(name, session, data, settings)`: Creates a single-island config.
    - `createFullConfig(islands, settings, activeIsland)`: Creates a multi-island config (e.g., Latium + Albion).
- **BindingDetector**: `listenForErrors(page)`, `hasBindingError()`. Captures Knockout errors. *Note: `error.text()` is a function.*
- **ComputedAsserter**: `assertEquals(page, path, expected, tolerance)`. Safely evaluates observables in page context.
- **FixtureManager**: `loadFixture(name)`, `generateFixture(params)`. Manages test data in `tests/fixtures/`.
- **LP Framework**: `tests/minimization/lp-framework.ts`. Uses `javascript-lp-solver` to compute minimum throughputs given demands and active effects.

## Minimization Tests

**Location**: `tests/minimization/minimization.spec.ts`
**Purpose**: Verifies that the calculator's reactive throughput logic matches a linear programming oracle.

**Implementation Details**:
- Decision variables: `t_f` (throughput of factory `f`).
- Objective: `minimize sum(t_f)`.
- Constraints: Net production of product `p` >= external demand `p`.
- Supports: Base productivity, multiplicative percentage boosts, self-effecting extra goods, and non-self-effecting extra goods.

**Common Pitfalls**:
- **Region IDs vs GUIDs**: `Factory.associatedRegions` typically contains string IDs (e.g. `"Roman"`). `Session.region` is a numeric GUID. To filter factories by session, first resolve the Session's region GUID to its corresponding Region ID via `params.regions`.
- **Build Synchronization**: Playwright tests load `dist/calculator.bundle.js`. Always run `npm run build` after modifying `src`. If the bundle doesn't update, use `rm -r -Force dist ; npm run build` (PowerShell) to force emission.

## Critical Constraints
- **Robust Initialization**: `networkidle` is unstable. Always wait for the view and island to be ready:
  `await page.waitForFunction(() => (window as any).view && (window as any).view.island());`
- **Knockout in `page.evaluate()`**: There is no bare `ko` global. Access observables by calling them: `window.view.island().factories[0].boost()`. `window.ko` *is* exposed (`src/main.ts`) so binding tests can inspect the registry (`(window as any).ko.bindingHandlers`, `.virtualElements.allowedBindings`) - use it for that only, never for `ko.unwrap`/`ko.isObservable` on view-model values.
- **Observable Arrays**: Must unwrap before array methods: `factory.buffs().find(...)` or `island.availablePatrons().find(...)`.
- **DOM-Based Testing**: Prefer waiting for selectors (`.product-tile`) and clicking elements over direct `window.view` access to avoid timing issues.

## Common Mistakes to Avoid
- **Reference Errors**: Never use `ko.isObservable()` or `ko.unwrap()` in `page.evaluate()`. Use `typeof === 'function'` or direct calls.
- **Missing Parentheses**: Using `factory.boost` instead of `factory.boost()` returns the function, not the value.
- **Manual localStorage**: When setting objects in `evaluate` blocks, you MUST `JSON.stringify(value)` for objects, otherwise they are stored as `"[object Object]"`.
- **Patron Availability**: `availablePatrons()` is filtered by DLC. If a patron isn't appearing, ensure its associated DLC is checked.
- **`page.evaluate` Arguments**: Playwright's `page.evaluate` only accepts **ONE** argument for the function. Pass multiple values as an object: `page.evaluate(({a, b}) => a + b, {a: 1, b: 2})`.
- **Storage Booleans**: `localStorage` stores booleans as strings `"1"` or `"0"`. Use `Number()` coercion when comparing.
- **Collapsible Elements**: Tests will fail to "click" or "see" elements inside collapsed fieldsets. Expand them first via DOM manipulation.
- **Hardcoding Params**: Don't hardcode cycle times or consumption rates. Read them from `window.view.island().assetsMap.get(guid)` in the test.
- **Bootstrap Tabs**: Only ONE tab can have the `active` class at init. Don't add `active` via `foreach` loops in templates.
- **Nested Replacement Errors**: When using `replace`, ensure the `new_string` doesn't accidentally wrap or nest class definitions (e.g., `class X { class X ... }`).
- **Need vs Product GUIDs**: Needs have their own GUIDs distinct from the products they consume. Check `params.needs` for the correct GUID when testing consumption logic.
- **Asset Traversal**: Some objects like `PopulationLevelNeed` aren't in the global `assetsMap`. Access them via their parents: `island.populationLevels.flatMap(l => l.needs)`.
- **Signed zero (`-0`)**: `scaling(0) * negativeBuff` yields `-0`, and `expect(-0).toBe(0)` fails (Object.is). Use `toBeCloseTo(0, 6)` for values that can be a negated zero.

## Tri-State Item Boost Testing (see `tests/computed/tristate-boost.spec.ts`)
- **Set/read a slot's state** via the observable: `item.slotStates.get(factoryObject)` — `state()` reads, `state(2)` writes (0=Off,1=Base,2=Boosted). `factoryObject` = `island.assetsMap.get(factoryGuid)` (same instance as in `item.factories`).
- Base equipment: `item.equipments.find(e => e.target === f)`; boost equipment: `item.boostEquipments.find(e => e.target === f)`. `e.scaling()` reflects the active variant; `e.activeBuff()` (base equip only) returns the displayed buff.
- **Persistence** reuses key `${factoryGuid}[${itemGuid}].scaling` as a raw int in the **island Storage JSON** — read via `island.storage.getItem(key)` (returns a number, set synchronously); seed a save by putting that key in `createIslandConfig`'s island `data`.
- **DLC-gated items self-heal**: writing a slot to a non-zero state auto-checks the item's DLC (`view.dlcsGuidMap.get(dlc).used()` → `checked(true)`). To assert visibility, check the DLC first; an unlocked slot is excluded from `factory.availableItems()`.
- **Boostable replace-input fixture**: prefer **156714** (non-mythic; the `Specialist Mythic 160xxx` items are churn-prone). Assert on the *replaced-from* good (goes to 0) — the replaced-to good may also be consumed indirectly and shifts with the boost's productivity.

## Local env: port 8080 may be squatted
The Playwright `webServer` uses `http-server -p 8080`. On this machine port 8080 can be held by an unrelated app (5KPlayer `Airplay.exe`) that returns empty (`Content-Length: 0`) responses, so the app never loads and every test times out at `waitForFunction(view.island())`. Free 8080 (quit the squatter), or run against another port with a temporary config overriding `use.baseURL` + `webServer` (`reuseExistingServer: true`). Tests hard-coding `http://localhost:8080/...` (`dlc-unlocks`, `product-visibility`, `session-icons`, `debug-dlc-assets`) can't be redirected this way and only pass on a free 8080. Delete the temporary alt-port config file when done - it's not part of any deliverable.

## Two pitfalls that produce mass, unrelated-looking test failures
- **Stale `dist/calculator.bundle.js` mid-session**: Playwright loads the on-disk bundle, not live source. If something reverts `dist/calculator.bundle.js` (e.g. `git checkout -- dist/...` to discard build noise before committing, since the project's convention is to only commit that file on an actual release) *after* a build but *before* the next test run, every subsequent run silently tests old code - failures look like widespread regressions across unrelated files, including tests that passed minutes earlier. Fix: `npm run build` immediately before every test run that matters, and never revert `dist/` between building and testing in the same session; only revert/discard it right at the very end, after the last test run.
- **Running two `npx playwright test` invocations concurrently** (e.g. one in the foreground, one backgrounded) against the same `webServer`/port causes resource contention and produces dozens of spurious failures (including `page.goto` never resolving) with no code-level cause. Never overlap two live `playwright test` runs against the same port; wait for one to finish before starting another.

## Population Tiers
| Region | Tier 1 | Tier 2 | Tier 3 |
| :--- | :--- | :--- | :--- |
| **Roman** | Liberti | Plebeians | Equites |
| **Celtic** | Waders | Smiths | Aldermen |

## Common Test GUIDs
| Category | GUID | Name / Description |
| :--- | :--- | :--- |
| **Session** | 37135 | All Islands (Global/Meta) |
| **Session** | 3245 | Latium |
| **Session** | 6627 | Albion |
| **Population**| 1499 | Liberti Population Level |
| **Residence** | 3087 | Liberti Residence (Latium) |
| **Residence** | 6472 | Aldermen Residence (Albion) |
| **Residence** | 6475 | Waders Residence (Albion) |
| **Factory**   | 3089 | Timber Factory (Latium) |
| **Factory**   | 2786 | Sheep Farm |
| **Factory**   | 3187 | Spinner |
| **Factory**   | 2694 | Latium Vineyard (produces Grapes 2070, NOT Wine) |
| **Factory**   | 23723 | Albion Vineyard (produces Grapes 2070, NOT Wine) |
| **Factory**   | 3177 | Roman Vintner (produces Wine 2138) |
| **Factory**   | 23753 | Celtic Vintner (produces Wine 2138) - Wine's two-factory-type fixture, ready-made for multi-region/multi-producer test scenarios |
| **Factory**   | 2916 | Limestone Quarry |
| **Factory**   | 3070 | Furnace (Latium, produces Iron 2115) - has equippable items (Favillus 50890/Smelters 51334), used as `itemFixture`-style fixture for aggregate factory-config-dialog tests |
| **Factory**   | 3174 | Bakery (Latium, produces Bread 2137) |
| **Factory**   | 3185 | Garum Works (Latium, produces Garum) |
| **Factory**   | 4831 | Olive Press (Roman) |
| **Factory**   | 152729 | Egyptian Olive Press |
| **Product**   | 2149 | Olive Oil |
| **Product**   | 2153 | Cheese |
| **Product**   | 2138 | Wine |
| **Product**   | 2140 | Oysters with Caviar |
| **Product**   | 2151 | Fine Glass |
| **Product**   | 2179 | Marble |
| **Product**   | 8563 | Minerals |
| **Product**   | 2069 | Wheat |
| **Product**   | 2137 | Bread |
| **Product**   | 2146 | Necklaces |
| **Product**   | 2075 | Good Horses (hippodrome horse need; no factory in Latium, met by import) |
| **Product**   | 2163 | (goodConsumptionUpgrade target, "Chariots on Fire" effect) |
| **Product**   | 145102| Obsidian |
| **Module**    | 77954 | Silo Module (Sheep Farm) |
| **Buff**      | 77960 | Silo Buff (+100% Prod) |
| **Item**      | 51339 | Measurer (-25% Workforce) |
| **Item**      | 50890 | Favillus (boostable, no DLC; base +35% prod / boost +45%) targets Roman 3070,3074,31755,3170,13808 |
| **Item**      | 51334 | Smelters (no boostBuffs; workforce maint -25%) targets Roman 3070 |
| **Item**      | 144842| Lorana (boostable, DLC 67902; +25%/+50%) single Celtic target 31764 |
| **Item**      | 145268| Volcano L End (boostable, DLC 67902) many Roman targets — multi-slot DLC-lock fixture |
| **Item**      | 156714| Racing L 01 (boostable, DLC 67903) Chassis 2128→Wood 2077 on Celtic 5616 — non-mythic replace-input fixture |
| **Buff**      | 50891 / 108960 | Favillus base / boost productivity buffs |
| **Factory**   | 3070 | Roman Iron (Favillus/Smelters target) |
| **Factory**   | 31764| Celtic Herbs (Lorana target) |
| **Factory**   | 5616 | Celtic Chariots (Racing L 01 target; consumes Chassis 2128) |
| **Patron**    | 43594 | Ceres (Always available) |
| **DLC**       | 67902 | Prophecies of Ash (DLC01) |
| **DLC**       | 67903 | DLC2 (gates the Hippodrome effect 156267) |
| **DLC**       | 67904 | Dawn of the Delta (DLC03) |
| **Residence** | 3142 | Equites Residence (Latium, popLevel 1497) — horse need 174983 gated |
| **Residence** | 3145 | Patricians Residence (Latium) — also carries gated horse need 174983 |
| **Population**| 1497 | Equites Population Level |
| **Effect**    | 145095| Obsidian Gathering (Limestone) |
| **Effect**    | 148043| Obsidian Mining (Obsidian) |
| **Effect**    | 99014 | Epicure of Water (Radius, island-effect, not a patron effect - has a manual checkbox in population-level-config-dialog.html); buff 32385, buff.population = 1 |
| **Effect**    | 43600 | CeresPopulationEffect |
| **Effect**    | 166475| Sláinga Gaileanga (mythical-item, targets Aldermen 6472, adds need 174425) |
| **Effect**    | 159339| Amphitheatre Splendour IV (island-event, targets Liberti 3087, adds Bread need 2689) |
| **Effect**    | 140883| Bread Sentries (island-event, goodConsumptionUpgrade Bread +20%) |
| **Buff**      | 166476| Sláinga buff (additionalNeedsDemand [174425] -> Necklaces 2146) |
| **Buff**      | 159338| Amphitheatre Splendour IV buff (additionalNeedsDemand [2689] -> Bread 2137) |
| **Effect**    | 156267| Hippodrome "Privilege of the Public Horse" (island-event, DLC2 67903, targets Equites 3142 + Patricians 3145, adds horse need 174983) |
| **Buff**      | 156266| Hippodrome buff "Privilege of the Public Horse" (additionalNeedsDemand [174983] -> Horses 2075) |
| **Need**      | 2689 | Roman Food Bread (needProduct 2137) |
| **Need**      | 174425| Item Need Celtic Fashion Necklaces (needProduct 2146) |
| **Need**      | 174983| Roman Household Horses (needProduct 2075, rate 0.00515 on Equites 3142) |

## Formulas Reference
- **Productivity (Boost)**: `((100 + sum(baseProductivityUpgrades)) * (100 + sum(productivityUpgrades))) / 100` (Division at end to avoid rounding artifacts like 315.01%)
- **Factory Throughput**: `buildings.utilized * boost * 60 / cycleTime`
- **Residence Need**: `buildings.constructed * needConsumptionRate * consumptionFactor`
- **Residence Residents**: `buildings.constructed * need.residents` (summed for checked needs)
- **Extra Goods**: `requiredInputAmount * (scaling * defaultAmount / additionalOutputCycle)`

## Storage Architecture
- **Global Keys**: `calculatorSettings`, `sessionSettings`, `globalEffects` (JSON strings).
- **Island Storage**: Nested JSON under island name key (e.g., `"Latium"`).
- **SubStorage Pattern**: Data is stringified JSON nested inside stringified JSON. Use `ConfigLoader` to handle this complexity.

## Execution
- `npm run build` - **MANDATORY** before running tests to sync `src` and `dist`.
- `npm test` - Run all (non-interactive)
- `npm run test:computed` - Scoped run for logic tests.
- Set `CI=true` or `--reporter=list` to prevent HTML report from opening.

## Gotchas

- **Params files**: `js/params.js` (current, with DLCs) is loaded via a `<script>` tag in `index.html`, **not** bundled — the page sees the on-disk file directly. `js/params-base.js` is the pre-first-DLC base data; `js/params-ref.js` is a reference dump. To assert against base-game needs without loading them, parse `params-base.js` in a VM sandbox (`vm.runInNewContext(src, { window: {} })`) and read `window.params.needs` (see `tests/computed/base-needs-not-locked.spec.ts`).
- **Port 8080**: a stale dev server left listening on 8080 makes Playwright's `webServer` abort with "already used". Kill the PID from `netstat -ano | grep :8080` before re-running.
- **Effects dialog**: open via `page.evaluate(() => $('#effects-dialog').modal('show'))`, then wait for `#effects-dialog.show`. Text search filters rows by localized `name()`; the same display name can repeat (e.g. several "Amphitheatre Splendour IV" / "Sláinga Gaileanga" variants), so locate a specific row by a distinctive icon (`img[src*="icon_2d_extra_demand"]`) rather than by count.
- **Unlock a DLC in a test**: `view.dlcsGuidMap.get(dlcGuid).checked(true)` (or `view.dlcs.forEach(d => d.checked(true))`). A DLC-gated effect's `available()` is false until its DLC is checked, so `scaling(1)` alone yields no demand.
- **`page.evaluate` returning an observable write**: `() => obs(1)` returns the KO observable (chaining) → Playwright "Cannot serialize result: object reference chain is too long". Wrap in a block so it returns undefined: `() => { obs(1); }`.
- **Base-need-not-locked guard keys on per-residence ungated consumption**, not on need-GUID existence in `params-base.js` — a base-defined need can be a gated conditional need on some tier (cross-tier mixed case). Build `residenceGuid -> Set<ungated needGuid>` from `params-base.js` and assert those specific needs are not `hidden()`.
- **Product tile shows `ProductPresenter.totalProduction`** (= demand target), NOT `totalDemand`. To assert the tile after a demand change, read the presenter via `view.presenter.productByGuid.get(productGuid).totalProduction()` — the underlying `product.totalDemand()`/`totalCurrentProduction()` are the model truth (see `tests/computed/hippodrome-need-gating.spec.ts`).
- **Collapsible summary selector**: The ID parameter passed to a `<collapsible>` component (e.g. `product-config-consumption`) is assigned to the collapsible body `div.collapse` rather than the fieldset or legend. To query the summary text in the header of a collapsible, locate the legend element pointing to that target: `legend[data-target="#product-config-consumption"] .summary span.float-right span`.
- **DLC03 / Olive Oil Gating**: Verifies Egyptian Olive Press (152729) is hidden in the Olive Oil (2149) config dialog on all islands when DLC03 (67904) is disabled, but becomes visible when DLC03 is active. Requires `Region.available` to check session availability and `Consumer.available` to check region availability.

## Test files: conditional-need gating (mythical-item / monument / DLC gating)
- `tests/binding/olive-oil-dlc-gating.spec.ts` — DLC03-gated Egyptian Olive Press tab visibility in the Olive Oil product config dialog.
- `tests/computed/hippodrome-need-gating.spec.ts` — DLC-gated hippodrome horse need: demand on/off, tile-production reconvergence, `activateAllNeeds`/user-controlled `checked`.
- `tests/computed/mythical-item-needs.spec.ts`, `tests/computed/mythical-item-effect-display.spec.ts`, `tests/computed/mythical-item-consumption-modifier.spec.ts` — Sláinga (item) + Amphitheatre (monument) gating and buff wiring.
- `tests/computed/base-needs-not-locked.spec.ts` — base-game consumption never hidden at startup.
- `tests/binding/population-need-gating.spec.ts` — presenter hides gated needs until effect active.
