import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import Ajv2020 from 'ajv/dist/2020';

const VENDOR = path.join(__dirname, '..', '..', 'vendor', 'anno117-exchange');

function readJson(file: string): any {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

test.describe('exchange entry point (U1)', () => {
    test('window.exchange exists as an object after load', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.view && window.view.island());
        const type = await page.evaluate(() => typeof window.exchange);
        expect(type).toBe('object');
        const isNull = await page.evaluate(() => window.exchange === null);
        expect(isNull).toBe(false);
    });
});

test.describe('vendored exchange spec (U1)', () => {
    const schema = readJson(path.join(VENDOR, 'schema', 'anno117-exchange.schema.json'));
    const manifest = readJson(path.join(VENDOR, 'fixtures', 'MANIFEST.json'));

    test('schema compiles in ajv', () => {
        const ajv = new Ajv2020({ strict: false, allErrors: true });
        expect(() => ajv.compile(schema)).not.toThrow();
    });

    test('every valid fixture of the manifest validates', () => {
        const ajv = new Ajv2020({ strict: false, allErrors: true });
        const validate = ajv.compile(schema);
        const valid = manifest.fixtures.filter((f: Record<string, any>) => f.valid === true);
        expect(valid.length).toBeGreaterThan(0);
        for (const entry of valid) {
            const doc = readJson(path.join(VENDOR, 'fixtures', entry.file));
            const ok = validate(doc);
            expect(ok, `${entry.file}: ${JSON.stringify(validate.errors)}`).toBe(true);
        }
    });
});
