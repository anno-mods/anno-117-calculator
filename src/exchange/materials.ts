// Construction materials, mythical-item effects and the item/effect classifier (U3, R50, KTD16).
import { GuidClassifier } from "./keys";
import { Guid, MaterialEntry, MythicalItemEffect } from "./types";
import { EffectConfig, FactoryConfig, ItemConfig, ProductConfig } from "../types.config";

// MaterialEntry.endFactories: region id ("Roman" = Latium, "Celtic" = Albion, "Egyptian" = Aegyptus) -> GUID of the
// factory that outputs the material there, for each region in the product's associatedRegions.
// Timber: Sawmill 3089 / 5945 / 152803.

export function buildMaterials(products: readonly ProductConfig[], factories: readonly FactoryConfig[]): MaterialEntry[] {
    const result: MaterialEntry[] = [];
    for (const p of products) {
        if (!p.isConstructionMaterial) continue;
        const endFactories: Record<string, Guid> = {};
        for (const region of p.associatedRegions ?? []) {
            const f = factories.find((x) => x.associatedRegions.includes(region) && x.outputs.some((o) => o.product === p.guid));
            if (f) endFactories[region] = f.guid;
        }
        result.push({ product: p.guid, endFactories });
    }
    return result;
}

export function buildMythicalItemEffects(effects: readonly EffectConfig[]): MythicalItemEffect[] {
    return effects
        .filter((e) => e.source === "mythical-item")
        .map((e) => ({ effect: e.guid, dlcUnlocks: [...(e.dlcUnlocks ?? [])] }));
}

/**
 * Item GUIDs (params.items) and effect GUIDs (params.effects) share the key scheme `<target>[<x>].scaling`;
 * the two GUID spaces are disjoint, so a lookup decides which one a key holds.
 */
export function makeClassifier(items: readonly ItemConfig[], effects: readonly EffectConfig[]): GuidClassifier {
    const itemGuids = new Set(items.map((i) => i.guid));
    const effectGuids = new Set(effects.map((e) => e.guid));
    return (guid: Guid) => (itemGuids.has(guid) ? "item" : effectGuids.has(guid) ? "effect" : "unknown");
}
