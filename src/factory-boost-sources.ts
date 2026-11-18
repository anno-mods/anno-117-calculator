import { ACCURACY, ko } from './util';
import { AppliedBuff } from './buffs';
import { Effect, Item, Fertility, isProductionRelevantBuff } from './production';
import { isPermanentOnlyEffect } from './permanent-only-effects';
import type { ExtraGoodProduction } from './buffs';
import type { Workforce } from './population';
import type { Product } from './production';
import type { Consumer } from './factories';

declare const $: any;
declare const view: any;

/**
 * Read-only model of what drives a consumer's productivity: the rows of the three groups of the factory
 * config view (equipped items, range effects, permanent effects), the header numbers and the breakdown
 * behind the productivity tooltip. It classifies `consumer.buffs()`; it never writes `boost`.
 */

/**
 * The productivity formula shared by `Consumer.boostSubscription` and the breakdown: base additions and
 * productivity upgrades combine as `(100 + base) * (100 + upgrades) / 10000`, the division last to avoid
 * rounding artifacts, times the fertility factor, floored at ACCURACY.
 */
export function computeProductivity(baseProductivitySum: number, productivityUpgradeSum: number, fertilityFactor: number = 1.0): number {
    const totalBoost = ((100 + baseProductivitySum) * (100 + productivityUpgradeSum)) / 10000;
    return Math.max(ACCURACY, totalBoost * fertilityFactor);
}

/** The dialog that owns an effect: the Effects dialog, or the patron selection dialog for patron effects. */
export type EffectOwner = 'effects' | 'patron';

/** Source values the Effects dialog offers in its source filter. */
const EFFECTS_DIALOG_SOURCES = ['mythical-item', 'tech', 'festival', 'veneration-effect', 'session-event', 'island-event'];

/** Maps an effect to the dialog that owns it: effects of the island's patrons belong to the patron dialog. */
export function resolveEffectOwner(consumer: Consumer, effect: Effect): EffectOwner {
    return consumer.island.patronEffects.some(e => e.guid === effect.guid) ? 'patron' : 'effects';
}

/**
 * Closes the factory dialog and opens the dialog that owns the effect after the fade (Bootstrap has no
 * stacked modals). The Effects dialog opens with the effect name in its search field and the effect source in
 * its source filter (`all` when the dialog offers no such source).
 */
export function openEffectOwner(effect: Effect, owner: EffectOwner): void {
    $('#product-config-dialog').modal('hide');
    if (owner === 'patron') {
        setTimeout(() => $('#patron-selection-dialog').modal('show'), 500);
        return;
    }
    view.effectsFilter.search(effect.name());
    view.effectsFilter.source(effect.source && EFFECTS_DIALOG_SOURCES.indexOf(effect.source) !== -1 ? effect.source : 'all');
    setTimeout(() => $('#effects-dialog').modal('show'), 500);
}

/** The buff fields a row shows, named like the fields of `Buff`, so one template renders item and effect rows. */
export interface BuffValues {
    baseProductivityUpgrade: number;
    productivityUpgrade: number;
    fuelDurationPercent: number;
    workforceMaintenanceFactorUpgrade: number;
    fertilityPercent: number;
    addedFertility?: Fertility;
}

/** Productivity of one list entry in percentage points: base additions plus productivity upgrades. */
function pointsOf(values: BuffValues): number {
    return values.baseProductivityUpgrade + values.productivityUpgrade;
}

/**
 * One row of the range effect or permanent effect group: all buffs one effect applies to the consumer. The
 * values of a range row are the raw buff values (like an item row, shown while the toggle is Off), the values
 * of a permanent row are scaled by the effect (stack count).
 */
export class EffectBoostRow {
    public readonly effect: Effect;
    public readonly target: Consumer;
    public readonly guid: number;
    public readonly name: KnockoutComputed<string>;
    /** Per-target state of a range effect (0 = Off, 1 = On); undefined for permanent effects. */
    public readonly state: KnockoutObservable<number> | undefined;
    /** The toggle's view of `state`: any stored value other than 1 reads as Off (a corrupt save contributes nothing). */
    public readonly toggle: KnockoutComputed<number> | undefined;
    public readonly owner: EffectOwner;
    /** True for effects that the Effects dialog does not list: the row has no link to that dialog. */
    public readonly permanentOnly: boolean;
    public readonly sourceText: KnockoutComputed<string>;
    public readonly applied: KnockoutComputed<AppliedBuff[]>;
    public readonly activeBuff: KnockoutComputed<BuffValues>;
    public readonly stack: KnockoutComputed<number>;
    /** The activated item that names this effect through `heroicEffect`, if any (permanent rows). */
    public readonly equippedBy: KnockoutComputed<Item | undefined>;
    /** Text of the source line: the name of `equippedBy`, else the source label of the effect. */
    public readonly sourceLine: KnockoutComputed<string>;

    constructor(effect: Effect, target: Consumer) {
        this.effect = effect;
        this.target = target;
        this.guid = effect.guid;
        this.name = effect.name;
        this.state = effect.slotStates?.get(target);
        const state = this.state;
        this.toggle = state ? ko.pureComputed({
            read: () => state() === 1 ? 1 : 0,
            write: (v: number) => state(v ? 1 : 0),
        }) : undefined;
        this.owner = resolveEffectOwner(target, effect);
        this.permanentOnly = isPermanentOnlyEffect(effect.guid);
        const scaled = this.state == null;

        this.sourceText = ko.pureComputed(() => effect.getSourceText());
        this.applied = ko.pureComputed(() => target.buffs().filter(b => b.parent === effect));
        this.stack = ko.pureComputed(() => effect.scaling());

        this.activeBuff = ko.pureComputed(() => {
            const sum: BuffValues = {
                baseProductivityUpgrade: 0,
                productivityUpgrade: 0,
                fuelDurationPercent: 0,
                workforceMaintenanceFactorUpgrade: 0,
                fertilityPercent: 0,
            };
            for (const b of this.applied()) {
                sum.baseProductivityUpgrade += scaled ? b.baseProductivityUpgrade() : b.buff.baseProductivityUpgrade;
                sum.productivityUpgrade += scaled ? b.productivityUpgrade() : b.buff.productivityUpgrade;
                sum.fuelDurationPercent += scaled ? b.fuelDurationPercent() : b.buff.fuelDurationPercent;
                sum.workforceMaintenanceFactorUpgrade += scaled ? b.workforceMaintenanceFactorUpgrade() : b.buff.workforceMaintenanceFactorUpgrade;
                sum.fertilityPercent += scaled ? b.fertilityPercent() : b.buff.fertilityPercent;
                if (!sum.addedFertility && b.buff.addedFertility)
                    sum.addedFertility = b.buff.addedFertility;
            }
            return sum;
        });

        this.equippedBy = ko.pureComputed(() => {
            const island = target.island;
            for (const item of [...island.items, ...island.residenceItems]) {
                if (item.heroicEffectGuid !== effect.guid)
                    continue;
                for (const state of item.slotStates.values())
                    if (state() > 0)
                        return item;
            }
            return undefined;
        });

        this.sourceLine = ko.pureComputed(() => {
            const item = this.equippedBy();
            return item ? item.name() : this.sourceText();
        });
    }

    /** Extra goods of all buffs of the effect on the consumer; undefined when there are none. */
    get extraGoods(): ExtraGoodProduction[] | undefined {
        const goods = this.applied().flatMap(b => b.extraGoods ?? []);
        return goods.length ? goods : undefined;
    }

    /** Input replacements of all buffs of the effect on the consumer; undefined when there are none. */
    get replacementArray(): { old: Product, new?: Product | undefined }[] | undefined {
        const replacements = this.applied().flatMap(b => b.replacementArray ?? []);
        return replacements.length ? replacements : undefined;
    }

    get replacingWorkforce(): Workforce | undefined {
        return this.applied().find(b => b.replacingWorkforce)?.replacingWorkforce;
    }
}

/** Contributions to the productivity of a consumer by source kind, in percentage points of the upgrade sum. */
export interface ProductivityBreakdown {
    baseAdditions: number;
    /** Sum of all productivity upgrades in percentage points; the multiplier is 100 + upgrades. */
    upgrades: number;
    items: number;
    rangeEffects: number;
    permanentEffects: number;
    timeLimitedEffects: number;
    modules: number;
    aqueduct: number;
    /** (100 + base additions) * (100 + upgrades) / 100, in percent, before the fertility factor. */
    sum: number;
    fertilityFactor: number;
    /** Productivity as a fraction, equal to `consumer.boost()`. */
    total: number;
}

export class FactoryBoostSources {
    public readonly itemRows: KnockoutComputed<AppliedBuff[]>;
    public readonly rangeRows: KnockoutComputed<EffectBoostRow[]>;
    public readonly permanentRows: KnockoutComputed<EffectBoostRow[]>;
    /** True when any group has rows. */
    public readonly hasAny: KnockoutComputed<boolean>;
    /** Active contributing sources: items and range effects above Off plus permanent effects. */
    public readonly count: KnockoutComputed<number>;
    /** Net productivity points of the active rows of the three groups (before modules, aqueduct, fertility). */
    public readonly net: KnockoutComputed<number>;
    public readonly breakdown: KnockoutComputed<ProductivityBreakdown>;

    private readonly consumer: Consumer;
    private readonly rowCache = new Map<Effect, EffectBoostRow>();

    /**
     * @param consumer - the consumer whose `buffs()` are classified
     * @param fertilityFactor - reads the fertility multiplier (1 for consumers without a needed fertility)
     */
    constructor(consumer: Consumer, fertilityFactor: () => number) {
        this.consumer = consumer;

        this.itemRows = ko.pureComputed(() => consumer.availableItems().filter(b => b.parent instanceof Item));

        this.rangeRows = ko.pureComputed(() => {
            const effects: Effect[] = [];
            for (const b of consumer.availableItems()) {
                const p = b.parent;
                if (p instanceof Effect && p.slotStates != null && effects.indexOf(p) === -1)
                    effects.push(p);
            }
            return effects.map(e => this.rowFor(e));
        });

        this.permanentRows = ko.pureComputed(() => {
            const effects: Effect[] = [];
            for (const b of consumer.buffs()) {
                const p = b.parent;
                if (p instanceof Effect && p.slotStates == null && !p.effectDuration && p.scaling() > 0
                    && changesProductionOf(b) && effects.indexOf(p) === -1)
                    effects.push(p);
            }
            return effects.map(e => this.rowFor(e));
        });

        this.hasAny = ko.pureComputed(() => this.itemRows().length > 0 || this.rangeRows().length > 0 || this.permanentRows().length > 0);

        this.count = ko.pureComputed(() => {
            let n = this.permanentRows().length;
            for (const b of this.itemRows())
                if (itemState(b)() > 0)
                    n++;
            for (const r of this.rangeRows())
                if (r.state!() === 1)
                    n++;
            return n;
        });

        this.net = ko.pureComputed(() => {
            let sum = 0;
            for (const b of this.itemRows())
                if (itemState(b)() > 0)
                    sum += pointsOf(b.activeBuff!());
            for (const r of this.rangeRows())
                if (r.state!() === 1)
                    sum += pointsOf(r.activeBuff());
            for (const r of this.permanentRows())
                sum += pointsOf(r.activeBuff());
            return sum;
        });

        this.breakdown = ko.pureComputed(() => {
            let baseSum = 0;
            let upgradeSum = 0;
            const parts = { items: 0, rangeEffects: 0, permanentEffects: 0, timeLimitedEffects: 0, modules: 0, aqueduct: 0 };

            // one running sum in the order of Consumer.boostSubscription keeps the total equal to boost()
            for (const b of consumer.buffs()) {
                const up = b.productivityUpgrade();
                baseSum += b.baseProductivityUpgrade();
                upgradeSum += up;

                const p = b.parent;
                if (p instanceof Item)
                    parts.items += up;
                else if (p instanceof Effect) {
                    if (p.slotStates != null)
                        parts.rangeEffects += up;
                    else if (p.effectDuration)
                        parts.timeLimitedEffects += up;
                    else
                        parts.permanentEffects += up;
                }
                else
                    parts.modules += up;
            }

            if (consumer.aqueductBuff != null) {
                baseSum += consumer.aqueductBuff.baseProductivityUpgrade();
                const up = consumer.aqueductBuff.productivityUpgrade();
                upgradeSum += up;
                parts.aqueduct += up;
            }

            const fertility = fertilityFactor();
            return {
                baseAdditions: baseSum,
                upgrades: upgradeSum,
                ...parts,
                sum: ((100 + baseSum) * (100 + upgradeSum)) / 100,
                fertilityFactor: fertility,
                total: computeProductivity(baseSum, upgradeSum, fertility),
            };
        });
    }

    /** The row of an effect on this consumer; one object per effect, so the list identity survives recomputes. */
    private rowFor(effect: Effect): EffectBoostRow {
        let row = this.rowCache.get(effect);
        if (!row) {
            row = new EffectBoostRow(effect, this.consumer);
            this.rowCache.set(effect, row);
        }
        return row;
    }
}

/** Slot state of an item row (0 = Off, 1 = Base, 2 = Boosted). */
export function itemState(row: AppliedBuff): KnockoutObservable<number> {
    return (row.parent as Item).slotStates.get(row.target)!;
}

/** True when the buff moves a production field of its target, base productivity included. */
function changesProductionOf(applied: AppliedBuff): boolean {
    return applied.buff.baseProductivityUpgrade !== 0 || isProductionRelevantBuff(applied.buff);
}
