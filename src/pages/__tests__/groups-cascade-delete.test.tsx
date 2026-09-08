import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { renderPage } from "@/test/test-utils";
import { server } from "@/test/mocks/server";
import { GroupsPage } from "@/pages/groups";

/**
 * The list's trash icon is the entry point most people use, and it used to
 * delete the group alone — leaving a wizard-built team's agents belonging to
 * nothing. The checkbox that fixes that has to cascade over the group's REAL
 * configuration: the enriched descriptor behind this list carries a member list
 * but no `moderatorAgentId`, and `deleteGroupWithMembers` deletes the moderator
 * too, so cascading over the descriptor leaves exactly the orphan the checkbox
 * exists to prevent.
 */

const GROUP = {
  id: "grp-cascade",
  name: "Standing team",
  description: "",
  style: "ROUND_TABLE",
  moderatorAgentId: "agent-moderator",
  members: [
    { agentId: "agent-one", displayName: "Ana" },
    { agentId: "agent-two", displayName: "Ben" },
  ],
};

function serve(onDeleteAgent: (id: string) => void, groupOk = true) {
  server.use(
    http.get("*/groupstore/groups/descriptors", () =>
      HttpResponse.json([
        {
          resource: `eddi://ai.labs.group/groupstore/groups/${GROUP.id}?version=1`,
          name: GROUP.name,
          description: "",
          createdOn: 1,
          lastModifiedOn: 2,
        },
      ]),
    ),
    http.get(`*/groupstore/groups/${GROUP.id}`, () =>
      groupOk
        ? HttpResponse.json(GROUP)
        : new HttpResponse(null, { status: 500 }),
    ),
    http.get("*/agentstore/agents/:agentId/currentversion", () =>
      HttpResponse.text("1"),
    ),
    http.delete("*/agentstore/agents/:agentId", ({ params }) => {
      onDeleteAgent(String(params.agentId));
      return new HttpResponse(null, { status: 204 });
    }),
    http.delete(`*/groupstore/groups/${GROUP.id}`, () => new HttpResponse(null, { status: 204 })),
  );
}

async function openDeleteDialog() {
  renderPage("/manage/groups", <GroupsPage />);
  // Delete lives in the card's actions menu, so the menu opens first.
  await userEvent.click(await screen.findByTestId(`group-menu-${GROUP.id}`));
  await userEvent.click(await screen.findByRole("button", { name: /^delete$/i }));
  return screen.findByTestId("delete-members-checkbox");
}

/** The dialog's confirm button, which is the only Delete left once it is open. */
function confirmButton() {
  return screen.getByRole("button", { name: /^delete$/i });
}

describe("GroupsPage — cascade delete", () => {
  it("deletes the moderator too, which the list's own data does not name", async () => {
    const deleted: string[] = [];
    serve((id) => deleted.push(id));

    const checkbox = await openDeleteDialog();
    await userEvent.click(checkbox);
    await userEvent.click(confirmButton());

    await waitFor(() => expect(deleted).toContain("agent-moderator"));
    expect(deleted).toEqual(
      expect.arrayContaining(["agent-one", "agent-two", "agent-moderator"]),
    );
  });

  it("deletes no agents when the box is left unticked", async () => {
    const deleted: string[] = [];
    serve((id) => deleted.push(id));

    await openDeleteDialog();
    await userEvent.click(confirmButton());

    await waitFor(() => expect(screen.queryByTestId("delete-members-checkbox")).toBeNull());
    expect(deleted).toEqual([]);
  });

  it("deletes nothing when the group's members cannot be read", async () => {
    // Quietly downgrading to a group-only delete would keep the agents, which
    // is the one thing the reader just said they did not want.
    const deleted: string[] = [];
    serve((id) => deleted.push(id), false);

    const checkbox = await openDeleteDialog();
    await userEvent.click(checkbox);
    await userEvent.click(confirmButton());

    await waitFor(() => expect(screen.getByTestId("delete-members-checkbox")).toBeInTheDocument());
    expect(deleted).toEqual([]);
  });
});
