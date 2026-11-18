import { test, expect, Page } from '@playwright/test';
import { exportDoc, fileOf, importText, openApp } from '../helpers/exchange';

// U11 exchange half: an imported item at Base or Boosted switches on the island effect named by its heroicEffect,
// unless the file states that effect itself; and the merge half of import-scopes R23a. Items and effects are derived
// from window.params; the GUIDs below are the fixtures the scenarios name.
//   160048  factory item, heroicEffect 166439 (no DLC), boostable
//   185162  factory item, heroicEffect 185132 (DLC 67904)
//   160084  villa item without heroicEffect in the data (the villa tests patch one in)
//   50890   factory item without heroicEffect
const LATIUM = 3245;
const HEROIC_ITEM = 160048;
const HEROIC_EFFECT = 166439;
const DLC3_ITEM = 185162;
const DLC3_EFFECT = 185132;
const VILLA_ITEM = 160084;
const PLAIN_ITEM = 50890;

interface Entry { kind: string; code: string; island?: string; message: string; detail?: Record<string, any> }
interface IslandPlan { store: Record<string, any>; ext: Record<string, any>; report: Entry[] }

const effectKey = (g: number) => 'island.effect.' + g + '.scaling';

// First factory of params.factories among the targets of the item.
async function factoryOf(page: Page, item: number): Promise<number> {
    return page.evaluate((g) => {
        const it = window.params.items.find((i: { guid: number }) => i.guid === g);
        const f = it.targets.find((t: number) => window.params.factories.some((x: { guid: number }) => x.guid === t));
        if (f === undefined) throw new Error('item ' + g + ' has no factory target');
        return f as number;
    }, item);
}

async function planOne(page: Page, island: Record<string, any>, extra: Record<string, any> = {}): Promise<IslandPlan> {
    return page.evaluate((text: string) => {
        const ex = window.exchange;
        const r = ex.readExchange(text);
        if ('error' in r) throw new Error(r.error);
        return ex.planIslands(r).islands[0] as never;
    }, fileOf([{ id: 'x', name: 'Test', session: LATIUM, ...island }], extra));
}

test.describe('heroic effect write: import plan', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    test('a factory item at Base writes its island effect as 1, Boosted writes the same value', async ({ page }) => {
        const f = await factoryOf(page, HEROIC_ITEM);
        const base = await planOne(page, { factories: { [f]: { items: [{ item: HEROIC_ITEM }] } } });
        expect(base.store[effectKey(HEROIC_EFFECT)]).toBe(1);
        expect(base.store[f + '[' + HEROIC_ITEM + '].scaling']).toBe(1);
        const boosted = await planOne(page, { factories: { [f]: { items: [{ item: HEROIC_ITEM, boosted: true }] } } });
        expect(boosted.store[effectKey(HEROIC_EFFECT)]).toBe(1);
        expect(boosted.store[f + '[' + HEROIC_ITEM + '].scaling']).toBe(2);
    });

    test('AE4: an explicit effects entry of 0 keeps the effect off while the item is equipped', async ({ page }) => {
        const f = await factoryOf(page, HEROIC_ITEM);
        const p = await planOne(page, { factories: { [f]: { items: [{ item: HEROIC_ITEM }] } }, effects: { [HEROIC_EFFECT]: 0 } });
        expect(p.store[effectKey(HEROIC_EFFECT)]).toBe(0);
        expect(p.store[f + '[' + HEROIC_ITEM + '].scaling']).toBe(1);
    });

    test('a measured mythicEffect of an item record (boostConditionMet false) wins over the item entry', async ({ page }) => {
        const f = await factoryOf(page, HEROIC_ITEM);
        const p = await planOne(page, {
            factories: { [f]: { items: [{ item: HEROIC_ITEM }] } },
            itemHolders: [{ guid: 31032, instance: 1, items: [{ item: 51328, instance: 10, slot: 0, mythicEffect: HEROIC_EFFECT, boostConditionMet: false }] }],
        });
        expect(p.store[effectKey(HEROIC_EFFECT)]).toBe(0);
    });

    test('an effect stated in effects.global or effects.bySession suppresses the island write', async ({ page }) => {
        const f = await factoryOf(page, HEROIC_ITEM);
        const island = { factories: { [f]: { items: [{ item: HEROIC_ITEM }] } } };
        const global = await planOne(page, island, { effects: { global: { [HEROIC_EFFECT]: 1 } } });
        expect(global.store[effectKey(HEROIC_EFFECT)]).toBeUndefined();
        const session = await planOne(page, island, { effects: { bySession: { [LATIUM]: { [HEROIC_EFFECT]: 1 } } } });
        expect(session.store[effectKey(HEROIC_EFFECT)]).toBeUndefined();
    });

    test('an item without heroicEffect writes no island effect', async ({ page }) => {
        const f = await factoryOf(page, PLAIN_ITEM);
        const p = await planOne(page, { factories: { [f]: { items: [{ item: PLAIN_ITEM }] } } });
        expect(Object.keys(p.store).filter((k) => k.startsWith('island.effect.'))).toEqual([]);
    });

    test('an item at Off (not listed) writes nothing', async ({ page }) => {
        const p = await planOne(page, { factories: {} });
        expect(p.store[effectKey(HEROIC_EFFECT)]).toBeUndefined();
    });

    test('DLC: the item and its effect add the DLC to the dlc-enabled report', async ({ page }) => {
        const f = await factoryOf(page, DLC3_ITEM);
        const p = await planOne(page, { factories: { [f]: { items: [{ item: DLC3_ITEM }] } } });
        expect(p.store[effectKey(DLC3_EFFECT)]).toBe(1);
        const dlc = p.report.find((e) => e.code === 'dlc-enabled')!;
        expect(dlc.detail!.items).toContain(DLC3_ITEM);
        expect(dlc.detail!.effects).toContain(DLC3_EFFECT);
    });
});

test.describe('heroic effect write: residence items', () => {
    // 160084 carries no heroicEffect in the data; the patch names one that exists in params.effects
    const patch = ';(function () { window.params.items.find(function (i) { return i.guid === ' + VILLA_ITEM + '; }).heroicEffect = ' + HEROIC_EFFECT + '; })();';

    test.beforeEach(async ({ page }) => {
        await page.route('**/js/params.js', async (route) => {
            const response = await route.fetch();
            await route.fulfill({ response, body: (await response.text()) + '\n' + patch });
        });
        await openApp(page);
    });

    test('AE4: a residence item entry stores its state and the effect as 1; an explicit 0 stays 0', async ({ page }) => {
        const on = await planOne(page, { residenceItems: [{ item: VILLA_ITEM }] });
        expect(on.store['residenceItem.' + VILLA_ITEM + '.state']).toBe(1);
        expect(on.store[effectKey(HEROIC_EFFECT)]).toBe(1);
        const off = await planOne(page, { residenceItems: [{ item: VILLA_ITEM }], effects: { [HEROIC_EFFECT]: 0 } });
        expect(off.store['residenceItem.' + VILLA_ITEM + '.state']).toBe(1);
        expect(off.store[effectKey(HEROIC_EFFECT)]).toBe(0);
    });

    test('a villa item that is not listed writes no effect', async ({ page }) => {
        const p = await planOne(page, { residenceItems: [] });
        expect(p.store[effectKey(HEROIC_EFFECT)]).toBeUndefined();
    });
});

test.describe('heroic effect write: round trip', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    const effectsOf = async (page: Page) => {
        const { document } = await exportDoc(page);
        return document.islands.find((i: Record<string, any>) => i.name === 'Test') as Record<string, any>;
    };

    test('item and effect on: both survive an export and a re-import', async ({ page }) => {
        const f = await factoryOf(page, HEROIC_ITEM);
        const text = fileOf([{ id: 'x', name: 'Test', session: LATIUM, factories: { [f]: { items: [{ item: HEROIC_ITEM }] } } }]);
        expect((await importText(page, text)).ok).toBe(true);
        const out = await effectsOf(page);
        expect(out.effects[HEROIC_EFFECT]).toBe(1);
        expect(out.factories[f].items).toEqual([{ item: HEROIC_ITEM }]);
        expect((await importText(page, JSON.stringify((await exportDoc(page)).document))).ok).toBe(true);
        const again = await effectsOf(page);
        expect(again.effects[HEROIC_EFFECT]).toBe(1);
    });

    test('an equipped item whose effect has no stored value (older save) exports effects[guid] 0, so a re-import keeps it off', async ({ page }) => {
        const f = await factoryOf(page, HEROIC_ITEM);
        const text = fileOf([{ id: 'x', name: 'Test', session: LATIUM, factories: { [f]: { items: [{ item: HEROIC_ITEM }] } } }]);
        expect((await importText(page, text)).ok).toBe(true);
        await page.evaluate((g) => {
            const store = JSON.parse(localStorage.getItem('Test') as string);
            delete store['island.effect.' + g + '.scaling'];
            localStorage.setItem('Test', JSON.stringify(store));
        }, HEROIC_EFFECT);
        const out = await effectsOf(page);
        expect(out.effects[HEROIC_EFFECT]).toBe(0);
        expect((await importText(page, JSON.stringify((await exportDoc(page)).document))).ok).toBe(true);
        const value = await page.evaluate((g) => window.view.islands().find((i: { name(): string }) => i.name() === 'Test').assetsMap.get(g).scaling(), HEROIC_EFFECT);
        expect(value).toBe(0);
    });

    test('item equipped and effect switched off: the export carries effects[guid] 0 and a re-import keeps it off', async ({ page }) => {
        const f = await factoryOf(page, HEROIC_ITEM);
        const text = fileOf([{ id: 'x', name: 'Test', session: LATIUM, factories: { [f]: { items: [{ item: HEROIC_ITEM }] } } }]);
        expect((await importText(page, text)).ok).toBe(true);
        await page.evaluate((g) => {
            const island = window.view.islands().find((i: { name(): string }) => i.name() === 'Test');
            island.assetsMap.get(g).scaling(0);
        }, HEROIC_EFFECT);
        const out = await effectsOf(page);
        expect(out.effects[HEROIC_EFFECT]).toBe(0);
        expect(out.factories[f].items).toEqual([{ item: HEROIC_ITEM }]);
        expect((await importText(page, JSON.stringify((await exportDoc(page)).document))).ok).toBe(true);
        const stored = await page.evaluate((g) => {
            const island = window.view.islands().find((i: { name(): string }) => i.name() === 'Test');
            return island.assetsMap.get(g).scaling();
        }, HEROIC_EFFECT);
        expect(stored).toBe(0);
    });
});

// Merge half of import-scopes R23a: the write of the effect value is planned like any other island effect key, so a
// partial import keeps or replaces it with the Modifiers scope.
test.describe('R23a merge half: the heroic effect value follows the Modifiers scope', () => {
    const NONE = { islands: false, residences: false, production: false, trade: false, modifiers: false, keepIslands: false, keepRoutes: false, recalcRoutes: false };
    const only = (...scopes: string[]) => ({ ...NONE, ...Object.fromEntries(scopes.map((s) => [s, true])) });

    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    // Merges the file into a stored island that holds the item at Off and the effect at 0, under the given selection.
    async function merged(page: Page, text: string, selection: Record<string, boolean>, f: number): Promise<Record<string, any>> {
        return page.evaluate(
            ({ t, s, f, item, effect }) => {
                const ex = window.exchange;
                const full = ex.planImport(t);
                if ('error' in full) throw new Error(full.error);
                const stored = { Test: JSON.stringify({ session: 3245, [f + '[' + item + '].scaling']: 0, ['island.effect.' + effect + '.scaling']: 0 }) };
                const m = ex.mergeScoped(stored, full, s as never, [{ fileId: 'x', calcName: 'Test', by: 'name' }]);
                return JSON.parse(m.keyMap['Test']);
            },
            { t: text, s: selection, f, item: HEROIC_ITEM, effect: HEROIC_EFFECT },
        );
    }

    test('Modifiers ticked: the effect is 1; unticked or with only Residences: effect and item state stay as stored', async ({ page }) => {
        const f = await factoryOf(page, HEROIC_ITEM);
        const text = fileOf([{ id: 'x', name: 'Test', session: LATIUM, factories: { [f]: { items: [{ item: HEROIC_ITEM }] } } }]);
        const itemKey = f + '[' + HEROIC_ITEM + '].scaling';

        const modifiers = await merged(page, text, only('modifiers'), f);
        expect(modifiers[effectKey(HEROIC_EFFECT)]).toBe(1);
        expect(modifiers[itemKey]).toBe(1);

        const production = await merged(page, text, only('production'), f);
        expect(production[effectKey(HEROIC_EFFECT)]).toBe(0);
        expect(production[itemKey]).toBe(0);

        const residences = await merged(page, text, only('residences'), f);
        expect(residences[effectKey(HEROIC_EFFECT)]).toBe(0);
        expect(residences[itemKey]).toBe(0);
    });

    test('a file that states the effect with value 0 keeps 0 with Modifiers ticked', async ({ page }) => {
        const f = await factoryOf(page, HEROIC_ITEM);
        const text = fileOf([{ id: 'x', name: 'Test', session: LATIUM, factories: { [f]: { items: [{ item: HEROIC_ITEM }] } }, effects: { [HEROIC_EFFECT]: 0 } }]);
        const modifiers = await merged(page, text, only('modifiers'), f);
        expect(modifiers[effectKey(HEROIC_EFFECT)]).toBe(0);
        expect(modifiers[f + '[' + HEROIC_ITEM + '].scaling']).toBe(1);
    });
});
