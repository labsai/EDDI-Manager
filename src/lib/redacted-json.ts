/**
 * Parsing JSON that EDDI's secret redaction has already been through.
 *
 * `SecretRedactionFilter` (EDDI: `secrets/sanitize/SecretRedactionFilter.java`)
 * runs over the raw request TEXT, not over a parsed document, and its last rule
 *
 *     (api[_-]?key|token|secret|password|authorization)(?:\\*["'])?\s*[=:]\s*(?:\\*["'])?[^'"\\\s,;}{\]]{8,}
 *       → $1=<REDACTED>
 *
 * matches the key's closing quote, the colon AND the value's opening quote, then
 * replaces the lot. So a perfectly ordinary body comes back malformed:
 *
 *     {"modelName":"x","apiKey":"sk-ant-…"}  →  {"modelName":"x","apiKey=<REDACTED>"}
 *     {"token":12345678,"n":1}               →  {"token=<REDACTED>,"n":1}
 *
 * — a bare string where a key/value pair was. The `sk-…` and `Bearer …` rules
 * replace only the value and leave the document valid; this one does not, and it
 * runs last, so it re-mangles what those already redacted.
 *
 * Two client-side readers parse that body, and BOTH failed silently on it:
 *
 * - the approval diff, which fell back to comparing raw text and reported the
 *   whole stored document as deleted;
 * - `detectEscalationFlags`, whose capability-grant checks all sit behind a
 *   `JSON.parse` — so a request that embedded a credential AND granted dynamic
 *   agent creation warned about the credential only. "No warning" reads as "no
 *   capability grant", which is the exact false negative that file exists to
 *   prevent.
 *
 * Repairing here rather than at either call site keeps them agreeing about what
 * a redacted body means — the same reason `RequestRedactor` holds the backend's
 * three redaction sites together in one class.
 */

/**
 * A field the filter mangled, as it appears in the output.
 *
 * - `([{,]\s*)` — the match must be in KEY position, so a *value* that
 *   legitimately reads `"apiKey=<REDACTED>"` (the filter's correct output when a
 *   credential was embedded in a string) is left alone.
 * - `"([^"\\]*?(?:…names…))` — the key text, ending in one of the filter's
 *   names. `[^"\\]` cannot cross a quote, which also bounds the backtracking.
 * - `(?:[^",}\]]*")?` — what a secret containing a space leaves behind:
 *   `"password":"hunter2 more"` → `"password=<REDACTED> more"`.
 * - the lookahead insists a value delimiter follows, so a partial match inside
 *   some larger string is not rewritten.
 */
const REDACTED_FIELD =
  /([{,]\s*)"([^"\\]*?(?:api[_-]?key|token|secret|password|authorization))=<REDACTED>(?:[^",}\]]*")?(?=\s*[,}\]])/gi;

/** Cheap pre-check: the mangled shape always contains this. */
const MANGLED_MARKER = "=<REDACTED>";

/** Re-quote every field {@link REDACTED_FIELD} matches. Exported for tests. */
export function repairRedactedFields(content: string): string {
  if (!content.includes(MANGLED_MARKER)) return content;
  return content.replace(REDACTED_FIELD, '$1"$2":"<REDACTED>"');
}

export type ParseResult = { ok: true; value: unknown } | { ok: false };

/**
 * `JSON.parse`, retried once over {@link repairRedactedFields} if it throws.
 *
 * The repair is a FALLBACK, never a pre-pass: a body that already parses is
 * returned untouched, so a document carrying the marker legitimately inside a
 * string — `"${vault:<REDACTED>}"`, or an escaped JSON body nested in a field —
 * is never rewritten. And a repair that does not yield valid JSON is discarded,
 * leaving the caller exactly the failure it had before.
 */
export function parseRedactedJson(content: string): ParseResult {
  const direct = tryParse(content);
  if (direct.ok) return direct;
  return tryParse(repairRedactedFields(content));
}

function tryParse(content: string): ParseResult {
  try {
    return { ok: true, value: JSON.parse(content) };
  } catch {
    return { ok: false };
  }
}
