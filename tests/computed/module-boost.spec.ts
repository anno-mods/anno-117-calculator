import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers';

/**
 * Tests for module boost/buff application
 *
 * Validates that modules correctly apply productivity buffs to their parent factory.
 *
 * Test case: Sheep Farm (guid 2786) with Silo module (guid 77954)
 * - Silo module provides buff 77960 with +100% productivity upgrade
 * - When module is checked, factory boost should be 2.0 (100% increase)
 * - When module is unchecked, factory boost should return to 1.0 (base)
 */

test.describe('Module Boost Application', () => {
    test('sheep farm silo module applies +100% productivity boost', async ({ page }) => {
        const configLoader = new ConfigLoader();

        // Create config with sheep farm having 5 constructed buildings
        const config = configLoader.createIslandConfig("Latium", 3245, {
            "2786.buildings.constructed": "5",
            "2786.buildings.fullyUtilizeConstructed": "1"
        });

        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const sheepFarmGuid = 2786;
        const siloModuleGuid = 77954;
        const siloBuffGuid = 77960;

        await page.waitForTimeout(500);

        // Get initial state (module unchecked)
        const initialState = await page.evaluate((args) => {
            const island = window.view.island();
            const factory = island.factories.find((f: any) => f.guid === args.factoryGuid);
            const module = factory?.modules[0];

            // Find the applied buff from the module
            const moduleAppliedBuff = factory?.buffs().find((b: any) =>
                b.parent === module && b.buff?.guid === args.buffGuid
            );

            return {
                factoryGuid: factory?.guid,
                factoryBoost: factory?.boost(),
                factoryBuffsCount: factory?.buffs().length || 0,
                moduleGuid: module?.guid,
                moduleChecked: module?.checked(),
                moduleBuffsCount: module?.triggeredBuffs?.length || 0,
                appliedBuffExists: !!moduleAppliedBuff,
                appliedBuffScaling: moduleAppliedBuff?.scaling?.() ?? null,
                appliedBuffProductivity: moduleAppliedBuff?.productivityUpgrade?.() ?? null
            };
        }, { factoryGuid: sheepFarmGuid, buffGuid: siloBuffGuid });

        console.log('Initial state (module unchecked):', initialState);

        // Verify module exists and buff is created but not applied
        expect(initialState.factoryGuid).toBe(sheepFarmGuid);
        expect(initialState.moduleGuid).toBe(siloModuleGuid);
        expect(initialState.moduleChecked).toBe(false);
        expect(initialState.appliedBuffExists).toBe(true); // Buff should be created

        // Check factory boost - should be 1.0 (no boost) when module unchecked
        expect(initialState.factoryBoost).toBe(1.0);

        // Check the module (equip it)
        await page.evaluate((factoryGuid) => {
            const island = window.view.island();
            const factory = island.factories.find((f: any) => f.guid === factoryGuid);
            const module = factory?.modules[0];
            if (module) {
                module.checked(true);
            }
        }, sheepFarmGuid);

        await page.waitForTimeout(200);

        // Get state after checking module
        const checkedState = await page.evaluate((args) => {
            const island = window.view.island();
            const factory = island.factories.find((f: any) => f.guid === args.factoryGuid);
            const module = factory?.modules[0];

            // Find the applied buff from the module
            const moduleAppliedBuff = factory?.buffs().find((b: any) =>
                b.parent === module && b.buff?.guid === args.buffGuid
            );

            return {
                factoryBoost: factory?.boost(),
                factoryThroughput: factory?.throughput(),
                factoryThroughputByExisting: factory?.throughputByExistingBuildings(),
                moduleChecked: module?.checked(),
                moduleConstructed: module?.buildings.constructed(),
                moduleThroughput: module?.throughput(),
                appliedBuffExists: !!moduleAppliedBuff,
                appliedBuffScaling: moduleAppliedBuff?.scaling?.() ?? null,
                appliedBuffProductivity: moduleAppliedBuff?.productivityUpgrade?.() ?? null,
                // Debug: Check all buff scalings
                allBuffScalings: factory?.buffs().map((b: any) => ({
                    parentType: b.parent?.constructor?.name,
                    parentGuid: b.parent?.guid,
                    effectGuid: b.buff?.guid,
                    scaling: b.scaling?.(),
                    productivity: b.productivityUpgrade?.()
                }))
            };
        }, { factoryGuid: sheepFarmGuid, buffGuid: siloBuffGuid });

        console.log('After checking module:', checkedState);

        // Verify module is checked
        expect(checkedState.moduleChecked).toBe(true);

        // Verify buff scaling is active (should be 1.0 when checked)
        expect(checkedState.appliedBuffExists).toBe(true);
        console.log('Applied buff scaling:', checkedState.appliedBuffScaling);
        console.log('Applied buff productivity:', checkedState.appliedBuffProductivity);

        // The buff should provide +100% productivity
        expect(checkedState.appliedBuffProductivity).toBe(100);

        // CRITICAL: Factory boost should be 2.0 (base 1.0 + 100% from module)
        // According to the productivity system:
        // - Module buffs are additive: boost += 1
        // - With +100% productivity: boost = 1.0 * 1 = 2.0
        expect(checkedState.factoryBoost).toBe(2.0);

        // Verify throughput increases with boost
        // Base throughput = 5 buildings * 60 / 30 cycleTime = 10
        // With 2x boost = 10 * 2 = 20
        const expectedThroughput = 5 * 60 / 30; // Base: 10
        const expectedBoostedThroughput = expectedThroughput * 2.0; // Boosted: 20
        expect(checkedState.factoryThroughput).toBeCloseTo(expectedBoostedThroughput, 2);

        // Uncheck the module
        await page.evaluate((factoryGuid) => {
            const island = window.view.island();
            const factory = island.factories.find((f: any) => f.guid === factoryGuid);
            const module = factory?.modules[0];
            if (module) {
                module.checked(false);
            }
        }, sheepFarmGuid);

        await page.waitForTimeout(200);

        // Verify boost returns to 1.0
        const uncheckedState = await page.evaluate((args) => {
            const island = window.view.island();
            const factory = island.factories.find((f: any) => f.guid === args.factoryGuid);
            const module = factory?.modules[0];

            const moduleAppliedBuff = factory?.buffs().find((b: any) =>
                b.parent === module && b.buff?.guid === args.buffGuid
            );

            return {
                factoryBoost: factory?.boost(),
                moduleChecked: module?.checked(),
                appliedBuffScaling: moduleAppliedBuff?.scaling?.() ?? null
            };
        }, { factoryGuid: sheepFarmGuid, buffGuid: siloBuffGuid });

        console.log('After unchecking module:', uncheckedState);

        expect(uncheckedState.moduleChecked).toBe(false);
        expect(uncheckedState.factoryBoost).toBe(1.0); // Boost should return to base
    });

    test('module buff scaling is controlled by module checked state', async ({ page }) => {
        const configLoader = new ConfigLoader();

        const config = configLoader.createIslandConfig("Latium", 3245, {
            "2786.buildings.constructed": "3"
        });

        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const sheepFarmGuid = 2786;
        const siloBuffGuid = 77960;

        await page.waitForTimeout(500);

        // Check the module
        await page.evaluate((factoryGuid) => {
            const island = window.view.island();
            const factory = island.factories.find((f: any) => f.guid === factoryGuid);
            const module = factory?.modules[0];
            module?.checked(true);
        }, sheepFarmGuid);

        await page.waitForTimeout(100);

        // Get buff scaling when checked
        const checkedScaling = await page.evaluate((args) => {
            const island = window.view.island();
            const factory = island.factories.find((f: any) => f.guid === args.factoryGuid);
            const module = factory?.modules[0];
            const appliedBuff = factory?.buffs().find((b: any) =>
                b.parent === module && b.buff?.guid === args.buffGuid
            );

            return {
                moduleChecked: module?.checked(),
                buffScaling: appliedBuff?.scaling?.() ?? null,
                isModuleBuff: factory?.isModuleBuff?.(appliedBuff) ?? null
            };
        }, { factoryGuid: sheepFarmGuid, buffGuid: siloBuffGuid });

        console.log('Module checked - buff scaling:', checkedScaling);

        // When module is checked, buff scaling should be 1.0 (fully active)
        expect(checkedScaling.moduleChecked).toBe(true);
        expect(checkedScaling.buffScaling).toBe(1.0);

        // Uncheck the module
        await page.evaluate((factoryGuid) => {
            const island = window.view.island();
            const factory = island.factories.find((f: any) => f.guid === factoryGuid);
            const module = factory?.modules[0];
            module?.checked(false);
        }, sheepFarmGuid);

        await page.waitForTimeout(100);

        // Get buff scaling when unchecked
        const uncheckedScaling = await page.evaluate((args) => {
            const island = window.view.island();
            const factory = island.factories.find((f: any) => f.guid === args.factoryGuid);
            const module = factory?.modules[0];
            const appliedBuff = factory?.buffs().find((b: any) =>
                b.parent === module && b.buff?.guid === args.buffGuid
            );

            return {
                moduleChecked: module?.checked(),
                buffScaling: appliedBuff?.scaling?.() ?? null
            };
        }, { factoryGuid: sheepFarmGuid, buffGuid: siloBuffGuid });

        console.log('Module unchecked - buff scaling:', uncheckedScaling);

        // When module is unchecked, buff scaling should be 0.0 (inactive)
        expect(uncheckedScaling.moduleChecked).toBe(false);
        expect(uncheckedScaling.buffScaling).toBe(0.0);
    });
});
