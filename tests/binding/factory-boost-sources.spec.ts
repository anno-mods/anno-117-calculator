import { test, expect, Page, Locator } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

/**
 * Boost sources container of the factory config view: collapsed container with up to three groups
 * (equipped items, range effects, permanent effects), the productivity tooltip and the permanent effect
 * links. Fixtures: Furnace 3070 (Iron 2115), Bakery 3174 (Bread 2137), Spinner 3187 (item 160048 names the
 * island-wide effect 166439), effects 80565 (patron effect of Mars, productivity), 157428 (research, DLC 67904).
 */
const LATIUM_SESSION = 3245;
const ALBION_SESSION = 6627;
const IRON = 2115;
const FURNACE = 3070;
const BREAD = 2137;
const BAKERY = 3174;
const SPINNER = 3187;
const SPINNER_PRODUCT = 2141;
const CHARIOT_AND_CREW = 174824;
const CHARIOT_DLC = 67903;
const HEROIC_ITEM = 160048;
const HEROIC_EFFECT = 166439;
const PATRON_EFFECT = 80565;
const RESEARCH_EFFECT = 157428;

async function loadLatium(page: Page, routePatch?: string, extraIslands = false) {
    if (routePatch) {
        await page.route('**/js/params.js', async (route) => {
            const response = await route.fetch();
            await route.fulfill({ response, body: (await response.text()) + '\n' + routePatch });
        });
    }
    const configLoader = new ConfigLoader();
    if (extraIslands)
        await configLoader.loadConfigObject(page, configLoader.createFullConfig([
            { name: 'Latium', session: LATIUM_SESSION },
            { name: 'Albion', session: ALBION_SESSION },
        ], {}, 'Latium'));
    else
        await configLoader.loadConfigObject(page, configLoader.createIslandConfig('Latium', LATIUM_SESSION, {}));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
}

async function openDialog(page: Page, productGuid: number) {
    await page.evaluate((g) => {
        const view = (window as any).view;
        view.selectedProduct(view.presenter.productByGuid.get(g));
        (window as any).$('#product-config-dialog').modal('show');
    }, productGuid);
    await page.waitForSelector('#product-config-dialog.show', { state: 'visible', timeout: 8000 });
    await page.waitForTimeout(400);
}

function section(page: Page, factory: number): Locator {
    return page.locator(`#factories-tab-${factory} .factory-config-section`);
}

async function expand(page: Page, factory: number) {
    await section(page, factory).locator('legend[data-target="#factory-config-boost-sources"]').click();
    await expect(section(page, factory).locator('#factory-config-boost-sources')).toHaveClass(/show/);
    await page.waitForTimeout(400);
}

const text = (page: Page, key: string) => page.evaluate((k) => (window as any).view.texts[k].name(), key);

test.describe('Factory boost sources container', () => {
    test('AE1: collapsed by default, no group or formula visible, header shows count and net', async ({ page }) => {
        const errors = new BindingErrorDetector();
        errors.listenForErrors(page);
        await loadLatium(page);
        await page.evaluate((e) => { (window as any).view.island().assetsMap.get(e).scaling(1); }, PATRON_EFFECT);
        await openDialog(page, IRON);

        const s = section(page, FURNACE);
        await expect(s.locator('.boost-sources-row')).toHaveCount(1);
        await expect(s.locator('#factory-config-boost-sources')).not.toHaveClass(/show/);
        for (const head of await s.locator('.boost-group-head').all())
            await expect(head).toBeHidden();
        await expect(s.locator('.prod-tip')).toHaveCSS('visibility', 'hidden');

        const pairs = s.locator('.boost-head .boost-head-pair');
        await expect(pairs).toHaveCount(2);
        expect((await pairs.nth(0).textContent())!.trim()).toBe('1');
        expect((await pairs.nth(1).textContent())!).toContain('%');
        expect(errors.getErrorCounts().binding, errors.getFormattedBindingErrors().join(' | ')).toBe(0);
    });

    test('AE2/AE3: three groups in order; range effect has an Off/On toggle only, item the tri-state', async ({ page }) => {
        await loadLatium(page);
        await page.evaluate(({ dlc, effect }) => {
            (window as any).view.dlcsGuidMap.get(dlc).checked(true);
            (window as any).view.island().assetsMap.get(effect).scaling(1);
        }, { dlc: CHARIOT_DLC, effect: 43598 });
        await openDialog(page, BREAD);
        await expand(page, BAKERY);

        const s = section(page, BAKERY);
        const groups = await s.locator('.boost-group').evaluateAll(els => els.map(e => e.className.replace('boost-group ', '')));
        expect(groups).toEqual(['boost-group-items', 'boost-group-range', 'boost-group-permanent']);

        const toggle = s.locator(`#fc-${BAKERY}-${CHARIOT_AND_CREW}-equipped`);
        await expect(s.locator('.boost-group-range').locator(`#fc-${BAKERY}-${CHARIOT_AND_CREW}-equipped`)).toHaveCount(1);
        await expect(s.locator('.boost-group-items').locator(`#fc-${BAKERY}-${CHARIOT_AND_CREW}-equipped`)).toHaveCount(0);
        await expect(s.locator('.boost-group-range .boost-group-legend')).toHaveCount(0);
        await expect(s.locator('.boost-group-items .boost-group-legend .tri')).toHaveCount(3);

        const state = () => page.evaluate(({ e, f }) => {
            const island = (window as any).view.island();
            return island.assetsMap.get(e).slotStates.get(island.assetsMap.get(f))();
        }, { e: CHARIOT_AND_CREW, f: BAKERY });
        expect(await state()).toBe(0);
        await toggle.click();
        expect(await state()).toBe(1);
        await toggle.click();
        expect(await state()).toBe(0);
    });

    test('AE4: no Range effects heading without a qualifying range effect', async ({ page }) => {
        await loadLatium(page);
        await openDialog(page, IRON);
        await expand(page, FURNACE);
        await expect(section(page, FURNACE).locator('.boost-group-range')).toHaveCount(0);
        await expect(section(page, FURNACE).locator('.boost-group-head')).toHaveCount(1);
    });

    test('AE4: no container for a factory without items and active effects', async ({ page }) => {
        // no item targets any building, so the Bakery has no item and no active effect
        await loadLatium(page, `;window.params.items.forEach(i => { i.targets = []; });`);
        expect(await page.evaluate((f) => (window as any).view.island().assetsMap.get(f).boostSources.hasAny(), BAKERY)).toBe(false);
        await openDialog(page, BREAD);
        await expect(section(page, BAKERY)).toHaveCount(1);
        await expect(section(page, BAKERY).locator('.boost-sources-row')).toHaveCount(0);
    });
    test('AE5: permanent row is read-only with name and source, follows the effect; a time-limited effect has no row', async ({ page }) => {
        await loadLatium(page);
        await page.evaluate(({ e, furnace }) => {
            const island = (window as any).view.island();
            island.assetsMap.get(e).scaling(1);
            const timed = island.assetsMap.get(furnace).buffs().find((b: any) => b.parent.effectDuration && b.buff.productivityUpgrade !== 0);
            timed.parent.scaling(1);
        }, { e: RESEARCH_EFFECT, furnace: FURNACE });
        await openDialog(page, IRON);
        await expand(page, FURNACE);

        const rows = section(page, FURNACE).locator('.boost-group-permanent tbody tr');
        await expect(rows).toHaveCount(1);
        await expect(rows.first().locator('input, tri-state-toggle, .tri-state-toggle')).toHaveCount(0);
        const sourceText = await page.evaluate((e) => (window as any).view.island().assetsMap.get(e).getSourceText(), RESEARCH_EFFECT);
        await expect(rows.first().locator('.boost-source-line')).toHaveText(sourceText);

        await page.evaluate((e) => { (window as any).view.island().assetsMap.get(e).scaling(0); }, RESEARCH_EFFECT);
        await expect(section(page, FURNACE).locator('.boost-group-permanent')).toHaveCount(0);
    });

    test('AE10: heroic effect row names the item, stays after unchecking, link opens the Effects dialog, switching the effect off removes it', async ({ page }) => {
        await loadLatium(page);
        await openDialog(page, SPINNER_PRODUCT);
        await expand(page, SPINNER);

        const s = section(page, SPINNER);
        const toggle = s.locator(`#fc-${SPINNER}-${HEROIC_ITEM}-equipped`);
        const row = s.locator(`.boost-group-permanent tr[data-effect-guid="${HEROIC_EFFECT}"]`);
        await expect(row).toHaveCount(0);

        await toggle.click();
        await expect(row).toHaveCount(1);
        const itemName = await page.evaluate((g) => (window as any).view.island().assetsMap.get(g).name(), HEROIC_ITEM);
        await expect(row.locator('.boost-source-line')).toHaveText(itemName);

        await toggle.click(); // Boosted
        await toggle.click(); // Off
        await expect(row).toHaveCount(1);
        const sourceText = await page.evaluate((e) => (window as any).view.island().assetsMap.get(e).getSourceText(), HEROIC_EFFECT);
        await expect(row.locator('.boost-source-line')).toHaveText(sourceText);

        await row.locator('.boost-source-link').click();
        await page.waitForSelector('#effects-dialog.show', { state: 'visible', timeout: 8000 });
        await expect(page.locator('#product-config-dialog')).not.toHaveClass(/show/);
        const effectName = await page.evaluate((e) => (window as any).view.island().assetsMap.get(e).name(), HEROIC_EFFECT);
        expect(await page.evaluate(() => (window as any).view.effectsFilter.search())).toBe(effectName);
        expect(await page.evaluate(() => (window as any).view.effectsFilter.source())).toBe('mythical-item');
        expect(await page.evaluate((e) => (window as any).view.filteredEffects().some((x: any) => x.guid === e), HEROIC_EFFECT)).toBe(true);

        // switching the effect off removes the row, the item state stays
        const after = await page.evaluate(({ e, i, f }) => {
            const island = (window as any).view.island();
            const item = island.assetsMap.get(i);
            item.slotStates.get(island.assetsMap.get(f))(1);
            island.assetsMap.get(e).scaling(0);
            return { state: item.slotStates.get(island.assetsMap.get(f))(), rows: island.assetsMap.get(f).boostSources.permanentRows().length };
        }, { e: HEROIC_EFFECT, i: HEROIC_ITEM, f: SPINNER });
        expect(after).toEqual({ state: 1, rows: 0 });
    });

    test('the link of a patron effect opens the patron selection dialog', async ({ page }) => {
        await loadLatium(page);
        const owner = await page.evaluate(({ e, f }) => {
            const island = (window as any).view.island();
            island.assetsMap.get(e).scaling(1);
            return island.assetsMap.get(f).boostSources.permanentRows().find((r: any) => r.guid === e)?.owner;
        }, { e: PATRON_EFFECT, f: FURNACE });
        expect(owner).toBe('patron');

        await openDialog(page, IRON);
        await expand(page, FURNACE);
        await section(page, FURNACE).locator(`.boost-group-permanent tr[data-effect-guid="${PATRON_EFFECT}"] .boost-source-link`).click();
        await page.waitForSelector('#patron-selection-dialog.show', { state: 'visible', timeout: 8000 });
        await expect(page.locator('#product-config-dialog')).not.toHaveClass(/show/);
    });

    test('a research effect link pre-fills name and source; an unknown source leaves the filter at all', async ({ page }) => {
        await loadLatium(page, `window.params.effects.find(e => e.guid === ${PATRON_EFFECT}).source = 'unlisted-source';`);
        await page.evaluate(({ a }) => {
            const island = (window as any).view.island();
            island.assetsMap.get(a).scaling(1);
            island.patronEffects.length = 0; // resolved as a plain effect of the Effects dialog
        }, { a: PATRON_EFFECT });
        await openDialog(page, IRON);
        await expand(page, FURNACE);
        await section(page, FURNACE).locator(`.boost-group-permanent tr[data-effect-guid="${PATRON_EFFECT}"] .boost-source-link`).click();
        await page.waitForSelector('#effects-dialog.show', { state: 'visible', timeout: 8000 });
        expect(await page.evaluate(() => (window as any).view.effectsFilter.source())).toBe('all');
    });

    test('AE6: the productivity tooltip is hidden until hover or focus; its total equals the displayed value', async ({ page }) => {
        await loadLatium(page);
        await page.evaluate((e) => { (window as any).view.island().assetsMap.get(e).scaling(1); }, PATRON_EFFECT);
        await openDialog(page, IRON);

        const trigger = section(page, FURNACE).locator('.prod-trigger');
        const tip = section(page, FURNACE).locator('.prod-tip');
        await expect(tip).toHaveCSS('visibility', 'hidden');
        await trigger.focus();
        await expect(tip).toHaveCSS('visibility', 'visible');
        await trigger.evaluate((el) => (el as HTMLElement).blur());
        await expect(tip).toHaveCSS('visibility', 'hidden');
        await trigger.hover();
        await expect(tip).toHaveCSS('visibility', 'visible');

        const shown = (await section(page, FURNACE).locator('.prod-value').textContent())!.trim();
        const total = (await tip.locator('.prod-tip-total td').last().textContent())!.trim().replace(/\s+/g, '');
        expect(total).toBe(shown.replace(/\s+/g, '').replace('%', '') + '%');
        await expect(tip.locator('.prod-tip-fertility')).toHaveCount(0);
        await expect(tip.locator('.prod-tip-permanent')).toHaveCount(1);
        expect(await trigger.getAttribute('aria-label')).toBe(await text(page, 'productivityBreakdown'));
    });

    test('R11: without a productivity row there is no tooltip and the header claims no net', async ({ page }) => {
        await loadLatium(page);
        const target = await page.evaluate(() => {
            const view = (window as any).view;
            const island = view.island();
            for (const f of island.factories) {
                if (!f.neededFertility || !f.available() || !f.product)
                    continue;
                island.getIslandFertility(f.neededFertility.guid).checked(false);
                f.buffs().forEach((b: any) => { if (b.parent.source && !b.parent.slotStates) b.parent.scaling(0); });
                if (f.boostSources.hasAny() && view.presenter.productByGuid.get(f.product.guid)?.visibleFactories().length)
                    return { factory: f.guid, product: f.product.guid };
                island.getIslandFertility(f.neededFertility.guid).checked(true);
            }
            return null;
        });
        test.skip(!target, 'no fertility factory with items on the Latium island');
        await openDialog(page, target!.product);
        const s = section(page, target!.factory);
        await expect(s.locator('.prod-trigger')).toHaveCount(0);
        await expect(s.locator('.boost-head .boost-head-pair')).toHaveCount(1);
    });

    test('every icon of the container and the tooltip carries a title; base additions and productivity differ', async ({ page }) => {
        await loadLatium(page, `window.params.buildingBuffs.find(b => b.guid === 157429).baseProductivityUpgrade = 5;`);
        await page.evaluate(({ e, dlc }) => {
            (window as any).view.dlcsGuidMap.get(dlc).checked(true);
            (window as any).view.island().assetsMap.get(e).scaling(1);
            (window as any).view.island().assetsMap.get(3070).modules.forEach((m: any) => m.checked(true));
        }, { e: RESEARCH_EFFECT, dlc: CHARIOT_DLC });
        await openDialog(page, IRON);
        await expand(page, FURNACE);

        const missing = await section(page, FURNACE).evaluate((root) => {
            const out: string[] = [];
            const scope = root.querySelectorAll('.boost-sources-row, .prod-tip');
            scope.forEach((area) => {
                area.querySelectorAll('img, span.fa').forEach((el) => {
                    if (el.getAttribute('aria-hidden') === 'true' || el.classList.contains('fa-chevron-right') || el.classList.contains('fa-chevron-down'))
                        return;
                    if (el.closest('tri-state-toggle, .tri-state-toggle, external-link, .boost-group-head, legend'))
                        return;
                    const holder = el.closest('[title]');
                    if (!holder || !holder.getAttribute('title'))
                        out.push(el.outerHTML.slice(0, 120));
                });
            });
            return out;
        });
        expect(missing).toEqual([]);

        const base = await text(page, 'boostBaseAddition');
        const productivity = await text(page, 'productivity');
        expect(base).not.toBe(productivity);
        const permanent = section(page, FURNACE).locator('.boost-group-permanent');
        await expect(permanent.locator(`[title="${base}"]`)).toHaveCount(1);
        await expect(permanent.locator(`[title="${productivity}"]`)).toHaveCount(1);
    });

    test('switching islands with the dialog open raises no binding errors', async ({ page }) => {
        const errors = new BindingErrorDetector();
        errors.listenForErrors(page);
        const pageErrors: string[] = [];
        page.on('pageerror', (e) => pageErrors.push(e.message));
        await loadLatium(page, undefined, true);
        await page.evaluate((e) => { (window as any).view.island().assetsMap.get(e).scaling(1); }, PATRON_EFFECT);
        await openDialog(page, IRON);
        await page.evaluate(() => {
            const view = (window as any).view;
            view.island(view.islands().find((i: any) => i.name() === 'Albion'));
        });
        await page.waitForTimeout(400);
        await page.evaluate(() => {
            const view = (window as any).view;
            view.island(view.islands().find((i: any) => i.name() === 'Latium'));
        });
        await page.waitForTimeout(400);
        expect(pageErrors).toEqual([]);
        expect(errors.getErrorCounts().binding, errors.getFormattedBindingErrors().join(' | ')).toBe(0);
        expect(errors.getErrorCounts().knockout, errors.getFormattedKnockoutErrors().join(' | ')).toBe(0);
    });

    test('AE7: the open or closed state of the container is stored under its id', async ({ page }) => {
        await loadLatium(page);
        await page.evaluate((e) => { (window as any).view.island().assetsMap.get(e).scaling(1); }, PATRON_EFFECT);
        await openDialog(page, IRON);
        const stored = () => page.evaluate(() => {
            const json = JSON.parse(localStorage.getItem('collapsibleStates') || '{}');
            return json['factory-config-boost-sources'];
        });
        await expand(page, FURNACE);
        await expect.poll(stored).toBe(0);                                   // stored 0 = open
        await section(page, FURNACE).locator('legend[data-target="#factory-config-boost-sources"]').click();
        await expect.poll(stored).not.toBe(0);                               // closed again
    });
});
