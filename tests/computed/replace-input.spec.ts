import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers';

/**
 * Tests for ReplaceInputs buff with no new input (NewInput = 0)
 *
 * Item: Euryphaessa, Devotee to Crystalline Purity (effect guid 160500, buff guid 160501)
 * Factory: Glassblower (guid 3202), cycleTime 120
 *   inputs: Pigments (2124) + Sand (2117), each amount 1 per cycle
 *   output: Fine Glass Goods (2151)
 *
 * Buff 160501 replaces Pigments (2124) with no input (NewInput = 0),
 * meaning Pigments is removed from the factory's input list entirely.
 *
 * With 5 Glassblowers fully utilized:
 *   throughput = 5 * 1 * 60/120 = 2.5 t/min
 *   Pigments demand = 2.5 * 1 = 2.5 t/min (inactive) / 0 t/min (active)
 */

const GLASSBLOWER_GUID = 3202;
const PIGMENTS_GUID = 2124;
const EURYPHAESSA_GUID = 160500;
const LATIUM_SESSION = 3245;

test.describe('ReplaceInputs: Euryphaessa removes Pigments from Glassblower', () => {
    test('Glassblower: Euryphaessa eliminates Pigments demand when equipped', async ({ page }) => {
        const configLoader = new ConfigLoader();

        const config = configLoader.createIslandConfig('Latium', LATIUM_SESSION, {
            '3202.buildings.constructed': '5',
            '3202.buildings.fullyUtilizeConstructed': '1'
        });

        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());

        const getPigmentsDemand = () =>
            page.evaluate(
                ({ pigmentsGuid }) => {
                    const island = (window as any).view.island();
                    const product = island.assetsMap.get(pigmentsGuid);
                    return product?.totalDemand() ?? 0;
                },
                { pigmentsGuid: PIGMENTS_GUID }
            );

        const setEuryphaessa = async (active: boolean) => {
            await page.evaluate(
                ({ itemGuid, active }) => {
                    const island = (window as any).view.island();
                    const item = island.items.find((i: any) => i.guid === itemGuid);
                    if (item) item.checked(active);
                },
                { itemGuid: EURYPHAESSA_GUID, active }
            );
            await page.waitForTimeout(200);
        };

        // 5 Glassblowers, no Euryphaessa → 2.5 t/min Pigments required
        expect(await getPigmentsDemand()).toBeCloseTo(2.5, 2);

        // Equip Euryphaessa → Pigments removed from inputs
        await setEuryphaessa(true);
        expect(await getPigmentsDemand()).toBe(0);

        // Toggle 1: uncheck → Pigments back; check → Pigments gone
        await setEuryphaessa(false);
        expect(await getPigmentsDemand()).toBeCloseTo(2.5, 2);
        await setEuryphaessa(true);
        expect(await getPigmentsDemand()).toBe(0);

        // Toggle 2: uncheck → Pigments back; check → Pigments gone
        await setEuryphaessa(false);
        expect(await getPigmentsDemand()).toBeCloseTo(2.5, 2);
        await setEuryphaessa(true);
        expect(await getPigmentsDemand()).toBe(0);
    });
});
