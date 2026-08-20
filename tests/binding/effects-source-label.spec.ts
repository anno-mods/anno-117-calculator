import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

test.describe('Effect.getSourceText() mythical-item source label', () => {
    const CELTIC_SESSION = 6627; // Province Celtic Britannia (Albion)
    // "Slainga Gaileanga" mythical-item effect. Targets a specific residence GUID only, so it is
    // not surfaced via island.availableEffects() (villa effects target only residence GUIDs, a
    // known pre-existing gap) - read it directly off assetsMap, same as tests/computed/mythical-item-needs.spec.ts.
    const MYTHICAL_ITEM_EFFECT_GUID = 166475;

    test('reports source "mythical-item" and localizes it to "Heroic Specialist"', async ({ page }) => {
        const configLoader = new ConfigLoader();
        const config = configLoader.createFullConfig([
            {
                name: 'Albion',
                session: CELTIC_SESSION
            }
        ]);
        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());

        const result = await page.evaluate(({ effectGuid }) => {
            const island = (window as any).view.island();
            const effect = island.assetsMap.get(effectGuid);
            return {
                effectFound: !!effect,
                source: effect?.source,
                sourceText: effect?.getSourceText ? effect.getSourceText() : undefined
            };
        }, { effectGuid: MYTHICAL_ITEM_EFFECT_GUID });

        expect(result.effectFound).toBe(true);
        expect(result.source).toBe('mythical-item');
        expect(result.sourceText).toBe('Heroic Specialist');
    });
});
