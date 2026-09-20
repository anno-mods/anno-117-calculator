import { test, expect } from '@playwright/test';
import { installMockEventSource } from '../helpers';

// Binding tests for U4 (session-grouping plan): the Islands list restructured into session-headed,
// indented sections plus an ungrouped tail (KTD5/R4/R5), and "All Islands"'s checkbox/click
// binding rewired onto isAllIslandsChecked/onAllIslandsToggle. U2/U3's own state-machine rules are
// already covered at the computed layer by tests/computed/statistics-session-grouping.spec.ts -
// these assert the actual rendered DOM.
//
// GUIDs match tests/AGENTS.md's "Common Test GUIDs" table: session 3245 = Latium, session
// 6627 = Albion.

async function seedIsland(page: import('@playwright/test').Page, areaName: string, islandId: number, areaIndex = 0, sessionGuid?: number) {
  await page.evaluate(({ areaName, islandId, areaIndex, sessionGuid }) => {
    const instances = (window as any).__mockEventSourceInstances;
    const instance = instances[instances.length - 1];
    instance.onmessage({ data: JSON.stringify({ version: 1, areaName, islandId, areaIndex, sessionGuid, entries: [] }) });
  }, { areaName, islandId, areaIndex, sessionGuid });
}

test.describe('statistics.html grouped Islands sidebar (U4)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockEventSource(page);
    await page.goto('/statistics.html');
    await page.waitForFunction(() => (window as any).statisticsFeed !== undefined && (window as any).statisticsView !== undefined);
    await page.evaluate(() => (window as any).statisticsFeed.connect());
  });

  test('happy path (R4, R6): renders one heading per resolved session, ordered by params.sessions index, followed by an ungrouped tail', async ({ page }) => {
    await seedIsland(page, 'AlbionA', 3, 0, 6627);
    await seedIsland(page, 'LatiumA', 1, 0, 3245);
    await seedIsland(page, 'LatiumB', 2, 0, 3245);
    await seedIsland(page, 'Unresolved', 4, 0, 999999999);

    const sessionIndex = await page.evaluate(() => {
      const sessions = (window as any).params.sessions;
      return { latium: sessions.findIndex((s: any) => s.guid === 3245), albion: sessions.findIndex((s: any) => s.guid === 6627) };
    });

    const rows = page.locator('#statistics-islands-list > li');
    // 2 headings + 3 member rows (2 Latium + 1 Albion) + 1 ungrouped row = 6 total.
    await expect(rows).toHaveCount(6);

    const rowTexts = await rows.allTextContents();
    const latiumHeadingIdx = rowTexts.findIndex(t => t.includes('Latium'));
    const albionHeadingIdx = rowTexts.findIndex(t => t.includes('Albion'));
    expect(latiumHeadingIdx).toBeGreaterThanOrEqual(0);
    expect(albionHeadingIdx).toBeGreaterThanOrEqual(0);
    // Session order in the DOM must match params.sessions' own index order.
    if (sessionIndex.latium < sessionIndex.albion) {
      expect(latiumHeadingIdx).toBeLessThan(albionHeadingIdx);
    } else {
      expect(albionHeadingIdx).toBeLessThan(latiumHeadingIdx);
    }

    const unresolvedRow = rows.filter({ hasText: 'Unresolved' });
    await expect(unresolvedRow).toHaveCount(1);
  });

  test('happy path (KTD5): grouped island rows show only the island name (no session prefix), and are visually indented under their heading', async ({ page }) => {
    await seedIsland(page, 'LatiumA', 1, 0, 3245);

    const memberRow = page.locator('#statistics-islands-list > li', { hasText: 'LatiumA' });
    await expect(memberRow).toHaveCount(1);
    // No "Latium - " prefix (old getIslandLabel behavior) - just the bare area name.
    await expect(memberRow.locator('span').last()).toHaveText('LatiumA');
    await expect(memberRow).toHaveClass(/pl-4/);
  });

  test('happy path (R5): an ungrouped row (no resolved session) is not indented', async ({ page }) => {
    await seedIsland(page, 'Unresolved', 1, 0, 999999999);

    const row = page.locator('#statistics-islands-list > li', { hasText: 'Unresolved' });
    await expect(row).toHaveCount(1);
    await expect(row.locator('span').last()).toHaveText('Unresolved');
    await expect(row).not.toHaveClass(/pl-4/);
  });

  test('happy path (R9): clicking an unchecked session heading in the DOM checks every one of its member island checkboxes', async ({ page }) => {
    await seedIsland(page, 'LatiumA', 1, 0, 3245);
    await seedIsland(page, 'LatiumB', 2, 0, 3245);
    await seedIsland(page, 'AlbionA', 3, 0, 6627);

    const headingRow = page.locator('#statistics-islands-list > li', { hasText: 'Latium' }).first();
    const headingCheckbox = headingRow.locator('input[type="checkbox"]');
    await headingCheckbox.click();

    await expect(headingCheckbox).toBeChecked();
    const latiumACheckbox = page.locator('#statistics-islands-list > li', { hasText: 'LatiumA' }).locator('input[type="checkbox"]');
    const latiumBCheckbox = page.locator('#statistics-islands-list > li', { hasText: 'LatiumB' }).locator('input[type="checkbox"]');
    const albionACheckbox = page.locator('#statistics-islands-list > li', { hasText: 'AlbionA' }).locator('input[type="checkbox"]');
    await expect(latiumACheckbox).toBeChecked();
    await expect(latiumBCheckbox).toBeChecked();
    await expect(albionACheckbox).not.toBeChecked();
  });

  test('happy path: the "All Islands" checkbox shows checked once every arrived island is checked via the DOM', async ({ page }) => {
    await seedIsland(page, 'IslandA', 1, 0);
    await seedIsland(page, 'IslandB', 2, 0);

    const allIslandsCheckbox = page.locator('#statistics-collections-list li', { hasText: 'All Islands' }).locator('input[type="checkbox"]');
    await expect(allIslandsCheckbox).not.toBeChecked(); // only A is checked so far (R24 bootstrap)

    const islandBCheckbox = page.locator('#statistics-islands-list > li', { hasText: 'IslandB' }).locator('input[type="checkbox"]');
    await islandBCheckbox.click({ modifiers: ['Control'] });

    await expect(allIslandsCheckbox).toBeChecked();
  });

  test('regression: existing Collections-list rendering ("All Islands" first, checkbox visible) is unaffected by the rewiring', async ({ page }) => {
    await seedIsland(page, 'IslandA', 1, 0);

    const collectionRows = page.locator('#statistics-collections-list li');
    await expect(collectionRows).toHaveCount(1);
    await expect(collectionRows.first()).toContainText('All Islands');
    await expect(collectionRows.first().locator('input[type="checkbox"]')).toBeVisible();
  });
});
