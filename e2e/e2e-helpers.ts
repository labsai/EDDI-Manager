import { type Page, expect } from "@playwright/test";

/**
 * Shared E2E helpers.
 *
 * The Vite dev server auto-starts MSW browser worker when the real
 * backend is unreachable, so all E2E tests run against mock data with
 * zero extra setup.
 */

/**
 * Wait for the app to initialise: shell mounted, route chunk in, data rendered.
 *
 * ## The wait this replaces never waited for anything
 *
 * It was `locator('[class*="animate-pulse"]').first().waitFor({state:"hidden"})`
 * followed by `.catch(() => {})`, commented "no skeletons found — page loaded
 * instantly". Both halves were wrong.
 *
 * `animate-pulse` is worn by 43 elements, and most are decoration rather than
 * loading state — including the PlatformStatus dot, which lives in `TopBar`
 * (rendered *before* `<main>`, so it is always `.first()`) and pulses in all
 * three of its states. It never hides. So the wait could only ever time out,
 * and the `.catch` swallowed that: every UI test paid the full 10s and then
 * proceeded without having waited for data at all. With ~198 tests at one
 * worker, that is most of CI's 34-minute UI E2E run spent on a no-op.
 *
 * `page-loader.tsx` documents this exact hazard for the routing tests —
 * "`animate-pulse` is also worn by live-status dots elsewhere in the shell, so
 * 'is the page still loading?' cannot be answered by looking for that class".
 * This helper was the place that still answered it that way.
 *
 * ## What it waits for now
 *
 * Real loading placeholders inside the content area: the `Skeleton` primitive
 * (`data-slot="skeleton"`) and the `*-loading` testids pages use for hand-rolled
 * ones. `toHaveCount(0)` rather than `.first()` so a second skeleton outliving
 * the first cannot let the wait through, and no `.catch` — data that never
 * arrives is the failure this exists to surface.
 *
 * A page that renders neither passes immediately, which is the "loaded
 * instantly" case the old comment claimed.
 */
export async function waitForApp(page: Page) {
  // The shell.
  await page.waitForSelector('[data-testid="app-layout"]', { timeout: 15_000 });

  // The route's code-split chunk (SuspendedOutlet's fallback).
  await expect(page.getByTestId("page-loader")).toHaveCount(0, { timeout: 15_000 });

  // The page's own data.
  await expect(
    page.locator('main [data-slot="skeleton"], main [data-testid$="-loading"]'),
    "the page was still showing loading placeholders — its data never arrived",
  ).toHaveCount(0, { timeout: 15_000 });
}

/** Assert the visible h1 heading on the current page. */
export async function expectHeading(page: Page, text: string | RegExp) {
  await expect(page.locator("h1").first()).toContainText(text);
}
