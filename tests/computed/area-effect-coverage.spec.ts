import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

// Area-effect coverage (plan 2026-11-12-002 U8): the share of a level's residences in range of an area effect scales
// the buff values the effect puts on those residences; the effect's own 0/1 scaling stays untouched.
//   99014   Oysters with Caviar Building: source "building", one `population` buff (1 per residence), four Roman levels
//   166475  Slainga Gaileanga: a mythical-item effect (source is not "building")
const LATIUM = 3245;
const EFFECT = 99014;
const OTHER_SOURCE_EFFECT = 166475;

async function loadIsland(page: Page, data: Record<string, any> = {}) {
    const cl = new ConfigLoader();
    await cl.loadConfigObject(page, cl.createIslandConfig('Latium', LATIUM, data));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
}

/** Residences targeted by the effect, with their level and a fixed count; the effect switched on. */
const prepare = (page: Page, counts: number[]) => page.evaluate(({ effect, counts }) => {
    const island = (window as any).view.island();
    const e = island.assetsMap.get(effect);
    const residences = e.targets.filter((t: any) => t.populationLevel);
    residences.forEach((r: any, i: number) => r.buildings.constructed(counts[i % counts.length]));
    e.scaling(1);
    return residences.map((r: any) => ({ guid: r.guid, level: r.populationLevel.guid, count: r.buildings.constructed() }));
}, { effect: EFFECT, counts });

/** Residents the effect adds, per residence level. */
const contribution = (page: Page) => page.evaluate((effect) => {
    const island = (window as any).view.island();
    const e = island.assetsMap.get(effect);
    const out: Record<number, number> = {};
    for (const r of e.targets.filter((t: any) => t.populationLevel)) {
        const applied = r.buffs().filter((b: any) => b.parent === e);
        out[r.populationLevel.guid] = (out[r.populationLevel.guid] ?? 0) + applied.reduce((s: number, b: any) => s + b.populationBonus() * r.buildings.constructed(), 0);
    }
    return out;
}, EFFECT);

const setCoverage = (page: Page, level: number, value: number) =>
    page.evaluate(({ level, effect, value }) => { (window as any).view.island().areaEffectCoverage(level, effect)(value); }, { level, effect: EFFECT, value });

test.describe('area-effect coverage (U8)', () => {
    test('AE8: coverage 100 gives one resident per residence, listed shares scale each level', async ({ page }) => {
        await loadIsland(page);
        const residences = await prepare(page, [64, 40, 756, 32]);
        const levels = [...new Set(residences.map((r: any) => r.level))] as number[];
        expect(levels.length).toBeGreaterThan(1);
        const perLevel: Record<number, number> = {};
        for (const r of residences) perLevel[r.level] = (perLevel[r.level] ?? 0) + r.count;

        const full = await contribution(page);
        for (const l of levels) expect(full[l]).toBeCloseTo(perLevel[l], 6);

        const shares = [62.5, 5, 63.8, 90.6];
        levels.forEach((l, i) => setCoverage(page, l, shares[i % shares.length]));
        await page.waitForTimeout(50);
        const scaled = await contribution(page);
        levels.forEach((l, i) => expect(scaled[l], `level ${l}`).toBeCloseTo(perLevel[l] * shares[i % shares.length] / 100, 6));
    });

    test('coverage 0 removes one level and leaves the effect on; another level is not affected', async ({ page }) => {
        await loadIsland(page);
        const residences = await prepare(page, [10]);
        const levels = [...new Set(residences.map((r: any) => r.level))] as number[];
        const before = await contribution(page);
        await setCoverage(page, levels[0], 0);
        const after = await contribution(page);
        expect(after[levels[0]]).toBe(0);
        expect(after[levels[1]]).toBeCloseTo(before[levels[1]], 6);
        expect(await page.evaluate((e) => (window as any).view.island().assetsMap.get(e).scaling(), EFFECT)).toBe(1);
    });

    test('the effect scaling stays 0/1 and an effect of another source ignores a stored coverage', async ({ page }) => {
        await loadIsland(page);
        const residences = await prepare(page, [10]);
        await setCoverage(page, residences[0].level, 50);
        const r = await page.evaluate(({ effect, other, level }) => {
            const island = (window as any).view.island();
            const e = island.assetsMap.get(effect);
            island.areaEffectCoverage(level, other)(50);
            const o = island.assetsMap.get(other);
            const resBuffs = [...e.targets, ...(o.targets || [])].filter((t: any) => t.populationLevel).flatMap((t: any) => t.buffs());
            return {
                effectScaling: e.scaling(),
                shares: resBuffs.filter((b: any) => b.parent === e).map((b: any) => b.coverage()),
                otherShares: resBuffs.filter((b: any) => b.parent === o).map((b: any) => b.coverage()),
            };
        }, { effect: EFFECT, other: OTHER_SOURCE_EFFECT, level: residences[0].level });
        expect(r.effectScaling).toBe(1);
        expect(r.shares.some((s: number) => s === 0.5)).toBe(true);
        expect(r.otherShares.every((s: number) => s === 1)).toBe(true);
    });

    test('a coverage is stored per level and effect, restored on reload and clamped on read', async ({ page }) => {
        await loadIsland(page);
        const residences = await prepare(page, [10]);
        const level = residences[0].level;
        await setCoverage(page, level, 37.5);
        await page.evaluate(() => new Promise<void>((r) => setTimeout(() => setTimeout(r, 30), 30)));
        const key = `${level}[${EFFECT}].coverage`;
        expect(await page.evaluate((k) => (window as any).view.island().storage.getItem(k), key)).toBe(37.5);

        await loadIsland(page, { [key]: 12.5 });
        expect(await page.evaluate(({ l, e }) => (window as any).view.island().areaEffectCoverage(l, e)(), { l: level, e: EFFECT })).toBe(12.5);
        await loadIsland(page, { [key]: 150 });
        expect(await page.evaluate(({ l, e }) => (window as any).view.island().areaEffectCoverage(l, e)(), { l: level, e: EFFECT })).toBe(100);
        // an unchanged default writes nothing
        await loadIsland(page);
        await page.evaluate(({ l, e }) => { (window as any).view.island().areaEffectCoverage(l, e)(); }, { l: level, e: EFFECT });
        expect(await page.evaluate((k) => (window as any).view.island().storage.getItem(k), key)).toBeUndefined();
    });
});
