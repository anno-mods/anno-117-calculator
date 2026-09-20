import { test, expect } from '@playwright/test';
import { installMockEventSource } from '../helpers';

// Binding tests for U5 (connection indicator + explicit Connect action) in statistics.html /
// src/statistics.ts, driven through the shared mock EventSource
// (tests/helpers/mock-event-source.ts). These assert on the rendered DOM (button presence,
// indicator text, indicator CSS class) per the plan's U5 test scenarios (Covers AE4), not just
// window.statisticsFeed's view-model state - U3 already covers the state machine itself.

function samplePayload() {
  return JSON.stringify({
    version: 1,
    areaName: 'Latium',
    islandId: 1,
    areaIndex: 0,
    timeStamp: 1,
    entries: [
      // Wine (2138): real params match, non-zero values (GUIDs per tests/AGENTS.md).
      { productGuid: 2138, generation: 15, consumption: 5, perfectGeneration: 20, perfectConsumption: 10, buildings: 2 }
    ]
  });
}

test.describe('statistics.html connection indicator and Connect action (U5)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockEventSource(page);
    await page.goto('/statistics.html');
    await page.waitForFunction(() => (window as any).statisticsFeed !== undefined && (window as any).statisticsView !== undefined);
  });

  test('cold start: Offline indicator, empty table, Connect button present, no error rendered', async ({ page }) => {
    const indicator = page.locator('#statistics-root .badge');
    await expect(indicator).toHaveText('Offline');
    await expect(indicator).toHaveClass(/badge-secondary/);
    await expect(indicator).not.toHaveClass(/badge-success/);
    await expect(indicator).not.toHaveClass(/badge-warning/);

    const connectButton = page.locator('#statistics-root button', { hasText: 'Connect to running game' });
    await expect(connectButton).toHaveCount(1);
    await expect(connectButton).toBeVisible();

    // Empty tbody (from U4) - no rows rendered yet, no console-visible binding error.
    await expect(page.locator('#statistics-table-pane table tbody tr')).toHaveCount(0);

    // connect() must never be called automatically (KTD1) - no EventSource instance yet.
    const instanceCount = await page.evaluate(() => (window as any).__mockEventSourceInstances.length);
    expect(instanceCount).toBe(0);
  });

  test('clicking Connect then receiving a message transitions the indicator from Offline to Live', async ({ page }) => {
    const indicator = page.locator('#statistics-root .badge');
    await expect(indicator).toHaveText('Offline');

    const connectButton = page.locator('#statistics-root button', { hasText: 'Connect to running game' });
    await connectButton.click();

    // Clicking Connect alone (before onopen/onmessage) must not yet claim Live.
    await expect(indicator).toHaveText('Offline');

    const payload = samplePayload();
    await page.evaluate((data) => {
      const instance = (window as any).__mockEventSourceInstances[(window as any).__mockEventSourceInstances.length - 1];
      instance.onopen();
      instance.onmessage({ data });
    }, payload);

    await expect(indicator).toHaveText('Live');
    await expect(indicator).toHaveClass(/badge-success/);

    const rows = page.locator('#statistics-table-pane table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Wine' })).toHaveCount(1);
  });

  test('an error after data has rendered flips the indicator to Reconnecting while the row stays visible (AE4)', async ({ page }) => {
    const connectButton = page.locator('#statistics-root button', { hasText: 'Connect to running game' });
    await connectButton.click();

    const payload = samplePayload();
    await page.evaluate((data) => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onopen();
      instance.onmessage({ data });
    }, payload);

    const indicator = page.locator('#statistics-root .badge');
    await expect(indicator).toHaveText('Live');

    await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onerror();
    });

    await expect(indicator).toHaveText('Reconnecting');
    await expect(indicator).toHaveClass(/badge-warning/);

    // AE4: the last-received row is still visible in the DOM while reconnecting.
    const rows = page.locator('#statistics-table-pane table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Wine' })).toHaveCount(1);
  });

  test('sustained errors past the retry threshold move the indicator to Offline while the table still shows the last values', async ({ page }) => {
    const connectButton = page.locator('#statistics-root button', { hasText: 'Connect to running game' });
    await connectButton.click();

    const payload = samplePayload();
    await page.evaluate((data) => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onopen();
      instance.onmessage({ data });
    }, payload);

    const indicator = page.locator('#statistics-root .badge');
    await expect(indicator).toHaveText('Live');

    // MAX_CONSECUTIVE_RECONNECT_FAILURES in src/statistics-feed.ts is 5 - fire one more error than
    // that so the run is unambiguously past the threshold regardless of off-by-one interpretation.
    await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      for (let i = 0; i < 6; i++) {
        instance.onerror();
      }
    });

    await expect(indicator).toHaveText('Offline');
    await expect(indicator).toHaveClass(/badge-secondary/);

    const rows = page.locator('#statistics-table-pane table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Wine' })).toHaveCount(1);
  });
});
