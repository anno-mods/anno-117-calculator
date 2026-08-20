import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

// Tri-state boost toggle for equipped factory items (Off / Base / Boosted).
// Fixtures (verified against the 2026-07-19 params.js):
//   Favillus 50890  (no DLC)  base buff 50891 (+35% prod), boost buff 108960 (+45% prod), Roman factories
//   Smelters 51334  (no boost) buff 51335 (workforce maintenance -25%), Roman factories
//   Lorana   144842 (DLC 67902) base 144843 (+25%), boost 144892 (+50%), single Celtic factory 31764
//   Volcano L End 145268 (DLC 67902, boostable) multiple Roman factories -> multi-slot DLC lock test
const ROMAN_SESSION = 3245;
const CELTIC_SESSION = 6627;

const FAVILLUS = 50890;
const FAVILLUS_BASE_BUFF = 50891;
const FAVILLUS_BOOST_BUFF = 108960;
const ROMAN_FACTORY_A = 3070;   // Roman Iron
const ROMAN_FACTORY_B = 3074;   // Roman Glass (also a Favillus target)

const SMELTERS = 51334;         // no boostBuffs

const LORANA = 144842;
const LORANA_BOOST_BUFF = 144892;
const HERBS_FACTORY = 31764;
const ASH_DLC = 67902;

const VOLCANO_L = 145268;       // DLC 67902, boostable, multiple Roman targets

// Racing L 01 (156714, boostable, DLC 67903): both base buff 156715 and boost buff 156716 replace
// Chassis (2128) -> Wood (2077); single Celtic target factory 5616 (Chariots) that consumes Chassis.
// Chosen as a non-mythic fixture (the "Specialist Mythic" items are subject to rework). Note that Wood
// is also consumed indirectly (Chassis is produced from Wood) and the boost buff changes productivity,
// so only the replaced-from good (Chassis) has a clean, productivity-independent demand.
const RACING = 156714;
const RACING_FACTORY = 5616;
const RACING_DLC = 67903;
const CHASSIS = 2128;   // replaced-from
const WOOD_R = 2077;    // replaced-to

async function loadIsland(page: any, name: string, session: number, data: Record<string, any> = {}) {
    const cl = new ConfigLoader();
    const config = cl.createIslandConfig(name, session, data);
    await cl.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
}

// ---------------------------------------------------------------------------
// Group A - State machine
// ---------------------------------------------------------------------------
test.describe('Group A - tri-state state machine (Favillus, no DLC)', () => {
    test.beforeEach(async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
    });

    test('A1 - three states apply the right productivity', async ({ page }) => {
        const boostAt = (st: number) => page.evaluate(({ item, factory, st }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const f = island.assetsMap.get(factory);
            it.slotStates.get(f)(st);
            return f.boost();
        }, { item: FAVILLUS, factory: ROMAN_FACTORY_A, st });

        const s0 = await boostAt(0);
        const s1 = await boostAt(1);
        const s2 = await boostAt(2);
        const s0again = await boostAt(0);

        expect(s1).toBeGreaterThan(s0);         // Base productivity added
        expect(s2).toBeGreaterThan(s1);         // Boosted is stronger than Base
        expect(s0again).toBeCloseTo(s0, 6);     // back to baseline
    });

    test('A2 - mutual exclusion of base and boost variants', async ({ page }) => {
        const scalings = await page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const f = island.assetsMap.get(factory);
            const state = it.slotStates.get(f);
            const base = it.equipments.find((e: any) => e.target === f);
            const boost = it.boostEquipments.find((e: any) => e.target === f);
            const read = () => ({ base: base.scaling(), boost: boost.scaling() });
            state(1); const s1 = read();
            state(2); const s2 = read();
            state(0); const s0 = read();
            return { s0, s1, s2 };
        }, { item: FAVILLUS, factory: ROMAN_FACTORY_A });

        expect(scalings.s1).toEqual({ base: 1, boost: 0 });
        expect(scalings.s2).toEqual({ base: 0, boost: 1 });
        expect(scalings.s0).toEqual({ base: 0, boost: 0 });
    });

    test('A3 - UI toggle cycles 0 -> 1 -> 2 -> 0', async ({ page }) => {
        await page.evaluate((fg) => {
            const island = (window as any).view.island();
            (window as any).view.selectedProduct(island.assetsMap.get(fg).getProduct());
        }, ROMAN_FACTORY_A);

        const sel = `#fc-${ROMAN_FACTORY_A}-${FAVILLUS}-equipped`;
        await page.waitForSelector(sel, { state: 'attached' });

        const readState = () => page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            return island.assetsMap.get(item).slotStates.get(island.assetsMap.get(factory))();
        }, { item: FAVILLUS, factory: ROMAN_FACTORY_A });

        const states: number[] = [];
        for (let i = 0; i < 3; i++) {
            await page.locator(sel).first().dispatchEvent('click');
            states.push(await readState());
        }
        expect(states).toEqual([1, 2, 0]);
    });

    test('A4 - no-boost item cycles 0 -> 1 -> 0 and applies its buff at Base', async ({ page }) => {
        const info = await page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const f = island.assetsMap.get(factory);
            const state = it.slotStates.get(f);
            const base = it.equipments.find((e: any) => e.target === f);
            state(1); const wf1 = base.workforceMaintenanceFactorUpgrade();
            state(0); const wf0 = base.workforceMaintenanceFactorUpgrade();
            return { boostLen: it.boostEquipments.length, wf1, wf0 };
        }, { item: SMELTERS, factory: ROMAN_FACTORY_A });

        expect(info.boostLen).toBe(0);
        expect(info.wf1).toBeCloseTo(-25, 6);
        expect(info.wf0).toBeCloseTo(0, 6);

        // UI cycle only reaches Base for a no-boost item.
        await page.evaluate((fg) => {
            const island = (window as any).view.island();
            (window as any).view.selectedProduct(island.assetsMap.get(fg).getProduct());
        }, ROMAN_FACTORY_A);
        const sel = `#fc-${ROMAN_FACTORY_A}-${SMELTERS}-equipped`;
        await page.waitForSelector(sel, { state: 'attached' });
        const readState = () => page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            return island.assetsMap.get(item).slotStates.get(island.assetsMap.get(factory))();
        }, { item: SMELTERS, factory: ROMAN_FACTORY_A });

        const states: number[] = [];
        for (let i = 0; i < 3; i++) {
            await page.locator(sel).first().dispatchEvent('click');
            states.push(await readState());
        }
        expect(states).toEqual([1, 0, 1]);
    });

    test('A5 - per-slot independence across factories', async ({ page }) => {
        const res = await page.evaluate(({ item, fa, fb }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const a = island.assetsMap.get(fa);
            const b = island.assetsMap.get(fb);
            it.slotStates.get(a)(2); // Boosted on A
            it.slotStates.get(b)(1); // Base on B
            const baseA = it.equipments.find((e: any) => e.target === a);
            const boostA = it.boostEquipments.find((e: any) => e.target === a);
            const baseB = it.equipments.find((e: any) => e.target === b);
            const boostB = it.boostEquipments.find((e: any) => e.target === b);
            return {
                aBase: baseA.scaling(), aBoost: boostA.scaling(),
                bBase: baseB.scaling(), bBoost: boostB.scaling(),
            };
        }, { item: FAVILLUS, fa: ROMAN_FACTORY_A, fb: ROMAN_FACTORY_B });

        expect(res.aBase).toBe(0);
        expect(res.aBoost).toBe(1);
        expect(res.bBase).toBe(1);
        expect(res.bBoost).toBe(0);
    });

    test('A6 - activeBuff() reflects the displayed variant', async ({ page }) => {
        const res = await page.evaluate(({ item, factory, baseGuid, boostGuid }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const f = island.assetsMap.get(factory);
            const state = it.slotStates.get(f);
            const base = it.equipments.find((e: any) => e.target === f);
            state(0); const g0 = base.activeBuff().guid;
            state(1); const g1 = base.activeBuff().guid;
            state(2); const g2 = base.activeBuff().guid;
            return { g0, g1, g2, baseGuid, boostGuid };
        }, { item: FAVILLUS, factory: ROMAN_FACTORY_A, baseGuid: FAVILLUS_BASE_BUFF, boostGuid: FAVILLUS_BOOST_BUFF });

        expect(res.g0).toBe(res.baseGuid);
        expect(res.g1).toBe(res.baseGuid);
        expect(res.g2).toBe(res.boostGuid);
    });

    test('A7 - exactly one item row, boost buff still in the calc', async ({ page }) => {
        const res = await page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            const f = island.assetsMap.get(factory);
            const rows = f.availableItems().filter((e: any) => e.parent.guid === item).length;
            const allBuffs = f.buffs().filter((e: any) => e.parent && e.parent.guid === item).length;
            return { rows, allBuffs };
        }, { item: FAVILLUS, factory: ROMAN_FACTORY_A });

        expect(res.rows).toBe(1);       // one row per (item, factory)
        expect(res.allBuffs).toBe(2);   // base + boost both registered for the calc
    });
});

// ---------------------------------------------------------------------------
// Group B - Persistence (reuse the .scaling slot as int 0/1/2)
// ---------------------------------------------------------------------------
test.describe('Group B - persistence', () => {
    test('B1 - Boosted saves the integer 2 under the scaling key', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
        const stored = await page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const f = island.assetsMap.get(factory);
            it.slotStates.get(f)(2);
            return island.storage.getItem(`${factory}[${item}].scaling`);
        }, { item: FAVILLUS, factory: ROMAN_FACTORY_A });

        expect(stored).toBe(2);
        expect(typeof stored).toBe('number');
    });

    test('B1 - Boosted restores from a saved 2 and re-applies the boost buff', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION, { [`${ROMAN_FACTORY_A}[${FAVILLUS}].scaling`]: 2 });
        const res = await page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const f = island.assetsMap.get(factory);
            const boost = it.boostEquipments.find((e: any) => e.target === f);
            return { state: it.slotStates.get(f)(), boostScaling: boost.scaling() };
        }, { item: FAVILLUS, factory: ROMAN_FACTORY_A });

        expect(res.state).toBe(2);
        expect(res.boostScaling).toBe(1);
    });

    test('B2 - Base restores from a saved 1', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION, { [`${ROMAN_FACTORY_A}[${FAVILLUS}].scaling`]: 1 });
        const res = await page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const f = island.assetsMap.get(factory);
            const base = it.equipments.find((e: any) => e.target === f);
            const boost = it.boostEquipments.find((e: any) => e.target === f);
            return { state: it.slotStates.get(f)(), baseScaling: base.scaling(), boostScaling: boost.scaling() };
        }, { item: FAVILLUS, factory: ROMAN_FACTORY_A });

        expect(res.state).toBe(1);
        expect(res.baseScaling).toBe(1);
        expect(res.boostScaling).toBe(0);
    });

    test('B3 - backward compatibility: a pre-change float 1 loads as Base', async ({ page }) => {
        // Old saves stored the equip scaling as a float; parseInt("1.0") === 1 -> Base.
        await loadIsland(page, 'Latium', ROMAN_SESSION, { [`${ROMAN_FACTORY_A}[${FAVILLUS}].scaling`]: '1.0' });
        const res = await page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const f = island.assetsMap.get(factory);
            return it.slotStates.get(f)();
        }, { item: FAVILLUS, factory: ROMAN_FACTORY_A });
        expect(res).toBe(1);
    });

    test('B4 - no-boost item persists 0/1 unchanged', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
        const res = await page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const f = island.assetsMap.get(factory);
            const state = it.slotStates.get(f);
            const key = `${factory}[${item}].scaling`;
            state(1); const one = island.storage.getItem(key);
            state(0); const zero = island.storage.getItem(key);
            return { one, zero };
        }, { item: SMELTERS, factory: ROMAN_FACTORY_A });

        expect(res.one).toBe(1);
        expect(res.zero).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Group C - DLC unlock / lock visibility (Lorana, DLC 67902)
// ---------------------------------------------------------------------------
test.describe('Group C - DLC visibility (Lorana)', () => {
    test.beforeEach(async ({ page }) => {
        await loadIsland(page, 'Britannia', CELTIC_SESSION);
    });

    test('C1 - locked hides the row, unlocking shows it', async ({ page }) => {
        const hasRow = () => page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            const f = island.assetsMap.get(factory);
            return f.availableItems().some((e: any) => e.parent.guid === item);
        }, { item: LORANA, factory: HERBS_FACTORY });

        expect(await hasRow()).toBe(false);                      // DLC off by default

        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), ASH_DLC);
        expect(await hasRow()).toBe(true);                       // unlocked -> visible
    });

    test('C2 - locking after equip hides the row again', async ({ page }) => {
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), ASH_DLC);
        await page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            it.slotStates.get(island.assetsMap.get(factory))(2);
        }, { item: LORANA, factory: HERBS_FACTORY });

        // Force the DLC off (bypassing the UI disable) to prove the row disappears.
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(false), ASH_DLC);

        const hasRow = await page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            const f = island.assetsMap.get(factory);
            return f.availableItems().some((e: any) => e.parent.guid === item);
        }, { item: LORANA, factory: HERBS_FACTORY });
        expect(hasRow).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Group D - DLC invariant: an applied DLC item cannot be un-DLC'd
// ---------------------------------------------------------------------------
test.describe('Group D - DLC lock invariant', () => {
    test('D1 - Boosted slot marks the DLC used; clearing it releases the DLC', async ({ page }) => {
        await loadIsland(page, 'Britannia', CELTIC_SESSION);
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), ASH_DLC);

        const res = await page.evaluate(({ item, factory, dlc }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const state = it.slotStates.get(island.assetsMap.get(factory));
            const used = () => (window as any).view.dlcsGuidMap.get(dlc).used();
            state(2); const usedOn = used();
            state(0); const usedOff = used();
            return { usedOn, usedOff };
        }, { item: LORANA, factory: HERBS_FACTORY, dlc: ASH_DLC });

        expect(res.usedOn).toBe(true);
        expect(res.usedOff).toBe(false);
    });

    test('D2 - Base slot also marks the DLC used', async ({ page }) => {
        await loadIsland(page, 'Britannia', CELTIC_SESSION);
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), ASH_DLC);
        const used = await page.evaluate(({ item, factory, dlc }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            it.slotStates.get(island.assetsMap.get(factory))(1);
            return (window as any).view.dlcsGuidMap.get(dlc).used();
        }, { item: LORANA, factory: HERBS_FACTORY, dlc: ASH_DLC });
        expect(used).toBe(true);
    });

    test('D3 - load self-heals an inconsistent "Boosted + DLC off" save', async ({ page }) => {
        // Save has the slot Boosted but the DLC stored off (absent -> default off).
        await loadIsland(page, 'Britannia', CELTIC_SESSION, { [`${HERBS_FACTORY}[${LORANA}].scaling`]: 2 });

        const res = await page.evaluate(({ item, factory, dlc }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const f = island.assetsMap.get(factory);
            const boost = it.boostEquipments.find((e: any) => e.target === f);
            return {
                dlcChecked: (window as any).view.dlcsGuidMap.get(dlc).checked(),
                state: it.slotStates.get(f)(),
                boostScaling: boost.scaling(),
            };
        }, { item: LORANA, factory: HERBS_FACTORY, dlc: ASH_DLC });

        expect(res.dlcChecked).toBe(true);   // auto-enabled by used -> checked(true)
        expect(res.state).toBe(2);
        expect(res.boostScaling).toBe(1);
    });

    test('D4 - multi-slot DLC item: any active slot keeps the DLC used', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), ASH_DLC);

        const res = await page.evaluate(({ item, dlc }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const factories = it.factories.slice(0, 2);
            const sA = it.slotStates.get(factories[0]);
            const sB = it.slotStates.get(factories[1]);
            const used = () => (window as any).view.dlcsGuidMap.get(dlc).used();
            sA(2); sB(0); const oneActive = used();
            sB(1); const bothActive = used();
            sA(0); const stillBviaB = used();
            sB(0); const noneActive = used();
            return { oneActive, bothActive, stillBviaB, noneActive };
        }, { item: VOLCANO_L, dlc: ASH_DLC });

        expect(res.oneActive).toBe(true);
        expect(res.bothActive).toBe(true);
        expect(res.stillBviaB).toBe(true);
        expect(res.noneActive).toBe(false);
    });

    test('D5 - all slots Off: DLC not used and unlockable', async ({ page }) => {
        await loadIsland(page, 'Britannia', CELTIC_SESSION);
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), ASH_DLC);

        const res = await page.evaluate(({ item, factory, dlc }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            it.slotStates.get(island.assetsMap.get(factory))(0);
            const d = (window as any).view.dlcsGuidMap.get(dlc);
            const usedBefore = d.used();
            d.checked(false);           // now unlockable (no active slot)
            return { usedBefore, checkedAfter: d.checked() };
        }, { item: LORANA, factory: HERBS_FACTORY, dlc: ASH_DLC });

        expect(res.usedBefore).toBe(false);
        expect(res.checkedAfter).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Group E - No regressions
// ---------------------------------------------------------------------------
test.describe('Group E - no regressions', () => {
    test('E2 - a factory with only non-boost items keeps plain equip behaviour', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
        const res = await page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const f = island.assetsMap.get(factory);
            const state = it.slotStates.get(f);
            // checked write toggles Off/Base only, never Boosted.
            it.checked(true); const afterCheck = state();
            it.checked(false); const afterUncheck = state();
            return { boostLen: it.boostEquipments.length, afterCheck, afterUncheck };
        }, { item: SMELTERS, factory: ROMAN_FACTORY_A });

        expect(res.boostLen).toBe(0);
        expect(res.afterCheck).toBe(1);
        expect(res.afterUncheck).toBe(0);
    });

    test('E1 - checked write never sets Boosted even for a boostable item', async ({ page }) => {
        await loadIsland(page, 'Latium', ROMAN_SESSION);
        const res = await page.evaluate(({ item }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            it.checked(true);
            const states = it.factories.map((f: any) => it.slotStates.get(f)());
            return { states, checked: it.checked() };
        }, { item: FAVILLUS });

        expect(res.checked).toBe(true);
        expect(res.states.every((s: number) => s === 1)).toBe(true); // Base, not Boosted
    });
});

// ---------------------------------------------------------------------------
// Group F - input replacement in the Boosted state
// ---------------------------------------------------------------------------
// A boostable item whose base AND boost buff carry the same replaceInputs must apply the swap in
// Base and in Boosted, and revert to the original good when the slot is Off. Uses Racing L 01 (156714,
// Chassis -> Wood) on its only Celtic target factory 5616 (Chariots), which is the factory that consumes
// Chassis. Assertions focus on the replaced-from good (Chassis), whose demand is clean and independent
// of the boost buff's productivity change.
test.describe('Group F - input replacement across states (Racing L 01)', () => {
    test.beforeEach(async ({ page }) => {
        await loadIsland(page, 'Britannia', CELTIC_SESSION, {
            [`${RACING_FACTORY}.buildings.constructed`]: '5',
            [`${RACING_FACTORY}.buildings.fullyUtilizeConstructed`]: '1',
        });
        // The item is gated behind DLC 67903 - unlock it so the item behaves as in-game.
        await page.evaluate((dlc) => (window as any).view.dlcsGuidMap.get(dlc).checked(true), RACING_DLC);
    });

    test('F1 - Chassis is replaced by Wood in both Base and Boosted, and reverts when Off', async ({ page }) => {
        const demandAt = (st: number) => page.evaluate(({ item, factory, st, from, to }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const f = island.assetsMap.get(factory);
            it.slotStates.get(f)(st);
            return { chassis: island.assetsMap.get(from).totalDemand(), wood: island.assetsMap.get(to).totalDemand() };
        }, { item: RACING, factory: RACING_FACTORY, st, from: CHASSIS, to: WOOD_R });

        const off = await demandAt(0);
        const base = await demandAt(1);
        const boosted = await demandAt(2);
        const backOff = await demandAt(0);

        // Off: the factory consumes its original input (Chassis).
        expect(off.chassis).toBeGreaterThan(0);

        // Base: Chassis is swapped out (demand -> 0) and the replacement good (Wood) is consumed instead.
        expect(base.chassis).toBeCloseTo(0, 6);
        expect(base.wood).toBeGreaterThan(0);

        // Boosted: the boost buff carries the same replacement, so Chassis stays swapped out.
        expect(boosted.chassis).toBeCloseTo(0, 6);
        expect(boosted.wood).toBeGreaterThan(0);

        // The boost buff changes productivity, so the Wood throughput differs between Base and Boosted.
        expect(boosted.wood).not.toBeCloseTo(base.wood, 3);

        // Off again: the original Chassis demand fully reverts.
        expect(backOff.chassis).toBeCloseTo(off.chassis, 6);
    });

    test('F2 - only the active variant contributes its replacement', async ({ page }) => {
        const res = await page.evaluate(({ item, factory }) => {
            const island = (window as any).view.island();
            const it = island.assetsMap.get(item);
            const f = island.assetsMap.get(factory);
            const state = it.slotStates.get(f);
            const base = it.equipments.find((e: any) => e.target === f);
            const boost = it.boostEquipments.find((e: any) => e.target === f);
            const snapshot = () => ({
                baseScaling: base.scaling(), baseRepl: base.replacements.size,
                boostScaling: boost.scaling(), boostRepl: boost.replacements.size,
            });
            state(1); const s1 = snapshot();
            state(2); const s2 = snapshot();
            return { s1, s2 };
        }, { item: RACING, factory: RACING_FACTORY });

        // Both variants carry the replacement, but only the active one has scaling 1.
        expect(res.s1.baseRepl).toBe(1);
        expect(res.s1.boostRepl).toBe(1);
        expect(res.s1).toMatchObject({ baseScaling: 1, boostScaling: 0 });
        expect(res.s2).toMatchObject({ baseScaling: 0, boostScaling: 1 });
    });
});
