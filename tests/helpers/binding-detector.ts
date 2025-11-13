import { Page, ConsoleMessage } from '@playwright/test';

/**
 * Interface for categorized console messages
 */
interface CategorizedMessages {
  errors: ConsoleMessage[];
  warnings: ConsoleMessage[];
  info: ConsoleMessage[];
}

/**
 * Helper class for detecting and categorizing Knockout binding errors
 * Listens to browser console and filters for binding-related issues
 */
export class BindingErrorDetector {
  private messages: ConsoleMessage[] = [];
  private listening: boolean = false;

  /**
   * Known Knockout binding error patterns
   */
  private readonly BINDING_ERROR_PATTERNS = [
    /unable to parse bindings/i,
    /unable to process binding/i,
    /binding.*not defined/i,
    /ko\..*is not a function/i,
    /cannot read property.*of undefined.*binding/i,
    /knockout/i,
    /\$data.*undefined/i,
    /\$root.*undefined/i,
    /observable.*not a function/i,
  ];

  /**
   * Sets up console event listeners to capture errors
   * @param page - Playwright page instance
   */
  listenForErrors(page: Page): void {
    if (this.listening) {
      return;
    }

    this.listening = true;
    this.messages = [];

    // Listen to all console messages
    page.on('console', (msg) => {
      this.messages.push(msg);
    });

    // Listen to page errors
    page.on('pageerror', (error) => {
      // Convert page errors to console-like messages for consistency
      const errorMsg = {
        type: () => 'error',
        text: () => error.message,
        location: () => ({
          url: error.stack || '',
          lineNumber: 0,
          columnNumber: 0,
        }),
      } as ConsoleMessage;

      this.messages.push(errorMsg);
    });
  }

  /**
   * Gets all captured console messages
   * @returns Array of all console messages
   */
  getMessages(): ConsoleMessage[] {
    return this.messages;
  }

  /**
   * Gets all error messages
   * @returns Array of error console messages
   */
  getErrors(): ConsoleMessage[] {
    return this.messages.filter((msg) => msg.type() === 'error');
  }

  /**
   * Gets all warning messages
   * @returns Array of warning console messages
   */
  getWarnings(): ConsoleMessage[] {
    return this.messages.filter((msg) => msg.type() === 'warning');
  }

  /**
   * Categorizes all messages by type
   * @returns Object containing categorized messages
   */
  getCategorizedMessages(): CategorizedMessages {
    return {
      errors: this.getErrors(),
      warnings: this.getWarnings(),
      info: this.messages.filter((msg) => msg.type() === 'info'),
    };
  }

  /**
   * Checks if any binding errors were detected
   * @returns True if binding errors were found
   */
  hasBindingError(): boolean {
    return this.getBindingErrors().length > 0;
  }

  /**
   * Gets messages that match binding error patterns
   * @returns Array of binding error messages
   */
  getBindingErrors(): ConsoleMessage[] {
    const errors = this.getErrors();
    return errors.filter((msg) => {
      const text = msg.text().toLowerCase();
      return this.BINDING_ERROR_PATTERNS.some((pattern) => pattern.test(text));
    });
  }

  /**
   * Gets messages containing Knockout-related keywords
   * @returns Array of Knockout-related messages
   */
  getKnockoutErrors(): ConsoleMessage[] {
    return this.getErrors().filter((msg) => {
      const text = msg.text().toLowerCase();
      return (
        text.includes('knockout') ||
        text.includes('binding') ||
        text.includes('observable') ||
        text.includes('ko.')
      );
    });
  }

  /**
   * Gets formatted error messages for debugging
   * @returns Array of formatted error strings
   */
  getFormattedErrors(): string[] {
    return this.getErrors().map((msg) => {
      const location = msg.location();
      return `[${msg.type()}] ${msg.text()} (${location.url}:${location.lineNumber})`;
    });
  }

  /**
   * Gets formatted binding errors for debugging
   * @returns Array of formatted binding error strings
   */
  getFormattedBindingErrors(): string[] {
    return this.getBindingErrors().map((msg) => {
      const location = msg.location();
      return `[BINDING ERROR] ${msg.text()} (${location.url}:${location.lineNumber})`;
    });
  }

    /**
   * Gets formatted binding errors for debugging
   * @returns Array of formatted binding error strings
   */
    getFormattedKnockoutErrors(): string[] {
      return this.getKnockoutErrors().map((msg) => {
        const location = msg.location();
        return `[KNOCKOUT ERROR] ${msg.text()} (${location.url}:${location.lineNumber})`;
      });
    }

  /**
   * Clears all captured messages
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Gets count of errors by type
   * @returns Object with error counts
   */
  getErrorCounts(): { total: number; binding: number; knockout: number } {
    return {
      total: this.getErrors().length,
      binding: this.getBindingErrors().length,
      knockout: this.getKnockoutErrors().length,
    };
  }

  /**
   * Checks if specific error message exists
   * @param pattern - String or RegExp to search for
   * @returns True if matching error found
   */
  hasError(pattern: string | RegExp): boolean {
    const regex = typeof pattern === 'string' ? new RegExp(pattern, 'i') : pattern;
    return this.getErrors().some((msg) => regex.test(msg.text()));
  }

  /**
   * Waits for page to be error-free for a specific duration
   * @param page - Playwright page instance
   * @param duration - Duration in milliseconds to wait without errors
   * @returns Promise that resolves if no errors occur
   */
  async waitForNoErrors(page: Page, duration: number = 1000): Promise<boolean> {
    const initialCount = this.getErrors().length;
    await page.waitForTimeout(duration);
    return this.getErrors().length === initialCount;
  }
}
