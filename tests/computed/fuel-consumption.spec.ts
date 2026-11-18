import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers';

/**
 * Coal (fuel) consumption of a working building.
 *
 * One unit of coal lasts the burn time whatever the cycle time or productivity,
 * so a working building burns 60 / (fuelProductionTime * fuelDurationFactor) t/min.
 * In-game readings (Tessera Works, 120 s cycle): 3 min burn cycle, ~0.33 t/min.
 * Productivity items must not change the per-building consumption.
 */

const TESSERA_WORKS = 3203;
const BUILDINGS = 4;

async function openIsland(page: any) {
    const configLoader = new ConfigLoader();
    const config = configLoader.createIslandConfig("Latium", 3245, {
        [`${TESSERA_WORKS}.buildings.constructed`]: String(BUILDINGS),
        [`${TESSERA_WORKS}.buildings.fullyUtilizeConstructed`]: "1"
    });
    await configLoader.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.waitForTimeout(500);
}

test.describe('Fuel consumption', () => {
    test('Tessera Works burns 60 / fuel time per working building', async ({ page }) => {
        await openIsland(page);

        const result = await page.evaluate((guid) => {
            const f = window.view.island().assetsMap.get(guid) as any;
            return {
                coal: f.inputDemandFuel.amount(),
                fuelTime: window.view.constants.fuelProductionTime as number,
                cycleTime: f.cycleTime as number,
                utilized: f.buildings.utilized()
            };
        }, TESSERA_WORKS);

        expect(result.utilized).toBeCloseTo(BUILDINGS, 6);
        expect(result.coal).toBeCloseTo(BUILDINGS * 60 / result.fuelTime, 6);
        // cycle time / burn time would give a different number for non-matching cycles
        expect(result.cycleTime).toBe(result.fuelTime);
    });

    test('productivity items do not change coal consumption of the constructed buildings', async ({ page }) => {
        await openIsland(page);

        const result = await page.evaluate((guid) => {
            const island = window.view.island();
            const f = island.assetsMap.get(guid) as any;
            const before = { coal: f.inputDemandFuel.amount(), boost: f.boost() };

            const boosted: { item: number, boost: number, coal: number }[] = [];
            for (const item of island.items as any[]) {
                const equip = item.equipments.find((e: any) => e.target === f);
                if (!equip || equip.buff.productivityUpgrade + equip.buff.baseProductivityUpgrade <= 0) continue;
                equip.scaling(1);
                boosted.push({ item: item.guid, boost: f.boost(), coal: f.inputDemandFuel.amount() });
                equip.scaling(0);
            }
            return { before, boosted };
        }, TESSERA_WORKS);

        expect(result.boosted.length).toBeGreaterThan(0);
        for (const b of result.boosted) {
            expect(b.boost).toBeGreaterThan(result.before.boost);
            expect(b.coal).toBeCloseTo(result.before.coal, 6);
        }
    });

    test('fuel duration buffs lower consumption, productivity does not', async ({ page }) => {
        await openIsland(page);

        const result = await page.evaluate((guid) => {
            const island = window.view.island();
            const f = island.assetsMap.get(guid) as any;
            const base = f.inputDemandFuel.amount();
            const fuelBuffs = f.buffs().filter((b: any) => b.buff.fuelDurationPercent > 0);
            fuelBuffs.forEach((b: any) => b.scaling(1));
            const percent = fuelBuffs.reduce((a: number, b: any) => a + b.fuelDurationPercent(), 0);
            return { base, withFuelBuffs: f.inputDemandFuel.amount(), percent, count: fuelBuffs.length };
        }, TESSERA_WORKS);

        expect(result.count).toBeGreaterThan(0);
        expect(result.withFuelBuffs).toBeCloseTo(result.base / (1 + result.percent / 100), 6);
    });
});
