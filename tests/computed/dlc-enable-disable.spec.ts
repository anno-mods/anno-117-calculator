import { test, expect } from '@playwright/test';

/**
 * Start view mode (ViewMode.start in src/views.ts) followed by enabling the DLCs one at a time.
 * Enabling a DLC must not lock it: DLC.used() stays false (the settings dialog disables the
 * checkbox of a used DLC) and the DLC can be switched off again.
 */
test.describe('DLC enable and disable from Start settings', () => {
    test.beforeEach(async ({ page }) => {
        // The view mode exists on the first run only: an empty localStorage, no seeded config.
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island() && (window as any).view.viewMode);
        await page.evaluate(() => { (window as any).view.viewMode.start(); });
        await page.waitForTimeout(300);
        // The island management dialog opens 250 ms after start(); it is irrelevant here.
        await page.evaluate(() => { ($('#island-management-dialog') as any).modal('hide'); });
    });

    const dlcState = (page: any) => page.evaluate(() =>
        (window as any).view.dlcs.map((d: any) => ({
            id: d.id as string,
            checked: Boolean(d.checked()),
            used: Boolean(d.used()),
            domDisabled: (document.getElementById(d.id) as HTMLInputElement | null)?.disabled ?? null,
        })));

    test('Start leaves every DLC off and unlocked', async ({ page }) => {
        const state = await dlcState(page);
        expect(state.length).toBeGreaterThan(0);
        for (const d of state) {
            expect(d.checked, `${d.id} checked`).toBe(false);
            expect(d.used, `${d.id} used`).toBe(false);
        }
    });

    test('each DLC enabled one by one can be disabled again', async ({ page }) => {
        const count: number = await page.evaluate(() => (window as any).view.dlcs.length);
        expect(count).toBeGreaterThan(0);

        for (let i = 0; i < count; i++) {
            // Enable DLC i on top of the DLCs enabled so far.
            await page.evaluate((idx) => { (window as any).view.dlcs[idx].checked(true); }, i);
            await page.waitForTimeout(100); // dependentObjects is a deferred observable array

            const enabled = await dlcState(page);
            const id = enabled[i].id;
            expect.soft(enabled[i].checked, `${id} checked after enabling`).toBe(true);
            expect.soft(enabled[i].used, `${id} must not be locked by enabling it`).toBe(false);
            expect.soft(enabled[i].domDisabled, `${id} checkbox must stay enabled`).not.toBe(true);

            // Disable it again; the state must hold.
            await page.evaluate((idx) => { (window as any).view.dlcs[idx].checked(false); }, i);
            await page.waitForTimeout(100);
            const disabled = await dlcState(page);
            expect.soft(disabled[i].checked, `${id} checked after disabling`).toBe(false);
            expect.soft(disabled[i].used, `${id} used after disabling`).toBe(false);

            // Re-enable so the next step runs with DLC 0..i active.
            await page.evaluate((idx) => { (window as any).view.dlcs[idx].checked(true); }, i);
            await page.waitForTimeout(100);
        }

        // All DLCs on: every one of them can be switched off, in reverse order.
        for (let i = count - 1; i >= 0; i--) {
            await page.evaluate((idx) => { (window as any).view.dlcs[idx].checked(false); }, i);
            await page.waitForTimeout(100);
            const state = await dlcState(page);
            expect.soft(state[i].checked, `${state[i].id} checked after final disable`).toBe(false);
        }
        for (const d of await dlcState(page)) expect.soft(d.used, `${d.id} used at the end`).toBe(false);
    });
});
