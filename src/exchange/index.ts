import { ExchangeApi, ExchangeTables, IslandsPlan, ReadOk, TradePlan } from "./types";
import { planIslands } from "./import-islands";
import { planTrade } from "./import-trade";
import { reservedKeys, uniqueName } from "./names";
import * as keys from "./keys";
import { buildDiscoveries, buildSpecificEffects, buildWritableEffects } from "./discoveries";
import { readExchange } from "./reader";
import { buildMaterials, buildMythicalItemEffects, makeClassifier } from "./materials";

// Tables are derived from window.params on demand; params.js is loaded before the bundle and never changes at runtime.
function tables(): ExchangeTables {
    const params = window.params;
    const discoveries = buildDiscoveries(params.techs);
    const specificEffects = buildSpecificEffects(params.effects);
    return {
        discoveries,
        specificEffects,
        writableEffects: buildWritableEffects(discoveries, specificEffects),
        materials: buildMaterials(params.products, params.factories),
        mythicalItemEffects: buildMythicalItemEffects(params.effects),
    };
}

function classifyItemOrEffect(guid: number): "item" | "effect" | "unknown" {
    return makeClassifier(window.params.items, window.params.effects)(guid);
}

// Narrow test and debug entry point (KTD12). Later units register their functions here.
export const exchange: ExchangeApi = {
    uniqueName,
    reservedKeys,
    // Island id (KTD3) by island name; assigned lazily on first read. null for an unknown island.
    islandId: (islandName: string): string | null => {
        const island = window.view?.islands?.().find((i: { name(): string }) => i.name() === islandName);
        return island ? island.exchangeIslandId : null;
    },
    keys,
    parseFactoryScalingKey: (key: string) => keys.parseFactoryScalingKey(key, classifyItemOrEffect),
    classifyItemOrEffect,
    tables,
    readExchange,
    planIslands: (read: ReadOk): IslandsPlan => planIslands(read, { params: window.params }),
    planTrade: (islands: IslandsPlan, read: ReadOk): TradePlan => planTrade(islands, read, { params: window.params }),
};

declare global {
    interface Window {
        exchange: ExchangeApi;
    }
}

window.exchange = exchange;
