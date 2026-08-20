import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

/**
 * U5 - ResidencePresenter aggregate mode for the residence drill-in dialog
 * (population-level-config-dialog.html), All-Islands Aggregation plan.
 *
 * Verifies:
 *  1. Happy path: opening the dialog from an aggregated population tile shows summed
 *     residents, need consumption, and population buffs across real islands.
 *  2. Read-only: need-activation checkboxes, the buildings-constructed input, and
 *     population-buff checkboxes are structurally absent (not merely disabled) in
 *     aggregate mode.
 *  3. Mode switch: repointing the shared ResidencePresenter via update()/updateAggregate()
 *     shows the correct data each time, with no state leaking between modes.
 *  4. No-regression: the existing .update() call sites (population-tile.html normal path,
 *     components.ts consumer-residence path) keep working exactly as before.
 *
 * Key data (tests/AGENTS.md):
 *   - Latium session: 3245 (Roman region)
 *   - Liberti Population Level guid: 1499, Liberti Residence guid (Latium): 3087
 *   - Epicure of Water effect guid: 99014, buff guid: 32385, buff.population: 1
 *     (island-event, NOT a patron effect -> has a manual checkbox in the dialog)
 */

const LATIUM_SESSION = 3245;
const LIBERTI_POPULATION_LEVEL_GUID = 1499;
const LIBERTI_RESIDENCE_GUID = 3087;
const EPICURE_EFFECT_GUID = 99014;

// U3 (read-only gating for the product/factory tile grid, templates/product-tile.html) has not
// landed on this branch yet as of U5 - only U1/U2/U4 are merged. Enabling
// aggregateAllIslands therefore reproduces a pre-existing, out-of-scope-for-U5 binding
// error from the product tile grid's still-unguarded canDecConstructedBuildings()/
// factoryPresenterIfDefaultSupplier() synthetic-object bindings (KTD6, U3's job). That is not a
// regression introduced by this unit's ResidencePresenter/population-dialog work, so tests that
// enable aggregation filter it out rather than asserting a blanket zero-binding-errors page.
function nonProductTileBindingErrors(errorDetector: BindingErrorDetector): string[] {
    return errorDetector.getFormattedBindingErrors().filter((msg) =>
        !/canDecConstructedBuildings|factoryPresenterIfDefaultSupplier|productPresenters|product-tile/i.test(msg)
    );
}

test.describe('ResidencePresenter aggregate mode (U5)', () => {
    let configLoader: ConfigLoader;
    let errorDetector: BindingErrorDetector;

    test.beforeEach(({ page }) => {
        configLoader = new ConfigLoader();
        errorDetector = new BindingErrorDetector();
        errorDetector.listenForErrors(page);
    });

    // -----------------------------------------------------------------------
    // 1. Happy path: summed residents / need consumption / population buffs
    // -----------------------------------------------------------------------
    test('opening the dialog from an aggregated tile shows summed residents, needs and population buffs', async ({ page }) => {
        const config = configLoader.createFullConfig(
            [
                {
                    name: 'Latium', session: LATIUM_SESSION, data: {
                        [`${LIBERTI_RESIDENCE_GUID}.buildings.constructed`]: '2',
                        [`island.effect.${EPICURE_EFFECT_GUID}.scaling`]: '1',
                    }
                },
                {
                    name: 'Latium2', session: LATIUM_SESSION, data: {
                        [`${LIBERTI_RESIDENCE_GUID}.buildings.constructed`]: '3',
                    }
                },
            ],
            { 'settings.aggregateAllIslands': '1' },
            'All Islands'
        );
        await configLoader.loadConfigObject(page, config);

        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.waitForTimeout(300);
        await page.waitForSelector('.ui-tier-unit', { timeout: 10000 });

        // See nonProductTileBindingErrors() above: filters out U3's known, not-yet-landed
        // product-tile gating gap, which is unrelated to this unit's population/residence work.
        expect(nonProductTileBindingErrors(errorDetector), errorDetector.getFormattedBindingErrors().join('\n')).toEqual([]);

        // Open the dialog exactly the way the aggregate tile's sliders button does
        // (templates/population-tile.html): click it, let the click handler +
        // data-toggle="modal" attribute do their job.
        const tile = page.locator(`.ui-tier-unit-name[tier-unit-guid="${LIBERTI_POPULATION_LEVEL_GUID}"]`).locator('..');
        await tile.locator('button.btn-light.btn-sm').click();
        await page.waitForSelector('#population-level-config-dialog.show', { state: 'visible', timeout: 5000 });

        const expected = await page.evaluate(({ levelGuid, needGuid, residenceGuid }) => {
            const view = (window as any).view;
            const realIslands = view.islands().filter((i: any) => !i.isAllIslands());

            const expectedResidents = realIslands.reduce((sum: number, i: any) => {
                const level = i.assetsMap.get(levelGuid);
                return sum + (level ? level.residents() : 0);
            }, 0);
            const expectedBuildings = realIslands.reduce((sum: number, i: any) => {
                const level = i.assetsMap.get(levelGuid);
                return sum + (level ? level.residences[0].buildings.constructed() : 0);
            }, 0);

            const presenter = view.presenter.residence;
            const firstNeedPresenter = presenter.visibleNeedCategories()[0].visiblePopulationLevelNeeds()[0];
            const expectedNeedAmount = realIslands.reduce((sum: number, i: any) => {
                const level = i.assetsMap.get(levelGuid);
                const need = level ? level.needsMap.get(firstNeedPresenter.guid) : null;
                return sum + (need ? need.amount() : 0);
            }, 0);
            const expectedNeedResidents = realIslands.reduce((sum: number, i: any) => {
                const level = i.assetsMap.get(levelGuid);
                const need = level ? level.needsMap.get(firstNeedPresenter.guid) : null;
                return sum + (need ? need.residents() : 0);
            }, 0);

            void needGuid;
            void residenceGuid;

            return {
                isAggregateMode: presenter.isAggregateMode(),
                presenterResidents: presenter.residents(),
                expectedResidents,
                expectedBuildings,
                presenterBuildingsConstructed: presenter.buildings() ? presenter.buildings().constructed() : null,
                firstNeedId: firstNeedPresenter.id,
                firstNeedPresenterAmount: firstNeedPresenter.amount(),
                firstNeedPresenterResidents: firstNeedPresenter.residents(),
                expectedNeedAmount,
                expectedNeedResidents,
                populationBuffsCount: presenter.populationBuffs().length,
                epicureTotalPopulation: presenter.populationBuffs()
                    .filter((b: any) => b.appliedBuff.parent.guid === 99014)
                    .map((b: any) => b.totalPopulation())[0] ?? null,
            };
        }, { levelGuid: LIBERTI_POPULATION_LEVEL_GUID, needGuid: 0, residenceGuid: LIBERTI_RESIDENCE_GUID });

        expect(expected.isAggregateMode).toBe(true);
        expect(expected.presenterResidents).toBe(String(expected.expectedResidents));
        expect(expected.presenterBuildingsConstructed).toBe(expected.expectedBuildings); // 2 + 3 = 5
        expect(expected.expectedBuildings).toBe(5);
        expect(expected.firstNeedPresenterAmount).toBeCloseTo(expected.expectedNeedAmount, 6);
        expect(expected.firstNeedPresenterResidents).toBeCloseTo(expected.expectedNeedResidents, 6);

        // Epicure of Water is active on the representative island (Latium, first real island) -
        // population buff total = aggregate buildings (5) * populationBonus (1, from buff.population=1
        // at scaling=1 on the representative island's own AppliedBuff).
        expect(expected.populationBuffsCount).toBeGreaterThan(0);
        expect(expected.epicureTotalPopulation).toBe(5);

        // DOM confirms the same summed residents value in the dialog header
        const headerResidents = page.locator('#population-level-config-dialog .inline-list-centered strong').first();
        await expect(headerResidents).toHaveText(expected.presenterResidents);
    });

    // -----------------------------------------------------------------------
    // 2. Read-only: mutating controls structurally absent in aggregate mode
    // -----------------------------------------------------------------------
    test('mutating controls are structurally absent (not disabled) in aggregate mode', async ({ page }) => {
        const config = configLoader.createFullConfig(
            [
                {
                    name: 'Latium', session: LATIUM_SESSION, data: {
                        [`${LIBERTI_RESIDENCE_GUID}.buildings.constructed`]: '2',
                        [`island.effect.${EPICURE_EFFECT_GUID}.scaling`]: '1',
                    }
                },
                { name: 'Latium2', session: LATIUM_SESSION, data: { [`${LIBERTI_RESIDENCE_GUID}.buildings.constructed`]: '3' } },
            ],
            { 'settings.aggregateAllIslands': '1' },
            'All Islands'
        );
        await configLoader.loadConfigObject(page, config);

        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.waitForTimeout(300);
        await page.waitForSelector('.ui-tier-unit', { timeout: 10000 });

        const tile = page.locator(`.ui-tier-unit-name[tier-unit-guid="${LIBERTI_POPULATION_LEVEL_GUID}"]`).locator('..');
        await tile.locator('button.btn-light.btn-sm').click();
        await page.waitForSelector('#population-level-config-dialog.show', { state: 'visible', timeout: 5000 });

        // Buildings-constructed input structurally absent; read-only replacement present and correct
        const buildingsInput = page.locator(`#population-level-config-dialog [id="${LIBERTI_RESIDENCE_GUID}-constructed-buildings-input"]`);
        expect(await buildingsInput.count()).toBe(0);
        const buildingsReadonly = page.locator(`#population-level-config-dialog [id="${LIBERTI_RESIDENCE_GUID}-constructed-buildings-readonly"]`);
        await expect(buildingsReadonly).toBeVisible();
        await expect(buildingsReadonly).toHaveText('5');

        // Need-activation checkboxes structurally absent - none of the need-category tables render
        // an <input type=checkbox> for individual needs while in aggregate mode.
        const needCheckboxes = page.locator('#population-level-config-dialog table.table-striped.table-fixed input[type="checkbox"]');
        expect(await needCheckboxes.count()).toBe(0);
        const customCheckboxes = page.locator('#population-level-config-dialog table.table-striped.table-fixed .custom-checkbox');
        expect(await customCheckboxes.count()).toBe(0);

        // But at least one need row (with its read-only name/amount/residents) is still rendered
        const needRows = page.locator('#population-level-config-dialog table.table-striped.table-fixed tbody tr');
        expect(await needRows.count()).toBeGreaterThan(0);

        // Population-buff checkbox (non-patron Epicure effect) structurally absent, regardless
        // of whether the whole "From Area Effects & Specialists" section itself is currently
        // rendered (that section's own visibility - populationBuffsVisible() - is pre-existing
        // logic unrelated to aggregate mode; if it does render for a given buff, no checkbox
        // input for that buff may ever be present while in aggregate mode).
        const buffCheckbox = page.locator('#population-level-config-dialog input[id^="pop-buff-"]');
        expect(await buffCheckbox.count()).toBe(0);

        // ...and the Bootstrap custom-control classes must leave with the input. A
        // .custom-control.custom-checkbox wrapper whose .custom-control-label has no checkbox
        // still paints an empty box in front of every row (templates/AGENTS.md).
        const orphanedCheckboxStyling = page.locator(
            '#population-level-config-dialog .custom-control.custom-checkbox, #population-level-config-dialog .custom-control-label'
        );
        expect(await orphanedCheckboxStyling.count()).toBe(0);
    });

    // -----------------------------------------------------------------------
    // 3. Mode switch: update()/updateAggregate() repoint the same shared instance
    // -----------------------------------------------------------------------
    test('switching between aggregate and normal mode shows correct data each time with no leaked state', async ({ page }) => {
        const config = configLoader.createFullConfig(
            [
                { name: 'Latium', session: LATIUM_SESSION, data: { [`${LIBERTI_RESIDENCE_GUID}.buildings.constructed`]: '2' } },
                { name: 'Latium2', session: LATIUM_SESSION, data: { [`${LIBERTI_RESIDENCE_GUID}.buildings.constructed`]: '3' } },
            ],
            { 'settings.aggregateAllIslands': '1' },
            'All Islands'
        );
        await configLoader.loadConfigObject(page, config);

        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.waitForTimeout(300);

        // Start in aggregate mode
        const aggregateState = await page.evaluate((levelGuid) => {
            const view = (window as any).view;
            const presenter = view.presenter.residence;
            presenter.updateAggregate(levelGuid);
            return {
                isAggregateMode: presenter.isAggregateMode(),
                residents: presenter.residents(),
                buildingsConstructed: presenter.buildings() ? presenter.buildings().constructed() : null,
            };
        }, LIBERTI_POPULATION_LEVEL_GUID);

        expect(aggregateState.isAggregateMode).toBe(true);
        expect(aggregateState.buildingsConstructed).toBe(5);

        // Switch to a single real island's own PopulationLevel via update() - exactly what both
        // existing call sites do (population-tile.html normal path, components.ts:611)
        const normalState = await page.evaluate((residenceGuid) => {
            const view = (window as any).view;
            const latium = view.islands().find((i: any) => i.name() === 'Latium');
            const residence = latium.assetsMap.get(residenceGuid);
            const presenter = view.presenter.residence;
            presenter.update(residence.populationLevel);
            return {
                isAggregateMode: presenter.isAggregateMode(),
                residents: presenter.residents(),
                buildingsConstructed: presenter.buildings() ? presenter.buildings().constructed() : null,
                expectedResidents: residence.populationLevel.residents(),
            };
        }, LIBERTI_RESIDENCE_GUID);

        expect(normalState.isAggregateMode).toBe(false);
        expect(normalState.buildingsConstructed).toBe(2); // Latium's own count only, not the aggregate 5
        expect(normalState.residents).toBe(String(normalState.expectedResidents));

        // Switch back to aggregate mode again - confirms no stale state was left over from the
        // intervening normal update()
        const backToAggregate = await page.evaluate((levelGuid) => {
            const view = (window as any).view;
            const presenter = view.presenter.residence;
            presenter.updateAggregate(levelGuid);
            return {
                isAggregateMode: presenter.isAggregateMode(),
                buildingsConstructed: presenter.buildings() ? presenter.buildings().constructed() : null,
            };
        }, LIBERTI_POPULATION_LEVEL_GUID);

        expect(backToAggregate.isAggregateMode).toBe(true);
        expect(backToAggregate.buildingsConstructed).toBe(5);
    });

    // -----------------------------------------------------------------------
    // 4. No-regression: existing .update() call sites work exactly as before
    // -----------------------------------------------------------------------
    test('REGRESSION: normal per-island .update() call sites still work (population-tile + consumer-residence)', async ({ page }) => {
        const config = configLoader.createIslandConfig('Latium', LATIUM_SESSION, {
            [`${LIBERTI_RESIDENCE_GUID}.buildings.constructed`]: '4',
        });
        await configLoader.loadConfigObject(page, config);

        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.waitForTimeout(300);
        await page.waitForSelector('.ui-tier-unit', { timeout: 10000 });

        expect(errorDetector.hasBindingError(), errorDetector.getFormattedBindingErrors().join('\n')).toBe(false);

        // 4a. templates/population-tile.html's normal (non-aggregate) sliders button path
        const tile = page.locator(`.ui-tier-unit-name[tier-unit-guid="${LIBERTI_POPULATION_LEVEL_GUID}"]`).locator('..');
        await tile.locator('button.btn-light.btn-sm').click();
        await page.waitForSelector('#population-level-config-dialog.show', { state: 'visible', timeout: 5000 });

        const isAggregateFromTile = await page.evaluate(() => (window as any).view.presenter.residence.isAggregateMode());
        expect(isAggregateFromTile).toBe(false);

        // Editable buildings input present and functional (not gated on a real island)
        const buildingsInput = page.locator(`#population-level-config-dialog [id="${LIBERTI_RESIDENCE_GUID}-constructed-buildings-input"]`);
        await expect(buildingsInput).toBeVisible();
        await expect(buildingsInput).toHaveValue('4');

        // Need checkboxes present and interactive on a real island
        const needCheckbox = page.locator('#population-level-config-dialog table.table-striped.table-fixed input[type="checkbox"]').first();
        await expect(needCheckbox).toBeVisible();

        await page.evaluate(() => ($('#population-level-config-dialog') as any).modal('hide'));
        await page.waitForTimeout(300);

        // 4b. src/components.ts consumer-residence component's click handler:
        // $root.presenter.residence.update($data.consumer.populationLevel) - exercise the exact
        // same call directly (this path is reached from the consumer list of a factory/service that
        // consumes this population level, not from the population tile grid).
        const consumerPathState = await page.evaluate((residenceGuid) => {
            const view = (window as any).view;
            const residence = view.island().assetsMap.get(residenceGuid);
            view.presenter.residence.update(residence.populationLevel);
            return {
                isAggregateMode: view.presenter.residence.isAggregateMode(),
                residents: view.presenter.residence.residents(),
                expectedResidents: residence.populationLevel.residents(),
            };
        }, LIBERTI_RESIDENCE_GUID);

        expect(consumerPathState.isAggregateMode).toBe(false);
        expect(consumerPathState.residents).toBe(String(consumerPathState.expectedResidents));
    });

    // -----------------------------------------------------------------------
    // 5. The residence-row table itself must aggregate, not just the header
    // -----------------------------------------------------------------------

    /** Boots two Latium islands with All Islands selected and aggregation on. */
    async function loadTwoIslandAggregate(page: any, activeIsland = 'All Islands') {
        const config = configLoader.createFullConfig(
            [
                { name: 'Latium', session: LATIUM_SESSION },
                { name: 'Latium2', session: LATIUM_SESSION },
            ],
            { 'settings.aggregateAllIslands': '1' },
            activeIsland
        );
        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.waitForTimeout(300);
    }

    test('residence row residents sum to the aggregate, not one island', async ({ page }) => {
        await loadTwoIslandAggregate(page);

        const result = await page.evaluate(({ levelGuid, residenceGuid }) => {
            const view = (window as any).view;
            for (const island of view.islands()) {
                if (island.isAllIslands()) continue;
                island.assetsMap.get(residenceGuid).buildings.constructed(20);
            }

            const presenter = view.presenter.residence;
            presenter.updateAggregate(levelGuid);

            const perIslandResidents = view.islands()
                .filter((i: any) => !i.isAllIslands())
                .map((i: any) => i.assetsMap.get(residenceGuid).residents());

            const rows = presenter.residenceRows();

            return {
                rowResidents: rows.map((r: any) => r.residents()),
                rowConstructed: rows.map((r: any) => r.buildings().constructed()),
                rowReadOnly: rows.map((r: any) => r.buildings().readOnly),
                perIslandResidents,
            };
        }, { levelGuid: LIBERTI_POPULATION_LEVEL_GUID, residenceGuid: LIBERTI_RESIDENCE_GUID });

        const expectedTotal = result.perIslandResidents.reduce((a: number, b: number) => a + b, 0);
        expect(expectedTotal).toBeGreaterThan(0);
        expect(result.rowResidents.reduce((a: number, b: number) => a + b, 0)).toBeCloseTo(expectedTotal, 3);
        expect(result.rowConstructed.reduce((a: number, b: number) => a + b, 0)).toBe(40);
        expect(result.rowReadOnly).not.toContain(false);
    });

    test('effect coverage stays visible when the representative island has zero constructed', async ({ page }) => {
        await loadTwoIslandAggregate(page);

        const result = await page.evaluate(({ levelGuid, residenceGuid }) => {
            const view = (window as any).view;
            const islands = view.islands().filter((i: any) => !i.isAllIslands());
            // Representative (first) island deliberately empty; the other carries everything.
            islands[0].assetsMap.get(residenceGuid).buildings.constructed(0);
            islands[1].assetsMap.get(residenceGuid).buildings.constructed(15);

            const presenter = view.presenter.residence;
            presenter.updateAggregate(levelGuid);

            return presenter.residenceRows().map((r: any) => r.buildings().constructed());
        }, { levelGuid: LIBERTI_POPULATION_LEVEL_GUID, residenceGuid: LIBERTI_RESIDENCE_GUID });

        // The row must report the aggregate (15) so the template's `> 0` coverage gate passes.
        expect(result.reduce((a: number, b: number) => a + b, 0)).toBe(15);
    });

    test('residence rows are per-island values on a real island', async ({ page }) => {
        await loadTwoIslandAggregate(page, 'Latium');

        const result = await page.evaluate(({ residenceGuid }) => {
            const view = (window as any).view;
            const islands = view.islands().filter((i: any) => !i.isAllIslands());
            islands[0].assetsMap.get(residenceGuid).buildings.constructed(3);
            islands[1].assetsMap.get(residenceGuid).buildings.constructed(99);

            const residence = view.island().assetsMap.get(residenceGuid);
            const presenter = view.presenter.residence;
            presenter.update(residence.populationLevel);

            return {
                constructed: presenter.residenceRows().map((r: any) => r.buildings().constructed()),
                readOnly: presenter.residenceRows().map((r: any) => r.buildings().readOnly),
            };
        }, { residenceGuid: LIBERTI_RESIDENCE_GUID });

        expect(result.constructed).toEqual([3]);
        expect(result.readOnly).toEqual([false]);
    });
});
