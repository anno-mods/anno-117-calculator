import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { appReady, fileOf, importText, Json, openApp, settle } from '../helpers/exchange';

// U3 and U4: scope-aware planning and the scoped merge (src/exchange/merge.ts). The stored calculator is built with a
// full import of a base file; the scoped plan of a second file is then compared with the stored data.

const FIXTURES = path.join(__dirname, '..', '..', 'vendor', 'anno117-exchange', 'fixtures', 'valid');
const LATIUM = 3245;
const ALBION = 6627;
const AEGYPTUS = 149679;
const RESIDENCE = 3087; // Liberti residence, level 1499
const SAWMILL = 3089;
const BAKERY = 3174;
const BREAD = 2137;
const WINE = 2138;
const DATES_FARM = 152272; // DLC 3 factory

const ALL = { islands: true, residences: true, production: true, trade: true, modifiers: true, keepIslands: false, keepRoutes: false, recalcRoutes: false };
const NONE = { ...ALL, islands: false, residences: false, production: false, trade: false, modifiers: false };
const only = (...scopes: string[]) => ({ ...NONE, ...Object.fromEntries(scopes.map((s) => [s, true])) });

interface Scoped {
    error?: string;
    keyMap: Record<string, string>;
    skipped: { id: string; name: string; values: number; reason: string }[];
    islands: { id: string; key: string }[];
    stored: Record<string, string>;
    report: Json;
}

// Plans `text` with `selection` against the stored data; `mutate` may change localStorage first (same evaluate, no reload).
async function scoped(page: Page, text: string, selection: Json, mutate?: Record<string, string>): Promise<Scoped> {
    await settle(page);
    return page.evaluate(
        ({ t, s, m }) => {
            for (const k of Object.keys(m)) localStorage.setItem(k, m[k]);
            const plan = window.exchange.planScopedImport(t, s as never);
            if ('error' in plan) throw new Error(plan.error);
            const stored: Record<string, string> = {};
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i) as string;
                stored[k] = localStorage.getItem(k) as string;
            }
            return { keyMap: plan.keyMap, skipped: plan.skipped, islands: plan.islands ?? [], stored, report: plan.report };
        },
        { t: text, s: selection, m: mutate ?? {} },
    );
}

// Inner keys of a store whose value differs between the stored and the final JSON.
function storeDiff(before: string | undefined, after: string | undefined): string[] {
    const a: Json = before ? JSON.parse(before) : {};
    const b: Json = after ? JSON.parse(after) : {};
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).sort();
}

function topDiff(r: Scoped): string[] {
    return [...new Set([...Object.keys(r.stored), ...Object.keys(r.keyMap)])].filter((k) => r.stored[k] !== r.keyMap[k]).sort();
}

async function classify(page: Page, keys: string[]): Promise<(string | null)[]> {
    return page.evaluate((ks) => ks.map((k) => window.exchange.classifyKey('island', k)), keys);
}

function base(extraIslands: Json[] = [], extra: Json = {}): string {
    return fileOf(
        [
            {
                id: 'a', name: 'A', session: LATIUM, gameIsland: { sessionGuid: LATIUM, islandId: 1, areaIndex: 0 },
                buildings: { [RESIDENCE]: { built: 1 }, [SAWMILL]: { built: 1 } }, devotion: 1,
            },
            { id: 'b', name: 'B', session: LATIUM, buildings: { [RESIDENCE]: { built: 5 } } },
            ...extraIslands,
        ],
        extra,
    );
}

function storeOf(r: Scoped, name: string): Json {
    return JSON.parse(r.keyMap[name]);
}

test.describe('scoped plan and merge (U3, U4)', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    test('Covers AE1: Islands unticked, Residences ticked, four of six islands match; two are counted as skipped and none is created', async ({ page }) => {
        const names = ['A', 'B', 'C', 'D'];
        const stored = fileOf(names.map((n, i) => ({ id: n.toLowerCase(), name: n, session: LATIUM, buildings: { [RESIDENCE]: { built: 1 + i } } })));
        expect((await importText(page, stored)).ok).toBe(true);
        const incoming = fileOf(
            ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id, name: id.toUpperCase(), session: LATIUM, buildings: { [RESIDENCE]: { built: 40 }, [SAWMILL]: { built: 9 } } })),
        );
        const r = await scoped(page, incoming, only('residences'));
        expect(r.islands.map((i) => i.key).sort()).toEqual(['A', 'B', 'C', 'D']);
        expect(r.skipped.map((s) => s.id).sort()).toEqual(['e', 'f']);
        expect(r.skipped.every((s) => s.values > 0 && s.reason === 'unmatched')).toBe(true);
        expect(r.keyMap['E']).toBeUndefined();
        expect(JSON.parse(r.keyMap['islandNames'] ?? r.stored['islandNames'])).toEqual(JSON.parse(r.stored['islandNames']));
        for (const n of names) {
            expect(storeDiff(r.stored[n], r.keyMap[n]).filter((k) => k !== 'exchange.ext')).toEqual([`${RESIDENCE}.buildings.constructed`]);
            expect(storeOf(r, n)[`${RESIDENCE}.buildings.constructed`]).toBe(40);
        }
    });

    test('each single scope changes only keys of that scope', async ({ page }) => {
        expect((await importText(page, base())).ok).toBe(true);
        const incoming = fileOf([
            {
                id: 'a', name: 'A', session: LATIUM, gameIsland: { sessionGuid: LATIUM, islandId: 9, areaIndex: 0 },
                buildings: { [RESIDENCE]: { built: 7 }, [SAWMILL]: { built: 3 } }, devotion: 3, disabledNeeds: { 1499: [2689] },
                products: { [BREAD]: { notes: 'file note', producer: BAKERY } },
            },
            { id: 'b', name: 'B', session: LATIUM },
        ]);
        for (const scope of ['islands', 'residences', 'production', 'trade', 'modifiers']) {
            const r = await scoped(page, incoming, only(scope));
            const changed = storeDiff(r.stored['A'], r.keyMap['A']).filter((k) => k !== 'exchange.ext');
            expect(changed.length, `${scope} changes something`).toBeGreaterThan(0);
            const scopes = await classify(page, changed);
            expect(scopes.map((s) => s ?? 'none'), `${scope}: ${changed.join(', ')}`).toEqual(changed.map(() => scope));
        }
    });

    test('Covers AE2: Islands ticked, keep off, removes two unmatched islands with their routes; keep on keeps all four', async ({ page }) => {
        const names = ['A', 'B', 'C', 'D'];
        expect((await importText(page, fileOf(names.map((n) => ({ id: n.toLowerCase(), name: n, session: LATIUM }))))).ok).toBe(true);
        const routes = JSON.stringify([
            { productGUID: BREAD, from: 'A', to: 'B', userSetAmount: 0, isDefaultSupplier: false },
            { productGUID: BREAD, from: 'C', to: 'D', userSetAmount: 0, isDefaultSupplier: false },
            { productGUID: WINE, from: 'A', to: 'C', userSetAmount: 0, isDefaultSupplier: false },
        ]);
        const incoming = fileOf([
            { id: 'a', name: 'A', session: LATIUM },
            { id: 'b', name: 'B', session: LATIUM },
        ]);
        const off = await scoped(page, incoming, only('islands'), { tradeRoutes: routes });
        expect(JSON.parse(off.keyMap['islandNames']).filter((n: string) => n !== 'All Islands').sort()).toEqual(['A', 'B']);
        expect(off.keyMap['C']).toBeUndefined();
        expect(off.keyMap['D']).toBeUndefined();
        expect(JSON.parse(off.keyMap['tradeRoutes'])).toEqual([{ productGUID: BREAD, from: 'A', to: 'B', userSetAmount: 0, isDefaultSupplier: false }]);

        const keep = await scoped(page, incoming, { ...only('islands'), keepIslands: true }, { tradeRoutes: routes });
        expect(JSON.parse(keep.keyMap['islandNames']).filter((n: string) => n !== 'All Islands').sort()).toEqual(['A', 'B', 'C', 'D']);
        expect(keep.keyMap['C']).toBe(keep.stored['C']);
        expect(JSON.parse(keep.keyMap['tradeRoutes'])).toHaveLength(3);
    });

    test('Islands ticked and keep on: an unmatched file island with a calculator island name gets a suffixed name', async ({ page }) => {
        expect((await importText(page, fileOf([{ id: 'x', name: 'Alpha', session: LATIUM }]))).ok).toBe(true);
        const r = await scoped(page, fileOf([{ id: 'y', name: 'Alpha', session: ALBION }]), { ...only('islands'), keepIslands: true });
        expect(r.islands).toEqual([{ id: 'y', key: 'Alpha (2)' }]);
        expect(JSON.parse(r.keyMap['islandNames']).filter((n: string) => n !== 'All Islands').sort()).toEqual(['Alpha', 'Alpha (2)']);
        expect(r.keyMap['Alpha']).toBe(r.stored['Alpha']);
    });

    test('a matched island with Islands ticked takes the file name and keeps its other scopes; routes follow the new name', async ({ page }) => {
        expect((await importText(page, fileOf([{ id: 'x', name: 'Old', session: LATIUM, buildings: { [RESIDENCE]: { built: 11 } } }, { id: 'z', name: 'Other', session: LATIUM }]))).ok).toBe(true);
        const routes = JSON.stringify([{ productGUID: BREAD, from: 'Old', to: 'Other', userSetAmount: 0, isDefaultSupplier: false }]);
        const r = await scoped(page, fileOf([{ id: 'x', name: 'New', session: LATIUM }, { id: 'z', name: 'Other', session: LATIUM }]), only('islands'), { tradeRoutes: routes });
        expect(r.keyMap['Old']).toBeUndefined();
        expect(storeOf(r, 'New')[`${RESIDENCE}.buildings.constructed`]).toBe(11);
        expect(JSON.parse(r.keyMap['tradeRoutes'])[0].from).toBe('New');
    });

    test('Covers AE7: routes with keep on: the file replaces the routes of its (product, receiver) pair, other pairs stay', async ({ page }) => {
        const setup = fileOf([
            { id: 'r', name: 'Roma', session: LATIUM },
            { id: 'o', name: 'Ostia', session: LATIUM },
            { id: 'c', name: 'Capua', session: LATIUM },
        ]);
        expect((await importText(page, setup)).ok).toBe(true);
        const route = (product: number, from: string, to: string) => ({ productGUID: product, from, to, userSetAmount: 0, isDefaultSupplier: false });
        const storedRoutes = JSON.stringify([route(WINE, 'Capua', 'Roma'), route(BREAD, 'Ostia', 'Roma'), route(BREAD, 'Capua', 'Roma'), route(BREAD, 'Ostia', 'Capua')]);
        const incoming = fileOf(
            [
                { id: 'r', name: 'Roma', session: LATIUM, products: { [BREAD]: { producer: BAKERY } } },
                { id: 'o', name: 'Ostia', session: LATIUM },
                { id: 'c', name: 'Capua', session: LATIUM },
            ],
            { trade: { imports: [{ island: 'r', product: BREAD, suppliers: [{ island: 'o', amount: 0.5 }] }] } },
        );
        const stale = {
            tradeRoutes: storedRoutes,
        };
        await settle(page);
        const roma = await page.evaluate(() => JSON.parse(localStorage.getItem('Roma') as string) as Json);
        roma[`${BREAD}.defaultSupplier.type`] = 'passive_trade';
        roma[`${BREAD}.defaultSupplier.id`] = 'passive';
        roma[`${WINE}.defaultSupplier.type`] = 'passive_trade';
        roma[`${WINE}.defaultSupplier.id`] = 'passive';
        const r = await scoped(page, incoming, { ...only('trade'), keepRoutes: true }, { ...stale, Roma: JSON.stringify(roma) });
        const routes = JSON.parse(r.keyMap['tradeRoutes']) as Json[];
        const bread = routes.filter((x) => x.productGUID === BREAD).map((x) => `${x.from}>${x.to}`).sort();
        expect(bread).toEqual(['Ostia>Capua', 'Ostia>Roma']);
        expect(routes.filter((x) => x.productGUID === WINE).map((x) => `${x.from}>${x.to}`)).toEqual(['Capua>Roma']);
        const finalRoma = storeOf(r, 'Roma');
        expect(finalRoma[`${BREAD}.defaultSupplier.type`]).toBe('factory');
        expect(finalRoma[`${BREAD}.defaultSupplier.id`]).toBe(String(BAKERY));
        expect(finalRoma[`${WINE}.defaultSupplier.type`]).toBe('passive_trade');

        const off = await scoped(page, incoming, only('trade'), { ...stale, Roma: JSON.stringify(roma) });
        const offRoutes = JSON.parse(off.keyMap['tradeRoutes']) as Json[];
        expect(offRoutes.map((x) => `${x.productGUID}:${x.from}>${x.to}`)).toEqual([`${BREAD}:Ostia>Roma`]);
        expect(storeOf(off, 'Roma')[`${WINE}.defaultSupplier.type`]).toBeUndefined();
    });

    test('Covers R14: a kept default route takes part in the cycle check; the plan route becomes an ordinary route', async ({ page }) => {
        const islands = [
            { id: 'r', name: 'Roma', session: LATIUM },
            { id: 'o', name: 'Ostia', session: LATIUM },
        ];
        expect((await importText(page, fileOf(islands))).ok).toBe(true);
        // Stored: Ostia supplies Roma with Bread as the default route (receiver Roma, a pair the file does not mention).
        const stored = JSON.stringify([{ productGUID: BREAD, from: 'Ostia', to: 'Roma', userSetAmount: 0, isDefaultSupplier: true }]);
        // The file makes Roma the default supplier of Ostia: together with the kept route a cycle.
        const incoming = fileOf(islands, { trade: { imports: [{ island: 'o', product: BREAD, suppliers: [{ island: 'r', default: true }] }] } });
        const r = await scoped(page, incoming, { ...only('trade'), keepRoutes: true }, { tradeRoutes: stored });
        const routes = JSON.parse(r.keyMap['tradeRoutes']) as Json[];
        expect(routes.map((x) => `${x.from}>${x.to}:${x.isDefaultSupplier}`).sort()).toEqual(['Ostia>Roma:true', 'Roma>Ostia:false']);
        expect((r.report as Json).approximated.map((e: Json) => e.code)).toContain('default-cycle');

        // Keep off: the stored route is gone, so the plan route is the default.
        const off = await scoped(page, incoming, only('trade'), { tradeRoutes: stored });
        expect(JSON.parse(off.keyMap['tradeRoutes']).map((x: Json) => `${x.from}>${x.to}:${x.isDefaultSupplier}`)).toEqual(['Roma>Ostia:true']);
    });

    test('Covers R14, R21: a stored route equal to a plan route by (product, from, to) leaves one route, the plan route', async ({ page }) => {
        const islands = [
            { id: 'r', name: 'Roma', session: LATIUM },
            { id: 'o', name: 'Ostia', session: LATIUM },
        ];
        expect((await importText(page, fileOf(islands))).ok).toBe(true);
        const stored = JSON.stringify([{ productGUID: BREAD, from: 'Ostia', to: 'Roma', userSetAmount: 4, isDefaultSupplier: false }]);
        const incoming = fileOf(islands, { trade: { imports: [{ island: 'r', product: BREAD, suppliers: [{ island: 'o', default: true }] }] } });
        const r = await scoped(page, incoming, { ...only('trade'), keepRoutes: true }, { tradeRoutes: stored });
        expect(JSON.parse(r.keyMap['tradeRoutes'])).toEqual([{ productGUID: BREAD, from: 'Ostia', to: 'Roma', userSetAmount: 0, isDefaultSupplier: true }]);
    });

    test('Covers R17a: a partial import that leaves a stored route next to a preserved entry refreshes the snapshot and the export keeps the entry', async ({ page }) => {
        const islands = [
            { id: 'r', name: 'Roma', session: LATIUM },
            { id: 'o', name: 'Ostia', session: LATIUM },
        ];
        // A supplier island the file does not contain: the entry is preserved and the default becomes passive trade.
        const file = fileOf(islands, { trade: { imports: [{ island: 'r', product: BREAD, suppliers: [{ island: 'ghost', share: 1 }] }] } });
        expect((await importText(page, file)).ok).toBe(true);
        await page.evaluate((b: number) => {
            localStorage.setItem('tradeRoutes', JSON.stringify([{ productGUID: b, from: 'Ostia', to: 'Roma', userSetAmount: 0, isDefaultSupplier: false }]));
        }, BREAD);
        await page.reload();
        await appReady(page);
        expect((await importText(page, file, { ...only('trade'), keepRoutes: true })).ok).toBe(true);
        const { document, report } = await page.evaluate(() => window.exchange.exportDocument());
        expect(report.map((e: Json) => e.code)).not.toContain('import-entry-dropped');
        const entry = (document.trade.imports as Json[]).find((e) => e.island === 'r' && e.product === BREAD)!;
        expect(entry.suppliers).toEqual([{ island: 'ghost', share: 1 }, { island: 'o' }]);
    });

    test('a supplier that names a skipped island degrades to the passive-trade default and the entry is kept', async ({ page }) => {
        expect((await importText(page, fileOf([{ id: 'r', name: 'Roma', session: LATIUM }]))).ok).toBe(true);
        const incoming = fileOf(
            [
                { id: 'r', name: 'Roma', session: LATIUM },
                { id: 's', name: 'Stranger', session: LATIUM },
            ],
            { trade: { imports: [{ island: 'r', product: BREAD, suppliers: [{ island: 's', share: 1 }] }] } },
        );
        const r = await scoped(page, incoming, only('trade'));
        expect(r.skipped.map((s) => s.id)).toEqual(['s']);
        const roma = storeOf(r, 'Roma');
        expect(roma[`${BREAD}.defaultSupplier.type`]).toBe('passive_trade');
        expect(JSON.stringify(roma['exchange.ext'])).toContain('non-player-supplier');
        expect(JSON.parse(r.keyMap['tradeRoutes'])).toEqual([]);
    });

    test('Covers R17: the fully-utilize setting of a local producer is written only where the factory is built, and only with Trade ticked', async ({ page }) => {
        const setup = fileOf([
            { id: 'r', name: 'Roma', session: LATIUM, buildings: { [BAKERY]: { built: 2 } } },
            { id: 'o', name: 'Ostia', session: LATIUM },
            { id: 'c', name: 'Capua', session: LATIUM },
        ]);
        expect((await importText(page, setup)).ok).toBe(true);
        const incoming = fileOf(
            [
                { id: 'r', name: 'Roma', session: LATIUM },
                { id: 'o', name: 'Ostia', session: LATIUM },
                { id: 'c', name: 'Capua', session: LATIUM },
            ],
            {
                trade: {
                    imports: [
                        { island: 'r', product: BREAD, suppliers: [{ island: 'o', share: 1 }] },
                        { island: 'c', product: BREAD, suppliers: [{ island: 'o', share: 1 }] },
                    ],
                },
            },
        );
        const key = `${BAKERY}.buildings.fullyUtilizeConstructed`;
        const trade = await scoped(page, incoming, only('trade'));
        expect(storeOf(trade, 'Roma')[key]).toBe('1');
        expect(storeOf(trade, 'Capua')[key]).toBeUndefined();
        expect(storeOf(trade, 'Roma')[`${BAKERY}.buildings.constructed`]).toBe(2);
        const production = await scoped(page, incoming, only('production'));
        expect(storeOf(production, 'Roma')[key]).toBeUndefined();
    });

    test('Covers AE4: a DLC building of a ticked scope switches its DLC on without Modifiers; an item of Modifiers does not', async ({ page }) => {
        expect((await importText(page, fileOf([{ id: 'n', name: 'Nile', session: AEGYPTUS }]))).ok).toBe(true);
        const dlc3 = await page.evaluate(() => window.params.dlcs.find((d: { id: string }) => d.id.startsWith('DLC03_')).id as string);
        const dlcOfItem = await page.evaluate(() => {
            const item = window.params.items.find((i: { guid: number }) => i.guid === 145268);
            const dlc = window.params.dlcs.find((d: { guid: number }) => item.dlcUnlocks.includes(d.guid));
            return dlc.id as string;
        });
        const withBuilding = fileOf([{ id: 'n', name: 'Nile', session: AEGYPTUS, buildings: { [DATES_FARM]: { built: 2 } } }]);
        const r = await scoped(page, withBuilding, only('production'));
        expect(JSON.parse(r.keyMap['calculatorSettings'])[dlc3]).toBe('1');

        const withItem = fileOf([{ id: 'n', name: 'Nile', session: AEGYPTUS, factories: { [SAWMILL]: { items: [{ item: 145268 }] } } }]);
        const noItem = await scoped(page, withItem, only('production'));
        expect(JSON.parse(noItem.keyMap['calculatorSettings'] ?? '{}')[dlcOfItem]).toBeUndefined();
        expect(JSON.stringify(storeOf(noItem, 'Nile'))).not.toContain('145268');
    });

    test('Covers R13: settings.dlcs switches a DLC off only with Modifiers ticked', async ({ page }) => {
        expect((await importText(page, fileOf([{ id: 'a', name: 'A', session: LATIUM }]))).ok).toBe(true);
        const dlc2 = await page.evaluate(() => window.params.dlcs.find((d: { id: string }) => d.id.startsWith('DLC02_')).id as string);
        const text = fileOf([{ id: 'a', name: 'A', session: LATIUM }], { settings: { dlcs: [1, 3] } });
        const settings = JSON.stringify({ [dlc2]: '1', language: 'german' });
        const without = await scoped(page, text, only('production'), { calculatorSettings: settings });
        expect(JSON.parse(without.keyMap['calculatorSettings'])[dlc2]).toBe('1');
        const withMod = await scoped(page, text, only('modifiers'), { calculatorSettings: settings });
        expect(JSON.parse(withMod.keyMap['calculatorSettings'])[dlc2]).toBe('0');
        expect(JSON.parse(withMod.keyMap['calculatorSettings']).language).toBe('german');
    });

    test('Covers R9: UI state and settings without a scope are never touched by a partial selection', async ({ page }) => {
        expect((await importText(page, base())).ok).toBe(true);
        const ui = {
            collapsibleStates: '{"x":true}',
            statisticsCollections: '{"y":1}',
            'darkMode.checked': 'true',
            calculatorSettings: JSON.stringify({ 'settings.showAllProducts': '1', language: 'german', 'settings.importScope.trade': '0' }),
        };
        const incoming = fileOf([{ id: 'a', name: 'A', session: LATIUM, buildings: { [RESIDENCE]: { built: 3 } } }], {
            ext: { calculator: { collapsibleStates: { z: 1 }, settings: { 'settings.showAllProducts': false } } },
        });
        for (const sel of [only('residences'), only('trade', 'modifiers'), { ...ALL, keepIslands: true }]) {
            const r = await scoped(page, incoming, sel, ui);
            expect(r.keyMap['collapsibleStates']).toBe(ui.collapsibleStates);
            expect(r.keyMap['statisticsCollections']).toBe(ui.statisticsCollections);
            expect(r.keyMap['darkMode.checked']).toBe(ui['darkMode.checked']);
            const settings = JSON.parse(r.keyMap['calculatorSettings']);
            expect(settings['settings.showAllProducts']).toBe('1');
            expect(settings.language).toBe('german');
        }
    });

    test('Covers R12: the All Islands store is replaced only when all five scopes are ticked', async ({ page }) => {
        expect((await importText(page, base())).ok).toBe(true);
        const mutate = { 'All Islands': '{"session":37135,"marker":1}' };
        const incoming = fileOf([{ id: 'a', name: 'A', session: LATIUM }]);
        const partial = await scoped(page, incoming, { ...only('islands', 'residences', 'production', 'trade'), keepIslands: true }, mutate);
        expect(partial.keyMap['All Islands']).toBe(mutate['All Islands']);
        const all = await scoped(page, incoming, { ...ALL, keepIslands: true }, mutate);
        expect(all.keyMap['All Islands']).toBeUndefined();
    });

    test('full selection: the final key map equals the plan key map of the unscoped import (KTD1)', async ({ page }) => {
        for (const name of ['cinis-sawmill.json', 'item-locations.json']) {
            const text = fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
            const same = await page.evaluate(
                ({ t, s }) => {
                    const plain = window.exchange.planImport(t);
                    const scopedPlan = window.exchange.planScopedImport(t, s as never);
                    if ('error' in plain || 'error' in scopedPlan) return false;
                    return JSON.stringify(plain.keyMap) === JSON.stringify(scopedPlan.keyMap);
                },
                { t: text, s: { ...ALL, recalcRoutes: true } },
            );
            expect(same, name).toBe(true);
        }
    });

    test('a toggle of an unticked scope is ignored: Islands unticked with keepIslands behaves like keep off', async ({ page }) => {
        expect((await importText(page, base())).ok).toBe(true);
        const incoming = base();
        const a = await scoped(page, incoming, { ...only('residences'), keepIslands: true });
        const b = await scoped(page, incoming, only('residences'));
        expect(a.keyMap).toEqual(b.keyMap);
    });

    test('a stored store that is not valid JSON is kept as it is and reported through skipped', async ({ page }) => {
        const r = await page.evaluate((t) => {
            const plan = window.exchange.planImport(t);
            if ('error' in plan) throw new Error(plan.error);
            const merged = window.exchange.mergeScoped(
                { islandNames: '["A"]', A: '{not json' },
                plan,
                { islands: false, residences: true, production: false, trade: false, modifiers: false, keepIslands: false, keepRoutes: false, recalcRoutes: false },
                [{ fileId: 'a', calcName: 'A', by: 'name' }],
            );
            return { skipped: merged.skipped, a: merged.keyMap['A'] };
        }, fileOf([{ id: 'a', name: 'A', session: LATIUM, buildings: { [RESIDENCE]: { built: 3 } } }]));
        expect(r.a).toBe('{not json');
        expect(r.skipped).toEqual([{ id: 'a', name: 'A', values: 0, reason: 'invalid-store' }]);
    });

    test('the merged key map applies and the app loads it without console errors', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        expect((await importText(page, base())).ok).toBe(true);
        const incoming = fileOf([{ id: 'a', name: 'A', session: LATIUM, buildings: { [RESIDENCE]: { built: 21 } } }]);
        await settle(page);
        const ok = await page.evaluate((t) => {
            const plan = window.exchange.planScopedImport(t, { islands: false, residences: true, production: false, trade: false, modifiers: false, keepIslands: false, keepRoutes: false, recalcRoutes: false });
            if ('error' in plan) return false;
            return window.exchange.applyImport(plan, { reload: false }).ok;
        }, incoming);
        expect(ok).toBe(true);
        await page.reload();
        await appReady(page);
        const built = await page.evaluate((g) => window.view.islands().find((i: Record<string, any>) => i.name() === 'A').assetsMap.get(g).buildings.constructed(), RESIDENCE);
        expect(built).toBe(21);
        const sawmill = await page.evaluate((g) => window.view.islands().find((i: Record<string, any>) => i.name() === 'A').assetsMap.get(g).buildings.constructed(), SAWMILL);
        expect(sawmill).toBe(1);
        expect(errors).toEqual([]);
    });
});
