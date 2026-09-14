import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { toast } from "sonner";
import { server } from "@/test/mocks/server";
import { renderWithProviders, userEvent } from "@/test/test-utils";
import { ConnectionSettingsPanel } from "@/components/connections/connection-settings-panel";
import { draftFromView, requestFromDraft } from "@/lib/connection-settings";
import type {
  ConnectionSettings,
  ConnectionSettingsView,
} from "@/lib/api/connections";

const toastSpy = {
  success: vi.spyOn(toast, "success"),
  error: vi.spyOn(toast, "error"),
};

beforeEach(() => {
  toastSpy.success.mockClear();
  toastSpy.error.mockClear();
});

function view(overrides: Partial<ConnectionSettingsView> = {}): ConnectionSettingsView {
  return {
    enabled: { value: true, source: "STORED", property: "eddi.connections.enabled" },
    publicBaseUrl: {
      value: "https://eddi.example.com",
      source: "STORED",
      property: "eddi.connections.public-base-url",
    },
    credentialEndpointAllowlist: {
      value: ["https://auth.atlassian.com"],
      source: "STORED",
      property: "eddi.connections.credential-endpoint-allowlist",
    },
    allowPlaintextRemoteOrigins: {
      value: false,
      source: "DEFAULT",
      property: "eddi.connections.allow-plaintext-remote-origins",
    },
    redirectUri: "https://eddi.example.com/connections/callback",
    updatedAt: "2026-09-14T10:00:00Z",
    updatedBy: "admin",
    warnings: [],
    ...overrides,
  };
}

/**
 * A fresh deployment, byte-for-byte as EDDI answers it (captured from a live
 * boot): Jackson NON_NULL omits every null, so the unset base URL has no
 * `value` key, and `redirectUri`, `updatedAt` and `updatedBy` are absent.
 */
const FRESH_DEPLOYMENT_AS_EDDI_SENDS_IT = {
  enabled: { value: false, source: "DEFAULT", property: "eddi.connections.enabled" },
  publicBaseUrl: { source: "DEFAULT", property: "eddi.connections.public-base-url" },
  credentialEndpointAllowlist: {
    value: [],
    source: "DEFAULT",
    property: "eddi.connections.credential-endpoint-allowlist",
  },
  allowPlaintextRemoteOrigins: {
    value: false,
    source: "DEFAULT",
    property: "eddi.connections.allow-plaintext-remote-origins",
  },
  warnings: [],
};

function serve(body: object) {
  server.use(http.get("*/connectionstore/settings", () => HttpResponse.json(body)));
}

/** Captures the PUT body and answers with `answer`. */
function capturePut(answer: object = view()) {
  const sent: ConnectionSettings[] = [];
  server.use(
    http.put("*/connectionstore/settings", async ({ request }) => {
      sent.push((await request.json()) as ConnectionSettings);
      return HttpResponse.json(answer);
    }),
  );
  return sent;
}

/**
 * The settings that used to need a restart. What these tests protect: a pinned
 * value is never sent back as a change, a default is not silently turned into
 * a stored copy of itself, and the backend's reason for refusing a save reaches
 * the administrator.
 */
describe("ConnectionSettingsPanel", () => {
  it("shows the effective values and the redirect URI to register", async () => {
    serve(view());
    renderWithProviders(<ConnectionSettingsPanel />);

    expect(await screen.findByTestId("connection-settings")).toBeInTheDocument();
    expect(screen.getByTestId("settings-enabled")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("settings-public-base-url")).toHaveValue("https://eddi.example.com");
    expect(screen.getByTestId("settings-redirect-uri")).toHaveTextContent(
      "https://eddi.example.com/connections/callback",
    );
    expect(screen.getByText("https://auth.atlassian.com")).toBeInTheDocument();
  });

  it("renders a fresh deployment exactly as EDDI serializes it, and saves only what changed", async () => {
    serve(FRESH_DEPLOYMENT_AS_EDDI_SENDS_IT);
    const sent = capturePut();
    const user = userEvent.setup();
    renderWithProviders(<ConnectionSettingsPanel />);

    expect(await screen.findByTestId("settings-public-base-url")).toHaveValue("");
    expect(screen.queryByTestId("settings-redirect-uri")).not.toBeInTheDocument();
    expect(screen.getByTestId("settings-last-updated")).toBeEmptyDOMElement();

    await user.click(screen.getByTestId("settings-enabled"));
    await user.click(screen.getByTestId("settings-save"));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      enabled: true,
      publicBaseUrl: null,
      credentialEndpointAllowlist: null,
      allowPlaintextRemoteOrigins: null,
    });
  });

  it("renders a pinned setting read-only and names the property that pins it", async () => {
    serve(
      view({
        publicBaseUrl: {
          value: "https://pinned.example.com",
          source: "PINNED",
          property: "eddi.connections.public-base-url",
        },
        enabled: { value: true, source: "PINNED", property: "eddi.connections.enabled" },
      }),
    );
    renderWithProviders(<ConnectionSettingsPanel />);

    expect(await screen.findByTestId("settings-public-base-url")).toHaveAttribute("readonly");
    expect(screen.getByTestId("settings-enabled")).toBeDisabled();
    expect(screen.getByTestId("pinned-eddi.connections.public-base-url")).toHaveTextContent(
      "eddi.connections.public-base-url",
    );
  });

  it("says when a pin hides a different stored value, which would return if the pin went", async () => {
    serve(
      view({
        allowPlaintextRemoteOrigins: {
          value: false,
          source: "PINNED",
          property: "eddi.connections.allow-plaintext-remote-origins",
          shadowedStoredValue: true,
        },
      }),
    );
    renderWithProviders(<ConnectionSettingsPanel />);

    expect(
      await screen.findByTestId("shadowed-eddi.connections.allow-plaintext-remote-origins"),
    ).toBeInTheDocument();
  });

  it("keeps Save disabled until something actually changes", async () => {
    serve(view());
    const user = userEvent.setup();
    renderWithProviders(<ConnectionSettingsPanel />);

    const save = await screen.findByTestId("settings-save");
    expect(save).toBeDisabled();

    await user.click(screen.getByTestId("settings-allow-plaintext"));
    expect(save).toBeEnabled();

    await user.click(screen.getByTestId("settings-discard"));
    expect(save).toBeDisabled();
  });

  it("saves the change, leaves pinned and untouched defaults unset, and confirms", async () => {
    serve(
      view({
        enabled: { value: true, source: "PINNED", property: "eddi.connections.enabled" },
      }),
    );
    const sent = capturePut();
    const user = userEvent.setup();
    renderWithProviders(<ConnectionSettingsPanel />);

    const input = await screen.findByTestId("settings-public-base-url");
    await user.clear(input);
    await user.type(input, "https://new.example.com");
    await user.click(screen.getByTestId("settings-save"));

    await waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]).toEqual({
      enabled: null,
      publicBaseUrl: "https://new.example.com",
      credentialEndpointAllowlist: ["https://auth.atlassian.com"],
      allowPlaintextRemoteOrigins: null,
    });
    await waitFor(() => expect(toastSpy.success).toHaveBeenCalled());
  });

  it("checks origin text left in the allowlist box before saving, instead of sending it", async () => {
    serve(view());
    const sent = capturePut();
    const user = userEvent.setup();
    renderWithProviders(<ConnectionSettingsPanel />);

    await user.type(await screen.findByTestId("settings-allowlist-input"), "auth.example.com/token");
    await user.click(screen.getByTestId("settings-save"));

    expect(await screen.findByTestId("settings-allowlist-error")).not.toBeEmptyDOMElement();
    expect(sent).toHaveLength(0);
  });

  it("surfaces the backend's reason when a save is refused, and keeps the edit", async () => {
    serve(view());
    // Shaped as EDDI sends it: ClientErrorExceptionMapper writes a 4xx message as
    // a text/plain body, not JSON. A JSON fixture here would prove only that the
    // client agrees with a fixture this repo wrote.
    const reason =
      "allowPlaintextRemoteOrigins is pinned by the eddi.connections.allow-plaintext-remote-origins property, so it cannot be changed here.";
    server.use(
      http.put(
        "*/connectionstore/settings",
        () =>
          new HttpResponse(reason, {
            status: 409,
            headers: { "Content-Type": "text/plain" },
          }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ConnectionSettingsPanel />);

    await user.click(await screen.findByTestId("settings-allow-plaintext"));
    await user.click(screen.getByTestId("settings-save"));

    await waitFor(() => expect(toastSpy.error).toHaveBeenCalled());
    const shown = String(toastSpy.error.mock.calls[0]?.[0]);
    expect(shown).toContain("eddi.connections.allow-plaintext-remote-origins");
    expect(shown).toContain("409");
    // The server's view did not change, so the edit survives the refusal and can
    // be corrected rather than retyped.
    expect(screen.getByTestId("settings-allow-plaintext")).toHaveAttribute("aria-checked", "true");
  });

  it("refetches after a 409, so a property pinned since the page loaded shows up as pinned", async () => {
    let reads = 0;
    server.use(
      http.get("*/connectionstore/settings", () => {
        reads += 1;
        return HttpResponse.json(
          reads === 1
            ? view()
            : view({
                allowPlaintextRemoteOrigins: {
                  value: false,
                  source: "PINNED",
                  property: "eddi.connections.allow-plaintext-remote-origins",
                },
              }),
        );
      }),
      http.put(
        "*/connectionstore/settings",
        () =>
          new HttpResponse("allowPlaintextRemoteOrigins is pinned", {
            status: 409,
            headers: { "Content-Type": "text/plain" },
          }),
      ),
    );
    const user = userEvent.setup();
    renderWithProviders(<ConnectionSettingsPanel />);

    await user.click(await screen.findByTestId("settings-allow-plaintext"));
    await user.click(screen.getByTestId("settings-save"));

    expect(
      await screen.findByTestId("pinned-eddi.connections.allow-plaintext-remote-origins"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("settings-allow-plaintext")).toBeDisabled();
  });

  it("lists the warnings for a configuration that saves but will not fully work", async () => {
    serve(
      view({
        warnings: ["credentialEndpointAllowlist is empty, so no OAuth connection can resolve."],
      }),
    );
    renderWithProviders(<ConnectionSettingsPanel />);

    expect(await screen.findByTestId("connection-settings-warnings")).toHaveTextContent(
      "credentialEndpointAllowlist is empty",
    );
  });

  it.each([403, 404])("renders nothing when the backend answers %i", async (status) => {
    server.use(
      http.get("*/connectionstore/settings", () => new HttpResponse(null, { status })),
    );
    const { container } = renderWithProviders(<ConnectionSettingsPanel />);

    await waitFor(() =>
      expect(screen.queryByTestId("connection-settings-loading")).not.toBeInTheDocument(),
    );
    expect(screen.queryByTestId("connection-settings")).not.toBeInTheDocument();
    expect(screen.queryByTestId("connection-settings-error")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});

describe("requestFromDraft", () => {
  it("sends null for a pinned field even when the draft carries its value", () => {
    const current = view({
      publicBaseUrl: {
        value: "https://pinned.example.com",
        source: "PINNED",
        property: "eddi.connections.public-base-url",
      },
    });

    expect(requestFromDraft(draftFromView(current), current).publicBaseUrl).toBeNull();
  });

  it("sends null for an untouched default, and the value once it is changed", () => {
    const current = view();
    const draft = draftFromView(current);

    expect(requestFromDraft(draft, current).allowPlaintextRemoteOrigins).toBeNull();
    expect(
      requestFromDraft({ ...draft, allowPlaintextRemoteOrigins: true }, current)
        .allowPlaintextRemoteOrigins,
    ).toBe(true);
  });

  it("treats a default whose value is absent as unset, not as a change", () => {
    const current = FRESH_DEPLOYMENT_AS_EDDI_SENDS_IT as unknown as ConnectionSettingsView;

    expect(requestFromDraft(draftFromView(current), current)).toEqual({
      enabled: null,
      publicBaseUrl: null,
      credentialEndpointAllowlist: null,
      allowPlaintextRemoteOrigins: null,
    });
  });

  it("unsets an emptied base URL rather than storing an empty string", () => {
    const current = view();

    expect(
      requestFromDraft({ ...draftFromView(current), publicBaseUrl: "   " }, current).publicBaseUrl,
    ).toBeNull();
  });
});
