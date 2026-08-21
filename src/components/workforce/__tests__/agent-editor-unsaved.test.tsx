import { describe, it, expect, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, userEvent } from "@/test/test-utils";

import { AgentEditorSheet } from "../agent-editor-sheet";

/**
 * The sheet has four ways out — Escape, the backdrop, the X, and Cancel — and
 * they did not agree with each other.
 *
 * Escape and the backdrop called `window.confirm`. The X and Cancel called
 * `onClose` directly, so typing into an agent's description and then clicking
 * the X threw the edit away with no warning at all. A guard present on two of
 * four paths is the sort of thing an existing "renders close button that calls
 * onClose" test actively certifies as correct.
 *
 * So every path gets the same three questions: does a clean sheet close without
 * fuss, does a dirty one refuse to close until asked, and does declining keep
 * the edit.
 */

async function openSheet(onClose: () => void, { dirty }: { dirty: boolean }) {
  const user = userEvent.setup();
  renderWithProviders(<AgentEditorSheet agentId="agent1" onClose={onClose} />);
  const description = await screen.findByLabelText("Description");
  if (dirty) await user.type(description, " edited");
  return user;
}

/** The four exits. Each runs while no dialog is open, so the queries are unambiguous. */
const EXITS: Array<[string, (user: ReturnType<typeof userEvent.setup>) => Promise<void>]> = [
  ["the X", (user) => user.click(screen.getByRole("button", { name: /close/i }))],
  ["Cancel", (user) => user.click(screen.getByRole("button", { name: "Cancel" }))],
  ["Escape", (user) => user.keyboard("{Escape}")],
  [
    "the backdrop",
    async (user) => {
      // `.z-40` is the sheet's own overlay; the dialog's is z-50 and is not
      // present yet at this point anyway.
      const backdrop = document.querySelector('[aria-hidden="true"].fixed.inset-0.z-40');
      expect(backdrop, "the sheet's backdrop overlay was not rendered").toBeTruthy();
      await user.click(backdrop as Element);
    },
  ],
];

describe("AgentEditorSheet unsaved changes", () => {
  describe.each(EXITS)("closing via %s", (_label, exit) => {
    it("closes straight away when nothing has been edited", async () => {
      const onClose = vi.fn();
      const user = await openSheet(onClose, { dirty: false });

      await exit(user);

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("asks first when there are unsaved changes", async () => {
      const onClose = vi.fn();
      const user = await openSheet(onClose, { dirty: true });

      await exit(user);

      expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
      expect(onClose).not.toHaveBeenCalled();
    });

    it("keeps the edit when the discard is declined", async () => {
      const onClose = vi.fn();
      const user = await openSheet(onClose, { dirty: true });

      await exit(user);
      await screen.findByRole("alertdialog");
      await user.click(screen.getByTestId("unsaved-cancel"));

      await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
      expect(onClose).not.toHaveBeenCalled();
      const description = screen.getByLabelText("Description") as HTMLTextAreaElement;
      expect(description.value).toContain("edited");
    });
  });

  it("closes once the discard is confirmed", async () => {
    const onClose = vi.fn();
    const user = await openSheet(onClose, { dirty: true });

    await user.keyboard("{Escape}");
    await screen.findByRole("alertdialog");
    await user.click(screen.getByTestId("unsaved-confirm"));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
