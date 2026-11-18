import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// U1: the scope classifier (src/exchange/scopes.ts). One row per key family of Appendix A of the import-scopes plan.

const FIXTURES = path.join(__dirname, '..', '..', 'vendor', 'anno117-exchange', 'fixtures', 'valid');

// Island-store keys no scope owns on purpose (UI state of the island that the file may carry in ext.calculator.store).
// A key of a plan that is neither classified nor listed here fails the coverage scenario and names the key.
const UNSCOPED_ISLAND_KEYS = new Set<string>(['exchange.ext']);

type Kind = 'island' | 'top' | 'setting' | 'ext-island' | 'ext-document';
type Row = [Kind, string, string | null];

async function ready(page: Page): Promise<void> {
    await page.goto('/');
    await page.waitForFunction(() => window.view && window.view.island() && window.exchange);
}

const ROWS: Row[] = [
    // residences
    ['island', '3087.buildings.constructed', 'residences'],
    ['island', '3087.buildings.planned', 'residences'],
    ['island', '1499[2689].checked', 'residences'],
    ['island', '1499[2689].notes', 'residences'],
    ['island', '3087.effectCoverage', 'residences'],
    ['island', '1499[99014].coverage', 'residences'],
    ['island', '1499[3087].publicCoverage', 'residences'],
    ['island', 'villaCoverage', 'residences'],
    ['island', 'publicCoverage', 'residences'],
    ['island', '3087.notes', 'residences'],
    // production
    ['island', '3089.buildings.constructed', 'production'],
    ['island', '3089.buildings.planned', 'production'],
    ['island', '77954.buildings.fullyUtilizeConstructed', 'production'],
    ['island', '2786.module[77954].checked', 'production'],
    ['island', '2137.notes', 'production'],
    // trade: the factory fully-utilize key is Trade, the factory count is Production
    ['island', '3089.buildings.fullyUtilizeConstructed', 'trade'],
    ['island', '2137.defaultSupplier.type', 'trade'],
    ['island', '2137.defaultSupplier.id', 'trade'],
    ['island', '2137.governorSupply', 'trade'],
    ['island', 'passiveTrade.userSetAmount', 'trade'],
    ['island', '2137.passiveTrade.userSetAmount', 'trade'],
    // modifiers
    ['island', '3089[50890].scaling', 'modifiers'],
    ['island', '3089[145095].scaling', 'modifiers'],
    ['island', '3089.aqueductBuff.checked', 'modifiers'],
    ['island', 'island.effect.145095.scaling', 'modifiers'],
    ['island', 'island.fertility.123.checked', 'modifiers'],
    ['island', 'selectedPatron', 'modifiers'],
    ['island', 'devotion', 'modifiers'],
    ['island', 'residenceItem.51339.state', 'modifiers'],
    // islands
    ['island', 'session', 'islands'],
    ['island', 'exchange.islandId', 'islands'],
    ['island', 'gameConnector.islandID', 'islands'],
    ['island', 'gameConnector.areaIndex', 'islands'],
    // no scope
    ['island', '3089[999999999].scaling', null],
    ['island', 'somethingTheCalculatorDoesNotKnow', null],
    ['island', '999999999.buildings.constructed', null],
    // top-level keys
    ['top', 'tradeRoutes', 'trade'],
    ['top', 'globalEffects', 'modifiers'],
    ['top', 'sessionSettings', 'modifiers'],
    ['top', 'islandNames', 'islands'],
    ['top', 'islandName', 'islands'],
    ['top', 'collapsibleStates', null],
    ['top', 'statisticsCollections', null],
    ['top', 'darkMode.checked', null],
    ['top', 'All Islands', null],
    ['top', 'calculatorSettings', null],
    // settings keys
    ['setting', 'settings.needConsumption', 'modifiers'],
    ['setting', 'settings.showAllProducts', null],
    ['setting', 'language', null],
    ['setting', 'settings.importScope.islands', null],
    ['setting', 'settings.importScope.recalcRoutes', null],
    // exchange.ext pointers, island level
    ['ext-island', '/buildings/3087', 'residences'],
    ['ext-island', '/buildings/3089', 'production'],
    ['ext-island', '/buildings/999999999', 'production'],
    ['ext-island', '/residencesByLevel/1499', 'residences'],
    ['ext-island', '/factories/3089/items/0', 'modifiers'],
    ['ext-island', '/factories/3089/effects/1', 'modifiers'],
    ['ext-island', '/factories/2786/modules/77954', 'production'],
    ['ext-island', '/factories/2786/manualProductivity', 'production'],
    ['ext-island', '/products/2137/producer', 'trade'],
    ['ext-island', '/products/2137/notes', 'production'],
    ['ext-island', '/effects/145095', 'modifiers'],
    ['ext-island', '/wonders', 'modifiers'],
    ['ext-island', '/moduleAttachments', 'production'],
    ['ext-island', '/minimumStock', 'trade'],
    ['ext-island', '/gameIsland', 'islands'],
    ['ext-island', '/population', null],
    ['ext-island', '/layout', null],
    ['ext-island', '/toString', null],
    // exchange.ext pointers, document level
    ['ext-document', '/trade/routes', 'trade'],
    ['ext-document', '/effects/global/95709', 'modifiers'],
    ['ext-document', '/research/queue', 'modifiers'],
    ['ext-document', '/settings/map', 'islands'],
    ['ext-document', '/account', null],
    ['ext-document', '/history', null],
    // malformed pointers
    ['ext-island', '', null],
    ['ext-island', 'no-leading-slash', null],
    ['ext-island', '/', null],
    ['ext-document', '//', null],
];

test.describe('scope classifier (U1)', () => {
    test.beforeEach(async ({ page }) => {
        await ready(page);
    });

    test('every key family of Appendix A classifies to the stated scope', async ({ page }) => {
        const results = await page.evaluate((rows: Row[]) => rows.map(([kind, key]) => window.exchange.classifyKey(kind, key)), ROWS);
        const mismatches = ROWS.map((r, i) => ({ row: r, got: results[i] })).filter((x) => x.got !== x.row[2]);
        expect(mismatches).toEqual([]);
    });

    test('a DLC id of params.dlcs is a Modifiers setting, a device setting is none', async ({ page }) => {
        const r = await page.evaluate(() => {
            const ids: string[] = window.params.dlcs.map((d: { id: string }) => d.id);
            return {
                scopes: ids.map((id) => window.exchange.classifyKey('setting', id)),
                count: ids.length,
                device: [window.exchange.isDeviceSetting('language'), window.exchange.isDeviceSetting('settings.importScope.trade'), window.exchange.isDeviceSetting('settings.showAllProducts')],
            };
        });
        expect(r.count).toBeGreaterThan(0);
        expect(new Set(r.scopes)).toEqual(new Set(['modifiers']));
        expect(r.device).toEqual([true, true, false]);
    });

    test('a malformed pointer or key never throws', async ({ page }) => {
        const r = await page.evaluate(() => {
            const out: unknown[] = [];
            for (const kind of ['island', 'top', 'setting', 'ext-island', 'ext-document'] as const) {
                for (const key of ['', '/', '~', '/~', '[', '1[2].scaling', '..', '/__proto__', '/constructor/x', 'constructor']) {
                    out.push(window.exchange.classifyKey(kind, key));
                }
            }
            return out;
        });
        expect(r.every((x) => x === null)).toBe(true);
    });

    test('every key of every island store a vendored fixture plans is classified or listed as unscoped', async ({ page }) => {
        const names = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.json'));
        const texts = names.map((n) => fs.readFileSync(path.join(FIXTURES, n), 'utf-8'));
        const unclassified = await page.evaluate(
            ({ texts, allowed }: { texts: string[]; allowed: string[] }) => {
                const ex = window.exchange;
                const bad = new Set<string>();
                texts.forEach((t, i) => {
                    const plan = ex.planImport(t);
                    if ('error' in plan) return;
                    for (const isl of plan.islands ?? []) {
                        const store = JSON.parse(plan.keyMap[isl.key]) as Record<string, unknown>;
                        for (const k of Object.keys(store)) {
                            if (allowed.includes(k)) continue;
                            if (ex.classifyKey('island', k) === null) bad.add(k);
                        }
                        const ext = store['exchange.ext'] as { captured?: { pointer: string }[]; guids?: { pointer: string }[] } | undefined;
                        for (const e of [...(ext?.captured ?? []), ...(ext?.guids ?? [])]) {
                            if (ex.classifyKey('ext-island', e.pointer) === null) bad.add(`ext-island ${e.pointer} (${i})`);
                        }
                    }
                    const docExt = JSON.parse(plan.keyMap['exchange.ext']) as { captured?: { pointer: string }[] };
                    for (const e of docExt.captured ?? []) {
                        if (ex.classifyKey('ext-document', e.pointer) === null) bad.add(`ext-document ${e.pointer} (${i})`);
                    }
                });
                return [...bad].sort();
            },
            { texts, allowed: [...UNSCOPED_ISLAND_KEYS] },
        );
        // Unscoped captured pointers are the file's own unknown fields; only store keys must have a scope.
        const storeKeys = unclassified.filter((k) => !k.startsWith('ext-'));
        expect(storeKeys).toEqual([]);
    });
});
