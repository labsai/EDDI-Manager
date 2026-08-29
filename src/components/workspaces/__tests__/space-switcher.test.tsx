import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, userEvent } from "@/test/test-utils";
import { SpaceSwitcher } from "@/components/workspaces/space-switcher";
import * as workspacesApi from "@/lib/api/workspaces";
import type { WorkspaceInfo } from "@/lib/api/workspaces";

const ALICE = "alice@example.com";
const PERSONAL = { id: `user:${ALICE}`, kind: "personal" as const, label: ALICE };
const TEAM = { id: "team:engineering", kind: "team" as const, label: "engineering" };

function info(overrides: Partial<WorkspaceInfo> = {}): WorkspaceInfo {
  return {
    enabled: true,
    principal: ALICE,
    defaultSpace: PERSONAL.id,
    spaces: [PERSONAL, TEAM],
    seesEverything: false,
    ...overrides,
  };
}

/**
 * A control that hides itself more often than it appears.
 *
 * Every "renders nothing" case here is a deliberate refusal to teach a concept
 * the deployment does not use — and each one would otherwise show a filter that
 * either cannot work or has nothing to offer.
 */
describe("SpaceSwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  async function render(ws = info()) {
    vi.spyOn(workspacesApi, "getWorkspaceInfo").mockResolvedValue(ws);
    const result = renderWithProviders(<SpaceSwitcher />);
    await waitFor(() => expect(workspacesApi.getWorkspaceInfo).toHaveBeenCalled());
    return result;
  }

  it("offers every space the caller can reach, plus the unfiltered view", async () => {
    await render();

    await userEvent.click(await screen.findByTestId("space-switcher"));

    expect(screen.getByTestId("space-option-all")).toBeInTheDocument();
    expect(screen.getByTestId(`space-option-${PERSONAL.id}`)).toBeInTheDocument();
    expect(screen.getByTestId(`space-option-${TEAM.id}`)).toBeInTheDocument();
  });

  it("hides itself when enforcement is off", async () => {
    // Everyone already sees everything, so the control could only ever narrow
    // to a filter the server will not apply.
    await render(info({ enabled: false, seesEverything: true }));

    await waitFor(() => expect(screen.queryByTestId("space-switcher")).not.toBeInTheDocument());
  });

  it("hides itself when there is only one space to choose", async () => {
    await render(info({ spaces: [PERSONAL] }));

    await waitFor(() => expect(screen.queryByTestId("space-switcher")).not.toBeInTheDocument());
  });

  it("calls the personal space the same thing in the trigger as in the menu", async () => {
    // The trigger used the raw label and so showed "alice@example.com" one
    // click after the menu had called it "My workspace" — the same space named
    // two different things.
    await render();

    await userEvent.click(await screen.findByTestId("space-switcher"));
    await userEvent.click(screen.getByTestId(`space-option-${PERSONAL.id}`));

    expect(screen.getByTestId("space-switcher")).toHaveTextContent("My workspace");
    expect(screen.getByTestId("space-switcher")).not.toHaveTextContent(ALICE);
  });

  it("shows a team by its name once chosen", async () => {
    await render();

    await userEvent.click(await screen.findByTestId("space-switcher"));
    await userEvent.click(screen.getByTestId(`space-option-${TEAM.id}`));

    expect(screen.getByTestId("space-switcher")).toHaveTextContent("engineering");
    expect(localStorage.getItem("eddi.workspace.space")).toBe(TEAM.id);
  });

  it("returns to the unfiltered view", async () => {
    await render();

    await userEvent.click(await screen.findByTestId("space-switcher"));
    await userEvent.click(screen.getByTestId(`space-option-${TEAM.id}`));
    await userEvent.click(screen.getByTestId("space-switcher"));
    await userEvent.click(screen.getByTestId("space-option-all"));

    expect(screen.getByTestId("space-switcher")).toHaveTextContent("All workspaces");
    expect(localStorage.getItem("eddi.workspace.space")).toBeNull();
  });
});
