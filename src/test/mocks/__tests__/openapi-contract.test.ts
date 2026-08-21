import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import type { RequestHandler } from "msw";
import {
  handlers,
  coordinatorHandlers,
  orphanHandlers,
  logAdminHandlers,
  secretsHandlers,
  variablesHandlers,
  auditHandlers,
  quotaHandlers,
  scheduleHandlers,
  gdprHandlers,
  capabilityHandlers,
  userMemoryHandlers,
  propertiesHandlers,
  triggerHandlers,
  backupSyncHandlers,
} from "../handlers";

/**
 * Does every mocked endpoint actually exist on the backend?
 *
 * 5,481 unit tests and 198 UI E2E tests validate the Manager against
 * `handlers.ts` — 5,000 lines of hand-written mocks. Nothing checked that those
 * mocks resemble EDDI. A mock that invents an endpoint, or keeps one the backend
 * has dropped, makes the whole suite prove the Manager is consistent with a
 * fiction the same repo wrote.
 *
 * This closes that in the direction that a snapshot can close cheaply: **no
 * handler may mock an operation the backend does not expose.** The other
 * direction — the backend gaining something the mocks lack — is what the
 * `integration` tier is for, since it needs a live instance to see.
 *
 * The snapshot is `openapi-operations.json`, method + path only, refreshed with
 * `.github/scripts/refresh-openapi-operations.mjs`. See that script for why it
 * is a snapshot rather than a live fetch.
 *
 * ## What this found when it was first run
 *
 * 301 handlers, 8 unmatched, of which three were real:
 * `parserstore/parsers/jsonSchema` and `snippetstore/snippets/jsonSchema` do not
 * exist (the backend serves `jsonSchema` for eleven stores, not those two) while
 * `schemas.ts` builds that URL generically for *every* resource type; and
 * `POST /snippetstore/snippets/{id}` does not exist either. All three are
 * exempted below with that reasoning rather than quietly deleted, because the
 * app-side fix is a separate change.
 */

const SNAPSHOT = path.join(__dirname, "..", "openapi-operations.json");

/**
 * Handlers that legitimately have no matching backend operation.
 *
 * Every entry carries a reason. An entry is a promise that the mismatch is
 * understood — not a place to silence a failure. Adding one without a reason
 * defeats the check.
 */
const EXEMPT: Record<string, string> = {
  "GET */openapi":
    "The document that defines this check. It does not describe itself, so it can never appear in its own path list.",

  "GET https://api.github.com/repos/labsai/EDDI/releases/latest":
    "Third party, by design — the update check. The single off-origin host the Manager contacts; update-check-card.test.tsx pins that invariant.",

  "GET */parserstore/parsers/jsonSchema":
    "DRIFT, tracked: EDDI serves jsonSchema for eleven stores and not parser. schemas.ts:20 builds the URL for every RESOURCE_TYPE, so this 404s in production while the mock answers 200. Fixing the app side is a separate change.",

  "GET */snippetstore/snippets/jsonSchema":
    "DRIFT, tracked: same as parserstore — no jsonSchema operation exists for this store.",

  "POST */snippetstore/snippets/:id":
    "DRIFT, tracked: the backend exposes put/get/delete on {id} for snippets, not post. parserstore does have post, which is probably where this was copied from.",

  "POST */secretstore/secrets/:tenantId/:keyName/rotate":
    "Anticipated absence, not drift: secrets.ts falls back to a plain PUT on 404/405, and says so. Worth knowing that the mock answering 200 means the fallback — the live path against a 6.3.0 backend — is never exercised by a test.",

  "GET */logs/recent":
    "Dead mock: production reads /administration/logs (logs.ts BASE + query string), which the snapshot does contain. Nothing calls this.",
};

const ALL_HANDLERS: RequestHandler[] = [
  ...handlers,
  ...coordinatorHandlers,
  ...orphanHandlers,
  ...logAdminHandlers,
  ...secretsHandlers,
  ...variablesHandlers,
  ...auditHandlers,
  ...quotaHandlers,
  ...scheduleHandlers,
  ...gdprHandlers,
  ...capabilityHandlers,
  ...userMemoryHandlers,
  ...propertiesHandlers,
  ...triggerHandlers,
  ...backupSyncHandlers,
];

/** `:id` and `{id}` both become `{}` so MSW and OpenAPI paths can be compared. */
function normalisePath(p: string): string {
  const withoutQuery = p.split("?")[0] ?? "";
  const collapsed = withoutQuery
    .split("/")
    .map((seg) =>
      seg.startsWith(":") || (seg.startsWith("{") && seg.endsWith("}")) ? "{}" : seg,
    )
    .join("/");
  return collapsed.replace(/\/+$/, "");
}

interface MockRoute {
  method: string;
  /** The pattern exactly as written, for exemption keys and failure messages. */
  raw: string;
  /** MSW's leading `*` spans path segments, so the pattern is a suffix. */
  wildcard: boolean;
  tail: string;
  /**
   * A pattern whose store segment is itself a parameter — a leading wildcard
   * followed by `:store/:plural/…` — is a catch-all standing in for many
   * concrete stores, so comparing it to one concrete spec path is meaningless.
   * It is matched segment-wise instead (see `matchesShape`), which still fails
   * if the shape is wrong.
   */
  genericStore: boolean;
}

function toRoute(handler: RequestHandler): MockRoute | null {
  const info = (handler as unknown as { info: { path: unknown; method: unknown } }).info;
  if (typeof info?.path !== "string" || typeof info?.method !== "string") return null;

  const raw = info.path;
  const wildcard = raw.startsWith("*");
  const stripped = raw.replace(/^\*/, "");
  const tail = normalisePath(stripped.startsWith("/") ? stripped : `/${stripped}`);
  const firstSegment = tail.split("/").filter(Boolean)[0];

  return {
    method: info.method.toUpperCase(),
    raw,
    wildcard,
    tail,
    genericStore: firstSegment === "{}",
  };
}

const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8")) as {
  eddiVersion: string;
  operations: string[];
};

const SPEC_OPERATIONS = snapshot.operations.map((op) => {
  const [method, ...rest] = op.split(" ");
  return { method: method!, path: normalisePath(rest.join(" ")) };
});

/**
 * Segment-wise match, with the mock's `{}` standing for any single segment.
 *
 * This is what makes a catch-all — a leading wildcard, then `{store}/{plural}/descriptors` —
 * checkable instead of skippable: it still has to line up with a real operation
 * of the same shape and the same trailing segments, so a typo in
 * `descriptors` — or a method the backend does not offer there — fails.
 */
function matchesShape(route: MockRoute, specPath: string): boolean {
  const routeSegs = route.tail.split("/").filter(Boolean);
  const specSegs = specPath.split("/").filter(Boolean);

  // A leading `*` spans segments, so the mock describes the tail of the path.
  if (route.wildcard) {
    if (specSegs.length < routeSegs.length) return false;
  } else if (specSegs.length !== routeSegs.length) {
    return false;
  }

  const offset = specSegs.length - routeSegs.length;
  return routeSegs.every((seg, i) => seg === "{}" || seg === specSegs[offset + i]);
}

/**
 * Exact match: every segment equal, and a `{}` on one side only satisfied by a
 * `{}` on the other. Stricter than `matchesShape` — a mock that puts a
 * parameter where the backend has a literal segment is a mismatch worth
 * knowing about, so ordinary routes are held to this.
 */
function matchesExactly(route: MockRoute, specPath: string): boolean {
  return route.wildcard
    ? specPath === route.tail || specPath.endsWith(route.tail)
    : specPath === route.tail;
}

function isInSpec(route: MockRoute): boolean {
  // Catch-alls cannot be compared exactly — their store segment is a parameter
  // standing in for any store — so only those fall back to the shape match.
  const matches = route.genericStore ? matchesShape : matchesExactly;
  return SPEC_OPERATIONS.some(
    (op) => op.method === route.method && matches(route, op.path),
  );
}

describe(`MSW handlers against EDDI ${snapshot.eddiVersion}'s API surface`, () => {
  const routes = ALL_HANDLERS.map(toRoute).filter((r): r is MockRoute => r !== null);

  it("reads a snapshot that actually has operations in it", () => {
    // Guards the whole file: an empty or malformed snapshot would make every
    // assertion below vacuous rather than failing.
    expect(SPEC_OPERATIONS.length).toBeGreaterThan(100);
    expect(routes.length).toBeGreaterThan(100);
  });

  it("mocks no endpoint the backend does not expose", () => {
    const unexplained = routes
      .filter((r) => !isInSpec(r))
      .filter((r) => !(`${r.method} ${r.raw}` in EXEMPT))
      .map((r) => `${r.method} ${r.raw}`);

    expect(
      unexplained,
      [
        "These MSW handlers mock endpoints that EDDI does not expose, so every test",
        "using them is validating against a fiction. Either fix the handler, or add it",
        `to EXEMPT in this file with a reason. If the backend gained the endpoint, run:`,
        "  node .github/scripts/refresh-openapi-operations.mjs",
      ].join("\n"),
    ).toEqual([]);
  });

  it("keeps every exemption pointed at a handler that still exists", () => {
    // An exemption outliving its handler is a stale excuse, and the next real
    // drift on that path would be silently waved through.
    const present = new Set(routes.map((r) => `${r.method} ${r.raw}`));
    const orphaned = Object.keys(EXEMPT).filter((key) => !present.has(key));

    expect(orphaned, "EXEMPT entries with no matching handler — delete them").toEqual([]);
  });

  it("gives every exemption a reason", () => {
    const unreasoned = Object.entries(EXEMPT)
      .filter(([, reason]) => reason.trim().length < 20)
      .map(([key]) => key);

    expect(unreasoned, "an exemption without a reason is just a silenced failure").toEqual([]);
  });

  it("contacts exactly one off-origin host", () => {
    // The update check is the only outbound call the Manager makes, and
    // updates.ts is built around that being true. A second absolute URL
    // appearing in the mocks means a second one appeared in the app.
    const hosts = [
      ...new Set(
        routes
          .filter((r) => /^https?:\/\//.test(r.raw))
          .map((r) => new URL(r.raw).host),
      ),
    ];
    expect(hosts).toEqual(["api.github.com"]);
  });
});
