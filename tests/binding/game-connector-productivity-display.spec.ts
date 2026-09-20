import { test, expect } from '@playwright/test';
import { installMockEventSource } from '../helpers';
import { ConfigLoader } from '../helpers/config-loader';

// Exercises R5's bracketed productivity display (templates/factory-config-section.html) through
// the product-config-dialog's Factories tab.

const LATIUM_SESSION = 3245;
const TIMBER_FACTORY_GUID = 3089;
const TIMBER_PRODUCT_GUID = 2174; // Factory 3089's actual output product guid

declare const window: any;

async function openProductDialog(page: any, productGuid: number) {
  await page.evaluate((guid: number) => {
    const view = window.view;
    const product = view.island().assetsMap.get(guid);
    view.selectedProduct(product);
    ($('#product-config-dialog') as any).modal('show');
  }, productGuid);
  await page.waitForSelector('#product-config-dialog.show');
}

test.describe('game-connector productivity bracket display (U4/R5)', () => {
  let configLoader: ConfigLoader;

  test.beforeEach(async ({ page }) => {
    configLoader = new ConfigLoader();
    await installMockEventSource(page);
    await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Latium', LATIUM_SESSION));
    await page.goto('/');
    await page.waitForFunction(() => window.view && window.view.island());
  });

  test('no bracket is rendered before any sync has happened', async ({ page }) => {
    await openProductDialog(page, TIMBER_PRODUCT_GUID);
    await expect(page.locator('#product-config-dialog')).not.toContainText('(');
  });

  test('the synced productivity renders bracketed next to the computed productivity', async ({ page }) => {
    await page.evaluate((guid: number) => {
      const view = window.view;
      const connector = view.gameConnector;
      connector.connect();
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onopen();

      const payload = JSON.stringify([{
        sessionGuid: 3245,
        islandId: 1,
        areaIndex: 0,
        areaName: 'Latium',
        entries: [{ productGuid: 2077, buildingsByGuid: { [guid]: 3 }, averageProductivity: 82 }]
      }]);
      instances[instances.length - 1].onmessage({ data: payload });
    }, TIMBER_FACTORY_GUID);

    await openProductDialog(page, TIMBER_PRODUCT_GUID);
    await expect(page.locator('#product-config-dialog')).toContainText('(82%)');
  });
});
