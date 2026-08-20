import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

test.describe('Effects dialog search and filter', () => {
    const LATIUM_SESSION = 3245;

    test('typing in the search box narrows the effects table to matching names, clearing restores it', async ({ page }) => {
        const configLoader = new ConfigLoader();
        const config = configLoader.createFullConfig([
            { name: 'Latium', session: LATIUM_SESSION, data: {} }
        ]);
        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());

        // Open the effects dialog via Bootstrap's jQuery modal API, same pattern used by
        // other tests (e.g. tests/computed/fertility-extra-goods.spec.ts). The navbar icon
        // that triggers this modal is duplicated for responsive layouts, and the visible one
        // depends on viewport, so driving the modal API directly is more robust.
        await page.evaluate(() => (window as any).$('#effects-dialog').modal('show'));
        await page.waitForSelector('#effects-dialog.show, #effects-dialog.in');

        const rowCountBefore = await page.locator('#effects-dialog tbody tr').count();
        expect(rowCountBefore).toBeGreaterThan(0);

        await page.fill('#effects-dialog input[type="text"]', 'zzz-no-such-effect-zzz');
        await expect(page.locator('#effects-dialog tbody tr')).toHaveCount(0);

        await page.fill('#effects-dialog input[type="text"]', '');
        await expect(page.locator('#effects-dialog tbody tr')).toHaveCount(rowCountBefore);
    });
});
