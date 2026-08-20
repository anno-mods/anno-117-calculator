import { test, expect } from '@playwright/test';
import { ConfigLoader } from '../helpers/config-loader';
import { BindingErrorDetector } from '../helpers/binding-detector';

/**
 * Public Building Presenters (publicServices / publicRecipeBuildings / recipeLists).
 *
 * Anno 117's own params.js/params-ref.js/params-base.js carry zero entries for these building
 * types today (the population loops that would build them from params.* stay commented out -
 * see AGENTS.md), so there is no real fixture data to load. This suite injects synthetic
 * PublicConsumerBuilding/RecipeList instances directly into each island's assetsMap/arrays after
 * construction, then exercises the presenter classes' own computeds directly (matching this
 * repo's tests/computed/ convention, e.g. all-islands-aggregation-products.spec.ts) rather than
 * driving the DOM - window.view.template.publicServices/publicRecipeBuildings/recipeLists are
 * plain (non-observable) arrays built once at bootstrap from the (always-empty) model arrays, so
 * reassigning them post-bootstrap has no Knockout dependency to trigger a re-render (see
 * AGENTS.md's "never swap the array foreach iterates" warning) - the presenters are still fully
 * testable by constructing and querying them directly.
 */

const LATIUM_SESSION = 3245;
const ALBION_SESSION = 6627;

interface InjectedFixture {
    productGuid: number;
    serviceGuid: number;
    recipeBuilding1Guid: number;
    recipeBuilding2Guid: number;
    recipeListGuid: number;
}

async function injectFixture(page: any): Promise<InjectedFixture> {
    return page.evaluate(() => {
        const allIslands = (window as any).view.islandManager.allIslands;
        const literalsMap = allIslands.literalsMap;

        const mockProductConfig = {
            guid: 999991,
            locaText: { english: 'Mock Fire Service Good' },
            name: 'Mock Fire Service Good',
            inputs: []
        };

        const mockServiceConfig = {
            guid: 999992,
            locaText: { english: 'Mock Fire Station' },
            name: 'Mock Fire Station',
            product: '999991',
            associatedRegions: ['Roman'],
            maintenances: []
        };

        const recipeBuilding1Config = {
            guid: 999994,
            locaText: { english: 'Mock Recipe Building A' },
            name: 'Mock Recipe Building A',
            associatedRegions: ['Roman'],
            maintenances: []
        };
        const recipeBuilding2Config = {
            guid: 999995,
            locaText: { english: 'Mock Recipe Building B' },
            name: 'Mock Recipe Building B',
            associatedRegions: ['Roman'],
            maintenances: []
        };

        const mockRecipeListConfig = {
            guid: 999993,
            locaText: { english: 'Mock Public Kitchen List' },
            name: 'Mock Public Kitchen List',
            recipeBuildings: [999994, 999995],
            region: '3245',
            associatedRegions: ['Roman']
        };

        const PublicConsumerBuildingCtor = (window as any).PublicConsumerBuilding;
        const RecipeListCtor = (window as any).RecipeList;
        const ProductCtor = (window as any).Product;

        for (const island of (window as any).view.islands()) {
            if (island.isAllIslands()) continue;
            const islandAssetsMap = island.assetsMap;

            const product = new ProductCtor(mockProductConfig, islandAssetsMap);
            islandAssetsMap.set(product.guid, product);

            const service = new PublicConsumerBuildingCtor(mockServiceConfig, islandAssetsMap, literalsMap, island);
            islandAssetsMap.set(service.guid, service);
            island.publicServices.push(service);
            island.consumers.push(service);

            const recipeBuilding1 = new PublicConsumerBuildingCtor(recipeBuilding1Config, islandAssetsMap, literalsMap, island);
            islandAssetsMap.set(recipeBuilding1.guid, recipeBuilding1);
            island.publicRecipeBuildings.push(recipeBuilding1);
            island.consumers.push(recipeBuilding1);

            const recipeBuilding2 = new PublicConsumerBuildingCtor(recipeBuilding2Config, islandAssetsMap, literalsMap, island);
            islandAssetsMap.set(recipeBuilding2.guid, recipeBuilding2);
            island.publicRecipeBuildings.push(recipeBuilding2);
            island.consumers.push(recipeBuilding2);

            const recipeList = new RecipeListCtor(mockRecipeListConfig, islandAssetsMap, island);
            islandAssetsMap.set(recipeList.guid, recipeList);
            island.recipeLists.push(recipeList);

            // world.ts wires b.recipeName for every item already in island.publicRecipeBuildings
            // at Island-construction time (mirrors the "Restaurant: Schnitzel" -> "Schnitzel"
            // display convention) - replicate it here since these buildings were injected after
            // construction, the same reason publicBuildingsSectionVisible needs re-creating below.
            recipeBuilding1.recipeName = () => recipeBuilding1.name().split(':').slice(-1)[0].trim();
            recipeBuilding2.recipeName = () => recipeBuilding2.name().split(':').slice(-1)[0].trim();

            service.initDemands(islandAssetsMap);
            recipeBuilding1.initDemands(islandAssetsMap);
            recipeBuilding2.initDemands(islandAssetsMap);
        }

        return {
            productGuid: mockProductConfig.guid,
            serviceGuid: mockServiceConfig.guid,
            recipeBuilding1Guid: recipeBuilding1Config.guid,
            recipeBuilding2Guid: recipeBuilding2Config.guid,
            recipeListGuid: mockRecipeListConfig.guid
        };
    });
}

test.describe('Public Building Presenters - Single-Island & Aggregate Mode', () => {
    let configLoader: ConfigLoader;
    let errorDetector: BindingErrorDetector;
    let fixture: InjectedFixture;

    test.beforeEach(async ({ page }) => {
        configLoader = new ConfigLoader();
        errorDetector = new BindingErrorDetector();
        errorDetector.listenForErrors(page);

        const config = configLoader.createFullConfig(
            [
                { name: 'Latium', session: LATIUM_SESSION, data: {} },
                { name: 'Albion', session: ALBION_SESSION, data: {} }
            ],
            {},
            'Latium'
        );
        await configLoader.loadConfigObject(page, config);
        await page.goto('/');
        await page.waitForFunction(() => (window as any).view && (window as any).view.island());
        await page.waitForTimeout(300);

        fixture = await injectFixture(page);
    });

    test('Single island: presenter reflects model state and construction mutates it', async ({ page }) => {
        const result = await page.evaluate(({ serviceGuid, recipeListGuid, recipeBuilding1Guid }) => {
            const view = (window as any).view;
            const latium = view.islands().find((i: any) => i.name() === 'Latium');
            view.island(latium);

            const PublicServicePresenter = (window as any).PublicServicePresenter;
            const RecipeListPresenter = (window as any).RecipeListPresenter;
            const PublicRecipeBuildingPresenter = (window as any).PublicRecipeBuildingPresenter;

            const serviceModel = latium.assetsMap.get(serviceGuid);
            const servicePresenter = new PublicServicePresenter(serviceModel, view.island);

            const initialVisible = servicePresenter.visible();
            const initialConstructed = servicePresenter.buildings().constructed();

            servicePresenter.buildings().constructed(3);
            const afterConstructed = servicePresenter.buildings().constructed();
            const modelConstructed = serviceModel.buildings.constructed();

            const recipeListModel = latium.assetsMap.get(recipeListGuid);
            const recipeListPresenter = new RecipeListPresenter(recipeListModel, view.island);
            const initialUnusedCount = recipeListPresenter.unusedRecipes().length;
            const initialCanCreate = recipeListPresenter.canCreate();

            const recipeBuilding1Model = latium.assetsMap.get(recipeBuilding1Guid);
            recipeListPresenter.selectedRecipe(recipeBuilding1Model);
            recipeListPresenter.create();

            const afterUnusedCount = recipeListPresenter.unusedRecipes().length;
            const recipeBuilding1Presenter = new PublicRecipeBuildingPresenter(recipeBuilding1Model, view.island);

            return {
                initialVisible,
                initialConstructed,
                afterConstructed,
                modelConstructed,
                initialUnusedCount,
                initialCanCreate,
                afterUnusedCount,
                recipeBuilding1Visible: recipeBuilding1Presenter.visible(),
                recipeBuilding1Constructed: recipeBuilding1Presenter.buildings().constructed(),
                recipeBuilding1Name: recipeBuilding1Presenter.recipeName()
            };
        }, fixture);

        expect(result.initialVisible).toBe(true);
        expect(result.initialConstructed).toBe(0);
        expect(result.afterConstructed).toBe(3);
        expect(result.modelConstructed).toBe(3);

        expect(result.initialUnusedCount).toBe(2);
        expect(result.initialCanCreate).toBe(true);
        expect(result.afterUnusedCount).toBe(1);

        expect(result.recipeBuilding1Visible).toBe(true);
        expect(result.recipeBuilding1Constructed).toBe(1);
        expect(result.recipeBuilding1Name).toBeTruthy();
    });

    test('Aggregate mode: sums constructed counts and gates recipeList create/selection', async ({ page }) => {
        const result = await page.evaluate(({ serviceGuid, recipeListGuid }) => {
            const view = (window as any).view;
            const latium = view.islands().find((i: any) => i.name() === 'Latium');
            const albion = view.islands().find((i: any) => i.name() === 'Albion');
            const allIslandsInstance = view.islands().find((i: any) => i.isAllIslands());

            latium.assetsMap.get(serviceGuid).buildings.constructed(2);
            albion.assetsMap.get(serviceGuid).buildings.constructed(3);

            view.settings.aggregateAllIslands.checked(true);
            view.island(allIslandsInstance);

            const PublicServicePresenter = (window as any).PublicServicePresenter;
            const RecipeListPresenter = (window as any).RecipeListPresenter;

            const servicePresenter = new PublicServicePresenter(latium.assetsMap.get(serviceGuid), view.island);
            const aggregateConstructed = servicePresenter.buildings().constructed();
            const aggregateRequired = servicePresenter.buildings().required();

            const recipeListPresenter = new RecipeListPresenter(latium.assetsMap.get(recipeListGuid), view.island);
            const aggregateCanCreate = recipeListPresenter.canCreate();
            const aggregateUnusedCount = recipeListPresenter.unusedRecipes().length;

            // Switch back to a single real island and confirm non-aggregate values are unaffected
            view.island(latium);
            const singleIslandConstructed = servicePresenter.buildings().constructed();

            return { aggregateConstructed, aggregateRequired, aggregateCanCreate, aggregateUnusedCount, singleIslandConstructed };
        }, fixture);

        expect(result.aggregateConstructed).toBe(5);
        expect(result.aggregateCanCreate).toBe(false);
        expect(result.aggregateUnusedCount).toBe(2);
        expect(result.singleIslandConstructed).toBe(2);
    });
});
