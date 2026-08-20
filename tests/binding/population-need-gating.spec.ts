import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

// Frontend regression guard: the population-needs presenter (ResidencePresenter ->
// NeedCategoryPresenter -> PopulationLevelNeedPresenter) must not render a conditional
// (mythical-item / monument) need until its granting effect is active. Visibility flows through
// PopulationLevelNeedPresenter.visible, which must honour PopulationLevelNeed.hidden() - not just
// available(). Bread (2689) is gated on Liberti behind the Amphitheatre Splendour IV effect (159339).
test.describe('Population-needs presenter hides gated needs', () => {
    const LATIUM_SESSION = 3245;
    const LIBERTI_POPULATION_LEVEL_GUID = 1499;
    const LIBERTI_RESIDENCE_GUID = 3087;
    const BREAD_NEED_GUID = 2689;         // gated behind the Amphitheatre effect on Liberti
    const AMPHITHEATRE_IV_EFFECT_GUID = 159339;
    const PLAIN_NEED_GUID = 2665;         // a plain ungated Liberti base need (control)

    test.beforeEach(async ({ page }) => {
        const configLoader = new ConfigLoader();
        const config = configLoader.createFullConfig([
            { name: 'Latium', session: LATIUM_SESSION, data: { '3087.buildings.constructed': '100' } },
        ]);
        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    });

    // Reads which need GUIDs the residence presenter currently renders (visible) for the Liberti tier.
    async function visibleNeedGuids(page: any): Promise<number[]> {
        return page.evaluate((popLevelGuid: number) => {
            const view = (window as any).view;
            const level = view.island().assetsMap.get(popLevelGuid);
            const presenter = view.presenter.residence;
            presenter.update(level); // point the presenter at the Liberti population level
            const guids: number[] = [];
            for (const category of presenter.visibleNeedCategories()) {
                for (const need of category.visiblePopulationLevelNeeds()) {
                    guids.push(need.guid);
                }
            }
            return guids;
        }, LIBERTI_POPULATION_LEVEL_GUID);
    }

    test('a gated need is not rendered until its effect is active; a plain need always is', async ({ page }) => {
        const before = await visibleNeedGuids(page);
        expect(before).toContain(PLAIN_NEED_GUID);      // plain base need always shown
        expect(before).not.toContain(BREAD_NEED_GUID);  // gated need hidden while effect is off

        await page.evaluate(({ effectGuid, residenceGuid }) => {
            const island = (window as any).view.island();
            // Effect targets a specific residence GUID, so read it directly off assetsMap.
            void residenceGuid;
            island.assetsMap.get(effectGuid).scaling(1);
        }, { effectGuid: AMPHITHEATRE_IV_EFFECT_GUID, residenceGuid: LIBERTI_RESIDENCE_GUID });

        const after = await visibleNeedGuids(page);
        expect(after).toContain(PLAIN_NEED_GUID);       // plain need still shown
        expect(after).toContain(BREAD_NEED_GUID);       // gated need now shown
    });
});
