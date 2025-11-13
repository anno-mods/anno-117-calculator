import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers';

/**
 * Tests for module input demand calculations
 *
 * Validates that modules correctly calculate input demands based on their parent factory's buildings.
 *
 * Test case: Sheep Farm (guid 2786) with Silo module (guid 77954)
 * - Silo module requires wheat (product 2069) as input
 * - Module cycle time: 300s, input: 1 wheat per cycle
 * - When module is checked, wheat demand should appear based on factory's utilized buildings
 * - Demand calculation: buildings.utilized() * 60 / 300 * 1 = wheat/min
 */

test.describe('Module Input Demands', () => {
    test('sheep farm silo module should show wheat demand when equipped', async ({ page }) => {
        const configLoader = new ConfigLoader();

        // Create config with sheep farm having 5 constructed buildings
        const config = configLoader.createIslandConfig("Latium", 3245, {
            "2786.buildings.constructed": "5",  // Sheep farm with 5 buildings
            "2786.buildings.fullyUtilizeConstructed": "1"  // 1 = true, 0 = false
        });

        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const sheepFarmGuid = 2786;
        const wheatProductGuid = 2069;

        // Wait a bit for initialization
        await page.waitForTimeout(500);

        // Verify module exists and is initially unchecked
        const initialState = await page.evaluate((args) => {
            const island = window.view.island();
            const factory = island.factories.find((f: any) => f.guid === args.factoryGuid);

            if (!factory || !factory.modules || factory.modules.length === 0) {
                return { error: 'Factory or module not found' };
            }

            const module = factory.modules[0];
            const wheatProduct = island.assetsMap.get(args.wheatGuid);
            const wheatDemand = wheatProduct?.demands().find((d: any) => d.consumer === module);

            return {
                factoryGuid: factory.guid,
                factoryConstructed: factory.buildings.constructed(),
                factoryUtilized: factory.buildings.utilized(),
                moduleGuid: module.guid,
                moduleChecked: module.checked(),
                moduleConstructed: module.buildings.constructed(),
                moduleUtilized: module.buildings.utilized(),
                moduleThroughput: module.throughput(),
                wheatDemandExists: !!wheatDemand,
                wheatDemandAmount: wheatDemand?.amount() || 0
            };
        }, { factoryGuid: sheepFarmGuid, wheatGuid: wheatProductGuid });

        console.log('Initial state (module unchecked):', initialState);

        // Verify setup
        expect(initialState.error).toBeUndefined();
        expect(initialState.factoryConstructed).toBe(5);
        expect(initialState.moduleChecked).toBe(false);
        expect(initialState.moduleConstructed).toBe(0); // Should be 0 when unchecked
        expect(initialState.wheatDemandAmount).toBe(0); // No demand when unchecked

        // Check the module (equip it)
        await page.evaluate((factoryGuid) => {
            const island = window.view.island();
            const factory = island.factories.find((f: any) => f.guid === factoryGuid);
            const module = factory?.modules[0];
            if (module) {
                module.checked(true);
            }
        }, sheepFarmGuid);

        // Wait for reactive updates
        await page.waitForTimeout(200);

        // Verify module shows wheat demand after being checked
        const checkedState = await page.evaluate((args) => {
            const island = window.view.island();
            const factory = island.factories.find((f: any) => f.guid === args.factoryGuid);
            const module = factory?.modules[0];

            const wheatProduct = island.assetsMap.get(args.wheatGuid);
            const wheatDemand = wheatProduct?.demands().find((d: any) => d.consumer === module);

            return {
                factoryConstructed: factory.buildings.constructed(),
                factoryRequired: factory.buildings.required(),
                factoryUtilized: factory.buildings.utilized(),
                moduleChecked: module?.checked(),
                moduleConstructed: module?.buildings.constructed(),
                moduleUtilized: module?.buildings.utilized(),
                moduleThroughput: module?.throughput(),
                moduleThroughputByExisting: module?.throughputByExistingBuildings(),
                moduleUseThroughputByExisting: module?.useThroughputByExistingBuildings(),
                moduleFullyUtilize: module?.buildings.fullyUtilizeConstructed(),
                moduleBoost: module?.boost(),
                moduleCycleTime: module?.cycleTime,
                wheatDemandAmount: wheatDemand?.amount() || 0
            };
        }, { factoryGuid: sheepFarmGuid, wheatGuid: wheatProductGuid });

        console.log('After checking module:', checkedState);

        // Calculate expected wheat demand
        // Formula: module.buildings.utilized() * 60 / cycleTime * inputAmount * boost
        // Module utilizes factory's utilized buildings when checked
        // Module: factory has 5 utilized buildings, 300s cycle time, 1 wheat per cycle, boost = 1.0
        const expectedWheatDemand = 5 * 60 / 300 * 1 * 1.0; // = 1.0 wheat/min

        expect(checkedState.moduleChecked).toBe(true);
        expect(checkedState.moduleFullyUtilize).toBe(true); // Should be enabled for modules
        expect(checkedState.moduleConstructed).toBe(5); // Module's constructed = factory's utilized
        expect(checkedState.moduleThroughput).toBeGreaterThan(0);
        expect(checkedState.wheatDemandAmount).toBeCloseTo(expectedWheatDemand, 2);

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

        // Verify demand goes back to 0
        const uncheckedState = await page.evaluate((args) => {
            const island = window.view.island();
            const factory = island.factories.find((f: any) => f.guid === args.factoryGuid);
            const module = factory?.modules[0];

            const wheatProduct = island.assetsMap.get(args.wheatGuid);
            const wheatDemand = wheatProduct?.demands().find((d: any) => d.consumer === module);

            return {
                moduleChecked: module?.checked(),
                moduleConstructed: module?.buildings.constructed(),
                wheatDemandAmount: wheatDemand?.amount() || 0
            };
        }, { factoryGuid: sheepFarmGuid, wheatGuid: wheatProductGuid });

        console.log('After unchecking module:', uncheckedState);

        expect(uncheckedState.moduleChecked).toBe(false);
        expect(uncheckedState.moduleConstructed).toBe(0);
        expect(uncheckedState.wheatDemandAmount).toBe(0);
    });
});
