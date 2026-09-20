import { test, expect } from '@playwright/test';
import { installMockEventSource } from '../helpers';
import { ConfigLoader } from '../helpers/config-loader';

// Exercises R1's navbar Connect/Disconnect control (index.html's #game-connector-toggle button,
// wired in src/main.ts).

const LATIUM_SESSION = 3245;

test.describe('game-connector navbar control (U5/R1)', () => {
  let configLoader: ConfigLoader;

  test.beforeEach(async ({ page }) => {
    configLoader = new ConfigLoader();
    await installMockEventSource(page);
    await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Latium', LATIUM_SESSION));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.gameConnector);
  });

  test('clicking while disconnected calls connect()', async ({ page }) => {
    await page.locator('#game-connector-toggle').click();
    const state = await page.evaluate(() => (window as any).view.gameConnector.state());
    expect(state).toBe('connecting');
  });

  test('clicking while connected calls disconnect()', async ({ page }) => {
    await page.evaluate(() => {
      (window as any).view.gameConnector.connect();
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onopen();
    });
    await expect(page.locator('#game-connector-toggle')).toHaveAttribute('title', 'Connected');

    await page.locator('#game-connector-toggle').click();
    const state = await page.evaluate(() => (window as any).view.gameConnector.state());
    expect(state).toBe('disconnected');
  });

  test('the tooltip reflects each of the five connection states', async ({ page }) => {
    const button = page.locator('#game-connector-toggle');

    await expect(button).toHaveAttribute('title', 'Disconnected');

    await page.evaluate(() => (window as any).view.gameConnector.connect());
    await expect(button).toHaveAttribute('title', 'Connecting…');

    await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onopen();
    });
    await expect(button).toHaveAttribute('title', 'Connected');

    await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onerror();
    });
    await expect(button).toHaveAttribute('title', 'Reconnecting…');

    await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      for (let i = 0; i < 6; i++) instance.onerror();
    });
    await expect(button).toHaveAttribute('title', 'Offline');
  });
});
