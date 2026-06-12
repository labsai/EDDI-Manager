import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/api-client";
import {
  Globe,
  GlobeLock,
  Settings,
  Clock,
  Scissors,
  Plus,
  X,
  Play,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  parseUriId,
  type RagIngestionSource,
  type WebSourceConfig,
  type Scope,
  type CrawlSettings,
  type IngestionSettings,
  type Schedule,
} from "@/lib/api/ingestion-sources";
import {
  useIngestionSources,
  useCreateIngestionSource,
  useUpdateIngestionSource,
  useDeleteIngestionSource,
  useTriggerIngestion,
} from "@/hooks/use-ingestion-sources";

const EMPTY_SOURCE: RagIngestionSource = {
  name: "",
  type: "web",
  sourceConfig: { startUrl: "" },
  ragConfigUri: "",
};

const SOURCE_TYPES = [
  { value: "web", label: "Web Crawler", hint: "Crawl websites with TOC extraction", disabled: false },
  { value: "file", label: "File System", hint: "Coming soon", disabled: true },
  { value: "git", label: "Git Repository", hint: "Coming soon", disabled: true },
  { value: "api", label: "API Endpoint", hint: "Coming soon", disabled: true },
] as const;

const CHUNK_STRATEGIES = [
  { value: "recursive", label: "Recursive (recommended)" },
  { value: "paragraph", label: "Paragraph" },
  { value: "sentence", label: "Sentence" },
] as const;

const CRON_PRESETS = [
  { label: "Hourly", expr: "0 * * * *" },
  { label: "Daily", expr: "0 2 * * *" },
  { label: "Weekly", expr: "0 2 * * 0" },
  { label: "Monthly", expr: "0 2 1 * *" },
] as const;

function Section({
  label,
  icon: Icon,
  accent,
  defaultOpen = true,
  children,
}: {
  label: string;
  icon: React.ElementType;
  accent: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-border bg-card/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-start transition-colors hover:bg-muted/30"
      >
        <Icon className={cn("h-4 w-4 shrink-0", accent)} />
        <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-foreground/80">
          {label}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && <div className="border-t border-border px-4 py-3">{children}</div>}
    </div>
  );
}

export interface IngestionSourceEditorProps {
  initial?: RagIngestionSource;
  ragConfigUri: string;
  onSave: (source: RagIngestionSource) => void;
  onCancel: () => void;
  readOnly?: boolean;
  isSaving?: boolean;
}

export function IngestionSourceEditor({
  initial,
  ragConfigUri,
  onSave,
  onCancel,
  readOnly = false,
  isSaving = false,
}: IngestionSourceEditorProps) {
  const [source, setSource] = useState<RagIngestionSource>(
    initial ?? { ...EMPTY_SOURCE, ragConfigUri },
  );

  const update = useCallback(
    (patch: Partial<RagIngestionSource>) => setSource((prev) => ({ ...prev, ...patch })),
    [],
  );

  const isWeb = source.type === "web";
  const webConfig = source.sourceConfig as WebSourceConfig | undefined;
  const scope = webConfig?.scope;
  const crawlSettings = webConfig?.crawlSettings;
  const ingestSettings = source.ingestionSettings;
  const schedule = source.schedule;

  return (
    <div className="space-y-3" data-testid="ingestion-source-editor">
      <Section label="Basic Information" icon={Globe} accent="text-sky-500">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={source.name}
              onChange={(e) => update({ name: e.target.value })}
              readOnly={readOnly}
              placeholder="e.g. Product Documentation"
              className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="ingestion-source-name"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </label>
            <input
              type="text"
              value={source.description ?? ""}
              onChange={(e) => update({ description: e.target.value || undefined })}
              readOnly={readOnly}
              placeholder="Optional description"
              className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              data-testid="ingestion-source-description"
            />
          </div>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Source Type <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {SOURCE_TYPES.map((st) => (
                <button
                  key={st.value}
                  type="button"
                  disabled={st.disabled || readOnly}
                  onClick={() => {
                    if (st.value === source.type || st.disabled) return;
                    update({ type: st.value, sourceConfig: { startUrl: "" } });
                  }}
                  className={cn(
                    "rounded-lg border p-2.5 text-start transition-all",
                    source.type === st.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary/50"
                      : "border-border hover:border-muted-foreground/40",
                    (st.disabled || readOnly) && "opacity-50 cursor-not-allowed",
                  )}
                  data-testid={`source-type-${st.value}`}
                >
                  <span className="text-xs font-medium text-foreground">{st.label}</span>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{st.hint}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {isWeb && (
        <Section label="Web Source Configuration" icon={GlobeLock} accent="text-emerald-500">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Start URL <span className="text-destructive">*</span>
              </label>
              <input
                type="url"
                value={webConfig?.startUrl ?? ""}
                onChange={(e) =>
                  update({ sourceConfig: { ...webConfig, startUrl: e.target.value } as WebSourceConfig })
                }
                readOnly={readOnly}
                placeholder="https://docs.example.com"
                className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="source-start-url"
              />
            </div>


            <div className="rounded-md border border-dashed border-muted-foreground/20 p-3">
              <details className="group" data-testid="scope-details">
                <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-muted-foreground list-none flex items-center gap-1.5">
                  <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  Scope Constraints
                </summary>
                <div className="mt-2 space-y-2.5">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={scope?.sameDomainOnly ?? true}
                      onChange={(e) =>
                        update({
                          sourceConfig: {
                            ...webConfig,
                            scope: { ...scope, sameDomainOnly: e.target.checked } as Scope,
                          } as WebSourceConfig,
                        })
                      }
                      disabled={readOnly}
                      className="rounded border-input accent-primary"
                      data-testid="source-same-domain"
                    />
                    <span className="text-xs text-foreground">Same Domain Only</span>
                  </label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Path Prefix</label>
                      <input
                        type="text"
                        value={scope?.pathPrefix ?? "/"}
                        onChange={(e) =>
                          update({
                            sourceConfig: {
                              ...webConfig,
                              scope: { ...scope, pathPrefix: e.target.value || "/" } as Scope,
                            } as WebSourceConfig,
                          })
                        }
                        readOnly={readOnly}
                        className="h-7 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        data-testid="source-path-prefix"
                      />
                    </div>
                    <div className="w-20">
                      <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Max Depth</label>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={scope?.maxDepth ?? 3}
                        onChange={(e) =>
                          update({
                            sourceConfig: {
                              ...webConfig,
                              scope: { ...scope, maxDepth: parseInt(e.target.value, 10) || 0 } as Scope,
                            } as WebSourceConfig,
                          })
                        }
                        readOnly={readOnly}
                        className="h-7 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        data-testid="source-max-depth"
                      />
                    </div>
                    <div className="w-20">
                      <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Max Pages</label>
                      <input
                        type="number"
                        min={1}
                        max={10000}
                        value={scope?.maxPages ?? 200}
                        onChange={(e) =>
                          update({
                            sourceConfig: {
                              ...webConfig,
                              scope: { ...scope, maxPages: parseInt(e.target.value, 10) || 1 } as Scope,
                            } as WebSourceConfig,
                          })
                        }
                        readOnly={readOnly}
                        className="h-7 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        data-testid="source-max-pages"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Exclude Patterns</label>
                    <ExcludePatternEditor
                      patterns={scope?.excludePatterns ?? []}
                      onChange={(patterns) =>
                        update({
                          sourceConfig: {
                            ...webConfig,
                            scope: { ...scope, excludePatterns: patterns.length > 0 ? patterns : undefined } as Scope,
                          } as WebSourceConfig,
                        })
                      }
                      readOnly={readOnly}
                    />
                  </div>
                </div>
              </details>
            </div>

            <div className="rounded-md border border-dashed border-muted-foreground/20 p-3">
              <details className="group" data-testid="crawl-settings-details">
                <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wider text-muted-foreground list-none flex items-center gap-1.5">
                  <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                  Crawl Settings
                </summary>
                <div className="mt-2 space-y-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Request Delay (ms)</label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={crawlSettings?.requestDelayMs ?? 500}
                        onChange={(e) =>
                          update({
                            sourceConfig: {
                              ...webConfig,
                              crawlSettings: { ...crawlSettings, requestDelayMs: parseInt(e.target.value, 10) || 0 } as CrawlSettings,
                            } as WebSourceConfig,
                          })
                        }
                        readOnly={readOnly}
                        className="h-7 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        data-testid="source-request-delay"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Timeout (s)</label>
                      <input
                        type="number"
                        min={1}
                        value={crawlSettings?.timeoutSeconds ?? 15}
                        onChange={(e) =>
                          update({
                            sourceConfig: {
                              ...webConfig,
                              crawlSettings: { ...crawlSettings, timeoutSeconds: parseInt(e.target.value, 10) || 15 } as CrawlSettings,
                            } as WebSourceConfig,
                          })
                        }
                        readOnly={readOnly}
                        className="h-7 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        data-testid="source-timeout"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">User-Agent</label>
                    <input
                      type="text"
                      value={crawlSettings?.userAgent ?? "EDDI-Crawler/1.0"}
                      onChange={(e) =>
                        update({
                          sourceConfig: {
                            ...webConfig,
                            crawlSettings: { ...crawlSettings, userAgent: e.target.value || undefined } as CrawlSettings,
                          } as WebSourceConfig,
                        })
                      }
                      readOnly={readOnly}
                      className="h-7 w-full rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      data-testid="source-user-agent"
                    />
                  </div>
                </div>
              </details>
            </div>
          </div>
        </Section>
      )}

      <Section label="Ingestion Settings" icon={Scissors} accent="text-amber-500">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Chunk Strategy</label>
            <select
              value={ingestSettings?.chunkStrategy ?? "recursive"}
              onChange={(e) =>
                update({
                  ingestionSettings: { ...ingestSettings, chunkStrategy: e.target.value as IngestionSettings["chunkStrategy"] } as IngestionSettings,
                })
              }
              disabled={readOnly}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
              data-testid="source-chunk-strategy"
            >
              {CHUNK_STRATEGIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Chunk Size</label>
                <span className="text-xs font-mono font-medium text-foreground">{ingestSettings?.chunkSize ?? 512} chars</span>
              </div>
              <input
                type="range" min={64} max={4096} step={64}
                value={ingestSettings?.chunkSize ?? 512}
                onChange={(e) => update({ ingestionSettings: { ...ingestSettings, chunkSize: parseInt(e.target.value, 10) } as IngestionSettings })}
                disabled={readOnly}
                className="w-full accent-primary"
                data-testid="source-chunk-size"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Overlap</label>
                <span className="text-xs font-mono font-medium text-foreground">{ingestSettings?.chunkOverlap ?? 64} chars</span>
              </div>
              <input
                type="range" min={0} max={Math.floor((ingestSettings?.chunkSize ?? 512) / 2)} step={16}
                value={ingestSettings?.chunkOverlap ?? 64}
                onChange={(e) => update({ ingestionSettings: { ...ingestSettings, chunkOverlap: parseInt(e.target.value, 10) } as IngestionSettings })}
                disabled={readOnly}
                className="w-full accent-primary"
                data-testid="source-chunk-overlap"
              />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={ingestSettings?.contentHashDedup ?? true}
                onChange={(e) => update({ ingestionSettings: { ...ingestSettings, contentHashDedup: e.target.checked } as IngestionSettings })}
                disabled={readOnly}
                className="rounded border-input accent-primary"
                data-testid="source-content-dedup"
              />
              <span className="text-xs text-foreground">Content Hash Dedup</span>
            </label>
            <div className="flex-1">
              <label className="mb-0.5 block text-[10px] font-medium text-muted-foreground">Max Content Length</label>
              <input
                type="number" min={1000} max={1000000} step={1000}
                value={ingestSettings?.maxContentLength ?? 100000}
                onChange={(e) => update({ ingestionSettings: { ...ingestSettings, maxContentLength: parseInt(e.target.value, 10) || 100000 } as IngestionSettings })}
                readOnly={readOnly}
                className="h-7 w-32 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="source-max-content"
              />
            </div>
          </div>
        </div>
      </Section>

      <Section label="Schedule" icon={Clock} accent="text-violet-500">
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={schedule?.enabled ?? true}
              onChange={(e) => update({ schedule: { ...schedule, enabled: e.target.checked } as Schedule })}
              disabled={readOnly}
              className="rounded border-input accent-primary"
              data-testid="source-schedule-enabled"
            />
            <span className="text-xs text-foreground">Scheduled Run Enabled</span>
          </label>
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cron Expression</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={schedule?.cronExpression ?? "0 2 * * *"}
                onChange={(e) => update({ schedule: { ...schedule, cronExpression: e.target.value || "0 2 * * *" } as Schedule })}
                readOnly={readOnly}
                placeholder="0 2 * * *"
                className="h-8 flex-1 rounded-md border border-input bg-background px-3 font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                data-testid="source-cron"
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Format: minute hour day month weekday</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {CRON_PRESETS.map((preset) => (
                <button
                  key={preset.expr}
                  type="button"
                  disabled={readOnly}
                  onClick={() => update({ schedule: { ...schedule, cronExpression: preset.expr } as Schedule })}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[10px] transition-colors",
                    (schedule?.cronExpression ?? "0 2 * * *") === preset.expr
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-muted-foreground/40",
                  )}
                  data-testid={`cron-preset-${preset.label.toLowerCase()}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {!readOnly && (
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
            data-testid="source-cancel-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(source)}
            disabled={!source.name.trim() || !ragConfigUri || isSaving}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            data-testid="source-save-btn"
          >
            {isSaving ? (initial ? "Updating..." : "Adding...") : initial ? "Update Source" : "Add Source"}
          </button>
        </div>
      )}
    </div>
  );
}

function ExcludePatternEditor({
  patterns,
  onChange,
  readOnly,
}: {
  patterns: string[];
  onChange: (patterns: string[]) => void;
  readOnly?: boolean;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    onChange([...patterns, trimmed]);
    setInput("");
  };

  return (
    <div>
      {patterns.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {patterns.map((p, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
              {p}
              {!readOnly && (
                <button type="button" onClick={() => onChange(patterns.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
      {!readOnly && (
        <div className="flex gap-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
            placeholder="**/legacy/**"
            className="h-7 flex-1 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={add}
            disabled={!input.trim()}
            className="inline-flex items-center gap-1 rounded border border-input px-2 text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
      )}
    </div>
  );
}

export function IngestionSourcesPanel({
  resourceId,
  version,
  readOnly,
}: {
  resourceId: string;
  version: number;
  readOnly?: boolean;
}) {
  const ragConfigUri = `eddi://ai.labs.rag/ragstore/rags/${resourceId}?version=${version}`;
  const { data: sources, isLoading } = useIngestionSources(ragConfigUri);
  const createMutation = useCreateIngestionSource();
  const updateMutation = useUpdateIngestionSource();
  const deleteMutation = useDeleteIngestionSource();
  const triggerMutation = useTriggerIngestion();

  const { t } = useTranslation();
  const [editing, setEditing] = useState<{ source: RagIngestionSource; id?: string; version?: number } | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleSave = (source: RagIngestionSource) => {
    if (editing?.id && editing?.version !== undefined) {
      updateMutation.mutate(
        { id: editing.id, version: editing.version, source },
        {
          onSuccess: () => {
            toast.success(t("ragEditor.sourceUpdated", "Ingestion source updated"));
            setEditing(null);
            setIsAdding(false);
          },
          onError: (err) => {
            toast.error(t("ragEditor.sourceUpdateError", "Failed to update ingestion source"), { description: getErrorMessage(err) });
          },
        },
      );
    } else {
      createMutation.mutate(source, {
        onSuccess: () => {
          toast.success(t("ragEditor.sourceCreated", "Ingestion source created"));
          setIsAdding(false);
          setEditing(null);
        },
        onError: (err) => {
          toast.error(t("ragEditor.sourceCreateError", "Failed to create ingestion source"), { description: getErrorMessage(err) });
        },
      });
    }
  };

  const handleDelete = (srcId: string, srcVersion: number) => {
    deleteMutation.mutate(
      { id: srcId, version: srcVersion, ragConfigUri },
      {
        onSuccess: () => {
          toast.success(t("ragEditor.sourceDeleted", "Ingestion source deleted"));
        },
        onError: (err) => {
          toast.error(t("ragEditor.sourceDeleteError", "Failed to delete ingestion source"), { description: getErrorMessage(err) });
        },
      },
    );
  };

  const handleTrigger = (id: string, version: number) => {
    setTriggering(id);
    triggerMutation.mutate({ id, version }, {
      onSuccess: () => toast.success(t("ragEditor.triggerSuccess", "Ingestion triggered")),
      onError: (err) => toast.error(t("ragEditor.triggerError", "Failed to trigger ingestion"), { description: getErrorMessage(err) }),
      onSettled: () => setTriggering(null),
    });
  };

  return (
    <div className="space-y-3" data-testid="ingestion-sources-panel">
      {isLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading ingestion sources...
        </div>
      )}

      {!isLoading && sources && sources.length === 0 && !isAdding && (
        <p className="text-xs text-muted-foreground italic" data-testid="no-sources-msg">
          No ingestion sources configured. Add one to automatically crawl content into this knowledge base.
        </p>
      )}

      {sources && sources.length > 0 && (
        <div className="space-y-2">
          {sources.map((src, idx) => {
            const parsed = src.resource ? parseUriId(src.resource) : null;
            const srcId = parsed?.id ?? `src-${idx}`;
            const srcVersion = parsed?.version ?? 1;
            const isWeb = src.type === "web";
            const wc = src.sourceConfig as WebSourceConfig;
            return (
              <div key={src.resource ?? idx} className="rounded-lg border border-border bg-card p-3" data-testid={`source-item-${idx}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">{src.name}</span>
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{src.type}</span>
                    </div>
                    {src.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">{src.description}</p>
                    )}
                    {isWeb && wc?.startUrl && (
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground truncate">{wc.startUrl}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!readOnly && (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditing({ source: src, id: srcId, version: srcVersion })}
                          className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit"
                          data-testid={`source-edit-${idx}`}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTrigger(srcId, srcVersion)}
                          disabled={triggering === srcId}
                          className="rounded p-1 text-muted-foreground hover:text-emerald-500 transition-colors"
                          title="Trigger Ingestion"
                          data-testid={`source-trigger-${idx}`}
                        >
                          {triggering === srcId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(srcId, srcVersion)}
                          className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete"
                          data-testid={`source-delete-${idx}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && !isAdding && (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-muted-foreground/30 px-3 py-2 text-xs font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          data-testid="add-ingestion-source-btn"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Ingestion Source
        </button>
      )}

      {(isAdding || editing) && (
        <IngestionSourceEditor
          initial={editing?.source}
          ragConfigUri={ragConfigUri}
          onSave={handleSave}
          onCancel={() => { setEditing(null); setIsAdding(false); }}
          readOnly={false}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}
