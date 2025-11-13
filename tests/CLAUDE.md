# Testing Framework Knowledge

**ConfigLoader** (tests/helpers/config-loader.ts):
- `loadConfig(page, configPath)`: Loads JSON fixture into localStorage before navigation
- `loadConfigObject(page, config)`: Loads config object directly into localStorage
- `createIslandConfig(name, session, islandData, calculatorSettings)`: Creates properly structured island config with new SubStorage format
  - Returns complete config with nested island JSON structure
  - Includes all required storage keys: calculatorSettings, sessionSettings, globalEffects
  - Island data stored as stringified JSON under island name key
- `clearStorage(page)`: Clears all localStorage data
- `getStorageState(page)`: Returns current localStorage snapshot for debugging
- **Integration**: Uses `page.addInitScript()` to inject localStorage before page load

**BindingErrorDetector** (tests/helpers/binding-detector.ts):
- `listenForErrors(page)`: Sets up console event listeners for error capture
- `getErrors()`: Returns all captured console errors (ConsoleMessage objects)
- `hasBindingError()`: Boolean check for Knockout binding errors
- `getBindingErrors()`: Filters for binding-specific error messages
- `getKnockoutErrors()`: Returns errors containing "knockout", "binding", "observable"
- **Detection Patterns**: Watches for "Unable to parse bindings", "undefined is not a function", ko.* errors
- **CRITICAL**: Error objects have `text` and `type` as methods (functions), not properties
  - Access via: `error.text()` and `error.type()` (Playwright ConsoleMessage API)
  - Handle both: `typeof error.text === 'function' ? error.text() : error.text`

**ComputedValueAsserter** (tests/helpers/computed-asserter.ts):
- `getValue(page, path)`: Evaluates computed observable in page context
  - Example: `getValue(page, 'window.view.island().factories[0].inputAmount()')`
- `assertEquals(page, path, expected, tolerance)`: Asserts computed value within tolerance
- `waitForValue(page, path, expected, timeout)`: Polls until value matches or timeout
- `getObservableValue(page, selector, property)`: Gets observable from DOM element binding
- **Tolerance Support**: Handles floating-point comparisons with ACCURACY/EPSILON

**FixtureManager** (tests/helpers/fixture-manager.ts):
- `loadFixture(name)`: Loads fixture file from tests/fixtures/
- `getFixtureList()`: Returns available fixture names
- `validateFixture(config)`: Validates fixture structure before loading
- `generateFixture(params)`: Creates fixture programmatically for parameterized tests

#### Key Test Scenarios

**Knockout Binding Validation**:
1. Load page with debug mode enabled (`window.view.debug.enabled(true)`)
2. Capture all console errors during initialization
3. Check for binding errors in templates (factory-tile, population-tile, dialogs)
4. Verify component registration completed before applyBindings
5. Assert no "Unable to parse bindings" errors
6. Validate template loading via `ko.templates` object

**Computed Observable Verification**:
1. **Factory Calculations** (src/factories.ts):
   - **CRITICAL**: Method renamed from `inputAmountByExistingBuildings()` to `throughputByExistingBuildings()`
   - `throughputByExistingBuildings()` requires `buildings.fullyUtilizeConstructed(true)` to return non-zero values
   - Formula: `buildings.constructed() * boost() * 60 / cycleTime` (only when fullyUtilizeConstructed is true)
   - `inputAmount()` = max(inputAmountByOutput, inputAmountByExistingBuildings) [DEPRECATED - use throughput-based methods]
   - `buildings.required()` = inputAmount() / 60 * cycleTime / boost()
   - `boost()` reflects applied buffs (items, modules, effects)
2. **Population Needs** (src/consumption.ts):
   - `ResidenceNeed.amount()` = residents() * need.tpmin / 60
   - `PopulationLevelNeed.residents()` aggregates across all residences
   - `PopulationLevelNeed.amount()` sums residence consumption
3. **Production Chains** (src/production.ts):
   - `Product.amount()` = sum of all factory outputs
   - `Demand.amount()` = consumer.inputAmount() * factor

**localStorage Persistence**:
1. Load fixture with specific building counts
2. Modify factory constructed buildings in UI
3. Reload page
4. Verify buildings.constructed() matches saved value
5. Test persistence patterns: persistBool, persistInt, persistFloat, persistString
6. Validate storage keys: `${guid}.${attribute}` pattern

**New SubStorage Structure** (Implemented 2025-11):
- **Global Storage Keys** (top-level in localStorage):
  - `calculatorSettings`: JSON string containing settings.* keys (e.g., "settings.showAllProducts": "1")
  - `sessionSettings`: JSON string containing session-level settings
  - `globalEffects`: JSON string containing global effect scaling values
  - `islandName`: Current selected island name
  - `islandNames`: Array of island names
  - `versionCalculator`: Version string
  - `tradeRoutes`: JSON array of trade routes
  - `collapsibleStates`: JSON object for UI state
  - `debug.enabled`: Debug mode flag

- **Island-Specific Storage** (nested JSON under island name):
  - Each island (e.g., "Latium", "All Islands") has its own JSON string containing:
    - `session`: Session GUID the island belongs to
    - `selectedPatron`: Currently selected patron
    - `{guid}.buildings.constructed`: Building counts
    - `{guid}.buildings.fullyUtilizeConstructed`: Building utilization flags
    - Other island-specific data

**Critical Session GUIDs**:
- 37135 = Global/Meta session (use for "All Islands")
- 3245 = Latium session
- Always use correct session GUID matching the island's region in tests

**Initialization Order Validation**:
1. Verify objects created before initDemands() called
2. Assert initDemands() completes before applyBuffs()
3. Confirm applyBuffs() creates AppliedBuff instances
4. Validate persistBuildings() loads after relationships established
5. Check window.view.island() populated before ko.applyBindings()

#### Example Test Implementation

```typescript
// tests/binding/template-bindings.spec.ts
import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

test('factory-tile template binds without errors', async ({ page }) => {
  const configLoader = new ConfigLoader();
  const errorDetector = new BindingErrorDetector();

  // Load basic configuration (with new SubStorage format)
  await configLoader.loadConfig(page, 'fixtures/basic.json');

  // Enable debug mode before page load
  await page.addInitScript(() => {
    localStorage.setItem('debug.enabled', 'true');
  });

  // Listen for errors
  errorDetector.listenForErrors(page);

  // Navigate to app
  await page.goto('http://localhost:8080/index.html');

  // Wait for initialization
  await page.waitForSelector('.factory-tile', { timeout: 5000 });

  // Assert no binding errors
  expect(errorDetector.hasBindingError()).toBe(false);

  // Verify factory tiles rendered
  const factoryTiles = await page.locator('.factory-tile').count();
  expect(factoryTiles).toBeGreaterThan(0);
});
```

```typescript
// tests/computed/factory-calculations.spec.ts
import { test, expect } from '@playwright/test';
import { ComputedValueAsserter } from '../helpers/computed-asserter';

test('factory inputAmount computed correctly', async ({ page }) => {
  const asserter = new ComputedValueAsserter();

  await page.goto('http://localhost:8080/index.html');
  await page.waitForLoadState('networkidle');

  // Set factory buildings to 10
  await page.evaluate(() => {
    const factory = window.view.island().factories[0];
    factory.buildings.constructed(10);
    factory.boost(1.5); // 50% boost
  });

  // Get expected value: 10 buildings * 1.5 boost * 60 / cycleTime
  const cycleTime = await page.evaluate(() =>
    window.view.island().factories[0].cycleTime
  );
  const expected = 10 * 1.5 * 60 / cycleTime;

  // Assert computed value matches
  await asserter.assertEquals(
    page,
    'window.view.island().factories[0].inputAmount()',
    expected,
    0.01 // tolerance
  );
});
```

#### Integration with Existing Debug System

The testing framework leverages existing debug utilities:
- **window.debugKO**: Use in test scripts to inspect binding contexts
- **Debug Binding Handler**: Enable via fixtures to capture binding lifecycle
- **Asset Type Detection**: Validate Template wrappers resolve correctly
- **Console Output Parsing**: Extract [DebugKO] messages for assertions

#### Testing Commands

```json
{
  "scripts": {
    "test": "playwright test",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --debug",
    "test:ui": "playwright test --ui",
    "test:binding": "playwright test tests/binding",
    "test:computed": "playwright test tests/computed",
    "test:e2e": "playwright test tests/e2e",
    "test:factory-dialogs": "playwright test tests/binding/factory-config-dialogs.spec.ts --reporter=list"
  }
}
```

#### Test Configuration Considerations

**Playwright Config** (playwright.config.ts):
- `baseURL`: 'http://localhost:8080' (requires local dev server)
- `use.viewport`: { width: 1920, height: 1080 } (full desktop view)
- `use.screenshot`: 'only-on-failure'
- `use.video`: 'retain-on-failure'
- `use.trace`: 'on-first-retry'
- `testDir`: './tests'
- `timeout`: 30000 (30 seconds per test)

**Dev Server Integration**:
- Option 1: Run `npm run dev` separately before tests
- Option 2: Use `webServer` in Playwright config to auto-start dev server
- Option 3: Serve static `dist/` directory via Playwright's built-in server

**CI/CD Considerations**:
- Use `npx playwright install` to install browser binaries
- Run tests in headless mode on CI
- Upload test-results/ artifacts for debugging failures
- Generate HTML test report via `playwright show-report`

## Critical Playwright Constraints

### Knockout.js NOT Available in page.evaluate()

**IMPORTANT**: The `ko` object (Knockout.js) is **NOT available** inside `page.evaluate()` contexts in Playwright tests.

**Why**: Playwright's `page.evaluate()` runs code in an **isolated browser execution context** that only has access to:
- `window` object and its properties
- DOM APIs
- Global variables defined in the page
- **NOT** module-scoped variables or library imports unless explicitly attached to window

**Wrong Approach** (Will Fail):
```typescript
// ❌ This will fail - ko is not defined in evaluate context
await page.evaluate(() => {
  if (ko.isObservable(window.view.island().factories[0].boost)) {
    // ko is undefined here!
  }
});
```

**Correct Approach**:
```typescript
// ✅ Access observables through window.view and call them with ()
await page.evaluate(() => {
  const factory = window.view.island().factories[0];
  const boostValue = factory.boost(); // Call observable to unwrap
  const buildings = factory.buildings.constructed(); // Call nested observable
  return { boostValue, buildings };
});
```

### Working with Knockout Observables in Tests

Since `ko.isObservable()`, `ko.unwrap()`, and other Knockout utilities are unavailable in `page.evaluate()`:

**Pattern 1: Direct Observable Calls**
```typescript
// Get observable values by calling them with ()
const value = await page.evaluate(() => {
  return window.view.island().factories[0].inputAmount();
  //                                                  ^^^ Call the observable
});
```

**Pattern 2: Check for Function Type**
```typescript
// Check if something is callable (likely an observable)
const isObservable = await page.evaluate(() => {
  const prop = window.view.island().factories[0].boost;
  return typeof prop === 'function';
});
```

**Pattern 3: Access Observable Arrays**
```typescript
// Observable arrays are functions that return arrays
const factoryCount = await page.evaluate(() => {
  const factories = window.view.island().factories;
  // If factories is an observable array, call it
  if (typeof factories === 'function') {
    return factories().length;
  }
  // Otherwise treat as regular array
  return factories.length;
});
```

**Pattern 4: Working with Buffs Observable Array** (CRITICAL)
```typescript
// factory.buffs is KnockoutObservableArray<AppliedBuff>
// MUST unwrap with () before calling array methods

// ❌ WRONG - will fail with "factory.buffs.find is not a function"
const buff = factory.buffs.find(b => b.parent === module);

// ✅ CORRECT - unwrap observable array first
const buff = factory.buffs().find(b => b.parent === module);

// Same applies to all array methods
factory.buffs().length;        // Not: factory.buffs.length
factory.buffs().map(...);      // Not: factory.buffs.map(...)
factory.buffs().filter(...);   // Not: factory.buffs.filter(...)
```

**Pattern 4: Iterate Over Data Structures**
```typescript
// Work with maps and arrays in evaluate context
const needsData = await page.evaluate(() => {
  const island = window.view.island();
  const popLevel = island.populationLevels[0];

  // Convert Map to array for iteration
  const needsArray = Array.from(popLevel.needsMap.values());

  return needsArray.map(need => ({
    guid: need.guid,
    checked: need.checked(), // Call observable
    amount: need.amount()    // Call computed observable
  }));
});
```

### Test Design Principles

1. **Access Data Through window.view**: All application state is accessible via `window.view` global object
2. **Call Observables with ()**: Always call observables as functions to unwrap values
3. **No Knockout Utilities**: Don't rely on `ko.*` helpers in test evaluation contexts
4. **Return Simple Data**: Return plain objects/arrays from `page.evaluate()`, not observables
5. **Type Checking**: Use `typeof prop === 'function'` to detect observables instead of `ko.isObservable()`

### Example Test Pattern

```typescript
test('factory calculation test', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Get data by calling observables
  const factoryData = await page.evaluate(() => {
    const factory = window.view.island().factories[0];

    // Return plain data object, not observables
    return {
      guid: factory.guid,
      cycleTime: factory.cycleTime,
      buildings: factory.buildings.constructed(), // ✅ Call observable
      boost: factory.boost(),                     // ✅ Call observable
      inputAmount: factory.inputAmount()          // ✅ Call computed
    };
  });

  // Calculate expected value outside page context
  const expected = (factoryData.buildings * factoryData.boost * 60) / factoryData.cycleTime;

  // Assert
  expect(factoryData.inputAmount).toBeCloseTo(expected, 2);
});
```

### Helper Classes Handle This Correctly

The test helper classes (`ComputedValueAsserter`, etc.) are designed to work around these limitations:

```typescript
// Helper internally handles the evaluate context correctly
await asserter.assertEquals(
  page,
  'window.view.island().factories[0].inputAmount()',
  expectedValue,
  { tolerance: 0.01 }
);
```

The helper:
1. Evaluates the path string in page context
2. Automatically calls if it's a function (observable)
3. Returns the unwrapped value
4. Compares with tolerance

### Debugging in Page Context

When debugging, remember these alternatives to Knockout utilities:

| Knockout Utility | Playwright Alternative |
|-----------------|------------------------|
| `ko.isObservable(obj)` | `typeof obj === 'function'` |
| `ko.unwrap(obs)` | `typeof obs === 'function' ? obs() : obs` |
| `ko.toJS(data)` | Manual recursion calling observables |
| `ko.dataFor(element)` | `window.view` traversal |
| `ko.contextFor(element)` | Not available - use data attributes or window.view |

### Common Pitfalls

❌ **Don't do this**:
```typescript
await page.evaluate(() => {
  const obs = window.view.island().factories[0].boost;
  return ko.unwrap(obs); // ❌ ko is undefined!
});
```

✅ **Do this instead**:
```typescript
await page.evaluate(() => {
  const obs = window.view.island().factories[0].boost;
  return typeof obs === 'function' ? obs() : obs; // ✅ Works!
});
```

## Test Fixture Best Practices

### Fixture Assignment by Test Type

- **basic.json**: Minimal configuration for binding tests
  - One island, no buildings
  - Used for template validation, component registration tests
  - Validates UI renders without errors

- **with-data.json**: Sample data for computed tests
  - One island per session
  - At least one residence and one factory per island with buildings > 0
  - Used for calculation tests, initialization order tests
  - Validates business logic and computed observables

### Creating Effective Fixtures

Fixtures are JSON files representing localStorage state:

```json
{
  "versionCalculator": "1",
  "session": "37135",
  "islandName": "Latium",
  "5475.buildings.constructed": "1",
  "6475.buildings.constructed": "1",
  "debug.enabled": "true"
}
```

**Key Patterns**:
- `{guid}.buildings.constructed` - Building count for factory/residence
- `{guid}.boost` - Productivity modifier
- `session` - Session GUID
- `islandName` - Current island name
- `debug.enabled` - Enable debug mode

## Calculation Formulas Reference

When writing tests for computed observables, use these formulas to calculate expected values:

### Factory Calculations

All factory calculations are in `src/factories.ts`:

- **inputAmountByExistingBuildings()** = `buildings.constructed * boost * 60 / cycleTime`
  - Uses cycleTime from params.js
  - Calculates production based on existing building count

- **inputAmount()** = `max(inputAmountByOutput(), inputAmountByExistingBuildings())`
  - Takes the higher value between demand-driven and building-count-driven input
  - Ensures factories produce enough for demand or utilize existing buildings

- **buildings.required()** = `inputAmount() / 60 * cycleTime / boost()`
  - Inverse of inputAmountByExistingBuildings
  - Calculates how many buildings needed for current demand

### Population Need Calculations

Population calculations are in `src/consumption.ts`:

- **ResidenceNeed.amount()** = `buildings.constructed * needConsumptionRate * consumptionFactor`
  - needConsumptionRate comes from params.js
  - consumptionFactor comes from settings (default 1.0)
  - Returns 0 if need is not checked

- **ResidenceNeed.residents()** = `buildings.constructed * need.residents`
  - need.residents comes from params.js
  - Returns 0 if need is not checked

- **PopulationLevelNeed.amount()** - Aggregates across all residences
  - Sums ResidenceNeed.amount() for all residences in the population level
  - For the same need GUID across all residence buildings

### Params-Based Testing Strategy

Always read values from params.js in tests to make them resilient to game data changes:

```typescript
// ✅ Good - Uses params data
const cycleTime = await page.evaluate(() => {
  return window.view.island().factories[0].cycleTime;
});
const expected = (buildings * boost * 60) / cycleTime;

// ❌ Bad - Hardcoded values break when params change
const expected = (buildings * boost * 60) / 30; // What if cycleTime changes?
```

## DOM-Based Test Patterns (Critical for Context Issues)

### The Problem: Lost Context with window.view

When writing tests that need to access `window.view` data, you may encounter "context lost" errors where `window.view` is undefined even though DOM elements have rendered. This happens because:
- The webpack bundle may not have fully initialized
- Timing issues between DOM rendering and JavaScript execution
- Playwright's `page.evaluate()` runs before application initialization completes

### The Solution: DOM-Based Approach

**Always prefer DOM-based interactions over programmatic data access**:

✅ **Correct Pattern** (Used in `template-bindings.spec.ts`):
```typescript
// Wait for DOM elements, not window.view
await page.waitForSelector('.product-tile', { timeout: 10000 });
await page.waitForLoadState('networkidle');

// Get buttons from DOM
const buttons = await page.locator('.btn[data-target="#factory-config-dialog"]').all();

// Click buttons naturally
await button.click();
```

❌ **Problematic Pattern** (Causes context errors):
```typescript
// Don't access window.view directly to find buttons
const categoriesInfo = await page.evaluate(() => {
  const island = (window as any).view.island(); // May be undefined!
  // ... traverse data structures
});
```

### Factory Config Dialog Test Pattern

The `factory-config-dialogs.spec.ts` test demonstrates the correct pattern:

1. **Wait for DOM elements** (not window.view):
   ```typescript
   await page.waitForSelector('.ui-fchain-item, .ui-service-building-item', {
     timeout: 10000,
     state: 'attached',
   });
   ```

2. **Expand collapsed sections** (via DOM manipulation):
   ```typescript
   await page.evaluate(() => {
     document.querySelectorAll('fieldset.ui-fieldset.collapsible').forEach((fieldset) => {
       const legend = fieldset.querySelector('legend');
       if (legend && fieldset.classList.contains('collapsed')) {
         (legend as HTMLElement).click();
       }
     });
   });
   ```

3. **Filter to visible elements only**:
   ```typescript
   const allButtons = await page.locator('.btn[data-target="#factory-config-dialog"]').all();
   const visibleButtons = [];
   for (const button of allButtons) {
     if (await button.isVisible()) {
       visibleButtons.push(button);
     }
   }
   ```

4. **Extract metadata from DOM** (not from data objects):
   ```typescript
   const info = await button.evaluate((btn) => {
     const factoryTile = btn.closest('.ui-fchain-item');
     const categoryFieldset = factoryTile?.closest('fieldset.ui-fieldset');
     const categoryLegend = categoryFieldset?.querySelector('legend');
     const factoryNameElement = factoryTile?.querySelector('.ui-fchain-item-name');

     return {
       categoryName: categoryLegend?.textContent?.trim() || 'Unknown',
       factoryName: factoryNameElement?.textContent?.trim() || 'Unknown',
     };
   });
   ```

5. **Use natural interactions**:
   ```typescript
   // Click button to open dialog
   await button.click({ force: true }); // force handles edge cases

   // Wait for dialog to appear
   await page.waitForSelector('#factory-config-dialog.show', {
     timeout: 5000,
     state: 'visible',
   });

   // Close with keyboard (natural user action)
   await page.keyboard.press('Escape');
   ```

### Why This Works

- **No dependency on window.view**: The test works even if application initialization is delayed
- **Uses actual user interactions**: Clicks, keyboard presses, scrolling
- **Resilient to timing issues**: Waits for visible elements, not data structures
- **Matches existing test patterns**: Follows same approach as `template-bindings.spec.ts`

### Common Issues and Solutions

**Issue**: "Element is not visible" errors
- **Solution**: Filter buttons with `isVisible()` check before clicking
- **Alternative**: Use `{ force: true }` for edge cases with collapsible sections

**Issue**: Test timeout waiting for window.view
- **Solution**: Don't wait for window.view - wait for DOM elements instead

**Issue**: Stale element reference
- **Solution**: Re-query elements after DOM changes (expanding sections, opening dialogs)

**Issue**: Category identification from data
- **Solution**: Use DOM traversal to find parent fieldset legend text

### Testing Modal Dialogs

When testing dialogs that appear via Bootstrap modals:

1. **Open via DOM click** (not programmatic modal('show')):
   ```typescript
   await button.click(); // Triggers data-toggle="modal"
   ```

2. **Wait for .show class**:
   ```typescript
   await page.waitForSelector('#dialog-id.show', { state: 'visible' });
   ```

3. **Close naturally**:
   ```typescript
   await page.keyboard.press('Escape'); // Or click close button
   ```

4. **Don't use force close** unless necessary:
   ```typescript
   // Avoid: await page.evaluate(() => $('#dialog').modal('hide'));
   // Prefer: await page.keyboard.press('Escape');
   ```

## Module Testing Patterns

### Module Input Demands Test (module-input-demands.spec.ts)
Tests that modules correctly calculate input demands based on parent factory's utilized buildings.

**Test Setup**:
```typescript
const config = {
    "versionCalculator": "1",
    "session": "37135",
    "islandName": "Latium",
    "2786.buildings.constructed": "5",  // Sheep farm
    "2786.buildings.fullyUtilizeConstructed": "1"  // MUST use "1" not "true"
};
```

**Key Assertions**:
- Module `buildings.constructed` syncs from factory's `buildings.utilized()`
- Input demand calculation: `buildings.utilized() * 60 / cycleTime * inputAmount * boost`
- Demand appears only when module is checked

### Module Boost Test (module-boost.spec.ts)
Tests that module buffs apply multiplicative productivity boost to factory.

**Critical Points**:
1. **Observable Array Access**: Must unwrap `factory.buffs()` before array methods
2. **Property Names**: Use `appliedBuff.buff.guid` NOT `appliedBuff.effect.guid`
3. **Boost Calculation**: All buffs are additive (was different in prior versions)
4. **Expected Values**:
   - Module unchecked: `factoryBoost = 1.0`, `appliedBuffScaling = 0`
   - Module checked: `factoryBoost = 2.0`, `appliedBuffScaling = 1`, `productivityUpgrade = 100`

**Test Pattern for Reactive Updates**:
```typescript
// Check module
await page.evaluate((factoryGuid) => {
    const factory = window.view.island().factories.find(f => f.guid === factoryGuid);
    factory.modules[0].checked(true);
}, sheepFarmGuid);

await page.waitForTimeout(200);  // Wait for observables to update

// Verify boost changed
const state = await page.evaluate(() => {
    const factory = window.view.island().factories[0];
    return {
        boost: factory.boost(),
        buffs: factory.buffs().map(b => ({
            scaling: b.scaling(),
            productivity: b.productivityUpgrade()
        }))
    };
});
```

## Resources

- **Playwright Evaluate Docs**: https://playwright.dev/docs/evaluating
- **Main Testing Docs**: [tests/README.md](./README.md)
- **Developer Guide Testing Section**: [docs/DEVELOPER_GUIDE.md](../docs/DEVELOPER_GUIDE.md)
