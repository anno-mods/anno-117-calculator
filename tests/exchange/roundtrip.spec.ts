import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
    appReady,
    collectErrors,
    exportDoc,
    fileOf,
    importText,
    Json,
    openApp,
    reportEntries,
    settle,
    summaryByName,
    summaryDifferences,
    validateSchema,
    vendoredFixture,
} from '../helpers/exchange';

// U12: integration scenarios of the exchange feature. The import runs through planImport + applyImport(reload:false) and a
// page reload (the helper keeps the imported state, see tests/helpers/exchange.ts); the old dump import runs through the
// real #config-selector input.

const LATIUM = 3245;
const AEGYPTUS = 149679;
const SAWMILL = 3089;
const WOOD = 2077;
const BREAD = 2137;
const BAKERY = 3174; // Latium bakery, not a construction material factory
const WADER_RESIDENCE = 3087;
const SARDINES = 2088;
const DLC3 = 'DLC03_Dawn_of_Delta';
const DLC3_GUID = 67904;
const DATES_FARM = 152272; // Egyptian factory of DLC 3
const MYTH_DLC3 = 185132; // mythical-item effect gated by DLC 3
const MYTH_PLAIN = 166439; // mythical-item effect without DLC
const WINE_NEED = 2690; // DLC 3 need
const SOAP_NEED = 2770; // DLC 3 need
const GOLD = 31698;
const GOLDSMITH = 152358;

const OLD_DUMP = path.join(__dirname, '..', 'fixtures', 'Anno117CalculatorConfig.json');
// The Marcia 69 dump of the repository anno-117-savegame-exchange-format (not part of this repository).
const MARCIA = path.resolve(
    process.env.ANNO_EXCHANGE_REPO ?? path.join(__dirname, '..', '..', '..', 'anno-117-savegame-exchange-format'),
    'data',
    'processed',
    'calculator_configs',
    'Marcia 69 updated.json',
);

/** Loads a config dump through the old import path (#config-selector) and waits for the reload. */
async function oldImport(page: Page, file: string): Promise<void> {
    await page.evaluate(() => {
        (window as any).__beforeOldImport = true;
    });
    await page.setInputFiles('#config-selector', file);
    await page.waitForFunction(() => {
        const w = window as any;
        return !w.__beforeOldImport && w.view && w.view.island && w.view.island() && w.exchange;
    }, undefined, { timeout: 120000 });
}

async function exportAndReimport(page: Page): Promise<Json> {
    const { document } = await exportDoc(page);
    expect(validateSchema(document), JSON.stringify(validateSchema.errors?.slice(0, 5))).toBe(true);
    const res = await importText(page, JSON.stringify(document));
    expect(res.error, 'import of the own export').toBeUndefined();
    return document;
}

test.describe('integration: Cinis, trade floor, DLC and needs', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    test('4 Cinis sawmills require 8 t/min Wood (AE21)', async ({ page }) => {
        const errors = collectErrors(page);
        const text = vendoredFixture('valid/cinis-sawmill.json');
        const expected = JSON.parse(text).ext.conformance.expect;
        expect(expected).toMatchObject({ product: WOOD, demandPerMinute: 8, sawmills: 4 });
        const res = await importText(page, text);
        expect(res.ok, res.error).toBe(true);
        await settle(page);
        const v = await page.evaluate(
            ({ sawmill, wood }) => {
                const isl = (window as any).view.islands().find((i: any) => i.name() === 'Cinis');
                const f = isl.assetsMap.get(sawmill);
                return {
                    built: f.buildings.constructed(),
                    utilized: f.buildings.utilized(),
                    fully: f.buildings.fullyUtilizeConstructed(),
                    woodDemand: isl.assetsMap.get(wood).totalDemand(),
                };
            },
            { sawmill: SAWMILL, wood: WOOD },
        );
        expect(v.built).toBe(4);
        expect(v.fully).toBe(true);
        expect(v.utilized).toBe(4);
        expect(v.woodDemand).toBeCloseTo(8, 6);
        expect(errors).toEqual([]);
    });

    test('a default route with amount above the demand: the import is the amount, the surplus is excess production (R54, KTD9)', async ({ page }) => {
        const island = (id: string, name: string, extra: Json = {}) => ({ id, name, session: LATIUM, ...extra });
        const entry = (suppliers: Json[], basis: string) => ({ imports: [{ island: 'b', product: SARDINES, basis, suppliers }] });
        const read = () =>
            page.evaluate((guid: number) => {
                const isl = (window as any).view.islands().find((i: any) => i.name() === 'B');
                const p = isl.assetsMap.get(guid);
                return { demand: p.totalDemand(), imported: p.tradeList.outputAmount(), excess: p.excessProduction() };
            }, SARDINES);

        // Without an amount the route supplies exactly the demand.
        const plain = fileOf([island('a', 'A'), island('b', 'B', { buildings: { [WADER_RESIDENCE]: { built: 100 } } })], {
            trade: entry([{ island: 'a', default: true, share: 1 }], 'planned'),
        });
        expect((await importText(page, plain)).ok).toBe(true);
        await settle(page);
        const base = await read();
        expect(base.demand).toBeGreaterThan(0);
        expect(base.imported).toBeCloseTo(base.demand, 6);
        expect(base.excess).toBeCloseTo(0, 6);

        // An entered amount is a floor under the supplier's import; the part above the demand is excess production.
        const amount = Math.ceil(base.demand) + 6;
        const floor = fileOf([island('a', 'A'), island('b', 'B', { buildings: { [WADER_RESIDENCE]: { built: 100 } } })], {
            trade: entry([{ island: 'a', default: true, amount }], 'entered'),
        });
        expect((await importText(page, floor)).ok).toBe(true);
        await settle(page);
        const withFloor = await read();
        expect(withFloor.imported).toBeCloseTo(amount, 6);
        expect(withFloor.demand).toBeCloseTo(base.demand, 6);
        expect(withFloor.excess).toBeCloseTo(amount - base.demand, 6);
    });

    test('a local producer left partly utilized stays so through a round trip although the good is received (R51)', async ({ page }) => {
        const text = fileOf(
            [
                { id: 'a', name: 'A', session: LATIUM },
                { id: 'b', name: 'B', session: LATIUM, buildings: { [BAKERY]: { built: 2, fullyUtilize: false }, [WADER_RESIDENCE]: { built: 100 } } },
            ],
            { trade: { imports: [{ island: 'b', product: BREAD, basis: 'planned', suppliers: [{ island: 'a', default: true, share: 1 }] }] } },
        );
        expect((await importText(page, text)).ok).toBe(true);
        // The user state without the key: the sawmill is not fully utilized by default.
        await page.evaluate((key: string) => {
            const store = JSON.parse(localStorage.getItem('B') as string);
            delete store[key];
            localStorage.setItem('B', JSON.stringify(store));
        }, `${BAKERY}.buildings.fullyUtilizeConstructed`);
        await page.reload();
        await appReady(page);
        const before = await summaryByName(page);
        const { document } = await exportDoc(page);
        const b = (document.islands as Json[]).find((i) => i.id === 'b')!;
        expect(b.buildings[String(BAKERY)]).toMatchObject({ built: 2, fullyUtilize: false });
        expect((await importText(page, JSON.stringify(document))).ok).toBe(true);
        expect(summaryDifferences(before, await summaryByName(page))).toEqual([]);
    });

    test('a DLC switched on after import turns the unlisted needs on and keeps a listed need off (AE22)', async ({ page }) => {
        // Find the population levels that carry the two DLC 3 needs.
        const levels = await page.evaluate(
            ({ wine, soap }) => {
                const isl = (window as any).view.island();
                const find = (g: number) => isl.populationLevels.find((l: any) => l.needs.some((n: any) => n.need.guid === g))?.guid as number | undefined;
                return { wine: find(wine), soap: find(soap) };
            },
            { wine: WINE_NEED, soap: SOAP_NEED },
        );
        expect(levels.wine, 'level of the wine need').toBeTruthy();
        expect(levels.soap, 'level of the soap need').toBeTruthy();

        // DLC 3 is off in the file (settings.dlcs lists 1 and 2); the soap need is listed as disabled, the wine need is not.
        const text = fileOf([{ id: 'a', name: 'Alpha', session: LATIUM, disabledNeeds: { [levels.soap as number]: [SOAP_NEED] } }], {
            settings: { dlcs: [1, 2] },
        });
        expect((await importText(page, text)).ok).toBe(true);
        await settle(page);
        const read = () =>
            page.evaluate(
                ({ wine, soap, dlc }) => {
                    const w = window as any;
                    const isl = w.view.islands().find((i: any) => i.name() === 'Alpha');
                    const need = (g: number) => {
                        for (const l of isl.populationLevels) {
                            const n = l.needs.find((x: any) => x.need.guid === g);
                            if (n) return { available: Boolean(n.available()), checked: Boolean(n.checked()) };
                        }
                        return null;
                    };
                    return { dlcOn: Boolean(w.view.dlcsGuidMap.get(dlc).checked()), wine: need(wine), soap: need(soap) };
                },
                { wine: WINE_NEED, soap: SOAP_NEED, dlc: DLC3_GUID },
            );
        const off = await read();
        expect(off.dlcOn).toBe(false);
        expect(off.wine?.available).toBe(false);

        await page.evaluate((dlc: number) => {
            (window as any).view.dlcsGuidMap.get(dlc).checked(true);
        }, DLC3_GUID);
        await settle(page);
        const on = await read();
        expect(on.dlcOn).toBe(true);
        expect(on.wine).toEqual({ available: true, checked: true });
        expect(on.soap).toEqual({ available: true, checked: false });
    });

    test('a file without settings.dlcs and a count for a DLC 3 building enables the DLC at load and the report names it', async ({ page }) => {
        const text = fileOf([{ id: 'nile', name: 'Nile', session: AEGYPTUS, buildings: { [DATES_FARM]: { built: 2 } } }]);
        const res = await importText(page, text);
        expect(res.ok, res.error).toBe(true);
        expect(JSON.parse(res.plan!.keyMap['calculatorSettings'] ?? '{}')[DLC3]).toBeUndefined();
        await settle(page);
        expect(await page.evaluate((d: number) => (window as any).view.dlcsGuidMap.get(d).checked(), DLC3_GUID)).toBe(true);
        const named = reportEntries(res.plan!).find((e) => e.code === 'dlc-enabled' && e.detail?.dlc === DLC3);
        expect(named, 'the report names the DLC').toBeTruthy();
    });

    test('a mythical effect of a building holder item is applied, the effect DLC is on and the report names it (KTD16)', async ({ page }) => {
        const holders = [
            {
                guid: 91001,
                instance: 1,
                items: [
                    { item: 51328, instance: 10, slot: 0, mythicEffect: MYTH_DLC3, boostConditionMet: true },
                    { item: 51330, instance: 11, slot: 1, mythicEffect: MYTH_PLAIN, boostConditionMet: false },
                ],
            },
            { kind: 'ship', guid: 91002, instance: 2, carried: [{ item: 51328, instance: 12, mythicEffect: 166441, boostConditionMet: true }] },
        ];
        const res = await importText(page, fileOf([{ id: 'a', name: 'Alpha', session: LATIUM, itemHolders: holders }]));
        expect(res.ok, res.error).toBe(true);
        await settle(page);
        const v = await page.evaluate(
            ({ dlcEffect, plainEffect, shipEffect, dlc }) => {
                const w = window as any;
                const isl = w.view.islands().find((i: any) => i.name() === 'Alpha');
                const store = JSON.parse(localStorage.getItem('Alpha') as string);
                return {
                    dlcScaling: isl.assetsMap.get(dlcEffect).scaling(),
                    plainScaling: isl.assetsMap.get(plainEffect).scaling(),
                    shipScaling: isl.assetsMap.get(shipEffect).scaling(),
                    dlcOn: w.view.dlcsGuidMap.get(dlc).checked(),
                    settings: JSON.parse(localStorage.getItem('calculatorSettings') as string),
                    dlcKey: store[`island.effect.${dlcEffect}.scaling`],
                };
            },
            { dlcEffect: MYTH_DLC3, plainEffect: MYTH_PLAIN, shipEffect: 166441, dlc: DLC3_GUID },
        );
        expect(v.dlcScaling).toBe(1);
        expect(v.dlcKey).toBe(1);
        expect(v.plainScaling).toBe(0); // boostConditionMet false: nothing set
        expect(v.shipScaling).toBe(0); // ship holder: preserved, not applied
        expect(v.dlcOn).toBe(true);
        expect(Number(v.settings[DLC3])).toBe(1);
        const entries = reportEntries(res.plan!);
        expect(entries.some((e) => e.code === 'dlc-enabled' && e.detail?.dlc === DLC3)).toBe(true);
        // the records stay unchanged
        const { document } = await exportDoc(page);
        expect((document.islands as Json[]).find((i) => i.id === 'a')!.itemHolders).toEqual(holders);
    });
});

test.describe('integration: preserved data', () => {
    test.beforeEach(async ({ page }) => {
        await openApp(page);
    });

    test('history, live and minimumStock survive import and export unchanged (AE11, AE20)', async ({ page }) => {
        const original = JSON.parse(vendoredFixture('valid/history-and-live.json'));
        original.islands[0].minimumStock = { 2137: 12 };
        expect((await importText(page, JSON.stringify(original))).ok).toBe(true);
        const first = await exportDoc(page);
        expect(first.document.history).toEqual(original.history);
        expect(first.document.live).toEqual(original.live);
        expect((first.document.islands as Json[]).find((i) => i.id === 'i1')!.minimumStock).toEqual({ 2137: 12 });
        // a second pass changes nothing either
        expect((await importText(page, JSON.stringify(first.document))).ok).toBe(true);
        const second = await exportDoc(page);
        expect(second.document.history).toEqual(original.history);
        expect((second.document.islands as Json[]).find((i) => i.id === 'i1')!.minimumStock).toEqual({ 2137: 12 });
        expect(second.report.filter((r) => /dropped|pruned/.test(r.code))).toEqual([]);
    });

    test('item records of the item-locations fixture survive; a repeated instance id is reported and every record kept (AE26)', async ({ page }) => {
        const original = JSON.parse(vendoredFixture('valid/item-locations.json'));
        const res = await importText(page, JSON.stringify(original));
        expect(res.ok, res.error).toBe(true);
        const { document } = await exportDoc(page);
        for (const oi of original.islands as Json[]) {
            const isl = (document.islands as Json[]).find((i) => i.id === oi.id)!;
            expect(isl.itemHolders).toEqual(oi.itemHolders);
            expect(isl.itemStorage).toEqual(oi.itemStorage);
        }
        expect(document.account).toEqual(original.account);
        expect(document.unlocatedItems).toEqual(original.unlocatedItems);
        // Several records of one item GUID are in the fixture; every place is counted in the report.
        const places = reportEntries(res.plan!).filter((e) => e.code === 'item-records').map((e) => e.detail?.place);
        expect(places).toContain('itemStorage');

        // A repeated instance id: problem entry, all records kept.
        const dup = JSON.parse(JSON.stringify(original));
        const storage = (dup.islands as Json[]).find((i) => Array.isArray(i.itemStorage) && i.itemStorage.length)!;
        const clone = { ...storage.itemStorage[0] };
        if (clone.instance === undefined) clone.instance = 424242;
        storage.itemStorage.push(clone);
        storage.itemStorage[0].instance = clone.instance;
        const res2 = await importText(page, JSON.stringify(dup));
        expect(res2.ok, res2.error).toBe(true);
        expect((res2.plan!.problems as Json[]).some((p) => p.code === 'duplicate-instance')).toBe(true);
        const again = await exportDoc(page);
        const kept = (again.document.islands as Json[]).find((i) => i.id === storage.id)!;
        expect(kept.itemStorage).toEqual(storage.itemStorage);
    });
});

test.describe('integration: old dump', () => {
    test('the old import path loads the sample dump unchanged (regression)', async ({ page }) => {
        const errors = collectErrors(page);
        await openApp(page);
        await oldImport(page, OLD_DUMP);
        const dump = JSON.parse(fs.readFileSync(OLD_DUMP, 'utf-8')) as Record<string, string>;
        const names = JSON.parse(dump['islandNames']) as string[];
        const state = await page.evaluate(() => {
            const w = window as any;
            return {
                islands: w.view.islands().map((i: any) => i.name()),
                keys: Object.keys(localStorage),
                version: localStorage.getItem('versionCalculator'),
                exchangeKeys: Object.keys(localStorage).filter((k) => k.startsWith('exchange.')),
            };
        });
        for (const n of names) expect(state.islands, n).toContain(n);
        for (const k of Object.keys(dump)) expect(state.keys, k).toContain(k);
        // the old import knows nothing of the exchange format: no exchange.* key is written by it
        expect(state.exchangeKeys.filter((k) => k !== 'exchange.islandId')).toEqual([]);
        expect(errors).toEqual([]);
    });

    test('the old sample dump keeps every computed value through export and import', async ({ page }) => {
        test.setTimeout(180000);
        const errors = collectErrors(page);
        await openApp(page);
        await oldImport(page, OLD_DUMP);
        const before = await summaryByName(page);
        expect(Object.keys(before).length).toBeGreaterThan(0);
        const document = await exportAndReimport(page);
        expect((document.islands as Json[]).length).toBe(Object.keys(before).length);
        const after = await summaryByName(page);
        expect(summaryDifferences(before, after)).toEqual([]);
        // The second pass is stable as well.
        await exportAndReimport(page);
        expect(summaryDifferences(before, await summaryByName(page))).toEqual([]);
        expect(errors).toEqual([]);
    });
});

test.describe('integration: Marcia 69 sample game', () => {
    test.skip(!fs.existsSync(MARCIA), `Marcia 69 updated.json not found at ${MARCIA}; set ANNO_EXCHANGE_REPO to the repository anno-117-savegame-exchange-format`);

    test('the Marcia 69 game loads through the exchange format; the Listening Weasel Nome Gold pair keeps import 0 and local output 4.8 t/min (R51)', async ({ page }) => {
        test.setTimeout(300000);
        const errors = collectErrors(page);
        await openApp(page);
        await oldImport(page, MARCIA);

        const gold = () =>
            page.evaluate(
                ({ product, factory }) => {
                    const isl = (window as any).view.islands().find((i: any) => i.name() === 'Listening Weasel Nome');
                    const f = isl.assetsMap.get(factory);
                    const p = isl.assetsMap.get(product);
                    return {
                        built: f.buildings.constructed(),
                        fully: f.buildings.fullyUtilizeConstructed(),
                        localOutput: f.outputAmount(),
                        imported: p.tradeList.outputAmount(),
                    };
                },
                { product: GOLD, factory: GOLDSMITH },
            );
        await settle(page);
        const dump = await gold();
        expect(dump.built).toBe(4);
        expect(Boolean(dump.fully)).toBe(true);
        expect(dump.localOutput).toBeCloseTo(4.8, 2);
        expect(dump.imported).toBeCloseTo(0, 6);

        const before = await summaryByName(page);
        const document = await exportAndReimport(page);
        // every island of the dump (22 game islands and the user's "Monument Demand" island) is exported
        expect((document.islands as Json[]).length).toBe(Object.keys(before).length);

        await settle(page);
        const exchange = await gold();
        expect(exchange.localOutput).toBeCloseTo(4.8, 2);
        expect(exchange.imported).toBeCloseTo(0, 6);
        expect(Boolean(exchange.fully)).toBe(true);
        expect(summaryDifferences(before, await summaryByName(page))).toEqual([]);
        expect(errors).toEqual([]);
        await appReady(page);
    });
});
