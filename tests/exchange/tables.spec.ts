import { test, expect, Page } from '@playwright/test';

// U3: static mapping tables (storage keys, discoveries, materials, mythical-item effects, item/effect classifier).

async function ready(page: Page) {
    await page.goto('/');
    await page.waitForFunction(() => window.view && window.view.island() && window.exchange);
}

// Storage writes are debounced with setTimeout(0); wait until they are flushed.
async function flush(page: Page) {
    await page.evaluate(() => new Promise<void>((r) => setTimeout(() => setTimeout(r, 20), 20)));
}

const AREA_BUFFS = [51796, 30467, 38412, 38411];

test.describe('discoveries table (U3)', () => {
    test('all 16 techs resolve to existing effects, only 37870 is repeatable', async ({ page }) => {
        await ready(page);
        const r = await page.evaluate(() => {
            const t = window.exchange.tables();
            const known = new Set(window.params.effects.map((e: Record<string, any>) => e.guid));
            return {
                count: t.discoveries.length,
                missing: t.discoveries.flatMap((d: Record<string, any>) => d.effects).filter((g: number) => !known.has(g)),
                empty: t.discoveries.filter((d: Record<string, any>) => d.effects.length === 0).map((d: Record<string, any>) => d.tech),
                repeatable: t.discoveries.filter((d: Record<string, any>) => d.repeatable).map((d: Record<string, any>) => d.tech),
            };
        });
        expect(r.count).toBe(16);
        expect(r.missing).toEqual([]);
        expect(r.empty).toEqual([]);
        expect(r.repeatable).toEqual([37870]);
    });

    test('specific effects: session and global lists, area buffs never writable', async ({ page }) => {
        await ready(page);
        const t = await page.evaluate(() => window.exchange.tables());
        for (const g of [155616, 145095, 148043, 145099]) expect(t.specificEffects.session).toContain(g);
        expect(t.specificEffects.global).toContain(43620);
        expect(t.specificEffects.neverWritable.slice().sort()).toEqual(AREA_BUFFS.slice().sort());
        for (const g of AREA_BUFFS) {
            expect(t.writableEffects).not.toContain(g);
            expect(t.specificEffects.session).not.toContain(g);
            expect(t.specificEffects.global).not.toContain(g);
            expect(t.discoveries.flatMap((d: Record<string, any>) => d.effects)).not.toContain(g);
        }
        // the writable set holds every discovery effect and every specific effect
        for (const d of t.discoveries) for (const g of d.effects) expect(t.writableEffects).toContain(g);
        for (const g of [155616, 145095, 148043, 145099, 43620]) expect(t.writableEffects).toContain(g);
    });
});

test.describe('materials table (U3)', () => {
    test('13 materials, end factory per available region, Timber/Sawmill GUIDs', async ({ page }) => {
        await ready(page);
        const r = await page.evaluate(() => {
            const t = window.exchange.tables();
            const p = window.params;
            const expected = p.products.filter((x: Record<string, any>) => x.isConstructionMaterial);
            const problems: string[] = [];
            for (const prod of expected) {
                const m = t.materials.find((x: Record<string, any>) => x.product === prod.guid);
                if (!m) { problems.push('missing material ' + prod.guid); continue; }
                for (const region of prod.associatedRegions || []) {
                    const f = m.endFactories[region];
                    if (f === undefined) { problems.push(prod.guid + ' no factory in ' + region); continue; }
                    const fc = p.factories.find((x: Record<string, any>) => x.guid === f);
                    if (!fc || !fc.outputs.some((o: Record<string, any>) => o.product === prod.guid) || !fc.associatedRegions.includes(region))
                        problems.push(prod.guid + ' wrong factory ' + f + ' for ' + region);
                }
            }
            return { count: t.materials.length, problems, timber: t.materials.find((x: Record<string, any>) => x.product === 2174) };
        });
        expect(r.count).toBe(13);
        expect(r.problems).toEqual([]);
        expect(r.timber.endFactories).toEqual({ Roman: 3089, Celtic: 5945, Egyptian: 152803 });
    });
});

test.describe('mythical-item effects and classifier (U3)', () => {
    test('mythical-item table lists the effects with source mythical-item and their DLC', async ({ page }) => {
        await ready(page);
        const r = await page.evaluate(() => {
            const t = window.exchange.tables();
            const expected = window.params.effects.filter((e: Record<string, any>) => e.source === 'mythical-item');
            return {
                got: t.mythicalItemEffects.map((e: Record<string, any>) => e.effect).sort((a: number, b: number) => a - b),
                want: expected.map((e: Record<string, any>) => e.guid).sort((a: number, b: number) => a - b),
                dlc: t.mythicalItemEffects.find((e: Record<string, any>) => e.effect === 185132),
            };
        });
        expect(r.got.length).toBeGreaterThan(0);
        expect(r.got).toEqual(r.want);
        expect(r.dlc.dlcUnlocks).toEqual([67904]);
    });

    test('classifier distinguishes an item key from an effect key', async ({ page }) => {
        await ready(page);
        const r = await page.evaluate(() => {
            const ex = window.exchange;
            const p = window.params;
            const item = p.items[0].guid;
            const effect = p.effects.find((e: Record<string, any>) => e.source === 'mythical-item').guid;
            return {
                item: ex.classifyItemOrEffect(item),
                effect: ex.classifyItemOrEffect(effect),
                unknown: ex.classifyItemOrEffect(1),
                itemKey: ex.keys.factoryItemScaling(3089, item),
                parsedItem: ex.parseFactoryScalingKey(`3089[${item}].scaling`),
                parsedEffect: ex.parseFactoryScalingKey(`3089[${effect}].scaling`),
                parsedOther: ex.parseFactoryScalingKey('3089.aqueductBuff.checked'),
                item0: item,
                effect0: effect,
            };
        });
        expect(r.item).toBe('item');
        expect(r.effect).toBe('effect');
        expect(r.unknown).toBe('unknown');
        expect(r.itemKey).toBe(`3089[${r.item0}].scaling`);
        expect(r.parsedItem).toEqual({ target: 3089, guid: r.item0, kind: 'item' });
        expect(r.parsedEffect).toEqual({ target: 3089, guid: r.effect0, kind: 'effect' });
        expect(r.parsedOther).toBeNull();
    });
});

test.describe('storage key builders (U3)', () => {
    test('builders match the keys the app writes', async ({ page }) => {
        await ready(page);
        const guids = await page.evaluate(() => {
            const view = window.view;
            const island = view.island();
            const prod = island.products[0];
            const level = island.populationLevels[0];
            const need = level.needs[0];
            const residence = island.residenceBuildings[0];
            return { island: island.name(), product: prod.guid, level: level.guid, need: need.need.guid, residence: residence.guid };
        });
        await page.evaluate((g) => {
            const view = window.view;
            const island = view.island();
            island.residenceBuildings[0].buildings.constructed(7);
            island.residenceBuildings[0].buildings.planned(9);
            island.products[0].notes('hello');
            island.populationLevels[0].needs[0].notes('nn');
            island.populationLevels[0].needs[0].checked(false);
        }, guids);
        await flush(page);
        const r = await page.evaluate((g) => {
            const k = window.exchange.keys;
            const store = JSON.parse(localStorage.getItem(g.island) || '{}');
            return {
                constructedKey: k.buildingsConstructed(g.residence), plannedKey: k.buildingsPlanned(g.residence),
                util: k.buildingsFullyUtilize(g.residence), productNotes: k.productNotes(g.product),
                needNotes: k.needNotes(g.level, g.need), needChecked: k.needChecked(g.level, g.need),
                keys: Object.keys(store),
                supplierType: k.defaultSupplierType(g.product), supplierId: k.defaultSupplierId(g.product),
                session: k.sessionEffectScaling(3245, 155616), global: k.globalEffectScaling(43620),
                islandEffect: k.islandEffectScaling(5), fert: k.islandFertilityChecked(9),
                aq: k.aqueductChecked(3089), mod: k.moduleChecked(3089, 4),
                effScaling: k.factoryEffectScaling(3089, 8), gc: [k.gameConnectorIslandId, k.gameConnectorAreaIndex],
            };
        }, guids);
        expect(r.keys).toContain(r.constructedKey);
        expect(r.keys).toContain(r.plannedKey);
        expect(r.keys).toContain(r.productNotes);
        expect(r.keys).toContain(r.needNotes);
        expect(r.keys).toContain(r.needChecked);
        expect(r.constructedKey).toBe(`${guids.residence}.buildings.constructed`);
        expect(r.util).toBe(`${guids.residence}.buildings.fullyUtilizeConstructed`);
        expect(r.supplierType).toBe(`${guids.product}.defaultSupplier.type`);
        expect(r.supplierId).toBe(`${guids.product}.defaultSupplier.id`);
        expect(r.session).toBe('session.3245.effect.155616.scaling');
        expect(r.global).toBe('global.effect.43620.scaling');
        expect(r.islandEffect).toBe('island.effect.5.scaling');
        expect(r.fert).toBe('island.fertility.9.checked');
        expect(r.aq).toBe('3089.aqueductBuff.checked');
        expect(r.mod).toBe('3089.module[4].checked');
        expect(r.effScaling).toBe('3089[8].scaling');
        expect(r.gc).toEqual(['gameConnector.islandID', 'gameConnector.areaIndex']);
    });
});
