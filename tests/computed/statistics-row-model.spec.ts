import { test, expect } from '@playwright/test';
import { installMockEventSource } from '../helpers';

// Exercises the row view-model in src/statistics-feed.ts (U3 of the live-statistics-page plan):
// row creation/update-in-place, first-seen insertion order (KTD8), and R14's defensive numeric
// coercion. See tests/helpers/mock-event-source.ts for the shared fake-EventSource rationale.
//
// GUIDs below match tests/AGENTS.md's "Common Test GUIDs" table:
// - Product 2138 "Wine"
// - Product 2137 "Bread"
// - Session 3245 "Latium"

test.describe('statistics-feed row model (KTD8, R14)', () => {
  test.beforeEach(async ({ page }) => {
    await installMockEventSource(page);
    await page.goto('/statistics.html');
    await page.waitForFunction(() => (window as any).statisticsFeed !== undefined);
    await page.evaluate(() => (window as any).statisticsFeed.connect());
  });

  test('first message populates one row per entry, values matching the payload', async ({ page }) => {
    const payload = JSON.stringify({
      version: 1,
      areaName: 'Latium',
      islandId: 1,
      areaIndex: 0,
      sessionGuid: 3245,
      timeStamp: 1,
      entries: [
        { productGuid: 2138, generation: 10, consumption: 4, perfectGeneration: 20, perfectConsumption: 8, buildings: 3 },
        { productGuid: 2137, generation: 6, consumption: 2, perfectGeneration: 12, perfectConsumption: 4, buildings: 2 }
      ]
    });

    const result = await page.evaluate((data) => {
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onmessage({ data });
      const islands = (window as any).statisticsFeed.islands();
      const rows = islands[0].rows();
      return rows.map((r: any) => ({
        productGuid: r.productGuid,
        name: r.identity.name,
        generation: r.generation(),
        consumption: r.consumption(),
        perfectGeneration: r.perfectGeneration(),
        perfectConsumption: r.perfectConsumption(),
        buildings: r.buildings()
      }));
    }, payload);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ productGuid: 2138, name: 'Wine', generation: 10, consumption: 4, perfectGeneration: 20, perfectConsumption: 8, buildings: 3 });
    expect(result[1]).toMatchObject({ productGuid: 2137, name: 'Bread', generation: 6, consumption: 2, perfectGeneration: 12, perfectConsumption: 4, buildings: 2 });
  });

  test('second message updates existing row values in place - same length and order', async ({ page }) => {
    const first = JSON.stringify({
      version: 1,
      areaName: 'Latium',
      islandId: 1,
      areaIndex: 0,
      sessionGuid: 3245,
      timeStamp: 1,
      entries: [
        { productGuid: 2138, generation: 10, consumption: 4, perfectGeneration: 20, perfectConsumption: 8, buildings: 3 },
        { productGuid: 2137, generation: 6, consumption: 2, perfectGeneration: 12, perfectConsumption: 4, buildings: 2 }
      ]
    });
    const second = JSON.stringify({
      version: 1,
      areaName: 'Latium',
      islandId: 1,
      areaIndex: 0,
      sessionGuid: 3245,
      timeStamp: 2,
      entries: [
        { productGuid: 2138, generation: 99, consumption: 44, perfectGeneration: 20, perfectConsumption: 8, buildings: 5 },
        { productGuid: 2137, generation: 66, consumption: 22, perfectGeneration: 12, perfectConsumption: 4, buildings: 4 }
      ]
    });

    const result = await page.evaluate(({ first, second }) => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onmessage({ data: first });
      const islands = (window as any).statisticsFeed.islands();
      const lengthAfterFirst = islands[0].rows().length;
      const orderAfterFirst = islands[0].rows().map((r: any) => r.productGuid);

      instance.onmessage({ data: second });
      const rows = islands[0].rows();

      return {
        lengthAfterFirst,
        orderAfterFirst,
        lengthAfterSecond: rows.length,
        orderAfterSecond: rows.map((r: any) => r.productGuid),
        values: rows.map((r: any) => ({ productGuid: r.productGuid, generation: r.generation(), buildings: r.buildings() }))
      };
    }, { first, second });

    expect(result.lengthAfterSecond).toBe(result.lengthAfterFirst);
    expect(result.orderAfterSecond).toEqual(result.orderAfterFirst);
    expect(result.values).toEqual([
      { productGuid: 2138, generation: 99, buildings: 5 },
      { productGuid: 2137, generation: 66, buildings: 4 }
    ]);
  });

  test('an entry with an invalid/missing numeric field renders that field as zero; other entries still update', async ({ page }) => {
    const payload = JSON.stringify({
      version: 1,
      areaName: 'Latium',
      islandId: 1,
      areaIndex: 0,
      sessionGuid: 3245,
      timeStamp: 1,
      entries: [
        // generation is a non-numeric string, buildings key omitted entirely
        { productGuid: 2138, generation: 'not-a-number', consumption: 4, perfectGeneration: 20, perfectConsumption: 8 },
        // valid sibling entry in the same message
        { productGuid: 2137, generation: 6, consumption: 2, perfectGeneration: 12, perfectConsumption: 4, buildings: 2 }
      ]
    });

    const result = await page.evaluate((data) => {
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onmessage({ data });
      const islands = (window as any).statisticsFeed.islands();
      const rows = islands[0].rows();
      return rows.map((r: any) => ({
        productGuid: r.productGuid,
        generation: r.generation(),
        consumption: r.consumption(),
        buildings: r.buildings()
      }));
    }, payload);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ productGuid: 2138, generation: 0, consumption: 4, buildings: 0 });
    expect(result[1]).toMatchObject({ productGuid: 2137, generation: 6, consumption: 2, buildings: 2 });
  });

  test('extended entry fields (delta, totalMaintenance, totalIncome, totalProfit, summedProductivity, averageProductivity) parse from the payload', async ({ page }) => {
    const payload = JSON.stringify({
      version: 1,
      areaName: 'Latium',
      timeStamp: 1,
      sessionGuid: 3245,
      islandId: 7,
      areaIndex: 1,
      entries: [
        {
          productGuid: 2138, generation: 10, consumption: 4, delta: 6,
          perfectGeneration: 20, perfectConsumption: 8, buildings: 3,
          totalMaintenance: 50, totalIncome: 120.5, totalProfit: 70,
          summedProductivity: 2.4, averageProductivity: 0.8
        }
      ]
    });

    const result = await page.evaluate((data) => {
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onmessage({ data });
      const islands = (window as any).statisticsFeed.islands();
      const island = islands[0];
      const row = island.rows()[0];
      return {
        islandId: island.islandId(),
        areaIndex: island.areaIndex(),
        delta: row.delta(),
        totalMaintenance: row.totalMaintenance(),
        totalIncome: row.totalIncome(),
        totalProfit: row.totalProfit(),
        summedProductivity: row.summedProductivity(),
        averageProductivity: row.averageProductivity()
      };
    }, payload);

    expect(result).toEqual({
      islandId: 7,
      areaIndex: 1,
      delta: 6,
      totalMaintenance: 50,
      totalIncome: 120.5,
      totalProfit: 70,
      summedProductivity: 2.4,
      averageProductivity: 0.8
    });
  });

  test('missing/invalid extended entry fields coerce to zero (R14)', async ({ page }) => {
    const payload = JSON.stringify({
      version: 1,
      areaName: 'Latium',
      islandId: 1,
      areaIndex: 0,
      sessionGuid: 3245,
      timeStamp: 1,
      entries: [
        { productGuid: 2138, generation: 10, consumption: 4, totalMaintenance: 'not-a-number' }
      ]
    });

    const result = await page.evaluate((data) => {
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onmessage({ data });
      const row = (window as any).statisticsFeed.islands()[0].rows()[0];
      return {
        delta: row.delta(),
        totalMaintenance: row.totalMaintenance(),
        totalIncome: row.totalIncome(),
        totalProfit: row.totalProfit(),
        summedProductivity: row.summedProductivity(),
        averageProductivity: row.averageProductivity()
      };
    }, payload);

    expect(result).toEqual({
      delta: 0, totalMaintenance: 0, totalIncome: 0, totalProfit: 0,
      summedProductivity: 0, averageProductivity: 0
    });
  });

  test('a disconnect-shaped event (onerror) after data has been received does not clear rows', async ({ page }) => {
    const payload = JSON.stringify({
      version: 1,
      areaName: 'Latium',
      islandId: 1,
      areaIndex: 0,
      sessionGuid: 3245,
      timeStamp: 1,
      entries: [{ productGuid: 2138, generation: 10, consumption: 4, perfectGeneration: 20, perfectConsumption: 8, buildings: 3 }]
    });

    const result = await page.evaluate((data) => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onopen();
      instance.onmessage({ data });
      const islands = (window as any).statisticsFeed.islands();
      const before = islands[0].rows().map((r: any) => ({ productGuid: r.productGuid, generation: r.generation() }));

      instance.onerror();

      const after = islands[0].rows().map((r: any) => ({ productGuid: r.productGuid, generation: r.generation() }));
      return { before, after, state: (window as any).statisticsFeed.connectionState() };
    }, payload);

    expect(result.after).toEqual(result.before);
    expect(result.state).toBe('reconnecting');
  });

  test('multiple islands in same stream buffer separately and do not collide', async ({ page }) => {
    const result = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];

      // Message for Island A (Latium)
      instance.onmessage({
        data: JSON.stringify({
          version: 1,
          areaName: 'Latium',
          islandId: 1,
          areaIndex: 0,
          sessionGuid: 3245,
          entries: [{ productGuid: 2138, generation: 10, consumption: 4, perfectGeneration: 20, perfectConsumption: 8, buildings: 3 }]
        })
      });

      // Message for Island B (Nusquam)
      instance.onmessage({
        data: JSON.stringify({
          version: 1,
          areaName: 'Nusquam',
          islandId: 2,
          areaIndex: 0,
          sessionGuid: 3245,
          entries: [{ productGuid: 2138, generation: 99, consumption: 44, perfectGeneration: 200, perfectConsumption: 88, buildings: 5 }]
        })
      });

      const islands = (window as any).statisticsFeed.islands();
      return islands.map((isl: any) => ({
        areaName: isl.areaName,
        sessionIdentity: isl.sessionIdentity(),
        rows: isl.rows().map((r: any) => ({
          productGuid: r.productGuid,
          generation: r.generation()
        }))
      }));
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      areaName: 'Latium',
      sessionIdentity: 3245,
      rows: [{ productGuid: 2138, generation: 10 }]
    });
    expect(result[1]).toMatchObject({
      areaName: 'Nusquam',
      sessionIdentity: 3245,
      rows: [{ productGuid: 2138, generation: 99 }]
    });
  });

  // Session 3245/6627 collision regression (found in production via the session-grouping
  // feature): islandId alone repeats across sessions in real pipe data (areaIndex is constant),
  // so two different-session islands sharing an islandId must never collide into one
  // IslandFeedState - see StatisticsFeed.islandsByIdentity's doc.
  test('regression: two different-session islands sharing the same islandId/areaIndex do not collide', async ({ page }) => {
    const result = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];

      instance.onmessage({
        data: JSON.stringify({ version: 1, areaName: 'Juliana', islandId: 5, areaIndex: 1, sessionGuid: 3245, entries: [] })
      });
      // Same islandId (5) and areaIndex (1) as Juliana, but a different session - must be a
      // distinct island, not an overwrite of Juliana's identity.
      instance.onmessage({
        data: JSON.stringify({ version: 1, areaName: 'Cragmore', islandId: 5, areaIndex: 1, sessionGuid: 6627, entries: [] })
      });

      const islands = (window as any).statisticsFeed.islands();
      return islands.map((isl: any) => ({ areaName: isl.areaName, islandId: isl.islandId(), areaIndex: isl.areaIndex(), sessionIdentity: isl.sessionIdentity() }));
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ areaName: 'Juliana', islandId: 5, areaIndex: 1, sessionIdentity: 3245 });
    expect(result[1]).toEqual({ areaName: 'Cragmore', islandId: 5, areaIndex: 1, sessionIdentity: 6627 });
  });

  test('U1/R1: a numeric sessionGuid matching a params.sessions guid resolves that session', async ({ page }) => {
    const result = await page.evaluate(() => {
      const sessionGuid = ((window as any).params.sessions[0] || {}).guid;
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onmessage({
        data: JSON.stringify({ version: 1, areaName: 'Latium', islandId: 1, areaIndex: 0, sessionGuid, entries: [] })
      });
      const island = (window as any).statisticsFeed.islands()[0];
      const resolved = (window as any).statisticsParams.resolveSession(island.sessionIdentity());
      return { sessionIdentity: island.sessionIdentity(), resolvedGuid: resolved ? resolved.guid : null, expectedGuid: sessionGuid };
    });
    expect(result.sessionIdentity).toBe(result.expectedGuid);
    expect(result.resolvedGuid).toBe(result.expectedGuid);
  });

  test('U1/R3: a sessionGuid unmatched in params.sessions resolves no session, but the island is still created (a valid number still satisfies the identity requirement)', async ({ page }) => {
    const result = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onmessage({
        data: JSON.stringify({ version: 1, areaName: 'Latium', islandId: 1, areaIndex: 0, sessionGuid: 999999999, entries: [] })
      });
      const island = (window as any).statisticsFeed.islands()[0];
      return { islandExists: !!island, resolved: (window as any).statisticsParams.resolveSession(island.sessionIdentity()) };
    });
    expect(result.islandExists).toBe(true);
    expect(result.resolved).toBeNull();
  });

  test('U1/R2, identity: a message with sessionGuid missing or non-numeric is dropped entirely - sessionGuid is part of the hard identity, same as islandId/areaIndex', async ({ page }) => {
    const result = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      instance.onmessage({
        data: JSON.stringify({ version: 1, areaName: 'Latium', islandId: 1, areaIndex: 0, entries: [] })
      });
      instance.onmessage({
        data: JSON.stringify({ version: 1, areaName: 'Nusquam', islandId: 2, areaIndex: 0, sessionGuid: 'not-a-number', entries: [] })
      });
      return (window as any).statisticsFeed.islands().length;
    });
    expect(result).toBe(0);
  });

  test('U1/R2: a message carrying only the legacy sessionId field (no sessionGuid) is dropped entirely - sessionId plays no role in identity or session resolution', async ({ page }) => {
    const result = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      instances[instances.length - 1].onmessage({
        data: JSON.stringify({ version: 1, areaName: 'Latium', islandId: 1, areaIndex: 0, sessionId: 1, entries: [] })
      });
      return (window as any).statisticsFeed.islands().length;
    });
    expect(result).toBe(0);
  });

  test('U2/R6: session groups are ordered by session index; ungrouped (unresolvable) islands are separate, sorted by areaName', async ({ page }) => {
    const result = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];

      // Get session config array to identify valid session GUIDs
      const sessionConfig = (window as any).params.sessions;
      const s0 = sessionConfig[0]?.guid;
      const s1 = sessionConfig[1]?.guid;

      // Island 1: Session 1, Name Z
      instance.onmessage({
        data: JSON.stringify({ version: 1, areaName: 'IslandZ', islandId: 1, areaIndex: 0, sessionGuid: s1, entries: [] })
      });
      // Island 2: Session 0, Name B
      instance.onmessage({
        data: JSON.stringify({ version: 1, areaName: 'IslandB', islandId: 2, areaIndex: 0, sessionGuid: s0, entries: [] })
      });
      // Island 3: Session 0, Name A
      instance.onmessage({
        data: JSON.stringify({ version: 1, areaName: 'IslandA', islandId: 3, areaIndex: 0, sessionGuid: s0, entries: [] })
      });
      // Island 4: Unresolvable session (R3) - lands in ungroupedIslands, not sessionGroups
      instance.onmessage({
        data: JSON.stringify({ version: 1, areaName: 'IslandUnresolved', islandId: 4, areaIndex: 0, sessionGuid: 999999, entries: [] })
      });

      const view = (window as any).statisticsView;
      return {
        groupedNames: view.sessionGroups().flatMap((g: any) => g.islands().map((isl: any) => isl.areaName)),
        ungroupedNames: view.ungroupedIslands().map((isl: any) => isl.areaName)
      };
    });

    // s0's group sorts before s1's group, and within s0, IslandA before IslandB (areaName tiebreak).
    expect(result.groupedNames).toEqual(['IslandA', 'IslandB', 'IslandZ']);
    expect(result.ungroupedNames).toEqual(['IslandUnresolved']);
  });

  // U5: the old single-island `selectedAreaName`/`selectedIsland` sticky auto-select was removed
  // (superseded by U4's R24 `checkedKeys` bootstrap - see tests/computed/statistics-collections.spec.ts's
  // own "AE15" test for the dedicated coverage). This test now exercises the same
  // "auto-select first arrival, stays sticky" behavior through the current `checkedKeys` surface.
  test('auto-select selects first seen island and stays sticky', async ({ page }) => {
    const result = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];
      const view = (window as any).statisticsView;

      const initialSelection = view.checkedKeys();

      instance.onmessage({
        data: JSON.stringify({ version: 1, areaName: 'Latium', islandId: 1, areaIndex: 0, sessionGuid: 3245, entries: [] })
      });
      const selectionAfterFirst = view.checkedKeys();

      instance.onmessage({
        data: JSON.stringify({ version: 1, areaName: 'Nusquam', islandId: 2, areaIndex: 0, sessionGuid: 3245, entries: [] })
      });
      const selectionAfterSecond = view.checkedKeys();

      return { initialSelection, selectionAfterFirst, selectionAfterSecond };
    });

    expect(result.initialSelection).toEqual([]);
    expect(result.selectionAfterFirst).toEqual([{ sessionGuid: 3245, islandId: 1, areaIndex: 0 }]);
    expect(result.selectionAfterSecond).toEqual([{ sessionGuid: 3245, islandId: 1, areaIndex: 0 }]); // stays sticky, doesn't jump to Nusquam
  });

  // (sessionGuid, islandId, areaIndex) is the hard identity key - areaName is display-only and
  // never used for lookup/collision. The following tests cover the identity-model edge/error
  // cases.

  test('two messages sharing an areaName but distinct (islandId, areaIndex) create two distinct islands', async ({ page }) => {
    const result = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];

      instance.onmessage({
        data: JSON.stringify({
          version: 1, areaName: 'Latium', islandId: 1, areaIndex: 0, sessionGuid: 3245,
          entries: [{ productGuid: 2138, generation: 10, consumption: 4, perfectGeneration: 20, perfectConsumption: 8, buildings: 3 }]
        })
      });
      // Same areaName, different identity - under name-only keying this would collide with the
      // island above; under (islandId, areaIndex) keying it must be a second, independent island.
      instance.onmessage({
        data: JSON.stringify({
          version: 1, areaName: 'Latium', islandId: 2, areaIndex: 0, sessionGuid: 3245,
          entries: [{ productGuid: 2138, generation: 77, consumption: 33, perfectGeneration: 200, perfectConsumption: 88, buildings: 9 }]
        })
      });

      const islands = (window as any).statisticsFeed.islands();
      return islands.map((isl: any) => ({
        areaName: isl.areaName,
        islandId: isl.islandId(),
        areaIndex: isl.areaIndex(),
        rows: isl.rows().map((r: any) => ({ productGuid: r.productGuid, generation: r.generation() }))
      }));
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ areaName: 'Latium', islandId: 1, areaIndex: 0, rows: [{ productGuid: 2138, generation: 10 }] });
    expect(result[1]).toMatchObject({ areaName: 'Latium', islandId: 2, areaIndex: 0, rows: [{ productGuid: 2138, generation: 77 }] });
  });

  test('a later message for the same (islandId, areaIndex) with a changed areaName updates the display label without creating a duplicate island', async ({ page }) => {
    const result = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];

      instance.onmessage({
        data: JSON.stringify({
          version: 1, areaName: 'Latium', islandId: 1, areaIndex: 0, sessionGuid: 3245,
          entries: [{ productGuid: 2138, generation: 10, consumption: 4, perfectGeneration: 20, perfectConsumption: 8, buildings: 3 }]
        })
      });
      const afterFirst = (window as any).statisticsFeed.islands().map((isl: any) => isl.areaName);

      // Same identity, renamed - must update in place, not append a second island.
      instance.onmessage({
        data: JSON.stringify({
          version: 1, areaName: 'Latium Renamed', islandId: 1, areaIndex: 0, sessionGuid: 3245,
          entries: [{ productGuid: 2138, generation: 99, consumption: 44, perfectGeneration: 20, perfectConsumption: 8, buildings: 5 }]
        })
      });

      const islands = (window as any).statisticsFeed.islands();
      return {
        afterFirst,
        islandCount: islands.length,
        areaNameAfterSecond: islands[0].areaName,
        rowsAfterSecond: islands[0].rows().map((r: any) => ({ productGuid: r.productGuid, generation: r.generation() }))
      };
    });

    expect(result.afterFirst).toEqual(['Latium']);
    expect(result.islandCount).toBe(1);
    expect(result.areaNameAfterSecond).toBe('Latium Renamed');
    // Update-in-place (KTD8), not a fresh row set.
    expect(result.rowsAfterSecond).toEqual([{ productGuid: 2138, generation: 99 }]);
  });

  test('a message missing islandId is dropped entirely - no island created, no row applied', async ({ page }) => {
    const result = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];

      instance.onmessage({
        data: JSON.stringify({
          version: 1, areaName: 'Latium', areaIndex: 0, sessionGuid: 3245,
          entries: [{ productGuid: 2138, generation: 10, consumption: 4 }]
        })
      });

      return {
        islandCount: (window as any).statisticsFeed.islands().length,
        state: (window as any).statisticsFeed.connectionState()
      };
    });

    expect(result.islandCount).toBe(0);
    // connectionState only reaches 'live' at the end of a fully-processed message; a dropped
    // payload never reaches that line, so state stays at its pre-message value (offline - only
    // connect() was called in beforeEach, no onopen()/prior message).
    expect(result.state).toBe('offline');
  });

  test('a message missing areaIndex is dropped entirely - no island created, no row applied', async ({ page }) => {
    const result = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];

      instance.onmessage({
        data: JSON.stringify({
          version: 1, areaName: 'Latium', islandId: 1, sessionGuid: 3245,
          entries: [{ productGuid: 2138, generation: 10, consumption: 4 }]
        })
      });

      return {
        islandCount: (window as any).statisticsFeed.islands().length,
        state: (window as any).statisticsFeed.connectionState()
      };
    });

    expect(result.islandCount).toBe(0);
    expect(result.state).toBe('offline');
  });

  test('a message missing sessionGuid is dropped entirely - no island created, no row applied', async ({ page }) => {
    const result = await page.evaluate(() => {
      const instances = (window as any).__mockEventSourceInstances;
      const instance = instances[instances.length - 1];

      instance.onmessage({
        data: JSON.stringify({
          version: 1, areaName: 'Latium', islandId: 1, areaIndex: 0,
          entries: [{ productGuid: 2138, generation: 10, consumption: 4 }]
        })
      });

      return {
        islandCount: (window as any).statisticsFeed.islands().length,
        state: (window as any).statisticsFeed.connectionState()
      };
    });

    expect(result.islandCount).toBe(0);
    expect(result.state).toBe('offline');
  });
});
