import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * `consumer-residence` (src/components.ts) used to call ResidencePresenter.update()
 * unconditionally, and update() sets aggregateMode(false). While aggregating, `$data.consumer` is
 * the FIRST REAL island's ResidenceBuilding, so the dialog opened fully editable against one
 * arbitrary island while All-Islands was still selected - every read-only gate bypassed, and the
 * user's edits silently landing on that island.
 *
 * ResidencePresenter.open() makes the update()/updateAggregate() decision itself, so no call site
 * can drop out of aggregate mode by accident.
 */

const ROMAN_SESSION = 3245;
const ALL_ISLANDS_NAME = 'All Islands';
const RESIDENCE_LIBERTI = 3087;

async function loadAggregateConfig(page: Page, islands: { name: string; session: number }[], activeIsland: string) {
    const cl = new ConfigLoader();
    const config = cl.createFullConfig(islands, { 'settings.aggregateAllIslands': '1' }, activeIsland);
    await cl.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.waitForTimeout(300);
}

test.describe('Population dialog entry points', () => {

    test('opening from a consumer row stays in aggregate mode', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        const result = await page.evaluate(({ RESIDENCE_LIBERTI }) => {
            const view = (window as any).view;
            for (const island of view.islands()) {
                if (island.isAllIslands()) continue;
                island.assetsMap.get(RESIDENCE_LIBERTI).buildings.constructed(12);
            }

            // Exactly what the consumer-residence component does on click: the consumer is the
            // FIRST REAL island's ResidenceBuilding, not the pseudo-island's.
            const firstReal = view.islands().find((i: any) => !i.isAllIslands());
            const populationLevel = firstReal.assetsMap.get(RESIDENCE_LIBERTI).populationLevel;
            view.presenter.residence.open(populationLevel);

            return {
                editable: view.presenter.residence.editable(),
                constructed: view.presenter.residence.buildings().constructed(),
            };
        }, { RESIDENCE_LIBERTI });

        expect(result.editable).toBe(false);
        expect(result.constructed).toBe(24);
    });

    test('opening on a real island is editable', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
        ], 'IslandA');

        const editable = await page.evaluate(({ RESIDENCE_LIBERTI }) => {
            const view = (window as any).view;
            const populationLevel = view.island().assetsMap.get(RESIDENCE_LIBERTI).populationLevel;
            view.presenter.residence.open(populationLevel);
            return view.presenter.residence.editable();
        }, { RESIDENCE_LIBERTI });

        expect(editable).toBe(true);
    });

    test('clicking a residence consumer row in the product dialog does not unlock editing', async ({ page }) => {
        await loadAggregateConfig(page, [
            { name: 'IslandA', session: ROMAN_SESSION },
            { name: 'IslandB', session: ROMAN_SESSION },
        ], ALL_ISLANDS_NAME);

        // Which products a tier actually consumes is params.js data that drifts (Bread, for one,
        // is monument-gated for Liberti and produces no demand at all), so discover a product that
        // genuinely has a residence consumer rather than hardcoding a guid.
        const productGuid = await page.evaluate(({ RESIDENCE_LIBERTI }) => {
            const view = (window as any).view;
            for (const island of view.islands()) {
                if (island.isAllIslands()) continue;
                island.assetsMap.get(RESIDENCE_LIBERTI).buildings.constructed(12);
                island.activateAllNeeds(true);
            }

            for (const entry of view.presenter.productByGuid) {
                const presenter = entry[1];
                // consumerViewVisible() gates the dialog's consumption section, which is where the
                // residence consumer rows live.
                if (presenter.consumerViewVisible())
                    return entry[0];
            }
            return null;
        }, { RESIDENCE_LIBERTI });

        expect(productGuid, 'no product with a visible consumer list in the fixture').not.toBeNull();

        await page.evaluate((guid) => {
            const view = (window as any).view;
            view.selectedProduct(view.presenter.productByGuid.get(guid));
        }, productGuid);

        await page.evaluate(() => (window as any).$('#product-config-dialog').modal('show'));
        await page.waitForSelector('#product-config-dialog.show');
        // The consumer list lives inside a collapsible that starts collapsed; Playwright cannot
        // click through a collapsed fieldset (tests/AGENTS.md).
        await page.evaluate(() => document.querySelector('#product-config-consumption')?.classList.add('show'));
        await page.waitForTimeout(300);

        // consumer-residence is rendered through a `component:` binding, so there is no
        // <consumer-residence> element in the DOM - only the clickable .inline-list it emits.
        const residenceRow = page.locator('#product-config-consumption .inline-list[style*="cursor: pointer"]').first();
        await expect(residenceRow).toBeVisible();
        await residenceRow.click();
        await page.waitForTimeout(700);

        const editable = await page.evaluate(() => (window as any).view.presenter.residence.editable());
        expect(editable).toBe(false);
    });
});
