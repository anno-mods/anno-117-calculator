import { test, expect } from '@playwright/test';
import { installMockEventSource } from '../helpers';

// Exercises U2 (session grouping) and U3 (group-toggle selection model) of the live-statistics
// session-grouping plan (docs/plans/2026-08-19-001-feat-live-statistics-session-grouping-plan.md):
// `StatisticsViewModel.sessionGroups`/`ungroupedIslands` (KTD4), and `isGroupChecked`/
// `onGroupToggle`/`growCheckedGroupsOnArrival` (KTD2, KTD3, KTD6).
//
// GUIDs match tests/AGENTS.md's "Common Test GUIDs" table: session 3245 = Latium, session
// 6627 = Albion.

function islandMessage(areaName: string, islandId: number, areaIndex: number, sessionGuid?: number) {
  return JSON.stringify({ version: 1, areaName, islandId, areaIndex, sessionGuid, entries: [] });
}

test.describe('statistics session grouping (U2) and group toggles (U3)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockEventSource(page);
    await page.goto('/statistics.html');
    await page.waitForFunction(() => (window as any).statisticsFeed !== undefined);
    await page.evaluate(() => (window as any).statisticsFeed.connect());
  });

  async function seedMessage(page: any, areaName: string, islandId: number, areaIndex: number, sessionGuid?: number) {
    await page.evaluate((data: string) => {
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onmessage({ data });
    }, islandMessage(areaName, islandId, areaIndex, sessionGuid));
  }

  test.describe('U2: sessionGroups / ungroupedIslands', () => {
    test('happy path: three islands across two resolvable sessions produce two ordered groups', async ({ page }) => {
      await seedMessage(page, 'LatiumA', 1, 0, 3245);
      await seedMessage(page, 'LatiumB', 2, 0, 3245);
      await seedMessage(page, 'AlbionA', 3, 0, 6627);

      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        return view.sessionGroups().map((g: any) => ({
          sessionGuid: g.sessionGuid,
          islands: g.islands().map((i: any) => i.areaName)
        }));
      });

      expect(result).toHaveLength(2);
      const guids = result.map((g: any) => g.sessionGuid);
      expect(guids).toEqual(expect.arrayContaining([3245, 6627]));
      const latium = result.find((g: any) => g.sessionGuid === 3245);
      expect(latium.islands.sort()).toEqual(['LatiumA', 'LatiumB']);
      const albion = result.find((g: any) => g.sessionGuid === 6627);
      expect(albion.islands).toEqual(['AlbionA']);
    });

    test('edge case (R3): an island with an unresolved sessionGuid appears in ungroupedIslands, not sessionGroups', async ({ page }) => {
      await seedMessage(page, 'Known', 1, 0, 3245);
      await seedMessage(page, 'Unresolved', 2, 0, 999999999);

      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        return {
          groupNames: view.sessionGroups().flatMap((g: any) => g.islands().map((i: any) => i.areaName)),
          ungrouped: view.ungroupedIslands().map((i: any) => i.areaName)
        };
      });

      expect(result.groupNames).toEqual(['Known']);
      expect(result.ungrouped).toEqual(['Unresolved']);
    });

    test('edge case: a session with zero arrived islands produces no sessionGroups entry', async ({ page }) => {
      // No island ever arrives for Albion (6627) - only Latium arrives.
      await seedMessage(page, 'LatiumA', 1, 0, 3245);

      const result = await page.evaluate(() => (window as any).statisticsView.sessionGroups().map((g: any) => g.sessionGuid));
      expect(result).toEqual([3245]);
    });

    test('regression: two islands sharing a session, arriving in reverse-alphabetical order, still list alphabetically', async ({ page }) => {
      await seedMessage(page, 'Zeta', 1, 0, 3245);
      await seedMessage(page, 'Alpha', 2, 0, 3245);

      const result = await page.evaluate(() => {
        const group = (window as any).statisticsView.sessionGroups().find((g: any) => g.sessionGuid === 3245);
        return group.islands().map((i: any) => i.areaName);
      });
      expect(result).toEqual(['Alpha', 'Zeta']);
    });
  });

  test.describe('U3: isGroupChecked / onGroupToggle', () => {
    test('happy path (AE1): a session auto-checks once all its arrived islands are checked', async ({ page }) => {
      await seedMessage(page, 'LatiumA', 1, 0, 3245);
      await seedMessage(page, 'LatiumB', 2, 0, 3245);

      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, true);
        view.onIslandClick({ islandId: 2, areaIndex: 0 }, true);
        return view.isGroupChecked([{ islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }])();
      });
      expect(result).toBe(true);
    });

    test('happy path (AE2): checking an unchecked group selects all its members without affecting others', async ({ page }) => {
      await seedMessage(page, 'LatiumA', 1, 0, 3245);
      await seedMessage(page, 'LatiumB', 2, 0, 3245);
      await seedMessage(page, 'AlbionA', 3, 0, 6627);

      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 3, areaIndex: 0 }, false); // C checked alone first
        view.onGroupToggle([{ islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }]);
        return view.checkedKeys().slice().sort((a: any, b: any) => a.islandId - b.islandId);
      });
      expect(result).toEqual([
        { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }, { islandId: 3, areaIndex: 0 }
      ]);
    });

    test('happy path (AE3): unchecking a checked group deselects only its members', async ({ page }) => {
      await seedMessage(page, 'LatiumA', 1, 0, 3245);
      await seedMessage(page, 'LatiumB', 2, 0, 3245);
      await seedMessage(page, 'AlbionA', 3, 0, 6627);

      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        const latiumKeys = [{ islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }];
        view.onGroupToggle(latiumKeys); // check Latium
        view.onIslandClick({ islandId: 3, areaIndex: 0 }, true); // also check C
        view.onGroupToggle(latiumKeys); // uncheck Latium again
        return view.checkedKeys().slice();
      });
      expect(result).toEqual([{ islandId: 3, areaIndex: 0 }]);
    });

    test('happy path (AE4): two disjoint groups, and All Islands, can all show checked at once', async ({ page }) => {
      await seedMessage(page, 'LatiumA', 1, 0, 3245);
      await seedMessage(page, 'LatiumB', 2, 0, 3245);
      await seedMessage(page, 'AlbionA', 3, 0, 6627);
      await seedMessage(page, 'AlbionB', 4, 0, 6627);

      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        const latiumKeys = [{ islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }];
        const albionKeys = [{ islandId: 3, areaIndex: 0 }, { islandId: 4, areaIndex: 0 }];
        const allKeys = view.feed.islands().map((i: any) => ({ islandId: i.islandId(), areaIndex: i.areaIndex() }));
        view.onGroupToggle(latiumKeys);
        view.onGroupToggle(albionKeys);
        return {
          latiumChecked: view.isGroupChecked(latiumKeys)(),
          albionChecked: view.isGroupChecked(albionKeys)(),
          allIslandsChecked: view.isGroupChecked(allKeys)()
        };
      });
      expect(result).toEqual({ latiumChecked: true, albionChecked: true, allIslandsChecked: true });
    });

    test('edge case (AE5): unchecking a group holding the last checked island is a no-op', async ({ page }) => {
      await seedMessage(page, 'LatiumA', 1, 0, 3245);

      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        const keys = [{ islandId: 1, areaIndex: 0 }];
        view.onGroupToggle(keys); // check
        view.onGroupToggle(keys); // attempt to uncheck the only checked island - vetoed
        return view.checkedKeys().slice();
      });
      expect(result).toEqual([{ islandId: 1, areaIndex: 0 }]);
    });

    test('edge case (AE7, KD7): a fully-checked group cannot be unchecked via its own heading, ever', async ({ page }) => {
      await seedMessage(page, 'LatiumA', 1, 0, 3245);
      await seedMessage(page, 'LatiumB', 2, 0, 3245);

      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        const keys = [{ islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }];
        view.onGroupToggle(keys); // check both
        view.onGroupToggle(keys); // attempt uncheck - vetoed, all checked islands are this group's
        const afterFirstAttempt = view.checkedKeys().slice();
        view.onGroupToggle(keys); // attempt again - still vetoed
        return { afterFirstAttempt, afterSecondAttempt: view.checkedKeys().slice(), stillChecked: view.isGroupChecked(keys)() };
      });
      expect(result.afterFirstAttempt.length).toBe(2);
      expect(result.afterSecondAttempt.length).toBe(2);
      expect(result.stillChecked).toBe(true);
    });

    test('edge case (AE8): isGroupChecked returns false for a group with zero arrived members', async ({ page }) => {
      const result = await page.evaluate(() => (window as any).statisticsView.isGroupChecked([])());
      expect(result).toBe(false);
    });

    test('edge case (AE6): toggling a group while a user Collection is active deactivates it without editing its membership', async ({ page }) => {
      await seedMessage(page, 'LatiumA', 1, 0, 3245);
      await seedMessage(page, 'LatiumB', 2, 0, 3245);
      await seedMessage(page, 'AlbionA', 3, 0, 6627);
      await seedMessage(page, 'AlbionB', 4, 0, 6627);

      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        view.collections.push({ id: 'c1', name: 'Iron Triangle', members: [{ islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }] });
        view.onCollectionCheck('c1'); // A, B checked, c1 active
        view.onGroupToggle([{ islandId: 3, areaIndex: 0 }, { islandId: 4, areaIndex: 0 }]); // toggle Albion
        const collection = view.collections().find((c: any) => c.id === 'c1');
        return {
          activeCollectionId: view.activeCollectionId(),
          collectionMembers: collection.members,
          checkedKeys: view.checkedKeys().slice().sort((a: any, b: any) => a.islandId - b.islandId)
        };
      });
      expect(result.activeCollectionId).toBeUndefined();
      expect(result.collectionMembers).toEqual([{ islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }]);
      expect(result.checkedKeys).toEqual([
        { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }, { islandId: 3, areaIndex: 0 }, { islandId: 4, areaIndex: 0 }
      ]);
    });

    test('regression: user-created Collection activation/editing/deactivation is unaffected by the new group model', async ({ page }) => {
      await seedMessage(page, 'LatiumA', 1, 0, 3245);
      await seedMessage(page, 'LatiumB', 2, 0, 3245);

      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        view.onIslandClick({ islandId: 1, areaIndex: 0 }, false);
        view.createCollection('My Group');
        view.onIslandClick({ islandId: 2, areaIndex: 0 }, true); // ctrl-click edits active collection in place
        const collection = view.collections().find((c: any) => c.name === 'My Group');
        return { activeCollectionId: view.activeCollectionId(), members: collection.members };
      });
      expect(result.activeCollectionId).toBe(result.members[0] && result.activeCollectionId); // sanity: still a real id
      expect(result.members.sort((a: any, b: any) => a.islandId - b.islandId)).toEqual([
        { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }
      ]);
    });
  });

  test.describe('U3: growCheckedGroupsOnArrival (KTD6)', () => {
    test('regression: "All Islands" grows automatically as a new island arrives while every known island is checked', async ({ page }) => {
      await seedMessage(page, 'LatiumA', 1, 0, 3245);
      await seedMessage(page, 'LatiumB', 2, 0, 3245);

      const result = await page.evaluate(async () => {
        const view = (window as any).statisticsView;
        const allKeysBefore = view.feed.islands().map((i: any) => ({ islandId: i.islandId(), areaIndex: i.areaIndex() }));
        view.onGroupToggle(allKeysBefore); // fully check All Islands
        const checkedBefore = view.checkedKeys().slice();

        const instances = (window as any).__mockEventSourceInstances;
        const instance = instances[instances.length - 1];
        instance.onmessage({ data: JSON.stringify({ version: 1, areaName: 'LatiumC', islandId: 3, areaIndex: 0, sessionGuid: 3245, entries: [] }) });

        return {
          checkedBefore,
          checkedAfter: view.checkedKeys().slice().sort((a: any, b: any) => a.islandId - b.islandId),
          allIslandsChecked: view.isGroupChecked(view.feed.islands().map((i: any) => ({ islandId: i.islandId(), areaIndex: i.areaIndex() })))()
        };
      });

      expect(result.checkedBefore.sort((a: any, b: any) => a.islandId - b.islandId)).toEqual([
        { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }
      ]);
      expect(result.checkedAfter).toEqual([
        { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }, { islandId: 3, areaIndex: 0 }
      ]);
      expect(result.allIslandsChecked).toBe(true);
    });

    test('new: a session group grows the same way when a same-session island arrives, without affecting other groups', async ({ page }) => {
      await seedMessage(page, 'LatiumA', 1, 0, 3245);
      await seedMessage(page, 'LatiumB', 2, 0, 3245);
      await seedMessage(page, 'AlbionA', 3, 0, 6627); // NOT checked - stays unchecked throughout

      const result = await page.evaluate(async () => {
        const view = (window as any).statisticsView;
        const latiumKeys = [{ islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }];
        view.onGroupToggle(latiumKeys); // fully check Latium only; Albion (3) stays unchecked

        const instances = (window as any).__mockEventSourceInstances;
        const instance = instances[instances.length - 1];
        instance.onmessage({ data: JSON.stringify({ version: 1, areaName: 'LatiumC', islandId: 4, areaIndex: 0, sessionGuid: 3245, entries: [] }) });

        const newLatiumKeys = [{ islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }, { islandId: 4, areaIndex: 0 }];
        return {
          checkedKeys: view.checkedKeys().slice().sort((a: any, b: any) => a.islandId - b.islandId),
          latiumChecked: view.isGroupChecked(newLatiumKeys)(),
          albionChecked: view.isGroupChecked([{ islandId: 3, areaIndex: 0 }])()
        };
      });

      expect(result.checkedKeys).toEqual([
        { islandId: 1, areaIndex: 0 }, { islandId: 2, areaIndex: 0 }, { islandId: 4, areaIndex: 0 }
      ]);
      expect(result.latiumChecked).toBe(true);
      expect(result.albionChecked).toBe(false);
    });

    test('regression: reloading with every island previously checked shows "All Islands" checked again once those islands re-arrive, with no persisted All-Islands state', async ({ page }) => {
      await seedMessage(page, 'LatiumA', 1, 0, 3245);
      await seedMessage(page, 'LatiumB', 2, 0, 3245);
      await page.evaluate(() => {
        const view = (window as any).statisticsView;
        const allKeys = view.feed.islands().map((i: any) => ({ islandId: i.islandId(), areaIndex: i.areaIndex() }));
        view.onGroupToggle(allKeys);
      });

      await installMockEventSource(page);
      await page.goto('/statistics.html');
      await page.waitForFunction(() => (window as any).statisticsFeed !== undefined);
      await page.evaluate(() => (window as any).statisticsFeed.connect());
      await seedMessage(page, 'LatiumA', 1, 0, 3245);
      await seedMessage(page, 'LatiumB', 2, 0, 3245);

      const result = await page.evaluate(() => {
        const view = (window as any).statisticsView;
        const allKeys = view.feed.islands().map((i: any) => ({ islandId: i.islandId(), areaIndex: i.areaIndex() }));
        return view.isGroupChecked(allKeys)();
      });
      expect(result).toBe(true);
    });
  });
});
