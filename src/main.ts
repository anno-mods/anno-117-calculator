import { ACCURACY, formatNumber, formatPercentage, versionCalculator, Option, ko, dummyObservable, NeedConsumptionSetting, NamedElement, debugBindingContext, logAssetInfo, inspectElement, getAssetType } from './util';
import { languageCodes, texts as locaTexts, options } from './i18n';
import { registerComponents } from './components';

// Import params from the js directory - this is a legacy import that needs to be loaded
// We'll handle this differently to avoid TypeScript rootDir issues
if (typeof require !== 'undefined') {
    require('../js/params');
}
import { AssetsMap, LiteralsMap } from './types';
import { DarkMode, ResidencePresenter } from './views';
import { CategoryPresenter } from './presenters';
import { ConstantsConfig, NeedConsumptionConfig, TextConfig } from './types.config';
import { Storage as SubStorage, Island, Region, Session } from './world';
import { Effect, ProductCategory } from './production';


declare const $: any;
declare const window: any;
declare const require: any;


// Make utility functions globally available
window.ACCURACY = ACCURACY;
window.formatNumber = formatNumber;
window.formatPercentage = formatPercentage;
window.factoryReset = factoryReset;
window.exportConfig = exportConfig;

// Make debug utilities globally available
window.debugKO = {
    context: debugBindingContext,
    type: getAssetType,
    log: logAssetInfo,
    inspect: inspectElement
};

/**
 * Global view object containing all application state
 */
window.view = {
    settings: {
        language: ko.observable("english"),
        options: [],
        selectedNeedConsumptionSetting: dummyObservable<NeedConsumptionSetting>("selectedNeedConsumption"),
        needConsumptionSettings: []
    },
    constants: {} as  ConstantsConfig,
    texts: {},
    dlcs: [],
    dlcsMap: new Map(),
    // Add missing properties that are referenced in the original code
    globalEffects: [] as Effect[],
    selectedFactory: ko.observable(null),
    selectedProduct: ko.observable(null),
    selectedPopulationLevel: ko.observable(null),
    selectedMultiFactoryProducts: ko.observable([]),
    selectedResidenceEffectView: ko.observable(null),
    island: ko.observable(null),
    islands: ko.observableArray([]),
    regions: [] as Region[],
    sessions: [] as Session[],
    needAttributes: [] as NamedElement[],
    assetsMap: new Map() as AssetsMap,
    literalsMap: new Map() as LiteralsMap,
    productsToTraders: new Map(),
    tradeManager: null,
    collapsibleStates: null,
    productionChain: null,
    template: {
        populationLevels: [],
        categories: [],
        consumers: [],
        publicServices: [],
        publicRecipeBuildings: []
    },
    presenter: {
        residence: null,
        categories: [],
        productByGuid: new Map(),
    },
    viewMode: null,
    islandManager: null,
    // Debug settings for Knockout binding debugging
    debug: {
        enabled: ko.observable(false),
        logBindings: ko.observable(false),
        verboseMode: ko.observable(false)
    }
};

// Restore debug settings from localStorage
const debugEnabled = localStorage.getItem('debug.enabled');
if (debugEnabled === 'true') {
    window.view.debug.enabled(true);
}
const debugVerbose = localStorage.getItem('debug.verboseMode');
if (debugVerbose === 'true') {
    window.view.debug.verboseMode(true);
}
const debugLogBindings = localStorage.getItem('debug.logBindings');
if (debugLogBindings === 'true') {
    window.view.debug.logBindings(true);
}

// Persist debug settings changes to localStorage
window.view.debug.enabled.subscribe((value: boolean) => {
    localStorage.setItem('debug.enabled', value.toString());
});
window.view.debug.verboseMode.subscribe((value: boolean) => {
    localStorage.setItem('debug.verboseMode', value.toString());
});
window.view.debug.logBindings.subscribe((value: boolean) => {
    localStorage.setItem('debug.logBindings', value.toString());
});

// Set default language based on browser locale
for (const code in languageCodes) {
    if (navigator.language.startsWith(code)) {
        window.view.settings.language(languageCodes[code]);
        break;
    }
}

/**
 * Checks if loaded config is old and applies upgrade
 * Called after initialization to handle version migrations
 * @param configVersion - The version of the loaded configuration
 */
function configUpgrade(configVersion: string | null): void {
    if (configVersion == null)
        configVersion = "v1.0";

    // Utility functions when upgrad logic is needed

    try {
        //const _versionParts = configVersion.replace(/[^.\d]/g, "").split(".").map(d => parseInt(d));
        
        /**
         * Checks if a setting is enabled
         * @param settingName - Name of the setting to check
         * @returns True if the setting is enabled
         */
/*         function _isChecked(settingName: string): boolean {
            const val = localStorage.getItem(`settings.${settingName}`);
            return val != null && parseInt(val) > 0;
        } */
        
        /**
         * Removes a setting from localStorage
         * @param settingName - Name of the setting to remove
         */
/*         function _remove(settingName: string): void {
            localStorage.removeItem(`settings.${settingName}`);
        } */

    } catch (e) { 
        console.warn(e); 
    }
}

/**
 * Resets the factory configuration by clearing localStorage and reloading
 */
function factoryReset(): void {
    if (localStorage)
        localStorage.clear();

    location.reload();
}

/**
 * Checks if the application is running locally
 * @returns True if running locally
 */
function isLocal(): boolean {
    return window.location.protocol == 'file:' || /localhost|127\.0\.0\.1/.test(window.location.hostname);
}

/**
 * Exports the current configuration to a JSON file
 */
function exportConfig(): void {
    const saveData = (function () {
        const a = document.createElement("a");
        document.body.appendChild(a);
        a.style.display = "none";
        return function (data: Storage, fileName: string): void {
            const blob = new Blob([JSON.stringify(data, null, 4)], { type: "text/json" });
            const url = window.URL.createObjectURL(blob);
            a.href = url;
            a.download = fileName;
            a.click();
            window.URL.revokeObjectURL(url);
        };
    }());

    saveData(localStorage, ("Anno117CalculatorConfig") + ".json");
}

/**
 * Checks for updates and shows notifications
 * Compares current version with latest GitHub release
 */
function checkAndShowNotifications(configVersion: string | null): void {
    $.getJSON("https://api.github.com/repos/anno-mods/anno-117-calculator/releases/latest").done((release: any) => {
        $('#download-calculator-button').attr("href", release.zipball_url);

        if (isLocal()) {
            if (release.tag_name !== versionCalculator) {
                ($ as any).notify({
                    // options
                    message: window.view.texts.calculatorUpdate.name()
                }, {
                    // settings
                    type: 'warning',
                    placement: { align: 'center' }
                });
            }
        }


        if (configVersion != null && configVersion != versionCalculator) {
            if (window.view.texts.newFeature?.name() && window.view.texts.newFeature.name().length)
                ($ as any).notify({
                    // options
                    message: window.view.texts.newFeature.name()
                }, {
                    // settings
                    type: 'success',
                    placement: { align: 'center' },
                    timer: 60000
                });
        }

    });
}

/**
 * Installs event listener for importing configuration files
 * Handles file selection and JSON parsing
 */
function installImportConfigListener(): void {
    if (localStorage) {
        $('#config-selector').on('change', (event: JQuery.ChangeEvent) => {
            event.preventDefault();
            if (!event.target.files || !event.target.files[0])
                return;

            const file = event.target.files[0];
            console.log(file);
            const fileReader = new FileReader();

            fileReader.onload = function (ev: ProgressEvent<FileReader>) {
                const text = (ev.target as FileReader).result || (ev.currentTarget as FileReader).result;

                try {
                    let config = JSON.parse(text as string);

                    if (localStorage) {
                        localStorage.clear();
                        for (var a in config)
                            localStorage.setItem(a, config[a]);

                       
                        location.reload();
                    } else {
                        console.error("No local storage accessible to write result into.");
                    }
                } catch (e) {
                    console.error('Failed to parse config file:', e);
                }
            };

            fileReader.onerror = function (err: ProgressEvent<FileReader>) {
                console.error(err);
            };

            fileReader.readAsText(file);
        });
    }
}



/**
 * Sets up Knockout numeric input validation and extender
 */
function setupNumericExtender(): void {
    ko.extenders.numeric = function(target: any, options: any) {
        const result = ko.pureComputed({
            read: target,
            write: function(newValue: any) {
                const current = target();
                let newValueAsNum = isNaN(newValue) ? 0 : +newValue;
                
                if (options && options.precision !== undefined) {
                    newValueAsNum = parseFloat(newValueAsNum.toFixed(options.precision));
                }
                
                if (options && options.min !== undefined && newValueAsNum < options.min) {
                    newValueAsNum = options.min;
                }
                
                if (options && options.max !== undefined && newValueAsNum > options.max) {
                    newValueAsNum = options.max;
                }
                
                if (options && options.callback) {
                    const callbackResult = options.callback(newValue, current, newValueAsNum);
                    if (callbackResult !== null) {
                        newValueAsNum = callbackResult;
                    }
                }
                
                if (newValueAsNum !== current) {
                    target(newValueAsNum);
                } else {
                    target.notifySubscribers(newValueAsNum);
                }
            }
        }).extend({ notify: 'always' });
        
        result(target());
        return result;
    };
}

/**
 * Main application initialization
 * @param isFirstRun - Whether this is the first time running the application
 * @param configVersion - The version of the configuration
 */
function init(_isFirstRun: boolean, configVersion: string | null): void {
    // Initialize application
    configUpgrade(configVersion);

    window.view.darkMode = new DarkMode();
    
    // Set up Knockout numeric extender
    setupNumericExtender();
    
    // Use the global params object (set by params.js)
    const params = window.params;
    window.view.constants = params.constants;
    
    // Set up DLCs
    window.view.dlcs = [];
    window.view.dlcsMap = new Map();

    const settingsStorage = localStorage ? new SubStorage("calculatorSettings") : undefined;
    const sessionStorage = localStorage ? new SubStorage("sessionSettings") : undefined;
    
    for (let dlc of (params.dlcs || [])) {
        const d = new (require('./util').DLC)(dlc);
        window.view.dlcs.push(d);
        window.view.dlcsMap.set(d.id, d);
        if (settingsStorage) {
            let id = d.id;
            if (settingsStorage.getItem(id) != null)
                d.checked(parseInt(settingsStorage.getItem(id) || '0'));

            d.checked.subscribe((val: boolean) => settingsStorage.setItem(id, val ? '1' : '0'));
        }
    }

    // Set up options

    for (let attr in options) {
        let o = new Option({...options[attr], id: attr});

        window.view.settings[attr] = o;
        window.view.settings.options.push(o);

        if (settingsStorage) {
            let id = "settings." + attr;
            if (settingsStorage.getItem(id) != null)
                o.checked(parseInt(settingsStorage.getItem(id) || '0') ? true : false);

            o.checked.subscribe((val: boolean) => settingsStorage.setItem(id, val ? '1' : '0'));
        }
    }

    window.view.settings.languages = params.languages;

    for (let attr of (params.needConsumptions as NeedConsumptionConfig[])) {
        let o = new NeedConsumptionSetting(attr);

        window.view.settings.needConsumptionSettings.push(o);
    } 
    window.view.settings.selectedNeedConsumptionSetting = ko.observable( window.view.settings.needConsumptionSettings[0])
    if (settingsStorage) {
        let id = "settings.needConsumption";
        let selection = window.view.settings.selectedNeedConsumptionSetting as KnockoutObservable<NeedConsumptionSetting>;
        if (settingsStorage.getItem(id) != null)
            for (var o of window.view.settings.needConsumptionSettings)
                if(o.id == settingsStorage.getItem(id))
                    selection(o);

        selection.subscribe((val ) => settingsStorage.setItem(id, val.id as string));
    }

    // Set up global effects
    var globalEffects = window.view.globalEffects as Effect[];
    for (let effect of (params.effects || [])) {
        // create Module owner effects here so that they are avaiable in the constructor of Modules
        if (!effect.effectScope.endsWith("Meta") && effect.effectScope != "ModuleOwner")
            continue

        const r = new Effect(effect, window.view.assetsMap);
        window.view.assetsMap.set(r.guid, r);
        globalEffects.push(r);
    }

    // Set up persistence for global effects
    if (localStorage) {
        const globalEffectsStorage = new SubStorage("globalEffects");
        for (const effect of globalEffects) {
            const storageKey = `${effect.guid}.scaling`;

            // Load saved scaling value
            const savedValue = globalEffectsStorage.getItem(storageKey);
            if (savedValue != null) {
                effect.scaling(parseFloat(savedValue));
            }

        }
    }


    

    // Set up regions
    window.view.regions = [];
    for (let region of (params.regions || [])) {
        const r = new Region(region);
        window.view.assetsMap.set(r.guid, r);
        window.view.literalsMap.set(r.id, r);
        window.view.regions.push(r);
    }

    // Set up sessions
    window.view.sessions = [];
    for (let session of (params.sessions || [])) {
        const s = new Session(session, params.effects || [], window.view.assetsMap, sessionStorage);
        window.view.assetsMap.set(s.guid, s);
        window.view.sessions.push(s);
    }

    window.view.needAttributes = [];
    // Set up attributes: Population, Money, Happiness, Health, FireSafety, Belief, Knowledge, Prestige
    for (let attribute of (params.needAttributes || [])) {
        const r = new NamedElement(attribute);
        window.view.needAttributes.push(r);
        window.view.literalsMap.set(r.id, r);
    }

    // Set up island management
    window.view.islandManager = new (require('./world').IslandManager)(params, _isFirstRun);

    // Set up language persistence
    if (settingsStorage) {
        const id = "language";
        if (settingsStorage.getItem(id))
            window.view.settings.language(settingsStorage.getItem(id));

        window.view.settings.language.subscribe((val: string) => settingsStorage.setItem(id, val));
    }

    // Handle configuration upgrades
    if (!_isFirstRun)
        configUpgrade(configVersion);


    // Set up modal dialogs and UI state
    window.view.collapsibleStates = new (require('./views').CollapsibleStates)();
    window.view.selectedFactory = ko.observable(window.view.island().factories[0]);
    window.view.selectedPopulationLevel = ko.observable(window.view.island().populationLevels[0]);
    window.view.selectedMultiFactoryProducts = ko.observable(window.view.island().multiFactoryProducts);
    window.view.selectedResidenceEffectView = ko.observable(new (require('./views').ResidenceEffectView)([window.view.island().residenceBuildings[0]]));

    // Set up trade manager
    window.view.tradeManager = new (require('./trade').TradeManager)();

    // Set up templates
    const allIslands = window.view.islandManager.allIslands as Island;
    const selectedIsland = window.view.island();
    const templates: any[] = [];
    const arrayToTemplate = (name: string) => allIslands[name].map((asset: any, index: number) => {
        const t = new (require('./views').Template)(asset, selectedIsland, name, index);
        templates.push(t);
        return t;
    });

    window.view.island.subscribe((i: any) => templates.forEach(t => t.parentInstance(i)));

    const presenter = window.view.presenter;
    presenter.categories = [] as CategoryPresenter[];
    // Create CategoryPresenter for each category template
    allIslands.categories.forEach((category: ProductCategory) => {
        const categoryPresenter = new CategoryPresenter(category, window.view.island) 
        presenter.categories.push(categoryPresenter);
        for(const productPresenter of categoryPresenter.productPresenters){
            presenter.productByGuid.set(productPresenter.guid, productPresenter);
            if (window.view.selectedProduct() == null)
                window.view.selectedProduct(productPresenter.instance());
        }
    });

    window.view.template = {
        populationGroups: arrayToTemplate("populationGroups"),
        consumers: arrayToTemplate("consumers"),
        publicServices: arrayToTemplate("publicServices"),
        publicRecipeBuildings: arrayToTemplate("publicRecipeBuildings")
    };
    window.view.presenter.residence = new ResidencePresenter(allIslands.needCategories, allIslands.populationLevels[0]);
    

    // Set up view mode for first run
    if (_isFirstRun)
        window.view.viewMode = new (require('./views').ViewMode)(_isFirstRun);

    // Register Knockout components (before bindings are applied)
    registerComponents();

    // Apply Knockout bindings
    ko.applyBindings(window.view, $(document.body)[0]);

    // Set up modal event handlers
    $('#factory-choose-dialog').on('show.bs.modal', () => {
        window.view.selectedMultiFactoryProducts((window.view.island() as Island).multiFactoryProducts
            .filter((p: any) => p.availableFactories().length > 1)
            .sort((a: any, b: any) => a.name().localeCompare(b.name())));
    });

    $('#patron-selection-dialog').on('show.bs.modal', () => {
        // No specific setup needed as the dialog directly binds to island observables
    });

    $('*').on('hidden.bs.modal', () => {
        const input = $(':focus');
        if (input.length)
            input.blur();
        $('.modal-backdrop').remove();
        $('body').removeClass('modal-open');
        $('body').css('padding-right', '');
    });

    if (window.view.viewMode)
        $('#view-mode-dialog').modal("show");

    (window.view.island() as Island).name.subscribe(val => { window.document.title = val; });

    // Set up key bindings
    var keyBindings = ko.computed(() => {
        var bindings = new Map();

        var language = window.view.settings.language();
        if (language == 'chinese' || language == 'korean' || language == 'japanese' || language == 'taiwanese') {
            language = 'english';
        }

        for (var l of (window.view.island() as Island).populationLevels) {
            var name = l.locaText[language];

            for (var c of name.toLowerCase()) {
                if (!bindings.has(c)) {
                    bindings.set(c, $(`.ui-tier-unit-name[tier-unit-guid=${l.guid}] ~ .input .input-group input`));
                    l.hotkey(c);
                    break;
                }
            }
        }

        return bindings;
    });

    $(document).on("keydown", (evt: { altKey: any; ctrlKey: any; shiftKey: any; target: { tagName: string; type: string; }; key: string; }) => {
        if (evt.altKey || evt.ctrlKey || evt.shiftKey)
            return true;

        if (evt.target.tagName === 'TEXTAREA')
            return true;

        if (evt.target.tagName === 'INPUT' && evt.target.type === "text")
            return true;

        var focused = false;
        var bindings = keyBindings();
        if (bindings.has(evt.key)) {
            focused = true;
            bindings.get(evt.key).focus().select();
        }

        if (evt.target.tagName === 'INPUT' && !isNaN(parseInt(evt.key)) || focused) {
            let isDigit = evt.key >= "0" && evt.key <= "9";
            return ['ArrowUp', 'ArrowDown', 'Backspace', 'Delete'].includes(evt.key) || isDigit || evt.key === "." || evt.key === ",";
        }
        return false;
    });

}

// Export functions for global access
export { factoryReset, exportConfig, init }; 

// Document ready handler - initialize the application when DOM is ready
$(document).ready(function () {
    const configVersion = localStorage && localStorage.getItem("versionCalculator");
    const isFirstRun = !localStorage || localStorage.getItem("versionCalculator") == null;

    if(localStorage)
        localStorage.setItem("versionCalculator", versionCalculator)
    // Parse the parameters (texts will be loaded from i18n)
    // Note: locaTexts parsing is handled in the i18n module
    
    // Parse the texts - create NamedElement instances for each text entry
    for (let text of window.params.texts as TextConfig[]) {
        console.log(text);
        window.view.texts[text.name] = new (require('./util').NamedElement)({ 
            name: text.name, 
            guid: text.lineID,
            locaText: text.locaText 
        });
    }

    for (let attr in locaTexts) {
        window.view.texts[attr] = new (require('./util').NamedElement)({ 
            name: attr, 
            guid: attr, // Use the attribute name as the GUID
            locaText: locaTexts[attr] 
        });
    }
    


    // Check for updates and show notifications
    checkAndShowNotifications(configVersion);

    // Initialize the application
    init(isFirstRun, configVersion);

    // Set up Bootstrap popovers
    ($ as any)('[data-toggle="popover"]').popover();
    
    // Install import config listener (must occur after template binding)
    installImportConfigListener();
}); 