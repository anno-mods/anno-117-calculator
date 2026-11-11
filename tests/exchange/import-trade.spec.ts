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
    await page.waitForFunction(() => (window as any).view && (window as any).view.island() && (window as any).exchange);
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

async function planFull(page: Page, text: string): Promise<{ trade: TradePlan; islands: any }> {
    return page.evaluate((t: string) => {
        const ex = (window as any).exchange;
        const r = ex.readExchange(t);
        if ('error' in r) throw new Error(r.error);
        const islands = ex.planIslands(r);
        const trade = ex.planTrade(islands, r);
        return { trade, islands };
    }, text);
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
        expect(islands.islands.map((i: any) => i.name)).toEqual(['A', 'B', 'C', 'D', 'E']);
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

    test('no default flag and no share: all routes ordinary, product default left alone, minimum zero routes written (R54)', async ({ page }) => {
        const p = await plan(page, doc([isl('a'), isl('b'), isl('c')], { imports: [imp('c', DATES, [{ island: 'a' }, { island: 'b', amount: 3 }])] }));
        expect(p.tradeRoutes).toEqual([
            { productGUID: DATES, from: 'A', to: 'C', userSetAmount: 0, isDefaultSupplier: false },
            { productGUID: DATES, from: 'B', to: 'C', userSetAmount: 3, isDefaultSupplier: false },
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
        expect(p.tradeRoutes).toEqual([{ productGUID: BREAD, from: 'A', to: 'B', userSetAmount: 3, isDefaultSupplier: false }]);
        expect(Object.keys(p.islands['B'].store).filter((k) => k.includes('defaultSupplier'))).toEqual([]);
        expect(Object.keys(p.islands['B'].store).filter((k) => k.includes('passiveTrade'))).toEqual([]);
        expect(codes(p.report)).toContain('governor-default');
        const kept = p.islands['B'].ext.preservedImports;
        expect(kept.length).toBe(1);
        expect(kept[0].entry).toEqual(entry);
        expect(kept[0].preserved).toEqual([{ governor: 4711, default: true }]);
        expect(kept[0].restore.routes).toEqual([{ from: 'A', to: 'B', userSetAmount: 3, isDefaultSupplier: false }]);

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

    test('a two-island cycle keeps the second route as an ordinary route with its amount and reports it', async ({ page }) => {
        const first = imp('b', BREAD, [{ island: 'a', default: true }]);
        const second = imp('a', BREAD, [{ island: 'b', default: true, amount: 5 }]);
        const p = await plan(page, doc([isl('a'), isl('b')], { imports: [first, second] }));
        expect(p.tradeRoutes).toEqual([
            { productGUID: BREAD, from: 'A', to: 'B', userSetAmount: 0, isDefaultSupplier: true },
            { productGUID: BREAD, from: 'B', to: 'A', userSetAmount: 5, isDefaultSupplier: false },
        ]);
        expect(codes(p.report)).toContain('default-cycle');
        const kept = p.islands['A'].ext.preservedImports;
        expect(kept.length).toBe(1);
        expect(kept[0].reasons).toContain('cycle');
        expect(kept[0].entry).toEqual(second);
        expect(kept[0].restore.routes).toEqual([{ from: 'B', to: 'A', userSetAmount: 5, isDefaultSupplier: false }]);
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
            const imports = JSON.parse(text).trade.imports as any[];
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
        const pointers = p.islands['A'].ext.guids.map((g: any) => g.pointer).sort();
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
});
