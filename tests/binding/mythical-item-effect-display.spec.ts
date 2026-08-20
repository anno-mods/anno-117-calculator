import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

// DOM-level checks for the mythical-item / monument effect display in the effects dialog.
test.describe('Mythical item effect rendering', () => {
    const LATIUM_SESSION = 3245;
    const LIBERTI_POPULATION_LEVEL_GUID = 1499;

    test.beforeEach(async ({ page }) => {
        const configLoader = new ConfigLoader();
        const config = configLoader.createFullConfig([
            { name: 'Latium', session: LATIUM_SESSION, data: { '3087.buildings.constructed': '100' } },
        ]);
        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.evaluate(() => (window as any).$('#effects-dialog').modal('show'));
        await page.waitForSelector('#effects-dialog.show, #effects-dialog.in');
    });

    test('every available effect row renders (foreach not halted by residence targets)', async ({ page }) => {
        const detector = new BindingErrorDetector();
        detector.listenForErrors(page);

        // A binding throw inside a row (e.g. a residence target lacking getRegionExtendedName) would
        // truncate the foreach, so the DOM row count must equal the computed filteredEffects length.
        const expected = await page.evaluate(() => (window as any).view.filteredEffects().length);
        expect(expected).toBeGreaterThan(1);
        await expect(page.locator('#effects-dialog tbody tr')).toHaveCount(expected);

        expect(detector.hasBindingError()).toBe(false);
    });

    test('reduced-consumption rows show the percentage and the affected product icon', async ({ page }) => {
        // "Bread Sentries" carries a single goodConsumptionUpgrade (Bread, +20%).
        await page.fill('#effects-dialog input[type="text"]', 'Bread Sentries');
        await expect(page.locator('#effects-dialog tbody tr')).toHaveCount(1);

        const buffCell = page.locator('#effects-dialog tbody tr').first().locator('td:nth-child(5)');
        await expect(buffCell).toContainText('%');
        // A product icon (data-URI image) accompanies the percentage - not the generic marketplace icon.
        expect(await buffCell.locator('img').count()).toBeGreaterThan(0);
        await expect(buffCell.locator('img[src*="icon_marketplace_2d_light"]')).toHaveCount(0);
    });

    test('additional-need rows show the extra-demand icon plus the added product icon', async ({ page }) => {
        const rows = page.locator('#effects-dialog tbody tr', {
            has: page.locator('img[src*="icon_2d_extra_demand"]'),
        });
        expect(await rows.count()).toBeGreaterThan(0);

        const row = rows.first();
        await expect(row.locator('td:nth-child(5) img[src*="icon_2d_extra_demand"]')).toHaveCount(1);
        // Extra-demand marker + at least one resolved product icon.
        expect(await row.locator('td:nth-child(5) img').count()).toBeGreaterThanOrEqual(2);
    });

    test('residence targets render the population-level icon (not the shared residence icon)', async ({ page }) => {
        // Every residence shares one building icon, so the target column shows the population icon.
        // Colosseum effects target the Liberti residence; at least one target <img> must carry the
        // Liberti population icon (and differ from that residence's own building icon).
        const result = await page.evaluate((popLevelGuid) => {
            const island = (window as any).view.island();
            const popIcon = island.assetsMap.get(popLevelGuid).icon;
            const residenceIcon = island.assetsMap.get(3087).icon; // Liberti residence building icon
            const srcs = Array.from(document.querySelectorAll('#effects-dialog tbody tr td:nth-child(4) img'))
                .map((img) => (img as HTMLImageElement).getAttribute('src'));
            return {
                popIcon,
                iconsDiffer: popIcon !== residenceIcon,
                matches: srcs.filter((s) => s === popIcon).length,
            };
        }, LIBERTI_POPULATION_LEVEL_GUID);

        expect(result.popIcon).toBeTruthy();
        expect(result.iconsDiffer).toBe(true);
        expect(result.matches).toBeGreaterThan(0);
    });
});
