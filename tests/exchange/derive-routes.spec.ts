import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// U7: supplier sets derived from savegame routes (src/exchange/derive-routes.ts) and the gate of the re-calculation
// toggle. The vendored conformance fixtures trade-*.json hold routes and the expected `trade.imports`.

const FIXTURES = path.join(__dirname, '..', '..', 'vendor', 'anno117-exchange', 'fixtures', 'valid');
const BREAD = 2137;

interface Supplier { island?: string; share?: number; default?: boolean; amount?: number }
interface Entry { island: string; product: number; basis?: string; suppliers: Supplier[] }

async function ready(page: Page) {
    await page.goto('/');
    await page.waitForFunction(() => window.view && window.view.island() && window.exchange);
}

async function derive(page: Page, routes: unknown[], visits: unknown[] = []): Promise<Entry[]> {
    return page.evaluate(({ r, v }) => window.exchange.deriveImports(r as never, v as never), { r: routes, v: visits }) as Promise<Entry[]>;
}

function byPair(entries: Entry[]): Map<string, Entry> {
    return new Map(entries.map((e) => [`${e.island}|${e.product}`, e]));
}

const fixtures = fs.readdirSync(FIXTURES).filter((f) => f.startsWith('trade-') && f.endsWith('.json'));

function route(id: string, stations: unknown[], ships: unknown[] = [{ type: 1001, slots: 4, count: 1 }]) {
    return { id, stations, ships };
}
const load = (product: number, slot = 0, amount = 10) => ({ product, mode: 'load', slot, amount });
const unload = (product: number, slot = 0, amount = 10) => ({ product, mode: 'unload', slot, amount });

test.describe('route derivation (U7)', () => {
    test.beforeEach(async ({ page }) => {
        await ready(page);
    });

    for (const file of fixtures) {
        test(`conformance fixture ${file}: derived suppliers and shares equal the fixture's imports`, async ({ page }) => {
            const doc = JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf-8'));
            const derived = await derive(page, doc.trade.routes, doc.trade.visits ?? []);
            const expected: Entry[] = doc.trade.imports ?? [];
            const got = byPair(derived);
            expect([...got.keys()].sort()).toEqual(expected.map((e) => `${e.island}|${e.product}`).sort());
            for (const e of expected) {
                const d = got.get(`${e.island}|${e.product}`)!;
                expect(d.basis).toBe('planned');
                expect(d.suppliers.map((s) => s.island).sort()).toEqual(e.suppliers.map((s) => s.island).sort());
                for (const s of e.suppliers) {
                    const mine = d.suppliers.find((x) => x.island === s.island)!;
                    expect(mine.share as number).toBeCloseTo(s.share as number, 3);
                    expect(mine.amount).toBeUndefined();
                }
                // exactly one residual supplier, the largest share
                const flagged = d.suppliers.filter((s) => s.default === true);
                expect(flagged.length).toBe(1);
                expect(Math.max(...d.suppliers.map((s) => s.share as number))).toBeCloseTo(flagged[0].share as number, 9);
            }
        });
    }

    test('route with ships [] and with all counts 0 gives no entry', async ({ page }) => {
        const stations = [{ island: 'a', slots: [load(BREAD)] }, { island: 'b', slots: [unload(BREAD)] }];
        expect(await derive(page, [route('r1', stations, [])])).toEqual([]);
        expect(await derive(page, [route('r2', stations, [{ type: 1, count: 0 }])])).toEqual([]);
    });

    test('a station without island is neither sink nor source', async ({ page }) => {
        const only = await derive(page, [route('r1', [{ slots: [load(BREAD)] }, { island: 'b', slots: [unload(BREAD)] }])]);
        expect(only).toEqual([]);
        const sinkless = await derive(page, [route('r2', [{ island: 'a', slots: [load(BREAD)] }, { slots: [unload(BREAD)] }])]);
        expect(sinkless).toEqual([]);
    });

    test('ties in share: the smallest island id is the default', async ({ page }) => {
        const d = await derive(page, [
            route('r1', [
                { island: 'zeta', slots: [load(BREAD, 0)] },
                { island: 'alpha', slots: [load(BREAD, 1)] },
                { island: 'c', slots: [unload(BREAD, 0), unload(BREAD, 1)] },
            ]),
        ]);
        expect(d.length).toBe(1);
        expect(d[0].suppliers.find((s) => s.default)?.island).toBe('alpha');
    });

    test('one route collecting a good at five islands: every source is a supplier of the sink, once each', async ({ page }) => {
        const loads = (slots: number[]) => slots.map((s) => load(BREAD, s, 50));
        const d = await derive(page, [
            route('r73', [
                { island: 'a8451', slots: loads([0, 1, 2, 3, 4]) },
                // slot 2 twice and slot 0 missing, as the savegame extraction delivers it
                { island: 'a8899', slots: [2, 1, 2, 3, 4].map((s) => unload(BREAD, s, 50)) },
                { island: 'a9667', slots: loads([0, 1, 2, 3, 4]) },
                { island: 'a9795', slots: loads([0, 1, 2, 3, 4]) },
                { island: 'a9603', slots: loads([0, 1, 2, 3, 4]) },
                { island: 'a8515', slots: loads([0, 1, 2, 3, 4]) },
            ]),
        ]);
        expect(d.length).toBe(1);
        expect(d[0].island).toBe('a8899');
        expect(d[0].suppliers.map((s) => s.island).sort()).toEqual(['a8451', 'a8515', 'a9603', 'a9667', 'a9795']);
        expect(d[0].suppliers.filter((s) => s.default)).toHaveLength(1);
        for (const s of d[0].suppliers) expect(s.share).toBeCloseTo(0.2, 9);
    });

    test('sources that load different slot indexes serve only their own slots', async ({ page }) => {
        const d = await derive(page, [
            route('r1', [
                { island: 'a', slots: [load(BREAD, 0, 50)] },
                { island: 'b', slots: [load(BREAD, 1, 50), load(BREAD, 2, 50)] },
                { island: 'c', slots: [unload(BREAD, 0, 50), unload(BREAD, 1, 50), unload(BREAD, 2, 50)] },
            ]),
        ]);
        const shares = Object.fromEntries(d[0].suppliers.map((s) => [s.island, s.share as number]));
        expect(shares.a).toBeCloseTo(1 / 3, 9);
        expect(shares.b).toBeCloseTo(2 / 3, 9);
    });

    test('a good that is never unloaded gives no entry', async ({ page }) => {
        expect(await derive(page, [route('r1', [{ island: 'a', slots: [load(BREAD)] }, { island: 'b', slots: [load(BREAD)] }])])).toEqual([]);
    });

    test('Roma-Ostia with Bread: entry for Roma, supplier Ostia, default, no amount (AE5, derivation half)', async ({ page }) => {
        const d = await derive(page, [route('r1', [{ island: 'ostia', slots: [load(BREAD)] }, { island: 'roma', slots: [unload(BREAD)] }])]);
        expect(d).toEqual([{ island: 'roma', product: BREAD, basis: 'planned', suppliers: [{ island: 'ostia', share: 1, default: true }] }]);
    });

    test('a malformed route is skipped without throwing', async ({ page }) => {
        const d = await derive(page, [{ id: 'bad', ships: [{ count: 1 }] }, null, route('ok', [{ island: 'a', slots: [load(BREAD)] }, { island: 'b', slots: [unload(BREAD)] }])]);
        expect(d.map((e) => e.island)).toEqual(['b']);
    });

    test('hasShipRoutes ignores source.kind and generator.name and counts ships only', async ({ page }) => {
        const result = await page.evaluate((b) => {
            const ex = window.exchange;
            const ships = [{ type: 1, count: 1 }];
            const st = [{ island: 'a', slots: [{ product: b, mode: 'load' }] }];
            return {
                planner: ex.hasShipRoutes({ trade: { routes: [{ id: 'r', stations: st, ships }] }, generator: { name: 'anno117-planner' } } as never),
                savegame: ex.hasShipRoutes({ trade: { routes: [{ id: 'r', stations: st, ships }] }, source: { kind: 'savegame' } } as never),
                emptyShips: ex.hasShipRoutes({ trade: { routes: [{ id: 'r', stations: st, ships: [] }] } }),
                zeroCounts: ex.hasShipRoutes({ trade: { routes: [{ id: 'r', stations: st, ships: [{ type: 1, count: 0 }] }] } }),
                noRoutes: ex.hasShipRoutes({ trade: { imports: [] } }),
                noTrade: ex.hasShipRoutes({}),
            };
        }, BREAD);
        expect(result).toEqual({ planner: true, savegame: true, emptyShips: false, zeroCounts: false, noRoutes: false, noTrade: false });
    });
});
