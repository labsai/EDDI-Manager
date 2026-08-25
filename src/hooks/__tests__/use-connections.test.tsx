import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import { type ReactNode } from "react";
import { server } from "@/test/mocks/server";
import { useUpdateConnection, MINE_KEY } from "@/hooks/use-connections";
import type { ConnectionConfiguration } from "@/lib/api/connections";

/**
 * The save path's cache handling, tested at production's `staleTime`.
 *
 * The shared test client uses the default `staleTime: 0`, under which every
 * seeded entry is stale the instant it is written and the ordering bug below
 * cannot reproduce. `src/main.tsx` ships `staleTime: 30_000`, so these use a
 * client configured the same way — the difference between the two is the whole
 * subject of the test.
 */
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, Wrapper };
}

const DRAFT: ConnectionConfiguration = {
  name: "jira",
  description: "edited locally",
  authType: "STATIC",
  binding: "SERVICE",
  allowUnverifiedPrincipal: false,
  oauth: null,
  staticAuth: {
    headerName: "Authorization",
    valueTemplate: "Bearer ${vault:jira-token}",
  },
  baseUrlAllowlist: ["https://jira.example.com"],
} as ConnectionConfiguration;

function acceptSave() {
  server.use(
    http.put("*/connectionstore/connections/:id", ({ params }) =>
      HttpResponse.json(
        {},
        {
          status: 200,
          headers: {
            Location: `/connectionstore/connections/${params.id}?version=7`,
          },
        },
      ),
    ),
  );
}

describe("useUpdateConnection", () => {
  it("seeds the version the save created, so the page has something to render", async () => {
    acceptSave();
    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateConnection(), { wrapper: Wrapper });

    await result.current.mutateAsync({ id: "conn1", version: 6, config: DRAFT });

    await waitFor(() =>
      expect(queryClient.getQueryData(["connections", "conn1", 7])).toEqual(DRAFT),
    );
  });

  it("leaves that seed INVALIDATED, so the server still gets the last word", async () => {
    // The ordering trap. `invalidateQueries` only marks the queries that exist
    // when it runs, and at a 30s staleTime a seed written afterwards is fresh:
    // no observer would refetch it, and anything the server normalised on write
    // would stay invisible for half a minute. Seeding first means the
    // invalidation catches this key too.
    acceptSave();
    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateConnection(), { wrapper: Wrapper });

    await result.current.mutateAsync({ id: "conn1", version: 6, config: DRAFT });

    await waitFor(() =>
      expect(queryClient.getQueryData(["connections", "conn1", 7])).toBeDefined(),
    );
    const state = queryClient.getQueryState(["connections", "conn1", 7]);
    expect(state?.isInvalidated).toBe(true);
  });

  it("still invalidates the rest of the tree, grants included", async () => {
    // Deleting or re-scoping a connection changes what its grants mean, which
    // is why the per-user list hangs off the same key.
    acceptSave();
    const { queryClient, Wrapper } = createWrapper();
    queryClient.setQueryData(MINE_KEY, []);
    const { result } = renderHook(() => useUpdateConnection(), { wrapper: Wrapper });

    await result.current.mutateAsync({ id: "conn1", version: 6, config: DRAFT });

    await waitFor(() =>
      expect(queryClient.getQueryState(MINE_KEY)?.isInvalidated).toBe(true),
    );
  });

  it("does not invent a cache entry when there is no Location to follow", async () => {
    server.use(
      http.put("*/connectionstore/connections/:id", () =>
        HttpResponse.json({}, { status: 200 }),
      ),
    );
    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateConnection(), { wrapper: Wrapper });

    await result.current.mutateAsync({ id: "conn1", version: 6, config: DRAFT });

    expect(queryClient.getQueryData(["connections", "conn1", 7])).toBeUndefined();
  });

  it("survives a Location it cannot parse", async () => {
    // An unparseable Location is the server's business, not the cache's: the
    // save still succeeded, and the page falls back to fetching.
    server.use(
      http.put("*/connectionstore/connections/:id", () =>
        HttpResponse.json({}, { status: 200, headers: { Location: "nonsense" } }),
      ),
    );
    const { queryClient, Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateConnection(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({ id: "conn1", version: 6, config: DRAFT }),
    ).resolves.toBeDefined();
    expect(queryClient.getQueryData(["connections", "conn1", 7])).toBeUndefined();
  });
});
