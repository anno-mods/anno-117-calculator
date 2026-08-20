import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

test.describe('Item-gated needs hide until their effect is active', () => {
    const CELTIC_SESSION = 6627; // Province Celtic Britannia (Albion)
    const MYTHICAL_ITEM_EFFECT_GUID = 166475; // Slainga Gaileanga, Man Of The Forest
    // 174425 appears ONCE in residence 6472's needsList, gated behind requiresItem 166475 with its real
    // consumption rate. It is a conditional need: consumed only while the mythical-item effect is active,
    // so it must be hidden until the effect is toggled on.
    const GATED_NEED_GUID = 174425;
    // A plain ungated need on residence 6472 with a real needConsumptionRate and no requiresItem.
    const PLAIN_UNGATED_NEED_GUID = 6429;
    const ALDERMAN_RESIDENCE_GUID = 6472;

    test('a gated need is hidden until its effect is toggled on', async ({ page }) => {
        const configLoader = new ConfigLoader();
        const config = configLoader.createFullConfig([
            {
                name: 'Albion',
                session: CELTIC_SESSION,
                data: {
                    "6472.buildings.constructed": "10"
                }
            }
        ]);
        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());

        // With the granting effect OFF, the conditional need must be hidden (hidden === true):
        // residence 6472 only consumes it gated behind requiresItem 166475.
        const hiddenBefore = await page.evaluate(({ residenceGuid, needGuid }) => {
            const island = (window as any).view.island();
            const residence = island.assetsMap.get(residenceGuid);
            if (!residence) return undefined;
            const populationLevelNeed = residence.populationLevel.getNeed(needGuid);
            return populationLevelNeed ? populationLevelNeed.hidden() : undefined;
        }, { residenceGuid: ALDERMAN_RESIDENCE_GUID, needGuid: GATED_NEED_GUID });

        expect(hiddenBefore).toBe(true);

        // Toggle the mythical-item effect on. The need becomes available (hidden === false).
        await page.evaluate(({ effectGuid }) => {
            const island = (window as any).view.island();
            // This effect targets a specific residence GUID only, so it is not surfaced via
            // island.availableEffects() (see comment on PopulationLevelNeed.hidden in
            // src/consumption.ts for why). Read it directly off assetsMap, same as the gating logic.
            const effect = island.assetsMap.get(effectGuid);
            effect.scaling(1);
        }, { effectGuid: MYTHICAL_ITEM_EFFECT_GUID });

        const hiddenAfter = await page.evaluate(({ residenceGuid, needGuid }) => {
            const island = (window as any).view.island();
            const residence = island.assetsMap.get(residenceGuid);
            const populationLevelNeed = residence.populationLevel.getNeed(needGuid);
            return populationLevelNeed.hidden();
        }, { residenceGuid: ALDERMAN_RESIDENCE_GUID, needGuid: GATED_NEED_GUID });

        expect(hiddenAfter).toBe(false);
    });

    test('a plain ungated need is available', async ({ page }) => {
        const configLoader = new ConfigLoader();
        const config = configLoader.createFullConfig([
            {
                name: 'Albion',
                session: CELTIC_SESSION,
                data: {
                    "6472.buildings.constructed": "10"
                }
            }
        ]);
        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());

        const hidden = await page.evaluate(({ residenceGuid, needGuid }) => {
            const island = (window as any).view.island();
            const residence = island.assetsMap.get(residenceGuid);
            if (!residence) return undefined;
            const populationLevelNeed = residence.populationLevel.getNeed(needGuid);
            return populationLevelNeed ? populationLevelNeed.hidden() : undefined;
        }, { residenceGuid: ALDERMAN_RESIDENCE_GUID, needGuid: PLAIN_UNGATED_NEED_GUID });

        expect(hidden).toBe(false);
    });
});
