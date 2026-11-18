import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * Governor supply (plan 2026-11-12-001 U1): Product.governorSupply is a per-product, persisted t/min figure that is
 * summed into the product's production next to the passive supplier. It lowers the default supplier's demand, never
 * becomes the default supplier and never creates a route.
 */

const LATIUM = 3245;
const BAKERY = 3174;

async function load(page: Page, islands: { name: string; session: number; data?: Record<string, any> }[], active: string, settings: Record<string, string> = {}) {
    const cl = new ConfigLoader();
    await cl.loadConfigObject(page, cl.createFullConfig(islands, settings, active));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.waitForTimeout(300);
}

// Builds a bakery so that some input product has demand and a factory as default supplier; returns its guid.
async function demandedProduct(page: Page, islandName: string): Promise<number> {
    return page.evaluate(({ name, bakery }) => {
        const view = (window as any).view;
        const island = view.islands().find((i: any) => i.name() === name);
        const b = island.assetsMap.get(bakery);
        b.buildings.fullyUtilizeConstructed(true);
        b.buildings.constructed(8);
        for (const p of island.products) {
            if (p.totalDemand() > 0.5 && p.defaultSupplier() && p.defaultSupplier().type === 'factory') return p.guid as number;
        }
        throw new Error('no demanded product with a factory supplier');
    }, { name: islandName, bakery: BAKERY });
}

test.describe('governor supply (U1)', () => {
    test('lowers the default supplier demand and keeps the default supplier and total production', async ({ page }) => {
        await load(page, [{ name: 'Roma', session: LATIUM }], 'Roma');
        const guid = await demandedProduct(page, 'Roma');
        const r = await page.evaluate((g) => {
            const p = (window as any).view.island().assetsMap.get(g);
            const supplier = p.defaultSupplier();
            const demand = p.totalDemand();
            const before = { supplier: supplier.currentProduction(), total: p.totalCurrentProduction() };
            p.governorSupply(demand / 2);
            return {
                demand,
                before,
                after: { supplier: p.defaultSupplier().currentProduction(), total: p.totalCurrentProduction(), same: p.defaultSupplier() === supplier },
                routes: p.tradeList.routes().length,
            };
        }, guid);
        expect(r.after.same).toBe(true);
        expect(r.after.supplier).toBeCloseTo(r.before.supplier - r.demand / 2, 6);
        expect(r.after.total).toBeCloseTo(r.before.total, 6);
        expect(r.routes).toBe(0);
    });

    test('a governor supply above the demand shows as excess production and zeroes the supplier demand', async ({ page }) => {
        await load(page, [{ name: 'Roma', session: LATIUM }], 'Roma');
        const guid = await demandedProduct(page, 'Roma');
        const r = await page.evaluate((g) => {
            const p = (window as any).view.island().assetsMap.get(g);
            const demand = p.totalDemand();
            p.governorSupply(demand + 2);
            return { demand, excess: p.excessProduction(), supplier: p.defaultSupplier().currentProduction() };
        }, guid);
        expect(r.excess).toBeCloseTo(2, 6);
        expect(r.supplier).toBeCloseTo(0, 6);
    });

    test('with the passive supplier as default it receives the remaining demand; its stored amount is untouched', async ({ page }) => {
        await load(page, [{ name: 'Roma', session: LATIUM }], 'Roma');
        const guid = await demandedProduct(page, 'Roma');
        const r = await page.evaluate((g) => {
            const island = (window as any).view.island();
            const p = island.assetsMap.get(g);
            p.passiveTradeSupplier.setAsDefaultSupplier();
            const demand = p.totalDemand();
            p.governorSupply(demand / 4);
            return { demand, passive: p.passiveTradeSupplier.currentProduction(), stored: island.storage.getItem('passiveTrade.userSetAmount') };
        }, guid);
        expect(r.passive).toBeCloseTo(r.demand * 0.75, 6);
        expect(r.stored == null || Number(r.stored) === 0).toBe(true);
    });

    test('negative input stays at zero', async ({ page }) => {
        await load(page, [{ name: 'Roma', session: LATIUM }], 'Roma');
        const v = await page.evaluate(() => {
            const p = (window as any).view.island().assetsMap.get(2137);
            p.governorSupply(-3);
            return p.governorSupply();
        });
        expect(v).toBe(0);
    });

    test('persists per product: a stored value applies to that product only', async ({ page }) => {
        await load(page, [{ name: 'Roma', session: LATIUM, data: { '2137.governorSupply': 4 } }], 'Roma');
        const r = await page.evaluate(() => {
            const island = (window as any).view.island();
            const bread = island.assetsMap.get(2137);
            const other = island.products.find((p: any) => p.guid !== 2137);
            bread.governorSupply(5);
            return { read: island.assetsMap.get(2137).governorSupply(), other: other.governorSupply() };
        });
        expect(r.other).toBe(0);
        await page.evaluate(() => new Promise<void>((res) => setTimeout(() => setTimeout(res, 30), 30)));
        const stored = await page.evaluate(() => (window as any).view.island().storage.getItem('2137.governorSupply'));
        expect(Number(stored)).toBe(5);
    });

    test('initial value from storage is read at load', async ({ page }) => {
        await load(page, [{ name: 'Roma', session: LATIUM, data: { '2137.governorSupply': 4 } }], 'Roma');
        const r = await page.evaluate(() => {
            const island = (window as any).view.island();
            const other = island.products.find((p: any) => p.guid !== 2137);
            return { bread: island.assetsMap.get(2137).governorSupply(), other: other.governorSupply() };
        });
        expect(r.bread).toBe(4);
        expect(r.other).toBe(0);
    });

    test('aggregate mode: the tile total includes the governor supply of the real islands', async ({ page }) => {
        await load(
            page,
            [
                { name: 'Roma', session: LATIUM },
                { name: 'Ostia', session: LATIUM },
            ],
            'All Islands',
            { 'settings.aggregateAllIslands': '1' },
        );
        const r = await page.evaluate(() => {
            const view = (window as any).view;
            const roma = view.islands().find((i: any) => i.name() === 'Roma');
            const ostia = view.islands().find((i: any) => i.name() === 'Ostia');
            const presenter = view.presenter.productByGuid.get(2137);
            const before = presenter.totalProduction();
            roma.assetsMap.get(2137).governorSupply(3);
            ostia.assetsMap.get(2137).governorSupply(2);
            return { before, after: presenter.totalProduction() };
        });
        expect(r.after).toBeCloseTo(r.before + 5, 6);
    });

    test('the exchange summary counts the governor supply as an import', async ({ page }) => {
        await load(page, [{ name: 'Roma', session: LATIUM }], 'Roma');
        const imports = await page.evaluate(() => {
            const view = (window as any).view;
            view.island().assetsMap.get(2137).governorSupply(4);
            const s = (window as any).exchange.computeSummary();
            return Object.values(s.islands as Record<string, any>)[0].imports['2137'];
        });
        expect(imports).toBeCloseTo(4, 6);
    });
});
