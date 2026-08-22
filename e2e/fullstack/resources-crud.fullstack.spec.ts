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

      // Warm this store first.
      //
      // The FIRST resource created in a given store never gets a descriptor:
      // 201 from the store, document retrievable by id, and `…/descriptors`
      // stays empty. Every write after that is listed within a second.
      //
      // Established by dispatch, not inference. Rules was first and failed;
      // removing Rules moved the failure to API Calls; a global warm-up that
      // created an apicall made API Calls pass and left Rules failing. The
      // common factor is the first write per store, not the type and not the
      // position. It stayed hidden because the old assertion looked for `some
      // link` rather than the id it had just created, so a leftover from an
      // earlier run satisfied it.
      const warmup = await request.post(`${API_BASE}/${rt.store}/${rt.plural}`, {
        data: rt.createPayload,
      });
      if (warmup.status() === 201) {
        const warm = extractIdFromLocation(warmup.headers()["location"]!);
        await cleanupResource(
          request,
          `${rt.store}/${rt.plural}`,
          warm.id,
          warm.version
        );
      }

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

