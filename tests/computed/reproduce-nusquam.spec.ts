import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import * as fs from 'fs';

test('Nusquam Roman Bakery required buildings is 0 after switching from All Islands with aggregate mode enabled', async ({ page }) => {
    const configPath = 'tests/fixtures/Anno117CalculatorConfig.json';
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Enable aggregate mode
    const settings = JSON.parse(config.calculatorSettings);
    settings['settings.aggregateAllIslands'] = '1';
    config.calculatorSettings = JSON.stringify(settings);

    // Start on All Islands
    config.islandName = 'All Islands';

    const cl = new ConfigLoader();
    await cl.loadConfigObject(page, config);

    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.island());
    await page.waitForTimeout(500);

    // Switch active island to Nusquam
    await page.evaluate(() => {
        const view = (window as any).view;
        const nusquam = view.islands().find((i: any) => i.name() === 'Nusquam');
        if (nusquam) {
            view.island(nusquam);
        }
    });
    await page.waitForTimeout(500);

    // Get detailed state of Roman Bakery (3174) on Nusquam
    const detailedState = await page.evaluate(() => {
        const view = (window as any).view;
        const island = view.island();
        const factory = island.assetsMap.get(3174);
        if (!factory) {
            return null;
        }
        return {
            requiredBuildings: factory.buildings.required(),
            constructedBuildings: factory.buildings.constructed(),
            isDefaultSupplier: factory.isDefaultSupplier()
        };
    });

    expect(detailedState).not.toBeNull();
    expect(detailedState!.requiredBuildings).toBe(0);
    expect(detailedState!.constructedBuildings).toBe(0);
    expect(detailedState!.isDefaultSupplier).toBe(true);
});
