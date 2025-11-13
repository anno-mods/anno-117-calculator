# Anno 117 Calculator - Test Suite

This directory contains automated tests for the Anno 117 Calculator using Playwright for browser automation.

## Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Install Playwright browsers:
```bash
npx playwright install
```

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
npm run test:binding    # Knockout binding validation tests
npm run test:computed   # Computed observable calculation tests
npm run test:e2e        # End-to-end integration tests
```

### Interactive Mode
```bash
npm run test:ui         # Opens Playwright UI for interactive testing
npm run test:headed     # Run tests in headed mode (visible browser)
npm run test:debug      # Run tests in debug mode
```

### Test Reports
After running tests, view the HTML report:
```bash
npm run test:report
```

## Test Structure

### `/helpers/`
Helper classes for test utilities:
- **ConfigLoader**: Manages localStorage configuration and fixture loading
- **BindingErrorDetector**: Captures and categorizes Knockout binding errors
- **ComputedValueAsserter**: Validates computed observable calculations
- **FixtureManager**: Creates and manages test fixtures

### `/fixtures/`
Test configuration files (JSON) loaded into localStorage:
- `empty.json`: Minimal configuration
- `basic.json`: Basic settings with no population/factories

### `/binding/`
Knockout.js binding validation tests:
- Verifies templates bind without errors
- Checks component registration
- Validates template loading

### `/computed/`
Computed observable calculation tests:
- Factory production calculations
- Population need calculations
- Tests use params.js values for robust validation

### `/e2e/`
End-to-end integration tests:
- Application initialization flow
- localStorage persistence
- UI rendering
- Initialization order validation

## Writing Tests

### Using Helpers

```typescript
import { test } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { ComputedValueAsserter } from '../helpers/computed-asserter';

test('my test', async ({ page }) => {
  const configLoader = new ConfigLoader();
  const asserter = new ComputedValueAsserter();

  // Load fixture
  await configLoader.loadConfig(page, 'tests/fixtures/basic.json');

  // Navigate
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Assert computed value
  await asserter.assertEquals(
    page,
    'window.view.island().factories[0].inputAmount()',
    expectedValue
  );
});
```

### Using params.js for Calculations

Tests should read from params.js to calculate expected values, making them robust against params changes:

```typescript
// Get cycleTime from params
const cycleTime = await page.evaluate(() => {
  return window.view.island().factories[0].cycleTime;
});

// Calculate expected using params data
const expected = (buildings * boost * 60) / cycleTime;

// Assert
await asserter.assertEquals(page, 'window.view.island().factories[0].inputAmount()', expected);
```

### Creating Fixtures

Programmatically:
```typescript
import { FixtureManager } from '../helpers/fixture-manager';

const fixtureManager = new FixtureManager();
const config = fixtureManager.generateFixture({
  populationLevels: [
    { guid: 1010343, residents: 1000, buildings: 5 }
  ],
  factories: [
    { guid: 1010517, buildings: 10, boost: 1.5 }
  ]
});

await configLoader.loadConfigObject(page, config);
```

Or use JSON files in `tests/fixtures/`.

## Debugging Tests

### Enable Debug Mode
```typescript
await configLoader.setDebugMode(page, true);
```

This enables Knockout binding debug output in the browser console.

### Check for Errors
```typescript
import { BindingErrorDetector } from '../helpers/binding-detector';

const errorDetector = new BindingErrorDetector();
errorDetector.listenForErrors(page);

// ... test code ...

// Check for errors
const errors = errorDetector.getFormattedBindingErrors();
console.log(errors);
```

### Use Playwright Inspector
```bash
npm run test:debug
```

### Screenshots and Videos
Failed tests automatically capture:
- Screenshots (in `test-results/`)
- Videos (in `test-results/`)
- Traces (viewable with `npx playwright show-trace trace.zip`)

## CI/CD Integration

Tests are configured to run in CI via `playwright.config.ts`:
- Runs in headless mode
- 2 retries on failure
- Single worker for deterministic results
- Generates HTML report

### Running in CI
```bash
npm run build        # Build the application
npm test             # Run tests
npm run test:report  # View results
```

## Common Patterns

### Wait for Observable Updates
```typescript
await page.evaluate(() => {
  const factory = window.view.island().factories[0];
  factory.buildings.constructed(10);
});

// Wait for subscriptions to fire
await page.waitForTimeout(500);
```

### Check Array Lengths
```typescript
await asserter.assertArrayLength(
  page,
  'window.view.island().factories',
  5,
  'Should have 5 factories'
);
```

### Verify Range
```typescript
await asserter.assertInRange(
  page,
  'window.view.island().factories[0].boost()',
  0.5,
  2.0,
  'Boost should be between 0.5 and 2.0'
);
```

## Troubleshooting

### Test Timeout
Increase timeout in test:
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // ...
});
```

### Webpack Dev Server Not Starting
Make sure port 8080 is available, or update `playwright.config.ts` to use a different port.

### Elements Not Found
Wait for elements before interacting:
```typescript
await page.waitForSelector('.factory-tile', { timeout: 10000 });
```

### localStorage Not Persisting
Use `page.addInitScript()` via ConfigLoader to set localStorage before page loads:
```typescript
await configLoader.setItem(page, 'key', 'value');
```

## Best Practices

1. **Use params.js values**: Always calculate expected values from params data
2. **Add tolerance**: Use tolerance for floating-point comparisons
3. **Wait for observables**: Allow time for Knockout subscriptions to update
4. **Clear state**: Use fixtures to ensure clean test state
5. **Descriptive messages**: Include helpful messages in assertions
6. **Group related tests**: Use `test.describe()` to organize tests
7. **Skip when needed**: Use `test.skip()` for tests requiring specific data

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Anno Calculator Architecture](../docs/DEVELOPER_GUIDE.md)
- [Knockout.js Documentation](https://knockoutjs.com/documentation/introduction.html)
