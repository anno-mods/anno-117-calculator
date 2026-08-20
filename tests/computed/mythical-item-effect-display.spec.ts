import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

// Data plumbing behind the mythical-item / monument effect display in the effects dialog:
//   1. Residence-targeting effects surface their residences in Effect.targets (so target icons render
//      AND the effect appears in Island.availableEffects()).
//   2. Buff.additionalNeeds resolves each added-need GUID to the product it consumes (product icon).
//   3. Residence targets expose a populationLevel with its own icon (dialog shows the population icon
//      because every residence shares one building icon).
//   4. Buff.goodConsumptionUpgrade resolves to {product, amountInPercent} for the reduced-consumption
//      display (percentage + product icon).
test.describe('Mythical item effect display data', () => {
    const CELTIC_SESSION = 6627; // Albion

    // Effect 166475 "Sláinga Gaileanga" targets ONLY residence 6472 (Aldermen, Albion). Its buff
    // 166476 adds need 174425 (Celtic Fashion Necklaces -> product 2146).
    const RESIDENCE_TARGETING_EFFECT_GUID = 166475;
    const ALDERMAN_RESIDENCE_GUID = 6472;
    const EXTRA_NEED_BUFF_GUID = 166476;
    const NECKLACES_PRODUCT_GUID = 2146;

    test.beforeEach(async ({ page }) => {
        const configLoader = new ConfigLoader();
        const config = configLoader.createFullConfig([
            { name: 'Albion', session: CELTIC_SESSION, data: { '6472.buildings.constructed': '10' } },
        ]);
        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    });

    test('residence target surfaces in Effect.targets and availableEffects', async ({ page }) => {
        const result = await page.evaluate(({ effectGuid, residenceGuid }) => {
            const island = (window as any).view.island();
            const effect = island.assetsMap.get(effectGuid);
            const residence = island.assetsMap.get(residenceGuid);
            return {
                targetsResidence: effect.targets.indexOf(residence) !== -1,
                inAvailableEffects: island.availableEffects().indexOf(effect) !== -1,
                targetHasPopulationIcon: !!(residence.populationLevel && residence.populationLevel.icon),
            };
        }, { effectGuid: RESIDENCE_TARGETING_EFFECT_GUID, residenceGuid: ALDERMAN_RESIDENCE_GUID });

        expect(result.targetsResidence).toBe(true);
        expect(result.inAvailableEffects).toBe(true);
        expect(result.targetHasPopulationIcon).toBe(true);
    });

    test('Buff.additionalNeeds resolves each need to its consumed product', async ({ page }) => {
        const result = await page.evaluate(({ buffGuid }) => {
            const island = (window as any).view.island();
            const buff = island.assetsMap.get(buffGuid);
            return {
                count: buff.additionalNeeds.length,
                productGuids: buff.additionalNeeds.map((p: any) => p.guid),
                allHaveIcons: buff.additionalNeeds.every((p: any) => !!p.icon),
            };
        }, { buffGuid: EXTRA_NEED_BUFF_GUID });

        expect(result.count).toBe(1);
        expect(result.productGuids).toContain(NECKLACES_PRODUCT_GUID);
        expect(result.allHaveIcons).toBe(true);
    });
});

// Monument (colosseum) effect: "Amphitheatre Splendour IV" (Amphitheater-Pracht IV) adds a Bread need
// to the Liberti population tier. Verifies the added need is applied/displayed correctly.
test.describe('Monument effect adds a need (Amphitheatre Splendour IV -> Bread for Liberti)', () => {
    const LATIUM_SESSION = 3245;
    const AMPHITHEATRE_IV_EFFECT_GUID = 159339; // Effect Colosseum Secondary 03 (Amphitheater-Pracht IV)
    const LIBERTI_RESIDENCE_GUID = 3087;
    const LIBERTI_POPULATION_LEVEL_GUID = 1499;
    const BREAD_PRODUCT_GUID = 2137;

    test.beforeEach(async ({ page }) => {
        const configLoader = new ConfigLoader();
        const config = configLoader.createFullConfig([
            { name: 'Latium', session: LATIUM_SESSION, data: { '3087.buildings.constructed': '100' } },
        ]);
        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    });

    test('the effect targets the Liberti residence and its buff adds the Bread need', async ({ page }) => {
        const result = await page.evaluate(({ effectGuid, residenceGuid, popLevelGuid }) => {
            const island = (window as any).view.island();
            const effect = island.assetsMap.get(effectGuid);
            const residence = island.assetsMap.get(residenceGuid);
            const popLevel = island.assetsMap.get(popLevelGuid);
            return {
                inAvailableEffects: island.availableEffects().indexOf(effect) !== -1,
                targetsLiberti: effect.targets.indexOf(residence) !== -1,
                // The residence's population icon is what the dialog renders for the target.
                targetPopulationIconMatches: residence.populationLevel === popLevel
                    && !!popLevel.icon && residence.populationLevel.icon === popLevel.icon,
                addedNeedProducts: effect.buffs.flatMap((b: any) => b.additionalNeeds.map((p: any) => p.guid)),
            };
        }, { effectGuid: AMPHITHEATRE_IV_EFFECT_GUID, residenceGuid: LIBERTI_RESIDENCE_GUID, popLevelGuid: LIBERTI_POPULATION_LEVEL_GUID });

        expect(result.inAvailableEffects).toBe(true);
        expect(result.targetsLiberti).toBe(true);
        expect(result.targetPopulationIconMatches).toBe(true);
        expect(result.addedNeedProducts).toContain(BREAD_PRODUCT_GUID);
    });

    // Target behaviour: Bread is a conditional need for Liberti - consumed ONLY while the amphitheatre
    // effect is active. params.js emits need 2689 (Bread) as a single gated entry on residence 3087
    // (needConsumptionRate 0.0215, requiresItem 159339), so Bread demand is 0 until the effect is on.
    test('gates the Bread need: off -> no demand, on -> > 2 t/min', async ({ page }) => {
        const off = await page.evaluate((productGuid) => {
            const island = (window as any).view.island();
            return island.assetsMap.get(productGuid).totalDemand();
        }, BREAD_PRODUCT_GUID);
        expect(off).toBe(0);

        const on = await page.evaluate(({ effectGuid, productGuid }) => {
            const island = (window as any).view.island();
            island.assetsMap.get(effectGuid).scaling(1);
            return island.assetsMap.get(productGuid).totalDemand();
        }, { effectGuid: AMPHITHEATRE_IV_EFFECT_GUID, productGuid: BREAD_PRODUCT_GUID });
        expect(on).toBeGreaterThan(2);
    });
});
