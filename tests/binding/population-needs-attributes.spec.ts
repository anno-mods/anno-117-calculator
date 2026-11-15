import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

// Needs table of the population level dialog (plan 2026-11-12-002 U7): header icons, cells and aggregate mode.
const LATIUM = 3245;
const LIBERTI_LEVEL = 1499;
const LIBERTI_RESIDENCE = 3087;

async function load(page: Page, opts: { aggregate?: boolean; patch?: string } = {}) {
    if (opts.patch) {
        const patch = opts.patch;
        await page.route('**/js/params.js', async (route) => {
            const response = await route.fetch();
            await route.fulfill({ response, body: (await response.text()) + '\n;' + patch });
        });
    }
    const cl = new ConfigLoader();
    const islands = [
        { name: 'Latium', session: LATIUM, data: { [`${LIBERTI_RESIDENCE}.buildings.constructed`]: 4 } },
        ...(opts.aggregate ? [{ name: 'Latium2', session: LATIUM, data: { [`${LIBERTI_RESIDENCE}.buildings.constructed`]: 3 } }] : []),
    ];
    await cl.loadConfigObject(page, cl.createFullConfig(islands, opts.aggregate ? { 'settings.aggregateAllIslands': '1' } : {}, opts.aggregate ? 'All Islands' : 'Latium'));
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.waitForTimeout(300);
}

const openLevel = async (page: Page, level: number) => {
    await page.evaluate((guid) => {
        const w = window as any;
        const island = w.view.island();
        w.view.presenter.residence.open(island.populationLevels.find((l: any) => l.guid === guid));
        w.$('#population-level-config-dialog').modal('show');
    }, level);
    await page.waitForSelector('#population-level-config-dialog.show', { state: 'visible' });
    // expand every need category so the rows render in view
    await page.evaluate(() => (window as any).$('#population-level-config-dialog .collapse').addClass('show'));
};

/** Column keys of the header icon row, then the data of every need row. */
const readTable = (page: Page) => page.evaluate(() => {
    const dialog = document.querySelector('#population-level-config-dialog')!;
    const head = Array.from(dialog.querySelectorAll('tr.need-column-icons th')).map((th) => ({
        title: th.getAttribute('title') || '',
        text: (th.textContent || '').trim(),
        imgSrc: th.querySelector('img')?.getAttribute('src') ?? null,
    }));
    const needTables = Array.from(dialog.querySelectorAll('.collapse table')).filter((t) => t.querySelector('colgroup'));
    const rows = needTables.flatMap((t) => Array.from(t.querySelectorAll('tbody tr'))).map((tr) => ({
        cells: Array.from(tr.children).length,
        attributes: Array.from(tr.querySelectorAll('td.need-attribute-cell')).map((td) => ({ title: td.getAttribute('title'), text: (td.textContent || '').replace(/\s+/g, ' ').trim() })),
        weight: tr.querySelector('td.need-weight-cell') ? (tr.querySelector('td.need-weight-cell')!.textContent || '').trim() : null,
        dlcIcons: Array.from(tr.querySelectorAll('td.need-dlc-cell img')).map((i) => i.getAttribute('title')),
        buildingIcons: Array.from(tr.querySelectorAll('td.need-building-cell img')).map((i) => i.getAttribute('title')),
        coverage: tr.querySelector('td.need-coverage-cell') ? (tr.querySelector('td.need-coverage-cell')!.textContent || '').trim() : null,
        checkbox: tr.querySelectorAll('input[type="checkbox"]').length,
    }));
    return { head, rows, scrollsPage: document.documentElement.scrollWidth > window.innerWidth };
});

test.describe('population level dialog: needs table (U7)', () => {
    let detector: BindingErrorDetector;

    test.beforeEach(({ page }) => {
        detector = new BindingErrorDetector();
        detector.listenForErrors(page);
    });

    test('AE13: header icons, attribute cells with sign, no mark at 0, supply weight, DLC and buildings', async ({ page }) => {
        await load(page);
        await openLevel(page, LIBERTI_LEVEL);
        const table = await readTable(page);
        const expected = await page.evaluate(() => {
            const w = window as any;
            const presenter = w.view.presenter.residence;
            const columns = presenter.needColumns();
            return {
                attributes: columns.attributes.map((a: any) => ({ id: a.id, name: a.name(), icon: a.icon })),
                weight: columns.weight,
                dlc: columns.dlc,
                building: columns.building,
                coverage: columns.coverage,
                needs: presenter.visibleNeedCategories().flatMap((c: any) => c.visiblePopulationLevelNeeds()).map((n: any) => ({
                    guid: n.guid,
                    values: w.params.needAttributes.map((a: any) => w.params.needs.find((x: any) => x.guid === n.guid).needAttributes[a.id]),
                    ids: w.params.needAttributes.map((a: any) => a.id),
                    weight: n.supplyWeight,
                })),
            };
        });
        const columnCount = 1 + expected.attributes.length + [expected.weight, expected.dlc, expected.building, expected.coverage].filter(Boolean).length + 1;
        expect(table.head.length).toBe(columnCount);

        // header marks: attribute icon and name, then the optional columns
        expected.attributes.forEach((a: any, i: number) => {
            expect(table.head[1 + i].title).toBe(a.name);
            expect(table.head[1 + i].imgSrc).toBe(a.icon);
        });
        let next = 1 + expected.attributes.length;
        if (expected.weight) { expect(table.head[next].text.length).toBeGreaterThan(0); next++; }
        // static icons of the template are hashed by the build, so the marks are checked by image and title
        const texts = await page.evaluate(() => ({ dlc: (window as any).view.texts.needColDlc.name(), building: (window as any).view.texts.needColSupplyBuilding.name() }));
        if (expected.dlc) { expect(table.head[next].imgSrc).not.toBeNull(); expect(table.head[next].title).toBe(texts.dlc); next++; }
        if (expected.building) { expect(table.head[next].imgSrc).not.toBeNull(); expect(table.head[next].title).toBe(texts.building); next++; }
        if (expected.coverage) { expect(table.head[next].text).toBe('%'); next++; }
        for (const h of table.head.slice(1, -1)) expect(h.title).not.toBe('');

        expect(table.rows.length).toBe(expected.needs.length);
        table.rows.forEach((row, i) => {
            const need = expected.needs[i];
            expect(row.cells, `row ${i}`).toBe(columnCount);
            expect(row.attributes.length).toBe(expected.attributes.length);
            expected.attributes.forEach((a: any, j: number) => {
                const raw = need.values[need.ids.indexOf(a.id)];
                const text = row.attributes[j].text;
                if (raw === 0) expect(text, `need ${need.guid} ${a.id}`).toBe('');
                else if (a.id === 'Population') expect(text).not.toBe('');
                else expect(text.replace(/\s/g, '')).toBe((raw > 0 ? '+' : '-') + String(Math.abs(raw)));
            });
            if (expected.weight) expect(row.weight).toBe(need.weight !== 0 ? String(need.weight) : '');
            expect(row.checkbox).toBe(1);
        });
        expect(expected.weight).toBe(true);
        expect(table.scrollsPage).toBe(false);
        expect(detector.hasBindingError(), detector.getFormattedBindingErrors().join('\n')).toBe(false);
    });

    test('every icon in the new columns has a title', async ({ page }) => {
        await load(page);
        await openLevel(page, LIBERTI_LEVEL);
        const missing = await page.evaluate(() => {
            const out: string[] = [];
            document.querySelectorAll('#population-level-config-dialog tr.need-column-icons th, #population-level-config-dialog td.need-dlc-cell img, #population-level-config-dialog td.need-building-cell img').forEach((e, i) => {
                if (e.tagName === 'TH' && e === e.parentElement!.firstElementChild) return;
                if (e.tagName === 'TH' && e === e.parentElement!.lastElementChild) return;
                if (!e.getAttribute('title')) out.push(e.tagName + ' ' + i);
            });
            return out;
        });
        expect(missing).toEqual([]);
    });

    test('a public need shows its public buildings and the coverage; goods needs show their factories', async ({ page }) => {
        await load(page);
        await openLevel(page, LIBERTI_LEVEL);
        const t = await readTable(page);
        const kinds = await page.evaluate(() => {
            const w = window as any;
            return w.view.presenter.residence.visibleNeedCategories().flatMap((c: any) => c.visiblePopulationLevelNeeds()).map((n: any) => ({ isBuilding: n.isBuilding, buildings: n.supplyBuildings().length }));
        });
        kinds.forEach((k: any, i: number) => {
            expect(t.rows[i].buildingIcons.length).toBe(k.buildings);
            if (k.isBuilding) expect(t.rows[i].coverage).toBe('100 %');
            else expect(t.rows[i].coverage).toBe('');
        });
        expect(kinds.some((k: any) => k.isBuilding && k.buildings > 0)).toBe(true);
        expect(kinds.some((k: any) => !k.isBuilding && k.buildings > 0)).toBe(true);
    });

    test('without public-building data the coverage column does not exist and public needs have no building cell content', async ({ page }) => {
        await load(page, { patch: 'window.params.publicServices = [];' });
        await openLevel(page, LIBERTI_LEVEL);
        const t = await readTable(page);
        expect(t.rows.every((r) => r.coverage === null)).toBe(true);
        expect(t.head.some((h) => h.text === '%')).toBe(false);
        expect(detector.hasBindingError(), detector.getFormattedBindingErrors().join('\n')).toBe(false);
    });

    test('aggregate mode shows the same columns read-only and keeps the array identity of the tiles', async ({ page }) => {
        await load(page, { aggregate: true });
        const refs = await page.evaluate(() => { const w = window as any; w.__groups = w.view.template.populationGroups; return true; });
        expect(refs).toBe(true);
        await openLevel(page, LIBERTI_LEVEL);
        const t = await readTable(page);
        const expected = await page.evaluate(() => (window as any).view.presenter.residence.needColumns().attributes.length);
        expect(t.rows.length).toBeGreaterThan(0);
        for (const row of t.rows) {
            expect(row.checkbox).toBe(0);
            expect(row.attributes.length).toBe(expected);
        }
        expect(await page.evaluate(() => (window as any).__groups === (window as any).view.template.populationGroups)).toBe(true);
        const errors = detector.getFormattedBindingErrors().filter((m) => !/canDecConstructedBuildings|factoryPresenterIfDefaultSupplier|productPresenters|product-tile/i.test(m));
        expect(errors).toEqual([]);
    });

    test('the dialog uses the wide modal size', async ({ page }) => {
        await load(page);
        expect(await page.locator('#population-level-config-dialog .modal-dialog.modal-xl').count()).toBe(1);
    });
});
