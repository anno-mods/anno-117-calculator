import { ko, formatNumber, NamedElement } from './util';
import type { Buff, Effect, Item, Product } from './production';
import type { Island } from './world';
import type { PopulationLevel } from './population';

declare const window: any;
declare const $: any;

/**
 * View model of the villa items dialog (templates/villa-items-dialog.html): one sortable table with one row per
 * residence item of the island. Cells show the raw values of the active variant (Boosted at state 2, otherwise
 * Base) and are never scaled by the island's villaCoverage, so the sort order does not depend on the coverage.
 */

/** `state`, `name`, `targets`, `attr:<needAttribute id>`, `consumption`, `additional` */
export type VillaSortKey = string;

/** One contribution of the active variant to an attribute or a consumption change. */
export interface VillaChip {
    value: number;
    text: string;
    title: string;
    /** Icons of the goods the contribution applies to; empty for a contribution without a good. */
    icons: { src: string | undefined; name: string }[];
}

export interface VillaColumn {
    key: VillaSortKey;
    /** Column title, also the title of the header icon and the sort button. */
    title: () => string;
    icon?: string | undefined;
    /** Header carries icon and text (no single icon stands for the column) */
    withText: boolean;
}

export const SORT_STORAGE_KEY = 'villaItemsSort';

const COLLATOR_TAGS: Record<string, string> = {
    english: 'en',
    simplified_chinese: 'zh-Hans',
    traditional_chinese: 'zh-Hant',
    brazilian: 'pt-BR',
    french: 'fr',
    polish: 'pl',
    spanish: 'es',
    italian: 'it',
    german: 'de',
    russian: 'ru',
    japanese: 'ja',
    korean: 'ko',
};

function signed(value: number): string {
    return formatNumber(value, true);
}

/** Buffs of an item buff: the buff itself and the buffs of the area effect it names (`functionalEffect`, one level deep). */
function withFunctionalBuffs(buff: Buff, island: Island): Buff[] {
    const buffs = [buff];
    if (buff.functionalEffect) {
        const effect = island.assetsMap.get(buff.functionalEffect) as Effect | undefined;
        for (const guid of (effect?.buffGuids || [])) {
            const b = island.assetsMap.get(guid) as Buff | undefined;
            if (b)
                buffs.push(b);
        }
    }
    return buffs;
}

function goodsOf(guids: number[], island: Island): { product: Product; icon: string | undefined; name: string }[] {
    const goods = [];
    for (const g of guids) {
        const product = island.assetsMap.get(g) as Product | undefined;
        if (product)
            goods.push({ product, icon: product.icon, name: product.name() });
    }
    return goods;
}

export class VillaItemRow {
    public item: Item;
    public id: string;
    public name: KnockoutComputed<string>;
    public icon?: string | undefined;
    public state: KnockoutObservable<number>;
    public hasBoost: boolean;
    public levels: PopulationLevel[];
    /** The island-wide effect of the item when it exists in params.effects */
    public heroicEffect: Effect | undefined;
    public heroicLit: KnockoutComputed<boolean>;
    public heroicTitle: KnockoutComputed<string>;
    /** Raw values of the active variant; recomputed when the state or the language changes. */
    public data: KnockoutComputed<VillaRowData>;

    constructor(item: Item, private readonly island: Island, private readonly attributes: NamedElement[]) {
        this.item = item;
        this.id = 'villa-item-' + item.guid;
        this.name = item.name;
        this.icon = item.icon;
        this.state = item.slotStates.values().next().value as KnockoutObservable<number>;
        this.hasBoost = item.boostEquipments.length > 0;
        this.heroicEffect = item.heroicEffectOf();

        const order = new Map<number, number>(island.populationLevels.map((l, i) => [l.guid, i]));
        const levels = new Map<number, PopulationLevel>();
        for (const f of item.factories) {
            const level = (f as unknown as { populationLevel?: PopulationLevel }).populationLevel;
            if (level)
                levels.set(level.guid, level);
        }
        this.levels = [...levels.values()].sort((a, b) => (order.get(a.guid) ?? 0) - (order.get(b.guid) ?? 0));

        this.heroicLit = ko.pureComputed(() => !!this.heroicEffect && this.heroicEffect.scaling() >= 1);
        this.heroicTitle = ko.pureComputed(() => {
            const texts = window.view.texts;
            if (!this.heroicEffect)
                return '';
            return `${texts.villaHeroicEffect.name()}: ${this.heroicEffect.name()} (${this.heroicLit() ? texts.villaEffectOn.name() : texts.villaEffectOff.name()})`;
        });

        this.data = ko.pureComputed(() => this.collect());
    }

    /** Lowest tier among the targeted levels: the position of the level in params.populationLevels. */
    lowestTier(): number {
        const order = new Map<number, number>(this.island.populationLevels.map((l, i) => [l.guid, i]));
        return Math.min(...this.levels.map(l => order.get(l.guid) ?? 0));
    }

    private activeBuffs(): Buff[] {
        const seen = new Set<Buff>();
        const buffs: Buff[] = [];
        for (const e of this.item.equipments) {
            if (seen.has(e.buff))
                continue;
            seen.add(e.buff);
            buffs.push(e.activeBuff ? e.activeBuff() : e.buff);
        }
        return buffs;
    }

    private collect(): VillaRowData {
        const attributes = new Map<string, VillaChip[]>();
        const additional: VillaChip[] = [];
        let consumption = 0;

        for (const a of this.attributes)
            attributes.set(a.id as string, []);

        for (const active of this.activeBuffs()) {
            for (const buff of withFunctionalBuffs(active, this.island)) {
                consumption += buff.consumptionModifierInPercent;

                for (const entry of buff.goodConsumptionUpgrade) {
                    if (entry.amountInPercent === 0)
                        continue;
                    const name = entry.product.name();
                    additional.push({
                        value: entry.amountInPercent,
                        text: signed(entry.amountInPercent) + ' %',
                        title: `${name} ${signed(entry.amountInPercent)} %`,
                        icons: [{ src: entry.product.icon, name }],
                    });
                }

                for (const attribute of this.attributes) {
                    const id = attribute.id as string;
                    const chips = attributes.get(id)!;
                    // The Population attribute of a buff and its `population` field state the same residents
                    const own = buff.attributes[id] ?? (id === 'Population' ? buff.population : 0);
                    if (own)
                        chips.push({ value: own, text: signed(own), title: `${attribute.name()} ${signed(own)}`, icons: [] });

                    for (const entry of buff.needAttributes) {
                        const value = entry.attributes[id] ?? 0;
                        if (!value)
                            continue;
                        const goods = goodsOf(entry.productGuids, this.island);
                        const names = goods.map(g => g.name).join(', ');
                        chips.push({
                            value,
                            text: signed(value),
                            title: `${names || attribute.name()} ${signed(value)}`,
                            icons: goods.map(g => ({ src: g.icon, name: g.name })),
                        });
                    }
                }
            }
        }

        return { attributes, consumption: consumption !== 0 ? consumption : undefined, additional };
    }

    /** Sum of the raw chip values of an attribute (no chip counts as 0). */
    attributeSum(id: string): number {
        return (this.data().attributes.get(id) || []).reduce((s, c) => s + c.value, 0);
    }

    /** Count of the additional effects, then the largest absolute value among them. */
    additionalSort(): [number, number] {
        const list = this.data().additional;
        return [list.length, list.reduce((m, c) => Math.max(m, Math.abs(c.value)), 0)];
    }

    /** Words the search matches: item name, good and attribute names of the chips, names of the targeted levels. */
    searchText(): string {
        const parts: string[] = [this.name()];
        const d = this.data();
        for (const chips of d.attributes.values())
            for (const c of chips) {
                parts.push(c.title);
                for (const i of c.icons)
                    parts.push(i.name);
            }
        for (const c of d.additional)
            parts.push(c.title);
        for (const l of this.levels)
            parts.push(l.name());
        return parts.join(' ').toLowerCase();
    }
}

export interface VillaRowData {
    /** need attribute id -> chips in the order of the data */
    attributes: Map<string, VillaChip[]>;
    /** flat consumption change in percent; undefined when the active variant has none */
    consumption: number | undefined;
    additional: VillaChip[];
}

/** One attribute cell of a row, in the order of window.view.needAttributes. */
export interface VillaAttributeCell {
    attribute: NamedElement;
    chips: VillaChip[];
}

export class VillaItemsViewModel {
    public search: KnockoutObservable<string>;
    public sortKey: KnockoutObservable<VillaSortKey>;
    public sortDir: KnockoutObservable<1 | -1>;
    public columns: VillaColumn[];
    public rows: KnockoutComputed<VillaItemRow[]>;
    private rowCache = new Map<Item, VillaItemRow>();

    constructor(private readonly attributes: NamedElement[]) {
        this.search = ko.observable('');
        this.sortKey = ko.observable('name');
        this.sortDir = ko.observable(1);

        const texts = () => window.view.texts;
        this.columns = [
            { key: 'state', title: () => texts().villaColState.name(), icon: undefined, withText: false },
            { key: 'name', title: () => texts().villaColItem.name(), icon: undefined, withText: false },
            { key: 'targets', title: () => texts().villaColTargets.name(), icon: '../icons/icon_house_white.png', withText: false },
            ...attributes.map((a): VillaColumn => ({ key: 'attr:' + a.id, title: () => a.name(), icon: a.icon, withText: false })),
            { key: 'consumption', title: () => texts().villaColConsumption.name(), icon: '../icons/icon_marketplace_2d_light.png', withText: false },
            { key: 'additional', title: () => texts().villaColAdditional.name(), icon: undefined, withText: true },
        ];

        this.loadSort();
        const persist = () => {
            try {
                localStorage.setItem(SORT_STORAGE_KEY, JSON.stringify({ key: this.sortKey(), dir: this.sortDir() }));
            } catch (e) {
                // storage unavailable: the order only lasts for this session
            }
        };
        this.sortKey.subscribe(persist);
        this.sortDir.subscribe(persist);

        this.rows = ko.pureComputed(() => this.buildRows());
    }

    /** Sort order stored on this device; a missing, unreadable or invalid value leaves name ascending. */
    private loadSort(): void {
        try {
            const text = localStorage.getItem(SORT_STORAGE_KEY);
            if (!text)
                return;
            const stored = JSON.parse(text);
            const valid = stored && typeof stored === 'object'
                && typeof stored.key === 'string' && this.columns.some(c => c.key === stored.key)
                && (stored.dir === 1 || stored.dir === -1);
            if (valid) {
                this.sortKey(stored.key);
                this.sortDir(stored.dir);
            }
        } catch (e) {
            // keep the default
        }
    }

    /** Direction of the first click on a column: highest first for the numeric columns (R11c). */
    firstDir(key: VillaSortKey): 1 | -1 {
        return key.startsWith('attr:') || key === 'consumption' || key === 'additional' ? -1 : 1;
    }

    sortBy(key: VillaSortKey): void {
        if (this.sortKey() === key)
            this.sortDir(this.sortDir() === 1 ? -1 : 1);
        else {
            this.sortDir(this.firstDir(key));
            this.sortKey(key);
        }
    }

    ariaSort(key: VillaSortKey): string {
        if (this.sortKey() !== key)
            return 'none';
        return this.sortDir() === 1 ? 'ascending' : 'descending';
    }

    /** The sort state of a column in words, naming what the next click does. */
    sortTitle(key: VillaSortKey): string {
        const texts = window.view.texts;
        const sort = this.ariaSort(key);
        return (sort === 'none' ? texts.villaSortNone : sort === 'ascending' ? texts.villaSortAscending : texts.villaSortDescending).name();
    }

    /** Title and accessible label of a header button: the column title and the sort state. */
    headerTitle(column: VillaColumn): string {
        return `${column.title()}. ${this.sortTitle(column.key)}`;
    }

    sortIconClass(key: VillaSortKey): string {
        const sort = this.ariaSort(key);
        return sort === 'ascending' ? 'fa fa-sort-asc' : sort === 'descending' ? 'fa fa-sort-desc' : 'fa fa-sort';
    }

    /** Cells of the attribute columns of a row, in the order of window.view.needAttributes. */
    attributeCells(row: VillaItemRow): VillaAttributeCell[] {
        const data = row.data();
        return this.attributes.map(attribute => ({ attribute, chips: data.attributes.get(attribute.id as string) || [] }));
    }

    private rowOf(item: Item, island: Island): VillaItemRow {
        let row = this.rowCache.get(item);
        if (!row) {
            row = new VillaItemRow(item, island, this.attributes);
            this.rowCache.set(item, row);
        }
        return row;
    }

    private collator(): Intl.Collator {
        const language = window.view.settings.language() as string;
        return new Intl.Collator(COLLATOR_TAGS[language] || 'en', { numeric: true });
    }

    /**
     * Rows of the selected island: filtered by the search, sorted by the active column. A new array on every
     * evaluation, iterated only inside the modal (the bootstrap arrays of the tile grid are never touched).
     */
    private buildRows(): VillaItemRow[] {
        const island: Island | undefined = window.view.island();
        if (!island)
            return [];

        const collator = this.collator();
        const search = this.search().trim().toLowerCase();
        const key = this.sortKey();
        const dir = this.sortDir();

        const rows = island.residenceItems
            .map(item => this.rowOf(item, island))
            .filter(row => !search || row.searchText().includes(search));

        const primary = (a: VillaItemRow, b: VillaItemRow): number => {
            if (key === 'state')
                return a.state() - b.state();
            if (key === 'name')
                return collator.compare(a.name(), b.name());
            if (key === 'targets')
                return (a.levels.length - b.levels.length) || (a.lowestTier() - b.lowestTier());
            if (key === 'consumption')
                return (a.data().consumption ?? 0) - (b.data().consumption ?? 0);
            if (key === 'additional') {
                const x = a.additionalSort();
                const y = b.additionalSort();
                return (x[0] - y[0]) || (x[1] - y[1]);
            }
            if (key.startsWith('attr:')) {
                const id = key.slice(5);
                return a.attributeSum(id) - b.attributeSum(id);
            }
            return 0;
        };

        return rows.sort((a, b) => (primary(a, b) * dir) || collator.compare(a.name(), b.name()));
    }

    /** Closes the open dialog and opens the villa dialog (Bootstrap has no stacked modals). */
    open(): void {
        $('.modal.show').modal('hide');
        setTimeout(() => $('#villa-items-dialog').modal('show'), 400);
    }

    /**
     * R11d: closes the villa dialog and opens the Effects dialog with the name of the island-wide effect in its
     * search field.
     */
    openEffect(row: VillaItemRow): void {
        if (!row.heroicEffect)
            return;
        window.view.effectsFilter.source('all');
        window.view.effectsFilter.search(row.heroicEffect.name());
        $('#villa-items-dialog').modal('hide');
        setTimeout(() => $('#effects-dialog').modal('show'), 400);
    }
}
