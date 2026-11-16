import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// U6: import plan for trade and suppliers (tradeRoutes entries, default supplier keys, preserved parts, report).
// Pure function, no storage writes. Stored route shape (src/trade.ts TradeRouteConfig):
// {productGUID, from, to, userSetAmount, isDefaultSupplier}; `from` supplies `to`.

const FIXTURES = path.join(__dirname, '..', '..', 'vendor', 'anno117-exchange', 'fixtures');

function fixtureText(file: string): string {
    return fs.readFileSync(path.join(FIXTURES, file), 'utf-8');
}

// Real GUIDs of js/params.js
const LATIUM = 3245;
const DATES = 151680;
const GOLD = 31698;
const BREAD = 2137;
const GOLDSMITH = 152358; // Gold producer, Egyptian
const OTHER_GOLD_FACTORY = 31755;
const BAKERY = 3174;

interface Entry { kind: string; code: string; island?: string; message: string; detail?: Record<string, any> }
interface StoredRoute { productGUID: number; from: string; to: string; userSetAmount: number; isDefaultSupplier: boolean }
interface TradePlan {
    tradeRoutes: StoredRoute[];
    islands: Record<string, { store: Record<string, any>; ext: { preservedImports: any[]; minimumStock?: Record<string, number>; guids: any[] } }>;
    document: { trade?: { routes?: any[]; visits?: any[]; governorHarbours?: any[] }; preservedImports: any[] };
    report: Entry[];
}

async function ready(page: Page) {
    await page.goto('/');
    await page.waitForFunction(() => window.view && window.view.island() && window.exchange);
}

function doc(islands: Record<string, any>[], trade?: Record<string, any>): string {
    return JSON.stringify({
        format: 'anno117-exchange',
        formatVersion: '1.0',
        generator: { name: 'u6-test' },
        ...(trade ? { trade } : {}),
        islands,
    });
}

function isl(id: string, extra: Record<string, any> = {}): Record<string, any> {
    return { id, name: id.toUpperCase(), session: LATIUM, ...extra };
}

async function planFull(page: Page, text: string, opts: Record<string, any> = {}): Promise<{ trade: TradePlan; islands: any }> {
    return page.evaluate(({ t, o }) => {
        const ex = window.exchange;
        const r = ex.readExchange(t);
        if ('error' in r) throw new Error(r.error);
        const islands = ex.planIslands(r);
        const trade = ex.planTrade(islands, r, o as never);
        return { trade, islands };
    }, { t: text, o: opts });
}

async function plan(page: Page, text: string): Promise<TradePlan> {
    return (await planFull(page, text)).trade;
}

function imp(island: string, product: number, suppliers: Record<string, any>[], extra: Record<string, any> = {}) {
    return { island, product, basis: 'planned', suppliers, ...extra };
}

function codes(entries: Entry[]): string[] {
    return entries.map((e) => e.code);
}

test.describe('import plan: trade (U6)', () => {
    test.beforeEach(async ({ page }) => {
        await ready(page);
    });

    test('planTrade is registered and creates no storage', async ({ page }) => {
        const before = await page.evaluate(() => localStorage.length);
        const p = await plan(page, doc([isl('a'), isl('b')], { imports: [imp('b', DATES, [{ island: 'a', share: 1 }])] }));
        expect(p.tradeRoutes.length).toBe(1);
        const after = await page.evaluate(() => ({ n: localStorage.length, a: localStorage.getItem('A') }));
        expect(after.a).toBeNull();
        expect(after.n).toBe(before);
    });

    test('dates distribution: four default routes from the source island at userSetAmount 0 (AE13)', async ({ page }) => {
        const { trade, islands } = await planFull(page, fixtureText('valid/trade-distribution-circuit-relays.json'));
        expect(trade.tradeRoutes).toEqual(
            ['B', 'C', 'D', 'E'].map((to) => ({ productGUID: DATES, from: 'A', to, userSetAmount: 0, isDefaultSupplier: true })),
        );
        expect(islands.islands.map((i: Record<string, any>) => i.name)).toEqual(['A', 'B', 'C', 'D', 'E']);
        // trade-route defaults leave the product's stored default alone (KTD9)
        for (const i of Object.values(trade.islands)) {
            expect(Object.keys(i.store).filter((k) => k.includes('defaultSupplier'))).toEqual([]);
        }
        expect(codes(trade.report)).not.toContain('routes-imports-disagree');
    });

    test('shares 2:1: the larger is the default, the smaller an ordinary route at 0 (AE14)', async ({ page }) => {
        const p = await plan(
            page,
            doc([isl('a'), isl('b'), isl('c')], { imports: [imp('c', DATES, [{ island: 'a', share: 0.3333 }, { island: 'b', share: 0.6667 }])] }),
        );
        expect(p.tradeRoutes).toEqual([
            { productGUID: DATES, from: 'A', to: 'C', userSetAmount: 0, isDefaultSupplier: false },
            { productGUID: DATES, from: 'B', to: 'C', userSetAmount: 0, isDefaultSupplier: true },
        ]);
    });

    test('shares 2:1 with supplier amounts: both keep their amounts, the default is still the larger', async ({ page }) => {
        const p = await plan(
            page,
            doc([isl('a'), isl('b'), isl('c')], {
                imports: [imp('c', DATES, [{ island: 'a', share: 2, amount: 4 }, { island: 'b', share: 1, amount: 2 }], { basis: 'entered' })],
            }),
        );
        expect(p.tradeRoutes).toEqual([
            { productGUID: DATES, from: 'A', to: 'C', userSetAmount: 4, isDefaultSupplier: true },
            { productGUID: DATES, from: 'B', to: 'C', userSetAmount: 2, isDefaultSupplier: false },
        ]);
    });

    test('equal shares: the lexically smallest island id is the default', async ({ page }) => {
        const p = await plan(
            page,
            doc([isl('zeta'), isl('alpha'), isl('c')], { imports: [imp('c', DATES, [{ island: 'zeta', share: 0.5 }, { island: 'alpha', share: 0.5 }])] }),
        );
        const dflt = p.tradeRoutes.filter((r) => r.isDefaultSupplier);
        expect(dflt.length).toBe(1);
        expect(dflt[0].from).toBe('ALPHA');
    });

    test('an explicit default flag on the smaller supplier makes it the default route', async ({ page }) => {
        const p = await plan(
            page,
            doc([isl('a'), isl('b'), isl('c')], {
                imports: [imp('c', DATES, [{ island: 'a', share: 0.9 }, { island: 'b', share: 0.1, default: true }])],
            }),
        );
        expect(p.tradeRoutes.map((r) => [r.from, r.isDefaultSupplier])).toEqual([['A', false], ['B', true]]);
    });

    test('no default flag and no share: all routes ordinary, product default left alone, minimum zero routes written, a planned amount is kept and no floor (R54, R19a)', async ({ page }) => {
        const p = await plan(page, doc([isl('a'), isl('b'), isl('c')], { imports: [imp('c', DATES, [{ island: 'a' }, { island: 'b', amount: 3 }])] }));
        expect(p.tradeRoutes).toEqual([
            { productGUID: DATES, from: 'A', to: 'C', userSetAmount: 0, isDefaultSupplier: false },
            { productGUID: DATES, from: 'B', to: 'C', userSetAmount: 0, isDefaultSupplier: false },
        ]);
        expect(Object.keys(p.islands['C'].store).filter((k) => k.includes('defaultSupplier'))).toEqual([]);
    });

    test('two flagged defaults: reported, entry preserved, nothing written (R54)', async ({ page }) => {
        const entry = imp('c', DATES, [{ island: 'a', default: true }, { island: 'b', default: true }]);
        const p = await plan(page, doc([isl('a'), isl('b'), isl('c')], { imports: [entry] }));
        expect(p.tradeRoutes).toEqual([]);
        expect(Object.keys(p.islands['C'].store)).toEqual([]);
        expect(codes(p.report)).toContain('ambiguous-default');
        const kept = p.islands['C'].ext.preservedImports;
        expect(kept.length).toBe(1);
        expect(kept[0].reasons).toContain('ambiguous-default');
        expect(kept[0].entry).toEqual(entry);
        expect(kept[0].restore.routes).toEqual([]);
    });

    test('default route with amount 10: userSetAmount 10 (the calculator supplies max(userSetAmount, amount), surplus is excess production)', async ({ page }) => {
        const p = await plan(page, doc([isl('a'), isl('b')], { imports: [imp('b', BREAD, [{ island: 'a', default: true, amount: 10 }], { basis: 'entered' })] }));
        expect(p.tradeRoutes).toEqual([{ productGUID: BREAD, from: 'A', to: 'B', userSetAmount: 10, isDefaultSupplier: true }]);
    });

    test('Listening Weasel Nome Gold: local producer fully utilized, Cinis route default at 0 (R51)', async ({ page }) => {
        const text = doc(
            [
                isl('cinis', { name: 'Cinis', buildings: { [GOLDSMITH]: { built: 2 }, [OTHER_GOLD_FACTORY]: { built: 0 } } }),
                isl('roma', { name: 'Roma' }),
            ],
            { imports: [imp('cinis', GOLD, [{ island: 'roma', share: 1 }])] },
        );
        const { trade } = await planFull(page, text);
        expect(trade.tradeRoutes).toEqual([{ productGUID: GOLD, from: 'Roma', to: 'Cinis', userSetAmount: 0, isDefaultSupplier: true }]);
        expect(trade.islands['Cinis'].store).toEqual({ [`${GOLDSMITH}.buildings.fullyUtilizeConstructed`]: '1' });
        expect(trade.report.some((e) => e.code === 'local-producer-utilized' && e.island === 'cinis')).toBe(true);
    });

    test('local producer with fullyUtilize false in the file keeps the flag at "0" (R15, R51)', async ({ page }) => {
        const text = doc(
            [
                isl('cinis', { name: 'Cinis', buildings: { [GOLDSMITH]: { built: 2, fullyUtilize: false } } }),
                isl('roma', { name: 'Roma' }),
            ],
            { imports: [imp('cinis', GOLD, [{ island: 'roma', share: 1 }])] },
        );
        const { trade, islands } = await planFull(page, text);
        expect(trade.islands['Cinis'].store).toEqual({});
        expect(islands.islands[0].store[`${GOLDSMITH}.buildings.fullyUtilizeConstructed`]).toBe('0');
        expect(trade.tradeRoutes.length).toBe(1);
    });

    test('governor flagged default next to an island supplier with a share: governor is the residual, nothing is the default route (R54)', async ({ page }) => {
        const entry = imp('b', BREAD, [{ governor: 4711, default: true }, { island: 'a', share: 1, amount: 3 }]);
        const p = await plan(page, doc([isl('a'), isl('b')], { imports: [entry] }));
        expect(p.tradeRoutes).toEqual([{ productGUID: BREAD, from: 'A', to: 'B', userSetAmount: 0, isDefaultSupplier: false }]);
        expect(Object.keys(p.islands['B'].store).filter((k) => k.includes('defaultSupplier'))).toEqual([]);
        expect(Object.keys(p.islands['B'].store).filter((k) => k.includes('passiveTrade'))).toEqual([]);
        expect(codes(p.report)).toContain('governor-default');
        const kept = p.islands['B'].ext.preservedImports;
        expect(kept.length).toBe(1);
        expect(kept[0].entry).toEqual(entry);
        expect(kept[0].preserved).toEqual([{ governor: 4711, default: true }]);
        expect(kept[0].restore.routes).toEqual([{ from: 'A', to: 'B', userSetAmount: 0, isDefaultSupplier: false }]);

        const zero = await plan(page, doc([isl('a'), isl('b')], { imports: [imp('b', BREAD, [{ governor: 4711, default: true }, { island: 'a', share: 1 }])] }));
        expect(zero.tradeRoutes[0].userSetAmount).toBe(0);
        expect(zero.tradeRoutes[0].isDefaultSupplier).toBe(false);
    });

    test('governor and island supplier both flagged default: more than one default, nothing written', async ({ page }) => {
        const p = await plan(
            page,
            doc([isl('a'), isl('b')], { imports: [imp('b', BREAD, [{ governor: 4711, default: true }, { island: 'a', default: true }])] }),
        );
        expect(p.tradeRoutes).toEqual([]);
        expect(codes(p.report)).toContain('ambiguous-default');
        expect(p.islands['B'].ext.preservedImports.length).toBe(1);
    });

    test('governor goods with different rates: suppliers and governorHarbours unchanged in ext, no route and no key (R52, R46)', async ({ page }) => {
        const harbours = [
            { governor: 4711, region: 'Latium', position: { x: 1, y: 2 }, goods: [{ product: BREAD, rate: 2.5 }, { product: DATES, rate: 0.5 }], stockLimits: { [BREAD]: 40 } },
        ];
        const imports = [imp('a', BREAD, [{ governor: 4711, share: 1 }]), imp('a', DATES, [{ governor: 4711, share: 1 }])];
        const p = await plan(page, doc([isl('a')], { imports, governorHarbours: harbours }));
        expect(p.tradeRoutes).toEqual([]);
        expect(p.islands['A'].store).toEqual({});
        expect(p.document.trade?.governorHarbours).toEqual(harbours);
        expect(p.islands['A'].ext.preservedImports.map((k) => k.entry)).toEqual(imports);
        expect(codes(p.report)).toContain('governor-supplier');
        expect(codes(p.report)).toContain('governor-harbours');
    });

    test('governor amount next to an island supplier: governor supply key, one route, one applied report line (AE1, R1, R5)', async ({ page }) => {
        const entry = imp('b', BREAD, [{ island: 'a', amount: 2 }, { governor: 777, amount: 4 }]);
        const p = await plan(page, doc([isl('a'), isl('b')], { imports: [entry] }));
        expect(p.islands['B'].store[`${BREAD}.governorSupply`]).toBe(4);
        expect(p.tradeRoutes.length).toBe(1);
        expect(p.tradeRoutes[0].from).toBe('A');
        const applied = p.report.filter((r) => r.code === 'governor-supply-applied');
        expect(applied.length).toBe(1);
        expect(applied[0].kind).toBe('approximated');
        expect(applied[0].detail).toMatchObject({ governor: 777, product: BREAD, amount: 4 });
        expect(p.report.map((r) => r.code)).not.toContain('governor-supplier');
        const kept = p.islands['B'].ext.preservedImports;
        expect(kept.length).toBe(1);
        expect(kept[0].restore.governorSupply).toBe(4);
    });

    test('governor without amount supplies nothing and stays preserved (AE2, R2)', async ({ page }) => {
        const entry = imp('b', BREAD, [{ island: 'a', amount: 2 }, { governor: 777 }, { governor: 778, amount: 0 }]);
        const p = await plan(page, doc([isl('a'), isl('b')], { imports: [entry] }));
        expect(Object.keys(p.islands['B'].store).filter((k) => k.includes('governorSupply'))).toEqual([]);
        expect(codes(p.report)).toContain('governor-supplier');
        expect(codes(p.report)).not.toContain('governor-supply-applied');
        const kept = p.islands['B'].ext.preservedImports;
        expect(kept[0].entry).toEqual(entry);
        expect(kept[0].restore.governorSupply).toBe(0);
    });

    test('governor flagged default with an amount: supply applied, no route, no default key (AE3, R3, R4)', async ({ page }) => {
        const p = await plan(page, doc([isl('a'), isl('b')], { imports: [imp('b', BREAD, [{ governor: 777, amount: 4, default: true }])] }));
        expect(p.islands['B'].store).toEqual({ [`${BREAD}.governorSupply`]: 4 });
        expect(p.tradeRoutes).toEqual([]);
        expect(codes(p.report)).toContain('governor-default');
        expect(codes(p.report)).toContain('governor-supply-applied');
    });

    test('two governors on one entry supply the sum with two report lines', async ({ page }) => {
        const p = await plan(page, doc([isl('a'), isl('b')], { imports: [imp('b', BREAD, [{ governor: 1, amount: 3 }, { governor: 2, amount: 1.5 }])] }));
        expect(p.islands['B'].store[`${BREAD}.governorSupply`]).toBe(4.5);
        expect(p.report.filter((r) => r.code === 'governor-supply-applied').length).toBe(2);
    });

    test('ambiguous default with a governor writes no governor supply', async ({ page }) => {
        const p = await plan(page, doc([isl('a'), isl('b')], { imports: [imp('b', BREAD, [{ governor: 4711, amount: 2, default: true }, { island: 'a', default: true }])] }));
        expect(Object.keys(p.islands['B'].store).filter((k) => k.includes('governorSupply'))).toEqual([]);
        expect(codes(p.report)).not.toContain('governor-supply-applied');
    });

    test('a repeated entry for the same island and product adds no governor amount', async ({ page }) => {
        const imports = [imp('b', BREAD, [{ governor: 1, amount: 3 }]), imp('b', BREAD, [{ governor: 2, amount: 5 }])];
        const p = await plan(page, doc([isl('a'), isl('b')], { imports }));
        expect(p.islands['B'].store[`${BREAD}.governorSupply`]).toBe(3);
        expect(p.report.filter((r) => r.code === 'governor-supply-applied').length).toBe(1);
        expect(codes(p.report)).toContain('duplicate-import-entry');
    });

    test('governor amount for an unknown product or an unavailable receiver writes no key', async ({ page }) => {
        const imports = [imp('b', 999999999, [{ governor: 1, amount: 3 }]), imp('ghost', BREAD, [{ governor: 1, amount: 3 }])];
        const p = await plan(page, doc([isl('b')], { imports }));
        expect(p.islands['B'].store).toEqual({});
    });

    test('a non-player supplier alone becomes the passive-trade default; the original supplier stays in ext (R52, CD10)', async ({ page }) => {
        const entry = imp('b', BREAD, [{ island: 'npc-island', share: 1 }]);
        const p = await plan(page, doc([isl('b')], { imports: [entry] }));
        expect(p.tradeRoutes).toEqual([]);
        expect(p.islands['B'].store).toEqual({ [`${BREAD}.defaultSupplier.type`]: 'passive_trade', [`${BREAD}.defaultSupplier.id`]: 'passive' });
        const kept = p.islands['B'].ext.preservedImports;
        expect(kept.length).toBe(1);
        expect(kept[0].entry).toEqual(entry);
        expect(kept[0].preserved).toEqual([{ island: 'npc-island', share: 1 }]);
        expect(kept[0].reasons).toContain('non-player-supplier');
        // CD10 restore condition: the default the import wrote, the routes it wrote, the shared passive amount it relies on
        expect(kept[0].restore).toEqual({
            island: 'B',
            product: BREAD,
            routes: [],
            defaultSupplier: { type: 'passive_trade', id: 'passive' },
            passiveUserSetAmount: 0,
            governorSupply: 0,
        });
        expect(codes(p.report)).toContain('non-player-passive');
    });

    test('an orphan-island supplier degrades like a non-player supplier', async ({ page }) => {
        const text = doc([isl('b'), { id: 'o', name: 'Orphan', session: 99999 }], { imports: [imp('b', BREAD, [{ island: 'o', share: 1 }])] });
        const p = await plan(page, text);
        expect(p.tradeRoutes).toEqual([]);
        expect(p.islands['B'].store[`${BREAD}.defaultSupplier.type`]).toBe('passive_trade');
    });

    test('a non-player supplier next to an island supplier is kept in ext, no passive default (R52)', async ({ page }) => {
        const p = await plan(page, doc([isl('a'), isl('b')], { imports: [imp('b', BREAD, [{ island: 'a', share: 0.6 }, { island: 'npc', share: 0.4 }])] }));
        expect(p.tradeRoutes).toEqual([{ productGUID: BREAD, from: 'A', to: 'B', userSetAmount: 0, isDefaultSupplier: true }]);
        expect(p.islands['B'].store).toEqual({});
        expect(p.islands['B'].ext.preservedImports[0].preserved).toEqual([{ island: 'npc', share: 0.4 }]);
        expect(codes(p.report)).toContain('non-player-kept');
    });

    test('a two-island cycle keeps the second route as an ordinary route and reports it', async ({ page }) => {
        const first = imp('b', BREAD, [{ island: 'a', default: true }]);
        const second = imp('a', BREAD, [{ island: 'b', default: true, amount: 5 }]);
        const p = await plan(page, doc([isl('a'), isl('b')], { imports: [first, second] }));
        expect(p.tradeRoutes).toEqual([
            { productGUID: BREAD, from: 'A', to: 'B', userSetAmount: 0, isDefaultSupplier: true },
            { productGUID: BREAD, from: 'B', to: 'A', userSetAmount: 0, isDefaultSupplier: false },
        ]);
        expect(codes(p.report)).toContain('default-cycle');
        const kept = p.islands['A'].ext.preservedImports;
        expect(kept.length).toBe(1);
        expect(kept[0].reasons).toContain('cycle');
        expect(kept[0].entry).toEqual(second);
        expect(kept[0].restore.routes).toEqual([{ from: 'B', to: 'A', userSetAmount: 0, isDefaultSupplier: false }]);
        expect(p.islands['B'].ext.preservedImports).toEqual([]);
    });

    test('a longer default chain closing on itself is a cycle too; a chain ending in a factory is not', async ({ page }) => {
        const chain = [imp('b', BREAD, [{ island: 'a', default: true }]), imp('c', BREAD, [{ island: 'b', default: true }]), imp('a', BREAD, [{ island: 'c', default: true }])];
        const p = await plan(page, doc([isl('a'), isl('b'), isl('c')], { imports: chain }));
        expect(p.tradeRoutes.map((r) => r.isDefaultSupplier)).toEqual([true, true, false]);
        const open = await plan(page, doc([isl('a'), isl('b'), isl('c')], { imports: chain.slice(0, 2) }));
        expect(open.tradeRoutes.map((r) => r.isDefaultSupplier)).toEqual([true, true]);
        expect(codes(open.report)).not.toContain('default-cycle');
    });

    test('exactly one default route per receiving island and product, also across two entries', async ({ page }) => {
        const p = await plan(
            page,
            doc([isl('a'), isl('b'), isl('c')], {
                imports: [imp('c', BREAD, [{ island: 'a', default: true }]), imp('c', BREAD, [{ island: 'b', default: true }])],
            }),
        );
        expect(p.tradeRoutes.filter((r) => r.to === 'C' && r.isDefaultSupplier).length).toBe(1);
        expect(p.tradeRoutes.length).toBe(2);
        expect(codes(p.report)).toContain('duplicate-import-entry');
        // the same pair twice is one route
        const q = await plan(
            page,
            doc([isl('a'), isl('c')], { imports: [imp('c', BREAD, [{ island: 'a', share: 1 }]), imp('c', BREAD, [{ island: 'a', share: 1, amount: 2 }])] }),
        );
        expect(q.tradeRoutes.length).toBe(1);
    });

    test('no-ships route and a route with only non-player stations produce no entries and a report line', async ({ page }) => {
        const noShips = await plan(page, fixtureText('valid/trade-no-ships.json'));
        expect(noShips.tradeRoutes).toEqual([]);
        expect(codes(noShips.report)).toContain('route-without-ships');

        const npc = await plan(
            page,
            doc([isl('a')], {
                routes: [
                    {
                        id: 'r1',
                        stations: [
                            { slots: [{ product: DATES, mode: 'load', slot: 0, amount: 10 }] },
                            { slots: [{ product: DATES, mode: 'unload', slot: 0, amount: 10 }] },
                        ],
                        ships: [{ type: 1001, slots: 4, count: 1 }],
                    },
                ],
                imports: [],
            }),
        );
        expect(npc.tradeRoutes).toEqual([]);
        expect(codes(npc.report)).toContain('route-non-player-only');
    });

    test('imports and routes disagree: imports wins and the report lists the disagreement (R49)', async ({ page }) => {
        const routes = [
            {
                id: 'r1',
                stations: [
                    { island: 'a', slots: [{ product: DATES, mode: 'load', slot: 0, amount: 10 }] },
                    { island: 'b', slots: [{ product: DATES, mode: 'unload', slot: 0, amount: 10 }] },
                ],
                ships: [{ type: 1001, slots: 4, count: 1 }],
            },
        ];
        const p = await plan(page, doc([isl('a'), isl('b'), isl('c')], { routes, imports: [imp('b', DATES, [{ island: 'c', share: 1 }])] }));
        expect(p.tradeRoutes).toEqual([{ productGUID: DATES, from: 'C', to: 'B', userSetAmount: 0, isDefaultSupplier: true }]);
        expect(codes(p.report)).toContain('routes-imports-disagree');
        expect(p.document.trade?.routes).toEqual(routes);

        // routes without any imports: not derived, reported as preserved
        const q = await plan(page, doc([isl('a'), isl('b')], { routes }));
        expect(q.tradeRoutes).toEqual([]);
        expect(codes(q.report)).toContain('routes-not-derived');
        expect(q.document.trade?.routes).toEqual(routes);
    });

    test('routes, visits and minimumStock are preserved unchanged', async ({ page }) => {
        const text = fixtureText('valid/trade-relay-net-zero.json');
        const original = JSON.parse(text);
        original.islands[0].minimumStock = { [BREAD]: 12 };
        const p = await plan(page, JSON.stringify(original));
        expect(p.document.trade?.routes).toEqual(original.trade.routes);
        expect(p.document.trade?.visits).toEqual(original.trade.visits);
        expect(p.islands['A'].ext.minimumStock).toEqual({ [BREAD]: 12 });
        expect(codes(p.report)).toContain('minimum-stock');
        expect(codes(p.report)).toContain('routes-preserved');
    });

    test('vendored trade fixtures: no disagreement between routes and imports, one route per import supplier', async ({ page }) => {
        const names = fs.readdirSync(path.join(FIXTURES, 'valid')).filter((f) => f.startsWith('trade-'));
        expect(names.length).toBe(12);
        for (const name of names) {
            const text = fixtureText('valid/' + name);
            const p = await plan(page, text);
            const imports = JSON.parse(text).trade.imports as Array<Record<string, any>>;
            expect(p.tradeRoutes.length, name).toBe(imports.reduce((n, i) => n + i.suppliers.length, 0));
            expect(codes(p.report), name).not.toContain('routes-imports-disagree');
            for (const r of p.tradeRoutes) expect(r.userSetAmount).toBe(0);
        }
    });

    test('products[p].producer: factory id, none, absent; notes; unknown factory and product kept', async ({ page }) => {
        const text = doc([
            isl('a', {
                products: {
                    [BREAD]: { producer: BAKERY, notes: 'baker' },
                    [GOLD]: { producer: 'none' },
                    [DATES]: { notes: 'only a note' },
                    [GOLD + 1000000]: { producer: GOLDSMITH },
                    [2138]: { producer: 999999999 },
                },
            }),
        ]);
        const p = await plan(page, text);
        const s = p.islands['A'].store;
        expect(s[`${BREAD}.defaultSupplier.type`]).toBe('factory');
        expect(s[`${BREAD}.defaultSupplier.id`]).toBe(String(BAKERY));
        expect(s[`${BREAD}.notes`]).toBe('baker');
        expect(s[`${GOLD}.defaultSupplier.type`]).toBe('null');
        expect(s[`${GOLD}.defaultSupplier.id`]).toBe('null');
        expect(s[`${DATES}.notes`]).toBe('only a note');
        expect(s[`${DATES}.defaultSupplier.type`]).toBeUndefined();
        const pointers = p.islands['A'].ext.guids.map((g: Record<string, any>) => g.pointer).sort();
        expect(pointers).toEqual([`/products/${GOLD + 1000000}`, '/products/2138/producer'].sort());
        expect(s["2138.defaultSupplier.type"]).toBeUndefined();
    });

    test('a passive-trade default from a non-player supplier wins over a products producer', async ({ page }) => {
        const text = doc([isl('b', { products: { [BREAD]: { producer: BAKERY } } })], { imports: [imp('b', BREAD, [{ island: 'npc', share: 1 }])] });
        const p = await plan(page, text);
        expect(p.islands['B'].store[`${BREAD}.defaultSupplier.type`]).toBe('passive_trade');
        expect(p.islands['B'].ext.preservedImports[0].restore.defaultSupplier).toEqual({ type: 'passive_trade', id: 'passive' });
    });

    test('an unknown product or an unavailable receiving island keeps the entry unchanged and writes nothing', async ({ page }) => {
        const unknownProduct = imp('b', 5, [{ island: 'a', share: 1 }]);
        const toOrphan = imp('o', BREAD, [{ island: 'a', share: 1 }]);
        const toNobody = imp('nobody', BREAD, [{ island: 'a', share: 1 }]);
        const text = doc([isl('a'), isl('b'), { id: 'o', name: 'Orphan', session: 99999 }], { imports: [unknownProduct, toOrphan, toNobody] });
        const p = await plan(page, text);
        expect(p.tradeRoutes).toEqual([]);
        expect(p.islands['B'].ext.preservedImports.map((k) => k.entry)).toEqual([unknownProduct]);
        expect(p.document.preservedImports.map((k) => k.entry)).toEqual([toOrphan, toNobody]);
        expect(codes(p.report)).toEqual(expect.arrayContaining(['unknown-guid', 'import-receiver-unavailable']));
    });

    // ---- route derivation, amounts as floor 0, kept routes (U8) ----

    const station = (island: string, slots: Record<string, any>[]) => ({ island, slots });
    const ship = [{ type: 1001, slots: 4, count: 1 }];
    // Ostia loads Bread, Roma unloads it; the file's own entry for Roma lists Ostia (entered 0.5) and Capua.
    const savegame = (basis: string, ships: Record<string, any>[] = ship) =>
        doc([isl('roma'), isl('ostia'), isl('capua')], {
            routes: [{ id: 'r1', stations: [station('ostia', [{ product: BREAD, mode: 'load', slot: 0, amount: 10 }]), station('roma', [{ product: BREAD, mode: 'unload', slot: 0, amount: 10 }])], ships }],
            imports: [imp('roma', BREAD, [{ island: 'ostia', amount: 0.5 }, { island: 'capua' }], { basis })],
        });

    test('Covers AE5: the re-calculation toggle takes the supplier set, the default and the floors from the route; an entered amount stays a floor', async ({ page }) => {
        const on = await plan(page, savegame('entered')).then(() => planFull(page, savegame('entered'), { recalcRoutes: true }));
        expect(on.trade.tradeRoutes).toEqual([{ productGUID: BREAD, from: 'OSTIA', to: 'ROMA', userSetAmount: 0.5, isDefaultSupplier: true }]);
        expect(codes(on.trade.report)).toContain('routes-derived');
        expect(codes(on.trade.report)).not.toContain('routes-not-derived');

        const planned = await planFull(page, savegame('planned'), { recalcRoutes: true });
        expect(planned.trade.tradeRoutes).toEqual([{ productGUID: BREAD, from: 'OSTIA', to: 'ROMA', userSetAmount: 0, isDefaultSupplier: true }]);

        const off = await planFull(page, savegame('entered'));
        expect(off.trade.tradeRoutes.map((r) => `${r.from}:${r.userSetAmount}:${r.isDefaultSupplier}`)).toEqual(['OSTIA:0.5:false', 'CAPUA:0:false']);
    });

    test('Covers R18, R19: toggle on and no ship on any route: trade.imports is the input', async ({ page }) => {
        const none = await planFull(page, savegame('entered', []), { recalcRoutes: true });
        expect(none.trade.tradeRoutes.map((r) => r.from)).toEqual(['OSTIA', 'CAPUA']);
        expect(codes(none.trade.report)).not.toContain('routes-derived');
        const zero = await planFull(page, savegame('entered', [{ type: 1, count: 0 }]), { recalcRoutes: true });
        expect(zero.trade.tradeRoutes.map((r) => r.from)).toEqual(['OSTIA', 'CAPUA']);
    });

    test('Covers R20: governor and non-player suppliers of the entry stay next to the derived island suppliers', async ({ page }) => {
        const text = doc([isl('roma'), isl('ostia')], {
            routes: [{ id: 'r1', stations: [station('ostia', [{ product: BREAD, mode: 'load', slot: 0, amount: 10 }]), station('roma', [{ product: BREAD, mode: 'unload', slot: 0, amount: 10 }])], ships: ship }],
            imports: [imp('roma', BREAD, [{ island: 'ostia', default: true }, { governor: 4711, amount: 2 }])],
        });
        const { trade } = await planFull(page, text, { recalcRoutes: true });
        expect(trade.tradeRoutes).toEqual([{ productGUID: BREAD, from: 'OSTIA', to: 'ROMA', userSetAmount: 0, isDefaultSupplier: true }]);
        expect(trade.islands['ROMA'].store[`${BREAD}.governorSupply`]).toBe(2);
        const kept = trade.islands['ROMA'].ext.preservedImports;
        expect(kept.length).toBe(1);
        expect(kept[0].reasons).toContain('governor-supplier');
        expect(kept[0].preserved).toEqual([{ governor: 4711, amount: 2 }]);
        expect(kept[0].entry.suppliers.map((s: Record<string, any>) => s.island ?? s.governor)).toEqual(['ostia', 4711]);
    });

    test('Covers AE6: a planner supplier amount is written as floor 0, kept in the entry, and the default stays as in the file', async ({ page }) => {
        const entry = imp('b', BREAD, [{ island: 'a', default: true, amount: 0.38 }, { governor: 4711, amount: 1.5 }], { basis: undefined });
        delete entry.basis;
        const { trade } = await planFull(page, doc([isl('a'), isl('b')], { imports: [entry] }));
        expect(trade.tradeRoutes).toEqual([{ productGUID: BREAD, from: 'A', to: 'B', userSetAmount: 0, isDefaultSupplier: true }]);
        const kept = trade.islands['B'].ext.preservedImports;
        expect(kept.length).toBe(1);
        expect(kept[0].reasons).toEqual(expect.arrayContaining(['amount-kept', 'governor-supplier']));
        expect(kept[0].entry).toEqual(entry);
        expect(kept[0].restore.routes).toEqual([{ from: 'A', to: 'B', userSetAmount: 0, isDefaultSupplier: true }]);
        expect(trade.islands['B'].store[`${BREAD}.governorSupply`]).toBe(1.5);
        expect(codes(trade.report)).toEqual(expect.arrayContaining(['import-amount-kept', 'governor-supply-applied']));
    });

    test('an entered amount is a floor and creates no amount-kept entry', async ({ page }) => {
        const { trade } = await planFull(page, doc([isl('a'), isl('b')], { imports: [imp('b', BREAD, [{ island: 'a', default: true, amount: 0.38 }], { basis: 'entered' })] }));
        expect(trade.tradeRoutes[0].userSetAmount).toBe(0.38);
        expect(trade.islands['B'].ext.preservedImports).toEqual([]);
    });

    test('a built producer named in the file stays the default supplier; the import becomes an ordinary route', async ({ page }) => {
        const built = doc([isl('a'), isl('b', { buildings: { [BAKERY]: { built: 2 } }, products: { [BREAD]: { producer: BAKERY } } })], { imports: [imp('b', BREAD, [{ island: 'a', default: true }])] });
        const r = await planFull(page, built);
        expect(r.trade.tradeRoutes).toEqual([{ productGUID: BREAD, from: 'A', to: 'B', userSetAmount: 0, isDefaultSupplier: false }]);
        expect(codes(r.trade.report)).toContain('factory-default-kept');
        const key = Object.keys(r.trade.islands).find((k) => k.toUpperCase() === 'B') as string;
        expect(r.trade.islands[key].store['2137.defaultSupplier.type']).toBe('factory');
        // Without the building the route stays the default supplier.
        const unbuilt = doc([isl('a'), isl('b', { products: { [BREAD]: { producer: BAKERY } } })], { imports: [imp('b', BREAD, [{ island: 'a', default: true }])] });
        expect((await planFull(page, unbuilt)).trade.tradeRoutes[0].isDefaultSupplier).toBe(true);
    });

    test('Covers R14: a kept default route closes a cycle with a plan default route; a kept route of a produced pair is not seen', async ({ page }) => {
        const text = doc([isl('a'), isl('b')], { imports: [imp('b', BREAD, [{ island: 'a', default: true }])] });
        // Kept: B supplies A (default). The plan makes A the default supplier of B: a cycle.
        const kept = [{ productGUID: BREAD, from: 'B', to: 'A', userSetAmount: 0, isDefaultSupplier: true }];
        const cyc = await planFull(page, text, { keptRoutes: kept });
        expect(cyc.trade.tradeRoutes).toEqual([{ productGUID: BREAD, from: 'A', to: 'B', userSetAmount: 0, isDefaultSupplier: false }]);
        expect(codes(cyc.trade.report)).toContain('default-cycle');
        // Kept: another supplier of the produced pair (Bread, B) is replaced by the file, so it cannot make a duplicate default.
        const same = [{ productGUID: BREAD, from: 'C', to: 'B', userSetAmount: 0, isDefaultSupplier: true }];
        const dup = await planFull(page, text, { keptRoutes: same });
        expect(dup.trade.tradeRoutes[0].isDefaultSupplier).toBe(true);
        expect(codes(dup.trade.report)).not.toContain('duplicate-import-entry');
    });
});
