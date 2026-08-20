import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

test.describe('Obsidian Production Fixture Test', () => {
  let configLoader: ConfigLoader;

  const LATIUM_SESSION = 3245;
  const ALBION_SESSION = 6627;

  test.beforeEach(async ({ page }) => {
    configLoader = new ConfigLoader();
    
    // Create a full config with both islands
    const config = configLoader.createFullConfig([
        { 
            name: 'Latium', 
            session: LATIUM_SESSION, 
            data: {
                "3145.buildings.constructed": "1000",
                "island.effect.145095.scaling": "1",
                "145102.defaultSupplier.type": "extra_good",
                "145102.defaultSupplier.id": "2916"
            }
        },
        { 
            name: 'Albion', 
            session: ALBION_SESSION,
            data: {
                "6475.buildings.constructed": "1"
            }
        }
    ]);

    await configLoader.loadConfigObject(page, config);
    
    await page.goto('/');
    
    // Wait for params to be loaded
    await page.waitForFunction(() => (window as any).params !== undefined, { timeout: 10000 });

    // Wait for islands to be initialized
    await page.waitForFunction(() => {
      const view = (window as any).view;
      return view && view.islands && view.islands().length >= 3; // All Islands + Latium + Albion
    }, { timeout: 10000 });
  });

  test('Latium: check if obsidian production matches demand', async ({ page }) => {
    const results = await page.evaluate(() => {
      const view = (window as any).view;
      const latium = view.islands().find((i: any) => i.name() === "Latium");
      view.island(latium);
      
      const PRODUCT_OBSIDIAN = 145102;
      const obsidian = latium.assetsMap.get(PRODUCT_OBSIDIAN);
      
      const patrician = latium.residenceBuildings.find((r: any) => r.guid === 3145);
      
      const EFFECT_OBSIDIAN_GATHERING = 145095;
      const effect = latium.allEffects.find((e: any) => e.guid === EFFECT_OBSIDIAN_GATHERING);

      return {
          produced: obsidian.totalCurrentProduction(),
          consumed: obsidian.totalDemand(),
          defaultSupplier: obsidian.defaultSupplier()?.type,
          latiumConstructed: patrician?.buildings.constructed(),
          effectScaling: effect?.scaling()
      };
    });

    console.log('Results:', results);
    // In the fixture, 1000 Patrician Residences are constructed in Latium
    expect(results.latiumConstructed).toBe(1000);
    expect(results.effectScaling).toBe(1);
    expect(results.produced).toBeGreaterThan(0);
    // 1000 Patrician = 8.333 demand. 
    // Roman Limestone Quarry (2916) at 100% produces 1/12 obsidian as byproduct.
    // Base production of 2916 is 1 t/min. 1/12 = 0.0833 t/min per factory.
    // 1000 Patricians need 100 Limestone quarries to be fully supplied, which are driven
    // by the ExtraGoodSupplier.
    expect(results.produced).toBeCloseTo(8.333, 3);
  });

  test('Albion: check if settings load correctly', async ({ page }) => {
    const results = await page.evaluate(() => {
      const view = (window as any).view;
      const albion = view.islands().find((i: any) => i.name() === "Albion");
      
      const RESIDENCE_CELTIC_T1 = 6475; // Laborer
      const laborer = albion.residenceBuildings.find((r: any) => r.guid === RESIDENCE_CELTIC_T1);
      
      return {
          laborerConstructed: laborer?.buildings.constructed()
      };
    });

    console.log('Albion Results:', results);
    expect(results.laborerConstructed).toBe(1);
  });
});
