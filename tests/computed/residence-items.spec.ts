import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

// Residence items (villa items): U1 binding gap, U3 model, coverage seam, island state.
// Fixtures are derived from window.params; the GUIDs below are the ones the scenarios name:
//   160084  Specialist Mythic 12: goodConsumptionUpgrade Bread (2137) -20 % base / -30 % boosted, residence targets only
//   149292  Specialist HallOfFame Nanny: consumptionModifierInPercent -5 / -10, population 2 / 3
//   51829   Specialist NeedReward C Eels: no boost variant, +1 Population while the Eels need is supplied
//   51835   Specialist NeedReward R Bread: no boost variant, +2 Population while the Bread need is supplied
//   159054  Specialist Racing L 07: boostable, DLC 67903, residence targets only
//   41352   Specialist Rival 02: workforce buffs only (not a villa item)
const ROMAN_SESSION = 3245;
const FAVILLUS = 50890; // boostable Roman factory item, counter-check that assetsMap carries items
const BREAD_ITEM = 160084;
const NANNY = 149292;
const EELS_NEED_ITEM = 51829;
const BREAD_NEED_ITEM = 51835;
const RACING_L07 = 159054;
const RACING_DLC = 67903;
const WORKFORCE_ONLY = 41352;
const PLEBEIANS_RESIDENCE = 3141; // Bread need 2689 is ungated here (the Peasants entry is gated by an effect)
const BREAD_NEED = 2689;

async function loadIsland(page: any, name: string, session: number, data: Record<string, any> = {}) {
    const cl = new ConfigLoader();
    await cl.loadConfigObject(page, cl.createIslandConfig(name, session, data));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
}

// Bread demand of the Plebeians residence with 10 buildings, need switched on.
const breadAmount = (page: any) => page.evaluate(({ r, n }: { r: number; n: number }) => {
    const island = (window as any).view.island();
    const res = island.assetsMap.get(r);
    res.buildings.constructed(10);
    const need = res.needsMap.get(n);
    need.checked(true);
    return need.amount();
}, { r: PLEBEIANS_RESIDENCE, n: BREAD_NEED });

const setState = (page: any, item: number, state: number) => page.evaluate(({ item, state }: { item: number; state: number }) => {
    const it = (window as any).view.island().assetsMap.get(item);
    it.slotStates.values().next().value(state);
}, { item, state });

const setCoverage = (page: any, value: number) => page.evaluate((v: number) => {
    (window as any).view.island().villaCoverage(v);
}, value);

test.describe('U1 - residence-targeting items before the residence item pass', () => {
    test.beforeEach(async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
    });

    test('items with residence targets are derived from params, not hardcoded', async ({ page }) => {
        const set = await page.evaluate(() => {
            const w = window as any;
            const res = new Set(w.params.residenceBuildings.map((r: any) => r.guid));
            return w.params.items.filter((i: any) => i.targets.some((t: number) => res.has(t))).map((i: any) => i.guid);
        });
        expect(set).toContain(BREAD_ITEM);
        expect(set).toContain(WORKFORCE_ONLY);
    });

    test('the first item pass never binds an item that targets residences only', async ({ page }) => {
        // island.items is the list of the first pass: no residence-only item is in it
        const result = await page.evaluate(() => {
            const w = window as any;
            const island = w.view.island();
            const res = new Set(w.params.residenceBuildings.map((r: any) => r.guid));
            const only = w.params.items.filter((i: any) => i.targets.length && i.targets.every((t: number) => res.has(t)));
            return only.map((i: any) => ({ guid: i.guid, inItems: island.items.some((x: any) => x.guid === i.guid) }));
        });
        expect(result.length).toBeGreaterThan(0);
        for (const r of result) expect(r.inItems, `item ${r.guid} in island.items`).toBe(false);
    });

    test('counter-check: a factory item is in assetsMap', async ({ page }) => {
        const bound = await page.evaluate((g) => (window as any).view.island().assetsMap.get(g) !== undefined, FAVILLUS);
        expect(bound).toBe(true);
    });
});

test.describe('U3 - residence items', () => {
    test.beforeEach(async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
    });

    test('equipping 160084 reduces Bread demand by 20 % at Base, 30 % Boosted, Off restores it', async ({ page }) => {
        const base = await breadAmount(page);
        expect(base).toBeGreaterThan(0);
        await setState(page, BREAD_ITEM, 1);
        expect((await breadAmount(page)) / base).toBeCloseTo(0.8, 6);
        await setState(page, BREAD_ITEM, 2);
        expect((await breadAmount(page)) / base).toBeCloseTo(0.7, 6);
        await setState(page, BREAD_ITEM, 0);
        expect((await breadAmount(page)) / base).toBeCloseTo(1, 6);
    });

    test('villaCoverage scales the reduction: 50 gives 10 %, 100 gives 20 %, 0 gives none', async ({ page }) => {
        const base = await breadAmount(page);
        await setState(page, BREAD_ITEM, 1);
        await setCoverage(page, 50);
        expect((await breadAmount(page)) / base).toBeCloseTo(0.9, 6);
        await setCoverage(page, 100);
        expect((await breadAmount(page)) / base).toBeCloseTo(0.8, 6);
        await setCoverage(page, 0);
        expect((await breadAmount(page)) / base).toBeCloseTo(1, 6);
    });

    test('coverage scales consumptionModifierInPercent and population, and leaves effect scaling alone', async ({ page }) => {
        const r = await page.evaluate(({ item, res, need }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const residence = island.assetsMap.get(res);
            residence.buildings.constructed(10);
            residence.needsMap.get(need).checked(true);
            const state = it.slotStates.values().next().value;
            const out: any = {};
            state(1);
            for (const cov of [100, 50]) {
                island.villaCoverage(cov);
                out['pop' + cov] = residence.residents();
                out['cm' + cov] = it.equipments.find((e: any) => e.target === residence).consumptionModifierInPercent();
                out['scaling' + cov] = it.equipments.find((e: any) => e.target === residence).scaling();
            }
            return out;
        }, { item: NANNY, res: PLEBEIANS_RESIDENCE, need: BREAD_NEED });
        expect(r.cm100).toBeCloseTo(-5, 6);
        expect(r.cm50).toBeCloseTo(-2.5, 6);
        expect(r.scaling50).toBe(1);
        // population 2 per residence of the item buff, 10 residences
        expect(r.pop100 - r.pop50).toBeCloseTo(2 * 10 * 0.5, 6);
    });

    test('an item without a boost variant: stray state 2 applies Base numbers only', async ({ page }) => {
        const r = await page.evaluate(({ item }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const eq = it.equipments[0];
            const state = it.slotStates.values().next().value;
            state(1); const s1 = eq.scaling();
            state(2); const s2 = eq.scaling();
            state(0); const s0 = eq.scaling();
            return { boost: it.boostEquipments.length, s0, s1, s2 };
        }, { item: EELS_NEED_ITEM });
        expect(r).toEqual({ boost: 0, s0: 0, s1: 1, s2: 1 });
    });

    test('a supplied need adds residents while it is on (needAttributes Population)', async ({ page }) => {
        const r = await page.evaluate(({ item, res, need }) => {
            const island = (window as any).view.island();
            const residence = island.assetsMap.get(res);
            residence.buildings.constructed(10);
            const n = residence.needsMap.get(need);
            n.checked(true);
            const before = n.residents();
            island.assetsMap.get(item).slotStates.values().next().value(1);
            const on = n.residents();
            n.checked(false);
            const off = n.residents();
            return { before, on, off };
        }, { item: BREAD_NEED_ITEM, res: PLEBEIANS_RESIDENCE, need: BREAD_NEED });
        expect(r.on - r.before).toBeCloseTo(2 * 10, 6);
        expect(r.off).toBe(0);
    });

    test('DLC invariant: an item with one dlcUnlocks entry makes its DLC used and checked', async ({ page }) => {
        const before = await page.evaluate((d) => {
            const dlc = (window as any).view.dlcsGuidMap.get(d);
            dlc.checked(false);
            return { used: dlc.used(), checked: dlc.checked() };
        }, RACING_DLC);
        expect(before.used).toBe(false);
        await setState(page, RACING_L07, 1);
        const after = await page.evaluate((d) => {
            const dlc = (window as any).view.dlcsGuidMap.get(d);
            return { used: Boolean(dlc.used()), checked: Boolean(dlc.checked()) };
        }, RACING_DLC);
        expect(after).toEqual({ used: true, checked: true });
        await setState(page, RACING_L07, 0);
        expect(await page.evaluate((d) => Boolean((window as any).view.dlcsGuidMap.get(d).used()), RACING_DLC)).toBe(false);
    });

    test('eligibility: residenceItems equal the items that pass the villa predicate, 41352 is not one', async ({ page }) => {
        const r = await page.evaluate(() => {
            const w = window as any;
            const p = w.params;
            const res = new Set(p.residenceBuildings.map((x: any) => x.guid));
            const buffs = new Map(p.buildingBuffs.map((b: any) => [b.guid, b]));
            const effects = new Map(p.effects.map((e: any) => [e.guid, e]));
            const demand = (b: any) => !!b && (b.consumptionModifierInPercent || b.population
                || (b.goodConsumptionUpgrade || []).some((g: any) => g.product && g.amountInPercent)
                || (b.attributes && b.attributes.Population)
                || (b.needAttributes || []).some((n: any) => n.attributes && n.attributes.Population));
            const expected = p.items.filter((i: any) => (!i.allocation || i.allocation === 'Villa')
                && i.targets.some((t: number) => res.has(t))
                && [...(i.buffs || []), ...(i.boostBuffs || [])].some((g: number) => {
                    const b: any = buffs.get(g);
                    if (demand(b)) return true;
                    const fe: any = b && b.functionalEffect ? effects.get(b.functionalEffect) : null;
                    return !!fe && fe.buffs.some((x: number) => demand(buffs.get(x)));
                })).map((i: any) => i.guid).sort((a: number, b: number) => a - b);
            const actual = w.view.island().residenceItems.map((i: any) => i.guid).sort((a: number, b: number) => a - b);
            return { expected, actual };
        });
        expect(r.expected.length).toBeGreaterThan(0);
        expect(r.actual).toEqual(r.expected);
        expect(r.actual).not.toContain(WORKFORCE_ONLY);
        expect(r.actual).toContain(BREAD_ITEM);
    });

    test('factory dialogs are unchanged: no villa item in island.items or in a factory item list', async ({ page }) => {
        const r = await page.evaluate(() => {
            const island = (window as any).view.island();
            const villa = new Set(island.residenceItems.map((i: any) => i.guid));
            const inItems = island.items.filter((i: any) => villa.has(i.guid)).length;
            let inFactories = 0;
            for (const f of island.factories)
                for (const e of f.availableItems()) if (villa.has(e.parent.guid)) inFactories++;
            return { count: villa.size, inItems, inFactories };
        });
        expect(r.count).toBeGreaterThan(0);
        expect(r.inItems).toBe(0);
        expect(r.inFactories).toBe(0);
    });

    test('integration: a residence lists one buff entry per (item, buff) and inactive ones have scaling 0', async ({ page }) => {
        const r = await page.evaluate(({ item, res }) => {
            const island = (window as any).view.island();
            const residence = island.assetsMap.get(res);
            const mine = () => residence.buffs().filter((b: any) => b.parent.guid === item);
            const off = mine().map((b: any) => ({ buff: b.buff.guid, scaling: b.scaling() }));
            island.assetsMap.get(item).slotStates.values().next().value(2);
            const boosted = mine().map((b: any) => ({ buff: b.buff.guid, scaling: b.scaling() }));
            return { off, boosted };
        }, { item: BREAD_ITEM, res: PLEBEIANS_RESIDENCE });
        expect(r.off).toEqual([{ buff: 160085, scaling: 0 }, { buff: 160086, scaling: 0 }]);
        expect(r.boosted).toEqual([{ buff: 160085, scaling: 0 }, { buff: 160086, scaling: 1 }]);
    });

    test('persistence: state and villaCoverage are stored as numbers', async ({ page }) => {
        await setState(page, BREAD_ITEM, 2);
        await setCoverage(page, 35);
        await page.evaluate(() => new Promise<void>((r) => setTimeout(() => setTimeout(r, 30), 30)));
        const stored = await page.evaluate((item) => {
            const s = (window as any).view.island().storage;
            return { state: s.getItem(`residenceItem.${item}.state`), cov: s.getItem('villaCoverage') };
        }, BREAD_ITEM);
        expect(stored).toEqual({ state: 2, cov: 35 });
    });
});

test.describe('U3 - residence item persistence on load', () => {
    test('stored state and villaCoverage are restored with the buff active', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION, { [`residenceItem.${BREAD_ITEM}.state`]: 1, villaCoverage: 50 });
        expect(await page.evaluate(() => (window as any).view.island().villaCoverage())).toBe(50);
        const state = await page.evaluate((i) => (window as any).view.island().assetsMap.get(i).slotStates.values().next().value(), BREAD_ITEM);
        expect(state).toBe(1);
        // Base at coverage 50 reduces Bread by 10 %
        const ratio = await page.evaluate(({ r, n, item }) => {
            const island = (window as any).view.island();
            const res = island.assetsMap.get(r);
            res.buildings.constructed(10);
            res.needsMap.get(n).checked(true);
            const withItem = res.needsMap.get(n).amount();
            island.assetsMap.get(item).slotStates.values().next().value(0);
            return withItem / res.needsMap.get(n).amount();
        }, { r: PLEBEIANS_RESIDENCE, n: BREAD_NEED, item: BREAD_ITEM });
        expect(ratio).toBeCloseTo(0.9, 6);
    });

    test('villaCoverage outside 0..100 is clamped on read', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION, { villaCoverage: 150 });
        expect(await page.evaluate(() => (window as any).view.island().villaCoverage())).toBe(100);
        await loadIsland(page, 'Latium', ROMAN_SESSION, { villaCoverage: -5 });
        expect(await page.evaluate(() => (window as any).view.island().villaCoverage())).toBe(0);
    });
});
