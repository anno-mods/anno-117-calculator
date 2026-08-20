import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

test.describe('Patron consumption modifier (Isis-Bubastis Feline Grace)', () => {
    const LATIUM_SESSION = 3245;
    const LIBERTI_RESIDENCE_GUID = 3087;
    const ISIS_BUBASTIS_PATRON_GUID = 153578;
    const SARDINES_NEED_GUID = 2665;

    test('Isis-Bubastis patron at devotion 250 decreases Liberti consumption by 1%', async ({ page }) => {
        const configLoader = new ConfigLoader();

        // Create Latium island with 1000 Liberti buildings constructed, devotion 250, and Isis-Bubastis patron selected
        // We also pass calculatorSettings to activate the Dawn of Delta DLC
        const config = configLoader.createIslandConfig('Latium', LATIUM_SESSION, {
            [`${LIBERTI_RESIDENCE_GUID}.buildings.constructed`]: '1000',
            devotion: '250',
            selectedPatron: String(ISIS_BUBASTIS_PATRON_GUID),
        }, {
            "DLC03_Dawn_of_Delta": "1"
        });

        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());

        await page.waitForTimeout(300);

        // Get consumption under the patron effect (devotion 250)
        const consumptionWithPatron = await page.evaluate(({ residenceGuid, needGuid }) => {
            const island = (window as any).view.island();
            const residence = island.assetsMap.get(residenceGuid);
            const need = residence.needsMap.get(needGuid);
            return need.amount();
        }, { residenceGuid: LIBERTI_RESIDENCE_GUID, needGuid: SARDINES_NEED_GUID });

        expect(consumptionWithPatron).toBeGreaterThan(0);

        // Get baseline consumption without the patron effect by setting devotion to 0
        await page.evaluate(() => {
            (window as any).view.island().devotion(0);
        });

        await page.waitForTimeout(100);

        const baselineConsumption = await page.evaluate(({ residenceGuid, needGuid }) => {
            const island = (window as any).view.island();
            const residence = island.assetsMap.get(residenceGuid);
            const need = residence.needsMap.get(needGuid);
            return need.amount();
        }, { residenceGuid: LIBERTI_RESIDENCE_GUID, needGuid: SARDINES_NEED_GUID });

        // Consumption must decrease by exactly 1% (i.e. to 99% of baseline)
        expect(consumptionWithPatron).toBeCloseTo(baselineConsumption * 0.99, 5);
    });
});
