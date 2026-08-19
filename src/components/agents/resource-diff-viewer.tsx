import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { diffLines } from "diff";
import { Equal, AlertTriangle } from "lucide-react";

interface ResourceDiffViewerProps {
  sourceContent: string | null;
  targetContent: string | null;
}

/** Unchanged lines kept either side of a change, git-style. */
const CONTEXT_LINES = 3;
/** A gap this short is not worth a fold — the fold row costs a line itself. */
const MIN_COLLAPSIBLE_GAP = 4;

type LineKind = "added" | "removed" | "context";

interface DiffLine {
  kind: LineKind;
  text: string;
}

type DiffRow = { row: "line"; line: DiffLine } | { row: "gap"; id: number; count: number };

/**
 * Side-by-side-ish diff viewer for JSON resource content.
 * Uses jsdiff's diffLines to compute a unified colored diff.
 *
 * Both sides are normalised first — parsed, deep key-sorted and re-printed with
 * the same indentation — so that only real content differences show up. Without
 * that, comparing a stored document against a compact request body reports the
 * whole document as rewritten, which is the opposite of what a diff is for.
 */
export function ResourceDiffViewer({
  sourceContent,
  targetContent,
}: ResourceDiffViewerProps) {
  const { t } = useTranslation();
  const [expandedGaps, setExpandedGaps] = useState<Set<number>>(() => new Set());

  const diff = useMemo(() => {
    if (!sourceContent && !targetContent) return null;

    const source = normalizeJson(sourceContent);
    const target = normalizeJson(targetContent);

    if (source.text === target.text) return "identical" as const;

    return {
      lines: toDiffLines(diffLines(target.text, source.text)),
      // Only one side needs to be unparseable for the comparison to fall back to
      // raw text, and the approver has to be told: a formatting-only difference
      // then renders as a full rewrite.
      rawComparison: !source.parsed || !target.parsed,
    };
  }, [sourceContent, targetContent]);

  const rows = useMemo(
    () => (diff && diff !== "identical" ? collapseUnchanged(diff.lines, expandedGaps) : []),
    [diff, expandedGaps],
  );

  if (diff === null) return null;

  if (diff === "identical") {
    return (
      <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground bg-secondary/30 rounded-lg">
        <Equal className="h-4 w-4" />
        {t("importDialog.contentIdentical", "Content identical")}
      </div>
    );
  }

  return (
    <div className="overflow-auto rounded-lg border bg-card text-xs font-mono max-h-80">
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-secondary/50 text-[10px] text-muted-foreground">
        <span>{t("importDialog.targetContent", "Target")} → {t("importDialog.sourceContent", "Source")}</span>
      </div>
      {diff.rawComparison && (
        <p
          className="flex items-start gap-1.5 border-b bg-amber-500/10 px-3 py-1.5 text-[10px] font-sans text-amber-700 dark:text-amber-400"
          data-testid="diff-raw-comparison"
        >
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          {t(
            "importDialog.diffRawComparison",
            "One side isn't valid JSON, so this is a plain-text comparison — differences in formatting alone also show up as changes.",
          )}
        </p>
      )}
      <div className="p-0">
        {rows.map((entry, i) =>
          entry.row === "gap" ? (
            <button
              key={`gap-${entry.id}`}
              type="button"
              onClick={() => setExpandedGaps((open) => new Set(open).add(entry.id))}
              className="flex w-full items-center gap-2 border-s-2 border-transparent bg-secondary/30 px-2 py-0.5 text-start text-[10px] font-sans text-muted-foreground hover:bg-secondary/60"
              data-testid="diff-context-gap"
            >
              {/* `lines`, not `count` — `count` would put i18next into plural
                  lookup (`_one`/`_other`), and a gap is never shorter than
                  MIN_COLLAPSIBLE_GAP anyway. */}
              {t("importDialog.diffHiddenLines", "… {{lines}} unchanged lines — click to show", {
                lines: entry.count,
              })}
            </button>
          ) : (
            <div
              key={`line-${i}`}
              className={`flex ${
                entry.line.kind === "added"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-s-2 border-emerald-500"
                  : entry.line.kind === "removed"
                    ? "bg-red-500/10 text-red-700 dark:text-red-400 border-s-2 border-red-500"
                    : "text-muted-foreground border-s-2 border-transparent"
              }`}
            >
              <span className="inline-block w-6 shrink-0 text-end pe-2 text-muted-foreground/50 select-none">
                {entry.line.kind === "added" ? "+" : entry.line.kind === "removed" ? "−" : " "}
              </span>
              {/* `whitespace-pre-wrap` keeps the JSON indentation a plain div
                  would collapse; `wrap-anywhere` wraps an over-long line
                  instead of pushing every other line behind a scrollbar. */}
              <span className="min-w-0 flex-1 whitespace-pre-wrap wrap-anywhere">
                {entry.line.text || " "}
              </span>
            </div>
          ),
        )}
      </div>
    </div>
  );
}

interface NormalizedJson {
  text: string;
  /** False when the content could not be parsed and is compared as raw text. */
  parsed: boolean;
}

/** Deep-sort all keys recursively and re-print, for stable diffing */
function normalizeJson(content: string | null): NormalizedJson {
  if (!content) return { text: "", parsed: true };

  const direct = parseJson(content);
  if (direct.ok) return { text: printJson(direct.value), parsed: true };

  const repaired = parseJson(repairRedactionMarkers(content));
  if (repaired.ok) return { text: printJson(repaired.value), parsed: true };

  return { text: content, parsed: false };
}

function parseJson(content: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(content) };
  } catch {
    return { ok: false };
  }
}

function printJson(value: unknown): string {
  return JSON.stringify(deepSortKeys(value), null, 2);
}

/**
 * Re-quote a redaction marker that was substituted into the raw request text.
 *
 * EDDI's `SecretRedactionFilter` writes `<REDACTED>` over the matched secret,
 * and depending on what the pattern consumed that can take one or both of the
 * value's quotes with it — leaving `"apiKey":<REDACTED>"` or `"apiKey":"<REDACTED>`,
 * neither of which parses. One unparseable field then costs the approver the
 * whole diff: the proposed body falls back to its raw single line and every
 * line of the stored document reads as deleted.
 *
 * Only used as a fallback after a straight parse has already failed, so a body
 * where the marker sits legitimately inside a string (`${vault:<REDACTED>}`) is
 * never rewritten — and if this repair does corrupt such a body, the re-parse
 * fails too and the raw text is used exactly as before.
 */
function repairRedactionMarkers(content: string): string {
  if (!content.includes("<REDACTED>")) return content;
  return content.replace(/"?<REDACTED>"?/g, '"<REDACTED>"');
}

function deepSortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(deepSortKeys);
  if (value !== null && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = deepSortKeys((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

/** Flatten jsdiff chunks into one line per rendered row. */
function toDiffLines(changes: ReturnType<typeof diffLines>): DiffLine[] {
  const lines: DiffLine[] = [];
  for (const change of changes) {
    const kind: LineKind = change.added ? "added" : change.removed ? "removed" : "context";
    const parts = change.value.split("\n");
    // Each chunk ends on the newline that terminates its last line.
    if (parts[parts.length - 1] === "") parts.pop();
    for (const text of parts) lines.push({ kind, text });
  }
  return lines;
}

/**
 * Fold long runs of unchanged lines away.
 *
 * The point of the diff is the change; on a 400-line agent config, rendering
 * every identical line back puts the approver right back to finding the edit by
 * eye. Each fold is expandable — nothing is hidden that cannot be got back.
 */
function collapseUnchanged(lines: DiffLine[], expandedGaps: Set<number>): DiffRow[] {
  const keep = lines.map((line) => line.kind !== "context");
  lines.forEach((line, i) => {
    if (line.kind === "context") return;
    for (let j = Math.max(0, i - CONTEXT_LINES); j <= Math.min(lines.length - 1, i + CONTEXT_LINES); j++) {
      keep[j] = true;
    }
  });

  const rows: DiffRow[] = [];
  let gapId = 0;
  for (let i = 0; i < lines.length; ) {
    const line = lines[i]!;
    if (keep[i]) {
      rows.push({ row: "line", line });
      i++;
      continue;
    }
    const start = i;
    while (i < lines.length && !keep[i]) i++;
    const run = lines.slice(start, i);
    const id = gapId++;
    if (run.length < MIN_COLLAPSIBLE_GAP || expandedGaps.has(id)) {
      for (const line of run) rows.push({ row: "line", line });
    } else {
      rows.push({ row: "gap", id, count: run.length });
    }
  }
  return rows;
}
