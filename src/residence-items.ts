import type { BuildingBuffConfig, ItemConfig, ParamsConfig } from './types.config';

// Pure data predicates for residence items (villa items). No calculator class is imported, so the exchange
// planner can share them with the Island.

export type VillaParams = Pick<ParamsConfig, 'residenceBuildings' | 'buildingBuffs' | 'effects'>;

function changesDemand(b: BuildingBuffConfig | undefined): boolean {
    if (!b)
        return false;
    return (b.consumptionModifierInPercent ?? 0) !== 0
        || (b.goodConsumptionUpgrade || []).some(g => g.product !== 0 && g.amountInPercent !== 0)
        || (b.population ?? 0) !== 0
        || (b.attributes?.Population ?? 0) !== 0
        || (b.needAttributes || []).some(n => (n.attributes?.Population ?? 0) !== 0);
}

/**
 * Residence items (villa items): items whose radius effect reaches residences and changes consumption or
 * residents. The decision rests on extractor data only: `allocation`, when present, is "Villa"; at least one
 * target is a residence building; one buff of the item (base, boost, or the buffs of the area effect a buff
 * adds, one level deep) carries a consumption or residents kind. `heroicEffect` is not part of the test: an
 * item that reaches residences only through its island-wide effect is a factory item.
 */
export function isVillaItem(config: ItemConfig, params: VillaParams): boolean {
    if (config.allocation !== undefined && config.allocation !== 'Villa')
        return false;

    const residences = new Set(params.residenceBuildings.map(r => r.guid));
    if (!(config.targets || []).some(t => residences.has(t)))
        return false;

    const buffs = new Map(params.buildingBuffs.map(b => [b.guid, b]));
    const effects = new Map(params.effects.map(e => [e.guid, e]));

    for (const guid of [...(config.buffs || []), ...(config.boostBuffs || [])]) {
        const buff = buffs.get(guid);
        if (changesDemand(buff))
            return true;
        const functional = buff && buff.functionalEffect ? effects.get(buff.functionalEffect) : undefined;
        if (functional && functional.buffs.some(g => changesDemand(buffs.get(g))))
            return true;
    }
    return false;
}
