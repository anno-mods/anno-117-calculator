import { test, expect } from '@playwright/test';
import { installMockEventSource } from '../helpers';
import { ConfigLoader } from '../helpers/config-loader';

// Exercises the U1 connection-state machine in src/game-connector.ts through the main index.html
// entry point. anno-117-pipe's real local server does not exist yet (KTD7), so these tests drive
// a minimal fake EventSource (tests/helpers/mock-event-source.ts) - same mechanism as the
// statistics page's own connection-state tests, but an independent GameConnector instance
// (KTD1: no shared implementation with src/statistics-feed.ts).

const LATIUM_SESSION = 3245;
const TIMBER_FACTORY_GUID = 3089;

test.describe('game-connector connection state (U1)', () => {
  let configLoader: ConfigLoader;

  test.beforeEach(async ({ page }) => {
    configLoader = new ConfigLoader();
    await installMockEventSource(page);
    await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Latium', LATIUM_SESSION));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.gameConnector);
  });

  test('never called automatically: state starts disconnected with no mock instance created', async ({ page }) => {
    const state = await page.evaluate(() => (window as any).view.gameConnector.state());
    const instanceCount = await page.evaluate(() => (window as any).__mockEventSourceInstances.length);

    expect(state).toBe('disconnected');
    expect(instanceCount).toBe(0);
  });

  test('connect() transitions disconnected -> connecting -> connected on a successful open', async ({ page }) => {
    const connecting = await page.evaluate(() => {
      (window as any).view.gameConnector.connect();
      return (window as any).view.gameConnector.state();
    });
    expect(connecting).toBe('connecting');

    const connected = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onopen();
      return (window as any).view.gameConnector.state();
    });
    expect(connected).toBe('connected');
  });

  test('a transport error while connected transitions to reconnecting, then offline after exhausting retries', async ({ page }) => {
    const result = await page.evaluate(() => {
      const connector = (window as any).view.gameConnector;
      connector.connect();
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onopen();
      instance.onerror();
      const afterOneError = connector.state();
      // MAX_CONSECUTIVE_RECONNECT_FAILURES in src/game-connector.ts is 5 - fire one more than that.
      for (let i = 0; i < 6; i++) instance.onerror();
      const afterManyErrors = connector.state();
      return { afterOneError, afterManyErrors };
    });

    expect(result.afterOneError).toBe('reconnecting');
    expect(result.afterManyErrors).toBe('offline');
  });

  test('an EventSource that never opened goes straight to offline (never reconnecting) after onerror', async ({ page }) => {
    await page.evaluate(() => (window as any).view.gameConnector.connect());
    const state = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onerror();
      return (window as any).view.gameConnector.state();
    });
    expect(state).toBe('offline');
  });

  test('disconnect() while connected returns to disconnected and clears touched factories\' productivity, without touching buildings.constructed', async ({ page }) => {
    const result = await page.evaluate((factoryGuid) => {
      const view = (window as any).view;
      const connector = view.gameConnector;
      connector.connect();
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onopen();

      const payload = JSON.stringify([{
        sessionGuid: 3245,
        islandId: 1,
        areaIndex: 0,
        areaName: 'Latium',
        entries: [{ productGuid: 2077, buildingsByGuid: { [factoryGuid]: 5 }, averageProductivity: 80 }]
      }]);
      instance.onmessage({ data: payload });

      connector.disconnect();

      const island = view.islands().find((i: any) => i.name() === 'Latium');
      const factory = island.assetsMap.get(factoryGuid);
      return {
        state: connector.state(),
        constructed: factory.buildings.constructed(),
        syncedAverageProductivity: factory.syncedAverageProductivity()
      };
    }, TIMBER_FACTORY_GUID);

    expect(result.state).toBe('disconnected');
    expect(result.constructed).toBe(5);
    expect(result.syncedAverageProductivity).toBeNull();
  });

  test('connect() after reaching offline creates a fresh EventSource, not a no-op', async ({ page }) => {
    const result = await page.evaluate(() => {
      const connector = (window as any).view.gameConnector;
      connector.connect();
      const instances = (window as any).__mockEventSourceInstances;
      instances[0].onerror(); // never opened -> straight to offline
      const stateAfterFirstFailure = connector.state();

      connector.connect(); // must not be swallowed by a stale connect() guard
      return { stateAfterFirstFailure, instanceCount: instances.length };
    });

    expect(result.stateAfterFirstFailure).toBe('offline');
    expect(result.instanceCount).toBe(2);
  });
});
