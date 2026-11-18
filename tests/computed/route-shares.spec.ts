import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { allocateShares } from '../../src/trade-allocation';

/**
 * Allocation of a destination's demand across several supplying routes (src/trade-allocation.ts): the largest producer
 * stays the default supplier, the others get fixed amounts that follow the production of the sources.
 */

const LATIUM = 3245;
const BREAD = 2137;

test.describe('allocateShares (pure rule)', () => {
    const sources = [
        { key: 'A', surplus: 6 },
        { key: 'B', surplus: 3 },
        { key: 'C', surplus: 1 },
    ];

    test('supply covers demand: floors scale to demand, the largest producer is the default', () => {
        const r = allocateShares(5, sources);
        expect(r.find((x) => x.isDefault)?.key).toBe('A');
        expect(r.find((x) => x.key === 'B')?.floor).toBeCloseTo(1.5, 9);
        expect(r.find((x) => x.key === 'C')?.floor).toBeCloseTo(0.5, 9);
        expect(r.find((x) => x.key === 'A')?.floor).toBe(0);
    });

    test('demand exceeds supply: non-default sources give their full surplus, the default takes the rest', () => {
        const r = allocateShares(40, sources);
        expect(r.find((x) => x.key === 'B')?.floor).toBe(3);
        expect(r.find((x) => x.key === 'C')?.floor).toBe(1);
        expect(r.filter((x) => x.isDefault)).toHaveLength(1);
    });

    test('equal surplus: the alphabetically first source is the default', () => {
        const r = allocateShares(2, [{ key: 'B', surplus: 2 }, { key: 'A', surplus: 2 }]);
        expect(r.find((x) => x.isDefault)?.key).toBe('A');
        expect(r.find((x) => x.key === 'B')?.floor).toBeCloseTo(1, 9);
    });

    test('equal surplus keeps the preferred (current) default', () => {
        const r = allocateShares(2, [{ key: 'A', surplus: 0 }, { key: 'B', surplus: 0 }], () => true, 'B');
        expect(r.find((x) => x.isDefault)?.key).toBe('B');
    });

    test('keepPreferred leaves the default where it is and only sets the floors of the others', () => {
        const r = allocateShares(5, sources, () => true, 'C', true);
        expect(r.find((x) => x.isDefault)?.key).toBe('C');
        expect(r.find((x) => x.key === 'A')?.floor).toBeGreaterThan(0);
        expect(r.find((x) => x.key === 'B')?.floor).toBeGreaterThan(0);
    });

    test('keepPreferred does not keep a source that must not be default', () => {
        const r = allocateShares(5, sources, (k) => k !== 'C', 'C', true);
        expect(r.find((x) => x.isDefault)?.key).toBe('A');
    });

    test('a source that must not be default is skipped; it keeps a floor of its own', () => {
        const r = allocateShares(5, sources, (k) => k !== 'A');
        expect(r.find((x) => x.isDefault)?.key).toBe('B');
        expect(r.find((x) => x.key === 'A')?.floor).toBeCloseTo(3, 9);
    });

    test('no surplus anywhere: one default, every floor 0; zero demand gives floor 0', () => {
        const none = allocateShares(5, [{ key: 'A', surplus: 0 }, { key: 'B', surplus: 0 }]);
        expect(none.every((x) => x.floor === 0)).toBe(true);
        expect(none.filter((x) => x.isDefault)).toHaveLength(1);
        expect(allocateShares(0, sources).every((x) => x.floor === 0)).toBe(true);
    });
});

async function load(page: Page, tradeRoutes: object[]) {
    const cl = new ConfigLoader();
    const names = ['Roma', 'Ostia', 'Cumae', 'Pompeii'];
    const config = cl.createFullConfig(names.map((name) => ({ name, session: LATIUM, data: {} })), {}, 'Roma');
    config.tradeRoutes = JSON.stringify(tradeRoutes);
    await cl.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island() && (window as any).view.tradeManager);
    await page.waitForTimeout(300);
}

const route = (from: string, to: string, userSetAmount: number, isDefaultSupplier: boolean) => ({ productGUID: BREAD, from, to, userSetAmount, isDefaultSupplier });

// Cumae supplies Pompeii with 6 t/min, so Cumae needs 6 t/min from Roma and Ostia.
const ROUTES = [route('Roma', 'Cumae', 0, true), route('Ostia', 'Cumae', 0, false), route('Cumae', 'Pompeii', 6, false)];

async function setBakeries(page: Page, counts: Record<string, number>) {
    return page.evaluate((c) => {
        const view = (window as any).view;
        const out: Record<string, number> = {};
        for (const island of view.islands()) {
            const bread = island.assetsMap.get(2137);
            if (!bread || c[island.name()] === undefined) continue;
            const bakery = bread.factories[0];
            bakery.buildings.constructed(c[island.name()]);
            out[island.name()] = (bakery.buildings.constructed() * bakery.boost() * 60 * bakery.extraGoodFactor()) / bakery.cycleTime;
        }
        return out;
    }, counts);
}

async function floors(page: Page) {
    return page.evaluate(() => {
        const view = (window as any).view;
        return view.tradeManager.routes().map((r: any) => ({ from: r.from.name(), to: r.to.name(), floor: r.userSetAmount(), def: r.isDefaultSupplier(), production: r.currentProduction() }));
    });
}

test.describe('recomputeShares on routes', () => {
    test('the larger producer stays the default and the other gets its share of the demand', async ({ page }) => {
        await load(page, ROUTES);
        const cap = await setBakeries(page, { Roma: 3, Ostia: 1 });
        await page.evaluate(() => (window as any).view.tradeRoutes.recomputeShares());
        const list = await floors(page);
        const roma = list.find((r: any) => r.from === 'Roma' && r.to === 'Cumae');
        const ostia = list.find((r: any) => r.from === 'Ostia' && r.to === 'Cumae');
        const demand = 6;
        const total = cap.Roma + cap.Ostia;
        expect(roma.def).toBe(true);
        expect(ostia.def).toBe(false);
        expect(ostia.floor).toBeCloseTo(total >= demand ? (demand * cap.Ostia) / total : cap.Ostia, 6);
        expect(roma.floor).toBe(0);
    });

    test('the default moves to the larger producer', async ({ page }) => {
        await load(page, ROUTES);
        await setBakeries(page, { Roma: 1, Ostia: 4 });
        await page.evaluate(() => (window as any).view.tradeRoutes.recomputeShares());
        const list = await floors(page);
        expect(list.find((r: any) => r.from === 'Ostia' && r.to === 'Cumae').def).toBe(true);
        expect(list.find((r: any) => r.from === 'Roma' && r.to === 'Cumae')).toBeDefined();
    });

    test('a group with a floor set by hand stays untouched for the one-shot and is replaced on request', async ({ page }) => {
        await load(page, [route('Roma', 'Cumae', 0, true), route('Ostia', 'Cumae', 2.5, false), route('Cumae', 'Pompeii', 6, false)]);
        await setBakeries(page, { Roma: 1, Ostia: 4 });
        await page.evaluate(() => (window as any).view.tradeRoutes.recomputeShares(true));
        const before = await floors(page);
        expect(before.find((r: any) => r.from === 'Ostia' && r.to === 'Cumae').floor).toBeCloseTo(2.5, 9);
        expect(before.find((r: any) => r.from === 'Roma' && r.to === 'Cumae').def).toBe(true);
        await page.evaluate(() => (window as any).view.tradeRoutes.recomputeShares());
        const after = await floors(page);
        expect(after.find((r: any) => r.from === 'Ostia' && r.to === 'Cumae').def).toBe(true);
    });

    test('keeping the default updates only the floors of the other routes', async ({ page }) => {
        await load(page, ROUTES);
        await setBakeries(page, { Roma: 1, Ostia: 4 });
        await page.evaluate(() => (window as any).view.tradeRoutes.recomputeShares(false, true));
        const list = await floors(page);
        const roma = list.find((r: any) => r.from === 'Roma' && r.to === 'Cumae');
        const ostia = list.find((r: any) => r.from === 'Ostia' && r.to === 'Cumae');
        expect(roma.def).toBe(true);
        expect(ostia.def).toBe(false);
        expect(ostia.floor).toBeGreaterThan(0);
    });

    test('a built factory as default supplier stays; the routes carry what its capacity cannot cover', async ({ page }) => {
        await load(page, [route('Roma', 'Cumae', 0, false), route('Ostia', 'Cumae', 0, false), route('Cumae', 'Pompeii', 6, false)]);
        const cap = await setBakeries(page, { Cumae: 1, Roma: 3, Ostia: 1 });
        await page.evaluate(() => (window as any).view.tradeRoutes.recomputeShares());
        const list = await floors(page);
        const roma = list.find((r: any) => r.from === 'Roma' && r.to === 'Cumae');
        const ostia = list.find((r: any) => r.from === 'Ostia' && r.to === 'Cumae');
        const need = Math.max(0, 6 - cap.Cumae);
        const total = cap.Roma + cap.Ostia;
        expect(roma.def).toBe(false);
        expect(ostia.def).toBe(false);
        expect(roma.floor + ostia.floor).toBeCloseTo(Math.min(need, total), 6);
        const isDefaultFactory = await page.evaluate(() => (window as any).view.islands().find((i: any) => i.name() === 'Cumae').assetsMap.get(2137).defaultSupplier().type);
        expect(isDefaultFactory).toBe('factory');
    });

    test('a single supplier is left alone', async ({ page }) => {
        await load(page, [route('Roma', 'Cumae', 0, true), route('Cumae', 'Pompeii', 6, false)]);
        await setBakeries(page, { Roma: 3 });
        await page.evaluate(() => (window as any).view.tradeRoutes.recomputeShares());
        const list = await floors(page);
        const r = list.find((x: any) => x.from === 'Roma' && x.to === 'Cumae');
        expect(r.def).toBe(true);
        expect(r.floor).toBe(0);
    });
});
