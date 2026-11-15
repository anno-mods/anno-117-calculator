import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * DlcSettings.volcano (src/dlc-settings.ts): the volcano level model over the scales of the three volcano effects in
 * the Latium (3245) and Meta (37135) sessions, and the unlocked set stored as `volcano.unlocked` in sessionSettings.
 */
const LATIUM = 3245;
const META = 37135;
const ALBION = 6627;
const GATHERING = 145095;
const MINING = 148043;
const FERTILE = 145099;
const PROPHECIES = 67902;
const EFFECTS = [GATHERING, MINING, FERTILE];

type Scales = Record<number, number>;

function sessionKey(session: number, effect: number): string {
    return `session.${session}.effect.${effect}.scaling`;
}

// sessionSettings seed: the same scale in both volcano sessions.
function seed(scales: Scales, unlocked?: number[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const s of [LATIUM, META])
        for (const e of EFFECTS)
            if (scales[e] !== undefined) out[sessionKey(s, e)] = String(scales[e]);
    if (unlocked) out['volcano.unlocked'] = unlocked;
    return out;
}

async function open(page: Page, sessionSettings: Record<string, unknown> = {}) {
    const loader = new ConfigLoader();
    const config = loader.createIslandConfig('Latium', LATIUM, {});
    config.sessionSettings = sessionSettings;
    await loader.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.waitForTimeout(200);
}

async function scales(page: Page, session: number): Promise<Scales> {
    return page.evaluate(({ session, effects }) => {
        const s = (window as any).view.sessions.find((x: any) => x.guid === session);
        const out: Record<number, number> = {};
        for (const e of effects) out[e] = s.effects.find((x: any) => x.guid === e).scaling();
        return out;
    }, { session, effects: EFFECTS });
}

async function level(page: Page): Promise<number | null> {
    return page.evaluate(() => (window as any).view.dlcSettings.volcano.level());
}

async function setLevel(page: Page, n: number) {
    await page.evaluate((v) => { (window as any).view.dlcSettings.volcano.level(v); }, n);
    await page.waitForTimeout(100);
}

async function unlocked(page: Page): Promise<number[]> {
    return page.evaluate(() => (window as any).view.dlcSettings.volcano.unlocked());
}

async function dlc(page: Page) {
    return page.evaluate((g) => {
        const d = (window as any).view.dlcsGuidMap.get(g);
        return { used: Boolean(d.used()), checked: Boolean(d.checked()) };
    }, PROPHECIES);
}

async function storedSession(page: Page): Promise<Record<string, any>> {
    await page.waitForTimeout(100);
    return page.evaluate(() => JSON.parse(localStorage.getItem('sessionSettings') || '{}'));
}

test.describe('DlcSettings volcano level', () => {
    test('fresh profile: level 0, the volcano member exists, DLC is not forced on', async ({ page }) => {
        await open(page);
        expect(await level(page)).toBe(0);
        expect(await unlocked(page)).toEqual([]);
        expect(await page.evaluate(() => (window as any).view.dlcSettings.volcano.dlc.guid)).toBe(PROPHECIES);
        expect((await dlc(page)).used).toBe(false);
    });

    test('level(3) from zero writes 3 to all three effects in both sessions, unlocks them and locks the DLC', async ({ page }) => {
        await open(page);
        await setLevel(page, 3);
        for (const s of [LATIUM, META]) expect(await scales(page, s)).toEqual({ [GATHERING]: 3, [MINING]: 3, [FERTILE]: 3 });
        expect(await unlocked(page)).toEqual(EFFECTS);
        expect(await level(page)).toBe(3);
        expect(await dlc(page)).toEqual({ used: true, checked: true });

        const stored = await storedSession(page);
        for (const s of [LATIUM, META]) for (const e of EFFECTS) expect(Number(stored[sessionKey(s, e)])).toBe(3);
        expect(stored['volcano.unlocked']).toEqual(EFFECTS);
    });

    test('an unlocked subset receives the level, the other effect stays 0; level 0 keeps the set', async ({ page }) => {
        await open(page, seed({ [GATHERING]: 5, [MINING]: 5, [FERTILE]: 0 }));
        expect(await level(page)).toBe(5);
        expect(await unlocked(page)).toEqual([GATHERING, MINING]);

        await setLevel(page, 2);
        expect(await scales(page, LATIUM)).toEqual({ [GATHERING]: 2, [MINING]: 2, [FERTILE]: 0 });
        expect(await scales(page, META)).toEqual({ [GATHERING]: 2, [MINING]: 2, [FERTILE]: 0 });

        await setLevel(page, 0);
        for (const s of [LATIUM, META]) expect(await scales(page, s)).toEqual({ [GATHERING]: 0, [MINING]: 0, [FERTILE]: 0 });
        expect(await level(page)).toBe(0);
        expect((await dlc(page)).used).toBe(false);
        expect(await unlocked(page)).toEqual([GATHERING, MINING]);

        await setLevel(page, 3);
        expect(await scales(page, LATIUM)).toEqual({ [GATHERING]: 3, [MINING]: 3, [FERTILE]: 0 });
    });

    test('mixed scales: level is null, differences lists every effect, level(4) unifies the unlocked ones', async ({ page }) => {
        await open(page, seed({ [GATHERING]: 3, [MINING]: 5, [FERTILE]: 0 }));
        expect(await level(page)).toBeNull();
        const diff = await page.evaluate(() => (window as any).view.dlcSettings.volcano.differences().map((d: any) => [d.effect.guid, d.value]));
        expect(diff).toEqual([[GATHERING, 3], [MINING, 5], [FERTILE, 0]]);

        await setLevel(page, 4);
        expect(await scales(page, LATIUM)).toEqual({ [GATHERING]: 4, [MINING]: 4, [FERTILE]: 0 });
        expect(await level(page)).toBe(4);
    });

    test('the stored unlocked set is read at startup and a manual scale unlocks a third effect', async ({ page }) => {
        await open(page, seed({ [GATHERING]: 0, [MINING]: 0, [FERTILE]: 0 }, [GATHERING, MINING]));
        expect(await unlocked(page)).toEqual([GATHERING, MINING]);
        await setLevel(page, 3);
        expect(await scales(page, META)).toEqual({ [GATHERING]: 3, [MINING]: 3, [FERTILE]: 0 });

        await page.evaluate((e) => {
            const s = (window as any).view.sessions.find((x: any) => x.guid === 3245);
            s.effects.find((x: any) => x.guid === e).scaling(1);
        }, FERTILE);
        expect(await unlocked(page)).toEqual(EFFECTS);
        expect((await storedSession(page))['volcano.unlocked']).toEqual(EFFECTS);
    });

    test('applyAll(5) writes 5 to all three effects of both volcano sessions and leaves other sessions alone', async ({ page }) => {
        await open(page, seed({ [GATHERING]: 1, [MINING]: 0, [FERTILE]: 0 }));
        await page.evaluate(() => { (window as any).view.dlcSettings.applyAll(5); });
        for (const s of [LATIUM, META]) expect(await scales(page, s)).toEqual({ [GATHERING]: 5, [MINING]: 5, [FERTILE]: 5 });
        const albion = await page.evaluate(({ session, effects }) => {
            const s = (window as any).view.sessions.find((x: any) => x.guid === session);
            return effects.map((e: number) => { const f = s.effects.find((x: any) => x.guid === e); return f ? f.scaling() : 0; });
        }, { session: ALBION, effects: EFFECTS });
        expect(albion).toEqual([0, 0, 0]);
    });

    test('Master view mode produces level 5 on all three effects', async ({ page }) => {
        // The view mode exists on the first run only: an empty localStorage, no seeded config.
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island() && (window as any).view.viewMode);
        await page.evaluate(() => { (window as any).view.viewMode.master(); });
        await page.waitForTimeout(100);
        for (const s of [LATIUM, META]) expect(await scales(page, s)).toEqual({ [GATHERING]: 5, [MINING]: 5, [FERTILE]: 5 });
        expect(await level(page)).toBe(5);
    });
});
