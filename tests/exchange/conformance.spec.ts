import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { appReady, collectErrors, exportDoc, FIXTURE_DIR, importText, Json, openApp, reportEntries, validateSchema, vendoredFixture } from '../helpers/exchange';

// U12: conformance over the vendored manifest (R20). Every valid fixture imports into the running app, the app starts on
// the imported state without errors and exports a file that validates against the vendored schema. Every invalid fixture
// is rejected according to its class: envelope (reader error with the manifest code), schema (JSON Schema failure at the
// manifest path and keyword), semantic (reader error or problem with the manifest code).

interface ManifestEntry {
    file: string;
    valid: boolean;
    class?: 'envelope' | 'schema' | 'semantic';
    reason?: string;
    expect?: { code?: string; path?: string; keyword?: string };
}

const manifest = JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, 'MANIFEST.json'), 'utf-8')) as { fixtures: ManifestEntry[] };
const valid = manifest.fixtures.filter((f) => f.valid);
const invalid = manifest.fixtures.filter((f) => !f.valid);

function schemaErrors(text: string): { path: string; keyword: string }[] {
    let doc: unknown;
    try {
        doc = JSON.parse(text);
    } catch {
        return [{ path: '', keyword: 'json' }];
    }
    validateSchema(doc);
    return (validateSchema.errors ?? []).map((e) => ({ path: e.instancePath, keyword: e.keyword }));
}

test('the manifest lists every fixture file of the vendored folders', () => {
    const listed = new Set(manifest.fixtures.map((f) => f.file));
    for (const dir of ['valid', 'invalid']) {
        for (const f of fs.readdirSync(path.join(FIXTURE_DIR, dir)).filter((x) => x.endsWith('.json'))) {
            expect(listed.has(`${dir}/${f}`), `${dir}/${f} is in the manifest`).toBe(true);
        }
    }
    for (const f of manifest.fixtures) expect(fs.existsSync(path.join(FIXTURE_DIR, f.file)), f.file).toBe(true);
});

test.describe('conformance: valid fixtures import and export', () => {
    for (const entry of valid) {
        test(entry.file, async ({ page }) => {
            const errors = collectErrors(page);
            const text = vendoredFixture(entry.file);
            expect(schemaErrors(text), 'the fixture validates against the vendored schema').toEqual([]);

            await openApp(page);
            const res = await importText(page, text);
            expect(res.error, 'import').toBeUndefined();
            expect(res.ok).toBe(true);
            expect(res.plan?.problems ?? [], 'a valid fixture yields no import problems').toEqual([]);

            // The app starts on the imported state and exports a valid file again.
            await appReady(page);
            expect(await page.evaluate(() => !!(window as any).view.island())).toBe(true);
            const { document } = await exportDoc(page);
            expect(schemaErrors(JSON.stringify(document)), 'the export validates against the vendored schema').toEqual([]);
            const source = JSON.parse(text) as Json;
            for (const isl of source.islands as Json[]) {
                expect((document.islands as Json[]).some((i) => i.id === isl.id), `island ${isl.id} survives`).toBe(true);
            }
            expect(errors).toEqual([]);
        });
    }
});

test.describe('conformance: invalid fixtures are rejected by class', () => {
    for (const entry of invalid) {
        test(`${entry.file} (${entry.class})`, async ({ page }) => {
            const text = vendoredFixture(entry.file);
            await openApp(page);
            const before = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort()));
            const plan = await page.evaluate((t: string) => {
                const r = (window as any).exchange.planImport(t);
                return 'error' in r ? { error: r.error as string, code: r.code as string } : { problems: r.problems as Json[] };
            }, text);
            const errs = schemaErrors(text);
            const exp = entry.expect ?? {};

            if (entry.class === 'envelope') {
                expect('error' in plan, `${entry.file} is rejected: ${entry.reason}`).toBe(true);
                expect((plan as Json).code).toBe(exp.code);
                expect(errs.length, 'an envelope failure also fails the schema').toBeGreaterThan(0);
                if (exp.path !== undefined) {
                    const p = exp.path === '/' ? '' : exp.path;
                    expect(errs.some((e) => e.path === p && e.keyword === exp.keyword), JSON.stringify(errs)).toBe(true);
                }
            } else if (entry.class === 'schema') {
                expect(errs.some((e) => e.path === exp.path && e.keyword === exp.keyword), JSON.stringify(errs.slice(0, 5))).toBe(true);
                // The runtime reader (KTD7) does not run the full schema: it either rejects the file or reports the value as a problem.
                const flagged = 'error' in plan || ((plan as Json).problems as Json[]).length > 0;
                expect(flagged, `${entry.file}: ${entry.reason}`).toBe(true);
            } else {
                // semantic: the schema accepts the file; the reader names the violation by code, as an error or as a problem
                expect(errs, 'the schema cannot express this rule').toEqual([]);
                const codes = 'error' in plan ? [(plan as Json).code] : ((plan as Json).problems as Json[]).map((p) => p.code);
                expect(codes, `${entry.file}: ${entry.reason}`).toContain(exp.code);
            }

            // A rejected file never changes the storage.
            const after = await page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort()));
            expect(after).toBe(before);
        });
    }
});

test('a valid fixture imports with a report that lists the carried-through content', async ({ page }) => {
    await openApp(page);
    const res = await importText(page, vendoredFixture('valid/unknown-fields-everywhere.json'));
    expect(res.ok).toBe(true);
    expect(reportEntries(res.plan as Json).some((e) => e.kind === 'carried-through')).toBe(true);
});
