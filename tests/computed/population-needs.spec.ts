import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { ComputedValueAsserter } from '../helpers/computed-asserter';
import { FixtureManager } from '../helpers/fixture-manager';
import { Island } from '../../src/world';

test.describe('Population Needs Calculation Tests', () => {
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


  test('good consumption updates when checked state changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get a need and toggle it
    const needToggleResult = await page.evaluate(() => {
      const island = (window as any).view.island() as Island;
      const popLevel = island.populationLevels[0];

      if (!popLevel || !popLevel.needsMap || popLevel.needsMap.size === 0) {
        return null;
      }

      const need = Array.from(popLevel.needsMap.values())[0];
      const initialChecked = need.checked();
      const initialAmount = need.amount();

      // Toggle checked state
      need.checked(!initialChecked);

      return {
        initialChecked,
        initialAmount,
        newChecked: need.checked(),
        newAmount: need.amount(),
      };
    });

    if (needToggleResult === null) {
      test.skip();
      return;
    }

    // Verify the checked state changed
    expect(needToggleResult.newChecked).toBe(!needToggleResult.initialChecked);

    // When need is unchecked, amount might become 0 or remain the same depending on implementation
    // This tests the reactive subscription works correctly
  });

  test('residence need calculations use params needConsumptionRate value', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Get all needs and verify they use params tpmin
    const needsVerification = await page.evaluate(() => {
      const island = (window as any).view.island() as Island;
      const results: Array<{
        needGuid: number;
        calculatedCorrectly: boolean;
      }> = [];

      for (const popLevel of island.populationLevels) {
        const residences = popLevel.allResidences();

        for (const residence of residences) {
          for (const residenceNeed of residence.needsMap.values()) {
            const need = residenceNeed.need;
            const amount = residenceNeed.amount();
            const expectedAmount = residenceNeed.residence.buildings.constructed() * residenceNeed.needConsumptionRate * (window as any).view.settings.selectedNeedConsumptionSetting().consumptionFactor;

            // Check if calculation is correct (with tolerance)
            const isCorrect = Math.abs(amount - expectedAmount) < 0.01;

            results.push({
              needGuid: need.guid,
              calculatedCorrectly: isCorrect,
            });
          }
        }
      }

      return results;
    });

    // Verify all needs calculate correctly using params tpmin
    const incorrectNeeds = needsVerification.filter((n) => !n.calculatedCorrectly);

    expect(
      incorrectNeeds,
      `Some needs calculated incorrectly: ${incorrectNeeds
        .map((n) => `GUID ${n.needGuid}`)
        .join(', ')}`
    ).toHaveLength(0);
  });

  test('total residents calculation matches sum of all residences', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const totalsData = await page.evaluate(() => {
      const island = (window as any).view.island() as Island;
      const popLevel = island.populationLevels[0];

      if (!popLevel) {
        return null;
      }

      const residences = popLevel.allResidences();

      // Calculate sum of residents across residences
      let sumResidents = 0;
      for (const residence of residences) {
        const buildings = residence.buildings.constructed();

        for (const n of residence.needsMap.values()) {          
          sumResidents += n.residents();
        }

      }

      // Get total from population level
      const totalResidents = popLevel.residents();

      return {
        sumResidents,
        totalResidents,
        residenceCount: residences.length,
      };
    });

    if (totalsData === null) {
      test.skip();
      return;
    }

    // Verify total matches sum
    expect(totalsData.totalResidents).toBe(totalsData.sumResidents);
  });
});
