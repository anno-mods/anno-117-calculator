# TypeScript Development Notes for Anno Calculator

## Class Architecture and Interface Patterns

### IslandManager Settings Pattern

**Purpose**: Manages island creation settings (world.ts:254-273)

**Key Pattern**:
- Settings are Option instances with localization and persistence
- Initial values set by `isFirstRun` parameter (ViewMode dependent)
- Applied via Island methods (e.g., `island.activateAllNeeds(checked)`)
- Settings belong to IslandManager, NOT view.settings
- Template binding: `data-bind="checked: $root.islandManager.activateAllNeeds.checked"`

### Constructible Interface Pattern
- `Constructible` is an interface (not a class) that extends `NamedElement`
- Required properties: `buildings: BuildingsCalc`, `island: Island`, `addBuff(appliedBuff: AppliedBuff): void`
- **NEVER use `instanceof Constructible`** - interfaces cannot be checked with instanceof
- Use the `isConstructible(obj)` type guard function in `world.ts` instead
- Classes implementing Constructible: `ResidenceBuilding`, `Consumer` (and its subclasses: `Factory`, `Module`, `PublicConsumerBuilding`)

### Parameter Interface Integration
When creating classes that use configuration interfaces from `types.config.ts`:

1. **Always look up referenced objects**: Convert numeric IDs to actual object references using `_assetsMap.get()`
2. **Update property types**: Change from `number[]` to proper object arrays (e.g., `Buff[]`, `Effect[]`, `Product[]`)
3. **Add proper error handling**: Throw descriptive errors when referenced objects aren't found

Example pattern:
```typescript
// Instead of storing IDs
public buffs: number[];

// Store actual objects  
public buffs: Buff[];

// In constructor
this.buffs = config.buffs.map(buffId => {
    const buff = _assetsMap.get(buffId);
    if (!buff) {
        throw new Error(`Buff with GUID ${buffId} not found in assetsMap`);
    }
    return buff as Buff;
});
```

### Type Safety Improvements
- **Remove all `as any` type assertions** - they break type safety
- When properties exist but aren't typed, add them to the class definition rather than using type assertions
- Use proper type guards for interface checking instead of `instanceof` on interfaces
- For filtering that changes types, combine type guards with instanceof checks: 
  ```typescript
  .filter((f: any) => isConstructible(f) && f instanceof Consumer) as Consumer[]
  ```

### Missing Property Patterns  
When encountering "missing" properties that exist at runtime:
- Check if they're commented out in the class definition
- Add them as properly typed optional properties: `public property?: Type`
- Common example: `ResidenceBuilding` needs `upgradedBuildingGuid?: string` and `upgradedBuilding?: ResidenceBuilding`

## Module Integration Architecture
- **Module Creation**: Modules are created in Factory constructor when `config.additionalModule` exists
- **AppliedBuff Creation**: Modules call `applyBuffs()` from Factory.initDemands() - creates AppliedBuff instances with `useParentScaling=false`
- **Buff Scaling**: Module `checked` observable controls buff scaling (0 = inactive, 1 = active)
- **Persistence**: Module state persisted using `persistBool` pattern in Island constructor
- **Circular Imports**: AppliedBuff moved to separate `buffs.ts` file to resolve Factory ↔ Production circular dependency

### Critical Module Implementation Details
**Input Demand Calculation** (factories.ts:388):
- Modules MUST have `buildings.fullyUtilizeConstructed(true)` in constructor
- This enables throughput calculation via `throughputByExistingBuildings`
- Without this, modules produce no input demands even when checked

**Boost Application via Observable Array** (factories.ts:41, 104):
- `buffs` MUST be `KnockoutObservableArray<AppliedBuff>`, not plain array
- Declared as: `public buffs: KnockoutObservableArray<AppliedBuff>;`
- Initialized as: `this.buffs = ko.observableArray([]);`
- Without observable array, `boostSubscription` doesn't react to module buff changes
- All code accessing buffs must unwrap: `this.buffs()` not `this.buffs`

**Module Buff Application Flow**:
1. Factory.initDemands() calls `module.applyBuffs(assetsMap)` (factories.ts:633)
2. Module creates AppliedBuff with `useParentScaling=false` (factories.ts:400-406)
3. Module sets initial scaling: `appliedBuff.scaling(this.checked() ? 1 : 0)` (factories.ts:408)
4. AppliedBuff constructor calls `this.target.addBuff(this)` (buffs.ts:139)
5. Consumer.addBuff() pushes to observable array: `this.buffs.push(appliedBuff)` (factories.ts:335)
6. Observable array change triggers `boostSubscription` recalculation (factories.ts:177-202)
7. Module buffs are multiplicative, other buffs additive (factories.ts:184-190)

**AppliedBuff Property Names** (buffs.ts:14-27):
- AppliedBuff has `buff` property, NOT `effect`
- Correct: `appliedBuff.buff.guid`
- Wrong: `appliedBuff.effect.guid`

## Item Tri-State Boost (Off / Base / Boosted)
Factory items with a boosted variant (`ItemConfig.boostBuffs`, extracted for `ItemWithBoost` + legendary/mythic production items) use one tri-state control per `(item, factory)` slot: `0 = Off`, `1 = Base`, `2 = Boosted`. Data fact: every boostable item carries exactly **one** base buff and **one** boost buff, so base↔boost pairing is by target factory.

- **State lives in `Item.slotStates: Map<Constructible, ko.observable(number)>`** (production.ts) — one observable per factory in `this.factories`. This is the single writable source of truth; buff scalings are derived from it.
- **`AppliedBuff` scaling is externally supplied** via the `scalingOverride` constructor param (buffs.ts). Base equipment scaling = writable computed `{read: state()===1?1:0, write: v => state(v?1:0)}` — **writable is required** so legacy call sites/tests doing `equip.scaling(1)` (= equip at Base) still work. Boost equipment scaling = `pureComputed(state()===2?1:0)` and is flagged `isBoostBuff=true`.
- **Row list vs calc**: `Consumer.addBuff` pushes every item AppliedBuff to `buffs()` (so the boost math sums it) but only non-`isBoostBuff` ones to `items` (so `availableItems()` shows one row per slot). Boost math (factories.ts:~188) sums `buffs()` without checking `available()`, relying on scaling being 0 for inactive variants.
- **`Item.checked`** reads/writes `slotStates` (all slots >=1 → checked; write sets Off/Base only, never Boosted).
- **Active-variant display**: each base `AppliedBuff.activeBuff` is a computed returning the boost buff at state 2, else the base buff. Templates bind item-row buff fields via `activeBuff()`, not `buff`.
- **DLC invariant**: each slot state is registered with the item's DLC via `lockDLCIfSet(state)` in the Item constructor. Any slot at state >=1 makes `DLC.used()` true (disables the un-check UI); loading a slot to a non-zero state auto-checks the DLC (`used` → `checked(true)`), self-healing an inconsistent "state 2 + DLC off" save. So `state !== 0` implies the DLC is on — scaling computeds need no `available()` gate.
- **Persistence** (world.ts `initItems`): `persistInt({state: slotStates.get(f)}, "state", `${f.guid}[${i.guid}].scaling`)` — reuses the old equip `.scaling` key as raw int 0/1/2 (old float 0/1 saves load cleanly via `parseInt`). Boost equipments are derived, never persisted. Stored in the **per-island Storage JSON** (Island ctor's `localStorage` param is a `Storage` instance, not global `window.localStorage`), so the raw value in that JSON is a number, not a string.
- **UI**: `tri-state-toggle` component (components.ts) + `.tri`/`.tri-state-toggle` CSS (style.css). Replaces `icon-checkbox` wherever an equipped item's `scaling` was rendered.

### Object Lookup Best Practices
1. Always validate `_assetsMap.get(id)` results before using
2. Use descriptive error messages with GUID and context
3. Cast to appropriate types after validation: `buff as Buff`

## Syntax Fixes
Knockout computed: `read: () => { return value; }, write: (val: boolean) => { setValue(val); }`  
Avoid: `(() => {...})` or `((val as boolean) => {...})`

## Class Hierarchy
- **Consumer**: Base class (inputs only, final consumption)
- **Factory**: Extends Consumer (inputs + outputs, produces for other consumers)  
- **Module**: Extends Consumer (provides conditional buffs with multiplicative bonuses)
- **PublicConsumerBuilding**: Extends Consumer (services, no production)

## Productivity Bonus System

### Two-Stage Productivity Calculation
The productivity boost calculation uses a two-stage approach with `baseProductivityUpgrade` and `productivityUpgrade`:

**Stage 1 - Base Productivity (Additive)**:
- `baseProductivityUpgrade` values are summed and added to the base value of 100
- Applied from all sources: buffs (items/effects/modules) and aqueduct buffs
- Example: If two buffs have baseProductivityUpgrade of 10 and 15:
  - Base = 100 + 10 + 15 = 125

**Stage 2 - Percentage Multiplier (Additive, then Multiplicative)**:
- `productivityUpgrade` percentages are summed together
- The sum is applied as a multiplier: `(1 + sum / 100)`
- Multiplied with the base productivity from Stage 1
- Example: If buffs have productivityUpgrade of 20 and 10:
  - Multiplier = 1 + (20 + 10) / 100 = 1.3

**Final Formula**:
```typescript
const baseValue = 100 + sum(baseProductivityUpgrade);
const multiplier = 100 + sum(productivityUpgrade);
const totalBoost = (baseValue * multiplier) / 10000;
```

**Example Calculation**:
- baseProductivityUpgrade = 20, productivityUpgrade = 30
- baseValue = 100 + 20 = 120
- multiplier = 100 + 30 = 130
- totalBoost = (120 × 130) / 10000 = 1.56 (156% productivity)

### Implementation Pattern
See the implementation in `src/factories.ts:177-202` in the `Consumer.initDemands()` boostSubscription.

**Critical Detail**: Division is performed at the end (`/ 10000`) to avoid floating-point rounding issues that can cause display problems (e.g., showing 315.01% instead of 315%).

### Buff Property Architecture
**Buff Class** (production.ts:478, 516):
- `baseProductivityUpgrade: number` - Added to base 100 before multiplication
- `productivityUpgrade: number` - Percentage multiplier applied to base

**AppliedBuff Class** (buffs.ts:21, 84-90):
- `baseProductivityUpgrade: KnockoutObservable<number>` - Scales buff value by `scaling()`
- `productivityUpgrade: KnockoutObservable<number>` - Scales buff value by `scaling()`

**AqueductBuff Class** (production.ts:828, 854-860):
- Same observable pattern as AppliedBuff
- Both properties scaled by aqueduct `scaling()` value

### BuildingDemand Pattern
- **BuildingDemand**: Subclass of Demand that accepts `KnockoutObservable<number>` as factor
- **Dynamic Scaling**: `updateAmount()` method multiplies base amount by observable factor
- **Usage**: Used for fuel consumption demands where factor changes based on buff calculations
- **Factor Removal**: Base Demand class no longer has static factor property - moved to BuildingDemand observable

## Effects Persistence Architecture

### Three-Tier Effect Persistence System
**Global Effects** (main.ts:369-384):
- Storage key pattern: `global.effect.${effectGuid}.scaling`
- Persisted after creation during initialization
- Uses direct localStorage.getItem/setItem with observable subscriptions

**Session Effects** (world.ts:203-218):
- Storage key pattern: `session.${sessionGuid}.effect.${effectGuid}.scaling`
- Persisted in Session constructor after effect creation
- Uses TypeScript-safe localStorage existence checking

**Island Effects** (world.ts:786-789):
- Storage key pattern: `island.effect.${effectGuid}.scaling`
- Uses existing `persistFloat(effect, "scaling", ...)` helper pattern
- Integrated into Island constructor persistence flow

### Implementation Details
- **Effect Scaling**: All effects use `scaling: KnockoutObservable<number>` (0=inactive, 1=active)
- **Automatic Persistence**: Observable subscriptions save changes immediately to localStorage
- **Type Safety**: Proper null checking for localStorage.getItem() results
- **Backward Compatible**: No changes to existing Effect class interface
- **Consistent Pattern**: All three levels follow same observable subscription pattern

### Storage Key Structure
```
global.effect.${effectGuid}.scaling          // Global effects
session.${sessionGuid}.effect.${effectGuid}.scaling  // Session effects  
island.effect.${effectGuid}.scaling          // Island effects (via persistFloat)
```

### Core Architecture
- Factory/building persistence uses helper functions: persistBool, persistInt, persistFloat, persistString
- All persistence is scoped with localStorage keys: ${scope}.${obj.guid}.${attributeName}
- Global objects (regions, sessions, effects) now have persistence for their scaling states
- Island-level persistence happens in Island constructor using persistBuildings() flow

## Effect Source Types and Display

### Effect Source Property
**Purpose**: Identifies the origin/type of an effect for UI display

**Source Enum Values** (production.ts:655):
- `'module'` - Effect from factory modules
- `'tech'` - Effect from technology/discoveries
- `'festival'` - Effect from festival events
- `'veneration-effect'` - Effect from patron veneration
- `'session-event'` - Session-wide event effect
- `'island-event'` - Island-specific event effect

**Property Declaration**:
```typescript
public source?: string; // Optional, set from config
public effectDuration?: number; // Duration in seconds (for events)
```

### Source Text Localization (production.ts:699-737)

**getSourceText() Method**: Returns localized source name with optional duration
- Maps source enum to params.js translation keys (NOT i18n.ts)
- Accesses translations via `window.view.texts`
- Appends duration in brackets if `effectDuration > 0`: `"Festival (2h)"`
- Uses global `formatNumber()` function for duration formatting

**Source to Translation Key Mapping**:
```typescript
'module' → 'silo'
'tech' → 'discovery'
'festival' → 'festival'
'veneration-effect' → 'venerationEffects'
'session-event' → 'sessionEvent'
'island-event' → 'islandEvent'
```

**Important**: Always use params.js translations (accessed via `window.view.texts`), not i18n.ts translations, for game-related text.

### Effect Filtering by Session

**Location**: Island.availableEffects computed observable (world.ts:818-843)

**Filtering Logic**:
1. **Meta Session (All Islands)**: Shows all effects without filtering
   - Check: `this.isAllIslands()` returns true
   - No target validation needed

2. **Regular Islands**: Shows effects only if they meet one of:
   - `effect.targetsIsAllProduction === true` (global effects)
   - Effect has at least one target in the island's session/region

**Region Matching**:
```typescript
const hasTargetsInSession = e.targets.some(target => {
    return target.associatedRegions.some(region =>
        region.guid === this.island.session.region.guid
    );
});
```

**Key Behavior**:
- Session-specific effects (e.g., Latium-only) hidden on islands from other sessions
- All effects visible in "All Islands" view for comprehensive overview
- Uses Constructible interface: targets have `associatedRegions` property
- Patron effects always filtered out via `this.patronEffects.indexOf(e) != -1`

**Template Integration** (templates/effects-dialog.html:36):
- Duration column replaced with source display
- Binding: `data-bind="text: $data.getSourceText()"`
- Shows source type with duration in brackets when applicable

## Population-Level Need Management

### Architecture Transformation
**Before**: Individual residence-level need activation (ResidenceNeed.checked observable per building)
**After**: Population-level need activation (PopulationLevelNeed.checked observable shared across all residences)

### Key Classes Created/Modified
**PopulationLevelNeed** (consumption.ts:74-139):
- Centralized need management for entire population tier
- Properties: checked, notes, available, hidden observables
- Methods: name(), isInactive(), banned(), prepareResidenceEffectView()
- Each PopulationLevel has needsMap: Map<number, PopulationLevelNeed>

**PopulationLevel** (population.ts:233-355):
- Added needsMap and needs array for population-level need management
- Methods: getNeed(), isNeedActivated(), getVisibleNeeds()
- Needs initialized when first residence is added via addResidence()

**ResidenceNeed** (consumption.ts:145-261):
- checked and notes properties now computed observables delegating to PopulationLevel
- Maintains all calculation logic (amount, residents, demands)
- Preserved UI compatibility through delegation pattern

### Persistence Changes
**Storage Pattern**: Changed from `${residenceGuid}[${needGuid}].checked` to `${populationLevelGuid}[${needGuid}].checked`
**Location**: Island constructor persistence (world.ts:961-967) now iterates PopulationLevel.needs instead of ResidenceBuilding.needsMap

### UI Architecture
**ResidencePresenter** (views.ts:747-793):
- Added populationNeedCategories computed observable
- Creates need categories from population-level needs with aggregated totalResidents() and totalAmount()
- Preserves methods by adding properties directly to PopulationLevelNeed objects (avoids object spread)

**Template Structure** (templates/population-level-config-dialog.html):
- Population summary section with total residents across all residences
- Residence buildings table showing individual buildings with controls
- Population-level needs section with single checkbox per need type
- Proper binding context: $root.texts for localization, $data.need.product for asset icons

### Critical Implementation Patterns
**Object Method Preservation**: NEVER use object spread (`...obj`) with Knockout objects as it loses method references
**Template Binding Context**: Use $root.texts for localization, formatNumber/formatPercentage as global functions
**Delegation Pattern**: ResidenceNeed observables delegate to PopulationLevel for single source of truth
**Dynamic Property Addition**: Add computed properties directly to existing objects to preserve methods

## Need Categorization Architecture 

### Storage Architecture

**SubStorage Pattern** (world.ts:34-152):
- `calculatorSettings` - Settings JSON (e.g., `settings.showAllProducts`)
- `sessionSettings` - Session config
- `globalEffects` - Global effect scaling
- Per-island: `new Storage(islandName)` - Island-specific JSON

**Numeric Type Preservation**:
- `persistInt` and `persistFloat` helper functions MUST save raw numeric values to `localStorage` (not `.toString()`).
- This ensures `JSON.stringify` in `Storage.save()` preserves numbers as numeric types in the final JSON, preventing "1" vs 1 type mismatch in tests.

### RangeEffect and Residence Buffs

**RangeEffect Class** (src/views.ts):
- Encapsulates population buff logic: `appliedBuff`, `isPatronEffect`.
- Reactive properties: `checked`, `available`, `visible`, `totalPopulation`.
- `totalPopulation()`: Calculated as `buildings.constructed() * appliedBuff.populationBonus()`.

**Patron Effects and Initialization**:
- **Effect Class**: Added `targetsIsAllResidences: boolean` (e.g. for Ceres).
- **Initialization**: `Island` constructor (world.ts) performs a second `applyBuffsToResidences` pass for BOTH `allEffects` and `patronEffects`.
- **Reactivity**: `availablePatronEffects` computed in `Island` MUST have a subscription to stay active even if not bound to UI, ensuring effect scaling updates correctly.

### Category Identification Issue
**Problem**: Need categories use `id` as unique identifier, NOT `guid`
**Root Cause**: `NeedCategory` extends `NamedElement` which has optional `guid?: number`, but categories are identified by their `id: string` property
**Critical Fix**: Always use `category.id` for Map keys when grouping needs by category


### Two-Way Observable Delegation Pattern
**Problem**: Population-level need changes not reflected in residence-level consumption
**Solution**: ResidenceNeed.checked must be writable computed observable with delegation

```typescript
// WRONG - read-only delegation breaks consumption
this.checked = ko.pureComputed(() => {
    const populationLevelNeed = this.residence.populationLevel.getNeed(this.need.guid);
    return populationLevelNeed ? populationLevelNeed.checked() : false;
});

// CORRECT - two-way binding enables proper consumption
this.checked = ko.pureComputed({
    read: () => {
        const populationLevelNeed = this.residence.populationLevel.getNeed(this.need.guid);
        return populationLevelNeed ? populationLevelNeed.checked() : true;
    },
    write: (value: boolean) => {
        const populationLevelNeed = this.residence.populationLevel.getNeed(this.need.guid);
        if (populationLevelNeed) {
            populationLevelNeed.checked(value);
        }
    }
});
```

### Key Implementation Details
- **Category Mapping**: Use `category.id` string identifiers, not `category.guid` numbers
- **Delegation Direction**: PopulationLevelNeed is the source of truth, ResidenceNeed delegates to it
- **Default Values**: When population-level need doesn't exist, default to `true` (activated) to maintain backward compatibility
- **Consumption Flow**: ResidenceNeed.amount() calculations depend on ResidenceNeed.checked() delegation working properly

### Object Method Preservation Pattern
**Critical Implementation Detail**: User's fix preserves Knockout observable methods by avoiding object spread

**Problem**: Object spread (`...obj`) loses method references from Knockout observables
**Solution**: Direct property addition to existing objects
```typescript
// WRONG - loses Knockout methods
const extended = { ...populationLevelNeed, totalResidents, totalAmount };

// CORRECT - preserves methods by direct assignment
populationLevelNeed.totalResidents = totalResidents;
populationLevelNeed.totalAmount = totalAmount;
populationLevelNeed.prepareResidenceEffectView = prepareResidenceEffectView;
```

### Template Integration Improvements
**UI Binding Context**: Fixed template binding to work with presenter pattern
- Proper use of `$root.texts` for localization
- Global function calls: `formatNumber()`, `formatPercentage()` without $root prefix
- Correct data context navigation: `$data.need.product` for asset properties

## Knockout Debug System

**Debug Utilities** (src/util.ts:542-772):
- `window.debugKO.inspect(selector)`, `.type(obj)`, `.log(obj, label)`, `.context(element)`
- Template wrapper detection, safe observable unwrapping, asset type identification

**Debug Binding** (src/components.ts:75-134):
- Template usage: `<div data-bind="debug: 'Label'">`
- Logs `[DebugKO]` with asset type, GUID, name, binding context
- Requires `window.view.debug.enabled()` for init, `verboseMode()` for updates

**Persistence** (src/main.ts:79-110):
- localStorage restore on init: `debug.enabled`, `verboseMode`, `logBindings`
- Two-way sync via observable subscriptions
- Enable: `localStorage.setItem('debug.enabled', 'true')` OR `window.view.debug.enabled(true)`

## Internationalization (i18n.ts)

**Required Languages** (12 total): english, french, polish, spanish, italian, german, brazilian, russian, simplified_chinese, traditional_chinese, japanese, korean

**CRITICAL**: Use `simplified_chinese` and `traditional_chinese`, NEVER `chinese`

**Workflow**:
- Add key with English: `newKey: { english: "text" }`
- Complete: `/translate newKey` OR `npm run check-translations`
- Verify: `npm run check-translations`
- Template: `<span data-bind="text: $root.texts.newKey"></span>`

**Excluded**: `helpContent` (managed separately, doesn't require all 12 languages)

**Common Errors**: Using `chinese` instead of `simplified_chinese`/`traditional_chinese`, missing languages, special character escaping

## Presenter Pattern Architecture

### CategoryPresenter Implementation

**Purpose**: Wraps ProductCategory and creates ProductPresenter instances for all products in the category

**Key Architectural Decision**: CategoryPresenter creates its own ProductPresenter instances rather than filtering from island.productPresenters
- **Reason**: Ensures each product has exactly one presenter per category, avoiding duplication
- **Pattern**: Similar to ResidencePresenter creating need presenters

**Critical Properties**:
```typescript
export class CategoryPresenter {
    public instance: KnockoutObservable<ProductCategory>;  // Resolves from island.assetsMap
    public category: ProductCategory;                       // Original category reference
    public island: KnockoutObservable<Island>;             // MUST be observable for reactivity
    public productPresenters: ProductPresenter[];           // Created in constructor, not computed
}
```

**Initialization Pattern** (main.ts:494-505):
```typescript
// For each category in allIslands.categories
const categoryPresenter = new CategoryPresenter(category, window.view.island);
presenter.categories.push(categoryPresenter);

// Build presenter lookup map
for (const productPresenter of categoryPresenter.productPresenters) {
    presenter.productByGuid.set(productPresenter.guid, productPresenter);
}
```

**Key Differences from ProductPresenter**:
- `productPresenters` is a plain array (not computed) - created once in constructor
- `instance` computed resolves category from island.assetsMap on island changes
- No filtering logic - creates presenters for ALL products in category.products

### ProductPresenter Architecture

**Critical Observable Pattern**:
```typescript
export class ProductPresenter {
    public product: Product;                              // Direct reference (NOT observable)
    public island: KnockoutObservable<Island>;           // MUST be observable
    public instance: KnockoutComputed<Product>;          // Resolves from island().assetsMap
    public factoryPresenters: FactoryPresenter[];        // Created once, not observable array
}
```

**Why instance is Computed**:
- Allows product data to update when user switches islands
- Resolves current island's version: `this.island().assetsMap.get(this.product.guid)`
- All delegated properties use `this.instance()` to get current data

**Factory Presenter Creation**:
- Created once in constructor from `product.factories`
- Each FactoryPresenter gets reference to parent ProductPresenter
- Not an observable array - static list per product

### FactoryPresenter Nested Pattern

**Parent Reference for Observable Island**:
```typescript
export class FactoryPresenter {
    public parentProduct: ProductPresenter;
    public island: KnockoutObservable<Island>;  // Inherited from parent

    constructor(factory: Factory, parent: ProductPresenter) {
        this.parentProduct = parent;
        this.island = parent.island;  // Share parent's observable island
        this.instance = ko.computed(() =>
            this.island().assetsMap.get(this.factory.guid)
        );
    }
}
```

**Critical Pattern**: Never create new observable - reuse parent's observable island
- Ensures all nested presenters react to same island changes
- Avoids subscription proliferation
- Maintains single source of truth

### Common Presenter Anti-Patterns

**❌ WRONG - Creating circular dependency**:
```typescript
this.product = ko.pureComputed(() => this.instance());
this.instance = ko.computed(() => this.island().assetsMap.get(this.product.guid));
// ERROR: product depends on instance, instance depends on product.guid
```

**✅ CORRECT - Direct reference + computed resolution**:
```typescript
this.product = product;  // Direct reference to original product
this.instance = ko.pureComputed(() => this.island().assetsMap.get(this.product.guid));
```

**❌ WRONG - Creating new observable for nested presenter**:
```typescript
this.island = ko.observable(parent.island());  // Creates duplicate observable
```

**✅ CORRECT - Share parent's observable**:
```typescript
this.island = parent.island;  // Reuse parent's observable reference
```

### Presenter Integration with Templates (REMOVED)

**Old Pattern (Removed)**: Templates with added computed properties
```typescript
// This pattern was replaced
categoryTemplate.productPresenters = ko.pureComputed(() => {
    // Filter island.productPresenters by category
});
```

**New Pattern (Implemented)**: Dedicated presenter hierarchy
```typescript
// CategoryPresenter creates its own ProductPresenters
window.view.presenter.categories = [];  // Array of CategoryPresenter
window.view.presenter.productByGuid = new Map();  // Quick lookup

// Templates removed - use presenters directly in bindings
```

**Benefits of Presenter-Only Approach**:
- Clear separation: Templates for display, Presenters for data/logic
- No mixing of Template pattern with Presenter pattern
- Single source of ProductPresenter instances (via CategoryPresenter)
- Faster lookups via productByGuid Map

### Observable vs Direct Reference Guidelines

**Use Observable When**:
- Value changes during application lifetime (e.g., selected island)
- Multiple components need to react to changes
- Value needs to persist across UI updates

**Use Direct Reference When**:
- Value is immutable after creation (e.g., original Product/Category reference)
- Only needed for identification (e.g., guid lookup)
- Used to resolve current data from observable source

**Computed Observable Pattern**:
- Delegate to observable source: `ko.pureComputed(() => this.island().assetsMap.get(guid))`
- Provides reactive access to current data
- Updates automatically when observable source changes

### Product-Based Presenter Pattern (PLANNED)

**ProductPresenter** - Wraps Product with UI-specific observables:
- `factoryPresenters: FactoryPresenter[]` - Nested presenters for factories
- `availableSuppliers: KnockoutComputed<SupplierOption[]>` - All supplier options for dropdown
- `totalProduction`, `totalDemand`, `netBalance` - Aggregate calculations

**UI Templates**:
- `product-tile.html` - Single tile per product showing aggregate production/demand
- `product-config-dialog.html` - Tabbed dialog (Factories | Extra Goods | Trade Routes | Production Chain)
- `factory-config-section.html` - Individual factory configuration within product dialog

**Critical Patterns**:
- Object method preservation: Add properties directly, never use spread operator
- Supplier dropdown: Integrates factories, islands (for trade routes), extra goods, passive trade
- Trade route auto-creation: Selecting island creates TradeRoute with minAmount=0
- Init order: Create presenters after initDemands/applyBuffs, before persistBuildings

## Supplier Interface Architecture (PLANNED)

**Problem**: Demands tightly coupled to Factory suppliers. No unified way to handle trade routes, passive trade, or extra goods as alternative sources.

**Supplier Interface**:
```typescript
interface Supplier {
    type: 'factory' | 'trade_route' | 'passive_trade' | 'extra_good';
    currentProduction(): number;
    setDemand(amount: number): void;
}
```

**Implementations**:
- **FactorySupplier**: Wraps Factory, generates recursive input demands
- **TradeRouteSupplier**: Auto-creates trade routes with `userSetAmount` floor constraint
- **PassiveTradeSupplier**: Manual input, no demand propagation ("joker" supplier)
- **ExtraGoodSupplier**: Wraps items producing extra goods

**Product Changes**:
- Add `defaultSupplier: KnockoutObservable<Supplier>` (user-selected per island)
- Add `availableSuppliers: KnockoutComputed<Supplier[]>` (all options)
- Deprecate `fixedFactory` property

**Demand Simplification**:
- Remove `Demand.factory` property
- Demand resolution at Product level via `defaultSupplier.setDemand()`

**Init Order**:
1. Create objects (factories, products, consumers, suppliers)
2. `f.initDemands()` - Factories register in products
3. `p.initSuppliers()` - Create supplier instances
4. `e.applyBuffs()` - Effects apply buffs
5. `p.restoreDefaultSupplier()` - Load supplier selection
6. `persistBuildings()` - Load factory state

**Trade Route Changes**:
- Add `userSetAmount` observable - user-set minimum
- Auto-cleanup: Delete routes where `userSetAmount == 0 && !manuallySet`
- Storage: `island.product.${productGuid}.supplier.type|.id`

**TradeList modifications** (trade.ts:180-331):
- `userSetAmount: KnockoutObservable<number>` - user-set minimum
- `manuallySet: KnockoutObservable<boolean>` - distinguishes user vs auto-created routes
- `routes` includes `userSetAmount` property per route
- Auto-cleanup: Remove routes where `userSetAmount == 0 && !manuallySet`

**Patterns**: Strategy (Supplier interface), Presenter (UI separation), Delegation (Demand→Product→Supplier)

**Pitfalls**: Circular dependencies (use separate suppliers.ts file), Observable method preservation (never use spread operator), Init order (suppliers after factories register, selection before demands)

## Mythical-item / Monument Effect Display

### Effect targets for residences
- `Effect.targets` is populated during the **first** `applyBuffs` pass, which runs **before** residences exist (world.ts init order). Effects whose targets are only residence GUIDs therefore keep an empty `targets` and never appear in `Island.availableEffects()`.
- Fix: `Effect.applyBuffsToResidences` (production.ts) also appends resolved residence targets to `this.targets` (deduped; skips the `targetsIsAllResidences` case to avoid flooding). This makes the effect surface in `availableEffects()` and renders target icons.

### getRegionExtendedName is part of Constructible
- The effects-dialog target-icon binding calls `$data.getRegionExtendedName()` for **every** target. `Constructible` (world.ts) declares `getRegionExtendedName(): string`; both `Consumer` and `ResidenceBuilding` implement it. A missing implementation throws inside the `foreach` and **halts the whole effects table** (only rows before the offending one render) — a silent, easy-to-miss failure mode.

### Buff display fields (buff-display iterates raw `Buff`, not `AppliedBuff`)
- `Buff.additionalNeeds: Product[]` is resolved in the constructor from `config.additionalNeedsDemand` (Need GUIDs → `Need.product`); the raw GUID list is not stored (no other consumer). Duck-type the lookup (`asset instanceof Product` or `asset.product instanceof Product`) — do not import `Need` (production↔consumption cycle).
- Consumption reduction has two independent shapes: flat `consumptionModifierInPercent` (all needs, shown with the marketplace icon) and per-good `goodConsumptionUpgrade: {product, amountInPercent}[]` (shown with each product icon).

### Additional-need gating semantic (data-owner decision, 2026-07-13; calculator follow-up shipped 2026-07-18)
- A need referenced by an effect's `additionalNeedsDemand` is **conditional**: consumed only while the effect is active, gated via the residence `needsList` entry's `requiresItem`. It is **not** a base need.
- `params.js` now emits these as a **single gated** `needsList` entry (real rate + `requiresItem`, no ungated sibling). The old "ungated wins" workaround in `PopulationLevelNeed.hidden` was removed.
- **Gating is enforced in three places, all keyed off `ResidenceNeed.requiresItem`:**
  1. `ResidenceNeed.amount()` / `.residents()` return 0 while the gating effect is inactive (`gatingEffectInactive`, consumption.ts) — this is what makes the *demand* 0 until the effect is on.
  2. `PopulationLevelNeed.hidden` hides the need in need lists (`getVisibleNeeds`). It reads the same `ResidenceNeed.gatingEffect` observable (not a fresh `assetsMap` lookup).
  3. `PopulationLevelNeedPresenter.visible` (views.ts) — the UI presenter path — must AND in `!hidden()`, not just `available()`, or gated needs render anyway.
- **Init-order trap:** the gating effect is resolved into the observable `ResidenceNeed.gatingEffect` during `initDemands` (local `assetsMap` is populated by then). It is NOT looked up inside the `amount()`/`residents()`/`hidden` computeds, because those can be evaluated eagerly during island construction — before `island.assetsMap` exists (would throw) and before the effect ref could bind reactively.
- **`checked` is user-controlled — never write it from gating.** `(un)gating` toggles freely and reversibly, so subscribing `hidden` → `checked` resets the user's choice on every effect toggle (flakiness) and, because `hidden` can wake during construction, also crashes. A need's initial `checked` comes from saved storage, else the DLC `available` path / `IslandManager.activateAllNeeds` bulk apply (world.ts `Island.activateAllNeeds`, `persistNeedChecked`). After that only the user changes it. A gated need therefore stays 0-demand until the user opts in, independent of the effect.
- **Cross-tier mixed case is real:** the same need GUID can be genuine ungated base consumption for one tier and a gated conditional need for another (e.g. Bread 2689: ungated for Plebeians/Equites, monument-gated for Liberti). Guards keyed on "need GUID is base-defined" are wrong; key on per-residence ungated consumption (see `tests/computed/base-needs-not-locked.spec.ts`).
- Extractor fix spec: `C:\dev\asset-extractor\docs\plans\2026-07-13-fix-additional-need-should-gate-not-be-base.md`; calculator follow-up: `docs/superpowers/plans/2026-07-18-handoff-gated-needs-calculator-followup.md`.

## Product demand/production reactivity (production.ts, presenters.ts)

- The product tile binds to `ProductPresenter.totalProduction` = `product.totalDemand() + product.excessProduction()` (= `max(demand, currentProduction)`; shows the demand target even when under-producing).
- `Product.excessProduction` is a **`pureComputed`**: `max(0, totalCurrentProduction() - totalDemand())`. Do NOT turn it back into an observable written inside `demandCalculationSubscription`: that `ko.computed` reads `totalCurrentProduction` to set supplier demands, and (per its own note, production.ts) can read a **stale** production value and not re-run afterwards — which left `excessProduction`/the tile stuck at the pre-toggle value when demand dropped to 0 (e.g. toggling a gated need's effect back off: model demand → 0 but tile stayed at ~0.5). A pureComputed tracks both inputs and always reconverges.
- General rule: a `ko.computed` that both **reads** production/demand observables and **writes** observables feeding back into them is glitch-prone. Prefer a `pureComputed` for any derived display value; keep the side-effecting subscription (`setDemand`) minimal.

## Aggregate mode (`src/aggregate.ts`)

Single home for the All-Islands aggregation contract. Imported by `presenters.ts`,
`public-building-presenters.ts`, `population-presenters.ts`, `views.ts`, `components.ts` and
`main.ts`. It uses structural parameter types (`{ isAllIslands(): boolean }`) so it never imports
`world.ts`, which would be a cycle risk through `util.ts`.

- **Every helper here is a plain function, never a `ko.pureComputed`.** `isAggregateModeFor(island)`,
  `isAggregating()`, `sumAcrossRealIslands(selector)`, `compareAggregateDemands(...)`. A shared
  memoized computed is a single node that notifies every binding at once, which produced a real
  stale-`$data` glitch inside `with:` blocks (see `templates/AGENTS.md`). Called as a function, the
  dependencies register in the *calling* binding's own computed, which is semantically identical to
  writing the expression inline at each site.
- **`AggregateBuildingsCalc` guarantees three things** the two hand-rolled synthetic objects it
  replaced did not: `readOnly === true` so UI components can render a display instead of an editable
  control with no template-level condition; setters are explicit, logged no-ops instead of silent
  writes to a throwaway object discarded on the next recompute (which is what made
  `incConstructedBuildings()` lose edits with no signal); and `utilized` is the sum of each island's
  own `utilized()`, not a value re-derived from a summed `required` under one global
  `fullyUtilizeConstructed` flag - that flag is a per-island choice.
- A fresh instance is allocated on every recompute of the owning `pureComputed`. Only that
  computed's bound VALUE changes, never the presenter arrays templates iterate, so it cannot trigger
  a tile-grid rebuild.
- **Feed `AggregateBuildingsCalc` from `sumBuildingsAcrossRealIslands(guid)`, not from one
  `sumAcrossRealIslands` closure per metric.** `constructed`, `required` and `utilized` are read
  together on nearly every visible row (`capacityUtilisation` alone reads two), so per-metric
  closures walked `view.islands()` and repeated the `assetsMap` lookup three or four times per
  recompute. The helper does one walk behind a shared `pureComputed`. It is the only exception to
  the plain-function rule above and a safe one: the computed is private to a single owner's
  metrics, never shared across bindings. Build it once per owner (the guid never changes) so the
  memo survives recomputes; it is lazy, so it costs nothing outside aggregate mode. It returns all
  four metrics - hand `AggregateBuildingsCalc` only the ones that row actually displays and let it
  default the rest (residence rows omit `planned` deliberately).
- **`FactoryPresenter.buildings()` returns the right object in both modes**, so template code must
  never reach through to `.instance().buildings`. Same for `ResidenceRow.buildings()`. One
  deliberate exception: inside `product-tile.html`'s `with: factoryPresenterIfDefaultSupplier()`
  block, whose aggregate branch returns a synthetic stand-in that intentionally exposes
  `instance().buildings` and no `buildings()` at all - do not "fix" that call site. Anything
  handed to a component as a param must be a KO observable/computed, not a plain function -
  components resolve params with `ko.unwrap`, which returns a plain function untouched instead of
  calling it.
- `window.view.isAggregating` and `window.view.compareAggregateDemands` are exposed in `main.ts` for
  template bindings and tests that have no presenter in scope. `window.ko` is exposed there too, so
  binding tests can assert which binding handlers are registered.

### Which properties are aggregate-branched

`src/presenters.ts`: `FactoryPresenter.buildings`/`.boost`/`.outputAmount`/`.workforceAmount`/
`.isDefaultSupplier`/`.representativeInstance`/`.editable`, and `ProductPresenter.totalDemandNoRoutes`/
`.totalProduction`/`.extraGoodProduction`/`.factoryPresenterIfDefaultSupplier`/`.isHighlightedAsMissing`/
`.availableExtraGoodSuppliers`/`.consumerViewVisible`/`.showTradeRouteTab`/`.editable`.
`src/views.ts`: `ResidencePresenter.residents`/`.buildings`/`.residenceRows`/`.editable`/`.open` plus the
nested need presenters. `src/public-building-presenters.ts` and `src/population-presenters.ts` carry their
own branches. `src/components.ts`'s `consumer-view` aggregates and orders the demand list.

### Per-property contracts worth knowing before you touch one

- `FactoryPresenter.buildings()` (presenter-level computed) is aggregate-branched;
  `FactoryPresenter.instance().buildings` (the raw per-island `Factory`'s own property) is NOT.
- `FactoryPresenter.workforceAmount` sums `factory.workforceDemand.amount()` for that one factory type
  across real islands. `factory-config-section.html`'s "Required Workforce" row binds to it
  (`$parent.workforceAmount()`), not `$data.instance().workforceDemand.amount()`, which only ever
  reflected the pseudo-island's always-empty demand.
- `ProductPresenter.showTradeRouteTab()` must stay the exact complement of "some visible factory reports
  `isDefaultSupplier()`", or `product-config-dialog.html` gives two panes `show active` at once and they
  render stacked. At bootstrap the pseudo-island happens to resolve a factory supplier for every product,
  so a divergence only appears once it carries a non-factory supplier of its own (e.g. passive trade
  chosen with aggregation off, then switched on).
- `FactoryPresenter.representativeInstance` backs the production chain while aggregating: the real island
  with the highest `currentProduction()`. A summed chain is not well-defined, because islands can pick
  different suppliers for the same input. The chain's t/min come from the aggregate `outputAmount` while
  its per-node building counts divide by that one island's boost, so those counts are not aggregate-
  consistent when islands differ in productivity - a known, deliberate trade-off.
- `ResidencePresenter.open(populationLevel)` is the only supported way to open the population dialog: it
  chooses `update()` vs `updateAggregate()` itself, so no call site can silently drop out of aggregate
  mode into an editable single-island view. `ResidencePresenter.residenceRows` (not
  `instance().allResidences()`) backs the dialog's residence table so every cell aggregates consistently
  with the header. `ResidencePresenter.editable()` reflects the presenter's OWN mode, not the global
  condition - the dialog can be open on an aggregate row while a real island is selected - so its
  template sites must use `if:`/`ifnot:` on `editable()`, never `ifEditable`/`ifAggregated`.
- `ProductPresenter.isHighlightedAsMissing` sums `required`/`constructed` via the same building counts as
  `factoryPresenterIfDefaultSupplier()`, gated on `settings.missingBuildingsHighlight`. It used to read
  the pseudo-island's own Product, which never has real demand, so the tile could never turn red.
- `ProductPresenter.availableExtraGoodSuppliers` groups suppliers by factory GUID across real islands,
  includes a factory type if it `canSupply()` on at least one, and sums `currentProduction()` per type.
  Some buffs (e.g. "Arboreal Rhizome") apply the same buff to several sibling factory types; only the
  entry where `factory.product === the extra good` is self-effecting (folds into that factory's own
  `outputAmount`, no tab row). Covered by `tests/computed/all-islands-aggregation-extra-goods.spec.ts`.
- **Null parity.** Any aggregate branch that conditionally returns `null` vs a synthetic object must
  return `null` for a product/factory with zero visible instances, exactly matching the non-aggregate
  branch - a non-null placeholder for an otherwise-absent row breaks `with:` templates (see
  `templates/AGENTS.md` for the layout bug this caused). `factoryPresenterIfDefaultSupplier()` also
  returns `null` when no real island's `defaultSupplier().type === 'factory'`, **except** with zero real
  islands, where it still returns the synthetic all-zero object (a deliberately different bootstrap-edge
  contract, covered by `tests/computed/all-islands-aggregation-products.spec.ts`).

### Known gaps

- `ResidencePresenter.populationBuffs` sources its buff *catalog* from one representative real island, so
  a buff active only on a non-representative island does not appear at all; only the summed magnitude of
  buffs that do appear is fully aggregate-derived.
- `PublicServicePresenter`/`PublicRecipeBuildingPresenter` still return a plain writable `BuildingsCalc`
  (`readOnly === false`) while aggregating, so they must not be pointed at `constructed-buildings-input`.
  Inert today: those call sites are gated with `ifEditable`/`ifAggregated`, and the public-buildings
  pipeline is commented out in `world.ts`.
- No persistent "aggregation active" UI indicator exists; the navbar badge originally added for it was
  removed per user feedback - the tile grid's own read-only gating was judged sufficient.

## Population Presenters (population-presenters.ts)
`PopulationGroupPresenter`/`PopulationLevelPresenter` mirror `CategoryPresenter`/`ProductPresenter`'s shape (built once at bootstrap from the All-Islands reference island's catalog, share the single `window.view.island` observable, resolve the current island's own instance via `island().assetsMap.get(guid)`) and replace the generic `Template` class for the `populationGroups` tile surface only - `Template` is unchanged for `consumers`/`publicServices`/`publicRecipeBuildings`. `sumAcrossRealIslands(selector)` (exported from this file) sums a selector across `view.islands()` minus the All-Islands pseudo-island; reused by `src/views.ts`'s `ResidencePresenter` aggregate branches via import.