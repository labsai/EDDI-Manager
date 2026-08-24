/**
 * The connection write rules, mirrored from the backend so a failed save
 * becomes an inline hint instead of a 400.
 *
 * Every rule here is enforced server-side too — `ConnectionConfiguration.validate()`
 * in EDDI is the authority, and it also covers import, which this never sees.
 * Mirroring buys the author the message *while they are still looking at the
 * field*, which is the whole point: the backend names the field in its message,
 * but only after a round trip that throws the form's focus away.
 *
 * Deliberately pure — no React, no `t()`. Codes come out; the UI translates
 * them (`<ValidationMessage code={…} />`). The API layer has the same problem
 * and `secrets.ts` solved it the same way.
 *
 * **When the backend rule changes, change it here in the same commit.** A
 * mirror that has drifted is worse than no mirror: it either blocks a document
 * the backend would accept, or promises one it will refuse.
 */

/** Fields a validation result can be keyed by. */
export type ConnectionField =
  | "name"
  | "authType"
  | "baseUrlAllowlist"
  | "staticAuth.headerName"
  | "staticAuth.valueTemplate"
  | "staticAuth.username"
  | "staticAuth.passwordRef"
  | "oauth.authorizationUrl"
  | "oauth.tokenUrl"
  | "oauth.discoveryUrl"
  | "oauth.clientId"
  | "oauth.clientSecret"
  | "oauth.extraAuthParams";

/**
 * A stable code for one broken rule. The UI turns it into a sentence.
 *
 * String union rather than free text so a typo is a compile error and
 * `ValidationMessage` is exhaustive over the set.
 */
export type ValidationCode =
  | "nameRequired"
  | "nameFormat"
  | "allowlistRequired"
  | "originNotBare"
  | "originScheme"
  | "originHost"
  | "headerNameRequired"
  | "templateRequired"
  | "templateNoReference"
  | "templateBadSegment"
  | "usernameRequired"
  | "secretMustBeReference"
  | "clientIdRequired"
  | "endpointRequired"
  | "endpointNotHttps"
  | "endpointUserInfo"
  | "endpointNotAbsolute"
  | "paramCredentialShaped";

export type ConnectionErrors = Partial<Record<ConnectionField, ValidationCode>>;

/**
 * A value that is exactly one reference and nothing else.
 *
 * Anchored, like the backend's `REFERENCE_ONLY.matcher(...).matches()`: a value
 * that merely *contains* a reference is not one, or `sk-live-x${vault:unused}`
 * would pass as a reference while carrying a literal key.
 *
 * `eddivault` and `vars` are accepted because the backend accepts them —
 * narrowing this to `vault` alone would refuse documents EDDI stores happily.
 */
const REFERENCE_ONLY = /^\$\{(vault|eddivault|vars):[^}]{1,256}\}$/;

/** Interpolated segments inside a header value template. */
const INTERPOLATION = /\$\{[^}]{0,256}\}/g;

/**
 * Names that mark a value as credential-shaped, kept out of `extraAuthParams`.
 *
 * Same vocabulary as the backend's `CREDENTIAL_PARAM_NAMES`. An arbitrary
 * string map is the obvious place for an author to paste a key, and a key
 * pasted there sits in plaintext in the connection document.
 */
const CREDENTIAL_PARAM_NAMES = new Set([
  "apikey",
  "api_key",
  "apitoken",
  "api_token",
  "password",
  "passwd",
  "secret",
  "secretkey",
  "secret_key",
  "token",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
  "authorization",
  "auth",
  "credential",
  "credentials",
  "privatekey",
  "private_key",
  "clientsecret",
  "client_secret",
  "assertion",
  "code_verifier",
]);

/** Whether `value` is a `${vault:…}` / `${vars:…}` reference and nothing else. */
export function isSecretReference(value: string | null | undefined): boolean {
  return typeof value === "string" && REFERENCE_ONLY.test(value.trim());
}

/** Whether `name` would be refused as credential-shaped in `extraAuthParams`. */
export function isCredentialParamName(name: string): boolean {
  const normalized = name.toLowerCase().replace(/[-._]/g, "");
  return (
    CREDENTIAL_PARAM_NAMES.has(normalized) ||
    CREDENTIAL_PARAM_NAMES.has(normalized.replace(/_/g, ""))
  );
}

/**
 * A bare origin — `scheme://host[:port]`, no path, query, fragment, userinfo or
 * trailing slash.
 *
 * Parsed rather than pattern-matched, for the reason the backend gives: a
 * string comparison accepts `api.example.com` (no scheme), which then never
 * matches anything at resolve time — an allowlist that looks right and blocks
 * everything.
 */
export function validateOrigin(origin: string): ValidationCode | null {
  const candidate = origin.trim();
  if (!candidate) return "originHost";

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return "originNotBare";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "originScheme";
  if (!url.hostname) return "originHost";
  if (url.username || url.password) return "originNotBare";
  if (url.search || url.hash) return "originNotBare";
  // `new URL("https://x")` normalises the empty path to "/", so both spellings
  // are the bare origin the backend means; anything longer is a path.
  if (url.pathname !== "" && url.pathname !== "/") return "originNotBare";
  return null;
}

/**
 * A credential endpoint — absolute https, no userinfo.
 *
 * Whether the ORIGIN is one the operator trusts is a separate, deployment-level
 * allowlist this cannot see (`eddi.connections.credential-endpoint-allowlist`),
 * so a value that passes here can still come back as a 400. That refusal is
 * surfaced from the save, not predicted here.
 */
export function validateCredentialEndpoint(
  url: string | null | undefined,
  required: boolean,
): ValidationCode | null {
  const candidate = (url ?? "").trim();
  if (!candidate) return required ? "endpointRequired" : null;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return "endpointNotAbsolute";
  }
  if (parsed.protocol !== "https:") return "endpointNotHttps";
  if (parsed.username || parsed.password) return "endpointUserInfo";
  if (!parsed.hostname) return "endpointNotAbsolute";
  return null;
}

/**
 * A header value template — literal text is fine, every `${…}` segment must be
 * a reference, and there has to be at least one.
 *
 * The last clause is the one worth keeping: a template with no interpolation at
 * all is a plaintext credential wearing a template's clothes.
 */
export function validateHeaderTemplate(
  template: string | null | undefined,
): ValidationCode | null {
  const value = (template ?? "").trim();
  if (!value) return "templateRequired";

  let sawReference = false;
  for (const match of value.matchAll(INTERPOLATION)) {
    if (!REFERENCE_ONLY.test(match[0])) return "templateBadSegment";
    sawReference = true;
  }
  return sawReference ? null : "templateNoReference";
}

/**
 * The binding a given auth type is allowed to carry — which is exactly one.
 *
 * The rule runs both ways in the backend: `PER_USER` requires
 * `OAUTH2_AUTHORIZATION_CODE`, and `OAUTH2_AUTHORIZATION_CODE` requires
 * `PER_USER`. Two one-way rules that between them leave a single legal value,
 * so the Manager derives the field instead of offering it — see
 * `connection-detail.tsx`. Exported so the derivation has one home.
 */
export function bindingFor(authType: string): "SERVICE" | "PER_USER" {
  return authType === "OAUTH2_AUTHORIZATION_CODE" ? "PER_USER" : "SERVICE";
}

/** Whether this auth type completes an OAuth flow (mirrors `AuthType.isOAuth`). */
export function isOAuthType(authType: string): boolean {
    return (
    authType === "OAUTH2_AUTHORIZATION_CODE" ||
    authType === "OAUTH2_CLIENT_CREDENTIALS"
  );
}

/** The shape `validateConnection` reads. Structural, so the API type satisfies it. */
export interface ValidatableConnection {
  name?: string;
  authType?: string;
  baseUrlAllowlist?: string[] | null;
  staticAuth?: {
    headerName?: string;
    valueTemplate?: string | null;
    username?: string | null;
    passwordRef?: string | null;
  } | null;
  oauth?: {
    authorizationUrl?: string | null;
    tokenUrl?: string | null;
    discoveryUrl?: string | null;
    clientId?: string | null;
    clientSecret?: string | null;
    extraAuthParams?: Record<string, string> | null;
  } | null;
}

/**
 * Every broken rule, keyed by the field that broke it.
 *
 * Returns all of them rather than the first, so a form can mark up three fields
 * at once — the backend can only ever name one, because it throws on the first.
 */
export function validateConnection(config: ValidatableConnection): ConnectionErrors {
  const errors: ConnectionErrors = {};

  const name = (config.name ?? "").trim();
  if (!name) {
    errors.name = "nameRequired";
  } else if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    // Not a backend rule — a connection is referenced as `${connection:name}`,
    // and a name carrying a brace, a slash or a space produces a reference that
    // silently never resolves. Advisory, and phrased as such in the copy.
    errors.name = "nameFormat";
  }

  const allowlist = (config.baseUrlAllowlist ?? []).filter((o) => o.trim());
  if (allowlist.length === 0) {
    errors.baseUrlAllowlist = "allowlistRequired";
  } else {
    for (const origin of allowlist) {
      const problem = validateOrigin(origin);
      if (problem) {
        errors.baseUrlAllowlist = problem;
        break;
      }
    }
  }

  const authType = config.authType ?? "STATIC";
  if (authType === "STATIC" || authType === "BASIC") {
    const staticAuth = config.staticAuth ?? {};
    if (!(staticAuth.headerName ?? "").trim()) {
      errors["staticAuth.headerName"] = "headerNameRequired";
    }
    if (authType === "BASIC") {
      if (!(staticAuth.username ?? "").trim()) {
        errors["staticAuth.username"] = "usernameRequired";
      }
      if (!isSecretReference(staticAuth.passwordRef)) {
        errors["staticAuth.passwordRef"] = "secretMustBeReference";
      }
    } else {
      const problem = validateHeaderTemplate(staticAuth.valueTemplate);
      if (problem) errors["staticAuth.valueTemplate"] = problem;
    }
  } else {
    const oauth = config.oauth ?? {};
    const tokenUrl = validateCredentialEndpoint(oauth.tokenUrl, true);
    if (tokenUrl) errors["oauth.tokenUrl"] = tokenUrl;

    const discoveryUrl = validateCredentialEndpoint(oauth.discoveryUrl, false);
    if (discoveryUrl) errors["oauth.discoveryUrl"] = discoveryUrl;

    if (!(oauth.clientId ?? "").trim()) errors["oauth.clientId"] = "clientIdRequired";
    if (!isSecretReference(oauth.clientSecret)) {
      errors["oauth.clientSecret"] = "secretMustBeReference";
    }
    if (authType === "OAUTH2_AUTHORIZATION_CODE") {
      const authorizationUrl = validateCredentialEndpoint(oauth.authorizationUrl, true);
      if (authorizationUrl) errors["oauth.authorizationUrl"] = authorizationUrl;
    }
    for (const key of Object.keys(oauth.extraAuthParams ?? {})) {
      if (isCredentialParamName(key)) {
        errors["oauth.extraAuthParams"] = "paramCredentialShaped";
        break;
      }
    }
  }

  return errors;
}
