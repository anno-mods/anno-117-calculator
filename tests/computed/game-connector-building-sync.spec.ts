import { test, expect } from '@playwright/test';
import { installMockEventSource } from '../helpers';
import { ConfigLoader } from '../helpers/config-loader';

// Exercises R4/R5 (src/game-connector.ts's syncReport) through the main bundle's index.html entry
// point. AverageProductivity values are passed already in 0-100 form (e.g. 75, not 0.75) to match
// the plan's explicit template contract for the bracketed display (U4's Approach: no `* 100`
// multiplication, unlike the calculator's own computed `boost()`).

const LATIUM_SESSION = 3245;
const TIMBER_FACTORY_GUID = 3089;
// Product 31697 (Gold) is produced by two Roman-region factory types, so both can coexist on the
// same (Roman) island's assetsMap - unlike Wine's two factory types, which are region-exclusive
// (Roman Vintner 3177 vs. Celtic Vintner 23753) and can never appear together on one island.
const GOLD_MINE_GUID = 50280;
const GOLD_WASHER_GUID = 31753;
const LIMESTONE_QUARRY_GUID = 2916;
const UNKNOWN_BUILDING_GUID = 999999999;

function tickPayload(entries: any[]) {
  return JSON.stringify([{
    sessionGuid: LATIUM_SESSION,
    islandId: 1,
    areaIndex: 0,
    areaName: 'Latium',
    entries
  }]);
}

async function sendTick(page: any, entries: any[]) {
  await page.evaluate((data: string) => {
    const instances = (window as any).__mockEventSourceInstances;
    instances[instances.length - 1].onmessage({ data });
  }, tickPayload(entries));
}

test.describe('game-connector building-count and productivity write path (U4/R4/R5)', () => {
  let configLoader: ConfigLoader;

  test.beforeEach(async ({ page }) => {
    configLoader = new ConfigLoader();
    await installMockEventSource(page);
    await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Latium', LATIUM_SESSION));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.gameConnector);
    await page.evaluate(() => {
      (window as any).view.gameConnector.connect();
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onopen();
    });
  });

  test('a buildingsByGuid entry matching an existing Factory writes constructed and syncedAverageProductivity', async ({ page }) => {
    await sendTick(page, [{
      productGuid: 2077,
      buildingsByGuid: { [TIMBER_FACTORY_GUID]: 4 },
      averageProductivity: 75
    }]);

    const result = await page.evaluate((guid) => {
      const island = (window as any).view.islands().find((i: any) => i.name() === 'Latium');
      const factory = island.assetsMap.get(guid);
      return { constructed: factory.buildings.constructed(), productivity: factory.syncedAverageProductivity() };
    }, TIMBER_FACTORY_GUID);

    expect(result.constructed).toBe(4);
    expect(result.productivity).toBe(75);
  });

  test('an unmatched buildingGuid is skipped without throwing and without affecting other entries', async ({ page }) => {
    await sendTick(page, [
      { productGuid: 2077, buildingsByGuid: { [UNKNOWN_BUILDING_GUID]: 9 }, averageProductivity: 50 },
      { productGuid: 2115, buildingsByGuid: { [LIMESTONE_QUARRY_GUID]: 2 }, averageProductivity: 90 }
    ]);

    const result = await page.evaluate((guid) => {
      const island = (window as any).view.islands().find((i: any) => i.name() === 'Latium');
      const quarry = island.assetsMap.get(guid);
      return { constructed: quarry.buildings.constructed(), state: (window as any).view.gameConnector.state() };
    }, LIMESTONE_QUARRY_GUID);

    expect(result.constructed).toBe(2);
    expect(result.state).toBe('connected'); // no exception thrown
  });

  test('a product with two factory types shows the identical AverageProductivity on both', async ({ page }) => {
    await sendTick(page, [{
      productGuid: 31697, // Gold
      buildingsByGuid: { [GOLD_MINE_GUID]: 2, [GOLD_WASHER_GUID]: 3 },
      averageProductivity: 60
    }]);

    const result = await page.evaluate(({ mineGuid, washerGuid }) => {
      const island = (window as any).view.islands().find((i: any) => i.name() === 'Latium');
      const mine = island.assetsMap.get(mineGuid);
      const washer = island.assetsMap.get(washerGuid);
      return {
        romanConstructed: mine.buildings.constructed(),
        celticConstructed: washer.buildings.constructed(),
        romanProductivity: mine.syncedAverageProductivity(),
        celticProductivity: washer.syncedAverageProductivity()
      };
    }, { mineGuid: GOLD_MINE_GUID, washerGuid: GOLD_WASHER_GUID });

    expect(result.romanConstructed).toBe(2);
    expect(result.celticConstructed).toBe(3);
    expect(result.romanProductivity).toBe(60);
    expect(result.celticProductivity).toBe(60);
  });

  test('sync always wins: a manual edit between two ticks is overwritten by the next report', async ({ page }) => {
    await sendTick(page, [{ productGuid: 2077, buildingsByGuid: { [TIMBER_FACTORY_GUID]: 4 }, averageProductivity: 50 }]);

    await page.evaluate((guid) => {
      const island = (window as any).view.islands().find((i: any) => i.name() === 'Latium');
      island.assetsMap.get(guid).buildings.constructed(99); // user manually types something else
    }, TIMBER_FACTORY_GUID);

    await sendTick(page, [{ productGuid: 2077, buildingsByGuid: { [TIMBER_FACTORY_GUID]: 7 }, averageProductivity: 50 }]);

    const constructed = await page.evaluate((guid) => {
      const island = (window as any).view.islands().find((i: any) => i.name() === 'Latium');
      return island.assetsMap.get(guid).buildings.constructed();
    }, TIMBER_FACTORY_GUID);

    expect(constructed).toBe(7);
  });

  test('disconnecting clears the bracket but leaves buildings.constructed() at its last synced value', async ({ page }) => {
    await sendTick(page, [{ productGuid: 2077, buildingsByGuid: { [TIMBER_FACTORY_GUID]: 4 }, averageProductivity: 50 }]);

    const result = await page.evaluate((guid) => {
      (window as any).view.gameConnector.disconnect();
      const island = (window as any).view.islands().find((i: any) => i.name() === 'Latium');
      const factory = island.assetsMap.get(guid);
      return { constructed: factory.buildings.constructed(), productivity: factory.syncedAverageProductivity() };
    }, TIMBER_FACTORY_GUID);

    expect(result.constructed).toBe(4);
    expect(result.productivity).toBeNull();
  });
});
