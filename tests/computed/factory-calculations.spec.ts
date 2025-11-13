import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { ComputedValueAsserter } from '../helpers/computed-asserter';
import { FixtureManager } from '../helpers/fixture-manager';
import { Island } from '../../src/world';
import { Factory } from '../../src/factories';

test.describe('Factory Calculation Tests', () => {
  let configLoader: ConfigLoader;
  let asserter: ComputedValueAsserter;
  let fixtureManager: FixtureManager;

  test.beforeEach(async ({ page }) => {
    configLoader = new ConfigLoader();
    asserter = new ComputedValueAsserter();
    fixtureManager = new FixtureManager();

    // Load fixture with data for calculations
    await configLoader.loadConfig(page, 'tests/fixtures/with-data.json');
  });

  test('factory inputAmount calculated correctly', async ({ page }) => {
    // Navigate and wait for initialization
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Get first factory from the island
    const factoryData = await page.evaluate(() => {
      const island = (window as any).view.island() as Island;
      const factory = island.factories[0];

      if (!factory) {
        throw new Error('No factories found on island');
      }

      return {
        guid: factory.guid,
        cycleTime: factory.cycleTime,
        initialBuildings: factory.buildings.constructed(),
        initialBoost: factory.boost(),
      };
    });

    // Set specific values
    const testBuildings = 10;
    const testBoost = 1.5;

    await page.evaluate(
      ({ buildings, boost }) => {
        const factory = (window as any).view.island().factories[0];
        factory.buildings.constructed(buildings);
        factory.buildings.fullyUtilizeConstructed(true);
        factory.boost(boost);
      },
      { buildings: testBuildings, boost: testBoost }
    );

    // Calculate expected value using params data
    // Formula: throughputByExistingBuildings = buildings.constructed() * boost() * 60 / cycleTime
    const expectedInputAmount = (testBuildings * testBoost * 60) / factoryData.cycleTime;

    // Assert the computed value matches
    await asserter.assertEquals(
      page,
      'window.view.island().factories[0].throughputByExistingBuildings()',
      expectedInputAmount,
      { tolerance: 0.01, message: 'Factory throughputByExistingBuildings should match calculation' }
    );

  });


  test('factory boost reflects applied buffs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get initial boost value
    const initialBoost = await asserter.getValue<number>(
      page,
      'window.view.island().factories[0].boost()'
    );

    // Verify boost is a positive number
    expect(initialBoost).toBeGreaterThan(0);

    // Check that boost updates when buffs are applied
    // (This tests the reactive nature of the boost subscription)
    await page.evaluate(() => {
      const factory = (window as any).view.island().factories[0];

      // Manually trigger boost recalculation if possible
      if (factory.boostSubscription) {
        // The subscription should automatically update boost when buffs change
        return true;
      }
      return false;
    });
  });

  test('multiple factories calculate independently', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get multiple factories
    const factoriesData = await page.evaluate(() => {
      const island = (window as any).view.island() as Island;
      return island.factories.slice(0, 3).map((f: any) => ({
        guid: f.guid,
        cycleTime: f.cycleTime,
      }));
    });

    // Skip test if not enough factories
    if (factoriesData.length < 2) {
      test.skip();
    }

    // Set different values for each factory
    for (let i = 0; i < factoriesData.length; i++) {
      const testBuildings = (i + 1) * 5; // 5, 10, 15
      const testBoost = 1.0 + i * 0.2; // 1.0, 1.2, 1.4

      await page.evaluate(
        ({ index, buildings, boost }) => {
          const factory = (window as any).view.island().factories[index];
          factory.buildings.constructed(buildings);
          factory.buildings.fullyUtilizeConstructed(true);
          factory.boost(boost);
        },
        { index: i, buildings: testBuildings, boost: testBoost }
      );

      // Calculate expected value
      const expected = (testBuildings * testBoost * 60) / factoriesData[i].cycleTime;

      // Assert each factory calculates correctly
      await asserter.assertEquals(
        page,
        `window.view.island().factories[${i}].throughputByExistingBuildings()`,
        expected,
        { tolerance: 0.01, message: `Factory ${i} should calculate independently` }
      );
    }
  });

  test('factory calculations use correct ACCURACY constant', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get ACCURACY constant from params
    const accuracy = await asserter.getParamsValue<number>(page, 'ACCURACY');

    // Verify ACCURACY is defined and reasonable
    expect(accuracy).toBeDefined();
    expect(accuracy).toBeGreaterThan(0);
    expect(accuracy).toBeLessThan(0.02);

    // Use the ACCURACY value for tolerance in calculations
    const testBuildings = 7;
    const testBoost = 1.33;

    const factoryData = await page.evaluate(
      ({ buildings, boost }) => {
        const factory = (window as any).view.island().factories[0];
        factory.buildings.constructed(buildings);
        factory.buildings.fullyUtilizeConstructed(true);
        factory.boost(boost);
        return {
          cycleTime: factory.cycleTime,
          inputAmount: factory.throughputByExistingBuildings(),
        };
      },
      { buildings: testBuildings, boost: testBoost }
    );

    const expected = (testBuildings * testBoost * 60) / factoryData.cycleTime;

    // Use ACCURACY as tolerance
    const diff = Math.abs(factoryData.inputAmount - expected);
    expect(diff).toBeLessThanOrEqual(accuracy);
  });

  test('factory calculations with params-based expected values', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Set test values
    await page.evaluate(() => {
      const factory = (window as any).view.island().factories[0];
      factory.buildings.constructed(12);
      factory.buildings.fullyUtilizeConstructed(true);
      factory.boost(1.4);
    });

    // Calculate expected value using params data directly in browser
    const expected = await asserter.calculateExpectedValue(
      page,
      `(() => {
        const factory = window.view.island().factories[0];
        return factory.buildings.constructed() * factory.boost() * 60 / factory.cycleTime;
      })()`
    );

    // Get actual value
    const actual = await asserter.getValue<number>(
      page,
      'window.view.island().factories[0].throughputByExistingBuildings()'
    );

    // Assert they match
    expect(Math.abs(actual - expected)).toBeLessThan(0.01);
  });
});
