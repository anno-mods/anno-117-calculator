import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

// Public-building coverage (plan 2026-11-12-002 U10): the share of a level's residences in range of a public building
// scales the residents and the amount of the public needs the building provides.
//   3087   Roman 01 residence (level 1499), needs 2750 (Public Market, provided by building 3527) and 2751
//   3141   Roman 02 residence (level 1496), also has need 2750
//   2689   Bread need of the Plebeians residence 3141: a goods need, not a public service
const LATIUM = 3245;
const PEASANTS_RESIDENCE = 3087;
const PEASANTS_LEVEL = 1499;
const PLEBEIANS_RESIDENCE = 3141;
const PLEBEIANS_LEVEL = 1496;
const MARKET_NEED = 2750;
const MARKET = 3527;
const BREAD_NEED = 2689;

async function loadIsland(page: Page, data: Record<string, any> = {}, patch?: string) {
    if (patch) {
        await page.route('**/js/params.js', async (route) => {
            const response = await route.fetch();
            await route.fulfill({ response, body: (await response.text()) + '\n;' + patch });
        });
    }
    const cl = new ConfigLoader();
    await cl.loadConfigObject(page, cl.createIslandConfig('Latium', LATIUM, data));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
}

const residents = (page: Page, residence: number, need: number, constructed = 10) => page.evaluate(({ r, n, c }) => {
    const res = (window as any).view.island().assetsMap.get(r);
    res.buildings.constructed(c);
    return res.needsMap.get(n).residents();
}, { r: residence, n: need, c: constructed });

const setCoverage = (page: Page, level: number, building: number, value: number) =>
    page.evaluate(({ level, building, value }) => { (window as any).view.island().publicCoverage(level, building)(value); }, { level, building, value });

test.describe('public-building coverage (U10)', () => {
    test('AE10: a listed building scales its need on its level only', async ({ page }) => {
        await loadIsland(page);
        const full = await residents(page, PEASANTS_RESIDENCE, MARKET_NEED);
        const other = await residents(page, PLEBEIANS_RESIDENCE, MARKET_NEED);
        expect(full).toBeGreaterThan(0);
        await setCoverage(page, PEASANTS_LEVEL, MARKET, 84.4);
        expect(await residents(page, PEASANTS_RESIDENCE, MARKET_NEED)).toBeCloseTo(full * 0.844, 6);
        expect(await residents(page, PLEBEIANS_RESIDENCE, MARKET_NEED)).toBeCloseTo(other, 6);
    });

    test('the amount of a public need is scaled too, an unchecked need stays 0', async ({ page }) => {
        await loadIsland(page);
        const r = await page.evaluate(({ res, need, level, building }) => {
            const island = (window as any).view.island();
            const residence = island.assetsMap.get(res);
            residence.buildings.constructed(10);
            const n = residence.needsMap.get(need);
            n.needConsumptionRate = 0.5; // public needs have no rate in the data; give this one so the amount is observable
            const full = n.amount();
            island.publicCoverage(level, building)(50);
            const half = n.amount();
            n.checked(false);
            return { full, half, off: n.residents(), offAmount: n.amount() };
        }, { res: PEASANTS_RESIDENCE, need: MARKET_NEED, level: PEASANTS_LEVEL, building: MARKET });
        expect(r.half).toBeCloseTo(r.full / 2, 6);
        expect(r.off).toBe(0);
        expect(r.offAmount).toBe(0);
    });

    test('a need provided by two buildings uses the larger listed coverage', async ({ page }) => {
        // the data lists one provider per need in the region; a second provider of the Market need is added for this scenario
        const second = 999001;
        await loadIsland(page, {}, `window.params.publicServices.push(Object.assign({}, window.params.publicServices.find(function (s) { return s.guid === ${MARKET}; }), { guid: ${second} }));`);
        const full = await residents(page, PEASANTS_RESIDENCE, MARKET_NEED);
        await setCoverage(page, PEASANTS_LEVEL, MARKET, 40);
        await setCoverage(page, PEASANTS_LEVEL, second, 70);
        expect(await residents(page, PEASANTS_RESIDENCE, MARKET_NEED)).toBeCloseTo(full * 0.7, 6);
        await setCoverage(page, PEASANTS_LEVEL, second, 20);
        expect(await residents(page, PEASANTS_RESIDENCE, MARKET_NEED)).toBeCloseTo(full * 0.4, 6);
    });

    test('an unlisted building uses the island scalar, a goods need is not affected', async ({ page }) => {
        await loadIsland(page);
        const full = await residents(page, PEASANTS_RESIDENCE, MARKET_NEED);
        const bread = await page.evaluate(({ r, n }) => {
            const res = (window as any).view.island().assetsMap.get(r);
            res.buildings.constructed(10);
            res.needsMap.get(n).checked(true);
            return res.needsMap.get(n).amount();
        }, { r: PLEBEIANS_RESIDENCE, n: BREAD_NEED });
        await page.evaluate(() => { (window as any).view.island().publicCoverageDefault(70); });
        expect(await residents(page, PEASANTS_RESIDENCE, MARKET_NEED)).toBeCloseTo(full * 0.7, 6);
        const breadAfter = await page.evaluate(({ r, n }) => (window as any).view.island().assetsMap.get(r).needsMap.get(n).amount(), { r: PLEBEIANS_RESIDENCE, n: BREAD_NEED });
        expect(breadAfter).toBeCloseTo(bread, 6);
        // a listed building wins over the scalar
        await setCoverage(page, PEASANTS_LEVEL, MARKET, 30);
        expect(await residents(page, PEASANTS_RESIDENCE, MARKET_NEED)).toBeCloseTo(full * 0.3, 6);
    });

    test('the shares are stored, restored on reload and clamped on read', async ({ page }) => {
        await loadIsland(page);
        await setCoverage(page, PEASANTS_LEVEL, MARKET, 55);
        await page.evaluate(() => { (window as any).view.island().publicCoverageDefault(80); });
        await page.evaluate(() => new Promise<void>((r) => setTimeout(() => setTimeout(r, 30), 30)));
        const stored = await page.evaluate(({ level, building }) => {
            const s = (window as any).view.island().storage;
            return { listed: s.getItem(`${level}[${building}].publicCoverage`), scalar: s.getItem('publicCoverage') };
        }, { level: PEASANTS_LEVEL, building: MARKET });
        expect(stored).toEqual({ listed: 55, scalar: 80 });

        await loadIsland(page, { [`${PEASANTS_LEVEL}[${MARKET}].publicCoverage`]: 150, publicCoverage: 20 });
        const read = await page.evaluate(({ level, building }) => {
            const island = (window as any).view.island();
            return { listed: island.publicCoverage(level, building)(), scalar: island.publicCoverageDefault(), unlisted: island.publicCoverage(level, 99999)() };
        }, { level: PEASANTS_LEVEL, building: MARKET });
        expect(read).toEqual({ listed: 100, scalar: 20, unlisted: undefined });
    });

    test('without params.publicServices no building provides a need, so a listed share changes nothing', async ({ page }) => {
        await loadIsland(page, {}, 'window.params.publicServices = [];');
        const full = await residents(page, PEASANTS_RESIDENCE, MARKET_NEED);
        await setCoverage(page, PEASANTS_LEVEL, MARKET, 10);
        expect(await residents(page, PEASANTS_RESIDENCE, MARKET_NEED)).toBeCloseTo(full, 6);
    });
});
