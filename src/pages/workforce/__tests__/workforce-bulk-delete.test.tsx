import { describe, it, expect, beforeEach, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { renderWithProviders, userEvent } from "@/test/test-utils";
import { server } from "@/test/mocks/server";

import { WorkforceDashboard } from "../workforce-dashboard";

/**
 * Bulk delete used to fire on the click, with nothing in between.
 *
 * Deleting ONE task force has always gone through an AlertDialog — WorkforceCard
 * renders it — so the more destructive action was the one with the weaker guard.
 * These tests are written against the network rather than against the dialog:
 * what matters is not that a dialog appeared, it is that nothing was deleted
 * until someone said so. Asserting on the dialog alone would still pass if the
 * confirm button were wired to nothing at all.
 */

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverMock;

/** Records every DELETE the page actually sends. */
function watchDeletes() {
  const deleted: string[] = [];
  server.use(
    http.delete("*/groupstore/groups/:id", ({ params }) => {
      deleted.push(String(params.id));
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return deleted;
}

/** Enter bulk mode and select the first task force offered. */
async function selectFirstTaskForce(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Select" }));

  const checkboxes = await screen.findAllByRole("button", { name: "Select" });
  // The toolbar's own toggle now reads "Cancel", so every remaining "Select"
  // is a card. Take the first.
  const card = checkboxes.find((b) => b.getAttribute("aria-pressed") === "false");
  expect(card, "no selectable task force was rendered").toBeTruthy();
  await user.click(card!);
}

describe("WorkforceDashboard bulk delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes nothing until the deletion is confirmed", async () => {
    const deleted = watchDeletes();
    const user = userEvent.setup();
    renderWithProviders(<WorkforceDashboard />);

    await selectFirstTaskForce(user);
    await user.click(screen.getByTestId("bulk-delete-btn"));

    // The dialog is up...
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    // ...and this is the part that used to be false.
    expect(deleted).toEqual([]);
  });

  it("still deletes nothing when the dialog is dismissed", async () => {
    const deleted = watchDeletes();
    const user = userEvent.setup();
    renderWithProviders(<WorkforceDashboard />);

    await selectFirstTaskForce(user);
    await user.click(screen.getByTestId("bulk-delete-btn"));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(deleted).toEqual([]);
  });

  it("deletes the selected task force once confirmed", async () => {
    const deleted = watchDeletes();
    const user = userEvent.setup();
    renderWithProviders(<WorkforceDashboard />);

    await selectFirstTaskForce(user);
    await user.click(screen.getByTestId("bulk-delete-btn"));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleted).toHaveLength(1));
  });

  it("names the number at risk, so 'Delete' is not a guess", async () => {
    const user = userEvent.setup();
    renderWithProviders(<WorkforceDashboard />);

    await selectFirstTaskForce(user);
    await user.click(screen.getByTestId("bulk-delete-btn"));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/1/)).toBeInTheDocument();
    expect(within(dialog).getByText(/cannot be undone/i)).toBeInTheDocument();
  });
});
