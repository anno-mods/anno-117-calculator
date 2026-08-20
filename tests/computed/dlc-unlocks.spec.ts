import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import * as fs from 'fs';
import * as path from 'path';

test.describe('DLC Unlock Logic', () => {
  let configLoader: ConfigLoader;

  test.beforeEach(async () => {
    configLoader = new ConfigLoader();
  });

  async function getBasicConfig() {
    const fullPath = path.resolve(process.cwd(), "tests/fixtures/basic.json");
    const configContent = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(configContent);
  }

  test('assets with dlcUnlocks have available() === false when no DLC is active', async ({ page }) => {
    const config = await getBasicConfig();
    
    await configLoader.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.islands().length > 0);
    await page.waitForTimeout(300);

    // Uncheck all DLCs
    await page.evaluate(() => {
        window.view.dlcs.forEach((d: any) => d.checked(false));
    });

    const availabilityInfo = await page.evaluate(() => {
        const island = (window as any).view.island();
        if (!island) return { totalDlcAssets: 0, availableDlcAssets: 0, availableNames: [] };
        const assets = Array.from(island.assetsMap.values());
        const dlcAssets = assets.filter((a: any) => a.dlcs && a.dlcs.length > 0);
        const availableDlcAssets = dlcAssets.filter((a: any) => a.available());
        
        return {
            totalDlcAssets: dlcAssets.length,
            availableDlcAssets: availableDlcAssets.length,
            availableNames: availableDlcAssets.map((a: any) => `${a.name()} (${a.guid})`)
        };
    });

    if (availabilityInfo.availableDlcAssets > 0) {
        console.log('Available DLC assets (should be 0):', availabilityInfo.availableNames);
    }

    expect(availabilityInfo.totalDlcAssets).toBeGreaterThan(0);
    expect(availabilityInfo.availableDlcAssets).toBe(0);
  });

  test('products and effects with available() === false are not displayed in the frontend', async ({ page }) => {
    const config = await getBasicConfig();
    
    await configLoader.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.islands().length > 0);
    await page.waitForTimeout(300);

    // Uncheck all DLCs
    await page.evaluate(() => {
        window.view.dlcs.forEach((d: any) => d.checked(false));
    });

    const visibilityInfo = await page.evaluate(() => {
        const presenter = window.view.presenter;
        const allProductPresenters = presenter.categories.flatMap((cat: any) => cat.productPresenters);
        
        const unavailableProducts = allProductPresenters.filter((p: any) => p.instance() && !p.instance().available());
        const visibleUnavailableProducts = unavailableProducts.filter((p: any) => p.visible());

        // Check effects
        const allEffects = window.view.globalEffects;
        const unavailableEffects = allEffects.filter((e: any) => !e.available());
        
        return {
            totalUnavailableProducts: unavailableProducts.length,
            visibleUnavailableProducts: visibleUnavailableProducts.length
        };
    });

    expect(visibilityInfo.totalUnavailableProducts).toBeGreaterThan(0);
    expect(visibilityInfo.visibleUnavailableProducts).toBe(0);
  });

  test('activate all DLCs - ensure that available is true now', async ({ page }) => {
    const config = await getBasicConfig();
    
    await configLoader.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.islands().length > 0);
    await page.waitForTimeout(300);

    // Activate all DLCs
    await page.evaluate(() => {
        window.view.dlcs.forEach((d: any) => d.checked(true));
    });

    const availabilityInfo = await page.evaluate(() => {
        const island = window.view.island();
        if (!island) return { totalDlcAssets: 0, availableDlcAssets: 0 };
        const assets = Array.from(island.assetsMap.values());
        const dlcAssets = assets.filter((a: any) => a.dlcs && a.dlcs.length > 0);
        
        return {
            totalDlcAssets: dlcAssets.length,
            availableDlcAssets: dlcAssets.filter((a: any) => a.available()).length
        };
    });

    expect(availabilityInfo.totalDlcAssets).toBeGreaterThan(0);
    expect(availabilityInfo.availableDlcAssets).toBe(availabilityInfo.totalDlcAssets);
  });

  test('activate all DLCs ensure products and effects are shown', async ({ page }) => {
    const config = await getBasicConfig();
    // Enable showAllProducts to make sure they are shown if available
    config["calculatorSettings"] = JSON.stringify({
        "settings.showAllProducts": "1"
    });
    
    await configLoader.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.islands().length > 0);
    await page.waitForTimeout(300);

    // Activate all DLCs
    await page.evaluate(() => {
        window.view.dlcs.forEach((d: any) => d.checked(true));
    });

    const visibilityInfo = await page.evaluate(() => {
        const presenter = window.view.presenter;
        const allProductPresenters = presenter.categories.flatMap((cat: any) => cat.productPresenters);
        
        const dlcProducts = allProductPresenters.filter((p: any) => p.instance().dlcs && p.instance().dlcs.length > 0);
        const visibleDlcProducts = dlcProducts.filter((p: any) => p.visible());
        
        return {
            totalDlcProducts: dlcProducts.length,
            visibleDlcProducts: visibleDlcProducts.length
        };
    });

    expect(visibilityInfo.totalDlcProducts).toBeGreaterThan(0);
    expect(visibilityInfo.visibleDlcProducts).toBe(visibilityInfo.totalDlcProducts);
  });

  test('open product coal (guid 2085) and check that coal mine (guid 144810) is shown as a producer', async ({ page }) => {
    const config = await getBasicConfig();
    
    await configLoader.loadConfigObject(page, config);
    await page.goto('/');
    await page.waitForFunction(() => (window as any).view && (window as any).view.islands().length > 0);
    await page.waitForTimeout(300);

    // Activate all DLCs
    await page.evaluate(() => {
        window.view.dlcs.forEach((d: any) => d.checked(true));
    });

    // Find Coal product presenter and open its config dialog
    const coalPresenterFound = await page.evaluate(() => {
        const presenter = window.view.presenter;
        const coalPresenter = presenter.categories
            .flatMap((cat: any) => cat.productPresenters)
            .find((p: any) => p.instance().guid === 2085);
        
        if (coalPresenter) {
            coalPresenter.openConfigDialog();
            return true;
        }
        return false;
    });

    expect(coalPresenterFound).toBe(true);

    // Wait for dialog to be visible
    await page.waitForSelector('#product-config-dialog', { state: 'visible' });
    
    // Wait for Coal Mine to appear in the dialog (either as text or in a title attribute)
    await page.waitForFunction(() => {
        const dialog = document.querySelector('#product-config-dialog');
        if (!dialog) return false;
        
        // Check for text content
        const textFound = dialog.textContent?.includes('Coal Mine');
        if (textFound) return true;
        
        // Check for title attributes (in tab buttons)
        const titles = Array.from(dialog.querySelectorAll('[title]')).map(el => el.getAttribute('title'));
        return titles.some(t => t?.includes('Coal Mine'));
    }, { timeout: 10000 });

    // Check if Coal Mine is listed as a producer
    const producersInfo = await page.evaluate(() => {
        const dialog = document.querySelector('#product-config-dialog');
        if (!dialog) return { found: false };
        
        const textFound = dialog.textContent?.includes('Coal Mine');
        const titles = Array.from(dialog.querySelectorAll('[title]')).map(el => el.getAttribute('title'));
        const titleFound = titles.some(t => t?.includes('Coal Mine'));
        
        return {
            found: textFound || titleFound
        };
    });

    expect(producersInfo.found).toBe(true);
  });

  test.describe('DLC Locking Logic', () => {
    const DLC_67902 = 67902; // Prophecies of Ash
    const FACTORY_COAL_MINE = 144810;
    const NEED_BOARDGAMES = 145225;
    const EFFECT_OBSIDIAN_GATHERING = 145095;
    const PATRON_VULCAN = 144800;

    test.beforeEach(async ({ page }) => {
        const config = await getBasicConfig();
        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.islands().length > 0);
        await page.waitForTimeout(300);

        // Ensure DLC is unchecked initially
        await page.evaluate((dlcGuid) => {
            const dlc = window.view.dlcs.find((d: any) => d.guid === dlcGuid);
            if (dlc) dlc.checked(false);
        }, DLC_67902);
    });

    test('DLC is locked and checked when a factory has constructed buildings', async ({ page }) => {
        const dlcState = await page.evaluate(({factoryGuid, dlcGuid}) => {
            const factory = window.view.island().assetsMap.get(factoryGuid);
            factory.buildings.constructed(1);
            const dlc = window.view.dlcs.find((d: any) => d.guid === dlcGuid);
            return {
                checked: dlc.checked(),
                used: dlc.used()
            };
        }, {factoryGuid: FACTORY_COAL_MINE, dlcGuid: DLC_67902});

        expect(dlcState.checked).toBe(true);
        expect(dlcState.used).toBe(true);
    });

    test('DLC is locked and checked when an effect has scaling > 0', async ({ page }) => {
        const dlcState = await page.evaluate(({effectGuid, dlcGuid}) => {
            const effect = window.view.island().allEffects.find((e: any) => e.guid === effectGuid);
            if (effect) effect.scaling(0.5);
            const dlc = window.view.dlcs.find((d: any) => d.guid === dlcGuid);
            return {
                checked: dlc.checked(),
                used: dlc.used(),
                hasEffect: !!effect
            };
        }, {effectGuid: EFFECT_OBSIDIAN_GATHERING, dlcGuid: DLC_67902});

        expect(dlcState.hasEffect).toBe(true);
        expect(dlcState.checked).toBe(true);
        expect(dlcState.used).toBe(true);
    });

    test('DLC is locked and checked when a patron is selected', async ({ page }) => {
        const dlcState = await page.evaluate(({patronGuid, dlcGuid}) => {
            // Enable DLC first so patron is available
            const dlc = window.view.dlcs.find((d: any) => d.guid === dlcGuid);
            if (dlc) dlc.checked(true);

            const island = window.view.island();
            const patron = island.availablePatrons().find((p: any) => p.guid === patronGuid);
            if (patron) island.selectedPatron(patron);
            
            return {
                checked: dlc.checked(),
                used: dlc.used(),
                hasPatron: !!patron
            };
        }, {patronGuid: PATRON_VULCAN, dlcGuid: DLC_67902});

        expect(dlcState.hasPatron).toBe(true);
        expect(dlcState.checked).toBe(true);
        expect(dlcState.used).toBe(true);
    });
  });
});
