# Tab Switching and Knockout Binding Fixes - Session Log

## Date
2025-11-09

## Issues Identified and Fixed

### 1. Bootstrap Tab Switching Not Working

**Problem**: Tabs in `product-config-dialog.html` were not switching when clicked.

**Root Causes**:
1. All tabs had the `active` class - Bootstrap requires only ONE active tab at initialization
2. Custom `click: $data.openTab` handler was interfering with Bootstrap's default behavior
3. Incorrect attribute usage - using `href` instead of `data-target` for button tabs
4. Missing `aria-controls` attributes for accessibility

**Files Modified**: `templates/product-config-dialog.html`

**Changes Made**:
- Removed `active` class from factory tab buttons (lines 95)
- Kept `active` class only on Trade Routes tab (line 104)
- Removed custom `click: $data.openTab` handler (line 95)
- Changed `attr: {'href': ...}` to `attr: {'data-target': ...}` (line 95)
- Added `aria-controls` attributes to all tab buttons (lines 95, 104)

**Before**:
```html
<button class="nav-link active" data-toggle="tab" type="button" role="tab"
        data-bind="attr: {'href': '#factories-tab-' + $data.guid()}, click: $data.openTab">
```

**After**:
```html
<button class="nav-link" data-toggle="tab" type="button" role="tab"
        data-bind="attr: {'data-target': '#factories-tab-' + $data.guid(),
                          'aria-controls': 'factories-tab-' + $data.guid()}">
```

### 2. Knockout Component Binding Syntax Errors

**Problem**: Multiple templates had incorrect Knockout component binding syntax causing parse errors.

**Error Message**:
```
Uncaught SyntaxError: Unable to process binding
Message: Unable to parse bindings.
Bindings value: component: 'btn-default-supplier', params={'supplier': $data.instance()}
Message: missing : after property id
```

**Root Cause**: Using equals sign `=` or quoted object notation `{'key': value}` instead of colon syntax `params: {key: value}`

**Files Modified**:
- `templates/factory-config-section.html` (line 20)
- `templates/product-config-dialog.html` (lines 57, 169, 172, 189, 192)

**Incorrect Patterns Found**:
```html
<!-- Pattern 1: Using = instead of : -->
params={'supplier': $data}

<!-- Pattern 2: Mixed syntax with redundant params= -->
params={'supplier': params=$data}

<!-- Pattern 3: Using = for simple value -->
params=$data
```

**Correct Syntax**:
```html
<!-- Correct object params -->
params: {supplier: $data}

<!-- Correct simple value -->
params: $data
```

**Specific Fixes**:

1. **factory-config-section.html:20**
   - Before: `params={'supplier': $data.instance()}`
   - After: `params: {supplier: $data.instance()}`

2. **product-config-dialog.html:57**
   - Before: `params={'supplier': params=$data}`
   - After: `params: {supplier: $data}`

3. **product-config-dialog.html:169**
   - Before: `params={'supplier': $data.instance().passiveTradeSupplier}`
   - After: `params: {supplier: $data.instance().passiveTradeSupplier}`

4. **product-config-dialog.html:172, 192**
   - Before: `params=$data`
   - After: `params: $data`

5. **product-config-dialog.html:189**
   - Before: `params={'supplier': $data}`
   - After: `params: {supplier: $data}`

### 3. Unused TypeScript Import

**Problem**: TypeScript compilation error about unused import.

**Error**: `TS6133: 'Supplier' is declared but its value is never read.`

**File Modified**: `src/components.ts` (line 5)

**Fix**:
- Before: `import { isSupplier, PassiveTradeSupplier, Supplier } from './suppliers';`
- After: `import { isSupplier, PassiveTradeSupplier } from './suppliers';`

## Key Learnings

### Bootstrap 4 Tab Requirements

1. **Single Active Tab**: Only ONE tab should have `active` class at initialization
2. **Button Syntax**: Use `data-target` attribute for `<button>` elements with `data-toggle="tab"`
3. **Link Syntax**: Use `href` attribute for `<a>` elements with `data-toggle="tab"`
4. **No Custom Handlers**: Don't add custom `click` handlers - Bootstrap handles tab switching automatically
5. **Accessibility**: Include `aria-controls` and `aria-selected` attributes

### Knockout Component Binding Syntax

**Golden Rules**:
1. Always use colon `:` for params property (NEVER equals `=`)
2. Don't quote object property names: `{supplier: $data}` not `{'supplier': $data}`
3. Consistent across all component types (custom elements and data-bind syntax)
4. Object params: `params: {key: value, key2: value2}`
5. Simple value params: `params: value`

**Common Mistake Pattern**:
```html
<!-- WRONG - will cause parse error -->
<component params={'key': value}></component>
<component params=value></component>

<!-- CORRECT -->
<component params: {key: value}></component>
<component params: value></component>
```

## Build Verification

After all fixes, the build completed successfully:
```bash
npm run build
# webpack 5.88.2 compiled with 2 warnings in 1826 ms
# (warnings are pre-existing knockout-amd-helpers issues, not related to our changes)
```

## Files Changed Summary

1. `templates/product-config-dialog.html` - Tab switching and component binding fixes
2. `templates/factory-config-section.html` - Component binding syntax fix
3. `src/components.ts` - Removed unused import

## Documentation Updates

Added to `templates/CLAUDE.md`:
- New section: "Knockout Component Binding Syntax (CRITICAL)"
- Examples of correct vs incorrect syntax
- Common error patterns and fixes
- Key points for component binding

## Testing Recommendations

1. Verify tab switching works in product-config-dialog
2. Check all "Set as Default" buttons render and function correctly
3. Verify trade route amount inputs display properly
4. Test passive trade supplier interactions
5. Ensure no console errors related to Knockout bindings

## Related Documentation

- Bootstrap 4 Tabs: https://getbootstrap.com/docs/4.5/components/navs/#tabs
- Knockout Component Binding: https://knockoutjs.com/documentation/component-binding.html
- Project-specific: `templates/CLAUDE.md` - Knockout Component Binding Syntax section
