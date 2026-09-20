import { test, expect } from '@playwright/test';
import { installMockEventSource } from '../helpers';

// Exercises U2 of the live-statistics-page plan (docs/plans/2026-08-11-001-feat-live-statistics-
// island-collections-plan.md): checked-island multi-select (`checkedKeys`), single active
// collection (`activeCollectionId`), and the click/collection-check/deactivate/zero-guard
// interaction rules (R5-R7, R9-R13, R18, R20) on `src/statistics.ts`'s `StatisticsViewModel`.
//
// `collections` has no CRUD API yet (that's U4) - tests seed it directly via
// `window.statisticsView.collections.push(...)`, exactly as a later unit's persistence-restore
// will. See tests/computed/statistics-connection-state.spec.ts for the mock-EventSource rationale;
// every mock message below carries numeric islandId/areaIndex (U1's hard requirement) or it is
// silently dropped by StatisticsFeed.handleMessage.

function islandMessage(areaName: string, islandId: number, areaIndex: number) {
  return JSON.stringify({ version: 1, areaName, islandId, areaIndex, entries: [] });
}

test.describe('statistics collections/checked-islands state (U2)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockEventSource(page);
    await page.goto('/statistics.html');
    await page.waitForFunction(() => (window as any).statisticsFeed !== undefined);
    await page.evaluate(() => (window as any).statisticsFeed.connect());
  });

  // Seeds three arrived islands (A, B, C) via the mock feed. Used by most tests below.
  async function seedThreeIslands(page: any) {
    await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onmessage({ data: JSON.stringify({ version: 1, areaName: 'IslandA', islandId: 1, areaIndex: 0, entries: [] }) });
      instance.onmessage({ data: JSON.stringify({ version: 1, areaName: 'IslandB', islandId: 2, areaIndex: 0, entries: [] }) });
      instance.onmessage({ data: JSON.stringify({ version: 1, areaName: 'IslandC', islandId: 3, areaIndex: 0, entries: [] }) });
    });
  }

  test('happy path (R5): plain click on an unchecked island checks exactly that island', async ({ page }) => {
    await seedThreeIslands(page);
    const result = await page.evaluate(() => {
      const view = (window as any).statisticsView;
      view.onIslandClick({ islandId: 2, areaIndex: 0 }, false);
      return view.checkedKeys();
    });
    expect(result).toEqual([{ islandId: 2, areaIndex: 0 }]);
  });

  test('happy path (R6): Ctrl-click adds an unchecked island, then removes it again', async ({ page }) => {
    await seedThreeIslands(page);
    const result = await page.evaluate(() => {
      const view = (window as any).statisticsView;
      view.onIslandClick({ islandId: 1, areaIndex: 0 }, false); // seed with A checked
      view.onIslandClick({ islandId: 2, areaIndex: 0 }, true); // ctrl-add B
      const afterAdd = view.checkedKeys().slice();
      view.onIslandClick({ islandId: 2, areaIndex: 0 }, true); // ctrl-remove B
      const afterRemove = view.checkedKeys().slice();
      return { afterAdd, afterRemove };
    });
    expect(result.afterAdd).toEqual([{ islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }]);
    expect(result.afterRemove).toEqual([{ islandId: 1, areaIndex: 0 }]);
  });

  test('happy path (R20): calling the ctrl-branch on a focused/unchecked key adds it without deselecting others', async ({ page }) => {
    await seedThreeIslands(page);
    const result = await page.evaluate(() => {
      const view = (window as any).statisticsView;
      view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
      // R20: keyboard activation uses the ctrl-equivalent toggle-in-place path, same as onIslandClick(key, true).
      view.onIslandClick({ islandId: 3, areaIndex: 0 }, true);
      return view.checkedKeys();
    });
    expect(result).toEqual([{ islandId: 1, areaIndex: 0 }, { islandId: 3, areaIndex: 0 }]);
  });

  test('edge case (AE8): a Ctrl-click that would drop the checked count to zero is a no-op', async ({ page }) => {
    await seedThreeIslands(page);
    const result = await page.evaluate(() => {
      const view = (window as any).statisticsView;
      view.onIslandClick({ islandId: 1, areaIndex: 0 }, false); // only A checked
      view.onIslandClick({ islandId: 1, areaIndex: 0 }, true); // ctrl-click the only checked island
      return view.checkedKeys();
    });
    expect(result).toEqual([{ islandId: 1, areaIndex: 0 }]); // unchanged - no-op
  });

  test('edge case (AE14): checking a collection with no arrived members is a no-op', async ({ page }) => {
    await seedThreeIslands(page);
    const result = await page.evaluate(() => {
      const view = (window as any).statisticsView;
      view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
      view.collections.push({
        id: 'ghost-collection',
        name: 'Ghost',
        members: [{ islandId: 99, areaIndex: 0 }] // never arrived
      });
      view.onCollectionCheck('ghost-collection');
      return { checkedKeys: view.checkedKeys(), activeCollectionId: view.activeCollectionId() };
    });
    expect(result.checkedKeys).toEqual([{ islandId: 1, areaIndex: 0 }]);
    expect(result.activeCollectionId).toBeUndefined();
  });

  test('edge case (AE1): Ctrl-click while a collection is active updates its stored membership (all-arrived case)', async ({ page }) => {
    await seedThreeIslands(page);
    const result = await page.evaluate(() => {
      const view = (window as any).statisticsView;
      view.collections.push({
        id: 'c1',
        name: 'Iron Triangle',
        members: [{ islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }]
      });
      view.onCollectionCheck('c1');
      view.onIslandClick({ islandId: 3, areaIndex: 0 }, true); // ctrl-add C while c1 active
      const collection = view.collections().find((c: any) => c.id === 'c1');
      return { checkedKeys: view.checkedKeys(), members: collection.members, activeCollectionId: view.activeCollectionId() };
    });
    expect(result.activeCollectionId).toBe('c1');
    expect(result.checkedKeys.sort((a: any, b: any) => a.islandId - b.islandId)).toEqual([
      { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }, { islandId: 3, areaIndex: 0 }
    ]);
    expect(result.members.sort((a: any, b: any) => a.islandId - b.islandId)).toEqual([
      { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }, { islandId: 3, areaIndex: 0 }
    ]);
  });

  test('edge case (AE4): Ctrl-click while a collection with a pending member is active leaves the pending member untouched', async ({ page }) => {
    await seedThreeIslands(page);
    const result = await page.evaluate(() => {
      const view = (window as any).statisticsView;
      view.collections.push({
        id: 'c1',
        name: 'Has Pending',
        members: [{ islandId: 1, areaIndex: 0 }, { islandId: 99, areaIndex: 0 }] // 99 never arrives
      });
      view.onCollectionCheck('c1'); // only island 1 arrives -> checkedKeys = [1]
      view.onIslandClick({ islandId: 2, areaIndex: 0 }, true); // ctrl-add B
      const collection = view.collections().find((c: any) => c.id === 'c1');
      return { checkedKeys: view.checkedKeys(), members: collection.members };
    });
    expect(result.checkedKeys.sort((a: any, b: any) => a.islandId - b.islandId)).toEqual([
      { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }
    ]);
    // Pending member (99) survives untouched, arrived member (1) kept, newly checked (2) added.
    expect(result.members.sort((a: any, b: any) => a.islandId - b.islandId)).toEqual([
      { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }, { islandId: 99, areaIndex: 0 }
    ]);
  });

  test('edge case (AE2, AE9, revised KD5-REV): a plain click while a collection is active deselects it and replaces the checked set, leaving membership (including pending members) untouched', async ({ page }) => {
    await seedThreeIslands(page);
    const result = await page.evaluate(() => {
      const view = (window as any).statisticsView;
      view.collections.push({
        id: 'c1',
        name: 'A B and pending C',
        members: [{ islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }, { islandId: 99, areaIndex: 0 }]
      });
      view.onCollectionCheck('c1'); // arrived subset -> checkedKeys = [1, 2]
      // Plain click on a third arrived island D (not in c1) - deselects c1, checks D alone.
      view.onIslandClick({ islandId: 3, areaIndex: 0 }, false);
      const collection = view.collections().find((c: any) => c.id === 'c1');
      return { checkedKeys: view.checkedKeys(), members: collection.members, activeCollectionId: view.activeCollectionId() };
    });
    expect(result.activeCollectionId).toBeUndefined();
    expect(result.checkedKeys).toEqual([{ islandId: 3, areaIndex: 0 }]);
    // Membership entirely untouched by the plain click - A(1), B(2), and pending 99 all survive.
    expect(result.members.sort((a: any, b: any) => a.islandId - b.islandId)).toEqual([
      { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }, { islandId: 99, areaIndex: 0 }
    ]);
  });

  test('regression (KTD2, session-grouping plan): "All Islands" is no longer a real activeCollectionId sentinel - onCollectionCheck/onCollectionUncheck no-op for it', async ({ page }) => {
    // "All Islands" moved off the activeCollectionId model entirely (KD2/KTD2) - it is checked
    // via the new isGroupChecked/onGroupToggle mechanism instead (see
    // tests/computed/statistics-session-grouping.spec.ts's U3 describe block for its actual
    // behavior, including AE6/AE7 coverage of deactivating a Collection and the zero-guard).
    // The old sentinel id no longer matches anything in `collections`, so calling the
    // Collection-only API with it is a harmless no-op.
    const ALL_ISLANDS_COLLECTION_ID = '__all-islands__';
    await seedThreeIslands(page);

    const result = await page.evaluate((allIslandsId) => {
      const view = (window as any).statisticsView;
      view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
      const checkedBefore = view.checkedKeys().slice();
      view.onCollectionCheck(allIslandsId);
      const afterCheck = { active: view.activeCollectionId(), checked: view.checkedKeys().slice() };
      view.onCollectionUncheck(allIslandsId);
      const afterUncheck = { active: view.activeCollectionId(), checked: view.checkedKeys().slice() };
      return { checkedBefore, afterCheck, afterUncheck };
    }, ALL_ISLANDS_COLLECTION_ID);

    expect(result.afterCheck.active).toBeUndefined();
    expect(result.afterCheck.checked).toEqual(result.checkedBefore);
    expect(result.afterUncheck.active).toBeUndefined();
    expect(result.afterUncheck.checked).toEqual(result.checkedBefore);
  });

  test('edge case (AE13): unchecking the active user-created collection deactivates it without changing checkedKeys', async ({ page }) => {
    await seedThreeIslands(page);
    const result = await page.evaluate(() => {
      const view = (window as any).statisticsView;
      view.collections.push({ id: 'c1', name: 'Pair', members: [{ islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }] });
      view.onCollectionCheck('c1');
      const checkedBefore = view.checkedKeys().slice();
      view.onCollectionUncheck('c1');
      return { activeAfter: view.activeCollectionId(), checkedBefore, checkedAfter: view.checkedKeys() };
    });
    expect(result.activeAfter).toBeUndefined();
    expect(result.checkedAfter).toEqual(result.checkedBefore);
  });

  test('integration (R10 + R13): checking a collection with one arrived and one pending member checks only the arrived one and activates', async ({ page }) => {
    await seedThreeIslands(page);
    const result = await page.evaluate(() => {
      const view = (window as any).statisticsView;
      view.collections.push({
        id: 'c1',
        name: 'Mixed',
        members: [{ islandId: 2, areaIndex: 0 }, { islandId: 42, areaIndex: 0 }] // 42 never arrives
      });
      view.onCollectionCheck('c1');
      return { checkedKeys: view.checkedKeys(), activeCollectionId: view.activeCollectionId() };
    });
    expect(result.checkedKeys).toEqual([{ islandId: 2, areaIndex: 0 }]);
    expect(result.activeCollectionId).toBe('c1');
  });

  // U3 (R8): the table/header now sums across every checked island (`checkedIslands`,
  // `filteredRows`, `categories`, `areaName`, `sessionInfo`). GUIDs match tests/AGENTS.md's
  // "Common Test GUIDs" table (2138 Wine, 2137 Bread, both category "Consumer Goods").
  test.describe('U3: multi-island aggregation (R8)', () => {
    test('happy path: two checked islands with an overlapping product guid sum generation/consumption/etc per product', async ({ page }) => {
      const result = await page.evaluate(() => {
        const instances = (window as any).__mockEventSourceInstances;
        const instance = instances[instances.length - 1];
        instance.onmessage({
          data: JSON.stringify({
            version: 1, areaName: 'IslandA', islandId: 1, areaIndex: 0,
            entries: [{ productGuid: 2138, generation: 10, consumption: 4, perfectGeneration: 20, perfectConsumption: 8, buildings: 3 }]
          })
        });
        instance.onmessage({
          data: JSON.stringify({
            version: 1, areaName: 'IslandB', islandId: 2, areaIndex: 0,
            entries: [{ productGuid: 2138, generation: 77, consumption: 33, perfectGeneration: 100, perfectConsumption: 40, buildings: 9 }]
          })
        });

        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        view.onIslandClick({ islandId: 2, areaIndex: 0 }, true);

        const row = view.filteredRows().find((r: any) => r.productGuid === 2138);
        return {
          generation: row.generation(),
          consumption: row.consumption(),
          perfectGeneration: row.perfectGeneration(),
          perfectConsumption: row.perfectConsumption(),
          buildings: row.buildings()
        };
      });

      expect(result).toEqual({ generation: 87, consumption: 37, perfectGeneration: 120, perfectConsumption: 48, buildings: 12 });
    });

    test('regression: a single checked island produces output identical to today\'s single-island behavior', async ({ page }) => {
      const result = await page.evaluate(() => {
        const instances = (window as any).__mockEventSourceInstances;
        const instance = instances[instances.length - 1];
        instance.onmessage({
          data: JSON.stringify({
            version: 1, areaName: 'IslandA', islandId: 1, areaIndex: 0,
            entries: [{ productGuid: 2138, generation: 10, consumption: 4, perfectGeneration: 20, perfectConsumption: 8, buildings: 3 }]
          })
        });

        const view = (window as any).statisticsView;
        // Old single-island behavior for comparison: island.rows() directly (pre-U3 filteredRows
        // derivation), same category filter ('All' -> no filtering) and product ordering.
        const island = (window as any).statisticsFeed.islands()[0];
        const oldRow = island.rows().find((r: any) => r.productGuid === 2138);
        const oldExpected = {
          generation: oldRow.generation(), consumption: oldRow.consumption(),
          perfectGeneration: oldRow.perfectGeneration(), perfectConsumption: oldRow.perfectConsumption(),
          buildings: oldRow.buildings()
        };

        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        const newRow = view.filteredRows().find((r: any) => r.productGuid === 2138);
        const newActual = {
          generation: newRow.generation(), consumption: newRow.consumption(),
          perfectGeneration: newRow.perfectGeneration(), perfectConsumption: newRow.perfectConsumption(),
          buildings: newRow.buildings()
        };

        return { oldExpected, newActual, rowCount: view.filteredRows().length };
      });

      expect(result.newActual).toEqual(result.oldExpected);
      expect(result.rowCount).toBe(1);
    });

    test('edge case: a product guid present in only one checked island appears once, with that island\'s own values', async ({ page }) => {
      const result = await page.evaluate(() => {
        const instances = (window as any).__mockEventSourceInstances;
        const instance = instances[instances.length - 1];
        instance.onmessage({
          data: JSON.stringify({
            version: 1, areaName: 'IslandA', islandId: 1, areaIndex: 0,
            entries: [
              { productGuid: 2138, generation: 10, consumption: 4, perfectGeneration: 20, perfectConsumption: 8, buildings: 3 },
              { productGuid: 2137, generation: 6, consumption: 2, perfectGeneration: 12, perfectConsumption: 4, buildings: 2 }
            ]
          })
        });
        instance.onmessage({
          data: JSON.stringify({
            version: 1, areaName: 'IslandB', islandId: 2, areaIndex: 0,
            entries: [{ productGuid: 2138, generation: 77, consumption: 33, perfectGeneration: 100, perfectConsumption: 40, buildings: 9 }]
          })
        });

        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        view.onIslandClick({ islandId: 2, areaIndex: 0 }, true);

        const rows = view.filteredRows();
        const breadRows = rows.filter((r: any) => r.productGuid === 2137);
        return {
          totalRowCount: rows.length,
          breadRowCount: breadRows.length,
          breadGeneration: breadRows[0].generation(),
          breadConsumption: breadRows[0].consumption(),
          breadBuildings: breadRows[0].buildings()
        };
      });

      expect(result.totalRowCount).toBe(2);
      expect(result.breadRowCount).toBe(1);
      expect(result.breadGeneration).toBe(6); // IslandA's own value, not zeroed or doubled
      expect(result.breadConsumption).toBe(2);
      expect(result.breadBuildings).toBe(2);
    });

    test('row identity: an unrelated product\'s row object is reused across ticks, not replaced (code-review fix)', async ({ page }) => {
      // Code-review finding: filteredRows used to allocate a brand-new MergedRowViewModel (with
      // brand-new ko.observables) for every guid on every recompute, so a single SSE tick updating
      // ANY row's value replaced the object identity of EVERY row - defeating <tbody data-bind=
      // "foreach: filteredRows">'s diff-by-identity and forcing a full DOM rebuild every tick. This
      // asserts row objects are reused (===) across ticks for a guid whose own values didn't change,
      // while a guid whose values DID change still reflects the new sum through the SAME object.
      const result = await page.evaluate(() => {
        const instances = (window as any).__mockEventSourceInstances;
        const instance = instances[instances.length - 1];
        instance.onmessage({
          data: JSON.stringify({
            version: 1, areaName: 'IslandA', islandId: 1, areaIndex: 0,
            entries: [
              { productGuid: 2138, generation: 10, consumption: 4, perfectGeneration: 20, perfectConsumption: 8, buildings: 3 },
              { productGuid: 2137, generation: 6, consumption: 2, perfectGeneration: 12, perfectConsumption: 4, buildings: 2 }
            ]
          })
        });

        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);

        const before = view.filteredRows();
        const wineRowBefore = before.find((r: any) => r.productGuid === 2138);
        const breadRowBefore = before.find((r: any) => r.productGuid === 2137);

        // Only Wine's (2138) values change on this tick - Bread (2137) is untouched.
        instance.onmessage({
          data: JSON.stringify({
            version: 1, areaName: 'IslandA', islandId: 1, areaIndex: 0,
            entries: [
              { productGuid: 2138, generation: 99, consumption: 44, perfectGeneration: 20, perfectConsumption: 8, buildings: 3 },
              { productGuid: 2137, generation: 6, consumption: 2, perfectGeneration: 12, perfectConsumption: 4, buildings: 2 }
            ]
          })
        });

        const after = view.filteredRows();
        const wineRowAfter = after.find((r: any) => r.productGuid === 2138);
        const breadRowAfter = after.find((r: any) => r.productGuid === 2137);

        return {
          wineSameObject: wineRowBefore === wineRowAfter,
          breadSameObject: breadRowBefore === breadRowAfter,
          wineGenerationAfter: wineRowAfter.generation(),
          breadGenerationAfter: breadRowAfter.generation()
        };
      });

      // Both rows keep their identity (KTD8-style: update in place, never swap identity) - Wine's
      // updated value still flows through the SAME object, proving reuse isn't stale caching.
      expect(result.wineSameObject).toBe(true);
      expect(result.breadSameObject).toBe(true);
      expect(result.wineGenerationAfter).toBe(99);
      expect(result.breadGenerationAfter).toBe(6);
    });

    test('edge case: zero checked islands (reachable before any island has arrived, R19) renders an empty table', async ({ page }) => {
      // No seedThreeIslands call here - nothing has arrived yet, checkedKeys is still empty, and
      // the U3 bridge's selectedIsland fallback is also undefined (no auto-select has fired).
      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        return { filteredRows: view.filteredRows(), categories: view.categories(), checkedIslands: view.checkedIslands() };
      });

      expect(result.filteredRows).toEqual([]);
      expect(result.categories).toEqual(['All']);
      expect(result.checkedIslands).toEqual([]);
    });

    test('areaName/sessionInfo: single checked island resolves the real name/session (regression); multi/zero checked degrade gracefully', async ({ page }) => {
      const result = await page.evaluate(() => {
        const sessionConfig = (window as any).params.sessions;
        const s0 = sessionConfig[0]?.guid;

        const instances = (window as any).__mockEventSourceInstances;
        const instance = instances[instances.length - 1];
        instance.onmessage({
          data: JSON.stringify({ version: 1, areaName: 'IslandA', islandId: 1, areaIndex: 0, sessionGuid: s0, entries: [] })
        });
        instance.onmessage({
          data: JSON.stringify({ version: 1, areaName: 'IslandB', islandId: 2, areaIndex: 0, sessionGuid: s0, entries: [] })
        });

        const view = (window as any).statisticsView;

        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        const singleAreaName = view.areaName();
        const singleSessionInfo = view.sessionInfo();

        view.onIslandClick({ islandId: 2, areaIndex: 0 }, true);
        const multiAreaName = view.areaName();
        const multiSessionInfo = view.sessionInfo();

        return {
          singleAreaName, singleSessionName: singleSessionInfo ? singleSessionInfo.name : null,
          multiAreaName, multiSessionInfo
        };
      });

      expect(result.singleAreaName).toBe('IslandA');
      expect(result.singleSessionName).toBeTruthy(); // real session resolved (regression)
      expect(result.multiAreaName).toBe('2 islands selected');
      expect(result.multiSessionInfo).toBeNull();
    });

    test('categories: union across two checked islands with different category sets, in productFilters order', async ({ page }) => {
      // Wine (2138) and Bread (2137) both resolve to "Consumer Goods" (tests/AGENTS.md GUID table).
      // A guid with no productFilters match resolves to "Other" (KTD6) - use that as the second,
      // distinct category so the two checked islands contribute different category sets.
      const result = await page.evaluate(() => {
        const instances = (window as any).__mockEventSourceInstances;
        const instance = instances[instances.length - 1];
        instance.onmessage({
          data: JSON.stringify({
            version: 1, areaName: 'IslandA', islandId: 1, areaIndex: 0,
            entries: [{ productGuid: 2138, generation: 10, consumption: 4, perfectGeneration: 20, perfectConsumption: 8, buildings: 3 }]
          })
        });
        instance.onmessage({
          data: JSON.stringify({
            version: 1, areaName: 'IslandB', islandId: 2, areaIndex: 0,
            entries: [{ productGuid: 999999999, generation: 3, consumption: 1, perfectGeneration: 10, perfectConsumption: 10, buildings: 1 }]
          })
        });

        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        view.onIslandClick({ islandId: 2, areaIndex: 0 }, true);

        return view.categories();
      });

      expect(result[0]).toBe('All');
      expect(result).toContain('Consumer Goods');
      expect(result).toContain('Other');
      expect(result).toHaveLength(3);
    });
  });

  test('R9: checking collection A then collection B leaves only B active, never both', async ({ page }) => {
    await seedThreeIslands(page);
    const result = await page.evaluate(() => {
      const view = (window as any).statisticsView;
      view.collections.push({ id: 'a', name: 'A', members: [{ islandId: 1, areaIndex: 0 }] });
      view.collections.push({ id: 'b', name: 'B', members: [{ islandId: 2, areaIndex: 0 }] });
      view.onCollectionCheck('a');
      const activeAfterA = view.activeCollectionId();
      view.onCollectionCheck('b');
      const activeAfterB = view.activeCollectionId();
      const collectionA = view.collections().find((c: any) => c.id === 'a');
      return { activeAfterA, activeAfterB, checkedAfterB: view.checkedKeys(), collectionAMembers: collectionA.members };
    });
    expect(result.activeAfterA).toBe('a');
    expect(result.activeAfterB).toBe('b');
    expect(result.checkedAfterB).toEqual([{ islandId: 2, areaIndex: 0 }]);
    // R9's switch to B must not corrupt A's own stored membership.
    expect(result.collectionAMembers).toEqual([{ islandId: 1, areaIndex: 0 }]);
  });

  // U4 of the plan: createCollection/deleteCollection CRUD, and localStorage persistence/restore
  // of collections + the active selection (R14-R17, R19, R24) on `StatisticsViewModel`.
  test.describe('U4: collection CRUD + persistence/restore', () => {
    const STORAGE_KEY = 'statisticsCollections';

    test('happy path (AE7): create a collection from the current checked set - active, matching members, checked set unchanged', async ({ page }) => {
      await seedThreeIslands(page);
      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        view.onIslandClick({ islandId: 2, areaIndex: 0 }, true);
        const checkedBefore = view.checkedKeys().slice();
        view.createCollection('My Pair');
        const collections = view.collections();
        return {
          checkedBefore,
          checkedAfter: view.checkedKeys(),
          activeCollectionId: view.activeCollectionId(),
          collectionCount: collections.length,
          newCollection: collections[collections.length - 1]
        };
      });
      expect(result.checkedAfter).toEqual(result.checkedBefore);
      expect(result.collectionCount).toBe(1);
      expect(result.newCollection.name).toBe('My Pair');
      expect(result.newCollection.id).toBe(result.activeCollectionId);
      expect(result.newCollection.members.sort((a: any, b: any) => a.islandId - b.islandId)).toEqual([
        { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }
      ]);
    });

    test('edge case (R14): creating a collection with a duplicate name succeeds under a distinct id', async ({ page }) => {
      await seedThreeIslands(page);
      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        view.createCollection('Same Name');
        const firstId = view.activeCollectionId();
        view.onIslandClick({ islandId: 2, areaIndex: 0 }, false);
        view.createCollection('Same Name');
        const secondId = view.activeCollectionId();
        return { firstId, secondId, collections: view.collections() };
      });
      expect(result.firstId).not.toBe(result.secondId);
      expect(result.collections).toHaveLength(2);
      expect(result.collections[0].name).toBe('Same Name');
      expect(result.collections[1].name).toBe('Same Name');
    });

    test('edge case (R14): createCollection no-ops on a blank/whitespace-only name', async ({ page }) => {
      await seedThreeIslands(page);
      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        const activeBefore = view.activeCollectionId();
        view.createCollection('   ');
        return { activeAfter: view.activeCollectionId(), collections: view.collections(), activeBefore };
      });
      expect(result.collections).toEqual([]);
      expect(result.activeAfter).toBe(result.activeBefore);
    });

    test('edge case (R14): createCollection no-ops when checkedKeys is empty', async ({ page }) => {
      // No seedThreeIslands/no clicks - checkedKeys starts empty (nothing has arrived).
      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        view.createCollection('Nothing Checked');
        return { collections: view.collections(), activeCollectionId: view.activeCollectionId() };
      });
      expect(result.collections).toEqual([]);
      expect(result.activeCollectionId).toBeUndefined();
    });

    test('happy path (AE5): delete the active collection - checked islands remain checked, no collection active', async ({ page }) => {
      await seedThreeIslands(page);
      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        view.onIslandClick({ islandId: 2, areaIndex: 0 }, true);
        view.createCollection('ToDelete');
        const id = view.activeCollectionId();
        const checkedBefore = view.checkedKeys().slice();
        view.deleteCollection(id);
        return {
          checkedAfter: view.checkedKeys(),
          checkedBefore,
          activeAfter: view.activeCollectionId(),
          collections: view.collections()
        };
      });
      expect(result.checkedAfter).toEqual(result.checkedBefore);
      expect(result.activeAfter).toBeUndefined();
      expect(result.collections).toEqual([]);
    });

    test('edge case (R15): deleting a NON-active collection leaves activeCollectionId and checkedKeys untouched', async ({ page }) => {
      await seedThreeIslands(page);
      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        view.createCollection('Collection A');
        const idA = view.activeCollectionId();
        view.onIslandClick({ islandId: 2, areaIndex: 0 }, false);
        view.createCollection('Collection B');
        const idB = view.activeCollectionId();
        const checkedBefore = view.checkedKeys().slice();
        view.deleteCollection(idA); // A is not active (B is)
        return {
          checkedAfter: view.checkedKeys(),
          checkedBefore,
          activeAfter: view.activeCollectionId(),
          idB,
          remaining: view.collections().map((c: any) => c.id)
        };
      });
      expect(result.checkedAfter).toEqual(result.checkedBefore);
      expect(result.activeAfter).toBe(result.idB);
      expect(result.remaining).toEqual([result.idB]);
    });

    test('happy path (AE15): a genuinely first visit (no persisted state) auto-checks the first arriving island', async ({ page }) => {
      // beforeEach already did a fresh page.goto with no prior localStorage writes to this key -
      // localStorage.getItem(STORAGE_KEY) returns null (never written), distinguishing R24 from a
      // persisted-but-empty selection (R19), which would have the key present.
      const result = await page.evaluate(() => {
        const instances = (window as any).__mockEventSourceInstances;
        const instance = instances[instances.length - 1];
        instance.onmessage({ data: JSON.stringify({ version: 1, areaName: 'IslandA', islandId: 1, areaIndex: 0, entries: [] }) });
        const view = (window as any).statisticsView;
        return { checkedKeys: view.checkedKeys(), activeCollectionId: view.activeCollectionId() };
      });
      expect(result.checkedKeys).toEqual([{ islandId: 1, areaIndex: 0 }]);
      expect(result.activeCollectionId).toBeUndefined();
    });

    test('happy path (AE6): reload with a persisted active collection - once members arrive, they show checked and the collection shows active', async ({ page }) => {
      await seedThreeIslands(page);
      await page.evaluate(() => {
        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        view.onIslandClick({ islandId: 2, areaIndex: 0 }, true);
        view.createCollection('Persisted Pair');
      });

      // Simulate a reload: re-navigate within the same test - Playwright persists localStorage for
      // the origin across navigations within a test, so the freshly constructed StatisticsViewModel
      // reads back what the write-back computed above already saved.
      await installMockEventSource(page);
      await page.goto('/statistics.html');
      await page.waitForFunction(() => (window as any).statisticsFeed !== undefined);
      await page.evaluate(() => (window as any).statisticsFeed.connect());

      const beforeArrival = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        return { checkedKeys: view.checkedKeys(), activeCollectionId: view.activeCollectionId() };
      });
      // R19: nothing checked yet - none of the persisted-checked islands have re-arrived.
      expect(beforeArrival.checkedKeys).toEqual([]);
      // The restored collection itself is active immediately (independent of member arrival).
      expect(beforeArrival.activeCollectionId).toBeTruthy();

      await seedThreeIslands(page);
      const afterArrival = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        return { checkedKeys: view.checkedKeys(), activeCollectionId: view.activeCollectionId() };
      });
      expect(afterArrival.checkedKeys.sort((a: any, b: any) => a.islandId - b.islandId)).toEqual([
        { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }
      ]);
      expect(afterArrival.activeCollectionId).toBe(beforeArrival.activeCollectionId);
    });

    test('edge case (AE12): reload with none of the persisted-checked islands arrived - nothing checked, no collection active', async ({ page }) => {
      await seedThreeIslands(page);
      await page.evaluate(() => {
        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        view.createCollection('Never Arrives');
      });

      await installMockEventSource(page);
      await page.goto('/statistics.html');
      await page.waitForFunction(() => (window as any).statisticsFeed !== undefined);
      await page.evaluate(() => (window as any).statisticsFeed.connect());
      // Deliberately do NOT re-send island 1's message this time.

      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        return { checkedKeys: view.checkedKeys(), filteredRows: view.filteredRows() };
      });
      expect(result.checkedKeys).toEqual([]);
      expect(result.filteredRows).toEqual([]);
    });

    test('regression (KTD2): reload restores checkedKeys via the ordinary R17 snapshot (no All-Islands-specific persisted state), and "All Islands" shows checked again once every restored island re-arrives - a brand-new island does NOT auto-join until the user re-expresses the group-select gesture in the new session (KTD6 refinement)', async ({ page }) => {
      await seedThreeIslands(page);
      await page.evaluate(() => {
        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        view.onIslandClick({ islandId: 2, areaIndex: 0 }, true);
        view.onIslandClick({ islandId: 3, areaIndex: 0 }, true); // A, B, C all checked - the entire known set
      });

      await installMockEventSource(page);
      await page.goto('/statistics.html');
      await page.waitForFunction(() => (window as any).statisticsFeed !== undefined);
      await page.evaluate(() => (window as any).statisticsFeed.connect());

      // No activeCollectionId sentinel is involved at all (KTD2) - just the ordinary checked-keys
      // snapshot restoring. Once A, B, and C (the entire persisted set) re-arrive, "All Islands"
      // shows checked purely because isGroupChecked() derives it from checkedKeys/feed.islands.
      const afterRestore = await page.evaluate(() => {
        const instances = (window as any).__mockEventSourceInstances;
        const instance = instances[instances.length - 1];
        instance.onmessage({ data: JSON.stringify({ version: 1, areaName: 'IslandA', islandId: 1, areaIndex: 0, entries: [] }) });
        instance.onmessage({ data: JSON.stringify({ version: 1, areaName: 'IslandB', islandId: 2, areaIndex: 0, entries: [] }) });
        instance.onmessage({ data: JSON.stringify({ version: 1, areaName: 'IslandC', islandId: 3, areaIndex: 0, entries: [] }) });
        const view = (window as any).statisticsView;
        const allKeys = view.feed.islands().map((i: any) => ({ islandId: i.islandId(), areaIndex: i.areaIndex() }));
        return { activeCollectionId: view.activeCollectionId(), allIslandsChecked: view.isGroupChecked(allKeys)() };
      });
      expect(afterRestore.activeCollectionId).toBeUndefined();
      expect(afterRestore.allIslandsChecked).toBe(true);

      // A brand-new island D, never part of the persisted snapshot, arrives next - it does NOT
      // auto-join (KTD6 refinement): a plain reload-restore is never treated as an explicit
      // "select this whole group" gesture, only an actual onGroupToggle call in the current
      // session is. This is deliberate: without it, a smaller, unrelated persisted Collection that
      // merely happens to match the arrived count so far would also incorrectly pull in new
      // islands, regressing the Collections-unaffected guarantee (KD3/R13).
      const afterD = await page.evaluate(() => {
        const instances = (window as any).__mockEventSourceInstances;
        const instance = instances[instances.length - 1];
        instance.onmessage({ data: JSON.stringify({ version: 1, areaName: 'IslandD', islandId: 4, areaIndex: 0, entries: [] }) });
        const view = (window as any).statisticsView;
        return view.checkedKeys().slice().sort((a: any, b: any) => a.islandId - b.islandId);
      });
      expect(afterD).toEqual([
        { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }, { islandId: 3, areaIndex: 0 }
      ]);

      // Once the user explicitly re-expresses "select everything" in the new session (onGroupToggle
      // on the now-fully-checked group is a no-op per R11/KD7, so toggle it off then on again to
      // arm growth), a further new arrival E does auto-join.
      const afterGrow = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        const allKeysBeforeE = view.feed.islands().map((i: any) => ({ islandId: i.islandId(), areaIndex: i.areaIndex() }));
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, true); // ctrl-uncheck A, breaking "fully checked"
        view.onGroupToggle(allKeysBeforeE); // re-select everything currently known - arms growth

        const instances = (window as any).__mockEventSourceInstances;
        const instance = instances[instances.length - 1];
        instance.onmessage({ data: JSON.stringify({ version: 1, areaName: 'IslandE', islandId: 5, areaIndex: 0, entries: [] }) });
        const feedView = (window as any).statisticsView;
        return feedView.checkedKeys().slice().sort((a: any, b: any) => a.islandId - b.islandId);
      });
      expect(afterGrow).toEqual([
        { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }, { islandId: 3, areaIndex: 0 },
        { islandId: 4, areaIndex: 0 }, { islandId: 5, areaIndex: 0 }
      ]);
    });

    test('sanity: the persisted blob under STORAGE_KEY matches the KTD1 shape after a create', async ({ page }) => {
      await seedThreeIslands(page);
      await page.evaluate(() => {
        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        view.createCollection('Shape Check');
      });
      const raw = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string);
      expect(Array.isArray(parsed.collections)).toBe(true);
      expect(parsed.collections[0]).toEqual(
        expect.objectContaining({ id: expect.any(String), name: 'Shape Check', members: [{ islandId: 1, areaIndex: 0 }] })
      );
      expect(parsed.active).toEqual({ collectionId: parsed.collections[0].id, checked: [{ islandId: 1, areaIndex: 0 }] });
    });
  });
});
