import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getEnrichedConnectionDescriptors,
  getConnection,
  createConnection,
  updateConnection,
  deleteConnection,
  duplicateConnection,
  listMyConnections,
  authorizeConnection,
  disconnectConnection,
  type ConnectionConfiguration,
} from "@/lib/api/connections";

const CONNECTIONS_KEY = ["connections"] as const;

/**
 * The linked-accounts list.
 *
 * A child of `["connections"]` on purpose: deleting a connection deletes its
 * grants, so a config mutation invalidating the parent takes this with it.
 */
const MINE_KEY = [...CONNECTIONS_KEY, "mine"] as const;

// ─── Admin CRUD ─────────────────────────────────────────────────

/**
 * The connection configurations, enriched for the list.
 *
 * `enabled` exists for the per-user page, which wants this list only when the
 * viewer is an admin — asking anyway would spend a guaranteed 403 (and an
 * audit-log entry) on every page view to render nothing.
 */
export function useConnectionDescriptors(
  limit = 20,
  index = 0,
  filter = "",
  enabled = true,
) {
  return useQuery({
    queryKey: [...CONNECTIONS_KEY, "enriched", { limit, index, filter }],
    queryFn: () => getEnrichedConnectionDescriptors(limit, index, filter),
    enabled,
    /**
     * A 403 is an answer, not a failure to retry. Retrying it three times
     * delays the "you are not an eddi-admin" screen by several seconds and
     * puts three refusals in the server's audit log for one page view.
     */
    retry: (failureCount, error) =>
      failureCount < 2 &&
      !(typeof error === "object" &&
        error !== null &&
        "status" in error &&
        [401, 403, 404].includes((error as { status: number }).status)),
  });
}

export function useConnection(id: string, version?: number) {
  return useQuery({
    queryKey: [...CONNECTIONS_KEY, id, version],
    queryFn: () => getConnection(id, version),
    enabled: !!id,
  });
}

export function useCreateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: ConnectionConfiguration) => createConnection(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    },
  });
}

export function useUpdateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      version,
      config,
    }: {
      id: string;
      version: number;
      config: ConnectionConfiguration;
    }) => updateConnection(id, version, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    },
  });
}

export function useDeleteConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      version,
      permanent,
    }: {
      id: string;
      version: number;
      permanent?: boolean;
    }) => deleteConnection(id, version, permanent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    },
  });
}

export function useDuplicateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      duplicateConnection(id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    },
  });
}

// ─── Per-user grants ────────────────────────────────────────────

/**
 * The calling user's linked accounts.
 *
 * `retry: false` because both of its interesting failures are final answers:
 * a 404 means the feature is off and a 403 means there is no verified
 * identity. Neither improves on a second attempt, and both are states the page
 * renders deliberately rather than errors it hides.
 */
export function useMyConnections(enabled = true) {
  return useQuery({
    queryKey: MINE_KEY,
    queryFn: listMyConnections,
    enabled,
    retry: false,
  });
}

/**
 * Begin linking an account.
 *
 * Returns the provider URL; it does **not** navigate. The caller decides when
 * the page may leave, because the page leaving is the point at which any
 * unsaved state is lost.
 */
export function useAuthorizeConnection() {
  return useMutation({
    mutationFn: ({ name, returnTo }: { name: string; returnTo: string }) =>
      authorizeConnection(name, returnTo),
  });
}

export function useDisconnectConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ name }: { name: string }) => disconnectConnection(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MINE_KEY });
    },
  });
}
