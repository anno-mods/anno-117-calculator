// Standalone params-driven identity resolution for the statistics page (U2).
//
// Pure lookup functions only - no Knockout observables, no Island/assetsMap/Product/Session
// object instantiation (KTD3). The statistics page has no `Island` to build those objects from,
// so icon/name/category resolution reads `window.params` directly, mirroring the two lookups
// `NamedElement` performs (src/util.ts:300-322): `iconPath` -> `params.icons[...]`, and
// `locaText[currentLanguage]` falling back to `locaText.english`, falling back to the raw name.

import { detectBrowserLanguage } from './i18n';
import { LocaTextConfig, ParamsConfig, ProductConfig, ProductFilterConfig, SessionConfig } from './types.config';

export interface ResolvedProduct {
    guid: number;
    name: string;
    icon: string | undefined;
    category: string;
}

export interface ResolvedSession {
    guid: number;
    name: string;
    icon: string | undefined;
}

/** KTD6: entries with no explicit params category fall back into "Other". */
const OTHER_CATEGORY = 'Other';

function getParams(): ParamsConfig | undefined {
    // window.params is declared `any` globally (src/types.ts); statistics.html loads js/params.js
    // as a plain global script before the bundle runs (same pattern as index.html), so this is
    // present by the time any of these functions run - but never assume it is, hence the guards
    // throughout this file.
    return window.params;
}

/**
 * Resolves the page's display language from the browser locale via `i18n.ts`'s shared
 * `detectBrowserLanguage()` (the same lookup `main.ts` uses to seed
 * `window.view.settings.language()`) - this standalone page has no `window.view`/Knockout
 * settings object to read from, so the result is used directly instead. Falls back to
 * `'english'` when nothing matches.
 */
export function currentLanguage(): string {
    return detectBrowserLanguage() ?? 'english';
}

function resolveLocaText(locaText: LocaTextConfig | { [key: string]: string } | undefined | null, fallbackName: string): string {
    if (locaText) {
        const lang = currentLanguage();
        const localized = locaText[lang];
        if (localized) {
            return localized;
        }
        const english = locaText['english'];
        if (english) {
            return english;
        }
    }
    return fallbackName;
}

function resolveCategoryForProduct(guid: number, params: ParamsConfig): string {
    if (!Array.isArray(params.productFilters)) {
        return OTHER_CATEGORY;
    }
    const filter = params.productFilters.find(
        (f: ProductFilterConfig) => Array.isArray(f.products) && f.products.indexOf(guid) !== -1
    );
    if (!filter) {
        // KTD6: product found, but no productFilter lists it -> "Other".
        return OTHER_CATEGORY;
    }
    return resolveLocaText(filter.locaText, OTHER_CATEGORY);
}

/**
 * Resolves a product's icon, localized display name and category from `window.params`.
 * KTD4: a `guid` with no match in `window.params.products` still renders - a GUID-derived
 * fallback name, no icon (caller/template supplies a generic placeholder), category "Other".
 */
export function resolveProduct(guid: number): ResolvedProduct {
    const params = getParams();
    const config: ProductConfig | undefined =
        params && Array.isArray(params.products) ? params.products.find((p: ProductConfig) => p.guid === guid) : undefined;

    if (!params || !config) {
        return {
            guid,
            name: `Unknown (${guid})`,
            icon: undefined,
            category: OTHER_CATEGORY
        };
    }

    const icon = params.icons ? params.icons[config.iconPath] : undefined;
    const name = resolveLocaText(config.locaText, config.name);
    const category = resolveCategoryForProduct(guid, params);

    return { guid, name, icon, category };
}

/**
 * Resolves a session's icon and localized name from `window.params`, accepting either a numeric
 * session guid or a raw string identifier (the server may only supply an `areaName` string - see
 * the plan's Open Questions). Numeric identifiers match `SessionConfig.guid`; string identifiers
 * match `SessionConfig.name` case-insensitively. KTD4: returns `null` (never a synthetic session)
 * when nothing matches - the caller falls back to the raw server-provided area name with no
 * session icon/name.
 */
export function resolveSession(identifier: number | string | null | undefined): ResolvedSession | null {
    if (identifier === null || identifier === undefined || identifier === '') {
        return null;
    }

    const params = getParams();
    if (!params || !Array.isArray(params.sessions)) {
        return null;
    }

    let config: SessionConfig | undefined;
    if (typeof identifier === 'number') {
        config = params.sessions.find((s: SessionConfig) => s.guid === identifier);
    } else {
        const needle = identifier.toLowerCase();
        config = params.sessions.find((s: SessionConfig) => (s.name || '').toLowerCase() === needle);
    }

    if (!config) {
        return null;
    }

    const icon = params.icons ? params.icons[config.iconPath] : undefined;
    const name = resolveLocaText(config.locaText, config.name);

    return { guid: config.guid, name, icon };
}
