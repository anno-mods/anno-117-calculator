import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * `isRiverEmbankment` of a factory entry in params.js: true only for an entry that sets it to true,
 * read through Factory.isRiverEmbankment and FactoryPresenter.isRiverEmbankment. The extractor may not
 * deliver the attribute yet, so the spec patches params.js through a route.
 */
const WINE = 2138;
const ROMAN_VINTNER = 3177;   // flagged by the patch
const SAWMILL = 3089;  // Roman sawmill, explicit false
const BAKERY = 3174;          // attribute absent

test('isRiverEmbankment is true for a flagged entry, false for an explicit false and for an absent attribute', async ({ page }) => {
    await page.route('**/js/params.js', async (route) => {
        const response = await route.fetch();
        const patch = `;
            (function () {
                const byGuid = (g) => window.params.factories.find(f => f.guid === g);
                byGuid(${ROMAN_VINTNER}).isRiverEmbankment = true;
                byGuid(${SAWMILL}).isRiverEmbankment = false;
                delete byGuid(${BAKERY}).isRiverEmbankment;
            })();`;
        await route.fulfill({ response, body: (await response.text()) + '\n' + patch });
    });
    const configLoader = new ConfigLoader();
    await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Latium', 3245, {}));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());

    const r = await page.evaluate(({ wine, roman, sawmill, bakery }) => {
        const view = (window as any).view;
        const island = view.island();
        const presenters = Array.from(view.presenter.productByGuid.values()).flatMap((p: any) => p.factoryPresenters);
        return {
            romanModel: island.assetsMap.get(roman).isRiverEmbankment,
            sawmillModel: island.assetsMap.get(sawmill).isRiverEmbankment,
            bakeryModel: island.assetsMap.get(bakery).isRiverEmbankment,
            romanPresenter: presenters.find((p: any) => p.factory.guid === roman).isRiverEmbankment,
            sawmillPresenter: presenters.find((p: any) => p.factory.guid === sawmill).isRiverEmbankment,
        };
    }, { wine: WINE, roman: ROMAN_VINTNER, sawmill: SAWMILL, bakery: BAKERY });

    expect(r).toEqual({
        romanModel: true, sawmillModel: false, bakeryModel: false,
        romanPresenter: true, sawmillPresenter: false,
    });
});
