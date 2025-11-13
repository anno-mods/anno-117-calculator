# TypeScript Development Notes for Anno Calculator

## Class Architecture and Interface Patterns

### IslandManager Settings Pattern (IMPLEMENTED)

**Purpose**: IslandManager manages island creation settings that control default behavior for new islands

**Key Pattern**: Settings follow Option class pattern with localization and persistence
- Each setting is an `Option` instance with `name`, `guid`, and `locaText`
- Initial values can be set based on `isFirstRun` parameter (start mode vs other modes)
- Settings are automatically persisted via Option class localStorage integration

**Example Implementation** (world.ts:254-273):
```typescript
export class IslandManager {
    public showIslandOnCreation: Option;
    public activateAllNeeds: Option;

    constructor(params: ParamsConfig, isFirstRun: boolean) {
        // Create Option instances
        this.showIslandOnCreation = new (require('./util').Option)({
            name: "Show Island on Creation",
            guid: "showIslandOnCreation",
            locaText: texts.showIslandOnCreation
        });
        this.showIslandOnCreation.checked(true);

        this.activateAllNeeds = new (require('./util').Option)({
            name: "Activate all needs",
            guid: "activateAllNeeds",
            locaText: texts.activateAllNeeds
        });
        // Set based on mode: false for start (first run), true otherwise
        this.activateAllNeeds.checked(!isFirstRun);
    }
}
```

**Using Settings in Island Creation** (world.ts:355):
```typescript
var island = new Island(this.params, new Storage(name), true, session);
island.activateAllNeeds(this.activateAllNeeds.checked());
```

**Island Method Pattern** (world.ts:1143-1151):
```typescript
activateAllNeeds(activate: boolean): void {
    // Apply setting to all population levels
    for (let populationLevel of this.populationLevels) {
        for (let need of populationLevel.needs) {
            need.checked(activate);
        }
    }
}
```

**Template Binding** (island-management-dialog.html:45-48):
```html
<div class="custom-control custom-checkbox mb-3">
    <input id="checkbox-activate-all-needs" type="checkbox"
           class="custom-control-input"
           data-bind="checked: $root.islandManager.activateAllNeeds.checked">
    <label class="custom-control-label"
           for="checkbox-activate-all-needs"
           data-bind="text: $root.islandManager.activateAllNeeds.name"></label>
</div>
```

**Key Principles**:
- Settings belong to IslandManager, NOT view.settings
- Settings control new island initialization behavior
- Island methods apply settings to their internal state
- Option class handles persistence automatically
- Initial values can vary by ViewMode (start/plan/master)

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

## Module Integration Architecture (IMPLEMENTED)
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

### Object Lookup Best Practices
1. Always validate the result of `_assetsMap.get(id)` before using
2. Use descriptive error messages that include the GUID and context
3. Cast to appropriate types after validation: `buff as Buff`
4. Handle optional references properly with conditional checks

## Code Documentation Standards

### Class Attribute Grouping
When documenting class properties, group them logically with section headers:

```typescript
export class Consumer extends NamedElement {
    // === BASIC PROPERTIES ===
    public guid: number;
    public isFactory: boolean;
    
    // === PRODUCTION CONFIGURATION ===  
    public defaultInputs: Map<Product, number>;
    public cycleTime: number;
    
    // === BUFF SYSTEM ===
    public items: AppliedBuff[];           // Applied item effects
    public buffs: AppliedBuff[];           // All applied effects
    
    // === INPUT DEMAND SYSTEM ===
    public inputDemandsMap: Map<Product, Demand>;
    public inputDemands: KnockoutObservableArray<Demand>;
    
    // === REACTIVE SUBSCRIPTIONS ===
    public boostSubscription!: KnockoutComputed<void>;
}
```


## Syntax Fixes
Knockout computed: `read: () => { return value; }, write: (val: boolean) => { setValue(val); }`  
Avoid: `(() => {...})` or `((val as boolean) => {...})`

## Class Hierarchy
- **Consumer**: Base class (inputs only, final consumption)
- **Factory**: Extends Consumer (inputs + outputs, produces for other consumers)  
- **Module**: Extends Consumer (provides conditional buffs with multiplicative bonuses)
- **PublicConsumerBuilding**: Extends Consumer (services, no production)

## Productivity Bonus System

### Multiplicative vs Additive Calculation
The productivity boost calculation uses a mixed approach:
- **Module buffs**: Multiplicative - each module buff multiplies the existing productivity
- **All other buffs**: Additive - items, effects, and aqueduct buffs add together

### Implementation Pattern
See the implementation in `src/factories.ts:179-203` in the `Consumer.initDemands()` method and the helper method `isModuleBuff()` at `src/factories.ts:354-356`.

This approach prevents modules from having diminishing returns when stacked with other productivity bonuses.

### BuildingDemand Pattern
- **BuildingDemand**: Subclass of Demand that accepts `KnockoutObservable<number>` as factor
- **Dynamic Scaling**: `updateAmount()` method multiplies base amount by observable factor
- **Usage**: Used for fuel consumption demands where factor changes based on buff calculations
- **Factor Removal**: Base Demand class no longer has static factor property - moved to BuildingDemand observable

## Effects Persistence Architecture (IMPLEMENTED)

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

## Population-Level Need Management (IMPLEMENTED)

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

### UI Architecture (IMPLEMENTED)
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

## Need Categorization Architecture (IMPLEMENTED)

### Category Identification Issue
**Problem**: Need categories use `id` as unique identifier, NOT `guid`
**Root Cause**: `NeedCategory` extends `NamedElement` which has optional `guid?: number`, but categories are identified by their `id: string` property
**Critical Fix**: Always use `category.id` for Map keys when grouping needs by category

```typescript
// WRONG - causes all needs to appear under same category
if (!categories.has(category.guid)) {
    categories.set(category.guid, categoryObj);
}

// CORRECT - properly groups needs by category
if (!categories.has(category.id)) {
    categories.set(category.id, categoryObj);
}
```

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

## Knockout Debug System (IMPLEMENTED)

### Debug Utilities (src/util.ts:542-772)

**Core Functions**:
- `isKnockoutObservable(obj)`: Type guard for observables/computeds/observable arrays
- `safeUnwrap(value)`: Unwraps observables safely, handles write-only observables
- `getAssetType(data)`: Detects asset type (Factory, Consumer, Template wrapper, etc.)
- `debugBindingContext(element)`: Inspects Knockout binding context for DOM element
- `logAssetInfo(data, label?)`: Logs detailed asset information with observable properties
- `inspectElement(selector)`: Inspects element by CSS selector or HTMLElement

**Type Safety**: All functions use `unknown` types instead of `any` for strict typing

**Key Features**:
- Template wrapper detection: Recognizes and unwraps `Template(instance)` pattern
- Constructor name detection: Uses `obj.constructor.name` for class identification
- NamedElement detection: Checks for `guid` + `name` properties
- Safe error handling: Try-catch around observable unwrapping for write-only observables

### Debug Binding Handler (src/components.ts:75-134)

**Registration**: `ko.bindingHandlers.debug` registered before `ko.applyBindings()`

**Callbacks**:
- `init`: Logs initial binding when element is bound (requires `window.view.debug.enabled()`)
- `update`: Logs observable changes (requires `window.view.debug.verboseMode()`)

**Template Usage**:
```typescript
<div data-bind="debug: 'Label', [other bindings]">
<div data-bind="debug: true, visible: observable">
```

**Output**: `[DebugKO]` prefixed console logs with asset type, GUID, name, region, binding context

### Debug Settings Persistence (src/main.ts:79-110)

**Critical Implementation**: Debug settings must be restored from localStorage on initialization

**Observable Creation** (lines 79-84):
```typescript
debug: {
    enabled: ko.observable(false),
    logBindings: ko.observable(false),
    verboseMode: ko.observable(false)
}
```

**localStorage Restoration** (lines 87-99):
```typescript
const debugEnabled = localStorage.getItem('debug.enabled');
if (debugEnabled === 'true') {
    window.view.debug.enabled(true);
}
// Same for verboseMode and logBindings
```

**Two-Way Sync** (lines 102-110):
```typescript
window.view.debug.enabled.subscribe((value: boolean) => {
    localStorage.setItem('debug.enabled', value.toString());
});
// Same for verboseMode and logBindings
```

**Without this code**: Debug mode won't persist across page reloads, even if set in localStorage

### Global Debug Object (src/main.ts:29-35)

Exposed as `window.debugKO` for console access:
```typescript
window.debugKO = {
    context: debugBindingContext,
    type: getAssetType,
    log: logAssetInfo,
    inspect: inspectElement
};
```

**Usage from Console**:
```javascript
debugKO.inspect('.factory-tile');
debugKO.type(window.view.selectedFactory());
debugKO.log(window.view.island(), 'Current Island');
```

### Common Debugging Patterns

**Enable Before Page Load**:
```javascript
localStorage.setItem('debug.enabled', 'true');
// Reload page
```

**Enable After Load** (auto-persists):
```javascript
window.view.debug.enabled(true);
window.view.debug.verboseMode(true);
```

**Check Binding Context**:
```javascript
const ctx = ko.contextFor(document.querySelector('.factory-tile'));
debugKO.log(ctx.$data, 'Factory Tile Context');
```

**Inspect Template Instance**:
```javascript
// $data is Template object
debugKO.type($data); // "Template(Factory)"
debugKO.type($data.instance()); // "Factory"
```

### Performance Considerations

- **Zero Overhead When Disabled**: Observable check `window.view.debug.enabled()` returns false immediately
- **Verbose Mode**: Update callback fires on every observable change - use sparingly
- **Template Bindings**: All 15 templates have debug bindings at strategic points (see templates/CLAUDE.md)

## Internationalization (i18n.ts)

### Language Code Conventions

**CRITICAL**: Always use the standardized language codes in `src/i18n.ts`:
- ✅ `simplified_chinese` - Simplified Chinese
- ✅ `traditional_chinese` - Traditional Chinese
- ✅ `brazilian` - Brazilian Portuguese
- ❌ `chinese` - NEVER use this (ambiguous)

### Complete Language List (12 required for all keys)

Every translation key MUST include all 12 languages:
```typescript
keyName: {
    english: "...",
    french: "...",
    polish: "...",
    spanish: "...",
    italian: "...",
    german: "...",
    brazilian: "...",
    russian: "...",
    simplified_chinese: "...",
    traditional_chinese: "...",
    japanese: "...",
    korean: "..."
}
```

### Language Code Mapping

The `languageCodes` object maps browser locale codes to internal language names:
```typescript
export const languageCodes: Record<string, string> = {
    'en': 'english',
    'de': 'german',
    'zh_TW': 'chinese_traditional',
    'zh_HK': 'chinese_traditional',
    'zh_HANT': 'chinese_traditional',
    'zh': 'chinese_simplified',
    'fr': 'french',
    'es': 'spanish',
    'pt-br': 'brazilian',
    'ru': 'russian',
    'ko': 'korean',
    'ja': 'japanese',
    'it': 'italien',  // Note: maps to "italien" not "italian"
    'pl': 'polish'
}
```

**Important**: The `languageCodes` map uses `chinese_traditional` and `chinese_simplified` with underscores, but the translation keys themselves use the same names.

### Translation Key Structure

```typescript
export const texts: Record<string, Record<string, string>> = {
    keyName: {
        // All 12 languages required
        // Can use either quoted or unquoted keys
        "english": "...",
        french: "...",
        // ...
    }
}
```

### Adding New Translation Keys

When adding new UI text:

1. **Add to src/i18n.ts with English translation:**
   ```typescript
   newKey: {
       english: "Your English text"
   }
   ```

2. **Complete all languages:**
   ```bash
   /translate newKey
   ```
   Or manually add all 12 languages if translations are already known.

3. **Verify completeness:**
   ```bash
   npm run check-translations
   ```

4. **Use in templates:**
   ```html
   <span data-bind="text: $root.texts.newKey"></span>
   ```

### Excluded Keys

**`helpContent`**: Contains long HTML documentation, managed separately. Does NOT require all 12 languages.

### Common Errors

1. **Using `chinese:` instead of `simplified_chinese:`**
   - ❌ `chinese: "文本"`
   - ✅ `simplified_chinese: "文本"`

2. **Missing languages**
   - Run `npm run check-translations` to detect
   - Use `/translate keyName` to complete

3. **Inconsistent quoting**
   - Both `"english":` and `english:` are valid
   - Be consistent within each key

4. **Special characters in translations**
   - Properly escape quotes: `"It's"` → `"It\\'s"` or use `"It's"`
   - HTML entities work: `&nbsp;`, `&mdash;`, etc.

### Translation Workflow Tools

See root `CLAUDE.md` for complete translation workflow documentation including:
- `npm run check-translations` - Check completeness
- `/translate keyName` - Interactive translation
- `./scripts/auto-translate.sh` - Automated batch translation
- `docs/CLAUDE_HEADLESS.md` - Headless mode documentation

## Presenter Pattern Architecture (IMPLEMENTED)

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

## Supplier Interface Architecture (PLANNED)

### Current Demand System (production.ts:112-184)

**Problem**: Demands are tightly coupled to Factory suppliers
- Demand class has `factory: KnockoutObservable<Factory>` property (line 118)
- `updateFixedProductFactory()` method (lines 152-175) assigns factory based on region matching
- Product.fixedFactory determines which factory fulfills demand (line 143-144)
- Trade routes and extra goods exist but don't integrate into demand resolution

**Limitation**: No unified way to specify whether a product comes from:
1. Local factory production
2. Trade route import
3. Passive trade (manual input without demand propagation)
4. Extra good production (items affecting factories)

### Proposed Supplier Interface

**Core Concept**: Abstract the concept of "where does this product come from" into a Supplier interface

```typescript
interface Supplier {
    // Identification
    readonly type: 'factory' | 'trade_route' | 'passive_trade' | 'extra_good';
    readonly product: Product;
    readonly island: Island;

    // Production capabilities
    defaultProduction(): number;      // Current/baseline production amount
    canSupply(amount: number): boolean; // Can this supplier fulfill amount?

    // Demand integration
    setDemand(amount: number): void;  // Request supplier to produce/import amount
    overProduction(): number;         // Excess production available
}
```

### Supplier Implementations

**1. FactorySupplier** (wraps existing Factory)
- `defaultProduction()`: Returns `factory.inputAmount() * factory.extraGoodFactor()`
- `setDemand()`: Updates `factory.inputAmountByOutput()`
- `canSupply()`: Checks if factory `available()` and in correct region
- Generates its own input demands recursively

**2. TradeRouteSupplier** (wraps TradeList)
- `defaultProduction()`: Returns sum of trade route amounts importing to this island
- `setDemand()`: Creates/updates trade route with `userSetAmount` constraint
- `userSetAmount`: User-set floor - trade route amount can increase but not decrease below this
- Auto-creates trade route if none exists (with userSetAmount = 0)
- Auto-deletes route if supplier changed and userSetAmount = 0

**3. PassiveTradeSupplier** (new concept)
- `defaultProduction()`: Returns manually entered amount
- `setDemand()`: No-op (doesn't propagate demands)
- "Joker" supplier - provides goods without generating upstream demand
- Useful for representing external sources or simplified scenarios

**4. ExtraGoodSupplier** (wraps ExtraGoodProductionList)
- `defaultProduction()`: Returns `extraGoodProductionList.amount()`
- `setDemand()`: Updates `factory.demandByExtraGoodSupplier()`
- Only available if items produce this specific product
- Typically used in combination with factory supplier

### Product-Level Supplier Selection

**Key Change**: Move from Factory selection to Supplier selection at Product level

```typescript
class Product {
    // Existing
    public factories: Factory[];
    public fixedFactory: KnockoutObservable<Factory | null>;  // DEPRECATED

    // New
    public availableSuppliers: KnockoutComputed<Supplier[]>;  // All possible suppliers
    public defaultSupplier: KnockoutObservable<Supplier | null>; // User-selected default
}
```

**Per-Island Supplier Selection**: Each product has one default supplier per island
- Storage key: `island.product.${productGuid}.supplier.type` and `.supplier.id`
- Supplier types identified by: `factory.guid`, `'trade'`, `'passive'`, `extra_good_item.guid`

### Demand Refactoring

**Simplify Demand class** (remove factory coupling):

```typescript
class Demand {
    public consumer: Constructible;
    public product: Product;
    public amount: KnockoutObservable<number>;

    // REMOVED: factory, updateFixedProductFactory()
}
```

**Demand Resolution** happens at Product level:
- Product.defaultSupplier receives all demand
- Supplier.setDemand() handles fulfillment strategy
- Factory suppliers generate recursive demands for their inputs

### Presenter Pattern for UI

**FactoryPresenter** (similar to ResidencePresenter pattern):
- Wraps Factory/Product combination for UI binding
- Provides computed observables for supplier selection
- **Supplier Options Calculation**:
  - `availableFactorySuppliers`: Factories producing this product (filter by region)
  - `availableTradeIslands`: Islands that can export via trade route
  - `availableExtraGoodSuppliers`: Items that produce this product as extra good
  - `canUsePassiveTrade`: Always true (passive trade always available)

**Benefits of Presenter**:
- Separates UI logic from data model
- Reusable computed properties for supplier selection
- Handles complex observable chains for supplier availability
- Example: `availableTradeIslands()` filters islands by session/region and existing routes

### Critical Initialization Order

**Existing Pattern** (world.ts:518):
```typescript
1. Create objects (factories, products, consumers)
2. f.initDemands(assetsMap)    // Factories register in products
3. e.applyBuffs(assetsMap)     // Effects create AppliedBuff
4. persistBuildings(factory)   // Load saved state
```

**With Suppliers**:
```typescript
1. Create objects (factories, products, consumers, suppliers)
2. f.initDemands(assetsMap)    // Register factories in products
3. p.initSuppliers(assetsMap)  // Create supplier instances for each product
4. e.applyBuffs(assetsMap)     // Effects still apply to factories
5. p.restoreDefaultSupplier()  // Load supplier selection from localStorage
6. persistBuildings(factory)   // Load factory-specific state
```

### Trade Route Integration Changes

**TradeList modifications** (trade.ts:180-331):
- `userSetAmount: KnockoutObservable<number>` - user-set minimum
- `manuallySet: KnockoutObservable<boolean>` - distinguishes user vs auto-created routes
- `routes` includes `userSetAmount` property per route
- Auto-cleanup: Remove routes where `userSetAmount == 0 && !manuallySet`

**TradeRoute persistence** (trade.ts:403-418):
- Add `userSetAmount` to JSON serialization
- Restore userSetAmount on load

### Implementation Strategy

**Phase 1: Supplier Infrastructure**
1. Create Supplier interface and implementations
2. Add Product.defaultSupplier and Product.availableSuppliers
3. Implement supplier persistence (localStorage integration)

**Phase 2: Demand Refactoring**
1. Remove Demand.factory property
2. Move demand resolution to Product level
3. Update Demand.updateAmount() to work through Product.defaultSupplier

**Phase 3: UI Integration**
1. Create FactoryPresenter class
2. Build supplier selection dialog/dropdown
3. Update templates to use presenter pattern
4. Add trade route userSetAmount UI

**Phase 4: Migration & Cleanup**
1. Migrate existing fixedFactory selections to default suppliers
2. Remove deprecated Product.fixedFactory
3. Update all demand creation to use new pattern

### Design Patterns in Use

**Strategy Pattern**: Supplier interface with multiple implementations (FactorySupplier, TradeRouteSupplier, etc.)
- Benefit: Pluggable fulfillment strategies without changing Product/Demand code

**Presenter Pattern**: FactoryPresenter separates UI logic from data model (see ResidencePresenter:702-758)
- Benefit: Computed observables for complex supplier selection logic
- Preserves reactivity through Knockout observables

**Delegation Pattern**: Demand → Product → Supplier chain
- Benefit: Single source of truth for supplier selection
- Similar to ResidenceNeed → PopulationLevelNeed delegation

### Key Files to Modify

**Core Classes**:
- `src/production.ts` - Product, Demand classes
- `src/factories.ts` - Factory integration with suppliers
- `src/trade.ts` - TradeList, TradeRoute with userSetAmount

**New Files**:
- `src/suppliers.ts` - Supplier interface and implementations
- `src/views.ts` - FactoryPresenter (add to existing file)

**Initialization**:
- `src/world.ts` - Island constructor supplier initialization

**UI Templates**:
- `templates/factory-config-dialog.html` - Supplier selection UI
- `templates/product-supplier-dialog.html` - New supplier management dialog

### References to Similar Code

**Presenter Pattern**: See ResidencePresenter (views.ts:702-758)
- Observable delegation to underlying data
- Computed properties for UI-specific calculations
- Update() method for switching underlying instance

**Persistence Pattern**: See Effect persistence (CLAUDE.md:122-158)
- Three-tier system (global, session, island)
- Observable subscriptions for auto-save
- localStorage key patterns: `${scope}.${guid}.${attribute}`

**Object Lookup**: See AppliedBuff constructor (buffs.ts:36-141)
- Validate assetsMap.get() results
- Descriptive error messages with GUIDs
- Type casting after validation

### Avoiding Common Pitfalls

**1. Circular Dependencies**
- Supplier → Factory → Product → Supplier cycle risk
- Solution: Keep Supplier interface in separate file, import carefully
- Similar to AppliedBuff separation (buffs.ts) to avoid Factory ↔ Production cycle

**2. Observable Method Preservation**
- NEVER use object spread with Knockout objects
- See Object Method Preservation Pattern (CLAUDE.md:256-269)
- Add properties directly: `obj.newProp = ko.computed(...)`

**3. Initialization Order**
- Suppliers must be created AFTER factories register in products
- Supplier selection must load BEFORE demands are calculated
- Critical section: Island constructor (world.ts:536+)

**4. Type Safety**
- Avoid `as any` casts
- Use proper type guards: `isSupplier(obj)` helper function
- See Type Safety Improvements (CLAUDE.md:37-44)