import { ko } from "../util";
import type { ReportEntry } from "./types";

// View-model of #exchange-report-dialog (templates/exchange-report-dialog.html), bound at window.view.exchangeReport.
// The dialog lists what an export dropped or approximated. An import shows no report (R5); the only message an import
// can produce is `invalid`, shown in the Download dialog when a chosen file is not an exchange file.

export interface ReportSection {
    id: string;
    textKey: string;
    entries: { message: string }[];
}

type TextKey = "exchangeApproximated";

function section(id: string, textKey: TextKey, entries: ReportEntry[]): ReportSection[] {
    return entries.length ? [{ id, textKey, entries: entries.map((e) => ({ message: e.message })) }] : [];
}

export class ExchangeReportDialog {
    // Set when a chosen file is rejected; shown in the download dialog, nothing else changes.
    public invalid = ko.observable(null as string | null);
    public sections = ko.observableArray([] as ReportSection[]);
    public title: KnockoutComputed<string>;

    constructor(private readonly texts: () => Record<string, { name(): string }>) {
        this.title = ko.pureComputed(() => {
            const t = this.texts();
            return t["exchangeExportReportTitle"] ? t["exchangeExportReportTitle"].name() : "";
        });
    }

    public showExport(report: ReportEntry[]): void {
        this.sections(section("exchange-export-entries", "exchangeApproximated", report));
    }
}
