import { ko } from './util';
import { PublicConsumerBuilding } from './factories';
import { RecipeList } from './consumption';
import { Island } from './world';
import { BuildingsCalc } from './util';
import { isAggregateModeFor, sumAcrossRealIslands } from './aggregate';

export class PublicServicePresenter {
    public building: PublicConsumerBuilding;
    public island: KnockoutObservable<Island>;
    public instance: KnockoutComputed<PublicConsumerBuilding | null>;

    public guid: number;
    public icon: string | undefined;
    public name: KnockoutComputed<string>;
    public visible: KnockoutComputed<boolean>;
    public inputAmount: KnockoutComputed<number>;
    public buildings: KnockoutComputed<BuildingsCalc>;
    public isHighlightedAsMissing: KnockoutComputed<boolean>;

    constructor(building: PublicConsumerBuilding, island: KnockoutObservable<Island>) {
        this.building = building;
        this.island = island;
        this.guid = building.guid;
        this.icon = building.icon;

        this.instance = ko.computed(() => (this.island().assetsMap.get(this.guid) as PublicConsumerBuilding) ?? null);
        this.name = ko.pureComputed(() => this.instance()?.name() ?? this.building.name());

        this.visible = ko.pureComputed(() => {
            if (isAggregateModeFor(this.island())) {
                const realIslands = window.view.islands().filter((i: Island) => !i.isAllIslands());
                return realIslands.some((realIsland: Island) => {
                    const inst = realIsland.assetsMap.get(this.guid) as PublicConsumerBuilding | undefined;
                    return inst ? inst.visible() : false;
                });
            }
            return this.instance()?.visible() ?? false;
        });

        this.inputAmount = ko.pureComputed(() => {
            if (isAggregateModeFor(this.island())) {
                return sumAcrossRealIslands((realIsland: Island) => {
                    const inst = realIsland.assetsMap.get(this.guid) as PublicConsumerBuilding | undefined;
                    return inst ? inst.throughput() : 0;
                });
            }
            return this.instance()?.throughput() ?? 0;
        });

        this.buildings = ko.pureComputed(() => {
            if (!isAggregateModeFor(this.island())) {
                return this.instance()?.buildings || new BuildingsCalc();
            }

            const aggregate = new BuildingsCalc();
            aggregate.constructed(sumAcrossRealIslands((realIsland: Island) => {
                const inst = realIsland.assetsMap.get(this.guid) as PublicConsumerBuilding | undefined;
                return inst ? inst.buildings.constructed() : 0;
            }));
            aggregate.required(sumAcrossRealIslands((realIsland: Island) => {
                const inst = realIsland.assetsMap.get(this.guid) as PublicConsumerBuilding | undefined;
                return inst ? inst.buildings.required() : 0;
            }));
            return aggregate;
        });

        this.isHighlightedAsMissing = ko.pureComputed(() => {
            if (!window.view.settings.missingBuildingsHighlight || !window.view.settings.missingBuildingsHighlight.checked())
                return false;

            return this.buildings().required() > this.buildings().constructed() + 0.001;
        });
    }
}

export class PublicRecipeBuildingPresenter {
    public building: PublicConsumerBuilding;
    public island: KnockoutObservable<Island>;
    public instance: KnockoutComputed<PublicConsumerBuilding | null>;

    public guid: number;
    public icon: string | undefined;
    public name: KnockoutComputed<string>;
    public recipeName: KnockoutComputed<string | undefined>;
    public visible: KnockoutComputed<boolean>;
    public inputAmount: KnockoutComputed<number>;
    public buildings: KnockoutComputed<BuildingsCalc>;

    constructor(building: PublicConsumerBuilding, island: KnockoutObservable<Island>) {
        this.building = building;
        this.island = island;
        this.guid = building.guid;
        this.icon = building.icon;

        this.instance = ko.computed(() => (this.island().assetsMap.get(this.guid) as PublicConsumerBuilding) ?? null);
        this.name = ko.pureComputed(() => this.instance()?.name() ?? this.building.name());
        this.recipeName = ko.pureComputed(() => this.instance()?.recipeName?.() ?? this.building.recipeName?.() ?? '');

        this.visible = ko.pureComputed(() => this.instance()?.visible() ?? false);
        this.inputAmount = ko.pureComputed(() => this.instance()?.throughput() ?? 0);
        this.buildings = ko.pureComputed(() => this.instance()?.buildings || new BuildingsCalc());
    }
}

export class RecipeListPresenter {
    public recipeList: RecipeList;
    public island: KnockoutObservable<Island>;
    public instance: KnockoutComputed<RecipeList | null>;

    public guid: number | undefined;
    public icon: string | undefined;
    public name: KnockoutComputed<string>;
    public visible: KnockoutComputed<boolean>;

    // Controls/Bindings compatibility
    public unusedRecipes: KnockoutComputed<any[]>;
    public selectedRecipe: KnockoutObservable<any | null>;
    public canCreate: KnockoutComputed<boolean>;
    public selectedRecipeSubscription: KnockoutComputed<void>;

    constructor(recipeList: RecipeList, island: KnockoutObservable<Island>) {
        this.recipeList = recipeList;
        this.island = island;
        this.guid = recipeList.guid;
        this.icon = recipeList.icon;

        this.instance = ko.computed(() => (this.island().assetsMap.get(this.guid || 0) as RecipeList) ?? null);
        this.name = ko.pureComputed(() => this.instance()?.name() ?? this.recipeList.name());

        this.unusedRecipes = ko.pureComputed(() => {
            if (isAggregateModeFor(this.island())) {
                const result: any[] = [];
                for (const recipe of this.recipeList.recipeBuildings) {
                    const sum = sumAcrossRealIslands((realIsland: Island) => {
                        const inst = realIsland.assetsMap.get(recipe.guid) as PublicConsumerBuilding | undefined;
                        return inst ? inst.buildings.constructed() : 0;
                    });
                    if (sum === 0) {
                        result.push(recipe);
                    }
                }
                return result;
            }
            return this.instance()?.unusedRecipes() ?? [];
        });

        this.visible = ko.pureComputed(() => {
            if (isAggregateModeFor(this.island())) {
                const realIslands = window.view.islands().filter((i: Island) => !i.isAllIslands());
                const available = realIslands.some((realIsland: Island) => {
                    const inst = realIsland.assetsMap.get(this.guid || 0) as RecipeList | undefined;
                    return inst ? inst.available() : false;
                });
                if (!available) return false;

                return this.unusedRecipes().length != 0;
            }
            return this.instance()?.visible() ?? false;
        });

        this.selectedRecipe = ko.observable(null);

        // Keep selectedRecipe in sync with instance selectedRecipe if not aggregate
        this.selectedRecipeSubscription = ko.computed(() => {
            const inst = this.instance();
            if (inst && !isAggregateModeFor(this.island())) {
                this.selectedRecipe(inst.selectedRecipe());
            }
        });

        // Write back to instance if user changes it in single island mode
        this.selectedRecipe.subscribe(val => {
            const inst = this.instance();
            if (inst && val && !isAggregateModeFor(this.island())) {
                inst.selectedRecipe(val);
            }
        });

        this.canCreate = ko.pureComputed(() => {
            if (isAggregateModeFor(this.island())) return false;
            return !!this.instance()?.canCreate();
        });
    }

    create(): void {
        if (isAggregateModeFor(this.island())) return;
        this.instance()?.create();
    }
}
