import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

// Needs table of the population level dialog (plan 2026-11-12-002 U7): which columns render and what the presenter
// holds for each need. Expectations come from window.params.needs and window.params.needAttributes.
const LATIUM = 3245;

async function loadIsland(page: Page, patch?: string) {
    if (patch) {
        await page.route('**/js/params.js', async (route) => {
            const response = await route.fetch();
            await route.fulfill({ response, body: (await response.text()) + '\n;' + patch });
        });
    }
    const cl = new ConfigLoader();
    await cl.loadConfigObject(page, cl.createIslandConfig('Latium', LATIUM));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island() && (window as any).view.presenter.residence);
}

/** Opens the presenter on the level and returns the data of its visible needs and the rendered columns. */
const describeLevel = (page: Page, levelGuid: number) => page.evaluate((guid) => {
    const w = window as any;
    const presenter = w.view.presenter.residence;
    presenter.update(w.view.island().assetsMap.get(guid));
    const needs = presenter.visibleNeedCategories().flatMap((c: any) => c.visiblePopulationLevelNeeds());
    const cfg = new Map<number, any>(w.params.needs.map((n: any) => [n.guid, n]));
    const columns = presenter.needColumns();
    return {
        columnIds: columns.attributes.map((a: any) => a.id),
        dlc: columns.dlc,
        coverage: columns.coverage,
        paramsAttributeIds: w.params.needAttributes.map((a: any) => a.id),
        needs: needs.map((n: any) => ({
            guid: n.guid,
            residents: n.residents(),
            residentsPerResidence: n.residentsPerResidence,
            cells: n.cells().map((c: any) => ({ id: c.attribute.id, value: c.value, total: c.total(), isPopulation: c.isPopulation, text: c.text() })),
            weight: n.supplyWeight,
            dlcNames: n.dlcs.map((d: any) => d.name()),
            buildings: n.supplyBuildings().map((b: any) => ({ guid: b.guid, name: b.name() })),
            coverage: n.coverage(),
            isBuilding: n.isBuilding,
            config: cfg.get(n.guid),
        })),
    };
}, levelGuid);

const levelsOfIsland = (page: Page) => page.evaluate(() => (window as any).view.island().populationLevels.filter((l: any) => l.visible()).map((l: any) => l.guid as number));

test.describe('needs table columns (U7)', () => {
    test('AE13: attribute columns are the attributes with a value on a visible need, in the order of params.needAttributes', async ({ page }) => {
        await loadIsland(page);
        for (const level of await levelsOfIsland(page)) {
            const d = await describeLevel(page, level);
            expect(d.needs.length, `level ${level}`).toBeGreaterThan(0);
            const expected = d.paramsAttributeIds.filter((id: string) => d.needs.some((n: any) => n.config.needAttributes[id] !== 0));
            expect(d.columnIds, `level ${level}`).toEqual(expected);
            for (const need of d.needs) {
                // one cell per rendered column, in the same order, holding the raw value of the need
                expect(need.cells.map((c: any) => c.id)).toEqual(d.columnIds);
                for (const cell of need.cells) {
                    expect(cell.value).toBe(need.config.needAttributes[cell.id]);
                    if (cell.isPopulation) expect(cell.value).toBe(need.residentsPerResidence);
                }
            }
        }
    });

    test('a column in which every visible need has 0 is not rendered', async ({ page }) => {
        await loadIsland(page);
        const seen = new Set<string>();
        let omitted = 0;
        for (const level of await levelsOfIsland(page)) {
            const d = await describeLevel(page, level);
            for (const id of d.paramsAttributeIds) {
                if (!d.needs.some((n: any) => n.config.needAttributes[id] !== 0)) {
                    omitted++;
                    expect(d.columnIds).not.toContain(id);
                } else {
                    seen.add(id);
                }
            }
        }
        expect(seen.size).toBeGreaterThan(1);
        expect(omitted).toBeGreaterThan(0);
    });

    test('the Population cell is the residents cell of the need', async ({ page }) => {
        await loadIsland(page);
        const level = (await levelsOfIsland(page))[0];
        await page.evaluate((guid) => {
            const w = window as any;
            const island = w.view.island();
            const res = island.assetsMap.get(guid);
            for (const r of island.populationLevels.find((l: any) => l.guid === guid).allResidences()) r.buildings.constructed(7);
            return res && 0;
        }, level);
        const d = await describeLevel(page, level);
        const withResidents = d.needs.filter((n: any) => n.residentsPerResidence > 0);
        expect(withResidents.length).toBeGreaterThan(0);
        for (const need of withResidents) {
            const cell = need.cells.find((c: any) => c.isPopulation);
            expect(cell, `need ${need.guid}`).toBeDefined();
            expect(need.residents).toBeGreaterThan(0);
        }
    });

    test('every cell holds the total over the residences, the raw value stays on the cell, and the totals row sums them', async ({ page }) => {
        await loadIsland(page);
        const level = (await levelsOfIsland(page))[0];
        const constructed = 7;
        await page.evaluate(({ guid, n }) => {
            for (const r of (window as any).view.island().populationLevels.find((l: any) => l.guid === guid).allResidences()) r.buildings.constructed(n);
        }, { guid: level, n: constructed });
        const d = await describeLevel(page, level);
        let nonPopulation = 0;
        for (const need of d.needs) {
            for (const cell of need.cells) {
                expect(cell.value, `need ${need.guid} ${cell.id}`).toBe(need.config.needAttributes[cell.id]);
                if (cell.isPopulation) {
                    expect(cell.total).toBeCloseTo(need.residents, 9);
                } else {
                    // goods needs have a share of supply of 1; public needs a default coverage of 100 percent
                    expect(cell.total, `need ${need.guid} ${cell.id}`).toBeCloseTo(constructed * cell.value * (need.isBuilding ? need.coverage / 100 : 1), 9);
                    expect(cell.text === '', `need ${need.guid} ${cell.id}`).toBe(cell.total === 0);
                    if (cell.value !== 0) nonPopulation++;
                }
            }
        }
        expect(nonPopulation).toBeGreaterThan(0);
    });

    test('supply weight, DLC and supply buildings follow the data', async ({ page }) => {
        await loadIsland(page);
        for (const level of await levelsOfIsland(page)) {
            const d = await describeLevel(page, level);
            expect(d.dlc).toBe(d.needs.some((n: any) => (n.config.dlcUnlocks || []).length > 0));
            for (const need of d.needs) {
                expect(need.weight).toBe(need.config.supplyWeight);
                const dlcs = await page.evaluate((ids) => ids.map((g: number) => (window as any).view.dlcsGuidMap.get(g)?.name()).filter(Boolean), need.config.dlcUnlocks || []);
                expect(need.dlcNames).toEqual(dlcs);
            }
            // goods needs: the available factories of params.factories whose output is the product
            const goods = d.needs.filter((n: any) => !n.isBuilding);
            for (const need of goods) {
                const expected: number[] = await page.evaluate(({ product }) => {
                    const w = window as any;
                    const island = w.view.island();
                    return w.params.factories
                        .filter((f: any) => f.outputs.some((o: any) => o.product === product))
                        .map((f: any) => f.guid)
                        .filter((g: number) => island.assetsMap.get(g)?.available());
                }, { product: need.config.needProduct });
                expect(need.buildings.map((b: any) => b.guid).sort(), `need ${need.guid}`).toEqual([...expected].sort());
            }
        }
    });

    test('public needs list the public buildings that provide them and show the coverage', async ({ page }) => {
        await loadIsland(page);
        let checked = 0;
        for (const level of await levelsOfIsland(page)) {
            const d = await describeLevel(page, level);
            const publics = d.needs.filter((n: any) => n.isBuilding);
            if (!publics.length) continue;
            expect(d.coverage).toBe(true);
            for (const need of publics) {
                const providers: number[] = await page.evaluate(({ need, region }) => {
                    const w = window as any;
                    return w.params.publicServices
                        .filter((s: any) => s.providedNeeds.includes(need) && (s.regions.length === 0 || s.regions.includes(region)))
                        .map((s: any) => s.guid);
                }, { need: need.guid, region: await page.evaluate(() => (window as any).view.island().region.id) });
                expect(need.buildings.map((b: any) => b.guid).sort()).toEqual([...providers].sort());
                expect(need.coverage).toBe(100);
                checked++;
            }
        }
        expect(checked).toBeGreaterThan(0);
    });

    test('without params.publicServices a public need has no supply building and the coverage column does not render', async ({ page }) => {
        await loadIsland(page, 'window.params.publicServices = [];');
        let publics = 0;
        for (const level of await levelsOfIsland(page)) {
            const d = await describeLevel(page, level);
            expect(d.coverage).toBe(false);
            for (const need of d.needs.filter((n: any) => n.isBuilding)) {
                publics++;
                expect(need.buildings).toEqual([]);
            }
        }
        expect(publics).toBeGreaterThan(0);
    });
});
