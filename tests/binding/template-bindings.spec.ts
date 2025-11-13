import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

test.describe('Template Binding Validation', () => {
  let configLoader: ConfigLoader;
  let errorDetector: BindingErrorDetector;

  test.beforeEach(async ({ page }) => {
    configLoader = new ConfigLoader();
    errorDetector = new BindingErrorDetector();

    // Load basic configuration
    await configLoader.loadConfig(page, 'tests/fixtures/with-data.json');

    // Enable debug mode to catch binding issues
    await configLoader.setDebugMode(page, true);

    // Set up error detection
    errorDetector.listenForErrors(page);
  });

  test('factory-tile template binds without errors', async ({ page }) => {
    // Navigate to application
    await page.goto('/');

    // Wait for factories section to load
    await page.waitForSelector('.product-tile', {
      timeout: 10000,
      state: 'attached',
    });

    // Wait a bit for all bindings to complete
    await page.waitForTimeout(2000);

    // Check for binding errors
    const bindingErrors = errorDetector.getFormattedBindingErrors();
    expect(
      bindingErrors,
      `Expected no binding errors, but found: ${bindingErrors.join('\n')}`
    ).toHaveLength(0);

    // Verify factory tiles or service buildings rendered
    const factoryCount = await page.locator('.product-tile, .ui-service-building-item').count();
    expect(factoryCount, 'Expected at least one product tile or service building to be rendered').toBeGreaterThan(0);
  });

  test('population-tile template binds without errors', async ({ page }) => {
    await page.goto('/');

    // Wait for population tiles to load
    await page.waitForSelector('.ui-tier-unit', { timeout: 10000 });

    // Wait for bindings to complete
    await page.waitForTimeout(2000);

    // Check for binding errors
    expect(errorDetector.hasBindingError()).toBe(false);

    // Verify population tiles rendered
    const populationTiles = await page.locator('.ui-tier-unit').count();
    expect(populationTiles).toBeGreaterThan(0);
  });

  test('debug binding handler works correctly', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('networkidle');

    // Check debug mode is enabled
    const debugEnabled = await page.evaluate(() => {
      return (window as any).view?.debug?.enabled?.();
    });

    expect(debugEnabled).toBe(true);

    // Check for [DebugKO] messages in console
    const messages = errorDetector.getMessages();
    const debugMessages = messages.filter((msg) =>
      msg.text().includes('[DebugKO]')
    );

    // We should see some debug output if debug mode is working
    expect(
      debugMessages.length,
      'Expected debug binding handler to produce console output'
    ).toBeGreaterThan(0);
  });

  test('no observable unwrapping errors', async ({ page }) => {
    await page.goto('/');

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Check for common observable unwrapping errors
    const observableErrors = errorDetector
      .getErrors()
      .filter((msg) => {
        const text = msg.text().toLowerCase();
        return (
          text.includes('is not a function') ||
          text.includes('observable') ||
          text.includes('undefined')
        );
      });

    expect(
      observableErrors,
      `Observable unwrapping errors found: ${observableErrors
        .map((m) => m.text())
        .join('\n')}`
    ).toHaveLength(0);
  });

  test('collapsible sections bind correctly', async ({ page }) => {
    await page.goto('/');

    // Wait for collapsible sections to load
    await page.waitForSelector('fieldset.ui-fieldset', { timeout: 10000 });

    // Find all collapsible sections
    const collapsibles = await page.locator('fieldset.ui-fieldset').count();

    expect(collapsibles, 'Expected at least one collapsible section').toBeGreaterThan(0);

    // Ensure no binding errors in collapsible sections
    expect(errorDetector.hasBindingError()).toBe(false);
  });
});
