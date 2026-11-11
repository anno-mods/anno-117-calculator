import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import Ajv2020 from 'ajv/dist/2020';
import { seedOnce, appReady } from '../helpers/exchange';

// U11: the `computed` block of the export and the comparison after an import (R17, AE5).

const VENDOR = path.join(__dirname, '..', '..', 'vendor', 'anno117-exchange');
const LATIUM = 3245;
const WADER_RESIDENCE = 3087; // population level 1499
const NEED_LEVEL = 1499;
const SAWMILL = 3089;

type Json = Record<string, any>;

const schema = JSON.parse(fs.readFileSync(path.join(VENDOR, 'schema', 'anno117-exchange.schema.json'), 'utf-8'));
const validateSchema = new Ajv2020({ strict: false, allErrors: true }).compile(schema);

function fileOf(islands: Json[], extra: Json = {}): string {
    return JSON.stringify({ format: 'anno117-exchange', formatVersion: '1.0', generator: { name: 'u11-test' }, islands, ...extra });
}

function tradeFixture(): Json {
    // Island A supplies Sardines (2088, demanded by the Waders of island B) over a trade route: B imports them.
    const raw = fs.readFileSync(path.join(VENDOR, 'fixtures', 'valid', 'trade-manual-one-slot.json'), 'utf-8');
    const doc = JSON.parse(raw.split('151680').join('2088'));
    doc.islands[1].buildings = { [WADER_RESIDENCE]: { built: 100 } };
    return doc;
}

async function settle(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((r) => setTimeout(() => setTimeout(r, 30), 30)));
}

async function open(page: Page): Promise<void> {
    await seedOnce(page);
    await page.goto('/');
    await appReady(page);
}

async function load(page: Page, text: string): Promise<void> {
    await settle(page);
    const res = await page.evaluate((t: string) => {
        const ex = window.exchange;
        const plan = ex.planImport(t);
        if ('error' in plan) return { ok: false, error: plan.error };
        const r = ex.applyImport(plan, { reload: false });
        return { ok: r.ok, error: r.error };
    }, text);
    expect(res.error, 'import').toBeUndefined();
    await page.reload();
    await appReady(page);
}

async function summary(page: Page): Promise<Json> {
    await settle(page);
    return page.evaluate(() => window.exchange.computeSummary());
}

test.describe('computed block (U11)', () => {
    test.beforeEach(async ({ page }) => {
        await open(page);
    });

    test('export of a fixture island contains residents per level, buildings required and imports', async ({ page }) => {
        await load(page, JSON.stringify(tradeFixture()));
        await settle(page);
        const { document: doc } = await page.evaluate(() => window.exchange.exportDocument());
        const b = (doc.islands as Json[]).find((i) => i.name === 'B') as Json;
        const c = doc.computed.islands[b.id];
        expect(c, 'computed for island B').toBeTruthy();
        expect(c.residents[String(NEED_LEVEL)]).toBeGreaterThan(0);
        expect(Object.keys(c.buildingsRequired).length).toBeGreaterThan(0);
        for (const v of Object.values(c.buildingsRequired)) expect(v).toBeGreaterThan(0);
        expect(Object.keys(c.imports).length).toBeGreaterThan(0);
        for (const v of Object.values(c.imports)) expect(v).toBeGreaterThan(0);
        // the pseudo-island is not part of it
        expect(Object.keys(doc.computed.islands).length).toBe(2);
        const ok = validateSchema(doc);
        expect(ok, JSON.stringify(validateSchema.errors?.slice(0, 5))).toBe(true);
        const read = await page.evaluate((d: Json) => {
            const r = window.exchange.readExchange(JSON.stringify(d));
            return 'error' in r ? { error: r.error, problems: [] } : { problems: r.problems, computed: r.document ? r.document.computed : r.computed };
        }, doc);
        expect(read.error).toBeUndefined();
    });

    test('buildings required are unrounded', async ({ page }) => {
        await load(page, fileOf([{ id: 'a', name: 'Alpha', session: LATIUM, buildings: { [WADER_RESIDENCE]: { built: 37 }, [SAWMILL]: { built: 1 } } }]));
        const s = await summary(page);
        const values = Object.values(s.islands['a'] ? s.islands['a'].buildingsRequired : (Object.values(s.islands)[0] as Json).buildingsRequired) as number[];
        expect(values.some((v) => Math.abs(v - Math.round(v)) > 1e-6)).toBe(true);
    });

    test('import of a file whose computed residents differ by 5 % lists the island and both values and does not block (AE5)', async ({ page }) => {
        // Learn what the calculator computes for this state, then import the same state with a 5 % deviation.
        await load(page, JSON.stringify(tradeFixture()));
        const own = await summary(page);
        const bId = await page.evaluate(() => window.exchange.islandId('B'));
        const real = own.islands[bId].residents[String(NEED_LEVEL)] as number;
        expect(real).toBeGreaterThan(0);

        const doc = tradeFixture();
        doc.islands[1].id = bId;
        doc.computed = { islands: { [bId]: { residents: { [String(NEED_LEVEL)]: real * 1.05 } } } };
        await load(page, JSON.stringify(doc));

        const section = page.locator('#exchange-computed-differences');
        await expect(section).toBeVisible();
        const text = await section.innerText();
        expect(text).toContain('B');
        // values are shown with at most two decimals
        expect(text).toContain(String(Number((real * 1.05).toFixed(2))));
        expect(text).toContain(String(Number(real.toFixed(2))));
        // the key is consumed and the app stays usable
        expect(await page.evaluate(() => sessionStorage.getItem('exchange.computed'))).toBeNull();
        await page.locator('#exchange-close-button').click();
        await expect(page.locator('#exchange-report-dialog')).toBeHidden();
        expect(await page.evaluate(() => !!window.view.island())).toBe(true);
    });

    test('differences below tolerance produce no entry', async ({ page }) => {
        await load(page, JSON.stringify(tradeFixture()));
        const own = await summary(page);
        const bId = await page.evaluate(() => window.exchange.islandId('B'));
        const real = own.islands[bId].residents[String(NEED_LEVEL)] as number;

        const doc = tradeFixture();
        doc.islands[1].id = bId;
        doc.computed = { islands: { [bId]: { residents: { [String(NEED_LEVEL)]: real * 1.005 } } } };
        await load(page, JSON.stringify(doc));

        await expect(page.locator('#exchange-computed-differences')).toHaveCount(0);
        expect(await page.evaluate(() => sessionStorage.getItem('exchange.computed'))).toBeNull();
        expect(await page.evaluate(() => window.view.exchangeReport.differences().length)).toBe(0);
    });
});
