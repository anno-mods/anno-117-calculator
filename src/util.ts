import { 
  NamedElementConfig, 
  OptionConfig, 
  DLCConfig, 
  NumberInputHandlerParams, 
  NumericBounds,
  LocaTextConfig
} from './types';
import { NeedConsumptionConfig } from './types.config';

declare const $: any;
declare const window: any;

export const ko = require("knockout");
require("knockout-amd-helpers");

// Set up module context for dynamic imports - exclude .md files
const moduleContext = (require as any).context(".", true, /^(?!.*\.md$).*$/);
const templateContext = (require as any).context("../templates", true, /\.html$/);

/**
 * Custom module loader for Knockout AMD helpers
 * @param moduleName - Name of the module to load
 * @param done - Callback function to execute when module is loaded
 */
ko.bindingHandlers.module.loader = function (moduleName: string, done: Function) {
    const mod = moduleContext("./" + moduleName);
    done(mod);
};

ko.amdTemplateEngine.defaultSuffix = ".html";
/**
 * Custom template loader for Knockout AMD template engine
 * @param templateName - Name of the template to load
 * @param done - Callback function to execute when template is loaded
 */
ko.amdTemplateEngine.loader = function (templateName: string, done: Function) {
    const template = templateContext("./" + templateName + ko.amdTemplateEngine.defaultSuffix);
    done(template.default);
};

/** Version string for the calculator application */
export let versionCalculator = "1.2";
/** Flag indicating if this is a preview version */
export let isPreview = false;
/** Accuracy threshold for floating point comparisons */
export let ACCURACY = 0.01;
/** Very small epsilon value for precise floating point comparisons */
export let EPSILON = 0.0000001;
/** Special identifier for "All Islands" view */
export let ALL_ISLANDS = "All Islands";

/**
 * When resetting the default supplier this method returns a factory GUID
 * if the standard procedure should not be applied. Otherwise it returns null
 */
export function getForcedDefaultSupplier(regionID: string | undefined, productGUID: number): number | null {
    if(regionID == "Meta" || regionID == "Roman")
        if (productGUID == 31697)
            return 31753

    return null
}


/** Number formatter using the browser's locale */
const formater = new Intl.NumberFormat(navigator.language || "en").format;

/**
 * Formats a number according to the browser's locale with optional sign
 * @param num - The number to format
 * @param forceSign - Whether to force a plus sign for positive numbers
 * @returns The formatted number string
 */
export function formatNumber(num: number | string, forceSign: boolean = false): string {
    const rounded = Math.ceil(100 * parseFloat(String(num))) / 100;
    if (Math.abs(rounded) < EPSILON)
        return "0";
    const str = formater(rounded);
    if (forceSign && rounded > EPSILON)
        return '+' + str;
    return str;
}



/**
 * Handles number input with mouse wheel support and keyboard modifiers
 * Provides increment/decrement functionality with configurable step sizes
 */
export class NumberInputHandler {
    private obs: KnockoutObservable<number>;
    private id: string;
    private max: number;
    private min: number;
    private step: number;
    private input: any;

    /**
     * Creates a new NumberInputHandler instance
     * @param params - Configuration parameters
     */
    constructor(params: NumberInputHandlerParams) {
        // Validate required parameters
        if (!params) {
            throw new Error('NumberInputHandler params is required');
        }
        if (!params.obs) {
            throw new Error('NumberInputHandler params.obs is required');
        }
        if (!params.id) {
            throw new Error('NumberInputHandler params.id is required');
        }

        // Explicit assignments
        this.obs = params.obs;
        this.id = params.id;
        this.max = parseFloat($('#' + this.id).attr('max') || 'Infinity');
        this.min = parseFloat($('#' + this.id).attr('min') || '-Infinity');
        this.step = parseFloat($('#' + this.id).attr('step') || '1');
        this.input = $('#' + this.id);
        
        if (this.input.length != 1)
            console.log("Invalid binding", this.id, this.input);
            
        this.input.on("wheel", (evt: WheelEvent) => {
            if (document.activeElement !== this.input.get(0))
                return;

            evt.preventDefault();
            const deltaY = evt.deltaY || (evt as any).originalEvent?.deltaY;
            const sign = -Math.sign(deltaY);
            const factor = this.getInputFactor(evt);

            const val = parseFloat(this.obs() as any) + sign * factor * this.step + ACCURACY;
            const clampedVal = Math.max(this.min, Math.min(this.max, val));
            this.obs(Math.floor(clampedVal / this.step) * this.step);

            return false;
        });
    }

    /**
     * Gets the input factor based on keyboard modifiers
     * @param evt - The wheel event
     * @returns The factor to multiply the step by
     */
    private getInputFactor(evt: WheelEvent): number {
        let factor = 1;
        if (evt.ctrlKey)
            factor *= 10;
        if (evt.shiftKey)
            factor *= 100;
        return factor;
    }
}

/**
 * Formats a number as a percentage with optional sign
 * @param number - The number to format as percentage
 * @param forceSign - Whether to force a plus sign for positive numbers
 * @returns The formatted percentage string
 */
export function formatPercentage(number: number | string, forceSign: boolean = true): string {
    return window.formatNumber(Math.ceil(10 * parseFloat(String(number))) / 10, forceSign) + ' %';
}

/**
 * Delays updating an observable to prevent rapid successive updates
 * @param obs - The observable to update
 * @param val - The value to set
 */
export function delayUpdate(obs: KnockoutObservable<any>, val: any): void {
    const version = (obs as any).getVersion ? (obs as any).getVersion() : obs();
    setTimeout(() => {
        if ((obs as any).getVersion && !(obs as any).hasChanged(version) || version === obs())
            obs(val);
    });
}

/**
 * Knockout extender for numeric input validation and formatting
 * Provides bounds checking, precision control, and custom callbacks
 * @param target - The target observable
 * @param bounds - Configuration object for bounds and behavior
 * @returns A computed observable with numeric validation
 */
(ko as any).extenders.numeric = function (target: KnockoutObservable<number>, bounds: NumericBounds): KnockoutComputed<number> {
    //create a writable computed observable to intercept writes to our observable
    const result = ko.computed({
        read: target,  //always return the original observables value
        write: function (newValue: any) {
            const current = target();

            let valueToWrite: number;
            if (bounds.precision === 0)
                valueToWrite = parseInt(newValue);
            else if (bounds.precision) {
                const roundingMultiplier = Math.pow(10, bounds.precision);
                const newValueAsNum = isNaN(newValue) ? 0 : +newValue;
                valueToWrite = Math.round(newValueAsNum * roundingMultiplier) / roundingMultiplier;
            } else {
                valueToWrite = parseFloat(newValue);
            }

            if (!isFinite(valueToWrite) || valueToWrite == null) {
                if (newValue != current)
                    target.notifySubscribers(); // reset input field
                return;
            }

            if (valueToWrite > bounds.max)
                valueToWrite = bounds.max;

            if (valueToWrite < bounds.min)
                valueToWrite = bounds.min;

            if (bounds.callback && typeof bounds.callback === "function") {
                const callbackResult = bounds.callback(valueToWrite, current, newValue);
                if (callbackResult == null)
                    return;
                valueToWrite = callbackResult;
            }

            //only write if it changed
            if (valueToWrite !== current || newValue !== valueToWrite) {
                if ((result as any)._state && (result as any)._state.isBeingEvaluated) {
                    console.log("cycle detected, propagation stops");
                    return;
                }
                target(valueToWrite);
            }
        }
    });

    return result as any;
};

/**
 * Creates an integer input observable with validation
 * @param init - Initial value
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param callback - Optional callback function for custom validation
 * @returns A knockout observable with integer validation
 */
export function createIntInput(init: number, min: number = -Infinity, max: number = Infinity, callback: ((value: number, current: number, newValue: any) => number | null) | null = null): KnockoutObservable<number> {
    const obs = ko.observable(init);
    return obs.extend({ numeric: { precision: 0, min, max, callback } }) as any;
}

/**
 * Creates a float input observable with validation
 * @param init - Initial value
 * @param min - Minimum allowed value
 * @param max - Maximum allowed value
 * @param callback - Optional callback function for custom validation
 * @returns A knockout observable with float validation
 */
export function createFloatInput(init: number, min: number = -Infinity, max: number = Infinity, callback: ((value: number, current: number, newValue: any) => number | null) | null = null): KnockoutObservable<number> {
    const obs = ko.observable(init);
    return obs.extend({ numeric: { min, max, callback } }) as any;
}

/**
 * Base class for named elements in the application
 * Provides common functionality for all named objects
 */
export class NamedElement {
    public name: KnockoutComputed<string>;
    public guid?: number;
    public id?: string;
    public locaText: LocaTextConfig | { [key: string]: string };
    public icon?: string;
    public dlcs?: DLC[];
    public available: KnockoutComputed<boolean>;
    public notes?: KnockoutObservable<string>;
    public dependentObjects?: KnockoutObservableArray<any>;
    public dlcLockingObservables: any[];

    /**
     * Creates a new NamedElement instance
     * @param config - Configuration object for the named element
     */
    constructor(config: NamedElementConfig) {
        // Validate required parameters
        if (!config) {
            throw new Error('NamedElement config is required');
        }

        // Explicit assignments
        if (config.guid)
            this.guid = config.guid;
        if (config.id)
            this.id = config.id;
        this.locaText = config.locaText || {};
        
        // Create computed name that uses localization
        this.name = ko.computed(() => {
            const view = window.view;
            if (!view || !view.settings) {
                return config.name || "";
            }

            const lang = view.settings.language() as string
            if (lang in this.locaText){            
                let text = this.locaText[lang];
                if (text) {
                    return text;
                }
            }

            let text = this.locaText["english"];
            return text ? text : (config.name || "");
        });

        // Set up icon from params if available
        const params = window.params;
        if (config.iconPath && params && params.icons) {
            this.icon = params.icons[config.iconPath];
        }

        // Set up DLC management
        this.available = ko.pureComputed(() => true);
        this.dlcLockingObservables = [];
    }

    /**
     * Locks an observable to a specific DLC if this element has only one DLC
     * @param obs - The observable to lock
     */
    lockDLCIfSet(obs: any): void {
        if (!this.dlcs || this.dlcs.length !== 1) {
            return;
        }

        this.dlcLockingObservables.push(obs);
        this.dlcs[0].addDependentObject(obs);
    }

    /**
     * Removes DLC dependencies when this element is deleted
     */
    delete(): void {
        if (!this.dlcs || this.dlcs.length !== 1) {
            return;
        }

        for (const obs of this.dlcLockingObservables) {
            this.dlcs[0].removeDependentObject(obs);
        }
    }
}

export class NeedConsumptionSetting extends NamedElement {
    public consumptionFactor: number

    constructor(config: NeedConsumptionConfig){
        super(config);
        this.id = config.id;
        this.consumptionFactor = config.consumptionFactor;
    }
}

/**
 * Represents an option that can be checked/unchecked
 * Extends NamedElement with checkbox functionality
 */
export class Option extends NamedElement {
    public checked: KnockoutObservable<boolean>;
    public visible: KnockoutObservable<boolean>;

    /**
     * Creates a new Option instance
     * @param config - Configuration object for the option
     */
    constructor(config: OptionConfig) {
        super(config);
        
        // Explicit assignments
        this.checked = ko.observable(config.checked || false) as any;
        this.visible = ko.observable(!!config);
    }
}

/**
 * Represents a DLC (Downloadable Content) option
 * Extends Option with dependency management
 */
export class DLC extends Option {
    public dependentObjects: KnockoutObservableArray<any>;
    public used: KnockoutComputed<boolean>;
    public id: string;

    /**
     * Creates a new DLC instance
     * @param config - Configuration object for the DLC
     */
    constructor(config: DLCConfig) {
        super(config);
        
        // Explicit assignments
        this.id = config.id || '';
        this.dependentObjects = ko.observableArray(config.dependentObjects || []).extend({ deferred: true }) as any;

        // Create the used computed observable
        this.used = ko.pureComputed(() => {
            for (const obs of this.dependentObjects()) {
                if (obs() != 0) // can be int, float or bool -> non-strict comparison
                    return true;
            }
            return false;
        }) as any;

        // Subscribe to used changes to auto-check the DLC
        this.used.subscribe(() => {
            if (this.used()) {
                this.checked(true);
            }
        });
    }

    /**
     * Adds a dependent object to this DLC
     * @param obs - The dependent observable
     */
    addDependentObject(obs: KnockoutObservable<any>): void {
        this.dependentObjects.push(obs);
    }

    /**
     * Removes a dependent object from this DLC
     * @param obs - The dependent observable
     */
    removeDependentObject(obs: KnockoutObservable<any>): void {
        this.dependentObjects.remove(obs);
    }
} 

export class BuildingsCalc {
    public fullyUtilizeConstructed: KnockoutObservable<boolean>;
    public constructed: KnockoutObservable<number>;
    public planned: KnockoutObservable<number>;
    public required: KnockoutObservable<number>; // set by parent class
    public utilized: KnockoutComputed<number>;


    constructor(){
        this.fullyUtilizeConstructed = ko.observable(false);
        this.constructed = ko.observable(0);
        this.planned = ko.observable(0);
        this.required = ko.observable(0);
        this.utilized = ko.computed(() => this.fullyUtilizeConstructed() ? Math.max(this.constructed(), this.required()) : this.required());   

    }


}

/**
 * Creates a dummy observable that logs an error when accessed before proper initialization
 * @param name - The name of the observable for error reporting
 * @returns A dummy observable that logs errors on access
 */
export function dummyObservable<T = any>(name: string): KnockoutObservable<T> {
  const obs = function(value?: T) {
    if (arguments.length === 0) {
      console.error(`[DummyObservable] Attempted to read uninitialized observable: ${name}`);
      return undefined as any;
    } else {
      console.error(`[DummyObservable] Attempted to write to uninitialized observable: ${name}`, value);
    }
  } as KnockoutObservable<T>;
  obs.subscribe = () => { console.error(`[DummyObservable] subscribe on ${name}`); return { dispose: () => {} } as any; };
  obs.extend = () => obs;
  obs.notifySubscribers = () => { console.error(`[DummyObservable] notifySubscribers on ${name}`); };
  return obs;
}

/**
 * Creates a dummy observable array that logs an error when accessed before proper initialization
 * @param name - The name of the observable array for error reporting
 * @returns A dummy observable array that logs errors on access
 */
export function dummyObservableArray<T = any>(name: string): KnockoutObservableArray<T> {
  const obsArray = function(value?: T[]) {
    if (arguments.length === 0) {
      console.error(`[DummyObservableArray] Attempted to read uninitialized observable array: ${name}`);
      return [] as any;
    } else {
      console.error(`[DummyObservableArray] Attempted to write to uninitialized observable array: ${name}`, value);
    }
  } as KnockoutObservableArray<T>;
  
  // Array methods
  obsArray.push = () => { console.error(`[DummyObservableArray] push on ${name}`); return 0; };
  obsArray.pop = () => { console.error(`[DummyObservableArray] pop on ${name}`); return undefined as any; };
  obsArray.shift = () => { console.error(`[DummyObservableArray] shift on ${name}`); return undefined as any; };
  obsArray.unshift = () => { console.error(`[DummyObservableArray] unshift on ${name}`); return 0; };
  obsArray.splice = () => { console.error(`[DummyObservableArray] splice on ${name}`); return [] as any; };
  obsArray.reverse = () => { console.error(`[DummyObservableArray] reverse on ${name}`); return obsArray; };
  obsArray.sort = () => { console.error(`[DummyObservableArray] sort on ${name}`); return obsArray; };
  obsArray.remove = () => { console.error(`[DummyObservableArray] remove on ${name}`); return [] as any; };
  obsArray.removeAll = () => { console.error(`[DummyObservableArray] removeAll on ${name}`); return [] as any; };
  obsArray.destroy = () => { console.error(`[DummyObservableArray] destroy on ${name}`); return [] as any; };
  obsArray.destroyAll = () => { console.error(`[DummyObservableArray] destroyAll on ${name}`); return [] as any; };
  obsArray.replace = () => { console.error(`[DummyObservableArray] replace on ${name}`); return [] as any; };
  
  // Observable methods
  obsArray.subscribe = () => { console.error(`[DummyObservableArray] subscribe on ${name}`); return { dispose: () => {} } as any; };
  obsArray.extend = () => obsArray;
  obsArray.notifySubscribers = () => { console.error(`[DummyObservableArray] notifySubscribers on ${name}`); };
  
  return obsArray;
}

/**
 * Creates a dummy method that logs an error when called before proper initialization
 * @param name - The name of the method for error reporting
 * @returns A dummy method that logs errors on call
 */
export function dummyMethod(name: string): any {
  return function() {
    console.error(`[DummyMethod] Attempted to call uninitialized method: ${name}`);
  };
}

/**
 * Creates a dummy computed that logs an error when accessed before proper initialization
 * @param name - The name of the computed for error reporting
 * @returns A dummy computed that logs errors on access
 */
export function dummyComputed<T = any>(name: string): KnockoutComputed<T> {
  const computed = function() {
    console.error(`[DummyComputed] Attempted to read uninitialized computed: ${name}`);
    return undefined as any;
  } as KnockoutComputed<T>;
  computed.subscribe = () => { console.error(`[DummyComputed] subscribe on ${name}`); return { dispose: () => {} } as any; };
  computed.notifySubscribers = () => { console.error(`[DummyComputed] notifySubscribers on ${name}`); };
  return computed;
}

// ============================================================================
// KNOCKOUT BINDING DEBUGGING UTILITIES
// ============================================================================

/**
 * Interface for debug binding information
 */
export interface DebugBindingInfo {
    element: HTMLElement;
    data: unknown;
    dataType: string;
    isObservable: boolean;
    bindingContext: {
        $data: unknown;
        $root: unknown;
        $parent?: unknown;
        $parents?: unknown[];
    };
    assetInfo?: {
        guid?: number;
        name?: string;
        type?: string;
        region?: string;
    };
}

/**
 * Check if object is a Knockout observable or computed
 * @param obj - Object to check
 * @returns Boolean indicating if object is observable
 */
export function isKnockoutObservable(obj: unknown): boolean {
    if (!obj) return false;
    return ko.isObservable(obj) || ko.isComputed(obj) || ko.isObservableArray(obj);
}

/**
 * Safely unwrap observable and return its value
 * Handles non-observables gracefully
 * @param value - Value to unwrap
 * @returns Unwrapped value or original value if not observable
 */
export function safeUnwrap(value: unknown): unknown {
    if (ko.isObservable(value)) {
        try {
            return (value as KnockoutObservable<unknown>)();
        } catch (e) {
            return '[Write-only observable]';
        }
    }
    return value;
}

/**
 * Get type information about a bound asset
 * @param data - The bound data object
 * @returns String describing the asset type
 */
export function getAssetType(data: unknown): string {
    if (!data) return 'null/undefined';

    // Check if it's a Template wrapper
    if (typeof data === 'object' && data !== null && 'instance' in data && isKnockoutObservable((data as Record<string, unknown>).instance)) {
        const unwrapped = safeUnwrap((data as Record<string, unknown>).instance);
        return `Template(${getAssetType(unwrapped)})`;
    }

    // Check for NamedElement properties
    if (typeof data === 'object' && data !== null) {
        const obj = data as Record<string, unknown>;

        // Try to determine class name from constructor
        const constructorName = obj.constructor?.name;
        if (constructorName && constructorName !== 'Object') {
            return constructorName;
        }

        // Check for common NamedElement properties
        if ('guid' in obj && 'name' in obj) {
            return 'NamedElement';
        }
    }

    // Check if it's an observable
    if (isKnockoutObservable(data)) {
        const unwrapped = safeUnwrap(data);
        return `Observable(${getAssetType(unwrapped)})`;
    }

    // Fallback to typeof
    return typeof data;
}

/**
 * Extract asset information from a bound object
 * @param data - The bound data object
 * @returns Object with asset properties
 */
function extractAssetInfo(data: unknown): { guid?: number; name?: string; type?: string; region?: string } {
    const info: { guid?: number; name?: string; type?: string; region?: string } = {};

    if (!data || typeof data !== 'object') return info;

    const obj = data as Record<string, unknown>;

    // Extract guid
    if ('guid' in obj && typeof obj.guid === 'number') {
        info.guid = obj.guid;
    }

    // Extract name (might be observable or string)
    if ('name' in obj) {
        const name = safeUnwrap(obj.name);
        if (typeof name === 'string') {
            info.name = name;
        }
    }

    // Extract region
    if ('region' in obj) {
        const region = safeUnwrap(obj.region);
        if (region && typeof region === 'object' && 'name' in (region as Record<string, unknown>)) {
            const regionName = safeUnwrap((region as Record<string, unknown>).name);
            if (typeof regionName === 'string') {
                info.region = regionName;
            }
        }
    }

    // Set type
    info.type = getAssetType(data);

    return info;
}

/**
 * Debug utility to inspect Knockout binding context
 * @param element - DOM element to inspect
 * @returns Object with binding context information
 */
export function debugBindingContext(element: HTMLElement): DebugBindingInfo | null {
    if (!element) {
        console.error('[DebugKO] Invalid element provided');
        return null;
    }

    try {
        const context = ko.contextFor(element);
        if (!context) {
            console.warn('[DebugKO] No binding context found for element');
            return null;
        }

        const data = context.$data;
        const info: DebugBindingInfo = {
            element,
            data,
            dataType: getAssetType(data),
            isObservable: isKnockoutObservable(data),
            bindingContext: {
                $data: data,
                $root: context.$root,
                $parent: context.$parent,
                $parents: context.$parents
            },
            assetInfo: extractAssetInfo(data)
        };

        return info;
    } catch (e) {
        console.error('[DebugKO] Error inspecting binding context:', e);
        return null;
    }
}

/**
 * Log detailed information about a bound asset
 * @param data - The bound data object
 * @param label - Optional label for the log
 */
export function logAssetInfo(data: unknown, label?: string): void {
    const prefix = label ? `[DebugKO] ${label}:` : '[DebugKO]';

    console.group(prefix);
    console.log('Type:', getAssetType(data));
    console.log('Is Observable:', isKnockoutObservable(data));

    if (data && typeof data === 'object') {
        const assetInfo = extractAssetInfo(data);
        if (assetInfo) {
            console.log('Asset Info:', assetInfo);
        }

        // Log observable properties
        const obj = data as Record<string, unknown>;
        const observableProps = Object.keys(obj).filter(key => isKnockoutObservable(obj[key]));
        if (observableProps.length > 0) {
            console.log('Observable Properties:', observableProps);
        }
    }

    console.log('Value:', data);
    console.groupEnd();
}

/**
 * Inspect element by selector and log binding information
 * @param selector - CSS selector or element
 */
export function inspectElement(selector: string | HTMLElement): void {
    const element = typeof selector === 'string'
        ? document.querySelector(selector) as HTMLElement
        : selector;

    if (!element) {
        console.error('[DebugKO] Element not found:', selector);
        return;
    }

    const info = debugBindingContext(element);
    if (info) {
        console.group(`[DebugKO] Element: ${element.tagName}${element.id ? '#' + element.id : ''}${element.className ? '.' + element.className.split(' ').join('.') : ''}`);
        console.log('Asset Type:', info.dataType);
        console.log('Is Observable:', info.isObservable);
        if (info.assetInfo) {
            console.log('Asset Info:', info.assetInfo);
        }
        console.log('Binding Context:', info.bindingContext);
        console.log('Data:', info.data);
        console.groupEnd();
    }
}