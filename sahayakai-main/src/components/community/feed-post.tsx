"use client";

import { useState } from "react";
import { isSafeHttpsUrl } from '@/lib/security/safe-links';
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Heart,
  UserPlus,
  Lightbulb,
  HelpCircle,
  Trophy,
  FileUp,
  FileText,
  ExternalLink,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { ModerationMenu } from "@/components/moderation/moderation-menu";
import type { GroupPost, PostType, PostAttachment } from "@/types/community";
import type { ConnectionStatus } from "@/types";

interface FeedPostProps {
  post: GroupPost;
  groupName?: string;
  connectionStatus?: ConnectionStatus;
  onLike?: (postId: string) => void;
  onConnect?: (uid: string) => void;
  isLiked?: boolean;
}

/**
 * Post-type label + tint. Exported so the homepage Community corner and the
 * feed filter use the same names and colours as the posts themselves.
 */
export const POST_TYPE_CONFIG: Record<
  PostType,
  { label: string; icon: typeof Lightbulb; bg: string; text: string }
> = {
  share: {
    label: "I Tried This",
    icon: Lightbulb,
    bg: "bg-tint-accent",
    text: "text-primary",
  },
  ask_help: {
    label: "Ask Help",
    icon: HelpCircle,
    bg: "bg-tint-info",
    text: "text-info",
  },
  celebrate: {
    label: "Celebrate",
    icon: Trophy,
    bg: "bg-tint-success",
    text: "text-success",
  },
  resource: {
    label: "Resource",
    icon: FileUp,
    bg: "bg-chart-5/10",
    text: "text-chart-5",
  },
};

const READ_MORE_THRESHOLD = 280;

function AttachmentCard({ attachment }: { attachment: PostAttachment }) {
  // Only https links are clickable: older or client-written posts may hold javascript: URLs.
  const isLink = attachment.type === 'link' && isSafeHttpsUrl(attachment.url);
  const content = (
    <div className={cn(
      "flex max-w-full items-center gap-2 rounded-surface-sm border border-border bg-muted/50 px-3 py-2",
      isLink && "cursor-pointer hover:bg-muted hover:border-primary/30 transition-colors duration-micro",
    )}>
      {isLink ? (
        <ExternalLink className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      ) : (
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <span className={cn(
        "truncate text-sm",
        isLink ? "text-primary" : "text-foreground/80",
      )}>
        {attachment.title || attachment.type}
      </span>
    </div>
  );

  if (isLink) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="focus-ring max-w-full rounded-surface-sm no-underline">
        {content}
      </a>
    );
  }

  return content;
}

// Null-safe initials from a possibly-undefined display name.
function getInitials(name?: string | null): string {
  if (!name || typeof name !== "string") return "?";
  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "?";
}

// Coerce an arbitrary createdAt value into a Date. Handles ISO strings,
// epoch numbers, and Firestore Timestamp shapes ({seconds} / {_seconds} /
// .toDate()). Returns null when it cannot produce a valid Date.
function coerceDate(value: unknown): Date | null {
  if (value == null) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === "object") {
    const obj = value as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };
    if (typeof obj.toDate === "function") {
      try {
        const d = obj.toDate();
        return d instanceof Date && !isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
    const seconds =
      typeof obj.seconds === "number"
        ? obj.seconds
        : typeof obj._seconds === "number"
          ? obj._seconds
          : null;
    if (seconds != null) {
      const d = new Date(seconds * 1000);
      return isNaN(d.getTime()) ? null : d;
    }
  }

  return null;
}

// Safe relative-time string. Returns '' on any malformed/invalid input
// so a single bad post can never throw and blank the whole feed.
function formatTimeAgo(value: unknown): string {
  const date = coerceDate(value);
  if (!date) return "";
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "";
  }
}

export default function FeedPost({
  post,
  groupName,
  connectionStatus,
  onLike,
  onConnect,
  isLiked = false,
}: FeedPostProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const { language, t } = useLanguage();

  const typeConfig = POST_TYPE_CONFIG[post.postType] ?? POST_TYPE_CONFIG.share;
  const TypeIcon = typeConfig.icon;

  // Show translated content if available for user's language.
  // Default to '' so a post missing both a translation and content
  // never crashes on `.length` / `.slice`.
  const localizedContent =
    (language !== "English" && post.translations?.[language]
      ? post.translations[language]
      : post.content) ?? "";

  const needsTruncation = localizedContent.length > READ_MORE_THRESHOLD;
  const displayContent =
    needsTruncation && !expanded
      ? localizedContent.slice(0, READ_MORE_THRESHOLD) + "..."
      : localizedContent;

  const initials = getInitials(post.authorName);

  const timeAgo = formatTimeAgo(post.createdAt);

  function handleLike() {
    onLike?.(post.id);
  }

  const statParts = [
    post.likesCount > 0 ? (post.likesCount === 1 ? t("1 like") : t("{count} likes").replace("{count}", String(post.likesCount))) : null,
    post.commentsCount > 0 ? (post.commentsCount === 1 ? t("1 comment") : t("{count} comments").replace("{count}", String(post.commentsCount))) : null,
  ].filter(Boolean);

  return (
    <article className="rounded-surface-md border border-border bg-card shadow-soft transition-shadow duration-micro ease-out-quart hover:shadow-elevated">
      <div className="p-4 sm:p-6">
        {/* Header: who, where, when — then what kind of post */}
        {/* Grid so the one post-type pill sits under the author on phones and
            beside it from sm up, without crowding the group name. */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-4 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]">
          <button
            type="button"
            onClick={() => router.push(`/profile/${post.authorUid}`)}
            className="focus-ring row-span-2 shrink-0 self-start rounded-pill sm:row-span-1"
            aria-label={t("View profile")}
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={post.authorPhotoURL ?? undefined} alt="" />
              <AvatarFallback className="bg-tint-accent text-sm font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
          </button>

          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => router.push(`/profile/${post.authorUid}`)}
              className="focus-ring block max-w-full truncate rounded-surface-sm text-left text-sm font-semibold text-foreground hover:underline"
            >
              {post.authorName}
            </button>
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              {groupName && <span className="truncate">{groupName}</span>}
              {groupName && timeAgo && <span aria-hidden="true">&middot;</span>}
              {timeAgo && <span className="shrink-0">{timeAgo}</span>}
            </p>
          </div>

          <span
            className={cn(
              "col-start-2 row-start-2 mt-2 inline-flex items-center gap-1 justify-self-start rounded-pill px-2.5 py-1 text-xs font-medium sm:col-start-3 sm:row-start-1 sm:mt-0",
              typeConfig.bg,
              typeConfig.text
            )}
          >
            <TypeIcon className="h-3 w-3" aria-hidden="true" />
            {t(typeConfig.label)}
          </span>

          {/* Moderation v1: block author / report post (hides itself on own posts) */}
          <div className="col-start-3 row-start-1 -mr-2 -mt-1 sm:col-start-4">
            <ModerationMenu
              targetUid={post.authorUid}
              targetName={post.authorName}
              reportTargetType="post"
              reportTargetId={post.id}
            />
          </div>
        </div>

        {/* Content */}
        <div className="mt-3 sm:pl-14">
          <p className="whitespace-pre-line break-words text-base leading-7 text-foreground/90 indic-text">
            {displayContent}
          </p>
          {needsTruncation && (
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="focus-ring mt-1 rounded-surface-sm text-sm font-medium text-primary hover:underline"
            >
              {expanded ? t("Show less") : t("Read more")}
            </button>
          )}

          {/* Attachments */}
          {(post.attachments?.length ?? 0) > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {post.attachments?.map((att, i) => (
                <AttachmentCard key={i} attachment={att} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Actions — only controls that do something. The old "Comment" button had
          no handler (comments are not built yet), so it is gone until they are. */}
      <div className="flex items-center gap-2 border-t border-line-hairline px-2 py-1.5 sm:px-3">
        <Button
          variant="ghost"
          size="sm"
          aria-pressed={isLiked}
          className={cn(
            "gap-1.5 text-muted-foreground hover:bg-tint-danger hover:text-destructive",
            isLiked && "text-destructive"
          )}
          onClick={handleLike}
        >
          <Heart
            className={cn("h-4 w-4", isLiked && "fill-current")}
            aria-hidden="true"
          />
          {t("Like")}
        </Button>

        {statParts.length > 0 && (
          <span className="text-xs text-muted-foreground">{statParts.join(" · ")}</span>
        )}

        {connectionStatus === "none" && onConnect && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-8 gap-1.5 rounded-pill border-primary/20 bg-tint-accent text-primary hover:bg-primary/15 hover:text-primary"
            onClick={() => onConnect(post.authorUid)}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {t("Connect")}
          </Button>
        )}
      </div>
    </article>
  );
}
