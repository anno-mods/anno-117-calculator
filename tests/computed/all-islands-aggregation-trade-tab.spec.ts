import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * `ProductPresenter.showTradeRouteTab()` must be the exact complement of "some visible factory
 * reports isDefaultSupplier()". `isDefaultSupplier` was made aggregate-aware ("the first visible
 * factory is always active") but showTradeRouteTab still read the All-Islands pseudo-island's own
 * defaultSupplier(), so both the first factory tab and the Trading tab could resolve to
 * `show active` at once and render stacked (product-config-dialog.html:84/94/105/111).
 */

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

test.describe('All-Islands aggregation - product dialog tab activation', () => {

    test('exactly one tab is active when factories are visible while aggregating', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({ PRODUCT_BREAD, FACTORY_BAKERY }) => {
            const view = (window as any).view;

            for (const island of view.islands()) {
                if (island.isAllIslands()) continue;
                const bakery = island.assetsMap.get(FACTORY_BAKERY);
                if (bakery) bakery.buildings.constructed(3);
            }

            const presenter = view.presenter.productByGuid.get(PRODUCT_BREAD);
            const visible = presenter.visibleFactories();

            return {
                visibleCount: visible.length,
                activeFactoryTabs: visible.filter((f: any) => f.isDefaultSupplier()).length,
                tradeTabActive: presenter.showTradeRouteTab(),
            };
        }, { PRODUCT_BREAD, FACTORY_BAKERY });

        expect(result.visibleCount).toBeGreaterThan(0);
        expect(result.activeFactoryTabs).toBe(1);
        expect(result.tradeTabActive).toBe(false);
    });

    /**
     * The actual defect. At bootstrap the pseudo-island happens to resolve a factory supplier for
     * every product, so the two conditions agree by luck. They diverge as soon as the pseudo-island
     * carries a non-factory supplier of its own - reachable by choosing passive trade on the
     * All-Islands view with aggregation off, then switching aggregation on, or by loading such a
     * save. isDefaultSupplier() still reports the first visible factory as active (aggregate rule),
     * while showTradeRouteTab() read the pseudo-island's own supplier and also said "active".
     */
    test('trade tab stays inactive when the pseudo-island own supplier is not a factory', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({ PRODUCT_BREAD }) => {
            const view = (window as any).view;
            const presenter = view.presenter.productByGuid.get(PRODUCT_BREAD);

            const passiveTrade = presenter.availableSuppliers().find((o: any) => o.type === 'passive_trade');
            presenter.instance().defaultSupplier(passiveTrade.supplier);

            const visible = presenter.visibleFactories();
            return {
                pseudoIslandSupplierType: presenter.defaultSupplier() ? presenter.defaultSupplier().type : null,
                visibleCount: visible.length,
                activeFactoryTabs: visible.filter((f: any) => f.isDefaultSupplier()).length,
                tradeTabActive: presenter.showTradeRouteTab(),
            };
        }, { PRODUCT_BREAD });

        // Guard the premise: the pseudo-island really does carry a non-factory supplier while
        // visible factories exist, which is what makes the two conditions disagree.
        expect(result.pseudoIslandSupplierType).toBe('passive_trade');
        expect(result.visibleCount).toBeGreaterThan(0);

        expect(result.activeFactoryTabs).toBe(1);
        // The defect: the trade tab was ALSO active -> two panes rendered `show active`, stacked.
        expect(result.tradeTabActive).toBe(false);
    });

    test('exactly one active surface regardless of visible factory count', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({ PRODUCT_BREAD }) => {
            const view = (window as any).view;
            const presenter = view.presenter.productByGuid.get(PRODUCT_BREAD);
            const visible = presenter.visibleFactories();
            return {
                activeFactoryTabs: visible.filter((f: any) => f.isDefaultSupplier()).length,
                tradeTabActive: presenter.showTradeRouteTab(),
            };
        }, { PRODUCT_BREAD });

        expect(result.activeFactoryTabs + (result.tradeTabActive ? 1 : 0)).toBe(1);
    });

    test('non-aggregate behaviour is unchanged', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
        ], 'IslandA');

        const result = await page.evaluate(({ PRODUCT_BREAD }) => {
            const view = (window as any).view;
            const presenter = view.presenter.productByGuid.get(PRODUCT_BREAD);
            return {
                tradeTabActive: presenter.showTradeRouteTab(),
                supplierType: presenter.defaultSupplier() ? presenter.defaultSupplier().type : null,
            };
        }, { PRODUCT_BREAD });

        expect(result.tradeTabActive).toBe(result.supplierType !== 'factory');
    });
});
