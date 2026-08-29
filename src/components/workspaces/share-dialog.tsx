import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Globe, Loader2, Lock, Trash2, Users, UserPlus } from "lucide-react";
import { AccessibleDialog } from "@/components/ui/accessible-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getErrorMessage } from "@/lib/api-client";
import {
  ACCESS_LEVELS,
  getShareInfo,
  levelIncludes,
  revokeShare,
  setResourceVisibility,
  shareResource,
  type AccessLevel,
  type ResourceVisibility,
  type ShareResult,
} from "@/lib/api/sharing";
import { describeSpace, isUserSubject, parseSubjectInput } from "@/lib/spaces";

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  /** The resource being shared — an agent id, a workflow id, and so on. */
  resourceId: string;
  /** Shown in the title so the user knows what they are about to share. */
  resourceName?: string;
}

/**
 * Share one resource with people and teams.
 *
 * <h3>The consequence line is the point</h3> Sharing an agent cascades through
 * the workflows, rule sets, LLM configs and output sets it references — it has
 * to, or the recipient gets a name pointing at documents they cannot open. That
 * is invisible in the request and surprising in the result, so every outcome
 * here says how many resources it actually touched and names what it declined
 * to touch. "Shared" and "shared, except three things that belong to a
 * colleague" are different facts and the user needs both.
 */
export function ShareDialog({ open, onClose, resourceId, resourceName }: ShareDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [subjectInput, setSubjectInput] = useState("");
  const [level, setLevel] = useState<AccessLevel>("USE");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<ShareResult | null>(null);

  const {
    data: info,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["shares", resourceId],
    queryFn: () => getShareInfo(resourceId),
    enabled: open && !!resourceId,
  });

  const isOwner = levelIncludes(info?.callerLevel, "OWN");

  const afterChange = useCallback(
    async (result: ShareResult) => {
      setLastResult(result);
      await refetch();
      // Owner and visibility ride on the descriptor, so any listing showing a
      // badge for this resource is now stale.
      await queryClient.invalidateQueries({ queryKey: ["agents"] });
      await queryClient.invalidateQueries({ queryKey: ["descriptors"] });
    },
    [refetch, queryClient]
  );

  const handleShare = useCallback(async () => {
    const parsed = parseSubjectInput(subjectInput);
    if ("error" in parsed) {
      toast.error(
        parsed.error === "unknown-prefix"
          ? t("workspaces.share.unknownPrefix", "Use 'user:' or 'team:' — or just a name for a person.")
          : t("workspaces.share.subjectRequired", "Enter a person or team to share with.")
      );
      return;
    }
    setBusy(true);
    try {
      const result = await shareResource(resourceId, parsed.subject, level);
      await afterChange(result);
      setSubjectInput("");
      toast.success(t("workspaces.share.shared", "Shared"));
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [subjectInput, level, resourceId, afterChange, t]);

  const handleRevoke = useCallback(
    async (subject: string) => {
      setBusy(true);
      try {
        const result = await revokeShare(resourceId, subject);
        await afterChange(result);
        toast.success(t("workspaces.share.revoked", "Access removed"));
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [resourceId, afterChange, t]
  );

  const handleVisibility = useCallback(
    async (visibility: ResourceVisibility) => {
      setBusy(true);
      try {
        const result = await setResourceVisibility(resourceId, visibility);
        await afterChange(result);
        toast.success(t("workspaces.share.visibilityUpdated", "Visibility updated"));
      } catch (e) {
        toast.error(getErrorMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [resourceId, afterChange, t]
  );

  const title = resourceName
    ? t("workspaces.share.titleNamed", "Share “{{name}}”", { name: resourceName })
    : t("workspaces.share.title", "Share");

  const grants = useMemo(() => info?.grants ?? [], [info]);

  return (
    <AccessibleDialog open={open} onClose={onClose} title={title} maxWidth="max-w-lg" testId="share-dialog">
      {isLoading && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t("common.loading", "Loading…")}
        </div>
      )}

      {error && (
        <p className="py-4 text-sm text-destructive" role="alert">
          {getErrorMessage(error)}
        </p>
      )}

      {info && (
        <div className="space-y-5">
          <OwnerLine ownerId={info.ownerId} spaceId={info.spaceId} />

          {!isOwner && (
            <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              {t(
                "workspaces.share.notOwner",
                "Only the owner can change who has access. Ask them if you need this shared more widely."
              )}
            </p>
          )}

          {isOwner && (
            <>
              <VisibilityChooser current={info.visibility} busy={busy} onChange={handleVisibility} />

              <section className="space-y-2">
                <h3 className="text-sm font-medium">
                  {t("workspaces.share.peopleAndTeams", "People and teams")}
                </h3>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={subjectInput}
                    onChange={(e) => setSubjectInput(e.target.value)}
                    placeholder={t("workspaces.share.subjectPlaceholder", "name@example.com or team:engineering")}
                    aria-label={t("workspaces.share.subjectLabel", "Person or team")}
                    data-testid="share-subject-input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !busy) {
                        e.preventDefault();
                        void handleShare();
                      }
                    }}
                  />
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value as AccessLevel)}
                    aria-label={t("workspaces.share.levelLabel", "Access level")}
                    data-testid="share-level-select"
                    className="h-9 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {ACCESS_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {levelLabel(t, l)}
                      </option>
                    ))}
                  </select>
                  <Button onClick={() => void handleShare()} disabled={busy} data-testid="share-submit">
                    <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                    {t("workspaces.share.add", "Share")}
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">{levelHint(t, level)}</p>

                {grants.length === 0 ? (
                  <p className="py-2 text-sm text-muted-foreground">
                    {t("workspaces.share.noGrants", "Not shared with anyone yet.")}
                  </p>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {grants.map((grant) => (
                      <li key={grant.subject} className="flex items-center gap-3 px-3 py-2">
                        {isUserSubject(grant.subject) ? (
                          <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        ) : (
                          <Users className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        )}
                        <span className="flex-1 truncate text-sm">{describeSpace(grant.subject)}</span>
                        <Badge variant="secondary">{levelLabel(t, grant.level)}</Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleRevoke(grant.subject)}
                          aria-label={t("workspaces.share.revokeFor", "Stop sharing with {{subject}}", {
                            subject: describeSpace(grant.subject) ?? grant.subject,
                          })}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}

          {lastResult && <CascadeSummary result={lastResult} />}
        </div>
      )}
    </AccessibleDialog>
  );
}

function OwnerLine({ ownerId, spaceId }: { ownerId: string | null; spaceId: string | null }) {
  const { t } = useTranslation();
  const space = describeSpace(spaceId);
  return (
    <p className="text-sm text-muted-foreground" data-testid="share-owner-line">
      {ownerId
        ? t("workspaces.share.ownedBy", "Owned by {{owner}}", { owner: ownerId })
        : t("workspaces.share.unowned", "No recorded owner")}
      {space ? ` · ${t("workspaces.share.inSpace", "in {{space}}", { space })}` : ""}
    </p>
  );
}

function VisibilityChooser({
  current,
  busy,
  onChange,
}: {
  current: ResourceVisibility;
  busy: boolean;
  onChange: (v: ResourceVisibility) => void;
}) {
  const { t } = useTranslation();
  const options: { value: ResourceVisibility; icon: typeof Lock; label: string; hint: string }[] = [
    {
      value: "private",
      icon: Lock,
      label: t("workspaces.visibility.private", "Private"),
      hint: t("workspaces.visibility.privateHint", "Only you and people you share it with."),
    },
    {
      value: "space",
      icon: Users,
      label: t("workspaces.visibility.space", "Workspace"),
      hint: t("workspaces.visibility.spaceHint", "Everyone in this resource's workspace."),
    },
    {
      value: "published",
      icon: Globe,
      label: t("workspaces.visibility.published", "Published"),
      hint: t("workspaces.visibility.publishedHint", "Everyone with access to this deployment."),
    },
  ];

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{t("workspaces.share.visibility", "Visibility")}</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((opt) => {
          const Icon = opt.icon;
          const selected = current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={busy}
              onClick={() => onChange(opt.value)}
              aria-pressed={selected}
              data-testid={`visibility-${opt.value}`}
              className={[
                "flex flex-col gap-1 rounded-md border p-3 text-left transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
                selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent",
              ].join(" ")}
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {opt.label}
              </span>
              <span className="text-xs text-muted-foreground">{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * What the last change actually did.
 *
 * Sharing an agent reaches the whole config graph beneath it, which the user
 * never asked for explicitly — so say so. And when something was left alone
 * because it belongs to somebody else, name it: silence there reads as success
 * and leaves a recipient with a half-shared agent nobody knows is half-shared.
 */
function CascadeSummary({ result }: { result: ShareResult }) {
  const { t } = useTranslation();
  const skipped = result.skipped ?? [];
  const updated = result.updated ?? [];

  return (
    <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3" data-testid="share-cascade-summary">
      <p className="text-sm">
        {t("workspaces.share.cascadeApplied", "Applied to {{count}} resource", {
          count: updated.length,
        })}
      </p>
      {skipped.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {t("workspaces.share.cascadeSkipped", "{{count}} resource left unchanged — you do not own it", {
              count: skipped.length,
            })}
          </p>
          <ul className="list-inside list-disc text-xs text-muted-foreground">
            {skipped.slice(0, 5).map((target) => (
              <li key={target.id} className="truncate">
                {target.name ?? target.id}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function levelLabel(t: (k: string, d: string) => string, level: AccessLevel): string {
  switch (level) {
    case "USE":
      return t("workspaces.level.use", "Can chat");
    case "VIEW":
      return t("workspaces.level.view", "Can view");
    case "EDIT":
      return t("workspaces.level.edit", "Can edit");
    case "OWN":
      return t("workspaces.level.own", "Owner");
  }
}

function levelHint(t: (k: string, d: string) => string, level: AccessLevel): string {
  switch (level) {
    case "USE":
      return t(
        "workspaces.level.useHint",
        "They can talk to the agent, but cannot see how it is built — no prompts, tools or credentials."
      );
    case "VIEW":
      return t("workspaces.level.viewHint", "They can read the configuration and export a copy, but not change it.");
    case "EDIT":
      return t("workspaces.level.editHint", "They can change and deploy it, but not delete it or share it further.");
    case "OWN":
      return t("workspaces.level.ownHint", "Full control, including deleting it and sharing it with others.");
  }
}
