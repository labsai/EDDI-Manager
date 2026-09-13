import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { renderWithProviders, userEvent } from "@/test/test-utils";
import { SecretKeyPicker } from "../secret-key-picker";

/**
 * `${connection:name}` in the picker.
 *
 * Before this, the scheme was unknown to the reference grammar, so the picker
 * treated a connection reference as a raw secret: masked it behind dots and
 * offered to store it in the vault — which would have vaulted the literal
 * string `${connection:jira}` under a key name of the user's choosing. Kept in
 * its own file so the vault mode's suite stays a statement about vault mode.
 */

describe("SecretKeyPicker with a connection reference", () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockReset();
    server.use(
      http.get("*/secretstore/secrets/health", () =>
        HttpResponse.json({ status: "UP", provider: "local", available: true }),
      ),
      http.get("*/secretstore/secrets/default", () => HttpResponse.json([])),
    );
  });

  it("renders it as a Connection chip — unmasked, and not as a vault key", () => {
    renderWithProviders(<SecretKeyPicker value="${connection:jira}" onChange={onChange} />);

    const chip = screen.getByTestId("secret-key-picker-connection-chip");
    expect(chip).toHaveTextContent("Connection");
    expect(chip).toHaveTextContent("jira");
    // No password box, and no "not found in the vault" — there is no key to look up.
    expect(screen.queryByTestId("secret-key-picker-input")).not.toBeInTheDocument();
    expect(
      screen.queryByTitle("This key was not found in the vault"),
    ).not.toBeInTheDocument();
  });

  it("clears the reference like any other chip", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SecretKeyPicker value="${connection:jira}" onChange={onChange} />);

    await user.click(screen.getByTestId("secret-key-picker-clear"));

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("does not offer the connection list unless the field asks for it", () => {
    // Only three places resolve a connection reference; everywhere else the
    // offer would be an offer to fail at build time.
    renderWithProviders(<SecretKeyPicker value="" onChange={onChange} />);
    expect(screen.queryByTestId("secret-key-picker-connection-btn")).not.toBeInTheDocument();
  });

  it("lists the deployment's connections and inserts the chosen reference", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SecretKeyPicker value="" onChange={onChange} connections />);

    await user.click(screen.getByTestId("secret-key-picker-connection-btn"));
    await user.click(
      await screen.findByTestId("secret-key-picker-connection-btn-option-amplitude"),
    );

    expect(onChange).toHaveBeenCalledWith("${connection:amplitude}");
  });

  it("explains a 403 as a role limit, not a failure, and leaves typing open", async () => {
    // An `eddi-editor` may list connections; a plain viewer may not. The
    // reference can still be typed by hand, and the hint says so.
    server.use(
      http.get(
        "*/connectionstore/connections/descriptors",
        () => new HttpResponse(null, { status: 403 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SecretKeyPicker value="" onChange={onChange} connections />);

    await user.click(screen.getByTestId("secret-key-picker-connection-btn"));

    expect(
      await screen.findByTestId("secret-key-picker-connection-btn-forbidden"),
    ).toHaveTextContent("${connection:name}");
    expect(screen.queryByTestId("error-state")).not.toBeInTheDocument();
  });

  it("explains a 404 as a backend without the feature", async () => {
    server.use(
      http.get(
        "*/connectionstore/connections/descriptors",
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<SecretKeyPicker value="" onChange={onChange} connections />);

    await user.click(screen.getByTestId("secret-key-picker-connection-btn"));

    expect(
      await screen.findByTestId("secret-key-picker-connection-btn-unavailable"),
    ).toBeInTheDocument();
  });

  it("does not fetch the list until the popup opens", async () => {
    let listed = 0;
    server.use(
      http.get("*/connectionstore/connections/descriptors", () => {
        listed += 1;
        return HttpResponse.json([]);
      }),
    );
    renderWithProviders(<SecretKeyPicker value="" onChange={onChange} connections />);

    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(listed).toBe(0);
  });

  it("refuses a connection reference in a reference-only field", async () => {
    // clientSecret and passwordRef take `${vault:…}` and nothing else; the
    // backend refuses a connection there and so must the field.
    renderWithProviders(
      <SecretKeyPicker value="${connection:jira}" onChange={onChange} referenceOnly connections />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("secret-key-picker-literal-warning")).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("secret-key-picker-connection-chip")).not.toBeInTheDocument();
    expect(screen.queryByTestId("secret-key-picker-connection-btn")).not.toBeInTheDocument();
  });
});
