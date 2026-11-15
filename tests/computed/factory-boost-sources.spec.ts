import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * Model behind the Boost sources container of the factory config view (src/factory-boost-sources.ts):
 * classification of buffs into equipped items, range effects, permanent effects and time-limited effects,
 * header count and net, and the productivity breakdown whose total must equal factory.boost().
 */
const LATIUM_SESSION = 3245;
const BAKERY = 3174;
const FURNACE = 3070;          // Favillus 50890 (boostable) and Chariot and Crew target it
const FAVILLUS = 50890;
const CHARIOT_AND_CREW = 174824;
const CHARIOT_DLC = 67903;
const SPINNER = 3187;          // item 160048 names the island-wide effect 166439 (workforce maintenance)
const HEROIC_ITEM = 160048;
const HEROIC_EFFECT = 166439;

async function openLatium(page: Page, routePatch?: string) {
    if (routePatch) {
        await page.route('**/js/params.js', async (route) => {
            const response = await route.fetch();
            await route.fulfill({ response, body: (await response.text()) + '\n' + routePatch });
        });
    }
    const configLoader = new ConfigLoader();
    await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Latium', LATIUM_SESSION, {}));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
}

/** Breakdown total minus factory.boost() for a factory. */
async function parityGap(page: Page, factoryGuid: number): Promise<number> {
    return page.evaluate((g) => {
        const f = (window as any).view.island().assetsMap.get(g);
        return f.boostSources.breakdown().total - f.boost();
    }, factoryGuid);
}

test.describe('Factory boost sources model', () => {
    test('a factory without active sources: total equals boost, no rows, count 0', async ({ page }) => {
        await openLatium(page);
        const r = await page.evaluate((g) => {
            const f = (window as any).view.island().assetsMap.get(g);
            const s = f.boostSources;
            return {
                total: s.breakdown().total, boost: f.boost(), range: s.rangeRows().length, permanent: s.permanentRows().length,
                count: s.count(), net: s.net(), sum: s.breakdown().sum, fertility: s.breakdown().fertilityFactor,
            };
        }, BAKERY);
        expect(r.total).toBeCloseTo(r.boost, 9);
        expect(r.boost).toBeCloseTo(1, 9);
        expect(r.range).toBe(0);
        expect(r.permanent).toBe(0);
        expect(r.count).toBe(0);
        expect(r.net).toBe(0);
        expect(r.sum).toBeCloseTo(100, 9);
        expect(r.fertility).toBe(1);
    });

    test('parity of breakdown total and boost with item Base, item Boosted, range effect, aqueduct and module', async ({ page }) => {
        await openLatium(page);
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), CHARIOT_DLC);

        const set = (fn: string) => page.evaluate(`(() => { const island = window.view.island(); const f = island.assetsMap.get(${FURNACE}); ${fn} })()`);

        await set(`island.assetsMap.get(${FAVILLUS}).slotStates.get(f)(1);`);
        expect(await parityGap(page, FURNACE)).toBeCloseTo(0, 9);

        await set(`island.assetsMap.get(${FAVILLUS}).slotStates.get(f)(2);`);
        expect(await parityGap(page, FURNACE)).toBeCloseTo(0, 9);

        await set(`island.assetsMap.get(${CHARIOT_AND_CREW}).slotStates.get(f)(1);`);
        expect(await parityGap(page, FURNACE)).toBeCloseTo(0, 9);

        await set(`if (f.aqueductBuff) f.aqueductBuff.scaling(1); f.modules.forEach(m => m.checked(true));`);
        expect(await parityGap(page, FURNACE)).toBeCloseTo(0, 9);

        const lines = await page.evaluate((g) => {
            const b = (window as any).view.island().assetsMap.get(g).boostSources.breakdown();
            return { items: b.items, range: b.rangeEffects, total: b.total };
        }, FURNACE);
        expect(lines.items).toBeGreaterThan(0);
        expect(lines.range).toBeCloseTo(20, 9);
        expect(lines.total).toBeGreaterThan(1.5);
    });

    test('parity with a fertility factor below 100 percent', async ({ page }) => {
        await openLatium(page);
        const r = await page.evaluate(() => {
            const island = (window as any).view.island();
            const f = island.assetsMap.get(2956);
            island.getIslandFertility(f.neededFertility.guid).checked(false);
            const b = f.boostSources.breakdown();
            return { factor: b.fertilityFactor, total: b.total, boost: f.boost() };
        });
        expect(r.factor).toBeLessThan(1);
        expect(r.total).toBeCloseTo(r.boost, 9);
    });

    test('classification: range effect and item are separate groups; permanent effect only while its scaling is above 0', async ({ page }) => {
        await openLatium(page);
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), CHARIOT_DLC);

        const r = await page.evaluate(({ furnace, chariot, favillus }) => {
            const island = (window as any).view.island();
            const f = island.assetsMap.get(furnace);
            const s = f.boostSources;
            const permanentBuff = f.buffs().find((b: any) => b.parent.source === 'tech' && !b.parent.slotStates && !b.parent.effectDuration && b.buff.productivityUpgrade !== 0);
            const effect = permanentBuff.parent;
            const out: any = {
                rangeGuids: s.rangeRows().map((x: any) => x.guid),
                itemGuids: s.itemRows().map((x: any) => x.parent.guid),
                before: s.permanentRows().length,
            };
            effect.scaling(1);
            out.afterOn = s.permanentRows().map((x: any) => x.guid);
            out.effectGuid = effect.guid;
            out.sourceLine = s.permanentRows()[0].sourceLine();
            out.sourceText = effect.getSourceText();
            out.owner = s.permanentRows()[0].owner;
            effect.scaling(0);
            out.afterOff = s.permanentRows().length;
            out.chariot = chariot; out.favillus = favillus;
            return out;
        }, { furnace: FURNACE, chariot: CHARIOT_AND_CREW, favillus: FAVILLUS });

        expect(r.rangeGuids).toContain(CHARIOT_AND_CREW);
        expect(r.itemGuids).not.toContain(CHARIOT_AND_CREW);
        expect(r.itemGuids).toContain(FAVILLUS);
        expect(r.rangeGuids).not.toContain(FAVILLUS);
        expect(r.before).toBe(0);
        expect(r.afterOn).toEqual([r.effectGuid]);
        expect(r.sourceLine).toBe(r.sourceText);
        expect(r.owner).toBe('effects');
        expect(r.afterOff).toBe(0);
    });

    test('a time-limited effect is in no group, adds to the time-limited line and keeps parity', async ({ page }) => {
        await openLatium(page);
        const r = await page.evaluate((g) => {
            const f = (window as any).view.island().assetsMap.get(g);
            const s = f.boostSources;
            const timed = f.buffs().find((b: any) => b.parent.effectDuration && !b.parent.slotStates && b.buff.productivityUpgrade !== 0);
            const before = s.breakdown().timeLimitedEffects;
            timed.parent.scaling(1);
            return {
                found: !!timed,
                before,
                after: s.breakdown().timeLimitedEffects,
                expected: timed.buff.productivityUpgrade,
                permanent: s.permanentRows().length,
                range: s.rangeRows().length,
                gap: s.breakdown().total - f.boost(),
            };
        }, FURNACE);
        expect(r.found).toBe(true);
        expect(r.before).toBe(0);
        expect(r.after).toBeCloseTo(r.expected, 9);
        expect(r.permanent).toBe(0);
        expect(r.gap).toBeCloseTo(0, 9);
    });

    test('heroic effect (R4a): row appears with the item named, stays when the item is unchecked, leaves when the effect is switched off', async ({ page }) => {
        await openLatium(page);
        const steps = await page.evaluate(({ factory, itemGuid, effectGuid }) => {
            const island = (window as any).view.island();
            const f = island.assetsMap.get(factory);
            const item = island.assetsMap.get(itemGuid);
            const effect = island.assetsMap.get(effectGuid);
            const s = f.boostSources;
            const snap = () => {
                const row = s.permanentRows().find((x: any) => x.guid === effectGuid);
                return {
                    row: !!row,
                    equippedBy: row && row.equippedBy() ? row.equippedBy().guid : null,
                    itemState: item.slotStates.get(f)(),
                    gap: s.breakdown().total - f.boost(),
                };
            };
            const out: any = {};
            out.initial = snap();
            item.slotStates.get(f)(1);
            out.activated = snap();
            item.slotStates.get(f)(0);
            out.unchecked = snap();
            item.slotStates.get(f)(1);
            effect.scaling(0);
            out.effectOff = snap();
            return out;
        }, { factory: SPINNER, itemGuid: HEROIC_ITEM, effectGuid: HEROIC_EFFECT });

        expect(steps.initial.row).toBe(false);
        expect(steps.activated.row).toBe(true);
        expect(steps.activated.equippedBy).toBe(HEROIC_ITEM);
        expect(steps.unchecked.row).toBe(true);
        expect(steps.unchecked.equippedBy).toBeNull();
        expect(steps.effectOff.row).toBe(false);
        expect(steps.effectOff.itemState).toBe(1);
        for (const k of ['initial', 'activated', 'unchecked', 'effectOff'])
            expect(steps[k].gap).toBeCloseTo(0, 9);
    });

    test('an effect with two buffs on one factory yields one row with the summed values', async ({ page }) => {
        // the effect gets its buff twice, which creates two applied buffs on the same factory
        await openLatium(page, `window.params.effects.find(e => e.guid === 157428).buffs.push(157429);`);
        const r = await page.evaluate((g) => {
            const island = (window as any).view.island();
            const f = island.assetsMap.get(g);
            const effect = island.assetsMap.get(157428);
            effect.scaling(1);
            const rows = f.boostSources.permanentRows().filter((x: any) => x.guid === 157428);
            const single = effect.buffs[0].productivityUpgrade;
            return { rows: rows.length, applied: rows[0].applied().length, value: rows[0].activeBuff().productivityUpgrade, single };
        }, FURNACE);
        expect(r.rows).toBe(1);
        expect(r.applied).toBe(2);
        expect(r.value).toBeCloseTo(2 * r.single, 9);
    });

    test('a stackable effect doubles its row values at scaling 2', async ({ page }) => {
        await openLatium(page);
        const r = await page.evaluate(() => {
            const island = (window as any).view.island();
            for (const f of island.factories ?? []) {
                const hit = f.buffs().find((b: any) => b.parent.isStackable && !b.parent.slotStates && !b.parent.effectDuration && b.buff.productivityUpgrade !== 0);
                if (!hit)
                    continue;
                hit.parent.scaling(1);
                const one = f.boostSources.permanentRows().find((x: any) => x.guid === hit.parent.guid).activeBuff().productivityUpgrade;
                hit.parent.scaling(2);
                const two = f.boostSources.permanentRows().find((x: any) => x.guid === hit.parent.guid).activeBuff().productivityUpgrade;
                return { found: true, one, two, stack: f.boostSources.permanentRows().find((x: any) => x.guid === hit.parent.guid).stack() };
            }
            return { found: false, one: 0, two: 0, stack: 0 };
        });
        test.skip(!r.found, 'no stackable productivity effect reaches a factory of the Latium island');
        expect(r.two).toBeCloseTo(2 * r.one, 9);
        expect(r.stack).toBe(2);
    });

    test('an effect whose buffs change nothing production-relevant yields no permanent row', async ({ page }) => {
        await openLatium(page);
        const r = await page.evaluate(() => {
            const island = (window as any).view.island();
            const relevant = (b: any) => b.productivityUpgrade !== 0 || b.baseProductivityUpgrade !== 0 || b.workforceModifierInPercent !== 0
                || b.additionalOutputs.length > 0 || (b.addedFertility && b.addedFertility.guid !== 0) || b.fuelDurationPercent !== 0
                || b.replaceInputs.length > 0 || b.workforceMaintenanceFactorUpgrade !== 0 || (b.replaceWorkforce && b.replaceWorkforce.oldWorkforce.guid !== 0);
            for (const f of island.factories ?? []) {
                const hit = f.buffs().find((b: any) => b.parent.guid && !b.parent.slotStates && !b.parent.effectDuration && b.parent.source !== undefined
                    && !f.buffs().some((o: any) => o.parent === b.parent && relevant(o.buff)));
                if (!hit)
                    continue;
                hit.parent.scaling(1);
                return { found: true, rows: f.boostSources.permanentRows().filter((x: any) => x.guid === hit.parent.guid).length };
            }
            return { found: false, rows: -1 };
        });
        test.skip(!r.found, 'no effect without production-relevant buffs reaches a factory');
        expect(r.rows).toBe(0);
    });

    test('a corrupt range effect state (2) contributes nothing and the toggle reads Off', async ({ page }) => {
        await openLatium(page);
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), CHARIOT_DLC);
        const r = await page.evaluate(({ furnace, chariot }) => {
            const island = (window as any).view.island();
            const f = island.assetsMap.get(furnace);
            island.assetsMap.get(chariot).slotStates.get(f)(2);
            const row = f.boostSources.rangeRows().find((x: any) => x.guid === chariot);
            return { toggle: row.toggle(), range: f.boostSources.breakdown().rangeEffects, count: f.boostSources.count(), gap: f.boostSources.breakdown().total - f.boost() };
        }, { furnace: FURNACE, chariot: CHARIOT_AND_CREW });
        expect(r.toggle).toBe(0);
        expect(r.range).toBe(0);
        expect(r.count).toBe(0);
        expect(r.gap).toBeCloseTo(0, 9);
    });

    test('header count and net add the active items, range effects and permanent effects', async ({ page }) => {
        await openLatium(page);
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), CHARIOT_DLC);
        const r = await page.evaluate(({ furnace, chariot, favillus }) => {
            const island = (window as any).view.island();
            const f = island.assetsMap.get(furnace);
            const s = f.boostSources;
            const permanentBuff = f.buffs().find((b: any) => b.parent.source === 'tech' && !b.parent.slotStates && !b.parent.effectDuration && b.buff.productivityUpgrade !== 0);
            const fav = island.assetsMap.get(favillus);
            const out: any = { none: { count: s.count(), net: s.net() } };
            fav.slotStates.get(f)(1);
            const favValue = fav.equipments.find((e: any) => e.target === f).activeBuff().productivityUpgrade;
            island.assetsMap.get(chariot).slotStates.get(f)(1);
            permanentBuff.parent.scaling(1);
            out.all = { count: s.count(), net: s.net() };
            out.expectedNet = favValue + 20 + permanentBuff.buff.productivityUpgrade;
            return out;
        }, { furnace: FURNACE, chariot: CHARIOT_AND_CREW, favillus: FAVILLUS });
        expect(r.none).toEqual({ count: 0, net: 0 });
        expect(r.all.count).toBe(3);
        expect(r.all.net).toBeCloseTo(r.expectedNet, 9);
    });

    test('a consumer without fertility yields a breakdown without fertility and no exception', async ({ page }) => {
        await openLatium(page);
        const r = await page.evaluate(() => {
            const island = (window as any).view.island();
            const module = island.assetsMap.get(2786).modules[0];
            if (!module)
                return null;
            const b = module.boostSources.breakdown();
            return { fertility: b.fertilityFactor, total: b.total, boost: module.boost() };
        });
        test.skip(r === null, 'the sheep farm carries no module');
        expect(r!.fertility).toBe(1);
        expect(r!.total).toBeCloseTo(r!.boost, 9);
    });
});
