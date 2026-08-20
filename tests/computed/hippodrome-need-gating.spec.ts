import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

// The Hippodrome monument's "Privilege of the Public Horse" reward (effect 156267, buff 156266) adds a
// conditional Horses need (174983 -> product 2075) to the Equites tier (residence 3142). The effect is
// gated behind DLC2 (67903), so the hippodrome must be "unlocked" (DLC active) before it can be enabled.
test.describe('Hippodrome horse-need gating (Equites)', () => {
    const LATIUM_SESSION = 3245;
    const EQUITES_RESIDENCE_GUID = 3142;
    const EQUITES_POPULATION_LEVEL_GUID = 1497;
    const HORSE_NEED_GUID = 174983;            // Need Roman Household Horses
    const HORSE_PRODUCT_GUID = 2075;           // Good Horses
    const PUBLIC_HORSE_EFFECT_GUID = 156267;   // "Privilege of the Public Horse" (Hippodrome tier 06)
    const DLC2_GUID = 67903;                    // gates the hippodrome effect

    test.beforeEach(async ({ page }) => {
        const configLoader = new ConfigLoader();
        const config = configLoader.createFullConfig([
            { name: 'Latium', session: LATIUM_SESSION, data: { '3142.buildings.constructed': '100' } },
        ]);
        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());

        // Unlock the hippodrome: the effect's available() is gated behind DLC2 (67903).
        await page.evaluate((dlcGuid) => {
            (window as any).view.dlcsGuidMap.get(dlcGuid).checked(true);
        }, DLC2_GUID);
    });

    test('enabling the effect creates horse demand; unchecking it removes the demand', async ({ page }) => {
        // Enable "Privilege of the Public Horse".
        await page.evaluate((effectGuid) => {
            (window as any).view.island().assetsMap.get(effectGuid).scaling(1);
        }, PUBLIC_HORSE_EFFECT_GUID);

        const on = await page.evaluate((productGuid) => {
            return (window as any).view.island().assetsMap.get(productGuid).totalDemand();
        }, HORSE_PRODUCT_GUID);
        // 100 Equites * 0.00515 t/min = 0.515 t/min.
        expect(on).toBeGreaterThanOrEqual(0.5);

        // Uncheck the effect -> the gated need is no longer consumed.
        await page.evaluate((effectGuid) => {
            (window as any).view.island().assetsMap.get(effectGuid).scaling(0);
        }, PUBLIC_HORSE_EFFECT_GUID);

        const off = await page.evaluate((productGuid) => {
            return (window as any).view.island().assetsMap.get(productGuid).totalDemand();
        }, HORSE_PRODUCT_GUID);
        expect(off).toBe(0);
    });

    test('the product tile production converges when the effect is toggled off (no stale demand/production)', async ({ page }) => {
        // Regression guard for a UI bug: after unchecking the effect the model demand dropped to 0, but
        // the product tile still showed ~0.5 t/min because ProductPresenter.totalProduction reads
        // Product.excessProduction, which used to be written inside demandCalculationSubscription from a
        // stale totalCurrentProduction and never reconverged. Assert the presenter (tile) values track
        // the model in BOTH directions.
        const snapshot = () => page.evaluate((productGuid) => {
            const num = (v: any) => (typeof v === 'function' ? v() : v);
            const island = (window as any).view.island();
            const p = island.assetsMap.get(productGuid);
            const presenter = (window as any).view.presenter.productByGuid.get(productGuid);
            return {
                modelTotalDemand: num(p.totalDemand),
                modelTotalCurrentProduction: num(p.totalCurrentProduction),
                presenterTotalProduction: num(presenter.totalProduction),
                presenterTotalDemand: num(presenter.totalDemand),
                presenterNetBalance: num(presenter.netBalance),
            };
        }, HORSE_PRODUCT_GUID);

        // Effect ON: the tile shows the imported production covering demand.
        await page.evaluate((effectGuid) => {
            (window as any).view.island().assetsMap.get(effectGuid).scaling(1);
        }, PUBLIC_HORSE_EFFECT_GUID);

        const on = await snapshot();
        expect(on.modelTotalDemand).toBeGreaterThanOrEqual(0.5);
        expect(on.presenterTotalProduction).toBeGreaterThanOrEqual(0.5);
        expect(on.presenterTotalProduction).toBeCloseTo(on.modelTotalDemand, 3);
        expect(on.presenterNetBalance).toBeCloseTo(0, 3);

        // Effect OFF: demand AND the tile's production must both fall back to 0.
        await page.evaluate((effectGuid) => {
            (window as any).view.island().assetsMap.get(effectGuid).scaling(0);
        }, PUBLIC_HORSE_EFFECT_GUID);

        const off = await snapshot();
        expect(off.modelTotalDemand).toBe(0);
        expect(off.modelTotalCurrentProduction).toBe(0);
        expect(off.presenterTotalProduction).toBe(0); // was stuck at ~0.515 before the fix
        expect(off.presenterTotalDemand).toBe(0);
        expect(off.presenterNetBalance).toBe(0);
    });

    test('ungating a need respects the activateAllNeeds setting and never overrides checked', async ({ page }) => {
        // "Activate all needs = OFF": every need becomes unchecked, matching an island created with the
        // setting off (Island.activateAllNeeds is the bulk apply behind the IslandManager option). The
        // horse need is unchecked even while still gated.
        await page.evaluate(() => {
            const view = (window as any).view;
            view.islandManager.activateAllNeeds.checked(false);
            view.island().activateAllNeeds(false);
        });

        // Ungate the horse need by enabling the effect. checked is purely user-controlled - (un)gating
        // must NOT touch it - so the need stays unchecked and produces no demand until the user opts in.
        await page.evaluate((effectGuid) => {
            (window as any).view.island().assetsMap.get(effectGuid).scaling(1);
        }, PUBLIC_HORSE_EFFECT_GUID);

        const afterUngate = await page.evaluate(({ popGuid, needGuid, productGuid }) => {
            const island = (window as any).view.island();
            const need = island.assetsMap.get(popGuid).getNeed(needGuid);
            return { checked: need.checked(), demand: island.assetsMap.get(productGuid).totalDemand() };
        }, { popGuid: EQUITES_POPULATION_LEVEL_GUID, needGuid: HORSE_NEED_GUID, productGuid: HORSE_PRODUCT_GUID });

        expect(afterUngate.checked).toBe(false); // ungating did not re-activate the need
        expect(afterUngate.demand).toBe(0);

        // The user opts in - now (and only now) the ungated need is consumed.
        await page.evaluate(({ popGuid, needGuid }) => {
            (window as any).view.island().assetsMap.get(popGuid).getNeed(needGuid).checked(true);
        }, { popGuid: EQUITES_POPULATION_LEVEL_GUID, needGuid: HORSE_NEED_GUID });

        const afterOptIn = await page.evaluate((productGuid) => {
            return (window as any).view.island().assetsMap.get(productGuid).totalDemand();
        }, HORSE_PRODUCT_GUID);
        expect(afterOptIn).toBeGreaterThanOrEqual(0.5);
    });
});
