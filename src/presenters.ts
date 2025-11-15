import { ACCURACY, BuildingsCalc, createFloatInput, EPSILON, formatNumber, ko } from './util';
import { AppliedBuff, Product, ProductCategory } from './production';
import { Factory, Module } from './factories';
import { Island, Region } from './world';
import { ExtraGoodSupplier, Supplier } from './suppliers';
import { TradeRoute, TradeList } from './trade';
import { ProductionChainView } from './views';

declare const $: any;
declare const view: any;

/**
 * Option for supplier selection dropdown
 */
export interface SupplierOption {
    type: 'factory' | 'extra_good' | 'passive_trade';
    supplier: Supplier;
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
    public visible: KnockoutComputed<boolean>;
    public canSupply: KnockoutComputed<boolean>;
    public isDefaultSupplier: KnockoutComputed<boolean>;
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
        this.buildings = ko.pureComputed(() => this.instance()?.buildings || 0);
        this.boost = ko.pureComputed(() => this.instance()?.boost() || 1);
        this.outputAmount = ko.pureComputed(() => this.instance()?.outputAmount() || 0);
        this.modules = ko.pureComputed(() => this.instance()?.modules || []);
        this.items = ko.pureComputed(() => this.instance()?.availableItems() || []);

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

        this.isDefaultSupplier = ko.pureComputed(() =>
            this.instance()?.isDefaultSupplier() || false
        );

        this.productionChain = new ProductionChainView(this.instance, this.outputAmount);
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
    public excessProductionSubscription: KnockoutComputed<void>;

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
            for(const factory of this.visibleFactories())
                if(factory.isDefaultSupplier())
                    return factory;

            return null;
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
                            icon: './icons/icon_add_goods_socket_white.png'
                        });
                    }
                }
            }

            // 3. Passive trade (always available)
            suppliers.push({
                type: 'passive_trade',
                supplier: this.instance().passiveTradeSupplier,
                label: `${window.view.texts.traders.name()}`,
                icon: './icons/icon_shiptrade.png'
            });

            return suppliers;
        });

        this.availableExtraGoodSuppliers = ko.pureComputed(() => {
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
        })

        // Delegate to product's defaultSupplier
        this.defaultSupplier = ko.pureComputed(() => this.instance().defaultSupplier());

        // Selected supplier option (for binding to dropdown)
        this.selectedSupplierOption = ko.observable(null);

        // Island selection for trade route creation
        this.selectedTradeIsland = ko.observable(null);
        this.tradeRouteAmount = createFloatInput(0, 0);

        this.excessProductionSubscription = ko.pureComputed(() => { // pure Computed to avoid re-calculation when tradeRouteAmount is set
            this.tradeRouteAmount(this.instance().excessProduction());
        });

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


        this.extraGoodProduction = ko.pureComputed(() => this.instance().extraGoodSuppliers?.reduce((sum,prod) => sum + prod.currentProduction(), 0));


        // Calculate total production (from all local suppliers + trade imports)
        this.totalProduction = ko.pureComputed(() => this.instance().totalDemand() + this.instance().excessProduction());
        
        // Aggregate demand
        this.totalDemand = ko.pureComputed(() => this.instance().totalDemand());
        this.totalDemandNoRoutes = ko.pureComputed(() => this.instance().totalDemandNoRoutes());

        // Net balance (production - demand)
        this.netBalance = ko.pureComputed(() =>
            this.totalProduction() - this.totalDemand()
        );

        // Trade route management
        this.tradeList = ko.pureComputed(() => this.instance().tradeList);

        // Determine region from factories
        this.region = ko.pureComputed(() => {
            const factories = this.visibleFactories();
            if (factories.length > 0) {
                return factories[0].region();
            }
            return undefined;
        });

        // UI properties
        this.name = ko.pureComputed(() => this.product.name());
        this.icon = ko.pureComputed(() => this.product.icon as string);

        this.isHighlightedAsMissing = ko.pureComputed(() => {
            const supplier = this.defaultSupplier();

            if(!(supplier instanceof Factory))
                return false;

            return supplier.isHighlightedAsMissing();
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
                const factory = presenter.instance();
                if (!factory) throw new Error(`Visible factory with GUID ${presenter.guid()} has no instance on island ${presenter.island().name()}`);
                if (Math.abs(factory.throughput()) > EPSILON ||
                    factory.buildings.constructed() > 0)
                    return true;
            }

            // Don't show if none of the conditions are met
            return false;
        });

        this.consumerViewVisible = ko.pureComputed(() => this.instance().totalDemand() > ACCURACY);

        this.regionIconVisible = ko.pureComputed(() => this.island().region.id == "Meta");

        this.tradeListVisible = ko.pureComputed(() => this.tradeList()?.visible());

        this.extraGoodSuppliersVisible = ko.pureComputed(() => {
            for(var supplier of this.availableSuppliers()){
                if (supplier.type === 'extra_good')
                    return true;
            }

            return false;
        })
    }

    showTradeRouteTab(): boolean{
        return this.defaultSupplier()?.type != "factory"
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
        if (!supplier) return 'None';

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
        if (!supplier) return '';

        for (const option of this.availableSuppliers())
            if (option.supplier == supplier)
                return option.icon;

        if (supplier.type == "trade_route" || supplier.type == "passive_trade")
            return './icons/icon_shiptrade.png'

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
