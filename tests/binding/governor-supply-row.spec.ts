import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * Governor supply row on the Trading table of the product config dialog (plan 2026-11-12-001 U4): shown while the
 * island's governor supply of the product is positive, editable on a real island, absent while aggregating.
 */

const LATIUM = 3245;
const BREAD = 2137;
const ROW = '#product-config-dialog .governor-supply-row';
const INPUT = `#governor-supply-input-${BREAD}`;

async function load(page: Page, islands: { name: string; session: number }[], active: string, settings: Record<string, string> = {}) {
    const cl = new ConfigLoader();
    await cl.loadConfigObject(page, cl.createFullConfig(islands, { 'settings.showAllProducts': '1', ...settings }, active));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.waitForTimeout(300);
}

async function openDialog(page: Page) {
    await page.evaluate((guid) => {
        const view = (window as any).view;
        view.selectedProduct(view.presenter.productByGuid.get(guid));
        ($('#product-config-dialog') as any).modal('show');
    }, BREAD);
    await page.waitForSelector('#product-config-dialog.show', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);
}

const setSupply = (page: Page, v: number) =>
    page.evaluate((value) => {
        (window as any).view.island().assetsMap.get(2137).governorSupply(value);
    }, v);

const supply = (page: Page) => page.evaluate(() => (window as any).view.island().assetsMap.get(2137).governorSupply());

test.describe('governor supply row (U4)', () => {
    test('hidden at 0, shown with the value after a supply is set, hidden again at 0', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await load(page, [{ name: 'Roma', session: LATIUM }], 'Roma');
        await openDialog(page);
        await expect(page.locator(ROW)).toHaveCount(0);

        await setSupply(page, 4);
        await expect(page.locator(ROW)).toHaveCount(1);
        expect(await page.locator(INPUT).inputValue()).toBe('4');

        await setSupply(page, 0);
        await expect(page.locator(ROW)).toHaveCount(0);
        expect(errors).toEqual([]);
    });

    test('editing the input updates the governor supply', async ({ page }) => {
        await load(page, [{ name: 'Roma', session: LATIUM }], 'Roma');
        await openDialog(page);
        await setSupply(page, 4);
        await expect(page.locator(ROW)).toHaveCount(1);
        await page.locator(INPUT).evaluate((el: HTMLInputElement) => {
            el.value = '6';
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(await supply(page)).toBe(6);
    });

    test('no row and no binding error while aggregating all islands', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => {
            if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text());
        });
        await load(page, [{ name: 'Roma', session: LATIUM }, { name: 'Ostia', session: LATIUM }], 'All Islands', { 'settings.aggregateAllIslands': '1' });
        await page.evaluate(() => {
            const view = (window as any).view;
            view.islands().find((i: any) => i.name() === 'Roma').assetsMap.get(2137).governorSupply(4);
        });
        await openDialog(page);
        await expect(page.locator(ROW)).toHaveCount(0);
        expect(errors).toEqual([]);
    });
});
