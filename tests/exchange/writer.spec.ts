import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { seedOnce, appReady } from '../helpers/exchange';

// U8: the atomic writer. Tests that inspect state without a reload read it inside the same evaluate as the write,
// because live Storage objects of the running app save debounced and would otherwise overwrite the written keys.

const FIXTURES = path.join(__dirname, '..', '..', 'vendor', 'anno117-exchange', 'fixtures', 'valid');
const LATIUM = 3245;

type Json = Record<string, unknown>;

function doc(extra: Json = {}): string {
    return JSON.stringify({
        format: 'anno117-exchange',
        formatVersion: '1.0',
        generator: { name: 'u8-test' },
        islands: [
            { id: 'b', name: 'Beta', session: LATIUM, buildings: { 3089: { built: 2 } }, futureIslandField: { keep: 'island-value' } },
            { id: 'a', name: 'Alpha', session: LATIUM },
        ],
        futureDocumentField: { keep: 'document-value' },
        ...extra,
    });
}

async function ready(page: Page) {
    await page.goto('/');
    await appReady(page);
}

test.describe('applyImport (U8)', () => {
    test('invalid JSON in the plan aborts before clear(); storage unchanged', async ({ page }) => {
        await ready(page);
        const r = await page.evaluate((text: string) => {
            const ex = (window as any).exchange;
            localStorage.setItem('marker', 'keep-me');
            const plan = ex.planImport(text);
            plan.keyMap['tradeRoutes'] = '{not json';
            const before = JSON.stringify(Object.entries(localStorage).sort());
            const res = ex.applyImport(plan, { reload: false });
            const after = JSON.stringify(Object.entries(localStorage).sort());
            return { res, same: before === after };
        }, doc());
        expect(r.res.ok).toBe(false);
        expect(r.res.error).toContain('tradeRoutes');
        expect(r.res.written).toEqual([]);
        expect(r.same).toBe(true);
    });

    test('a QuotaExceededError on the 20th write restores the snapshot byte for byte', async ({ page }) => {
        await ready(page);
        const r = await page.evaluate((text: string) => {
            const ex = (window as any).exchange;
            localStorage.setItem('marker', 'café ☃ {"a":1}  ');
            const plan = ex.planImport(text);
            for (let i = 0; i < 30; i++) plan.keyMap['Pad' + i] = '{"pad":' + i + '}';
            const before = JSON.stringify(Object.entries(localStorage).sort());
            const res = ex.applyImport(plan, { reload: false, failAfterWrites: 20 });
            const after = JSON.stringify(Object.entries(localStorage).sort());
            return { res, same: before === after, pad: localStorage.getItem('Pad0'), alpha: localStorage.getItem('Alpha') };
        }, doc());
        expect(r.res.ok).toBe(false);
        expect(r.res.error).toContain('QuotaExceededError');
        expect(r.res.written).toEqual([]);
        expect(r.same).toBe(true);
        expect(r.pad).toBeNull();
        expect(r.alpha).toBeNull();
    });

    test('a failure restores an injected storage and sessionStorage hand-off', async ({ page }) => {
        await ready(page);
        const r = await page.evaluate((text: string) => {
            const ex = (window as any).exchange;
            const data = new Map<string, string>([['x', '1']]);
            const fake = {
                get length() { return data.size; },
                key: (i: number) => [...data.keys()][i] ?? null,
                getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
                setItem: (k: string, v: string) => { data.set(k, v); },
                removeItem: (k: string) => { data.delete(k); },
                clear: () => data.clear(),
            };
            const plan = ex.planImport(text);
            plan.computed = { islands: {} };
            const res = ex.applyImport(plan, { reload: false, storage: fake, failAfterWrites: 3 });
            return { res, keys: [...data.keys()], sess: sessionStorage.getItem('exchange.computed') };
        }, doc());
        expect(r.res.ok).toBe(false);
        expect(r.keys).toEqual(['x']);
        expect(r.sess).toBeNull();
    });

    test('writes versionCalculator, ordered islandNames, islandName and the computed hand-off', async ({ page }) => {
        await ready(page);
        const r = await page.evaluate((text: string) => {
            const ex = (window as any).exchange;
            const plan = ex.planImport(text);
            plan.computed = { islands: { a: { residents: { '1': 5 } } } };
            const res = ex.applyImport(plan, { reload: false });
            return {
                res,
                version: localStorage.getItem('versionCalculator'),
                names: localStorage.getItem('islandNames'),
                name: localStorage.getItem('islandName'),
                computed: sessionStorage.getItem('exchange.computed'),
                alpha: JSON.parse(localStorage.getItem('Alpha') as string),
                keys: Object.keys(localStorage).sort(),
            };
        }, doc());
        expect(r.res.ok).toBe(true);
        expect(r.res.written).toContain('versionCalculator');
        expect(r.version).toBeTruthy();
        // plan order is Beta, Alpha; the app sorts by session then name
        expect(JSON.parse(r.names as string)).toEqual(['Alpha', 'Beta']);
        expect(r.name).toBe('Alpha');
        expect(JSON.parse(r.computed as string)).toEqual({ islands: { a: { residents: { '1': 5 } } } });
        expect(r.alpha.session).toBe(LATIUM);
        expect(r.keys).toContain('exchange.ext');
    });

    test('no computed hand-off when the plan has no computed block', async ({ page }) => {
        await ready(page);
        const r = await page.evaluate((text: string) => {
            sessionStorage.setItem('exchange.computed', 'stale');
            const ex = (window as any).exchange;
            ex.applyImport(ex.planImport(text), { reload: false });
            return sessionStorage.getItem('exchange.computed');
        }, doc());
        expect(r).toBe('stale');
    });

    test('unknown document-level and island-level fields are written to the two exchange.ext keys', async ({ page }) => {
        await ready(page);
        const r = await page.evaluate((text: string) => {
            const ex = (window as any).exchange;
            const res = ex.applyImport(ex.planImport(text), { reload: false });
            return { res, top: localStorage.getItem('exchange.ext'), beta: localStorage.getItem('Beta'), alpha: localStorage.getItem('Alpha') };
        }, doc());
        expect(r.res.ok).toBe(true);
        expect(r.top).toContain('document-value');
        expect(r.top).not.toContain('island-value');
        const beta = JSON.parse(r.beta as string);
        expect(JSON.stringify(beta['exchange.ext'])).toContain('island-value');
        expect(r.alpha).not.toContain('island-value');
    });

    test('an orphan island is absent from islandNames and present in exchange.ext', async ({ page }) => {
        await ready(page);
        const text = doc({
            islands: [
                { id: 'a', name: 'Alpha', session: LATIUM },
                { id: 'o', name: 'Orphan', session: 99999, secret: 'orphan-value' },
            ],
        });
        const r = await page.evaluate((t: string) => {
            const ex = (window as any).exchange;
            const res = ex.applyImport(ex.planImport(t), { reload: false });
            return { res, names: localStorage.getItem('islandNames'), orphan: localStorage.getItem('Orphan'), top: localStorage.getItem('exchange.ext') };
        }, text);
        expect(r.res.ok).toBe(true);
        expect(JSON.parse(r.names as string)).toEqual(['Alpha']);
        expect(r.orphan).toBeNull();
        expect(r.top).toContain('orphan-value');
    });

    test('language and darkMode.checked survive an import of a file that carries neither', async ({ page }) => {
        await ready(page);
        const r = await page.evaluate((text: string) => {
            localStorage.setItem('calculatorSettings', JSON.stringify({ language: 'german', 'settings.showAllProducts': '1' }));
            localStorage.setItem('darkMode.checked', 'true');
            const ex = (window as any).exchange;
            const res = ex.applyImport(ex.planImport(text), { reload: false });
            return { res, settings: JSON.parse(localStorage.getItem('calculatorSettings') as string), dark: localStorage.getItem('darkMode.checked') };
        }, doc());
        expect(r.res.ok).toBe(true);
        expect(r.settings.language).toBe('german');
        expect(r.dark).toBe('true');
        // everything else of the old settings is replaced
        expect(r.settings['settings.showAllProducts']).toBeUndefined();
    });

    test('no language key is invented when none was stored', async ({ page }) => {
        await ready(page);
        const r = await page.evaluate((text: string) => {
            localStorage.removeItem('calculatorSettings');
            localStorage.removeItem('darkMode.checked');
            const ex = (window as any).exchange;
            ex.applyImport(ex.planImport(text), { reload: false });
            return { settings: JSON.parse(localStorage.getItem('calculatorSettings') as string), dark: localStorage.getItem('darkMode.checked') };
        }, doc());
        expect(r.settings.language).toBeUndefined();
        expect(r.dark).toBeNull();
    });

    test('after import and reload: no first-run state, islands listed, no console errors; delete and rename keep the island data scope', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(e.message));
        page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
        await seedOnce(page);
        await ready(page);

        await Promise.all([
            page.waitForEvent('load'),
            page.evaluate((text: string) => {
                const ex = (window as any).exchange;
                const res = ex.applyImport(ex.planImport(text));
                if (!res.ok) throw new Error(res.error);
            }, doc()),
        ]);
        await appReady(page);

        const state = await page.evaluate(() => ({
            names: (window as any).view.islands().map((i: any) => i.name()),
            selected: (window as any).view.island().name(),
            version: localStorage.getItem('versionCalculator'),
            visibleModals: Array.from(document.querySelectorAll('.modal.show')).length,
        }));
        expect(state.names).toEqual(expect.arrayContaining(['All Islands', 'Alpha', 'Beta']));
        expect(state.selected).toBe('Alpha');
        expect(state.version).toBeTruthy();
        expect(state.visibleModals).toBe(0);

        // rename keeps the preserved island data
        const renamed = await page.evaluate(() => {
            const view = (window as any).view;
            const beta = view.islands().find((i: any) => i.name() === 'Beta');
            view.islandManager.islandNameInput('Gamma');
            view.islandManager.rename(beta, 'Gamma');
            return null;
        });
        await page.waitForTimeout(100);
        const afterRename = await page.evaluate(() => localStorage.getItem('Gamma'));
        const oldKey = await page.evaluate(() => localStorage.getItem('Beta'));
        expect(renamed).toBeNull();
        expect(oldKey).toBeNull();
        expect(afterRename).toContain('island-value');

        // delete removes the store and with it the preserved island data
        await page.evaluate(() => {
            const view = (window as any).view;
            const g = view.islands().find((i: any) => i.name() === 'Gamma');
            view.islandManager.delete(g);
        });
        await page.waitForTimeout(100);
        const afterDelete = await page.evaluate(() => ({
            store: localStorage.getItem('Gamma'),
            all: Object.keys(localStorage).map((k) => localStorage.getItem(k) as string).filter((v) => v.includes('island-value')).length,
        }));
        expect(afterDelete.store).toBeNull();
        expect(afterDelete.all).toBe(0);

        expect(errors).toEqual([]);
    });

    for (const name of ['item-locations.json', 'trade-point-to-point.json']) {
        test(`full import and reload of the vendored fixture ${name} loads without console errors`, async ({ page }) => {
            const errors: string[] = [];
            page.on('pageerror', (e) => errors.push(e.message));
            page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(m.text()); });
            await seedOnce(page);
            await ready(page);
            const text = fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
            await Promise.all([
                page.waitForEvent('load'),
                page.evaluate((t: string) => {
                    const ex = (window as any).exchange;
                    const plan = ex.planImport(t);
                    if (plan.error) throw new Error(plan.error);
                    const res = ex.applyImport(plan);
                    if (!res.ok) throw new Error(res.error);
                }, text),
            ]);
            await appReady(page);
            const n = await page.evaluate(() => (window as any).view.islands().length);
            expect(n).toBeGreaterThan(1);
            expect(errors).toEqual([]);
        });
    }
});
