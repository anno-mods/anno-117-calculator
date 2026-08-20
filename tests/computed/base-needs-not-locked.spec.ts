import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';

// Regression guard for the mythical-item "additional need" feature. That feature introduced need
// gating (PopulationLevelNeed.hidden via requiresItem): a need can be hidden until its unlocking
// effect is active. Genuine base-game *consumption* must NEVER be locked at startup - if a residence
// tier eats a good ungated in the base game, that good stays always-available in full params.js.
//
// IMPORTANT: a need GUID being defined in the base game does NOT mean every tier consumes it ungated.
// The same need can be genuine base consumption for one tier (ungated) yet a conditional
// additionalNeedsDemand need for another (gated behind a monument/mythical-item effect). Bread (2689)
// is the canonical example: eaten ungated by Plebeians/Equites but only added to Liberti by the
// Amphitheatre monument. So we key the guard on per-residence UNGATED base consumption, not on need
// GUIDs alone - otherwise a legitimately-gated tier trips a false positive.
test.describe('Base-game needs are never locked at startup', () => {
    const LATIUM_SESSION = 3245; // Roman - base game
    const ALBION_SESSION = 6627; // Celtic - base game

    // Parse js/params-base.js (`if(window.params == null)window.params={...}`) in an isolated VM
    // context and return, per residence GUID, the set of need GUIDs it consumes UNGATED (no
    // requiresItem) - i.e. genuine base consumption for that tier.
    function loadBaseUngatedNeedsByResidence(): Map<number, Set<number>> {
        const src = fs.readFileSync(path.resolve(__dirname, '../../js/params-base.js'), 'utf8');
        const sandbox: any = { window: {} };
        vm.runInNewContext(src, sandbox);
        const residences = (sandbox.window.params && sandbox.window.params.residenceBuildings) || [];
        const byResidence = new Map<number, Set<number>>();
        for (const residence of residences) {
            const ungated = new Set<number>();
            for (const need of (residence.needsList || [])) {
                if (need.requiresItem === undefined) {
                    ungated.add(need.need);
                }
            }
            if (ungated.size > 0) {
                byResidence.set(residence.guid, ungated);
            }
        }
        return byResidence;
    }

    test('no base-game consumption is hidden on a fresh Latium + Albion world', async ({ page }) => {
        const baseUngated = Array.from(loadBaseUngatedNeedsByResidence().entries())
            .map(([residenceGuid, needs]) => [residenceGuid, Array.from(needs)] as [number, number[]]);
        expect(baseUngated.length).toBeGreaterThan(0);

        const configLoader = new ConfigLoader();
        const config = configLoader.createFullConfig([
            { name: 'Latium', session: LATIUM_SESSION, data: {} },
            { name: 'Albion', session: ALBION_SESSION, data: {} },
        ]);
        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());

        // For each residence that eats a good ungated in the base game, assert the corresponding
        // population-level need is not hidden at startup (before any effect is toggled).
        const lockedBaseNeeds = await page.evaluate((baseUngatedPairs: [number, number[]][]) => {
            const view = (window as any).view;
            const locked: { islandName: string; residenceGuid: number; needGuid: number }[] = [];
            let checked = 0;

            for (const island of view.islands()) {
                for (const [residenceGuid, needGuids] of baseUngatedPairs) {
                    const residence = island.assetsMap.get(residenceGuid);
                    if (!residence || !residence.populationLevel) continue;
                    for (const needGuid of needGuids) {
                        const populationLevelNeed = residence.populationLevel.getNeed(needGuid);
                        if (!populationLevelNeed) continue;
                        checked++;
                        if (populationLevelNeed.hidden()) {
                            locked.push({ islandName: island.name, residenceGuid, needGuid });
                        }
                    }
                }
            }
            return { locked, checked };
        }, baseUngated);

        // Sanity: we actually exercised some base needs (otherwise the assertion is vacuous).
        expect(lockedBaseNeeds.checked).toBeGreaterThan(0);
        expect(lockedBaseNeeds.locked).toEqual([]);
    });
});
