import { Page, expect } from '@playwright/test';

/**
 * Interface for value comparison options
 */
interface ComparisonOptions {
  tolerance?: number;
  message?: string;
}

/**
 * Helper class for verifying computed observable values in the browser context
 * Handles floating-point comparisons and observable unwrapping
 */
export class ComputedValueAsserter {
  /**
   * Default tolerance for floating-point comparisons
   * Matches the ACCURACY constant from util.ts
   */
  private readonly DEFAULT_TOLERANCE = 0.00001;

  /**
   * Gets a value from the page context by evaluating a JavaScript expression
   * @param page - Playwright page instance
   * @param path - JavaScript expression to evaluate (e.g., 'window.view.island().name()')
   * @returns The evaluated value
   */
  async getValue<T = any>(page: Page, path: string): Promise<T> {
    return await page.evaluate((expression) => {
      // Helper function to safely evaluate nested paths
      const evalPath = (expr: string): any => {
        try {
          // Use Function constructor for safer eval alternative
          return new Function(`return ${expr}`)();
        } catch (e) {
          throw new Error(`Failed to evaluate path "${expr}": ${e}`);
        }
      };

      return evalPath(expression);
    }, path);
  }

  /**
   * Asserts that a computed value equals the expected value (with tolerance for numbers)
   * @param page - Playwright page instance
   * @param path - JavaScript expression to evaluate
   * @param expected - Expected value
   * @param options - Comparison options (tolerance, custom message)
   */
  async assertEquals<T>(
    page: Page,
    path: string,
    expected: T,
    options: ComparisonOptions = {}
  ): Promise<void> {
    const actual = await this.getValue<T>(page, path);
    const tolerance = options.tolerance ?? this.DEFAULT_TOLERANCE;
    const message = options.message ?? `Expected ${path} to equal ${expected}`;

    // Handle numeric comparisons with tolerance
    if (typeof expected === 'number' && typeof actual === 'number') {
      const diff = Math.abs(actual - expected);
      expect(diff, message).toBeLessThanOrEqual(tolerance);
    } else {
      expect(actual, message).toBe(expected);
    }
  }

  /**
   * Asserts that a value is within a specific range
   * @param page - Playwright page instance
   * @param path - JavaScript expression to evaluate
   * @param min - Minimum value (inclusive)
   * @param max - Maximum value (inclusive)
   * @param message - Optional custom message
   */
  async assertInRange(
    page: Page,
    path: string,
    min: number,
    max: number,
    message?: string
  ): Promise<void> {
    const value = await this.getValue<number>(page, path);
    const msg = message ?? `Expected ${path} (${value}) to be between ${min} and ${max}`;

    expect(value, msg).toBeGreaterThanOrEqual(min);
    expect(value, msg).toBeLessThanOrEqual(max);
  }

  /**
   * Waits for a value to match the expected value (with optional timeout)
   * @param page - Playwright page instance
   * @param path - JavaScript expression to evaluate
   * @param expected - Expected value
   * @param timeout - Timeout in milliseconds (default: 5000)
   * @param tolerance - Tolerance for numeric comparisons
   * @returns Promise that resolves when value matches
   */
  async waitForValue<T>(
    page: Page,
    path: string,
    expected: T,
    timeout: number = 5000,
    tolerance: number = this.DEFAULT_TOLERANCE
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const actual = await this.getValue<T>(page, path);

      // Check if values match (with tolerance for numbers)
      if (typeof expected === 'number' && typeof actual === 'number') {
        if (Math.abs(actual - expected) <= tolerance) {
          return;
        }
      } else if (actual === expected) {
        return;
      }

      // Wait a bit before checking again
      await page.waitForTimeout(100);
    }

    const actual = await this.getValue<T>(page, path);
    throw new Error(
      `Timeout waiting for ${path} to equal ${expected}. Current value: ${actual}`
    );
  }

  /**
   * Gets an observable value from a DOM element's binding context
   * @param page - Playwright page instance
   * @param selector - CSS selector for the element
   * @param property - Property name on $data
   * @returns The observable value
   */
  async getObservableValue<T = any>(
    page: Page,
    selector: string,
    property: string
  ): Promise<T> {
    return await page.evaluate(
      ({ sel, prop }) => {
        const element = document.querySelector(sel);
        if (!element) {
          throw new Error(`Element not found: ${sel}`);
        }

        const context = (window as any).ko.contextFor(element);
        if (!context) {
          throw new Error(`No binding context found for element: ${sel}`);
        }

        const data = context.$data;
        const value = data[prop];

        // Unwrap observable if needed
        if ((window as any).ko.isObservable(value)) {
          return value();
        }

        return value;
      },
      { sel: selector, prop: property }
    );
  }

  /**
   * Asserts that a value is truthy
   * @param page - Playwright page instance
   * @param path - JavaScript expression to evaluate
   * @param message - Optional custom message
   */
  async assertTruthy(page: Page, path: string, message?: string): Promise<void> {
    const value = await this.getValue(page, path);
    const msg = message ?? `Expected ${path} to be truthy`;
    expect(value, msg).toBeTruthy();
  }

  /**
   * Asserts that a value is falsy
   * @param page - Playwright page instance
   * @param path - JavaScript expression to evaluate
   * @param message - Optional custom message
   */
  async assertFalsy(page: Page, path: string, message?: string): Promise<void> {
    const value = await this.getValue(page, path);
    const msg = message ?? `Expected ${path} to be falsy`;
    expect(value, msg).toBeFalsy();
  }

  /**
   * Gets multiple values at once for efficiency
   * @param page - Playwright page instance
   * @param paths - Object mapping keys to JavaScript expressions
   * @returns Object with evaluated values
   */
  async getValues<T extends Record<string, any>>(
    page: Page,
    paths: Record<string, string>
  ): Promise<T> {
    return await page.evaluate((expressions) => {
      const results: Record<string, any> = {};

      for (const [key, expr] of Object.entries(expressions)) {
        try {
          results[key] = new Function(`return ${expr}`)();
        } catch (e) {
          results[key] = { error: String(e) };
        }
      }

      return results as T;
    }, paths);
  }

  /**
   * Asserts an array has specific length
   * @param page - Playwright page instance
   * @param path - JavaScript expression that evaluates to an array
   * @param expectedLength - Expected array length
   * @param message - Optional custom message
   */
  async assertArrayLength(
    page: Page,
    path: string,
    expectedLength: number,
    message?: string
  ): Promise<void> {
    const value = await this.getValue<any[]>(page, path);
    const msg = message ?? `Expected ${path} to have length ${expectedLength}`;

    if (!Array.isArray(value)) {
      throw new Error(`${path} is not an array. Got: ${typeof value}`);
    }

    expect(value.length, msg).toBe(expectedLength);
  }

  /**
   * Gets params.js values for test calculations
   * @param page - Playwright page instance
   * @param path - Path to params value (e.g., 'params.constants.ACCURACY')
   * @returns The params value
   */
  async getParamsValue<T = any>(page: Page, path: string): Promise<T> {
    return await this.getValue<T>(page, `window.${path}`);
  }

  /**
   * Calculates expected value using params.js data
   * Useful for robust tests that don't break when params change
   * @param page - Playwright page instance
   * @param calculation - JavaScript expression using params values
   * @returns The calculated value
   */
  async calculateExpectedValue(page: Page, calculation: string): Promise<number> {
    return await page.evaluate((expr) => {
      try {
        return new Function(`return ${expr}`)();
      } catch (e) {
        throw new Error(`Failed to calculate expected value: ${e}`);
      }
    }, calculation);
  }
}
