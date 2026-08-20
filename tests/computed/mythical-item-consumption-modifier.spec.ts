import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';

// Verifies the ResidenceNeed.amount() formula (src/consumption.ts) folds in each active
// AppliedBuff's consumptionModifierInPercent() plus any goodConsumptionUpgrade() entry whose
// product matches the need's product. No real buff in params.js drives this via
// availableEffects().scaling(1) (the only goodConsumptionUpgrade buff, 160085, is delivered by
// an item, not an island effect - see mythical-item-buff-fields.spec.ts), so we isolate the
// formula by pushing a synthetic AppliedBuff-shaped object directly onto a REAL residence's REAL
// buffs() observable array and reading the REAL need.amount() computed.
test.describe('Consumption modifier wiring (mythical items)', () => {
    const LATIUM_SESSION = 3245;

    // Liberti Residence (Latium), "Residence Roman 01 Peasants" - see tests/AGENTS.md GUID table.
    const LIBERTI_RESIDENCE_GUID = 3087;

    // Need Roman Food Bread -> needProduct 2137 (Bread). Part of LIBERTI_RESIDENCE_GUID's needsList,
    // but only as a conditional need gated behind the Amphitheatre Splendour IV effect (159339). We
    // activate that effect in beforeEach so Bread is actually consumed; the consumption-modifier wiring
    // under test is independent of gating.
    const BREAD_NEED_GUID = 2689;
    const BREAD_PRODUCT_GUID = 2137;
    const AMPHITHEATRE_IV_EFFECT_GUID = 159339; // gates the Bread need on Liberti

    // Need Roman Fashion Tunics -> needProduct 2141 (unrelated product). Also part of
    // LIBERTI_RESIDENCE_GUID's needsList; used as a control to prove per-product matching.
    const CONTROL_NEED_GUID = 2768;

    test.beforeEach(async ({ page }) => {
        const configLoader = new ConfigLoader();
        const config = configLoader.createFullConfig([
            {
                name: 'Latium',
                session: LATIUM_SESSION,
                data: {
                    "3087.buildings.constructed": "100"
                }
            }
        ]);
        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());

        // Activate the Amphitheatre effect so the gated Bread need is consumed by Liberti.
        await page.evaluate((effectGuid) => {
            (window as any).view.island().assetsMap.get(effectGuid).scaling(1);
        }, AMPHITHEATRE_IV_EFFECT_GUID);
    });

    test('a buff with consumptionModifierInPercent scales every need amount', async ({ page }) => {
        const before = await page.evaluate(({ residenceGuid, needGuid }) => {
            const island = (window as any).view.island();
            const residence = island.assetsMap.get(residenceGuid);
            const need = residence.needsMap.get(needGuid);
            return need.amount();
        }, { residenceGuid: LIBERTI_RESIDENCE_GUID, needGuid: BREAD_NEED_GUID });

        expect(before).toBeGreaterThan(0);

        const after = await page.evaluate(({ residenceGuid, needGuid }) => {
            const island = (window as any).view.island();
            const residence = island.assetsMap.get(residenceGuid);
            const need = residence.needsMap.get(needGuid);

            const fakeBuff = {
                // ResidenceBuilding.residents (population.ts) is an eager ko.computed subscribed to
                // buffs() that reads b.buff.population unconditionally, so the synthetic buff needs a
                // minimal `buff` stub even though this test only exercises consumptionModifierInPercent.
                buff: { population: 0 },
                consumptionModifierInPercent: () => -25,
                goodConsumptionUpgrade: () => [],
            };
            residence.buffs.push(fakeBuff);
            const amount = need.amount();
            residence.buffs.remove(fakeBuff);
            return amount;
        }, { residenceGuid: LIBERTI_RESIDENCE_GUID, needGuid: BREAD_NEED_GUID });

        expect(after).toBeCloseTo(before * 0.75, 3);

        // Confirm the synthetic buff was actually removed and amount() is back to baseline.
        const restored = await page.evaluate(({ residenceGuid, needGuid }) => {
            const island = (window as any).view.island();
            const residence = island.assetsMap.get(residenceGuid);
            const need = residence.needsMap.get(needGuid);
            return need.amount();
        }, { residenceGuid: LIBERTI_RESIDENCE_GUID, needGuid: BREAD_NEED_GUID });

        expect(restored).toBeCloseTo(before, 3);
    });

    test('a goodConsumptionUpgrade entry only affects the matching product need', async ({ page }) => {
        const baseline = await page.evaluate(({ residenceGuid, breadNeedGuid, controlNeedGuid }) => {
            const island = (window as any).view.island();
            const residence = island.assetsMap.get(residenceGuid);
            const breadNeed = residence.needsMap.get(breadNeedGuid);
            const controlNeed = residence.needsMap.get(controlNeedGuid);
            return {
                bread: breadNeed.amount(),
                control: controlNeed.amount(),
            };
        }, { residenceGuid: LIBERTI_RESIDENCE_GUID, breadNeedGuid: BREAD_NEED_GUID, controlNeedGuid: CONTROL_NEED_GUID });

        expect(baseline.bread).toBeGreaterThan(0);
        expect(baseline.control).toBeGreaterThan(0);

        const withBuff = await page.evaluate(({ residenceGuid, breadNeedGuid, controlNeedGuid, breadProductGuid }) => {
            const island = (window as any).view.island();
            const residence = island.assetsMap.get(residenceGuid);
            const breadNeed = residence.needsMap.get(breadNeedGuid);
            const controlNeed = residence.needsMap.get(controlNeedGuid);
            const breadProduct = island.assetsMap.get(breadProductGuid);

            const fakeBuff = {
                // See note above: minimal `buff` stub required by ResidenceBuilding.residents.
                buff: { population: 0 },
                consumptionModifierInPercent: () => 0,
                goodConsumptionUpgrade: () => [{ product: breadProduct, amountInPercent: -20 }],
            };
            residence.buffs.push(fakeBuff);
            const result = {
                bread: breadNeed.amount(),
                control: controlNeed.amount(),
            };
            residence.buffs.remove(fakeBuff);
            return result;
        }, {
            residenceGuid: LIBERTI_RESIDENCE_GUID,
            breadNeedGuid: BREAD_NEED_GUID,
            controlNeedGuid: CONTROL_NEED_GUID,
            breadProductGuid: BREAD_PRODUCT_GUID,
        });

        // Bread need drops 20% because the entry's product matches.
        expect(withBuff.bread).toBeCloseTo(baseline.bread * 0.8, 3);
        // Non-Bread need is untouched because the entry's product does not match.
        expect(withBuff.control).toBeCloseTo(baseline.control, 3);

        // Confirm removal restored both needs to baseline.
        const restored = await page.evaluate(({ residenceGuid, breadNeedGuid, controlNeedGuid }) => {
            const island = (window as any).view.island();
            const residence = island.assetsMap.get(residenceGuid);
            const breadNeed = residence.needsMap.get(breadNeedGuid);
            const controlNeed = residence.needsMap.get(controlNeedGuid);
            return {
                bread: breadNeed.amount(),
                control: controlNeed.amount(),
            };
        }, { residenceGuid: LIBERTI_RESIDENCE_GUID, breadNeedGuid: BREAD_NEED_GUID, controlNeedGuid: CONTROL_NEED_GUID });

        expect(restored.bread).toBeCloseTo(baseline.bread, 3);
        expect(restored.control).toBeCloseTo(baseline.control, 3);
    });
});
