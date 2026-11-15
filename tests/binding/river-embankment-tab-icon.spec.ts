import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * River embankment icon in the supplier tabs of the product config dialog (AE11). The factory flag
 * `isRiverEmbankment` is set on a params entry through a route patch, so the spec does not depend on the
 * extractor delivering it: Roman Vintner 3177 is flagged, Celtic Vintner 23753 is its unflagged twin (both
 * make Wine 2138), Bakery 3174 (Bread 2137) has no flagged factory.
 */
const WINE = 2138;
const BREAD = 2137;
const ROMAN_VINTNER = 3177;
const CELTIC_VINTNER = 23753;
const LATIUM_SESSION = 3245;
const ALBION_SESSION = 6627;
const ICON = '.river-embankment-icon';

async function patchParams(page: Page) {
    await page.route('**/js/params.js', async (route) => {
        const response = await route.fetch();
        const patch = `window.params.factories.find(f => f.guid === ${ROMAN_VINTNER}).isRiverEmbankment = true;`;
        await route.fulfill({ response, body: (await response.text()) + '\n' + patch });
    });
}

async function openProduct(page: Page, product: number) {
    await page.evaluate((g) => {
        const view = (window as any).view;
        view.selectedProduct(view.presenter.productByGuid.get(g));
        (window as any).$('#product-config-dialog').modal('show');
    }, product);
    await page.waitForSelector('#product-config-dialog.show', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);
}

async function loadIslands(page: Page, active: string, aggregate: boolean) {
    const configLoader = new ConfigLoader();
    const settings: Record<string, string> = { 'settings.showAllProducts': '1' };
    if (aggregate)
        settings['settings.aggregateAllIslands'] = '1';
    await configLoader.loadConfigObject(page, configLoader.createFullConfig([
        { name: 'Latium', session: LATIUM_SESSION },
        { name: 'Albion', session: ALBION_SESSION },
    ], settings, active));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.waitForTimeout(300);
}

/** Per supplier tab: the factory guid of its pane and whether its river icon is visible. */
async function tabIcons(page: Page): Promise<{ factory: number; icon: boolean }[]> {
    return page.locator('#product-config-supplier-tabs .nav-link[data-target^="#factories-tab-"]').evaluateAll((tabs) =>
        tabs.map((tab) => {
            const img = tab.querySelector('.river-embankment-icon') as HTMLElement | null;
            const visible = !!img && getComputedStyle(img).display !== 'none';
            return { factory: Number((tab.getAttribute('data-target') as string).replace('#factories-tab-', '')), icon: visible };
        }));
}

test.describe('river embankment tab icon', () => {
    test('AE11: the icon sits in the tab of the flagged factory only, between region icon and name, with the localized title', async ({ page }) => {
        await patchParams(page);
        await loadIslands(page, 'All Islands', false);
        await openProduct(page, WINE);

        const tabs = await tabIcons(page);
        expect(tabs.map(t => t.factory).sort()).toEqual([ROMAN_VINTNER, CELTIC_VINTNER].sort());
        expect(tabs.find(t => t.factory === ROMAN_VINTNER)!.icon).toBe(true);
        expect(tabs.find(t => t.factory === CELTIC_VINTNER)!.icon).toBe(false);
        await expect(page.locator(`${ICON}:visible`)).toHaveCount(1);

        const title = await page.evaluate(() => (window as any).view.texts.riverEmbankment.name());
        await expect(page.locator(`${ICON}:visible`)).toHaveAttribute('title', title);

        const order = await page.locator(`${ICON}:visible`).evaluate((img) => {
            const prev = img.previousElementSibling as HTMLElement;
            const next = img.nextElementSibling as HTMLElement;
            return { prevIsRegionIcon: prev.classList.contains('icon-sm') && prev.tagName === 'SPAN', nextIsName: next.classList.contains('mb-0') };
        });
        expect(order).toEqual({ prevIsRegionIcon: true, nextIsName: true });
    });

    test('the icon is present in the All-Islands tab strip with aggregation on', async ({ page }) => {
        await patchParams(page);
        await loadIslands(page, 'All Islands', true);
        await openProduct(page, WINE);

        const tabs = await tabIcons(page);
        expect(tabs.find(t => t.factory === ROMAN_VINTNER)!.icon).toBe(true);
        expect(tabs.find(t => t.factory === CELTIC_VINTNER)!.icon).toBe(false);
    });

    test('the icon is present on a single island', async ({ page }) => {
        await patchParams(page);
        await loadIslands(page, 'Latium', false);
        await openProduct(page, WINE);
        const tabs = await tabIcons(page);
        expect(tabs).toEqual([{ factory: ROMAN_VINTNER, icon: true }]);
    });

    test('a product without a flagged factory shows no river icon in any tab', async ({ page }) => {
        await patchParams(page);
        await loadIslands(page, 'Latium', false);
        await openProduct(page, BREAD);
        await expect(page.locator(`${ICON}:visible`)).toHaveCount(0);
        await expect(page.locator('#product-config-supplier-tabs img[src$="icon_raw_resource_rivers_2d_0_1.webp"]:visible')).toHaveCount(0);
    });
});
