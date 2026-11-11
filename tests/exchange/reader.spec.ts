import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES = path.join(__dirname, '..', '..', 'vendor', 'anno117-exchange', 'fixtures');

interface ManifestEntry {
    file: string;
    valid: boolean;
    class?: string;
    expect?: { code?: string; path?: string; keyword?: string };
}

const manifest: { fixtures: ManifestEntry[] } = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'MANIFEST.json'), 'utf-8'));

function fixtureText(file: string): string {
    return fs.readFileSync(path.join(FIXTURES, file), 'utf-8');
}

function fixtureJson(file: string): Record<string, unknown> {
    return JSON.parse(fixtureText(file));
}

// Result shapes as seen from the test (plain JSON that crossed page.evaluate).
interface UnknownField { pointer: string; value: unknown; scope: string; kind: string }
interface Problem { pointer: string; code: string; message: string }
interface ReadOk {
    doc: Record<string, any>;
    unknown: UnknownField[];
    problems: Problem[];
    computed?: unknown;
}
interface ReadErr { error: string; code: string }
type ReadOut = ReadOk | ReadErr;

async function read(page: Page, text: string): Promise<ReadOut> {
    return page.evaluate((t: string) => window.exchange.readExchange(t), text);
}

function asOk(r: ReadOut): ReadOk {
    expect('error' in r, JSON.stringify(r).slice(0, 300)).toBe(false);
    return r as ReadOk;
}

function asErr(r: ReadOut): ReadErr {
    expect('error' in r, 'expected an envelope error').toBe(true);
    return r as ReadErr;
}

test.describe('exchange reader (U4)', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.view && window.view.island());
    });

    test('newer major fails and names both versions; newer minor passes', async ({ page }) => {
        const doc = fixtureJson('valid/minimal-third-party.json');
        const err = asErr(await read(page, JSON.stringify({ ...doc, formatVersion: '2.0' })));
        expect(err.code).toBe('unsupported-major');
        expect(err.error).toContain('2.0');
        expect(err.error).toContain('1.0');
        asOk(await read(page, JSON.stringify({ ...doc, formatVersion: '1.7' })));
    });

    test('envelope errors: not JSON, wrong format, missing generator name, missing and duplicate island ids', async ({ page }) => {
        expect(asErr(await read(page, 'this is not json')).code).toBe('not-json');
        expect(asErr(await read(page, '[1,2]')).code).toBe('not-object');
        const base = fixtureJson('valid/minimal-third-party.json');
        expect(asErr(await read(page, JSON.stringify({ ...base, format: 'other' }))).code).toBe('wrong-format');
        expect(asErr(await read(page, JSON.stringify({ ...base, generator: { version: '1' } }))).code).toBe('missing-generator-name');
        expect(asErr(await read(page, JSON.stringify({ ...base, islands: [{ name: 'x' }] }))).code).toBe('missing-island-id');
        const dup = asErr(await read(page, JSON.stringify({ ...base, islands: [{ id: 'a' }, { id: 'a' }] })));
        expect(dup.code).toBe('duplicate-island-id');
        expect(dup.error).toContain('a');
    });

    test('invalid fixtures follow the manifest class (reader rules)', async ({ page }) => {
        // The manifest marks three required-key fixtures as "schema"; the plan makes them envelope errors
        // (missing generator.name, missing or duplicate island ids). Their codes:
        const requiredKeyCodes: Record<string, string> = {
            'invalid/missing-generator-name.json': 'missing-generator-name',
            'invalid/island-without-id.json': 'missing-island-id',
            'invalid/missing-islands.json': 'missing-islands',
        };
        const invalid = manifest.fixtures.filter((f) => !f.valid);
        expect(invalid.length).toBeGreaterThan(0);
        for (const entry of invalid) {
            const out = await read(page, fixtureText(entry.file));
            if (entry.class === 'envelope') {
                const err = asErr(out);
                expect(err.code, entry.file).toBe(entry.expect?.code);
            } else if (requiredKeyCodes[entry.file]) {
                expect(asErr(out).code, entry.file).toBe(requiredKeyCodes[entry.file]);
            } else if (entry.class === 'semantic' && entry.expect?.code === 'duplicate-island-id') {
                expect(asErr(out).code, entry.file).toBe('duplicate-island-id');
            } else if (entry.class === 'semantic' && entry.expect?.code === 'duplicate-instance') {
                const ok = asOk(out);
                expect(ok.problems.some((p) => p.code === 'duplicate-instance'), entry.file).toBe(true);
                // all records stay preserved
                expect(ok.doc.islands[0].itemStorage).toHaveLength(1);
                expect(ok.doc.account.items).toHaveLength(1);
            } else if (entry.class === 'schema') {
                const ok = asOk(out);
                expect(ok.doc, entry.file).toBeTruthy();
                expect(ok.problems.length, entry.file).toBeGreaterThan(0);
            } else {
                throw new Error(`unhandled manifest entry ${entry.file} (${entry.class})`);
            }
        }
    });

    test('every valid fixture reads without envelope error', async ({ page }) => {
        const valid = manifest.fixtures.filter((f) => f.valid);
        expect(valid.length).toBeGreaterThan(10);
        for (const entry of valid) {
            const out = await read(page, fixtureText(entry.file));
            const ok = asOk(out);
            expect(ok.doc.format, entry.file).toBe('anno117-exchange');
            // computed never stays in the document copy
            expect(ok.doc.computed, entry.file).toBeUndefined();
            expect(ok.problems, entry.file).toEqual([]);
        }
    });

    test('unknown fields at document, island and extension level are captured with pointer and scope (AE1)', async ({ page }) => {
        const ok = asOk(await read(page, fixtureText('valid/unknown-fields-everywhere.json')));
        const find = (pointer: string) => ok.unknown.find((u) => u.pointer === pointer);
        const docLevel = find('/unknownKey');
        expect(docLevel).toBeTruthy();
        expect(docLevel!.scope).toBe('document');
        expect(docLevel!.kind).toBe('unknown');
        expect(docLevel!.value).toEqual({ nested: [1, { deep: true }] });
        const islandId = fixtureJson('valid/unknown-fields-everywhere.json').islands as { id: string }[];
        const isl = find('/islands/0/unknownKey');
        expect(isl).toBeTruthy();
        expect(isl!.scope).toBe(islandId[0].id);
        const docExt = find('/ext/gen-x');
        expect(docExt).toBeTruthy();
        expect(docExt!.scope).toBe('document');
        expect(docExt!.value).toEqual({ unknownKey: { nested: [1, { deep: true }] } });
        const islExt = find('/islands/0/ext/gen-x');
        expect(islExt).toBeTruthy();
        expect(islExt!.scope).toBe(islandId[0].id);
        // unknown keys at deeper levels
        expect(find('/generator/unknownKey')).toBeTruthy();
        expect(find('/settings/difficulty/unknownKey') ?? find('/settings/unknownKey')).toBeTruthy();
        expect(find('/trade/unknownKey')).toBeTruthy();
        expect(find('/islands/0/buildings/3089/unknownKey') ?? find('/islands/0/gameIsland/unknownKey')).toBeTruthy();
        expect(ok.problems).toEqual([]);
    });

    test('unknown-generator file keeps private ext blocks; minimal file reads without problems (AE6)', async ({ page }) => {
        const minimal = asOk(await read(page, fixtureText('valid/minimal-third-party.json')));
        expect(minimal.problems).toEqual([]);
        expect(minimal.unknown).toEqual([]);
        const third = asOk(await read(page, fixtureText('valid/third-party-buildings.json')));
        expect(third.problems).toEqual([]);
        const gen = asOk(await read(page, fixtureText('valid/unknown-generator.json')));
        expect(gen.problems).toEqual([]);
        expect(gen.unknown.map((u) => u.pointer).sort()).toEqual(['/ext/unknown-tool-9000', '/islands/0/ext/unknown-tool-9000']);
    });

    test('an ext.calculator block is known, not captured', async ({ page }) => {
        const base = fixtureJson('valid/minimal-third-party.json');
        const doc = { ...base, ext: { calculator: { a: 1 } } };
        const ok = asOk(await read(page, JSON.stringify(doc)));
        expect(ok.unknown).toEqual([]);
        expect(ok.doc.ext.calculator).toEqual({ a: 1 });
    });

    test('unknown region, building, effect and product GUIDs stay data (AE18)', async ({ page }) => {
        const ok = asOk(await read(page, fixtureText('valid/unknown-guids.json')));
        expect(ok.problems).toEqual([]);
        const later = ok.doc.islands[0];
        expect(later.session).toBe(999001);
        expect(later.buildings['999002']).toEqual({ built: 3, planned: 1 });
        expect(later.effects['999003']).toBe(1);
        expect(later.products['999004'].producer).toBe(999005);
        expect(ok.doc.effects.bySession['999001']['999003']).toBe(2);
        expect(ok.doc.settings.dlcs).toEqual([1, 7]);
        expect(ok.doc.research.researched).toContain(999006);
    });

    test('wrong-typed known keys give a problems entry; numeric strings are coerced (CD4)', async ({ page }) => {
        const wrong = asOk(await read(page, fixtureText('invalid/building-count-wrong-type.json')));
        const p = wrong.problems.find((x) => x.pointer === '/islands/0/buildings/3089/built');
        expect(p).toBeTruthy();
        expect(wrong.doc.islands[0].buildings['3089'].built).toBeUndefined();

        const base = fixtureJson('valid/minimal-third-party.json');
        const doc = {
            ...base,
            islands: [{
                id: 'a',
                session: '3245',
                devotion: '12.5',
                buildings: { '3089': { built: '4', planned: 2, fullyUtilize: 'yes' } },
            }],
        };
        const ok = asOk(await read(page, JSON.stringify(doc)));
        const isl = ok.doc.islands[0];
        expect(isl.session).toBe(3245);
        expect(isl.devotion).toBe(12.5);
        expect(isl.buildings['3089'].built).toBe(4);
        expect(isl.buildings['3089'].planned).toBe(2);
        expect(isl.buildings['3089'].fullyUtilize).toBeUndefined();
        const pointers = ok.problems.map((x) => x.pointer);
        expect(pointers).toContain('/islands/0/buildings/3089/fullyUtilize');
        expect(ok.problems.find((x) => x.pointer === '/islands/0/session')?.code).toBe('coerced');
    });

    test('item locations: every place is captured with its scope (R56)', async ({ page }) => {
        const src = fixtureJson('valid/item-locations.json');
        const ok = asOk(await read(page, JSON.stringify(src)));
        expect(ok.problems).toEqual([]);
        const islands = src.islands as { id: string }[];
        const scopeOf = (pointer: string) => ok.unknown.find((u) => u.pointer === pointer);
        for (let i = 0; i < islands.length; i++) {
            const isl = islands[i] as Record<string, unknown>;
            for (const key of ['itemHolders', 'itemStorage']) {
                if (isl[key] !== undefined) {
                    const u = scopeOf(`/islands/${i}/${key}`);
                    expect(u, `${i}/${key}`).toBeTruthy();
                    expect(u!.scope).toBe(islands[i].id);
                    expect(u!.kind).toBe('unmodelled');
                    expect(u!.value).toEqual(isl[key]);
                }
            }
        }
        const account = scopeOf('/account');
        expect(account).toBeTruthy();
        expect(account!.scope).toBe('document');
        expect(account!.value).toEqual(src.account);
        const unlocated = scopeOf('/unlocatedItems');
        expect(unlocated).toBeTruthy();
        expect(unlocated!.scope).toBe('document');
        expect(unlocated!.value).toEqual(src.unlocatedItems);
    });

    test('catalog keys the calculator does not model are captured as unmodelled with their core location', async ({ page }) => {
        const base = fixtureJson('valid/minimal-third-party.json');
        const doc = {
            ...base,
            name: 'Plan',
            dominantPatron: 5,
            fleet: { ships: [] },
            history: [],
            live: {},
            settings: { map: { size: 'x' }, dlcs: [1] },
            islands: [{ id: 'a', population: { '1': 5 }, harbour: { spots: 2 }, layout: {} }],
        };
        const ok = asOk(await read(page, JSON.stringify(doc)));
        const byPointer = new Map(ok.unknown.map((u) => [u.pointer, u]));
        for (const p of ['/name', '/dominantPatron', '/fleet', '/history', '/live', '/settings/map']) {
            expect(byPointer.get(p)?.scope, p).toBe('document');
            expect(byPointer.get(p)?.kind, p).toBe('unmodelled');
        }
        for (const p of ['/islands/0/population', '/islands/0/harbour', '/islands/0/layout']) {
            expect(byPointer.get(p)?.scope, p).toBe('a');
        }
    });

    test('computed is kept only on the result, not in the document copy', async ({ page }) => {
        const ok = asOk(await read(page, fixtureText('valid/unknown-fields-everywhere.json')));
        expect(ok.doc.computed).toBeUndefined();
        expect(ok.computed).toBeTruthy();
    });

    test('repeated item instance across places is a problem; all records stay', async ({ page }) => {
        const ok = asOk(await read(page, fixtureText('invalid/duplicate-item-instance.json')));
        const dup = ok.problems.filter((p) => p.code === 'duplicate-instance');
        expect(dup).toHaveLength(1);
        expect(dup[0].message).toContain('2001');
        expect(ok.doc.islands[0].itemStorage[0].instance).toBe(2001);
        expect(ok.doc.account.items[0].instance).toBe(2001);
    });

    test('item record without item GUID is a problem and the record is kept', async ({ page }) => {
        const ok = asOk(await read(page, fixtureText('invalid/item-record-without-item.json')));
        expect(ok.problems.some((p) => p.pointer === '/islands/0/itemStorage/0')).toBe(true);
        expect(ok.doc.islands[0].itemStorage).toHaveLength(1);
    });

    test('readExchange is pure: the same text twice gives equal results', async ({ page }) => {
        const text = fixtureText('valid/unknown-fields-everywhere.json');
        const a = await read(page, text);
        const b = await read(page, text);
        expect(b).toEqual(a);
    });
});
