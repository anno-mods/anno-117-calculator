import { ko } from "./util";
import type { DLC } from "./util";
import type { Effect } from "./production";
import type { Session } from "./world";
import { VOLCANO_EFFECTS, VOLCANO_SESSIONS } from "./exchange/discoveries";
import { VOLCANO_UNLOCKED_KEY } from "./exchange/keys";
import { HARVEST_SEASON_EFFECT } from "./permanent-only-effects";

// DLC-specific view-model code (plan 2026-11-12-003, R11b). Everything that names a DLC or its content lives here and in
// templates/dlc-settings.html; the settings dialog only includes that template for each DLC row. A later DLC-specific
// setting is a further member of DlcSettings plus a block in the template.

export interface KeyValueStore {
    getItem(key: string): any;
    setItem(key: string, value: any): void;
}

export interface VolcanoDifference {
    effect: Effect;
    value: number;
}

// The volcano level: the shared scale of the three volcano effects in the sessions VOLCANO_SESSIONS (the savegame stores
// it the same way). The scales are the live `Effect.scaling` observables of the sessions, which persist themselves.
// Only the set of unlocked effects needs storage of its own, because level 0 sets every scale to 0.
export class VolcanoSettings {
    // Prophecies of Ash: the one DLC all three effects list. The data states it; no DLC GUID appears in code.
    public readonly dlc: DLC;
    // The three effects of the first volcano session, in the order of VOLCANO_EFFECTS.
    public readonly effects: Effect[];
    // GUIDs of the effects the user has unlocked (a scale above 0 once, or the file of an import).
    public readonly unlocked: KnockoutObservableArray<number>;
    // 0 (every scale is 0), the shared non-zero scale, or null when the non-zero scales differ.
    public readonly level: KnockoutComputed<number | null>;
    // Names the effects the level applies to, for the tooltip of the selector icon.
    public readonly effectNames: KnockoutComputed<string>;
    // One entry per effect with its largest scale; shown while `level()` is null.
    public readonly differences: KnockoutComputed<VolcanoDifference[]>;
    public readonly levels: readonly number[] = [0, 1, 2, 3, 4, 5];

    private readonly scalings: { effect: number; scaling: KnockoutObservable<number> }[] = [];

    constructor(dlc: DLC, effects: Effect[], scalings: { effect: number; scaling: KnockoutObservable<number> }[], private readonly store: KeyValueStore | undefined) {
        this.dlc = dlc;
        this.effects = effects;
        this.scalings = scalings;

        const stored = store ? store.getItem(VOLCANO_UNLOCKED_KEY) : undefined;
        const initial = Array.isArray(stored) ? VOLCANO_EFFECTS.filter((e) => stored.includes(e)) : [];
        this.unlocked = ko.observableArray(initial);
        for (const s of scalings) this.unlockIfActive(s.effect, s.scaling());
        this.persist(initial);

        // A scale above 0 (selector, Master mode, manual edit, effect dialog) unlocks its effect.
        for (const s of scalings)
            s.scaling.subscribe((value: number) => {
                if (this.unlockIfActive(s.effect, value)) this.persist();
            });

        this.level = ko.pureComputed({
            read: () => {
                const active = this.scalings.map((s) => s.scaling()).filter((v) => v > 0);
                if (active.length === 0) return 0;
                return active.every((v) => v === active[0]) ? active[0] : null;
            },
            write: (value: number | null) => {
                if (value != null) this.setLevel(value);
            },
        });

        this.effectNames = ko.pureComputed(() => this.effects.map((e) => e.name()).join(", "));

        this.differences = ko.pureComputed(() =>
            this.effects.map((effect) => ({
                effect,
                value: Math.max(0, ...this.scalings.filter((s) => s.effect === effect.guid).map((s) => s.scaling())),
            })),
        );
    }

    // Level 0 sets every scale to 0 and keeps the unlocked set. A larger level applies to the unlocked set and leaves
    // the other effects at 0; without a set (fresh profile) it applies to all three and unlocks them.
    public setLevel(level: number): void {
        if (level > 0 && this.unlocked().length === 0) {
            this.unlocked([...VOLCANO_EFFECTS]);
            this.persist();
        }
        const targets = this.unlocked();
        for (const s of this.scalings) s.scaling(level > 0 && targets.includes(s.effect) ? level : 0);
    }

    // Writes the level to all three effects, whatever was unlocked before (Master view mode).
    public applyAll(level: number): void {
        for (const s of this.scalings) s.scaling(level);
    }

    private unlockIfActive(effect: number, value: number): boolean {
        if (!(value > 0) || this.unlocked().includes(effect)) return false;
        this.unlocked(VOLCANO_EFFECTS.filter((e) => e === effect || this.unlocked().includes(e)));
        return true;
    }

    private persist(previous?: number[]): void {
        if (!this.store) return;
        const now = this.unlocked();
        if (previous && previous.length === now.length && previous.every((e, i) => e === now[i])) return;
        this.store.setItem(VOLCANO_UNLOCKED_KEY, [...now]);
    }
}

export class DlcSettings {
    // Undefined when the params carry no volcano effect or no single DLC for it; its template block then does not render.
    public readonly volcano: VolcanoSettings | undefined;

    constructor(sessions: Session[], store: KeyValueStore | undefined) {
        this.volcano = DlcSettings.createVolcano(sessions, store);
        DlcSettings.switchOnHarvestSeasonWithItsDlc(sessions);
    }

    // Shemu / Achet (the harvest season effect) has no switch of its own outside the Permanent effects group of the
    // factory dialog. Activating its DLC switches it on in every session that has it; loading a saved state and later
    // manual changes are left alone, because only a change of the DLC flag fires the subscription.
    private static switchOnHarvestSeasonWithItsDlc(sessions: Session[]): void {
        const effects = sessions
            .map((s) => s.effects.find((e) => e.guid === HARVEST_SEASON_EFFECT))
            .filter((e): e is Effect => e != null);
        const dlc = effects[0]?.dlcs?.length === 1 ? effects[0].dlcs[0] : undefined;
        if (!dlc) return;
        // The effect is switched on by the DLC itself, so it must not lock the DLC (a locked DLC cannot be switched off again).
        for (const e of effects) dlc.removeDependentObject(e.scaling);
        dlc.checked.subscribe((checked: boolean) => {
            if (checked) for (const e of effects) e.scaling(1);
        });
    }

    // Master view mode: the volcano at level 5.
    public applyAll(volcanoLevel: number): void {
        this.volcano?.applyAll(volcanoLevel);
    }

    private static createVolcano(sessions: Session[], store: KeyValueStore | undefined): VolcanoSettings | undefined {
        const scalings: { effect: number; scaling: KnockoutObservable<number> }[] = [];
        let effects: Effect[] = [];
        for (const sessionGuid of VOLCANO_SESSIONS) {
            const session = sessions.find((s) => s.guid === sessionGuid);
            if (!session) continue;
            const found = VOLCANO_EFFECTS.map((guid) => session.effects.find((e) => e.guid === guid)).filter((e): e is Effect => e != null);
            for (const e of found) scalings.push({ effect: e.guid as number, scaling: e.scaling });
            if (effects.length === 0) effects = found;
        }
        const dlc = effects[0]?.dlcs?.length === 1 ? effects[0].dlcs[0] : undefined;
        if (!dlc || scalings.length === 0) return undefined;
        return new VolcanoSettings(dlc, effects, scalings, store);
    }
}
