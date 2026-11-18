import { test, expect, Page } from '@playwright/test';

async function ready(page: Page) {
    await page.goto('/');
    await page.waitForFunction(() => window.view && window.view.island());
}

// Creates a Roman-session island through the island manager without switching to it.
async function createIsland(page: Page, name: string) {
    await page.evaluate((n) => {
        const view = window.view;
        view.islandManager.showIslandOnCreation.checked(false);
        const session = view.sessions.find((s: Record<string, any>) => s.region.id === 'Roman');
        view.islandManager.create(n, session);
    }, name);
}

// Storage writes are debounced with setTimeout(0); wait until they are flushed.
async function flush(page: Page) {
    await page.evaluate(() => new Promise<void>((r) => setTimeout(() => setTimeout(r, 20), 20)));
}

function storeJson(page: Page, name: string) {
    return page.evaluate((n) => {
        const t = localStorage.getItem(n);
        return t ? JSON.parse(t) : null;
    }, name);
}

test.describe('island ids (U2)', () => {
    test('fresh island gets an id on first export call and keeps it after reload', async ({ page }) => {
        await ready(page);
        await createIsland(page, 'Fresh Isle');
        const before = await storeJson(page, 'Fresh Isle');
        expect(before === null || before['exchange.islandId'] === undefined).toBe(true);

        const id = await page.evaluate(() => window.exchange.islandId('Fresh Isle'));
        expect(id).toMatch(/^[0-9a-f]{16}$/);
        // a second read returns the same id
        expect(await page.evaluate(() => window.exchange.islandId('Fresh Isle'))).toBe(id);
        await flush(page);
        expect((await storeJson(page, 'Fresh Isle'))['exchange.islandId']).toBe(id);

        await page.reload();
        await page.waitForFunction(() => window.view && window.view.island());
        expect(await page.evaluate(() => window.exchange.islandId('Fresh Isle'))).toBe(id);
    });

    test('two islands get different ids', async ({ page }) => {
        await ready(page);
        await createIsland(page, 'Isle A');
        await createIsland(page, 'Isle B');
        const ids = await page.evaluate(() => [
            window.exchange.islandId('Isle A'),
            window.exchange.islandId('Isle B'),
        ]);
        expect(ids[0]).not.toBe(ids[1]);
    });

    test('renaming an island keeps the id', async ({ page }) => {
        await ready(page);
        await createIsland(page, 'Old Name');
        const id = await page.evaluate(() => window.exchange.islandId('Old Name'));
        await flush(page);
        await page.evaluate(() => {
            const view = window.view;
            const island = view.islands().find((i: Record<string, any>) => i.name() === 'Old Name');
            view.islandManager.islandNameInput('New Name');
            view.islandManager.rename(island, 'New Name');
        });
        await flush(page);
        expect(await storeJson(page, 'Old Name')).toBeNull();
        const store = await storeJson(page, 'New Name');
        expect(store['exchange.islandId']).toBe(id);
        expect(await page.evaluate(() => window.exchange.islandId('New Name'))).toBe(id);
    });

    test('deleting an island removes its store and id', async ({ page }) => {
        await ready(page);
        await createIsland(page, 'Doomed');
        await page.evaluate(() => window.exchange.islandId('Doomed'));
        await flush(page);
        expect((await storeJson(page, 'Doomed'))['exchange.islandId']).toBeTruthy();
        await page.evaluate(() => {
            const view = window.view;
            view.islandManager.delete(view.islands().find((i: Record<string, any>) => i.name() === 'Doomed'));
        });
        await flush(page);
        expect(await page.evaluate(() => localStorage.getItem('Doomed'))).toBeNull();
        expect(await page.evaluate(() => window.exchange.islandId('Doomed'))).toBeNull();
    });
});

test.describe('unique names (U2)', () => {
    test('a repeated name gets a numeric suffix', async ({ page }) => {
        await ready(page);
        const r = await page.evaluate(() => {
            const ex = window.exchange;
            const taken = new Set<string>();
            const a = ex.uniqueName('Latium 5', taken);
            taken.add(a);
            const b = ex.uniqueName('Latium 5', taken);
            taken.add(b);
            const c = ex.uniqueName('Latium 5', taken);
            return [a, b, c];
        });
        expect(r).toEqual(['Latium 5', 'Latium 5 (2)', 'Latium 5 (3)']);
    });

    test('reserved names get a suffix', async ({ page }) => {
        await ready(page);
        const names = ['tradeRoutes', 'devotion', 'language', 'All Islands', 'islandNames'];
        const r = await page.evaluate((ns) => {
            const ex = window.exchange;
            return ns.map((n: string) => ex.uniqueName(n, new Set<string>()));
        }, names);
        expect(r).toEqual(names.map((n) => `${n} (2)`));
    });

    test('names under a reserved key prefix get a suffix, other names do not', async ({ page }) => {
        await ready(page);
        const r = await page.evaluate(() => {
            const ex = window.exchange;
            const empty = new Set<string>();
            return [ex.uniqueName('settings.foo', empty), ex.uniqueName('Settings', empty), ex.uniqueName('Albion', empty)];
        });
        expect(r).toEqual(['settings.foo (2)', 'Settings', 'Albion']);
    });

    test('reservedKeys lists the top-level keys the app uses', async ({ page }) => {
        await ready(page);
        const keys: string[] = await page.evaluate(() => window.exchange.reservedKeys().keys);
        for (const k of ['All Islands', 'calculatorSettings', 'sessionSettings', 'globalEffects', 'tradeRoutes',
            'collapsibleStates', 'statisticsCollections', 'islandName', 'islandNames', 'versionCalculator', 'language', 'devotion']) {
            expect(keys).toContain(k);
        }
    });
});
