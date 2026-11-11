// Storage key patterns and builders of the calculator (U3). Island-scope keys live in the island's Storage JSON
// (`new Storage(islandName)`, the `localStorage` parameter of the Island constructor); session and global keys
// live in the SubStorages "sessionSettings" and "globalEffects" (see the note on each builder).
// Every pattern cites the src line that persists it.

import { FactoryScalingKey, Guid } from "./types";

// src/world.ts:737 persistBuildings: `<g>.buildings.constructed|planned`, also for residence buildings (world.ts:1228).
export const buildingsConstructed = (g: Guid): string => `${g}.buildings.constructed`;
export const buildingsPlanned = (g: Guid): string => `${g}.buildings.planned`;
// src/world.ts:739
export const buildingsFullyUtilize = (g: Guid): string => `${g}.buildings.fullyUtilizeConstructed`;

// src/world.ts:1238-1239 persistNeedChecked / persistString on a population level need. Stored "1" / "0" (world.ts:752).
export const needChecked = (level: Guid, need: Guid): string => `${level}[${need}].checked`;
export const needNotes = (level: Guid, need: Guid): string => `${level}[${need}].notes`;

// src/world.ts:1052-1053 (item slot state, int 0/1/2) and world.ts:983 (effect slot state, int 0/1): the same
// scheme `<target>[<x>].scaling`, so `x` is an item GUID or an effect GUID (see classifyItemOrEffect, KTD16).
export const factoryItemScaling = (factory: Guid, item: Guid): string => `${factory}[${item}].scaling`;
export const factoryEffectScaling = (factory: Guid, effect: Guid): string => `${factory}[${effect}].scaling`;

// src/world.ts:909 (the key says `.checked`; the value is persisted with persistFloat on `scaling`)
export const aqueductChecked = (factory: Guid): string => `${factory}.aqueductBuff.checked`;
// src/world.ts:915
export const moduleChecked = (factory: Guid, module: Guid): string => `${factory}.module[${module}].checked`;

// src/world.ts:973 (effects without per-target slot states only, see world.ts:967-973)
export const islandEffectScaling = (effect: Guid): string => `island.effect.${effect}.scaling`;
// src/world.ts:1067
export const islandFertilityChecked = (fertility: Guid): string => `island.fertility.${fertility}.checked`;

// src/world.ts:1086 persistString(p, "notes") -> `<guid>.notes`
export const productNotes = (product: Guid): string => `${product}.notes`;
// src/world.ts:1089-1090 and :1126-1139; values "factory" | "extra_good" | "passive_trade" | "null"
export const defaultSupplierType = (product: Guid): string => `${product}.defaultSupplier.type`;
export const defaultSupplierId = (product: Guid): string => `${product}.defaultSupplier.id`;

// src/world.ts:35-36
export const gameConnectorIslandId = "gameConnector.islandID";
export const gameConnectorAreaIndex = "gameConnector.areaIndex";

// src/world.ts:250 -- key inside SubStorage("sessionSettings") (main.ts:385); `session` is the Session GUID.
export const sessionEffectScaling = (session: Guid, effect: Guid): string => `session.${session}.effect.${effect}.scaling`;
// The global effect key inside SubStorage("globalEffects") is `<guid>.scaling` (src/main.ts:468-469). The
// `global.effect.<g>.scaling` form is the logical key of the exchange tables; it is mapped to the stored
// form by globalEffectStoredKey.
export const globalEffectScaling = (effect: Guid): string => `global.effect.${effect}.scaling`;
export const globalEffectStoredKey = (effect: Guid): string => `${effect}.scaling`;

export type GuidClassifier = (guid: Guid) => FactoryScalingKey["kind"] | "unknown";

const FACTORY_SCALING = /^(\d+)\[(\d+)\]\.scaling$/;

/**
 * Parses `<target>[<x>].scaling`. `kind` says whether x is an item or an effect GUID, decided by GUID lookup
 * (the two share one key scheme). Returns null for any other key and for a GUID that is neither.
 */
export function parseFactoryScalingKey(key: string, classify: GuidClassifier): FactoryScalingKey | null {
    const m = FACTORY_SCALING.exec(key);
    if (!m) return null;
    const guid = parseInt(m[2], 10);
    const kind = classify(guid);
    if (kind === "unknown") return null;
    return { target: parseInt(m[1], 10), guid, kind };
}
