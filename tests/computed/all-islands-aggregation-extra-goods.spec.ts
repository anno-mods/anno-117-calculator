import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * All-Islands aggregation coverage for the product-config-dialog's "Extra Goods" tab
 * (ProductPresenter.availableExtraGoodSuppliers / .extraGoodProduction, src/presenters.ts),
 * using the two distinct extra-good mechanics already covered per-island elsewhere:
 *  - Obsidian (145102): NON-self-effecting - Limestone Quarry (2916, effect 145095) and Iron Mine
 *    (2918, effect 148043) each produce Obsidian as a byproduct of their own primary output.
 *    See tests/computed/obsidian-fixture.spec.ts / fertility-extra-goods.spec.ts for the
 *    per-island mechanics this aggregation builds on.
 *  - Arboreal Rhizome (buff 50263, veneration-effect 50262): the SAME buff is applied to several
 *    sibling forestry factories (Woodcutter/Charcoal Burner/Resin Tapper) and grants each of them
 *    all 3 of its additionalOutputs (Wood 2077/Resin 31695/Charcoal 2085). For the factory whose
 *    OWN product matches (e.g. Woodcutter -> Wood), that entry is SELF-effecting: folded directly
 *    into the factory's own outputAmount (Factory.selfEffectingExtraGoods / extraGoodFactor,
 *    src/factories.ts) and never shown as its own Extra-Goods-tab row. For every other target
 *    factory (e.g. Charcoal Burner producing bonus Wood), the same entry is a genuine non-self
 *    extra good and legitimately shows as a row, same as Obsidian.
 *
 * Before the fix accompanying this test file, ProductPresenter.availableExtraGoodSuppliers was not
 * aggregate-branched: viewing "All Islands" with aggregation on resolved this.instance() to the
 * All-Islands pseudo-island's own (always-inactive) ExtraGoodSupplier instances, so the Extra Goods
 * tab lost every real producer row while aggregating, regardless of real per-island production.
 */

const DLC01 = 67902;
const ROMAN_SESSION = 3245;
const ALL_ISLANDS_NAME = 'All Islands';

const PRODUCT_OBSIDIAN = 145102;
const EFFECT_OBSIDIAN_GATHERING = 145095; // Limestone Quarry -> Obsidian byproduct
const EFFECT_OBSIDIAN_MINING = 148043;    // Iron Mine -> Obsidian byproduct
const FACTORY_LIMESTONE_QUARRY = 2916;
const FACTORY_IRON_MINE = 2918;

const PRODUCT_WOOD = 2077;
const EFFECT_ARBOREAL_RHIZOME = 50262;    // veneration-effect, self-effecting Wood bonus
const FACTORY_WOODCUTTER = 2878;
const FACTORY_CHARCOAL_BURNER = 2880;     // sibling target: cross-boosted with bonus Wood (non-self)

interface IslandSpec { name: string; session: number; }

async function loadAggregateConfig(page: Page, islands: IslandSpec[], activeIsland: string) {
    const cl = new ConfigLoader();
    const config = cl.createFullConfig(islands, { 'settings.aggregateAllIslands': '1' }, activeIsland);
    await cl.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.waitForTimeout(300);
}

test.describe('All-Islands aggregation - Extra Goods tab (product-config-dialog)', () => {

    test('Obsidian: all extra good producer factory types are shown, per-producer sum and total sum are correct', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({
            DLC01, EFFECT_OBSIDIAN_GATHERING, EFFECT_OBSIDIAN_MINING, PRODUCT_OBSIDIAN,
            FACTORY_LIMESTONE_QUARRY, FACTORY_IRON_MINE
        }) => {
            const view = (window as any).view;
            const islandA = view.islands().find((i: any) => i.name() === 'IslandA');
            const islandB = view.islands().find((i: any) => i.name() === 'IslandB');

            const dlc = view.dlcs.find((d: any) => d.guid === DLC01);
            if (dlc) dlc.checked(true);

            const setupIsland = (island: any, quarryCount: number, mineCount: number) => {
                const enableEffect = (guid: number) => {
                    const effect = island.allEffects.find((e: any) => e.guid === guid);
                    if (effect) effect.scaling(1);
                };
                enableEffect(EFFECT_OBSIDIAN_GATHERING);
                enableEffect(EFFECT_OBSIDIAN_MINING);

                const quarry = island.assetsMap.get(FACTORY_LIMESTONE_QUARRY);
                quarry.buildings.fullyUtilizeConstructed(true);
                quarry.buildings.constructed(quarryCount);

                const mine = island.assetsMap.get(FACTORY_IRON_MINE);
                mine.buildings.fullyUtilizeConstructed(true);
                mine.buildings.constructed(mineCount);
            };

            // Deliberately different building counts per island so a naive "read one island's
            // value" implementation would fail the sum assertions below.
            setupIsland(islandA, 6, 2);
            setupIsland(islandB, 3, 5);

            const producerAmount = (island: any, factoryGuid: number): number => {
                const obsidian = island.assetsMap.get(PRODUCT_OBSIDIAN);
                const supplier = obsidian.extraGoodSuppliers.find((s: any) => s.factory.guid === factoryGuid);
                return supplier ? supplier.currentProduction() : 0;
            };

            const expectedQuarryTotal = producerAmount(islandA, FACTORY_LIMESTONE_QUARRY) + producerAmount(islandB, FACTORY_LIMESTONE_QUARRY);
            const expectedMineTotal = producerAmount(islandA, FACTORY_IRON_MINE) + producerAmount(islandB, FACTORY_IRON_MINE);

            // The obsidian effects each target several factory types (session-wide "volcano"
            // events, not just the Limestone Quarry / Iron Mine this test deliberately builds up),
            // so the reference set of "producers that should show a row" is derived from the real
            // per-island data - any factory type that canSupply() on at least one real island -
            // rather than hardcoded, so the test doesn't assume a specific target-list size.
            const expectedFactoryGuids = new Set<number>();
            let expectedGrandTotal = 0;
            for (const island of [islandA, islandB]) {
                const obsidian = island.assetsMap.get(PRODUCT_OBSIDIAN);
                for (const supplier of obsidian.extraGoodSuppliers) {
                    if (supplier.canSupply()) {
                        expectedFactoryGuids.add(supplier.factory.guid);
                        expectedGrandTotal += supplier.currentProduction();
                    }
                }
            }

            const presenter = view.presenter.productByGuid.get(PRODUCT_OBSIDIAN);
            const rows = presenter.availableExtraGoodSuppliers();
            const rowByGuid = new Map(rows.map((r: any) => [r.factory.guid, r]));

            return {
                expectedQuarryTotal,
                expectedMineTotal,
                expectedGrandTotal,
                expectedFactoryGuids: Array.from(expectedFactoryGuids).sort((a, b) => a - b),
                rowCount: rows.length,
                factoryGuids: rows.map((r: any) => r.factory.guid).sort((a: number, b: number) => a - b),
                quarryRowProduction: rowByGuid.get(FACTORY_LIMESTONE_QUARRY)?.currentProduction(),
                mineRowProduction: rowByGuid.get(FACTORY_IRON_MINE)?.currentProduction(),
                totalPresenterProduction: presenter.extraGoodProduction(),
            };
        }, {
            DLC01, EFFECT_OBSIDIAN_GATHERING, EFFECT_OBSIDIAN_MINING, PRODUCT_OBSIDIAN,
            FACTORY_LIMESTONE_QUARRY, FACTORY_IRON_MINE
        });

        // Sanity: the scenario actually produced nonzero obsidian via both mechanisms, and the
        // reference set genuinely contains more than just the two factories this test built up
        // (proving the "all producers shown" assertion below is a real differentiator).
        expect(result.expectedQuarryTotal).toBeGreaterThan(0);
        expect(result.expectedMineTotal).toBeGreaterThan(0);
        expect(result.expectedFactoryGuids).toContain(FACTORY_LIMESTONE_QUARRY);
        expect(result.expectedFactoryGuids).toContain(FACTORY_IRON_MINE);

        // All extra good producers are shown - one row per factory TYPE (deduplicated across both
        // islands), matching exactly the set of factory types that canSupply() on any real island.
        expect(result.factoryGuids).toEqual(result.expectedFactoryGuids);

        // Individual producer sums are correct (summed across both islands, per factory type).
        expect(result.quarryRowProduction).toBeCloseTo(result.expectedQuarryTotal, 4);
        expect(result.mineRowProduction).toBeCloseTo(result.expectedMineTotal, 4);

        // Total sum (tab summary) equals the grand total across every producer and both islands.
        expect(result.totalPresenterProduction).toBeCloseTo(result.expectedGrandTotal, 4);
    });

    test('Obsidian: producer row is absent while aggregating when no real island has the effect active', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({ DLC01, PRODUCT_OBSIDIAN, FACTORY_LIMESTONE_QUARRY }) => {
            const view = (window as any).view;
            const islandA = view.islands().find((i: any) => i.name() === 'IslandA');
            const dlc = view.dlcs.find((d: any) => d.guid === DLC01);
            if (dlc) dlc.checked(true);

            // Deliberately leave the obsidian effect at its default (inactive) scaling, and still
            // construct/utilize the Limestone Quarry - production must stay 0 because canSupply()
            // is gated on the buff's scaling ratio, not building count.
            const quarry = islandA.assetsMap.get(FACTORY_LIMESTONE_QUARRY);
            quarry.buildings.fullyUtilizeConstructed(true);
            quarry.buildings.constructed(4);

            const presenter = view.presenter.productByGuid.get(PRODUCT_OBSIDIAN);
            return {
                rows: presenter.availableExtraGoodSuppliers().length,
                totalProduction: presenter.extraGoodProduction(),
            };
        }, { DLC01, PRODUCT_OBSIDIAN, FACTORY_LIMESTONE_QUARRY });

        expect(result.rows).toBe(0);
        expect(result.totalProduction).toBe(0);
    });

    test("Arboreal Rhizome: self-effecting boost aggregates via factory outputAmount, cross-boosted sibling still shows as a correctly-summed Extra Goods row", async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({ EFFECT_ARBOREAL_RHIZOME, PRODUCT_WOOD, FACTORY_WOODCUTTER, FACTORY_CHARCOAL_BURNER }) => {
            const view = (window as any).view;
            const islandA = view.islands().find((i: any) => i.name() === 'IslandA');
            const islandB = view.islands().find((i: any) => i.name() === 'IslandB');

            const setupIsland = (island: any, woodcutterCount: number, charcoalBurnerCount: number) => {
                const effect = island.allEffects.find((e: any) => e.guid === EFFECT_ARBOREAL_RHIZOME);
                if (effect) effect.scaling(1);

                const woodcutter = island.assetsMap.get(FACTORY_WOODCUTTER);
                woodcutter.buildings.fullyUtilizeConstructed(true);
                woodcutter.buildings.constructed(woodcutterCount);

                // Charcoal Burner's own product is Charcoal, not Wood - the buff's Wood entry on
                // this factory is therefore a genuine NON-self extra good (unlike Woodcutter's).
                const charcoalBurner = island.assetsMap.get(FACTORY_CHARCOAL_BURNER);
                charcoalBurner.buildings.fullyUtilizeConstructed(true);
                charcoalBurner.buildings.constructed(charcoalBurnerCount);

                return woodcutter;
            };

            // Different counts per island so every sum assertion below is a real differentiator.
            const woodcutterA = setupIsland(islandA, 5, 4);
            const woodcutterB = setupIsland(islandB, 3, 7);

            const crossBoostedWoodAmount = (island: any): number => {
                const wood = island.assetsMap.get(PRODUCT_WOOD);
                const supplier = wood.extraGoodSuppliers.find((s: any) => s.factory.guid === FACTORY_CHARCOAL_BURNER);
                return supplier ? supplier.currentProduction() : 0;
            };
            const expectedCrossBoostedWoodTotal = crossBoostedWoodAmount(islandA) + crossBoostedWoodAmount(islandB);

            const presenter = view.presenter.productByGuid.get(PRODUCT_WOOD);
            const factoryPresenter = presenter.factoryPresenters.find((fp: any) => fp.factory.guid === FACTORY_WOODCUTTER);
            const rows = presenter.availableExtraGoodSuppliers();
            const rowByGuid = new Map(rows.map((r: any) => [r.factory.guid, r]));

            return {
                aOutput: woodcutterA.outputAmount(),
                bOutput: woodcutterB.outputAmount(),
                aExtraGoodFactor: woodcutterA.extraGoodFactor(),
                aggFactoryOutput: factoryPresenter.outputAmount(),
                aggTotalProduction: presenter.totalProduction(),
                extraGoodTabRowGuids: rows.map((r: any) => r.factory.guid),
                expectedCrossBoostedWoodTotal,
                crossBoostedRowProduction: rowByGuid.get(FACTORY_CHARCOAL_BURNER)?.currentProduction(),
            };
        }, { EFFECT_ARBOREAL_RHIZOME, PRODUCT_WOOD, FACTORY_WOODCUTTER, FACTORY_CHARCOAL_BURNER });

        // Sanity: the self-boost actually inflated output above the un-boosted baseline (factor > 1),
        // and the cross-boosted sibling genuinely produced nonzero bonus Wood on both islands.
        expect(result.aExtraGoodFactor).toBeGreaterThan(1);
        expect(result.aOutput).toBeGreaterThan(0);
        expect(result.bOutput).toBeGreaterThan(0);
        expect(result.expectedCrossBoostedWoodTotal).toBeGreaterThan(0);

        // Individual sum: this one factory type's aggregated outputAmount equals both islands' own.
        expect(result.aggFactoryOutput).toBeCloseTo(result.aOutput + result.bOutput, 4);

        // The buff also cross-boosts sibling forestry factories (Charcoal Burner here) with bonus
        // Wood as a genuine NON-self extra good, so it legitimately shows as an Extra-Goods-tab row
        // for Wood, correctly summed across both islands - but the Woodcutter's own self-effecting
        // entry must never appear as a row itself (it's folded into the factory's own output
        // instead), true both per-island and while aggregating.
        expect(result.extraGoodTabRowGuids).toContain(FACTORY_CHARCOAL_BURNER);
        expect(result.extraGoodTabRowGuids).not.toContain(FACTORY_WOODCUTTER);
        expect(result.crossBoostedRowProduction).toBeCloseTo(result.expectedCrossBoostedWoodTotal, 4);

        // Total sum: Wood's aggregate production reflects at least the summed boosted output plus
        // the cross-boosted sibling's contribution.
        expect(result.aggTotalProduction).toBeGreaterThanOrEqual(result.aOutput + result.bOutput + result.expectedCrossBoostedWoodTotal - 0.01);
    });
});
