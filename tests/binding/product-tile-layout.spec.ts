import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * Regression guard for a layout bug in templates/product-tile.html: `.product-tile-amount`
 * (the t/min production line) was nested inside `.product-tile-attribute-group`, which has a
 * fixed `height: 2rem` in style.css (flex-column + space-between) sized for the compact
 * buildings-count row alone. Once a tile's count row rendered (constructed/required builds up
 * to two lines within the tile's fixed 130px width), the two rows together overflowed the fixed
 * 2rem box - the box does not grow with content - pushing the t/min line out of its intended
 * bounds with no bottom padding before the tile border, and misaligning t/min height across
 * tiles that do vs don't render a count row. Fix: `.product-tile-amount`'s wrapper is a sibling
 * of `.product-tile-attribute-group` (not nested inside it), matching the tile's original,
 * pre-regression structure - each row then sizes to its own natural content height.
 *
 * Key data (tests/AGENTS.md): Latium session 3245; Bakery 3174 produces Bread 2137; Garum Works
 * 3185 produces Garum.
 */

const LATIUM_SESSION = 3245;
const BAKERY = 3174;
const GARUM_WORKS = 3185;

test.describe('product-tile layout - count row + t/min row height regression', () => {
    test('product-tile-amount is not nested inside product-tile-attribute-group, and renders with normal bottom padding', async ({ page }) => {
        const configLoader = new ConfigLoader();
        const config = configLoader.createIslandConfig('Latium', LATIUM_SESSION, {
            [`${BAKERY}.buildings.constructed`]: '2',
            [`${GARUM_WORKS}.buildings.constructed`]: '3',
        }, { 'settings.showAllProducts': '1' });
        await configLoader.loadConfigObject(page, config);

        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.waitForSelector('.product-tile', { timeout: 10000 });

        for (const alt of ['Bread', 'Garum']) {
            const result = await page.evaluate((productAlt) => {
                const img = document.querySelector(`.product-tile-icon img[alt="${productAlt}"]`);
                const tile = img?.closest('.product-tile');
                if (!tile) return null;

                const group = tile.querySelector('.product-tile-attribute-group');
                const amount = tile.querySelector('.product-tile-amount');
                if (!group || !amount) return null;

                const tileRect = tile.getBoundingClientRect();
                const amountRect = amount.getBoundingClientRect();

                return {
                    amountIsInsideGroup: group.contains(amount),
                    bottomPadding: tileRect.bottom - amountRect.bottom,
                };
            }, alt);

            expect(result, `expected a rendered product-tile for ${alt}`).not.toBeNull();
            // The structural regression: t/min's wrapper must be a sibling of the fixed-height
            // count-row group, never a descendant of it.
            expect(result!.amountIsInsideGroup, `${alt}: .product-tile-amount must not be nested inside .product-tile-attribute-group`).toBe(false);
            // A real bottom padding must remain between the t/min line and the tile border (the
            // regression pushed this to ~0 or negative when the fixed-height box overflowed).
            expect(result!.bottomPadding, `${alt}: expected visible padding beneath t/min`).toBeGreaterThan(5);
        }
    });
});
