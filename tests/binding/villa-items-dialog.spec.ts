import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

// Villa items dialog (plan 2026-11-12-002 U6). Expectations are derived from window.params, the island and the DOM,
// never from the view model's own sort values. The named GUIDs are the items the scenarios talk about:
//   149292  residents 2 / 3 and consumption -5 % / -10 % (Base / Boosted)
//   160084  Bread -20 % / -30 % (goodConsumptionUpgrade), no residents, no consumption change
//   51835   no boost variant, +2 Population while the Bread need is supplied
const LATIUM = 3245;
const NANNY = 149292;
const BREAD_ITEM = 160084;
const BREAD_NEED_ITEM = 51835;
const BREAD = 2137;
const PLEBEIANS_RESIDENCE = 3141;
const BREAD_NEED = 2689;
const LIBERTI_LEVEL = 1499;
const SORT_KEY = 'villaItemsSort';

async function loadIsland(page: Page, extra: { data?: Record<string, any>; settings?: Record<string, any>; patch?: string; initScript?: () => void } = {}) {
    if (extra.patch) {
        const patch = extra.patch;
        await page.route('**/js/params.js', async (route) => {
            const response = await route.fetch();
            await route.fulfill({ response, body: (await response.text()) + '\n;' + patch });
        });
    }
    if (extra.initScript) await page.addInitScript(extra.initScript);
    const cl = new ConfigLoader();
    await cl.loadConfigObject(page, cl.createIslandConfig('Latium', LATIUM, extra.data ?? {}, extra.settings ?? {}));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island() && (window as any).view.villaItems);
}

const openDialog = async (page: Page) => {
    await page.evaluate(() => (window as any).$('#villa-items-dialog').modal('show'));
    await page.waitForSelector('#villa-items-dialog.show', { state: 'visible' });
};

const setState = (page: Page, item: number, state: number) =>
    page.evaluate(({ item, state }) => { (window as any).view.island().assetsMap.get(item).slotStates.values().next().value(state); }, { item, state });

/** The item GUIDs of the rows in the order of the table. */
const rowOrder = (page: Page) =>
    page.$$eval('#villa-items-table tbody tr', (rows) => rows.map((r) => Number((r as HTMLElement).dataset.item)));

const villaGuids = (page: Page) => page.evaluate(() => (window as any).view.island().residenceItems.map((i: any) => i.guid as number));

test.describe('villa items dialog (U6)', () => {
    let detector: BindingErrorDetector;

    test.beforeEach(({ page }) => {
        detector = new BindingErrorDetector();
        detector.listenForErrors(page);
    });

    test('the table has one row per villa item, the columns follow params.needAttributes and no tabs exist', async ({ page }) => {
        await loadIsland(page);
        await openDialog(page);
        const shape = await page.evaluate(() => {
            const w = window as any;
            const heads = Array.from(document.querySelectorAll('#villa-items-table thead th')) as HTMLElement[];
            const rows = Array.from(document.querySelectorAll('#villa-items-table tbody tr')) as HTMLElement[];
            return {
                keys: heads.map((h) => h.dataset.sortKey),
                scopes: heads.map((h) => h.getAttribute('scope')),
                attributeIds: w.view.needAttributes.map((a: any) => a.id),
                attributeIcons: w.view.needAttributes.map((a: any) => a.icon),
                attributeNames: w.view.needAttributes.map((a: any) => a.name()),
                headerImages: heads.map((h) => { const i = h.querySelector('img'); return i ? { src: i.getAttribute('src'), title: i.getAttribute('title') } : null; }),
                cellCounts: rows.map((r) => r.children.length),
                rowCount: rows.length,
                villaCount: w.view.island().residenceItems.length,
                tabs: document.querySelectorAll('#villa-items-dialog [data-toggle="tab"], #villa-items-dialog .nav-tabs').length,
                headerText: heads.map((h) => h.textContent!.trim()),
            };
        });
        const n = shape.attributeIds.length;
        expect(shape.keys.length).toBe(5 + n);
        expect(shape.keys).toEqual(['state', 'name', 'targets', ...shape.attributeIds.map((id: string) => 'attr:' + id), 'consumption', 'additional']);
        expect(shape.scopes.every((s) => s === 'col')).toBe(true);
        expect(shape.rowCount).toBe(shape.villaCount);
        expect(shape.rowCount).toBeGreaterThan(0);
        for (const c of shape.cellCounts) expect(c).toBe(5 + n);
        expect(shape.tabs).toBe(0);
        // target residences header: the residence icon with the title "Target residences"
        expect(shape.headerImages[2]!.src).toMatch(/icon_house_white\.png$/);
        expect(shape.headerImages[2]!.title).toBe('Target residences');
        // attribute headers carry the params icon and the attribute name
        for (let i = 0; i < n; i++) {
            expect(shape.headerImages[3 + i]!.src).toBe(shape.attributeIcons[i]);
            expect(shape.headerImages[3 + i]!.title).toBe(shape.attributeNames[i]);
        }
        // only the additional-effects header carries text; there is no DLC, rarity or radius column
        expect(shape.headerText.filter((t) => t !== '')).toEqual([await page.evaluate(() => (window as any).view.texts.villaColAdditional.name())]);
        expect(detector.hasBindingError(), detector.getFormattedBindingErrors().join('\n')).toBe(false);
    });

    test('entry points: the Effects dialog header button opens the dialog, the population dialog link too', async ({ page }) => {
        await loadIsland(page, { data: { '3087.buildings.constructed': 2, 'island.effect.99014.scaling': 1 } });
        await page.evaluate(() => (window as any).$('#effects-dialog').modal('show'));
        await page.waitForSelector('#effects-dialog.show', { state: 'visible' });
        await page.locator('#effects-dialog .modal-header button:has(.fa-home)').click();
        await page.waitForSelector('#villa-items-dialog.show', { state: 'visible' });
        await page.waitForTimeout(600); // let the fade finish, a hide during the transition is ignored
        await page.evaluate(() => (window as any).$('#villa-items-dialog').modal('hide'));
        await page.waitForSelector('#villa-items-dialog.show', { state: 'hidden' });

        await page.evaluate((level) => {
            const w = window as any;
            w.view.presenter.residence.open(w.view.island().assetsMap.get(level));
            w.$('#population-level-config-dialog').modal('show');
        }, LIBERTI_LEVEL);
        await page.waitForSelector('#population-level-config-dialog.show', { state: 'visible' });
        // the area effects block is collapsed by default
        await page.evaluate(() => (window as any).$('#population-level-config-dialog .collapse').addClass('show'));
        await page.locator('#population-level-config-dialog button:has(.fa-home)').click();
        await page.waitForSelector('#villa-items-dialog.show', { state: 'visible' });
        expect(detector.hasBindingError(), detector.getFormattedBindingErrors().join('\n')).toBe(false);
    });

    test('AE5: "bread" shows the villa items whose effect text mentions Bread, and clearing restores the list', async ({ page }) => {
        await loadIsland(page);
        await openDialog(page);
        const all = await rowOrder(page);
        const expected: number[] = await page.evaluate(() => {
            const w = window as any;
            const island = w.view.island();
            const buffs = new Map(w.params.buildingBuffs.map((b: any) => [b.guid, b]));
            const names = new Map(w.params.products.map((p: any) => [p.guid, p.name]));
            const mentions = (item: any) => {
                const goods: number[] = [];
                for (const g of [...(item.buffs || []), ...(item.boostBuffs || [])]) {
                    const b: any = buffs.get(g);
                    for (const e of b.goodConsumptionUpgrade || []) goods.push(e.product);
                    for (const e of b.needAttributes || []) goods.push(...e.products);
                }
                return goods.some((g) => String(names.get(g)).toLowerCase().includes('bread'));
            };
            return island.residenceItems.filter((i: any) => mentions(w.params.items.find((x: any) => x.guid === i.guid))).map((i: any) => i.guid);
        });
        expect(expected).toContain(BREAD_ITEM);
        expect(expected).toContain(BREAD_NEED_ITEM);
        await page.fill('#villa-items-search', 'bread');
        const found = await rowOrder(page);
        expect([...found].sort()).toEqual([...expected].sort());
        expect(found.length).toBeLessThan(all.length);
        await page.fill('#villa-items-search', '');
        expect(await rowOrder(page)).toEqual(all);
    });

    test('the control cycles Off, Base, Boosted for a boostable item and Off, Base for the others', async ({ page }) => {
        await loadIsland(page);
        await openDialog(page);
        const toggle = (item: number) => page.locator(`#villa-items-table tr[data-item="${item}"] .tri-state-toggle`);
        const state = (item: number) => page.evaluate((i) => (window as any).view.island().assetsMap.get(i).slotStates.values().next().value(), item);
        const seen: number[] = [];
        for (let i = 0; i < 4; i++) { await toggle(NANNY).click(); seen.push(await state(NANNY)); }
        expect(seen).toEqual([1, 2, 0, 1]);
        const plain: number[] = [];
        for (let i = 0; i < 3; i++) { await toggle(BREAD_NEED_ITEM).click(); plain.push(await state(BREAD_NEED_ITEM)); }
        expect(plain).toEqual([1, 0, 1]);
    });

    test('AE7: a state changed in the dialog is exported', async ({ page }) => {
        await loadIsland(page);
        await openDialog(page);
        await page.locator(`#villa-items-table tr[data-item="${NANNY}"] .tri-state-toggle`).click();
        await page.locator(`#villa-items-table tr[data-item="${NANNY}"] .tri-state-toggle`).click();
        await page.evaluate(() => new Promise<void>((r) => setTimeout(() => setTimeout(r, 30), 30)));
        const entry = await page.evaluate((i) => {
            const doc = (window as any).exchange.exportDocument().document;
            const isl = doc.islands.find((x: any) => x.name === 'Latium');
            return (isl.residenceItems || []).find((e: any) => e.item === i);
        }, NANNY);
        expect(entry).toEqual({ item: NANNY, boosted: true });
    });

    test('AE12: raw values of the active variant, a dash where the item has none, independent of the coverage', async ({ page }) => {
        await loadIsland(page);
        await openDialog(page);
        const cells = (item: number) => page.evaluate((i) => {
            const row = document.querySelector(`#villa-items-table tr[data-item="${i}"]`)!;
            const text = (sel: string) => Array.from(row.querySelectorAll(sel)).map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim());
            const chips = (c: Element) => Array.from(c.querySelectorAll('.villa-chip')).map((e) => ({ text: (e.textContent || '').replace(/\s+/g, ' ').trim(), title: e.getAttribute('title') }));
            const attr = (id: string) => chips(row.querySelector(`td[data-attribute="${id}"]`)!);
            return {
                population: attr('Population'),
                populationDash: !!row.querySelector('td[data-attribute="Population"] .villa-dash'),
                consumption: text('td.villa-consumption'),
                additional: chips(row.querySelector('td.villa-additional')!),
            };
        }, item);
        const bread = await page.evaluate((g) => (window as any).view.island().assetsMap.get(g).name(), BREAD);

        const base = await cells(NANNY);
        expect(base.population.map((c) => c.text)).toEqual(['+2']);
        expect(base.consumption[0]).toBe('-5 %');
        await setState(page, NANNY, 2);
        const boosted = await cells(NANNY);
        expect(boosted.population.map((c) => c.text)).toEqual(['+3']);
        expect(boosted.consumption[0]).toBe('-10 %');

        const breadBase = await cells(BREAD_ITEM);
        expect(breadBase.populationDash).toBe(true);
        expect(breadBase.consumption[0]).toBe('–');
        expect(breadBase.additional.map((c) => c.text)).toEqual(['-20 %']);
        expect(breadBase.additional[0].title).toBe(`${bread} -20 %`);
        await setState(page, BREAD_ITEM, 2);
        expect((await cells(BREAD_ITEM)).additional.map((c) => c.text)).toEqual(['-30 %']);

        // a supplied-need contribution carries the good icon and its name in the title
        const supplied = await cells(BREAD_NEED_ITEM);
        expect(supplied.population).toEqual([{ text: '+2', title: `${bread} +2` }]);
        const icon = await page.locator(`#villa-items-table tr[data-item="${BREAD_NEED_ITEM}"] td[data-attribute="Population"] .villa-chip img`).getAttribute('title');
        expect(icon).toBe(bread);

        // the coverage changes the calculation and no number of the table
        const before = await page.locator('#villa-items-table tbody').innerText();
        const demand = () => page.evaluate(({ r, n }) => {
            const res = (window as any).view.island().assetsMap.get(r);
            res.buildings.constructed(10);
            res.needsMap.get(n).checked(true);
            return res.needsMap.get(n).amount();
        }, { r: PLEBEIANS_RESIDENCE, n: BREAD_NEED });
        await setState(page, BREAD_ITEM, 1);
        const full = await demand();
        await page.locator('#villa-coverage-input').fill('50');
        expect(await page.evaluate(() => (window as any).view.island().villaCoverage())).toBe(50);
        expect(await demand()).toBeGreaterThan(full);
        expect(await page.locator('#villa-coverage-output').innerText()).toBe('50 %');
        await setState(page, BREAD_ITEM, 2);
        await setState(page, NANNY, 2);
        expect(await page.locator('#villa-items-table tbody').innerText()).toBe(before);
    });

    test('AE3 and R14: entries without calculator data produce no row and no mark', async ({ page }) => {
        await loadIsland(page, { data: {} });
        const text = JSON.stringify({
            format: 'anno117-exchange', formatVersion: '1.0', generator: { name: 'u6' },
            islands: [{ id: 'x', name: 'Latium', session: LATIUM, residenceItems: [{ item: 999999999 }, { item: 41352, boosted: true }, { item: NANNY }] }],
        });
        await page.evaluate((t) => {
            const ex = (window as any).exchange;
            const plan = ex.planImport(t);
            ex.applyImport(plan, { reload: false });
        }, text);
        await page.reload();
        await page.waitForFunction(() => (window as any).view && (window as any).view.villaItems);
        await openDialog(page);
        const guids = await rowOrder(page);
        const villa = await villaGuids(page);
        expect(guids.length).toBe(villa.length);
        expect(guids).not.toContain(41352);
        expect(await page.locator('#villa-items-dialog [disabled]').count()).toBe(0);
        expect(await page.locator('#villa-items-dialog').innerText()).not.toMatch(/kept|999999999/i);
    });

    test('every icon-only control has a title and an aria-label, headers and sort indicators included', async ({ page }) => {
        await loadIsland(page);
        await openDialog(page);
        const missing = await page.evaluate(() => {
            const out: string[] = [];
            document.querySelectorAll('#villa-items-dialog img').forEach((e, i) => { if (!e.getAttribute('title') || !e.getAttribute('alt')) out.push('img ' + i + ' ' + e.getAttribute('src')?.slice(0, 40)); });
            document.querySelectorAll('#villa-items-dialog button:not(.close), #villa-items-dialog .tri-state-toggle, #villa-items-dialog [role="img"]').forEach((e, i) => {
                if (!e.getAttribute('title') || !e.getAttribute('aria-label')) out.push(e.tagName + ' ' + i + ' ' + e.className);
            });
            return out;
        });
        expect(missing).toEqual([]);
    });

    test('opening and sorting leave the bootstrap arrays alone', async ({ page }) => {
        await loadIsland(page);
        await page.evaluate(() => {
            const w = window as any;
            w.__refs = { groups: w.view.template.populationGroups, cats: w.view.presenter.categories.map((c: any) => c.productPresenters) };
        });
        await openDialog(page);
        await page.locator('#villa-items-table th[data-sort-key="state"] button').click();
        await page.locator('#villa-items-table th[data-sort-key="attr:Population"] button').click();
        const same = await page.evaluate(() => {
            const w = window as any;
            return w.__refs.groups === w.view.template.populationGroups
                && w.__refs.cats.every((a: any, i: number) => a === w.view.presenter.categories[i].productPresenters);
        });
        expect(same).toBe(true);
        expect(detector.hasBindingError(), detector.getFormattedBindingErrors().join('\n')).toBe(false);
    });

    test('the factory dialogs list no villa item and have no link to the villa dialog', async ({ page }) => {
        await loadIsland(page);
        const leaks = await page.evaluate(() => {
            const w = window as any;
            const island = w.view.island();
            const villa = new Set(island.residenceItems.map((i: any) => i.guid));
            const inItems = island.items.some((i: any) => villa.has(i.guid));
            const inFactories = island.consumers.some((c: any) => (c.availableItems ? c.availableItems() : []).some((e: any) => villa.has(e.parent.guid)));
            const links = document.querySelectorAll('#product-config-dialog [data-target="#villa-items-dialog"], #product-config-dialog .fa-home').length;
            return { inItems, inFactories, links };
        });
        expect(leaks).toEqual({ inItems: false, inFactories: false, links: 0 });
    });

    test('the dialog and both entry buttons are absent on the All-Islands pseudo-island', async ({ page }) => {
        await loadIsland(page);
        await page.evaluate(() => { const w = (window as any); w.view.island(w.view.islands().find((i: any) => i.isAllIslands())); });
        await openDialog(page);
        expect(await page.locator('#villa-items-table').count()).toBe(0);
        expect(await page.locator('#villa-coverage-input').count()).toBe(0);
        await page.evaluate(() => (window as any).$('#villa-items-dialog').modal('hide'));
        await page.evaluate(() => (window as any).$('#effects-dialog').modal('show'));
        await page.waitForSelector('#effects-dialog.show', { state: 'visible' });
        expect(await page.locator('#effects-dialog .modal-header button:has(.fa-home)').count()).toBe(0);
        expect(detector.hasBindingError(), detector.getFormattedBindingErrors().join('\n')).toBe(false);
    });
});

test.describe('villa items dialog: the island-wide effect icon (AE6, R11d)', () => {
    const patch = (effect: number) => `(function () {
        var item = window.params.items.find(function (i) { return i.guid === ${BREAD_ITEM}; });
        item.heroicEffect = ${effect};
    })();`;

    const anyHeroicEffect = async (page: Page): Promise<number> => {
        await loadIsland(page);
        return page.evaluate(() => {
            const island = (window as any).view.island();
            const i = island.items.find((x: any) => x.heroicEffectGuid && island.assetsMap.get(x.heroicEffectGuid)?.buffGuids?.length);
            return i.heroicEffectGuid as number;
        });
    };

    test('the icon is dim before activation, lit after, stays lit at Off and links to the Effects dialog', async ({ page }) => {
        const effect = await anyHeroicEffect(page);
        const fresh = page;
        await loadIsland(fresh, { patch: patch(effect) });
        await openDialog(fresh);
        const icon = fresh.locator(`#villa-items-table tr[data-item="${BREAD_ITEM}"] .villa-heroic`);
        const withoutIcon = fresh.locator(`#villa-items-table tr[data-item="${NANNY}"] .villa-heroic`);
        expect(await withoutIcon.count()).toBe(0);
        const lit = async () => (await icon.getAttribute('class'))!.includes('villa-heroic-lit');
        expect(await lit()).toBe(false);
        await setState(fresh, BREAD_ITEM, 1);
        expect(await lit()).toBe(true);
        await setState(fresh, BREAD_ITEM, 2);
        await setState(fresh, BREAD_ITEM, 0);
        expect(await lit()).toBe(true);
        const effectName = await fresh.evaluate((g) => (window as any).view.island().assetsMap.get(g).name(), effect);
        expect(await icon.getAttribute('title')).toContain(effectName);
        expect(await icon.getAttribute('title')).toContain('Island-wide effect');
        // an effect switched off in the Effects dialog stays off while the item stays equipped
        await icon.click();
        await fresh.waitForSelector('#effects-dialog.show', { state: 'visible' });
        expect(await fresh.locator('#villa-items-dialog.show').count()).toBe(0);
        expect(await fresh.inputValue('#effects-dialog input[type="text"]')).toBe(effectName);
        await fresh.evaluate((g) => { (window as any).view.island().assetsMap.get(g).scaling(0); }, effect);
        expect(await fresh.evaluate((i) => (window as any).view.island().assetsMap.get(i).slotStates.values().next().value(), BREAD_ITEM)).toBe(0);
        expect(await fresh.evaluate((g) => (window as any).view.island().assetsMap.get(g).scaling(), effect)).toBe(0);
    });
});

test.describe('villa items dialog: sort (AE11)', () => {
    let detector: BindingErrorDetector;

    test.beforeEach(({ page }) => {
        detector = new BindingErrorDetector();
        detector.listenForErrors(page);
    });

    interface Cell { name: string; state: number; targets: number; tier: number; attr: Record<string, number>; consumption: number; additionalCount: number; additionalMax: number }

    /** Per row: the values of the cells as the table shows them. */
    const readCells = (page: Page): Promise<Record<number, Cell>> => page.evaluate(() => {
        const w = window as any;
        const levels = w.view.island().populationLevels.map((l: any) => l.name());
        const num = (t: string) => { const m = t.replace(/\s+/g, '').match(/^[+-]?[\d.,]+/); return m ? parseFloat(m[0].replace(',', '.')) : 0; };
        const out: Record<number, any> = {};
        document.querySelectorAll('#villa-items-table tbody tr').forEach((row) => {
            const guid = Number((row as HTMLElement).dataset.item);
            const chips = (c: Element) => Array.from(c.querySelectorAll('.villa-chip')).map((e) => num((e.textContent || '').trim()));
            const attr: Record<string, number> = {};
            for (const a of w.view.needAttributes) attr[a.id] = chips(row.querySelector(`td[data-attribute="${a.id}"]`)!).reduce((s, v) => s + v, 0);
            const tiers = Array.from(row.querySelectorAll('td.villa-targets img')).map((i) => levels.indexOf(i.getAttribute('title')));
            const additional = chips(row.querySelector('td.villa-additional')!);
            out[guid] = {
                name: (row.querySelector('.villa-item-name span')!.textContent || '').trim(),
                state: w.view.island().assetsMap.get(guid).slotStates.values().next().value(),
                targets: tiers.length,
                tier: Math.min(...tiers),
                attr,
                consumption: chips(row.querySelector('td.villa-consumption')!)[0] ?? 0,
                additionalCount: additional.length,
                additionalMax: additional.reduce((m, v) => Math.max(m, Math.abs(v)), 0),
            };
        });
        return out;
    });

    const click = (page: Page, key: string) => page.locator(`#villa-items-table th[data-sort-key="${key}"] button`).click();
    const ariaSort = (page: Page, key: string) => page.locator(`#villa-items-table th[data-sort-key="${key}"]`).getAttribute('aria-sort');

    test('each column sorts in its first direction, reverses on the second click and falls back to the name', async ({ page }) => {
        await loadIsland(page);
        await openDialog(page);
        const guids = await villaGuids(page);
        // spread the states so the state column has three values: three boostable items at 0, 1 and 2
        const boostable: number[] = await page.evaluate(() => (window as any).view.island().residenceItems.filter((i: any) => i.boostEquipments.length > 0).map((i: any) => i.guid));
        await setState(page, boostable[0], 0);
        await setState(page, boostable[1], 1);
        await setState(page, boostable[2], 2);
        const cells = await readCells(page);
        const collator = new Intl.Collator('en', { numeric: true });
        const byName = (a: number, b: number) => collator.compare(cells[a].name, cells[b].name);
        const attributeIds: string[] = await page.evaluate(() => (window as any).view.needAttributes.map((a: any) => a.id));

        const value: Record<string, (g: number) => number> = {
            state: (g) => cells[g].state,
            targets: (g) => cells[g].targets * 1000 + cells[g].tier,
            consumption: (g) => cells[g].consumption,
            additional: (g) => cells[g].additionalCount * 1e6 + cells[g].additionalMax,
            ...Object.fromEntries(attributeIds.map((id) => [`attr:${id}`, (g: number) => cells[g].attr[id]])),
        };
        const expected = (key: string, dir: 1 | -1): number[] => {
            if (key === 'name') return [...guids].sort((a, b) => dir * byName(a, b) || byName(a, b));
            const v = value[key];
            return [...guids].sort((a, b) => dir * (v(a) - v(b)) || byName(a, b));
        };

        const keys = ['state', 'name', 'targets', ...attributeIds.map((id) => 'attr:' + id), 'consumption', 'additional'];
        for (const key of keys) {
            const first = key.startsWith('attr:') || key === 'consumption' || key === 'additional' ? -1 : 1;
            await click(page, key);
            expect(await ariaSort(page, key), `${key} first click`).toBe(first === 1 ? 'ascending' : 'descending');
            for (const other of keys.filter((k) => k !== key)) expect(await ariaSort(page, other)).toBe('none');
            expect(await rowOrder(page), `${key} first click order`).toEqual(expected(key, first));
            await click(page, key);
            expect(await ariaSort(page, key)).toBe(first === 1 ? 'descending' : 'ascending');
            expect(await rowOrder(page), `${key} second click order`).toEqual(expected(key, (first * -1) as 1 | -1));
        }
        expect(detector.hasBindingError(), detector.getFormattedBindingErrors().join('\n')).toBe(false);
    });

    test('the coverage changes no order, and a state change re-sorts without losing rows or the search text', async ({ page }) => {
        await loadIsland(page);
        await openDialog(page);
        const guids = await villaGuids(page);
        await click(page, 'state');
        const first = await rowOrder(page);
        await page.locator('#villa-coverage-input').fill('20');
        expect(await rowOrder(page)).toEqual(first);
        await page.fill('#villa-items-search', 'a');
        const searched = await rowOrder(page);
        await setState(page, searched[0], 1);
        const after = await rowOrder(page);
        expect([...after].sort()).toEqual([...searched].sort());
        expect(await page.inputValue('#villa-items-search')).toBe('a');
        expect(await page.locator('#villa-items-dialog.show').count()).toBe(1);
        await page.fill('#villa-items-search', '');
        expect((await rowOrder(page)).length).toBe(guids.length);
    });

    test('the sort order is kept on the device; invalid or unreadable storage falls back to name ascending', async ({ page }) => {
        await loadIsland(page);
        await openDialog(page);
        await click(page, 'consumption');
        const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), SORT_KEY);
        expect(stored).toEqual({ key: 'consumption', dir: -1 });
        await page.reload();
        await page.waitForFunction(() => (window as any).view && (window as any).view.villaItems);
        await openDialog(page);
        expect(await ariaSort(page, 'consumption')).toBe('descending');

        for (const bad of ['"x"', '{"key":"nope","dir":3}', '{"key":"state","dir":2}']) {
            const q = await page.context().newPage();
            await q.addInitScript((value: string) => localStorage.setItem('villaItemsSort', value), bad);
            const cl = new ConfigLoader();
            await cl.loadConfigObject(q, cl.createIslandConfig('Latium', LATIUM));
            await q.goto('/');
            await q.waitForFunction(() => (window as any).view && (window as any).view.villaItems);
            await openDialog(q);
            expect(await ariaSort(q, 'name'), bad).toBe('ascending');
            await q.close();
        }

        const t = await page.context().newPage();
        const errors = new BindingErrorDetector();
        errors.listenForErrors(t);
        await t.addInitScript(() => {
            const get = Storage.prototype.getItem;
            const set = Storage.prototype.setItem;
            Storage.prototype.getItem = function (k: string) { if (k === 'villaItemsSort') throw new Error('blocked'); return get.call(this, k); };
            Storage.prototype.setItem = function (k: string, v: string) { if (k === 'villaItemsSort') throw new Error('blocked'); return set.call(this, k, v); };
        });
        const cl = new ConfigLoader();
        await cl.loadConfigObject(t, cl.createIslandConfig('Latium', LATIUM));
        await t.goto('/');
        await t.waitForFunction(() => (window as any).view && (window as any).view.villaItems);
        await openDialog(t);
        expect(await ariaSort(t, 'name')).toBe('ascending');
        await click(t, 'state');
        expect(await ariaSort(t, 'state')).toBe('ascending');
        expect(errors.hasBindingError(), errors.getFormattedBindingErrors().join('\n')).toBe(false);
        await t.close();
    });

    test('the language sets the collation of the item column', async ({ page }) => {
        await loadIsland(page);
        await openDialog(page);
        await page.evaluate(() => (window as any).view.settings.language('german'));
        expect(await ariaSort(page, 'name')).toBe('ascending');
        const names = await page.$$eval('#villa-items-table tbody .villa-item-name span', (e) => e.map((x) => (x.textContent || '').trim()));
        const sorted = [...names].sort(new Intl.Collator('de', { numeric: true }).compare);
        expect(names).toEqual(sorted);
    });
});
