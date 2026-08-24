import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Globe,
  Info,
  Plug,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { ErrorState } from "@/components/shared/error-state";
import { RefetchErrorNotice } from "@/components/shared/refetch-error-notice";
import { SecretKeyPicker } from "@/components/shared/secret-key-picker";
import { HeaderValueField } from "@/components/connections/header-value-field";
import { OriginAllowlistField } from "@/components/connections/origin-allowlist-field";
import { ValidationMessage } from "@/components/connections/validation-message";
import { AuthTypeBadge } from "@/components/connections/connection-badges";
import {
  useConnection,
  useUpdateConnection,
  useDeleteConnection,
} from "@/hooks/use-connections";
import { getErrorMessage } from "@/lib/api-client";
import {
  AUTH_TYPES,
  CLIENT_AUTH_METHODS,
  emptyConnection,
  parseConnectionResourceUri,
  type AuthType,
  type ConnectionConfiguration,
} from "@/lib/api/connections";
import {
  bindingFor,
  isOAuthType,
  validateConnection,
  type ValidationCode,
} from "@/lib/connection-validation";

/**
 * The connection editor.
 *
 * Hand-written rather than generated from `/jsonSchema`, like every other form
 * in this app — the schema is used to feed Monaco's validation, never to build
 * fields. Three of this document's rules are ones a generated form could not
 * express anyway:
 *
 *  - **`binding` is derived, not chosen.** The backend couples it to `authType`
 *    in both directions, which leaves exactly one legal value per type. Offering
 *    it as a select would offer three broken combinations and one working one.
 *  - **`name` is immutable.** Every grant is filed under `(tenant, name)`, so a
 *    rename orphans them — and the next connection created under the old name
 *    inherits them. The backend refuses; the input is disabled and says why.
 *  - **Secrets are references.** `clientSecret` and `passwordRef` take a
 *    `${vault:…}` pointer, never a value, so they use the picker's
 *    reference-only mode rather than a password box that would accept a paste
 *    and fail on save.
 *
 * There is deliberately **no Connect button here.** Linking navigates the whole
 * page to the provider, which would discard whatever draft is on screen. It
 * belongs on the surfaces that have nothing unsaved — the linked-accounts panel.
 */
export function ConnectionDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const parsedVersion = Number(searchParams.get("version") ?? "1");
  const version = Number.isFinite(parsedVersion) ? parsedVersion : 1;

  const { data: config, isLoading, isError, refetch } = useConnection(id!, version);
  const updateMutation = useUpdateConnection();
  const deleteMutation = useDeleteConnection();

  const [draft, setDraft] = useState<ConnectionConfiguration | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [unverifiedConfirmOpen, setUnverifiedConfirmOpen] = useState(false);
  const [rawOpen, setRawOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);

  useEffect(() => {
    if (config) setDraft({ ...config });
  }, [config]);

  const errors = useMemo(
    () => (draft ? validateConnection(draft) : {}),
    [draft],
  );

  /**
   * Switching auth type keeps both blocks in the draft.
   *
   * Only the relevant one is sent (see `handleSave`), so a mis-click on the
   * type select does not silently destroy an OAuth block the author spent ten
   * minutes on — switching back restores it. What is *stored* stays clean.
   */
  const changeAuthType = useCallback((authType: AuthType) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const blank = emptyConnection(authType);
      return {
        ...prev,
        authType,
        binding: bindingFor(authType),
        // The flag is only legal on a per-user binding, and the backend refuses
        // it elsewhere rather than ignoring it — a relaxation sitting on a
        // document where it does nothing reads as a decision already in force.
        allowUnverifiedPrincipal:
          authType === "OAUTH2_AUTHORIZATION_CODE"
            ? prev.allowUnverifiedPrincipal
            : false,
        staticAuth: prev.staticAuth ?? blank.staticAuth,
        oauth: prev.oauth ?? blank.oauth,
      };
    });
  }, []);

  const handleSave = async () => {
    if (!draft || !id) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0) {
      toast.error(
        t("connections.fixFieldsFirst", "Some fields still need attention."),
      );
      return;
    }
    // Send only the block this type uses. Leaving the other one populated would
    // store a client secret reference on a connection that has no OAuth flow.
    const payload: ConnectionConfiguration = {
      ...draft,
      staticAuth: isOAuthType(draft.authType) ? null : draft.staticAuth,
      oauth: isOAuthType(draft.authType) ? draft.oauth : null,
      binding: bindingFor(draft.authType),
    };
    try {
      const result = await updateMutation.mutateAsync({ id, version, config: payload });
      const location = (result as { location?: string })?.location;
      if (location) {
        // Follow the new version, or the next save conflicts with itself.
        const { version: newVersion } = parseConnectionResourceUri(location);
        setSearchParams({ version: String(newVersion) }, { replace: true });
      }
      toast.success(t("connections.saved", "Connection saved"));
    } catch (err) {
      // A 400 here names the field and the fix — a duplicate name, a token URL
      // the operator has not allowlisted, PER_USER on a deployment without
      // OIDC, an OAuth connection with no vault. None of those are knowable
      // from the browser, so the backend's sentence is the useful one.
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync({ id, version });
      navigate("/manage/connections");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const patchStatic = (
    patch: Partial<NonNullable<ConnectionConfiguration["staticAuth"]>>,
  ) =>
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            staticAuth: {
              headerName: "Authorization",
              ...prev.staticAuth,
              ...patch,
            },
          }
        : prev,
    );

  const patchOAuth = (
    patch: Partial<NonNullable<ConnectionConfiguration["oauth"]>>,
  ) =>
    setDraft((prev) =>
      prev ? { ...prev, oauth: { ...prev.oauth, ...patch } } : prev,
    );

  // Only a failed INITIAL load replaces the page. A background refetch failure
  // must not throw away a form the user is part way through editing.
  if (isError && !draft) {
    return (
      <div data-testid="connection-detail-error">
        <ErrorState
          message={t("common.error", "Something went wrong")}
          onRetry={() => void refetch()}
          retryLabel={t("common.retry", "Retry")}
        />
      </div>
    );
  }

  if (isLoading || !draft) {
    return (
      <div className="space-y-6" data-testid="connection-detail-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const perUser = draft.authType === "OAUTH2_AUTHORIZATION_CODE";
  const fieldError = (field: keyof typeof errors) =>
    showErrors ? errors[field] : undefined;

  return (
    <div className="flex max-w-4xl flex-col gap-6">
      {isError && (
        <div data-testid="connection-detail-refetch-error">
          <RefetchErrorNotice onRetry={() => void refetch()} />
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/manage/connections")}
          aria-label={t("common.back", "Back")}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight">
            {draft.name || t("connections.unnamed", "Unnamed connection")}
          </h1>
          <p className="text-xs text-muted-foreground">v{version}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={() => setDeleteOpen(true)}
          data-testid="delete-connection-btn"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          {t("common.delete", "Delete")}
        </Button>
        <Button
          size="sm"
          onClick={() => void handleSave()}
          disabled={updateMutation.isPending}
          data-testid="save-connection-btn"
        >
          <Save className="h-4 w-4" aria-hidden="true" />
          {updateMutation.isPending
            ? t("common.saving", "Saving…")
            : t("common.save", "Save")}
        </Button>
      </div>

      {/* General */}
      <section className="space-y-4 rounded-xl border border-border/50 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Plug className="h-4 w-4 text-primary" aria-hidden="true" />
          {t("connections.general", "General")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="connection-name">
              {t("connections.name", "Name")}
            </label>
            <Input
              id="connection-name"
              data-testid="connection-name-input"
              value={draft.name}
              disabled
              readOnly
            />
            <p className="text-[11px] text-muted-foreground">
              {t(
                "connections.nameImmutable",
                "Fixed after creation: every linked account is filed under this name, so renaming would strand them. Create a new connection instead.",
              )}
            </p>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium" htmlFor="connection-description">
              {t("connections.description", "Description")}
            </label>
            <Input
              id="connection-description"
              data-testid="connection-description-input"
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
        </div>
      </section>

      {/* Authentication */}
      <section className="space-y-4 rounded-xl border border-border/50 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <AuthTypeBadge authType={draft.authType} />
          {t("connections.authentication", "Authentication")}
        </h2>

        <div className="space-y-1">
          <label className="text-xs font-medium" htmlFor="connection-auth-type">
            {t("connections.authTypeCol", "Authentication")}
          </label>
          <select
            id="connection-auth-type"
            data-testid="connection-auth-type-select"
            className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
            value={draft.authType}
            onChange={(e) => changeAuthType(e.target.value as AuthType)}
          >
            {AUTH_TYPES.map((type) => (
              <option key={type} value={type}>
                {authTypeLabel(t, type)}
              </option>
            ))}
          </select>
        </div>

        {/* Binding is shown, not chosen — see the file comment. */}
        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="space-y-1 text-xs">
            <p className="font-medium text-foreground">
              {perUser
                ? t("connections.bindingPerUserTitle", "Resolves as each end user")
                : t("connections.bindingServiceTitle", "Resolves as one shared account")}
            </p>
            <p className="text-muted-foreground">
              {perUser
                ? t(
                    "connections.bindingPerUserBody",
                    "Everyone links their own account and the agent acts as them. This follows from the authentication type — a user login is the only flow that produces a grant per person.",
                  )
                : t(
                    "connections.bindingServiceBody",
                    "One credential, the same for everybody. This follows from the authentication type — a fixed key is the same key for everyone however it is bound.",
                  )}
            </p>
            {perUser && (
              <p className="text-muted-foreground">
                {t(
                  "connections.bindingPerUserWhere",
                  "People connect their own accounts from",
                )}{" "}
                <Link
                  to="/manage/linked-accounts"
                  className="text-primary hover:underline"
                >
                  {t("pages.linkedAccounts.title", "Linked accounts")}
                </Link>
                .
              </p>
            )}
          </div>
        </div>

        {perUser && (
          <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={draft.allowUnverifiedPrincipal}
                data-testid="allow-unverified-principal"
                onChange={(e) => {
                  if (e.target.checked) {
                    // Turning this ON is the decision worth interrupting: it
                    // lets anything that can assert a user id spend that user's
                    // stored credentials. Turning it off needs no ceremony.
                    setUnverifiedConfirmOpen(true);
                  } else {
                    setDraft({ ...draft, allowUnverifiedPrincipal: false });
                  }
                }}
              />
              <span>
                <span className="block font-medium text-foreground">
                  {t(
                    "connections.allowUnverified",
                    "Trust user identities asserted by a front proxy",
                  )}
                </span>
                <span className="block text-muted-foreground">
                  {t(
                    "connections.allowUnverifiedBody",
                    "Only for a deployment that authenticates its users upstream. With this on, anything that can name a user to your proxy can spend that user's stored credentials — nothing checks the claim afterwards.",
                  )}
                </span>
              </span>
            </label>
          </div>
        )}

        {isOAuthType(draft.authType) ? (
          <div className="space-y-4">
            {perUser && (
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="connection-authorization-url">
                  {t("connections.authorizationUrl", "Authorization URL")}
                </label>
                <Input
                  id="connection-authorization-url"
                  data-testid="connection-authorization-url"
                  className="font-mono text-xs"
                  dir="ltr"
                  value={draft.oauth?.authorizationUrl ?? ""}
                  onChange={(e) => patchOAuth({ authorizationUrl: e.target.value })}
                  placeholder="https://auth.example.com/authorize"
                />
                <ValidationMessage code={fieldError("oauth.authorizationUrl")} />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="connection-token-url">
                {t("connections.tokenUrl", "Token URL")}
              </label>
              <Input
                id="connection-token-url"
                data-testid="connection-token-url"
                className="font-mono text-xs"
                dir="ltr"
                value={draft.oauth?.tokenUrl ?? ""}
                onChange={(e) => patchOAuth({ tokenUrl: e.target.value })}
                placeholder="https://auth.example.com/oauth/token"
              />
              <p className="text-[11px] text-muted-foreground">
                {t(
                  "connections.credentialEndpointHint",
                  "The client secret is sent here, so it must be https and its origin must be one the operator has allowlisted for credential endpoints.",
                )}
              </p>
              <ValidationMessage code={fieldError("oauth.tokenUrl")} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="connection-client-id">
                  {t("connections.clientId", "Client ID")}
                </label>
                <Input
                  id="connection-client-id"
                  data-testid="connection-client-id"
                  className="font-mono text-xs"
                  dir="ltr"
                  value={draft.oauth?.clientId ?? ""}
                  onChange={(e) => patchOAuth({ clientId: e.target.value })}
                />
                <ValidationMessage code={fieldError("oauth.clientId")} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">
                  {t("connections.clientSecret", "Client secret")}
                </label>
                <SecretKeyPicker
                  value={draft.oauth?.clientSecret ?? ""}
                  onChange={(clientSecret) => patchOAuth({ clientSecret })}
                  referenceOnly
                  testId="connection-client-secret"
                />
                <ValidationMessage code={fieldError("oauth.clientSecret")} />
              </div>
            </div>

            <ScopesField
              value={draft.oauth?.scopes ?? []}
              onChange={(scopes) => patchOAuth({ scopes })}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="connection-client-auth-method">
                  {t("connections.clientAuthMethod", "Client authentication")}
                </label>
                <select
                  id="connection-client-auth-method"
                  data-testid="connection-client-auth-method"
                  className="flex h-9 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  value={draft.oauth?.clientAuthMethod ?? "client_secret_basic"}
                  onChange={(e) => patchOAuth({ clientAuthMethod: e.target.value })}
                >
                  {CLIENT_AUTH_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  {t(
                    "connections.clientAuthMethodHint",
                    "How the client secret reaches the token endpoint. Guessing it wrong looks exactly like a wrong secret, so it is a setting rather than a fallback.",
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="connection-discovery-url">
                  {t("connections.discoveryUrl", "Discovery URL (optional)")}
                </label>
                <Input
                  id="connection-discovery-url"
                  data-testid="connection-discovery-url"
                  className="font-mono text-xs"
                  dir="ltr"
                  value={draft.oauth?.discoveryUrl ?? ""}
                  onChange={(e) =>
                    patchOAuth({ discoveryUrl: e.target.value || null })
                  }
                  placeholder="https://auth.example.com/.well-known/openid-configuration"
                />
                <ValidationMessage code={fieldError("oauth.discoveryUrl")} />
              </div>
            </div>

            <ExtraParamsField
              value={draft.oauth?.extraAuthParams ?? {}}
              onChange={(extraAuthParams) => patchOAuth({ extraAuthParams })}
              error={fieldError("oauth.extraAuthParams")}
            />

            {perUser && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t(
                  "connections.pkceAlwaysOn",
                  "PKCE (S256) is always applied to a user login and cannot be switched off — the redirect target is a public path.",
                )}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium" htmlFor="connection-header-name">
                {t("connections.headerName", "Header name")}
              </label>
              <Input
                id="connection-header-name"
                data-testid="connection-header-name"
                className="font-mono text-xs"
                dir="ltr"
                value={draft.staticAuth?.headerName ?? ""}
                onChange={(e) => patchStatic({ headerName: e.target.value })}
                placeholder="Authorization"
              />
              <ValidationMessage code={fieldError("staticAuth.headerName")} />
            </div>

            {draft.authType === "STATIC" ? (
              <div className="space-y-1">
                <label className="text-xs font-medium" htmlFor="connection-header-value">
                  {t("connections.headerValue", "Header value")}
                </label>
                <HeaderValueField
                  id="connection-header-value"
                  value={draft.staticAuth?.valueTemplate ?? ""}
                  onChange={(valueTemplate) => patchStatic({ valueTemplate })}
                  error={fieldError("staticAuth.valueTemplate")}
                />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium" htmlFor="connection-username">
                    {t("connections.username", "Username")}
                  </label>
                  <Input
                    id="connection-username"
                    data-testid="connection-username"
                    value={draft.staticAuth?.username ?? ""}
                    onChange={(e) => patchStatic({ username: e.target.value })}
                  />
                  <ValidationMessage code={fieldError("staticAuth.username")} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">
                    {t("connections.password", "Password")}
                  </label>
                  <SecretKeyPicker
                    value={draft.staticAuth?.passwordRef ?? ""}
                    onChange={(passwordRef) => patchStatic({ passwordRef })}
                    referenceOnly
                    testId="connection-password"
                  />
                  <ValidationMessage code={fieldError("staticAuth.passwordRef")} />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Allowed origins */}
      <section className="space-y-3 rounded-xl border border-border/50 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Globe className="h-4 w-4 text-primary" aria-hidden="true" />
          {t("connections.allowedOrigins", "Where the credential may be sent")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t(
            "connections.allowedOriginsHint",
            "List every origin this credential is allowed to reach. Anything not listed is refused, so a later config edit cannot redirect it somewhere else.",
          )}
        </p>
        <OriginAllowlistField
          value={draft.baseUrlAllowlist}
          onChange={(baseUrlAllowlist) => setDraft({ ...draft, baseUrlAllowlist })}
          error={fieldError("baseUrlAllowlist")}
          testId="connection-origins"
        />
      </section>

      {/* Advanced */}
      <section className="space-y-3 rounded-xl border border-border/50 p-5">
        <h2 className="text-sm font-semibold">
          {t("connections.advanced", "Advanced")}
        </h2>
        <div className="space-y-1 sm:max-w-xs">
          <label className="text-xs font-medium" htmlFor="connection-timeout">
            {t("connections.timeoutMs", "Token endpoint timeout (ms)")}
          </label>
          <Input
            id="connection-timeout"
            data-testid="connection-timeout"
            type="number"
            min={0}
            value={draft.timeoutMs ?? ""}
            onChange={(e) =>
              setDraft({
                ...draft,
                // Empty means "use the resolver's default", which is null and
                // not 0 — a zero-millisecond timeout would fail every call.
                timeoutMs: e.target.value === "" ? null : Number(e.target.value),
              })
            }
            placeholder={t("connections.timeoutDefault", "Default")}
          />
        </div>
      </section>

      {/* Raw */}
      <section className="overflow-hidden rounded-xl border border-border/50">
        <button
          type="button"
          className="flex w-full items-center justify-between px-5 py-3 text-sm font-medium transition-colors hover:bg-muted/30"
          onClick={() => setRawOpen(!rawOpen)}
          aria-expanded={rawOpen}
        >
          {t("connections.rawConfig", "Raw configuration")}
          {rawOpen ? (
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        {rawOpen && (
          <div className="border-t border-border/30 p-4">
            <pre
              className="max-h-96 overflow-auto rounded-lg bg-muted/30 p-4 font-mono text-xs"
              dir="ltr"
            >
              {JSON.stringify(draft, null, 2)}
            </pre>
          </div>
        )}
      </section>

      <AlertDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("connections.confirmDelete", "Delete this connection?")}
        description={t(
          "connections.confirmDeleteDesc",
          "Every account linked through it is unlinked at the same time — tokens must not outlive the connection that produced them. Agents referring to it by name will stop being able to authenticate.",
        )}
        onConfirm={() => void handleDelete()}
        confirmLabel={t("common.delete", "Delete")}
        cancelLabel={t("common.cancel", "Cancel")}
        isPending={deleteMutation.isPending}
      />

      <AlertDialog
        open={unverifiedConfirmOpen}
        onOpenChange={setUnverifiedConfirmOpen}
        variant="warning"
        title={t(
          "connections.confirmUnverified",
          "Accept identities this deployment did not verify?",
        )}
        description={t(
          "connections.confirmUnverifiedDesc",
          "Anyone who can assert a user id to your front proxy will be able to spend that user's stored credentials for this connection. Nothing checks the claim afterwards — the id is the whole authority for choosing whose token to use. Only turn this on if your proxy genuinely authenticates every request it forwards.",
        )}
        onConfirm={() => {
          setDraft((prev) =>
            prev ? { ...prev, allowUnverifiedPrincipal: true } : prev,
          );
          setUnverifiedConfirmOpen(false);
        }}
        confirmLabel={t("connections.confirmUnverifiedAccept", "I understand, turn it on")}
        cancelLabel={t("common.cancel", "Cancel")}
      />
    </div>
  );
}

/**
 * The auth type in words, matching the badge exactly.
 *
 * The same keys and the same English as `connection-badges.tsx`, deliberately:
 * `check-i18n.mjs` fails a key called with two different defaults, and one term
 * used two ways would be worse for the reader than for the checker anyway.
 */
function authTypeLabel(
  t: ReturnType<typeof useTranslation>["t"],
  authType: AuthType,
): string {
  switch (authType) {
    case "STATIC":
      return t("connections.authType.static", "API key");
    case "BASIC":
      return t("connections.authType.basic", "Username & password");
    case "OAUTH2_CLIENT_CREDENTIALS":
      return t("connections.authType.clientCredentials", "OAuth service account");
    case "OAUTH2_AUTHORIZATION_CODE":
      return t("connections.authType.authorizationCode", "OAuth user login");
  }
}

/* ─── Scopes ───────────────────────────────────────────────────── */

function ScopesField({
  value,
  onChange,
}: {
  value: string[];
  onChange: (scopes: string[]) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  const add = () => {
    // Providers document scopes space-delimited, and that is how people paste
    // them. Splitting here saves a row-at-a-time transcription that is easy to
    // get subtly wrong.
    const parts = draft
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    onChange([...value, ...parts.filter((p) => !value.includes(p))]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium" htmlFor="connection-scopes">
        {t("connections.scopes", "Scopes")}
      </label>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((scope) => (
            <Badge key={scope} variant="secondary" className="gap-1 font-mono text-[11px]">
              <span dir="ltr">{scope}</span>
              <button
                type="button"
                onClick={() => onChange(value.filter((s) => s !== scope))}
                className="rounded hover:text-destructive"
                aria-label={t("connections.removeScope", {
                  scope,
                  defaultValue: "Remove {{scope}}",
                })}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <Input
          id="connection-scopes"
          data-testid="connection-scopes-input"
          className="h-8 font-mono text-xs"
          dir="ltr"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="read:jira-work offline_access"
        />
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t("common.add", "Add")}
        </Button>
      </div>
    </div>
  );
}

/* ─── Extra authorization parameters ───────────────────────────── */

function ExtraParamsField({
  value,
  onChange,
  error,
}: {
  value: Record<string, string>;
  onChange: (params: Record<string, string>) => void;
  error?: ValidationCode;
}) {
  const { t } = useTranslation();
  const entries = Object.entries(value);

  const replace = (index: number, entry: [string, string]) =>
    onChange(
      Object.fromEntries(entries.map((current, i) => (i === index ? entry : current))),
    );

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium">
        {t("connections.extraAuthParams", "Extra authorization parameters")}
      </label>
      <p className="text-[11px] text-muted-foreground">
        {t(
          "connections.extraAuthParamsHint",
          "Non-secret protocol parameters the provider expects — prompt, audience, access_type. Never a key or a token: this map is stored in the connection document in plain text.",
        )}
      </p>
      {entries.map(([key, val], index) => (
        <div key={index} className="flex gap-2">
          <Input
            className="h-8 font-mono text-xs"
            dir="ltr"
            value={key}
            onChange={(e) => replace(index, [e.target.value, val])}
            placeholder="prompt"
            aria-label={t("connections.paramName", "Parameter name")}
          />
          <Input
            className="h-8 font-mono text-xs"
            dir="ltr"
            value={val}
            onChange={(e) => replace(index, [key, e.target.value])}
            placeholder="consent"
            aria-label={t("connections.paramValue", "Parameter value")}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() =>
              onChange(Object.fromEntries(entries.filter((_, i) => i !== index)))
            }
            aria-label={t("connections.removeParam", "Remove parameter")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => onChange({ ...value, "": "" })}
        data-testid="connection-add-param"
        disabled={Object.prototype.hasOwnProperty.call(value, "")}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {t("connections.addParam", "Add parameter")}
      </Button>
      <ValidationMessage code={error} />
    </div>
  );
}
