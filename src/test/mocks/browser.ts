import { setupWorker } from "msw/browser";
import { browserHandlers } from "./browser-handlers";

export const worker = setupWorker(...browserHandlers);

/**
 * Where unhandled API calls are parked for the E2E tier to find.
 *
 * Read by `expectAllApiCallsHandled` in `e2e/fixtures.ts`, which fails the test
 * that caused them. Deliberately a plain array on `window` rather than console
 * output: console messages are easy to miss and awkward to attribute to a
 * specific test, and the browser worker's own warning is only a log line.
 */
export const UNHANDLED_API_REQUESTS_KEY = "__EDDI_UNHANDLED_API__";

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
  const store = window as unknown as Record<string, string[] | undefined>;
  (store[UNHANDLED_API_REQUESTS_KEY] ??= []).push(record);

  print.warning();
}
