import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import Ajv2020 from 'ajv/dist/2020';
import { seedOnce, appReady } from '../helpers/exchange';

// U10: export and import buttons, report dialog.

const VENDOR = path.join(__dirname, '..', '..', 'vendor', 'anno117-exchange');
const VALID = path.join(VENDOR, 'fixtures', 'valid');
const INVALID = path.join(VENDOR, 'fixtures', 'invalid');
const LATIUM = 3245;
const FARM = 2786;
const FARM_MODULE = 77954;

const schema = JSON.parse(fs.readFileSync(path.join(VENDOR, 'schema', 'anno117-exchange.schema.json'), 'utf-8'));
const validateSchema = new Ajv2020({ strict: false, allErrors: true }).compile(schema);

async function open(page: Page): Promise<void> {
    await seedOnce(page);
    await page.goto('/');
    await appReady(page);
}

async function openDownloadDialog(page: Page): Promise<void> {
    await page.locator('#download-selection-button').click();
    await expect(page.locator('#download-dialog')).toBeVisible();
    // Bootstrap ignores hide() while the fade-in runs; wait until the dialog is fully shown, as a user picking a file would.
    await page.waitForFunction(() => { const m = (window as any).$('#download-dialog').data('bs.modal'); return !!m && m._isShown && !m._isTransitioning; });
}

async function snapshot(page: Page): Promise<string> {
    await page.evaluate(() => new Promise<void>((r) => setTimeout(() => setTimeout(r, 30), 30)));
    return page.evaluate(() => {
        const out: Record<string, string | null> = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i) as string;
            out[k] = localStorage.getItem(k);
        }
        return JSON.stringify(Object.keys(out).sort().map((k) => [k, out[k]]));
    });
}

function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        if (/Failed to load resource/.test(m.text())) return;
        errors.push(m.text());
    });
    return errors;
}

test.describe('exchange interface (U10)', () => {
    test('the new buttons sit after the old config row and the old buttons stay', async ({ page }) => {
        await open(page);
        await openDownloadDialog(page);
        await expect(page.locator('#export-config-button')).toBeVisible();
        await expect(page.locator('#export-exchange-button')).toBeVisible();
        await expect(page.locator('#import-exchange-button')).toBeVisible();
        await expect(page.locator('#export-exchange-button span.fa-download')).toHaveCount(1);
        await expect(page.locator('#import-exchange-button span.fa-upload')).toHaveCount(1);
        expect(await page.locator('#export-exchange-button').getAttribute('title')).toBeTruthy();
    });

    test('an invalid file shows the message and changes nothing', async ({ page }) => {
        const errors = collectErrors(page);
        await open(page);
        const before = await snapshot(page);
        await openDownloadDialog(page);
        await page.setInputFiles('#exchange-selector', path.join(INVALID, 'newer-major.json'));
        await expect(page.locator('#exchange-invalid-message')).toBeVisible();
        await expect(page.locator('#exchange-report-dialog')).not.toBeVisible();
        expect(await snapshot(page)).toBe(before);
        expect(errors).toEqual([]);
    });

    test('a valid file opens the dialog with scope, island count and carried-through list; Cancel changes nothing', async ({ page }) => {
        const errors = collectErrors(page);
        await open(page);
        const before = await snapshot(page);
        await openDownloadDialog(page);
        await page.setInputFiles('#exchange-selector', path.join(VALID, 'item-locations.json'));
        const dialog = page.locator('#exchange-report-dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('#exchange-replace-warning')).toContainText(/settings/i);
        await expect(dialog.locator('#exchange-replace-warning')).toContainText(/trade/i);
        await expect(dialog.locator('#exchange-replace-warning')).toContainText(/preserved/i);
        await expect(dialog.locator('#exchange-replace-warning')).toContainText(/language/i);
        const expected = await page.evaluate((p) => {
            const plan = (window as any).exchange.planImport(p);
            return { islands: plan.report.counts.islands, carried: plan.report.carriedThrough.length, firstMessage: plan.report.carriedThrough[0]?.message };
        }, fs.readFileSync(path.join(VALID, 'item-locations.json'), 'utf-8'));
        await expect(dialog.locator('#exchange-count-islands')).toContainText(String(expected.islands));
        expect(expected.carried).toBeGreaterThan(0);
        await expect(dialog.locator('#exchange-carried li')).not.toHaveCount(0);
        await expect(dialog.locator('#exchange-carried')).toContainText(expected.firstMessage as string);
        await expect(dialog.locator('#exchange-confirm-button')).toBeVisible();
        await dialog.locator('#exchange-cancel-button').click();
        await expect(dialog).not.toBeVisible();
        expect(await snapshot(page)).toBe(before);
        expect(errors).toEqual([]);
    });

    test('Confirm replaces the stored data and reloads (AE23)', async ({ page }) => {
        await open(page);
        const before = await snapshot(page);
        await openDownloadDialog(page);
        await page.setInputFiles('#exchange-selector', path.join(VALID, 'minimal-third-party.json'));
        const dialog = page.locator('#exchange-report-dialog');
        await expect(dialog).toBeVisible();
        const reloaded = page.waitForEvent('load');
        await dialog.locator('#exchange-confirm-button').click();
        await reloaded;
        await appReady(page);
        expect(await snapshot(page)).not.toBe(before);
        const names = await page.evaluate(() => (window as any).view.islands().map((i: any) => i.name()));
        expect(names.length).toBeGreaterThan(1);
    });

    test('a failed write shows the failure message and keeps the page', async ({ page }) => {
        await open(page);
        await openDownloadDialog(page);
        await page.setInputFiles('#exchange-selector', path.join(VALID, 'minimal-third-party.json'));
        const dialog = page.locator('#exchange-report-dialog');
        await expect(dialog).toBeVisible();
        await page.evaluate(() => {
            const orig = Storage.prototype.setItem;
            Storage.prototype.setItem = function () {
                Storage.prototype.setItem = orig;
                throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
            };
        });
        await dialog.locator('#exchange-confirm-button').click();
        await expect(dialog.locator('#exchange-failed-message')).toBeVisible();
    });

    test('export downloads Anno117CalculatorExchange.json that validates', async ({ page }) => {
        await open(page);
        await openDownloadDialog(page);
        const download = page.waitForEvent('download');
        await page.locator('#export-exchange-button').click();
        const d = await download;
        expect(d.suggestedFilename()).toBe('Anno117CalculatorExchange.json');
        const doc = JSON.parse(fs.readFileSync((await d.path()) as string, 'utf-8'));
        expect(validateSchema(doc), JSON.stringify(validateSchema.errors)).toBe(true);
        expect(doc.format).toBe('anno117-exchange');
        // nothing dropped: no report dialog, no confirm
        await expect(page.locator('#exchange-report-dialog')).not.toBeVisible();
    });

    test('an export that drops a module attachment opens the read-only report naming it', async ({ page }) => {
        const errors = collectErrors(page);
        await open(page);
        const text = JSON.stringify({
            format: 'anno117-exchange', formatVersion: '1.0', generator: { name: 'u10-test' },
            islands: [{
                id: 'a', name: 'Alpha', session: LATIUM, buildings: { [FARM]: { built: 3 } },
                factories: { [FARM]: { modules: { [FARM_MODULE]: true } } },
                moduleAttachments: [{ building: FARM, instance: 11, module: FARM_MODULE, moduleInstance: 21 }],
            }],
        });
        await page.evaluate(() => new Promise<void>((r) => setTimeout(() => setTimeout(r, 30), 30)));
        const ok = await page.evaluate((t) => {
            const ex = (window as any).exchange;
            const plan = ex.planImport(t);
            return ex.applyImport(plan, { reload: false }).ok;
        }, text);
        expect(ok).toBe(true);
        await page.reload();
        await appReady(page);
        await page.evaluate(([farm, mod]) => {
            const isl = (window as any).view.islands().find((i: any) => i.name() === 'Alpha');
            isl.assetsMap.get(farm).modules.find((x: any) => x.guid === mod).checked(false);
        }, [FARM, FARM_MODULE]);
        await openDownloadDialog(page);
        const download = page.waitForEvent('download');
        await page.locator('#export-exchange-button').click();
        await download;
        const dialog = page.locator('#exchange-report-dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.locator('#exchange-confirm-button')).toHaveCount(0);
        const message = await page.evaluate(() => {
            const r = (window as any).exchange.exportDocument().report.find((e: any) => e.code === 'module-attachments-dropped');
            return r.message as string;
        });
        await expect(dialog).toContainText(message);
        expect(errors).toEqual([]);
    });
});
