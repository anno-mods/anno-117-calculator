import * as fs from 'fs';
import * as path from 'path';

/**
 * Parameters for programmatically generating fixtures
 */
export interface FixtureParams {
  populationLevels?: Array<{
    guid: number;
    residents?: number;
    buildings?: number;
  }>;
  factories?: Array<{
    guid: number;
    buildings?: number;
    boost?: number;
  }>;
  settings?: Record<string, string | number | boolean>;
}

/**
 * Helper class for managing test fixtures
 * Handles loading, validation, and programmatic generation of config.json fixtures
 */
export class FixtureManager {
  private readonly fixturesDir: string;

  constructor(fixturesDir: string = 'tests/fixtures') {
    this.fixturesDir = path.resolve(process.cwd(), fixturesDir);

    // Create fixtures directory if it doesn't exist
    if (!fs.existsSync(this.fixturesDir)) {
      fs.mkdirSync(this.fixturesDir, { recursive: true });
    }
  }

  /**
   * Loads a fixture file by name
   * @param name - Fixture name (without .json extension)
   * @returns Parsed fixture object
   */
  loadFixture(name: string): Record<string, any> {
    const fixturePath = this.getFixturePath(name);

    if (!fs.existsSync(fixturePath)) {
      throw new Error(`Fixture not found: ${name} (${fixturePath})`);
    }

    const content = fs.readFileSync(fixturePath, 'utf-8');

    try {
      return JSON.parse(content);
    } catch (e) {
      throw new Error(`Failed to parse fixture ${name}: ${e}`);
    }
  }

  /**
   * Gets list of available fixture files
   * @returns Array of fixture names (without .json extension)
   */
  getFixtureList(): string[] {
    if (!fs.existsSync(this.fixturesDir)) {
      return [];
    }

    return fs
      .readdirSync(this.fixturesDir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.replace('.json', ''));
  }

  /**
   * Validates a fixture structure
   * Ensures the fixture contains valid localStorage data
   * @param config - Configuration object to validate
   * @returns True if valid, throws error otherwise
   */
  validateFixture(config: Record<string, any>): boolean {
    // Check if config is an object
    if (typeof config !== 'object' || config === null) {
      throw new Error('Fixture must be an object');
    }

    // Check if all values are serializable
    try {
      JSON.stringify(config);
    } catch (e) {
      throw new Error(`Fixture contains non-serializable values: ${e}`);
    }

    // Warn about common localStorage keys that might be missing
    const recommendedKeys = ['versionCalculator', 'language'];
    const missingKeys = recommendedKeys.filter((key) => !(key in config));

    if (missingKeys.length > 0) {
      console.warn(
        `Fixture is missing recommended keys: ${missingKeys.join(', ')}`
      );
    }

    return true;
  }

  /**
   * Generates a fixture programmatically from parameters
   * @param params - Fixture generation parameters
   * @returns Generated configuration object
   */
  generateFixture(params: FixtureParams = {}): Record<string, any> {
    const config: Record<string, any> = {
      versionCalculator: '1.0',
      language: 'english',
    };

    // Add settings
    if (params.settings) {
      for (const [key, value] of Object.entries(params.settings)) {
        config[`settings.${key}`] = String(value);
      }
    }

    // Add population level data
    if (params.populationLevels) {
      for (const level of params.populationLevels) {
        if (level.residents !== undefined) {
          config[`${level.guid}.residents`] = String(level.residents);
        }
        if (level.buildings !== undefined) {
          config[`${level.guid}.buildings.constructed`] = String(level.buildings);
        }
      }
    }

    // Add factory data
    if (params.factories) {
      for (const factory of params.factories) {
        if (factory.buildings !== undefined) {
          config[`${factory.guid}.buildings.constructed`] = String(factory.buildings);
        }
        if (factory.boost !== undefined) {
          config[`${factory.guid}.boost`] = String(factory.boost);
        }
      }
    }

    return config;
  }

  /**
   * Saves a fixture to a file
   * @param name - Fixture name (without .json extension)
   * @param config - Configuration object to save
   */
  saveFixture(name: string, config: Record<string, any>): void {
    this.validateFixture(config);

    const fixturePath = this.getFixturePath(name);
    const content = JSON.stringify(config, null, 2);

    fs.writeFileSync(fixturePath, content, 'utf-8');
  }

  /**
   * Creates an empty fixture (minimal configuration)
   * @returns Minimal configuration object
   */
  createEmptyFixture(): Record<string, any> {
    return {
      versionCalculator: 'test',
      language: 'english',
    };
  }

  /**
   * Merges multiple fixtures together
   * Later fixtures override earlier ones
   * @param names - Array of fixture names to merge
   * @returns Merged configuration object
   */
  mergeFixtures(...names: string[]): Record<string, any> {
    let merged = {};

    for (const name of names) {
      const fixture = this.loadFixture(name);
      merged = { ...merged, ...fixture };
    }

    return merged;
  }

  /**
   * Gets the full path to a fixture file
   * @param name - Fixture name (without .json extension)
   * @returns Full path to fixture file
   */
  private getFixturePath(name: string): string {
    const filename = name.endsWith('.json') ? name : `${name}.json`;
    return path.join(this.fixturesDir, filename);
  }

  /**
   * Creates a fixture with specific population setup
   * @param levels - Array of population level configurations
   * @returns Configuration object
   */
  createPopulationFixture(
    levels: Array<{ guid: number; residents: number; buildings?: number }>
  ): Record<string, any> {
    return this.generateFixture({
      populationLevels: levels,
    });
  }

  /**
   * Creates a fixture with specific factory setup
   * @param factories - Array of factory configurations
   * @returns Configuration object
   */
  createFactoryFixture(
    factories: Array<{ guid: number; buildings: number; boost?: number }>
  ): Record<string, any> {
    return this.generateFixture({
      factories: factories,
    });
  }

  /**
   * Checks if a fixture exists
   * @param name - Fixture name
   * @returns True if fixture exists
   */
  fixtureExists(name: string): boolean {
    const fixturePath = this.getFixturePath(name);
    return fs.existsSync(fixturePath);
  }
}
