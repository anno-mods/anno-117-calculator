import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

/**
 * Smoke test: with 100 Equites (residence 3142) driving Bread demand, opening the Bread product
 * config dialog renders the Bakery's factory-config-section - which includes the tri-state item
 * toggles, the Off/Base/Boosted legend, and the activeBuff() buff-row bindings. Asserts the render
 * produces no JavaScript / Knockout binding errors. (Bread is produced by the Bakery 3174, which has
 * boostable items, so the tri-state path is exercised.)
 *
 * Note: resource-load errors (404/403 for some icons in the test server) are intentionally ignored -
 * only uncaught JS exceptions and Knockout binding errors are treated as failures.
 */
const LATIUM_SESSION = 3245;
const EQUITES_RESIDENCE = 3142;
const BREAD_PRODUCT = 2137;

test.describe('Bread config dialog with 100 Equites', () => {
    test('opening the Bread product config dialog produces no JavaScript/binding errors', async ({ page }) => {
        const configLoader = new ConfigLoader();
        const errorDetector = new BindingErrorDetector();
        const pageErrors: string[] = [];
        page.on('pageerror', (e) => pageErrors.push(e.message));

        await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Latium', LATIUM_SESSION, {
            [`${EQUITES_RESIDENCE}.buildings.constructed`]: '100',
        }));

        errorDetector.listenForErrors(page);

        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());

        // 100 Equites create Bread demand, so the producing Bakery is configurable.
        const breadDemand = await page.evaluate(
            (g) => (window as any).view.island().assetsMap.get(g).totalDemand(),
            BREAD_PRODUCT
        );
        expect(breadDemand, 'Equites should create Bread demand').toBeGreaterThan(0);

        // Open the Bread product config dialog -> renders the Bakery's factory-config-section.
        await page.evaluate((g) => {
            const island = (window as any).view.island();
            (window as any).view.selectedProduct(island.assetsMap.get(g));
        }, BREAD_PRODUCT);

        // The section and at least one tri-state item toggle must bind (attached; the items
        // collapsible is collapsed by default, so the elements are hidden but present).
        await page.waitForSelector('#product-config-dialog .factory-config-section', { state: 'attached', timeout: 10000 });
        await page.waitForSelector('#product-config-dialog .tri-state-toggle', { state: 'attached', timeout: 10000 });
        await page.waitForTimeout(500); // let nested bindings settle

        const counts = errorDetector.getErrorCounts();
        const bindingErrors = errorDetector.getFormattedBindingErrors();
        const knockoutErrors = errorDetector.getFormattedKnockoutErrors();

        expect(pageErrors, `Uncaught JS errors: ${pageErrors.join(' | ')}`).toEqual([]);
        expect(counts.binding, `Binding errors: ${bindingErrors.join(' | ')}`).toBe(0);
        expect(counts.knockout, `Knockout errors: ${knockoutErrors.join(' | ')}`).toBe(0);
    });
});
