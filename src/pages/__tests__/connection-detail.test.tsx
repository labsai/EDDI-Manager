import { describe, it, expect } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { renderPage, userEvent } from "@/test/test-utils";
import { ConnectionDetailPage } from "@/pages/connection-detail";

/**
 * The editor, and the three rules a generated form could not express:
 * `binding` is derived, `name` is immutable, and secrets are references.
 */

function renderDetail(id = "conn1", version = 1) {
  return renderPage(
    `/manage/connections/${id}?version=${version}`,
    <ConnectionDetailPage />,
    "/manage/connections/:id",
  );
}

/** Capture what a save actually puts on the wire. */
function captureSave() {
  const sent: Record<string, unknown>[] = [];
  server.use(
    http.put("*/connectionstore/connections/:id", async ({ request, params }) => {
      sent.push((await request.json()) as Record<string, unknown>);
      return new HttpResponse(null, {
        status: 200,
        headers: { Location: `/connectionstore/connections/${params.id}?version=2` },
      });
    }),
  );
  return sent;
}

describe("ConnectionDetailPage", () => {
  it("loads the connection into an editable draft", async () => {
    renderDetail();

    const name = await screen.findByTestId("connection-name-input");
    expect(name).toHaveValue("jira");
    expect(screen.getByTestId("connection-client-id")).toHaveValue("0Xy1abcDEF");
  });

  it("disables the name, because every grant is filed under it", async () => {
    // A rename orphans every linked account, and the next connection created
    // under the old name inherits them. The backend refuses; so does the form.
    renderDetail();

    expect(await screen.findByTestId("connection-name-input")).toBeDisabled();
  });

  it("shows the binding as derived rather than offering it as a choice", async () => {
    renderDetail();
    await screen.findByTestId("connection-name-input");

    // One select for the auth type, and no select for the binding: the backend
    // couples them both ways, leaving exactly one legal value per type.
    expect(screen.getByTestId("connection-auth-type-select")).toBeInTheDocument();
    expect(screen.queryByTestId("connection-binding-select")).not.toBeInTheDocument();
  });

  it("offers the unverified-principal flag only for a per-user connection", async () => {
    renderDetail("conn1"); // authorization code → PER_USER
    expect(await screen.findByTestId("allow-unverified-principal")).toBeInTheDocument();
  });

  it("hides that flag for a service connection, where the backend refuses it", async () => {
    renderDetail("conn3"); // STATIC → SERVICE
    await screen.findByTestId("connection-name-input");
    expect(screen.queryByTestId("allow-unverified-principal")).not.toBeInTheDocument();
  });

  it("re-derives the binding when the auth type changes", async () => {
    const user = userEvent.setup();
    const sent = captureSave();
    renderDetail("conn3"); // STATIC / SERVICE
    await screen.findByTestId("connection-name-input");

    await user.selectOptions(
      screen.getByTestId("connection-auth-type-select"),
      "OAUTH2_AUTHORIZATION_CODE",
    );
    // Fill what the new type requires, then save.
    await user.type(
      screen.getByTestId("connection-authorization-url"),
      "https://auth.example.com/authorize",
    );
    await user.type(
      screen.getByTestId("connection-token-url"),
      "https://auth.example.com/token",
    );
    await user.type(screen.getByTestId("connection-client-id"), "abc");
    await user.type(
      screen.getByTestId("connection-client-secret-input"),
      // `{{` is userEvent's escape for a literal brace — its keyboard syntax
      // would otherwise read `{vault:secret}` as a modifier.
      "${{vault:secret}",
    );
    await user.click(screen.getByTestId("save-connection-btn"));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.binding).toBe("PER_USER");
  });

  it("sends only the auth block its type uses", async () => {
    // Both blocks live in the draft so a mis-clicked type switch is reversible;
    // only one is stored, or a STATIC connection keeps a client-secret
    // reference for an OAuth flow it no longer has.
    const user = userEvent.setup();
    const sent = captureSave();
    renderDetail("conn3"); // STATIC
    await screen.findByTestId("connection-name-input");

    await user.click(screen.getByTestId("save-connection-btn"));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.oauth).toBeNull();
    expect(sent[0]!.staticAuth).not.toBeNull();
  });

  it("refuses to save a literal in a reference-only field, and says which", async () => {
    const user = userEvent.setup();
    const sent = captureSave();
    renderDetail("conn1");
    await screen.findByTestId("connection-name-input");

    // A valid reference renders as a chip, not an input — clearing it is what
    // puts the field back into a state where a literal could be typed at all.
    await user.click(screen.getByTestId("connection-client-secret-clear"));
    await user.type(screen.getByTestId("connection-client-secret-input"), "sk-live-abc");
    await user.click(screen.getByTestId("save-connection-btn"));

    // Nothing reached the backend, and the field says why.
    expect(sent).toHaveLength(0);
    expect(
      screen.getByTestId("connection-client-secret-literal-warning"),
    ).toBeInTheDocument();
  });

  it("follows the new version after a save, so the next one does not conflict", async () => {
    const user = userEvent.setup();
    captureSave();
    renderDetail("conn3");
    await screen.findByTestId("connection-name-input");

    await user.click(screen.getByTestId("save-connection-btn"));

    await waitFor(() =>
      expect(screen.getByText(/^v2$/)).toBeInTheDocument(),
    );
  });

  it("replaces the page only when the INITIAL load fails", async () => {
    server.use(
      http.get("*/connectionstore/connections/:id", ({ request }) => {
        if (new URL(request.url).pathname.endsWith("/descriptors")) return;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    renderDetail();

    expect(await screen.findByTestId("connection-detail-error")).toBeInTheDocument();
  });
});
