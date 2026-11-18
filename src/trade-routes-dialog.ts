import { ko, formatNumber } from './util';
import { stopsOf } from './exchange/derive-routes';
import { exchangeIdOf, getRouteAnalysis, TradeRoute } from './trade';
import { MIN_GAPS } from './route-analysis';
import { recomputeShares } from './trade-allocation';
import type { PairEvidence, RouteAnalysis, RouteIndicators } from './route-analysis';

declare const window: any;
declare const $: any;

/**
 * View model of the trade routes dialog (templates/trade-routes-management-dialog.html): the calculator routes with
 * required offload and utilization, the imported game routes, and one filter bar and sort state shared by both lists.
 * The dialog content is bound only while the dialog is open, so closed-dialog edits cost nothing (R6).
 */

export type TradeTab = 'calc' | 'game';
export type TradeSort = { key: string; dir: 1 | -1 };

interface PairFilter {
    source: string;
    dest: string;
    product: number;
    label: string;
}

interface FilterState {
    island: string;
    good: number;
    warnings: boolean;
    tab: TradeTab;
}

export interface GameStop {
    index: number;
    islandId: string;
    name: string;
    loads: number[];
    unloads: number[];
}

export interface GameRouteInfo {
    id: string;
    name: string;
    stops: GameStop[];
    pairs: PairEvidence[];
}

export interface GameStatus {
    red: boolean;
    yellow: boolean;
}

const COLLATOR_TAGS: Record<string, string> = {
    english: 'en', simplified_chinese: 'zh-Hans', traditional_chinese: 'zh-Hant', brazilian: 'pt-BR', french: 'fr', polish: 'pl',
    spanish: 'es', italian: 'it', german: 'de', russian: 'ru', japanese: 'ja', korean: 'ko',
};

export class TradeRoutesViewModel {
    public readonly opened = ko.observable(false);
    public readonly tab = ko.observable('calc' as TradeTab);
    public readonly islandFilter = ko.observable('');
    public readonly goodFilter = ko.observable(0);
    public readonly warningsOnly = ko.observable(false);
    public readonly pair = ko.observable(null as PairFilter | null);
    public readonly calcSort = ko.observable({ key: 'from', dir: 1 } as TradeSort);
    public readonly gameSort = ko.observable({ key: 'name', dir: 1 } as TradeSort);

    /** Header columns in cell order; a column without key is not sortable. */
    public readonly calcColumns = [
        { key: 'from', title: 'tradeColSource' },
        { key: '', title: '' },
        { key: 'to', title: 'tradeColDestination' },
        { key: 'good', title: 'tradeFilterGood' },
        { key: 'amount', title: 'tradeColAmount', right: true },
        { key: 'offload', title: 'tradeRequiredOffload', right: true },
        { key: 'utilization', title: 'tradeUtilization', right: true },
        { key: '', title: '' },
        { key: '', title: '' },
    ];
    public readonly gameColumns = [
        { key: 'name', title: 'tradeColRoute' },
        { key: 'from', title: 'tradeColSource' },
        { key: 'to', title: 'tradeColDestination' },
        { key: 'status', title: 'tradeColStatus' },
        { key: '', title: '' },
        { key: '', title: '' },
    ];

    private previous: FilterState | null = null;
    private infos: { analysis: RouteAnalysis; list: GameRouteInfo[] } | null = null;

    public readonly calcByKey: KnockoutComputed<Map<string, TradeRoute[]>>;
    public readonly islandOptions: KnockoutComputed<{ value: string; label: string }[]>;
    public readonly goodOptions: KnockoutComputed<{ value: number; label: string }[]>;
    public readonly calcRows: KnockoutComputed<TradeRoute[]>;
    public readonly gameRows: KnockoutComputed<GameRouteInfo[]>;
    public readonly calcCounts: KnockoutComputed<{ red: number; yellow: number }>;
    public readonly gameCounts: KnockoutComputed<{ red: number; yellow: number }>;

    constructor() {
        const tm = () => window.view.tradeManager;

        // Dialog open state: the delegated handlers do not depend on the dialog element existing yet.
        $(document).on('show.bs.modal', '#trade-routes-management-dialog', () => {
            this.tab('calc');
            this.pair(null);
            this.previous = null;
            this.opened(true);
        });
        $(document).on('hidden.bs.modal', '#trade-routes-management-dialog', () => this.opened(false));
        $(document).on('shown.bs.tab', '#trade-routes-management-dialog [data-toggle="tab"]', (e: any) => {
            this.tab($(e.target).attr('data-target') === '#trade-tab-game' ? 'game' : 'calc');
        });

        this.calcByKey = ko.pureComputed(() => {
            const map = new Map<string, TradeRoute[]>();
            for (const r of tm().routes() as TradeRoute[]) {
                const key = this.key(exchangeIdOf(r.from), exchangeIdOf(r.to), r.product.guid);
                const list = map.get(key) ?? [];
                list.push(r);
                map.set(key, list);
            }
            return map;
        });

        this.islandOptions = ko.pureComputed(() => {
            const names = new Set<string>();
            for (const r of tm().routes() as TradeRoute[]) {
                names.add(r.from.name());
                names.add(r.to.name());
            }
            for (const info of this.gameInfos()) for (const s of info.stops) names.add(s.name);
            return [{ value: '', label: this.t('tradeNoFilter') }, ...[...names].sort(this.collator()).map((n) => ({ value: n, label: n }))];
        });

        this.goodOptions = ko.pureComputed(() => {
            const guids = new Set<number>();
            for (const r of tm().routes() as TradeRoute[]) guids.add(r.product.guid);
            for (const info of this.gameInfos()) for (const s of info.stops) [...s.loads, ...s.unloads].forEach((g) => guids.add(g));
            const opts = [...guids].map((g) => ({ value: g, label: this.productName(g) })).sort((a, b) => this.collator()(a.label, b.label));
            return [{ value: 0, label: this.t('tradeNoFilter') }, ...opts];
        });

        this.calcRows = ko.pureComputed(() => {
            const rows = (tm().routes() as TradeRoute[]).filter((r) => this.matchesCalc(r));
            return this.sorted(rows, this.calcSort(), (r, key) => this.calcKey(r, key));
        });

        this.gameRows = ko.pureComputed(() => {
            const rows = this.gameInfos().filter((i) => this.matchesGame(i));
            return this.sorted(rows, this.gameSort(), (i, key) => this.gameKey(i, key));
        });

        // Counts cover every route: filters never change them.
        this.calcCounts = ko.pureComputed(() => {
            let red = 0;
            let yellow = 0;
            for (const r of tm().routes() as TradeRoute[]) {
                const ind = r.indicators();
                if (ind.red) red++;
                if (ind.yellow) yellow++;
            }
            return { red, yellow };
        });

        this.gameCounts = ko.pureComputed(() => {
            let red = 0;
            let yellow = 0;
            for (const i of this.gameInfos()) {
                const s = this.status(i);
                if (s.red) red++;
                if (s.yellow) yellow++;
            }
            return { red, yellow };
        });
    }

    // ---- texts ----

    /** Recomputes the floors and the default supplier of every multi-source group (src/trade-allocation.ts). */
    recomputeShares(untouchedOnly = false, keepDefault = false): void {
        ko.tasks.runEarly();
        recomputeShares(window.view.tradeManager.routes(), { untouchedOnly, keepDefault });
    }

    t(key: string): string {
        return window.view.texts[key]?.name() ?? key;
    }

    fmt(key: string, ...args: (string | number)[]): string {
        return this.t(key).replace(/%(\d)/g, (_m, i) => String(args[Number(i)] ?? ''));
    }

    private collator(): (a: string, b: string) => number {
        const tag = COLLATOR_TAGS[window.view.settings?.language?.() ?? ''] ?? undefined;
        const c = new Intl.Collator(tag, { sensitivity: 'base', numeric: true });
        return (a, b) => c.compare(a, b);
    }

    productName(guid: number): string {
        const p = window.view.island?.()?.assetsMap?.get(guid);
        return p ? p.name() : String(guid);
    }

    productIcon(guid: number): string | undefined {
        return window.view.island?.()?.assetsMap?.get(guid)?.icon;
    }

    private key(source: string | undefined, dest: string | undefined, product: number): string {
        return `${source ?? ''}|${dest ?? ''}|${product}`;
    }

    // ---- game routes ----

    private islandName(analysis: RouteAnalysis, id: string): string {
        return analysis.data.islandNames.get(id) ?? id;
    }

    gameInfos(): GameRouteInfo[] {
        const analysis = getRouteAnalysis();
        if (this.infos?.analysis !== analysis) {
            const list: GameRouteInfo[] = [];
            for (const route of analysis.data.routes) {
                const parsed = stopsOf(route);
                if (!parsed) continue;
                const stops: GameStop[] = parsed.stops.map((s) => ({
                    index: s.index,
                    islandId: s.island,
                    name: this.islandName(analysis, s.island),
                    loads: [...new Set(s.slots.filter((sl) => sl.mode === 'load').map((sl) => sl.product))],
                    unloads: [...new Set(s.slots.filter((sl) => sl.mode === 'unload').map((sl) => sl.product))],
                }));
                const id = String(route.id);
                list.push({ id, name: typeof route.name === 'string' && route.name ? route.name : id, stops, pairs: analysis.pairsOfRoute(id) });
            }
            this.infos = { analysis, list };
        }
        return this.infos.list;
    }

    /** Red and yellow states of the calculator routes that match the pairs of a game route. */
    status(info: GameRouteInfo): GameStatus {
        const by = this.calcByKey();
        const out: GameStatus = { red: false, yellow: false };
        for (const p of info.pairs) {
            for (const r of by.get(this.key(p.source, p.dest, p.product)) ?? []) {
                const ind = r.indicators();
                if (ind.red) out.red = true;
                if (ind.yellow) out.yellow = true;
            }
        }
        return out;
    }

    /** Calculator routes that exist for a pair of a game route (the reverse chip is shown only then). */
    hasCalcRoute(p: PairEvidence): boolean {
        return (this.calcByKey().get(p.key) ?? []).length > 0;
    }

    pairs(info: GameRouteInfo): { pair: PairEvidence; label: string; icon: string | undefined; tag: string }[] {
        const analysis = getRouteAnalysis();
        // The island that takes part in every pair is the common one; the tag names the other island.
        const common = new Set<string>();
        for (const id of [info.pairs[0]?.source, info.pairs[0]?.dest]) {
            if (id !== undefined && info.pairs.every((p) => p.source === id || p.dest === id)) common.add(id);
        }
        const tagIds = [...new Set(info.pairs.flatMap((p) => [p.source, p.dest]).filter((id) => !common.has(id)))];
        // Initials of the capitalized words ("Sepat des Regens" -> "SR"), one letter per word more until the
        // islands of this route differ; a one-word name shows its first letters (min. 3).
        const abbreviate = (id: string, letters: number): string => {
            const words = this.islandName(analysis, id).trim().split(/\s+/).filter((w) => /^\p{Lu}/u.test(w));
            if (words.length <= 1) return (words[0] ?? this.islandName(analysis, id)).slice(0, letters + 2);
            return words.map((w) => w.slice(0, letters)).join('');
        };
        let letters = 1;
        while (letters < 4 && new Set(tagIds.map((id) => abbreviate(id, letters))).size < tagIds.length) letters++;
        return info.pairs.map((p) => ({
            pair: p,
            label: `${this.islandName(analysis, p.source)} → ${this.islandName(analysis, p.dest)}`,
            icon: this.productIcon(p.product),
            tag: [p.source, p.dest].filter((id) => !common.has(id)).map((id) => abbreviate(id, letters)).join(' → '),
        }));
    }

    gameRouteCount(route: TradeRoute): number {
        return getRouteAnalysis().evidence(exchangeIdOf(route.from) ?? '', exchangeIdOf(route.to) ?? '', route.product.guid)?.routes.length ?? 0;
    }

    /** Distinct island names that load or unload at a game route, in stop order. */
    islandsOf(info: GameRouteInfo, role: 'loads' | 'unloads'): string {
        return [...new Set(info.stops.filter((s) => s[role].length > 0).map((s) => s.name))].join(', ');
    }

    hasGameRoutes(): boolean {
        return this.gameInfos().length > 0;
    }

    // ---- filtering ----

    private matchesCalc(r: TradeRoute): boolean {
        const pair = this.pair();
        if (pair && this.key(exchangeIdOf(r.from), exchangeIdOf(r.to), r.product.guid) !== this.key(pair.source, pair.dest, pair.product)) return false;
        const good = this.goodFilter();
        if (good && r.product.guid !== good) return false;
        const island = this.islandFilter();
        if (island && r.from.name() !== island && r.to.name() !== island) return false;
        if (this.warningsOnly()) {
            const ind = r.indicators();
            if (!ind.red && !ind.yellow) return false;
        }
        return true;
    }

    private matchesGame(i: GameRouteInfo): boolean {
        const pair = this.pair();
        if (pair && !i.pairs.some((p) => p.key === this.key(pair.source, pair.dest, pair.product))) return false;
        const good = this.goodFilter();
        const island = this.islandFilter();
        const handles = (s: GameStop) => (good ? s.loads.includes(good) || s.unloads.includes(good) : s.loads.length + s.unloads.length > 0);
        if (good && !i.stops.some(handles)) return false;
        if (island && !i.stops.some((s) => s.name === island && handles(s))) return false;
        if (this.warningsOnly()) {
            const s = this.status(i);
            if (!s.red && !s.yellow) return false;
        }
        return true;
    }

    // ---- sorting ----

    private sorted<T>(rows: T[], sort: TradeSort, keyOf: (row: T, key: string) => string | number | undefined): T[] {
        const cmp = this.collator();
        return rows
            .map((row, index) => ({ row, index, k: keyOf(row, sort.key) }))
            .sort((a, b) => {
                if (a.k === undefined && b.k === undefined) return a.index - b.index;
                if (a.k === undefined) return 1;
                if (b.k === undefined) return -1;
                const d = typeof a.k === 'number' && typeof b.k === 'number' ? a.k - b.k : cmp(String(a.k), String(b.k));
                return d !== 0 ? d * sort.dir : a.index - b.index;
            })
            .map((x) => x.row);
    }

    private calcKey(r: TradeRoute, key: string): string | number | undefined {
        switch (key) {
            case 'from': return r.from.name();
            case 'to': return r.to.name();
            case 'good': return r.product.name();
            case 'offload': return r.indicators().requiredOffload;
            case 'utilization': return r.indicators().utilization;
            case 'amount': return r.currentProduction();
        }
        return undefined;
    }

    /** Alphabetically first island that loads (`source`) or unloads (`dest`) the selected good, else any good. */
    private firstIsland(i: GameRouteInfo, role: 'loads' | 'unloads'): string | undefined {
        const good = this.goodFilter();
        const names = i.stops.filter((s) => (good ? s[role].includes(good) : s[role].length > 0)).map((s) => s.name);
        return names.sort(this.collator())[0];
    }

    private gameKey(i: GameRouteInfo, key: string): string | number | undefined {
        switch (key) {
            case 'name': return i.name;
            case 'from': return this.firstIsland(i, 'loads');
            case 'to': return this.firstIsland(i, 'unloads');
            case 'status': { const s = this.status(i); return (s.red ? 2 : 0) + (s.yellow ? 1 : 0); }
        }
        return undefined;
    }

    private sortState(tab: TradeTab): KnockoutObservable<TradeSort> {
        return tab === 'calc' ? this.calcSort : this.gameSort;
    }

    sortBy(tab: TradeTab, key: string): void {
        const state = this.sortState(tab);
        const cur = state();
        state({ key, dir: cur.key === key ? (cur.dir === 1 ? -1 : 1) : 1 });
    }

    ariaSort(tab: TradeTab, key: string): string {
        const s = this.sortState(tab)();
        return s.key !== key ? 'none' : s.dir === 1 ? 'ascending' : 'descending';
    }

    sortIconClass(tab: TradeTab, key: string): string {
        const a = this.ariaSort(tab, key);
        return a === 'ascending' ? 'fa fa-sort-asc' : a === 'descending' ? 'fa fa-sort-desc' : 'fa fa-sort';
    }

    headerTitle(tab: TradeTab, key: string, title: string): string {
        const a = this.ariaSort(tab, key);
        const state = a === 'none' ? 'villaSortNone' : a === 'ascending' ? 'villaSortAscending' : 'villaSortDescending';
        return `${title}. ${this.t(state)}`;
    }

    // ---- tab and jumps ----

    selectTab(tab: TradeTab): void {
        this.tab(tab);
        $(`#trade-routes-management-dialog [data-target="#trade-tab-${tab}"]`).tab('show');
    }

    private jump(source: string, dest: string, product: number, to: TradeTab): void {
        if (!this.pair()) this.previous = { island: this.islandFilter(), good: this.goodFilter(), warnings: this.warningsOnly(), tab: this.tab() };
        const analysis = getRouteAnalysis();
        this.pair({ source, dest, product, label: `${this.islandName(analysis, source)} → ${this.islandName(analysis, dest)}, ${this.productName(product)}` });
        this.islandFilter('');
        this.goodFilter(product);
        this.warningsOnly(false);
        this.selectTab(to);
    }

    showGameRoutes(route: TradeRoute): void {
        this.jump(exchangeIdOf(route.from) ?? '', exchangeIdOf(route.to) ?? '', route.product.guid, 'game');
    }

    showCalculatorRoutes(p: PairEvidence): void {
        this.jump(p.source, p.dest, p.product, 'calc');
    }

    /** Dismisses the jump chip and returns to the filter and tab before the jump. */
    back(): void {
        const prev = this.previous;
        this.pair(null);
        this.previous = null;
        if (!prev) return;
        this.islandFilter(prev.island);
        this.goodFilter(prev.good);
        this.warningsOnly(prev.warnings);
        this.selectTab(prev.tab);
    }

    // ---- indicator texts ----

    num(v: number | undefined): string {
        return v === undefined || !Number.isFinite(v) ? '–' : formatNumber(Math.round(v * 100) / 100);
    }

    reasonText(ind: RouteIndicators): string {
        const keys: Record<string, string> = {
            'no-evidence': 'tradeReasonNoEvidence', gaps: 'tradeReasonGaps', clock: 'tradeReasonClock', ship: 'tradeReasonShip',
            ambiguous: 'tradeReasonAmbiguous', 'no-ships': 'tradeReasonNoShips',
        };
        return this.fmt(keys[ind.reason ?? 'no-evidence'] ?? 'tradeReasonNoEvidence', MIN_GAPS);
    }

    offloadTip(r: TradeRoute): string {
        const ind = r.indicators();
        if (!ind.available) return `${this.t('tradeUnavailable')}: ${this.reasonText(ind)}`;
        const use = this.fmt('tradeTipOffload', this.num(ind.requiredOffload), this.num(ind.gapMinutes), this.num(r.currentProduction()), this.num(ind.actualUnload));
        if (ind.capacity === undefined) return use;
        return `${use} ${this.fmt('tradeTipCapacity', this.num(ind.capacity), ind.ships ?? 0, this.num(ind.utilization))}`;
    }

    redTip(r: TradeRoute): string {
        const ind = r.indicators();
        return this.fmt('tradeTipRed', this.num(ind.requiredOffload), this.num(ind.capacity), this.num(ind.utilization));
    }

    yellowTip(r: TradeRoute): string {
        const ind = r.indicators();
        const product = this.productName(r.product.guid);
        if (ind.yellow === 'minimumStock') return this.fmt('tradeTipMinimumStock', this.num(ind.stock?.minimum), r.to.name(), this.num(ind.stock?.load));
        if (ind.yellow === 'pool') {
            const base = this.fmt('tradeTipPool', r.from.name(), this.num(ind.stock?.pool), this.num(ind.stock?.load));
            return ind.competing.length ? `${base} ${this.fmt('tradeTipCompeting', ind.competing.join(', '))}` : base;
        }
        if (ind.yellow === 'storage') return this.fmt('tradeTipStorage', `${r.to.name()} (${product})`, this.num(ind.actualUnload), this.num(ind.requiredOffload)) + (ind.unloadIsNet ? ' ' + this.t('tradeNetNote') : '');
        return '';
    }
}
