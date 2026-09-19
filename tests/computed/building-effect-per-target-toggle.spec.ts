import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

// Per-building toggle for production-relevant 'building'-sourced effects.
// Fixture (verified against the current params.js):
//   Chariot and Crew 174824 (buff 174825, +20% productivityUpgrade, source 'building', DLC 67903,
//   targetsIsAllProduction: true) - the only 'source: building' effect whose buff moves a
//   factory-relevant field today. Targets include Bakery 3174 and Roman Iron 3070.
//   Roman Market Service 99314 (buff 68482, providedNeedUpgrade only, no DLC) - a non-qualifying
//   'building'-sourced effect targeting residences only (Liberti/Equites-tier), used as the
//   regression fixture for the 48 residence/attribute-only effects this plan leaves untouched.
//   Repeat Mining Productivity 82017 (buff 82018, +5% productivityUpgrade, source 'tech', no DLC) -
//   proves qualification requires source === 'building', not just a matching buff field.
//   Favillus 50890 (Item, base buff 50891 +35% prod) on Roman Iron 3070 - existing Item row used to
//   check the new Effect row doesn't disturb Item row rendering/counting (Group C regression).
const ROMAN_SESSION = 3245;

const CHARIOT_AND_CREW = 174824;
const CHARIOT_DLC = 67903;
const BAKERY = 3174;
const ROMAN_IRON = 3070;

const NON_QUALIFYING_BUILDING_EFFECT = 99314; // Roman Market Service (residence-targeted, no DLC)
const LIBERTI_RESIDENCE = 3087;

const NON_BUILDING_SOURCE_WITH_PRODUCTIVITY_BUFF = 82017; // tech, +5% productivityUpgrade

const FAVILLUS = 50890;

async function loadIsland(page: any, name: string, session: number, data: Record<string, any> = {}) {
    const cl = new ConfigLoader();
    const config = cl.createIslandConfig(name, session, data);
    await cl.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
}

// ---------------------------------------------------------------------------
// Group A - Qualification (R1, R2)
// ---------------------------------------------------------------------------
test.describe('Group A - qualification predicate', () => {
    test.beforeEach(async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
    });

    test('A1 - a qualifying effect populates slotStates with one entry per target, defaulting to 0', async ({ page }) => {
        const res = await page.evaluate(({ effectGuid, factory }) => {
            const island = (window as any).view.island();
            const effect = island.assetsMap.get(effectGuid);
            const f = island.assetsMap.get(factory);
            return {
                hasSlotStates: effect.slotStates != null,
                slotCount: effect.slotStates ? effect.slotStates.size : -1,
                bakeryState: effect.slotStates ? effect.slotStates.get(f)() : null,
                targetCount: effect.targets.length,
            };
        }, { effectGuid: CHARIOT_AND_CREW, factory: BAKERY });

        expect(res.hasSlotStates).toBe(true);
        expect(res.slotCount).toBe(res.targetCount);
        expect(res.bakeryState).toBe(0);
    });

    test('A2 - source gate: a non-building-sourced effect with a productivityUpgrade buff does not qualify', async ({ page }) => {
        const res = await page.evaluate((effectGuid) => {
            const island = (window as any).view.island();
            const effect = island.assetsMap.get(effectGuid);
            return { source: effect.source, hasSlotStates: effect.slotStates != null };
        }, NON_BUILDING_SOURCE_WITH_PRODUCTIVITY_BUFF);

        expect(res.source).toBe('tech');
        expect(res.hasSlotStates).toBe(false);
    });

    test('A3 - a non-qualifying building-sourced effect keeps the shared scaling (regression guard)', async ({ page }) => {
        const res = await page.evaluate(({ effectGuid, residence }) => {
            const island = (window as any).view.island();
            const effect = island.assetsMap.get(effectGuid);
            const r = island.assetsMap.get(residence);
            const applied = r.buffs().find((b: any) => b.parent.guid === effectGuid);
            effect.scaling(1);
            const scalingOn = applied ? applied.scaling() : null;
            effect.scaling(0);
            const scalingOff = applied ? applied.scaling() : null;
            return { hasSlotStates: effect.slotStates != null, scalingOn, scalingOff };
        }, { effectGuid: NON_QUALIFYING_BUILDING_EFFECT, residence: LIBERTI_RESIDENCE });

        expect(res.hasSlotStates).toBe(false);
        expect(res.scalingOn).toBe(1);
        expect(res.scalingOff).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Group B - Per-target independence (R3)
// ---------------------------------------------------------------------------
test.describe('Group B - per-target independence', () => {
    test.beforeEach(async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
    });

    test('B1 - toggling one target applies +20% productivity only to that target', async ({ page }) => {
        const res = await page.evaluate(({ effectGuid, factoryA, factoryB }) => {
            const island = (window as any).view.island();
            const effect = island.assetsMap.get(effectGuid);
            const fa = island.assetsMap.get(factoryA);
            const fb = island.assetsMap.get(factoryB);
            const before = { a: fa.boost(), b: fb.boost() };
            effect.slotStates.get(fa)(1);
            const after = { a: fa.boost(), b: fb.boost() };
            effect.slotStates.get(fa)(0);
            const reverted = { a: fa.boost(), b: fb.boost() };
            return { before, after, reverted };
        }, { effectGuid: CHARIOT_AND_CREW, factoryA: BAKERY, factoryB: ROMAN_IRON });

        expect(res.after.a).toBeGreaterThan(res.before.a);
        expect(res.after.b).toBeCloseTo(res.before.b, 6);
        expect(res.reverted.a).toBeCloseTo(res.before.a, 6);
    });

    test('B2 - each target has its own independent AppliedBuff scaling', async ({ page }) => {
        const res = await page.evaluate(({ effectGuid, factoryA, factoryB }) => {
            const island = (window as any).view.island();
            const effect = island.assetsMap.get(effectGuid);
            const fa = island.assetsMap.get(factoryA);
            const fb = island.assetsMap.get(factoryB);
            effect.slotStates.get(fa)(1);
            const appliedA = fa.buffs().find((b: any) => b.parent.guid === effectGuid);
            const appliedB = fb.buffs().find((b: any) => b.parent.guid === effectGuid);
            return { scalingA: appliedA.scaling(), scalingB: appliedB.scaling() };
        }, { effectGuid: CHARIOT_AND_CREW, factoryA: BAKERY, factoryB: ROMAN_IRON });

        expect(res.scalingA).toBe(1);
        expect(res.scalingB).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Group C - Items Equipped list membership (R4)
// ---------------------------------------------------------------------------
test.describe('Group C - Items Equipped membership', () => {
    test('C1 - the row is absent before DLC unlock, present after', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);

        const hasRow = () => page.evaluate(({ effectGuid, factory }) => {
            const island = (window as any).view.island();
            const f = island.assetsMap.get(factory);
            return f.availableItems().some((i: any) => i.parent.guid === effectGuid);
        }, { effectGuid: CHARIOT_AND_CREW, factory: BAKERY });

        expect(await hasRow()).toBe(false);

        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), CHARIOT_DLC);
        expect(await hasRow()).toBe(true);
    });

    test('C2 - regression: an existing Item row keeps its normal count alongside the new Effect row', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), CHARIOT_DLC);

        const res = await page.evaluate(({ item, effectGuid, factory }) => {
            const island = (window as any).view.island();
            const f = island.assetsMap.get(factory);
            const rows = f.availableItems();
            return {
                itemRows: rows.filter((i: any) => i.parent.guid === item).length,
                effectRows: rows.filter((i: any) => i.parent.guid === effectGuid).length,
            };
        }, { item: FAVILLUS, effectGuid: CHARIOT_AND_CREW, factory: ROMAN_IRON });

        expect(res.itemRows).toBe(1);   // Favillus keeps exactly one row, as before this plan
        expect(res.effectRows).toBe(1); // plus the new Chariot and Crew row
    });

    test('C3 - regression: a non-qualifying building-sourced effect never appears in an items list', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
        const anyRow = await page.evaluate((effectGuid) => {
            const island = (window as any).view.island();
            for (const f of island.factories) {
                if (f.availableItems().some((i: any) => i.parent.guid === effectGuid)) return true;
            }
            return false;
        }, NON_QUALIFYING_BUILDING_EFFECT);
        expect(anyRow).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Group D - Global Effects dialog exclusion (R5)
// ---------------------------------------------------------------------------
test.describe('Group D - global Effects dialog exclusion', () => {
    test('D1 - the qualifying effect never appears in availableEffects(), DLC state notwithstanding', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);

        const includesBefore = await page.evaluate((effectGuid) =>
            (window as any).view.island().availableEffects().some((e: any) => e.guid === effectGuid), CHARIOT_AND_CREW);
        expect(includesBefore).toBe(false);

        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), CHARIOT_DLC);

        const includesAfter = await page.evaluate((effectGuid) =>
            (window as any).view.island().availableEffects().some((e: any) => e.guid === effectGuid), CHARIOT_AND_CREW);
        expect(includesAfter).toBe(false);
    });

    test('D2 - regression: a non-building-sourced effect is unaffected by the exclusion', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
        const res = await page.evaluate((effectGuid) => {
            const island = (window as any).view.island();
            return {
                inAvailable: island.availableEffects().some((e: any) => e.guid === effectGuid),
                allBuildingSourced: island.availableEffects().every((e: any) => e.source !== 'building'),
            };
        }, NON_BUILDING_SOURCE_WITH_PRODUCTIVITY_BUFF);

        expect(res.inAvailable).toBe(true);
        expect(res.allBuildingSourced).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Group E - Persistence (R6, R7)
// ---------------------------------------------------------------------------
test.describe('Group E - persistence', () => {
    test('E1 - toggling a slot to 1 persists the integer 1 under the per-target key; reload restores it', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
        const stored = await page.evaluate(({ effectGuid, factory }) => {
            const island = (window as any).view.island();
            const effect = island.assetsMap.get(effectGuid);
            const f = island.assetsMap.get(factory);
            effect.slotStates.get(f)(1);
            return island.storage.getItem(`${factory}[${effectGuid}].scaling`);
        }, { effectGuid: CHARIOT_AND_CREW, factory: BAKERY });

        expect(stored).toBe(1);
        expect(typeof stored).toBe('number');

        await loadIsland(page, 'Latium', ROMAN_SESSION, { [`${BAKERY}[${CHARIOT_AND_CREW}].scaling`]: 1 });
        const restored = await page.evaluate(({ effectGuid, factory }) => {
            const island = (window as any).view.island();
            const f = island.assetsMap.get(factory);
            return island.assetsMap.get(effectGuid).slotStates.get(f)();
        }, { effectGuid: CHARIOT_AND_CREW, factory: BAKERY });
        expect(restored).toBe(1);
    });

    test('E2 - a legacy shared-scaling save from the prior global-toggle behavior is ignored, not migrated', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION, { [`island.effect.${CHARIOT_AND_CREW}.scaling`]: '1' });

        const res = await page.evaluate(({ effectGuid, factory }) => {
            const island = (window as any).view.island();
            const effect = island.assetsMap.get(effectGuid);
            const f = island.assetsMap.get(factory);
            return { sharedScaling: effect.scaling(), slotState: effect.slotStates.get(f)() };
        }, { effectGuid: CHARIOT_AND_CREW, factory: BAKERY });

        // The legacy key is never read back into anything once the shared-scaling loop skips
        // qualifying effects - no target is auto-enabled from it, and no error is thrown on load.
        expect(res.sharedScaling).toBe(0);
        expect(res.slotState).toBe(0);
    });

    test('E3 - regression: a non-qualifying effect\'s shared-scaling persistence is unaffected', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION, { [`island.effect.${NON_QUALIFYING_BUILDING_EFFECT}.scaling`]: '1' });
        const scaling = await page.evaluate((effectGuid) =>
            (window as any).view.island().assetsMap.get(effectGuid).scaling(), NON_QUALIFYING_BUILDING_EFFECT);
        expect(scaling).toBe(1);
    });
});

// ---------------------------------------------------------------------------
// Group F - DLC lock invariant (R8)
// ---------------------------------------------------------------------------
test.describe('Group F - DLC lock invariant', () => {
    test('F1 - an active slot marks the DLC used; clearing it releases the DLC', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), CHARIOT_DLC);

        const res = await page.evaluate(({ effectGuid, factory, dlc }) => {
            const island = (window as any).view.island();
            const effect = island.assetsMap.get(effectGuid);
            const state = effect.slotStates.get(island.assetsMap.get(factory));
            const used = () => (window as any).view.dlcsGuidMap.get(dlc).used();
            state(1); const usedOn = used();
            state(0); const usedOff = used();
            return { usedOn, usedOff };
        }, { effectGuid: CHARIOT_AND_CREW, factory: BAKERY, dlc: CHARIOT_DLC });

        expect(res.usedOn).toBe(true);
        expect(res.usedOff).toBe(false);
    });

    test('F2 - load self-heals an inconsistent "slot on + DLC off" save', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION, { [`${BAKERY}[${CHARIOT_AND_CREW}].scaling`]: 1 });

        const res = await page.evaluate(({ effectGuid, factory, dlc }) => {
            const island = (window as any).view.island();
            const effect = island.assetsMap.get(effectGuid);
            const f = island.assetsMap.get(factory);
            return {
                dlcChecked: (window as any).view.dlcsGuidMap.get(dlc).checked(),
                state: effect.slotStates.get(f)(),
            };
        }, { effectGuid: CHARIOT_AND_CREW, factory: BAKERY, dlc: CHARIOT_DLC });

        expect(res.dlcChecked).toBe(true);
        expect(res.state).toBe(1);
    });

    test('F3 - multi-target: one active slot keeps the DLC used even while another target is off', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), CHARIOT_DLC);

        const res = await page.evaluate(({ effectGuid, factoryA, factoryB, dlc }) => {
            const island = (window as any).view.island();
            const effect = island.assetsMap.get(effectGuid);
            const sA = effect.slotStates.get(island.assetsMap.get(factoryA));
            const sB = effect.slotStates.get(island.assetsMap.get(factoryB));
            const used = () => (window as any).view.dlcsGuidMap.get(dlc).used();
            sA(1); sB(0); const oneActive = used();
            sA(0); const noneActive = used();
            return { oneActive, noneActive };
        }, { effectGuid: CHARIOT_AND_CREW, factoryA: BAKERY, factoryB: ROMAN_IRON, dlc: CHARIOT_DLC });

        expect(res.oneActive).toBe(true);
        expect(res.noneActive).toBe(false);
    });
});
