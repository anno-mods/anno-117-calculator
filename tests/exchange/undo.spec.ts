import { test, expect, Page } from '@playwright/test';
import { fileOf, importText, Json, openApp, settle } from '../helpers/exchange';

// U5: the undo snapshot (src/exchange/undo.ts) and the writer's just-imported flag.

const LATIUM = 3245;
const RESIDENCE = 3087;
const SAWMILL = 3089;

function incoming(built: number): string {
    return fileOf([{ id: 'a', name: 'A', session: LATIUM, buildings: { [RESIDENCE]: { built } } }]);
}

function baseFile(): string {
    return fileOf([
        { id: 'a', name: 'A', session: LATIUM, buildings: { [RESIDENCE]: { built: 1 } } },
        { id: 'b', name: 'B', session: LATIUM, buildings: { [SAWMILL]: { built: 1 } } },
    ]);
}

// All localStorage entries as an object (after the debounced saves).
async function dump(page: Page): Promise<Record<string, string>> {
    await settle(page);
    return page.evaluate(() => {
        const out: Record<string, string> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i) as string;
            out[k] = localStorage.getItem(k) as string;
        }
        return out;
    });
}

// Sets an inner key of an island store directly in localStorage (no live Storage involved).
async function setStoreKey(page: Page, island: string, key: string, value: unknown): Promise<void> {
    await page.evaluate(
        ({ island, key, value }) => {
            const store = JSON.parse(localStorage.getItem(island) as string);
            store[key] = value;
            localStorage.setItem(island, JSON.stringify(store));
        },
        { island, key, value },
    );
}

// Snapshot, import `text` without reload, as the import listener of main.ts does.
async function snapshotAndImport(page: Page, text: string): Promise<void> {
    await settle(page);
    const ok = await page.evaluate((t) => {
        const ex = window.exchange;
        ex.undo.saveSnapshot(ex.undo.snapshot());
        const plan = ex.planScopedImport(t, { islands: true, residences: true, production: true, trade: true, modifiers: true, keepIslands: false, keepRoutes: false, recalcRoutes: false });
        if ('error' in plan) return false;
        return ex.applyImport(plan, { reload: false }).ok;
    }, text);
    expect(ok).toBe(true);
}

test.describe('undo snapshot (U5)', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
        expect((await importText(page, baseFile())).ok).toBe(true);
    });

    test('Covers AE8: Undo restores the data from before the import except device preferences; later edits are lost', async ({ page }) => {
        await setStoreKey(page, 'A', `${SAWMILL}.buildings.constructed`, 5);
        const before = await dump(page);
        await snapshotAndImport(page, incoming(40));
        expect((await dump(page))['A']).not.toBe(before['A']);

        // a later edit, and device preferences changed after the import
        await setStoreKey(page, 'A', `${SAWMILL}.buildings.constructed`, 77);
        await page.evaluate(() => {
            const s = JSON.parse(localStorage.getItem('calculatorSettings') ?? '{}');
            s.language = 'french';
            s['settings.importScope.trade'] = '0';
            localStorage.setItem('calculatorSettings', JSON.stringify(s));
            localStorage.setItem('darkMode.checked', 'true');
        });
        const result = await page.evaluate(() => window.exchange.undo.restoreSnapshot({ reload: false }));
        expect(result.ok).toBe(true);

        const after = await dump(page);
        const expected: Record<string, string> = { ...before, 'darkMode.checked': 'true' };
        const settings = JSON.parse(before['calculatorSettings'] ?? '{}');
        settings.language = 'french';
        settings['settings.importScope.trade'] = '0';
        expected['calculatorSettings'] = JSON.stringify(settings);
        expect(Object.keys(after).sort()).toEqual(Object.keys(expected).sort());
        for (const k of Object.keys(expected)) {
            if (k === 'calculatorSettings') expect(JSON.parse(after[k])).toEqual(JSON.parse(expected[k]));
            else expect(after[k], k).toBe(expected[k]);
        }
        expect(JSON.parse(after['A'])[`${SAWMILL}.buildings.constructed`]).toBe(5);
    });

    test('the snapshot survives a reload in the same tab and is absent in a new tab', async ({ page }) => {
        await snapshotAndImport(page, incoming(40));
        expect(await page.evaluate(() => window.exchange.undo.hasSnapshot())).toBe(true);
        await page.reload();
        await page.waitForFunction(() => window.view && window.view.island() && window.exchange);
        expect(await page.evaluate(() => window.exchange.undo.hasSnapshot())).toBe(true);

        const other = await page.context().newPage();
        await other.goto('/');
        await other.waitForFunction(() => window.view && window.view.island() && window.exchange);
        expect(await other.evaluate(() => window.exchange.undo.hasSnapshot())).toBe(false);
        await other.close();
    });

    test('a second import overwrites the snapshot: Undo returns to the state before the second import', async ({ page }) => {
        await snapshotAndImport(page, incoming(40));
        const afterFirst = await dump(page);
        await snapshotAndImport(page, incoming(60));
        const result = await page.evaluate(() => window.exchange.undo.restoreSnapshot({ reload: false }));
        expect(result.ok).toBe(true);
        const after = await dump(page);
        expect(after['A']).toBe(afterFirst['A']);
        expect(JSON.parse(after['A'])[`${RESIDENCE}.buildings.constructed`]).toBe(40);
    });

    test('without a snapshot there is nothing to undo; after Undo the snapshot is gone', async ({ page }) => {
        expect(await page.evaluate(() => window.exchange.undo.hasSnapshot())).toBe(false);
        const none = await page.evaluate(() => window.exchange.undo.restoreSnapshot({ reload: false }));
        expect(none.ok).toBe(false);

        await snapshotAndImport(page, incoming(40));
        expect((await page.evaluate(() => window.exchange.undo.restoreSnapshot({ reload: false }))).ok).toBe(true);
        expect(await page.evaluate(() => window.exchange.undo.hasSnapshot())).toBe(false);
    });

    test('a failing snapshot write returns an error, leaves no old snapshot and does not stop the import', async ({ page }) => {
        await snapshotAndImport(page, incoming(40));
        expect(await page.evaluate(() => window.exchange.undo.hasSnapshot())).toBe(true);
        const r = await page.evaluate((t) => {
            const orig = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key: string, value: string) {
                if (key === 'exchange.undoSnapshot') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
                return orig.call(this, key, value);
            };
            try {
                const ex = window.exchange;
                const saved = ex.undo.saveSnapshot(ex.undo.snapshot());
                const plan = ex.planImport(t);
                if ('error' in plan) return { saved, applied: false, has: false };
                const applied = ex.applyImport(plan, { reload: false }).ok;
                return { saved, applied, has: ex.undo.hasSnapshot() };
            } finally {
                Storage.prototype.setItem = orig;
            }
        }, incoming(70));
        expect(r.saved.ok).toBe(false);
        expect(r.applied).toBe(true);
        expect(r.has).toBe(false);
    });

    test('a write failure during the restore puts the data back as it was', async ({ page }) => {
        const r = await page.evaluate(() => {
            const makeStore = (init: Record<string, string>, failAt?: number) => {
                const data = new Map<string, string>(Object.entries(init));
                let writes = 0;
                return {
                    data,
                    get length() { return data.size; },
                    key: (i: number) => [...data.keys()][i] ?? null,
                    getItem: (k: string) => (data.has(k) ? (data.get(k) as string) : null),
                    setItem: (k: string, v: string) => {
                        writes++;
                        if (failAt !== undefined && writes === failAt) throw new DOMException('quota', 'QuotaExceededError');
                        data.set(k, v);
                    },
                    removeItem: (k: string) => { data.delete(k); },
                    clear: () => data.clear(),
                };
            };
            const session = makeStore({});
            const ex = window.exchange;
            ex.undo.saveSnapshot(new Map([['a', '1'], ['b', '2'], ['c', '3']]), { session });
            const storage = makeStore({ x: 'current' }, 2);
            const res = ex.undo.restoreSnapshot({ session, storage, reload: false });
            return { res, keys: [...storage.data.keys()], x: storage.data.get('x'), still: ex.undo.hasSnapshot({ session }) };
        });
        expect(r.res.ok).toBe(false);
        expect(r.keys).toEqual(['x']);
        expect(r.x).toBe('current');
        expect(r.still).toBe(true);
    });

    test('the snapshot is in sessionStorage only: not in localStorage, not in the exported document', async ({ page }) => {
        await snapshotAndImport(page, incoming(40));
        const r = await page.evaluate(() => ({
            local: Object.keys(localStorage).filter((k) => k.includes('undo')),
            localText: Object.keys(localStorage).some((k) => (localStorage.getItem(k) ?? '').includes('exchange.undoSnapshot')),
            session: sessionStorage.getItem('exchange.undoSnapshot') !== null,
            exported: JSON.stringify(window.exchange.exportDocument().document).includes('undoSnapshot'),
        }));
        expect(r.local).toEqual([]);
        expect(r.localText).toBe(false);
        expect(r.session).toBe(true);
        expect(r.exported).toBe(false);
    });

    test('the scope settings are device settings: not exported', async ({ page }) => {
        await page.evaluate(() => {
            const s = JSON.parse(localStorage.getItem('calculatorSettings') ?? '{}');
            s['settings.importScope.production'] = '0';
            s.language = 'german';
            localStorage.setItem('calculatorSettings', JSON.stringify(s));
        });
        const doc = (await page.evaluate(() => window.exchange.exportDocument().document)) as Json;
        const settings = (doc.ext?.calculator?.settings ?? {}) as Json;
        expect(Object.keys(settings).filter((k) => k.startsWith('settings.importScope.') || k === 'language')).toEqual([]);
    });
});
