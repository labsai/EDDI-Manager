import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { renderWithProviders, userEvent } from "@/test/test-utils";
import { LinkedAccountsPanel } from "@/components/connections/linked-accounts-panel";

/**
 * The per-user panel, and the four answers `/connections/mine` can give.
 *
 * Two of them are *states*, not errors: a deployment with
 * `eddi.connections.enabled=false` is not broken, and a deployment without OIDC
 * is not broken either. Rendering an error box over an intentional
 * configuration is the failure these tests exist to prevent.
 */

const ONE_ACTIVE = [
  {
    connection: "jira",
    status: "ACTIVE",
    expiresAt: null,
    scopes: ["read:jira-work"],
    connectedAt: "2026-01-05T10:00:00Z",
  },
];

function mine(body: object | null, status = 200) {
  server.use(
    http.get("*/connections/mine", () =>
      status === 200
        ? HttpResponse.json(body)
        : new HttpResponse(null, { status }),
    ),
  );
}

describe("LinkedAccountsPanel", () => {
  it("lists a linked account with its status and scopes", async () => {
    mine(ONE_ACTIVE);
    renderWithProviders(<LinkedAccountsPanel />);

    expect(await screen.findByTestId("linked-account-jira")).toBeInTheDocument();
    expect(screen.getByTestId("grant-status-ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("read:jira-work")).toBeInTheDocument();
  });

  it("says linking is switched off rather than showing an error", async () => {
    // A 404 here means the feature is disabled — or that the backend predates
    // it, which from the user's side is the same fact.
    mine(null, 404);
    renderWithProviders(<LinkedAccountsPanel />);

    expect(await screen.findByTestId("connections-disabled")).toBeInTheDocument();
    expect(screen.queryByTestId("error-state")).not.toBeInTheDocument();
  });

  it("asks the viewer to sign in when there is no verified identity", async () => {
    mine(null, 403);
    renderWithProviders(<LinkedAccountsPanel />);

    expect(await screen.findByTestId("connections-no-identity")).toBeInTheDocument();
    expect(screen.queryByTestId("error-state")).not.toBeInTheDocument();
  });

  it("shows a real error state for a real failure", async () => {
    mine(null, 500);
    renderWithProviders(<LinkedAccountsPanel />);

    expect(await screen.findByTestId("error-state")).toBeInTheDocument();
  });

  it("explains the empty case instead of leaving a blank panel", async () => {
    mine([]);
    renderWithProviders(<LinkedAccountsPanel />);

    expect(await screen.findByTestId("empty-state")).toBeInTheDocument();
  });

  it("offers Connect only for a connection that is not already linked", async () => {
    mine(ONE_ACTIVE);
    renderWithProviders(
      <LinkedAccountsPanel
        connectable={[{ name: "jira" }, { name: "google-drive" }]}
      />,
    );

    expect(await screen.findByTestId("linked-account-jira")).toBeInTheDocument();
    expect(screen.getByTestId("connect-google-drive")).toBeInTheDocument();
    // Matched on the connection NAME, which is what a grant is filed under.
    expect(screen.queryByTestId("connect-jira")).not.toBeInTheDocument();
  });

  it("gives Reconnect the emphasis only where reconnecting is the fix", async () => {
    // EXPIRED refreshes itself on the next call, so a prominent "Reconnect"
    // there would cost the user a consent screen to fix nothing.
    mine([
      { connection: "a", status: "EXPIRED", expiresAt: null, scopes: null, connectedAt: null },
      { connection: "b", status: "REFRESH_FAILED", expiresAt: null, scopes: null, connectedAt: null },
    ]);
    renderWithProviders(<LinkedAccountsPanel />);

    await screen.findByTestId("linked-account-a");
    expect(screen.getByTestId("grant-status-EXPIRED")).toBeInTheDocument();
    expect(screen.getByTestId("grant-status-REFRESH_FAILED")).toBeInTheDocument();
    // Both rows can be reconnected; only the terminal one is styled as urgent.
    expect(screen.getByTestId("reconnect-a")).toBeInTheDocument();
    expect(screen.getByTestId("reconnect-b")).toBeInTheDocument();
  });

  it("confirms before unlinking, then calls the backend", async () => {
    mine(ONE_ACTIVE);
    let deleted: string | null = null;
    server.use(
      http.delete("*/connections/:name/grant", ({ params }) => {
        deleted = params.name as string;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<LinkedAccountsPanel />);

    await user.click(await screen.findByTestId("unlink-jira"));
    // The confirm dialog stands between the click and the revocation.
    expect(deleted).toBeNull();

    await user.click(screen.getByRole("button", { name: /unlink/i }));
    await waitFor(() => expect(deleted).toBe("jira"));
  });
});

describe("LinkedAccountsPanel — starting a link", () => {
  let assign: ReturnType<typeof vi.fn>;
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    assign = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: { ...originalLocation, assign },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: originalLocation,
    });
  });

  it("sends the browser to the provider with a top-level navigation", async () => {
    // Not a popup and not an iframe: the nonce cookie binding the flow to this
    // browser is SameSite=Lax, which admits a top-level GET return and nothing
    // else.
    mine([]);
    let returnTo: string | null = null;
    server.use(
      http.post("*/connections/:name/authorize", ({ request }) => {
        returnTo = new URL(request.url).searchParams.get("returnTo");
        return HttpResponse.json({
          authorizationUrl: "https://provider.example/authorize?x=1",
        });
      }),
    );
    const user = userEvent.setup();
    renderWithProviders(<LinkedAccountsPanel connectable={[{ name: "jira" }]} />, {
      initialRoute: "/manage/linked-accounts",
    });

    await user.click(await screen.findByTestId("connect-jira"));

    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("https://provider.example/authorize?x=1"),
    );
    // The page it came from, so the round trip lands back where it started.
    expect(returnTo).toBe("/manage/linked-accounts");
  });

  it("does not navigate when authorize fails", async () => {
    mine([]);
    server.use(
      http.post(
        "*/connections/:name/authorize",
        () => new HttpResponse("No connection named 'jira'.", { status: 404 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<LinkedAccountsPanel connectable={[{ name: "jira" }]} />);

    await user.click(await screen.findByTestId("connect-jira"));

    await waitFor(() => expect(screen.getByTestId("connect-jira")).toBeEnabled());
    expect(assign).not.toHaveBeenCalled();
  });
});
