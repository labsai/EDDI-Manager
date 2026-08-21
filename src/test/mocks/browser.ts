import { setupWorker } from "msw/browser";
import { browserHandlers } from "./browser-handlers";
import { UNHANDLED_API_REQUESTS_KEY } from "./unhandled-api";

export const worker = setupWorker(...browserHandlers);

/**
 * Where unhandled API calls are parked for the E2E tier to find.
 *
 * Read by the auto fixture in `e2e/fixtures.ts`, which fails the test that
 * caused them. Not console output: console messages are easy to miss and
 * awkward to attribute to a specific test, and the worker's own warning is only
 * a log line.
 *
 * **`sessionStorage`, not `window`.** The first version parked the list on
 * `window`, which a full document navigation throws away — and every spec's
 * `beforeEach` does `page.goto(...)`, with several tests navigating again
 * mid-test. Anything recorded before the last navigation was silently dropped,
 * so the guard could pass on a test that *did* make unhandled calls. That is the
 * same class of bug this whole branch exists to remove, in the thing meant to
 * catch it. `sessionStorage` survives same-origin navigation and is per-tab, and
 * Playwright gives each test a fresh context — so it starts empty on its own,
 * with nothing to clear.
 */
export { UNHANDLED_API_REQUESTS_KEY };

/**
 * Paths the dev server owns. `browser-handlers.ts` already passes these through
 * with explicit handlers, so they never reach `onUnhandledRequest` — but a new
 * Vite internal could, and reporting a module request as a missing API mock
 * would send someone hunting for a handler that should not exist.
 */
const DEV_ASSET_PREFIXES = ["/src/", "/@vite/", "/@id/", "/@fs/", "/@react-refresh", "/node_modules/"];

/**
 * Record an API call that no MSW handler answered, then let it through.
 *
 * Only same-origin `fetch`/XHR counts. `request.destination` is `""` for those
 * and names a resource type ("document", "script", "image", "font", …) for
 * everything the browser fetches on its own, which is how a page navigation or
 * a favicon is kept out of the list.
 *
 * Bypassing rather than erroring is deliberate: erroring here would break the
 * dev server for a human running `npm run dev`, and the point is to make the
 * gap *visible to the test suite*, not to change how the app behaves.
 */
export function recordUnhandledApiRequest(request: Request, print: { warning: () => void }) {
  const url = new URL(request.url);
  if (url.origin !== window.location.origin) return;
  if (request.destination !== "") return;
  if (DEV_ASSET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) return;

  const record = `${request.method} ${url.pathname}${url.search}`;

  try {
    const raw = sessionStorage.getItem(UNHANDLED_API_REQUESTS_KEY);
    const seen: string[] = raw ? JSON.parse(raw) : [];
    seen.push(record);
    sessionStorage.setItem(UNHANDLED_API_REQUESTS_KEY, JSON.stringify(seen));
  } catch {
    // Storage unavailable or full. Fall back to the current document so the
    // record is not simply lost — the fixture reads both and concatenates, and
    // this array stays empty on the normal path.
    const store = window as unknown as Record<string, string[] | undefined>;
    (store[UNHANDLED_API_REQUESTS_KEY] ??= []).push(record);
  }

  print.warning();
}
