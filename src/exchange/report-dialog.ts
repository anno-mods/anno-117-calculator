import { ko } from "../util";
import type { ImportPlan, ReportEntry } from "./types";
import type { ComputedDifference, ComputedQuantity } from "./computed";

// View-model of #exchange-report-dialog (templates/exchange-report-dialog.html), bound at window.view.exchangeReport.
// Import mode shows the replacement scope, counts and report sections and has Confirm; export mode lists what the
// export dropped or approximated and has no Confirm.

export interface ReportSection {
    id: string;
    textKey: string;
    entries: { message: string }[];
}

export interface DifferenceRow {
    island: string;
    quantityKey: string;
    label: string;
    fileValue: string;
    calculatorValue: string;
}

const QUANTITY_TEXT_KEYS: Record<ComputedQuantity, string> = {
    residents: "exchangeQuantityResidents",
    buildingsRequired: "exchangeQuantityBuildings",
    imports: "exchangeQuantityImports",
};

// At most two decimals, no trailing zeros.
function formatValue(v: number): string {
    return String(Number(v.toFixed(2)));
}

type TextKey = "exchangeCarried" | "exchangeNotMapped" | "exchangeApproximated" | "exchangeNotProvided";

function section(id: string, textKey: TextKey, entries: ReportEntry[]): ReportSection[] {
    return entries.length ? [{ id, textKey, entries: entries.map((e) => ({ message: e.message })) }] : [];
}

export class ExchangeReportDialog {
    public importMode = ko.observable(true);
    public failed = ko.observable(false);
    // Set when a chosen file is rejected; shown in the download dialog, nothing else changes.
    public invalid = ko.observable(null as string | null);
    public islandCount = ko.observable(0);
    public orphanCount = ko.observable(0);
    public tradeRouteCount = ko.observable(0);
    public sections = ko.observableArray([] as ReportSection[]);
    public differences = ko.observableArray([] as DifferenceRow[]);
    public title: KnockoutComputed<string>;

    private plan: ImportPlan | null = null;
    private onConfirm: (plan: ImportPlan) => boolean = () => false;

    constructor(private readonly texts: () => Record<string, { name(): string }>) {
        this.title = ko.pureComputed(() => {
            const t = this.texts();
            const key = this.differences().length ? "exchangeComputedDifferences" : this.importMode() ? "exchangeReportTitle" : "exchangeExportReportTitle";
            return t[key] ? t[key].name() : "";
        });
    }

    public showImport(plan: ImportPlan, onConfirm: (plan: ImportPlan) => boolean): void {
        this.plan = plan;
        this.onConfirm = onConfirm;
        this.differences([]);
        this.importMode(true);
        this.failed(false);
        this.islandCount(plan.report.counts.islands);
        this.orphanCount(plan.report.counts.orphans);
        this.tradeRouteCount(plan.report.counts.tradeRoutes);
        this.sections([
            ...section("exchange-carried", "exchangeCarried", plan.report.carriedThrough),
            ...section("exchange-not-mapped", "exchangeNotMapped", plan.report.notMapped),
            ...section("exchange-approximated", "exchangeApproximated", plan.report.approximated),
            ...section("exchange-not-provided", "exchangeNotProvided", plan.report.notProvided),
        ]);
    }

    public showExport(report: ReportEntry[]): void {
        this.plan = null;
        this.differences([]);
        this.importMode(false);
        this.failed(false);
        this.sections(section("exchange-export-entries", "exchangeApproximated", report));
    }

    // Shown after an import reload when the file's `computed` block differs from the calculator's own values (R17).
    // Informational: the dialog only has Close.
    public showDifferences(diffs: ComputedDifference[]): void {
        this.plan = null;
        this.importMode(false);
        this.failed(false);
        this.sections([]);
        this.differences(diffs.map((d) => ({
            island: d.island,
            quantityKey: QUANTITY_TEXT_KEYS[d.quantity],
            label: d.label,
            fileValue: formatValue(d.fileValue),
            calculatorValue: formatValue(d.calculatorValue),
        })));
    }

    // Bound with click: confirm. On {ok:false} the dialog stays open with the failure message.
    public confirm = (): void => {
        if (!this.plan) return;
        this.failed(!this.onConfirm(this.plan));
    };
}
