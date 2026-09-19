import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

/**
 * DOM-level checks for the Chariot and Crew (174824) per-building toggle: it must render as a row in
 * the Bakery's "Items Equipped" table (first real exercise of tri-state-toggle / factory-config-section
 * with a non-Item, Effect parent - see plan Risks & Dependencies), must not appear in the global Effects
 * dialog any more, and clicking it must apply/remove the +20% productivity on that factory only.
 */
const LATIUM_SESSION = 3245;
const EQUITES_RESIDENCE = 3142;
const BREAD_PRODUCT = 2137;
const BAKERY = 3174;
const CHARIOT_AND_CREW = 174824;
const CHARIOT_DLC = 67903;
const TOGGLE_SELECTOR = `#fc-${BAKERY}-${CHARIOT_AND_CREW}-equipped`;

async function openBreadConfigDialog(page: any) {
    const configLoader = new ConfigLoader();
    await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Latium', LATIUM_SESSION, {
        [`${EQUITES_RESIDENCE}.buildings.constructed`]: '100',
    }));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());

    await page.evaluate((g) => {
        const island = (window as any).view.island();
        (window as any).view.selectedProduct(island.assetsMap.get(g));
    }, BREAD_PRODUCT);

    await page.waitForSelector('#product-config-dialog .factory-config-section', { state: 'attached', timeout: 10000 });
}

test.describe('Chariot and Crew per-building toggle', () => {
    test('row is absent before DLC unlock, present after - no binding/JS errors either way', async ({ page }) => {
        const errorDetector = new BindingErrorDetector();
        const pageErrors: string[] = [];
        page.on('pageerror', (e) => pageErrors.push(e.message));
        errorDetector.listenForErrors(page);

        await openBreadConfigDialog(page);
        await page.waitForTimeout(300);
        await expect(page.locator(TOGGLE_SELECTOR)).toHaveCount(0);

        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), CHARIOT_DLC);
        await page.waitForSelector(TOGGLE_SELECTOR, { state: 'attached', timeout: 10000 });
        await page.waitForTimeout(300);

        expect(pageErrors, `Uncaught JS errors: ${pageErrors.join(' | ')}`).toEqual([]);
        expect(errorDetector.getErrorCounts().binding, errorDetector.getFormattedBindingErrors().join(' | ')).toBe(0);
        expect(errorDetector.getErrorCounts().knockout, errorDetector.getFormattedKnockoutErrors().join(' | ')).toBe(0);
    });

    test('clicking the toggle applies +20% productivity; a second click removes it', async ({ page }) => {
        await openBreadConfigDialog(page);
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), CHARIOT_DLC);
        await page.waitForSelector(TOGGLE_SELECTOR, { state: 'attached', timeout: 10000 });

        const boost = () => page.evaluate((f) => (window as any).view.island().assetsMap.get(f).boost(), BAKERY);
        const readState = () => page.evaluate(({ effectGuid, factory }) => {
            const island = (window as any).view.island();
            return island.assetsMap.get(effectGuid).slotStates.get(island.assetsMap.get(factory))();
        }, { effectGuid: CHARIOT_AND_CREW, factory: BAKERY });

        const before = await boost();
        expect(await readState()).toBe(0);

        await page.locator(TOGGLE_SELECTOR).first().dispatchEvent('click');
        expect(await readState()).toBe(1); // no boosted variant - toggle only cycles Off <-> Base
        expect(await boost()).toBeGreaterThan(before);

        await page.locator(TOGGLE_SELECTOR).first().dispatchEvent('click');
        expect(await readState()).toBe(0);
        expect(await boost()).toBeCloseTo(before, 6);
    });

    test('the effect no longer appears in the global Effects dialog, DLC state notwithstanding', async ({ page }) => {
        // A companion "island-event"-sourced effect (155840, the milestone notification) shares the
        // exact same localized display name "Chariot and Crew" as the building-sourced one (174824),
        // so a name search alone can't distinguish them - the search legitimately still matches one row
        // (155840, unaffected by this plan). Assert the excluded effect specifically: 174824 is absent
        // from filteredEffects() and the DOM row count tracks the computed list (no stray/duplicate row).
        const configLoader = new ConfigLoader();
        await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Latium', LATIUM_SESSION));
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), CHARIOT_DLC);

        await page.evaluate(() => (window as any).$('#effects-dialog').modal('show'));
        await page.waitForSelector('#effects-dialog.show, #effects-dialog.in');
        await page.fill('#effects-dialog input[type="text"]', 'Chariot and Crew');

        const guids = await page.evaluate(() => (window as any).view.filteredEffects().map((e: any) => e.guid));
        expect(guids).not.toContain(CHARIOT_AND_CREW);
        expect(guids).toContain(155840); // companion island-event effect stays visible, unaffected

        await expect(page.locator('#effects-dialog tbody tr')).toHaveCount(guids.length);
    });
});
