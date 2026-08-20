# Template Design Guidelines for Anno Calculator

## UI Design Patterns
- **Dark mode support**: All product-tile classes have `.bg-dark .product-tile` variants in style.css

### Residents Display Guidelines
When displaying resident counts in templates, follow these patterns:

**Total Residents Display**:
- Use `inline-list-centered` class instead of `d-flex align-items-center` for consistency with project styles
- Display as read-only text with `formatNumber()`, never as number input
- Use residents icon (`icon_resource_population.png`) with proper title binding: `$root.texts.residents.name()`
- For prominent display, use subtle background styling: `background-color: rgba(0,0,0,0.05); border-radius: 4px/8px`

**Conditional Content Display**:
- Show residence type names only when multiple residences exist: `<!-- ko if: $parent.instance().allResidences().length > 1 -->`
- Use empty cells with comments for single residence scenarios to maintain table structure

### Table Header Improvements
**Remove Cluttered Headers**: Replace traditional table headers with visual icons and intuitive layout
- Replace text headers like "Residence Type | Buildings | Residents | Effects | Actions"
- Use `table-striped table-fixed` classes for consistent styling
- Implement icon-based column identification instead of text headers

### Layout Classes

**Use Project-Specific Classes**:
- `inline-list-centered`: For horizontally aligned content with icons and text
- `inline-list`: For floating effect icons and similar elements  
- `table-fixed`: For consistent table column widths
- `collapsible`: Use `<collapsible>` component for grouping related fields in dialogs (e.g., "From Area Effects & Specialists").

**Patron Effect Styling**:
- **Visual Offset**: Patron effects (Veneration/Ritual) should use `padding-left: 24px` to align visually with their interactive checkbox counterparts.

### Template Structure Patterns

**Collapsible Section**:
```html
<collapsible params="label: $root.texts.areaEffects.name(), id: $parent.populationBuffsId">
    <table class="table table-sm table-striped table-fixed mb-0">
        <tbody data-bind="foreach: populationBuffs">
            <tr data-bind="visible: visible">
                <td data-bind="style: {'padding-left': isPatronEffect ? '24px' : '0'}">
                    <buff-display params="buff: appliedBuff"></buff-display>
                </td>
                <td class="text-right">
                    <div class="inline-list-centered justify-content-end">
                        <img class="icon-sm icon-light mr-2" src="../icons/icon_resource_population.png" />
                        <span data-bind="text: formatNumber(totalPopulation())"></span>
                    </div>
                </td>
            </tr>
        </tbody>
    </table>
</collapsible>
```

**Population Summary Section**:
```html
<div class="d-flex justify-content-between align-items-center mb-3 p-3" style="background-color: rgba(0,0,0,0.05); border-radius: 8px;">
    <h5 class="mb-0" data-bind="text: $data.instance().name()"></h5>
    <div class="inline-list-centered">
        <img class="icon-sm icon-light mr-2" src="../icons/icon_resource_population.png" data-bind="attr: {title: $root.texts.residents.name()}" />
        <strong data-bind="text: formatNumber($data.instance().residents())"></strong>
    </div>
</div>
```

**Individual Residence Row**:
```html
<td style="width: 20%;">
    <div class="inline-list-centered">
        <img class="icon-sm icon-light mr-2" src="../icons/icon_resource_population.png" />
        <span data-bind="text: formatNumber($data.residents())"></span>
    </div>
</td>
```

### Icon Usage Standards
- **Residents**: `icon_resource_population.png`
- **Buildings**: `icon_house_white.png`
- **Effects**: `icon_marketplace_2d_light.png`
- Always include proper `title` attributes for accessibility
- Use `icon-sm icon-light` classes for consistent sizing

### Visual Hierarchy Principles
1. **Editable vs Read-only**: Clearly distinguish inputs (buildings) from calculated displays (residents)
2. **Information Density**: Use subtle backgrounds and spacing to group related information
3. **Progressive Disclosure**: Show residence type names only when multiple types exist
4. **Icon-First Design**: Lead with visual icons rather than text labels where possible

## Template-Specific Notes

### population-level-config-dialog.html
- Implements headerless table design with conditional residence type display
- Uses population summary section with prominent total residents display
- Follows inline-list-centered pattern for all resident count displays

### population-tile.html  
- Separates editable buildings input from read-only residents display
- Uses background styling to distinguish calculated values
- Maintains compact tile layout while improving visual hierarchy

## Binding Context Reminders
- Use `$root.texts.residents.name()` for localized text
- Use `formatNumber()` and `formatPercentage()` as global functions (no $root prefix)
- Access nested properties carefully: `$data.need.product` not `$data.product`

## Knockout Component Binding Syntax (CRITICAL)

### Correct Syntax Rules
**Component bindings must use colon `:` for params, NOT equals `=`**

```html
<!-- CORRECT -->
<div data-bind="component: 'component-name', params: {property: value}"></div>
<custom-component params="property: value"></custom-component>

<!-- WRONG - causes parse errors -->
<div data-bind="component: 'component-name', params={'property': value}"></div>
<div data-bind="component: 'component-name', params=value"></div>
<custom-component params={'property': value}></custom-component>
```

### Common Errors and Fixes

**Error**: `Unable to parse bindings. Message: missing : after property id`
**Cause**: Using `params=` or `params={'key': value}` instead of `params: {key: value}`

**Examples of Correct Usage**:
```html
<!-- Component with object params -->
<btn-default-supplier params="supplier: $data"></btn-default-supplier>
<trade-route-amount params="supplier: $data.instance().passiveTradeSupplier"></trade-route-amount>

<!-- Component with direct value -->
<div data-bind="component: 'number-input-increment', params: {obs: $data.amount, id: 'input-id'}"></div>

<!-- Custom element syntax -->
<asset-icon params="asset: $data.product"></asset-icon>
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
````

### Key Points
1. **Always use colon**: `params: {key: value}` not `params={key: value}`
2. **No quotes on property names**: `{supplier: $data}` not `{'supplier': $data}`
3. **Consistent across all component types**: Custom elements and data-bind component syntax
4. **Observable unwrapping**: Components should handle observable unwrapping internally if needed

## Read-only gating for derived/aggregate rows (All-Islands Aggregation feature)
- **Prefer the data contract over a template condition.** A control with a sensible read-only rendering should receive the aggregate object and branch internally on `buildings().readOnly` (see `constructed-buildings-input` in `src/components.ts`); `FactoryPresenter.buildings()` / `ResidenceRow.buildings()` already return an `AggregateBuildingsCalc` while aggregating, so the call site passes one object and needs no condition of its own.
- For blocks that must genuinely disappear (supplier pickers, item equip sections), use the `<!-- ko ifEditable: true -->` / `<!-- ko ifAggregated: true -->` virtual bindings, never `visible:` - `visible:` still evaluates the hidden control's `enable:`/`click:` bindings, which throws if the bound object doesn't implement the mutator methods. Sites gating on a *presenter's own* mode rather than the global one (`population-level-config-dialog.html`, `population-tile.html`) use `if:`/`ifnot:` on that presenter's `editable()` / `isAggregateMode()` instead - the dialog can be open on an aggregate row while a real island is selected.
- **Pitfall discovered**: replacing several duplicated inline conditions (e.g. `$root.island().isAllIslands() && $root.settings.aggregateAllIslands.checked()`, repeated across `product-tile.html`/`factory-config-section.html`/`product-config-dialog.html`) with a single shared `ko.pureComputed` on `window.view` caused a real reactivity glitch: switching islands via `<!-- ko with: $data.someComputed() --></* nested */>` could momentarily rebind the `ifnot:` block against a stale `$data` from before the switch, throwing on a method the new state's object doesn't have. The duplicated *inline* per-binding-site expression did not have this issue (each binding's own internal computed subscribes independently and stays in sync with its own `with:` context). Prefer the duplicated inline expression over a shared computed when the condition gates a block nested inside a `with:`/`foreach:` whose bound value itself changes with the same underlying observable. The `ifEditable`/`ifAggregated` binding handlers that replaced those inline expressions are safe for exactly the same reason the inline expression was: they delegate to KO's own `if` binding, which creates a per-site computed, so no shared memoized node is introduced.
- **`.product-tile-attribute-group` (style.css) has a fixed `height: 2rem`**, flex-column + `space-between`, sized for the compact buildings-count row (`.product-tile-count`) alone. It does not grow with content and has no `overflow` set. In `product-tile.html` the t/min production row (`.product-tile-amount`, under the "Total Production" comment) is a **sibling** of `.product-tile-attribute-group`, not nested inside it - it was nested at one point during the All-Islands Aggregation work, which forced both rows into the fixed 2rem box, overflowed it, and clipped the t/min line against the tile border with no bottom padding (also misaligning t/min's height across tiles that do vs don't render a count row). Keep `.product-tile-amount`'s wrapper as a sibling if this markup is touched again. Regression test: `tests/binding/product-tile-layout.spec.ts`.
- Any change to what `product-tile-count`'s `with:`-bound computed (`ProductPresenter.factoryPresenterIfDefaultSupplier()`) returns must preserve `null` for rows that previously rendered nothing (import-only products, or every real island's `defaultSupplier` being non-factory while aggregating) - a non-null return where the non-aggregate branch would be `null` makes the row start rendering unexpectedly, same overflow symptom as above. Exception: with zero real islands, the aggregate branch intentionally still returns a synthetic all-zero object (see `src/AGENTS.md`).
- **Bootstrap checkbox styling pitfall on read-only rows**: Removing the `<input type="checkbox">` while leaving container elements with Bootstrap form classes like `.custom-control.custom-checkbox` or `.custom-control-label` will still cause the browser to render empty checkbox shapes/borders. These styling classes must be removed entirely from the text labels on read-only rows to prevent empty boxes.

## Debug Binding Usage

All 15 templates now include debug bindings for troubleshooting Knockout binding issues.

### Debug Binding Pattern
```html
<!-- Root element of template/dialog -->
<div data-bind="debug: 'Template Name', [other bindings...]">

<!-- Context switches (with, foreach) -->
<div data-bind="debug: 'Context Label', with: $data.someProperty">

<!-- Loop iterations -->
<!-- ko foreach: items -->
<div data-bind="debug: 'Loop Item'">
<!-- /ko -->
```

### Strategic Placement
- **Root level**: All dialogs have debug binding on outermost element
- **Context switches**: At `with:` and `foreach:` binding points
- **Complex areas**: Module lists, workforce demands, item configurations

### Debug Labels by Template
- `factory-tile.html`: "Factory Tile", "Module"
- `population-tile.html`: "Population Tile"
- `factory-config-dialog.html`: "Factory Config Dialog", "Workforce Demand", "Module Config", "Available Item"
- `population-level-config-dialog.html`: "Population Config Dialog", "Residence Building", "Need Category", "Population Level Need"
- `settings-dialog.html`: "Settings Dialog", "Settings Option"
- `island-management-dialog.html`: "Island Management Dialog", "Island Candidate"
- All other dialogs: "[Dialog Name] Dialog"
- `treeElement.html`: "Tree Element" (for production chain tree)

### Enabling Debug Output
Debug bindings are controlled by `window.view.debug.enabled` observable:
```javascript
// Enable via localStorage (persists across reloads)
localStorage.setItem('debug.enabled', 'true');

// Enable via observable (auto-persists)
window.view.debug.enabled(true);
```

### Debug Output Format
When enabled, debug bindings log to console with `[DebugKO]` prefix:
- Element information
- Asset Type (Factory, Consumer, PopulationLevel, etc.)
- Asset Info (GUID, name, region if available)
- Binding Context ($data, $root, $parent hierarchy)

### When to Add Debug Bindings
- **New templates**: Add debug binding to root element
- **Complex binding contexts**: Add at `with:` and `foreach:` transitions
- **Troublesome areas**: Where binding errors commonly occur
- **Keep labels descriptive**: Use meaningful names that identify the context

### Debug Mode Interaction
- **init callback**: Fires once when binding is established (requires `debug.enabled` = true)
- **update callback**: Fires on observable changes (requires `debug.verboseMode` = true)
- No performance impact when debug mode is disabled (observable check returns false immediately)

## External Link Component

**Purpose**: Language-aware links to annolayouts.de (https://annolayouts.de/117/{lang}/{subpage})

**Usage**:
- Direct: `<external-link params="subpage: 'research'"></external-link>`
- Via collapsible: `<collapsible params="..., externalLink: 'research'">`

**Language Mapping**: english→en, german→de, french→fr, spanish→es, italian→it, russian→ru, simplified/traditional_chinese→cn, korean→kr, polish/brazilian/japanese→en (fallback)

**CORS Note**: No URL existence checking (CORS restrictions). User gets 404 on annolayouts.de if page doesn't exist.

**Implementation**: src/components.ts:725-764 (component), :450-539 (collapsible integration)

## Registered Components (src/components.ts)

**Input/UI Controls**:
- `number-input-increment` - Numeric input with +/- buttons
- `notes-section` - Notes textarea with toggle
- `lock-toggle` - Lock/unlock toggle button
- `icon-checkbox` - Checkbox with icon label
- `tri-state-toggle` - Item equip control Off/Base/Boosted (see below)
- `constructed-buildings-input` - Building count input

**Asset Display**:
- `asset-icon` - Asset icon with name/tooltip
- `factory-header` - Factory tile header
- `residence-label` - Residence name/icon
- `residence-effect-entry` - Residence need effect display
- `buff-display` - Buff/item effect display

**Supplier/Trade**:
- `btn-default-supplier` - Default supplier button
- `trade-route-amount` - Trade route amount input
- `additional-output` - Extra good production display

**Consumer/Demand**:
- `consumer-unknown`, `consumer-residence`, `consumer-factory`, `consumer-module` - Consumer type components
- `consumer-entry` - Single consumer entry
- `consumer-view` - Consumer list view
- `replacement` - Residence replacement info

**Layout**:
- `collapsible` - Collapsible section with optional external link
- `external-link` - Language-aware external links

## buff-display component (effects & patron dialogs)

- `buff-display` (`params: {buffs: ...}`) iterates **raw `Buff` objects** (`Effect.buffs`, `wonder.buffs`) — bind `Buff` fields directly (`$data.productivityUpgrade`, `$data.goodConsumptionUpgrade`, `$data.additionalNeeds`), not `AppliedBuff` fields.
- Consumption-reduction rows: flat `consumptionModifierInPercent != 0` → `±X %` + `icons/icon_marketplace_2d_light.png` (affects all needs); `goodConsumptionUpgrade` foreach → `±X %` + each `$data.product.icon` (per good).
- Additional-need row: `additionalNeeds.length` → `icons/icon_2d_extra_demand.png` (title `additionalNeed`) + each need's product icon.

## effects-dialog.html target column

- `foreach: $data.targets` renders one icon per target. For residence targets use the **population-level icon** (`$data.populationLevel ? $data.populationLevel.icon : $data.icon`) — all residences share one building icon, so population icons distinguish tiers.
- The `<thead>` is intentionally left unclosed before `<tbody data-bind="foreach: $root.filteredEffects">`; leave it as-is.
## tri-state-toggle component (item equip: Off / Base / Boosted)

- Replaces `icon-checkbox` for equipped **factory items** in `factory-config-section.html` and `consumer-config-dialog.html` (the item rows under `foreach: $data.availableItems`, where each `$data` is a base `AppliedBuff`).
- Params (colon syntax): `asset: $data.parent` (Item, for the icon), `state: $data.parent.slotStates.get($data.target)` (the KO observable 0/1/2), `hasBoost: $data.parent.boostEquipments.length > 0`, `id: ...`. Click cycles `0→1→2→0` (or `0→1→0` when `hasBoost` is false — behaves exactly like the old equip checkbox).
- **Bind item-row buff fields via `$data.activeBuff().*`, not `$data.buff.*`** — `activeBuff()` returns the boost buff at state 2, else the base buff, so the single row shows the active variant's numbers. (`extraGoods`/`replacementArray`/`replacingWorkforce` stay on `$data` — they are `AppliedBuff` fields, not buff fields.)
- Visuals in `style.css` (`.tri` driven by `data-state`): Off = white box, Base = blue check, Boosted = gold star. Dark mode keyed off `body.bg-dark`.
