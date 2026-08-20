import { ACCURACY, BuildingsCalc, createFloatInput, EPSILON, formatNumber, ko } from './util';
import { AppliedBuff, IslandFertility, Product, ProductCategory } from './production';
import { Factory, Module } from './factories';
import { Island, Region } from './world';
import { ExtraGoodSupplier, Supplier } from './suppliers';
import { TradeRoute, TradeList } from './trade';
import { ProductionChainView } from './views';
import { AggregateBuildingsCalc, isAggregateModeFor, sumAcrossRealIslands, sumBuildingsAcrossRealIslands } from './aggregate';

declare const $: any;
declare const view: any;

/**
 * Option for supplier selection dropdown
 */
export interface SupplierOption {
    type: 'factory' | 'extra_good' | 'passive_trade' | 'none';
    supplier: Supplier | null;
    label: string;
    icon: string;
}

/**
 * Presenter for individual factory within ProductPresenter
 * Provides factory-specific UI bindings and supplier management
 */
export class FactoryPresenter {
    public factory: Factory;
    public parentProduct: ProductPresenter;
    public instance: KnockoutComputed<Factory | null>;
    public island: KnockoutObservable<Island>;

    // Delegated properties
    public guid: KnockoutComputed<string>;
    public name: KnockoutComputed<string>;
    public region: KnockoutComputed<Region>;
    public buildings: KnockoutComputed<BuildingsCalc>;
    public boost: KnockoutComputed<number>;
    public outputAmount: KnockoutComputed<number>;
    public modules: KnockoutComputed<Module[]>;
    public items: KnockoutComputed<AppliedBuff[]>;
    public workforceAmount: KnockoutComputed<number>;
    public visible: KnockoutComputed<boolean>;
    public canSupply: KnockoutComputed<boolean>;
    public isDefaultSupplier: KnockoutComputed<boolean>;
    public representativeInstance: KnockoutComputed<Factory | null>;
    public productionChain: ProductionChainView;
    

    /**
     * Creates a new FactoryPresenter instance
     * @param factory - The factory to present
     * @param parent - Parent ProductPresenter
     */
    constructor(factory: Factory, parent: ProductPresenter) {
        if (!factory) {
            throw new Error('FactoryPresenter factory is required');
        }
        if (!parent) {
            throw new Error('FactoryPresenter parent is required');
        }

        this.factory = factory;
        this.parentProduct = parent;
        this.island = parent.island;        
        this.instance = ko.computed(() => this.island().assetsMap.get(this.factory.guid));
        

        // Delegate to factory observables
        this.guid = ko.pureComputed(() => this.instance()?.guid);
        this.name = ko.pureComputed(() => this.instance()?.name());
        this.region = ko.pureComputed(() => this.instance()?.associatedRegions[0]);
        // Built once (the guid never changes) so its single cross-island pass stays memoized across
        // recomputes instead of being rebuilt each time. Lazy: costs nothing off aggregate mode.
        const aggregateBuildingSums = sumBuildingsAcrossRealIslands(this.factory.guid);
        this.buildings = ko.pureComputed(() => {
            if (!isAggregateModeFor(this.island()))
                return this.instance()?.buildings || new BuildingsCalc();

            // Sum this one factory type's buildings across every real island (KTD1). A fresh
            // AggregateBuildingsCalc is returned each recompute - only this computed's own bound
            // value changes, never the productPresenters/factoryPresenters array identity templates
            // iterate, so this never triggers a tile-grid rebuild.
            return new AggregateBuildingsCalc(aggregateBuildingSums);
        });

        this.boost = ko.pureComputed(() => {
            if (isAggregateModeFor(this.island())) {
                let totalUtilized = 0;
                let weightedBoostSum = 0;
                for (const island of view.islands()) {
                    if (island.isAllIslands()) continue;
                    const factory = island.assetsMap.get(this.factory.guid) as Factory | undefined;
                    if (factory) {
                        const utilized = factory.buildings.utilized();
                        const boost = factory.boost();
                        totalUtilized += utilized;
                        weightedBoostSum += boost * utilized;
                    }
                }

                if (totalUtilized > EPSILON) {
                    return weightedBoostSum / totalUtilized;
                }

                // Fallback: weight by constructed buildings if utilized is 0
                let totalConstructed = 0;
                let weightedBoostSumConstructed = 0;
                for (const island of view.islands()) {
                    if (island.isAllIslands()) continue;
                    const factory = island.assetsMap.get(this.factory.guid) as Factory | undefined;
                    if (factory) {
                        const constructed = factory.buildings.constructed();
                        const boost = factory.boost();
                        totalConstructed += constructed;
                        weightedBoostSumConstructed += boost * constructed;
                    }
                }

                if (totalConstructed > EPSILON) {
                    return weightedBoostSumConstructed / totalConstructed;
                }

                // If constructed is also 0, use the boost of the first non-null factory instance, or fallback to 1
                for (const island of view.islands()) {
                    if (island.isAllIslands()) continue;
                    const factory = island.assetsMap.get(this.factory.guid) as Factory | undefined;
                    if (factory) {
                        return factory.boost();
                    }
                }

                return 1;
            }
            return this.instance()?.boost() || 1;
        });
        this.outputAmount = ko.pureComputed(() => {
            if (isAggregateModeFor(this.island())) {
                return sumAcrossRealIslands(island => {
                    const factory = island.assetsMap.get(this.factory.guid) as Factory | undefined;
                    return factory ? factory.outputAmount() : 0;
                });
            }
            return this.instance()?.outputAmount() || 0;
        });
        this.modules = ko.pureComputed(() => this.instance()?.modules || []);
        this.items = ko.pureComputed(() => this.instance()?.availableItems() || []);

        // Sums this one factory type's required workforce across every real island (mirrors
        // .buildings above) - the All-Islands pseudo-island's own workforceDemand.amount() is
        // otherwise always 0 (it has no constructed/utilized buildings of its own).
        this.workforceAmount = ko.pureComputed(() => {
            if (!isAggregateModeFor(this.island()))
                return this.instance()?.workforceDemand?.amount() ?? 0;

            return sumAcrossRealIslands(island => {
                const factory = island.assetsMap.get(this.factory.guid) as Factory | undefined;
                return factory ? factory.workforceDemand.amount() : 0;
            });
        });

        this.visible = ko.computed(() => {
            if (!this.instance()?.available())
                return false;

            if (this.island().region.id != "Meta" && this.region() != this.island().region)
                return false;

            return true;
        });

        this.canSupply = ko.pureComputed(() =>
            this.instance()?.canSupply() || false
        );

        this.isDefaultSupplier = ko.pureComputed(() => {
            if (!isAggregateModeFor(this.island()))
                return this.instance()?.isDefaultSupplier() || false;

            // No single real island's default-supplier choice is coherent once summed (KTD7):
            // deterministically treat the first visible factory type as active so the product-config
            // dialog's tabs never resolve to zero active tabs (blank pane) or an arbitrary stale one.
            const visibleFactories = this.parentProduct.visibleFactories();
            return visibleFactories.length > 0 && visibleFactories[0] === this;
        });

        /**
         * The Factory whose per-island configuration the production chain is drawn from.
         *
         * Outside aggregate mode this is simply instance(). While aggregating, instance() resolves
         * to the All-Islands pseudo-island's Factory - unmodified boost, no supplier selections -
         * so a chain rendered from it is meaningless. A summed chain is not well-defined either
         * (islands can choose different suppliers for the same input, so there is no single tree),
         * so show the shape from the island producing the most of this good, driven by the
         * aggregate outputAmount. Ties break on view.islands() order, which is stable.
         */
        this.representativeInstance = ko.pureComputed(() => {
            if (!isAggregateModeFor(this.island()))
                return this.instance();

            let best: Factory | null = null;
            let bestProduction = -1;

            for (const island of view.islands()) {
                if (island.isAllIslands()) continue;

                const factory = island.assetsMap.get(this.factory.guid) as Factory | undefined;
                if (!factory) continue;

                const production = factory.currentProduction();
                if (production > bestProduction) {
                    bestProduction = production;
                    best = factory;
                }
            }

            return best ?? this.instance();
        });

        this.productionChain = new ProductionChainView(this.representativeInstance, this.outputAmount);
    }

    /**
     * Sets this factory as the default supplier for the parent product
     */
    setAsDefaultSupplier(): void {
        this.instance()?.setAsDefaultSupplier();
    }

    outputAmountFormatted(): string {
        return formatNumber(this.outputAmount()).toString() + ' t/min';
    }

    /**
     * False while this presenter shows read-only aggregate values. A plain method, not a computed -
     * see the note on isAggregateModeFor in src/aggregate.ts.
     */
    editable(): boolean {
        return !isAggregateModeFor(this.island());
    }

    incConstructedBuildings(): void {
        this.buildings().constructed(this.buildings().constructed() + 1);
    }

    canDecConstructedBuildings(): boolean {
        return this.buildings().constructed() >= 1;
    }

    decConstructedBuildings(): void {
        if (this.buildings().constructed() <= 0)
            return;

        this.buildings().constructed(this.buildings().constructed() - 1);
    }

    requiredBuildingsFormatted(): string {
        return (window as any).view.settings.decimalsForBuildings.checked() ? formatNumber( this.buildings().required()) : Math.ceil( this.buildings().required() - 0.01).toString()
    }

    isCapacityUtilizationVisible(): boolean {
        return this.buildings().constructed() >= 1 && !this.parentProduct.product.isConstructionMaterial
    }

    isProductivityVisible(): boolean {
        const factory = this.instance();
        if (!factory) return true;
        if (!factory.neededFertility) return true;
        return factory.fertilityFactor() > EPSILON;
    }

    showFertilityCheckbox(): IslandFertility | undefined {
        const factory = this.instance();
        if (!factory?.neededFertility) return undefined;
        return this.island().getVisibleIslandFertility(factory.neededFertility.guid);
    }
}

/**
 * Presenter for Product - provides product-level UI bindings and supplier management
 * Single presenter per product, aggregates all factories producing that product
 */
export class ProductPresenter {
    // === CORE PROPERTIES ===
    public instance: KnockoutComputed<Product>;
    public product: Product;
    public island: KnockoutObservable<Island>;
    public guid: number;

    // === FACTORY PRESENTERS ===
    public factoryPresenters: FactoryPresenter[];
    public visibleFactories: KnockoutComputed<FactoryPresenter[]>;
    public factoryPresenterIfDefaultSupplier: KnockoutComputed<FactoryPresenter | null>;

    // === SUPPLIER MANAGEMENT ===
    public availableSuppliers: KnockoutComputed<SupplierOption[]>;
    public availableExtraGoodSuppliers: KnockoutComputed<ExtraGoodSupplier[]>;
    public defaultSupplier: KnockoutComputed<Supplier | null>;
    public selectedSupplierOption: KnockoutObservable<SupplierOption | null>;
    

    // === ISLAND SELECTION FOR TRADE ROUTES ===
    public availableTradeIslands: KnockoutComputed<Island[]>;
    public selectedTradeIsland: KnockoutObservable<Island | null>;
    public tradeRouteAmount: KnockoutObservable<number>;
    private excessProduction: KnockoutComputed<number>;

    // === AGGREGATE CALCULATIONS ===
    public extraGoodProduction: KnockoutComputed<number>;
    public totalProduction: KnockoutComputed<number>;
    public totalDemand: KnockoutComputed<number>;
    public totalDemandNoRoutes: KnockoutComputed<number>;
    public netBalance: KnockoutComputed<number>;

    // === TRADE ROUTE MANAGEMENT ===
    public tradeList: KnockoutComputed<TradeList>;

    // === UI STATE ===
    public isHighlightedAsMissing: KnockoutComputed<boolean>;
    public name: KnockoutComputed<string>;
    public icon: KnockoutComputed<string>;
    public region: KnockoutComputed<Region | undefined>;

    public visible: KnockoutComputed<boolean>;
    public consumerViewVisible: KnockoutComputed<boolean>;
    public regionIconVisible: KnockoutComputed<boolean>;
    public tradeListVisible: KnockoutComputed<boolean>;
    public extraGoodSuppliersVisible: KnockoutComputed<boolean>;

    /**
     * Creates a new ProductPresenter instance
     * @param product - The product to present
     * @param island - The island this product belongs to (unused, kept for compatibility)
     */
    constructor(product: Product, island: KnockoutObservable<Island>) {
        if (!product) {
            throw new Error('ProductPresenter product is required');
        }

        this.product = product;
        this.island = island;
        this.instance = ko.pureComputed(() => this.island().assetsMap.get(this.product.guid) as Product);
        this.guid = this.product.guid;

        // Create factory presenters for each factory producing this product
        this.factoryPresenters = product.factories.map(f => new FactoryPresenter(f, this));

        // Filter visible factories
        this.visibleFactories = ko.pureComputed(() =>
            this.factoryPresenters.filter(fp => fp.visible())
        );

        this.factoryPresenterIfDefaultSupplier = ko.pureComputed(() => {
            if (!isAggregateModeFor(this.island())) {
                for(const factory of this.visibleFactories())
                    if(factory.isDefaultSupplier())
                        return factory;

                return null;
            }

            // A product with no visible factory type (e.g. import-only, no local producer) must
            // resolve to null here too, exactly like the non-aggregate branch above - otherwise
            // product-tile.html's `with:` binding renders a "0/0" count row for products that
            // normally show no count row at all, which overflows the tile's fixed-height layout
            // (.product-tile-attribute-group has a fixed height and doesn't grow with content).
            if (this.visibleFactories().length === 0)
                return null;

            // Same null-parity requirement when every real island is importing this product
            // (defaultSupplier is passive trade / not-obtaining / a trade route) rather than
            // producing it locally anywhere - the non-aggregate branch above returns null in that
            // case (no visible factory isDefaultSupplier()), so the aggregate branch must too.
            // Only applies when at least one real island exists - with zero real islands there is
            // no per-island choice to be consistent with, so the synthetic all-zero object is kept
            // (matches the pre-existing "zero real islands" contract, tested elsewhere).
            const realIslands = view.islands().filter((island: Island) => !island.isAllIslands());
            const producedLocallyOnSomeIsland = realIslands.some((island: Island) => {
                const product = island.assetsMap.get(this.product.guid) as Product | undefined;
                return product?.defaultSupplier()?.type === 'factory';
            });
            if (realIslands.length > 0 && !producedLocallyOnSomeIsland)
                return null;

            // A non-default factory can still carry real required demand via an extra-good supplier
            // (Factory.throughputByExtraGoodSupplier, independent of default-supplier status), so the
            // aggregate compact count sums every factory type for this product, across every real
            // island, rather than "whichever factory each island happens to default to" (KTD6/R17).
            // The returned object is a synthetic stand-in, not a real FactoryPresenter: templates/
            // product-tile.html only calls instance().buildings.constructed()/.required() and
            // requiredBuildingsFormatted() on it in the always-rendered part of the tile - the +/-
            // construction controls that would need inc/decConstructedBuildings() are gated out via
            // if:/ifnot: in a later unit (U3/KTD4), so they are never bound against this object.
            const factoryTypes = this.product.factories;

            const sumBuildingMetric = (metric: 'constructed' | 'required'): number => {
                let sum = 0;
                for (const factoryType of factoryTypes) {
                    sum += sumAcrossRealIslands(island => {
                        const factory = island.assetsMap.get(factoryType.guid) as Factory | undefined;
                        return factory ? factory.buildings[metric]() : 0;
                    });
                }
                return sum;
            };

            const aggregateInstance = {
                buildings: {
                    constructed: () => sumBuildingMetric('constructed'),
                    required: () => sumBuildingMetric('required'),
                }
            };

            return {
                instance: () => aggregateInstance,
                requiredBuildingsFormatted: (): string =>
                    window.view.settings.decimalsForBuildings.checked()
                        ? formatNumber(aggregateInstance.buildings.required())
                        : Math.ceil(aggregateInstance.buildings.required() - 0.01).toString(),
                // Names the contributing factory types (KTD6/Key Decisions) - only meaningful when
                // more than one type is being summed. Consumed by a later template unit (U3); not
                // bound anywhere yet.
                contributingFactoryNames: (): string => {
                    if (factoryTypes.length <= 1) return '';
                    return this.visibleFactories()
                        .map(fp => fp.name())
                        .filter((name): name is string => !!name)
                        .join(', ');
                },
            };
        });

        // Available suppliers for selection (excluding islands - they get separate UI)
        this.availableSuppliers = ko.pureComputed(() => {
            const suppliers: SupplierOption[] = [];

            // 1. Factory suppliers (regional factories)
            for (const factory of this.instance().availableFactories()) {
                if (factory.island === island()) {
                    suppliers.push({
                        type: 'factory',
                        supplier: factory,
                        label: factory.getRegionExtendedName(),
                        icon: factory.icon || factory.getIcon()
                    });
                }
            }

            // 2. Extra good suppliers
            const extraGoodSuppliers = this.instance().extraGoodSuppliers;
            if (extraGoodSuppliers) {
                for (const supplier of extraGoodSuppliers) {
                    if (supplier.canSupply() && supplier.island === island()) {
                        suppliers.push({
                            type: 'extra_good',
                            supplier: supplier,
                            label: `${supplier.factory.name()} (${window.view.texts.extraGoods.name()})`,
                            icon: './icons/icon_extra_goods.webp'
                        });
                    }
                }
            }

            // 3. Not obtaining (only available when no factory is available)
            if (suppliers.length === 0) {
                suppliers.push({
                    type: 'none',
                    supplier: null,
                    label: window.view.texts.notObtaining.name(),
                    icon: './icons/icon_not_obtaining.png'
                });
            }

            // 4. Passive trade (always available)
            suppliers.push({
                type: 'passive_trade',
                supplier: this.instance().passiveTradeSupplier,
                label: `${window.view.texts.traders.name()}`,
                icon: './icons/icon_trade_routes_0.webp'
            });

            return suppliers;
        });

        this.availableExtraGoodSuppliers = ko.pureComputed(() => {
            if (!isAggregateModeFor(this.island())) {
                var suppliers = [];

                const extraGoodSuppliers = this.instance().extraGoodSuppliers;
                if (extraGoodSuppliers) {
                    for (const supplier of extraGoodSuppliers) {
                        if (supplier.canSupply() && supplier.island === island()) {
                            suppliers.push(supplier);
                        }
                    }
                }

                return suppliers;
            }

            // Each real island has its own ExtraGoodSupplier instance per factory type (extra-good
            // suppliers, like factories, are per-island). Group by factory GUID across every real
            // island and sum each factory type's production (mirrors FactoryPresenter.buildings/
            // outputAmount's per-factory-type aggregation, KTD1) - a factory type is included if it
            // canSupply() on at least one real island, even if its production is currently 0 there
            // (e.g. effect enabled but no buildings constructed yet).
            const byFactoryGuid = new Map<number, { factory: Factory; island: Island; currentProduction: () => number }>();

            for (const realIsland of view.islands()) {
                if (realIsland.isAllIslands()) continue;
                const product = realIsland.assetsMap.get(this.product.guid) as Product | undefined;
                for (const supplier of product?.extraGoodSuppliers || []) {
                    if (!supplier.canSupply() || byFactoryGuid.has(supplier.factory.guid)) continue;

                    const factoryGuid = supplier.factory.guid;
                    byFactoryGuid.set(factoryGuid, {
                        factory: supplier.factory,
                        island: this.island(),
                        currentProduction: () => sumAcrossRealIslands(anIsland => {
                            const p = anIsland.assetsMap.get(this.product.guid) as Product | undefined;
                            const s = p?.extraGoodSuppliers?.find(s => s.factory.guid === factoryGuid);
                            return s ? s.currentProduction() : 0;
                        }),
                    });
                }
            }

            return Array.from(byFactoryGuid.values());
        })

        // Delegate to product's defaultSupplier
        this.defaultSupplier = ko.pureComputed(() => this.instance().defaultSupplier());

        // Selected supplier option (for binding to dropdown)
        this.selectedSupplierOption = ko.observable(null);

        this.excessProduction = ko.pureComputed(() => this.instance().excessProduction());

        // Island selection for trade route creation
        this.selectedTradeIsland = ko.observable(null);
        this.tradeRouteAmount = createFloatInput(0, 0);

        // We cannout use a computed here to get excess production and update tradeRouteAmount in one line
        // because this would override user edits in the UI: after the user entered a value,
        // the computed would be re-evaluated resulting in tradeRouteAmount being reset to excess amount
        this.excessProduction.subscribe((amount: number) => this.tradeRouteAmount(amount));
        this.tradeRouteAmount(this.excessProduction());

        this.availableTradeIslands = ko.pureComputed(() => {
            if (!this.instance().tradeList) return [];

            // Filter islands that:
            // 1. Have this product's factory available
            // 2. Are not the current island
            // 3. Don't already have a trade route
            const usedIslands = new Set<Island>();
            for (const route of this.instance().tradeList.routes()) {
                usedIslands.add(route.from);
                usedIslands.add(route.to);
            }

            var islands = view.islands().filter((i: Island) => {
                if (i === island() || i.isAllIslands()) return false;
                if (usedIslands.has(i)) return false;

                return true; // allow routes from islands without a factory to allow handling extra goods
            });

            islands.sort((a: Island, b: Island) => {
                var sIdxA = view.sessions.indexOf(a.session);
                var sIdxB = view.sessions.indexOf(b.session);
    
                if (sIdxA == sIdxB) {
                    return a.name().localeCompare(b.name());
                } else {
                    return sIdxA - sIdxB;
                }
            });

            return islands;
        });


        this.extraGoodProduction = ko.pureComputed(() => {
            if (!isAggregateModeFor(this.island()))
                return this.instance().extraGoodSuppliers?.reduce((sum,prod) => sum + prod.currentProduction(), 0);

            return sumAcrossRealIslands(island => {
                const product = island.assetsMap.get(this.product.guid) as Product | undefined;
                return product?.extraGoodSuppliers?.reduce((sum, supplier) => sum + supplier.currentProduction(), 0) || 0;
            });
        });

        // Sums one real island's production excluding trade routes (KTD3): every non-'trade_route'
        // availableSuppliers() entry (factories + extra goods) plus passiveTradeSupplier as a
        // separate term, mirroring Product.totalCurrentProduction's own shape (production.ts:253-263)
        // but never double-counting goods moved between two of the user's own islands via trade route
        // (the exporting island's own production is already counted directly; only the importing
        // island's trade_route supplier entry is excluded here).
        const nonRouteProductionFor = (island: Island): number => {
            const product = island.assetsMap.get(this.product.guid) as Product | undefined;
            if (!product) return 0;

            let sum = 0;
            for (const supplier of product.availableSuppliers()) {
                if (supplier.type !== 'trade_route')
                    sum += supplier.currentProduction();
            }
            sum += product.passiveTradeSupplier.currentProduction();
            return sum;
        };

        // Calculate total production (from all local suppliers + trade imports)
        this.totalProduction = ko.pureComputed(() => {
            if (!isAggregateModeFor(this.island()))
                return this.instance().totalDemand() + this.instance().excessProduction();

            // Mirrors the per-island formula (totalDemand + excessProduction == max(demand,
            // production), see AGENTS.md "Product demand/production reactivity") using the
            // trade-route-safe aggregate sums instead of All-Islands' own (empty) totalDemand/
            // totalCurrentProduction - the tile keeps showing "at least the demand target" even
            // when under-producing, without ever re-deriving the demand-resolution pipeline itself
            // (only summing already-computed per-island outputs, per R5).
            return Math.max(this.totalDemandNoRoutes(), sumAcrossRealIslands(nonRouteProductionFor));
        });

        // Aggregate demand
        this.totalDemand = ko.pureComputed(() => {
            if (isAggregateModeFor(this.island())) {
                return this.totalDemandNoRoutes();
            }
            return this.instance().totalDemand();
        });
        this.totalDemandNoRoutes = ko.pureComputed(() => {
            if (!isAggregateModeFor(this.island()))
                return this.instance().totalDemandNoRoutes();

            // Local consumer demand only (excludes this island's own export obligations to another
            // of the user's islands), summed across every real island (R6).
            return sumAcrossRealIslands(island => {
                const product = island.assetsMap.get(this.product.guid) as Product | undefined;
                return product ? product.totalDemandNoRoutes() : 0;
            });
        });

        // Net balance (production - demand)
        this.netBalance = ko.pureComputed(() =>
            this.totalProduction() - this.totalDemand()
        );

        // Trade route management
        this.tradeList = ko.pureComputed(() => this.instance().tradeList);

        // Determine region from factories
        this.region = ko.pureComputed(() => {
            const regions = new Set(
                this.factoryPresenters
                    .map(f => f.factory.associatedRegions[0])
                    .filter(r => r != null && r.available())
            );
            if (regions.size == 1) {
                return [...regions][0];
            }
            return undefined;
        });

        // UI properties
        this.name = ko.pureComputed(() => this.product.name());
        this.icon = ko.pureComputed(() => this.product.icon as string);

        this.isHighlightedAsMissing = ko.pureComputed(() => {
            if (!isAggregateModeFor(this.island()))
                return this.instance()?.isHighlightedAsMissing() === true;

            // The All-Islands pseudo-island's own Product never carries real demand/production
            // (isHighlightedAsMissing() on instance() is always false there), so re-derive the
            // same "required > constructed" check from the aggregate building counts already
            // computed for the compact tile count (factoryPresenterIfDefaultSupplier, KTD6) -
            // summed across every producing factory type and every real island.
            if (!window.view.settings.missingBuildingsHighlight || !window.view.settings.missingBuildingsHighlight.checked())
                return false;

            const aggregate = this.factoryPresenterIfDefaultSupplier();
            const buildings = aggregate?.instance()?.buildings;
            if (!buildings) return false;

            return buildings.required() > buildings.constructed() + ACCURACY;
         });


        this.visible = ko.computed(() => {
            if (!this.instance().available())
                return false;

            const product = this.instance();


            // Show if showAllProducts is enabled (for non-construction materials)
            if (window.view.settings.showAllProducts && window.view.settings.showAllProducts.checked())
                return true;

            if (product.isConstructionMaterial && this.visibleFactories().length > 0)
                return true;

            const extraGoodAmount = product && product.extraGoodProductionList ? product.extraGoodProductionList.amount() : 0;
            const tradeList = this.tradeList();

            // Show if there's demand for it
            if (this.totalDemand() > EPSILON)
                return true;

            // Show if there's production (extra goods, trade routes, or factories)
            if (extraGoodAmount > EPSILON || tradeList.inputAmount() > EPSILON || tradeList.outputAmount() > EPSILON)
                return true;

            for (var presenter of this.visibleFactories()){
                if (isAggregateModeFor(this.island())) {
                    if (presenter.outputAmount() > EPSILON || presenter.buildings().constructed() > 0)
                        return true;
                } else {
                    const factory = presenter.instance();
                    if (!factory) throw new Error(`Visible factory with GUID ${presenter.guid()} has no instance on island ${presenter.island().name()}`);
                    if (Math.abs(factory.throughput()) > EPSILON ||
                        factory.buildings.constructed() > 0)
                        return true;
                }
            }

            // Don't show if none of the conditions are met
            return false;
        });

        this.consumerViewVisible = ko.pureComputed(() => {
            if (isAggregateModeFor(this.island())) {
                return this.totalDemandNoRoutes() > ACCURACY;
            }
            return this.instance().totalDemand() > ACCURACY;
        });

        this.regionIconVisible = ko.pureComputed(() => this.region() != null && this.island().region != this.region());

        this.tradeListVisible = ko.pureComputed(() => this.tradeList()?.visible());

        this.extraGoodSuppliersVisible = ko.pureComputed(() => {
            if (isAggregateModeFor(this.island())) {
                return this.availableExtraGoodSuppliers().length > 0;
            }
            for(var supplier of this.availableSuppliers()){
                if (supplier.type === 'extra_good')
                    return true;
            }

            return false;
        })
    }

    /**
     * False while this presenter shows read-only aggregate values. A plain method, not a computed -
     * see the note on isAggregateModeFor in src/aggregate.ts.
     */
    editable(): boolean {
        return !isAggregateModeFor(this.island());
    }

    /**
     * Whether the Trading tab is the active pane. Must be the exact complement of "some visible
     * factory reports isDefaultSupplier()", or product-config-dialog.html gives two panes
     * `show active` at once and they render stacked. While aggregating, the pseudo-island's own
     * defaultSupplier() is meaningless (usually unset, and any non-factory choice left over from
     * a real-island session survives here), so ask the factory presenters directly - they already
     * implement the aggregate "first visible factory is active" rule.
     */
    showTradeRouteTab(): boolean {
        if (isAggregateModeFor(this.island()))
            return !this.visibleFactories().some(f => f.isDefaultSupplier());

        return this.defaultSupplier()?.type != "factory";
    }

    /**
     * Handles supplier selection from dropdown
     * @param option - The selected supplier option
     */
    selectSupplier(option: SupplierOption): void {
        if (!option) return;

        this.instance().updateDefaultSupplier(option.supplier);
    }

    /**
     * Creates a trade route from selected island
     */
    createExportTradeRoute(): void {
        if(!this.canCreateExportTradeRoute())
            return;

        const island = this.selectedTradeIsland();
        if (!island) return;

        const amount = this.tradeRouteAmount() || 0;

        const route = new TradeRoute(
            this.product.guid,
            this.island(),
            island,
            amount
        );

        route.fromIslandProduct.tradeList.routes.push(route);
        route.toIslandProduct.tradeList.routes.push(route);
        view.tradeManager.add(route);

        // Reset form
        this.selectedTradeIsland(null);
        this.tradeRouteAmount(0);
    }

    /**
     * Creates a trade route from selected island
     */
    createImportTradeRoute(): void {
        const island = this.selectedTradeIsland();
        if (!island) return;

        if (!this.canCreateImportTradeRoute())
            return;

        const route = new TradeRoute(
            this.product.guid,
            island,
            this.island(),
            0
        );

        route.fromIslandProduct.tradeList.routes.push(route);
        route.toIslandProduct.tradeList.routes.push(route);
        view.tradeManager.add(route);

        // Set as default supplier if importing
        this.instance().updateDefaultSupplier(route);

        // Reset form
        this.selectedTradeIsland(null);
    }

    /**
     * Checks if trade route can be created
     */
    canCreateExportTradeRoute(): boolean {
        return this.selectedTradeIsland() != null && this.tradeRouteAmount() > EPSILON;
    }

    canCreateImportTradeRoute(): boolean {
        // ensure we do not create a cycle
        return this.selectedTradeIsland() != null && !this.selectedTradeIsland()?.assetsMap.get(this.guid).isSuppliedFrom(this.instance())!;
    }

    /**
     * Opens product config dialog
     */
    openConfigDialog(): void {
        view.selectedProduct(this);
        $('#product-config-dialog').modal('show');
    }

    /**
     * Gets label for current default supplier
     */
    getDefaultSupplierLabel(): string {
        const supplier = this.defaultSupplier();
        if (!supplier) return window.view.texts.notObtaining.name();

        for (const option of this.availableSuppliers())
            if (option.supplier == supplier)
                return option.label;

        if (supplier.type == "trade_route" || supplier.type == "passive_trade")
            return `${window.view.texts.trading.name()}`

        return 'Unknown';
    }

    /**
     * Gets icon for current default supplier
     */
    getDefaultSupplierIcon(): string {
        const supplier = this.defaultSupplier();
        if (!supplier) return './icons/icon_not_obtaining.png';

        for (const option of this.availableSuppliers())
            if (option.supplier == supplier)
                return option.icon;

        if (supplier.type == "trade_route" || supplier.type == "passive_trade")
            return './icons/icon_trade_routes_0.webp'

        return '';
    }

    tradingAmountFormatted(): string{
        return formatNumber(this.tradeList().amount() + this.instance().passiveTradeSupplier.currentProduction()) + ' t/min';
    }
}

/**
 * Presenter for ProductCategory - provides category-level UI bindings
 * Wraps ProductCategory and filters productPresenters by category's products
 */
export class CategoryPresenter {
    // === CORE PROPERTIES ===
    public instance: KnockoutObservable<ProductCategory>;
    public category: ProductCategory;
    public island: KnockoutObservable<Island>;

    // === DELEGATED PROPERTIES ===
    public guid: KnockoutComputed<number>;
    public name: KnockoutComputed<string>;

    // === PRODUCT PRESENTERS ===
    public productPresenters: ProductPresenter[];

    /**
     * Creates a new CategoryPresenter instance
     * @param category - The product category to present
     * @param island - The island this category belongs to
     */
    constructor(category: ProductCategory, island: KnockoutObservable<Island>) {
        if (!category) {
            throw new Error('CategoryPresenter category is required');
        }
        if (!island) {
            throw new Error('CategoryPresenter island is required');
        }

        this.category = category;
        this.island = island;
        this.instance = ko.computed(() => this.island().assetsMap.get(category.guid));

        // Delegate to category properties
        this.guid = ko.pureComputed(() => this.category.guid);
        this.name = ko.pureComputed(() => this.category.name());

        // Filter product presenters for products in this category
        this.productPresenters = [];
        
        for (const product of category.products)
            this.productPresenters.push(new ProductPresenter(product, island));

    }
}
