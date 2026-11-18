import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

// Every attribute of a need is a total over the residences of the level: constructed buildings x (raw value + villa-item
// bonus) x supply share, 0 while the need is unchecked or gated (plan 2026-11-16-001). Expectations come from
// window.params.needs, never from hard-coded values.
const LATIUM = 3245;
const LIBERTI_LEVEL = 1499;
const BUILDINGS = 7;
const PUBLIC_NEED = 2750;
const PUBLIC_BUILDING = 3527;

async function load(page: Page) {
    const cl = new ConfigLoader();
    await cl.loadConfigObject(page, cl.createIslandConfig('Latium', LATIUM));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island() && (window as any).view.presenter.residence);
    await page.evaluate(({ level, n }) => {
        const island = (window as any).view.island();
        for (const r of island.populationLevels.find((l: any) => l.guid === level).allResidences()) r.buildings.constructed(n);
    }, { level: LIBERTI_LEVEL, n: BUILDINGS });
}

/** Totals of every attribute of every visible need of the level next to the raw config values. */
const describe = (page: Page) => page.evaluate((level) => {
    const w = window as any;
    const island = w.view.island();
    const populationLevel = island.populationLevels.find((l: any) => l.guid === level);
    const cfg = new Map<number, any>(w.params.needs.map((n: any) => [n.guid, n]));
    const ids: string[] = w.params.needAttributes.map((a: any) => a.id);
    const needs = [...populationLevel.needsMap.values()].filter((n: any) => !n.hidden() && n.available());
    return needs.map((n: any) => ({
        guid: n.need.guid,
        product: n.need.product.guid,
        isBuilding: n.need.isBuilding,
        raw: Object.fromEntries(ids.map((id) => [id, cfg.get(n.need.guid).needAttributes[id] ?? 0])),
        totals: Object.fromEntries(ids.map((id) => [id, n.attributeTotal(id)])),
        residents: n.residents(),
    }));
}, LIBERTI_LEVEL);

test.describe('need attribute totals', () => {
    test('Population total equals residents() for every need', async ({ page }) => {
        await load(page);
        const needs = await describe(page);
        expect(needs.length).toBeGreaterThan(0);
        for (const n of needs) expect(n.totals.Population, `need ${n.guid}`).toBeCloseTo(n.residents, 9);
        expect(needs.some((n: any) => n.residents > 0)).toBe(true);
    });

    test('every attribute is buildings x raw value for a goods need', async ({ page }) => {
        await load(page);
        let nonPopulation = 0;
        for (const n of (await describe(page)).filter((x: any) => !x.isBuilding)) {
            for (const [id, raw] of Object.entries<number>(n.raw)) {
                expect(n.totals[id], `need ${n.guid} ${id}`).toBeCloseTo(BUILDINGS * raw, 9);
                if (id !== 'Population' && raw !== 0) nonPopulation++;
            }
        }
        expect(nonPopulation).toBeGreaterThan(0);
    });

    test('an unchecked need has no total and the value returns when it is checked again', async ({ page }) => {
        await load(page);
        const target = (await describe(page)).find((n: any) => Object.entries<number>(n.raw).some(([id, v]) => id !== 'Population' && v !== 0));
        expect(target).toBeDefined();
        const id = Object.entries<number>(target!.raw).find(([k, v]) => k !== 'Population' && v !== 0)![0];
        const read = (checked?: boolean) => page.evaluate(({ level, need, id, checked }) => {
            const w = window as any;
            const n = w.view.island().populationLevels.find((l: any) => l.guid === level).needsMap.get(need);
            if (checked !== undefined) n.checked(checked);
            return n.attributeTotal(id);
        }, { level: LIBERTI_LEVEL, need: target!.guid, id, checked });
        const before = await read();
        expect(before).not.toBe(0);
        expect(await read(false)).toBe(0);
        expect(await read(true)).toBeCloseTo(before, 9);
    });

    test('the share of supply of a public need scales every attribute', async ({ page }) => {
        await load(page);
        await page.evaluate(({ level, building }) => { (window as any).view.island().publicCoverage(level, building)(50); }, { level: LIBERTI_LEVEL, building: PUBLIC_BUILDING });
        const need = (await describe(page)).find((n: any) => n.guid === PUBLIC_NEED);
        expect(need).toBeDefined();
        for (const [id, raw] of Object.entries<number>(need!.raw))
            expect(need!.totals[id], id).toBeCloseTo(Math.round(BUILDINGS * 0.5) * raw, 9);
        expect(Object.values(need!.raw).some((v: number) => v !== 0)).toBe(true);
    });

    test('a villa item bonus for an attribute adds buildings x bonus while the need is supplied', async ({ page }) => {
        await load(page);
        const target = (await describe(page)).find((n: any) => !n.isBuilding && n.raw.Population > 0);
        expect(target).toBeDefined();
        const attribute = await page.evaluate(() => (window as any).params.needAttributes.map((a: any) => a.id).find((id: string) => id !== 'Population'));
        const result = await page.evaluate(({ level, need, product, attribute }) => {
            const w = window as any;
            const island = w.view.island();
            const n = island.populationLevels.find((l: any) => l.guid === level).needsMap.get(need);
            const before = n.attributeTotal(attribute);
            const beforePopulation = n.attributeTotal('Population');
            const stub = {
                buff: { population: 0 },
                needAttribute: (guid: number, id: string) => guid === product && id === attribute ? 3 : 0,
                consumptionModifierInPercent: () => 0,
                goodConsumptionUpgrade: () => [],
            };
            const residences = island.populationLevels.find((l: any) => l.guid === level).allResidences();
            for (const r of residences) r.buffs.push(stub);
            const result = { before, beforePopulation, after: n.attributeTotal(attribute), afterPopulation: n.attributeTotal('Population'), residences: residences.length };
            for (const r of residences) r.buffs.remove(stub);
            return result;
        }, { level: LIBERTI_LEVEL, need: target!.guid, product: target!.product, attribute });
        expect(result.after - result.before).toBeCloseTo(BUILDINGS * 3 * result.residences, 9);
        expect(result.afterPopulation).toBeCloseTo(result.beforePopulation, 9);
    });

    test('without constructed buildings every total is 0', async ({ page }) => {
        await load(page);
        await page.evaluate((level) => {
            for (const r of (window as any).view.island().populationLevels.find((l: any) => l.guid === level).allResidences()) r.buildings.constructed(0);
        }, LIBERTI_LEVEL);
        for (const n of await describe(page)) for (const v of Object.values<number>(n.totals)) expect(v).toBe(0);
    });
});
