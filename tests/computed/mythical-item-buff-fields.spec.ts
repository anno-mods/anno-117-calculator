import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

test.describe('Mythical Item Buff fields (goodConsumptionUpgrade)', () => {
    const LATIUM_SESSION = 3245;

    // "Pantites of Achaea, Hallowed by Deipneus" - mythic specialist buff.
    // Config: goodConsumptionUpgrade: [{ amountInPercent: -20, product: 2137 }]
    const BUFF_GUID = 160085;
    const BREAD_PRODUCT_GUID = 2137;

    test('resolves goodConsumptionUpgrade product reference and amount', async ({ page }) => {
        const configLoader = new ConfigLoader();
        const config = configLoader.createIslandConfig('Latium', LATIUM_SESSION);

        await configLoader.loadConfigObject(page, config);
        await page.goto('/');

        await page.waitForFunction(() => (window as any).view && (window as any).view.island());

        const result = await page.evaluate(({ buffGuid, breadGuid }) => {
            const island = (window as any).view.island();
            const buff = island.assetsMap.get(buffGuid);

            return {
                buffFound: !!buff,
                buffName: buff?.name ? buff.name() : undefined,
                goodConsumptionUpgradeLength: buff?.goodConsumptionUpgrade?.length,
                entryAmountInPercent: buff?.goodConsumptionUpgrade?.[0]?.amountInPercent,
                entryProductGuid: buff?.goodConsumptionUpgrade?.[0]?.product?.guid,
                entryProductIsSameAsBreadAsset: buff?.goodConsumptionUpgrade?.[0]?.product === island.assetsMap.get(breadGuid)
            };
        }, { buffGuid: BUFF_GUID, breadGuid: BREAD_PRODUCT_GUID });

        console.log('Result:', result);

        expect(result.buffFound).toBe(true);
        expect(result.goodConsumptionUpgradeLength).toBe(1);
        expect(result.entryAmountInPercent).toBe(-20);
        expect(result.entryProductGuid).toBe(BREAD_PRODUCT_GUID);
        // Confirms the field stores the resolved Product object (not just a matching guid).
        expect(result.entryProductIsSameAsBreadAsset).toBe(true);
    });
});
