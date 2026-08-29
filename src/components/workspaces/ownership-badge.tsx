import { useTranslation } from "react-i18next";
import { Globe, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { describeSpace } from "@/lib/spaces";

interface OwnershipBadgeProps {
  ownerId?: string;
  spaceId?: string;
  visibility?: "private" | "space" | "published";
  className?: string;
}

/**
 * Says, in one glance, why a resource is in a list that is otherwise "yours".
 *
 * <h3>It shows nothing far more often than it shows something</h3> The common
 * case — your own resource, in your own workspace — needs no badge, and adding
 * one to every row would turn the signal into wallpaper. So this renders only
 * for the two cases a reader would otherwise get wrong: something published to
 * the whole deployment, and something that reached them through someone else.
 *
 * It is presentation only. Access is decided by the backend, which scopes every
 * listing regardless of what is drawn here.
 */
export function OwnershipBadge({ ownerId, spaceId, visibility, className }: OwnershipBadgeProps) {
  const { t } = useTranslation();
  const { user } = useAuth();

  // No workspace fields at all: a backend without workspaces, or data that
  // predates them. Saying "unowned" there would invent a concept the deployment
  // does not have.
  if (!ownerId && !spaceId && !visibility) return null;

  if (visibility === "published") {
    return (
      <Badge variant="secondary" className={className} data-testid="ownership-badge-published">
        <Globe className="mr-1 h-3 w-3" aria-hidden="true" />
        {t("workspaces.badge.published", "Published")}
      </Badge>
    );
  }

  const isMine = !!ownerId && !!user?.username && ownerId === user.username;
  if (isMine) return null;

  if (!ownerId) return null;

  const space = describeSpace(spaceId);
  return (
    <Badge
      variant="outline"
      className={className}
      data-testid="ownership-badge-shared"
      title={
        space
          ? t("workspaces.badge.sharedTitle", "Owned by {{owner}} · in {{space}}", { owner: ownerId, space })
          : t("workspaces.badge.ownedBy", "Owned by {{owner}}", { owner: ownerId })
      }
    >
      <Users className="mr-1 h-3 w-3" aria-hidden="true" />
      {t("workspaces.badge.shared", "Shared")}
    </Badge>
  );
}
