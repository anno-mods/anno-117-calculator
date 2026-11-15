import { test, expect, Page } from '@playwright/test';

// U7: import plan for discoveries, effects, settings and construction materials. The scenarios assert on the
// raw key map of planImport (globalEffects, sessionSettings, calculatorSettings, island stores) and the report.
// Stored value types follow main.ts / world.ts: effect scalings are numbers, DLC flags are "1"/"0".

const LATIUM = 3245;
const META = 37135;
const AEGYPTUS = 149679;
const SAWMILL_LATIUM = 3089;
const OBSIDIAN_GATHERING = 145095;
const OBSIDIAN_MINING = 148043;
const FERTILE_SOIL = 145099;
const NILE_FLOOD = 155616;
const BEDROCK_TECH = 37870; // repeatable, effect 82017
const BEDROCK_EFFECT = 82017;
const PLAIN_TECH = 38708; // effect 71202
const PLAIN_EFFECT = 71202;
const AREA_BUFFS = [51796, 30467, 38412, 38411];

interface Entry { kind: string; code: string; island?: string; message: string; detail?: Record<string, any> }
interface Plan {
    keyMap: Record<string, string>;
    report: { carriedThrough: Entry[]; notMapped: Entry[]; approximated: Entry[]; notProvided: Entry[] };
    problems: any[];
}

async function ready(page: Page) {
    await page.goto('/');
    await page.waitForFunction(() => window.view && window.view.island() && window.exchange);
}

function doc(extra: Record<string, any>, islands: Record<string, any>[] = [{ id: 'a', name: 'A', session: LATIUM }]): string {
    return JSON.stringify({ format: 'anno117-exchange', formatVersion: '1.0', generator: { name: 'u7-test' }, ...extra, islands });
}

async function plan(page: Page, text: string): Promise<Plan> {
    const r = await page.evaluate((t: string) => window.exchange.planImport(t), text);
    if ('error' in r) throw new Error(r.error);
    return r;
}

function part(p: Plan, key: string): Record<string, any> {
    return JSON.parse(p.keyMap[key]);
}

function codes(p: Plan): string[] {
    const r = p.report;
    return [...r.carriedThrough, ...r.notMapped, ...r.approximated, ...r.notProvided].map((e) => e.code);
}

const gk = (g: number) => `${g}.scaling`;
const sk = (s: number, g: number) => `session.${s}.effect.${g}.scaling`;

test.describe('import plan: discoveries, effects, settings, materials (U7)', () => {
    test.beforeEach(async ({ page }) => {
        await ready(page);
    });

    test('researched 37870 with count 5 writes 82017.scaling 5; researched without count writes 1 (AE19)', async ({ page }) => {
        const withCount = await plan(page, doc({ research: { researched: [BEDROCK_TECH, PLAIN_TECH], counts: { [BEDROCK_TECH]: 5 } } }));
        const g = part(withCount, 'globalEffects');
        expect(g[gk(BEDROCK_EFFECT)]).toBe(5);
        expect(g[gk(PLAIN_EFFECT)]).toBe(1);

        const noCount = await plan(page, doc({ research: { researched: [BEDROCK_TECH] } }));
        expect(part(noCount, 'globalEffects')[gk(BEDROCK_EFFECT)]).toBe(1);

        // a discovery not in the list gets no key (scale 0 is the calculator default)
        expect(gk(PLAIN_EFFECT) in part(noCount, 'globalEffects')).toBe(false);
    });

    test('a count without a researched entry still applies to the repeatable discovery', async ({ page }) => {
        const p = await plan(page, doc({ research: { researched: [], counts: { [BEDROCK_TECH]: 3 } } }));
        expect(part(p, 'globalEffects')[gk(BEDROCK_EFFECT)]).toBe(3);
    });

    test('discoveries the calculator does not know are kept in the exchange.ext and reported', async ({ page }) => {
        const p = await plan(page, doc({ research: { researched: [PLAIN_TECH, 999111], queue: [5], knowledgePerMinute: 2 } }));
        const ext = part(p, 'exchange.ext');
        expect(ext.research.unmatched).toEqual([999111]);
        expect(ext.research.queue).toEqual([5]);
        expect(ext.research.knowledgePerMinute).toBe(2);
        expect(codes(p)).toContain('research-not-mapped');
    });

    test('a specific global effect wins over research and is written as given (AE19)', async ({ page }) => {
        const p = await plan(
            page,
            doc({ research: { researched: [BEDROCK_TECH], counts: { [BEDROCK_TECH]: 5 } }, effects: { global: { [BEDROCK_EFFECT]: 2, 43620: 1 } } }),
        );
        const g = part(p, 'globalEffects');
        expect(g[gk(BEDROCK_EFFECT)]).toBe(2);
        expect(g[gk(43620)]).toBe(1);
    });

    test('a specific effect with value 0 overrides research', async ({ page }) => {
        const p = await plan(page, doc({ research: { researched: [PLAIN_TECH] }, effects: { global: { [PLAIN_EFFECT]: 0 } } }));
        expect(part(p, 'globalEffects')[gk(PLAIN_EFFECT)]).toBe(0);
    });

    test('specific obsidian effect in effects.bySession is kept next to the volcano setting; the difference is reported (CD7)', async ({ page }) => {
        const p = await plan(
            page,
            doc({
                settings: { volcano: { enabled: true, level: 5, effects: [OBSIDIAN_GATHERING, OBSIDIAN_MINING] } },
                effects: { bySession: { [LATIUM]: { [OBSIDIAN_GATHERING]: 2 } } },
            }),
        );
        const s = part(p, 'sessionSettings');
        expect(s[sk(LATIUM, OBSIDIAN_GATHERING)]).toBe(2);
        expect(s[sk(LATIUM, OBSIDIAN_MINING)]).toBe(5);
        expect(codes(p)).toContain('volcano-effects-disagree');
        // the setting itself stays in the ext (both are preserved)
        expect(part(p, 'exchange.ext').settings.volcano.level).toBe(5);
    });

    test('volcano level 5 with two unlocked effects writes 5 and 5 and 0 for Fertile Soil, in sessions 3245 and 37135', async ({ page }) => {
        const p = await plan(page, doc({ settings: { volcano: { level: 5, effects: [OBSIDIAN_GATHERING, OBSIDIAN_MINING] } } }));
        const s = part(p, 'sessionSettings');
        for (const session of [LATIUM, META]) {
            expect(s[sk(session, OBSIDIAN_GATHERING)]).toBe(5);
            expect(s[sk(session, OBSIDIAN_MINING)]).toBe(5);
            expect(s[sk(session, FERTILE_SOIL)]).toBe(0);
        }
        expect(codes(p)).not.toContain('volcano-effects-disagree');
    });

    test('a volcano that is not enabled writes 0 to its three effects in both sessions and keeps its effect list as the unlocked set', async ({ page }) => {
        const p = await plan(page, doc({ settings: { volcano: { enabled: false, level: 3, effects: [OBSIDIAN_GATHERING] } } }));
        const s = part(p, 'sessionSettings');
        for (const session of [LATIUM, META]) {
            for (const effect of [OBSIDIAN_GATHERING, OBSIDIAN_MINING, FERTILE_SOIL]) expect(s[sk(session, effect)]).toBe(0);
        }
        expect(s['volcano.unlocked']).toEqual([OBSIDIAN_GATHERING]);
        expect(part(p, 'exchange.ext').settings.volcano.level).toBe(3);

        const empty = await plan(page, doc({ settings: { volcano: { enabled: false, level: 1, effects: [] } } }));
        expect('volcano.unlocked' in part(empty, 'sessionSettings')).toBe(false);
    });

    test('a volcano scale above 5 is written as 5 and reported with the original; other effects are not clamped', async ({ page }) => {
        const p = await plan(
            page,
            doc({
                settings: { volcano: { level: 7, effects: [OBSIDIAN_GATHERING] } },
                effects: { bySession: { [LATIUM]: { [OBSIDIAN_MINING]: 9 }, [AEGYPTUS]: { [NILE_FLOOD]: 9 } } },
            }),
        );
        const s = part(p, 'sessionSettings');
        expect(s[sk(LATIUM, OBSIDIAN_GATHERING)]).toBe(5);
        expect(s[sk(LATIUM, OBSIDIAN_MINING)]).toBe(5);
        expect(s[sk(AEGYPTUS, NILE_FLOOD)]).toBe(9);
        const entry = [...p.report.approximated].find((e) => e.code === 'volcano-level-clamped')!;
        const clamped = entry.detail!.clamped as { session: number; effect: number; original: number }[];
        expect(clamped).toContainEqual({ session: LATIUM, effect: OBSIDIAN_MINING, original: 9 });
        expect(clamped).toContainEqual({ session: LATIUM, effect: OBSIDIAN_GATHERING, original: 7 });
        expect(clamped.some((c) => c.effect === NILE_FLOOD)).toBe(false);
        expect(part(p, 'exchange.ext').settings.volcano.level).toBe(7);
    });

    test('Covers AE3: durations stay in the ext; the unlocked set holds the effects above 0', async ({ page }) => {
        const p = await plan(page, doc({ settings: { volcano: { level: 5, effects: [OBSIDIAN_GATHERING, OBSIDIAN_MINING], durations: { '1': 12 } } } }));
        expect(part(p, 'exchange.ext').settings.volcano.durations).toEqual({ '1': 12 });
        expect(part(p, 'sessionSettings')['volcano.unlocked']).toEqual([OBSIDIAN_GATHERING, OBSIDIAN_MINING]);
    });

    test('the unlocked set comes from effects.bySession when the file states volcano effects there', async ({ page }) => {
        const p = await plan(
            page,
            doc({ effects: { bySession: { [LATIUM]: { [OBSIDIAN_GATHERING]: 5, [OBSIDIAN_MINING]: 5, [FERTILE_SOIL]: 0 } } } }),
        );
        expect(part(p, 'sessionSettings')['volcano.unlocked']).toEqual([OBSIDIAN_GATHERING, OBSIDIAN_MINING]);
    });

    test('seasons in average mode write 155616 in the Aegyptus session; phase mode writes nothing and reports', async ({ page }) => {
        const avg = await plan(page, doc({ settings: { seasons: { enabled: true, phase: null, unlocks: [] } } }));
        expect(part(avg, 'sessionSettings')[sk(AEGYPTUS, NILE_FLOOD)]).toBe(1);

        const phase = await plan(page, doc({ settings: { seasons: { enabled: true, mode: 'phase', phase: 'flood', unlocks: [] } } }));
        expect(sk(AEGYPTUS, NILE_FLOOD) in part(phase, 'sessionSettings')).toBe(false);
        expect(codes(phase)).toContain('seasons-phase-mode');
        expect(part(phase, 'exchange.ext').settings.seasons.phase).toBe('flood');
    });

    test('a seasons setting that disagrees with the specific 155616 effect: the effect wins and the difference is reported (CD7)', async ({ page }) => {
        const p = await plan(
            page,
            doc({ settings: { seasons: { enabled: true, phase: null } }, effects: { bySession: { [AEGYPTUS]: { [NILE_FLOOD]: 0 } } } }),
        );
        expect(part(p, 'sessionSettings')[sk(AEGYPTUS, NILE_FLOOD)]).toBe(0);
        expect(codes(p)).toContain('seasons-effect-disagree');
    });

    test('effects of an unknown session or an unknown effect are kept, not written', async ({ page }) => {
        const p = await plan(
            page,
            doc({ effects: { global: { 99999991: 1, [OBSIDIAN_GATHERING]: 1 }, bySession: { 12345: { [NILE_FLOOD]: 1 }, [LATIUM]: { 99999992: 1, [PLAIN_EFFECT]: 1 } } } }),
        );
        expect(gk(99999991) in part(p, 'globalEffects')).toBe(false);
        expect(Object.keys(part(p, 'sessionSettings'))).toEqual([]);
        const ext = part(p, 'exchange.ext');
        expect(ext.effects.global['99999991']).toBe(1);
        expect(ext.effects.global[String(OBSIDIAN_GATHERING)]).toBe(1); // session-scope effect in the global map
        expect(ext.effects.bySession['12345'][String(NILE_FLOOD)]).toBe(1);
        expect(ext.effects.bySession[String(LATIUM)]['99999992']).toBe(1);
        expect(ext.effects.bySession[String(LATIUM)][String(PLAIN_EFFECT)]).toBe(1); // global-scope effect in a session map
    });

    test('settings.dlcs writes "1" for a listed number and "0" for an unlisted one; a number outside 1-3 is preserved', async ({ page }) => {
        const p = await plan(page, doc({ settings: { dlcs: [1, 3, 7] } }));
        const c = part(p, 'calculatorSettings');
        expect(c['DLC01_Prophecies_of_Ash']).toBe('1');
        expect(c['DLC02_The_Hippodrome']).toBe('0');
        expect(c['DLC03_Dawn_of_Delta']).toBe('1');
        expect(part(p, 'exchange.ext').settings.dlcsUnknown).toEqual([7]);
        expect(codes(p)).toContain('dlcs-unknown');
        const notListed = p.report.approximated.find((e) => e.code === 'dlc-not-listed')!;
        expect(notListed.detail!.dlcs).toEqual(['DLC02_The_Hippodrome']);
    });

    test('an empty settings.dlcs writes "0" for every DLC and keeps no unknown numbers', async ({ page }) => {
        const p = await plan(page, doc({ settings: { dlcs: [] } }));
        const c = part(p, 'calculatorSettings');
        expect([c['DLC01_Prophecies_of_Ash'], c['DLC02_The_Hippodrome'], c['DLC03_Dawn_of_Delta']]).toEqual(['0', '0', '0']);
        expect(part(p, 'exchange.ext').settings?.dlcsUnknown).toBeUndefined();
    });

    test('Covers R1: a DLC number that a params.dlcs entry maps is written as a flag, not kept as unknown', async ({ page }) => {
        const p = await page.evaluate((t: string) => {
            const dlcs = window.params.dlcs;
            const original = dlcs.slice();
            dlcs.push({ ...dlcs[0], guid: 99999, id: 'DLC04_Test' });
            try {
                return window.exchange.planImport(t);
            } finally {
                dlcs.length = 0;
                dlcs.push(...original);
            }
        }, doc({ settings: { dlcs: [4] } }));
        if ('error' in p) throw new Error(p.error);
        const c = part(p as Plan, 'calculatorSettings');
        expect(c['DLC04_Test']).toBe('1');
        expect(c['DLC01_Prophecies_of_Ash']).toBe('0');
        expect(part(p as Plan, 'exchange.ext').settings?.dlcsUnknown).toBeUndefined();
    });

    test('a params.dlcs id without the number pattern is not written', async ({ page }) => {
        const p = await page.evaluate((t: string) => {
            const dlcs = window.params.dlcs;
            const original = dlcs.slice();
            dlcs.push({ ...dlcs[0], guid: 99998, id: 'Special_Pack' });
            try {
                return window.exchange.planImport(t);
            } finally {
                dlcs.length = 0;
                dlcs.push(...original);
            }
        }, doc({ settings: { dlcs: [1] } }));
        if ('error' in p) throw new Error(p.error);
        expect('Special_Pack' in part(p as Plan, 'calculatorSettings')).toBe(false);
    });

    test('a file without settings.dlcs writes no DLC key', async ({ page }) => {
        const p = await plan(page, doc({}));
        expect(Object.keys(part(p, 'calculatorSettings')).filter((k) => k.startsWith('DLC'))).toEqual([]);
    });

    test('settings.difficulty.needConsumption writes the need consumption option; an unknown id is preserved and reported', async ({ page }) => {
        const ok = await plan(page, doc({ settings: { difficulty: { needConsumption: 'High', other: 1 } } }));
        expect(part(ok, 'calculatorSettings')['settings.needConsumption']).toBe('High');
        expect(part(ok, 'exchange.ext').settings.difficulty).toEqual({ other: 1 });

        const bad = await plan(page, doc({ settings: { difficulty: { needConsumption: 'Nope' } } }));
        expect('settings.needConsumption' in part(bad, 'calculatorSettings')).toBe(false);
        expect(part(bad, 'exchange.ext').settings.difficulty).toEqual({ needConsumption: 'Nope' });
        expect(codes(bad)).toContain('need-consumption-unknown');
    });

    test('materials Timber 4 on a Latium island writes 3089 constructed 4 and fullyUtilize "1" (AE21)', async ({ page }) => {
        const timber = await page.evaluate(
            (sawmill: number) => window.exchange.tables().materials.find((m: Record<string, any>) => m.endFactories.Roman === sawmill).product,
            SAWMILL_LATIUM,
        );
        const p = await plan(page, doc({}, [{ id: 'a', name: 'A', session: LATIUM, materials: { [timber]: 4 } }]));
        const store = part(p, 'A');
        expect(store[`${SAWMILL_LATIUM}.buildings.constructed`]).toBe(4);
        expect(store[`${SAWMILL_LATIUM}.buildings.fullyUtilizeConstructed`]).toBe('1');
    });

    test('buildings entry of the end factory wins over materials; the difference is reported (R50)', async ({ page }) => {
        const timber = await page.evaluate(
            (sawmill: number) => window.exchange.tables().materials.find((m: Record<string, any>) => m.endFactories.Roman === sawmill).product,
            SAWMILL_LATIUM,
        );
        const withBuildings = await plan(
            page,
            doc({}, [{ id: 'a', name: 'A', session: LATIUM, materials: { [timber]: 4 }, buildings: { [SAWMILL_LATIUM]: { built: 2, fullyUtilize: false } } }]),
        );
        const s = part(withBuildings, 'A');
        expect(s[`${SAWMILL_LATIUM}.buildings.constructed`]).toBe(2);
        expect(s[`${SAWMILL_LATIUM}.buildings.fullyUtilizeConstructed`]).toBe('0');
        expect(codes(withBuildings)).toContain('materials-difference');

        // buildings states only the flag: materials supplies the count
        const flagOnly = await plan(
            page,
            doc({}, [{ id: 'a', name: 'A', session: LATIUM, materials: { [timber]: 4 }, buildings: { [SAWMILL_LATIUM]: { fullyUtilize: false } } }]),
        );
        const f = part(flagOnly, 'A');
        expect(f[`${SAWMILL_LATIUM}.buildings.constructed`]).toBe(4);
        expect(f[`${SAWMILL_LATIUM}.buildings.fullyUtilizeConstructed`]).toBe('0');

        // equal count: no difference, built from buildings
        const same = await plan(
            page,
            doc({}, [{ id: 'a', name: 'A', session: LATIUM, materials: { [timber]: 4 }, buildings: { [SAWMILL_LATIUM]: { built: 4 } } }]),
        );
        expect(codes(same)).not.toContain('materials-difference');
        expect(part(same, 'A')[`${SAWMILL_LATIUM}.buildings.constructed`]).toBe(4);
    });

    test('a materials entry the calculator cannot place is preserved in the island ext and reported', async ({ page }) => {
        const p = await plan(page, doc({}, [{ id: 'a', name: 'A', session: LATIUM, materials: { 424242: 3 } }]));
        expect(part(p, 'A')['exchange.ext'].materials).toEqual({ 424242: 3 });
        expect(codes(p)).toContain('materials-not-mapped');
    });

    test('research.basis absent means researched; "applied" marks the lists as settings (R44); the keys are the same', async ({ page }) => {
        const absent = await plan(page, doc({ research: { researched: [PLAIN_TECH] } }));
        expect(codes(absent)).not.toContain('research-basis-applied');
        const applied = await plan(page, doc({ research: { basis: 'applied', researched: [PLAIN_TECH] } }));
        expect(codes(applied)).toContain('research-basis-applied');
        expect(part(applied, 'globalEffects')).toEqual(part(absent, 'globalEffects'));
        const researched = await plan(page, doc({ research: { basis: 'researched', researched: [PLAIN_TECH] } }));
        expect(codes(researched)).not.toContain('research-basis-applied');
    });

    test('no area-buff key is written for any input (KTD10)', async ({ page }) => {
        const p = await plan(
            page,
            doc(
                {
                    research: { researched: [PLAIN_TECH, BEDROCK_TECH, 28285, 37863, 37858, 38446] },
                    effects: { global: Object.fromEntries(AREA_BUFFS.map((g) => [g, 1])), bySession: { [LATIUM]: Object.fromEntries(AREA_BUFFS.map((g) => [g, 1])) } },
                    settings: { volcano: { level: 5, effects: [OBSIDIAN_GATHERING] } },
                },
                [{ id: 'a', name: 'A', session: LATIUM, effects: Object.fromEntries(AREA_BUFFS.map((g) => [g, 1])) }],
            ),
        );
        const written = [part(p, 'globalEffects'), part(p, 'sessionSettings'), part(p, 'calculatorSettings'), part(p, 'A')];
        for (const map of written) {
            for (const key of Object.keys(map)) {
                for (const g of AREA_BUFFS) expect(key).not.toContain(String(g));
            }
        }
        // the supplied values are kept verbatim in the ext
        const ext = part(p, 'exchange.ext');
        for (const g of AREA_BUFFS) expect(ext.effects.global[String(g)]).toBe(1);
        expect(codes(p)).toContain('area-buff-ignored');
    });

    // ---- Modifiers: global effects, unknown GUIDs, range effects, wonders (U9) ----

    const BAKERY = 3174;
    const RANGE_EFFECT = 174824; // building effect with per-building state, DLC 67903
    const effectKey = (type: number, effect: number) => `${type}[${effect}].scaling`;
    const oneIsland = (extra: Record<string, any>) => [{ id: 'a', name: 'A', session: LATIUM, ...extra }];

    test('Covers R23: a global effect that no researched discovery derives is applied as stated', async ({ page }) => {
        const p = await plan(page, doc({ research: { researched: [] }, effects: { global: { 43620: 1, [PLAIN_EFFECT]: 1 } } }));
        const g = part(p, 'globalEffects');
        expect(g[gk(43620)]).toBe(1);
        expect(g[gk(PLAIN_EFFECT)]).toBe(1);
    });

    test('Covers R24: an unknown global effect is kept in the ext and not written', async ({ page }) => {
        const p = await plan(page, doc({ effects: { global: { 999001: 1 } } }));
        expect(gk(999001) in part(p, 'globalEffects')).toBe(false);
        expect(part(p, 'exchange.ext').effects.global['999001']).toBe(1);
        expect(codes(p)).toContain('unknown-guid');
    });

    test('effect 183157 (Meta scope, island event, listed by no discovery) is applied when the file states it and is never derived', async ({ page }) => {
        // The two candidate causes of the missing effect in the Marcia files: neither holds. The GUID classifies as a writable
        // global effect and is no dormant area buff; no discovery lists it, so nothing can derive it from research.
        const stated = await plan(page, doc({ effects: { global: { 183157: 1 } } }));
        expect(part(stated, 'globalEffects')[gk(183157)]).toBe(1);
        const researched = await page.evaluate(() => (window.params.techs as { effects: number[] }[]).some((t) => t.effects.includes(183157)));
        expect(researched).toBe(false);
        expect(AREA_BUFFS).not.toContain(183157);
    });

    test('Covers R25: appliedEffects writes 1 or 0 to the per-building state, notes the DLC, wins over factories[].effects and stays kept', async ({ page }) => {
        const off = await plan(page, doc({}, oneIsland({ factories: { [BAKERY]: { effects: [RANGE_EFFECT] } }, appliedEffects: [{ type: BAKERY, effect: RANGE_EFFECT, applied: false, share: 1, method: 'x', scale: 1 }] })));
        expect(part(off, 'A')[effectKey(BAKERY, RANGE_EFFECT)]).toBe(0);
        const on = await plan(page, doc({}, oneIsland({ appliedEffects: [{ type: BAKERY, effect: RANGE_EFFECT, applied: true }] })));
        expect(part(on, 'A')[effectKey(BAKERY, RANGE_EFFECT)]).toBe(1);
        expect(codes(on)).toContain('dlc-enabled');
        const kept = part(on, 'A')['exchange.ext'].captured.find((c: Record<string, any>) => c.pointer === '/appliedEffects');
        expect(kept.value[0].effect).toBe(RANGE_EFFECT);
    });

    test('Covers R25: a fractional share is applied by the flag and approximated; entries without per-building state write nothing', async ({ page }) => {
        const half = await plan(page, doc({}, oneIsland({ appliedEffects: [{ type: BAKERY, effect: RANGE_EFFECT, applied: true, share: 0.5 }] })));
        expect(part(half, 'A')[effectKey(BAKERY, RANGE_EFFECT)]).toBe(1);
        expect(codes(half)).toContain('applied-effect-approximated');

        const none = await plan(
            page,
            doc({}, oneIsland({
                appliedEffects: [
                    { type: BAKERY, effect: 51635, applied: true }, // not an effect of the data
                    { type: 3087, effect: RANGE_EFFECT, applied: true }, // a residence is no target
                    { type: BAKERY, effect: 145095, applied: true }, // obsidian gathering has no per-building state
                ],
            })),
        );
        expect(Object.keys(part(none, 'A')).filter((k) => k.includes('[') && k.endsWith('.scaling'))).toEqual([]);
        expect(codes(none).filter((c) => c === 'applied-effect-not-applied').length).toBe(3);
    });

    test('Covers R26, AE9: wonders are kept at their pointer, no wonder effect is stored, and Modifiers unticked keeps the stored part', async ({ page }) => {
        const wonders = { 3621: { rank: 3, coverage: 80 }, 152714: { rank: 1 } };
        const text = doc({}, oneIsland({ wonders }));
        const p = await plan(page, text);
        const s = part(p, 'A');
        expect(s['exchange.ext'].captured.find((c: Record<string, any>) => c.pointer === '/wonders').value).toEqual(wonders);
        expect(Object.keys(s).filter((k) => k.startsWith('island.effect.'))).toEqual([]);

        // unticked Modifiers: the stored ext part stays (merge over a stored island that holds other wonders)
        const merged = await page.evaluate(
            ({ t }) => {
                const ex = window.exchange;
                const full = ex.planImport(t);
                if ('error' in full) throw new Error(full.error);
                const stored = { A: JSON.stringify({ 'exchange.ext': { originalName: 'A', captured: [{ pointer: '/wonders', kind: 'unmodelled', value: { 3621: { rank: 9 } } }], guids: [], moduleWritten: {} } }) };
                const none = { islands: false, residences: true, production: false, trade: false, modifiers: false, keepIslands: false, keepRoutes: false, recalcRoutes: false };
                const m = ex.mergeScoped(stored, full, none as never, [{ fileId: 'a', calcName: 'A', by: 'name' }]);
                return JSON.parse(m.keyMap['A'])['exchange.ext'].captured;
            },
            { t: text },
        );
        expect(merged.find((c: Record<string, any>) => c.pointer === '/wonders').value).toEqual({ 3621: { rank: 9 } });
    });});
