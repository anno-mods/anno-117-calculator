import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { appReady, collectErrors, fileOf, importText, openApp, settle } from '../helpers/exchange';

// U6: the scope block of the Download dialog, persistence of the ticks, the sentence and the Undo button.

const LATIUM = 3245;
const RESIDENCE = 3087;
const SAWMILL = 3089;
const UNDO_TEXT = 'Undo import. Everything changed since then is lost.';

const SCOPE_IDS = ['islands', 'residences', 'production', 'trade', 'modifiers'];

async function openDownloadDialog(page: Page): Promise<void> {
    await page.locator('#download-selection-button').click();
    await expect(page.locator('#download-dialog')).toBeVisible();
    await page.waitForFunction(() => {
        const m = window.$('#download-dialog').data('bs.modal');
        return !!m && m._isShown && !m._isTransitioning;
    });
}

function tmpFile(text: string): string {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'scopes-')), 'file.json');
    fs.writeFileSync(file, text);
    return file;
}

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

function twoIslands(a: number, b: number, extra: Record<string, unknown> = {}): string {
    return fileOf(
        [
            { id: 'a', name: 'A', session: LATIUM, buildings: { [RESIDENCE]: { built: a }, [SAWMILL]: { built: a } } },
            { id: 'b', name: 'B', session: LATIUM, buildings: { [RESIDENCE]: { built: b }, [SAWMILL]: { built: b } } },
        ],
        extra,
    );
}

test.describe('import scope block (U6)', () => {
    test('shows the five scopes in order, all ticked; the toggles follow the ticks and carry a title', async ({ page }) => {
        const errors = collectErrors(page);
        await openApp(page);
        await openDownloadDialog(page);
        const ids = await page.locator('#import-scope-block input[type=checkbox]').evaluateAll((els) => els.map((e) => e.id));
        expect(ids).toEqual(SCOPE_IDS.map((s) => `import-scope-${s}`));
        for (const s of SCOPE_IDS) await expect(page.locator(`#import-scope-${s}`)).toBeChecked();
        for (const id of ['import-keep-islands', 'import-keep-routes', 'import-recalc-routes']) {
            const b = page.locator(`#${id}`);
            await expect(b).toBeEnabled();
            await expect(b).toHaveAttribute('aria-pressed', 'true');
            expect(((await b.getAttribute('title')) ?? '').length).toBeGreaterThan(0);
            expect(((await b.getAttribute('aria-label')) ?? '').length).toBeGreaterThan(0);
        }
        await page.locator('#import-scope-islands').uncheck();
        await expect(page.locator('#import-keep-islands')).toBeDisabled();
        await expect(page.locator('#import-keep-routes')).toBeEnabled();
        await page.locator('#import-scope-trade').uncheck();
        await expect(page.locator('#import-keep-routes')).toBeDisabled();
        await expect(page.locator('#import-recalc-routes')).toBeDisabled();
        expect(errors).toEqual([]);
    });

    test('Covers AE3: unticked Production, keep-routes and re-calculation survive a reload', async ({ page }) => {
        await openApp(page);
        await openDownloadDialog(page);
        await page.locator('#import-scope-production').uncheck();
        await page.locator('#import-keep-routes').click();
        await page.locator('#import-recalc-routes').click();
        await settle(page);
        await page.reload();
        await appReady(page);
        await openDownloadDialog(page);
        await expect(page.locator('#import-scope-production')).not.toBeChecked();
        for (const s of ['islands', 'residences', 'trade', 'modifiers']) await expect(page.locator(`#import-scope-${s}`)).toBeChecked();
        await expect(page.locator('#import-keep-routes')).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('#import-recalc-routes')).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('#import-keep-islands')).toHaveAttribute('aria-pressed', 'true');
        const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('calculatorSettings') as string));
        expect(settings['settings.importScope.production']).toBe('0');
        expect(settings['settings.importScope.keepRoutes']).toBe('0');
    });

    test('the sentence names what the next import does and updates with the ticks and toggles', async ({ page }) => {
        await openApp(page);
        await openDownloadDialog(page);
        const sentence = page.locator('#import-scope-sentence');
        await expect(sentence).toContainText('This import replaces:');
        await expect(sentence).not.toContainText('Left unchanged');
        await expect(sentence).toContainText('Re-calculate routes from savegame data');
        await expect(sentence).toContainText(/Merged with your own entries: Islands/);
        await page.locator('#import-scope-modifiers').uncheck();
        await expect(sentence).toContainText(/Left unchanged: Modifiers/);
        await page.locator('#import-recalc-routes').click();
        await expect(sentence).not.toContainText('Re-calculate routes from savegame data');
        await page.locator('#import-keep-islands').click();
        await expect(sentence).not.toContainText(/Merged with your own entries: Islands/);
        await expect(sentence).toHaveAttribute('aria-live', 'polite');
    });

    test('choosing a file imports at once with the ticked scopes: no report, Download dialog with Undo, only residence keys changed', async ({ page }) => {
        const errors = collectErrors(page);
        await openApp(page);
        expect((await importText(page, twoIslands(1, 2))).ok).toBe(true);
        const before = await dump(page);
        await openDownloadDialog(page);
        for (const s of ['islands', 'production', 'trade', 'modifiers']) await page.locator(`#import-scope-${s}`).uncheck();
        const reloaded = page.waitForEvent('load');
        await page.setInputFiles('#exchange-selector', tmpFile(twoIslands(30, 40)));
        await reloaded;
        await appReady(page);
        await expect(page.locator('#download-dialog')).toBeVisible();
        await expect(page.locator('#exchange-report-dialog')).not.toBeVisible();
        await expect(page.locator('#import-undo-button')).toBeVisible();
        // the choice survived the reload
        await expect(page.locator('#import-scope-residences')).toBeChecked();
        await expect(page.locator('#import-scope-production')).not.toBeChecked();

        const after = await dump(page);
        for (const [island, built] of [['A', 30], ['B', 40]] as const) {
            const a = JSON.parse(before[island]);
            const b = JSON.parse(after[island]);
            expect(b[`${RESIDENCE}.buildings.constructed`]).toBe(built);
            const changed = Object.keys({ ...a, ...b }).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]) && k !== 'exchange.ext');
            expect(changed).toEqual([`${RESIDENCE}.buildings.constructed`]);
        }
        expect(errors).toEqual([]);
    });

    test('Covers AE8: the Undo button has the stated text and title, restores the data and disappears', async ({ page }) => {
        await openApp(page);
        expect((await importText(page, twoIslands(1, 2))).ok).toBe(true);
        const before = await dump(page);
        await openDownloadDialog(page);
        const reloaded = page.waitForEvent('load');
        await page.setInputFiles('#exchange-selector', tmpFile(twoIslands(30, 40)));
        await reloaded;
        await appReady(page);
        const undo = page.locator('#import-undo-button');
        await expect(undo).toBeVisible();
        await expect(undo).toHaveText(UNDO_TEXT);
        await expect(undo).toHaveAttribute('title', UNDO_TEXT);
        expect((await dump(page))['A']).not.toBe(before['A']);

        const back = page.waitForEvent('load');
        await undo.click();
        await back;
        await appReady(page);
        const after = await dump(page);
        for (const island of ['A', 'B']) expect(JSON.parse(after[island])[`${RESIDENCE}.buildings.constructed`]).toBe(JSON.parse(before[island])[`${RESIDENCE}.buildings.constructed`]);
        await openDownloadDialog(page);
        await expect(page.locator('#import-undo-button')).toHaveCount(0);
    });

    test('a failing snapshot write: the import still runs and no Undo button appears', async ({ page }) => {
        await openApp(page);
        expect((await importText(page, twoIslands(1, 2))).ok).toBe(true);
        await openDownloadDialog(page);
        await page.evaluate(() => {
            const orig = Storage.prototype.setItem;
            Storage.prototype.setItem = function (key: string, value: string) {
                if (key === 'exchange.undoSnapshot') throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
                return orig.call(this, key, value);
            };
        });
        const reloaded = page.waitForEvent('load');
        await page.setInputFiles('#exchange-selector', tmpFile(twoIslands(30, 40)));
        await reloaded;
        await appReady(page);
        const built = await dump(page);
        expect(JSON.parse(built['A'])[`${RESIDENCE}.buildings.constructed`]).toBe(30);
        await expect(page.locator('#download-dialog')).toBeVisible();
        await expect(page.locator('#import-undo-button')).toHaveCount(0);
    });

    test('a file that is not an exchange file shows the message, imports nothing and offers no Undo', async ({ page }) => {
        await openApp(page);
        const before = await dump(page);
        await openDownloadDialog(page);
        await page.setInputFiles('#exchange-selector', tmpFile('{"hello":"world"}'));
        await expect(page.locator('#exchange-invalid-message')).toBeVisible();
        await expect(page.locator('#import-undo-button')).toHaveCount(0);
        expect(await dump(page)).toEqual(before);
    });

    test('the scope settings are neither exported nor imported', async ({ page }) => {
        await openApp(page);
        await openDownloadDialog(page);
        await page.locator('#import-scope-production').uncheck();
        await settle(page);
        const doc = await page.evaluate(() => window.exchange.exportDocument().document);
        expect(JSON.stringify(doc)).not.toContain('settings.importScope');

        const hostile = fileOf([{ id: 'a', name: 'A', session: LATIUM }], { ext: { calculator: { settings: { 'settings.importScope.production': '1', language: 'german' } } } });
        const result = await page.evaluate((t) => {
            const plan = window.exchange.planImport(t);
            if ('error' in plan) return null;
            return JSON.parse(plan.keyMap['calculatorSettings']);
        }, hostile);
        expect(result['settings.importScope.production']).toBeUndefined();
        expect(result.language).toBeUndefined();
    });

    test('the dialog renders without binding errors in dark mode', async ({ page }) => {
        const errors = collectErrors(page);
        await openApp(page);
        await page.evaluate(() => {
            window.view.darkMode.checked(true);
        });
        await openDownloadDialog(page);
        await expect(page.locator('#import-scope-block')).toBeVisible();
        await page.locator('#import-scope-residences').uncheck();
        await page.locator('#import-scope-residences').check();
        expect(errors).toEqual([]);
    });
});
