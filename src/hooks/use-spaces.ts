import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getWorkspaceInfo,
  WORKSPACES_UNAVAILABLE,
  type SpaceInfo,
  type WorkspaceInfo,
} from "@/lib/api/workspaces";

/**
 * Where the chosen space is remembered.
 *
 * Per browser, not per server: which workspace you were last looking at is a
 * view preference, and round-tripping it through the backend would make an
 * ordinary UI choice look like account state.
 */
const STORAGE_KEY = "eddi.workspace.space";

/** The sentinel for "everything I can reach", which is also the default. */
export const ALL_SPACES = "";

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ALL_SPACES;
  } catch {
    // Private mode, or site data blocked. A forgotten preference is not worth
    // a broken page.
    return ALL_SPACES;
  }
}

function writeStored(spaceId: string) {
  try {
    if (spaceId === ALL_SPACES) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, spaceId);
  } catch {
    // Ignore: the switcher still works for this session.
  }
}

export interface UseSpacesResult {
  /**
   * Whether the backend enforces workspaces at all.
   *
   * Every workspace affordance is gated on this. A deployment with the feature
   * off must look exactly like the release before it — a Share dialog that
   * cannot change anything is worse than no Share button.
   */
  enabled: boolean;
  /**
   * The caller's principal as the backend records it — the value stamped as
   * `ownerId`. Compare against this, not the token's display name.
   */
  principal: string | null;
  /** Whether this caller sees other people's resources (admin, or feature off). */
  seesEverything: boolean;
  /** Every space this user can reach, personal first. */
  spaces: SpaceInfo[];
  /** The active space id, or {@link ALL_SPACES} for no narrowing. */
  activeSpace: string;
  setActiveSpace: (spaceId: string) => void;
  /** The active space's descriptor, or null when showing everything. */
  active: SpaceInfo | null;
  /**
   * Whether a switcher is worth showing at all. One space means the control
   * would only ever offer the view the user already has.
   */
  hasChoice: boolean;
  /** True until the first answer arrives, so callers can avoid a flash. */
  isLoading: boolean;
}

/**
 * The spaces the current user can reach and which one the UI is filtered to.
 *
 * <h3>The server is the source of truth, deliberately</h3> An earlier version
 * derived the space list from the Keycloak token client-side. That is easy to
 * get subtly wrong — a space id encoded differently does not throw, it selects
 * a workspace matching nothing, which renders as "you have no agents". Asking
 * the backend removes the second implementation of the encoding along with that
 * whole class of silent failure, and it is the only way to learn whether
 * enforcement is even switched on, which has no evidence in the data.
 *
 * The active space is a *narrowing*, never a widening: the backend scopes every
 * listing to what the caller may see regardless, and asking for a space you
 * cannot reach returns nothing rather than granting it. So this is safe to
 * treat as pure presentation.
 */
export function useSpaces(): UseSpacesResult {
  const { data, isLoading } = useQuery<WorkspaceInfo>({
    queryKey: ["workspaces", "info"],
    queryFn: getWorkspaceInfo,
    // Group membership and the enforcement flag change on the order of a
    // deployment, not a page view. Refetching either on every mount would be
    // noise on every screen in the app.
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // An error resolves to "no workspaces" rather than blocking the page: the
  // rest of the Manager works fine without them, and every real restriction is
  // enforced server-side no matter what is drawn here.
  const info = data ?? WORKSPACES_UNAVAILABLE;
  const spaces = useMemo(() => info.spaces, [info]);

  const [activeSpace, setActive] = useState<string>(readStored);

  // A remembered space the user can no longer reach — they left the group, or
  // the deployment turned workspaces off — would filter everything away with no
  // visible cause. Drop back to showing everything instead.
  useEffect(() => {
    if (activeSpace === ALL_SPACES) return;
    if (isLoading) return;
    if (spaces.some((s) => s.id === activeSpace)) return;
    setActive(ALL_SPACES);
    writeStored(ALL_SPACES);
  }, [spaces, activeSpace, isLoading]);

  const setActiveSpace = useCallback((spaceId: string) => {
    setActive(spaceId);
    writeStored(spaceId);
  }, []);

  const active = useMemo(
    () => spaces.find((s) => s.id === activeSpace) ?? null,
    [spaces, activeSpace]
  );

  // A space narrowing is meaningless once we KNOW nothing is enforced — everyone
  // already sees everything. But "we have not asked yet" is not "it is off":
  // dropping the narrowing while the query is in flight makes every listing
  // fetch unfiltered first and refetch a moment later, which the user sees as
  // their workspace filter briefly not applying. So the remembered choice
  // stands until an answer actually says enforcement is off, and the worst case
  // is one ignored query parameter.
  const narrowingApplies = data ? data.enabled : true;

  return {
    enabled: info.enabled,
    principal: info.principal,
    seesEverything: info.seesEverything,
    spaces,
    activeSpace: narrowingApplies ? activeSpace : ALL_SPACES,
    setActiveSpace,
    active,
    hasChoice: info.enabled && spaces.length > 1,
    isLoading,
  };
}
