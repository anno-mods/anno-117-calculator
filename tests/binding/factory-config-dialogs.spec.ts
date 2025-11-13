import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

/**
 * Test suite to validate factory config dialog bindings
 * Opens config dialog for one visible factory from each category
 * Fails if any Knockout binding errors occur
 */
test.describe('Factory Config Dialog Binding Validation', () => {
  let configLoader: ConfigLoader;
  let errorDetector: BindingErrorDetector;

  test.beforeEach(async ({ page }) => {
    configLoader = new ConfigLoader();
    errorDetector = new BindingErrorDetector();

    // Load with-data configuration to ensure factories exist
    await configLoader.loadConfig(page, 'tests/fixtures/with-data.json');

    // Enable debug mode to capture detailed binding information
    await configLoader.setDebugMode(page, true);

    // Set up error detection before navigation
    errorDetector.listenForErrors(page);
  });

  test('product config dialogs bind without errors for all categories', async ({ page }) => {
    // Set longer timeout for this test
    test.setTimeout(60000);

    // Navigate to application
    await page.goto('/');

    // Wait for application to fully initialize (same pattern as template-bindings.spec.ts)
    await page.waitForLoadState('networkidle');

    // Wait for product tiles to appear (product tiles replaced factory tiles)
    await page.waitForSelector('.product-tile, .ui-service-building-item', {
      timeout: 10000,
      state: 'attached',
    });

    // Wait for all bindings to complete
    await page.waitForTimeout(2000);

    // Expand all collapsible sections to make all factories visible
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

    console.log(`Expanded ${expandedCount} collapsed sections`);

    // Wait for sections to expand
    await page.waitForTimeout(1000);

    // Get all product/factory config buttons - filter to only visible ones
    // Note: Product tiles now have product-config-dialog, but we keep factory-config-dialog for public services
    const allButtons = await page.locator('.product-tile .btn[data-target="#product-config-dialog"], .product-tile .btn[data-target="#factory-config-dialog"], .ui-service-building-item .btn[data-target="#factory-config-dialog"]').all();

    // Filter to only visible buttons
    const factoryButtons: typeof allButtons = [];
    for (const button of allButtons) {
      const isVisible = await button.isVisible();
      if (isVisible) {
        factoryButtons.push(button);
      }
    }

    console.log(`\n=== Found ${factoryButtons.length} factories with config buttons ===`);

    // Group factories by their collapsible sections (categories)
    const factoryInfoList: Array<{
      index: number;
      categoryName: string;
      factoryName: string;
    }> = [];

    for (let i = 0; i < factoryButtons.length; i++) {
      const button = factoryButtons[i];

      // Get the category and factory name from the DOM
      const info = await button.evaluate((btn) => {
        const factoryTile = btn.closest('.product-tile, .ui-service-building-item');
        const categoryFieldset = factoryTile?.closest('fieldset.ui-fieldset');
        const categoryLegend = categoryFieldset?.querySelector('legend');
        const factoryNameElement = factoryTile?.querySelector('.product-tile-name, .ui-service-building-item-name');

        return {
          categoryName: categoryLegend?.textContent?.trim() || 'Unknown Category',
          factoryName: factoryNameElement?.textContent?.trim() || `Factory ${i}`,
        };
      });

      factoryInfoList.push({
        index: i,
        categoryName: info.categoryName,
        factoryName: info.factoryName,
      });
    }

    // Get unique categories
    const categoriesMap = new Map<string, typeof factoryInfoList[0]>();
    for (const factory of factoryInfoList) {
      if (!categoriesMap.has(factory.categoryName)) {
        categoriesMap.set(factory.categoryName, factory);
      }
    }

    const factoriesToTest = Array.from(categoriesMap.values());

    console.log(`Found ${categoriesMap.size} unique categories`);
    factoriesToTest.forEach(f => {
      console.log(`  - ${f.categoryName}: ${f.factoryName}`);
    });

    // Keep track of successful dialog opens
    let totalDialogsOpened = 0;
    const dialogResults: Array<{
      categoryName: string;
      factoryName: string;
      success: boolean;
      error?: string;
    }> = [];

    // Test one factory from each category
    for (const factoryInfo of factoriesToTest) {
      console.log(`\n--- Testing category: ${factoryInfo.categoryName} ---`);
      console.log(`  Opening dialog for: ${factoryInfo.factoryName}`);

      const errorCountBefore = errorDetector.getErrorCounts();

      try {
        const button = factoryButtons[factoryInfo.index];

        // Click button (force click to handle potential visibility issues)
        await button.click({ force: true });

        // Wait for modal to open (either product or factory dialog)
        await page.waitForSelector('#product-config-dialog.show, #factory-config-dialog.show', {
          timeout: 5000,
          state: 'visible',
        });

        // Wait for bindings to complete
        await page.waitForTimeout(1000);

        totalDialogsOpened++;

        // Check for new binding errors
        const errorCountAfter = errorDetector.getErrorCounts();
        const newBindingErrors = errorCountAfter.binding - errorCountBefore.binding;
        const newKnockoutErrors = errorCountAfter.knockout - errorCountBefore.knockout;

        if (newBindingErrors > 0 || newKnockoutErrors > 0) {
          // Get the last 10 debug messages
          const allMessages = errorDetector.getMessages();
          const debugMessages = allMessages
            .filter(msg => msg.text().includes('[DebugKO]'))
            .slice(-10)
            .map(msg => msg.text());

          const bindingErrors = errorDetector.getFormattedBindingErrors();
          const knockoutErrors = errorDetector.getFormattedKnockoutErrors();

          console.error(`\n❌ BINDING ERRORS DETECTED:`);
          console.error(`  Category: ${factoryInfo.categoryName}`);
          console.error(`  Factory: ${factoryInfo.factoryName}`);
          console.error(`  New binding errors: ${newBindingErrors}`);
          console.error(`  New knockout errors: ${newKnockoutErrors}`);
          console.error(`\n  Binding Errors:`);
          bindingErrors.forEach(err => console.error(`    ${err}`));
          console.error(`\n  Knockout Errors:`);
          knockoutErrors.forEach(err => console.error(`    ${err}`));
          console.error(`\n  Last 10 debug messages:`);
          debugMessages.forEach(msg => console.error(`    ${msg}`));

          dialogResults.push({
            categoryName: factoryInfo.categoryName,
            factoryName: factoryInfo.factoryName,
            success: false,
            error: `${newBindingErrors} binding errors, ${newKnockoutErrors} knockout errors`,
          });
        } else {
          console.log(`  ✓ Dialog opened successfully without errors`);
          dialogResults.push({
            categoryName: factoryInfo.categoryName,
            factoryName: factoryInfo.factoryName,
            success: true,
          });
        }

        // Close the modal
        await page.keyboard.press('Escape');

        // Wait for modal to close
        await page.waitForTimeout(500);

      } catch (error) {
        console.error(`  ✗ Failed to open dialog: ${error}`);
        dialogResults.push({
          categoryName: factoryInfo.categoryName,
          factoryName: factoryInfo.factoryName,
          success: false,
          error: String(error),
        });
      }
    }

    // Print summary
    console.log(`\n=== Test Summary ===`);
    console.log(`Total categories tested: ${factoriesToTest.length}`);
    console.log(`Total dialogs opened: ${totalDialogsOpened}`);
    console.log(`Successful: ${dialogResults.filter(r => r.success).length}`);
    console.log(`Failed: ${dialogResults.filter(r => !r.success).length}`);

    if (dialogResults.some(r => !r.success)) {
      console.log(`\nFailed dialogs:`);
      dialogResults.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.categoryName} / ${r.factoryName}: ${r.error}`);
      });
    }

    // Check overall error counts
    const finalErrorCounts = errorDetector.getErrorCounts();
    const hasErrors = finalErrorCounts.binding > 0 || finalErrorCounts.knockout > 0;

    if (hasErrors) {
      const allBindingErrors = errorDetector.getFormattedBindingErrors();
      const allKnockoutErrors = errorDetector.getFormattedKnockoutErrors();
      const lastDebugMessages = errorDetector.getMessages()
        .filter(msg => msg.text().includes('[DebugKO]'))
        .slice(-10)
        .map(msg => msg.text());

      console.error(`\n❌ OVERALL BINDING ERRORS DETECTED:`);
      console.error(`Total binding errors: ${finalErrorCounts.binding}`);
      console.error(`Total knockout errors: ${finalErrorCounts.knockout}`);
      console.error(`\nAll Binding Errors:`);
      allBindingErrors.forEach(err => console.error(`  ${err}`));
      console.error(`\nAll Knockout Errors:`);
      allKnockoutErrors.forEach(err => console.error(`  ${err}`));
      console.error(`\nLast 10 [DebugKO] messages:`);
      lastDebugMessages.forEach(msg => console.error(`  ${msg}`));
    }

    // Expect no binding or knockout errors
    expect(
      hasErrors,
      `Factory config dialogs had ${finalErrorCounts.binding} binding errors and ${finalErrorCounts.knockout} knockout errors. See console output for details.`
    ).toBe(false);

    // Expect at least some dialogs were tested
    expect(
      totalDialogsOpened,
      'Expected to test at least one factory config dialog'
    ).toBeGreaterThan(0);
  });
});
