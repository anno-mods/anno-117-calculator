import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

/**
 * Volcano level selector in the settings dialog (templates/dlc-settings.html, included by settings-dialog.html).
 */
const LATIUM = 3245;
const PROPHECIES = 67902;
const GATHERING = 145095;
const MINING = 148043;
const FERTILE = 145099;
const EFFECTS = [GATHERING, MINING, FERTILE];

async function open(page: Page, sessionSettings: Record<string, unknown> = {}, detector?: BindingErrorDetector) {
    const loader = new ConfigLoader();
    const config = loader.createIslandConfig('Latium', LATIUM, {});
    config.sessionSettings = sessionSettings;
    await loader.loadConfigObject(page, config);
    if (detector) detector.listenForErrors(page);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.evaluate(() => { (window as any).$('#settings-dialog').modal('show'); });
    await page.waitForSelector('#settings-dialog.show', { timeout: 10000 });
}

function seed(scales: Record<number, number>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const s of [LATIUM, 37135])
        for (const e of EFFECTS) if (scales[e] !== undefined) out[`session.${s}.effect.${e}.scaling`] = String(scales[e]);
    return out;
}

async function setDlc(page: Page, checked: boolean) {
    await page.evaluate(({ g, c }) => { (window as any).view.dlcsGuidMap.get(g).checked(c); }, { g: PROPHECIES, c: checked });
    await page.waitForTimeout(150);
}

async function currentScales(page: Page): Promise<number[]> {
    return page.evaluate((effects) => {
        const s = (window as any).view.sessions.find((x: any) => x.guid === 3245);
        return effects.map((e: number) => s.effects.find((x: any) => x.guid === e).scaling());
    }, EFFECTS);
}

test.describe('Volcano level selector in the settings dialog', () => {
    test('DLC on: six buttons, the one of the current level is pressed', async ({ page }) => {
        const detector = new BindingErrorDetector();
        await open(page, seed({ [GATHERING]: 5, [MINING]: 5, [FERTILE]: 5 }), detector);
        await page.waitForSelector('.dlc-extras .volcano-level-button', { timeout: 10000 });
        const buttons = page.locator('.dlc-extras .volcano-level-button');
        await expect(buttons).toHaveCount(6);
        await expect(buttons.nth(5)).toHaveAttribute('aria-pressed', 'true');
        await expect(buttons.nth(3)).toHaveAttribute('aria-pressed', 'false');
        expect(detector.getErrorCounts().binding, detector.getFormattedBindingErrors().join(' | ')).toBe(0);
    });

    test('DLC off: the selector is not in the DOM and no binding error is reported', async ({ page }) => {
        const detector = new BindingErrorDetector();
        await open(page, {}, detector);
        await setDlc(page, false);
        await expect(page.locator('.dlc-extras')).toHaveCount(0);
        expect(await currentScales(page)).toEqual([0, 0, 0]);

        await setDlc(page, true);
        await expect(page.locator('.dlc-extras')).toHaveCount(1);
        expect(detector.getErrorCounts().binding, detector.getFormattedBindingErrors().join(' | ')).toBe(0);
        expect(detector.getErrorCounts().knockout, detector.getFormattedKnockoutErrors().join(' | ')).toBe(0);
    });

    test('clicking a level writes it, locks the DLC checkbox; level 0 releases the lock', async ({ page }) => {
        await open(page);
        await setDlc(page, true);
        await page.waitForSelector('.dlc-extras .volcano-level-button');
        const buttons = page.locator('.dlc-extras .volcano-level-button');
        const dlcInput = page.locator('#settings-dialog .dlc-list input[type=checkbox]').first();

        await buttons.nth(3).click();
        expect(await currentScales(page)).toEqual([3, 3, 3]);
        await expect(buttons.nth(3)).toHaveAttribute('aria-pressed', 'true');
        await expect(dlcInput).toBeDisabled();

        await buttons.nth(0).click();
        expect(await currentScales(page)).toEqual([0, 0, 0]);
        await expect(buttons.nth(0)).toHaveAttribute('aria-pressed', 'true');
        await expect(dlcInput).toBeEnabled();
    });

    test('mixed scales: no button pressed, a sentence and one row per effect; a click clears the note', async ({ page }) => {
        await open(page, seed({ [GATHERING]: 3, [MINING]: 5, [FERTILE]: 0 }));
        await page.waitForSelector('.dlc-extras .volcano-level-button');
        const buttons = page.locator('.dlc-extras .volcano-level-button');
        for (let i = 0; i < 6; i++) await expect(buttons.nth(i)).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('.volcano-level-differs')).toHaveCount(1);
        const rows = page.locator('.volcano-level-difference');
        await expect(rows).toHaveCount(3);
        await expect(rows.nth(0).locator('strong')).toHaveText('3');
        await expect(rows.nth(1).locator('strong')).toHaveText('5');
        await expect(rows.nth(2).locator('strong')).toHaveText('0');

        await buttons.nth(4).click();
        await expect(page.locator('.volcano-level-differs')).toHaveCount(0);
        expect(await currentScales(page)).toEqual([4, 4, 0]);
    });

    test('every icon of the selector has a title', async ({ page }) => {
        await open(page, seed({ [GATHERING]: 3, [MINING]: 5, [FERTILE]: 0 }));
        await page.waitForSelector('.dlc-extras .volcano-level-button');
        const titles = await page.locator('.dlc-extras img').evaluateAll((imgs) => imgs.map((i) => i.getAttribute('title') || ''));
        expect(titles.length).toBe(4);
        for (const t of titles) expect(t.length).toBeGreaterThan(0);
    });
});
