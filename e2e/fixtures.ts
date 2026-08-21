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

/** Kept in sync by hand with `UNHANDLED_API_REQUESTS_KEY` in src/test/mocks/browser.ts. */
const UNHANDLED_API_REQUESTS_KEY = "__EDDI_UNHANDLED_API__";

export const test = base.extend<{ failOnUnhandledApiCalls: void }>({
  failOnUnhandledApiCalls: [
    async ({ page }, use) => {
      await use();

      // The page can already be closed if the test navigated away or crashed;
      // that is the test's own failure to report, not this fixture's.
      if (page.isClosed()) return;

      const unhandled = await page
        .evaluate((key) => (window as unknown as Record<string, string[] | undefined>)[key] ?? [], UNHANDLED_API_REQUESTS_KEY)
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
