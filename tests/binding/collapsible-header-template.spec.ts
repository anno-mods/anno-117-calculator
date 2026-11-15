import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

/**
 * The optional `headerTemplate` param of the collapsible component: the template renders in the legend,
 * clicking it toggles the section, and collapsibles without the param keep their t/min summary.
 */
const IRON = 2115;
const BREAD = 2137;
const FURNACE = 3070;
const PATRON_EFFECT = 80565;

async function openIron(page: Page, product = IRON, islandData: Record<string, string> = {}) {
    const configLoader = new ConfigLoader();
    await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Latium', 3245, islandData));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.evaluate(({ g, e }) => {
        const view = (window as any).view;
        view.island().assetsMap.get(e).scaling(1);
        view.selectedProduct(view.presenter.productByGuid.get(g));
        (window as any).$('#product-config-dialog').modal('show');
    }, { g: product, e: PATRON_EFFECT });
    await page.waitForSelector('#product-config-dialog.show', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);
}

test.describe('collapsible headerTemplate', () => {
    test('renders in the legend; clicking it toggles the section and stores the state', async ({ page }) => {
        const errors = new BindingErrorDetector();
        errors.listenForErrors(page);
        await openIron(page);

        const legend = page.locator(`#factories-tab-${FURNACE} legend[data-target="#factory-config-boost-sources"]`);
        const body = page.locator(`#factories-tab-${FURNACE} #factory-config-boost-sources`);
        await expect(legend.locator('.boost-head .boost-head-pair').first()).toBeVisible();

        await expect(body).not.toHaveClass(/show/);
        await legend.locator('.boost-head-pair').first().click(); // click inside the header template
        await expect(body).toHaveClass(/show/);
        await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('collapsibleStates') || '{}')['factory-config-boost-sources'])).toBe(0);
        expect(errors.getErrorCounts().binding, errors.getFormattedBindingErrors().join(' | ')).toBe(0);
    });

    test('collapsibles without headerTemplate keep the t/min summary and render no header content', async ({ page }) => {
        const errors = new BindingErrorDetector();
        errors.listenForErrors(page);
        await openIron(page, BREAD, { '3142.buildings.constructed': '100' });

        const consumption = page.locator('legend[data-target="#product-config-consumption"]');
        await expect(consumption.locator('.summary')).toContainText('t/min');
        await expect(consumption.locator('.collapser-header')).toHaveCount(0);
        expect(errors.getErrorCounts().binding, errors.getFormattedBindingErrors().join(' | ')).toBe(0);
    });
});
