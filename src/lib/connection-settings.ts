import type {
  ConnectionSetting,
  ConnectionSettings,
  ConnectionSettingsView,
} from "@/lib/api/connections";

/**
 * Pure helpers for the connection settings form, kept out of the component
 * module so it exports components only.
 *
 * Every read of a setting's `value` tolerates its absence: EDDI omits null
 * fields rather than sending `null` (see `ConnectionSetting`).
 */

/** The editable shape of the four deployment settings. */
export interface SettingsDraft {
  enabled: boolean;
  publicBaseUrl: string;
  credentialEndpointAllowlist: string[];
  allowPlaintextRemoteOrigins: boolean;
}

export function draftFromView(view: ConnectionSettingsView): SettingsDraft {
  return {
    enabled: view.enabled.value ?? false,
    publicBaseUrl: view.publicBaseUrl.value ?? "",
    credentialEndpointAllowlist: view.credentialEndpointAllowlist.value ?? [],
    allowPlaintextRemoteOrigins: view.allowPlaintextRemoteOrigins.value ?? false,
  };
}

/** Equality for a setting's value: element-wise for lists, strict otherwise. */
export function sameValue(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }
  return a === b;
}

/**
 * The `PUT` body for a draft.
 *
 * - A **pinned** field goes out as `null`. The backend keeps what is stored for
 *   it; a value that differs from the pin would be refused with 409.
 * - A field still at its **default** and left untouched also goes out as
 *   `null`, so saving one change does not quietly turn every other default into
 *   a stored copy of itself. An absent default value counts as `null`.
 * - An emptied base URL is `null` — unset — rather than an empty string.
 */
export function requestFromDraft(
  draft: SettingsDraft,
  view: ConnectionSettingsView,
): ConnectionSettings {
  const field = <T,>(setting: ConnectionSetting<T>, value: T | null): T | null => {
    if (setting.source === "PINNED") return null;
    if (setting.source === "DEFAULT" && sameValue(setting.value ?? null, value)) return null;
    return value;
  };
  const baseUrl = draft.publicBaseUrl.trim();
  return {
    enabled: field(view.enabled, draft.enabled),
    publicBaseUrl: field(view.publicBaseUrl, baseUrl === "" ? null : baseUrl),
    credentialEndpointAllowlist: field(
      view.credentialEndpointAllowlist,
      draft.credentialEndpointAllowlist,
    ),
    allowPlaintextRemoteOrigins: field(
      view.allowPlaintextRemoteOrigins,
      draft.allowPlaintextRemoteOrigins,
    ),
  };
}
