import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { SecretKeyPicker } from "@/components/shared/secret-key-picker";
import { ValidationMessage } from "@/components/connections/validation-message";
import type { ValidationCode } from "@/lib/connection-validation";

/**
 * A `valueTemplate` that is a literal prefix followed by exactly one reference.
 *
 * That covers essentially every real header — `Bearer ${vault:jira-token}`,
 * `${vault:amplitude-key}`, `Token ${vault:linear}` — and it is the only shape
 * that can be offered as two comprehensible fields instead of a syntax to
 * learn. Anything else (two references, a reference in the middle) is real and
 * legal, so it falls back to the raw template rather than being refused.
 */
const PREFIX_AND_REFERENCE =
  /^([^$]*)(\$\{(?:vault|eddivault|vars):[^}]{1,256}\})$/;

interface HeaderValueFieldProps {
  value: string;
  onChange: (value: string) => void;
  error?: ValidationCode;
  readOnly?: boolean;
  id?: string;
}

/**
 * The STATIC header value — a template, not a secret.
 *
 * Presented as "what goes in front" plus "which stored secret", because that is
 * what an author is actually deciding, and because the alternative is a free
 * text field whose rules (`${vault:…}` only, and at least one of them) are
 * invisible until the save fails.
 *
 * The raw editor is always one click away and is selected automatically for a
 * template this cannot take apart. It is not a fallback for the sake of it: a
 * connection whose stored value only the backend understands must still be
 * editable, and silently rewriting it into the structured shape would be a
 * config change nobody asked for.
 */
export function HeaderValueField({
  value,
  onChange,
  error,
  readOnly,
  id,
}: HeaderValueFieldProps) {
  const { t } = useTranslation();

  const parsed = useMemo(() => PREFIX_AND_REFERENCE.exec(value.trim()), [value]);
  /** Blank is structural: it is where an empty field starts, not an odd template. */
  const structural = value.trim() === "" || parsed !== null;
  const [raw, setRaw] = useState(!structural);

  const prefix = parsed?.[1] ?? "";
  const reference = parsed?.[2] ?? "";

  const showRaw = raw || !structural;

  return (
    <div className="space-y-2">
      {showRaw ? (
        <Input
          id={id}
          className="font-mono text-xs"
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={readOnly}
          placeholder="Bearer ${vault:jira-token}"
          aria-invalid={error !== undefined || undefined}
          data-testid="header-value-raw"
        />
      ) : (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)]">
          <div className="space-y-1">
            <Input
              id={id}
              className="h-7 font-mono text-xs"
              dir="ltr"
              value={prefix}
              onChange={(e) => onChange(`${e.target.value}${reference}`)}
              readOnly={readOnly}
              placeholder="Bearer "
              aria-label={t("connections.headerPrefix", "Prefix")}
              data-testid="header-value-prefix"
            />
            <p className="text-[10px] text-muted-foreground">
              {t("connections.headerPrefixHint", "Optional, e.g. “Bearer ”")}
            </p>
          </div>
          <div className="space-y-1">
            <SecretKeyPicker
              value={reference}
              onChange={(next) => onChange(`${prefix}${next}`)}
              readOnly={readOnly}
              referenceOnly
              testId="header-value-secret"
            />
            <p className="text-[10px] text-muted-foreground">
              {t("connections.headerSecretHint", "The stored secret to send")}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <code
          className="truncate rounded bg-muted/50 px-2 py-1 font-mono text-[11px] text-muted-foreground"
          dir="ltr"
          data-testid="header-value-preview"
        >
          {value || t("connections.headerEmptyPreview", "(nothing yet)")}
        </code>
        {structural && !readOnly && (
          <button
            type="button"
            onClick={() => setRaw((r) => !r)}
            className="text-[11px] text-primary hover:underline"
            data-testid="header-value-toggle"
          >
            {showRaw
              ? t("connections.headerUseFields", "Use the guided fields")
              : t("connections.headerUseRaw", "Edit as a template")}
          </button>
        )}
      </div>

      <ValidationMessage code={error} testId="header-value-error" />
    </div>
  );
}
