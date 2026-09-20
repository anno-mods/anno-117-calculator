import { test, expect } from '@playwright/test';
import { installMockEventSource } from '../helpers';

// Exercises the KTD5 connection-state machine in src/statistics-feed.ts (U3 of the
// live-statistics-page plan) through the statistics.bundle.js entry point.
//
// The anno-117-pipe server does not exist yet (see the plan's Risks & Dependencies), so these
// tests drive a minimal fake `EventSource` (tests/helpers/mock-event-source.ts) installed via
// page.addInitScript() *before* page.goto() navigates, so StatisticsFeed's `new EventSource(url)`
// (called only from the explicit `connect()` - KTD1, never automatically) picks up the fake, not
// a real network connection. The fake stashes every constructed instance on
// window.__mockEventSourceInstances so a test can trigger onopen/onmessage/onerror directly via
// page.evaluate().

function samplePayload(overrides: Partial<{ areaName: string; entries: any[] }> = {}) {
  return JSON.stringify({
    version: 1,
    areaName: overrides.areaName ?? 'Latium',
    // KD3/R1/R2: islandId/areaIndex are the hard identity key - required or the message is dropped.
    islandId: 1,
    areaIndex: 0,
    timeStamp: 12345,
    entries: overrides.entries ?? [
      { productGuid: 2138, generation: 10, consumption: 5, perfectGeneration: 20, perfectConsumption: 10, buildings: 3 }
    ]
  });
}

test.describe('statistics-feed connection state (KTD5)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockEventSource(page);
    await page.goto('/statistics.html');
    await page.waitForFunction(() => (window as any).statisticsFeed !== undefined);
  });

  test('never called automatically: connectionState starts offline with no mock instance created', async ({ page }) => {
    const state = await page.evaluate(() => (window as any).statisticsFeed.connectionState());
    const instanceCount = await page.evaluate(() => (window as any).__mockEventSourceInstances.length);

    expect(state).toBe('offline');
    expect(instanceCount).toBe(0);
  });

  test('EventSource that never opened stays offline (never reconnecting) after onerror', async ({ page }) => {
    await page.evaluate(() => (window as any).statisticsFeed.connect());

    await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onerror();
    });

    const state = await page.evaluate(() => (window as any).statisticsFeed.connectionState());
    expect(state).toBe('offline');
  });

  test('onopen then a message transitions state to live', async ({ page }) => {
    await page.evaluate(() => (window as any).statisticsFeed.connect());

    const payload = samplePayload();
    await page.evaluate((data) => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onopen();
      instance.onmessage({ data });
    }, payload);

    const state = await page.evaluate(() => (window as any).statisticsFeed.connectionState());
    expect(state).toBe('live');
  });

  test('onerror after a prior successful open transitions to reconnecting', async ({ page }) => {
    await page.evaluate(() => (window as any).statisticsFeed.connect());

    await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onopen();
      instance.onerror();
    });

    const state = await page.evaluate(() => (window as any).statisticsFeed.connectionState());
    expect(state).toBe('reconnecting');
  });

  test('sustained errors past the retry threshold transition to offline', async ({ page }) => {
    await page.evaluate(() => (window as any).statisticsFeed.connect());

    // MAX_CONSECUTIVE_RECONNECT_FAILURES in src/statistics-feed.ts is 5 - fire one more error than
    // that so the run is unambiguously past the threshold regardless of off-by-one interpretation.
    const state = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onopen();
      for (let i = 0; i < 6; i++) {
        instance.onerror();
      }
      return (window as any).statisticsFeed.connectionState();
    });

    expect(state).toBe('offline');
  });

  test('reconnecting then a new successful message transitions back to live', async ({ page }) => {
    await page.evaluate(() => (window as any).statisticsFeed.connect());

    const payload = samplePayload();
    const state = await page.evaluate((data) => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onopen();
      instance.onerror(); // -> reconnecting
      instance.onmessage({ data }); // -> live again
      return (window as any).statisticsFeed.connectionState();
    }, payload);

    expect(state).toBe('live');
  });

  test('connect() after reaching offline (never opened) creates a fresh EventSource, not a no-op', async ({ page }) => {
    const result = await page.evaluate(() => {
      const feed = (window as any).statisticsFeed;
      feed.connect();
      const instances = (window as any).__mockEventSourceInstances;
      instances[0].onerror(); // never opened -> straight to offline (KTD5)
      const stateAfterFirstFailure = feed.connectionState();

      feed.connect(); // must not be swallowed by a stale connect() guard
      return { stateAfterFirstFailure, instanceCountAfterSecondConnect: instances.length };
    });

    expect(result.stateAfterFirstFailure).toBe('offline');
    expect(result.instanceCountAfterSecondConnect).toBe(2);
  });

  test('connect() after sustained-failure offline creates a fresh EventSource that can reach live', async ({ page }) => {
    const payload = samplePayload();
    const result = await page.evaluate((data) => {
      const feed = (window as any).statisticsFeed;
      const instances = (window as any).__mockEventSourceInstances;

      feed.connect();
      instances[0].onopen();
      for (let i = 0; i < 6; i++) {
        instances[0].onerror();
      }
      const stateAfterGivingUp = feed.connectionState();

      feed.connect(); // Connect button must still work after the app gave up
      const instanceCountAfterSecondConnect = instances.length;
      instances[1].onopen();
      instances[1].onmessage({ data });
      const stateAfterReconnect = feed.connectionState();

      return { stateAfterGivingUp, instanceCountAfterSecondConnect, stateAfterReconnect };
    }, payload);

    expect(result.stateAfterGivingUp).toBe('offline');
    expect(result.instanceCountAfterSecondConnect).toBe(2);
    expect(result.stateAfterReconnect).toBe('live');
  });

  test('a disconnect-shaped event after data has been received does not clear rows', async ({ page }) => {
    await page.evaluate(() => (window as any).statisticsFeed.connect());

    const payload = samplePayload();
    const result = await page.evaluate((data) => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onopen();
      instance.onmessage({ data });
      const rowsBefore = (window as any).statisticsFeed.islands()[0].rows().length;
      instance.onerror();
      const rowsAfter = (window as any).statisticsFeed.islands()[0].rows().length;
      const generationAfter = (window as any).statisticsFeed.islands()[0].rows()[0].generation();
      return { rowsBefore, rowsAfter, generationAfter, state: (window as any).statisticsFeed.connectionState() };
    }, payload);

    expect(result.rowsBefore).toBe(1);
    expect(result.rowsAfter).toBe(1);
    expect(result.generationAfter).toBe(10);
    expect(result.state).toBe('reconnecting');
  });
});
