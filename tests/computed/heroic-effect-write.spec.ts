import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

// U11 - activating an item (Base or Boosted) switches on the island effect named by its `heroicEffect`;
// Off never switches it off. Items and effects are derived from window.params.
const ROMAN_SESSION = 3245;
const EGYPTIAN_SESSION = 149679;
const FAVILLUS = 50890; // factory item without heroicEffect
const BREAD_VILLA_ITEM = 160084; // residence item without heroicEffect in the data

async function loadIsland(page: Page, session: number, data: Record<string, any> = {}, patch?: string) {
    if (patch) {
        // appends a data patch to params.js, the page reads that file as a script
        await page.route('**/js/params.js', async (route) => {
            const response = await route.fetch();
            await route.fulfill({ response, body: (await response.text()) + '\n;' + patch });
        });
    }
    const cl = new ConfigLoader();
    await cl.loadConfigObject(page, cl.createIslandConfig('Test', session, data));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
}

const settle = (page: Page) => page.evaluate(() => new Promise<void>((r) => setTimeout(() => setTimeout(r, 30), 30)));

// First factory item of the island with a heroicEffect that resolves to an Effect with buffs.
async function heroicFactoryItem(page: Page): Promise<{ item: number; effect: number; factory: number; boostable: boolean }> {
    return page.evaluate(() => {
        const island = (window as any).view.island();
        for (const i of island.items) {
            if (!i.heroicEffectGuid) continue;
            const e = island.assetsMap.get(i.heroicEffectGuid);
            if (!e || typeof e.scaling !== 'function' || !e.buffGuids.length) continue;
            return { item: i.guid, effect: i.heroicEffectGuid, factory: i.factories[0].guid, boostable: i.boostEquipments.length > 0 };
        }
        throw new Error('no factory item with a heroic effect on this island');
    });
}

const slot = (page: Page, item: number, factory: number, state: number) => page.evaluate(({ item, factory, state }) => {
    const island = (window as any).view.island();
    island.assetsMap.get(item).slotStates.get(island.assetsMap.get(factory))(state);
}, { item, factory, state });

const effectValue = (page: Page, effect: number) => page.evaluate((g) => (window as any).view.island().assetsMap.get(g).scaling(), effect);
const stored = (page: Page, key: string) => page.evaluate((k) => (window as any).view.island().storage.getItem(k), key);

test.describe('U11 - factory items write their island-wide effect', () => {
    test('activation: Base and Boosted write 1, the item key keeps its own state', async ({ page }) => {
        await loadIsland(page, ROMAN_SESSION);
        const h = await heroicFactoryItem(page);
        expect(h.boostable).toBe(true);
        expect(await effectValue(page, h.effect)).toBe(0);
        expect(await stored(page, `island.effect.${h.effect}.scaling`)).toBeUndefined();
        await slot(page, h.item, h.factory, 1);
        await settle(page);
        expect(await effectValue(page, h.effect)).toBe(1);
        expect(await stored(page, `island.effect.${h.effect}.scaling`)).toBe(1);
        expect(await stored(page, `${h.factory}[${h.item}].scaling`)).toBe(1);

        // a fresh island going straight to Boosted writes the same 1
        await loadIsland(page, ROMAN_SESSION);
        await slot(page, h.item, h.factory, 2);
        await settle(page);
        expect(await effectValue(page, h.effect)).toBe(1);
        expect(await stored(page, `${h.factory}[${h.item}].scaling`)).toBe(2);
    });

    test('unchecking keeps the effect', async ({ page }) => {
        await loadIsland(page, ROMAN_SESSION);
        const h = await heroicFactoryItem(page);
        await slot(page, h.item, h.factory, 1);
        await slot(page, h.item, h.factory, 0);
        await settle(page);
        expect(await effectValue(page, h.effect)).toBe(1);
        expect(await stored(page, `island.effect.${h.effect}.scaling`)).toBe(1);
    });

    test('an item without heroicEffect writes no island effect at any state', async ({ page }) => {
        await loadIsland(page, ROMAN_SESSION);
        const factory = await page.evaluate((g) => (window as any).view.island().assetsMap.get(g).factories[0].guid, FAVILLUS);
        for (const s of [1, 2, 0]) await slot(page, FAVILLUS, factory, s);
        await settle(page);
        const keys = await page.evaluate(() => Object.keys((window as any).view.island().storage.json || {}).filter((k) => k.startsWith('island.effect.')));
        expect(keys).toEqual([]);
    });

    test('a heroicEffect without an Effect in params.effects writes nothing and logs nothing', async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
        await loadIsland(page, ROMAN_SESSION, {}, `window.params.items.find(function (i) { return i.guid === ${FAVILLUS}; }).heroicEffect = 999999999;`);
        const factory = await page.evaluate((g) => (window as any).view.island().assetsMap.get(g).factories[0].guid, FAVILLUS);
        for (const s of [1, 2, 0]) await slot(page, FAVILLUS, factory, s);
        await settle(page);
        const keys = await page.evaluate(() => Object.keys((window as any).view.island().storage.json || {}).filter((k) => k.startsWith('island.effect.')));
        expect(keys).toEqual([]);
        expect(errors).toEqual([]);
    });

    test('Effects dialog switch-off: the item stays, a reload does not write, Base to Boosted writes again', async ({ page }) => {
        await loadIsland(page, ROMAN_SESSION);
        const h = await heroicFactoryItem(page);
        await slot(page, h.item, h.factory, 1);
        await page.evaluate((g) => { (window as any).view.island().assetsMap.get(g).scaling(0); }, h.effect);
        expect(await effectValue(page, h.effect)).toBe(0);
        expect(await page.evaluate(({ i, f }) => {
            const island = (window as any).view.island();
            return island.assetsMap.get(i).slotStates.get(island.assetsMap.get(f))();
        }, { i: h.item, f: h.factory })).toBe(1);
        await settle(page);

        // the same stored data, loaded again: the item is equipped, the effect stays 0
        await loadIsland(page, ROMAN_SESSION, { [`${h.factory}[${h.item}].scaling`]: 1, [`island.effect.${h.effect}.scaling`]: 0 });
        expect(await effectValue(page, h.effect)).toBe(0);
        await slot(page, h.item, h.factory, 2);
        expect(await effectValue(page, h.effect)).toBe(1);
    });

    test('an old save (item equipped, effect never stored) loads off and a Base to Boosted change switches it on', async ({ page }) => {
        await loadIsland(page, ROMAN_SESSION);
        const h = await heroicFactoryItem(page);
        await loadIsland(page, ROMAN_SESSION, { [`${h.factory}[${h.item}].scaling`]: 1 });
        expect(await effectValue(page, h.effect)).toBe(0);
        await slot(page, h.item, h.factory, 2);
        expect(await effectValue(page, h.effect)).toBe(1);
    });

    test('DLC invariant: the effect of an activated item makes its DLC used and checked', async ({ page }) => {
        await loadIsland(page, EGYPTIAN_SESSION);
        const h = await page.evaluate(() => {
            const w = window as any;
            const island = w.view.island();
            for (const i of island.items) {
                if (!i.heroicEffectGuid) continue;
                const e = island.assetsMap.get(i.heroicEffectGuid);
                if (e && typeof e.scaling === 'function' && e.dlcs && e.dlcs.length === 1) return { item: i.guid, factory: i.factories[0].guid, effect: e.guid, dlc: e.dlcs[0].guid };
            }
            return null;
        });
        test.skip(h === null, 'no heroic effect with exactly one DLC on this island');
        await page.evaluate((d) => { (window as any).view.dlcsGuidMap.get(d).checked(false); }, h!.dlc);
        await slot(page, h!.item, h!.factory, 1);
        const dlcState = () => page.evaluate((d) => ({ used: Boolean((window as any).view.dlcsGuidMap.get(d).used()), checked: Boolean((window as any).view.dlcsGuidMap.get(d).checked()) }), h!.dlc);
        expect(await dlcState()).toEqual({ used: true, checked: true });
        // the item no longer holds the DLC at Off; the effect, which stays on, does
        await slot(page, h!.item, h!.factory, 0);
        expect(await dlcState()).toEqual({ used: true, checked: true });
    });
});

test.describe('U11 - residence items write their island-wide effect', () => {
    // 160084 carries no heroicEffect in the data; the patch gives it one that exists in params.effects
    const patch = (effect: string) => `(function () {
        var item = window.params.items.find(function (i) { return i.guid === ${BREAD_VILLA_ITEM}; });
        item.heroicEffect = ${effect};
    })();`;

    const anyHeroicEffect = (page: Page) => page.evaluate(() => {
        const island = (window as any).view.island();
        const i = island.items.find((x: any) => x.heroicEffectGuid && island.assetsMap.get(x.heroicEffectGuid)?.buffGuids?.length);
        return i.heroicEffectGuid as number;
    });

    test('the shared villa state writes the effect on activation and never switches it off', async ({ page }) => {
        await loadIsland(page, ROMAN_SESSION);
        const effect = await anyHeroicEffect(page);
        await loadIsland(page, ROMAN_SESSION, {}, patch(String(effect)));
        const state = (v: number) => page.evaluate(({ i, v }) => { (window as any).view.island().assetsMap.get(i).slotStates.values().next().value(v); }, { i: BREAD_VILLA_ITEM, v });
        expect(await effectValue(page, effect)).toBe(0);
        await state(1);
        expect(await effectValue(page, effect)).toBe(1);
        await state(0);
        expect(await effectValue(page, effect)).toBe(1);
        await page.evaluate((g) => { (window as any).view.island().assetsMap.get(g).scaling(0); }, effect);
        await state(2);
        expect(await effectValue(page, effect)).toBe(1);
    });

    test('a villa item without heroicEffect changes no island effect', async ({ page }) => {
        await loadIsland(page, ROMAN_SESSION);
        for (const v of [1, 2, 0]) await page.evaluate(({ i, v }) => { (window as any).view.island().assetsMap.get(i).slotStates.values().next().value(v); }, { i: BREAD_VILLA_ITEM, v });
        await settle(page);
        const keys = await page.evaluate(() => Object.keys((window as any).view.island().storage.json || {}).filter((k) => k.startsWith('island.effect.')));
        expect(keys).toEqual([]);
    });
});

test.describe('U11 - two items naming one effect', () => {
    test('activating either sets 1, both Off leaves 1', async ({ page }) => {
        await loadIsland(page, EGYPTIAN_SESSION);
        const pair = await page.evaluate(() => {
            const island = (window as any).view.island();
            const byEffect = new Map<number, any[]>();
            for (const i of island.items) {
                if (!i.heroicEffectGuid || !island.assetsMap.get(i.heroicEffectGuid)?.buffGuids) continue;
                byEffect.set(i.heroicEffectGuid, [...(byEffect.get(i.heroicEffectGuid) || []), i]);
            }
            for (const [effect, list] of byEffect)
                if (list.length > 1) return { effect, a: [list[0].guid, list[0].factories[0].guid], b: [list[1].guid, list[1].factories[0].guid] };
            return null;
        });
        test.skip(pair === null, 'no two items name one effect on this island');
        await slot(page, pair!.a[0], pair!.a[1], 1);
        expect(await effectValue(page, pair!.effect)).toBe(1);
        await page.evaluate((g) => { (window as any).view.island().assetsMap.get(g).scaling(0); }, pair!.effect);
        await slot(page, pair!.b[0], pair!.b[1], 1);
        expect(await effectValue(page, pair!.effect)).toBe(1);
        await slot(page, pair!.a[0], pair!.a[1], 0);
        await slot(page, pair!.b[0], pair!.b[1], 0);
        expect(await effectValue(page, pair!.effect)).toBe(1);
    });
});
