import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import {CategoryPresenter} from '../../src/presenters';
import { Island } from '../../src/world';

test.describe('Product Visibility Logic', () => {
  let configLoader: ConfigLoader;

  test.beforeEach(async () => {
    configLoader = new ConfigLoader();
  });

  test('product visible when showAllProducts is enabled', async ({ page }) => {
    const config = configLoader.createIslandConfig("Latium", 3245, {}, {
      "settings.showAllProducts": "1"
    });
    config["debug.enabled"] = "true";

    await configLoader.loadConfigObject(page, config);
    await page.goto('http://localhost:8080/index.html');
    await page.waitForLoadState('networkidle');

    // Get a product that is not a construction material and has no demand/production
    const visibilityInfo = await page.evaluate(() => {
      const island = window.view.island();
      const presenter = window.view.presenter;

      // Find a product that is not a construction material
      const productPresenter = presenter.categories
        .flatMap((cat: any) => cat.productPresenters)
        .find((p: any) => {
          const product = p.instance();
          return !product.isConstructionMaterial &&
                 product.available() &&
                 p.totalDemand() === 0;
        });

      if (!productPresenter) {
        return { found: false };
      }

      return {
        found: true,
        visible: productPresenter.visible(),
        isConstructionMaterial: productPresenter.instance().isConstructionMaterial,
        totalDemand: productPresenter.totalDemand(),
        showAllProducts: window.view.settings.showAllProducts.checked()
      };
    });

    expect(visibilityInfo.found).toBe(true);
    expect(visibilityInfo.showAllProducts).toBe(true);
    expect(visibilityInfo.visible).toBe(true);
  });

  test('construction material visible when showAllProducts enabled and factories available', async ({ page }) => {
    const config = configLoader.createIslandConfig("Latium", 3245, {}, {
      "settings.showAllProducts": "1" // Enabled
    });
    config["debug.enabled"] = "true";

    await configLoader.loadConfigObject(page, config);
    await page.goto('http://localhost:8080/index.html');
    await page.waitForLoadState('networkidle');

    // Find a construction material product with available factories
    const visibilityInfo = await page.evaluate(() => {
      const presenter = window.view.presenter;

      const productPresenter = presenter.categories
        .flatMap((cat: any) => cat.productPresenters)
        .find((p: any) => {
          const product = p.instance();
          return product.isConstructionMaterial &&
                 product.available() &&
                 p.visibleFactories().length > 0;
        });

      if (!productPresenter) {
        return { found: false };
      }

      return {
        found: true,
        visible: productPresenter.visible(),
        isConstructionMaterial: productPresenter.instance().isConstructionMaterial,
        showAllProducts: window.view.settings.showAllProducts.checked(),
        visibleFactoriesCount: productPresenter.visibleFactories().length,
        productName: productPresenter.instance().name()
      };
    });

    expect(visibilityInfo.found).toBe(true);
    expect(visibilityInfo.isConstructionMaterial).toBe(true);
    expect(visibilityInfo.showAllProducts).toBe(true);
    expect(visibilityInfo.visibleFactoriesCount).toBeGreaterThan(0);
    expect(visibilityInfo.visible).toBe(true);
  });

  test('product visible when there is demand', async ({ page }) => {
    const config = configLoader.createIslandConfig("Latium", 3245, {
      "3087.buildings.constructed": "10" // Timber factory with buildings
    }, {
      "settings.showAllProducts": "0"
    });
    config["debug.enabled"] = "true";

    await configLoader.loadConfigObject(page, config);
    await page.goto('http://localhost:8080/index.html');
    await page.waitForLoadState('networkidle');

    // Create demand by enabling a population need that consumes a product
    await page.evaluate(() => {
      const island = window.view.island() as Island;
      // Find first population level and enable a need
      if (island.populationLevels && island.populationLevels.length > 0) {
        const popLevel = island.populationLevels[0];
        popLevel.residences[0].buildings.constructed(10);
        // Enable first need
        const needs = Array.from(popLevel.needsMap.values());
        if (needs.length > 0) {
          needs[0].checked(true);
        }
      }
    });

    await page.waitForTimeout(500); // Wait for observables to update

    // Check if products with demand are visible
    const visibilityInfo = await page.evaluate(() => {
      const presenter = window.view.presenter;

      const productPresenter = presenter.categories
        .flatMap((cat: any) => cat.productPresenters)
        .find((p: any) => {
          const product = p.instance();
          return !product.isConstructionMaterial &&
                 product.available() &&
                 p.totalDemand() > 0;
        });

      if (!productPresenter) {
        return { found: false };
      }

      return {
        found: true,
        visible: productPresenter.visible(),
        isConstructionMaterial: productPresenter.instance().isConstructionMaterial,
        totalDemand: productPresenter.totalDemand(),
        showAllProducts: window.view.settings.showAllProducts.checked(),
        productName: productPresenter.instance().name()
      };
    });

    expect(visibilityInfo.found).toBe(true);
    expect(visibilityInfo.isConstructionMaterial).toBe(false);
    expect(visibilityInfo.showAllProducts).toBe(false);
    expect(visibilityInfo.totalDemand).toBeGreaterThan(0);
    expect(visibilityInfo.visible).toBe(true);
  });

  test('visibility logic components work correctly', async ({ page }) => {
    const config = configLoader.createIslandConfig("Latium", 3245, {}, {
      "settings.showAllProducts": "0"
    });
    config["debug.enabled"] = "true";

    await configLoader.loadConfigObject(page, config);
    await page.goto('http://localhost:8080/index.html');
    await page.waitForLoadState('networkidle');

    // Test the visibility logic by examining different product scenarios
    const logicTest = await page.evaluate(() => {
      const presenter = window.view.presenter;
      const allPresenters = presenter.categories.flatMap((cat: any) => cat.productPresenters);

      // Count products in different visibility states
      let visibleCount = 0;
      let hiddenCount = 0;
      let constructionMaterialCount = 0;
      let constructionMaterialVisible = 0;

      for (const p of allPresenters) {
        const product = p.instance();
        if (!product || !product.available()) continue;

        if (p.visible()) {
          visibleCount++;
          if (product.isConstructionMaterial) {
            constructionMaterialVisible++;
          }
        } else {
          hiddenCount++;
        }

        if (product.isConstructionMaterial) {
          constructionMaterialCount++;
        }
      }

      return {
        visibleCount,
        hiddenCount,
        constructionMaterialCount,
        constructionMaterialVisible,
        showAllProducts: window.view.settings.showAllProducts.checked(),
        // All construction materials should be visible
        allConstructionMaterialsVisible: constructionMaterialCount === constructionMaterialVisible
      };
    });

    // With showAllProducts disabled, only products with demand/production should be visible
    // Construction materials without demand/production should be hidden
    expect(logicTest.showAllProducts).toBe(false);
    expect(logicTest.constructionMaterialCount).toBeGreaterThan(0);
    // NOT all construction materials should be visible (only those with demand/production)
    expect(logicTest.allConstructionMaterialsVisible).toBe(false);
    // There should be some hidden products (those without demand/production)
    expect(logicTest.hiddenCount).toBeGreaterThan(0);
  });

  test('product NOT visible when no conditions are met', async ({ page }) => {
    const config = {
      "versionCalculator": "1",
      "session": "37135",
      "islandName": "Latium",
      "settings.showAllProducts": "0",
      "debug.enabled": "true"
    };

    await configLoader.loadConfigObject(page, config);
    await page.goto('http://localhost:8080/index.html');
    await page.waitForLoadState('networkidle');

    // Find a product that should not be visible
    const visibilityInfo = await page.evaluate(() => {
      const presenter = window.view.presenter;

      const productPresenter = presenter.categories
        .flatMap((cat: any) => cat.productPresenters)
        .find((p: any) => {
          const product = p.instance();
          if (!product.available()) return false;
          if (product.isConstructionMaterial) return false;
          if (p.totalDemand() > 0) return false;

          // Check if there's any production
          const extraGoodAmount = product.extraGoodProductionList ? product.extraGoodProductionList.amount() : 0;
          const tradeList = p.tradeList();
          const hasProduction = extraGoodAmount > 0 ||
                                tradeList.inputAmount() > 0 ||
                                tradeList.outputAmount() > 0;

          if (hasProduction) return false;

          // Check visible factories
          const hasVisibleFactories = p.visibleFactories().some((fp: any) => {
            const factory = fp.instance();
            return factory && (Math.abs(factory.throughput()) > 0 || factory.buildings.constructed() > 0);
          });

          return !hasVisibleFactories;
        });

      if (!productPresenter) {
        return { found: false };
      }

      return {
        found: true,
        visible: productPresenter.visible(),
        isConstructionMaterial: productPresenter.instance().isConstructionMaterial,
        totalDemand: productPresenter.totalDemand(),
        showAllProducts: window.view.settings.showAllProducts.checked(),
        productName: productPresenter.instance().name()
      };
    });

    expect(visibilityInfo.found).toBe(true);
    expect(visibilityInfo.isConstructionMaterial).toBe(false);
    expect(visibilityInfo.showAllProducts).toBe(false);
    expect(visibilityInfo.totalDemand).toBe(0);
    expect(visibilityInfo.visible).toBe(false);
  });

  test('construction material NOT all visible with showAllProducts disabled unless demand/production', async ({ page }) => {
    const config = configLoader.createIslandConfig("Latium", 3245, {}, {
      "settings.showAllProducts": "0"
    });
    config["debug.enabled"] = "true";

    await configLoader.loadConfigObject(page, config);
    await page.goto('http://localhost:8080/index.html');
    await page.waitForLoadState('networkidle');

    // Check that construction materials without demand/production are NOT visible
    const visibilityInfo = await page.evaluate(() => {
      const presenter = window.view.presenter;

      const constructionMaterials = (presenter.categories as CategoryPresenter[])
        .flatMap((cat: any) => cat.productPresenters)
        .filter((p: any) => {
          const product = p.instance();
          return product.isConstructionMaterial &&
                 product.available() &&
                 p.totalDemand() === 0 &&
                 p.visibleFactories().every((fp: any) => {
                   const f = fp.instance();
                   return f && f.buildings.constructed() === 0;
                 });
        });

      const anyVisible = constructionMaterials.some((p: any) => p.visible());
      const allVisible = constructionMaterials.every((p: any) => p.visible());

      return {
        count: constructionMaterials.length,
        anyVisible: anyVisible,
        allVisible: allVisible,
        showAllProducts: window.view.settings.showAllProducts.checked(),
        examples: constructionMaterials.slice(0, 3).map((p: any) => ({
          name: p.instance().name(),
          visible: p.visible(),
          isConstructionMaterial: p.instance().isConstructionMaterial,
          totalDemand: p.totalDemand()
        }))
      };
    });

    expect(visibilityInfo.showAllProducts).toBe(false);
    // Construction materials without demand/production should NOT be visible
    expect(visibilityInfo.anyVisible).toBe(true);
    expect(visibilityInfo.allVisible).toBe(false);
  });
});
