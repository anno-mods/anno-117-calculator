import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * Test case: When DLC03 is disabled, in all islands the product dialog for olive oil must not show the egyptian olive oil press.
 * 
 * Olive Oil (2149) has two producers:
 * 1. Olive Press (4831) - Roman (Base game, available without DLC)
 * 2. Egyptian Olive Press (152729) - Egyptian (Dawn of the Delta DLC03, guid 67904)
 */
const OLIVE_OIL_PRODUCT = 2149;
const ROMAN_PRESS_FACTORY = 4831;
const EGYPTIAN_PRESS_FACTORY = 152729;
const DLC03_DAWN_OF_DELTA = 67904;

const ROMAN_SESSION = 3245; // Latium
const EGYPTIAN_SESSION = 149679; // Aegyptus

const ALL_ISLANDS_NAME = 'All Islands';

async function loadConfig(page: Page, opts: {
    dlc03Active: boolean;
    aggregation: boolean;
    activeIsland?: string;
}) {
    const cl = new ConfigLoader();
    
    const settings: Record<string, string> = {
        'settings.showAllProducts': '1'
    };
    if (opts.aggregation) {
        settings['settings.aggregateAllIslands'] = '1';
    } else {
        settings['settings.aggregateAllIslands'] = '0';
    }

    const islands = [
        { name: 'Latium', session: ROMAN_SESSION },
        { name: 'Aegyptus', session: EGYPTIAN_SESSION }
    ];

    const config = cl.createFullConfig(islands, settings, opts.activeIsland ?? ALL_ISLANDS_NAME);
    await cl.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.waitForTimeout(300);

    // Set DLC03 checked status
    await page.evaluate(({ dlcGuid, active }) => {
        const dlc = (window as any).view.dlcs.find((d: any) => d.guid === dlcGuid);
        if (dlc) {
            dlc.checked(active);
        }
    }, { dlcGuid: DLC03_DAWN_OF_DELTA, active: opts.dlc03Active });
    await page.waitForTimeout(100);
}

async function openProductDialog(page: Page, productGuid: number) {
    await page.evaluate((guid) => {
        const view = (window as any).view;
        const presenter = view.presenter.productByGuid.get(guid);
        view.selectedProduct(presenter);
        ($('#product-config-dialog') as any).modal('show');
    }, productGuid);
    await page.waitForSelector('#product-config-dialog.show', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);
}

async function closeProductDialog(page: Page) {
    await page.evaluate(() => ($('#product-config-dialog') as any).modal('hide'));
    await page.waitForTimeout(300);
}

test.describe('Olive Oil DLC03 Gating Tests', () => {

    test('When DLC03 is disabled, All Islands product dialog for olive oil does not show Egyptian Olive Press but shows Roman Olive Press', async ({ page }) => {
        // Load config with DLC03 disabled and aggregation on, viewing All Islands
        await loadConfig(page, { dlc03Active: false, aggregation: true, activeIsland: ALL_ISLANDS_NAME });

        // Open Olive Oil product dialog
        await openProductDialog(page, OLIVE_OIL_PRODUCT);

        // Verify Roman Olive Press tab is shown
        const romanTab = page.locator(`#product-config-dialog button[data-target="#factories-tab-${ROMAN_PRESS_FACTORY}"]`);
        await expect(romanTab).toBeVisible();

        // Verify Egyptian Olive Press tab is NOT shown
        const egyptianTab = page.locator(`#product-config-dialog button[data-target="#factories-tab-${EGYPTIAN_PRESS_FACTORY}"]`);
        await expect(egyptianTab).toHaveCount(0);

        await closeProductDialog(page);
    });

    test('When DLC03 is disabled, Nile/Aegyptus island product dialog for olive oil does not show Egyptian Olive Press', async ({ page }) => {
        // Load config with DLC03 disabled and aggregation off, viewing Aegyptus
        await loadConfig(page, { dlc03Active: false, aggregation: false, activeIsland: 'Aegyptus' });

        // Open Olive Oil product dialog
        await openProductDialog(page, OLIVE_OIL_PRODUCT);

        // Verify Egyptian Olive Press tab is NOT shown
        const egyptianTab = page.locator(`#product-config-dialog button[data-target="#factories-tab-${EGYPTIAN_PRESS_FACTORY}"]`);
        await expect(egyptianTab).toHaveCount(0);

        await closeProductDialog(page);
    });

    test('When DLC03 is disabled, Latium island product dialog for olive oil does not show Egyptian Olive Press but shows Roman Olive Press', async ({ page }) => {
        // Load config with DLC03 disabled and aggregation off, viewing Latium
        await loadConfig(page, { dlc03Active: false, aggregation: false, activeIsland: 'Latium' });

        // Open Olive Oil product dialog
        await openProductDialog(page, OLIVE_OIL_PRODUCT);

        // Verify Roman Olive Press tab is shown
        const romanTab = page.locator(`#product-config-dialog button[data-target="#factories-tab-${ROMAN_PRESS_FACTORY}"]`);
        await expect(romanTab).toBeVisible();

        // Verify Egyptian Olive Press tab is NOT shown
        const egyptianTab = page.locator(`#product-config-dialog button[data-target="#factories-tab-${EGYPTIAN_PRESS_FACTORY}"]`);
        await expect(egyptianTab).toHaveCount(0);

        await closeProductDialog(page);
    });

    test('When DLC03 is enabled, All Islands product dialog for olive oil shows both Roman and Egyptian Olive Presses', async ({ page }) => {
        // Load config with DLC03 enabled and aggregation on, viewing All Islands
        await loadConfig(page, { dlc03Active: true, aggregation: true, activeIsland: ALL_ISLANDS_NAME });

        // Open Olive Oil product dialog
        await openProductDialog(page, OLIVE_OIL_PRODUCT);

        // Verify Roman Olive Press tab is shown
        const romanTab = page.locator(`#product-config-dialog button[data-target="#factories-tab-${ROMAN_PRESS_FACTORY}"]`);
        await expect(romanTab).toBeVisible();

        // Verify Egyptian Olive Press tab is shown
        const egyptianTab = page.locator(`#product-config-dialog button[data-target="#factories-tab-${EGYPTIAN_PRESS_FACTORY}"]`);
        await expect(egyptianTab).toBeVisible();

        await closeProductDialog(page);
    });

    test('When DLC03 is enabled, Nile/Aegyptus island product dialog for olive oil shows Egyptian Olive Press', async ({ page }) => {
        // Load config with DLC03 enabled and aggregation off, viewing Aegyptus
        await loadConfig(page, { dlc03Active: true, aggregation: false, activeIsland: 'Aegyptus' });

        // Open Olive Oil product dialog
        await openProductDialog(page, OLIVE_OIL_PRODUCT);

        // Verify Egyptian Olive Press tab is shown
        const egyptianTab = page.locator(`#product-config-dialog button[data-target="#factories-tab-${EGYPTIAN_PRESS_FACTORY}"]`);
        await expect(egyptianTab).toBeVisible();

        await closeProductDialog(page);
    });
});
