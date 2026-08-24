import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Lock,
  Server,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SecretKeyPicker } from "@/components/shared/secret-key-picker";
import { HeaderValueField } from "@/components/connections/header-value-field";
import { OriginAllowlistField } from "@/components/connections/origin-allowlist-field";
import { ValidationMessage } from "@/components/connections/validation-message";
import { useCreateConnection } from "@/hooks/use-connections";
import { getErrorMessage } from "@/lib/api-client";
import {
  emptyConnection,
  parseConnectionResourceUri,
  type AuthType,
  type ConnectionConfiguration,
} from "@/lib/api/connections";
import { validateConnection } from "@/lib/connection-validation";

interface CreateConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (id: string, version: number) => void;
}

type Step = "basics" | "credentials" | "origins";
const STEPS: Step[] = ["basics", "credentials", "origins"];

/**
 * Create a connection in three steps, then hand over to the editor.
 *
 * The steps are not decoration. `baseUrlAllowlist` is required by the backend,
 * and the auth block required for the chosen type is too, so a "quick create"
 * that asked only for a name would produce a 400 every time. Everything
 * optional — scopes, extra parameters, timeouts, the discovery URL — is left to
 * the editor, which is where a config is refined anyway.
 *
 * The auth type is offered as four described choices rather than an enum
 * select, because it is the one decision on this screen with consequences the
 * author cannot undo later: it fixes whether the connection resolves one shared
 * credential or one per person.
 */
export function CreateConnectionDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateConnectionDialogProps) {
  const { t } = useTranslation();
  const createMutation = useCreateConnection();

  const [step, setStep] = useState<Step>("basics");
  const [draft, setDraft] = useState<ConnectionConfiguration>(() =>
    emptyConnection("STATIC"),
  );
  /** Errors are shown once a step has been left, not while it is being typed into. */
  const [touched, setTouched] = useState(false);

  const errors = useMemo(() => validateConnection(draft), [draft]);

  const reset = useCallback(() => {
    setStep("basics");
    setDraft(emptyConnection("STATIC"));
    setTouched(false);
  }, []);

  const close = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [reset, onOpenChange]);

  /**
   * Switching type replaces the auth block wholesale rather than merging.
   *
   * Carrying a half-filled OAuth block onto a STATIC connection would send the
   * backend fields it validates against the wrong rules, and — more to the
   * point — it silently keeps a client secret reference on a connection that no
   * longer has an OAuth flow.
   */
  const changeAuthType = (authType: AuthType) => {
    setDraft((prev) => ({
      ...emptyConnection(authType),
      name: prev.name,
      description: prev.description,
      baseUrlAllowlist: prev.baseUrlAllowlist,
    }));
  };

  const stepIndex = STEPS.indexOf(step);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  /** Which errors belong to which step, so Next only blocks on this step's fields. */
  const stepErrors = useMemo(() => {
    switch (step) {
      case "basics":
        return errors.name ? { name: errors.name } : {};
      case "credentials":
        // Everything that is not the name or the allowlist — those belong to
        // the steps either side, and blocking Next on a field the user has not
        // reached yet is the classic way a wizard becomes unusable.
        return Object.fromEntries(
          Object.entries(errors).filter(
            ([field]) => field !== "name" && field !== "baseUrlAllowlist",
          ),
        );
      case "origins":
        return errors.baseUrlAllowlist
          ? { baseUrlAllowlist: errors.baseUrlAllowlist }
          : {};
    }
  }, [errors, step]);

  const stepIsValid = Object.keys(stepErrors).length === 0;

  const handleNext = () => {
    setTouched(true);
    if (!stepIsValid) return;
    setTouched(false);
    setStep(STEPS[stepIndex + 1]!);
  };

  const handleBack = () => {
    setTouched(false);
    setStep(STEPS[stepIndex - 1]!);
  };

  const handleCreate = async () => {
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    try {
      const result = await createMutation.mutateAsync(draft);
      const { id, version } = parseConnectionResourceUri(result?.location ?? "");
      toast.success(
        t("connections.created", {
          name: draft.name,
          defaultValue: '"{{name}}" created.',
        }),
      );
      onCreated?.(id, version);
      close();
    } catch (err) {
      // The backend names the field it refused and why — a duplicate name, a
      // token URL outside the operator's allowlist, PER_USER without OIDC. None
      // of those can be predicted from here, so the message is the answer.
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <AccessibleDialog
      open={open}
      onClose={close}
      title={t("connections.createTitle", "New connection")}
      testId="create-connection-dialog"
      maxWidth="max-w-xl"
    >
      {/* Step dots */}
      <div className="mb-4 flex items-center justify-center gap-2 py-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`h-2 w-2 rounded-full transition-colors ${
                i <= stepIndex ? "bg-primary" : "bg-muted"
              }`}
            />
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-8 transition-colors ${
                  i < stepIndex ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <div className="min-h-[18rem] space-y-4">
        {step === "basics" && (
          <>
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="create-connection-name"
              >
                {t("connections.name", "Name")}
              </label>
              <Input
                id="create-connection-name"
                data-testid="create-connection-name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="jira"
                autoComplete="off"
                aria-invalid={(touched && errors.name !== undefined) || undefined}
              />
              <p className="text-xs text-muted-foreground">
                {t(
                  "connections.nameHint",
                  "Agents refer to this connection by name — ${connection:jira}. It cannot be changed later.",
                )}
              </p>
              {touched && <ValidationMessage code={errors.name} />}
            </div>

            <div className="space-y-1.5">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="create-connection-description"
              >
                {t("connections.description", "Description")}
              </label>
              <Input
                id="create-connection-description"
                data-testid="create-connection-description"
                value={draft.description ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, description: e.target.value })
                }
                placeholder={t(
                  "connections.descriptionPlaceholder",
                  "What this connects to, for whoever reads the list",
                )}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-foreground">
                {t("connections.howItAuthenticates", "How it authenticates")}
              </legend>
              <div className="grid gap-2">
                {AUTH_TYPE_ORDER.map((authType) => (
                  <AuthTypeChoice
                    key={authType}
                    authType={authType}
                    selected={draft.authType === authType}
                    onSelect={() => changeAuthType(authType)}
                  />
                ))}
              </div>
            </fieldset>
          </>
        )}

        {step === "credentials" && (
          <CredentialsStep
            draft={draft}
            setDraft={setDraft}
            errors={touched ? errors : {}}
          />
        )}

        {step === "origins" && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {t("connections.allowedOrigins", "Where the credential may be sent")}
            </label>
            <p className="text-xs text-muted-foreground">
              {t(
                "connections.allowedOriginsHint",
                "List every origin this credential is allowed to reach. Anything not listed is refused, so a later config edit cannot redirect it somewhere else.",
              )}
            </p>
            <OriginAllowlistField
              value={draft.baseUrlAllowlist}
              onChange={(baseUrlAllowlist) =>
                setDraft({ ...draft, baseUrlAllowlist })
              }
              error={touched ? errors.baseUrlAllowlist : undefined}
              testId="create-connection-origins"
            />
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={isFirst}
          className={isFirst ? "invisible" : ""}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t("common.back", "Back")}
        </Button>
        {isLast ? (
          <Button
            onClick={() => void handleCreate()}
            disabled={createMutation.isPending}
            data-testid="create-connection-submit"
          >
            {createMutation.isPending
              ? t("common.saving", "Saving…")
              : t("connections.createSubmit", "Create connection")}
          </Button>
        ) : (
          <Button onClick={handleNext} data-testid="create-connection-next">
            {t("common.next", "Next")}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </AccessibleDialog>
  );
}

/* ─── Auth type choice ─────────────────────────────────────────── */

const AUTH_TYPE_ORDER: AuthType[] = [
  "STATIC",
  "BASIC",
  "OAUTH2_CLIENT_CREDENTIALS",
  "OAUTH2_AUTHORIZATION_CODE",
];

const AUTH_TYPE_ICONS: Record<AuthType, LucideIcon> = {
  STATIC: KeyRound,
  BASIC: Lock,
  OAUTH2_CLIENT_CREDENTIALS: Server,
  OAUTH2_AUTHORIZATION_CODE: UserCheck,
};

/**
 * One auth type, described by what it means rather than named by its constant.
 *
 * The copy sits in a switch of literal `t()` calls rather than in a table of
 * key strings, because `check-i18n.mjs` finds keys by scanning for literals —
 * a `t(choice.titleKey)` is invisible to it, and an invisible key is one that
 * ships as English in all eleven locales without anything going red.
 */
function AuthTypeChoice({
  authType,
  selected,
  onSelect,
}: {
  authType: AuthType;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const Icon = AUTH_TYPE_ICONS[authType];

  const title = () => {
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
  };

  const body = () => {
    switch (authType) {
      case "STATIC":
        return t(
          "connections.choice.staticBody",
          "One fixed header, the same for everyone — X-Api-Key, or Authorization: Bearer …",
        );
      case "BASIC":
        return t(
          "connections.choice.basicBody",
          "HTTP Basic. EDDI does the encoding, so the password stays a separate vault entry you can rotate on its own.",
        );
      case "OAUTH2_CLIENT_CREDENTIALS":
        return t(
          "connections.choice.clientCredentialsBody",
          "The agent signs in as itself. One access token shared by everyone, refreshed automatically.",
        );
      case "OAUTH2_AUTHORIZATION_CODE":
        return t(
          "connections.choice.authorizationCodeBody",
          "Each person connects their own account and the agent acts as them. Needs sign-in to be switched on, and a vault.",
        );
    }
  };

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      data-testid={`auth-type-choice-${authType}`}
      className={`flex items-start gap-3 rounded-lg border p-3 text-start transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40 hover:bg-secondary/50"
      }`}
    >
      <Icon
        className={`mt-0.5 h-4 w-4 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title()}</span>
        <span className="block text-xs text-muted-foreground">{body()}</span>
      </span>
    </button>
  );
}

/* ─── Credentials step ─────────────────────────────────────────── */

function CredentialsStep({
  draft,
  setDraft,
  errors,
}: {
  draft: ConnectionConfiguration;
  setDraft: (config: ConnectionConfiguration) => void;
  errors: ReturnType<typeof validateConnection>;
}) {
  const { t } = useTranslation();

  const patchStatic = (patch: Partial<NonNullable<ConnectionConfiguration["staticAuth"]>>) =>
    setDraft({
      ...draft,
      staticAuth: { headerName: "Authorization", ...draft.staticAuth, ...patch },
    });

  const patchOAuth = (patch: Partial<NonNullable<ConnectionConfiguration["oauth"]>>) =>
    setDraft({ ...draft, oauth: { ...draft.oauth, ...patch } });

  if (draft.authType === "STATIC" || draft.authType === "BASIC") {
    return (
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="create-connection-header"
          >
            {t("connections.headerName", "Header name")}
          </label>
          <Input
            id="create-connection-header"
            data-testid="create-connection-header"
            className="font-mono text-xs"
            dir="ltr"
            value={draft.staticAuth?.headerName ?? ""}
            onChange={(e) => patchStatic({ headerName: e.target.value })}
            placeholder="Authorization"
          />
          <ValidationMessage code={errors["staticAuth.headerName"]} />
        </div>

        {draft.authType === "STATIC" ? (
          <div className="space-y-1.5">
            <label
              className="text-sm font-medium text-foreground"
              htmlFor="create-connection-value"
            >
              {t("connections.headerValue", "Header value")}
            </label>
            <HeaderValueField
              id="create-connection-value"
              value={draft.staticAuth?.valueTemplate ?? ""}
              onChange={(valueTemplate) => patchStatic({ valueTemplate })}
              error={errors["staticAuth.valueTemplate"]}
            />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <label
                className="text-sm font-medium text-foreground"
                htmlFor="create-connection-username"
              >
                {t("connections.username", "Username")}
              </label>
              <Input
                id="create-connection-username"
                data-testid="create-connection-username"
                value={draft.staticAuth?.username ?? ""}
                onChange={(e) => patchStatic({ username: e.target.value })}
                autoComplete="off"
              />
              <ValidationMessage code={errors["staticAuth.username"]} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">
                {t("connections.password", "Password")}
              </label>
              <SecretKeyPicker
                value={draft.staticAuth?.passwordRef ?? ""}
                onChange={(passwordRef) => patchStatic({ passwordRef })}
                referenceOnly
                testId="create-connection-password"
              />
              <ValidationMessage code={errors["staticAuth.passwordRef"]} />
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {draft.authType === "OAUTH2_AUTHORIZATION_CODE" && (
        <div className="space-y-1.5">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="create-connection-authorization-url"
          >
            {t("connections.authorizationUrl", "Authorization URL")}
          </label>
          <Input
            id="create-connection-authorization-url"
            data-testid="create-connection-authorization-url"
            className="font-mono text-xs"
            dir="ltr"
            value={draft.oauth?.authorizationUrl ?? ""}
            onChange={(e) => patchOAuth({ authorizationUrl: e.target.value })}
            placeholder="https://auth.example.com/authorize"
          />
          <p className="text-xs text-muted-foreground">
            {t(
              "connections.authorizationUrlHint",
              "Where people are sent to approve access.",
            )}
          </p>
          <ValidationMessage code={errors["oauth.authorizationUrl"]} />
        </div>
      )}

      <div className="space-y-1.5">
        <label
          className="text-sm font-medium text-foreground"
          htmlFor="create-connection-token-url"
        >
          {t("connections.tokenUrl", "Token URL")}
        </label>
        <Input
          id="create-connection-token-url"
          data-testid="create-connection-token-url"
          className="font-mono text-xs"
          dir="ltr"
          value={draft.oauth?.tokenUrl ?? ""}
          onChange={(e) => patchOAuth({ tokenUrl: e.target.value })}
          placeholder="https://auth.example.com/oauth/token"
        />
        <ValidationMessage code={errors["oauth.tokenUrl"]} />
      </div>

      <div className="space-y-1.5">
        <label
          className="text-sm font-medium text-foreground"
          htmlFor="create-connection-client-id"
        >
          {t("connections.clientId", "Client ID")}
        </label>
        <Input
          id="create-connection-client-id"
          data-testid="create-connection-client-id"
          className="font-mono text-xs"
          dir="ltr"
          value={draft.oauth?.clientId ?? ""}
          onChange={(e) => patchOAuth({ clientId: e.target.value })}
          autoComplete="off"
        />
        <ValidationMessage code={errors["oauth.clientId"]} />
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">
          {t("connections.clientSecret", "Client secret")}
        </label>
        <SecretKeyPicker
          value={draft.oauth?.clientSecret ?? ""}
          onChange={(clientSecret) => patchOAuth({ clientSecret })}
          referenceOnly
          testId="create-connection-client-secret"
        />
        <ValidationMessage code={errors["oauth.clientSecret"]} />
      </div>
    </div>
  );
}
