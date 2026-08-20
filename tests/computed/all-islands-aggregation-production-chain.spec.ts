import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * ProductionChainView traverses `consumer.boost()`, `consumer.inputDemands()` and
 * `d.product.defaultSupplier()` - all per-island configuration. Built from the All-Islands
 * pseudo-island's Factory (unmodified boost, suppliers usually unset) the chain rendered while
 * aggregating is meaningless. A genuinely summed chain is not well-defined either, so the chain
 * is drawn from a representative real island: the one producing the most of this good.
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

test.describe('All-Islands aggregation - production chain representative', () => {

    test('chain is built from the highest-producing real island, not All-Islands', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({ PRODUCT_BREAD, FACTORY_BAKERY }) => {
            const view = (window as any).view;
            const counts: Record<string, number> = { IslandA: 2, IslandB: 9 };
            for (const island of view.islands()) {
                if (island.isAllIslands()) continue;
                const bakery = island.assetsMap.get(FACTORY_BAKERY);
                bakery.buildings.constructed(counts[island.name()]);
                bakery.buildings.fullyUtilizeConstructed(true);
            }

            const presenter = view.presenter.productByGuid.get(PRODUCT_BREAD);
            const bakery = presenter.factoryPresenters.find((f: any) => f.factory.guid === FACTORY_BAKERY);
            const representative = bakery.representativeInstance();

            return {
                representativeIsland: representative ? representative.island.name() : null,
                isAllIslands: representative ? representative.island.isAllIslands() : null,
                perIslandProduction: view.islands()
                    .filter((i: any) => !i.isAllIslands())
                    .map((i: any) => i.assetsMap.get(FACTORY_BAKERY).currentProduction()),
                hasChain: bakery.productionChain.tree() != null,
            };
        }, { PRODUCT_BREAD, FACTORY_BAKERY });

        // Guard the premise: IslandB must genuinely out-produce IslandA.
        expect(result.perIslandProduction[1]).toBeGreaterThan(result.perIslandProduction[0]);
        expect(result.isAllIslands).toBe(false);
        expect(result.representativeIsland).toBe('IslandB');
        expect(result.hasChain).toBe(true);
    });

    test('clicking a production chain node keeps the aggregate view', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({ PRODUCT_BREAD, FACTORY_BAKERY }) => {
            const view = (window as any).view;
            const counts: Record<string, number> = { IslandA: 2, IslandB: 9 };
            for (const island of view.islands()) {
                if (island.isAllIslands()) continue;
                const bakery = island.assetsMap.get(FACTORY_BAKERY);
                bakery.buildings.constructed(counts[island.name()]);
                bakery.buildings.fullyUtilizeConstructed(true);
            }

            const presenter = view.presenter.productByGuid.get(PRODUCT_BREAD);
            const bakery = presenter.factoryPresenters.find((f: any) => f.factory.guid === FACTORY_BAKERY);

            // Walk to a child node of the chain - it belongs to the REPRESENTATIVE island now,
            // not to All-Islands.
            const tree = bakery.productionChain.tree();
            const child = tree.children[0];

            // Exactly what treeElement.html does on click.
            view.selectedProduct(child.product);

            // ...and exactly what product-config-dialog.html's `with:` binding resolves.
            const resolved = view.presenter.productByGuid.get(view.selectedProduct().guid);

            return {
                childIslandIsAllIslands: child.product.island.isAllIslands(),
                resolvedExists: resolved != null,
                // The resolved presenter must still be reading the All-Islands view.
                resolvedIslandIsAllIslands: resolved ? resolved.island().isAllIslands() : null,
                // Selecting a node must not switch the selected island out of aggregate mode.
                stillAggregating: view.isAggregating(),
                // Every visible factory row of the resolved presenter still reports read-only
                // aggregate buildings, i.e. the dialog opens on aggregate data, not on the
                // representative island's own editable data.
                resolvedRowsReadOnly: resolved
                    ? resolved.visibleFactories().map((f: any) => f.buildings().readOnly)
                    : null,
            };
        }, { PRODUCT_BREAD, FACTORY_BAKERY });

        // Premise: the node really does come from a real island, not the pseudo-island.
        expect(result.childIslandIsAllIslands).toBe(false);
        // Contract: only the guid is used, so the dialog still resolves the aggregate presenter.
        expect(result.resolvedExists).toBe(true);
        expect(result.resolvedIslandIsAllIslands).toBe(true);
        expect(result.stillAggregating).toBe(true);
        expect(result.resolvedRowsReadOnly!.length).toBeGreaterThan(0);
        expect(result.resolvedRowsReadOnly).not.toContain(false);
    });

    test('representativeInstance is instance() when not aggregating', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
        ], 'IslandA');

        const same = await page.evaluate(({ PRODUCT_BREAD, FACTORY_BAKERY }) => {
            const view = (window as any).view;
            const presenter = view.presenter.productByGuid.get(PRODUCT_BREAD);
            const bakery = presenter.factoryPresenters.find((f: any) => f.factory.guid === FACTORY_BAKERY);
            return bakery.representativeInstance() === bakery.instance();
        }, { PRODUCT_BREAD, FACTORY_BAKERY });

        expect(same).toBe(true);
    });
});
