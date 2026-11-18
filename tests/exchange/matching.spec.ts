import { test, expect, Page } from '@playwright/test';

// U2: matching of file islands to stored calculator islands (src/exchange/matching.ts).

const LATIUM = 3245;
const ALBION = 6627;

async function ready(page: Page): Promise<void> {
    await page.goto('/');
    await page.waitForFunction(() => window.view && window.view.island() && window.exchange);
}

type File = { id: string; name: string; session?: number; game?: { sessionGuid: number; islandId: number; areaIndex: number } };
type Stored = { name: string; id?: string; session?: number; triple?: { islandId: number; areaIndex: number } };

function match(page: Page, files: File[], stored: Stored[]) {
    return page.evaluate(
        ({ files, stored, known, def }) => {
            const refs = files.map((f) => ({ id: f.id, name: f.name, session: f.session, gameIsland: f.game }));
            const store = stored.map((s) => ({ name: s.name, id: s.id, session: s.session, triple: s.triple }));
            return window.exchange.matchIslands(refs, store, { knownSessions: new Set(known), defaultSession: def });
        },
        { files, stored, known: [LATIUM, ALBION], def: LATIUM },
    );
}

test.describe('island matching (U2)', () => {
    test.beforeEach(async ({ page }) => {
        await ready(page);
    });

    test('the island id matches even when the names differ', async ({ page }) => {
        const r = await match(page, [{ id: 'abc', name: 'Renamed', session: LATIUM }], [{ name: 'Original', id: 'abc', session: LATIUM }]);
        expect(r).toEqual([{ fileId: 'abc', calcName: 'Original', by: 'id' }]);
    });

    test('the game-island triple matches when no id matches', async ({ page }) => {
        const r = await match(
            page,
            [{ id: 'x', name: 'Other', session: LATIUM, game: { sessionGuid: LATIUM, islandId: 7, areaIndex: 2 } }],
            [{ name: 'Mine', id: 'y', session: LATIUM, triple: { islandId: 7, areaIndex: 2 } }],
        );
        expect(r[0]).toEqual({ fileId: 'x', calcName: 'Mine', by: 'triple' });
    });

    test('a different triple does not match', async ({ page }) => {
        const r = await match(
            page,
            [{ id: 'x', name: 'Other', session: LATIUM, game: { sessionGuid: LATIUM, islandId: 7, areaIndex: 3 } }],
            [{ name: 'Mine', id: 'y', session: LATIUM, triple: { islandId: 7, areaIndex: 2 } }],
        );
        expect(r[0].calcName).toBeNull();
    });

    test('exact name with the same session matches', async ({ page }) => {
        const r = await match(page, [{ id: 'x', name: 'Alpha', session: LATIUM }], [{ name: 'Alpha', id: 'y', session: LATIUM }]);
        expect(r[0]).toEqual({ fileId: 'x', calcName: 'Alpha', by: 'name' });
    });

    test('an island without a session counts as the first session', async ({ page }) => {
        const r = await match(page, [{ id: 'x', name: 'Alpha' }], [{ name: 'Alpha', id: 'y' }]);
        expect(r[0].by).toBe('name');
    });

    test('the same name in another session is no match', async ({ page }) => {
        const r = await match(page, [{ id: 'x', name: 'Alpha', session: ALBION }], [{ name: 'Alpha', id: 'y', session: LATIUM }]);
        expect(r[0].calcName).toBeNull();
    });

    test('two file islands with one name and one calculator island: the first gets it', async ({ page }) => {
        const r = await match(
            page,
            [
                { id: 'x1', name: 'Alpha', session: LATIUM },
                { id: 'x2', name: 'Alpha', session: LATIUM },
            ],
            [{ name: 'Alpha', id: 'y', session: LATIUM }],
        );
        expect(r.map((m) => m.calcName)).toEqual(['Alpha', null]);
    });

    test('an id match is not taken by an earlier name match', async ({ page }) => {
        const r = await match(
            page,
            [
                { id: 'x1', name: 'Alpha', session: LATIUM },
                { id: 'known', name: 'Zed', session: LATIUM },
            ],
            [{ name: 'Alpha', id: 'known', session: LATIUM }],
        );
        expect(r.map((m) => [m.fileId, m.calcName, m.by])).toEqual([
            ['x1', null, null],
            ['known', 'Alpha', 'id'],
        ]);
    });

    test('an island of a session the calculator does not know (orphan) is never matched', async ({ page }) => {
        const r = await match(page, [{ id: 'abc', name: 'Alpha', session: 99999 }], [{ name: 'Alpha', id: 'abc', session: LATIUM }]);
        expect(r[0].calcName).toBeNull();
    });

    test('an island without an id receives one before matching and keeps it', async ({ page }) => {
        await page.evaluate(() => {
            const view = window.view;
            view.islandManager.showIslandOnCreation.checked(false);
            const session = view.sessions.find((s: Record<string, any>) => s.region.id === 'Roman');
            view.islandManager.create('Fresh Isle', session);
        });
        const first = await page.evaluate(() => window.exchange.readStoredIslands().find((s) => s.name === 'Fresh Isle'));
        expect(first?.id).toMatch(/^[0-9a-f]{16}$/);
        const second = await page.evaluate(() => window.exchange.readStoredIslands().find((s) => s.name === 'Fresh Isle'));
        expect(second?.id).toBe(first?.id);
        expect(second?.session).toBe(LATIUM);
    });
});
