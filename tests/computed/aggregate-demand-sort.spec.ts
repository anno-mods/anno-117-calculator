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

const RESIDENCE_LIBERTI = 3087;
const RESIDENCE_EQUITES = 3142;

test.describe('Aggregate demand sort comparator', () => {

    test('is antisymmetric for two residence consumers', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({ RESIDENCE_LIBERTI, RESIDENCE_EQUITES }) => {
            const view = (window as any).view;
            const allIslands = view.islands().find((i: any) => i.isAllIslands());

            const indices = new Map<number, number>();
            allIslands.residenceBuildings.forEach((r: any, i: number) => indices.set(r.guid, i));
            const indexOf = (guid: number) => indices.get(guid);

            const liberti = { consumer: allIslands.assetsMap.get(RESIDENCE_LIBERTI), amount: () => 1 };
            const equites = { consumer: allIslands.assetsMap.get(RESIDENCE_EQUITES), amount: () => 1 };

            return {
                forward: view.compareAggregateDemands(indexOf, liberti, equites),
                backward: view.compareAggregateDemands(indexOf, equites, liberti),
                libertiIndex: indices.get(RESIDENCE_LIBERTI),
                equitesIndex: indices.get(RESIDENCE_EQUITES),
            };
        }, { RESIDENCE_LIBERTI, RESIDENCE_EQUITES });

        // Guard the premise: the two residences must occupy distinct index slots.
        expect(result.libertiIndex).toBeDefined();
        expect(result.equitesIndex).toBeDefined();
        expect(result.libertiIndex).not.toBe(result.equitesIndex);

        expect(result.forward).not.toBe(0);
        expect(Math.sign(result.forward)).toBe(-Math.sign(result.backward));
    });

    test('orders residences by their residenceBuildings index', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({ RESIDENCE_LIBERTI, RESIDENCE_EQUITES }) => {
            const view = (window as any).view;
            const allIslands = view.islands().find((i: any) => i.isAllIslands());

            const indices = new Map<number, number>();
            allIslands.residenceBuildings.forEach((r: any, i: number) => indices.set(r.guid, i));
            const indexOf = (guid: number) => indices.get(guid);

            const rows = [RESIDENCE_EQUITES, RESIDENCE_LIBERTI].map(guid => ({
                consumer: allIslands.assetsMap.get(guid), amount: () => 1
            }));

            const sorted = rows.slice().sort((a, b) => view.compareAggregateDemands(indexOf, a, b));

            return {
                sortedGuids: sorted.map(r => r.consumer.guid),
                expectedGuids: [RESIDENCE_EQUITES, RESIDENCE_LIBERTI]
                    .slice()
                    .sort((x, y) => (indices.get(x) as number) - (indices.get(y) as number)),
            };
        }, { RESIDENCE_LIBERTI, RESIDENCE_EQUITES });

        expect(result.sortedGuids).toEqual(result.expectedGuids);
    });

    test('residence consumers sort ahead of factory consumers', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({ RESIDENCE_LIBERTI }) => {
            const view = (window as any).view;
            const allIslands = view.islands().find((i: any) => i.isAllIslands());
            const indexOf = () => undefined;

            const residence = { consumer: allIslands.assetsMap.get(RESIDENCE_LIBERTI), amount: () => 1 };
            const factory = { consumer: allIslands.assetsMap.get(3174), amount: () => 1 };

            return {
                residenceFirst: view.compareAggregateDemands(indexOf, residence, factory),
                factoryFirst: view.compareAggregateDemands(indexOf, factory, residence),
            };
        }, { RESIDENCE_LIBERTI });

        expect(result.residenceFirst).toBeLessThan(0);
        expect(result.factoryFirst).toBeGreaterThan(0);
    });
});
