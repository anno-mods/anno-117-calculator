import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Helper class for managing localStorage configuration during tests
 * Handles loading config.json fixtures into browser localStorage before page load
 */
export class ConfigLoader {
  /**
   * Loads a configuration file into localStorage before navigating to the page
   * @param page - Playwright page instance
   * @param configPath - Relative path to config file from project root
   */
  async loadConfig(page: Page, configPath: string): Promise<void> {
    const fullPath = path.resolve(process.cwd(), configPath);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`Config file not found: ${fullPath}`);
    }

    const configContent = fs.readFileSync(fullPath, 'utf-8');
    const config = JSON.parse(configContent);

    await this.loadConfigObject(page, config);
  }

  /**
   * Loads a configuration object directly into localStorage
   * @param page - Playwright page instance
   * @param config - Configuration object to load
   */
  async loadConfigObject(page: Page, config: Record<string, any>): Promise<void> {
    // Use addInitScript to inject localStorage before page loads
    await page.addInitScript((configData) => {
      for (const [key, value] of Object.entries(configData)) {
        localStorage.setItem(key, String(value));
      }
    }, config);
  }

  /**
   * Creates a properly structured island config with the new storage format
   * @param islandName - Name of the island
   * @param session - Session GUID
   * @param islandData - Island-specific data (e.g., building counts)
   * @param calculatorSettings - Calculator settings (e.g., settings.showAllProducts)
   * @returns Properly structured config object
   */
  createIslandConfig(
    islandName: string,
    session: number,
    islandData: Record<string, any> = {},
    calculatorSettings: Record<string, any> = {}
  ): Record<string, any> {
    // Create nested island storage structure
    const islandStorage = {
      session: session,
      selectedPatron: "",
      ...islandData
    };

    return {
      islandName: islandName,
      versionCalculator: "1.0",
      tradeRoutes: "[]",
      collapsibleStates: "{}",
      "debug.enabled": "false",
      calculatorSettings: JSON.stringify(calculatorSettings, null, 4),
      sessionSettings: "{}",
      globalEffects: "{}",
      [islandName]: JSON.stringify(islandStorage, null, 4)
    };
  }

  /**
   * Clears all localStorage data
   * @param page - Playwright page instance
   */
  async clearStorage(page: Page): Promise<void> {
    await page.evaluate(() => {
      localStorage.clear();
    });
  }

  /**
   * Gets the current state of localStorage for debugging
   * @param page - Playwright page instance
   * @returns Object containing all localStorage key-value pairs
   */
  async getStorageState(page: Page): Promise<Record<string, string>> {
    return await page.evaluate(() => {
      const storage: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          storage[key] = localStorage.getItem(key) || '';
        }
      }
      return storage;
    });
  }

  /**
   * Sets a single localStorage item
   * @param page - Playwright page instance
   * @param key - Storage key
   * @param value - Storage value
   */
  async setItem(page: Page, key: string, value: string): Promise<void> {
    await page.evaluate(
      ({ k, v }) => localStorage.setItem(k, v),
      { k: key, v: value }
    );
  }

  /**
   * Gets a single localStorage item
   * @param page - Playwright page instance
   * @param key - Storage key
   * @returns The value or null if not found
   */
  async getItem(page: Page, key: string): Promise<string | null> {
    return await page.evaluate(
      (k) => localStorage.getItem(k),
      key
    );
  }

  /**
   * Enables debug mode before page load
   * @param page - Playwright page instance
   * @param enabled - Whether to enable debug mode
   */
  async setDebugMode(page: Page, enabled: boolean = true): Promise<void> {
    await page.addInitScript((isEnabled) => {
      localStorage.setItem('debug.enabled', isEnabled ? 'true' : 'false');
    }, enabled);
  }
}
