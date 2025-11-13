# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Anno 117 Calculator is a web-based calculator for the computer game Anno 117, built to compute production chains and resource consumption based on population requirements. The migration from JavaScript to TypeScript has been completed, with legacy JavaScript files in the `js/` directory serving as reference only.

## Development Commands

### Build Commands
- `npm run build` - Build the project with webpack
- `npm run build:ts` - TypeScript compilation only
- `npm run dev` - Development mode with webpack watch
- `npm run type-check` - TypeScript type checking without emitting files
- `npm run type-check:watch` - TypeScript type checking in watch mode

### Migration Scripts
- `npm run migrate` - Run TypeScript migration helper
- `npm run fix-types` - Fix TypeScript errors automatically
- `npm run fix-critical` - Fix critical TypeScript errors
- `npm run generate-types` - Generate type definitions from params

### Translation Management
- `npm run check-translations` - Check translation completeness in src/i18n.ts
- `npm run check-translations:batch` - Generate batch translation command file
- `/translate <key>` - Translate individual key into all supported languages (slash command)
- `./scripts/auto-translate.sh` - Automated batch translation using Claude headless mode

See [Translation Workflow](#translation-workflow) section below for details.

## Project Architecture

### Dual Source Structure
The project maintains both JavaScript (legacy) and TypeScript (target) versions:
- `js/` - Original JavaScript files (legacy, still referenced by webpack aliases)
- `src/` - TypeScript source files (target)
- `dist/` - Compiled output directory

### Core Modules
- **main.ts** - Application entry point, initializes knockout bindings and global state
- **types.ts** - Comprehensive type definitions for all interfaces and configurations
- **util.ts** - Base classes (NamedElement, DLC, Option) and utility functions
- **params.ts** - Game configuration data (generated from Anno 117 assets)
- **population.ts** - Population management and residence calculations
- **factories.ts** - Production building and factory logic
- **world.ts** - Session, region, and island management
- **trade.ts** - Trade route and NPC trader management
- **views.ts** - UI view models and dialogs
- **components.ts** - Knockout component registration
- **i18n.ts** - Internationalization and text management
- **production.ts** - Product, Demand, and Buff management classes
- **buffs.ts** - AppliedBuff and ExtraGoodProduction classes (separated to resolve circular imports)

### Key Design Patterns
- **Knockout.js MVVM** - Uses observables for reactive UI updates
- **Global State Management** - `window.view` object contains all application state
- **Configuration-Driven** - All game data loaded from `params.ts` configuration
- **Module System** - Mix of ES6 imports and AMD requires for compatibility

### Template System
HTML templates are loaded from `templates/` directory via webpack context and registered as Knockout templates.

## TypeScript Migration Status

Migration completed. Legacy JavaScript files in `js/` are reference-only.

### Build Process
- Entry: `src/main.ts` → Output: `dist/calculator.bundle.js`
- External deps: Knockout, jQuery, Bootstrap loaded globally
- Templates loaded via webpack's require.context()

## Key Files
- @src/main.ts:292 - `init()` function, main initialization sequence
- @src/types.ts - Type definitions for all interfaces
- @docs/DEVELOPER_GUIDE.md - Complete development documentation
## Testing and Validation

Always run type checking after making changes:
```bash
npm run type-check
```

For build validation:
```bash
npm run build
```

For binding validation after every build:
```bash
npm run test:factory-dialog
```

### Automated Testing

The project uses Playwright for comprehensive browser automation testing. Tests validate:
- Knockout binding correctness (templates, components, observables)
- Computed observable calculations (factories, population, production chains)
- Application initialization and localStorage persistence

#### Test Commands
```bash
npm test                 # Run all tests
npm run test:headed      # Run with visible browser
npm run test:ui          # Interactive test runner
npm run test:debug       # Debug mode with inspector
npm run test:binding     # Knockout binding validation tests
npm run test:computed    # Calculation verification tests
npm run test:e2e         # End-to-end integration tests
```

#### Test Resources
- **Full Testing Guide**: [docs/DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md#testing-and-validation)
- **Test Documentation**: [tests/README.md](tests/README.md)
- **Testing Knowledge**: [tests/CLAUDE.md](tests/CLAUDE.md) - Playwright constraints and calculation formulas

## UI Design Guidelines (IMPLEMENTED)

### Template Styling Standards
- **Use Project-Specific Classes**: Prefer `inline-list-centered` over `d-flex align-items-center` for consistency with project styles
- **Residents Display Pattern**: Always display total residents as read-only text with `formatNumber()`, never as number input
- **Icon-First Design**: Use visual icons (`icon_resource_population.png`, `icon_house_white.png`) instead of text headers
- **Conditional Content**: Show residence type names only when multiple residences exist per population level
- **Visual Hierarchy**: Distinguish editable inputs (buildings) from calculated displays (residents) through styling

### Table Header Improvements
- Remove traditional table headers for cleaner UI
- Use `table-striped table-fixed` classes for consistent column widths  
- Implement icon-based column identification
- Apply subtle backgrounds (`rgba(0,0,0,0.05)`) for grouping related information

## Architecture Notes
- `types.config.ts` is generated - never edit directly
- Use `number-input-increment` for numeric inputs
- Most assets created per island; regions/sessions/buffs are global
- Circular imports: production.ts → buffs.ts ← factories.ts

### CSS Class Naming Conventions
- **Product tiles**: Use `product-tile` and `product-tile-*` classes (e.g., `product-tile-name`, `product-tile-icon`, `product-tile-amount`)
- **Old naming**: `ui-fchain-item` classes have been removed - do NOT use them
- **Dark mode support**: All product-tile classes have `.bg-dark .product-tile` variants in style.css

## Critical Initialization Order (world.ts:518)
1. Create objects (consumers, factories, products)
2. `f.initDemands(assetsMap)` - factories register in products  
3. `e.applyBuffs(assetsMap)` - effects create AppliedBuff for targets
4. `persistBuildings()` - load saved configurations

## Debugging Knockout Errors
- **Template errors**: Check `ko.templates` object, add null checks
- **Effects missing**: Wrong initialization order (applyBuffs before initDemands)
- **Components broken**: Call registerComponents() before ko.applyBindings()

Quick debug: `console.log(Object.keys(ko.templates), window.view.island().factories[0].buffs.length)`

## Knockout Binding Debugging (Development Only)

### Debug Binding Handler
- **Purpose**: Log binding context and asset information for troubleshooting template issues
- **Location**: src/components.ts (registered alongside other binding handlers)
- **Usage Patterns**:
  - Basic debugging: `<div data-bind="debug: true">...</div>`
  - Labeled debugging: `<div data-bind="debug: 'Factory Tile'">...</div>`
- **Behavior**:
  - **init callback**: Logs initial binding information when element is first bound
  - **update callback**: Logs changes when bound observables update (requires verbose mode)
  - Only active when `window.view.debug.enabled()` is true

### Debug Utilities (Global Access)
Available via `window.debugKO` object for ad-hoc debugging from browser console:

```javascript
// Inspect specific element by selector
debugKO.inspect('#factory-config-dialog');
debugKO.inspect('.factory-tile');

// Get asset type information
const type = debugKO.type(window.view.selectedFactory());
console.log('Type:', type); // "Factory" or "Template(Factory)"

// Log detailed asset information
debugKO.log(window.view.island(), 'Current Island');

// Get full binding context
const context = debugKO.context(document.querySelector('.factory-tile'));
console.log(context.assetInfo); // { guid, name, type, region }
```

### Enabling Debug Mode

**Via localStorage** (Persists across page reloads):
```javascript
// Before page load - set in browser console
localStorage.setItem('debug.enabled', 'true');
// Then reload page to see all binding initialization logs

// To disable
localStorage.setItem('debug.enabled', 'false');
// Or: localStorage.removeItem('debug.enabled');
```

**Via Observable** (Auto-persists to localStorage):
```javascript
// In browser console - changes automatically persist
window.view.debug.enabled(true);
window.view.debug.verboseMode(true); // Optional: log all update events

// To disable
window.view.debug.enabled(false);

// Check current status
console.log('Debug enabled:', window.view.debug.enabled());
```

**Programmatically** (For development):
```typescript
// Add to src/main.ts before ko.applyBindings()
window.view.debug.enabled(true);
window.view.debug.verboseMode(true);
```

### Asset Type Detection
The debug utilities automatically identify:
- **Template Wrappers**: Detects and unwraps `Template` objects via `instance` observable
- **Class Names**: Uses constructor.name for Factory, Consumer, PopulationLevel, etc.
- **NamedElement Properties**: Identifies objects with guid + name properties
- **Observable Status**: Distinguishes observables from plain values

### Template Instance Resolution
Debug utilities handle the Template pattern used in factory-tile/population-tile:
```javascript
// If $data is Template object with instance observable:
debugKO.type($data); // "Template(Factory)"
debugKO.log($data);  // Automatically unwraps to show actual Factory info
```

### Common Debug Patterns
```javascript
// Debug specific factory
const factory = window.view.island().factories[0];
debugKO.log(factory, 'Timber Factory');

// Inspect population level binding
const popLevel = window.view.selectedPopulationLevel();
debugKO.log(popLevel, 'Current Population');

// Check binding context hierarchy
const ctx = ko.contextFor($('#some-element')[0]);
console.log('$data:', ctx.$data);
console.log('$root:', ctx.$root);
console.log('$parent:', ctx.$parent);

// List all observable properties on an object
const factory = window.view.selectedFactory();
Object.keys(factory).forEach(key => {
    if (ko.isObservable(factory[key])) {
        console.log(`${key}:`, factory[key]());
    }
});
```

### Console Output Format
When debug binding fires or manual inspection occurs:
```
[DebugKO] Factory Tile - Initial Binding
  Element: <div class="factory-tile">
  Asset Type: Factory
  Is Observable: false
  Asset Info: {
    guid: 1010517,
    name: "Timber Mill",
    type: "Factory",
    region: "New World"
  }
  Binding Context $data: {...}
```

### Implementation Details
- **Files**:
  - `src/util.ts:542-772` - Debug utility functions (isKnockoutObservable, safeUnwrap, getAssetType, debugBindingContext, logAssetInfo, inspectElement)
  - `src/components.ts:75-134` - Debug binding handler (ko.bindingHandlers.debug with init/update)
  - `src/main.ts:29-35` - Global debugKO object
  - `src/main.ts:79-110` - Debug settings with localStorage persistence
  - All 15 templates in `templates/*.html` - Debug bindings at strategic points
- **Type Safety**: Uses strict typing with `unknown` types, no `any` casts
- **Performance**: Zero overhead when debug mode disabled
- **Safe Unwrapping**: Handles write-only observables gracefully
- **Persistence**: Debug settings automatically save to/restore from localStorage
  - `localStorage.setItem('debug.enabled', 'true')` enables debug mode across reloads
  - Setting `window.view.debug.enabled(true)` automatically persists to localStorage
  - Subscriptions on observables handle two-way sync (lines 102-110 in main.ts)

### Debugging Binding Errors
When template bindings fail:
1. **Add debug binding**: `<div data-bind="debug: 'Problem Area', visible: someObservable">`
2. **Enable debug mode**: `window.view.debug.enabled(true)`
3. **Reload page**: Check console for [DebugKO] output
4. **Inspect binding**: Use `debugKO.inspect()` on the element
5. **Check asset info**: Verify guid, name, type are correct

### Gotchas
- **Circular References**: Binding contexts contain circular references ($root → island → factories → island). Don't use `JSON.stringify()` directly.
- **Observable vs Value**: Check `ko.isObservable()` before calling `()` to unwrap
- **Template Timing**: `$data.instance()` may return different objects as parent updates
- **Verbose Mode Impact**: Update logging fires on every observable change; use sparingly
- **localStorage Persistence Required**: Debug mode won't persist without the localStorage restore code (main.ts:87-110). Observable subscriptions handle automatic saving on changes.

## Design System and Typography

### Font Configuration
- **Primary Font**: Pelago (`pelago-regular.otf`) for all body text and UI elements
- **Heading Font**: Albertus Nova for headings (h1, legends) and special emphasis
- **Base Font Size**: 16px (increased from 14px for better readability)
- **Font Loading**: Use `@font-face` with `font-display: swap` for performance
- **Letter Spacing**: Applied subtle letter-spacing to improve readability

### Color Scheme (Warm Earth Tones)
- **Body Background**: `#d4b89b` (warm brown)
- **Navbar Background**: `#ffe9de` (light peachy cream)
- **Input Fields**: `#c4a485` (darker tone, ~10% darker than body)
- **Modal Dialogs**: Dark blue theme
  - Content: `#2c3e50` (medium dark blue)
  - Header/Footer: `#1a252f` (darker blue)
  - Text: `#ecf0f1` (light blue-gray)
- **UI Components**: Semi-transparent navbar color `rgba(255, 233, 222, 0.9)`

### CSS Component Patterns
- **Form Controls**: Use consistent background `#c4a485` and border `#abb8c3`
- **Custom Selects**: Match form control styling for consistency
- **Modal Separation**: Dark blue modals contrast with warm main theme
- **Button Text Color**: CRITICAL - Button text color should be white/light, not transparent
- **Number Input Increment**: Maintain consistent width (16px) across light/dark modes

### Font Size Hierarchy
- **Body**: 16px (Pelago)
- **H1**: 40px (Albertus Nova)
- **Legends**: 22px (Albertus Nova)
- **UI Components**: 13-14px (factory names, amounts, etc.)
- **Small Text**: 11-12px (load indicators, help text)
- **Input Groups**: 0.8rem

## Bootstrap 4 Tab Implementation (Version 4.5.2)

### Critical Requirements for Tab Switching

**Single Active Tab Rule**: Only ONE tab/tab-pane should have the `active` class at initialization. Bootstrap will manage active states during tab switching.

**Button vs Link Syntax**:
```html
<!-- For <button> elements - use data-target -->
<button class="nav-link" data-toggle="tab" data-target="#tab-pane-id"
        aria-controls="tab-pane-id" aria-selected="false">
    Tab Label
</button>

<!-- For <a> elements - use href -->
<a class="nav-link" data-toggle="tab" href="#tab-pane-id"
   aria-controls="tab-pane-id" aria-selected="false">
    Tab Label
</a>
```

### Common Tab Implementation Errors

**Error 1: Multiple Active Tabs**
```html
<!-- WRONG - all tabs marked active -->
<button class="nav-link active" data-toggle="tab">Tab 1</button>
<button class="nav-link active" data-toggle="tab">Tab 2</button>

<!-- CORRECT - only one active tab -->
<button class="nav-link active" data-toggle="tab">Tab 1</button>
<button class="nav-link" data-toggle="tab">Tab 2</button>
```

**Error 2: Custom Click Handlers Interfering**
```html
<!-- WRONG - custom handler prevents Bootstrap behavior -->
<button class="nav-link" data-toggle="tab" data-bind="click: customHandler">

<!-- CORRECT - let Bootstrap handle tab switching -->
<button class="nav-link" data-toggle="tab">
```

**Error 3: Wrong Attribute for Buttons**
```html
<!-- WRONG - buttons should use data-target, not href -->
<button data-toggle="tab" href="#tab-id">

<!-- CORRECT -->
<button data-toggle="tab" data-target="#tab-id">
```

### Accessibility Attributes

Always include ARIA attributes for proper accessibility:
```html
<button class="nav-link" data-toggle="tab" data-target="#factories-tab"
        role="tab" aria-controls="factories-tab" aria-selected="false">
```

### Tab Pane Structure

Tab content panes must match the active state of their corresponding tab button:
```html
<!-- Tab navigation -->
<button class="nav-link active" data-target="#tab1">Tab 1</button>
<button class="nav-link" data-target="#tab2">Tab 2</button>

<!-- Tab content - matching active states -->
<div class="tab-pane fade show active" id="tab1">Content 1</div>
<div class="tab-pane fade" id="tab2">Content 2</div>
```

### Knockout Integration with Bootstrap Tabs

When generating tab IDs dynamically with Knockout:
```html
<!-- Tab button -->
<button data-bind="attr: {'data-target': '#tab-' + $data.guid(),
                          'aria-controls': 'tab-' + $data.guid()}">

<!-- Matching tab pane -->
<div data-bind="attr: {'id': 'tab-' + $data.guid()}">
```

**Critical**: Don't add `active` class via Knockout bindings on all items in a foreach loop. Set ONE default active tab in the template, let Bootstrap manage the rest.

## Generated File Notes

- Items create AppliedBuff for each target. This tracks whether the effect is applied to the specific factory in AppliedBuff.scaling (knockout observable storing a float).
- Initialization order in island constructor is important. Buffs register in factories. Factories register in products. Therefore, initDemands and applyBuffs exist to establish the links after objects are created. Only after that values are loaded from localStorage (as part of calling the persist* method)
- Most assets are created for each island. Only some (regions, seesions, buffs, need categories) only exist once globally.
- Avoid to use `as any` casts when generating code. Do not use them to fix typescript errors.
- Use inline-list* classes from styles.css when creating floating divs.
- types.ts is automatically generated and must not be manually edited.

## Storage Architecture (Updated 2025-11)

### SubStorage Pattern
The application uses the `Storage` class (exported as `SubStorage` in main.ts) to manage localStorage with nested JSON structure:

**Storage Class** (src/world.ts:34-152):
- Each Storage instance manages one top-level localStorage key
- Data stored as JSON string, parsed into `this.json` object
- Internal Map for quick lookups
- Debounced saving (0ms timeout) to prevent excessive writes

**Three SubStorage Instances**:
1. `calculatorSettings = new SubStorage("calculatorSettings")` (main.ts:350)
   - Stores settings like `settings.showAllProducts`, `settings.decimalsForBuildings`
   - Keys accessed via `settingsStorage.getItem("settings.propertyName")`

2. `sessionSettings = new SubStorage("sessionSettings")` (main.ts:351)
   - Stores session-level configuration
   - Used for session effects persistence

3. `globalEffects = new SubStorage("globalEffects")` (main.ts:416)
   - Stores global effect scaling values
   - Keys: `{effectGuid}.scaling`

**Island Storage** (per-island JSON):
- Each island has its own Storage instance: `new Storage(islandName)`
- Island name used as localStorage key (e.g., "Latium", "All Islands")
- Contains nested JSON with session, building counts, etc.
- See tests/CLAUDE.md for complete structure

### ALL_ISLANDS Constant
- Defined in src/util.ts:51 as `"All Islands"`
- Used as storage key for the special all-islands view
- Session GUID: 37135 (Global/Meta session)
- Must be included in all test fixtures

## Translation Workflow

### Overview
The calculator supports 12 languages. All translation keys in `src/i18n.ts` must include all languages for completeness. See `src/CLAUDE.md` for i18n-specific technical details.

### Required Languages (12 total)
1. english
2. french
3. polish
4. spanish
5. italian
6. german
7. brazilian
8. russian
9. simplified_chinese
10. traditional_chinese
11. japanese
12. korean

### Checking Translation Completeness

**Check all translations:**
```bash
npm run check-translations
```

**Generate batch translation file:**
```bash
npm run check-translations:batch
# Creates scripts/translate-all.txt with /translate commands
```

### Manual Translation (Interactive)

**Translate individual key:**
```bash
/translate keyName
```

Example: `/translate requiredNumberOfBuildings`

The `/translate` command (defined in `.claude/commands/translate.md`):
- Reads the current translation entry
- Identifies missing languages
- Generates translations for all 12 languages
- Updates src/i18n.ts with complete translations
- Runs type-check for validation

### Automated Batch Translation (Headless)

**Using auto-translate script:**
```bash
# Preview what would be done
./scripts/auto-translate.sh --dry-run

# Translate specific key only
./scripts/auto-translate.sh --key keyName

# Translate first N incomplete keys
./scripts/auto-translate.sh --max 5

# Translate all incomplete keys
./scripts/auto-translate.sh
```

**How it works:**
1. Runs `check-translations.js` to identify incomplete keys
2. Uses Claude Code headless mode to execute `/translate` for each key
3. Applies rate limiting (default 2s delay between translations)
4. Logs results to `logs/translate-*.json`
5. Runs type-check to verify all changes

**Important notes:**
- Requires `claude` CLI to be installed and in PATH
- Uses `--permission-mode acceptEdits` to auto-approve file edits
- Processes translations sequentially to respect rate limits
- See `docs/CLAUDE_HEADLESS.md` for detailed headless mode documentation

### Best Practices

1. **Always check completeness before commits:**
   ```bash
   npm run check-translations
   ```

2. **Add translations when adding new UI text:**
   - Add key to `src/i18n.ts` with at least English translation
   - Run `/translate keyName` to complete all languages

3. **Use consistent key naming:**
   - Descriptive names: `requiredNumberOfBuildings` not `buildings`
   - camelCase format
   - Group related keys with common prefixes

4. **Language code consistency:**
   - Use `simplified_chinese` and `traditional_chinese` (NOT `chinese`)
   - Use `brazilian` for Brazilian Portuguese
   - See `src/CLAUDE.md` for complete language code reference

### Troubleshooting

**Translation script fails:**
- Verify `claude` CLI is installed: `which claude`
- Check logs in `logs/translate-*.json` for error details
- Try manual translation with `/translate keyName`

**Type errors after translation:**
- Run `npm run type-check` to see errors
- Verify quote consistency in translations
- Check for special characters that need escaping

**Incomplete translations persist:**
- Clear any background processes: check running bash shells
- Manually add missing translations to src/i18n.ts
- Run `npm run check-translations` to verify

## Product-Based Presenter Architecture (PLANNED)

### Motivation and Design Goals

The current factory-centric UI displays multiple tiles per product (one per factory), making it difficult to:
- See total product supply/demand at a glance
- Manage supplier selection (factories, trade routes, extra goods, passive trade)
- Create and manage trade routes in context of production needs

The Product-Based Presenter system addresses these issues by:
1. **Single tile per product** showing aggregate production/demand
2. **Unified supplier selection** dropdown integrating all supplier types
3. **Tabbed factory management** within product-config-dialog
4. **Integrated trade route creation** from supplier selection

### ProductPresenter Class Structure

**Purpose**: Wraps Product with UI-specific computed observables and supplier management

**Key Properties:**
- `instance: KnockoutObservable<Product>` - Current product
- `factoryPresenters: KnockoutObservableArray<FactoryPresenter>` - Nested presenters for each factory
- `availableSuppliers: KnockoutComputed<SupplierOption[]>` - All supplier options for dropdown
- `defaultSupplier: KnockoutComputed<Supplier>` - Delegates to product.defaultSupplier
- `totalProduction: KnockoutComputed<number>` - Sum from all suppliers
- `totalDemand: KnockoutComputed<number>` - Total product demand
- `netBalance: KnockoutComputed<number>` - Production minus demand

**Methods:**
- `selectSupplier(option: SupplierOption)` - Handles dropdown selection, creates trade routes if needed
- `createTradeRoute(island, isExport, minAmount)` - Creates trade route and sets as default supplier
- `openConfigDialog()` - Opens product-config-dialog

**Implementation Location**: `src/presenters.ts` (new file)

### FactoryPresenter Class (Nested Presenter)

**Purpose**: Represents individual factory within ProductPresenter

**Key Properties:**
- `factory: Factory` - Underlying factory instance
- `parentProduct: ProductPresenter` - Reference to parent presenter
- Delegated observables: `name`, `buildings`, `boost`, `outputAmount`, `modules`, `items`

**Methods:**
- `setAsDefaultSupplier()` - Sets this factory as default supplier for parent product
- `isDefaultSupplier()` - Checks if this factory is current default

**Implementation Location**: `src/presenters.ts` (new file)

### SupplierOption Interface

```typescript
interface SupplierOption {
    type: 'factory' | 'extra_good' | 'trade_island' | 'trade_route' | 'passive_trade';
    supplier?: Supplier;        // For direct supplier selection
    island?: Island;            // For trade route creation
    label: string;              // Display name
    icon: string;               // Icon path
}
```

### UI Templates

**product-tile.html**: Replaces factory-tile with product-level view
- Product icon and name
- Default supplier badge
- Total production and net balance
- Click opens product-config-dialog

**product-config-dialog.html**: Replaces factory-config-dialog
- Supplier selection dropdown (factories, islands, extra goods, passive trade)
- Tabs: Factories | Extra Goods | Trade Routes | Production Chain
- Factories tab contains factory-config-section for each factory

**factory-config-section.html**: Individual factory configuration within product dialog
- Buildings input, boost display
- Modules, items, aqueduct buff
- Trade routes for this factory
- All existing factory-config-dialog content

### Initialization Order (Critical)

```typescript
// In Island constructor (world.ts:518+)
1. Create objects (factories, products)
2. f.initDemands(assetsMap)           // Factories register in products
3. p.initSuppliers(island)             // Create supplier instances (already exists)
4. e.applyBuffs(assetsMap)             // Effects apply buffs
5. createProductPresenters(island)     // NEW: Create ProductPresenter for each product
6. restoreDefaultSuppliers()           // Load supplier selections from localStorage
7. persistBuildings(factory)           // Load factory state
```

### Supplier Selection Workflow

1. User opens product-config-dialog from product-tile
2. Dropdown populated by `availableSuppliers` computed:
   - Regional factories producing this product
   - Islands with factories (for trade route creation)
   - Extra good suppliers (items affecting factories)
   - Passive trade supplier (always available)
3. User selects supplier:
   - **Factory**: `product.updateDefaultSupplier(factory)`
   - **Island**: Creates `TradeRoute`, sets as default supplier
   - **Extra Good**: `product.updateDefaultSupplier(extraGoodSupplier)`
   - **Passive Trade**: `product.updateDefaultSupplier(passiveTradeSupplier)`
4. Product `demandCalculationSubscription` updates factory demands
5. UI reactively updates via Knockout observables

### Trade Route Integration

**Auto-creation from Supplier Dropdown:**
- Selecting island creates `TradeRoute` with `minAmount = 0`
- Import routes automatically set as default supplier
- Export routes created manually from trade routes tab

**Trade Route Cleanup:**
- Routes with `minAmount == 0` deleted when supplier changes
- User can set `minAmount > 0` to persist route even when not default

**Persistence:**
- TradeManager persists `isDefaultSupplier` flag per route
- Restored on initialization before product presenters created

### Critical Implementation Patterns

**Object Method Preservation:**
```typescript
// ❌ WRONG - loses Knockout methods
const extended = { ...product, totalProduction };

// ✅ CORRECT - preserves methods
product.totalProduction = totalProduction;
```

**Presenter Pattern (from ResidencePresenter):**
- Observable `instance` property for switching underlying data
- Computed observables delegate to `instance().property`
- Nested presenters for hierarchical data (FactoryPresenter within ProductPresenter)
- Direct property addition to preserve Knockout methods

### Files to Create/Modify

**New Files:**
- `src/presenters.ts` - ProductPresenter, FactoryPresenter classes
- `templates/product-tile.html` - Product tile replacing factory-tile
- `templates/product-config-dialog.html` - Product dialog replacing factory-config-dialog
- `templates/factory-config-section.html` - Factory section within product dialog

**Modified Files:**
- `src/views.ts` - Export ProductPresenter
- `src/main.ts` - Add `selectedProduct` observable, create presenters
- `src/world.ts` - Integrate presenter creation in Island constructor
- `index.html` - Replace `foreach: factories` with `foreach: productPresenters`
- `src/components.ts` - Register product-related components

### Benefits

1. **Unified Product View**: Single tile shows total production/demand for product
2. **Integrated Supplier Management**: All supplier types in one dropdown
3. **Contextual Trade Route Creation**: Create routes directly from production management
4. **Tabbed Factory Management**: All factories for product in one dialog
5. **Consistent Patterns**: Follows ResidencePresenter pattern
6. **Reactive Updates**: Knockout observables handle all UI updates automatically

### References

- **Presenter Pattern**: ResidencePresenter (views.ts:729-785)
- **Supplier Interface**: suppliers.ts:10-22, already implemented
- **Template Pattern**: Template class (views.ts:132-227)
- **Demand System**: Product.demandCalculationSubscription (production.ts:223-240)
- **Trade Routes**: TradeList, TradeRoute (trade.ts)
- **Extra Good Suppliers**: ExtraGoodSupplier (suppliers.ts:100-189)
- The island in presenter classes must be an observable value.