import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AlertTriangle, Lock, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { OriginAllowlistField } from "@/components/connections/origin-allowlist-field";
import {
  useConnectionSettings,
  useUpdateConnectionSettings,
} from "@/hooks/use-connections";
import { getErrorMessage, isApiError } from "@/lib/api-client";
import { commitPending } from "@/lib/chip-values";
import {
  draftFromView,
  requestFromDraft,
  sameValue,
  type SettingsDraft,
} from "@/lib/connection-settings";
import { cn, formatRelativeTime } from "@/lib/utils";
import type {
  ConnectionSetting,
  ConnectionSettingsView,
} from "@/lib/api/connections";

/**
 * A remount key that changes whenever the server's answer does.
 *
 * The form seeds its draft from the view once, on mount. Keying it this way
 * resets the draft after a save or when another administrator's change arrives,
 * without a state-syncing effect that could overwrite an edit mid-keystroke.
 */
function formKey(view: ConnectionSettingsView): string {
  return JSON.stringify([
    view.updatedAt,
    draftFromView(view),
    view.enabled.source,
    view.publicBaseUrl.source,
    view.credentialEndpointAllowlist.source,
    view.allowPlaintextRemoteOrigins.source,
  ]);
}

/**
 * Connections — the deployment-level settings.
 *
 * These were backend properties, so turning connections on or approving a new
 * OAuth provider meant a restart. They are runtime settings now. A property
 * that is still set on the server **pins** its value: the backend refuses to
 * change it, and this form shows it read-only with the property's name, so
 * "I saved and nothing changed" is never the experience.
 *
 * Renders nothing for a non-admin (403) and for a backend older than runtime
 * settings (404) — neither is an error the viewer can act on.
 */
export function ConnectionSettingsPanel() {
  const { t } = useTranslation();
  const { data: view, isLoading, isError, error, refetch } = useConnectionSettings();

  if (isError && isApiError(error) && [401, 403, 404].includes(error.status)) {
    return null;
  }

  if (isLoading) {
    return (
      <section
        className="space-y-3 rounded-xl border border-border bg-card p-5"
        data-testid="connection-settings-loading"
      >
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-10 w-full" />
      </section>
    );
  }

  if (isError || !view) {
    return (
      <section
        className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-5"
        data-testid="connection-settings-error"
      >
        <p className="text-sm text-muted-foreground">
          {t(
            "connections.settings.loadFailed",
            "The connection settings could not be loaded.",
          )}
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>
          {t("common.retry", "Retry")}
        </Button>
      </section>
    );
  }

  return <SettingsForm key={formKey(view)} view={view} />;
}

function SettingsForm({ view }: { view: ConnectionSettingsView }) {
  const { t } = useTranslation();
  const update = useUpdateConnectionSettings();
  const baseline = useMemo(() => draftFromView(view), [view]);
  const [draft, setDraft] = useState<SettingsDraft>(baseline);
  // Uncommitted allowlist text, owned here so a save can never drop it.
  const [pendingOrigin, setPendingOrigin] = useState("");

  const committed: SettingsDraft = {
    ...draft,
    publicBaseUrl: draft.publicBaseUrl.trim(),
    credentialEndpointAllowlist: commitPending(
      draft.credentialEndpointAllowlist,
      pendingOrigin,
    ),
  };
  const dirty =
    committed.enabled !== baseline.enabled ||
    committed.publicBaseUrl !== baseline.publicBaseUrl ||
    !sameValue(committed.credentialEndpointAllowlist, baseline.credentialEndpointAllowlist) ||
    committed.allowPlaintextRemoteOrigins !== baseline.allowPlaintextRemoteOrigins;

  const save = async () => {
    try {
      // mutateAsync rather than mutate's per-call callbacks: a successful save
      // replaces the query data, which remounts this form (see formKey), and a
      // per-call callback is not guaranteed to run for an unmounted observer.
      await update.mutateAsync(requestFromDraft(committed, view));
      toast.success(t("connections.settings.saved", "Connection settings saved"));
    } catch (err) {
      // The backend names the field and the fix — a 400 for a malformed value,
      // a 409 naming the property that pins it — so its message is the toast.
      toast.error(getErrorMessage(err));
    }
  };

  const updatedAt = view.updatedAt ? Date.parse(view.updatedAt) : Number.NaN;

  return (
    <section
      className="space-y-5 rounded-xl border border-border bg-card p-5"
      data-testid="connection-settings"
      aria-labelledby="connection-settings-title"
    >
      <div className="flex items-start gap-3">
        <SlidersHorizontal className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        <div className="space-y-1">
          <h2 id="connection-settings-title" className="text-lg font-semibold text-foreground">
            {t("connections.settings.title", "Deployment settings")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              "connections.settings.subtitle",
              "Changed here without a restart — every EDDI instance picks up a change within five seconds.",
            )}
          </p>
        </div>
      </div>

      {view.warnings.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3"
          role="status"
          data-testid="connection-settings-warnings"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {t(
                "connections.settings.warningsTitle",
                "Saved, but not everything will work yet",
              )}
            </p>
            <ul className="list-disc space-y-1 ps-4 text-sm text-muted-foreground">
              {view.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <SettingRow
        setting={view.enabled}
        label={t("connections.settings.enabled", "Connections enabled")}
        hint={t(
          "connections.settings.enabledHint",
          "While off, no connection resolves and nobody can link an account.",
        )}
        inline
      >
        <Switch
          checked={draft.enabled}
          onChange={(enabled) => setDraft((prev) => ({ ...prev, enabled }))}
          disabled={view.enabled.source === "PINNED"}
          label={t("connections.settings.enabled", "Connections enabled")}
          testId="settings-enabled"
        />
      </SettingRow>

      <SettingRow
        setting={view.publicBaseUrl}
        label={t("connections.settings.publicBaseUrl", "Public base URL")}
        hint={t(
          "connections.settings.publicBaseUrlHint",
          "EDDI's own address, such as https://eddi.example.com. The OAuth redirect URI is built from it, and providers match that exactly.",
        )}
        htmlFor="settings-public-base-url"
      >
        <Input
          id="settings-public-base-url"
          data-testid="settings-public-base-url"
          dir="ltr"
          value={draft.publicBaseUrl}
          onChange={(e) => setDraft((prev) => ({ ...prev, publicBaseUrl: e.target.value }))}
          placeholder="https://eddi.example.com"
          autoComplete="off"
          readOnly={view.publicBaseUrl.source === "PINNED"}
        />
        {view.redirectUri && (
          <p className="text-xs text-muted-foreground">
            {t(
              "connections.settings.redirectUri",
              "Redirect URI to register at each OAuth provider",
            )}
            {": "}
            <code
              className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground"
              dir="ltr"
              data-testid="settings-redirect-uri"
            >
              {view.redirectUri}
            </code>
          </p>
        )}
      </SettingRow>

      <SettingRow
        setting={view.credentialEndpointAllowlist}
        label={t("connections.settings.allowlist", "Credential endpoint allowlist")}
        hint={t(
          "connections.settings.allowlistHint",
          "Origins a client secret may be sent to: the token and authorization endpoints of your OAuth connections. While empty, no OAuth connection can resolve.",
        )}
      >
        <OriginAllowlistField
          value={draft.credentialEndpointAllowlist}
          onChange={(origins) =>
            setDraft((prev) => ({ ...prev, credentialEndpointAllowlist: origins }))
          }
          pending={pendingOrigin}
          onPendingChange={setPendingOrigin}
          readOnly={view.credentialEndpointAllowlist.source === "PINNED"}
          testId="settings-allowlist"
        />
      </SettingRow>

      <SettingRow
        setting={view.allowPlaintextRemoteOrigins}
        label={t("connections.settings.allowPlaintext", "Allow plaintext remote origins")}
        hint={t(
          "connections.settings.allowPlaintextHint",
          "Lets a connection send its credential over plain http to a host other than this one, where it crosses the network unencrypted. Loopback is always allowed.",
        )}
        inline
      >
        <Switch
          checked={draft.allowPlaintextRemoteOrigins}
          onChange={(allowPlaintextRemoteOrigins) =>
            setDraft((prev) => ({ ...prev, allowPlaintextRemoteOrigins }))
          }
          disabled={view.allowPlaintextRemoteOrigins.source === "PINNED"}
          label={t("connections.settings.allowPlaintext", "Allow plaintext remote origins")}
          testId="settings-allow-plaintext"
        />
      </SettingRow>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground" data-testid="settings-last-updated">
          {view.updatedBy && !Number.isNaN(updatedAt)
            ? t("connections.settings.lastUpdated", {
                by: view.updatedBy,
                when: formatRelativeTime(updatedAt),
                defaultValue: "Last changed by {{by}} · {{when}}",
              })
            : null}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setDraft(baseline);
              setPendingOrigin("");
            }}
            disabled={!dirty || update.isPending}
            data-testid="settings-discard"
          >
            {t("connections.settings.discard", "Discard changes")}
          </Button>
          <Button
            onClick={() => void save()}
            disabled={!dirty || update.isPending}
            data-testid="settings-save"
          >
            {t("connections.settings.save", "Save settings")}
          </Button>
        </div>
      </div>
    </section>
  );
}

function SettingRow({
  setting,
  label,
  hint,
  htmlFor,
  inline,
  children,
}: {
  setting: ConnectionSetting<unknown>;
  label: string;
  hint: string;
  htmlFor?: string;
  inline?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const pinned = setting.source === "PINNED";
  const heading = (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-medium text-foreground" htmlFor={htmlFor}>
          {label}
        </label>
        {pinned && (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            title={t(
              "connections.settings.pinnedHint",
              "Set in the server's configuration, so it can only be changed there.",
            )}
            data-testid={`pinned-${setting.property}`}
          >
            <Lock className="h-3 w-3" aria-hidden="true" />
            <span dir="ltr">
              {t("connections.settings.pinned", {
                property: setting.property,
                defaultValue: "Pinned by {{property}}",
              })}
            </span>
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  if (inline) {
    return (
      <div className="flex items-start justify-between gap-4">
        {heading}
        {children}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {heading}
      {children}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
  testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      data-testid={testId}
      className={cn(
        "relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform",
          checked ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
