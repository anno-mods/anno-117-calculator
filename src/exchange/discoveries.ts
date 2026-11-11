// Discovery and specific-effect tables (U3, KTD10).
import { DiscoveryEntry, Guid, SpecificEffects } from "./types";
import { EffectConfig, TechConfig } from "../types.config";

// DiscoveryEntry.repeatable: only the repeatable tech (37870, Beneath Bedrock) scales by a repeat count; the others are 0/1.
// SpecificEffects.session lives in SubStorage "sessionSettings" per session (src/world.ts:250), .global in
// SubStorage "globalEffects" (src/main.ts:468), .neverWritable are dormant area buffs.

// Session-scope effects the exchange format names: Nile flood / Positive Harvest Season (155616) and the volcano
// phase effects Obsidian Gathering (145095), Obsidian Mining (148043), Ash Bloom (145099). All have
// source "session-event", effectScope "ObjectsInSession" in js/params.js. The params also hold two Potion
// effects (99955, 99957) with the same scope; the format does not name them, so they are not written.
export const SESSION_EFFECTS: readonly Guid[] = [155616, 145095, 148043, 145099];

// The three volcano effects, written with the volcanic soil level in the Latium and the Meta (Worldmap) session
// (conversion rules, "Volcanic soil level"), and the Nile flood effect, written 1 in the Aegyptus session when
// seasons are enabled in average mode.
export const VOLCANO_EFFECTS: readonly Guid[] = [145095, 148043, 145099];
export const VOLCANO_SESSIONS: readonly Guid[] = [3245, 37135];
export const NILE_FLOOD_EFFECT: Guid = 155616;
export const NILE_FLOOD_SESSION: Guid = 149679;

// Global (Meta scope) wonder effects: Vervactor's Plough / Ceres "More Fields" (43620) and Cernunnos "Extra Goods"
// (50262), both source "veneration-effect", effectScope "ObjectsInMeta". Further veneration-effect effects found in
// params at runtime are added by specificEffects().
export const GLOBAL_WONDER_EFFECTS: readonly Guid[] = [43620, 50262];

// AreaBuff GUIDs of params.areaBuffs (the "Dormant" area buffs persisted by main.ts:486-496); they have no
// exchange counterpart and are never written.
export const AREA_BUFF_GUIDS: readonly Guid[] = [51796, 30467, 38412, 38411];

/** Discoveries from params.techs: tech GUID -> effect GUIDs (src/types.config.ts TechConfig). */
export function buildDiscoveries(techs: readonly TechConfig[]): DiscoveryEntry[] {
    return techs.map((t) => ({
        tech: t.guid,
        effects: [...t.effects],
        repeatable: t.isRepeatable === true,
        dlcUnlocks: [...(t.dlcUnlocks ?? [])],
    }));
}

export function buildSpecificEffects(effects: readonly EffectConfig[]): SpecificEffects {
    const veneration = effects
        .filter((e) => e.source === "veneration-effect" && e.effectScope.endsWith("Meta"))
        .map((e) => e.guid);
    const global = [...new Set([...GLOBAL_WONDER_EFFECTS, ...veneration])];
    return { session: [...SESSION_EFFECTS], global, neverWritable: [...AREA_BUFF_GUIDS] };
}

/** Every effect GUID the importer may write: discovery effects plus the specific effects, never the area buffs. */
export function buildWritableEffects(discoveries: readonly DiscoveryEntry[], specific: SpecificEffects): Guid[] {
    const never = new Set(specific.neverWritable);
    const all = new Set<Guid>();
    for (const d of discoveries) for (const g of d.effects) all.add(g);
    for (const g of specific.session) all.add(g);
    for (const g of specific.global) all.add(g);
    return [...all].filter((g) => !never.has(g)).sort((a, b) => a - b);
}
