import { test, expect, Page } from '@playwright/test';

const COAL = 2085;
const COAL_HUT = 152271;
const COAL_MINE = 152245;
const SEPAT_SESSION = 149679;

async function ready(page: Page) {
    await page.goto('/');
    await page.waitForFunction(() => window.view && window.view.island() && window.exchange);
}

test.describe('Sepat des Wiesels coal import', () => {
    test.beforeEach(async ({ page }) => {
        await ready(page);
    });

    test('imports the coal hut as default supplier and fully utilizes the local coal mine', async ({ page }) => {
        const text = JSON.stringify({
            format: 'anno117-exchange',
            formatVersion: '1.0',
            generator: { name: 'coal-import-test' },
            islands: [{
                id: 'sepat',
                name: 'Sepat des Wiesels',
                session: SEPAT_SESSION,
                buildings: {
                    [COAL_HUT]: { built: 8 },
                    [COAL_MINE]: { built: 1, fullyUtilize: true },
                },
                products: { [COAL]: { producer: COAL_HUT } },
            }],
        });

        const plan = await page.evaluate((input) => window.exchange.planImport(input), text);

        expect(plan.error).toBeUndefined();
        const islandStore = JSON.parse(plan.keyMap['Sepat des Wiesels']);
        expect(islandStore[`${COAL}.defaultSupplier.type`]).toBe('factory');
        expect(islandStore[`${COAL}.defaultSupplier.id`]).toBe(String(COAL_HUT));
        expect(islandStore[`${COAL_MINE}.buildings.fullyUtilizeConstructed`]).toBe('1');
    });
});
