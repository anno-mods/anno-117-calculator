import { test, expect, Page } from '@playwright/test';
import { exportDoc, fileOf, importText, openApp, settle, validateSchema } from '../helpers/exchange';

// Residence items (villa items): import plan (U4) and export / round trip (U5).
// Fixtures are real GUIDs of js/params.js:
//   160084  villa item, boostable, no DLC (Bread -20 % / -30 %)
//   149292  villa item, boostable, no DLC
//   51829   villa item without boost variant
//   159054  villa item, boostable, DLC 67903
//   41352   known item, no residence effect on demand (workforce buffs only)
//   156714  known factory item (Celtic), not a residence item
const LATIUM = 3245;
const BREAD_ITEM = 160084;
const NANNY = 149292;
const NO_BOOST_VILLA = 51829;
const DLC_VILLA = 159054;
const WORKFORCE_ONLY = 41352;
const FACTORY_ITEM = 156714;
const UNKNOWN_ITEM = 999999999;

interface Entry { kind: string; code: string; island?: string; message: string; detail?: Record<string, any> }
interface IslandPlan { store: Record<string, any>; ext: Record<string, any>; report: Entry[] }

async function planOne(page: Page, island: Record<string, any>): Promise<IslandPlan> {
    return page.evaluate((text: string) => {
        const ex = window.exchange;
        const r = ex.readExchange(text);
        if ('error' in r) throw new Error(r.error);
        return ex.planIslands(r).islands[0] as never;
    }, fileOf([{ id: 'x', name: 'Test', session: LATIUM, ...island }]));
}

const codes = (entries: Entry[]) => entries.map((e) => e.code);

test.describe('residence items: import plan (U4)', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    test('AE3: an unknown item is carried through, a known non-villa item is reported not applied, neither is stored', async ({ page }) => {
        const i = await planOne(page, { residenceItems: [{ item: UNKNOWN_ITEM }, { item: WORKFORCE_ONLY, boosted: true }] });
        expect(i.report.find((e) => e.code === 'unknown-guid')!.detail).toMatchObject({ pointer: '/residenceItems/0', guid: UNKNOWN_ITEM });
        expect(i.report.find((e) => e.code === 'residence-item-not-applied')!.detail).toMatchObject({ pointer: '/residenceItems/1' });
        expect(Object.keys(i.store).filter((k) => k.startsWith('residenceItem.'))).toEqual([]);
        expect(i.ext.guids.map((g: any) => g.pointer)).toEqual(['/residenceItems/0']);
        expect(i.ext.captured.map((c: any) => c.pointer)).toEqual(['/residenceItems/1']);
    });

    test('villa item states: boosted selects 2 for a boostable item, boosted without a variant stores 1 and is reported', async ({ page }) => {
        const i = await planOne(page, {
            residenceItems: [{ item: BREAD_ITEM, boosted: true }, { item: NANNY, boosted: false }, { item: NO_BOOST_VILLA, boosted: true }],
        });
        expect(i.store[`residenceItem.${BREAD_ITEM}.state`]).toBe(2);
        expect(i.store[`residenceItem.${NANNY}.state`]).toBe(1);
        expect(i.store[`residenceItem.${NO_BOOST_VILLA}.state`]).toBe(1);
        expect(codes(i.report)).toContain('item-boost-approximated');
        expect(i.report.filter((e) => e.code === 'residence-item-applied').length).toBe(3);
    });

    test('a known factory item in residenceItems is reported not applied and not stored', async ({ page }) => {
        const i = await planOne(page, { residenceItems: [{ item: FACTORY_ITEM }] });
        expect(codes(i.report)).toContain('residence-item-not-applied');
        expect(Object.keys(i.store).filter((k) => k.startsWith('residenceItem.'))).toEqual([]);
    });

    test('R5a: a repeated item keeps the first entry as state and reports the second', async ({ page }) => {
        const i = await planOne(page, { residenceItems: [{ item: BREAD_ITEM, boosted: false }, { item: BREAD_ITEM, boosted: true }] });
        expect(i.store[`residenceItem.${BREAD_ITEM}.state`]).toBe(1);
        const dup = i.report.find((e) => e.code === 'residence-item-duplicate')!;
        expect(dup.detail).toMatchObject({ pointer: '/residenceItems/1' });
        expect(i.ext.captured.map((c: any) => c.pointer)).toEqual(['/residenceItems/1']);
    });

    test('AE2: villaCoverage as a number, as {default}, with byLevel, out of range, invalid and absent', async ({ page }) => {
        expect((await planOne(page, { villaCoverage: 50 })).store.villaCoverage).toBe(50);
        expect((await planOne(page, { villaCoverage: { default: 50 } })).store.villaCoverage).toBe(50);

        const levels = await planOne(page, { villaCoverage: { default: 30, byLevel: { '1496': 10 } } });
        expect(levels.store.villaCoverage).toBe(30);
        expect(levels.report.find((e) => e.code === 'villa-coverage-not-applied')!.detail).toMatchObject({ pointer: '/villaCoverage/byLevel' });
        expect(levels.ext.captured.find((c: any) => c.pointer === '/villaCoverage/byLevel').value).toEqual({ '1496': 10 });

        const high = await planOne(page, { villaCoverage: 150 });
        expect(high.store.villaCoverage).toBe(100);
        expect(codes(high.report)).toContain('villa-coverage-clamped');

        const text = await planOne(page, { villaCoverage: 'half' });
        expect(text.store.villaCoverage).toBeUndefined();
        expect(codes(text.report)).toContain('villa-coverage-invalid');

        const absent = await planOne(page, {});
        expect(absent.store.villaCoverage).toBeUndefined();
        expect(codes(absent.report)).not.toContain('villa-coverage-applied');
    });

    test('the other coverage fields apply what the calculator has data for and keep the rest at its pointer', async ({ page }) => {
        const i = await planOne(page, { residenceEffects: { '1496': { '99014': 62.5, '140536': 27.7 } }, publicCoverages: { '1496': { '3527': 84.4, '99999': 84.4 } }, publicCoverage: 100 });
        const pointers = i.ext.captured.map((c: any) => c.pointer).sort();
        expect(pointers).toEqual(['/publicCoverages/1496/99999', '/residenceEffects/1496/140536'].sort());
        expect(i.store['1496[99014].coverage']).toBe(62.5);
        expect(i.store['1496[3527].publicCoverage']).toBe(84.4);
        expect(i.store.publicCoverage).toBe(100);
    });

    test('DLC: an imported villa item with one dlcUnlocks entry reports the DLC as enabled', async ({ page }) => {
        const i = await planOne(page, { residenceItems: [{ item: DLC_VILLA }] });
        const dlc = i.report.find((e) => e.code === 'dlc-enabled')!;
        expect(dlc.detail!.items).toEqual([DLC_VILLA]);
    });
});

test.describe('residence items: import and export (U5)', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    const island = async (page: Page) => {
        const { document, report } = await exportDoc(page);
        return { island: document.islands.find((i: any) => i.name === 'Test') as Record<string, any>, document, report };
    };

    test('AE3 round trip: unknown, non-villa and repeated entries return in content and order', async ({ page }) => {
        const entries = [{ item: UNKNOWN_ITEM }, { item: WORKFORCE_ONLY, boosted: true }, { item: BREAD_ITEM, boosted: true }, { item: BREAD_ITEM }, { item: NANNY }];
        const res = await importText(page, fileOf([{ id: 'x', name: 'Test', session: LATIUM, residenceItems: entries }]));
        expect(res.ok).toBe(true);
        const { island: out } = await island(page);
        expect(out.residenceItems).toEqual(entries);
    });

    test('AE7: a state changed in the page is exported, the other entry stays', async ({ page }) => {
        await importText(page, fileOf([{ id: 'x', name: 'Test', session: LATIUM, residenceItems: [{ item: BREAD_ITEM }, { item: NANNY, boosted: true }] }]));
        await page.evaluate((g) => {
            const island = window.view.islands().find((i: any) => i.name() === 'Test');
            island.assetsMap.get(g).slotStates.values().next().value(2);
        }, BREAD_ITEM);
        const { island: out } = await island(page);
        const byItem = Object.fromEntries(out.residenceItems.map((e: any) => [e.item, e]));
        expect(byItem[BREAD_ITEM]).toEqual({ item: BREAD_ITEM, boosted: true });
        expect(byItem[NANNY]).toEqual({ item: NANNY, boosted: true });
    });

    test('state Off writes no entry and no field when nothing is preserved', async ({ page }) => {
        await importText(page, fileOf([{ id: 'x', name: 'Test', session: LATIUM, residenceItems: [{ item: BREAD_ITEM }] }]));
        await page.evaluate((g) => {
            const island = window.view.islands().find((i: any) => i.name() === 'Test');
            island.assetsMap.get(g).slotStates.values().next().value(0);
        }, BREAD_ITEM);
        const { island: out } = await island(page);
        expect(out.residenceItems).toBeUndefined();
    });

    test('a state 2 on an item without a boost variant exports as equipped and is reported', async ({ page }) => {
        await importText(page, fileOf([{ id: 'x', name: 'Test', session: LATIUM, residenceItems: [{ item: NO_BOOST_VILLA }] }]));
        await page.evaluate((g) => {
            const island = window.view.islands().find((i: any) => i.name() === 'Test');
            island.storage.setItem(`residenceItem.${g}.state`, 2);
        }, NO_BOOST_VILLA);
        const { island: out, report } = await island(page);
        expect(out.residenceItems).toEqual([{ item: NO_BOOST_VILLA }]);
        expect(report.map((r: any) => r.code)).toContain('item-boost-dropped');
    });

    test('villaCoverage: stored 50 exports as {default: 50}, byLevel returns unchanged, no key writes no field', async ({ page }) => {
        await importText(page, fileOf([{ id: 'x', name: 'Test', session: LATIUM, villaCoverage: { default: 30, byLevel: { '1496': 10 } } }]));
        let out = (await island(page)).island;
        expect(out.villaCoverage).toEqual({ default: 30, byLevel: { '1496': 10 } });

        await page.evaluate(() => { window.view.islands().find((i: any) => i.name() === 'Test').villaCoverage(50); });
        out = (await island(page)).island;
        expect(out.villaCoverage).toEqual({ default: 50, byLevel: { '1496': 10 } });

        await importText(page, fileOf([{ id: 'x', name: 'Test', session: LATIUM }]));
        out = (await island(page)).island;
        expect(out.villaCoverage).toBeUndefined();
        expect(out.residenceItems).toBeUndefined();
    });

    test('R16: population returns unchanged and sets no residences; unapplied coverage fields return unchanged', async ({ page }) => {
        const extra = {
            population: { '1496': 120 },
            residenceEffects: { '1496': { '99014': 62.5, '140536': 27.7 } },
            publicCoverages: { '1496': { '3527': 84.4, '99999': 5 } },
            publicCoverage: 100,
        };
        await importText(page, fileOf([{ id: 'x', name: 'Test', session: LATIUM, ...extra }]));
        const { island: out } = await island(page);
        for (const key of ['population', 'publicCoverages', 'publicCoverage']) expect(out[key]).toEqual((extra as any)[key]);
        // the effect lists every level it reaches: the levels the file left out return as 0
        expect(out.residenceEffects['1496']).toEqual(extra.residenceEffects['1496']);
        for (const level of Object.keys(out.residenceEffects).filter((l) => l !== '1496')) expect(out.residenceEffects[level]).toEqual({ '99014': 0 });
        const built = await page.evaluate(() => window.view.islands().find((i: any) => i.name() === 'Test').residenceBuildings.reduce((s: number, r: any) => s + r.buildings.constructed(), 0));
        expect(built).toBe(0);
    });

    test('the exported document validates against the schema', async ({ page }) => {
        await importText(page, fileOf([{ id: 'x', name: 'Test', session: LATIUM, villaCoverage: 40, residenceItems: [{ item: BREAD_ITEM, boosted: true }, { item: UNKNOWN_ITEM }] }]));
        await settle(page);
        const { document } = await island(page);
        expect(validateSchema(document), JSON.stringify(validateSchema.errors)).toBe(true);
    });

    test('an import reaches the page: the item state and the coverage are active on the island', async ({ page }) => {
        await importText(page, fileOf([{ id: 'x', name: 'Test', session: LATIUM, villaCoverage: { default: 50 }, residenceItems: [{ item: BREAD_ITEM, boosted: false }] }]));
        await page.evaluate(() => { window.view.selectedIsland?.(window.view.islands().find((i: any) => i.name() === 'Test')); });
        const r = await page.evaluate((g) => {
            const island = window.view.islands().find((i: any) => i.name() === 'Test');
            const res = island.assetsMap.get(3141);
            res.buildings.constructed(10);
            const need = res.needsMap.get(2689);
            need.checked(true);
            const withItem = need.amount();
            island.assetsMap.get(g).slotStates.values().next().value(0);
            return { cov: island.villaCoverage(), ratio: withItem / need.amount() };
        }, BREAD_ITEM);
        expect(r.cov).toBe(50);
        expect(r.ratio).toBeCloseTo(0.9, 6);
    });
});
