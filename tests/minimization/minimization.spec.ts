import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';
import { buildAndSolve, LpInput } from './lp-framework';
import * as path from 'path';

// Load params.js for LP solver
const mockWindow: any = { params: null };
(global as any).window = mockWindow;
const paramsPath = path.resolve(__dirname, '../../js/params.js');
require(paramsPath);
const params = mockWindow.params;

test.describe('Demand Minimization Tests (LP Solver vs Calculator)', () => {
  test.setTimeout(60000);
  const configLoader = new ConfigLoader();
  const errorDetector = new BindingErrorDetector();

  test.beforeEach(async ({ page }) => {
    errorDetector.listenForErrors(page);
    page.on('console', msg => {
        if (msg.type() === 'error') console.error('PAGE ERROR:', msg.text());
        else console.log('PAGE LOG:', msg.text());
    });
  });

  test.afterEach(async ({ page }) => {
    if (errorDetector.hasBindingError()) {
        console.error('Binding errors found:', errorDetector.getFormattedBindingErrors().join('\n'));
    }
    const errors = errorDetector.getErrors();
    if (errors.length > 0) {
        // console.error('Console errors already reported via page.on("console")');
    }
  });

  test('cheese-supply-chain: Cheese (2153)', async ({ page }) => {
    // 1. Solve LP (Goat Milk / Cheese is a Celtic chain, so we use Albion/6627)
    const lpInput: LpInput = {
      params,
      sessionGuid: 6627, // Albion
      demands: [{ productGuid: 2153, amount: 10 }], // 10 cheese/min
      activeEffects: []
    };
    const solution = buildAndSolve(lpInput);
    expect(solution.feasible).toBe(true);

    // 2. Setup Calculator (Goat Milk / Cheese is a Celtic chain, so we use Albion/6627)
    const config = configLoader.createIslandConfig("Albion", 6627, {}, {});
    await configLoader.loadConfigObject(page, config);
    await page.goto('/');
    
    // Log content for debugging
    const content = await page.content();
    console.log(`Page content snippet: ${content.substring(0, 500)}`);

    await page.waitForFunction(() => (window as any).view && (window as any).view.island(), { timeout: 30000 });

    // 3. Apply throughputs
    await page.evaluate(({ throughputs, boosts }) => {
      const view = (window as any).view;
      const island = view.island();
      
      for (const [fGuidStr, t] of Object.entries(throughputs)) {
        const fGuid = parseInt(fGuidStr);
        if (t as number > 0) {
          const factory = island.assetsMap.get(fGuid);
          if (factory) {
            const boost = (boosts as any)[fGuidStr] || 1.0;
            const cycleTime = factory.cycleTime;
            // buildings = ceil(t / (boost * 60 / cycleTime))
            const buildings = Math.ceil((t as number) / (boost * 60 / cycleTime));
            factory.buildings.constructed(buildings);
            factory.buildings.fullyUtilizeConstructed(true);
          }
        }
      }
    }, { 
        throughputs: Object.fromEntries(solution.throughputs), 
        boosts: Object.fromEntries(solution.boosts) 
    });

    // 4. Wait for observables
    await page.waitForTimeout(500);

    // 5. Assert production matches or exceeds demand
    const production = await page.evaluate((pGuid) => {
      const product = (window as any).view.island().assetsMap.get(pGuid);
      return product.totalCurrentProduction();
    }, 2153);

    console.log(`Cheese Production: ${production}, LP Demand: 10`);
    expect(production).toBeGreaterThanOrEqual(10 - 0.001);
  });

  test('obsidian-extra-good: Obsidian (145102)', async ({ page }) => {
    // Obsidian Gathering (145095)
    const lpInput: LpInput = {
      params,
      sessionGuid: 3245,
      demands: [{ productGuid: 145102, amount: 5 }],
      activeEffects: [{ effectGuid: 145095, scaling: 1 }]
    };
    const solution = buildAndSolve(lpInput);
    expect(solution.feasible).toBe(true);

    const config = configLoader.createIslandConfig("Latium", 3245, {}, {});
    await configLoader.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());

    // Enable effect in calculator
    await page.evaluate((eGuid) => {
        const effect = (window as any).view.island().assetsMap.get(eGuid);
        if (effect) effect.scaling(1);
    }, 145095);

    // Apply throughputs
    await page.evaluate(({ throughputs, boosts }) => {
      const view = (window as any).view;
      const island = view.island();
      
      for (const [fGuidStr, t] of Object.entries(throughputs)) {
        const fGuid = parseInt(fGuidStr);
        if (t as number > 0) {
          const factory = island.assetsMap.get(fGuid);
          if (factory) {
            const boost = (boosts as any)[fGuidStr] || 1.0;
            const cycleTime = factory.cycleTime;
            const buildings = Math.ceil((t as number) / (boost * 60 / cycleTime));
            factory.buildings.constructed(buildings);
            factory.buildings.fullyUtilizeConstructed(true);
            
            // If it's the producer for a demanded product, set it as default supplier
            // (In this case, obsidian might be provided by extra good supplier)
          }
        }
      }
    }, { 
        throughputs: Object.fromEntries(solution.throughputs), 
        boosts: Object.fromEntries(solution.boosts) 
    });

    // Set Obsidian supplier to Extra Good Supplier if needed
    await page.evaluate((pGuid) => {
        const product = (window as any).view.island().assetsMap.get(pGuid);
        if (product && product.availableSuppliers) {
            const extraGoodSupplier = product.availableSuppliers().find((s: any) => s.type === 'extra_good');
            if (extraGoodSupplier) product.updateDefaultSupplier(extraGoodSupplier);
        }
    }, 145102);

    await page.waitForTimeout(500);

    const production = await page.evaluate((pGuid) => {
      const product = (window as any).view.island().assetsMap.get(pGuid);
      return product.totalCurrentProduction();
    }, 145102);

    console.log(`Obsidian Production: ${production}, LP Demand: 5`);
    expect(production).toBeGreaterThanOrEqual(5 - 0.001);
  });

  test('multi-product-demand: Cheese (2153) + Wine (2138)', async ({ page }) => {
    // Demanding both Cheese (Celtic) and Wine (Roman) requires a session that supports both.
    // Albion supports Celtic Cheese and Roman Celtic Wine.
    const lpInput: LpInput = {
      params,
      sessionGuid: 6627, // Albion
      demands: [
        { productGuid: 2153, amount: 5 },
        { productGuid: 2138, amount: 5 }
      ],
      activeEffects: []
    };
    const solution = buildAndSolve(lpInput);
    expect(solution.feasible).toBe(true);

    // Setup Calculator on Albion to support both Celtic Cheese and Roman Celtic Wine
    const config = configLoader.createIslandConfig("Albion", 6627, {}, {});
    await configLoader.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());

    // Apply throughputs
    await page.evaluate(({ throughputs, boosts }) => {
      const view = (window as any).view;
      const island = view.island();
      for (const [fGuidStr, t] of Object.entries(throughputs)) {
        const fGuid = parseInt(fGuidStr);
        if (t as number > 0) {
          const factory = island.assetsMap.get(fGuid);
          if (factory) {
            const boost = (boosts as any)[fGuidStr] || 1.0;
            const cycleTime = factory.cycleTime;
            const buildings = Math.ceil((t as number) / (boost * 60 / cycleTime));
            factory.buildings.constructed(buildings);
            factory.buildings.fullyUtilizeConstructed(true);
          }
        }
      }
    }, { 
        throughputs: Object.fromEntries(solution.throughputs), 
        boosts: Object.fromEntries(solution.boosts) 
    });

    await page.waitForTimeout(500);

    const cheeseProd = await page.evaluate((pGuid) => (window as any).view.island().assetsMap.get(pGuid).totalCurrentProduction(), 2153);
    const wineProd = await page.evaluate((pGuid) => (window as any).view.island().assetsMap.get(pGuid).totalCurrentProduction(), 2138);

    console.log(`Cheese: ${cheeseProd}, Wine: ${wineProd}, Demand: 5 each`);
    expect(cheeseProd).toBeGreaterThanOrEqual(5 - 0.001);
    expect(wineProd).toBeGreaterThanOrEqual(5 - 0.001);
  });

  test('silo-module-boost: Sheep Farm (2786) + Silo module (77954, buff 77960)', async ({ page }) => {
    // Silo buff 77960 = +100% productivity on Sheep Farm. It is a module (77954), not a
    // standalone effect, so it must be passed via activeModules, not activeEffects.
    const sheepFarmGuid = 2786;
    const woolGuid = 2073; // Sheep Farm outputs product 2073 (Good Sheep)
    const demand = 20; // units/min

    const lpWithSilo: LpInput = {
      params,
      sessionGuid: 3245,
      demands: [{ productGuid: woolGuid, amount: demand }],
      activeEffects: [],
      activeModules: [{ factoryGuid: sheepFarmGuid, buffGuids: [77960] }]
    };
    const lpWithout: LpInput = { ...lpWithSilo, activeModules: [] };

    const solutionWith = buildAndSolve(lpWithSilo);
    const solutionWithout = buildAndSolve(lpWithout);
    expect(solutionWith.feasible).toBe(true);
    expect(solutionWithout.feasible).toBe(true);

    // +100% boost halves the buildings needed: objective with silo < without
    console.log(`Objective with Silo: ${solutionWith.objective}, without: ${solutionWithout.objective}`);
    expect(solutionWith.objective).toBeLessThan(solutionWithout.objective);

    const boost = solutionWith.boosts.get(sheepFarmGuid) ?? 1;
    console.log(`Sheep Farm boost with Silo: ${boost}`);
    expect(boost).toBeGreaterThan(1);

    const config = configLoader.createIslandConfig("Latium", 3245, {}, {});
    await configLoader.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());

    // Enable Silo module on Sheep Farm
    await page.evaluate((fGuid) => {
        const factory = (window as any).view.island().assetsMap.get(fGuid);
        if (factory && factory.modules && factory.modules.length > 0) {
            factory.modules[0].checked(true);
        }
    }, sheepFarmGuid);

    // Apply LP throughputs as buildings
    await page.evaluate(({ throughputs, boosts }) => {
      const island = (window as any).view.island();
      for (const [fGuidStr, t] of Object.entries(throughputs)) {
        const fGuid = parseInt(fGuidStr);
        if ((t as number) > 0) {
          const factory = island.assetsMap.get(fGuid);
          if (factory) {
            const boost = (boosts as any)[fGuidStr] || 1.0;
            const buildings = Math.ceil((t as number) / (boost * 60 / factory.cycleTime));
            factory.buildings.constructed(buildings);
            factory.buildings.fullyUtilizeConstructed(true);
          }
        }
      }
    }, {
        throughputs: Object.fromEntries(solutionWith.throughputs),
        boosts: Object.fromEntries(solutionWith.boosts)
    });

    await page.waitForTimeout(500);

    const woolProd = await page.evaluate(
      (pGuid) => (window as any).view.island().assetsMap.get(pGuid).totalCurrentProduction(),
      woolGuid
    );

    console.log(`Wool Production: ${woolProd}, LP Demand: ${demand}`);
    expect(woolProd).toBeGreaterThanOrEqual(demand - 0.001);
  });
});
