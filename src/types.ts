// Core type definitions for the Anno 117 Calculator

import { NamedElement } from "./util";

// Common interface for localized text
export interface LocaTextConfig {
  english: string;
  french: string;
  polish: string;
  spanish: string;
  italian: string;
  german: string;
  brazilian: string;
  russian: string;
  simplified_chinese: string;
  traditional_chinese: string;
  japanese: string;
  korean: string;
  [key: string]: string; // Allow string indexing
}


// Base configuration interfaces
export interface NamedElementConfig {
  guid?: number;
  id?: string;
  name?: string;
  locaText?: LocaTextConfig;
  iconPath?: string;
  dlcs?: string[];
  available?: boolean;
  notes?: string;
}

export interface OptionConfig extends NamedElementConfig {
  checked?: boolean;
}

export interface DLCConfig extends OptionConfig {
  id?: string;
  dependentObjects?: any[];
}

// Configuration interfaces for different components
export interface ConsumerConfig extends NamedElementConfig {
  guid:number;
  associatedRegions: string[];
  inputs?: {
    product: number;
    amount: number;
  }[];
  needsFuelInput: boolean;

  maintenances: {
    product: number;
    amount: number;
  }[];
  cycleTime: number;
  aqueductProductivityBuff?: number;
}

export interface BuffConfig extends NamedElementConfig {
  guid:number;
  additionalOutputCycle?: number;
  amount?: number;
  factory?: string;
  product?: string;
}

export interface WorkforceDemandConfig {
  factory: string;
  workforce: string;
  amount: number;
  percentBoost?: number;
}

export interface FactoryConfig extends ConsumerConfig {

  outputs: {
    product: number;
    amount: number;
  }[];
  modulesLimit: number;
}

export interface PopulationLevelConfig extends NamedElementConfig {
  populationLevel: number;
  residentMax: number;
  residentsPerNeed?: Map<string, number>;
  fullHouse: number;
  region: number;
  residence: number; 
  skyscraperLevels?: number[];
  specialResidence?: number;
  needs: NeedConfig[];
}

export interface NeedConfig {
  guid: number;
  tpmin?: number;
  isBonusNeed?: boolean;
  excludePopulationFromMoneyAndConsumptionCalculation?: boolean;
  residents?: number;
  requiredFloorLevel?: number;
}

export interface ResidenceNeedConfig {
  need: number;
  needConsumptionRate?: number;
}

export interface ResidenceBuildingConfig extends NamedElementConfig {
  populationLevel?: string;
  residentMax?: number;
  region?: string;
  residenceNeedsMap?: Map<string, any>;
  existingBuildings?: number;
  residentsPerNeed?: Record<string, number>;
  upgradedBuilding?: number;
}


export interface WorkforceConfig extends NamedElementConfig {
  demands?: any[];
}

export interface RegionConfig extends NamedElementConfig {
  islands?: string[];
}

export interface SessionConfig extends NamedElementConfig {
  islands?: string[];
  region?: string;
}

export interface IslandConfig extends NamedElementConfig {
  region?: string;
  assetsMap?: Map<string, any>;
}

export interface TradeConfig extends NamedElementConfig {
  region?: string;
  products?: string[];
  amounts?: number[];
}

export interface NPCTraderConfig extends TradeConfig {
  demands?: any[];
}

export interface TradeManagerConfig extends NamedElementConfig {
  demands?: any[];
}

export interface ViewConfig {
  settings: {
    language: KnockoutObservable<string>;
    options: any[];
    serverOptions: any[];
    serverAddress: KnockoutObservable<string>;
  };
  texts: Record<string, any>;
  dlcs: any[];
  dlcsMap: Map<string, any>;
  islands?: KnockoutObservableArray<any>;
  selectedIsland?: KnockoutObservable<any>;
  selectedResidenceEffectView?: KnockoutObservable<any>;
}

// Utility function types
export interface NumberInputHandlerParams {
  obs: KnockoutObservable<number>;
  id: string;
}

export interface NumericBounds {
  precision?: number;
  min: number;
  max: number;
  callback?: (value: number, current: number, newValue: any) => number | null;
}

// Asset map type - any type that extends NamedElement
export type AssetsMap = Map<number, any>;
export type LiteralsMap = Map<string, NamedElement>;

// Helper functions for AssetsMap operations
export function getFromAssetsMap(assetsMap: AssetsMap, guid: string | number): any {
    const numericGuid = typeof guid === 'string' ? parseInt(guid) : guid;
    return isNaN(numericGuid) ? undefined : assetsMap.get(numericGuid);
}

export function setInAssetsMap(assetsMap: AssetsMap, guid: string | number, element: any): void {
    const numericGuid = typeof guid === 'string' ? parseInt(guid) : guid;
    if (!isNaN(numericGuid)) {
        assetsMap.set(numericGuid, element);
    }
}

export function generateGuidIfMissing(element: any): string {
    if (!element.guid) {
        // Generate a unique guid if missing - use timestamp + random for uniqueness
        element.guid = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    }
    return element.guid;
}



export interface CollapsibleStates {
  get(id: string, collapsed: boolean): any;
  [key: string]: any; // Allow dynamic properties
}

// Utility types
export type ALL_ISLANDS = string;

// Global declarations
declare global {
  interface Window {
    view: any;
    params: any;
    ko: any;
    $: any;
    ACCURACY: number;
    formatNumber: (num: number | string, forceSign?: boolean) => string;
    formatPercentage: (num: number | string, forceSign?: boolean) => string;
    factoryReset: () => void;
    exportConfig: () => void;
  }
} 

