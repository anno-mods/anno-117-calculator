import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// U7: planImport assembles the island, trade and effects parts into one plan.

const FIXTURES = path.join(__dirname, '..', '..', 'vendor', 'anno117-exchange', 'fixtures');
const LATIUM = 3245;
const DATES = 151680;
const BEDROCK_TECH = 37870;

async function ready(page: Page) {
    await page.goto('/');
    await page.waitForFunction(() => window.view && window.view.island() && window.exchange);
}

function validFixtures(): string[] {
    return fs.readdirSync(path.join(FIXTURES, 'valid')).filter((f) => f.endsWith('.json'));
}

function fileText(name: string): string {
    return fs.readFileSync(path.join(FIXTURES, 'valid', name), 'utf-8');
}

test.describe('planImport (U7)', () => {
    test.beforeEach(async ({ page }) => {
        await ready(page);
    });

    test('a __proto__ key in ext.calculator.settings stays an own, serializable setting', async ({ page }) => {
        const text = '{"format":"anno117-exchange","formatVersion":"1.0","generator":{"name":"t"},'
            + '"ext":{"calculator":{"settings":{"__proto__":{"polluted":1},"showAllProducts":true}}},'
            + '"islands":[{"id":"a","name":"Zed","session":3245}]}';
        const r = await page.evaluate((t: string) => {
            const plan = window.exchange.planImport(t);
            const parsed = JSON.parse(plan.keyMap.calculatorSettings);
            return {
                ownProto: Object.prototype.hasOwnProperty.call(parsed, '__proto__'),
                proto: JSON.stringify(Object.getOwnPropertyDescriptor(parsed, '__proto__')?.value),
                shown: parsed.showAllProducts,
                polluted: ({} as Record<string, unknown>).polluted,
            };
        }, text);
        expect(r.ownProto).toBe(true);
        expect(r.proto).toBe('{"polluted":1}');
        expect(r.shown).toBe(true);
        expect(r.polluted).toBeUndefined();
    });

    test('planImport is registered and creates no storage', async ({ page }) => {
        const r = await page.evaluate(() => {
            const before = localStorage.length;
            const ex = window.exchange;
            const plan = ex.planImport(JSON.stringify({ format: 'anno117-exchange', formatVersion: '1.0', generator: { name: 't' }, islands: [{ id: 'a', name: 'Zed', session: 3245 }] }));
            return { before, after: localStorage.length, zed: localStorage.getItem('Zed'), hasKeyMap: 'keyMap' in plan };
        });
        expect(r.hasKeyMap).toBe(true);
        expect(r.zed).toBeNull();
        expect(r.after).toBe(r.before);
    });

    test('an envelope error is returned as the error object', async ({ page }) => {
        const r = await page.evaluate(() => window.exchange.planImport('{"format":"other"}'));
        expect(r.code).toBe('wrong-format');
        expect(typeof r.error).toBe('string');
        expect(r.keyMap).toBeUndefined();
    });

    test('islands, trade and effects give one key map and a report with the four lists', async ({ page }) => {
        const text = JSON.stringify({
            format: 'anno117-exchange',
            formatVersion: '1.0',
            generator: { name: 'u7-test' },
            settings: { dlcs: [1], difficulty: { needConsumption: 'Medium' }, volcano: { level: 3, effects: [145095] } },
            research: { researched: [BEDROCK_TECH], counts: { [BEDROCK_TECH]: 4 } },
            trade: {
                imports: [{ island: 'b', product: DATES, basis: 'planned', suppliers: [{ island: 'a', share: 1 }] }],
                routes: [{ id: 'r1', stations: [] }],
            },
            account: { items: [{ item: 1, instance: 1 }] },
            weird: { keep: true },
            computed: { islands: { a: { residents: { '1': 5 } } } },
            islands: [
                { id: 'a', name: 'A', session: LATIUM, buildings: { 3089: { built: 2 } }, minimumStock: { 2137: 5 } },
                { id: 'b', name: 'B', session: LATIUM, population: { '1': 3 } },
                { id: 'o', name: 'Orphan', session: 99999 },
            ],
        });
        const plan = await page.evaluate((t: string) => window.exchange.planImport(t), text);
        expect(plan.error).toBeUndefined();

        // keys: island stores, trade routes, the three SubStorages, island list, top-level ext
        expect(Object.keys(plan.keyMap).sort()).toEqual(
            ['A', 'B', 'calculatorSettings', 'exchange.ext', 'globalEffects', 'islandName', 'islandNames', 'sessionSettings', 'tradeRoutes'].sort(),
        );
        expect(plan.keyMap['Orphan']).toBeUndefined();
        expect(JSON.parse(plan.keyMap.islandNames)).toEqual(['A', 'B']);
        expect(plan.keyMap.islandName).toBe('A');
        expect(JSON.parse(plan.keyMap.tradeRoutes)).toEqual([{ productGUID: DATES, from: 'A', to: 'B', userSetAmount: 0, isDefaultSupplier: true }]);
        expect(JSON.parse(plan.keyMap.globalEffects)['82017.scaling']).toBe(4);
        expect(JSON.parse(plan.keyMap.sessionSettings)[`session.${LATIUM}.effect.145095.scaling`]).toBe(3);
        expect(JSON.parse(plan.keyMap.calculatorSettings)).toEqual({
            DLC01_Prophecies_of_Ash: '1',
            DLC02_The_Hippodrome: '0',
            DLC03_Dawn_of_Delta: '0',
            'settings.needConsumption': 'Medium',
        });

        // island stores are compact JSON strings with island data
        expect(plan.keyMap.A).not.toContain('\n');
        const a = JSON.parse(plan.keyMap.A);
        expect(a['3089.buildings.constructed']).toBe(2);
        expect(a['exchange.islandId']).toBe('a');
        expect(a['exchange.ext'].minimumStock).toEqual({ 2137: 5 });
        expect(a['exchange.ext'].preservedImports).toEqual([]);
        const b = JSON.parse(plan.keyMap.B);
        expect(b['exchange.ext'].captured.some((c: Record<string, any>) => c.pointer === '/population')).toBe(true);

        // top-level ext: orphan, account, document-level unknown field, trade routes
        const ext = JSON.parse(plan.keyMap['exchange.ext']);
        expect(ext.orphans.map((o: Record<string, any>) => o.id)).toEqual(['o']);
        expect(ext.account).toEqual({ items: [{ item: 1, instance: 1 }] });
        expect(ext.captured.some((c: Record<string, any>) => c.pointer === '/weird' && c.value.keep === true)).toBe(true);
        expect(ext.trade.routes).toEqual([{ id: 'r1', stations: [] }]);
        expect(ext.settings.volcano.level).toBe(3);

        // report with the four lists, preserved counts and orphans
        for (const list of ['carriedThrough', 'notMapped', 'approximated', 'notProvided']) expect(Array.isArray(plan.report[list])).toBe(true);
        expect(plan.report.carriedThrough.some((e: Record<string, any>) => e.code === 'unknown-field' && e.detail.pointer === '/weird')).toBe(true);
        expect(plan.report.carriedThrough.some((e: Record<string, any>) => e.code === 'item-records')).toBe(true);
        expect(plan.report.notMapped.some((e: Record<string, any>) => e.code === 'orphan-island')).toBe(true);
        expect(plan.report.counts).toMatchObject({ islands: 2, orphans: 1, tradeRoutes: 1 });
        expect(plan.report.orphans).toEqual([{ id: 'o', session: 99999 }]);
        expect(plan.orphans.map((o: Record<string, any>) => o.id)).toEqual(['o']);
        expect(plan.computed).toEqual({ islands: { a: { residents: { '1': 5 } } } });
        expect(plan.problems).toEqual([]);
    });

    test('trade store additions and ext are merged into the island store; settingsKeys from items are appended to the DLC keys', async ({ page }) => {
        const r = await page.evaluate(() => {
            const ex = window.exchange;
            const mythic = ex.tables().mythicalItemEffects.find((m: Record<string, any>) => m.dlcUnlocks.length > 0);
            const dlc = window.params.dlcs.find((d: Record<string, any>) => d.guid === mythic.dlcUnlocks[0]).id;
            const text = JSON.stringify({
                format: 'anno117-exchange',
                formatVersion: '1.0',
                generator: { name: 't' },
                settings: { dlcs: [] },
                islands: [
                    {
                        id: 'a',
                        name: 'A',
                        session: 3245,
                        itemHolders: [{ guid: 3070, instance: 1, items: [{ item: 50890, instance: 2, mythicEffect: mythic.effect, boostConditionMet: true }] }],
                        products: { 2137: { producer: 3174, notes: 'n' } },
                    },
                ],
            });
            return { dlc, plan: ex.planImport(text) };
        });
        expect(JSON.parse(r.plan.keyMap.calculatorSettings)[r.dlc]).toBe('1');
        const a = JSON.parse(r.plan.keyMap.A);
        expect(a['2137.defaultSupplier.type']).toBe('factory');
        expect(a['2137.defaultSupplier.id']).toBe('3174');
        expect(a['2137.notes']).toBe('n');
    });

    test('every valid vendored fixture plans without throwing and every JSON string of the key map parses', async ({ page }) => {
        const texts = validFixtures().map((f) => ({ name: f, text: fileText(f) }));
        expect(texts.length).toBeGreaterThan(20);
        const results = await page.evaluate(
            (files: { name: string; text: string }[]) =>
                files.map((f) => {
                    try {
                        const plan = window.exchange.planImport(f.text);
                        if ('error' in plan) return { name: f.name, error: plan.error };
                        const bad: string[] = [];
                        for (const [k, v] of Object.entries(plan.keyMap as Record<string, string>)) {
                            if (typeof v !== 'string') bad.push(k + ': not a string');
                            else if (k !== 'islandName') {
                                try {
                                    JSON.parse(v);
                                } catch {
                                    bad.push(k);
                                }
                            }
                        }
                        return { name: f.name, bad, problems: plan.problems.filter((p: Record<string, any>) => p.code === 'invalid-json').length, lists: Object.keys(plan.report).length };
                    } catch (e) {
                        return { name: f.name, thrown: String(e) };
                    }
                }),
            texts,
        );
        for (const r of results as Array<Record<string, any>>) {
            expect(r.thrown, r.name).toBeUndefined();
            expect(r.error, r.name).toBeUndefined();
            expect(r.bad, r.name).toEqual([]);
            expect(r.problems, r.name).toBe(0);
        }
    });

    test('item records and document-level unknown fields of the vendored fixtures land in the top-level ext', async ({ page }) => {
        const plan = await page.evaluate((t: string) => window.exchange.planImport(t), fileText('unknown-fields-everywhere.json'));
        const ext = JSON.parse(plan.keyMap['exchange.ext']);
        expect(ext.captured.length).toBeGreaterThan(0);
        const items = await page.evaluate((t: string) => window.exchange.planImport(t), fileText('item-locations.json'));
        const itemExt = JSON.parse(items.keyMap['exchange.ext']);
        expect(itemExt.account ?? itemExt.unlocatedItems).toBeDefined();
    });
});
