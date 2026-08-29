import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders, userEvent } from "@/test/test-utils";
import { ShareDialog } from "@/components/workspaces/share-dialog";
import { server } from "@/test/mocks/server";
import { http, HttpResponse } from "msw";

const RESOURCE_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const SHARES = `*/descriptorstore/descriptors/${RESOURCE_ID}/shares`;

function shareInfo(overrides: Record<string, unknown> = {}) {
  return {
    resourceId: RESOURCE_ID,
    ownerId: "alice",
    spaceId: "user:alice",
    visibility: "space",
    grants: [],
    callerLevel: "OWN",
    ...overrides,
  };
}

describe("ShareDialog", () => {
  const props = { open: true, onClose: vi.fn(), resourceId: RESOURCE_ID, resourceName: "Test Agent" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("tells a non-owner they cannot change access, and offers no controls that would fail", async () => {
    // Showing the controls and letting the server refuse would teach the user
    // that sharing is broken rather than that it is not theirs to do.
    server.use(http.get(SHARES, () => HttpResponse.json(shareInfo({ callerLevel: "VIEW" }))));

    renderWithProviders(<ShareDialog {...props} />);

    await waitFor(() => expect(screen.getByTestId("share-owner-line")).toBeInTheDocument());
    expect(screen.getByText(/only the owner can change who has access/i)).toBeInTheDocument();
    expect(screen.queryByTestId("share-submit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("visibility-published")).not.toBeInTheDocument();
  });

  it("asks twice before handing someone ownership", async () => {
    // Every other level is reversible by the owner alone. OWN is not: the
    // recipient can delete the resource and re-share it, and taking it back
    // needs their cooperation. So the first click warns instead of acting.
    const shared = vi.fn();
    server.use(
      http.get(SHARES, () => HttpResponse.json(shareInfo())),
      http.post(SHARES, () => {
        shared();
        return HttpResponse.json({ updated: [], skipped: [] });
      })
    );

    renderWithProviders(<ShareDialog {...props} />);
    await waitFor(() => expect(screen.getByTestId("share-subject-input")).toBeInTheDocument());

    await userEvent.type(screen.getByTestId("share-subject-input"), "bob");
    await userEvent.selectOptions(screen.getByTestId("share-level-select"), "OWN");
    await userEvent.click(screen.getByTestId("share-submit"));

    expect(screen.getByTestId("share-owner-warning")).toBeInTheDocument();
    expect(shared).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId("share-submit"));
    await waitFor(() => expect(shared).toHaveBeenCalledTimes(1));
  });

  it("cancels a pending ownership transfer when the level is changed", async () => {
    server.use(http.get(SHARES, () => HttpResponse.json(shareInfo())));

    renderWithProviders(<ShareDialog {...props} />);
    await waitFor(() => expect(screen.getByTestId("share-subject-input")).toBeInTheDocument());

    await userEvent.type(screen.getByTestId("share-subject-input"), "bob");
    await userEvent.selectOptions(screen.getByTestId("share-level-select"), "OWN");
    await userEvent.click(screen.getByTestId("share-submit"));
    expect(screen.getByTestId("share-owner-warning")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByTestId("share-level-select"), "VIEW");
    expect(screen.queryByTestId("share-owner-warning")).not.toBeInTheDocument();
  });

  it("shares at the chosen level without a second click for every other level", async () => {
    let sentLevel: string | null = null;
    server.use(
      http.get(SHARES, () => HttpResponse.json(shareInfo())),
      http.post(SHARES, ({ request }) => {
        sentLevel = new URL(request.url).searchParams.get("level");
        return HttpResponse.json({ updated: [{ id: RESOURCE_ID, name: "Test Agent" }], skipped: [] });
      })
    );

    renderWithProviders(<ShareDialog {...props} />);
    await waitFor(() => expect(screen.getByTestId("share-subject-input")).toBeInTheDocument());

    await userEvent.type(screen.getByTestId("share-subject-input"), "bob@example.com");
    await userEvent.click(screen.getByTestId("share-submit"));

    await waitFor(() => expect(sentLevel).toBe("USE"));
  });

  it("names what it declined to touch, rather than reporting a clean success", async () => {
    // A half-shared agent that nobody knows is half-shared is the failure mode
    // this summary exists to prevent.
    server.use(
      http.get(SHARES, () => HttpResponse.json(shareInfo())),
      http.post(SHARES, () =>
        HttpResponse.json({
          updated: [{ id: RESOURCE_ID, name: "Test Agent" }],
          skipped: [{ id: "bbbbbbbbbbbbbbbbbbbbbbbb", name: "Bob's rule set" }],
        })
      )
    );

    renderWithProviders(<ShareDialog {...props} />);
    await waitFor(() => expect(screen.getByTestId("share-subject-input")).toBeInTheDocument());

    await userEvent.type(screen.getByTestId("share-subject-input"), "bob");
    await userEvent.click(screen.getByTestId("share-submit"));

    await waitFor(() => expect(screen.getByTestId("share-cascade-summary")).toBeInTheDocument());
    expect(screen.getByText("Bob's rule set")).toBeInTheDocument();
    expect(screen.getByText(/left unchanged/i)).toBeInTheDocument();
  });

  it("counts one resource in the singular and several in the plural", async () => {
    server.use(
      http.get(SHARES, () => HttpResponse.json(shareInfo())),
      http.post(SHARES, () =>
        HttpResponse.json({
          updated: [
            { id: "1111111111111111111111aa", name: "a" },
            { id: "2222222222222222222222bb", name: "b" },
          ],
          skipped: [],
        })
      )
    );

    renderWithProviders(<ShareDialog {...props} />);
    await waitFor(() => expect(screen.getByTestId("share-subject-input")).toBeInTheDocument());

    await userEvent.type(screen.getByTestId("share-subject-input"), "bob");
    await userEvent.click(screen.getByTestId("share-submit"));

    // "Applied to 2 resource" is what a missing plural form produces, and it is
    // the sort of thing that ships because nobody shares exactly two things
    // while testing.
    await waitFor(() => expect(screen.getByText("Applied to 2 resources")).toBeInTheDocument());
  });

  it("rejects a subject with an unrecognised prefix instead of sharing with nobody", async () => {
    // "group:engineering" is a plausible typo for "team:engineering", and a
    // share with a subject nobody holds looks exactly like a successful one.
    const shared = vi.fn();
    server.use(
      http.get(SHARES, () => HttpResponse.json(shareInfo())),
      http.post(SHARES, () => {
        shared();
        return HttpResponse.json({ updated: [], skipped: [] });
      })
    );

    renderWithProviders(<ShareDialog {...props} />);
    await waitFor(() => expect(screen.getByTestId("share-subject-input")).toBeInTheDocument());

    await userEvent.type(screen.getByTestId("share-subject-input"), "group:engineering");
    await userEvent.click(screen.getByTestId("share-submit"));

    await waitFor(() => expect(shared).not.toHaveBeenCalled());
  });
});
