import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * The Egyptian seasons (155616) and the three DLC 3 soil effects (183157, 183161, 185454) are not listed in the
 * Effects dialog; the Permanent effects group of the factory dialog carries their on/off switch.
 */
const AEGYPTUS_SESSION = 149679;
const DLC3 = 67904;
const PERMANENT_ONLY = [155616, 183157, 183161, 185454];

async function openAegyptus(page: Page) {
    const configLoader = new ConfigLoader();
    await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Aegyptus', AEGYPTUS_SESSION, {}));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.evaluate((dlc) => { (window as any).view.dlcsGuidMap.get(dlc).checked(true); }, DLC3);
}

test.describe('permanent-only effects', () => {
    test('activating DLC 3 switches the harvest season on in every session; later changes stay', async ({ page }) => {
        const configLoader = new ConfigLoader();
        await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Aegyptus', AEGYPTUS_SESSION, {}));
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        const r = await page.evaluate(({ dlc, guid }) => {
            const w = window as any;
            const effects = w.view.sessions.map((s: any) => s.effects.find((e: any) => e.guid === guid)).filter(Boolean);
            const d = w.view.dlcsGuidMap.get(dlc);
            d.checked(false);
            effects.forEach((e: any) => e.scaling(0));
            const before = effects.map((e: any) => e.scaling());
            d.checked(true);
            const after = effects.map((e: any) => e.scaling());
            effects.forEach((e: any) => e.scaling(0));
            const manual = effects.map((e: any) => e.scaling());
            return { count: effects.length, before, after, manual };
        }, { dlc: DLC3, guid: 155616 });
        expect(r.count).toBeGreaterThan(0);
        expect(r.before.every((v: number) => v === 0)).toBe(true);
        expect(r.after.every((v: number) => v === 1)).toBe(true);
        expect(r.manual.every((v: number) => v === 0)).toBe(true);
    });

    test('are not in the filtered list of the Effects dialog', async ({ page }) => {
        await openAegyptus(page);
        const r = await page.evaluate((guids) => {
            const w = window as any;
            const listed = w.view.filteredEffects().map((e: any) => e.guid);
            const available = w.view.island().availableEffects().map((e: any) => e.guid);
            return { listed: guids.filter((g: number) => listed.includes(g)), availableCount: guids.filter((g: number) => available.includes(g)).length };
        }, PERMANENT_ONLY);
        expect(r.listed).toEqual([]);
        expect(r.availableCount).toBeGreaterThan(0);
    });

    test('a switched-off effect is a permanent row with its switch; switching it on lifts the productivity', async ({ page }) => {
        await openAegyptus(page);
        const r = await page.evaluate((guids) => {
            const w = window as any;
            const island = w.view.island();
            const out: any[] = [];
            for (const guid of guids) {
                const effect = island.assetsMap.get(guid);
                if (!effect || !effect.available()) continue;
                const factory = effect.targets.find((t: any) => t.boostSources && t.available());
                if (!factory) continue;
                effect.scaling(0);
                const row = factory.boostSources.permanentRows().find((x: any) => x.guid === guid);
                const rowOff = !!row;
                const offBoost = factory.boost();
                const offCount = factory.boostSources.count();
                row.enabled(true);
                out.push({
                    guid, rowOff, switchOn: effect.scaling(), permanentOnly: row.permanentOnly,
                    gain: factory.boost() - offBoost, countDelta: factory.boostSources.count() - offCount,
                    parity: factory.boostSources.breakdown().total - factory.boost(),
                });
                row.enabled(false);
                out[out.length - 1].scalingAfterOff = effect.scaling();
            }
            return out;
        }, PERMANENT_ONLY);
        expect(r.length).toBeGreaterThan(0);
        for (const e of r) {
            expect(e.rowOff, `effect ${e.guid}`).toBe(true);
            expect(e.permanentOnly).toBe(true);
            expect(e.switchOn).toBe(1);
            expect(e.countDelta).toBe(1);
            expect(e.gain).toBeGreaterThanOrEqual(0);
            expect(e.parity).toBeCloseTo(0, 6);
            expect(e.scalingAfterOff).toBe(0);
        }
    });
});
