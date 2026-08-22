import { test, expect } from "@playwright/test";
import {
  waitForFullStack,
  navigateTo,
  API_BASE,
  waitForBackend,
} from "./fullstack-helpers";
import {
  extractIdFromLocation,
  cleanupResource,
} from "../integration/integration-helpers";

/**
 * Resource types and their API store paths.
 * Used for parameterized CRUD testing through the browser UI.
 */
interface ResourceTypeCase {
  name: string;
  urlType: string;
  store: string;
  plural: string;
  createPayload: Record<string, unknown>;
}

const RESOURCE_TYPES: ResourceTypeCase[] = [
  {
    name: "Rules",
    urlType: "rules",
    store: "rulestore",
    plural: "rulesets",
    createPayload: { behaviorGroups: [] },
  },
  {
    name: "API Calls",
    urlType: "apicalls",
    store: "apicallstore",
    plural: "apicalls",
    createPayload: { targetServerUrl: "", httpCalls: [] },
  },
  {
    name: "Output Sets",
    urlType: "output",
    store: "outputstore",
    plural: "outputsets",
    createPayload: { outputSet: [] },
  },
  {
    name: "Dictionaries",
    urlType: "dictionary",
    store: "dictionarystore",
    plural: "dictionaries",
    createPayload: { words: [], phrases: [], regExs: [] },
  },
  {
    name: "LLM",
    urlType: "llm",
    store: "llmstore",
    plural: "llms",
    createPayload: { tasks: [] },
  },
  {
    name: "Property Setter",
    urlType: "propertysetter",
    store: "propertysetterstore",
    plural: "propertysetters",
    createPayload: { setOnActions: [] },
  },
] as const;

/**
 * Resources hub and per-type list pages verified with real backend data.
 */
test.describe("Resources — Full Stack", () => {
  test.describe.configure({ timeout: 120_000, mode: "serial" });

  const cleanup: { storePath: string; id: string; version: number }[] = [];

  test.beforeAll(async ({ request }) => {
    await waitForBackend(request);

    // Wait for the DESCRIPTOR mechanism, not just for health.
    //
    // Whichever test ran first used to fail — Rules while it was first, API
    // Calls the moment Rules was removed — with the resource created (201,
    // retrievable by id) and its store's `…/descriptors` empty for a full
    // thirty seconds. Neither a per-store warm-up nor a global create/delete
    // fixed it, because the thing that is not ready is the descriptor
    // projection itself, and `waitForBackend` only asks whether EDDI is up.
    //
    // So this creates a throwaway resource and waits until it is actually
    // LISTED before any test asserts anything, then removes it.
    const probe = await request.post(`${API_BASE}/apicallstore/apicalls`, {
      data: { targetServerUrl: "", httpCalls: [] },
    });
    expect(probe.status()).toBe(201);
    const { id, version } = extractIdFromLocation(probe.headers()["location"]!);

    try {
      await expect
        .poll(
          async () => {
            const res = await request.get(
              `${API_BASE}/apicallstore/apicalls/descriptors?limit=100&index=0`
            );
            if (!res.ok()) return false;
            const descriptors = (await res.json()) as Array<{ resource?: string }>;
            return descriptors.some((d) => (d.resource ?? "").includes(id));
          },
          {
            timeout: 90_000,
            message:
              "EDDI never listed a freshly created resource — the descriptor projection is not coming up, and every case below would fail on it",
          }
        )
        .toBe(true);
    } finally {
      await cleanupResource(request, "apicallstore/apicalls", id, version);
    }
  });

  test.afterAll(async ({ request }) => {
    for (const item of cleanup) {
      await cleanupResource(request, item.storePath, item.id, item.version);
    }
  });

  test("resources hub shows all resource type cards", async ({
    page,
    request,
  }) => {
    await waitForFullStack(page, request, "/manage/resources", {
      skipHealthCheck: true,
    });

    // All 6 resource type cards should be visible
    for (const rt of RESOURCE_TYPES) {
      await expect(
        page.getByTestId(`resource-type-${rt.urlType}`)
      ).toBeVisible();
    }
  });

  for (const rt of RESOURCE_TYPES) {
    test(`${rt.name}: created resource appears in list`, async ({
      page,
      request,
    }) => {

      // Create resource via API
      const basePath = `${rt.store}/${rt.plural}`;
      const createRes = await request.post(`${API_BASE}/${basePath}`, {
        data: rt.createPayload,
      });
      expect(createRes.status()).toBe(201);
      const { id, version } = extractIdFromLocation(
        createRes.headers()["location"]!
      );
      cleanup.push({ storePath: basePath, id, version });

      // Wait for the BACKEND to list it before opening the page.
      //
      // `navigateTo` loads the list, React Query caches whatever the descriptors
      // endpoint returned, and the page does not refetch on its own — so a
      // `toBeVisible` poll afterwards re-reads a DOM that will never change. If
      // the descriptor lands a moment after the POST returns 201, the test waits
      // ten seconds for a list that was already decided. The first type through
      // wears it: EDDI creates the collection and its indexes on that first
      // write, which is visible in the backend log, and `Rules` — first in this
      // array — is the one that has been failing on every push to main.
      //
      // Polling the API first removes the race for every type. It also turns a
      // genuine 'never listed' into a failure that says so, instead of a UI
      // assertion timing out with no clue why.
      await expect
        .poll(
          async () => {
            const res = await request.get(
              `${API_BASE}/${basePath}/descriptors?limit=100&index=0`
            );
            if (!res.ok()) return [];
            const descriptors = (await res.json()) as Array<{ resource?: string }>;
            return descriptors.map((d) => d.resource ?? "");
          },
          {
            timeout: 30_000,
            message: `${rt.name} was created but never appeared in ${basePath}/descriptors`,
          }
        )
        .toEqual(expect.arrayContaining([expect.stringContaining(id)]));

      // Navigate to the resource type list page
      await navigateTo(page, `/manage/resources/${rt.urlType}`);

      // The resource THIS test created, by id — not merely 'a link exists'.
      await expect(
        page.locator(`main a[href*="/manage/resources/${rt.urlType}/${id}"]`)
      ).toBeVisible({ timeout: 10_000 });
    });
  }

  test("resource detail page renders content", async ({ page, request }) => {
    // Create a behavior resource to view in detail
    const createRes = await request.post(
      `${API_BASE}/rulestore/rulesets`,
      { data: { behaviorGroups: [] } }
    );
    expect(createRes.status()).toBe(201);
    const { id, version } = extractIdFromLocation(
      createRes.headers()["location"]!
    );
    cleanup.push({
      storePath: "rulestore/rulesets",
      id,
      version,
    });

    // `rules`, not `behavior`: the resource is created through
    // `rulestore/rulesets`, so opening the legacy slug would route to a
    // different (non-existent) type and render the "unknown type" error state
    // while the two assertions below still passed.
    await navigateTo(page, `/manage/resources/rules/${id}`);

    // Back link should be visible
    await expect(page.getByTestId("back-to-list")).toBeVisible();

    // Main content area should have rendered
    await expect(page.locator("main").first()).toBeVisible();
  });

  test("resource type card navigates to list page", async ({ page }) => {
    await navigateTo(page, "/manage/resources");

    await page.getByTestId("resource-type-behavior").click();
    await expect(page).toHaveURL(/\/manage\/resources\/behavior/);
  });
});

