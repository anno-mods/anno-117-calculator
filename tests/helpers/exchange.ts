import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import Ajv2020 from 'ajv/dist/2020';

export type Json = Record<string, any>;

/** The vendored specification: schema, fixtures and manifest. */
export const VENDOR = path.join(__dirname, '..', '..', 'vendor', 'anno117-exchange');
export const FIXTURE_DIR = path.join(VENDOR, 'fixtures');

const schema = JSON.parse(fs.readFileSync(path.join(VENDOR, 'schema', 'anno117-exchange.schema.json'), 'utf-8'));
/** The full JSON Schema validator (dev dependency ajv); the bundle itself only carries the hand-written reader. */
export const validateSchema = new Ajv2020({ strict: false, allErrors: true }).compile(schema);

/** Text of a vendored fixture, e.g. `valid/cinis-sawmill.json`. */
export function vendoredFixture(rel: string): string {
    return fs.readFileSync(path.join(FIXTURE_DIR, rel), 'utf-8');
}

/** A minimal valid exchange file around the given islands. */
export function fileOf(islands: Json[], extra: Json = {}): string {
    return JSON.stringify({ format: 'anno117-exchange', formatVersion: '1.0', generator: { name: 'u12-test' }, ...extra, islands });
}

/** Storage writes are debounced with setTimeout(0); wait until they are flushed. */
export async function settle(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>((r) => setTimeout(() => setTimeout(r, 30), 30)));
}

/** Seeds, navigates and waits for the app. */
export async function openApp(page: Page, extra: Record<string, string> = {}): Promise<void> {
    await seedOnce(page, extra);
    await page.goto('/');
    await appReady(page);
}

/** Page errors and console errors (missing resources excluded), for the no-binding-error assertions. */
export function collectErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        if (/Failed to load resource/.test(m.text())) return;
        errors.push(m.text());
    });
    return errors;
}

export interface ImportOutcome {
    ok: boolean;
    error?: string;
    plan?: Json;
}

/** planImport + applyImport(reload:false) of `text`, then a page reload so the app runs on the imported state. */
export async function importText(page: Page, text: string): Promise<ImportOutcome> {
    await settle(page);
    const res = await page.evaluate((t: string) => {
        const ex = (window as any).exchange;
        const plan = ex.planImport(t);
        if ('error' in plan) return { ok: false, error: plan.error as string };
        const r = ex.applyImport(plan, { reload: false });
        return { ok: r.ok as boolean, error: r.error as string | undefined, plan: { report: plan.report, problems: plan.problems, keyMap: plan.keyMap } };
    }, text);
    if (res.ok) {
        await page.reload();
        await appReady(page);
    }
    return res;
}

/** Every report entry of a plan report (the four lists). */
export function reportEntries(plan: Json): Json[] {
    const r = plan.report;
    return [...r.carriedThrough, ...r.notMapped, ...r.approximated, ...r.notProvided];
}

/** exportDocument() of the running app. */
export async function exportDoc(page: Page): Promise<{ document: Json; report: Json[] }> {
    await settle(page);
    return page.evaluate(() => (window as any).exchange.exportDocument());
}

/** computeSummary() keyed by island name instead of island id, so two runs compare even when ids were assigned in between. */
export async function summaryByName(page: Page): Promise<Json> {
    await settle(page);
    return page.evaluate(() => {
        const w = window as any;
        const s = w.exchange.computeSummary();
        const out: Record<string, unknown> = {};
        for (const isl of w.view.islands()) {
            if (isl.isAllIslands()) continue;
            out[isl.name()] = s.islands[isl.exchangeIslandId];
        }
        return out;
    });
}

/** Asserts two summaries by name are equal within a numeric tolerance; returns the differences. */
export function summaryDifferences(a: Json, b: Json, eps = 1e-6): string[] {
    const diffs: string[] = [];
    const names = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const n of names) {
        for (const q of ['residents', 'buildingsRequired', 'imports']) {
            const x: Json = (a[n] ?? {})[q] ?? {};
            const y: Json = (b[n] ?? {})[q] ?? {};
            for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
                const vx = x[k] ?? 0;
                const vy = y[k] ?? 0;
                if (Math.abs(vx - vy) > eps * Math.max(1, Math.abs(vx))) diffs.push(`${n}/${q}/${k}: ${vx} vs ${vy}`);
            }
        }
    }
    return diffs;
}

/**
 * Seeds a fresh page for exchange import flows that reload.
 * ConfigLoader.loadConfigObject re-seeds localStorage on every navigation (addInitScript), which would overwrite an
 * imported state on reload. This seed runs once per browser tab: sessionStorage survives a reload and marks it done.
 */
export async function seedOnce(page: Page, extra: Record<string, string> = {}): Promise<void> {
    await page.addInitScript((extraKeys: Record<string, string>) => {
        try {
            if (sessionStorage.getItem('__exchangeSeeded')) return;
            sessionStorage.setItem('__exchangeSeeded', '1');
            localStorage.setItem('versionCalculator', '4.0');
            localStorage.setItem('islandNames', '[]');
            for (const k of Object.keys(extraKeys)) localStorage.setItem(k, extraKeys[k]);
        } catch {
            // storage unavailable: the page then runs as a first run
        }
    }, extra);
}

/** Waits until the app and window.exchange are ready. */
export async function appReady(page: Page): Promise<void> {
    await page.waitForFunction(() => {
        const w = window as unknown as { view?: { island?: () => unknown }; exchange?: unknown };
        return !!(w.view && w.view.island && w.view.island() && w.exchange);
    });
}
