import { test } from '@playwright/test';
import { ConfigLoader } from './helpers/config-loader';

test('debug DLC assets', async ({ page }) => {
    const configLoader = new ConfigLoader();
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const dlcAssets = await page.evaluate(() => {
        const view = (window as any).view;
        const island = view.island();
        const assets = Array.from(island.assetsMap.values()) as any[];
        
        const results: any[] = [];
        for (const asset of assets) {
            if (asset.dlcs && asset.dlcs.length > 0) {
                let type = 'unknown';
                if (asset.constructor.name.includes('Factory')) type = 'factory';
                else if (asset.constructor.name.includes('ResidenceNeed')) type = 'need';
                else if (asset.constructor.name.includes('Effect')) type = 'effect';
                else if (asset.constructor.name.includes('Patron')) type = 'patron';
                
                results.push({
                    guid: asset.guid,
                    name: asset.name(),
                    type: type,
                    className: asset.constructor.name,
                    dlcGuid: asset.dlcs[0].guid,
                    dlcName: asset.dlcs[0].name()
                });
            }
        }
        return results;
    });

    console.log(JSON.stringify(dlcAssets, null, 2));
});
