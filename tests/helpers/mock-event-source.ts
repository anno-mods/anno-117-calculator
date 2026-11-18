import type { Page } from '@playwright/test';

/**
 * Installs a minimal fake `EventSource` on `window` before the page under test navigates, so
 * `new EventSource(url)` inside the statistics page's bundle (see src/statistics-feed.ts) picks
 * up the fake instead of opening a real network connection. Each constructed instance is stashed
 * on `window.__mockEventSourceInstances` so a test can trigger `onopen`/`onmessage`/`onerror`
 * directly via `page.evaluate()`.
 */
export async function installMockEventSource(page: Page): Promise<void> {
  await page.addInitScript(() => {
    (window as any).__mockEventSourceInstances = [];

    class MockEventSource {
      url: string;
      onopen: ((ev?: any) => void) | null = null;
      onmessage: ((ev: any) => void) | null = null;
      onerror: ((ev?: any) => void) | null = null;

      constructor(url: string) {
        this.url = url;
        (window as any).__mockEventSourceInstances.push(this);
      }

      close() {
        // no-op: this test double never needs to simulate an actual socket teardown
      }
    }

    (window as any).EventSource = MockEventSource;
  });
}
