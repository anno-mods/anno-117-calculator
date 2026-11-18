import { test, expect, Page } from '@playwright/test';
import { exportDoc, fileOf, importText, openApp, validateSchema } from '../helpers/exchange';

// publicCoverages and publicCoverage (plan 2026-11-12-002 U10): import plan, store keys, export and round trip.
//   3527 / 3528  public buildings of params.publicServices (Market, Tavern); levels 1496 to 1499 have residences
//   3617 is not asserted to exist; 99999 is no building of the data
const LATIUM = 3245;
const MARKET = 3527;
const TAVERN = 3528;
const UNKNOWN_BUILDING = 99999;

interface Entry { kind: string; code: string; message: string; detail?: Record<string, any> }
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

test.describe('publicCoverages: import plan', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    test('applied leaves are stored, clamped and reported; leaves without data are kept at their pointer', async ({ page }) => {
        const i = await planOne(page, {
            publicCoverages: { '1496': { [MARKET]: 84.4, [TAVERN]: 120, [UNKNOWN_BUILDING]: 5 }, '777': { [MARKET]: 10 } },
        });
        expect(i.store[`1496[${MARKET}].publicCoverage`]).toBe(84.4);
        expect(i.store[`1496[${TAVERN}].publicCoverage`]).toBe(100);
        expect(codes(i.report)).toContain('public-coverage-clamped');
        expect(i.ext.captured.map((c: any) => c.pointer).sort()).toEqual([`/publicCoverages/1496/${UNKNOWN_BUILDING}`, `/publicCoverages/777/${MARKET}`].sort());
        expect(i.report.filter((e) => e.code === 'public-coverage-not-applied').length).toBe(2);
    });

    test('the scalar publicCoverage is stored; a non-number is kept; the spec shape is kept', async ({ page }) => {
        expect((await planOne(page, { publicCoverage: 70 })).store.publicCoverage).toBe(70);
        expect((await planOne(page, { publicCoverage: 100 })).store.publicCoverage).toBe(100);
        const bad = await planOne(page, { publicCoverage: 'all' });
        expect(bad.store.publicCoverage).toBeUndefined();
        expect(bad.ext.captured.map((c: any) => c.pointer)).toEqual(['/publicCoverage']);
        const spec = await planOne(page, { publicCoverages: { default: 40 } });
        expect(spec.ext.captured.map((c: any) => c.pointer)).toEqual(['/publicCoverages/default']);
        expect(Object.keys(spec.store).filter((k) => /publicCoverage/.test(k))).toEqual([]);
    });
});

test.describe('publicCoverages: export and round trip', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    test('applied and unapplied leaves return, the scalar returns, and the document validates', async ({ page }) => {
        const publicCoverages = { '1496': { [MARKET]: 84.4, [UNKNOWN_BUILDING]: 5 }, '1497': { [TAVERN]: 40 } };
        const text = fileOf([{ id: 'x', name: 'Test', session: LATIUM, publicCoverages, publicCoverage: 100 }]);
        expect((await importText(page, text)).ok).toBe(true);
        const { document } = await exportDoc(page);
        const out = document.islands.find((i: any) => i.name === 'Test');
        expect(out.publicCoverages).toEqual(publicCoverages);
        expect(out.publicCoverage).toBe(100);
        expect(validateSchema(document), JSON.stringify(validateSchema.errors)).toBe(true);
    });

    test('an edited share is exported; nothing stored writes no field', async ({ page }) => {
        await importText(page, fileOf([{ id: 'x', name: 'Test', session: LATIUM }]));
        let out = (await exportDoc(page)).document.islands.find((i: any) => i.name === 'Test');
        expect(out.publicCoverages).toBeUndefined();
        expect(out.publicCoverage).toBeUndefined();
        await page.evaluate(({ m }) => { (window as any).view.island().publicCoverage(1496, m)(33); }, { m: MARKET });
        out = (await exportDoc(page)).document.islands.find((i: any) => i.name === 'Test');
        expect(out.publicCoverages).toEqual({ '1496': { [MARKET]: 33 } });
    });
});

test.describe('publicCoverages without public-building data', () => {
    test('every leaf is reported not applied and returns unchanged', async ({ page }) => {
        await page.route('**/js/params.js', async (route) => {
            const response = await route.fetch();
            await route.fulfill({ response, body: (await response.text()) + '\n;window.params.publicServices = [];' });
        });
        await openApp(page);
        const publicCoverages = { '1496': { [MARKET]: 84.4 } };
        const i = await planOne(page, { publicCoverages });
        expect(i.report.filter((e) => e.code === 'public-coverage-not-applied').length).toBe(1);
        expect(Object.keys(i.store).filter((k) => /publicCoverage/.test(k))).toEqual([]);
        await importText(page, fileOf([{ id: 'x', name: 'Test', session: LATIUM, publicCoverages }]));
        const out = (await exportDoc(page)).document.islands.find((x: any) => x.name === 'Test');
        expect(out.publicCoverages).toEqual(publicCoverages);
    });
});
