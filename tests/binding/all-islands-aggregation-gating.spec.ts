import { test, expect, Page, Browser } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * U3: read-only gating (KTD4) for the All-Islands aggregation feature. Covers AE3 (mutating
 * controls structurally absent on aggregate rows, read-only replacements shown), AE7
 * (contributing-factory tooltip on the compact tile), AE10 (product-config-dialog for a
 * multi-factory-type product resolves exactly one active, non-blank tab), and no-regression
 * (identical rendering off-aggregate / on a real island).
 *
 * Note: the R16 persistent aggregation-active indicator (navbar badge) was removed post-launch
 * per user feedback - the tile grid's read-only gating already communicates aggregate mode
 * clearly enough without a separate badge.
 *
 * Fixtures reuse the U2 test file's discovered constants (tests/computed/
 * all-islands-aggregation-products.spec.ts): Wine (2138) is produced by two region-specific
 * factory types - Roman Vintner (3177) and Celtic Vintner (23753) - making it the ready-made
 * multi-factory-type fixture needed for AE10 and the AE7 tooltip.
 *
 * Controls that only render conditionally on factory data (module checkboxes, aqueduct-buff
 * checkbox, fertility checkbox, item tri-state toggles) are located at runtime via a small
 * scan over throwaway single-region islands, rather than hardcoding GUIDs that could silently
 * drift with params.js content changes.
 */

const ROMAN_SESSION = 3245;
const CELTIC_SESSION = 6627;
const ALL_ISLANDS_NAME = 'All Islands';

const WINE = 2138;
const ROMAN_VINTNER = 3177;
const CELTIC_VINTNER = 23753;

interface IslandSpec { name: string; session: number; }

async function loadAggregateConfig(page: Page, islands: IslandSpec[], opts: {
    activeIsland?: string;
    aggregation?: boolean;
} = {}) {
    const cl = new ConfigLoader();
    // Force every available product's tile to render regardless of demand/production, so tile
    // presence in these tests reflects gating logic, not ProductPresenter.visible()'s unrelated
    // (non-aggregate-branched) demand/production heuristics.
    const settings: Record<string, string> = { 'settings.showAllProducts': '1' };
    if (opts.aggregation !== false)
        settings['settings.aggregateAllIslands'] = '1';

    const config = cl.createFullConfig(islands, settings, opts.activeIsland ?? ALL_ISLANDS_NAME);
    await cl.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.waitForTimeout(300);
}

/** Opens product-config-dialog for the given product guid via the internal API (avoids
 *  depending on tile layout/visibility to locate the right config button). */
async function openProductDialog(page: Page, productGuid: number) {
    await page.evaluate((guid) => {
        const view = (window as any).view;
        const presenter = view.presenter.productByGuid.get(guid);
        view.selectedProduct(presenter);
        ($('#product-config-dialog') as any).modal('show');
    }, productGuid);
    await page.waitForSelector('#product-config-dialog.show', { state: 'visible', timeout: 5000 });
    await page.waitForTimeout(300);
}

async function closeProductDialog(page: Page) {
    await page.evaluate(() => ($('#product-config-dialog') as any).modal('hide'));
    await page.waitForTimeout(300);
}

/** Locates the .product-tile whose name text matches the given product's localized presenter
 *  name (tiles carry no guid attribute of their own). */
function productTileByGuid(page: Page, productGuid: number) {
    return page.evaluate((guid) => {
        const view = (window as any).view;
        return view.presenter.productByGuid.get(guid).name();
    }, productGuid).then((name) =>
        page.locator('.product-tile').filter({ has: page.locator('.product-tile-name', { hasText: name }) }).first()
    );
}

interface FeatureFixture { productGuid: number; factoryGuid: number; }

type FeatureName = 'module' | 'aqueduct' | 'fertility' | 'item';

/** Scans throwaway single-island scouts (one per region) for the first factory exhibiting
 *  `feature`, evaluated in-page (a function value can't cross the page.evaluate boundary, so
 *  the check is inlined per feature name instead of passed as a callback). */
async function discoverFactoryFixture(browser: Browser, feature: FeatureName): Promise<FeatureFixture | null> {
    const page = await browser.newPage();
    try {
        for (const session of [ROMAN_SESSION, CELTIC_SESSION]) {
            await loadAggregateConfig(page, [{ name: 'Scout', session }], { aggregation: false, activeIsland: 'Scout' });
            const found = await page.evaluate((featureName) => {
                const island = (window as any).view.island();
                for (const factory of island.factories) {
                    if (!factory.product) continue;
                    let matches = false;
                    switch (featureName) {
                        case 'module':
                            matches = factory.modules && factory.modules.filter((m: any) => m.visible()).length > 0;
                            break;
                        case 'aqueduct':
                            matches = !!factory.aqueductBuff;
                            break;
                        case 'fertility':
                            matches = !!factory.neededFertility;
                            break;
                        case 'item':
                            matches = factory.availableItems && factory.availableItems().length > 0;
                            break;
                    }
                    if (matches)
                        return { productGuid: factory.product.guid, factoryGuid: factory.guid };
                }
                return null;
            }, feature);
            if (found) return found;
        }
        return null;
    } finally {
        await page.close();
    }
}

/** Sets constructed buildings (fully utilized) for `factoryGuid` on every real island. */
async function stockAllRealIslands(page: Page, factoryGuid: number, count: number) {
    await page.evaluate(({ factoryGuid, count }) => {
        const view = (window as any).view;
        for (const island of view.islands()) {
            if (island.isAllIslands()) continue;
            const f = island.assetsMap.get(factoryGuid);
            if (f) { f.buildings.fullyUtilizeConstructed(true); f.buildings.constructed(count); }
        }
    }, { factoryGuid, count });
}

test.describe('All-Islands aggregation - read-only gating & indicator (U3)', () => {
    let moduleFixture: FeatureFixture | null;
    let aqueductFixture: FeatureFixture | null;
    let fertilityFixture: FeatureFixture | null;
    let itemFixture: FeatureFixture | null;

    test.beforeAll(async ({ browser }) => {
        [moduleFixture, aqueductFixture, fertilityFixture, itemFixture] = await Promise.all([
            discoverFactoryFixture(browser, 'module'),
            discoverFactoryFixture(browser, 'aqueduct'),
            discoverFactoryFixture(browser, 'fertility'),
            discoverFactoryFixture(browser, 'item'),
        ]);
    });

    test('AE3: product-tile construction +/- buttons structurally absent when aggregating, read-only count remains, restored off-aggregate', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'Latium', session: ROMAN_SESSION },
            { name: 'Albion', session: CELTIC_SESSION },
        ]);
        await stockAllRealIslands(page, ROMAN_VINTNER, 3);
        await stockAllRealIslands(page, CELTIC_VINTNER, 2);
        await page.waitForTimeout(200);

        const wineTile = await productTileByGuid(page, WINE);
        await expect(wineTile).toBeVisible();
        await expect(wineTile.locator('.product-tile-count .btn-group')).toHaveCount(0);

        const countSpan = wineTile.locator('.product-tile-count span').first();
        await expect(countSpan).toBeVisible();
        expect(Number(await countSpan.textContent())).toBeCloseTo(5, 4);

        // No regression: toggling aggregation off restores the +/- controls immediately.
        await page.evaluate(() => (window as any).view.settings.aggregateAllIslands.checked(false));
        await page.waitForTimeout(200);
        await expect(wineTile.locator('.product-tile-count .btn-group')).toHaveCount(1);
    });

    test('AE3: product-config-dialog gates supplier-selection, constructed-buildings-input, default-supplier buttons, fully-utilize checkbox, and trade-routes-tab content', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'Latium', session: ROMAN_SESSION },
            { name: 'Albion', session: CELTIC_SESSION },
        ]);
        await stockAllRealIslands(page, ROMAN_VINTNER, 3);
        await stockAllRealIslands(page, CELTIC_VINTNER, 2);
        await page.waitForTimeout(200);

        await openProductDialog(page, WINE);

        // Supplier selection section is entirely gated - none of its content is meaningful in
        // aggregate mode (defaultSupplier() is not aggregate-branched).
        await expect(page.locator('#product-config-dialog .modal-body > .grouping-box')).toHaveCount(0);

        // Per-factory-tab mutating controls. The constructed-buildings-input COMPONENT is still
        // mounted (it now decides its own rendering from buildings().readOnly - Layer 2), but its
        // editable spinner must not be: no number input, no +/- increment buttons.
        await expect(page.locator('#product-config-dialog input[id$="-constructed-buildings-input"]')).toHaveCount(0);
        await expect(page.locator('#product-config-dialog btn-default-supplier')).toHaveCount(0);
        await expect(page.locator('#product-config-dialog [data-bind*="fullyUtilizeConstructed"]')).toHaveCount(0);

        // Trade-routes tab content (island selector, import/export forms, routes table) is emptied,
        // but the tab-pane wrapper itself is left intact for Bootstrap's tab CSS.
        await expect(page.locator('#trade-routes-tab table')).toHaveCount(0);
        await expect(page.locator('#trade-routes-tab select#trade-islands')).toHaveCount(0);
        await expect(page.locator('#trade-routes-tab')).toHaveCount(1);

        // Read-only replacement for the buildings count remains visible. Per KTD7 the active tab
        // is the first factory type in visibleFactories() order (Roman Vintner), and this per-tab
        // read-only value is FactoryPresenter.buildings() - summed across real islands for THAT ONE
        // factory type only (Roman Vintner exists only on Latium, not Albion) - distinct from the
        // product-tile's compact count, which sums across ALL factory types (KTD6). So the expected
        // value here is Latium's own count (3), not the cross-type total (5) asserted elsewhere.
        const activeTab = page.locator('#product-config-dialog .tab-pane.show.active[id^="factories-tab-"]');
        const buildingsSpan = activeTab.locator('.factory-config-section table span').first();
        await expect(buildingsSpan).toBeVisible();
        expect(Number(await buildingsSpan.textContent())).toBeCloseTo(3, 4);

        // Verify the factory tab link does not display "0 t/min" in aggregate mode
        const tabButton = page.locator('#product-config-dialog button.nav-link.active');
        await expect(tabButton).toBeVisible();
        const tabText = await tabButton.innerText();
        expect(tabText).not.toContain('0.00 t/min');
        expect(tabText).not.toContain('0 t/min');

        await closeProductDialog(page);

        // No regression: same dialog on a real island (aggregation setting still on) renders
        // every one of these controls exactly as before.
        await page.evaluate(() => {
            const view = (window as any).view;
            view.island(view.islands().find((i: any) => i.name() === 'Latium'));
        });
        await page.waitForTimeout(200);
        await openProductDialog(page, WINE);

        await expect(page.locator('#product-config-dialog .modal-body > .grouping-box')).toHaveCount(1);
        expect(await page.locator('#product-config-dialog input[id$="-constructed-buildings-input"]').count()).toBeGreaterThan(0);
        await expect(page.locator('#product-config-dialog [id$="-constructed-buildings-readonly"]')).toHaveCount(0);
        expect(await page.locator('#product-config-dialog btn-default-supplier').count()).toBeGreaterThan(0);
        expect(await page.locator('#product-config-dialog [data-bind*="fullyUtilizeConstructed"]').count()).toBeGreaterThan(0);
    });

    test('AE3: module / aqueduct / fertility / item toggle controls are structurally absent when aggregating, present off-aggregate', async ({ page }) => {
        const cases: [string, FeatureFixture | null, string][] = [
            ['module checkbox', moduleFixture, '.factory-config-section .inline-list.float-right'],
            ['aqueduct-buff checkbox', aqueductFixture, '.factory-config-section .inline-list.float-right'],
            ['fertility checkbox', fertilityFixture, '.factory-config-section input[id^="fert-config-"]'],
            ['item tri-state toggle', itemFixture, '.factory-config-section tri-state-toggle'],
        ];

        test.skip(cases.every(([, fixture]) => !fixture), 'No factories with these features were found in the current params.js');

        for (const [label, fixture, selector] of cases) {
            if (!fixture) continue;

            await loadAggregateConfig(page, [
                { name: 'Latium', session: ROMAN_SESSION },
                { name: 'Albion', session: CELTIC_SESSION },
            ]);
            await stockAllRealIslands(page, fixture.factoryGuid, 2);
            await page.waitForTimeout(200);

            await openProductDialog(page, fixture.productGuid);
            expect(await page.locator(selector).count(), `${label} should be structurally absent while aggregating`).toBe(0);
            await closeProductDialog(page);

            // No regression: same fixture, aggregation off, control renders exactly as before.
            await loadAggregateConfig(page, [
                { name: 'Latium', session: ROMAN_SESSION },
            ], { aggregation: false, activeIsland: 'Latium' });
            await page.evaluate((factoryGuid) => {
                const view = (window as any).view;
                const f = view.island().assetsMap.get(factoryGuid);
                if (f) { f.buildings.fullyUtilizeConstructed(true); f.buildings.constructed(2); }
            }, fixture.factoryGuid);
            await page.waitForTimeout(200);

            await openProductDialog(page, fixture.productGuid);
            expect(await page.locator(selector).count(), `${label} should render normally off-aggregate`).toBeGreaterThan(0);
            await closeProductDialog(page);
        }
    });

    test('AE7: product-tile tooltip names contributing factory types when aggregating a multi-producer product', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'Latium', session: ROMAN_SESSION },
            { name: 'Albion', session: CELTIC_SESSION },
        ]);

        const expectedTooltip = await page.evaluate((wine) => {
            const view = (window as any).view;
            const presenter = view.presenter.productByGuid.get(wine);
            return presenter.factoryPresenterIfDefaultSupplier().contributingFactoryNames();
        }, WINE);
        expect(expectedTooltip.length).toBeGreaterThan(0);

        const wineTile = await productTileByGuid(page, WINE);
        const tooltipTitle = await wineTile.locator('.product-tile-count [data-toggle="tooltip"]').getAttribute('title');
        expect(tooltipTitle).toBe(expectedTooltip);
    });

    test('AE10: product-config-dialog for a multi-factory-type product (Wine) shows exactly one active, non-blank tab in aggregate mode', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'Latium', session: ROMAN_SESSION },
            { name: 'Albion', session: CELTIC_SESSION },
        ]);
        await stockAllRealIslands(page, ROMAN_VINTNER, 4);
        await stockAllRealIslands(page, CELTIC_VINTNER, 3);
        await page.waitForTimeout(200);

        await openProductDialog(page, WINE);

        const activeFactoryTabs = page.locator('#product-config-dialog .tab-pane.show.active[id^="factories-tab-"]');
        await expect(activeFactoryTabs).toHaveCount(1);

        // The single active tab must have real, visible, non-blank content (not a blank pane).
        const text = await activeFactoryTabs.innerText();
        expect(text.trim().length).toBeGreaterThan(0);
        await expect(activeFactoryTabs.locator('.factory-config-section')).toBeVisible();
    });

    // -----------------------------------------------------------------------
    // U6/U7: factory-config-section's Required Workforce row and Items Equipped
    // section, and ProductPresenter.isHighlightedAsMissing - regression bugs found
    // after U3/U5 landed (factory-config-section.html read workforceDemand.amount()
    // and availableItems().length directly off the All-Islands pseudo-island's own,
    // always-empty Factory instance instead of an aggregate-branched value).
    // -----------------------------------------------------------------------

    test('U6: Required Workforce sums workforceDemand.amount() across real islands in aggregate mode', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'Latium', session: ROMAN_SESSION },
            { name: 'Latium2', session: ROMAN_SESSION },
        ]);
        await page.evaluate((romanVintner) => {
            const view = (window as any).view;
            const islands = view.islands().filter((i: any) => !i.isAllIslands());
            const counts = [2, 3];
            islands.forEach((island: any, idx: number) => {
                const f = island.assetsMap.get(romanVintner);
                f.buildings.fullyUtilizeConstructed(true);
                f.buildings.constructed(counts[idx]);
            });
        }, ROMAN_VINTNER);
        await page.waitForTimeout(200);

        const expected = await page.evaluate((romanVintner) => {
            const view = (window as any).view;
            const realIslands = view.islands().filter((i: any) => !i.isAllIslands());
            const sum = realIslands.reduce((acc: number, i: any) => acc + i.assetsMap.get(romanVintner).workforceDemand.amount(), 0);
            return { sum, formatted: (window as any).formatNumber(sum) };
        }, ROMAN_VINTNER);
        expect(expected.sum).toBeGreaterThan(0);

        await openProductDialog(page, WINE);

        // Wine has two factory types (Roman Vintner, Celtic Vintner); both render a "Workforce
        // Demand" row (one per tab-pane), so scope to the single active tab (KTD7 - Roman
        // Vintner, the only real factory type stocked in this fixture).
        const activeTab = page.locator('#product-config-dialog .tab-pane.show.active[id^="factories-tab-"]');
        const workforceRow = activeTab.locator('tr[data-bind*="Workforce Demand"]');
        await expect(workforceRow).toBeVisible();
        await expect(workforceRow.locator('span').last()).toHaveText(expected.formatted);

        await closeProductDialog(page);

        // No regression: same fixture, aggregation off, shows only the current (single) island's
        // own workforceDemand.amount(), not the cross-island sum.
        await page.evaluate(() => (window as any).view.settings.aggregateAllIslands.checked(false));
        await page.evaluate(() => {
            const view = (window as any).view;
            view.island(view.islands().find((i: any) => i.name() === 'Latium'));
        });
        await page.waitForTimeout(200);

        const expectedLatiumOnly = await page.evaluate((romanVintner) => {
            const view = (window as any).view;
            const f = view.island().assetsMap.get(romanVintner);
            return (window as any).formatNumber(f.workforceDemand.amount());
        }, ROMAN_VINTNER);

        await openProductDialog(page, WINE);
        const activeTabOffAggregate = page.locator('#product-config-dialog .tab-pane.show.active[id^="factories-tab-"]');
        await expect(activeTabOffAggregate.locator('tr[data-bind*="Workforce Demand"] span').last()).toHaveText(expectedLatiumOnly);
    });

    test('U6: Items Equipped section is structurally absent while aggregating, present off-aggregate', async ({ page }) => {
        test.skip(!itemFixture, 'No factory with items was found in the current params.js');
        if (!itemFixture) return;

        await loadAggregateConfig(page, [
            { name: 'Latium', session: ROMAN_SESSION },
            { name: 'Albion', session: CELTIC_SESSION },
        ]);
        await stockAllRealIslands(page, itemFixture.factoryGuid, 2);
        await page.waitForTimeout(200);

        await openProductDialog(page, itemFixture.productGuid);
        expect(await page.locator('#product-config-dialog .factory-config-section').getByText(/Items Equipped/i).count()).toBe(0);
        expect(await page.locator('#product-config-dialog .factory-config-section tri-state-toggle').count()).toBe(0);
        await closeProductDialog(page);

        // No regression: off-aggregate, the section renders normally with its item rows. Pick
        // whichever real island actually carries this factory type (itemFixture may be a
        // Roman- or Celtic-only factory - see discoverFactoryFixture).
        await page.evaluate(() => (window as any).view.settings.aggregateAllIslands.checked(false));
        await page.evaluate((factoryGuid) => {
            const view = (window as any).view;
            const owner = view.islands().find((i: any) => !i.isAllIslands() && i.assetsMap.get(factoryGuid));
            view.island(owner);
        }, itemFixture.factoryGuid);
        await page.waitForTimeout(200);

        await openProductDialog(page, itemFixture.productGuid);
        expect(await page.locator('#product-config-dialog .factory-config-section').getByText(/Items Equipped/i).count()).toBeGreaterThan(0);
    });

    test('U7: ProductPresenter.isHighlightedAsMissing reflects aggregate required/constructed shortfall summed across real islands', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'Latium', session: ROMAN_SESSION },
            { name: 'Latium2', session: ROMAN_SESSION },
        ]);
        await page.evaluate(() => (window as any).view.settings.missingBuildingsHighlight.checked(true));

        // Each real island alone looks fine (constructed >= required), but the aggregate total
        // required (12) exceeds the aggregate total constructed (7) - only visible once summed.
        await page.evaluate((romanVintner) => {
            const view = (window as any).view;
            const islands = view.islands().filter((i: any) => !i.isAllIslands());
            const perIsland = [{ constructed: 4, required: 5 }, { constructed: 3, required: 7 }];
            islands.forEach((island: any, idx: number) => {
                const f = island.assetsMap.get(romanVintner);
                f.buildings.constructed(perIsland[idx].constructed);
                f.buildings.required(perIsland[idx].required);
            });
        }, ROMAN_VINTNER);
        await page.waitForTimeout(200);

        const missingWhileShort = await page.evaluate((wine) => (window as any).view.presenter.productByGuid.get(wine).isHighlightedAsMissing(), WINE);
        expect(missingWhileShort).toBe(true);

        const wineTile = await productTileByGuid(page, WINE);
        await expect(wineTile).toHaveClass(/danger/);

        // Bringing aggregate constructed (>= required) resolves the shortfall.
        await page.evaluate((romanVintner) => {
            const view = (window as any).view;
            const islands = view.islands().filter((i: any) => !i.isAllIslands());
            islands.forEach((island: any) => {
                const f = island.assetsMap.get(romanVintner);
                f.buildings.constructed(10);
            });
        }, ROMAN_VINTNER);
        await page.waitForTimeout(200);

        const missingWhileSufficient = await page.evaluate((wine) => (window as any).view.presenter.productByGuid.get(wine).isHighlightedAsMissing(), WINE);
        expect(missingWhileSufficient).toBe(false);
        await expect(wineTile).not.toHaveClass(/danger/);
    });

    test('U8: factoryPresenterIfDefaultSupplier() stays null in aggregate mode when no real island produces the product locally (null-parity with non-aggregate)', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'Latium', session: ROMAN_SESSION },
            { name: 'Latium2', session: ROMAN_SESSION },
        ]);

        // Every real island imports Wine (passive trade) instead of producing it locally - the
        // non-aggregate branch already returns null here (no visible factory isDefaultSupplier()),
        // and the aggregate branch must match, or product-tile.html's `with:`-bound count row starts
        // rendering a "0/0" row that .product-tile-attribute-group's fixed height wasn't budgeted
        // for (see AGENTS.md - this was the cause of the t/min misalignment/clipping bug).
        await page.evaluate((wine) => {
            const view = (window as any).view;
            for (const island of view.islands()) {
                if (island.isAllIslands()) continue;
                const product = island.assetsMap.get(wine);
                product.passiveTradeSupplier.setAsDefaultSupplier();
            }
        }, WINE);
        await page.waitForTimeout(200);

        const aggregateResult = await page.evaluate((wine) =>
            (window as any).view.presenter.productByGuid.get(wine).factoryPresenterIfDefaultSupplier() === null, WINE);
        expect(aggregateResult).toBe(true);

        const wineTile = await productTileByGuid(page, WINE);
        await expect(wineTile).toBeVisible();
        await expect(wineTile.locator('.product-tile-count')).toBeEmpty();

        // No regression: same import-only state off-aggregate already resolves to null (this is
        // the reference behavior the aggregate branch must match).
        await page.evaluate(() => (window as any).view.settings.aggregateAllIslands.checked(false));
        await page.evaluate(() => {
            const view = (window as any).view;
            view.island(view.islands().find((i: any) => i.name() === 'Latium'));
        });
        await page.waitForTimeout(200);
        const nonAggregateResult = await page.evaluate((wine) =>
            (window as any).view.presenter.productByGuid.get(wine).factoryPresenterIfDefaultSupplier() === null, WINE);
        expect(nonAggregateResult).toBe(true);
    });

    test('U9: Product dialog consumption amount is correct after switching from All Islands to a regular island', async ({ page }) => {
        const LIBERTI_RESIDENCE_GUID = 3087;
        const LIBERTI_POPULATION_LEVEL_GUID = 1499;
        const cl = new ConfigLoader();
        const config = cl.createFullConfig(
            [
                {
                    name: 'Latium', session: ROMAN_SESSION, data: {
                        [`${LIBERTI_RESIDENCE_GUID}.buildings.constructed`]: '2',
                    }
                },
                {
                    name: 'Albion', session: CELTIC_SESSION, data: {
                        [`${LIBERTI_RESIDENCE_GUID}.buildings.constructed`]: '3',
                    }
                },
            ],
            { 'settings.aggregateAllIslands': '1' },
            'All Islands'
        );
        await cl.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.waitForTimeout(300);

        // Find an active product guid consumed by Liberti
        const productGuid = await page.evaluate((libertiLevelGuid) => {
            const view = (window as any).view;
            const island = view.islands().find((i: any) => i.name() === 'Latium');
            const level = island.assetsMap.get(libertiLevelGuid);
            for (const rn of level.needsMap.values()) {
                if (rn.need.product) return rn.need.product.guid;
            }
            return null;
        }, LIBERTI_POPULATION_LEVEL_GUID);

        expect(productGuid).not.toBeNull();

        // Let's open the product config dialog on All Islands for this product
        await openProductDialog(page, productGuid!);

        // Switch the island to Latium while the dialog is open
        await page.evaluate(() => {
            const view = (window as any).view;
            const latium = view.islands().find((i: any) => i.name() === 'Latium');
            view.island(latium);
        });
        await page.waitForTimeout(300);

        // Read the consumption summary value in the dialog
        const summaryText = await page.locator('legend[data-target="#product-config-consumption"] .summary span.float-right span').first().innerText();
        const summaryVal = parseFloat(summaryText.replace(/[^0-9.]/g, ''));

        // Let's also read Latium's actual demand for this product
        const expectedLatiumDemand = await page.evaluate(({ productGuid }) => {
            const view = (window as any).view;
            const island = view.islands().find((i: any) => i.name() === 'Latium');
            return island.assetsMap.get(productGuid).totalDemandNoRoutes();
        }, { productGuid });

        expect(summaryVal).toBeCloseTo(expectedLatiumDemand, 2);
    });

    test('U10: Obsidian extra goods collapsible and producers are visible in aggregate mode', async ({ page }) => {
        const PRODUCT_OBSIDIAN = 145102;
        const EFFECT_OBSIDIAN_GATHERING = 145095;
        const FACTORY_LIMESTONE_QUARRY = 2916;
        const DLC01 = 67902;

        const cl = new ConfigLoader();
        const config = cl.createFullConfig(
            [
                {
                    name: 'Latium', session: ROMAN_SESSION, data: {
                        [`${FACTORY_LIMESTONE_QUARRY}.buildings.constructed`]: '2',
                        [`${FACTORY_LIMESTONE_QUARRY}.buildings.fullyUtilizeConstructed`]: true,
                    }
                }
            ],
            { 'settings.aggregateAllIslands': '1' },
            'All Islands'
        );
        await cl.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.waitForTimeout(300);

        // Enable effect and DLC on Latium
        await page.evaluate(({ EFFECT_OBSIDIAN_GATHERING, DLC01 }) => {
            const view = (window as any).view;
            const latium = view.islands().find((i: any) => i.name() === 'Latium');
            const dlc = view.dlcs.find((d: any) => d.guid === DLC01);
            if (dlc) dlc.checked(true);
            const effect = latium.allEffects.find((e: any) => e.guid === EFFECT_OBSIDIAN_GATHERING);
            if (effect) effect.scaling(1);
        }, { EFFECT_OBSIDIAN_GATHERING, DLC01 });
        await page.waitForTimeout(300);

        // Open Obsidian product dialog
        await openProductDialog(page, PRODUCT_OBSIDIAN);

        // Verify Extra Goods section is visible
        const extraGoodsSection = page.locator('#product-config-extraGoods');
        await expect(extraGoodsSection).toBeVisible();

        // Verify Limestone Quarry row is visible inside the table
        const limestoneRow = extraGoodsSection.locator('tr:has-text("Limestone Quarry")');
        await expect(limestoneRow).toBeVisible();
    });

    test('U11: Devotion HUD button is disabled when aggregateAllIslands is checked on All Islands view, enabled otherwise', async ({ page }) => {
        // Load with aggregateAllIslands = '1' (enabled) and active island 'All Islands'
        await loadAggregateConfig(page, [
            { name: 'Latium', session: ROMAN_SESSION }
        ], { activeIsland: 'All Islands', aggregation: true });

        // Scoped to the navbar: the same data-target appears on buttons inside other surfaces
        // too, and an unscoped locator resolves to 3 elements (strict mode violation).
        const devotionBtn = page.locator('nav.navbar button:has(img.icon-navbar[data-target="#patron-selection-dialog"])');
        await expect(devotionBtn).toBeDisabled();

        // Switch aggregateAllIslands setting to off
        await page.evaluate(() => {
            (window as any).view.settings.aggregateAllIslands.checked(false);
        });
        await page.waitForTimeout(100);
        await expect(devotionBtn).toBeEnabled();

        // Switch back on
        await page.evaluate(() => {
            (window as any).view.settings.aggregateAllIslands.checked(true);
        });
        await page.waitForTimeout(100);
        await expect(devotionBtn).toBeDisabled();

        // Switch active island to Latium (real island)
        await page.evaluate(() => {
            const view = (window as any).view;
            const latium = view.islands().find((i: any) => i.name() === 'Latium');
            view.island(latium);
        });
        await page.waitForTimeout(100);
        await expect(devotionBtn).toBeEnabled();
    });

    test('ifEditable/ifAggregated virtual bindings are registered', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], { activeIsland: ALL_ISLANDS_NAME });

        const result = await page.evaluate(() => {
            const ko = (window as any).ko;
            const view = (window as any).view;

            const registered = {
                ifEditable: typeof ko.bindingHandlers.ifEditable === 'object',
                ifAggregated: typeof ko.bindingHandlers.ifAggregated === 'object',
                ifEditableVirtual: ko.virtualElements.allowedBindings.ifEditable === true,
                ifAggregatedVirtual: ko.virtualElements.allowedBindings.ifAggregated === true,
            };

            const whileAggregating = view.isAggregating();
            view.settings.aggregateAllIslands.checked(false);
            const whileOff = view.isAggregating();
            view.settings.aggregateAllIslands.checked(true);

            return { registered, whileAggregating, whileOff };
        });

        expect(result.registered.ifEditable).toBe(true);
        expect(result.registered.ifAggregated).toBe(true);
        expect(result.registered.ifEditableVirtual).toBe(true);
        expect(result.registered.ifAggregatedVirtual).toBe(true);
        expect(result.whileAggregating).toBe(true);
        expect(result.whileOff).toBe(false);
    });

    test('presenter.editable() is false while aggregating and true on a real island', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
        ], { activeIsland: ALL_ISLANDS_NAME });

        const aggregating = await page.evaluate(() => {
            const view = (window as any).view;
            const presenter = view.presenter.productByGuid.get(2137);
            return { product: presenter.editable(), factory: presenter.factoryPresenters[0].editable() };
        });

        expect(aggregating.product).toBe(false);
        expect(aggregating.factory).toBe(false);

        await page.evaluate(() => {
            const view = (window as any).view;
            view.island(view.islands().find((i: any) => !i.isAllIslands()));
        });
        await page.waitForTimeout(200);

        const real = await page.evaluate(() => {
            const view = (window as any).view;
            const presenter = view.presenter.productByGuid.get(2137);
            return { product: presenter.editable(), factory: presenter.factoryPresenters[0].editable() };
        });

        expect(real.product).toBe(true);
        expect(real.factory).toBe(true);
    });

    test('ResidencePresenter.editable() tracks its own aggregate mode, not the selected island', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], { activeIsland: ALL_ISLANDS_NAME });

        const result = await page.evaluate(() => {
            const view = (window as any).view;
            const residence = view.presenter.residence;
            const firstReal = view.islands().find((i: any) => !i.isAllIslands());
            const populationLevel = firstReal.assetsMap.get(3087).populationLevel;

            residence.updateAggregate(populationLevel.guid);
            const afterAggregate = { editable: residence.editable(), isAggregateMode: residence.isAggregateMode() };

            residence.update(populationLevel);
            const afterUpdate = { editable: residence.editable(), isAggregateMode: residence.isAggregateMode() };

            return { afterAggregate, afterUpdate };
        });

        expect(result.afterAggregate.editable).toBe(false);
        expect(result.afterAggregate.isAggregateMode).toBe(true);
        // Still on the All-Islands view, but the presenter itself is no longer in aggregate mode -
        // editable() must follow the presenter, not the global condition.
        expect(result.afterUpdate.editable).toBe(true);
        expect(result.afterUpdate.isAggregateMode).toBe(false);
    });

    test('constructed-buildings-input renders a read-only count while aggregating', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], { activeIsland: ALL_ISLANDS_NAME });

        await page.evaluate(() => {
            const view = (window as any).view;
            const counts: Record<string, number> = { IslandA: 4, IslandB: 7 };
            for (const island of view.islands()) {
                if (island.isAllIslands()) continue;
                island.assetsMap.get(3174).buildings.constructed(counts[island.name()]);
            }
        });

        await openProductDialog(page, 2137);

        const dialog = page.locator('#product-config-dialog');
        await expect(dialog.locator('input[id$="-constructed-buildings-input"]')).toHaveCount(0);
        await expect(dialog.locator('#\\33 174-constructed-buildings-readonly')).toHaveText('11');
    });

    test('constructed-buildings-input is editable on a real island', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
        ], { activeIsland: 'IslandA' });

        await openProductDialog(page, 2137);

        const dialog = page.locator('#product-config-dialog');
        await expect(dialog.locator('input[id$="-constructed-buildings-input"]').first()).toBeVisible();
        await expect(dialog.locator('[id$="-constructed-buildings-readonly"]')).toHaveCount(0);
    });
});
