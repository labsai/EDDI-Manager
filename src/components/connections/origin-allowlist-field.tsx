import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ValidationMessage } from "@/components/connections/validation-message";
import { validateOrigin, type ValidationCode } from "@/lib/connection-validation";

interface OriginAllowlistFieldProps {
  value: string[];
  onChange: (origins: string[]) => void;
  readOnly?: boolean;
  /** The whole-field error from the form's validation pass, if any. */
  error?: ValidationCode;
  testId?: string;
}

/**
 * `baseUrlAllowlist` — the origins this connection's credential may be sent to.
 *
 * Required and non-empty, which is the point of the whole field: without it a
 * config edit could redirect a live Google token to somebody else's host. It is
 * a *list* because one provider's credential legitimately spans hosts
 * (`googleapis.com`, `drive.googleapis.com`, …).
 *
 * Entries are checked as they are added rather than on save. The rule —
 * `scheme://host[:port]`, nothing else — is the kind that looks satisfied when
 * it is not: `api.example.com` with no scheme parses as a path, matches nothing
 * at resolve time, and produces an allowlist that appears correct and blocks
 * every request.
 */
export function OriginAllowlistField({
  value,
  onChange,
  readOnly,
  error,
  testId = "origin-allowlist",
}: OriginAllowlistFieldProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<ValidationCode | undefined>();

  const add = () => {
    const candidate = draft.trim();
    if (!candidate) return;
    const problem = validateOrigin(candidate);
    if (problem) {
      setDraftError(problem);
      return;
    }
    if (!value.includes(candidate)) onChange([...value, candidate]);
    setDraft("");
    setDraftError(undefined);
  };

  return (
    <div className="space-y-2" data-testid={testId}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((origin) => (
            <Badge
              key={origin}
              variant="secondary"
              className="gap-1 font-mono text-[11px]"
              data-testid={`${testId}-item-${origin}`}
            >
              <Globe className="h-3 w-3" aria-hidden="true" />
              <span dir="ltr">{origin}</span>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => onChange(value.filter((o) => o !== origin))}
                  className="rounded hover:text-destructive"
                  aria-label={t("connections.removeOrigin", {
                    origin,
                    defaultValue: "Remove {{origin}}",
                  })}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="flex gap-2">
          <Input
            className="h-8 font-mono text-xs"
            dir="ltr"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (draftError) setDraftError(undefined);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="https://api.example.com"
            aria-label={t("connections.addOrigin", "Add an allowed origin")}
            aria-invalid={draftError !== undefined || undefined}
            data-testid={`${testId}-input`}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={add}
            data-testid={`${testId}-add`}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t("common.add", "Add")}
          </Button>
        </div>
      )}

      {/* The draft's own problem takes precedence: it is about the text still in
          the box, which is what the user is looking at. */}
      <ValidationMessage
        code={draftError ?? error}
        testId={`${testId}-error`}
      />
    </div>
  );
}
