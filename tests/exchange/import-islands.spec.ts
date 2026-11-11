import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// U5: import plan for island-scope data (key map, orphans, report, exchange.ext). Pure function, no storage writes.

const FIXTURES = path.join(__dirname, '..', '..', 'vendor', 'anno117-exchange', 'fixtures');

function fixtureText(file: string): string {
    return fs.readFileSync(path.join(FIXTURES, file), 'utf-8');
}

// Real GUIDs of js/params.js
const LATIUM = 3245;
const LIBERTI = 1499;
const PLEBEIANS = 1496;
const WADERS = 1500;
const WADER_RESIDENCE = 6414;
const FISH_NEED = 2665; // Liberti need
const WINE = 2690; // DLC 3 need
const SOAP = 2770; // DLC 3 need
const SAWMILL = 3089;
const BOOSTABLE_ITEM = 50890; // has boostBuffs; targets factory 3070
const BOOSTABLE_FACTORY = 3070;
const PLAIN_ITEM = 96819; // no boostBuffs; targets sawmill 3089
const DLC1_ITEM = 144850; // dlc 67902 (DLC01_Prophecies_of_Ash); targets factory 2694
const DLC1_FACTORY = 2694;
const SHEEP_FARM = 2786;
const PIG_FARM = 2793;
const HORSE_BREEDER = 2794;
const SILO = 77954;
const FERT_ROMAN_A = 2206; // Roman only
const FERT_ROMAN_B = 4051; // Roman only
const FERT_CELTIC = 2214; // Celtic only
const MYTH_A = 166439; // mythical-item effect, no DLC
const MYTH_B = 166441;
const MYTH_DLC3 = 185132; // mythical-item effect, dlc 67904 (DLC03_Dawn_of_Delta)

interface Entry { kind: string; code: string; island?: string; message: string; detail?: Record<string, any> }
interface IslandPlan {
    id: string;
    name: string;
    key: string;
    store: Record<string, any>;
    ext: Record<string, any>;
    report: Entry[];
}
interface Plan {
    islands: IslandPlan[];
    orphans: { id: string; session?: number; island: Record<string, any> }[];
    report: Entry[];
    settingsKeys: Record<string, string>;
    document: { account?: any; unlocatedItems?: any };
}

async function ready(page: Page) {
    await page.goto('/');
    await page.waitForFunction(() => window.view && window.view.island() && window.exchange);
}

function doc(islands: Record<string, any>[], extra: Record<string, any> = {}): string {
    return JSON.stringify({
        format: 'anno117-exchange',
        formatVersion: '1.0',
        generator: { name: 'u5-test' },
        ...extra,
        islands,
    });
}

async function plan(page: Page, text: string): Promise<Plan> {
    return page.evaluate((t: string) => {
        const ex = window.exchange;
        const r = ex.readExchange(t);
        if ('error' in r) throw new Error(r.error);
        return ex.planIslands(r);
    }, text);
}

async function planOne(page: Page, island: Record<string, any>, extra: Record<string, any> = {}): Promise<IslandPlan> {
    const p = await plan(page, doc([{ id: 'x', name: 'Test', session: LATIUM, ...island }], extra));
    expect(p.islands.length).toBe(1);
    return p.islands[0];
}

function codes(entries: Entry[]): string[] {
    return entries.map((e) => e.code);
}

function keysMatching(store: Record<string, any>, re: RegExp): string[] {
    return Object.keys(store).filter((k) => re.test(k));
}

test.describe('import plan: islands (U5)', () => {
    test.beforeEach(async ({ page }) => {
        await ready(page);
    });

    test('planIslands is registered and creates no storage', async ({ page }) => {
        const before = await page.evaluate(() => localStorage.length);
        await plan(page, doc([{ id: 'a', name: 'Fresh', session: LATIUM }]));
        const after = await page.evaluate(() => ({ n: localStorage.length, fresh: localStorage.getItem('Fresh') }));
        expect(after.fresh).toBeNull();
        expect(after.n).toBe(before);
    });

    test('identity: session, island id, gameConnector as real numbers, store key equals unique name', async ({ page }) => {
        const p = await plan(
            page,
            doc([
                { id: 'i1', name: 'Latium 5', session: LATIUM, gameIsland: { sessionGuid: LATIUM, islandId: 77, areaIndex: 2, areaKey: 9, name: 'Game Name' } },
                { id: 'i2', name: 'Latium 5', session: LATIUM },
                { id: 'i3', name: 'tradeRoutes', session: LATIUM },
            ]),
        );
        const [a, b, c] = p.islands;
        expect(a.key).toBe('Latium 5');
        expect(a.name).toBe('Latium 5');
        expect(a.store['session']).toBe(LATIUM);
        expect(a.store['exchange.islandId']).toBe('i1');
        expect(a.store['gameConnector.islandID']).toBe(77);
        expect(a.store['gameConnector.areaIndex']).toBe(2);
        expect(typeof a.store['gameConnector.islandID']).toBe('number');
        expect(a.ext.gameIsland).toEqual({ areaKey: 9, name: 'Game Name' });
        // CD3, KTD6: collisions and reserved names get a suffix, the original name stays in ext
        expect(b.key).toBe('Latium 5 (2)');
        expect(b.ext.originalName).toBe('Latium 5');
        expect(c.key).toBe('tradeRoutes (2)');
        expect(codes(c.report)).toContain('name-changed');
    });

    test('island name falls back to gameIsland.name, then to the id', async ({ page }) => {
        const p = await plan(
            page,
            doc([
                { id: 'g1', session: LATIUM, gameIsland: { sessionGuid: LATIUM, islandId: 1, areaIndex: 0, name: 'From Game' } },
                { id: 'only-id', session: LATIUM },
            ]),
        );
        expect(p.islands[0].name).toBe('From Game');
        expect(p.islands[1].name).toBe('only-id');
        expect(p.islands[1].store['gameConnector.islandID']).toBeUndefined();
    });

    test('an island with session 99999 becomes an orphan and no store is created', async ({ page }) => {
        const p = await plan(
            page,
            doc([
                { id: 'later', name: 'Later Region', session: 99999, buildings: { [SAWMILL]: { built: 2 } } },
                { id: 'ok', name: 'Ok', session: LATIUM },
            ]),
        );
        expect(p.islands.map((i) => i.id)).toEqual(['ok']);
        expect(p.orphans.length).toBe(1);
        expect(p.orphans[0].id).toBe('later');
        expect(p.orphans[0].session).toBe(99999);
        expect(p.orphans[0].island.buildings[SAWMILL].built).toBe(2);
        const entry = p.report.find((e) => e.code === 'orphan-island');
        expect(entry?.island).toBe('later');
        // the orphan's name does not take a store key
        const q = await plan(page, doc([{ id: 'later', name: 'Same', session: 99999 }, { id: 'ok', name: 'Same', session: LATIUM }]));
        expect(q.islands[0].key).toBe('Same');
    });

    test('an island without a session gets no session key and a not-provided line', async ({ page }) => {
        const p = await plan(page, fixtureText('valid/minimal-third-party.json'));
        expect(p.islands.length).toBe(1);
        expect(p.islands[0].store['session']).toBeUndefined();
        expect(codes(p.islands[0].report)).toContain('session-not-provided');
        expect(p.orphans).toEqual([]);
    });

    test('buildings: constructed, planned, fullyUtilize as "1"/"0" only when stated; counts are numbers', async ({ page }) => {
        const i = await planOne(page, {
            buildings: {
                [SAWMILL]: { built: 4 },
                3091: { built: 2, planned: 5, fullyUtilize: false },
                3129: { built: 1, fullyUtilize: true },
            },
        });
        expect(i.store[`${SAWMILL}.buildings.constructed`]).toBe(4);
        expect(typeof i.store[`${SAWMILL}.buildings.constructed`]).toBe('number');
        // an absent flag on a construction-material end factory means on: no key (R50, AE21)
        expect(i.store[`${SAWMILL}.buildings.fullyUtilizeConstructed`]).toBeUndefined();
        expect(i.store[`${SAWMILL}.buildings.planned`]).toBeUndefined();
        expect(i.store['3091.buildings.planned']).toBe(5);
        expect(i.store['3091.buildings.fullyUtilizeConstructed']).toBe('0');
        expect(i.store['3129.buildings.fullyUtilizeConstructed']).toBe('1');
    });

    test('an absent fullyUtilize on a construction-material end factory and a module building gets no key', async ({ page }) => {
        const i = await planOne(page, { buildings: { [SAWMILL]: { built: 3 }, [SILO]: { built: 1 } } });
        expect(keysMatching(i.store, /fullyUtilize/)).toEqual([]);
    });

    test('disabled needs of Cinis write "0" for the listed need only (AE22)', async ({ page }) => {
        const i = await planOne(page, { name: 'Cinis', disabledNeeds: { [LIBERTI]: [FISH_NEED] } });
        expect(i.store[`${LIBERTI}[${FISH_NEED}].checked`]).toBe('0');
        expect(keysMatching(i.store, /\.checked$/)).toEqual([`${LIBERTI}[${FISH_NEED}].checked`]);
        expect(codes(i.report)).not.toContain('disabled-needs-not-provided');
    });

    test('a need of a DLC that is off: no key by default, "0" when the file lists it (KTD8)', async ({ page }) => {
        const p = await plan(page, fixtureText('valid/disabled-needs-new-dlc.json'));
        const [a, b] = p.islands;
        // wine and soap are not listed: no key, so they are on after the DLC toggle
        expect(a.store[`${PLEBEIANS}[${WINE}].checked`]).toBeUndefined();
        expect(keysMatching(a.store, /\.checked$/)).toEqual([`${LIBERTI}[${FISH_NEED}].checked`]);
        expect(keysMatching(b.store, /\.checked$/)).toEqual([]);
        // a listed need of that DLC is written as "0"
        const c = await planOne(page, { disabledNeeds: { [PLEBEIANS]: [WINE, SOAP] } });
        expect(c.store[`${PLEBEIANS}[${WINE}].checked`]).toBe('0');
        expect(c.store[`${PLEBEIANS}[${SOAP}].checked`]).toBe('0');
        // an empty object is not "not provided"; an absent key is
        expect(codes(b.report)).not.toContain('disabled-needs-not-provided');
        const d = await planOne(page, {});
        expect(codes(d.report)).toContain('disabled-needs-not-provided');
    });

    test('notes on a residence building and needNotes land under their storage keys', async ({ page }) => {
        const i = await planOne(page, {
            notes: { [WADER_RESIDENCE]: 'near the coast' },
            needNotes: { [LIBERTI]: { [FISH_NEED]: 'no fish here' } },
        });
        expect(i.store[`${WADER_RESIDENCE}.notes`]).toBe('near the coast');
        expect(i.store[`${LIBERTI}[${FISH_NEED}].notes`]).toBe('no fish here');
    });

    test('94 Wader residences by building and 129 by level: 94 is applied, the difference is reported (AE9)', async ({ page }) => {
        const i = await planOne(page, {
            session: 6627,
            buildings: { [WADER_RESIDENCE]: { built: 94 } },
            residencesByLevel: { [WADERS]: 129 },
        });
        expect(i.store[`${WADER_RESIDENCE}.buildings.constructed`]).toBe(94);
        const e = i.report.find((x) => x.code === 'residence-count-difference');
        expect(e).toBeTruthy();
        expect(e!.kind).toBe('approximated');
        expect(e!.detail).toMatchObject({ level: WADERS, building: WADER_RESIDENCE, byBuilding: 94, byLevel: 129 });
    });

    test('only residencesByLevel (129) writes constructed on the level residence building (F1)', async ({ page }) => {
        const i = await planOne(page, { session: 6627, residencesByLevel: { [WADERS]: 129 } });
        expect(i.store[`${WADER_RESIDENCE}.buildings.constructed`]).toBe(129);
        expect(codes(i.report)).not.toContain('residence-count-difference');
        // equal counts: no difference line
        const j = await planOne(page, { session: 6627, buildings: { [WADER_RESIDENCE]: { built: 129 } }, residencesByLevel: { [WADERS]: 129 } });
        expect(j.store[`${WADER_RESIDENCE}.buildings.constructed`]).toBe(129);
        expect(codes(j.report)).not.toContain('residence-count-difference');
    });

    test('fertilities: absent list writes no keys and is reported as not provided (AE8)', async ({ page }) => {
        const i = await planOne(page, {});
        expect(keysMatching(i.store, /^island\.fertility\./)).toEqual([]);
        const e = i.report.find((x) => x.code === 'fertilities-not-provided');
        expect(e?.kind).toBe('not-provided');
        expect(e!.detail!.guids).toContain(FERT_ROMAN_A);
        expect(e!.detail!.guids).not.toContain(FERT_CELTIC);
    });

    test('fertilitiesComplete false unchecks only the listed false one; true unchecks every absent one', async ({ page }) => {
        const a = await planOne(page, { fertilities: { [FERT_ROMAN_A]: false, [FERT_ROMAN_B]: true }, fertilitiesComplete: false });
        expect(a.store[`island.fertility.${FERT_ROMAN_A}.checked`]).toBe('0');
        expect(a.store[`island.fertility.${FERT_ROMAN_B}.checked`]).toBe('1');
        expect(keysMatching(a.store, /^island\.fertility\./).length).toBe(2);
        expect(codes(a.report)).toContain('fertilities-not-provided');

        const b = await planOne(page, { fertilities: { [FERT_ROMAN_B]: true }, fertilitiesComplete: true });
        expect(b.store[`island.fertility.${FERT_ROMAN_B}.checked`]).toBe('1');
        expect(b.store[`island.fertility.${FERT_ROMAN_A}.checked`]).toBe('0');
        // fertilities of another region are not touched
        expect(b.store[`island.fertility.${FERT_CELTIC}.checked`]).toBeUndefined();
        expect(codes(b.report)).not.toContain('fertilities-not-provided');
    });

    test('patron and devotion are written as given; a fraction is reported as truncated (R16)', async ({ page }) => {
        const a = await planOne(page, { patron: 80562, devotion: 64980 });
        expect(a.store['selectedPatron']).toBe('80562');
        expect(a.store['devotion']).toBe(64980);
        expect(typeof a.store['devotion']).toBe('number');
        expect(codes(a.report)).not.toContain('devotion-truncated');

        const b = await planOne(page, { devotion: 12.75 });
        expect(b.store['devotion']).toBe(12.75);
        const e = b.report.find((x) => x.code === 'devotion-truncated');
        expect(e?.kind).toBe('approximated');
        expect(e!.detail).toMatchObject({ value: 12.75, loaded: 12 });
    });

    test('items: boosted writes 2 for an item with boostBuffs, listed 1, unlisted no key (R48)', async ({ page }) => {
        const i = await planOne(page, {
            factories: {
                [BOOSTABLE_FACTORY]: { items: [{ item: BOOSTABLE_ITEM, boosted: true }] },
                [SAWMILL]: { items: [{ item: PLAIN_ITEM }] },
            },
        });
        expect(i.store[`${BOOSTABLE_FACTORY}[${BOOSTABLE_ITEM}].scaling`]).toBe(2);
        expect(typeof i.store[`${BOOSTABLE_FACTORY}[${BOOSTABLE_ITEM}].scaling`]).toBe('number');
        expect(i.store[`${SAWMILL}[${PLAIN_ITEM}].scaling`]).toBe(1);
        expect(codes(i.report)).not.toContain('item-boost-approximated');
        const j = await planOne(page, { factories: { [BOOSTABLE_FACTORY]: { items: [{ item: BOOSTABLE_ITEM, boosted: false }] } } });
        expect(j.store[`${BOOSTABLE_FACTORY}[${BOOSTABLE_ITEM}].scaling`]).toBe(1);
    });

    test('a boosted item without boostBuffs is written 1 and reported as approximated (KTD16)', async ({ page }) => {
        const i = await planOne(page, { factories: { [SAWMILL]: { items: [{ item: PLAIN_ITEM, boosted: true }] } } });
        expect(i.store[`${SAWMILL}[${PLAIN_ITEM}].scaling`]).toBe(1);
        const e = i.report.find((x) => x.code === 'item-boost-approximated');
        expect(e?.kind).toBe('approximated');
        expect(e!.detail).toMatchObject({ factory: SAWMILL, item: PLAIN_ITEM });
    });

    test('a factory entry that lists one item writes only that item; a factory without an entry gets no keys (R48)', async ({ page }) => {
        const i = await planOne(page, {
            buildings: { [SAWMILL]: { built: 1 }, 3091: { built: 1 } },
            factories: { [SAWMILL]: { items: [{ item: PLAIN_ITEM }] } },
        });
        expect(keysMatching(i.store, /\]\.scaling$/)).toEqual([`${SAWMILL}[${PLAIN_ITEM}].scaling`]);
        expect(keysMatching(i.store, /^3091(\.|\[)(?!buildings)/)).toEqual([]);
    });

    test('factory effects, aqueduct and modules map to their keys with the storage value types', async ({ page }) => {
        const i = await planOne(page, {
            factories: {
                2200: { effects: [51795], aqueduct: true },
                [SHEEP_FARM]: { modules: { [SILO]: true } },
                [PIG_FARM]: { modules: { [SILO]: false } },
            },
        });
        expect(i.store['2200[51795].scaling']).toBe(1);
        expect(i.store['2200.aqueductBuff.checked']).toBe(1);
        expect(i.store[`${SHEEP_FARM}.module[${SILO}].checked`]).toBe('1');
        expect(i.store[`${PIG_FARM}.module[${SILO}].checked`]).toBe('0');
        const off = await planOne(page, { factories: { 2200: { aqueduct: false } } });
        expect(off.store['2200.aqueductBuff.checked']).toBe(0);
    });

    test('three farms with a silo attachment on one: type-level keys, attachment kept, reported (KTD14, AE25)', async ({ page }) => {
        const attachment = { building: SHEEP_FARM, instance: 501, module: SILO, moduleInstance: 9001 };
        const i = await planOne(page, {
            buildings: { [SHEEP_FARM]: { built: 3 } },
            factories: { [SHEEP_FARM]: { modules: { [SILO]: true } }, [PIG_FARM]: { modules: { [SILO]: false } }, [HORSE_BREEDER]: {} },
            moduleAttachments: [attachment],
        });
        expect(i.store[`${SHEEP_FARM}.module[${SILO}].checked`]).toBe('1');
        expect(i.store[`${PIG_FARM}.module[${SILO}].checked`]).toBe('0');
        expect(keysMatching(i.store, new RegExp(`^${HORSE_BREEDER}\\.module`))).toEqual([]);
        const kept = i.ext.captured.find((c: Record<string, any>) => c.pointer === '/moduleAttachments');
        expect(kept.value).toEqual([attachment]);
        expect(i.ext.moduleWritten).toEqual({
            [`${SHEEP_FARM}.module[${SILO}].checked`]: '1',
            [`${PIG_FARM}.module[${SILO}].checked`]: '0',
        });
        const e = i.report.find((x) => x.code === 'module-attachments-per-instance');
        expect(e?.kind).toBe('not-mapped');
        expect(e!.detail).toMatchObject({ count: 1 });
    });

    test('island effects are written as given, a DLC-gated effect is reported', async ({ page }) => {
        const i = await planOne(page, { effects: { 155616: 1 } });
        expect(i.store['island.effect.155616.scaling']).toBe(1);
        const dlc = i.report.find((x) => x.code === 'dlc-enabled' && x.detail?.dlc === 'DLC03_Dawn_of_Delta');
        expect(dlc).toBeTruthy();
    });

    test('unknown building GUID and unknown effect are kept in exchange.ext with their location (AE18)', async ({ page }) => {
        const p = await plan(page, fixtureText('valid/unknown-guids.json'));
        expect(p.orphans.map((o) => o.id)).toEqual(['later-region']);
        const i = await planOne(page, {
            buildings: { 999002: { built: 3, planned: 1 }, [SAWMILL]: { built: 1 } },
            effects: { 999003: 1 },
            fertilities: { 999007: true },
            factories: { 999008: { items: [{ item: 999009, boosted: true }] }, [SAWMILL]: { items: [{ item: 999010 }] } },
        });
        expect(keysMatching(i.store, /999/)).toEqual([]);
        const byPointer = (ptr: string) => i.ext.guids.find((g: Record<string, any>) => g.pointer === ptr);
        expect(byPointer('/buildings/999002').value).toEqual({ built: 3, planned: 1 });
        expect(byPointer('/effects/999003').value).toBe(1);
        expect(byPointer('/fertilities/999007').value).toBe(true);
        expect(byPointer('/factories/999008').value).toEqual({ items: [{ item: 999009, boosted: true }] });
        expect(byPointer(`/factories/${SAWMILL}/items/0`).value).toEqual({ item: 999010 });
        expect(i.store[`${SAWMILL}.buildings.constructed`]).toBe(1);
        const lines = i.report.filter((x) => x.code === 'unknown-guid');
        expect(lines.length).toBe(5);
        expect(lines.every((x) => x.kind === 'carried-through')).toBe(true);
        expect(lines.map((x) => x.detail!.pointer)).toContain('/buildings/999002');
    });

    test('unknown fields and unmodelled keys of an island go to exchange.ext with report lines', async ({ page }) => {
        const p = await plan(page, fixtureText('valid/unknown-fields-everywhere.json'));
        const isl = p.islands[0];
        const pointers: string[] = isl.ext.captured.map((c: Record<string, any>) => c.pointer);
        expect(pointers.length).toBeGreaterThan(0);
        expect(pointers.every((q) => q.startsWith('/'))).toBe(true);
        expect(pointers.every((q) => !q.startsWith('/islands/'))).toBe(true);
        expect(codes(isl.report)).toContain('unknown-field');
        const j = await planOne(page, { population: { [LIBERTI]: 250 }, harbour: { x: 1 }, mystery: { a: 1 } });
        const pop = j.ext.captured.find((c: Record<string, any>) => c.pointer === '/population');
        expect(pop.value).toEqual({ [LIBERTI]: 250 });
        expect(pop.kind).toBe('unmodelled');
        expect(j.ext.captured.find((c: Record<string, any>) => c.pointer === '/mystery').kind).toBe('unknown');
        const e = j.report.filter((x) => x.code === 'unmodelled-key').map((x) => x.detail!.pointer);
        expect(e).toEqual(expect.arrayContaining(['/population', '/harbour']));
        expect(j.report.find((x) => x.code === 'unmodelled-key')!.kind).toBe('not-mapped');
    });

    test('item records of every island place are preserved and counted per place (R56)', async ({ page }) => {
        const p = await plan(page, fixtureText('valid/item-locations.json'));
        const i = p.islands[0];
        const holders = i.ext.captured.find((c: Record<string, any>) => c.pointer === '/itemHolders');
        const storage = i.ext.captured.find((c: Record<string, any>) => c.pointer === '/itemStorage');
        expect(holders.value.length).toBe(3);
        expect(storage.value.length).toBe(5);
        expect(holders.value[0].items[0].ext['savegame-writer'].EffectID).toBe(77);
        const byPlace = (code: string, place: string) => i.report.find((x) => x.code === code && x.detail?.place === place);
        expect(byPlace('item-records', 'itemHolders.items')!.detail).toMatchObject({ records: 3 });
        expect(byPlace('item-records', 'itemHolders.carried')!.detail).toMatchObject({ records: 2 });
        expect(byPlace('item-records', 'itemStorage')!.detail).toMatchObject({ records: 5, quantity: 11 });
        expect(byPlace('item-records', 'itemStorage')!.kind).toBe('carried-through');
        // document-scope places are surfaced, not interpreted
        expect(p.document.account).toBeTruthy();
        expect(p.document.unlocatedItems).toBeTruthy();
        expect(p.report.some((x) => x.code === 'item-records' && x.detail?.place === 'unlocatedItems')).toBe(true);
        // item possession is not application
        expect(keysMatching(i.store, /\]\.scaling$/)).toEqual([]);
    });

    test('mythicEffect of a socketed building item with boostConditionMet true sets the island effect to 1 (KTD16)', async ({ page }) => {
        const i = await planOne(page, {
            itemHolders: [
                {
                    guid: 91001,
                    instance: 1,
                    items: [
                        { item: 51328, instance: 10, slot: 0, mythicEffect: MYTH_A, boostConditionMet: true },
                        { item: 51330, instance: 11, slot: 1, mythicEffect: MYTH_B, boostConditionMet: false },
                    ],
                },
            ],
        });
        expect(i.store[`island.effect.${MYTH_A}.scaling`]).toBe(1);
        // every other mythical effect the file knows is reset to 0
        expect(i.store[`island.effect.${MYTH_B}.scaling`]).toBe(0);
        // unrelated mythical effects the file does not mention get no key
        expect(i.store[`island.effect.${MYTH_DLC3}.scaling`]).toBeUndefined();
        // the item records stay verbatim
        expect(i.ext.captured.find((c: Record<string, any>) => c.pointer === '/itemHolders').value[0].items.length).toBe(2);
    });

    test('mythicEffect without boostConditionMet true is not applied', async ({ page }) => {
        const i = await planOne(page, {
            itemHolders: [{ guid: 91001, instance: 1, items: [{ item: 51328, instance: 10, mythicEffect: MYTH_A }] }],
        });
        expect(i.store[`island.effect.${MYTH_A}.scaling`]).toBe(0);
    });

    test('a ship holder mythicEffect is preserved and reported as not applied', async ({ page }) => {
        const i = await planOne(page, {
            itemHolders: [
                { kind: 'ship', guid: 91002, instance: 2, route: 'r1', items: [{ item: 51292, instance: 12, mythicEffect: MYTH_A, boostConditionMet: true }] },
            ],
        });
        expect(i.store[`island.effect.${MYTH_A}.scaling`]).toBe(0);
        const e = i.report.find((x) => x.code === 'mythic-ship-not-applied');
        expect(e?.kind).toBe('not-mapped');
        expect(e!.detail).toMatchObject({ effect: MYTH_A });
        expect(i.ext.captured.find((c: Record<string, any>) => c.pointer === '/itemHolders').value[0].items[0].mythicEffect).toBe(MYTH_A);
    });

    test('island effects[E] sets the same key and the larger value wins', async ({ page }) => {
        const a = await planOne(page, {
            effects: { [MYTH_A]: 1 },
            itemHolders: [{ guid: 91001, instance: 1, items: [{ item: 51328, instance: 10, mythicEffect: MYTH_A, boostConditionMet: false }] }],
        });
        expect(a.store[`island.effect.${MYTH_A}.scaling`]).toBe(1);
        const b = await planOne(page, {
            effects: { [MYTH_A]: 0 },
            itemHolders: [{ guid: 91001, instance: 1, items: [{ item: 51328, instance: 10, mythicEffect: MYTH_A, boostConditionMet: true }] }],
        });
        expect(b.store[`island.effect.${MYTH_A}.scaling`]).toBe(1);
        const c = await planOne(page, {
            effects: { [MYTH_A]: 3 },
            itemHolders: [{ guid: 91001, instance: 1, items: [{ item: 51328, instance: 10, mythicEffect: MYTH_A, boostConditionMet: true }] }],
        });
        expect(c.store[`island.effect.${MYTH_A}.scaling`]).toBe(3);
    });

    test('an applied mythicEffect of a DLC-gated effect writes the DLC key and reports it', async ({ page }) => {
        const p = await plan(
            page,
            doc([
                {
                    id: 'd',
                    name: 'D',
                    session: LATIUM,
                    itemHolders: [{ guid: 91001, instance: 1, items: [{ item: 51328, instance: 10, mythicEffect: MYTH_DLC3, boostConditionMet: true }] }],
                },
            ]),
        );
        expect(p.settingsKeys['DLC03_Dawn_of_Delta']).toBe('1');
        expect(p.islands[0].store[`island.effect.${MYTH_DLC3}.scaling`]).toBe(1);
        const e = p.islands[0].report.find((x) => x.code === 'dlc-enabled' && x.detail?.dlc === 'DLC03_Dawn_of_Delta');
        expect(e).toBeTruthy();
        // no applied DLC effect: no key
        const q = await plan(page, doc([{ id: 'd', name: 'D', session: LATIUM }]));
        expect(q.settingsKeys).toEqual({});
    });

    test('an unknown mythicEffect GUID is kept in the record and reported', async ({ page }) => {
        const i = await planOne(page, {
            itemHolders: [{ guid: 91001, instance: 1, items: [{ item: 51328, instance: 10, mythicEffect: 999777, boostConditionMet: true }] }],
        });
        expect(keysMatching(i.store, /999777/)).toEqual([]);
        expect(i.report.some((x) => x.code === 'unknown-guid' && x.detail?.guid === 999777)).toBe(true);
        expect(i.ext.captured.find((c: Record<string, any>) => c.pointer === '/itemHolders').value[0].items[0].mythicEffect).toBe(999777);
    });

    test('an item scaling on a DLC-gated item reports the DLC switched on at load', async ({ page }) => {
        const p = await plan(page, doc([{ id: 'x', name: 'X', session: LATIUM, factories: { [DLC1_FACTORY]: { items: [{ item: DLC1_ITEM }] } } }]));
        const i = p.islands[0];
        expect(i.store[`${DLC1_FACTORY}[${DLC1_ITEM}].scaling`]).toBe(1);
        const e = i.report.find((x) => x.code === 'dlc-enabled' && x.detail?.dlc === 'DLC01_Prophecies_of_Ash');
        expect(e).toBeTruthy();
        // switched on by the item at load (DLC.used), so no settings key is written here
        expect(p.settingsKeys).toEqual({});
    });

    test('valid fixtures plan without throwing', async ({ page }) => {
        for (const f of ['valid/cinis-sawmill.json', 'valid/third-party-buildings.json', 'valid/newer-minor.json', 'valid/history-and-live.json']) {
            const p = await plan(page, fixtureText(f));
            expect(p.islands.length + p.orphans.length, f).toBeGreaterThan(0);
        }
        const c = await plan(page, fixtureText('valid/cinis-sawmill.json'));
        expect(c.islands[0].store[`${SAWMILL}.buildings.constructed`]).toBe(4);
        expect(c.islands[0].key).toBe('Cinis');
    });
});
