import { ko, Option } from "../util";
import { DEFAULT_SELECTION, effectiveSelection, IMPORT_SCOPE_SETTING_PREFIX, SCOPE_SETTING_NAMES } from "./scopes";
import { hasSnapshot, restoreSnapshot } from "./undo";
import type { ScopeSelection } from "./types";

// View-model of the import scope block in #download-dialog (templates/download-dialog.html), bound at
// window.view.importScopes: five scope ticks, three toggles (R1, R2), their persistence in calculatorSettings (R3), the
// sentence that names what the next import does (R4) and the Undo state (R5a).

type SettingName = (typeof SCOPE_SETTING_NAMES)[number];

interface SettingsStore {
    getItem(key: string): unknown;
    setItem(key: string, value: string): void;
}

type Texts = () => Record<string, { name(): string }>;

const SCOPE_TEXT: Record<"islands" | "residences" | "production" | "trade" | "modifiers", string> = {
    islands: "importScopeIslands",
    residences: "importScopeResidences",
    production: "importScopeProduction",
    trade: "importScopeTrade",
    modifiers: "importScopeModifiers",
};

export class ImportScopesViewModel {
    public islands: Option;
    public residences: Option;
    public production: Option;
    public trade: Option;
    public modifiers: Option;
    public keepIslands: Option;
    public keepRoutes: Option;
    public recalcRoutes: Option;
    public undoAvailable = ko.observable(hasSnapshot());
    public sentence: KnockoutComputed<string>;

    constructor(private readonly texts: Texts) {
        const make = (name: SettingName): Option => new Option({ id: name, checked: DEFAULT_SELECTION[name] });
        this.islands = make("islands");
        this.residences = make("residences");
        this.production = make("production");
        this.trade = make("trade");
        this.modifiers = make("modifiers");
        this.keepIslands = make("keepIslands");
        this.keepRoutes = make("keepRoutes");
        this.recalcRoutes = make("recalcRoutes");
        this.sentence = ko.pureComputed(() => this.buildSentence());
    }

    // Restores the stored states and stores every later change (device preferences: `settings.importScope.<name>`).
    public persist(store: SettingsStore): void {
        for (const name of SCOPE_SETTING_NAMES) {
            const option = this[name];
            const key = IMPORT_SCOPE_SETTING_PREFIX + name;
            const stored = store.getItem(key);
            if (stored !== null && stored !== undefined) option.checked(parseInt(String(stored), 10) ? true : false);
            option.checked.subscribe((v: boolean) => store.setItem(key, v ? "1" : "0"));
        }
    }

    // The selection as ticked; the effective selection (toggles of unticked scopes off) is used for the import.
    public selection(): ScopeSelection {
        return effectiveSelection({
            islands: this.islands.checked(),
            residences: this.residences.checked(),
            production: this.production.checked(),
            trade: this.trade.checked(),
            modifiers: this.modifiers.checked(),
            keepIslands: this.keepIslands.checked(),
            keepRoutes: this.keepRoutes.checked(),
            recalcRoutes: this.recalcRoutes.checked(),
        });
    }

    public undo = (): void => {
        restoreSnapshot();
    };

    private text(key: string): string {
        const t = this.texts()[key];
        return t ? t.name() : key;
    }

    private buildSentence(): string {
        const sel = this.selection();
        const replace: string[] = [];
        const merge: string[] = [];
        const leave: string[] = [];
        for (const scope of ["islands", "residences", "production", "trade", "modifiers"] as const) {
            const name = this.text(SCOPE_TEXT[scope]);
            if (!sel[scope]) {
                leave.push(name);
                continue;
            }
            const keeps = (scope === "islands" && sel.keepIslands) || (scope === "trade" && sel.keepRoutes);
            const label = scope === "trade" && sel.recalcRoutes ? `${name} (${this.text("importRecalcRoutes")})` : name;
            (keeps ? merge : replace).push(label);
        }
        const parts: string[] = [];
        if (replace.length) parts.push(`${this.text("importWillReplace")} ${replace.join(", ")}.`);
        if (merge.length) parts.push(`${this.text("importWillMerge")} ${merge.join(", ")}.`);
        if (leave.length) parts.push(`${this.text("importLeavesAlone")} ${leave.join(", ")}.`);
        return parts.join(" ");
    }
}
