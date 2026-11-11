import { ExchangeApi } from "./types";

// Narrow test and debug entry point (KTD12). Later units register their functions here.
export const exchange: ExchangeApi = {};

declare global {
    interface Window {
        exchange: ExchangeApi;
    }
}

window.exchange = exchange;
