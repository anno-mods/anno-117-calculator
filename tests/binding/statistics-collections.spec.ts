import { test, expect } from '@playwright/test';
import { installMockEventSource } from '../helpers';

// Binding tests for U5 (Collections/Islands sidebar DOM + click/Ctrl-click wiring) in
// statistics.html / src/statistics.ts, driven through the shared mock EventSource
// (tests/helpers/mock-event-source.ts). U2-U4's own state-machine rules (R5-R7, R9-R20, R24) are
// already covered at the computed layer by tests/computed/statistics-collections.spec.ts - these
// assert the actual rendered DOM (checkbox structure/order, native checked state after a real
// Playwright click/keyboard activation, enable/disable of the create-collection control) per the
// plan's U5 test scenarios, since that DOM wiring (the no-op-write-computed + separate click:
// handler pattern) is new code with its own failure modes a computed-layer test can't see.

async function seedIsland(page: import('@playwright/test').Page, areaName: string, islandId: number, areaIndex = 0) {
  await page.evaluate(({ areaName, islandId, areaIndex }) => {
    const instances = (window as any).__mockEventSourceInstances;
    const instance = instances[instances.length - 1];
    instance.onmessage({ data: JSON.stringify({ version: 1, areaName, islandId, areaIndex, entries: [] }) });
  }, { areaName, islandId, areaIndex });
}

async function connectAndSeedThree(page: import('@playwright/test').Page) {
  await page.evaluate(() => (window as any).statisticsFeed.connect());
  await seedIsland(page, 'IslandA', 1, 0);
  await seedIsland(page, 'IslandB', 2, 0);
  await seedIsland(page, 'IslandC', 3, 0);
}

test.describe('statistics.html Collections/Islands sidebar (U5)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockEventSource(page);
    await page.goto('/statistics.html');
    await page.waitForFunction(() => (window as any).statisticsFeed !== undefined && (window as any).statisticsView !== undefined);
  });

  test('happy path (R4): sidebar renders Collections above Islands, each row with a visible checkbox, "All Islands" first', async ({ page }) => {
    await connectAndSeedThree(page);

    const sidebar = page.locator('#statistics-sidebar');
    await expect(sidebar).toBeVisible();

    // Collections list: "All Islands" always first (R4/KTD2), no user collections yet.
    const collectionRows = page.locator('#statistics-collections-list li');
    await expect(collectionRows).toHaveCount(1);
    await expect(collectionRows.first()).toContainText('All Islands');
    await expect(collectionRows.first().locator('input[type="checkbox"]')).toBeVisible();

    // Islands list: three checkbox rows, one per arrived island.
    const islandRows = page.locator('#statistics-islands-list li');
    await expect(islandRows).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(islandRows.nth(i).locator('input[type="checkbox"]')).toBeVisible();
    }

    // Structural order: the Collections list's DOM node precedes the Islands list's DOM node.
    const collectionsListBox = await page.locator('#statistics-collections-list').boundingBox();
    const islandsListBox = await page.locator('#statistics-islands-list').boundingBox();
    expect(collectionsListBox).toBeTruthy();
    expect(islandsListBox).toBeTruthy();
    expect(collectionsListBox!.y).toBeLessThan(islandsListBox!.y);
  });

  test('happy path (R5): a plain click on an island checkbox checks only that island (deselects others)', async ({ page }) => {
    await connectAndSeedThree(page);

    const islandRows = page.locator('#statistics-islands-list li');
    const getCheckbox = (name: string) => islandRows.filter({ hasText: name }).locator('input[type="checkbox"]');

    await getCheckbox('IslandA').click();
    await getCheckbox('IslandB').click();

    await expect(getCheckbox('IslandA')).not.toBeChecked();
    await expect(getCheckbox('IslandB')).toBeChecked();
    await expect(getCheckbox('IslandC')).not.toBeChecked();

    const checkedKeys = await page.evaluate(() => (window as any).statisticsView.checkedKeys());
    expect(checkedKeys).toEqual([{ islandId: 2, areaIndex: 0 }]);
  });

  test('happy path (R6): Ctrl-clicking an island checkbox multi-selects without deselecting others', async ({ page }) => {
    await connectAndSeedThree(page);

    const islandRows = page.locator('#statistics-islands-list li');
    const getCheckbox = (name: string) => islandRows.filter({ hasText: name }).locator('input[type="checkbox"]');

    await getCheckbox('IslandA').click();
    await getCheckbox('IslandB').click({ modifiers: ['Control'] });

    await expect(getCheckbox('IslandA')).toBeChecked();
    await expect(getCheckbox('IslandB')).toBeChecked();
    await expect(getCheckbox('IslandC')).not.toBeChecked();

    const checkedKeys = await page.evaluate(() => (window as any).statisticsView.checkedKeys());
    expect(checkedKeys.sort((a: any, b: any) => a.islandId - b.islandId)).toEqual([
      { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }
    ]);
  });

  test('R20: a keyboard-triggered (Space) activation toggles in place, never replace-all', async ({ page }) => {
    await connectAndSeedThree(page);

    const islandRows = page.locator('#statistics-islands-list li');
    const getCheckbox = (name: string) => islandRows.filter({ hasText: name }).locator('input[type="checkbox"]');

    await getCheckbox('IslandA').click();
    await expect(getCheckbox('IslandA')).toBeChecked();

    // A native, real keyboard-driven activation (not a synthetic .click()) - Space on a focused
    // checkbox fires a click event with event.detail === 0, exactly the case R20 exists for.
    await getCheckbox('IslandB').focus();
    await getCheckbox('IslandB').press(' ');

    await expect(getCheckbox('IslandA')).toBeChecked();
    await expect(getCheckbox('IslandB')).toBeChecked();
    await expect(getCheckbox('IslandC')).not.toBeChecked();

    const checkedKeys = await page.evaluate(() => (window as any).statisticsView.checkedKeys());
    expect(checkedKeys.sort((a: any, b: any) => a.islandId - b.islandId)).toEqual([
      { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }
    ]);
  });

  test('checkbox DOM state re-syncs after an idempotent click (code-review fix: notify:\'always\')', async ({ page }) => {
    // Code-review finding: isIslandChecked/isCollectionChecked bind checked: to a ko.computed
    // whose read() can return the SAME boolean before and after a click (e.g. R7's zero-guard
    // veto, or R5 replacing the checked set with the same sole island already checked). A plain
    // ko.computed does not re-notify subscribers on an unchanged value, so without
    // .extend({notify: 'always'}) the browser's own native toggle would be left standing, visibly
    // out of sync with the model. This clicks the SAME checkbox twice in ways that should leave
    // the underlying boolean unchanged, and asserts the real DOM .checked property afterward -
    // not just the model state via page.evaluate, since the bug was purely a DOM-sync bug.
    await connectAndSeedThree(page);

    const islandRows = page.locator('#statistics-islands-list li');
    const islandACheckbox = islandRows.filter({ hasText: 'IslandA' }).locator('input[type="checkbox"]');

    // Plain click on IslandA (now the sole checked island), then plain click it again - R5's
    // "replace checked set with [this key]" is idempotent when it's already the sole checked key.
    // The browser's native toggle would try to UNCHECK it on the second click; the model must
    // veto that and the DOM must reflect the model, not the native guess.
    await islandACheckbox.click();
    await expect(islandACheckbox).toBeChecked();
    await islandACheckbox.click();
    await expect(islandACheckbox).toBeChecked();

    // Ctrl-click the sole checked island - R7's zero-guard makes this a no-op. The browser's
    // native toggle would try to UNCHECK it; the model vetoes, and the DOM must stay checked.
    await islandACheckbox.click({ modifiers: ['Control'] });
    await expect(islandACheckbox).toBeChecked();

    const checkedKeys = await page.evaluate(() => (window as any).statisticsView.checkedKeys());
    expect(checkedKeys).toEqual([{ islandId: 1, areaIndex: 0 }]);

    // "All Islands" row (session-grouping plan, KTD2): clicking it while unchecked (only A is
    // checked so far) checks every arrived island; clicking it again while fully checked is a
    // permanent no-op (R11/KD7's absolute zero-guard - unchecking it would drop the checked count
    // to zero, since a fully-checked group's membership is the entirety of checkedKeys) - the DOM
    // must stay checked, not silently flip to unchecked the way the browser's native toggle guesses.
    const allIslandsCheckbox = page.locator('#statistics-collections-list li', { hasText: 'All Islands' }).locator('input[type="checkbox"]');
    await allIslandsCheckbox.click();
    await expect(allIslandsCheckbox).toBeChecked();
    const checkedAfterAllIslands = await page.evaluate(() => (window as any).statisticsView.checkedKeys().length);
    expect(checkedAfterAllIslands).toBe(3);

    await allIslandsCheckbox.click();
    await expect(allIslandsCheckbox).toBeChecked();
    const checkedAfterSecondClick = await page.evaluate(() => (window as any).statisticsView.checkedKeys().length);
    expect(checkedAfterSecondClick).toBe(3);
  });

  test('happy path (R14): "Create collection" is disabled with nothing checked or a blank name, enabled once something is checked and a name is typed', async ({ page }) => {
    // Deliberately no seeded islands yet (unlike most other tests in this file) - R24's
    // first-arrival auto-check only fires once an island arrives, so `checkedKeys` is genuinely
    // empty right now, matching this scenario's "nothing checked" starting point exactly (see
    // tests/computed/statistics-collections.spec.ts's own "createCollection no-ops when
    // checkedKeys is empty" test for the same distinction).
    const nameInput = page.locator('#statistics-create-collection input[type="text"]');
    const createButton = page.locator('#statistics-create-collection button', { hasText: 'Create collection' });

    // Nothing checked yet, no name -> disabled.
    await expect(createButton).toBeDisabled();

    // Name typed, but nothing checked -> still disabled.
    await nameInput.fill('My Collection');
    await expect(createButton).toBeDisabled();

    // First island arrives - R24 auto-checks it, so checkedKeys is now non-empty; combined with
    // the name already typed, the button should become enabled.
    await page.evaluate(() => (window as any).statisticsFeed.connect());
    await seedIsland(page, 'IslandA', 1, 0);
    await expect(createButton).toBeEnabled();

    // Clear the name -> disabled again (blank name, even though something is checked).
    await nameInput.fill('');
    await expect(createButton).toBeDisabled();

    // Non-blank name again -> enabled.
    await nameInput.fill('My Collection');
    await expect(createButton).toBeEnabled();

    // Whitespace-only name -> disabled again.
    await nameInput.fill('   ');
    await expect(createButton).toBeDisabled();
  });

  test('integration: creating then deleting a collection removes its row without unchecking the currently checked islands', async ({ page }) => {
    await connectAndSeedThree(page);

    const islandRows = page.locator('#statistics-islands-list li');
    await islandRows.filter({ hasText: 'IslandA' }).locator('input[type="checkbox"]').click();
    await islandRows.filter({ hasText: 'IslandB' }).locator('input[type="checkbox"]').click({ modifiers: ['Control'] });

    const nameInput = page.locator('#statistics-create-collection input[type="text"]');
    const createButton = page.locator('#statistics-create-collection button', { hasText: 'Create collection' });
    await nameInput.fill('A and B');
    await createButton.click();

    const collectionRows = page.locator('#statistics-collections-list li');
    await expect(collectionRows).toHaveCount(2); // "All Islands" + the new one
    const newCollectionRow = collectionRows.filter({ hasText: 'A and B' });
    await expect(newCollectionRow).toHaveCount(1);
    await expect(newCollectionRow.locator('input[type="checkbox"]')).toBeChecked();

    await newCollectionRow.locator('button', { hasText: '×' }).click();

    await expect(collectionRows).toHaveCount(1); // only "All Islands" remains
    await expect(page.locator('#statistics-collections-list li', { hasText: 'A and B' })).toHaveCount(0);

    // Checked islands survive the delete untouched (R15).
    await expect(islandRows.filter({ hasText: 'IslandA' }).locator('input[type="checkbox"]')).toBeChecked();
    await expect(islandRows.filter({ hasText: 'IslandB' }).locator('input[type="checkbox"]')).toBeChecked();
    const checkedKeys = await page.evaluate(() => (window as any).statisticsView.checkedKeys());
    expect(checkedKeys.sort((a: any, b: any) => a.islandId - b.islandId)).toEqual([
      { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }
    ]);
  });

  test('regression: single-island sessions still render usable output, with no leftover dropdown', async ({ page }) => {
    await page.evaluate(() => (window as any).statisticsFeed.connect());
    await seedIsland(page, 'Latium', 1, 0);

    await expect(page.locator('#statistics-root select.custom-select')).toHaveCount(0);

    const islandRows = page.locator('#statistics-islands-list li');
    await expect(islandRows).toHaveCount(1);
    await expect(islandRows.first()).toContainText('Latium');

    // First arrival is auto-checked (R24) - table/header should reflect the single island.
    await expect(islandRows.first().locator('input[type="checkbox"]')).toBeChecked();
    await expect(page.locator('h3')).toHaveText('Latium');
  });
});
