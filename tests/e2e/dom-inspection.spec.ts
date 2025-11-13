import { test } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * DOM inspection test to diagnose what's actually rendering
 */
test.describe('DOM Inspection', () => {
  test('inspect what renders with with-data fixture', async ({ page }) => {
    const configLoader = new ConfigLoader();
    await configLoader.loadConfig(page, 'tests/fixtures/with-data.json');

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check what actually rendered
    const domInfo = await page.evaluate(() => {
      return {
        productTiles: document.querySelectorAll('.product-tile').length,
        serviceTiles: document.querySelectorAll('.ui-service-building-item').length,
        populationTiles: document.querySelectorAll('.ui-tier-unit').length,
        collapsibleSections: document.querySelectorAll('fieldset.ui-fieldset').length,
        productConfigButtons: document.querySelectorAll('[data-target="#product-config-dialog"]').length,
        factoryConfigButtons: document.querySelectorAll('[data-target="#factory-config-dialog"]').length,
        bodyHtml: document.body.innerHTML.substring(0, 5000), // First 5000 chars
      };
    });

    console.log('\n=== DOM INSPECTION RESULTS ===');
    console.log(`Product tiles (.product-tile): ${domInfo.productTiles}`);
    console.log(`Service tiles (.ui-service-building-item): ${domInfo.serviceTiles}`);
    console.log(`Population tiles (.ui-tier-unit): ${domInfo.populationTiles}`);
    console.log(`Collapsible sections: ${domInfo.collapsibleSections}`);
    console.log(`Product config buttons: ${domInfo.productConfigButtons}`);
    console.log(`Factory config buttons: ${domInfo.factoryConfigButtons}`);
    console.log('\n=== BODY HTML (first 5000 chars) ===');
    console.log(domInfo.bodyHtml);

    // Check window.view state
    const viewInfo = await page.evaluate(() => {
      const view = (window as any).view;

      if (!view) {
        return {
          hasView: false,
          error: 'window.view is undefined',
        };
      }

      if (!view.island) {
        return {
          hasView: true,
          hasIsland: false,
          error: 'view.island is undefined',
        };
      }

      const island = view.island();

      return {
        hasView: true,
        hasIsland: !!island,
        hasProductPresenters: !!island?.productPresenters,
        productPresentersCount: island?.productPresenters?.length || 0,
        factoriesCount: island?.factories?.length || 0,
        productsCount: island?.products?.length || 0,
        categoriesCount: view.template?.categories?.length || 0,
      };
    });

    console.log('\n=== window.view STATE ===');
    if ('error' in viewInfo) {
      console.log(`ERROR: ${viewInfo.error}`);
      return;
    }
    console.log(`Has island: ${viewInfo.hasIsland}`);
    console.log(`Has productPresenters: ${viewInfo.hasProductPresenters}`);
    console.log(`Product presenters count: ${viewInfo.productPresentersCount}`);
    console.log(`Factories count: ${viewInfo.factoriesCount}`);
    console.log(`Products count: ${viewInfo.productsCount}`);
    console.log(`Categories count: ${viewInfo.categoriesCount}`);

    // Check first category's productPresenters
    if (viewInfo.categoriesCount > 0) {
      const categoryInfo = await page.evaluate(() => {
        const view = (window as any).view;
        const firstCategory = view.template.categories[0];

        return {
          categoryName: firstCategory.instance().name || 'Unknown',
          hasProductPresenters: typeof firstCategory.productPresenters === 'function',
          productPresentersCount: firstCategory.productPresenters ? firstCategory.productPresenters().length : 0,
        };
      });

      console.log('\n=== FIRST CATEGORY INFO ===');
      console.log(`Category name: ${categoryInfo.categoryName}`);
      console.log(`Has productPresenters computed: ${categoryInfo.hasProductPresenters}`);
      console.log(`Product presenters in category: ${categoryInfo.productPresentersCount}`);
    }
  });
});
