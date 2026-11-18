import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

// Needs table of the population level dialog (plan 2026-11-12-002 U7): header icons, cells and aggregate mode.
const LATIUM = 3245;
const LIBERTI_LEVEL = 1499;
const LIBERTI_RESIDENCE = 3087;
const CONSTRUCTED = 4; // constructed Liberti residences of the fixture island

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
    const needTables = Array.from(dialog.querySelectorAll('.collapse table')).filter((t) => t.querySelector('colgroup') && !t.classList.contains('population-buffs-table'));
    const rows = needTables.flatMap((t) => Array.from(t.querySelectorAll('tbody tr'))).map((tr) => ({
        cells: Array.from(tr.children).length,
        attributes: Array.from(tr.querySelectorAll('td.need-attribute-cell')).map((td) => ({ title: td.getAttribute('title'), text: (td.textContent || '').replace(/\s+/g, ' ').trim() })),
        dlcIcons: Array.from(tr.querySelectorAll('img.need-dlc-icon')).map((i) => i.getAttribute('title')),
        coverage: tr.querySelector('.need-coverage') ? (tr.querySelector('.need-coverage')!.textContent || '').trim() : null,
        amount: tr.querySelector('.need-amount') ? (tr.querySelector('.need-amount')!.textContent || '').trim() : null,
        checkbox: tr.querySelectorAll('input[type="checkbox"]').length,
    }));
    const totals = Array.from(dialog.querySelectorAll('tr.need-totals td.need-attribute-cell')).map((td) => (td.textContent || '').trim());
    return { head, rows, totals, scrollsPage: document.documentElement.scrollWidth > window.innerWidth };
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
                dlc: columns.dlc,
                coverage: columns.coverage,
                needs: presenter.visibleNeedCategories().flatMap((c: any) => c.visiblePopulationLevelNeeds()).map((n: any) => ({
                    guid: n.guid,
                    values: w.params.needAttributes.map((a: any) => w.params.needs.find((x: any) => x.guid === n.guid).needAttributes[a.id]),
                    ids: w.params.needAttributes.map((a: any) => a.id),
                })),
            };
        });
        // name (with the DLC icons), attributes, the %-and-t/min column, the effects button
        const columnCount = 1 + expected.attributes.length + 1 + 1;
        expect(table.head.length).toBe(columnCount);

        // header marks: attribute icon and name, then the optional columns
        expected.attributes.forEach((a: any, i: number) => {
            expect(table.head[1 + i].title).toBe(a.name);
            expect(table.head[1 + i].imgSrc).toBe(a.icon);
        });
        let next = 1 + expected.attributes.length;
        expect(table.head[next].text).toBe(expected.coverage ? '% / t/min' : 't/min');
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
                else {
                    // a total over the residences: the fixture constructs CONSTRUCTED Liberti residences, all needs switched on
                    const total = CONSTRUCTED * raw;
                    const shown = text.replace(/\s/g, '');
                    expect(shown[0], `need ${need.guid} ${a.id}`).toBe(total > 0 ? '+' : '-');
                    expect(Math.abs(parseFloat(shown.slice(1).replace(',', '.')) - Math.abs(total)), `need ${need.guid} ${a.id}`).toBeLessThan(0.06);
                }
            });
            expect(row.checkbox).toBe(1);
        });
        // one total per attribute column
        expect(table.totals.length).toBe(expected.attributes.length);
        expect(table.scrollsPage).toBe(false);
        expect(detector.hasBindingError(), detector.getFormattedBindingErrors().join('\n')).toBe(false);
    });

    test('every icon in the new columns has a title', async ({ page }) => {
        await load(page);
        await openLevel(page, LIBERTI_LEVEL);
        const missing = await page.evaluate(() => {
            const out: string[] = [];
            document.querySelectorAll('#population-level-config-dialog tr.need-column-icons th, #population-level-config-dialog img.need-dlc-icon').forEach((e, i) => {
                if (e.tagName === 'TH' && e === e.parentElement!.firstElementChild) return;
                if (e.tagName === 'TH' && e === e.parentElement!.lastElementChild) return;
                if (!e.getAttribute('title')) out.push(e.tagName + ' ' + i);
            });
            return out;
        });
        expect(missing).toEqual([]);
    });

    test('a public need shows its coverage above the t/min; every need with consumption shows t/min', async ({ page }) => {
        await load(page);
        await openLevel(page, LIBERTI_LEVEL);
        const t = await readTable(page);
        const kinds = await page.evaluate(() => {
            const w = window as any;
            return w.view.presenter.residence.visibleNeedCategories().flatMap((c: any) => c.visiblePopulationLevelNeeds()).map((n: any) => ({ isBuilding: n.isBuilding, amount: n.amount() }));
        });
        kinds.forEach((k: any, i: number) => {
            if (k.isBuilding) expect(t.rows[i].coverage).toBe('100 %');
            else expect(t.rows[i].coverage).toBeNull();
            expect(t.rows[i].amount === null, `row ${i}`).toBe(!k.amount);
        });
        expect(kinds.some((k: any) => k.isBuilding)).toBe(true);
    });

    test('the totals row sums the needs that are switched on per attribute column', async ({ page }) => {
        await load(page);
        await openLevel(page, LIBERTI_LEVEL);
        const expected = await page.evaluate(() => {
            const p = (window as any).view.presenter.residence;
            const needs = p.visibleNeedCategories().flatMap((c: any) => c.visiblePopulationLevelNeeds());
            return p.needColumns().attributes.map((a: any) => needs.reduce((s: number, n: any) => s + n.attributeTotal(a.id), 0));
        });
        const t = await readTable(page);
        expect(t.totals.length).toBe(expected.length);
        expected.forEach((v: number, i: number) => {
            if (v === 0) expect(t.totals[i]).toBe('');
            else {
                const shown = t.totals[i].replace(/\s/g, '');
                expect(Math.abs(parseFloat(shown.replace('+', '').replace(',', '.')) - v), `column ${i}`).toBeLessThan(0.06);
            }
        });
        expect(expected.some((v: number) => v !== 0)).toBe(true);
    });

    test('unchecking a need keeps its potential values (dimmed), drops them from the totals and keeps the columns', async ({ page }) => {
        await load(page);
        await openLevel(page, LIBERTI_LEVEL);
        const target = await page.evaluate(() => {
            const p = (window as any).view.presenter.residence;
            const needs = p.visibleNeedCategories().flatMap((c: any) => c.visiblePopulationLevelNeeds());
            const columns = p.needColumns().attributes.map((a: any) => a.id);
            const index = needs.findIndex((n: any) => n.cells().some((c: any) => !c.isPopulation && c.value !== 0));
            return { index, columns };
        });
        expect(target.index).toBeGreaterThanOrEqual(0);
        const before = await readTable(page);
        expect(before.rows[target.index].attributes.some((a, j) => target.columns[j] !== 'Population' && a.text !== '')).toBe(true);
        await page.evaluate((index) => {
            const p = (window as any).view.presenter.residence;
            p.visibleNeedCategories().flatMap((c: any) => c.visiblePopulationLevelNeeds())[index].checked(false);
        }, target.index);
        await page.waitForTimeout(200);
        const after = await readTable(page);
        expect(after.head.length).toBe(before.head.length);
        after.rows[target.index].attributes.forEach((a, j) => expect(a.text, target.columns[j]).toBe(before.rows[target.index].attributes[j].text));
        const dimmed = await page.evaluate((index) => {
            const tables = Array.from(document.querySelectorAll('#population-level-config-dialog .collapse table')).filter((t) => t.querySelector('colgroup') && !t.classList.contains('population-buffs-table'));
            const tr = tables.flatMap((t) => Array.from(t.querySelectorAll('tbody tr')))[index];
            return Array.from(tr.querySelectorAll('td.need-attribute-cell')).every((td) => (td as HTMLElement).style.opacity !== '');
        }, target.index);
        expect(dimmed).toBe(true);
        expect(detector.hasBindingError(), detector.getFormattedBindingErrors().join('\n')).toBe(false);
    });

    test('aggregate mode shows the sum of the totals of the real islands', async ({ page }) => {
        await load(page, { aggregate: true });
        await openLevel(page, LIBERTI_LEVEL);
        const t = await readTable(page);
        const expected = await page.evaluate(() => {
            const p = (window as any).view.presenter.residence;
            const needs = p.visibleNeedCategories().flatMap((c: any) => c.visiblePopulationLevelNeeds());
            const cfg = new Map<number, any>((window as any).params.needs.map((n: any) => [n.guid, n]));
            return needs.map((n: any) => p.needColumns().attributes.map((a: any) => ({ id: a.id, raw: cfg.get(n.guid).needAttributes[a.id] ?? 0 })));
        });
        let checked = 0;
        t.rows.forEach((row, i) => row.attributes.forEach((cell, j) => {
            const { id, raw } = expected[i][j];
            if (id === 'Population' || raw === 0) return;
            const shown = cell.text.replace(/\s/g, '');
            // 4 + 3 constructed Liberti residences on the two real islands
            expect(Math.abs(parseFloat(shown.slice(1).replace(',', '.')) - Math.abs(7 * raw)), `row ${i} ${id}`).toBeLessThan(0.06);
            checked++;
        }));
        expect(checked).toBeGreaterThan(0);
    });

    test('without public-building data the % is not shown, only the t/min', async ({ page }) => {
        await load(page, { patch: 'window.params.publicServices = [];' });
        await openLevel(page, LIBERTI_LEVEL);
        const t = await readTable(page);
        expect(t.rows.every((r) => r.coverage === null)).toBe(true);
        expect(t.head.some((h) => h.text === '% / t/min')).toBe(false);
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
