import { test, expect } from '@playwright/test';
import { installMockEventSource } from '../helpers';
import { ConfigLoader } from '../helpers/config-loader';

// Exercises R2's matching order (src/game-connector.ts's resolveIsland) through the main
// index.html entry point.

const LATIUM_SESSION = 3245;

function reportPayload(overrides: Partial<{ sessionGUID: number; islandID: number; areaIndex: number; areaName: string }> = {}) {
  return JSON.stringify([{
    sessionGuid: overrides.sessionGUID ?? LATIUM_SESSION,
    islandId: overrides.islandID ?? 1,
    areaIndex: overrides.areaIndex ?? 0,
    areaName: overrides.areaName ?? 'Latium',
    entries: []
  }]);
}

async function send(page: any, data: string) {
  await page.evaluate((payload: string) => {
    const instances = (window as any).__mockEventSourceInstances;
    instances[instances.length - 1].onmessage({ data: payload });
  }, data);
}

async function connect(page: any) {
  await page.evaluate(() => {
    (window as any).view.gameConnector.connect();
    const instances = (window as any).__mockEventSourceInstances;
    instances[instances.length - 1].onopen();
  });
}

test.describe('game-connector island matching (U2/R2)', () => {
  let configLoader: ConfigLoader;

  test.beforeEach(async ({ page }) => {
    configLoader = new ConfigLoader();
    await installMockEventSource(page);
  });

  test('a report with no stored identity but a name match auto-links and persists identity', async ({ page }) => {
    await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Latium', LATIUM_SESSION));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.gameConnector);
    await connect(page);

    await send(page, reportPayload());

    const result = await page.evaluate(() => {
      const view = (window as any).view;
      const island = view.islands().find((i: any) => i.name() === 'Latium');
      return { identity: island.getGameConnectorIdentity(), islandCount: view.islands().length };
    });

    expect(result.identity).toEqual({ islandID: 1, areaIndex: 0 });
    expect(result.islandCount).toBe(2); // Latium + All Islands - no new island created
  });

  test('a stored-identity match takes priority even after the island is renamed', async ({ page }) => {
    await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Latium', LATIUM_SESSION));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.gameConnector);
    await connect(page);

    // First tick: name match auto-links and stores identity.
    await send(page, reportPayload());

    await page.evaluate(() => {
      const view = (window as any).view;
      const island = view.islands().find((i: any) => i.name() === 'Latium');
      island.name('Renamed Island');
    });

    // Second tick: identical identity, but the report's areaName ('Latium') no longer matches the
    // renamed island's current name - must still resolve via stored identity, not create a new
    // island or fail to match.
    await send(page, reportPayload());

    const result = await page.evaluate(() => {
      const view = (window as any).view;
      const renamed = view.islands().find((i: any) => i.name() === 'Renamed Island');
      return {
        islandCount: view.islands().length,
        renamedFound: !!renamed,
        identity: renamed ? renamed.getGameConnectorIdentity() : null
      };
    });

    expect(result.islandCount).toBe(2);
    expect(result.renamedFound).toBe(true);
    expect(result.identity).toEqual({ islandID: 1, areaIndex: 0 });
  });

  test('no identity or name match creates a new Island via IslandManager.create with the resolved session', async ({ page }) => {
    await configLoader.loadConfigObject(page, configLoader.createFullConfig([], {}, undefined));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.gameConnector);
    await connect(page);

    await send(page, reportPayload({ areaName: 'New Colony' }));

    const result = await page.evaluate(() => {
      const view = (window as any).view;
      const island = view.islands().find((i: any) => i.name() === 'New Colony');
      return {
        found: !!island,
        sessionGuid: island ? island.session.guid : null,
        identity: island ? island.getGameConnectorIdentity() : null
      };
    });

    expect(result.found).toBe(true);
    expect(result.sessionGuid).toBe(LATIUM_SESSION);
    expect(result.identity).toEqual({ islandID: 1, areaIndex: 0 });
  });

  test('an unresolved sessionGUID skips the report: no island created, no exception thrown', async ({ page }) => {
    await configLoader.loadConfigObject(page, configLoader.createFullConfig([], {}, undefined));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.gameConnector);
    await connect(page);

    const beforeCount = await page.evaluate(() => (window as any).view.islands().length);
    await send(page, reportPayload({ sessionGUID: 999999999, areaName: 'Ghost Island' }));

    const result = await page.evaluate(() => ({
      afterCount: (window as any).view.islands().length,
      state: (window as any).view.gameConnector.state()
    }));

    expect(result.afterCount).toBe(beforeCount);
    expect(result.state).toBe('connected'); // no exception - connection stayed alive
  });

  test('a report matching a previously-stored identity syncs into that island without re-checking the name', async ({ page }) => {
    await configLoader.loadConfigObject(page, configLoader.createFullConfig(
      [{ name: 'Alpha', session: LATIUM_SESSION }, { name: 'Beta', session: LATIUM_SESSION }],
      {}, 'Alpha'
    ));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.gameConnector);
    await connect(page);

    // Link "Beta" to islandID 7 explicitly (simulating an earlier tick).
    await page.evaluate(() => {
      const view = (window as any).view;
      const beta = view.islands().find((i: any) => i.name() === 'Beta');
      beta.setGameConnectorIdentity(7, 0);
    });

    // A report with areaName 'Alpha' (matching a different island by name) but islandID 7 must
    // still resolve to Beta via stored identity, not to Alpha via name.
    await send(page, reportPayload({ islandID: 7, areaName: 'Alpha' }));

    const result = await page.evaluate(() => {
      const view = (window as any).view;
      const alpha = view.islands().find((i: any) => i.name() === 'Alpha');
      return {
        alphaHasIdentity: !!alpha.getGameConnectorIdentity(),
        islandCount: view.islands().length
      };
    });

    expect(result.alphaHasIdentity).toBe(false);
    expect(result.islandCount).toBe(3); // Alpha + Beta + All Islands - no new island created
  });
});
