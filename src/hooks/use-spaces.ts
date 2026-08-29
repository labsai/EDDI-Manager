import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { spacesFor, type Space } from "@/lib/spaces";

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
  /** Every space this user can reach, personal first. */
  spaces: Space[];
  /** The active space id, or {@link ALL_SPACES} for no narrowing. */
  activeSpace: string;
  setActiveSpace: (spaceId: string) => void;
  /** The active space's descriptor, or null when showing everything. */
  active: Space | null;
  /**
   * Whether a switcher is worth showing at all. One space means the control
   * would only ever offer the view the user already has.
   */
  hasChoice: boolean;
}

/**
 * The spaces the current user can reach and which one the UI is filtered to.
 *
 * The active space is a *narrowing*, never a widening: the backend scopes every
 * listing to what the caller may see regardless, and asking for a space you
 * cannot reach returns nothing rather than granting it. So this is safe to
 * treat as pure presentation.
 */
export function useSpaces(): UseSpacesResult {
  const { user, groups } = useAuth();
  const principal = user?.username ?? null;

  const spaces = useMemo(() => spacesFor(principal, groups), [principal, groups]);
  const [activeSpace, setActive] = useState<string>(readStored);

  // A remembered space the user no longer belongs to would filter everything
  // away with no visible cause — drop back to showing everything instead.
  useEffect(() => {
    if (activeSpace === ALL_SPACES) return;
    if (spaces.length === 0) return;
    if (!spaces.some((s) => s.id === activeSpace)) {
      setActive(ALL_SPACES);
      writeStored(ALL_SPACES);
    }
  }, [spaces, activeSpace]);

  const setActiveSpace = useCallback((spaceId: string) => {
    setActive(spaceId);
    writeStored(spaceId);
  }, []);

  const active = useMemo(
    () => spaces.find((s) => s.id === activeSpace) ?? null,
    [spaces, activeSpace]
  );

  return {
    spaces,
    activeSpace,
    setActiveSpace,
    active,
    hasChoice: spaces.length > 1,
  };
}
