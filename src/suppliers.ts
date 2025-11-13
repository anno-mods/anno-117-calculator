import { createFloatInput, EPSILON, ko } from './util';
import { ExtraGoodProduction, Product } from './production';
import { Island } from './world';
import { Factory } from './factories';

/**
 * Supplier interface - represents any source that can provide a product
 * Implemented by Factory, TradeRoute, PassiveTradeSupplier, and ExtraGoodSupplier
 */
export interface Supplier {
    // Identification
    readonly type: 'factory' | 'trade_route' | 'passive_trade' | 'extra_good';
    readonly product: Product;

    // Production capabilities
    defaultProduction(): number;           // Current/baseline production amount
    currentProduction(): number;
    canSupply(): boolean;    // Can this supplier fulfill amount?

    isDefaultSupplier(): boolean;
    setAsDefaultSupplier(): void;

    // Demand integration
    setDemand(amount: number): void;       // Request supplier to produce/import amount
    unsetAsDefaultSupplier(): void;  // called by product when default supplier changes
}

/**
 * Type guard to check if an object implements the Supplier interface
 */
export function isSupplier(obj: any): obj is Supplier {
    return obj != null &&
        typeof obj.type === 'string' &&
        (obj.type === 'factory' || obj.type === 'trade_route' || obj.type === 'passive_trade' || obj.type === 'extra_good') &&
        obj.product instanceof Product
}

/**
 * PassiveTradeSupplier - "Joker" supplier that fulfills demand without generating upstream demands
 * Useful for representing external sources or simplified scenarios
 */
export class PassiveTradeSupplier implements Supplier {
    public readonly type: 'passive_trade' = 'passive_trade';
    public readonly product: Product;
    public readonly island: Island;
    public amount: KnockoutObservable<number>;
    public userSetAmount: KnockoutObservable<number>;

    /**
     * Creates a new PassiveTradeSupplier instance
     * @param product - The product this supplier provides
     * @param island - The island this supplier operates on
     */
    constructor(product: Product, island: Island) {
        if (!product) {
            throw new Error('PassiveTradeSupplier product is required');
        }
        if (!island) {
            throw new Error('PassiveTradeSupplier island is required');
        }

        this.product = product;
        this.island = island;
        this.amount = ko.observable(0);
        this.userSetAmount = createFloatInput(0, 0);
    }

    /**
     * Only used if needed
     */
    defaultProduction(): number {
        if (this.isDefaultSupplier())
            return 0; // when set as default supplier, userSetAmount is ignored

        return this.userSetAmount(); 
    }

    currentProduction(): number {
        if (this.isDefaultSupplier())
            return this.amount();

        return this.userSetAmount();
    }

    /**
     * Passive trade can always supply any amount (user responsibility)
     */
    canSupply(): boolean {
        return true;
    }

    isDefaultSupplier(): boolean {
        return this.product.defaultSupplier() === this;
    }

    setAsDefaultSupplier(): void {
        if (!this.canSupply())
            return;

        this.product.updateDefaultSupplier(this);
    }

    /**
     * Passive trade doesn't propagate demand
     */
    setDemand(amount: number): void {
        this.amount(amount);
    }

    /**
     * Passive trade doesn't propagate demand
     */
    unsetAsDefaultSupplier(): void {
        this.amount(this.userSetAmount());
    }
}

/**
 * ExtraGoodSupplier - Represents extra good production from items
 * Contains filtered list of ExtraGoodProduction entries where factory produces extra of its own output
 * (i.e., factory and product are identical, but AppliedBuff can differ)
 */
export class ExtraGoodSupplier implements Supplier {
    public readonly type: 'extra_good' = 'extra_good';
    public readonly factory: Factory;
    public readonly product: Product; // Extra good product
    public readonly island: Island;
    public productionList: ExtraGoodProduction[]; // ExtraGoodProduction[] - filtered entries where factory outputs this product

    public readonly throughput: KnockoutObservable<number>;

    /**
     * Creates a new ExtraGoodSupplier instance
     * @param product - The product this supplier provides
     * @param island - The island this supplier operates on
     */
    constructor(factory: Factory, extraGood: Product, island: Island) {
        if (!factory) {
            throw new Error('ExtraGoodSupplier factory is required');
        }
        if (!extraGood) {
            throw new Error('ExtraGoodSupplier product is required');
        }
        if (!island) {
            throw new Error('ExtraGoodSupplier island is required');
        }

        this.factory = factory;
        this.product = extraGood;        
        this.island = island;
        this.productionList = []; // Will be populated by ExtraGoodProduction entries
        this.throughput = ko.observable(0);
    }

    private getTotalRatio(): number {
        let totalRatio = 0;
        for (const entry of this.productionList) {
            if (entry && entry.item && entry.factory) {
                const scaling = typeof entry.item.scaling === 'function' ? entry.item.scaling() : entry.item.scaling;
                totalRatio += (scaling * entry.defaultAmount) / entry.additionalOutputCycle;
            }
        }
        return totalRatio;
    }

    defaultProduction(): number {
        // other demands determine the throughput of the factory
        if (this.throughput() + EPSILON < this.factory.throughput())
            return this.currentProduction();

        var otherThroughput = Math.max(this.factory.throughputByExistingBuildings(), this.factory.throughputByOutput());
        
        if (otherThroughput < EPSILON)
            return 0;
        
        return this.factory.throughput() / otherThroughput * this.currentProduction();

    }

    /**
     * Returns the total amount from all extra goods production entries
     * Sum of all ExtraGoodProduction.amount() in the list
     */
    currentProduction(): number {
        let total = 0;
        for (const entry of this.productionList) {
            if (entry && typeof entry.amount === 'function') {
                total += entry.amount();
            }
        }
        return total;
    }

    /**
     * Extra supplier can supply if there is at least one extra good production active.
     */
    canSupply(): boolean {
        return this.product != this.factory.product && this.getTotalRatio() > 0;
    }

    isDefaultSupplier(): boolean {
        return this.product.defaultSupplier() === this;
    }

    setAsDefaultSupplier(): void {
        if (!this.canSupply())
            return;

        this.product.updateDefaultSupplier(this);
    }

    /**
     * Sets demand for extra goods production by increasing factory production
     * Calculates required factory inputAmount to meet extra good production target
     * @param amount - Requested extra good production amount
     */
    setDemand(amount: number): void {
        if (amount <= 0 || this.productionList.length === 0) return;

        // Calculate the production ratio: extra_good_amount per factory_input_amount
        // For each entry: entry.amount() = item.scaling() * defaultAmount * factory.inputAmount / additionalOutputCycle
        // Total ratio = sum of (item.scaling() * defaultAmount / additionalOutputCycle)
        const totalRatio = this.getTotalRatio();

        if (totalRatio > 0) {
            // Required factory inputAmount = requested amount / ratio
            const requiredInputAmount = amount / totalRatio;

            this.throughput(requiredInputAmount);

        }
    }

    /**
     * Must only be called from product within the updateDefaultSupplier method
     */
    unsetAsDefaultSupplier(): void {
        this.throughput(0);
    }
}
