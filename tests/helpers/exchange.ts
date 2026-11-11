import { Page } from '@playwright/test';

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
