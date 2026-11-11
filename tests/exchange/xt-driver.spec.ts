import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { exportDoc, importText, openApp, summaryByName } from '../helpers/exchange';

// Driver for the demand comparison and multi-round-trip test against the planner (outside the repo, in C:\dev\xt).
// It does nothing unless XT_JOBS names a JSON file: a list of {"in", "summary", "export"}. Per job it imports the file
// into a fresh app and writes (1) the computed summary by island name plus the per-product demand in t/min, (2) the
// calculator's own export and its reports.

const JOBS = process.env.XT_JOBS;

test.describe('xt driver', () => {
    test.skip(!JOBS, 'XT_JOBS not set');

    test('import, compute and export every job', async ({ page }) => {
        test.setTimeout(60 * 60 * 1000);
        const jobs: { in: string; summary: string; export: string }[] = JSON.parse(fs.readFileSync(JOBS!, 'utf-8'));
        for (const job of jobs) {
            await openApp(page);
            const res = await importText(page, fs.readFileSync(job.in, 'utf-8'));
            expect(res.error, job.in).toBeUndefined();
            expect(res.ok, job.in).toBe(true);
            const summary = await summaryByName(page);
            const demand = await page.evaluate(() => {
                const out: Record<string, Record<string, number>> = {};
                for (const isl of window.view.islands()) {
                    if (isl.isAllIslands()) continue;
                    const per: Record<string, number> = {};
                    for (const p of isl.products) {
                        const d = p.totalDemand();
                        if (Number.isFinite(d) && d > 1e-9) per[String(p.guid)] = d;
                    }
                    out[isl.name()] = per;
                }
                return out;
            });
            for (const n of Object.keys(demand)) (summary[n] ??= {}).demand = demand[n];
            fs.writeFileSync(job.summary, JSON.stringify(summary, null, 1));
            const out = await exportDoc(page);
            fs.writeFileSync(job.export, JSON.stringify(out.document, null, 1));
            fs.writeFileSync(job.export + '.report.json', JSON.stringify({ import: res.plan?.report, export: out.report }, null, 1));
            await page.evaluate(() => localStorage.clear());
            await page.context().clearCookies();
        }
    });
});
