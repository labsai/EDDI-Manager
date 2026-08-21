import { test as base, expect } from "@playwright/test";

/**
 * The `test` every UI-tier spec imports, instead of `@playwright/test`.
 *
 * It carries one auto fixture: after each test, any API call MSW had no handler
 * for fails that test. Before this, the browser worker ran
 * `onUnhandledRequest: "bypass"`, so a missing handler fell through to the dev
 * server, the page rendered without its data, and a suite averaging 1.5
 * assertions per test sailed past it. That is the actual cause of the "MSW
 * browser worker too slow for this page" skips that used to sit in
 * `admin-pages.spec.ts` and `resource-editor.spec.ts` — the data was not slow,
 * it was never coming.
 *
 * The integration and full-stack tiers run against a real backend with no MSW,
 * so the key is simply absent there and the check is a no-op. They keep
 * importing from `@playwright/test` regardless.
 */

// Shared with the recorder rather than re-declared here — see that module for
// why it is not simply exported from `browser.ts`. `tsconfig.e2e.json` maps
// `@/*` to `./src/*`.
import { UNHANDLED_API_REQUESTS_KEY } from "@/test/mocks/unhandled-api";

export const test = base.extend<{ failOnUnhandledApiCalls: void }>({
  failOnUnhandledApiCalls: [
    async ({ page }, use) => {
      await use();

      // The page can already be closed if the test navigated away or crashed;
      // that is the test's own failure to report, not this fixture's.
      if (page.isClosed()) return;

      // Read `sessionStorage` first — it is where the recorder writes, and it
      // survives the `page.goto()` that every spec's `beforeEach` performs. The
      // `window` array is only ever populated if `sessionStorage` was
      // unavailable, so concatenating is exact rather than double-counting.
      const unhandled = await page
        .evaluate((key) => {
          let stored: string[] = [];
          try {
            const raw = sessionStorage.getItem(key);
            if (raw) stored = JSON.parse(raw) as string[];
          } catch {
            // fall through to the in-document fallback below
          }
          const fallback =
            (window as unknown as Record<string, string[] | undefined>)[key] ?? [];
          return [...stored, ...fallback];
        }, UNHANDLED_API_REQUESTS_KEY)
        .catch(() => [] as string[]);

      expect(
        unhandled,
        `MSW had no handler for these API calls, so the page rendered without their data:\n  ${unhandled.join("\n  ")}\n\nAdd a handler in src/test/mocks/handlers.ts.`,
      ).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
