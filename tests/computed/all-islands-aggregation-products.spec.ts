import { test, expect, Page, Browser } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * U2: presenter-level aggregation for products/factories (src/presenters.ts).
 *
 * Covers AE1, AE6, AE9, AE10 (setup), plus reactivity, zero-real-islands, and no-regression
 * scenarios from the U2 test list in the All-Islands Aggregation plan.
 *
 * Fixtures (per tests/AGENTS.md GUID table, plus runtime verification against the current params.js):
 *   Session Latium (Roman) = 3245, Session Albion (Celtic) = 6627, All Islands session = 37135
 *   Wine 2138: produced by region-specific "Vintner" factories - Roman Vintner 3177 and Celtic
 *   Vintner 23753 - the ready-made multi-factory-type fixture for the same product guid. (Note:
 *   the "Latium/Albion Vineyard" GUIDs 2694/23723 from tests/AGENTS.md produce Grapes 2070, not
 *   Wine - verified via a throwaway run before writing this file; Vintner is the correct fixture.)
 *
 * For the "local consumption" scenarios (AE1, AE6) we don't hardcode a specific need/residence -
 * Bread's need is monument-gated on the Liberti tier (see src/AGENTS.md "Cross-tier mixed case"),
 * so a hardcoded residence+need pair risks silently asserting on zero demand. Instead we discover,
 * once per test file (via a throwaway island), a real (residence, need, product) triple where the
 * need is ungated and the product has a local Roman-region producer - then reuse that discovered
 * product guid as a fixed constant for the rest of the file.
 */

const ROMAN_SESSION = 3245;
const CELTIC_SESSION = 6627;
const ALL_ISLANDS_NAME = 'All Islands';

const WINE = 2138;
// Wine (2138) is produced by region-specific "Vintner" factories - verified against the current
// params.js at runtime (the Latium/Albion "Vineyard" GUIDs 2694/23723 from tests/AGENTS.md produce
// Grapes 2070, not Wine, so they are not usable here).
const ROMAN_VINTNER = 3177;
const CELTIC_VINTNER = 23753;

interface IslandSpec { name: string; session: number; data?: Record<string, any>; }

interface LocalProductFixture { residenceGuid: number; needGuid: number; productGuid: number; }

async function loadAggregateConfig(page: Page, islands: IslandSpec[], opts: {
    activeIsland?: string;
    aggregation?: boolean;
    tradeRoutes?: any[];
} = {}) {
    const cl = new ConfigLoader();
    const settings: Record<string, string> = {};
    if (opts.aggregation !== false)
        settings['settings.aggregateAllIslands'] = '1';

    const config = cl.createFullConfig(islands, settings, opts.activeIsland ?? ALL_ISLANDS_NAME);
    if (opts.tradeRoutes)
        config.tradeRoutes = JSON.stringify(opts.tradeRoutes);

    await cl.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.waitForTimeout(300);
}

/** Finds an ungated residence need whose product has a local producer in the island's own region. */
async function discoverLocalProductFixture(browser: Browser): Promise<LocalProductFixture> {
    const page = await browser.newPage();
    try {
        await loadAggregateConfig(page, [{ name: 'Scout', session: ROMAN_SESSION }], { aggregation: false, activeIsland: 'Scout' });

        const fixture = await page.evaluate(() => {
            const island = (window as any).view.island();
            for (const residence of island.residenceBuildings) {
                for (const rn of residence.needsMap.values()) {
                    const need = rn as any;
                    if (need.requiresItem !== undefined) continue; // skip monument/item-gated needs
                    const product = need.need.product;
                    if (product && product.factories && product.factories.length > 0) {
                        return { residenceGuid: residence.guid, needGuid: need.need.guid, productGuid: product.guid };
                    }
                }
            }
            return null;
        });

        if (!fixture)
            throw new Error('discoverLocalProductFixture: no ungated need with a local Roman producer was found');

        return fixture;
    } finally {
        await page.close();
    }
}

test.describe('All-Islands aggregation - product/factory presenters (U2)', () => {
    let fixture: LocalProductFixture;

    test.beforeAll(async ({ browser }) => {
        fixture = await discoverLocalProductFixture(browser);
    });

    test('AE1: local demand and production sum across two real islands', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ]);

        const result = await page.evaluate(({ residenceGuid, productGuid }) => {
            const view = (window as any).view;
            const islandA = view.islands().find((i: any) => i.name() === 'IslandA');
            const islandB = view.islands().find((i: any) => i.name() === 'IslandB');

            islandA.assetsMap.get(residenceGuid).buildings.constructed(8);
            islandB.assetsMap.get(residenceGuid).buildings.constructed(5);

            const productA = islandA.assetsMap.get(productGuid);
            const productB = islandB.assetsMap.get(productGuid);
            const factoryA = productA.factories[0];
            const factoryB = productB.factories[0];
            factoryA.buildings.fullyUtilizeConstructed(true);
            factoryA.buildings.constructed(6);
            factoryB.buildings.fullyUtilizeConstructed(true);
            factoryB.buildings.constructed(4);

            const demandA = productA.totalDemandNoRoutes();
            const demandB = productB.totalDemandNoRoutes();
            const prodA = factoryA.currentProduction();
            const prodB = factoryB.currentProduction();

            const presenter = view.presenter.productByGuid.get(productGuid);

            return {
                demandA, demandB, prodA, prodB,
                aggDemand: presenter.totalDemandNoRoutes(),
                aggProduction: presenter.totalProduction(),
            };
        }, { residenceGuid: fixture.residenceGuid, productGuid: fixture.productGuid });

        // Sanity: the scenario actually exercised nonzero demand/production.
        expect(result.demandA + result.demandB).toBeGreaterThan(0);
        expect(result.prodA + result.prodB).toBeGreaterThan(0);

        expect(result.aggDemand).toBeCloseTo(result.demandA + result.demandB, 4);
        expect(result.aggProduction).toBeCloseTo(Math.max(result.demandA + result.demandB, result.prodA + result.prodB), 4);
    });

    test('AE6: trade route netting excludes export demand and import production, keeps passive trade', async ({ page }) => {
        const EXPORT_AMOUNT = 3;

        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], {
            tradeRoutes: [{
                productGUID: fixture.productGuid,
                from: 'IslandA',
                to: 'IslandB',
                userSetAmount: EXPORT_AMOUNT,
                isDefaultSupplier: false,
            }],
        });

        const result = await page.evaluate(({ residenceGuid, productGuid, exportAmount }) => {
            const view = (window as any).view;
            const islandA = view.islands().find((i: any) => i.name() === 'IslandA');
            const islandB = view.islands().find((i: any) => i.name() === 'IslandB');

            islandA.assetsMap.get(residenceGuid).buildings.constructed(4);
            islandB.assetsMap.get(residenceGuid).buildings.constructed(4);

            const productA = islandA.assetsMap.get(productGuid);
            const productB = islandB.assetsMap.get(productGuid);
            const factoryA = productA.factories[0];
            const factoryB = productB.factories[0];
            factoryA.buildings.fullyUtilizeConstructed(true);
            factoryA.buildings.constructed(6);
            factoryB.buildings.fullyUtilizeConstructed(true);
            factoryB.buildings.constructed(2);

            // Passive-trade supply on island B, kept as a non-default supplier so
            // currentProduction() reflects userSetAmount directly, independent of demand routing.
            productB.passiveTradeSupplier.userSetAmount(1.5);

            const route = view.tradeManager.routes().find((r: any) => r.product.guid === productGuid && r.from === islandA);

            const demandNoRoutesA = productA.totalDemandNoRoutes();
            const demandWithRoutesA = productA.totalDemand(); // includes the export obligation
            const demandNoRoutesB = productB.totalDemandNoRoutes();

            const nonRouteProduction = (island: any) => {
                const product = island.assetsMap.get(productGuid);
                let sum = 0;
                for (const supplier of product.availableSuppliers())
                    if (supplier.type !== 'trade_route')
                        sum += supplier.currentProduction();
                sum += product.passiveTradeSupplier.currentProduction();
                return sum;
            };

            const naiveTotalCurrentProduction = (island: any) => island.assetsMap.get(productGuid).totalCurrentProduction();

            const prodNoRoutesA = nonRouteProduction(islandA);
            const prodNoRoutesB = nonRouteProduction(islandB);
            const naiveProdB = naiveTotalCurrentProduction(islandB); // includes the imported route amount

            const presenter = view.presenter.productByGuid.get(productGuid);

            return {
                routeExists: !!route,
                routeAmount: route ? route.currentProduction() : 0,
                demandNoRoutesA, demandWithRoutesA, demandNoRoutesB,
                prodNoRoutesA, prodNoRoutesB, naiveProdB,
                aggDemand: presenter.totalDemandNoRoutes(),
                aggProduction: presenter.totalProduction(),
            };
        }, { residenceGuid: fixture.residenceGuid, productGuid: fixture.productGuid, exportAmount: EXPORT_AMOUNT });

        expect(result.routeExists).toBe(true);
        expect(result.routeAmount).toBeCloseTo(EXPORT_AMOUNT, 4);
        // The route inflates A's totalDemand (with routes) but must not appear in totalDemandNoRoutes.
        expect(result.demandWithRoutesA).toBeGreaterThan(result.demandNoRoutesA + EXPORT_AMOUNT - 0.01);
        // B's naive totalCurrentProduction (includes the imported route) must exceed the route-free sum -
        // proving the route really did contribute production on B's side that our filter must exclude.
        expect(result.naiveProdB).toBeGreaterThan(result.prodNoRoutesB + EXPORT_AMOUNT - 0.5);

        // Aggregate demand = local consumption only, from both islands - export obligation excluded.
        expect(result.aggDemand).toBeCloseTo(result.demandNoRoutesA + result.demandNoRoutesB, 4);
        // Aggregate production excludes B's imported route amount but keeps its passive-trade supply.
        const expectedAggProduction = Math.max(
            result.demandNoRoutesA + result.demandNoRoutesB,
            result.prodNoRoutesA + result.prodNoRoutesB
        );
        expect(result.aggProduction).toBeCloseTo(expectedAggProduction, 4);
    });

    test('AE9: multi-producer product (Wine) sums both factory types across islands', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'Latium', session: ROMAN_SESSION },
            { name: 'Albion', session: CELTIC_SESSION },
        ]);

        const result = await page.evaluate(({ wine, latiumVineyard, albionVineyard }) => {
            const view = (window as any).view;
            const latium = view.islands().find((i: any) => i.name() === 'Latium');
            const albion = view.islands().find((i: any) => i.name() === 'Albion');

            const latiumFactory = latium.assetsMap.get(latiumVineyard);
            const albionFactory = albion.assetsMap.get(albionVineyard);
            latiumFactory.buildings.fullyUtilizeConstructed(true);
            latiumFactory.buildings.constructed(3);
            albionFactory.buildings.fullyUtilizeConstructed(true);
            albionFactory.buildings.constructed(2);

            const presenter = view.presenter.productByGuid.get(wine);
            const synthetic = presenter.factoryPresenterIfDefaultSupplier();

            return {
                latiumConstructed: latiumFactory.buildings.constructed(),
                albionConstructed: albionFactory.buildings.constructed(),
                syntheticConstructed: synthetic.instance().buildings.constructed(),
                syntheticRequired: synthetic.instance().buildings.required(),
                requiredFormatted: synthetic.requiredBuildingsFormatted(),
                contributingNames: synthetic.contributingFactoryNames(),
                factoryTypeCount: presenter.product.factories.length,
            };
        }, { wine: WINE, latiumVineyard: ROMAN_VINTNER, albionVineyard: CELTIC_VINTNER });

        // Template-binding render check: every method the compact-count block calls resolves without error
        // and yields the summed count across BOTH factory types, on BOTH islands.
        expect(result.syntheticConstructed).toBeCloseTo(result.latiumConstructed + result.albionConstructed, 4);
        expect(typeof result.syntheticRequired).toBe('number');
        expect(typeof result.requiredFormatted).toBe('string');
        expect(result.requiredFormatted.length).toBeGreaterThan(0);

        if (result.factoryTypeCount > 1) {
            expect(result.contributingNames.length).toBeGreaterThan(0);
        }
    });

    test('AE10 setup: isDefaultSupplier resolves true for exactly one factory in aggregate mode', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'Latium', session: ROMAN_SESSION },
            { name: 'Albion', session: CELTIC_SESSION },
        ]);

        const result = await page.evaluate(({ wine, latiumVineyard, albionVineyard }) => {
            const view = (window as any).view;
            const latium = view.islands().find((i: any) => i.name() === 'Latium');
            const albion = view.islands().find((i: any) => i.name() === 'Albion');
            const allIslands = view.islands().find((i: any) => i.isAllIslands());

            // Force each real island to have picked a DIFFERENT factory as its own default supplier,
            // to prove the aggregate result doesn't depend on either island's own choice.
            const wineOnLatium = latium.assetsMap.get(wine);
            const wineOnAlbion = albion.assetsMap.get(wine);
            wineOnLatium.updateDefaultSupplier(latium.assetsMap.get(latiumVineyard));
            wineOnAlbion.updateDefaultSupplier(albion.assetsMap.get(albionVineyard));

            // Also point All-Islands' own (vestigial) default supplier at the SECOND factory type,
            // so a naive non-aggregate read of isDefaultSupplier() on the currently-viewed island
            // (All Islands) would resolve true for the second factory, not the first - this is what
            // makes the assertion below a real differentiator rather than a coincidental pass.
            const wineOnAllIslands = allIslands.assetsMap.get(wine);
            wineOnAllIslands.updateDefaultSupplier(wineOnAllIslands.factories[1]);

            const presenter = view.presenter.productByGuid.get(wine);
            const flags = presenter.factoryPresenters.map((fp: any) => fp.isDefaultSupplier());
            const trueCount = flags.filter((f: boolean) => f).length;
            const firstVisibleIsDefault = presenter.visibleFactories()[0]?.isDefaultSupplier();

            return { flags, trueCount, firstVisibleIsDefault };
        }, { wine: WINE, latiumVineyard: ROMAN_VINTNER, albionVineyard: CELTIC_VINTNER });

        expect(result.trueCount).toBe(1);
        expect(result.firstVisibleIsDefault).toBe(true);
    });

    test('zero real islands: aggregate computed values return 0, not an error', async ({ page }) => {
        await loadAggregateConfig(page, []);

        const result = await page.evaluate((wine) => {
            const view = (window as any).view;
            const presenter = view.presenter.productByGuid.get(wine);

            return {
                realIslandCount: view.islands().filter((i: any) => !i.isAllIslands()).length,
                totalDemandNoRoutes: presenter.totalDemandNoRoutes(),
                totalProduction: presenter.totalProduction(),
                extraGoodProduction: presenter.extraGoodProduction(),
                factoryPresenterIfDefaultSupplier: presenter.factoryPresenterIfDefaultSupplier(),
            };
        }, WINE);

        expect(result.realIslandCount).toBe(0);
        expect(result.totalDemandNoRoutes).toBe(0);
        expect(result.totalProduction).toBe(0);
        expect(result.extraGoodProduction).toBe(0);
        // Synthetic combined object still resolves (product has >1 factory type) with zero counts.
        expect(result.factoryPresenterIfDefaultSupplier).not.toBeNull();
    });

    test('REGRESSION: a product with no factory type resolves factoryPresenterIfDefaultSupplier to null while aggregating, matching the non-aggregate behavior', async ({ page }) => {
        // Bug found post-launch: the aggregate branch always returned a synthetic object, even for
        // products with zero visible factory types (e.g. Obsidian, import-only). Since product-tile.html
        // binds the compact count row via `with: factoryPresenterIfDefaultSupplier()`, a non-null return
        // for a product that normally shows no count row at all made the row render unexpectedly,
        // overflowing the tile's fixed-height layout and clipping the t/min line below it.
        await loadAggregateConfig(page, [
            { name: 'Latium', session: ROMAN_SESSION },
            { name: 'Albion', session: CELTIC_SESSION },
        ]);

        const result = await page.evaluate(() => {
            const view = (window as any).view;
            const zeroFactoryProduct = view.presenter.categories
                .flatMap((c: any) => c.productPresenters)
                .find((p: any) => p.visibleFactories().length === 0);

            if (!zeroFactoryProduct)
                return null;

            return {
                name: zeroFactoryProduct.name(),
                factoryPresenterIfDefaultSupplier: zeroFactoryProduct.factoryPresenterIfDefaultSupplier(),
            };
        });

        expect(result, 'expected at least one product with zero visible factory types to exist as a fixture').not.toBeNull();
        expect(result!.factoryPresenterIfDefaultSupplier).toBeNull();
    });

    test('reactivity: adding a real island updates aggregate sums without manual invalidation', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
        ]);

        const before = await page.evaluate(({ residenceGuid, productGuid }) => {
            const view = (window as any).view;
            const islandA = view.islands().find((i: any) => i.name() === 'IslandA');
            islandA.assetsMap.get(residenceGuid).buildings.constructed(5);

            const presenter = view.presenter.productByGuid.get(productGuid);
            return {
                demandA: islandA.assetsMap.get(productGuid).totalDemandNoRoutes(),
                aggDemand: presenter.totalDemandNoRoutes(),
            };
        }, { residenceGuid: fixture.residenceGuid, productGuid: fixture.productGuid });

        expect(before.aggDemand).toBeCloseTo(before.demandA, 4);

        const after = await page.evaluate(({ residenceGuid, productGuid, romanSession }) => {
            const view = (window as any).view;

            // Stay on All Islands after creating the new island.
            view.islandManager.showIslandOnCreation.checked(false);
            const session = view.sessions.find((s: any) => s.guid === romanSession);
            view.islandManager.create('IslandC', session);

            const islandC = view.islands().find((i: any) => i.name() === 'IslandC');
            islandC.assetsMap.get(residenceGuid).buildings.constructed(3);

            const islandA = view.islands().find((i: any) => i.name() === 'IslandA');
            const presenter = view.presenter.productByGuid.get(productGuid);

            return {
                stillAllIslands: view.island().isAllIslands(),
                demandA: islandA.assetsMap.get(productGuid).totalDemandNoRoutes(),
                demandC: islandC.assetsMap.get(productGuid).totalDemandNoRoutes(),
                aggDemand: presenter.totalDemandNoRoutes(),
            };
        }, { residenceGuid: fixture.residenceGuid, productGuid: fixture.productGuid, romanSession: ROMAN_SESSION });

        expect(after.stillAllIslands).toBe(true);
        expect(after.demandC).toBeGreaterThan(0);
        expect(after.aggDemand).toBeCloseTo(after.demandA + after.demandC, 4);
        // The sum genuinely changed - proves reactivity, not a stale cached value.
        expect(after.aggDemand).toBeGreaterThan(before.aggDemand + 0.001);
    });

    test('no regression: setting off on All Islands behaves exactly as before this unit', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
        ], { aggregation: false, activeIsland: ALL_ISLANDS_NAME });

        const result = await page.evaluate(({ wine, latiumVineyard }) => {
            const view = (window as any).view;
            const allIslands = view.islands().find((i: any) => i.isAllIslands());

            const presenter = view.presenter.productByGuid.get(wine);
            const factoryPresenter = presenter.factoryPresenters.find((fp: any) => fp.factory.guid === latiumVineyard);
            const allIslandsFactory = allIslands.assetsMap.get(latiumVineyard);
            const allIslandsProduct = allIslands.assetsMap.get(wine);

            return {
                isCurrentIslandAllIslands: view.island().isAllIslands(),
                buildingsIsSameReference: factoryPresenter.buildings() === allIslandsFactory.buildings,
                totalDemandNoRoutesMatches: presenter.totalDemandNoRoutes() === allIslandsProduct.totalDemandNoRoutes(),
                totalProductionMatches: presenter.totalProduction() === (allIslandsProduct.totalDemand() + allIslandsProduct.excessProduction()),
                isDefaultSupplierMatches: factoryPresenter.isDefaultSupplier() === (allIslandsFactory.isDefaultSupplier() || false),
            };
        }, { wine: WINE, latiumVineyard: ROMAN_VINTNER });

        expect(result.isCurrentIslandAllIslands).toBe(true);
        expect(result.buildingsIsSameReference).toBe(true);
        expect(result.totalDemandNoRoutesMatches).toBe(true);
        expect(result.totalProductionMatches).toBe(true);
        expect(result.isDefaultSupplierMatches).toBe(true);
    });

    test('no regression: aggregation on but viewing a real island behaves exactly as before this unit', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'Latium', session: ROMAN_SESSION },
            { name: 'Albion', session: CELTIC_SESSION },
        ], { aggregation: true, activeIsland: 'Latium' });

        const result = await page.evaluate(({ wine, latiumVineyard }) => {
            const view = (window as any).view;
            const latium = view.islands().find((i: any) => i.name() === 'Latium');

            const latiumFactory = latium.assetsMap.get(latiumVineyard);
            latiumFactory.buildings.fullyUtilizeConstructed(true);
            latiumFactory.buildings.constructed(4);

            const presenter = view.presenter.productByGuid.get(wine);
            const factoryPresenter = presenter.factoryPresenters.find((fp: any) => fp.factory.guid === latiumVineyard);
            const latiumProduct = latium.assetsMap.get(wine);

            return {
                isCurrentIslandReal: !view.island().isAllIslands(),
                buildingsIsSameReference: factoryPresenter.buildings() === latiumFactory.buildings,
                constructedMatches: factoryPresenter.buildings().constructed() === 4,
                totalDemandNoRoutesMatches: presenter.totalDemandNoRoutes() === latiumProduct.totalDemandNoRoutes(),
                totalProductionMatches: presenter.totalProduction() === (latiumProduct.totalDemand() + latiumProduct.excessProduction()),
            };
        }, { wine: WINE, latiumVineyard: ROMAN_VINTNER });

        expect(result.isCurrentIslandReal).toBe(true);
        expect(result.buildingsIsSameReference).toBe(true);
        expect(result.constructedMatches).toBe(true);
        expect(result.totalDemandNoRoutesMatches).toBe(true);
        expect(result.totalProductionMatches).toBe(true);
    });

    test('weighted average productivity for aggregate view factory dialog', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ]);

        const result = await page.evaluate(({ residenceGuid, productGuid }) => {
            const view = (window as any).view;
            const islandA = view.islands().find((i: any) => i.name() === 'IslandA');
            const islandB = view.islands().find((i: any) => i.name() === 'IslandB');

            islandA.assetsMap.get(residenceGuid).buildings.constructed(10);
            islandB.assetsMap.get(residenceGuid).buildings.constructed(5);

            const productA = islandA.assetsMap.get(productGuid);
            const productB = islandB.assetsMap.get(productGuid);
            const factoryA = productA.factories[0];
            const factoryB = productB.factories[0];

            factoryA.buildings.fullyUtilizeConstructed(true);
            factoryA.buildings.constructed(6);
            factoryA.boost(1.5); // 150%

            factoryB.buildings.fullyUtilizeConstructed(true);
            factoryB.buildings.constructed(4);
            factoryB.boost(2.0); // 200%

            // On IslandA, utilized will be 6. On IslandB, utilized will be 4.
            // Weighted average: (1.5 * 6 + 2.0 * 4) / (6 + 4) = (9 + 8) / 10 = 1.70 (170%)

            const presenter = view.presenter.productByGuid.get(productGuid);
            const factoryPresenter = presenter.factoryPresenters.find((fp: any) => fp.factory.guid === factoryA.guid);

            const boostBeforeChange = factoryPresenter.boost();

            // Let's modify the demand or constructed/utilized to verify reactivity
            factoryA.buildings.constructed(8);
            // Now IslandA utilized is 8, IslandB utilized is 4.
            // Weighted average: (1.5 * 8 + 2.0 * 4) / (8 + 4) = (12 + 8) / 12 = 20 / 12 = 1.6667 (166.67%)
            const boostAfterChange = factoryPresenter.boost();

            // Test fallback when utilized is 0 but constructed > 0:
            // Set utilized to 0 by removing demand (residences = 0) and not fully utilizing
            islandA.assetsMap.get(residenceGuid).buildings.constructed(0);
            islandB.assetsMap.get(residenceGuid).buildings.constructed(0);
            factoryA.buildings.fullyUtilizeConstructed(false);
            factoryB.buildings.fullyUtilizeConstructed(false);
            // Now utilized is 0 on both, but constructed is 8 on A and 4 on B.
            // Fallback should weight by constructed: (1.5 * 8 + 2.0 * 4) / 12 = 1.6667
            const boostFallbackConstructed = factoryPresenter.boost();

            // Test fallback when both utilized and constructed are 0:
            factoryA.buildings.constructed(0);
            factoryB.buildings.constructed(0);
            // Fallback should use the boost of the first non-null factory instance, which is factoryA (1.5)
            const boostFallbackNone = factoryPresenter.boost();

            return {
                boostBeforeChange,
                boostAfterChange,
                boostFallbackConstructed,
                boostFallbackNone
            };
        }, { residenceGuid: fixture.residenceGuid, productGuid: fixture.productGuid });

        expect(result.boostBeforeChange).toBeCloseTo(1.70, 4);
        expect(result.boostAfterChange).toBeCloseTo(1.6667, 4);
        expect(result.boostFallbackConstructed).toBeCloseTo(1.6667, 4);
        expect(result.boostFallbackNone).toBeCloseTo(1.5, 4);
    });
});
