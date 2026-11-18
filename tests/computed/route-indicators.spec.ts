import { test, expect, Page } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

/**
 * Trade route indicators (plan 2026-11-15-1255 U2): required offload = route rate x longest observed gap,
 * utilization = offload / capacity, red above 100 %, yellow from minimum stock or observed empty storage.
 * The evidence comes from the stored exchange document (`exchange.ext`), the rate from the calculator route.
 */

const LATIUM = 3245;
const BREAD = 2137;
const MIN = 60000;

interface Doc {
    routes?: any[];
    visits?: any[];
    history?: any[];
    live?: any;
    minimum?: Record<string, Record<string, number>>;
}

const slot = (product: number, mode: string, i = 0, amount = 50) => ({ product, mode, slot: i, amount });
const ship = (slots = 4, count = 1) => ({ type: 1, slots, count });

/** Route a -> b: source stop loads, destination stop unloads. */
function simpleRoute(id: number, from: string, to: string, extra: { amount?: number; ships?: any[]; name?: string } = {}) {
    return {
        id,
        name: extra.name ?? `r${id}`,
        stations: [
            { island: from, slots: [slot(BREAD, 'load', 0, extra.amount ?? 50)] },
            { island: to, slots: [slot(BREAD, 'unload', 0, extra.amount ?? 50)] },
        ],
        ships: extra.ships ?? [ship()],
    };
}

function visitsAt(route: number, island: string, minutes: number[], net = 30, clock = 'game') {
    return minutes.map((m) => ({ route, island, time: m * MIN, clock, goods: { [BREAD]: net } }));
}

async function load(page: Page, doc: Doc, calcRoutes: { from: string; to: string; amount: number }[], islandNames = ['Roma', 'Ostia', 'Cumae']) {
    const cl = new ConfigLoader();
    const ids: Record<string, string> = { Roma: 'a1', Ostia: 'a2', Cumae: 'a3' };
    const islands = islandNames.map((name) => ({
        name,
        session: LATIUM,
        data: {
            'exchange.islandId': ids[name],
            ...(doc.minimum?.[ids[name]] ? { 'exchange.ext': { minimumStock: doc.minimum[ids[name]] } } : {}),
        },
    }));
    const config = cl.createFullConfig(islands, {}, islandNames[0]);
    config.tradeRoutes = JSON.stringify(
        calcRoutes.map((r) => ({ productGUID: BREAD, from: r.from, to: r.to, userSetAmount: r.amount, isDefaultSupplier: false })),
    );
    const captured: any[] = [];
    if (doc.history) captured.push({ pointer: '/history', kind: 'unknown', value: doc.history });
    if (doc.live) captured.push({ pointer: '/live', kind: 'unknown', value: doc.live });
    config['exchange.ext'] = {
        orphans: [],
        captured,
        preservedImports: [],
        trade: { routes: doc.routes ?? [], visits: doc.visits ?? [] },
    };
    await cl.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island() && (window as any).view.tradeManager);
    await page.waitForTimeout(300);
}

async function ind(page: Page, index = 0): Promise<any> {
    return page.evaluate((i) => JSON.parse(JSON.stringify((window as any).view.tradeManager.routes()[i].indicators())), index);
}

const R = { from: 'Roma', to: 'Ostia' };
// gaps 10, 10, 20, 10 -> longest of the latest five is 20 minutes
const GAPS = [0, 10, 20, 40, 50];

test.describe('route indicators (U2)', () => {
    test('offload is rate times longest gap, utilization over capacity, red above 100 % and live in the rate', async ({ page }) => {
        await load(page, { routes: [simpleRoute(1, 'a1', 'a2')], visits: visitsAt(1, 'a2', GAPS) }, [{ ...R, amount: 1 }]);
        let r = await ind(page);
        expect(r.available).toBe(true);
        expect(r.gapMinutes).toBeCloseTo(20, 6);
        expect(r.requiredOffload).toBeCloseTo(20, 6);
        expect(r.capacity).toBeCloseTo(50, 6);
        expect(r.utilization).toBeCloseTo(40, 6);
        expect(r.red).toBe(false);

        // AE4: raising the rate raises offload and utilization; crossing 100 % turns red, lowering clears it
        await page.evaluate(() => { (window as any).view.tradeManager.routes()[0].userSetAmount(3); });
        r = await ind(page);
        expect(r.requiredOffload).toBeCloseTo(60, 6);
        expect(r.utilization).toBeCloseTo(120, 6);
        expect(r.red).toBe(true);
        await page.evaluate(() => { (window as any).view.tradeManager.routes()[0].userSetAmount(1); });
        expect((await ind(page)).red).toBe(false);
    });

    test('AE4: a demand edit changes the offload through the supplier graph without re-import', async ({ page }) => {
        await load(page, { routes: [simpleRoute(1, 'a1', 'a2')], visits: visitsAt(1, 'a2', GAPS) }, [{ ...R, amount: 0 }]);
        const before = await ind(page);
        expect(before.requiredOffload).toBeCloseTo(0, 6);
        const after = await page.evaluate(() => {
            const v = (window as any).view;
            const ostia = v.islands().find((i: any) => i.name() === 'Ostia');
            const route = v.tradeManager.routes()[0];
            route.setDemand(2);
            return route.indicators().requiredOffload;
        });
        expect(after).toBeCloseTo(40, 6);
    });

    test('AE5: one gap only gives unavailable with a reason', async ({ page }) => {
        await load(page, { routes: [simpleRoute(1, 'a1', 'a2')], visits: visitsAt(1, 'a2', [0, 10]) }, [{ ...R, amount: 1 }]);
        const r = await ind(page);
        expect(r.available).toBe(false);
        expect(r.reason).toBe('gaps');
        expect(r.red).toBe(false);
        expect(r.yellow).toBeUndefined();
    });

    test('no trade data: no indicators, no error', async ({ page }) => {
        await load(page, {}, [{ ...R, amount: 1 }]);
        const r = await ind(page);
        expect(r.available).toBe(false);
        expect(r.reason).toBe('no-evidence');
    });

    test('AE2: two game routes to one sink combine capacity', async ({ page }) => {
        await load(
            page,
            {
                routes: [simpleRoute(48, 'a1', 'a2'), simpleRoute(93, 'a1', 'a2')],
                visits: [...visitsAt(48, 'a2', GAPS), ...visitsAt(93, 'a2', GAPS)],
            },
            [{ ...R, amount: 3 }],
        );
        const r = await ind(page);
        expect(r.gameRoutes).toBe(2);
        expect(r.capacity).toBeCloseTo(100, 6);
        expect(r.requiredOffload).toBeCloseTo(60, 6);
        expect(r.red).toBe(false);
    });

    test('AE3: repeated island stop with differing mappings is unavailable', async ({ page }) => {
        const route = {
            id: 66,
            stations: [
                { island: 'a1', slots: [slot(BREAD, 'load', 0, 50)] },
                { island: 'a2', slots: [slot(BREAD, 'unload', 0, 50)] },
                { island: 'a1', slots: [slot(BREAD, 'load', 0, 50)] },
                { island: 'a2', slots: [slot(BREAD, 'unload', 0, 20)] },
            ],
            ships: [ship()],
        };
        await load(page, { routes: [route], visits: visitsAt(66, 'a2', GAPS) }, [{ ...R, amount: 1 }]);
        const r = await ind(page);
        expect(r.available).toBe(false);
        expect(r.reason).toBe('ambiguous');
    });

    test('AE6: relay load and unload of one good uses slot flow, never the net visit amount', async ({ page }) => {
        const route = {
            id: 7,
            stations: [
                { island: 'a1', slots: [slot(BREAD, 'load', 0, 100)] },
                { island: 'a2', slots: [slot(BREAD, 'unload', 0, 100), slot(BREAD, 'load', 1, 100)] },
                { island: 'a3', slots: [slot(BREAD, 'unload', 1, 100)] },
            ],
            ships: [ship(4)],
        };
        // the relay's net per visit alternates in sign: capacity stays 100 (slot amount), the actual unload is unknown
        const mixed = GAPS.map((m, i) => ({ route: 7, island: 'a2', time: m * MIN, clock: 'game', goods: { [BREAD]: i % 2 ? -20 : 10 } }));
        await load(page, { routes: [route], visits: mixed }, [{ ...R, amount: 1 }]);
        const r = await ind(page);
        expect(r.available).toBe(true);
        expect(r.capacity).toBeCloseTo(100, 6);
        expect(r.actualUnload).toBeUndefined();
    });

    test('relay whose recorded nets are all positive: the net is a lower bound of the unload and drives yellow storage', async ({ page }) => {
        const route = {
            id: 85,
            stations: [
                { island: 'a1', slots: [slot(BREAD, 'load', 1, 50)] },
                { island: 'a2', slots: [slot(BREAD, 'unload', 1, 50), slot(BREAD, 'load', 1, 50)] },
            ],
            ships: [ship(7, 2)],
        };
        // storage at zero in half the samples, 10 t net per visit against 1.5 t/min x 20 min = 30 t required
        const history = [{ island: 'a2', product: BREAD, kind: 'storage', clock: 'game', unit: 't', start: 0, step: 600100, values: [4, 0, 0, 5, 0, 0] }];
        await load(page, { routes: [route], visits: visitsAt(85, 'a2', GAPS, 10), history }, [{ ...R, amount: 1.5 }]);
        const r = await ind(page);
        expect(r.actualUnload).toBeCloseTo(10, 6);
        expect(r.unloadIsNet).toBe(true);
        expect(r.yellow).toBe('storage');
    });

    test('AE2: game routes from different sources to one destination are combined before red is decided', async ({ page }) => {
        await load(
            page,
            { routes: [simpleRoute(1, 'a1', 'a3'), simpleRoute(2, 'a2', 'a3')], visits: [...visitsAt(1, 'a3', GAPS), ...visitsAt(2, 'a3', GAPS)] },
            [{ from: 'Roma', to: 'Cumae', amount: 3 }, { from: 'Ostia', to: 'Cumae', amount: 0.1 }],
        );
        const a = await ind(page, 0);
        const b = await ind(page, 1);
        expect(a.capacity).toBeCloseTo(100, 6);
        expect(a.requiredOffload).toBeCloseTo(60, 6); // alone this is over the 50 t of its own game route
        expect(a.utilization).toBeCloseTo(62, 6);
        expect(a.red).toBe(false);
        expect(b.red).toBe(false);
    });

    test('AE3: an island visited at two equal stops uses the gap between visits of the same stop', async ({ page }) => {
        const route = {
            id: 66,
            stations: [
                { island: 'a1', slots: [slot(BREAD, 'load', 0, 50)] },
                { island: 'a2', slots: [slot(BREAD, 'unload', 0, 50)] },
                { island: 'a1', slots: [slot(BREAD, 'load', 0, 50)] },
                { island: 'a2', slots: [slot(BREAD, 'unload', 0, 50)] },
            ],
            ships: [ship()],
        };
        // gaps 10, 10, 20, 10, 10 -> sums of two consecutive gaps: 20, 30, 30, 20
        await load(page, { routes: [route], visits: visitsAt(66, 'a2', [0, 10, 20, 40, 50, 60]) }, [{ ...R, amount: 1 }]);
        const r = await ind(page);
        expect(r.available).toBe(true);
        expect(r.gapMinutes).toBeCloseTo(30, 6);
    });

    test('red is dropped when storage is not falling and deliveries cover 80 percent of the rate; kept when storage falls', async ({ page }) => {
        const series = (values: number[]) => [{ island: 'a2', product: BREAD, kind: 'storage', clock: 'game', unit: 't', start: 0, step: 600100, values }];
        // 3 t/min x 20 min = 60 t over the 50 t capacity; delivered 35 t x 4 intervals / 50 min = 2.8 t/min = 93 % of the rate
        const doc = (values: number[]) => ({ routes: [simpleRoute(1, 'a1', 'a2')], visits: visitsAt(1, 'a2', GAPS, 35), history: series(values) });
        await load(page, doc([500, 500, 500, 500, 500, 500]), [{ ...R, amount: 3 }]);
        let r = await ind(page);
        expect(r.utilization).toBeCloseTo(120, 6);
        expect(r.red).toBe(false);
        expect(r.supplied).toBe(true);

        await load(page, doc([500, 450, 400, 350, 300, 250]), [{ ...R, amount: 3 }]);
        r = await ind(page);
        expect(r.red).toBe(true);
        expect(r.supplied).toBeUndefined();

        // empty samples never count as supplied
        await load(page, doc([500, 500, 0, 500, 500, 500]), [{ ...R, amount: 3 }]);
        expect((await ind(page)).red).toBe(true);

        // deliveries well below the rate: 7 t x 4 / 50 = 0.56 t/min of 3 t/min
        await load(page, { ...doc([500, 500, 500, 500, 500, 500]), visits: visitsAt(1, 'a2', GAPS, 7) }, [{ ...R, amount: 3 }]);
        expect((await ind(page)).red).toBe(true);
    });

    test('AE1: zero demand and empty storage never shows yellow', async ({ page }) => {
        const history = [{ island: 'a2', product: BREAD, kind: 'storage', clock: 'game', unit: 't', start: 0, step: 600100, values: [0, 0, 0, 0] }];
        await load(page, { routes: [simpleRoute(51, 'a1', 'a2')], visits: visitsAt(51, 'a2', GAPS, 0), history }, [{ ...R, amount: 0 }]);
        const r = await ind(page);
        expect(r.requiredOffload).toBeCloseTo(0, 6);
        expect(r.yellow).toBeUndefined();
        expect(r.red).toBe(false);
    });

    test('AE7 (b): zero storage in history with too little unloaded gives yellow storage', async ({ page }) => {
        const history = [{ island: 'a2', product: BREAD, kind: 'storage', clock: 'game', unit: 't', start: 0, step: 600100, values: [12, 0, 4, 0] }];
        await load(page, { routes: [simpleRoute(1, 'a1', 'a2')], visits: visitsAt(1, 'a2', GAPS, 5), history }, [{ ...R, amount: 1 }]);
        const r = await ind(page);
        expect(r.actualUnload).toBeCloseTo(5, 6);
        expect(r.yellow).toBe('storage');
    });

    test('AE7 (a): relay with minimum stock below demand x gap gives yellow minimumStock; above it none', async ({ page }) => {
        const relay = {
            id: 9,
            stations: [
                { island: 'a1', slots: [slot(BREAD, 'load', 0, 100)] },
                { island: 'a2', slots: [slot(BREAD, 'unload', 0, 100), slot(BREAD, 'load', 1, 100)] },
                { island: 'a3', slots: [slot(BREAD, 'unload', 1, 100)] },
            ],
            ships: [ship(4)],
        };
        const doc: Doc = { routes: [relay], visits: visitsAt(9, 'a2', GAPS, 10), minimum: { a2: { [BREAD]: 50 } } };
        await load(page, doc, [{ ...R, amount: 3 }]); // 3 t/min x 20 min = 60 > 50
        const capped = await ind(page);
        expect(capped.yellow).toBe('minimumStock');
        expect(capped.capacity).toBeCloseTo(50, 6); // the relay keeps at most its minimum stock per visit
        expect(capped.red).toBe(true);
        await page.evaluate(() => { (window as any).view.tradeManager.routes()[0].userSetAmount(2); }); // 40 < 50
        const ok = await ind(page);
        expect(ok.yellow).toBeUndefined();
        expect(ok.red).toBe(false);
    });

    test('AE7 (a): a pure unload stop is not limited by its own minimum stock', async ({ page }) => {
        const doc: Doc = { routes: [simpleRoute(1, 'a1', 'a2')], visits: visitsAt(1, 'a2', GAPS), minimum: { a2: { [BREAD]: 999 } } };
        await load(page, doc, [{ ...R, amount: 1 }]);
        expect((await ind(page)).yellow).toBeUndefined();
    });

    test('AE7 (a): routes A to B and A to C share the pool above A\'s minimum', async ({ page }) => {
        const history = [{ island: 'a1', product: BREAD, kind: 'storage', clock: 'game', unit: 't', start: 0, step: 600100, values: [130, 120, 125] }];
        const doc: Doc = {
            routes: [simpleRoute(1, 'a1', 'a2'), simpleRoute(2, 'a1', 'a3')],
            visits: [...visitsAt(1, 'a2', GAPS), ...visitsAt(2, 'a3', GAPS)],
            history,
            minimum: { a1: { [BREAD]: 100 } }, // pool above the minimum: 30 t
        };
        // each route needs 1 x 20 = 20 t, together 40 > 30: both get yellow, the pure unload stop at B too
        await load(page, doc, [{ ...R, amount: 1 }, { from: 'Roma', to: 'Cumae', amount: 1 }]);
        const a = await ind(page, 0);
        const b = await ind(page, 1);
        expect(a.yellow).toBe('pool');
        expect(a.competing).toEqual(['Roma → Cumae']);
        expect(b.yellow).toBe('pool');
        // pool covers both: neither
        await page.evaluate(() => {
            const v = (window as any).view;
            v.tradeManager.routes().forEach((r: any) => r.userSetAmount(0.5));
        });
        expect((await ind(page, 0)).yellow).toBeUndefined();
        expect((await ind(page, 1)).yellow).toBeUndefined();
    });

    test('pure loader whose stock above the minimum is below the required load gives yellow pool', async ({ page }) => {
        const live = { clock: 'game', timestamp: 1, islands: { a1: { [BREAD]: { storage: 105 } } } };
        const doc: Doc = { routes: [simpleRoute(1, 'a1', 'a2')], visits: visitsAt(1, 'a2', GAPS), live, minimum: { a1: { [BREAD]: 100 } } };
        await load(page, doc, [{ ...R, amount: 1 }]);
        const r = await ind(page);
        expect(r.yellow).toBe('pool');
        expect(r.competing).toEqual([]);
        expect(r.stock.pool).toBeCloseTo(5, 6);
    });

    test('mixed clocks and unsupported ship types give unavailable with a reason', async ({ page }) => {
        const mixed = [...visitsAt(1, 'a2', [0, 10, 20], 30, 'game'), ...visitsAt(1, 'a2', [40, 50], 30, 'wall')];
        await load(page, { routes: [simpleRoute(1, 'a1', 'a2')], visits: mixed }, [{ ...R, amount: 1 }]);
        expect((await ind(page)).reason).toBe('clock');
    });

    test('ship without slot count is unsupported', async ({ page }) => {
        await load(page, { routes: [simpleRoute(1, 'a1', 'a2', { ships: [{ type: 1, count: 1 }] })], visits: visitsAt(1, 'a2', GAPS) }, [{ ...R, amount: 1 }]);
        expect((await ind(page)).reason).toBe('ship');
    });

    test('deleting an island makes its rows go away and leaves the others', async ({ page }) => {
        await load(
            page,
            { routes: [simpleRoute(1, 'a1', 'a2'), simpleRoute(2, 'a1', 'a3')], visits: [...visitsAt(1, 'a2', GAPS), ...visitsAt(2, 'a3', GAPS)] },
            [{ ...R, amount: 1 }, { from: 'Roma', to: 'Cumae', amount: 1 }],
        );
        const left = await page.evaluate(() => {
            const v = (window as any).view;
            const ostia = v.islands().find((i: any) => i.name() === 'Ostia');
            v.tradeManager.islandDeleted(ostia);
            const routes = v.tradeManager.routes();
            return { n: routes.length, available: routes[0].indicators().available };
        });
        expect(left).toEqual({ n: 1, available: true });
    });

    test('one game route that collects at two islands: the unload slots count once for both calculator routes', async ({ page }) => {
        const collect = {
            id: 1,
            name: 'collect',
            stations: [
                { island: 'a1', slots: [slot(BREAD, 'load', 0, 50)] },
                { island: 'a2', slots: [slot(BREAD, 'load', 0, 50)] },
                { island: 'a3', slots: [slot(BREAD, 'unload', 0, 50)] },
            ],
            ships: [ship()],
        };
        await load(page, { routes: [collect], visits: visitsAt(1, 'a3', GAPS) }, [
            { from: 'Roma', to: 'Cumae', amount: 1 },
            { from: 'Ostia', to: 'Cumae', amount: 1 },
        ]);
        for (const i of [0, 1]) {
            const r = await ind(page, i);
            expect(r.available).toBe(true);
            expect(r.requiredOffload).toBeCloseTo(20, 6);
            expect(r.capacity).toBeCloseTo(50, 6);
            expect(r.utilization).toBeCloseTo(80, 6);
            expect(r.red).toBe(false);
            expect(r.actualUnload).toBeUndefined();
        }
    });
});
