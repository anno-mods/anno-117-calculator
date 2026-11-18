import { test, expect } from '@playwright/test';

// Exercises src/statistics-params.ts (U2 of the live-statistics-page plan) through the
// statistics.bundle.js entry point. This page has no persisted localStorage config and no
// ConfigLoader dependency - the resolver functions are pure lookups against window.params,
// exposed for tests via window.statisticsParams (see src/statistics.ts).
//
// GUIDs used below come from js/params.js (grepped directly) and match tests/AGENTS.md's
// "Common Test GUIDs" table where overlapping:
// - Product 2138 "Wine": found at js/params.js ~line 49913-49927, english locaText "Wine",
//   listed in productFilters guid 37670 ("Consumer Goods", js/params.js ~line 48167-48192).
// - Session 3245 "Latium": found at js/params.js ~line 55361-55378 (raw `name` field
//   "Province Roman Italia", locaText.english "Latium").
// - 999999999 / "does-not-exist-session": not present in js/params.js (grepped, zero matches).

test.describe('statistics-params resolution', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/statistics.html');
    await page.waitForFunction(() => (window as any).statisticsParams !== undefined);
  });

  test('resolveProduct: known guid resolves icon, localized name, and category', async ({ page }) => {
    const result = await page.evaluate(() => (window as any).statisticsParams.resolveProduct(2138));

    expect(result.guid).toBe(2138);
    expect(result.name).toBe('Wine');
    expect(result.icon).toBeTruthy();
    expect(typeof result.icon).toBe('string');
    expect(result.category).toBe('Consumer Goods');
  });

  test('resolveProduct: unmatched guid returns KTD4 fallback (name has guid, no icon, "Other")', async ({ page }) => {
    const result = await page.evaluate(() => (window as any).statisticsParams.resolveProduct(999999999));

    expect(result.guid).toBe(999999999);
    expect(result.name).toContain('999999999');
    expect(result.icon).toBeUndefined();
    expect(result.category).toBe('Other');
  });

  test('resolveSession: known guid resolves name and icon', async ({ page }) => {
    const result = await page.evaluate(() => (window as any).statisticsParams.resolveSession(3245));

    expect(result).not.toBeNull();
    expect(result.guid).toBe(3245);
    expect(result.name).toBe('Latium');
    expect(result.icon).toBeTruthy();
    expect(typeof result.icon).toBe('string');
  });

  test('resolveSession: known raw name resolves the same session, case-insensitively', async ({ page }) => {
    const result = await page.evaluate(() =>
      (window as any).statisticsParams.resolveSession('PROVINCE roman ITALIA')
    );

    expect(result).not.toBeNull();
    expect(result.guid).toBe(3245);
    expect(result.name).toBe('Latium');
  });

  test('resolveSession: unresolvable identifiers return null for both lookup shapes', async ({ page }) => {
    const results = await page.evaluate(() => {
      const sp = (window as any).statisticsParams;
      return {
        byGuid: sp.resolveSession(999999999),
        byName: sp.resolveSession('does-not-exist-session'),
        byNull: sp.resolveSession(null),
        byUndefined: sp.resolveSession(undefined)
      };
    });

    expect(results.byGuid).toBeNull();
    expect(results.byName).toBeNull();
    expect(results.byNull).toBeNull();
    expect(results.byUndefined).toBeNull();
  });
});
