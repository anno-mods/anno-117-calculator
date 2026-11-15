import { NILE_FLOOD_EFFECT, VOLCANO_EFFECTS } from "./exchange/discoveries";

/**
 * Effects that the Effects dialog does not list. They show in the Permanent effects group of the factory dialog:
 * - the Egyptian harvest season Shemu / Achet (`NILE_FLOOD_EFFECT`), switched on with its DLC by `DlcSettings`;
 * - the three volcano effects (Obsidian gathering, Obsidian mining, fertile soil), whose scale is the volcano level
 *   of the settings dialog.
 * No row has a switch; a row exists while the effect is on. `params.js` carries no flag for this, so the set is named here.
 */
export const HARVEST_SEASON_EFFECT: number = NILE_FLOOD_EFFECT;

const HIDDEN_FROM_EFFECTS_DIALOG: ReadonlySet<number> = new Set([HARVEST_SEASON_EFFECT, ...VOLCANO_EFFECTS]);

/** True for effects that are listed in the Permanent effects group only. */
export function isPermanentOnlyEffect(guid: number): boolean {
    return HIDDEN_FROM_EFFECTS_DIALOG.has(guid);
}
