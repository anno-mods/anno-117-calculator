import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

/**
 * U4 - Population presenter aggregation (All-Islands Aggregation plan, U4).
 *
 * Verifies:
 *  1. (Regression, run first) With aggregateAllIslands OFF, a real island's
 *     population tiles - residents, buildings-constructed input + increment/decrement,
 *     hotkey, name, visibility - behave exactly like the pre-refactor Template-based
 *     rendering. This is load-bearing: PopulationGroupPresenter/PopulationLevelPresenter
 *     replace Template for every population tile, not just aggregate ones.
 *  2. Happy path: two real islands with a matching population-level guid sum residents
 *     on the All-Islands aggregate tile.
 *  3. Zero real islands: aggregate tile shows 0 residents, not an error.
 *  4. Reactivity: adding a real island updates the sum without a tile-grid rebuild.
 *  5. Read-only: the buildings-constructed input is structurally absent (not merely
 *     hidden) on the aggregate tile, replaced by a read-only summed count.
 *
 * Key data (tests/AGENTS.md):
 *   - Latium session: 3245 (Roman region)
 *   - Liberti Population Level guid: 1499, Liberti Residence guid (Latium): 3087
 *   - All Islands session: 37135
 */

const LATIUM_SESSION = 3245;
const LIBERTI_POPULATION_LEVEL_GUID = 1499;
const LIBERTI_RESIDENCE_GUID = 3087;

test.describe('All-Islands population aggregation (U4)', () => {
    let configLoader: ConfigLoader;
    let errorDetector: BindingErrorDetector;

    test.beforeEach(({ page }) => {
        configLoader = new ConfigLoader();
        errorDetector = new BindingErrorDetector();
        errorDetector.listenForErrors(page);
    });

    // -----------------------------------------------------------------------
    // 1. Regression (run first): normal per-island rendering unaffected
    // -----------------------------------------------------------------------
    test('REGRESSION: real island population tile renders identically with aggregation off', async ({ page }) => {
        const config = configLoader.createFullConfig(
            [{
                name: 'Latium',
                session: LATIUM_SESSION,
                data: { [`${LIBERTI_RESIDENCE_GUID}.buildings.constructed`]: '2' }
            }],
            {}, // aggregateAllIslands defaults off
            'Latium'
        );
        await configLoader.loadConfigObject(page, config);

        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.waitForTimeout(300);

        // No binding errors from the presenter refactor
        expect(errorDetector.hasBindingError(), errorDetector.getFormattedBindingErrors().join('\n')).toBe(false);

        // Tiles rendered
        await page.waitForSelector('.ui-tier-unit', { timeout: 10000 });
        const tileCount = await page.locator('.ui-tier-unit').count();
        expect(tileCount).toBeGreaterThan(0);

        // Editable input present and structurally normal (not gated)
        const input = page.locator(`[id="${LIBERTI_POPULATION_LEVEL_GUID}-buildings-constructed-input"]`);
        await expect(input).toBeVisible();
        await expect(input).toHaveValue('2');

        // No read-only replacement present on a normal island
        const readonly = page.locator(`[id="${LIBERTI_POPULATION_LEVEL_GUID}-buildings-constructed-readonly"]`);
        expect(await readonly.count()).toBe(0);

        // Residents text matches the model
        const modelState = await page.evaluate((guid) => {
            const island = (window as any).view.island();
            const level = island.assetsMap.get(guid);
            return { residents: level.residents(), name: level.name(), hotkey: level.hotkey() };
        }, LIBERTI_POPULATION_LEVEL_GUID);

        const tile = page.locator(`.ui-tier-unit-name[tier-unit-guid="${LIBERTI_POPULATION_LEVEL_GUID}"]`).locator('..');
        const nameText = await tile.locator('.ui-tier-unit-name span:last-child').innerText();
        expect(nameText).toBe(modelState.name);

        const residentsText = await tile.locator('strong').innerText();
        expect(residentsText).toBe(String(modelState.residents));

        // Hotkey (assigned by main.ts key-bindings computed based on population level name)
        if (modelState.hotkey) {
            const hotkeySpan = tile.locator('.ui-tier-unit-name span:first-child');
            await expect(hotkeySpan).toBeVisible();
            const hotkeyText = await hotkeySpan.innerText();
            expect(hotkeyText.toLowerCase()).toContain(modelState.hotkey.toLowerCase());
        }

        // Increment/decrement still mutate the real per-island observable.
        // number-input-increment snaps to the nearest step (10) multiple, so from 2
        // a single "+" click lands on 10 (floor((2+10+eps)/10)*10), not 2+10.
        const incrementButton = tile.locator('.input-group-btn-vertical button').first();
        await incrementButton.click();
        await expect(input).toHaveValue('10');

        let constructed = await page.evaluate((guid) => {
            const island = (window as any).view.island();
            return island.assetsMap.get(guid).buildings.constructed();
        }, LIBERTI_RESIDENCE_GUID);
        expect(constructed).toBe(10);

        const decrementButton = tile.locator('.input-group-btn-vertical button').nth(1);
        await decrementButton.click();
        await expect(input).toHaveValue('0');

        constructed = await page.evaluate((guid) => {
            const island = (window as any).view.island();
            return island.assetsMap.get(guid).buildings.constructed();
        }, LIBERTI_RESIDENCE_GUID);
        // toBeCloseTo, not toBe: the decrement math can land on a signed -0 (tests/AGENTS.md gotcha)
        expect(constructed).toBeCloseTo(0, 6);
    });

    // -----------------------------------------------------------------------
    // 2. Happy path: two real islands sum residents on the aggregate tile
    // -----------------------------------------------------------------------
    test('two real islands with matching population level sum residents on All-Islands tile', async ({ page }) => {
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

        expect(errorDetector.hasBindingError(), errorDetector.getFormattedBindingErrors().join('\n')).toBe(false);

        const result = await page.evaluate((guid) => {
            const view = (window as any).view;
            const island = view.island();
            const groupPresenter = view.template.populationGroups.find((g: any) =>
                g.populationLevels.some((l: any) => l.guid === guid)
            );
            const levelPresenter = groupPresenter.populationLevels.find((l: any) => l.guid === guid);

            const realIslands = view.islands().filter((i: any) => !i.isAllIslands());
            const expectedResidents = realIslands.reduce((sum: number, i: any) => {
                const level = i.assetsMap.get(guid);
                return sum + (level ? level.residents() : 0);
            }, 0);
            const expectedBuildings = realIslands.reduce((sum: number, i: any) => {
                const level = i.assetsMap.get(guid);
                return sum + (level ? level.residences[0].buildings.constructed() : 0);
            }, 0);

            return {
                isAllIslands: island.isAllIslands(),
                isAggregateMode: levelPresenter.isAggregateMode(),
                presenterResidents: levelPresenter.residents(),
                presenterAggregateBuildings: levelPresenter.aggregateBuildingsConstructed(),
                expectedResidents,
                expectedBuildings,
            };
        }, LIBERTI_POPULATION_LEVEL_GUID);

        expect(result.isAllIslands).toBe(true);
        expect(result.isAggregateMode).toBe(true);
        expect(result.expectedBuildings).toBe(5); // 2 + 3
        expect(result.presenterAggregateBuildings).toBe(result.expectedBuildings);
        expect(result.presenterResidents).toBe(result.expectedResidents);
        expect(result.presenterResidents).toBeGreaterThan(0);

        // DOM confirms the same summed value
        await page.waitForSelector('.ui-tier-unit', { timeout: 10000 });
        const tile = page.locator(`.ui-tier-unit-name[tier-unit-guid="${LIBERTI_POPULATION_LEVEL_GUID}"]`).locator('..');
        const residentsText = await tile.locator('strong').innerText();
        expect(residentsText).toBe(String(result.presenterResidents));
    });

    // -----------------------------------------------------------------------
    // 3. Zero real islands: aggregate tile shows 0, not an error
    // -----------------------------------------------------------------------
    test('zero real islands shows 0 residents on the aggregate tile, not an error', async ({ page }) => {
        const config = configLoader.createFullConfig(
            [],
            { 'settings.aggregateAllIslands': '1' },
            'All Islands'
        );
        await configLoader.loadConfigObject(page, config);

        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.waitForTimeout(300);

        expect(errorDetector.hasBindingError(), errorDetector.getFormattedBindingErrors().join('\n')).toBe(false);

        const result = await page.evaluate((guid) => {
            const view = (window as any).view;
            const groupPresenter = view.template.populationGroups.find((g: any) =>
                g.populationLevels.some((l: any) => l.guid === guid)
            );
            const levelPresenter = groupPresenter.populationLevels.find((l: any) => l.guid === guid);
            return {
                realIslandCount: view.islands().filter((i: any) => !i.isAllIslands()).length,
                residents: levelPresenter.residents(),
                aggregateBuildings: levelPresenter.aggregateBuildingsConstructed(),
            };
        }, LIBERTI_POPULATION_LEVEL_GUID);

        expect(result.realIslandCount).toBe(0);
        expect(result.residents).toBe(0);
        expect(result.aggregateBuildings).toBe(0);

        await page.waitForSelector('.ui-tier-unit', { timeout: 10000 });
        const tile = page.locator(`.ui-tier-unit-name[tier-unit-guid="${LIBERTI_POPULATION_LEVEL_GUID}"]`).locator('..');
        const residentsText = await tile.locator('strong').innerText();
        expect(residentsText).toBe('0');
    });

    // -----------------------------------------------------------------------
    // 4. Reactivity: adding a real island updates the sum without a tile-grid rebuild
    // -----------------------------------------------------------------------
    test('adding a real island updates the aggregate sum reactively without rebuilding the tile grid', async ({ page }) => {
        const config = configLoader.createFullConfig(
            [{ name: 'Latium', session: LATIUM_SESSION, data: { [`${LIBERTI_RESIDENCE_GUID}.buildings.constructed`]: '2' } }],
            { 'settings.aggregateAllIslands': '1' },
            'All Islands'
        );
        await configLoader.loadConfigObject(page, config);

        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.waitForTimeout(300);
        await page.waitForSelector('.ui-tier-unit', { timeout: 10000 });

        const before = await page.evaluate((guid) => {
            const view = (window as any).view;
            const groupPresenter = view.template.populationGroups.find((g: any) =>
                g.populationLevels.some((l: any) => l.guid === guid)
            );
            const levelPresenter = groupPresenter.populationLevels.find((l: any) => l.guid === guid);
            (window as any).__populationGroupsRef = view.template.populationGroups;
            return {
                residents: levelPresenter.residents(),
                tileCount: document.querySelectorAll('.ui-tier-unit').length,
            };
        }, LIBERTI_POPULATION_LEVEL_GUID);

        // Add a second real island via the same runtime path the island-management dialog uses,
        // then set its Liberti buildings count - no navigation/reselect of All-Islands.
        await page.evaluate((residenceGuid) => {
            const view = (window as any).view;
            const session = view.sessions.find((s: any) => s.guid === 3245);
            view.islandManager.create('Latium2', session);

            const newIsland = view.islands().find((i: any) => i.name() === 'Latium2');
            newIsland.assetsMap.get(residenceGuid).buildings.constructed("3");

            // Ensure we're still viewing All-Islands (showIslandOnCreation may have switched it)
            const allIslands = view.islands().find((i: any) => i.isAllIslands());
            view.island(allIslands);
        }, LIBERTI_RESIDENCE_GUID);

        await page.waitForTimeout(300);

        const after = await page.evaluate((guid) => {
            const view = (window as any).view;
            const groupPresenter = view.template.populationGroups.find((g: any) =>
                g.populationLevels.some((l: any) => l.guid === guid)
            );
            const levelPresenter = groupPresenter.populationLevels.find((l: any) => l.guid === guid);
            return {
                residents: levelPresenter.residents(),
                tileCount: document.querySelectorAll('.ui-tier-unit').length,
                sameArrayReference: view.template.populationGroups === (window as any).__populationGroupsRef,
                islandsInfo: view.islands().map((i: any) => `${i.name()}: constructed=${i.assetsMap.get(guid)?.buildings?.constructed() || 0}, residents=${i.assetsMap.get(guid)?.residents() || 0}`),
                aggregateBuildings: levelPresenter.aggregateBuildingsConstructed()
            };
        }, LIBERTI_POPULATION_LEVEL_GUID);

        expect(after.residents).toBe(30);
        expect(after.aggregateBuildings).toBe(5);
        expect(after.tileCount, 'tile-grid DOM node count should be unchanged (no rebuild)').toBe(before.tileCount);
        expect(after.sameArrayReference, 'window.view.template.populationGroups must remain the same array reference').toBe(true);

        // DOM reflects the updated sum without navigation
        const tile = page.locator(`.ui-tier-unit-name[tier-unit-guid="${LIBERTI_POPULATION_LEVEL_GUID}"]`).locator('..');
        const residentsText = await tile.locator('strong').innerText();
        expect(residentsText).toBe(String(after.residents));
    });

    // -----------------------------------------------------------------------
    // 5. Read-only: buildings-constructed input structurally absent on aggregate tile
    // -----------------------------------------------------------------------
    test('buildings-constructed input is structurally absent on the aggregate tile, replaced by read-only count', async ({ page }) => {
        const config = configLoader.createFullConfig(
            [{ name: 'Latium', session: LATIUM_SESSION, data: { [`${LIBERTI_RESIDENCE_GUID}.buildings.constructed`]: '4' } }],
            { 'settings.aggregateAllIslands': '1' },
            'All Islands'
        );
        await configLoader.loadConfigObject(page, config);

        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.waitForTimeout(300);
        await page.waitForSelector('.ui-tier-unit', { timeout: 10000 });

        // Structurally absent, not merely hidden - locator count must be 0
        const input = page.locator(`[id="${LIBERTI_POPULATION_LEVEL_GUID}-buildings-constructed-input"]`);
        expect(await input.count()).toBe(0);

        // Increment component (which would call incConstructedBuildings-style mutators) absent too
        const incrementGroup = page.locator(`.ui-tier-unit-name[tier-unit-guid="${LIBERTI_POPULATION_LEVEL_GUID}"]`)
            .locator('..')
            .locator('.input-group-btn-vertical');
        expect(await incrementGroup.count()).toBe(0);

        // Read-only replacement present and shows the correct summed count
        const readonly = page.locator(`[id="${LIBERTI_POPULATION_LEVEL_GUID}-buildings-constructed-readonly"]`);
        await expect(readonly).toBeVisible();
        await expect(readonly).toHaveText('4');
    });
});
