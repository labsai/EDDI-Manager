import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import {
  CONNECTIONS_DISABLED,
  CONNECTIONS_FORBIDDEN,
  ConnectionsError,
  authorizeConnection,
  disconnectConnection,
  emptyConnection,
  getEnrichedConnectionDescriptors,
  isConnectionErrorCode,
  listMyConnections,
  parseConnectionResourceUri,
} from "@/lib/api/connections";

describe("parseConnectionResourceUri", () => {
  it("parses an eddi:// resource URI", () => {
    expect(
      parseConnectionResourceUri(
        "eddi://ai.labs.connection/connectionstore/connections/conn1?version=3",
      ),
    ).toEqual({ id: "conn1", version: 3 });
  });

  it("parses a Location header path", () => {
    expect(
      parseConnectionResourceUri("/connectionstore/connections/new-42?version=2"),
    ).toEqual({ id: "new-42", version: 2 });
  });

  it("defaults a missing version to 1", () => {
    expect(
      parseConnectionResourceUri("/connectionstore/connections/conn9"),
    ).toEqual({ id: "conn9", version: 1 });
  });
});

describe("emptyConnection", () => {
  it("derives PER_USER for the user-login flow and SERVICE for the rest", () => {
    expect(emptyConnection("OAUTH2_AUTHORIZATION_CODE").binding).toBe("PER_USER");
    expect(emptyConnection("OAUTH2_CLIENT_CREDENTIALS").binding).toBe("SERVICE");
    expect(emptyConnection("STATIC").binding).toBe("SERVICE");
    expect(emptyConnection("BASIC").binding).toBe("SERVICE");
  });

  it("carries only the auth block its type uses", () => {
    const staticConn = emptyConnection("STATIC");
    expect(staticConn.staticAuth).not.toBeNull();
    expect(staticConn.oauth).toBeNull();

    const oauthConn = emptyConnection("OAUTH2_CLIENT_CREDENTIALS");
    expect(oauthConn.oauth).not.toBeNull();
    expect(oauthConn.staticAuth).toBeNull();
  });

  it("keeps PKCE on for the user-login flow — it is not switchable", () => {
    expect(emptyConnection("OAUTH2_AUTHORIZATION_CODE").oauth?.usePkce).toBe(true);
  });

  it("leaves an authorization URL slot only where the flow has one", () => {
    expect(emptyConnection("OAUTH2_AUTHORIZATION_CODE").oauth?.authorizationUrl).toBe("");
    expect(emptyConnection("OAUTH2_CLIENT_CREDENTIALS").oauth?.authorizationUrl).toBeNull();
  });

  it("never sets a tenant — the backend refuses anything but the default", () => {
    expect(emptyConnection("STATIC").tenantId).toBeUndefined();
  });
});

describe("isConnectionErrorCode", () => {
  it("recognises the closed set the callback can return", () => {
    expect(isConnectionErrorCode("invalid_state")).toBe(true);
    expect(isConnectionErrorCode("authorization_declined")).toBe(true);
    expect(isConnectionErrorCode("missing_code")).toBe(true);
    expect(isConnectionErrorCode("connection_removed")).toBe(true);
    expect(isConnectionErrorCode("exchange_failed")).toBe(true);
  });

  it("rejects anything else, including a null parameter", () => {
    expect(isConnectionErrorCode("server_error")).toBe(false);
    expect(isConnectionErrorCode(null)).toBe(false);
  });
});

describe("getEnrichedConnectionDescriptors", () => {
  it("enriches each descriptor from its config", async () => {
    const rows = await getEnrichedConnectionDescriptors();
    const jira = rows.find((r) => r.connectionName === "jira");
    expect(jira).toBeDefined();
    expect(jira?.authType).toBe("OAUTH2_AUTHORIZATION_CODE");
    expect(jira?.binding).toBe("PER_USER");
    expect(jira?.origins).toEqual(["https://api.atlassian.com"]);
    expect(jira?.unreadable).toBe(false);
  });

  it("keeps a row whose config cannot be read, and marks it", async () => {
    // A connection an admin cannot see is one they cannot delete either, so it
    // degrades to a flagged row instead of vanishing from the list.
    server.use(
      http.get("*/connectionstore/connections/:id", ({ request }) => {
        // `/descriptors` is not an id. `server.use` PREPENDS, so without this
        // the override answers the descriptor listing too and the failure looks
        // like the enrichment breaking rather than the listing never happening.
        if (new URL(request.url).pathname.endsWith("/descriptors")) return;
        return HttpResponse.json({ error: "boom" }, { status: 500 });
      }),
    );
    const rows = await getEnrichedConnectionDescriptors();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.unreadable)).toBe(true);
    expect(rows[0]!.authType).toBe("unknown");
  });

  it("keeps only the latest version of a duplicated id", async () => {
    server.use(
      http.get("*/connectionstore/connections/descriptors", () =>
        HttpResponse.json([
          {
            resource:
              "eddi://ai.labs.connection/connectionstore/connections/conn1?version=1",
            name: "jira",
            description: "old",
            createdOn: 1,
            lastModifiedOn: 1,
          },
          {
            resource:
              "eddi://ai.labs.connection/connectionstore/connections/conn1?version=4",
            name: "jira",
            description: "new",
            createdOn: 1,
            lastModifiedOn: 2,
          },
        ]),
      ),
    );
    const rows = await getEnrichedConnectionDescriptors();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.version).toBe(4);
  });
});

describe("the per-user routes translate their refusals into codes", () => {
  it("turns a 404 on /connections/mine into 'linking is disabled'", async () => {
    // The backend answers a disabled feature with 404 (its 503 body was dropped
    // by the exception mapper), and a bare 404 would render as "not found" on a
    // page that is very much found.
    server.use(
      http.get("*/connections/mine", () => new HttpResponse(null, { status: 404 })),
    );
    await expect(listMyConnections()).rejects.toMatchObject({
      code: CONNECTIONS_DISABLED,
      status: 404,
    });
  });

  it("treats a 503 the same way, for a deployment that answers with one", async () => {
    server.use(
      http.get("*/connections/mine", () => new HttpResponse(null, { status: 503 })),
    );
    await expect(listMyConnections()).rejects.toMatchObject({
      code: CONNECTIONS_DISABLED,
    });
  });

  it("turns a 403 into 'no verified identity'", async () => {
    server.use(
      http.get("*/connections/mine", () => new HttpResponse(null, { status: 403 })),
    );
    await expect(listMyConnections()).rejects.toMatchObject({
      code: CONNECTIONS_FORBIDDEN,
      status: 403,
    });
  });

  it("passes any other failure through with the backend's own message", async () => {
    server.use(
      http.get(
        "*/connections/mine",
        () => new HttpResponse("The grant store is unreachable", { status: 500 }),
      ),
    );
    await expect(listMyConnections()).rejects.toMatchObject({
      code: undefined,
      status: 500,
      message: "The grant store is unreachable",
    });
  });

  it("raises a ConnectionsError, so a caller can branch on the code", async () => {
    server.use(
      http.get("*/connections/mine", () => new HttpResponse(null, { status: 404 })),
    );
    await expect(listMyConnections()).rejects.toBeInstanceOf(ConnectionsError);
  });
});

describe("authorizeConnection", () => {
  it("passes returnTo through and returns the provider URL", async () => {
    let seen: string | null = null;
    server.use(
      http.post("*/connections/:name/authorize", ({ request }) => {
        seen = new URL(request.url).searchParams.get("returnTo");
        return HttpResponse.json({ authorizationUrl: "https://provider.example/auth" });
      }),
    );
    const result = await authorizeConnection("jira", "/manage/linked-accounts");
    expect(seen).toBe("/manage/linked-accounts");
    expect(result.authorizationUrl).toBe("https://provider.example/auth");
  });

  it("encodes a connection name that needs it", async () => {
    let path: string | null = null;
    server.use(
      http.post("*/connections/:name/authorize", ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json({ authorizationUrl: "https://provider.example/auth" });
      }),
    );
    await authorizeConnection("acme prod", "/manage/connections");
    expect(path).toBe("/connections/acme%20prod/authorize");
  });
});

describe("disconnectConnection", () => {
  it("resolves on the backend's 204", async () => {
    await expect(disconnectConnection("jira")).resolves.toBeUndefined();
  });

  it("resolves even when the connection itself is gone", async () => {
    // Unlinking must never be harder than linking was: the case that matters
    // most is the one where an admin has already deleted the connection.
    server.use(
      http.delete(
        "*/connections/:name/grant",
        () => new HttpResponse(null, { status: 204 }),
      ),
    );
    await expect(disconnectConnection("deleted-long-ago")).resolves.toBeUndefined();
  });
});
