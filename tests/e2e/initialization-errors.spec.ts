import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

/**
 * Test to diagnose initialization errors by printing last 10 error messages
 * Derived from initialization.spec.ts "application initializes without errors" test
 */
test.describe('Application Initialization Error Diagnosis', () => {
  let configLoader: ConfigLoader;
  let errorDetector: BindingErrorDetector;

  test.beforeEach(async () => {
    configLoader = new ConfigLoader();
    errorDetector = new BindingErrorDetector();
  });

  test('print last 10 console errors during initialization', async ({ page }) => {
    // Set longer timeout for this diagnostic test
    test.setTimeout(60000);

    // Set up error detection
    errorDetector.listenForErrors(page);

    // Load basic configuration
    await configLoader.loadConfig(page, 'tests/fixtures/basic.json');
    await configLoader.setDebugMode(page, true);

    console.log('\n=== Starting application initialization ===');

    // Navigate to application
    await page.goto('/');

    // Wait for initialization to complete
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(10000); // Extra time to capture all initialization errors

    console.log('=== Application initialization complete ===\n');

    // Get all errors captured during initialization
    const allErrors = errorDetector.getErrors();
    const bindingErrors = errorDetector.getFormattedBindingErrors();
    const knockoutErrors = errorDetector.getFormattedKnockoutErrors();
    const errorCounts = errorDetector.getErrorCounts();

    // Print error summary
    console.log('=== ERROR SUMMARY ===');
    console.log(`Total console messages captured: ${allErrors.length}`);
    console.log(`Binding errors: ${errorCounts.binding}`);
    console.log(`Knockout errors: ${errorCounts.knockout}`);
    console.log(`Other errors: ${errorCounts.other}`);
    console.log(`Warnings: ${errorCounts.warning}\n`);

    // Print last 10 errors of each type
    if (bindingErrors.length > 0) {
      console.log('=== LAST 10 BINDING ERRORS ===');
      const last10Binding = bindingErrors.slice(-10);
      last10Binding.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      console.log('');
    }

    if (knockoutErrors.length > 0) {
      console.log('=== LAST 10 KNOCKOUT ERRORS ===');
      const last10Knockout = knockoutErrors.slice(-10);
      last10Knockout.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      console.log('');
    }

    // Print last 10 errors from all captured console messages
    if (allErrors.length > 0) {
      console.log('=== LAST 10 CONSOLE ERRORS (ALL TYPES) ===');
      const last10All = allErrors.slice(-10);
      last10All.forEach((error, index) => {
        const text = typeof error.text === 'function' ? error.text() : error.text;
        const type = typeof error.type === 'function' ? error.type() : error.type;
        console.log(`${index + 1}. [${type}] ${text}`);
      });
      console.log('');
    }

    // Check if critical errors exist
    const hasCriticalErrors = errorCounts.binding > 0 || errorCounts.knockout > 0;

    if (hasCriticalErrors) {
      console.log('⚠️  CRITICAL ERRORS DETECTED during initialization');
      console.log('Application may not function correctly\n');
    } else {
      console.log('✓ No critical errors detected');
      console.log('Application initialized successfully\n');
    }

    // Check for common error patterns
    const hasTemplateErrors = bindingErrors.some(err =>
      err.includes('Unable to parse bindings') || err.includes('template')
    );
    const hasObservableErrors = knockoutErrors.some(err =>
      err.includes('observable') || err.includes('not a function')
    );
    const hasUndefinedErrors = allErrors.some(err => {
      const text = typeof err.text === 'function' ? err.text() : err.text;
      const type = typeof err.type === 'function' ? err.type() : err.type;
      return text.includes('undefined') && type === 'error';
    });

    if (hasTemplateErrors) {
      console.log('⚠️  Template binding errors detected - check template syntax');
    }
    if (hasObservableErrors) {
      console.log('⚠️  Observable errors detected - check computed observables and subscriptions');
    }
    if (hasUndefinedErrors) {
      console.log('⚠️  Undefined reference errors detected - check object initialization order');
    }

    // This test is diagnostic - it always passes but prints errors for analysis
    // To make it fail on errors, uncomment the following:
    expect(hasCriticalErrors, 'Critical errors detected during initialization').toBe(false);
  });

  test('print errors after expanding all sections', async ({ page }) => {
    test.setTimeout(60000);

    errorDetector.listenForErrors(page);
    await configLoader.loadConfig(page, 'tests/fixtures/basic.json');
    await configLoader.setDebugMode(page, true);

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    console.log('\n=== Expanding all collapsible sections ===');

    // Expand all collapsible sections
    const expandedCount = await page.evaluate(() => {
      let count = 0;
      document.querySelectorAll('fieldset.ui-fieldset.collapsible').forEach((fieldset) => {
        const legend = fieldset.querySelector('legend');
        if (legend && fieldset.classList.contains('collapsed')) {
          (legend as HTMLElement).click();
          count++;
        }
      });
      return count;
    });

    console.log(`Expanded ${expandedCount} sections`);

    // Wait for expansions to complete
    await page.waitForTimeout(2000);

    // Get errors after expansion
    const bindingErrors = errorDetector.getFormattedBindingErrors();
    const knockoutErrors = errorDetector.getFormattedKnockoutErrors();

    console.log('\n=== ERRORS AFTER SECTION EXPANSION ===');

    if (bindingErrors.length > 0) {
      console.log('Binding errors:');
      bindingErrors.slice(-10).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (knockoutErrors.length > 0) {
      console.log('Knockout errors:');
      knockoutErrors.slice(-10).forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    if (bindingErrors.length === 0 && knockoutErrors.length === 0) {
      console.log('✓ No errors after expanding sections');
    }

    console.log('');
  });
});
