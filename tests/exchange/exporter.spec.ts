import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import Ajv2020 from 'ajv/dist/2020';
import { seedOnce, appReady } from '../helpers/exchange';

// U9: the exporter. Every scenario that needs state loads a file through planImport + applyImport (reload false) and
// a page reload (seedOnce keeps the imported state), then exports from the reloaded app.

const VENDOR = path.join(__dirname, '..', '..', 'vendor', 'anno117-exchange');
const FIXTURES = path.join(VENDOR, 'fixtures', 'valid');
const LATIUM = 3245;
const ALBION = 6627;
const SAWMILL = 3089;
const TIMBER = 2174;
const FARM = 2786; // Roman factory with module 77954
const FARM_MODULE = 77954;
const WADER_RESIDENCE = 3087; // population level 1499
const NEED_LEVEL = 1499;
const BREAD = 2689;

type Json = Record<string, any>;

const schema = JSON.parse(fs.readFileSync(path.join(VENDOR, 'schema', 'anno117-exchange.schema.json'), 'utf-8'));
const ajv = new Ajv2020({ strict: false, allErrors: true });
const validateSchema = ajv.compile(schema);

function fixture(name: string): string {
    return fs.readFileSync(path.join(FIXTURES, name), 'utf-8');
}

function fileOf(islands: Json[], extra: Json = {}): string {
    return JSON.stringify({ format: 'anno117-exchange', formatVersion: '1.0', generator: { name: 'u9-test' }, islands, ...extra });
}

// Storage writes are debounced with setTimeout(0); wait until they are flushed.
async function settle(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((r) => setTimeout(() => setTimeout(r, 30), 30)));
}

async function open(page: Page): Promise<void> {
    await seedOnce(page);
    await page.goto('/');
    await appReady(page);
}

// Imports a file without reload, then reloads the page so the app runs on the imported state.
async function load(page: Page, text: string): Promise<{ ok: boolean; error?: string; report?: Json }> {
    await settle(page);
    const res = await page.evaluate((t: string) => {
        const ex = window.exchange;
        const plan = ex.planImport(t);
        if ('error' in plan) return { ok: false, error: plan.error };
        const r = ex.applyImport(plan, { reload: false });
        return { ok: r.ok, error: r.error, report: plan.report };
    }, text);
    if (res.ok) {
        await page.reload();
        await appReady(page);
    }
    return res;
}

async function exportDoc(page: Page): Promise<{ document: Json; report: Json[] }> {
    await settle(page);
    return page.evaluate(() => window.exchange.exportDocument());
}

// Parsed-document equality of the plan: generator.version, source and computed excluded; island names are compared
// as given (both documents come from one exporter, which writes the suffixed names).
function normalize(doc: Json): Json {
    const copy = JSON.parse(JSON.stringify(doc));
    if (copy.generator) delete copy.generator.version;
    delete copy.source;
    delete copy.computed;
    return copy;
}

async function roundTrip(page: Page, text: string): Promise<{ e1: Json; e2: Json; r1: Json[]; r2: Json[] }> {
    const first = await load(page, text);
    expect(first.error, 'first import').toBeUndefined();
    const a = await exportDoc(page);
    const second = await load(page, JSON.stringify(a.document));
    expect(second.error, 'second import').toBeUndefined();
    const b = await exportDoc(page);
    return { e1: a.document, e2: b.document, r1: a.report, r2: b.report };
}

async function readerAccepts(page: Page, doc: Json): Promise<{ error?: string; problems: Json[] }> {
    return page.evaluate((d: Json) => {
        const r = window.exchange.readExchange(JSON.stringify(d));
        return 'error' in r ? { error: r.error, problems: [] } : { problems: r.problems };
    }, doc);
}

function expectValid(doc: Json): void {
    const ok = validateSchema(doc);
    expect(ok, JSON.stringify(validateSchema.errors?.slice(0, 5))).toBe(true);
}

function islandByName(doc: Json, name: string): Json {
    const isl = (doc.islands as Json[]).find((i) => i.name === name);
    expect(isl, `island ${name}`).toBeTruthy();
    return isl as Json;
}

test.describe('exporter (U9)', () => {
    test.beforeEach(async ({ page }) => {
        await open(page);
    });

    test('buildDocument and exportDocument are registered; generator, source, no timestamp', async ({ page }) => {
        const r = await page.evaluate(() => {
            const ex = window.exchange;
            return { build: typeof ex.buildDocument, exp: typeof ex.exportDocument, doc: ex.buildDocument() };
        });
        expect(r.build).toBe('function');
        expect(r.exp).toBe('function');
        expect(r.doc.format).toBe('anno117-exchange');
        expect(r.doc.formatVersion).toBe('1.0');
        expect(r.doc.generator.name).toBe('anno117-calculator');
        expect(typeof r.doc.generator.version).toBe('string');
        expect(r.doc.source).toEqual({ kind: 'tool' });
        expect(JSON.stringify(r.doc)).not.toMatch(/saveTime|timestamp/);
        expect(r.doc.islands).toEqual([]);
        expectValid(r.doc);
    });

    test('the All Islands aggregate is never exported as an island and its store is kept in ext.calculator', async ({ page }) => {
        const res = await load(page, fileOf([{ id: 'a', name: 'Alpha', session: LATIUM }]));
        expect(res.ok).toBe(true);
        const { document } = await exportDoc(page);
        expect((document.islands as Json[]).map((i) => i.name)).toEqual(['Alpha']);
        expect(JSON.stringify(document.islands)).not.toContain('All Islands');
    });

    test('empty disabledNeeds object when no need is off; only "0" keys are listed', async ({ page }) => {
        await load(page, fileOf([{ id: 'a', name: 'Alpha', session: LATIUM }, { id: 'b', name: 'Beta', session: LATIUM, disabledNeeds: { [NEED_LEVEL]: [BREAD] } }]));
        const { document } = await exportDoc(page);
        expect(islandByName(document, 'Alpha').disabledNeeds).toEqual({});
        expect(islandByName(document, 'Beta').disabledNeeds).toEqual({ [NEED_LEVEL]: [BREAD] });
    });

    test('a stored "0" need key of an unknown GUID is listed too', async ({ page }) => {
        await load(page, fileOf([{ id: 'a', name: 'Alpha', session: LATIUM }]));
        await page.evaluate(() => {
            const s = JSON.parse(localStorage.getItem('Alpha') as string);
            s['1499[999777].checked'] = '0';
            s['1499[2665].checked'] = '1';
            localStorage.setItem('Alpha', JSON.stringify(s));
        });
        await page.reload();
        await appReady(page);
        const { document } = await exportDoc(page);
        expect(islandByName(document, 'Alpha').disabledNeeds).toEqual({ [NEED_LEVEL]: [999777] });
    });

    test('Cinis sample exports built 4 and fullyUtilize true (R50)', async ({ page }) => {
        await load(page, fixture('cinis-sawmill.json'));
        const { document } = await exportDoc(page);
        const cinis = (document.islands as Json[])[0];
        expect(cinis.buildings[String(SAWMILL)]).toEqual({ built: 4, fullyUtilize: true });
        expectValid(document);
    });

    test('notes on a residence building and a need note survive the round trip (F1)', async ({ page }) => {
        const text = fileOf([
            {
                id: 'a',
                name: 'Alpha',
                session: LATIUM,
                buildings: { [WADER_RESIDENCE]: { built: 94 } },
                notes: { [WADER_RESIDENCE]: 'residence note' },
                needNotes: { [NEED_LEVEL]: { [BREAD]: 'bread note' } },
                products: { [TIMBER]: { notes: 'timber note' } },
            },
        ]);
        const { e1, e2 } = await roundTrip(page, text);
        const isl = islandByName(e1, 'Alpha');
        expect(isl.notes).toEqual({ [WADER_RESIDENCE]: 'residence note' });
        expect(isl.needNotes).toEqual({ [NEED_LEVEL]: { [BREAD]: 'bread note' } });
        expect(isl.products[String(TIMBER)].notes).toBe('timber note');
        expect(normalize(e2)).toEqual(normalize(e1));
    });

    test('unknown fields at document and island level, a need note and a collapsed panel survive twice (AE1)', async ({ page }) => {
        const text = fileOf(
            [
                {
                    id: 'a',
                    name: 'Alpha',
                    session: LATIUM,
                    unknownIslandKey: { keep: 'island' },
                    needNotes: { [NEED_LEVEL]: { [BREAD]: 'note' } },
                    ext: { other: { private: [1, 2, 3] }, calculator: { collapsed: { 'panel-1': true } } },
                },
            ],
            {
                futureDocumentField: { keep: 'document' },
                settings: { dlcs: [1], map: { size: 3 } },
                ext: { other: { doc: true }, calculator: { collapsibleStates: { 'panel-x': 1 } } },
            },
        );
        const { e1, e2 } = await roundTrip(page, text);
        for (const e of [e1, e2]) {
            expect(e.futureDocumentField).toEqual({ keep: 'document' });
            expect(e.settings.map).toEqual({ size: 3 });
            expect(e.ext.other).toEqual({ doc: true });
            expect(e.ext.calculator.collapsibleStates).toMatchObject({ 'panel-x': 1 });
            const isl = islandByName(e, 'Alpha');
            expect(isl.unknownIslandKey).toEqual({ keep: 'island' });
            expect(isl.needNotes).toEqual({ [NEED_LEVEL]: { [BREAD]: 'note' } });
            expect(isl.ext.other).toEqual({ private: [1, 2, 3] });
            expect(isl.ext.calculator.collapsed).toEqual({ 'panel-1': true });
        }
        expect(normalize(e2)).toEqual(normalize(e1));
    });

    test('missing island ids are assigned and stay stable across two exports', async ({ page }) => {
        await settle(page);
        await page.evaluate(() => {
            const view = window.view;
            view.islandManager.showIslandOnCreation.checked(false);
            const session = view.sessions.find((s: Record<string, any>) => s.region.id === 'Roman');
            view.islandManager.create('Fresh One', session);
            view.islandManager.create('Fresh Two', session);
        });
        const a = await exportDoc(page);
        const b = await exportDoc(page);
        const ids = (a.document.islands as Json[]).map((i) => i.id);
        expect(ids).toHaveLength(2);
        for (const id of ids) expect(id).toMatch(/^[0-9a-f]{16}$/);
        expect(new Set(ids).size).toBe(2);
        expect((b.document.islands as Json[]).map((i) => i.id)).toEqual(ids);
        await page.reload();
        await appReady(page);
        const c = await exportDoc(page);
        expect((c.document.islands as Json[]).map((i) => i.id)).toEqual(ids);
        expectValid(c.document);
    });

    test('an island named like a reserved key exports as a valid file', async ({ page }) => {
        await load(page, fileOf([{ id: 'a', name: 'tradeRoutes', session: LATIUM, buildings: { [SAWMILL]: { built: 1 } } }]));
        const { document } = await exportDoc(page);
        expect((document.islands as Json[])[0].name).toBe('tradeRoutes (2)');
        expectValid(document);
        expect((await readerAccepts(page, document)).error).toBeUndefined();
    });

    test('unknown region island, unknown building count and unknown effect scale come back at their places (AE18)', async ({ page }) => {
        const text = fixture('unknown-guids.json');
        const original = JSON.parse(text);
        const { e1, e2 } = await roundTrip(page, text);
        // orphan island of the unknown session comes back as an islands[] record
        const orphanOriginal = (original.islands as Json[]).find((i) => i.session === 999001) as Json;
        const orphan = (e1.islands as Json[]).find((i) => i.id === orphanOriginal.id) as Json;
        expect(orphan).toEqual(orphanOriginal);
        // unknown building 999002 and effect 999003 on a known island sit at their original pointers
        const knownOriginal = (original.islands as Json[]).find((i) => i.session !== 999001 && i.buildings && i.buildings['999002']) as Json;
        if (knownOriginal) {
            const known = (e1.islands as Json[]).find((i) => i.id === knownOriginal.id) as Json;
            expect(known.buildings['999002']).toEqual(knownOriginal.buildings['999002']);
            if (knownOriginal.effects && knownOriginal.effects['999003'] !== undefined) expect(known.effects['999003']).toBe(knownOriginal.effects['999003']);
        }
        expect(normalize(e2)).toEqual(normalize(e1));
        expectValid(e1);
    });

    test('an island deleted in the app leaves no data in the export; a rename keeps preserved data (AE2, KTD15)', async ({ page }) => {
        await load(page, fixture('island-deletion-before.json'));
        await settle(page);
        // rename isl-a
        await page.evaluate(() => {
            const view = window.view;
            const isl = view.islands().find((i: Record<string, any>) => i.name() === 'Latium 5');
            view.islandManager.islandNameInput('Latium Five');
            view.islandManager.rename(isl, 'Latium Five');
        });
        const renamed = await exportDoc(page);
        const a = (renamed.document.islands as Json[]).find((i) => i.id === 'isl-a') as Json;
        expect(a.name).toBe('Latium Five');
        expect(a.unknownIslandKey).toEqual({ keep: 'a' });
        expect(a.needNotes).toEqual({ [NEED_LEVEL]: { [BREAD]: 'bread note' } });
        expect(renamed.document.trade.visits).toHaveLength(2);
        expect(JSON.stringify(renamed.document)).toContain('isl-b');

        // delete isl-b
        await page.evaluate(() => {
            const view = window.view;
            const isl = view.islands().find((i: Record<string, any>) => i.name() === 'Albion 2');
            view.islandManager.delete(isl);
        });
        const { document } = await exportDoc(page);
        const text = JSON.stringify(document);
        expect(text).not.toContain('isl-b');
        expect(text).not.toContain('only island B');
        expect(text).not.toContain('"keep":"b"');
        expect((document.islands as Json[]).map((i) => i.id).sort()).toEqual(['isl-a', 'isl-c']);
        expect(document.trade.visits).toEqual([{ route: 'r1', island: 'isl-a', trader: 'player', goods: { '151680': 10 } }]);
        expect(document.trade.routes[0].stations).toHaveLength(1);
        expect(document.history).toHaveLength(1);
        expect(Object.keys(document.live.islands)).toEqual(['isl-a']);
        const entries = document.trade.imports as Json[];
        for (const e of entries) {
            expect(e.island).not.toBe('isl-b');
            for (const s of e.suppliers ?? []) expect(s.island).not.toBe('isl-b');
        }
        expect(document.ext.other).toBeUndefined();
        // the calculator's own block is regenerated from its state; the file's foreign darkMode value is a device preference
        expect(document.ext.calculator).toBeTruthy();
        expectValid(document);
    });

    test('governor goods and a non-player supplier survive; a changed default drops the non-player supplier (CD10, R52)', async ({ page }) => {
        const NPC = 'npc-7';
        const text = fileOf(
            [
                { id: 'a', name: 'Alpha', session: LATIUM, buildings: { [SAWMILL]: { built: 2 } } },
                { id: 'b', name: 'Beta', session: LATIUM },
            ],
            {
                trade: {
                    governorHarbours: [{ governor: 7001, ext: { x: 1 } }],
                    imports: [
                        { island: 'b', product: TIMBER, suppliers: [{ governor: 7001, amount: 3, default: true }, { island: 'a', share: 1 }] },
                        { island: 'b', product: 2137, suppliers: [{ island: NPC, share: 1 }] },
                        { island: 'b', product: 2138, suppliers: [{ governor: 7002, amount: 1.5 }] },
                    ],
                },
            },
        );
        await load(page, text);
        const a = await exportDoc(page);
        const imports = a.document.trade.imports as Json[];
        const governorEntry = imports.find((e) => e.product === TIMBER) as Json;
        expect(governorEntry).toEqual((JSON.parse(text).trade.imports as Json[])[0]);
        expect(imports.find((e) => e.product === 2137)).toEqual((JSON.parse(text).trade.imports as Json[])[1]);
        expect(imports.find((e) => e.product === 2138)).toEqual((JSON.parse(text).trade.imports as Json[])[2]);
        expect(a.document.trade.governorHarbours).toEqual([{ governor: 7001, ext: { x: 1 } }]);
        expect(a.report.filter((r) => /dropped/.test(r.code))).toEqual([]);

        // after another import cycle the same holds
        await load(page, JSON.stringify(a.document));
        const b = await exportDoc(page);
        expect(normalize(b.document)).toEqual(normalize(a.document));

        // the user changes the default supplier of the non-player product to a factory
        await page.evaluate(() => {
            const view = window.view;
            const isl = view.islands().find((i: Record<string, any>) => i.name() === 'Beta');
            const product = isl.assetsMap.get(2137);
            product.defaultSupplier(product.factories[0]);
        });
        const c = await exportDoc(page);
        const after = c.document.trade.imports as Json[];
        expect(after.find((e) => e.product === 2137)).toBeUndefined();
        expect(JSON.stringify(c.document)).not.toContain(NPC);
        expect(c.report.some((r) => r.code === 'import-entry-dropped' && r.detail && r.detail.product === 2137)).toBe(true);
        // the governor goods are unaffected
        expect(after.find((e) => e.product === 2138)).toBeTruthy();
    });

    test('an edited supplier exports the edited value, not the stale preserved copy (AE3)', async ({ page }) => {
        const text = fileOf(
            [
                { id: 'roma', name: 'Roma', session: LATIUM },
                { id: 'tib', name: 'Tiberia', session: LATIUM },
                { id: 'ost', name: 'Ostia', session: LATIUM },
            ],
            { trade: { imports: [{ island: 'ost', product: TIMBER, suppliers: [{ island: 'roma', default: true }, { governor: 7001, amount: 2 }] }] } },
        );
        await load(page, text);
        const before = await exportDoc(page);
        expect((before.document.trade.imports as Json[])[0].suppliers).toContainEqual({ governor: 7001, amount: 2 });
        await page.evaluate(() => {
            const routes = JSON.parse(localStorage.getItem('tradeRoutes') as string);
            for (const r of routes) if (r.from === 'Roma') r.from = 'Tiberia';
            localStorage.setItem('tradeRoutes', JSON.stringify(routes));
        });
        await page.reload();
        await appReady(page);
        const after = await exportDoc(page);
        const entry = (after.document.trade.imports as Json[]).find((e) => e.product === TIMBER) as Json;
        expect(entry.suppliers).toEqual([{ island: 'tib', default: true }]);
        expect(JSON.stringify(after.document.trade)).not.toContain('"roma"');
        expect(after.report.some((r) => r.code === 'import-entry-dropped')).toBe(true);
    });

    test('a default route with an amount, a zero-minimum alternative and a local producer survive export, import, export (R54, KTD9)', async ({ page }) => {
        const text = fileOf(
            [
                { id: 'a', name: 'Alpha', session: LATIUM },
                { id: 'c', name: 'Gamma', session: LATIUM },
                { id: 'b', name: 'Beta', session: LATIUM, buildings: { [SAWMILL]: { built: 2 } } },
            ],
            { trade: { imports: [{ island: 'b', product: TIMBER, basis: 'planned', suppliers: [{ island: 'a', share: 0.7, amount: 10 }, { island: 'c', share: 0.3 }] }] } },
        );
        const { e1, e2 } = await roundTrip(page, text);
        const entry = (e1.trade.imports as Json[])[0];
        expect(entry.island).toBe('b');
        expect(entry.basis).toBe('entered');
        expect(entry.suppliers).toEqual([{ island: 'a', default: true, amount: 10 }, { island: 'c' }]);
        expect(islandByName(e1, 'Beta').buildings[String(SAWMILL)]).toEqual({ built: 2, fullyUtilize: true });
        expect(normalize(e2)).toEqual(normalize(e1));
    });

    test('module attachments are exported while the module state is as imported, dropped after a toggle (KTD14, AE25)', async ({ page }) => {
        const attachments = [
            { building: FARM, instance: 11, module: FARM_MODULE, moduleInstance: 21 },
            { building: FARM, instance: 12, module: FARM_MODULE, moduleInstance: 22 },
        ];
        const text = fileOf([{ id: 'a', name: 'Alpha', session: LATIUM, buildings: { [FARM]: { built: 3 } }, factories: { [FARM]: { modules: { [FARM_MODULE]: true } } }, moduleAttachments: attachments }]);
        await load(page, text);
        const a = await exportDoc(page);
        expect(islandByName(a.document, 'Alpha').moduleAttachments).toEqual(attachments);
        expect(islandByName(a.document, 'Alpha').factories[String(FARM)].modules).toEqual({ [String(FARM_MODULE)]: true });
        expect(a.report.filter((r) => r.code === 'module-attachments-dropped')).toEqual([]);

        await page.evaluate(
            ([farm, mod]) => {
                const view = window.view;
                const isl = view.islands().find((i: Record<string, any>) => i.name() === 'Alpha');
                const m = isl.assetsMap.get(farm).modules.find((x: Record<string, any>) => x.guid === mod);
                m.checked(false);
            },
            [FARM, FARM_MODULE],
        );
        const b = await exportDoc(page);
        expect(islandByName(b.document, 'Alpha').moduleAttachments).toBeUndefined();
        expect(islandByName(b.document, 'Alpha').factories[String(FARM)].modules).toEqual({ [String(FARM_MODULE)]: false });
        expect(b.report.some((r) => r.code === 'module-attachments-dropped')).toBe(true);
    });

    test('items: number 1 listed unboosted, 2 boosted, 0 unlisted; item keys and effect keys are told apart by GUID', async ({ page }) => {
        // Favillus 50890 (boostable) and Smelters 51334 (no boost) target the Roman iron factory 3070; 152715 is a
        // building-sourced effect, which shares the key shape `<target>[<x>].scaling` with the items.
        const info = { boostable: 50890, plain: 51334, bf: 3070, pf: 3070, effect: 152715 };
        const factories: Json = { [info.bf]: { items: [{ item: info.boostable, boosted: true }, { item: info.plain }], effects: [info.effect] } };
        await load(page, fileOf([{ id: 'a', name: 'Alpha', session: LATIUM, factories }]));
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('Alpha') as string));
        expect(stored[`${info.bf}[${info.boostable}].scaling`]).toBe(2);
        const { document } = await exportDoc(page);
        const f = islandByName(document, 'Alpha').factories[String(info.bf)];
        expect(f.items).toContainEqual({ item: info.boostable, boosted: true });
        expect(f.effects).toEqual([info.effect]);
        expect(f.items.some((i: Json) => i.item === info.effect)).toBe(false);
        if (info.pf) {
            const p = islandByName(document, 'Alpha').factories[String(info.pf)];
            expect(p.items).toContainEqual({ item: info.plain });
        }
        // a stored 0 is unlisted
        await page.evaluate(
            ([f0, item]) => {
                const s = JSON.parse(localStorage.getItem('Alpha') as string);
                s[`${f0}[${item}].scaling`] = 0;
                localStorage.setItem('Alpha', JSON.stringify(s));
            },
            [info.bf, info.boostable],
        );
        await page.reload();
        await appReady(page);
        const again = await exportDoc(page);
        const f2 = islandByName(again.document, 'Alpha').factories[String(info.bf)];
        expect(f2.items).toEqual([{ item: info.plain }]);
    });

    test('settings, research and effects come from the effect stores; every stored scaling is exported (CD6, CD7)', async ({ page }) => {
        const text = fileOf([{ id: 'a', name: 'Alpha', session: LATIUM }], {
            settings: { dlcs: [1, 3], difficulty: { needConsumption: 'Medium' }, volcano: { level: 3, effects: [145095], phase: 'idle' }, seasons: { enabled: true } },
            research: { researched: [37870], counts: { '37870': 4 } },
            effects: { global: { '43620': 1 } },
        });
        const { e1, e2 } = await roundTrip(page, text);
        expect(e1.research.basis).toBe('applied');
        expect(e1.research.counts['37870']).toBe(4);
        expect(e1.research.researched).toContain(37870);
        expect(e1.effects.global['43620']).toBe(1);
        expect(e1.settings.dlcs).toEqual([1, 3]);
        expect(e1.settings.difficulty.needConsumption).toBe('Medium');
        expect(e1.settings.volcano).toMatchObject({ level: 3, effects: [145095], phase: 'idle' });
        expect(e1.settings.seasons.enabled).toBe(true);
        expect(e1.effects.bySession['3245']['145095']).toBe(3);
        expect(normalize(e2)).toEqual(normalize(e1));
        expectValid(e1);
    });

    test('export reads localStorage after pending debounced saves are flushed', async ({ page }) => {
        await load(page, fileOf([{ id: 'a', name: 'Alpha', session: LATIUM }]));
        await settle(page);
        const doc = await page.evaluate(
            ([guid]) => {
                const view = window.view;
                const isl = view.islands().find((i: Record<string, any>) => i.name() === 'Alpha');
                isl.assetsMap.get(guid).buildings.constructed(7); // saved debounced; exported in the same tick
                return window.exchange.buildDocument();
            },
            [SAWMILL],
        );
        expect(islandByName(doc, 'Alpha').buildings[String(SAWMILL)].built).toBe(7);
    });

    test('calculator-only state is written to ext.calculator and restored', async ({ page }) => {
        await load(page, fileOf([{ id: 'a', name: 'Alpha', session: LATIUM, buildings: { [WADER_RESIDENCE]: { built: 5 } } }]));
        await page.evaluate((guid) => {
            const s = JSON.parse(localStorage.getItem('Alpha') as string);
            s['passiveTrade.userSetAmount'] = 4.5;
            s[`${guid}.effectCoverage`] = '{"1":0.5}';
            localStorage.setItem('Alpha', JSON.stringify(s));
            localStorage.setItem('collapsibleStates', '{"panel-a":1,"panel-b":0}');
            localStorage.setItem('statisticsCollections', '{"collections":[],"active":{"collectionId":"all","checked":[]}}');
            const all = JSON.parse(localStorage.getItem('All Islands') ?? '{}');
            all['marker.key'] = 'all-islands-store';
            localStorage.setItem('All Islands', JSON.stringify(all));
            const cs = JSON.parse(localStorage.getItem('calculatorSettings') ?? '{}');
            cs['settings.showAllProducts'] = '1';
            localStorage.setItem('calculatorSettings', JSON.stringify(cs));
        }, WADER_RESIDENCE);
        await page.reload();
        await appReady(page);
        const a = await exportDoc(page);
        const calc = a.document.ext.calculator;
        expect(calc.collapsibleStates).toMatchObject({ 'panel-a': 1, 'panel-b': 0 });
        expect(calc.statisticsCollections.active.collectionId).toBe('all');
        expect(calc.allIslands['marker.key']).toBe('all-islands-store');
        expect(calc.settings['settings.showAllProducts']).toBe('1');
        expect(typeof calc.darkMode === 'boolean' || calc.darkMode === undefined).toBe(true);
        const isl = islandByName(a.document, 'Alpha');
        expect(isl.ext.calculator.store['passiveTrade.userSetAmount']).toBe(4.5);
        expect(isl.ext.calculator.store[`${WADER_RESIDENCE}.effectCoverage`]).toBe('{"1":0.5}');
        // import it back: the state returns
        await load(page, JSON.stringify(a.document));
        const stored = await page.evaluate(() => ({
            collapsible: localStorage.getItem('collapsibleStates'),
            all: JSON.parse(localStorage.getItem('All Islands') ?? '{}'),
            settings: JSON.parse(localStorage.getItem('calculatorSettings') ?? '{}'),
            alpha: JSON.parse(localStorage.getItem('Alpha') as string),
        }));
        expect(JSON.parse(stored.collapsible as string)).toMatchObject({ 'panel-a': 1, 'panel-b': 0 });
        expect(stored.all['marker.key']).toBe('all-islands-store');
        expect(stored.settings['settings.showAllProducts']).toBe('1');
        expect(stored.alpha['passiveTrade.userSetAmount']).toBe(4.5);
    });

    test('routes that name the aggregate are exported through ext.calculator and restored', async ({ page }) => {
        await load(page, fileOf([{ id: 'a', name: 'Alpha', session: LATIUM }, { id: 'b', name: 'Beta', session: LATIUM }]));
        await page.evaluate(() => {
            localStorage.setItem('tradeRoutes', JSON.stringify([{ productGUID: 2174, from: 'Alpha', to: 'All Islands', userSetAmount: 2, isDefaultSupplier: false }, { productGUID: 2174, from: 'Alpha', to: 'Beta', userSetAmount: 1, isDefaultSupplier: false }]));
        });
        await page.reload();
        await appReady(page);
        const a = await exportDoc(page);
        expect(a.document.ext.calculator.routes).toEqual([{ productGUID: 2174, from: 'Alpha', to: 'All Islands', userSetAmount: 2, isDefaultSupplier: false }]);
        const entries = a.document.trade.imports as Json[];
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ island: 'b', suppliers: [{ island: 'a', amount: 1 }] });
        await load(page, JSON.stringify(a.document));
        const routes = await page.evaluate(() => JSON.parse(localStorage.getItem('tradeRoutes') as string));
        expect(routes.some((r: Json) => r.to === 'All Islands' && r.userSetAmount === 2)).toBe(true);
    });

    test('exported files validate against the schema and the runtime reader for every vendored valid fixture', async ({ page }) => {
        test.setTimeout(180000);
        const files = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.json'));
        for (const f of files) {
            const res = await load(page, fixture(f));
            expect(res.error, f).toBeUndefined();
            const { document } = await exportDoc(page);
            expectValid(document);
            const read = await readerAccepts(page, document);
            expect(read.error, f).toBeUndefined();
            expect(read.problems, f).toEqual([]);
        }
    });
});

// The two-step round trip over the vendored valid fixtures: import, export, import, export; the two exports are equal.
test.describe('exporter round trip over the vendored fixtures (U9)', () => {
    const files = fs.readdirSync(FIXTURES).filter((f) => f.endsWith('.json'));
    for (const f of files) {
        test(`round trip ${f}`, async ({ page }) => {
            await open(page);
            const { e1, e2 } = await roundTrip(page, fixture(f));
            expect(normalize(e2)).toEqual(normalize(e1));
        });
    }
});

test.describe('exporter item records (U9, KTD16)', () => {
    test.beforeEach(async ({ page }) => {
        await open(page);
    });

    test('the item-locations fixture round trips with every item record unchanged (AE26, calculator half)', async ({ page }) => {
        const text = fixture('item-locations.json');
        const original = JSON.parse(text);
        const { e1, e2 } = await roundTrip(page, text);
        for (const e of [e1, e2]) {
            for (const oi of original.islands as Json[]) {
                const isl = (e.islands as Json[]).find((i) => i.id === oi.id) as Json;
                expect(isl.itemHolders).toEqual(oi.itemHolders);
                expect(isl.itemStorage).toEqual(oi.itemStorage);
            }
            expect(e.account).toEqual(original.account);
            expect(e.unlocatedItems).toEqual(original.unlocatedItems);
        }
        expect(normalize(e2)).toEqual(normalize(e1));
    });

    test('a mythical item effect of a building holder is exported as an island effect; item records stay (KTD16)', async ({ page }) => {
        const MYTH_A = 166439;
        const MYTH_B = 166441;
        const holders = [
            {
                guid: 91001,
                instance: 1,
                items: [
                    { item: 51328, instance: 10, slot: 0, mythicEffect: MYTH_A, boostConditionMet: true },
                    { item: 51330, instance: 11, slot: 1, mythicEffect: MYTH_B, boostConditionMet: false },
                ],
            },
            { kind: 'ship', guid: 91002, instance: 2, carried: [{ item: 51328, instance: 12, mythicEffect: 99999999 }] },
        ];
        await load(page, fileOf([{ id: 'a', name: 'Alpha', session: LATIUM, itemHolders: holders }]));
        const { document } = await exportDoc(page);
        const isl = islandByName(document, 'Alpha');
        expect(isl.effects[String(MYTH_A)]).toBe(1);
        expect(isl.effects[String(MYTH_B)]).toBe(0);
        expect(isl.itemHolders).toEqual(holders);
        // item records are never derived from factories and factories never from item records
        expect(isl.factories ?? {}).toEqual({});
        // the item-locations fixture keeps its building effect out of the effects (building-sourced, not mythical-item)
        const original = JSON.parse(fixture('item-locations.json'));
        await load(page, fixture('item-locations.json'));
        const again = await exportDoc(page);
        const oi = (original.islands as Json[])[0];
        expect(((again.document.islands as Json[]).find((i) => i.id === oi.id) as Json).itemHolders).toEqual(oi.itemHolders);
    });

    test('a 600-record itemStorage survives one building edit', async ({ page }) => {
        const storage: Json[] = [];
        for (let i = 0; i < 600; i++) storage.push({ item: 51316 + (i % 7), instance: 100000 + i, slot: i % 4 });
        const text = fileOf([{ id: 'a', name: 'Alpha', session: LATIUM, buildings: { [SAWMILL]: { built: 2 } }, itemStorage: storage }]);
        await load(page, text);
        await settle(page);
        await page.evaluate((guid) => {
            const view = window.view;
            const isl = view.islands().find((i: Record<string, any>) => i.name() === 'Alpha');
            isl.assetsMap.get(guid).buildings.constructed(5);
        }, SAWMILL);
        const { document } = await exportDoc(page);
        const isl = islandByName(document, 'Alpha');
        expect(isl.itemStorage).toEqual(storage);
        expect(isl.buildings[String(SAWMILL)].built).toBe(5);
    });

    test('deleting an island drops its itemHolders and itemStorage but keeps account and unlocatedItems', async ({ page }) => {
        const text = fileOf(
            [
                { id: 'a', name: 'Alpha', session: LATIUM, itemStorage: [{ item: 51316, instance: 1 }], itemHolders: [{ guid: 91001, instance: 5, items: [{ item: 51316, instance: 2, slot: 0 }] }] },
                { id: 'b', name: 'Beta', session: LATIUM, itemStorage: [{ item: 51317, instance: 3 }] },
            ],
            { account: { items: [{ item: 51316, instance: 4 }], transferItems: [51316], future: { x: 1 } }, unlocatedItems: [{ item: 51318, instance: 9 }] },
        );
        await load(page, text);
        await settle(page);
        await page.evaluate(() => {
            const view = window.view;
            view.islandManager.delete(view.islands().find((i: Record<string, any>) => i.name() === 'Alpha'));
        });
        const { document } = await exportDoc(page);
        const str = JSON.stringify(document.islands);
        expect(str).not.toContain('"instance":1}');
        expect((document.islands as Json[]).map((i) => i.id)).toEqual(['b']);
        expect(document.islands[0].itemStorage).toEqual([{ item: 51317, instance: 3 }]);
        expect(document.account).toEqual({ items: [{ item: 51316, instance: 4 }], transferItems: [51316], future: { x: 1 } });
        expect(document.unlocatedItems).toEqual([{ item: 51318, instance: 9 }]);
        expect(JSON.stringify(document)).not.toContain('91001');
    });
});
