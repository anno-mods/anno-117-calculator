# Anno 117 Calculator - Developer Guide

## Project Overview

The Anno 117 Calculator is a web-based production chain calculator for the Anno 117 game. It helps players optimize their island economies by calculating resource consumption, production requirements, and trade routes based on population needs and factory configurations.

The project is built using TypeScript, Knockout.js for reactive UI, and Webpack for bundling. The project is built using TypeScript, Knockout.js for reactive UI, and Webpack for bundling. The migration from JavaScript to TypeScript has been completed, with legacy JavaScript files in the `js/` directory serving as reference only.

## Project Setup

### Prerequisites

#### Step 1: Install Node.js
1. Go to [nodejs.org](https://nodejs.org/)
2. Download the LTS (Long Term Support) version for your operating system
3. Run the installer and follow the setup wizard
4. Verify installation by opening a terminal/command prompt and typing:
   ```bash
   node --version
   npm --version
   ```
   Both commands should return version numbers

#### Step 2: Install Git
1. Go to [git-scm.com](https://git-scm.com/)
2. Download Git for your operating system
3. Run the installer with default settings
4. Verify installation by typing in terminal:
   ```bash
   git --version
   ```

#### Step 3: Install Cursor IDE
1. Go to [cursor.sh](https://cursor.sh/)
2. Download Cursor for your operating system
3. Install and launch Cursor
4. Sign up for a Cursor account when prompted
5. Cursor provides excellent AI-powered development assistance that will help you complete the project setup

#### Step 4: Set Up Development Environment
1. **Clone the repository** (if you have access):
   - In Cursor, press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "Git: Clone" and select it
   - Enter the repository URL
   - Choose a folder to save the project

2. **Create Feature Branch**
   - Open the terminal in Cursor (`Ctrl+`` or `Cmd+``)
   - It's recommended to work on a feature branch rather than directly on main
   - Use Cursor's AI assistant to help name your branch appropriately
   - Example: Ask the AI "What would be a good branch name for [your specific feature/task]?"

#### Step 5: Leverage Agentic AI
- **Enable AI Features**: Make sure Cursor's AI features are enabled in settings
- **Use AI Throughout Development**: The AI can help with:
  - Understanding the codebase architecture
  - Generating boilerplate code
  - Debugging TypeScript issues
  - Writing tests and documentation
  - Explaining error messages
- **Ask Questions**: Don't hesitate to ask the AI agent for specific setup steps if you encounter any issues
- **Tip**: Use `Ctrl+K` (or `Cmd+K` on Mac) to open the AI chat panel

### Initial Setup

```bash
# Clone the repository
git clone [repository-url]
cd anno-117-calculator

# Create and switch to a feature branch (let AI suggest the name)
git checkout -b [ai-suggested-branch-name]

# Install dependencies
npm install

# Build the project
npm run build

# Start development server
npm run dev
```

### Development Commands

- `npm run build` - Production build with webpack
- `npm run build:ts` - TypeScript compilation only
- `npm run dev` - Development mode with webpack watch
- `npm run type-check` - TypeScript type checking
- `npm run type-check:watch` - TypeScript type checking in watch mode

### Migration Commands

- `npm run fix-types` - Auto-fix TypeScript errors
- `npm run generate-types` - Generate type definitions from params


### Configure MCP servers
- `claude mcp add memory --scope project -- cmd /c "npx -y @itseasy21/mcp-knowledge-graph --memory-path ./docs/memory.jsonl"` - for Claude Code
- For Cursor:
   1. Follow https://forum.cursor.com/t/mcp-add-persistent-memory-in-cursor/57497
   2. Use `"MEMORY_FILE_PATH": "docs/memory.jsonl"` in `mcp.json`
   3. To set up memory rules go to: File -> Preferences -> Cursor Settings -> Rules & Memory

### Claude Code commands (assuming a Clude Code CLI is running)
- `/analyze <feature>` - When implementing a new feature, let Claude reflect about its architectural knowledge and process steps
- `/wrap-up` - When feature implementation / debugging is completed or at the end of a session, store the new insights in memory files (Claude.md)
- `/resume` - Continue with an existing session

## Adding Parameters and Game Data

The calculator uses extracted game data stored in `params.js` and `params.schema.json`. Here's how to add or update game parameters:

### Asset Extraction Process

1. **Asset Extractor Tool**
   - The project uses an asset-extractor tool to pull data from Anno 117 game files
   - This tool extracts buildings, production chains, population needs, and other game data
   - Run the asset extractor against the game installation directory

2. **Jupyter Notebook Pipeline**
   - After extraction, run the Jupyter notebook pipeline to process the raw data
   - The notebook performs data transformation, validation, and formatting
   - Generates both `params.js` (data) and params.schema.json` (json schema)

3. **Parameter Generation Workflow**
   ```bash

   # 1. Extract assets from game files (see asset-extractor project)
   jupyter notebook conversion_calculator.ipynb

   # 2. Generate TypeScript types
   npm run generate-types

   # 3. Validate the generated parameters
   npm run type-check
   ```

### Parameter Structure

The `params.js` file contains:
- **Buildings**: Production facilities, residences, public buildings
- **Products**: Resources, goods, and consumables
- **Population Levels**: Different tiers of residents
- **Production Chains**: Input/output relationships
- **Effects**: Buffs, items, and modifiers
- **Regions**: Different game areas and their properties

## Knockout.js Architecture

The calculator uses Knockout.js for reactive UI with a Model-View-ViewModel (MVVM) pattern.

### Dependency Management

Knockout.js manages dependencies through observables:

```typescript
// Observable properties automatically track dependencies
const population = ko.observable(1000);
const consumptionRate = ko.observable(0.5);

// Computed observables automatically update when dependencies change
const totalConsumption = ko.pureComputed(() => {
    return population() * consumptionRate();
});
```

### Key Observable Patterns

1. **Basic Observables**: Store single values that can change
2. **Observable Arrays**: For lists that can be modified
3. **Computed Observables**: Derived values that update automatically
4. **Pure Computed**: Optimized computed observables for read-only calculations

### Global State Management

The application uses a global `window.view` object that contains all application state:

```typescript
window.view = {
    island: ko.observable(new Island()),
    selectedFactory: ko.observable(null),
    settings: new Settings(),
    texts: new I18n(),
    // ... other global state
};
```

## Templates and Components

### Template System

HTML templates are stored in the `templates/` directory and loaded via webpack:

```typescript
// Templates are loaded using webpack's require.context()
const templates = require.context('../templates', false, /\.html$/);

// Templates are registered with Knockout
ko.templates = {};
templates.keys().forEach(key => {
    const name = key.replace('./', '').replace('.html', '');
    ko.templates[name] = templates(key);
});
```

### Component Registration

Components are registered in `src/components.ts`:

```typescript
ko.components.register('component-name', {
    viewModel: function(params) {
        // Component logic
        this.data = params.data;
        this.computed = ko.pureComputed(() => {
            // Reactive calculations
        });
    },
    template: `
        <div data-bind="text: data.name"></div>
        <span data-bind="text: computed"></span>
    `
});
```

### Key Component Patterns

1. **Asset Icons**: `asset-icon` component for displaying game assets
2. **Number Inputs**: `number-input-increment` for numeric values with +/- buttons
3. **Collapsibles**: `collapsible` component for expandable sections
4. **Factory Headers**: `factory-header` for production building displays
5. **Consumer Views**: `consumer-view` for showing demand chains

## Factory vs Consumer Architecture

The calculator uses a hierarchical class structure to model Anno 117's economic system:

### Consumer (Base Class)
**Purpose**: Base class for all buildings that consume resources
- **Population buildings**: Consume goods to satisfy resident needs
- **Public buildings**: Consume goods to provide services (schools, hospitals)
- **Factories**: Consume raw materials to produce finished goods

**Key Responsibilities**:
- Input demand management via `initDemands()`
- Buff system for productivity/efficiency modifiers
- Building count calculations (constructed/required/utilized)
- Workforce requirements

### Factory (Extends Consumer)
**Purpose**: Specialized consumer that produces goods for other consumers
- **Production chains**: Factory outputs become inputs for other consumers
- **Demand tracking**: Tracks which consumers need this factory's products
- **External sources**: Integrates trade routes and extra goods production

**Key Differences from Consumer**:
- Has `outputs[]` array of products it produces
- Manages `demands[]` from other consumers wanting its products
- Calculates `outputAmount` based on total demand
- Supports trade routes and extra goods systems

### Module (Extends Consumer)
**Purpose**: Attachments that provide buffs to factories
- **Conditional buffs**: Only active when module is checked/activated
- **Factory-specific**: Each module belongs to exactly one factory
- **Buff scaling**: Module activation controls buff intensity (0 or 1)

### PublicConsumerBuilding (Extends Consumer)
**Purpose**: Service buildings that don't participate in production chains
- **Population services**: Schools, hospitals, fire stations, etc.
- **Fixed recipes**: Can be locked to specific factory configurations
- **Non-productive**: Don't produce goods for consumption chains

### Production Chain Flow

```
Population → Demands → Factory → Inputs → Raw Material Factory → Trade/Extra Goods
     ↑                    ↑           ↑                    ↑              ↑
  Residences        Product Chain   Resources         Source Factory   External
  (Consumer)         (Demands)     (Inputs/Outputs)    (Consumer)     (Trade/Items)
```

### Initialization Order (Critical)

1. **Create all objects** first (consumers, factories, products)
2. **Link relationships** via `initDemands()` - factories register in products
3. **Apply buffs** via `applyBuffs()` - effects create AppliedBuff for targets  
4. **Load saved state** via `persistBuildings()` - restore user configurations

This separation ensures the demand calculation system can properly track dependencies between all consumers in the production chain.

## Calculator Initialization

The application initializes through a specific sequence in `src/main.ts:292`:

### Initialization Order

1. **Load Configuration** (params.js)
   - Game data loaded from generated parameters via `require('../js/params')`
   - Type definitions ensure data consistency

2. **Create Global Objects** (main.ts:357-405)
   - Effects created first for module owner effects
   - Regions created and added to `view.regions` array
   - Sessions created with effects and added to `view.sessions` array
   - Need attributes created and added to `view.needAttributes` array
   - NPC traders set up in `view.productsToTraders` Map

3. **Initialize Island Constructor** (world.ts:518)
   ```typescript
   // Critical: Order matters in island initialization
   constructor(params, localStorage, isNew, session) {
       // 1. Create basic objects
       // - Population levels, groups, residence buildings
       // - Factories, consumers, public buildings
       // - Products, categories, items
       
       // 2. Establish relationships
       for (let f of this.factories) {
           f.initDemands(assetsMap);  // Factories register demands
       }
       for (let e of this.allEffects) {
           e.applyBuffs(assetsMap);   // Effects apply buffs to targets
       }
       
       // 3. Load saved state (must be last)
       persistBuildings(factory);  // Load factory configurations
   }
   ```

4. **Set Up Island Management** (main.ts:408)
   - `IslandManager` created to handle multiple islands
   - Templates created for UI binding

5. **Register Components** (main.ts:462)
   - `registerComponents()` called before Knockout bindings
   - Templates loaded and associated with components

6. **Apply Bindings** (main.ts:465)
   - `ko.applyBindings(view, document.body)` establishes reactive UI connections

### Critical Design Considerations

#### Initialization Dependencies

- **Effects → Factories**: Effects create AppliedBuff for each target factory via `applyBuffs()`
- **Factories → Products**: Factories register demand in products via `initDemands()`
- **Products → UI**: Product calculations drive UI updates through Knockout observables

#### AppliedBuff System

```typescript
// Items create AppliedBuff for each target
class AppliedBuff {
    scaling: KnockoutObservable<number>; // Tracks if effect is applied (0-1 float)
    factory: Factory;                    // Target factory
    effect: Effect;                      // Source effect
}
```

#### Asset Creation Patterns

- **Global Assets**: Created once (regions, sessions, buffs, need categories)
- **Island Assets**: Created per island (buildings, products, population)
- **Factory Assets**: Created per factory instance (demands, applied buffs)

#### State Persistence

- `initDemands()` and `applyBuffs()` establish object relationships after creation
- `persistBuildings()` function loads saved factory configurations from localStorage
- Loading order: Create objects → Link objects → Load saved values

### Error Handling

The initialization includes comprehensive error handling in Island constructor:

```typescript
// Island constructor validation (world.ts:519-525)
if (!params) {
    throw new Error('Island params is required');
}
if (!localStorage) {
    throw new Error('Island localStorage is required');
}
if (!session) {
    throw new Error(`Session with GUID ${sessionGuid} not found in assetsMap`);
}
```

## Build Process

The build uses Webpack with TypeScript support:

1. **Entry Point**: `src/main.ts`
2. **Output**: `dist/calculator.bundle.js`
3. **Type Checking**: Separate from bundling for speed
4. **Template Loading**: Uses `require.context()` for HTML templates
5. **External Dependencies**: Knockout, jQuery, Bootstrap loaded globally

## Debugging Knockout Binding Errors

The calculator heavily uses Knockout.js templates and complex initialization order. Here's how to debug common issues:

### Enabling Debug Mode Before Page Load

To see detailed binding information as the page initializes, enable debug mode before loading:

**Option 1: Enable via localStorage** (Persists across reloads)
1. Open browser DevTools (F12)
2. Go to Console tab
3. Type: `localStorage.setItem('debug.enabled', 'true')`
4. Reload the page - all debug bindings will log to console
5. Debug mode will remain enabled until you clear localStorage or set it to 'false'

**Option 2: Enable Programmatically** (For development)
Add to `src/main.ts` before `ko.applyBindings()`:
```typescript
// Enable debug mode for development
window.view.debug.enabled(true);
// Optional: Enable verbose mode for update logging
window.view.debug.verboseMode(true);
```

**Option 3: Enable After Page Load** (Auto-persists to localStorage)
```javascript
// In browser console after page has loaded:
window.view.debug.enabled(true);
// This enables debug mode AND saves to localStorage automatically
// Reload page to see all binding initialization logs
// Debug mode will persist across reloads
```

**To Disable Debug Mode:**
```javascript
// Option 1: Via observable (auto-persists)
window.view.debug.enabled(false);

// Option 2: Via localStorage
localStorage.removeItem('debug.enabled');
// Or: localStorage.setItem('debug.enabled', 'false');
```

**Debug Output**: Look for `[DebugKO]` prefixed messages showing asset types, GUIDs, names, and binding contexts for all templates.

### Template Binding Errors

**Symptoms**: Errors like "Unable to parse bindings", "Property X is not defined", or blank/broken UI sections

**Debugging Steps**:
1. **Check Browser Console**: Look for specific binding error messages
2. **Inspect Template Loading**: Verify templates are loaded before bindings
   ```javascript
   // In browser console, check if templates exist:
   console.log(Object.keys(ko.templates || {}));
   ```
3. **Validate Data Context**: Ensure the binding context has required properties
   ```javascript
   // Check if view object is properly initialized:
   console.log(window.view);
   console.log(window.view.island());
   ```

### Effects Not Applied Issues

**Symptoms**: Buffs/items don't affect factories, productivity modifiers missing, or incorrect calculations

**Root Cause**: Usually initialization order problems where effects are applied before targets exist

**Debugging Process**:
1. **Verify Initialization Order** in Island constructor:
   ```typescript
   // Correct order (world.ts:518):
   constructor() {
       // 1. Create all objects first
       this.createFactories();
       this.createProducts();
       
       // 2. Link relationships - factories register in products
       for (let f of this.factories) {
           f.initDemands(assetsMap);  // Must happen after creation
       }
       
       // 3. Apply effects - effects find their targets
       for (let e of this.allEffects) {
           e.applyBuffs(assetsMap);   // Must happen after initDemands
       }
       
       // 4. Load saved state (must be last)
       persistBuildings(factory);
   }
   ```

2. **Check Effect Target Resolution**:
   ```javascript
   // In browser console:
   const island = window.view.island();
   console.log('Effects:', island.allEffects.length);
   console.log('Factories:', island.factories.length);
   
   // Check if effects found their targets:
   island.allEffects.forEach(effect => {
       console.log(`Effect ${effect.name()}: ${effect.appliedBuffs?.length || 0} targets`);
   });
   ```

3. **Validate AppliedBuff Creation**:
   ```javascript
   // Check if buffs were created for factories:
   const factory = window.view.island().factories[0];
   console.log('Factory buffs:', factory.buffs.length);
   console.log('Factory items:', factory.items.length);
   ```

### Common Initialization Issues

**Issue**: `Cannot read property 'X' of undefined` in templates
- **Cause**: Template tries to access property before object is created
- **Solution**: Add null checks in templates: `data-bind="if: $data && $data.property"`

**Issue**: Effects don't appear in factory buff lists
- **Cause**: `applyBuffs()` called before `initDemands()` or targets don't exist
- **Solution**: Ensure correct initialization order in Island constructor

**Issue**: Knockout components not rendering
- **Cause**: Components registered after `ko.applyBindings()` is called
- **Solution**: Call `registerComponents()` before `ko.applyBindings()` (main.ts:462-465)

### Debugging Workflow

1. **Enable Knockout Debug Mode**:
   ```javascript
   // Add to main.ts for development:
   ko.options.deferUpdates = false;  // Immediate updates for easier debugging
   ```

2. **Check Template Registration**:
   ```javascript
   // Verify specific template exists:
   if (!ko.templates['factory-config-dialog']) {
       console.error('Template not loaded');
   }
   ```

3. **Inspect Observable Values**:
   ```javascript
   // Check observable values and subscriptions:
   const factory = window.view.selectedFactory();
   console.log('Input amount:', factory.inputAmount());
   console.log('Buildings required:', factory.buildings.required());
   console.log('Boost factor:', factory.boost());
   ```

4. **Trace Initialization Steps**:
   - Add console.log statements in Island constructor
   - Verify order: create → initDemands → applyBuffs → persistBuildings
   - Check that assetsMap contains all required GUIDs

5. **Template Context Debugging**:
   ```html
   <!-- Add to templates for debugging: -->
   <!-- ko if: false -->
   <div data-bind="text: JSON.stringify($data)"></div>
   <!-- /ko -->
   ```

### Performance Debugging

For slow binding updates or infinite loops:
1. **Check Computed Observable Chains**: Look for circular dependencies
2. **Monitor Subscription Counts**: Excessive subscriptions can slow performance
3. **Use `pureComputed`**: Prefer `ko.pureComputed` over `ko.computed` for better performance

Remember: Most binding errors stem from initialization order issues. Always ensure objects exist before trying to link them or apply effects.

## Presenter Pattern Architecture

The application uses a sophisticated Presenter pattern to decouple data models from UI templates, particularly evident in the population management system implemented by the user.

### ResidencePresenter Class

**Purpose**: Acts as a view model adapter between PopulationLevel data and UI templates
**Key Features**:
- **Instance Management**: Maintains observable reference to current PopulationLevel via `instance` property
- **Computed Properties**: Provides reactive UI-friendly properties like `name()`, `residents()`, `buildings()`
- **Need Management**: Creates and manages arrays of ResidenceNeedPresenter and NeedCategoryPresenter objects
- **Update Pattern**: `update(populationLevel)` method allows dynamic switching of underlying data

### ResidenceNeedPresenter Class

**Purpose**: Presents individual needs within the UI with proper delegation to PopulationLevelNeed
**Key Architecture**:
- **Delegation Pattern**: All reactive properties delegate to the underlying PopulationLevelNeed instance
- **UI State Management**: Provides `visible`, `checked`, `amount`, `residents` as computed observables
- **Instance Binding**: Uses `instance: KnockoutObservable<PopulationLevelNeed | undefined>` for dynamic binding
- **Write Delegation**: Implements two-way binding for `checked` property that writes back to PopulationLevelNeed

### NeedCategoryPresenter Class

**Purpose**: Groups ResidenceNeedPresenter objects by category with aggregate behavior
**Features**:
- **Category-Level Checking**: Implements select-all/unselect-all behavior across need category
- **Visibility Management**: Shows/hides categories based on whether they contain visible needs
- **Collection Management**: Maintains `residenceNeeds` array and filtered `visibleResidenceNeeds`

### Construction Order and Class Interactions

**Critical Order (Island Constructor - world.ts:902-967)**:
1. **PopulationLevel Creation** (lines 902-906): Population levels created first with empty need management
2. **ResidenceBuilding Creation** (lines 908-912): Residence buildings created and linked to population levels  
3. **Need Initialization** (lines 922-932): `residence.initDemands()` creates ResidenceNeed objects
4. **Population-Level Need Creation** (lines 356-370): In `PopulationLevel.addResidence()`, PopulationLevelNeed objects created
5. **Presenter Creation** (lines 714-750): ResidencePresenter objects built from need categories and populate their nested arrays

### Template Integration Patterns

**Factory-Tile Template**: Uses Template class pattern for hierarchical data access
- Access pattern: `$data.instance().modules` where `$data` is Template and `instance()` resolves to actual Factory
- UI binding: `visible: $data.instance().visible` uses Template delegation to underlying asset
- Module iteration: `foreach: $data.instance().modules` accesses reactive module arrays

**Factory-Config-Dialog Template**: Direct binding to selected factory
- Binding context: `with: $root.selectedFactory()` establishes factory as data context
- Property access: `$data.name`, `$data.boost()`, `$data.modules` direct to factory properties
- Collapsible sections: Uses knockout component system for expandable UI sections

### Presenter Pattern Benefits

1. **Separation of Concerns**: Templates bind to presenter properties, not raw data models
2. **Computed Property Optimization**: Presenters provide optimized computed observables for UI-specific calculations
3. **Dynamic Data Binding**: `update()` methods allow presenters to switch underlying data without template changes
4. **Type Safety**: Presenter classes provide strongly-typed interfaces for template binding
5. **UI State Management**: Presenters handle UI-specific state that shouldn't pollute data models



## Testing and Validation

The project includes comprehensive automated testing using Playwright for browser automation.

### Quick Start

#### 1. Install Test Dependencies
```bash
npm install
npx playwright install
```

#### 2. Build and Test
```bash
npm run build    # Build the application
npm test         # Run all tests
```

### Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests (headless) |
| `npm run test:headed` | Run with visible browser |
| `npm run test:ui` | Interactive test runner |
| `npm run test:debug` | Debug mode with inspector |
| `npm run test:binding` | Only binding validation tests |
| `npm run test:computed` | Only calculation tests |
| `npm run test:e2e` | Only e2e integration tests |
| `npm run test:factory-dialogs` | Test factory config dialog bindings |
| `npm run test:report` | View HTML test report |

### What Gets Tested

The test suite validates three main areas:

#### Knockout Binding Validation
- Templates bind without errors
- Components register correctly
- No observable unwrapping errors
- Template loading works properly
- Factory config dialogs for all categories open without binding errors

#### Computed Observable Calculations
- Factory production calculations (inputAmount, buildings.required)
- Population need calculations (amount, residents)
- Boost and productivity modifiers
- Tests use params.js values for robust validation

#### End-to-End Workflows
- Application initialization order
- localStorage persistence
- UI rendering
- Global state management

### Test Helpers

The test suite provides helper classes in `tests/helpers/`:

**ConfigLoader** - Manages localStorage and fixture loading:
```typescript
const configLoader = new ConfigLoader();
await configLoader.loadConfig(page, 'tests/fixtures/basic.json');
await configLoader.setDebugMode(page, true);
```

**BindingErrorDetector** - Detects Knockout binding errors:
```typescript
const errorDetector = new BindingErrorDetector();
errorDetector.listenForErrors(page);
expect(errorDetector.hasBindingError()).toBe(false);
```

**ComputedValueAsserter** - Validates computed observables:
```typescript
const asserter = new ComputedValueAsserter();
await asserter.assertEquals(
  page,
  'window.view.island().factories[0].inputAmount()',
  expectedValue,
  { tolerance: 0.01 }
);
```

**FixtureManager** - Creates test configurations:
```typescript
const fixtureManager = new FixtureManager();
const config = fixtureManager.generateFixture({
  populationLevels: [{ guid: 1010343, residents: 1000, buildings: 5 }]
});
```

### Test Fixtures

Test fixtures are JSON files in `tests/fixtures/` that configure localStorage state:

- **basic.json** - Minimal configuration for binding tests
- **with-data.json** - Sample data for calculation tests
- **empty.json** - Clean slate configuration

Create custom fixtures with localStorage key patterns:
- `{guid}.buildings.constructed` - Building count
- `{guid}.boost` - Productivity boost
- `{popGuid}[{needGuid}].checked` - Need activation
- `settings.{option}` - Application settings

### Debugging Tests

**Enable Knockout Debug Mode:**
```typescript
await configLoader.setDebugMode(page, true);
```

**Use Playwright Inspector:**
```bash
npm run test:debug
```

**View Test Traces:**
Failed tests generate traces in `test-results/`:
```bash
npx playwright show-trace test-results/.../trace.zip
```

**Check Console Errors:**
```typescript
const errors = errorDetector.getFormattedBindingErrors();
console.log(errors);
```

### Writing New Tests

1. Create test file in appropriate directory (`binding/`, `computed/`, `e2e/`)
2. Import helpers from `'../helpers'`
3. Use params.js values for expected calculations
4. Add descriptive test names and messages
5. Run locally before committing

Example test:
```typescript
import { test, expect } from '@playwright/test';
import { ConfigLoader, ComputedValueAsserter } from '../helpers';

test('factory calculation test', async ({ page }) => {
  const configLoader = new ConfigLoader();
  const asserter = new ComputedValueAsserter();

  await configLoader.loadConfig(page, 'tests/fixtures/with-data.json');
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Get params value
  const cycleTime = await page.evaluate(() =>
    window.view.island().factories[0].cycleTime
  );

  // Calculate expected
  const expected = 60 / cycleTime;

  // Assert
  await asserter.assertEquals(
    page,
    'window.view.island().factories[0].someValue()',
    expected
  );
});
```

### Troubleshooting Tests

**Test timeouts**: Increase timeout with `test.setTimeout(60000)`

**Elements not found**: Add wait: `await page.waitForSelector('.element')`

**localStorage not persisting**: Use `configLoader.loadConfig()` before navigation

**Webpack not starting**: Check port 8080 is available

**Binding errors**: Enable debug mode and check console output

### CI/CD Integration

Tests run automatically in CI:
- Headless mode
- 2 retries on failure
- Single worker for determinism
- HTML report generated

### Type Checking and Build Validation

Always run type checking after changes:

```bash
npm run type-check  # Check types
npm run build      # Validate build
npm run dev        # Test in browser
```

### Additional Resources

- **Full Test Documentation**: [tests/README.md](../tests/README.md)
- **Testing Framework Knowledge**: [tests/CLAUDE.md](../tests/CLAUDE.md)
- **Playwright Documentation**: https://playwright.dev

## Getting Help

- Use Cursor's AI assistant for code questions
- Check `CLAUDE.md` for AI-specific development notes
- Review existing components for patterns and conventions

The AI assistant in Cursor can help with:
- Understanding complex TypeScript types
- Debugging Knockout.js binding issues
- Writing new components following project patterns
- Optimizing performance and build processes

Remember: The AI is your development partner - use it liberally throughout the development process!