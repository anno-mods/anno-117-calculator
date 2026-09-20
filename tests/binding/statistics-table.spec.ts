import { test, expect } from '@playwright/test';
import { installMockEventSource } from '../helpers';

// Binding tests for the U4 page shell (header, category tabs, dense row table) in
// statistics.html / src/statistics.ts, driven through the shared mock EventSource
// (tests/helpers/mock-event-source.ts). Unlike U3's computed-layer tests, these assert on
// the actual rendered DOM (icon src, name text, visible row count) per the plan's U4 test
// scenarios (Covers AE1/AE2), not just window.statisticsFeed's view-model state.
//
// GUIDs (tests/AGENTS.md / tests/computed/statistics-params-resolution.spec.ts):
// - Product 2138 "Wine", category "Consumer Goods" (real params match).
// - Product 2137 "Bread" (real params match; used here purely as a second, zero-valued row).
// - 999999999: no params match -> KTD4 fallback, category "Other" (per U2's resolveProduct).

function samplePayload() {
  return JSON.stringify({
    version: 1,
    areaName: 'Latium',
    islandId: 1,
    areaIndex: 0,
    timeStamp: 1,
    entries: [
      // Real product, non-zero values, category "Consumer Goods".
      { productGuid: 2138, generation: 15, consumption: 5, perfectGeneration: 20, perfectConsumption: 10, buildings: 2 },
      // Real product, all-zero values - must still render a row in the All tab (AE1).
      { productGuid: 2137, generation: 0, consumption: 0, perfectGeneration: 10, perfectConsumption: 5, buildings: 0 },
      // Unmatched guid -> KTD4 fallback, category "Other".
      { productGuid: 999999999, generation: 3, consumption: 1, perfectGeneration: 10, perfectConsumption: 10, buildings: 1 }
    ]
  });
}

async function connectAndPushSample(page: import('@playwright/test').Page) {
  const payload = samplePayload();
  await page.evaluate((data) => {
    (window as any).statisticsFeed.connect();
    const instances = (window as any).__mockEventSourceInstances;
    const instance = instances[instances.length - 1];
    instance.onopen();
    instance.onmessage({ data });
  }, payload);
}

test.describe('statistics.html table (U4: header, tabs, table)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockEventSource(page);
    await page.goto('/statistics.html');
    await page.waitForFunction(() => (window as any).statisticsFeed !== undefined && (window as any).statisticsView !== undefined);
  });

  test('All tab (default) shows one row per pushed entry, including the zero-valued one', async ({ page }) => {
    await connectAndPushSample(page);

    const rows = page.locator('#statistics-table-pane table tbody tr');
    await expect(rows).toHaveCount(3);

    // Zero-valued Bread row still rendered (AE1).
    await expect(rows.filter({ hasText: 'Bread' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Wine' })).toHaveCount(1);
  });

  test('selecting a category tab shows only that category\'s rows, with correct icon/name', async ({ page }) => {
    await connectAndPushSample(page);

    // Wine (2138) and Bread (2137) both resolve to params category "Consumer Goods"; the
    // unmatched guid (999999999) falls back to "Other" (KTD4/KTD6) - so selecting "Consumer
    // Goods" must show exactly those two rows and exclude the "Other" fallback row.
    const consumerGoodsTab = page.locator('#statistics-category-tabs button[data-category="Consumer Goods"]');
    await expect(consumerGoodsTab).toHaveCount(1);
    await consumerGoodsTab.click();

    const rows = page.locator('#statistics-table-pane table tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: 'Wine' })).toHaveCount(1);
    await expect(rows.filter({ hasText: 'Bread' })).toHaveCount(1);
    await expect(rows.filter({ hasText: '999999999' })).toHaveCount(0);

    const wineRow = rows.filter({ hasText: 'Wine' });
    const icon = wineRow.locator('img').first();
    await expect(icon).toBeVisible();
    const src = await icon.getAttribute('src');
    expect(src).toBeTruthy();
  });

  test('an entry falling back to category "Other" appears in both All and the Other tab', async ({ page }) => {
    await connectAndPushSample(page);

    // Present (as one of three rows) in All.
    const allRows = page.locator('#statistics-table-pane table tbody tr');
    await expect(allRows).toHaveCount(3);
    await expect(allRows.filter({ hasText: '999999999' })).toHaveCount(1);

    const otherTab = page.locator('#statistics-category-tabs button[data-category="Other"]');
    await expect(otherTab).toHaveCount(1);
    await otherTab.click();

    const otherRows = page.locator('#statistics-table-pane table tbody tr');
    await expect(otherRows).toHaveCount(1);
    await expect(otherRows.first()).toContainText('999999999');
  });

  test('switching tabs does not change the number or order of window.statisticsFeed.islands()[0].rows()', async ({ page }) => {
    await connectAndPushSample(page);

    const getRows = () => (window as any).statisticsFeed.islands()[0].rows().map((r: any) => r.productGuid);

    const before = await page.evaluate(getRows);
    expect(before).toEqual([2138, 2137, 999999999]);

    await page.locator('#statistics-category-tabs button[data-category="Consumer Goods"]').click();
    const afterConsumerGoods = await page.evaluate(getRows);
    expect(afterConsumerGoods).toEqual(before);

    await page.locator('#statistics-category-tabs button[data-category="Other"]').click();
    const afterOther = await page.evaluate(getRows);
    expect(afterOther).toEqual(before);

    await page.locator('#statistics-category-tabs button[data-category="All"]').click();
    const afterAll = await page.evaluate(getRows);
    expect(afterAll).toEqual(before);
    await expect(page.locator('#statistics-table-pane table tbody tr')).toHaveCount(3);
  });

  // U5 replaced the old single-island <select> dropdown with the Collections/Islands sidebar
  // (tests/binding/statistics-collections.spec.ts covers its own DOM/interaction scenarios in
  // detail); this is a narrow regression check that the dropdown is gone entirely, and that the
  // sidebar's Islands list still renders a usable single-island row.
  test('single-island sessions render via the sidebar, with no leftover dropdown', async ({ page }) => {
    const dropdown = page.locator('#statistics-root select.custom-select');
    await expect(dropdown).toHaveCount(0);

    await page.evaluate(() => {
      (window as any).statisticsFeed.connect();
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onmessage({
        data: JSON.stringify({ version: 1, areaName: 'Latium', islandId: 1, areaIndex: 0, entries: [] })
      });
    });

    await expect(dropdown).toHaveCount(0);
    const islandRows = page.locator('#statistics-islands-list li');
    await expect(islandRows).toHaveCount(1);
    await expect(islandRows.first()).toContainText('Latium');
  });

  test('category tabs are ordered according to params.productFilters configuration, with All always first', async ({ page }) => {
    await connectAndPushSample(page);

    const tabTexts = await page.locator('#statistics-category-tabs button').allInnerTexts();

    // The expected order of categories in window.params.productFilters
    const expectedOrder = await page.evaluate(() => {
      const currentLanguage = (window as any).statisticsParams.currentLanguage();
      const resolveLocaText = (locaText: any, fallbackName: string): string => {
        if (locaText) {
          const lang = currentLanguage;
          const localized = locaText[lang];
          if (localized) return localized;
          const english = locaText['english'];
          if (english) return english;
        }
        return fallbackName;
      };
      const params = (window as any).params;
      return params.productFilters.map((f: any) => resolveLocaText(f.locaText, 'Other'));
    });

    expect(tabTexts[0]).toBe('All');

    // Extract non-All tabs and verify they follow the relative order in expectedOrder
    const nonAllTabs = tabTexts.slice(1);
    const indexes = nonAllTabs.map(t => {
      const idx = expectedOrder.indexOf(t);
      return idx === -1 ? Infinity : idx;
    });

    // Indexes should be monotonically increasing (since they follow the expectedOrder order)
    for (let i = 0; i < indexes.length - 1; i++) {
      expect(indexes[i]).toBeLessThanOrEqual(indexes[i + 1]);
    }
  });

  test('table rows in the DOM are sorted according to the calculator product ordering', async ({ page }) => {
    // Push Wine (2138) first, then Bread (2137)
    const payload = JSON.stringify({
      version: 1,
      areaName: 'Latium',
      islandId: 1,
      areaIndex: 0,
      timeStamp: 1,
      entries: [
        { productGuid: 2138, generation: 10, perfectGeneration: 10 },
        { productGuid: 2137, generation: 5, perfectGeneration: 5 }
      ]
    });

    await page.evaluate((data) => {
      (window as any).statisticsFeed.connect();
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onopen();
      instance.onmessage({ data });
    }, payload);

    // Get row text content from table body
    const rowTexts = await page.locator('#statistics-table-pane table tbody tr td:nth-child(2)').allInnerTexts();

    // Bread (2137) must be first, then Wine (2138)
    expect(rowTexts).toHaveLength(2);
    expect(rowTexts[0]).toBe('Bread');
    expect(rowTexts[1]).toBe('Wine');
  });
});
