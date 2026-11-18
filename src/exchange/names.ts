// Reserved localStorage keys and unique island names (KTD6).
// An island name is also its localStorage key, so it must not collide with any other key the app
// reads or writes at the top level.

export interface ReservedKeys {
    /** Exact top-level localStorage keys. */
    keys: string[];
    /** Key patterns the app builds with a fixed prefix; a name starting with one is reserved. */
    prefixes: string[];
}

/**
 * Sources (all under src/):
 *  - world.ts: ALL_ISLANDS (util.ts), "islandName" / "islandNames" (IslandManager), "selectedPatron", "devotion",
 *    persist* ids such as "passiveTrade.userSetAmount", `island.effect.`, `island.fertility.`,
 *    `island.product.` (supplier keys), `session.<guid>.effect.` (Session), `gameConnector.` (island store keys)
 *  - main.ts: SubStorage("calculatorSettings"), SubStorage("sessionSettings"), SubStorage("globalEffects"),
 *    "versionCalculator", "language", `settings.` (legacy per-setting keys), `global.effect.`, "debug.enabled",
 *    "debug.verboseMode", "debug.logBindings"
 *  - trade.ts: "tradeRoutes"; views.ts: "collapsibleStates", "darkMode.checked"; statistics.ts: "statisticsCollections"
 *  - this feature: `exchange.` (island store key and the top-level "exchange.ext")
 */
export function reservedKeys(): ReservedKeys {
    return {
        keys: [
            "All Islands",
            "calculatorSettings",
            "sessionSettings",
            "globalEffects",
            "tradeRoutes",
            "collapsibleStates",
            "statisticsCollections",
            "islandName",
            "islandNames",
            "versionCalculator",
            "selectedPatron",
            "devotion",
            "language",
            "darkMode.checked",
            "debug.enabled",
            "debug.verboseMode",
            "debug.logBindings",
            "passiveTrade.userSetAmount",
            "exchange.ext",
        ],
        prefixes: [
            "settings.",
            "global.effect.",
            "session.",
            "island.",
            "gameConnector.",
            "debug.",
            "darkMode.",
            "passiveTrade.",
            "exchange.",
        ],
    };
}

export function isReservedName(name: string): boolean {
    const r = reservedKeys();
    return r.keys.indexOf(name) !== -1 || r.prefixes.some((p) => name.indexOf(p) === 0);
}

/**
 * Returns `wanted` when it is neither taken nor reserved, else `wanted (2)`, `wanted (3)`, ...
 * The caller adds the result to `taken` before the next call.
 */
export function uniqueName(wanted: string, taken: Iterable<string>): string {
    const takenSet = new Set<string>(taken);
    if (!takenSet.has(wanted) && !isReservedName(wanted))
        return wanted;

    // A suffix cannot remove a reserved prefix (`settings.x (2)` still starts with `settings.`), but the
    // suffixed string no longer equals any key the app builds from that prefix, so only exact reserved
    // keys and taken names are checked for the suffixed candidates.
    const exact = new Set<string>(reservedKeys().keys);
    for (let i = 2; ; i++) {
        const candidate = `${wanted} (${i})`;
        if (!takenSet.has(candidate) && !exact.has(candidate))
            return candidate;
    }
}
