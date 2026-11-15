/**
 * Effects that are switched in the Permanent effects group of the factory dialog and nowhere else: the Egyptian
 * seasons (Shemu / Achet) and the three DLC 3 soil effects (sesame, olives, gold fertility). The Effects dialog
 * does not list them; `params.js` carries no flag for this, so the set is named here.
 */
export const HARVEST_SEASON_EFFECT = 155616;

export const PERMANENT_ONLY_EFFECTS: ReadonlySet<number> = new Set([
    HARVEST_SEASON_EFFECT, // Effect Positive Harvest Season Productivity (Shemu / Achet)
    183157, // TechEffect Production SesameFertility
    183161, // TechEffect Production Olives Fertility
    185454, // TechEffect Fertility Gold DLC03
]);

export function isPermanentOnlyEffect(guid: number): boolean {
    return PERMANENT_ONLY_EFFECTS.has(guid);
}
