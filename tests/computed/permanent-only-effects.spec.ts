import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * The Egyptian harvest season Shemu / Achet (155616) and the three volcano effects (Obsidian gathering 145095,
 * Obsidian mining 148043, fertile soil 145099) are not listed in the Effects dialog. They appear as rows of the
 * Permanent effects group of the factory dialog while on; the season is switched on with DLC 3.
 */
const AEGYPTUS_SESSION = 149679;
const LATIUM_SESSION = 3245;
const DLC3 = 67904;
const HARVEST_SEASON = 155616;
const VOLCANO = [145095, 148043, 145099];
const PERMANENT_ONLY = [HARVEST_SEASON, ...VOLCANO];

async function open(page: Page, name: string, session: number) {
    const configLoader = new ConfigLoader();
    await configLoader.loadConfigObject(page, configLoader.createIslandConfig(name, session, {}));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
}

test.describe('permanent-only effects', () => {
    test('are not in the filtered list of the Effects dialog', async ({ page }) => {
        await open(page, 'Latium', LATIUM_SESSION);
        const r = await page.evaluate((guids) => {
            const w = window as any;
            w.view.dlcs.forEach((d: any) => d.checked(true));
            const listed = w.view.filteredEffects().map((e: any) => e.guid);
            const available = w.view.island().availableEffects().map((e: any) => e.guid);
            return { listed: guids.filter((g: number) => listed.includes(g)), availableCount: guids.filter((g: number) => available.includes(g)).length };
        }, PERMANENT_ONLY);
        expect(r.listed).toEqual([]);
        expect(r.availableCount).toBeGreaterThan(0);
    });

    test('a volcano effect is a permanent row while its scale is above 0, without link target in the Effects dialog', async ({ page }) => {
        await open(page, 'Latium', LATIUM_SESSION);
        const r = await page.evaluate((guids) => {
            const w = window as any;
            w.view.dlcs.forEach((d: any) => d.checked(true));
            const island = w.view.island();
            const out: any[] = [];
            for (const guid of guids) {
                const effect = island.assetsMap.get(guid);
                const factory = effect?.targets.find((t: any) => t.boostSources && t.available());
                if (!factory) continue;
                effect.scaling(0);
                const off = factory.boostSources.permanentRows().some((x: any) => x.guid === guid);
                effect.scaling(2);
                const row = factory.boostSources.permanentRows().find((x: any) => x.guid === guid);
                out.push({ guid, off, on: !!row, permanentOnly: row?.permanentOnly, stack: row?.stack(), parity: factory.boostSources.breakdown().total - factory.boost() });
                effect.scaling(0);
            }
            return out;
        }, VOLCANO);
        expect(r.length).toBeGreaterThan(0);
        for (const e of r) {
            expect(e.off, `effect ${e.guid}`).toBe(false);
            expect(e.on).toBe(true);
            expect(e.permanentOnly).toBe(true);
            expect(e.stack).toBe(2);
            expect(e.parity).toBeCloseTo(0, 6);
        }
    });

    test('activating DLC 3 switches the harvest season on in every session; later changes stay', async ({ page }) => {
        await open(page, 'Aegyptus', AEGYPTUS_SESSION);
        const r = await page.evaluate(({ dlc, guid }) => {
            const w = window as any;
            const effects = w.view.sessions.map((s: any) => s.effects.find((e: any) => e.guid === guid)).filter(Boolean);
            const d = w.view.dlcsGuidMap.get(dlc);
            d.checked(false);
            effects.forEach((e: any) => e.scaling(0));
            const before = effects.map((e: any) => e.scaling());
            d.checked(true);
            const after = effects.map((e: any) => e.scaling());
            const island = w.view.island();
            const season = island.assetsMap.get(guid);
            const factory = season?.targets.find((t: any) => t.boostSources && t.available());
            const row = factory?.boostSources.permanentRows().find((x: any) => x.guid === guid);
            const rowOn = !!row;
            effects.forEach((e: any) => e.scaling(0));
            const manual = effects.map((e: any) => e.scaling());
            return { count: effects.length, before, after, manual, rowOn, permanentOnly: row?.permanentOnly };
        }, { dlc: DLC3, guid: HARVEST_SEASON });
        expect(r.count).toBeGreaterThan(0);
        expect(r.before.every((v: number) => v === 0)).toBe(true);
        expect(r.after.every((v: number) => v === 1)).toBe(true);
        expect(r.rowOn).toBe(true);
        expect(r.permanentOnly).toBe(true);
        expect(r.manual.every((v: number) => v === 0)).toBe(true);
    });
});
