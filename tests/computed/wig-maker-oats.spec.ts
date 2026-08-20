import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import * as path from 'path';

test.describe('Wig Maker and Oat Demand Calculation', () => {
    const OATS_PRODUCT_GUID = 2068;
    const OAT_FARM_GUID = 2200;
    const WIG_MAKER_GUID = 31769;

    test('Oat Farm throughput is driven by Flax extra goods demand', async ({ page }) => {
        const configLoader = new ConfigLoader();
        const fixturePath = 'tests/fixtures/extra-goods-flax.json';

        await configLoader.loadConfig(page, fixturePath);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Verify we are on "All Islands"
        const currentIslandName = await page.evaluate(() => (window as any).view.island().name());
        console.log(`Current Island: ${currentIslandName}`);
        expect(currentIslandName).toBe("All Islands");

        // Get Oat Product Demand (should be just Liberti consumption)
        const oatProductDemand = await page.evaluate((guid) => {
            const island = (window as any).view.island();
            const product = island.assetsMap.get(guid);
            return product.totalDemand();
        }, OATS_PRODUCT_GUID);

        console.log(`Oat product demand: ${oatProductDemand}`);
        // 100 Liberti * 0.01388 = 1.388
        expect(oatProductDemand).toBeCloseTo(1.388, 3);

        // Get Oat Farm Throughput (should be driven by Flax demand from Wig Maker)
        const farmThroughput = await page.evaluate((guid) => {
            const island = (window as any).view.island();
            const farm = island.assetsMap.get(guid);
            return farm.throughput();
        }, OAT_FARM_GUID);

        console.log(`Oat Farm throughput with Wig Maker: ${farmThroughput}`);
        // Wig Maker -> Wig Base -> Flax. 
        // 1 Wig Maker (90s) needs 0.666 Wig Base/min.
        // 1 Wig Base Maker (120s) needs 0.5 Flax/min per 1.0 output.
        // 0.666 Wig Base needs 0.666 Flax/min.
        // If Oat Farm produces 1 Flax every 10 cycles (Casponia Casta), it needs 0.666 * 10 = 6.66 cycles/min.
        expect(farmThroughput).toBeGreaterThanOrEqual(6.66);

        // Reset Wig Maker to zero buildings
        await page.evaluate((guid) => {
            const island = (window as any).view.island();
            const factory = island.assetsMap.get(guid);
            if (factory) {
                factory.buildings.constructed(0);
            }
        }, WIG_MAKER_GUID);

        // Wait for re-calculation
        await page.waitForTimeout(500);

        const reducedFarmThroughput = await page.evaluate((guid) => {
            const island = (window as any).view.island();
            const farm = island.assetsMap.get(guid);
            return farm.throughput();
        }, OAT_FARM_GUID);

        console.log(`Oat Farm throughput without Wig Maker: ${reducedFarmThroughput}`);
        // Should drop back to just satisfying the Oat product demand
        expect(reducedFarmThroughput).toBeCloseTo(1.388, 3);
    });
});
