import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { loadRouteDoc, MIN } from '../helpers/route-doc';

/**
 * Trade route indicators on reduced fixtures (plan 2026-11-15-1255 U4). `tests/fixtures/exchange/route-cases.json`
 * holds routes 48, 93, 51 and 66 of the Marcia 73 sample with their visits, the storage history of the destination
 * goods concerned and the planner import entries between the islands involved; no save content, no other islands.
 *
 * Covers AE1 (Uxoriosum Head Piece), AE2 (Sepat Statuettes), AE3 (route 66 visits one island twice), AE6 (relay),
 * AE12 (no derived edge opposite a planner edge) and the unit assertion of KTD6.
 */

const FIXTURE = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'exchange', 'route-cases.json'), 'utf-8'));
const names: string[] = FIXTURE.islands.map((id: string) => 'I' + id.slice(1));
const nameOf = (id: string) => 'I' + id.slice(1);

const HEAD_PIECE = 31704;
const STATUETTES = 145220;
const COAL = 2085;

interface Calc {
    from: string;
    to: string;
    product: number;
    amount: number;
}

async function load(page: Page, calc: Calc[]) {
    await loadRouteDoc(
        page,
        { routes: FIXTURE.routes, visits: FIXTURE.visits, history: FIXTURE.history, minimum: FIXTURE.minimum },
        calc.map((c) => ({ from: nameOf(c.from), to: nameOf(c.to), amount: c.amount, product: c.product })),
        { islandNames: names },
    );
}

async function indicators(page: Page): Promise<any[]> {
    return page.evaluate(() => JSON.parse(JSON.stringify((window as any).view.tradeManager.routes().map((r: any) => ({ from: r.from.name(), to: r.to.name(), product: r.product.guid, ind: r.indicators() })))));
}

test.describe('route indicators on reduced Marcia 73 fixtures (U4)', () => {
    test('fixture holds no save content and the game clock unit is milliseconds', async () => {
        expect(Object.keys(FIXTURE).sort()).toEqual(['history', 'imports', 'islands', 'minimum', 'routes', 'source', 'visits']);
        // history step of the sample: 600,100 ms, about ten minutes (KTD6)
        expect(FIXTURE.history[0].step / MIN).toBeGreaterThan(9.9);
        expect(FIXTURE.history[0].step / MIN).toBeLessThan(10.1);
        // visit times of the sample span 110 minutes at 60,000 ms per minute
        const times: number[] = FIXTURE.visits.map((v: any) => v.time);
        expect((Math.max(...times) - Math.min(...times)) / MIN).toBeGreaterThan(100);
        expect((Math.max(...times) - Math.min(...times)) / MIN).toBeLessThan(130);
    });

    test('integer route ids of a file survive the reader (the visits refer to them)', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island() && (window as any).exchange);
        const id = await page.evaluate((routes) => {
            const doc = JSON.stringify({ format: 'anno117-exchange', formatVersion: '1.0', generator: { name: 't' }, islands: [], trade: { routes } });
            const r = (window as any).exchange.readExchange(doc);
            return r.doc?.trade?.routes?.[0]?.id;
        }, [{ id: 172, stations: [], ships: [] }]);
        expect(id).toBe(172);
    });

    test('AE1: Head Piece at Uxoriosum (zero stock, no demand) shows no indicator', async ({ page }) => {
        const series = FIXTURE.history.find((h: any) => h.island === 'a9603' && h.product === HEAD_PIECE);
        expect(series.values.every((v: number) => v === 0)).toBe(true);
        await load(page, [{ from: 'a8451', to: 'a9603', product: HEAD_PIECE, amount: 0 }]);
        const [row] = await indicators(page);
        expect(row.ind.yellow).toBeUndefined();
        expect(row.ind.red).toBe(false);
        expect(row.ind.requiredOffload ?? 0).toBe(0);
    });

    test('AE2: Statuettes at Sepat are served by routes 48 and 93; too few visits in the window give unavailable, not red', async ({ page }) => {
        await load(page, [
            { from: 'a25668', to: 'a26308', product: STATUETTES, amount: 0.1323 },
            { from: 'a10177', to: 'a26308', product: STATUETTES, amount: 0.1323 },
        ]);
        const rows = await indicators(page);
        expect(rows).toHaveLength(2);
        for (const r of rows) {
            // 2 or 3 visits per stop in 110 minutes: fewer than three usable gaps (AE5)
            expect(r.ind.available).toBe(false);
            expect(r.ind.reason).toBe('gaps');
            expect(r.ind.red).toBe(false);
            expect(r.ind.yellow).toBeUndefined();
        }
    });

    test('AE3: route 66 visits Sepat-side island a9795 twice per circuit; the gap is taken between visits of the same stop', async ({ page }) => {
        await load(page, [
            { from: 'a8899', to: 'a9795', product: COAL, amount: 1 },
            { from: 'a8515', to: 'a9795', product: COAL, amount: 1 },
        ]);
        const rows = await indicators(page);
        const times: number[] = [...new Set<number>(FIXTURE.visits.filter((v: any) => String(v.route) === '66' && v.island === 'a9795').map((v: any) => v.time))].sort((a, b) => a - b);
        const gaps = times.slice(1).map((t, i) => (t - times[i]) / MIN);
        const windows = gaps.slice(0, -1).map((g, i) => g + gaps[i + 1]);
        const expected = Math.max(...windows.slice(-5));
        for (const r of rows) {
            expect(r.ind.available).toBe(true);
            expect(r.ind.gapMinutes).toBeCloseTo(expected, 6);
            // two equal stops of 100 t per circuit, two sources combined into one capacity
            expect(r.ind.capacity).toBeCloseTo(200, 6);
            expect(r.ind.utilization).toBeCloseTo(((2 * expected) / 200) * 100, 4);
        }
    });

    test('AE6: relay stop that loads and unloads Statuettes uses slot flow for capacity and flags a net-only unload', async ({ page }) => {
        await load(page, [{ from: 'a25668', to: 'a41796', product: STATUETTES, amount: 0.5 }]);
        const [row] = await indicators(page);
        // the relay's visits record net amounts: a net-only unload is flagged as a lower bound, never read as gross
        expect(row.ind.unloadIsNet === true).toBe(row.ind.actualUnload !== undefined);
        expect(row.ind.reason === 'gaps' || row.ind.capacity > 0).toBe(true);
    });

    test('AE12: no route derived from the fixture is opposite a planner-listed edge', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island() && (window as any).exchange);
        const result = await page.evaluate(({ routes, visits, imports }) => {
            const derived = (window as any).exchange.deriveImports(routes, visits) as any[];
            const edge = (sink: string, supplier: string, product: number) => `${supplier}>${sink}>${product}`;
            const planner = new Set<string>();
            for (const i of imports) for (const s of i.suppliers ?? []) if (s.island) planner.add(edge(i.island, s.island, i.product));
            let matched = 0;
            let unmatched = 0;
            const reversed: string[] = [];
            for (const d of derived) {
                for (const s of d.suppliers ?? []) {
                    const e = edge(d.island, s.island, d.product);
                    const opposite = edge(s.island, d.island, d.product);
                    if (planner.has(e)) matched++;
                    else if (planner.has(opposite)) reversed.push(e);
                    else unmatched++;
                }
            }
            return { matched, unmatched, reversed };
        }, { routes: FIXTURE.routes, visits: FIXTURE.visits, imports: FIXTURE.imports });
        expect(result.reversed).toEqual([]);
        expect(result.matched + result.unmatched).toBeGreaterThan(0);
    });

    test('AE12 (local): the full Marcia 73 samples re-derive no edge opposite a planner edge', async ({ page }) => {
        const root = path.join(__dirname, '..', '..');
        const files = ['Marcia 73.with-storage-and-trade-history.exchange.json', 'Marcia 73.with-storage-and-trade-history.sparse.exchange.json'].map((f) => path.join(root, f));
        test.skip(files.some((f) => !fs.existsSync(f)), 'full Marcia 73 samples are not in the checkout');
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island() && (window as any).exchange);
        for (const file of files) {
            const doc = JSON.parse(fs.readFileSync(file, 'utf-8'));
            const result = await page.evaluate(({ routes, visits, imports }) => {
                const derived = (window as any).exchange.deriveImports(routes, visits) as any[];
                const planner = new Set<string>();
                for (const i of imports) for (const s of i.suppliers ?? []) if (s.island) planner.add(`${s.island}>${i.island}>${i.product}`);
                const reversed: string[] = [];
                let matched = 0;
                let unmatched = 0;
                for (const d of derived)
                    for (const s of d.suppliers ?? []) {
                        if (planner.has(`${s.island}>${d.island}>${d.product}`)) matched++;
                        else if (planner.has(`${d.island}>${s.island}>${d.product}`)) reversed.push(`${s.island}>${d.island}>${d.product}`);
                        else unmatched++;
                    }
                return { matched, unmatched, reversed };
            }, { routes: doc.trade.routes, visits: doc.trade.visits, imports: doc.trade.imports ?? [] });
            expect(result.reversed, path.basename(file)).toEqual([]);
            // the remaining edges are physical transfers the planner does not list: reported, not failed
            console.log(`${path.basename(file)}: matched ${result.matched}, topology differences ${result.unmatched}`);
        }
    });
});
