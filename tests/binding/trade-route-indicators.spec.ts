import { test, expect, Page } from '@playwright/test';
import { BREAD, loadRouteDoc, openTradeDialog, simpleRoute, visitsAt } from '../helpers/route-doc';

/**
 * Trade routes dialog (plan 2026-11-15-1255 U3): required offload and utilization columns with focusable tooltips,
 * indicators, filters, sorting, tabs with cross-link chips, and the game-route icon on imported product tiles.
 */

const GAPS = [0, 10, 20, 40, 50]; // longest gap 20 min
const ROMA_OSTIA = { from: 'Roma', to: 'Ostia' };
const ROMA_CUMAE = { from: 'Roma', to: 'Cumae' };

const twoRoutes = () => ({
    routes: [simpleRoute(1, 'a1', 'a2', { name: 'Alpha' }), simpleRoute(2, 'a1', 'a3', { name: 'Beta' })],
    visits: [...visitsAt(1, 'a2', GAPS), ...visitsAt(2, 'a3', GAPS)],
});

async function rowTexts(page: Page, table: string): Promise<string[]> {
    return page.locator(`${table} tbody tr`).evaluateAll((rows) => rows.map((r) => (r.textContent ?? '').replace(/\s+/g, ' ').trim()));
}

test.describe('trade route indicators (U3)', () => {
    test('AE8: columns show offload and utilization, focus and hover expose the tooltip', async ({ page }) => {
        await loadRouteDoc(page, twoRoutes(), [{ ...ROMA_OSTIA, amount: 1 }]);
        await openTradeDialog(page);
        const row = page.locator('#trade-calc-table tbody tr').first();
        await expect(row.locator('.trade-offload-value')).toHaveText('20');
        await expect(row.locator('.trade-utilization')).toContainText('40');

        const trigger = row.locator('.trade-offload .prod-trigger').first();
        const tip = row.locator('.trade-offload .prod-tip').first();
        await expect(tip).toBeHidden();
        await trigger.focus();
        await expect(tip).toBeVisible();
        await expect(tip).toContainText('20');
        // The tooltip names the capacity the requirement is compared with and the resulting utilization (20 t of 50 t).
        await expect(tip).toContainText(/Capacity of the matched game routes: 50 t per visit \(\d+ ships/);
        await expect(tip).toContainText('Utilization: 40 %');
        await expect(trigger).toHaveAttribute('aria-describedby', /trade-tip-offload-/);
        await expect(tip).toHaveAttribute('role', 'tooltip');
        await page.locator('#trade-routes-management-dialog .modal-header h4').click();
        await trigger.blur();
        await expect(tip).toBeHidden();
        await trigger.hover();
        await expect(tip).toBeVisible();
    });

    test('the number columns have right-aligned headers', async ({ page }) => {
        await loadRouteDoc(page, twoRoutes(), [{ ...ROMA_OSTIA, amount: 1 }]);
        await openTradeDialog(page);
        for (const key of ['amount', 'offload', 'utilization'])
            await expect(page.locator(`#trade-calc-table th[data-sort-key="${key}"]`)).toHaveClass(/text-right/);
        await expect(page.locator('#trade-calc-table th[data-sort-key="from"]')).not.toHaveClass(/text-right/);
    });

    test('red and yellow show together with distinct explanations; AE4 in the open dialog', async ({ page }) => {
        const history = [{ island: 'a2', product: BREAD, kind: 'storage', clock: 'game', unit: 't', start: 0, step: 600100, values: [10, 0, 3, 0] }];
        await loadRouteDoc(page, { ...twoRoutes(), visits: visitsAt(1, 'a2', GAPS, 5), history }, [{ ...ROMA_OSTIA, amount: 1 }]);
        await openTradeDialog(page);
        const row = page.locator('#trade-calc-table tbody tr').first();
        await expect(row.locator('.trade-red')).toHaveCount(0);
        await expect(row.locator('.trade-yellow')).toHaveCount(1);

        // raise the rate: 3 t/min x 20 min = 60 t over the 50 t capacity
        await page.evaluate(() => { (window as any).view.tradeManager.routes()[0].userSetAmount(3); });
        await expect(row.locator('.trade-utilization')).toContainText('120');
        await expect(row.locator('.trade-red')).toHaveCount(1);
        await expect(row.locator('.trade-yellow')).toHaveCount(1);
        const red = await row.locator('.trade-red .prod-tip').textContent();
        const yellow = await row.locator('.trade-yellow .prod-tip').textContent();
        expect(red).not.toEqual(yellow);

        await page.evaluate(() => { (window as any).view.tradeManager.routes()[0].userSetAmount(1); });
        await expect(row.locator('.trade-red')).toHaveCount(0);
    });

    test('unavailable shows its reason and the source-production triangle is untouched', async ({ page }) => {
        await loadRouteDoc(page, { routes: [simpleRoute(1, 'a1', 'a2')], visits: visitsAt(1, 'a2', [0, 10]) }, [{ ...ROMA_OSTIA, amount: 1 }]);
        await openTradeDialog(page);
        const row = page.locator('#trade-calc-table tbody tr').first();
        await expect(row.locator('.trade-unavailable')).toBeVisible();
        await row.locator('.trade-unavailable').focus();
        await expect(row.locator('.trade-unavailable .prod-tip')).toContainText(/fewer than 2/i);
        await expect(row.locator('.trade-red, .trade-yellow')).toHaveCount(0);
    });

    test('AE9: imported product tile shows the game-route icon with indicators, a local product keeps its factory count', async ({ page }) => {
        await loadRouteDoc(page, twoRoutes(), [{ ...ROMA_OSTIA, amount: 3, isDefault: true }], { active: 'Ostia' });
        await page.waitForFunction(() => document.querySelectorAll('.product-tile').length > 0);
        const imported = page.locator('.product-tile:has(.game-route-indicator)');
        await expect(imported).toHaveCount(1);
        await expect(imported.locator('.route-ind-red')).toBeVisible();
        await expect(imported.locator('.route-ind-yellow')).toBeHidden();
        await expect(imported.locator('.product-tile-count img[title]').first()).toBeVisible();

        // the producing island: no game-route icon, the factory count stays where it was
        await page.evaluate(() => { (window as any).view.island((window as any).view.islands().find((i: any) => i.name() === 'Roma')); });
        await expect(page.locator('.game-route-indicator')).toHaveCount(0);
        expect(await page.locator('.product-tile-count:not(.game-route-indicator)').count()).toBeGreaterThan(0);
    });

    test('AE10, AE11: filters, sorting and warnings-only in both tabs', async ({ page }) => {
        const doc = twoRoutes();
        // a game route of another good, without a calculator route
        doc.routes.push(simpleRoute(3, 'a1', 'a3', { name: 'Gamma', product: 2069 }));
        await loadRouteDoc(page, doc, [{ ...ROMA_OSTIA, amount: 3 }, { ...ROMA_CUMAE, amount: 1 }]);
        await openTradeDialog(page);
        const island = page.locator('#trade-filter-island');
        await expect(island.locator('option').first()).toHaveText('No filter');

        // sorting: header click sorts, second click reverses, aria-sort follows
        const th = page.locator('#trade-calc-table th[data-sort-key="to"]');
        await th.locator('button').click();
        await expect(th).toHaveAttribute('aria-sort', 'ascending');
        const asc = await rowTexts(page, '#trade-calc-table');
        await th.locator('button').click();
        await expect(th).toHaveAttribute('aria-sort', 'descending');
        const desc = await rowTexts(page, '#trade-calc-table');
        expect(desc).toEqual([...asc].reverse());
        const util = page.locator('#trade-calc-table th[data-sort-key="utilization"] button');
        await util.click();
        const byUtil = await page.locator('#trade-calc-table .trade-utilization').allTextContents();
        expect(parseFloat(byUtil[0])).toBeLessThanOrEqual(parseFloat(byUtil[1]));

        // island filter: only routes touching Cumae
        await island.selectOption('Cumae');
        await expect(page.locator('#trade-calc-table tbody tr')).toHaveCount(1);
        // game routes tab shares the filter
        await page.locator('#trade-tab-game-button').click();
        await expect(page.locator('#trade-game-table tbody tr')).toHaveCount(2);
        await expect(page.locator('#trade-game-table tbody tr', { hasText: 'Beta' })).toHaveCount(1);
        await island.selectOption('');

        // good filter excludes routes without the good
        const names = await page.evaluate(() => {
            const a = (window as any).view.island().assetsMap;
            return { bread: a.get(2137).name(), wheat: a.get(2069).name() };
        });
        await page.locator('#trade-filter-good').selectOption({ label: names.wheat });
        await expect(page.locator('#trade-game-table tbody tr')).toHaveCount(1);
        await expect(page.locator('#trade-game-table tbody tr')).toContainText('Gamma');
        await page.locator('#trade-filter-good').selectOption({ label: names.bread });
        await expect(page.locator('#trade-game-table tbody tr')).toHaveCount(2);
        await page.locator('#trade-filter-good').selectOption({ label: 'No filter' });

        // warnings only: the 3 t/min route is over capacity, the 1 t/min one is not; counts stay put
        await page.locator('label[for="trade-filter-warnings"]').click();
        await expect(page.locator('#trade-game-table tbody tr')).toHaveCount(1);
        await expect(page.locator('#trade-game-table tbody tr')).toContainText('Alpha');
        await expect(page.locator('#trade-tab-calc-button .badge-danger')).toHaveText('1');
        await expect(page.locator('#trade-tab-game-button .badge-danger')).toHaveText('1');
    });

    test('AE13: chips jump between the tabs, filters are shared, the chip in the filter bar returns', async ({ page }) => {
        await loadRouteDoc(page, twoRoutes(), [{ ...ROMA_OSTIA, amount: 1 }, { ...ROMA_CUMAE, amount: 1 }]);
        await openTradeDialog(page);
        await page.locator('#trade-filter-warnings').uncheck();
        await page.locator('#trade-filter-island').selectOption('Roma');

        const firstRow = page.locator('#trade-calc-table tbody tr').first();
        const dest = (await firstRow.locator('td').nth(2).textContent())?.trim();
        await firstRow.locator('.trade-chip-game').click();
        await expect(page.locator('#trade-tab-game')).toHaveClass(/active/);
        await expect(page.locator('#trade-game-table tbody tr')).toHaveCount(1);
        const jump = page.locator('.trade-jump-chip');
        await expect(jump).toBeVisible();
        await expect(jump).toContainText(dest as string);
        await expect(page.locator('#trade-filter-island')).toHaveValue('');

        // reverse chip goes back to the calculator tab for the same pair
        await page.locator('#trade-game-table .trade-chip-calc').first().click();
        await expect(page.locator('#trade-tab-calc')).toHaveClass(/active/);
        await expect(page.locator('#trade-calc-table tbody tr')).toHaveCount(1);

        // the chip in the filter bar restores the earlier filter and tab
        await page.locator('.trade-jump-back').click();
        await expect(jump).toHaveCount(0);
        await expect(page.locator('#trade-filter-island')).toHaveValue('Roma');
        await expect(page.locator('#trade-calc-table tbody tr')).toHaveCount(2);
    });

    test('clicking an island name still opens the product dialog', async ({ page }) => {
        await loadRouteDoc(page, twoRoutes(), [{ ...ROMA_OSTIA, amount: 1 }]);
        await openTradeDialog(page);
        await page.locator('#trade-calc-table tbody tr').first().locator('td a').first().click();
        await page.waitForSelector('#product-config-dialog.show', { timeout: 5000 });
    });

    test('closed dialog costs nothing: no row is evaluated until it opens', async ({ page }) => {
        await loadRouteDoc(page, twoRoutes(), [{ ...ROMA_OSTIA, amount: 1 }]);
        expect(await page.locator('#trade-calc-table').count()).toBe(0);
    });
});
