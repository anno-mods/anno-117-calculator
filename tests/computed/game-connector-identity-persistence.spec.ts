import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

// Exercises U6/KTD4's identity persistence (Island.getGameConnectorIdentity /
// setGameConnectorIdentity, src/world.ts) directly, independent of the connector's own matching
// logic (covered in tests/computed/game-connector-matching.spec.ts).

const LATIUM_SESSION = 3245;

test.describe('game-connector identity persistence (U6/KTD4)', () => {
  let configLoader: ConfigLoader;

  test.beforeEach(async ({ page }) => {
    configLoader = new ConfigLoader();
    await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Latium', LATIUM_SESSION));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
  });

  test('identity written in one session round-trips as the exact value a fresh Storage instance over the same key would read', async ({ page }) => {
    // A real page.reload() isn't usable here: ConfigLoader's addInitScript re-seeds localStorage
    // from the original fixture on every navigation (including reload), which would overwrite the
    // identity just written before a fresh Island ever gets to read it back - a test-harness
    // artifact, not something src/world.ts's Storage class does. Instead, assert directly against
    // the underlying localStorage JSON: Storage's constructor (src/world.ts) does nothing but
    // `JSON.parse(localStorage.getItem(key))`, so this is exactly what a fresh Storage('Latium')
    // instance - as a reload would construct - reads.
    await page.evaluate(() => {
      const island = (window as any).view.islands().find((i: any) => i.name() === 'Latium');
      island.setGameConnectorIdentity(42, 1);
    });
    // Storage.save() debounces the actual localStorage write via setTimeout(0) - give it a tick to flush.
    await page.waitForTimeout(100);

    const raw = await page.evaluate(() => JSON.parse(localStorage.getItem('Latium') as string));

    expect(raw['gameConnector.islandID']).toBe(42);
    expect(raw['gameConnector.areaIndex']).toBe(1);
  });

  test('an island with no stored identity yet returns null, not an error', async ({ page }) => {
    const identity = await page.evaluate(() => {
      const island = (window as any).view.islands().find((i: any) => i.name() === 'Latium');
      return island.getGameConnectorIdentity();
    });

    expect(identity).toBeNull();
  });
});
