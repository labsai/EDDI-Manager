/**
 * Parse transcript entry content, which may be:
 * 1. JSON from backend `extractResponse()` — e.g. `{"output":[{"type":"text","text":"..."}],...}`
 * 2. Plain text (already extracted, or from fixed backend)
 * 3. Java `toString()` metadata dump (legacy fallback — should be filtered out)
 * Returns the cleaned text string.
 */
export function parseTranscriptContent(content: string): string {
  if (!content) return "";

  // Quick check: does it look like JSON?
  const trimmed = content.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);

      // Format 1: { "output": [{ "type": "text", "text": "..." }], ... }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const texts: string[] = [];

        // Check nested "output" array
        if (Array.isArray(parsed.output)) {
          for (const item of parsed.output) {
            if (typeof item === "string") texts.push(item);
            else if (item?.text) texts.push(String(item.text));
          }
        }

        // Check flat "output:text:*" keys
        if (texts.length === 0) {
          for (const [key, val] of Object.entries(parsed)) {
            if (!key.startsWith("output:text:")) continue;
            if (typeof val === "string") texts.push(val);
            else if (Array.isArray(val)) {
              for (const item of val) {
                if (typeof item === "string") texts.push(item);
                else if (item?.text) texts.push(String(item.text));
              }
            } else if (val && typeof val === "object" && (val as Record<string, unknown>).text) {
              texts.push(String((val as Record<string, unknown>).text));
            }
          }
        }

        if (texts.length > 0) return texts.join("\n");
      }
    } catch {
      // Not valid JSON — might be a Java toString() dump; check below
    }

    // Detect Java ConversationOutput.toString() dumps — these contain
    // raw pipeline metadata like context, parser expressions, and actions.
    // Pattern: starts with "{" but fails JSON parse, and contains known
    // metadata markers from the EDDI backend.
    if (isJavaMetadataDump(trimmed)) {
      return "";
    }
  }

  return content;
}

/**
 * Detect whether content is a raw Java ConversationOutput.toString() dump
 * containing pipeline metadata rather than meaningful agent output.
 * Matches patterns like:
 *   - `expressions=unknown(...)` (parser output)
 *   - `actions=[send_message, unknown]` (conversation step actions)
 *   - `context={groupTranscript=` (group context injection)
 *   - `output=[null]` (empty output array)
 *   - `originWorkflowId=` (pipeline origin tracking)
 */
const JAVA_METADATA_PATTERNS = [
  /expressions=unknown\(/,
  /actions=\[send_message/,
  /context=\{groupTranscript=/,
  /output=\[null\]/,
  /originWorkflowId=/,
];

function isJavaMetadataDump(content: string): boolean {
  // Must match at least 2 patterns to avoid false positives
  let matches = 0;
  for (const pattern of JAVA_METADATA_PATTERNS) {
    if (pattern.test(content)) matches++;
    if (matches >= 2) return true;
  }
  return false;
}

/** Safely format a date/time that may be ISO string, epoch seconds, or epoch millis */
export function safeFormatDate(value: string | number | null | undefined, style: "date" | "time" | "full" = "full"): string {
  if (value == null) return "";
  let d: Date;
  if (typeof value === "number") {
    d = new Date(value < 1e12 ? value * 1000 : value);
  } else if (/^\d+(\.\d+)?$/.test(value)) {
    const n = parseFloat(value);
    d = new Date(n < 1e12 ? n * 1000 : n);
  } else {
    d = new Date(value);
  }
  if (isNaN(d.getTime())) return String(value);
  switch (style) {
    case "date": return d.toLocaleDateString();
    case "time": return d.toLocaleTimeString();
    default: return d.toLocaleString();
  }
}
