import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Session Icons on Factory Tiles', () => {
  let configLoader: ConfigLoader;

  test.beforeEach(async ({ page }) => {
    configLoader = new ConfigLoader();
    page.on('console', msg => {
        if (msg.type() === 'log') console.log(`[Browser] ${msg.text()}`);
    });
  });

  async function getBasicConfig() {
    const fullPath = path.resolve(process.cwd(), "tests/fixtures/basic.json");
    const configContent = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(configContent);
  }

  async function getWithDataConfig() {
    const fullPath = path.resolve(process.cwd(), "tests/fixtures/with-data.json");
    const configContent = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(configContent);
  }

  const checkProduct = async (page: any, productGuid: number) => {
    const info = await page.evaluate((guid: number) => {
        const presenter = window.view.presenter;
        const p = presenter.categories
            .flatMap((cat: any) => cat.productPresenters)
            .find((p: any) => p.instance().guid === guid);
        
        if (!p) {
            return { hasIcon: false, title: null, error: "Product not found" };
        }

        return {
            hasIcon: p.regionIconVisible(),
            title: p.region() ? p.region().name() : null,
            regionCount: p.product.regions.length,
            visibleFactories: p.visibleFactories().length,
            totalFactories: p.factoryPresenters.length,
            factoryRegions: p.factoryPresenters.map(f => f.region() ? f.region().id : null),
            factoryAssociatedRegionsCount: p.factoryPresenters[0] ? p.factoryPresenters[0].factory.associatedRegions.length : null,
            islandName: window.view.island().name(),
            islandRegion: window.view.island().region.id,
            productRegionId: p.region() ? p.region().id : null,
            regionIsNull: p.region() == null
        };
    }, productGuid);
    return info;
  };

  test.describe('with-data fixture', () => {
    test.beforeEach(async ({ page }) => {
      const config = await getWithDataConfig();
      config["calculatorSettings"] = JSON.stringify({ "settings.showAllProducts": "1" });
      await configLoader.loadConfigObject(page, config);
      await page.goto('/');
      await page.waitForLoadState('networkidle');
    });

    test('Latium, product Aurochs -> session icon Albion', async ({ page }) => {
      // Select Latium
      await page.evaluate(() => {
          const island = window.view.islands().find((i: any) => i.name() === "Latium");
          if (island) { window.view.island(island); }
      });

      const info = await checkProduct(page, 2105); // Aurochs
      console.log('Aurochs on Latium:', info);
      expect(info.hasIcon).toBe(true);
      expect(info.title).toBe("Albion");
    });

    test('Latium, product wine -> no session icon', async ({ page }) => {
      // Select Latium
      await page.evaluate(() => {
          const island = window.view.islands().find((i: any) => i.name() === "Latium");
          if (island) { window.view.island(island); }
      });

      const info = await checkProduct(page, 2138); // Wine
      console.log('Wine on Latium:', info);
      expect(info.hasIcon).toBe(false);
    });

    test('Albion, product Oysters with Caviar -> session icon Latium', async ({ page }) => {
      // Select Albion
      await page.evaluate(() => {
          const island = window.view.islands().find((i: any) => i.name() === "Albion");
          if (island) { window.view.island(island); }
      });

      const info = await checkProduct(page, 2140); // Oysters with Caviar
      console.log('Oysters on Albion:', info);
      expect(info.hasIcon).toBe(true);
      expect(info.title).toBe("Latium");
    });

    test('Albion, product Fine Glass -> session icon Latium', async ({ page }) => {
      // Select Albion
      await page.evaluate(() => {
          const island = window.view.islands().find((i: any) => i.name() === "Albion");
          if (island) { window.view.island(island); }
      });

      const info = await checkProduct(page, 2151); // Fine Glass
      console.log('Fine Glass on Albion:', info);
      expect(info.hasIcon).toBe(true);
      expect(info.title).toBe("Latium");
    });

    test('All islands, product wine -> no session icon', async ({ page }) => {
      // Select All Islands
      await page.evaluate(() => {
          const allIslands = window.view.islands().find((i: any) => i.name() === "All Islands");
          if (allIslands) { window.view.island(allIslands); }
      });

      const info = await checkProduct(page, 2138); // Wine
      console.log('Wine on All Islands:', info);
      expect(info.hasIcon).toBe(false);
    });
  });

  test('DLC active: Idols has session icon on factory tile in allIslands view', async ({ page }) => {
    const config = await getBasicConfig();
    config["calculatorSettings"] = JSON.stringify({ "settings.showAllProducts": "1" });
    
    await configLoader.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Select All Islands
    await page.evaluate(() => {
        const allIslands = window.view.islands().find((i: any) => i.name === "All Islands");
        if (allIslands) { window.view.island(allIslands); }
    });

    // Activate all DLCs
    await page.evaluate(() => {
        window.view.dlcs.forEach((d: any) => d.checked(true));
    });

    const info = await checkProduct(page, 145220);
    expect(info.hasIcon).toBe(true);
  });

  test('DLC inactive: session icons for marble are present', async ({ page }) => {
    const config = await getBasicConfig();
    config["calculatorSettings"] = JSON.stringify({ "settings.showAllProducts": "1" });
    
    await configLoader.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Select All Islands
    await page.evaluate(() => {
        const allIslands = window.view.islands().find((i: any) => i.name === "All Islands");
        if (allIslands) { window.view.island(allIslands); }
    });

    // Deactivate all DLCs
    await page.evaluate(() => {
        window.view.dlcs.forEach((d: any) => d.checked(false));
    });

    // Marble (2179)
    const info = await checkProduct(page, 2179);
    console.log('Marble on All Islands:', info);
    expect(info.hasIcon).toBe(true);
  });

  test('DLC active: Sardines has session icon (Latium-only)', async ({ page }) => {
    const config = await getBasicConfig();
    config["calculatorSettings"] = JSON.stringify({ "settings.showAllProducts": "1" });
    
    await configLoader.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Select All Islands
    await page.evaluate(() => {
        const allIslands = window.view.islands().find((i: any) => i.name === "All Islands");
        if (allIslands) { window.view.island(allIslands); }
    });

    // Activate all DLCs
    await page.evaluate(() => {
        window.view.dlcs.forEach((d: any) => d.checked(true));
    });

    // Sardines (2088)
    const info = await checkProduct(page, 2088);
    expect(info.hasIcon).toBe(true);
  });
});
