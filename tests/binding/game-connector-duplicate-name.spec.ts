import { test, expect } from '@playwright/test';
import { installMockEventSource } from '../helpers';
import { ConfigLoader } from '../helpers/config-loader';

// Exercises R3's duplicate-name refusal and its navbar-area error UI (src/game-connector.ts's
// processTick(), index.html's .alert-warning element).

const LATIUM_SESSION = 3245;
const ALBION_SESSION = 6627;

function report(overrides: any = {}) {
  return {
    sessionGuid: overrides.sessionGuid ?? LATIUM_SESSION,
    islandId: overrides.islandId ?? 1,
    areaIndex: overrides.areaIndex ?? 0,
    areaName: overrides.areaName ?? 'Latium',
    entries: []
  };
}

async function sendBatch(page: any, reports: any[]) {
  const payload = JSON.stringify(reports);
  await page.evaluate((data: string) => {
    const instances = (window as any).__mockEventSourceInstances;
    instances[instances.length - 1].onmessage({ data });
  }, payload);
}

test.describe('game-connector duplicate-name refusal (U3/R3)', () => {
  let configLoader: ConfigLoader;

  test.beforeEach(async ({ page }) => {
    configLoader = new ConfigLoader();
    await installMockEventSource(page);
    await configLoader.loadConfigObject(page, configLoader.createFullConfig([], {}, undefined));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.gameConnector);
    // Remove any unrelated startup notification toasts (bootstrap-notify) - they can render on
    // top of the navbar and intercept clicks on the duplicate-name alert's dismiss button below.
    await page.evaluate(() => {
      document.querySelectorAll('[data-notify="container"]').forEach(el => el.remove());
    });
    await page.evaluate(() => {
      (window as any).view.gameConnector.connect();
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onopen();
    });
  });

  test('two distinct-identity reports sharing one areaName: neither syncs, error names the island', async ({ page }) => {
    await sendBatch(page, [
      report({ islandId: 1, areaName: 'Contested' }),
      report({ islandId: 2, sessionGuid: ALBION_SESSION, areaName: 'Contested' })
    ]);

    const islandExists = await page.evaluate(() =>
      !!(window as any).view.islands().find((i: any) => i.name() === 'Contested'));
    expect(islandExists).toBe(false);

    const alert = page.locator('.alert-warning');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Contested');
  });

  test('the same island re-reporting within one tick (identical identity) is not treated as a collision', async ({ page }) => {
    await sendBatch(page, [
      report({ islandId: 1, areaName: 'Latium' }),
      report({ islandId: 1, areaName: 'Latium' })
    ]);

    const islandExists = await page.evaluate(() =>
      !!(window as any).view.islands().find((i: any) => i.name() === 'Latium'));
    expect(islandExists).toBe(true);
    await expect(page.locator('.alert-warning')).not.toBeVisible();
  });

  test('dismissing hides the error; a later tick with no collision does not resurface it', async ({ page }) => {
    await sendBatch(page, [
      report({ islandId: 1, areaName: 'Contested' }),
      report({ islandId: 2, sessionGuid: ALBION_SESSION, areaName: 'Contested' })
    ]);

    const alert = page.locator('.alert-warning');
    await expect(alert).toBeVisible();
    await alert.locator('button.close').click({ force: true });
    await expect(alert).not.toBeVisible();

    await sendBatch(page, [report({ islandId: 3, areaName: 'Peaceful' })]);

    await expect(alert).not.toBeVisible();
  });
});
