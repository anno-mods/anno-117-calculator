import { ExchangeApi } from "./types";
import { reservedKeys, uniqueName } from "./names";

// Narrow test and debug entry point (KTD12). Later units register their functions here.
export const exchange: ExchangeApi = {
    uniqueName,
    reservedKeys,
    // Island id (KTD3) by island name; assigned lazily on first read. null for an unknown island.
    islandId: (islandName: string): string | null => {
        const island = window.view?.islands?.().find((i: { name(): string }) => i.name() === islandName);
        return island ? island.exchangeIslandId : null;
    },
};

declare global {
    interface Window {
        exchange: ExchangeApi;
    }
}

window.exchange = exchange;
