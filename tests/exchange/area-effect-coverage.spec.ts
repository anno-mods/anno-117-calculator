import { test, expect, Page } from '@playwright/test';
import { exportDoc, fileOf, importText, openApp, validateSchema } from '../helpers/exchange';

// residenceEffects (plan 2026-11-12-002 U8): import plan, store keys, export and round trip.
//   99014 / 99058  area effects (source "building") reaching the Roman levels 1496 to 1499 (99058 reaches more levels)
//   140536, 99077  effects that exist in no array of params.js (the planner file of the grounding names them)
const LATIUM = 3245;
const EFFECT = 99014;
const EFFECT_2 = 99058;
const UNKNOWN_EFFECT = 140536;
const LEVELS = [1496, 1497, 1498, 1499];

interface Entry { kind: string; code: string; message: string; detail?: Record<string, any> }
interface IslandPlan { store: Record<string, any>; ext: Record<string, any>; report: Entry[] }

async function planOne(page: Page, island: Record<string, any>): Promise<IslandPlan> {
    return page.evaluate((text: string) => {
        const ex = window.exchange;
        const r = ex.readExchange(text);
        if ('error' in r) throw new Error(r.error);
        return ex.planIslands(r).islands[0] as never;
    }, fileOf([{ id: 'x', name: 'Test', session: LATIUM, ...island }]));
}

const codes = (entries: Entry[]) => entries.map((e) => e.code);
const coverageKeys = (store: Record<string, any>) => Object.keys(store).filter((k) => /\.coverage$/.test(k)).sort();

test.describe('residenceEffects: import plan', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    test('AE8: listed shares are stored, unlisted levels of a listed effect get 0, the effect is switched on', async ({ page }) => {
        const i = await planOne(page, {
            residenceEffects: {
                '1496': { [EFFECT]: 62.5, [EFFECT_2]: 40 },
                '1497': { [EFFECT]: 5.0 },
                '1498': { [EFFECT]: 63.8 },
                '1499': { [EFFECT]: 90.6 },
            },
        });
        expect(i.store[`1496[${EFFECT}].coverage`]).toBe(62.5);
        expect(i.store[`1497[${EFFECT}].coverage`]).toBe(5);
        expect(i.store[`1498[${EFFECT}].coverage`]).toBe(63.8);
        expect(i.store[`1499[${EFFECT}].coverage`]).toBe(90.6);
        expect(i.store[`1496[${EFFECT_2}].coverage`]).toBe(40);
        // 99058 lists one level only: every other level it reaches gets 0 (the planner treats an unlisted level as not in range)
        const unlisted = Object.keys(i.store).filter((k) => k.endsWith(`[${EFFECT_2}].coverage`) && !k.startsWith('1496['));
        expect(unlisted.length).toBeGreaterThan(0);
        for (const k of unlisted) expect(i.store[k]).toBe(0);
        expect(i.store[`island.effect.${EFFECT}.scaling`]).toBe(1);
        expect(i.store[`island.effect.${EFFECT_2}.scaling`]).toBe(1);
        expect(i.ext.captured).toEqual([]);
    });

    test('an effect listed with every level at 0 stores the shares and leaves the effect value alone', async ({ page }) => {
        const i = await planOne(page, { residenceEffects: { '1496': { [EFFECT]: 0 }, '1497': { [EFFECT]: 0 } } });
        expect(i.store[`1496[${EFFECT}].coverage`]).toBe(0);
        expect(i.store[`island.effect.${EFFECT}.scaling`]).toBeUndefined();
    });

    test('DLC: an effect with exactly one DLC adds it to the dlc-enabled report', async ({ page }) => {
        const effect = await page.evaluate(() => {
            const w = window as any;
            const levelOf = new Map<number, number>(w.params.residenceBuildings.map((r: any) => [r.guid, r.populationLevel]));
            const e = w.params.effects.find((x: any) => x.source === 'building' && (x.dlcUnlocks || []).length === 1 && (x.targets || []).some((t: number) => levelOf.has(t)));
            return e ? { guid: e.guid, level: levelOf.get(e.targets.find((t: number) => levelOf.has(t))) } : null;
        });
        test.skip(!effect, 'no building effect with one DLC and residence targets in the data');
        const i = await planOne(page, { residenceEffects: { [String(effect!.level)]: { [effect!.guid]: 50 } } });
        const dlc = i.report.find((e) => e.code === 'dlc-enabled')!;
        expect(dlc.detail!.effects).toEqual([effect!.guid]);
    });

    test('out of range values are clamped and reported, non-numbers are kept', async ({ page }) => {
        const i = await planOne(page, { residenceEffects: { '1496': { [EFFECT]: 150 }, '1497': { [EFFECT]: 'half' } } });
        expect(i.store[`1496[${EFFECT}].coverage`]).toBe(100);
        expect(codes(i.report)).toContain('area-effect-clamped');
        // the level is unlisted for the effect, so it gets 0 (the planner treats an unlisted level as not in range)
        expect(i.store[`1497[${EFFECT}].coverage`]).toBe(0);
        expect(i.ext.captured.map((c: any) => c.pointer)).toEqual([`/residenceEffects/1497/${EFFECT}`]);
        expect(codes(i.report)).toContain('area-effect-not-applied');
    });

    test('AE9: leaves without an Effect or on no population level are kept at their pointer and reported', async ({ page }) => {
        const i = await planOne(page, {
            residenceEffects: { '1496': { [UNKNOWN_EFFECT]: 27.7, [EFFECT]: 50 }, '777': { [EFFECT]: 10 } },
        });
        expect(i.store[`1496[${EFFECT}].coverage`]).toBe(50);
        expect(coverageKeys(i.store)).not.toContain(`1496[${UNKNOWN_EFFECT}].coverage`);
        expect(coverageKeys(i.store).some((k) => k.startsWith('777['))).toBe(false);
        expect(i.ext.captured.map((c: any) => c.pointer).sort()).toEqual([`/residenceEffects/1496/${UNKNOWN_EFFECT}`, `/residenceEffects/777/${EFFECT}`].sort());
        expect(i.report.filter((e) => e.code === 'area-effect-not-applied').length).toBe(2);
    });

    test('the spec shape is kept, reported and not applied', async ({ page }) => {
        const i = await planOne(page, { residenceEffects: { default: 40 } });
        expect(coverageKeys(i.store)).toEqual([]);
        expect(i.ext.captured.map((c: any) => c.pointer)).toEqual(['/residenceEffects/default']);
        expect(i.report.find((e) => e.code === 'area-effect-not-applied')!.kind).toBe('not-mapped');
    });

    test('an explicit effects value wins over the switch-on and is reported', async ({ page }) => {
        const i = await planOne(page, { effects: { [EFFECT]: 0 }, residenceEffects: { '1496': { [EFFECT]: 50 } } });
        expect(i.store[`island.effect.${EFFECT}.scaling`]).toBe(0);
        expect(i.store[`1496[${EFFECT}].coverage`]).toBe(50);
        expect(codes(i.report)).toContain('area-effect-overridden');
    });
});

test.describe('residenceEffects: import, export and round trip', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    const island = async (page: Page) => {
        const { document } = await exportDoc(page);
        return { island: document.islands.find((i: any) => i.name === 'Test') as Record<string, any>, document };
    };

    test('AE8, AE9: the applied values and every unapplied leaf return unchanged; the document validates', async ({ page }) => {
        const residenceEffects = {
            '1496': { [EFFECT]: 62.5, [UNKNOWN_EFFECT]: 27.7, '99077': 3 },
            '1497': { [EFFECT]: 5 },
            '1498': { [EFFECT]: 63.8 },
            '1499': { [EFFECT]: 90.6 },
        };
        const text = fileOf([{ id: 'x', name: 'Test', session: LATIUM, residenceEffects }]);
        expect((await importText(page, text)).ok).toBe(true);
        const { island: out, document } = await island(page);
        expect(out.residenceEffects).toEqual(residenceEffects);
        expect(out.effects[EFFECT]).toBe(1);
        expect(validateSchema(document), JSON.stringify(validateSchema.errors)).toBe(true);
    });

    test('the model reads the imported shares, and an edited share is exported', async ({ page }) => {
        const text = fileOf([{ id: 'x', name: 'Test', session: LATIUM, residenceEffects: { '1496': { [EFFECT]: 62.5 } } }]);
        await importText(page, text);
        const read = await page.evaluate((e) => {
            const w = window as any;
            const island = w.view.island();
            const level = island.populationLevels.find((l: any) => l.guid === 1496);
            const before = island.areaEffectCoverage(1496, e)();
            island.areaEffectCoverage(1496, e)(10);
            return { before, effectOn: island.assetsMap.get(e).scaling(), level: !!level };
        }, EFFECT);
        expect(read).toEqual({ before: 62.5, effectOn: 1, level: true });
        const { island: out } = await island(page);
        expect(out.residenceEffects['1496'][EFFECT]).toBe(10);
    });

    test('without a stored coverage no residenceEffects field is written', async ({ page }) => {
        const { island: out } = await (async () => {
            await importText(page, fileOf([{ id: 'x', name: 'Test', session: LATIUM }]));
            return island(page);
        })();
        expect(out.residenceEffects).toBeUndefined();
    });

    test('a stored <residence>.effectCoverage key still exports under ext.calculator.store', async ({ page }) => {
        await importText(page, fileOf([{ id: 'x', name: 'Test', session: LATIUM }]));
        await page.evaluate(() => { (window as any).view.island().storage.setItem('3087.effectCoverage', {}); });
        const { island: out } = await island(page);
        expect(out.ext.calculator.store['3087.effectCoverage']).toEqual({});
    });
});
