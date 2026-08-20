import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

const ROMAN_SESSION = 3245;
const ALL_ISLANDS_NAME = 'All Islands';

async function loadAggregateConfig(page: Page, islands: { name: string; session: number }[], activeIsland: string) {
    const cl = new ConfigLoader();
    const config = cl.createFullConfig(islands, { 'settings.aggregateAllIslands': '1' }, activeIsland);
    await cl.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.waitForTimeout(300);
}

const PRODUCT_BREAD = 2137;
const FACTORY_BAKERY = 3174;

test.describe('AggregateBuildingsCalc', () => {

    test('sums constructed across real islands and reports readOnly', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({ PRODUCT_BREAD, FACTORY_BAKERY }) => {
            const view = (window as any).view;
            const counts: Record<string, number> = { IslandA: 4, IslandB: 7 };
            for (const island of view.islands()) {
                if (island.isAllIslands()) continue;
                const bakery = island.assetsMap.get(FACTORY_BAKERY);
                if (bakery) bakery.buildings.constructed(counts[island.name()]);
            }

            const presenter = view.presenter.productByGuid.get(PRODUCT_BREAD);
            const bakeryPresenter = presenter.factoryPresenters.find((f: any) => f.factory.guid === FACTORY_BAKERY);
            const buildings = bakeryPresenter.buildings();

            return { constructed: buildings.constructed(), readOnly: buildings.readOnly };
        }, { PRODUCT_BREAD, FACTORY_BAKERY });

        expect(result.constructed).toBe(11);
        expect(result.readOnly).toBe(true);
    });

    test('writes to an aggregate BuildingsCalc are no-ops and never corrupt real islands', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({ PRODUCT_BREAD, FACTORY_BAKERY }) => {
            const view = (window as any).view;
            for (const island of view.islands()) {
                if (island.isAllIslands()) continue;
                const bakery = island.assetsMap.get(FACTORY_BAKERY);
                if (bakery) bakery.buildings.constructed(5);
            }

            const presenter = view.presenter.productByGuid.get(PRODUCT_BREAD);
            const bakeryPresenter = presenter.factoryPresenters.find((f: any) => f.factory.guid === FACTORY_BAKERY);

            bakeryPresenter.buildings().constructed(999);
            bakeryPresenter.incConstructedBuildings();

            const perIsland = view.islands()
                .filter((i: any) => !i.isAllIslands())
                .map((i: any) => i.assetsMap.get(FACTORY_BAKERY).buildings.constructed());

            return { aggregate: bakeryPresenter.buildings().constructed(), perIsland };
        }, { PRODUCT_BREAD, FACTORY_BAKERY });

        expect(result.aggregate).toBe(10);
        expect(result.perIsland).toEqual([5, 5]);
    });

    test('utilized honours each island own fullyUtilizeConstructed', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({ PRODUCT_BREAD, FACTORY_BAKERY }) => {
            const view = (window as any).view;
            const islands = view.islands().filter((i: any) => !i.isAllIslands());

            // IslandA: 10 built, fully-utilize ON  -> utilized() == max(10, required)
            // IslandB: 10 built, fully-utilize OFF -> utilized() == required (likely 0)
            islands[0].assetsMap.get(FACTORY_BAKERY).buildings.constructed(10);
            islands[0].assetsMap.get(FACTORY_BAKERY).buildings.fullyUtilizeConstructed(true);
            islands[1].assetsMap.get(FACTORY_BAKERY).buildings.constructed(10);
            islands[1].assetsMap.get(FACTORY_BAKERY).buildings.fullyUtilizeConstructed(false);

            const presenter = view.presenter.productByGuid.get(PRODUCT_BREAD);
            const bakeryPresenter = presenter.factoryPresenters.find((f: any) => f.factory.guid === FACTORY_BAKERY);

            return {
                aggregateUtilized: bakeryPresenter.buildings().utilized(),
                perIslandUtilized: islands.map((i: any) => i.assetsMap.get(FACTORY_BAKERY).buildings.utilized()),
            };
        }, { PRODUCT_BREAD, FACTORY_BAKERY });

        const expected = result.perIslandUtilized.reduce((a: number, b: number) => a + b, 0);
        expect(result.aggregateUtilized).toBeCloseTo(expected, 6);
        // Guard the premise: the two islands must actually differ, or the test proves nothing.
        expect(result.perIslandUtilized[0]).not.toBeCloseTo(result.perIslandUtilized[1], 6);
    });

    test('a real island BuildingsCalc is still writable and reports readOnly false', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
        ], 'IslandA');

        const result = await page.evaluate(({ PRODUCT_BREAD, FACTORY_BAKERY }) => {
            const view = (window as any).view;
            const presenter = view.presenter.productByGuid.get(PRODUCT_BREAD);
            const bakeryPresenter = presenter.factoryPresenters.find((f: any) => f.factory.guid === FACTORY_BAKERY);

            const buildings = bakeryPresenter.buildings();
            buildings.constructed(6);
            bakeryPresenter.incConstructedBuildings();

            return {
                readOnly: buildings.readOnly,
                constructed: view.island().assetsMap.get(FACTORY_BAKERY).buildings.constructed(),
            };
        }, { PRODUCT_BREAD, FACTORY_BAKERY });

        expect(result.readOnly).toBe(false);
        expect(result.constructed).toBe(7);
    });
});
