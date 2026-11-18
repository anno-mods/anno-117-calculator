import { Page } from '@playwright/test';
import { ConfigLoader } from './config-loader';

/** Seeds a calculator whose stored exchange data holds game routes, visits, history and minimum stock. */

export const LATIUM = 3245;
export const BREAD = 2137;
export const MIN = 60000;

export interface RouteDoc {
    routes?: any[];
    visits?: any[];
    history?: any[];
    live?: any;
    minimum?: Record<string, Record<string, number>>;
}

export const IDS: Record<string, string> = { Roma: 'a1', Ostia: 'a2', Cumae: 'a3' };
const idOf = (name: string) => IDS[name] ?? 'a' + name.slice(1);

export const slot = (product: number, mode: string, i = 0, amount = 50) => ({ product, mode, slot: i, amount });
export const ship = (slots = 4, count = 1) => ({ type: 1, slots, count });

/** Route from -> to: the source stop loads, the destination stop unloads. */
export function simpleRoute(id: number, from: string, to: string, extra: { amount?: number; ships?: any[]; name?: string; product?: number } = {}) {
    const product = extra.product ?? BREAD;
    return {
        id,
        name: extra.name ?? `r${id}`,
        stations: [
            { island: from, slots: [slot(product, 'load', 0, extra.amount ?? 50)] },
            { island: to, slots: [slot(product, 'unload', 0, extra.amount ?? 50)] },
        ],
        ships: extra.ships ?? [ship()],
    };
}

export function visitsAt(route: number, island: string, minutes: number[], net = 30, clock = 'game', product = BREAD) {
    return minutes.map((m) => ({ route, island, time: m * MIN, clock, goods: { [product]: net } }));
}

export async function loadRouteDoc(
    page: Page,
    doc: RouteDoc,
    calcRoutes: { from: string; to: string; amount: number; isDefault?: boolean; product?: number }[],
    opts: { islandNames?: string[]; active?: string } = {},
) {
    const islandNames = opts.islandNames ?? ['Roma', 'Ostia', 'Cumae'];
    const cl = new ConfigLoader();
    const islands = islandNames.map((name) => ({
        name,
        session: LATIUM,
        data: {
            'exchange.islandId': idOf(name),
            ...(doc.minimum?.[idOf(name)] ? { 'exchange.ext': { minimumStock: doc.minimum[idOf(name)] } } : {}),
        },
    }));
    const config = cl.createFullConfig(islands, {}, opts.active ?? islandNames[0]);
    config.tradeRoutes = JSON.stringify(
        calcRoutes.map((r) => ({ productGUID: r.product ?? BREAD, from: r.from, to: r.to, userSetAmount: r.amount, isDefaultSupplier: r.isDefault === true })),
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

export async function openTradeDialog(page: Page) {
    await page.evaluate(() => { ($ as any)('#trade-routes-management-dialog').modal('show'); });
    await page.waitForSelector('#trade-routes-management-dialog.show');
    await page.waitForSelector('#trade-calc-table');
}
