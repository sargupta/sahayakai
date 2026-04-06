"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Heart,
  MessageCircle,
  UserPlus,
  Lightbulb,
  HelpCircle,
  Trophy,
  FileUp,
  FileText,
  ExternalLink,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
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

const POST_TYPE_CONFIG: Record<
  PostType,
  { label: string; icon: typeof Lightbulb; bg: string; text: string }
> = {
  share: {
    label: "I Tried This",
    icon: Lightbulb,
    bg: "bg-amber-100",
    text: "text-amber-700",
  },
  ask_help: {
    label: "Ask Help",
    icon: HelpCircle,
    bg: "bg-purple-100",
    text: "text-purple-700",
  },
  celebrate: {
    label: "Celebrate",
    icon: Trophy,
    bg: "bg-emerald-100",
    text: "text-emerald-700",
  },
  resource: {
    label: "Resource",
    icon: FileUp,
    bg: "bg-blue-100",
    text: "text-blue-700",
  },
};

const READ_MORE_THRESHOLD = 280;

function AttachmentCard({ attachment }: { attachment: PostAttachment }) {
  const isLink = attachment.type === 'link' && attachment.url;
  const content = (
    <div className={cn(
      "flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2",
      isLink && "cursor-pointer hover:bg-muted/80 hover:border-primary/30 transition-colors",
    )}>
      {isLink ? (
        <ExternalLink className="h-4 w-4 shrink-0 text-primary/70" />
      ) : (
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      )}
      <span className={cn(
        "truncate text-sm",
        isLink ? "text-primary/80" : "text-foreground/80",
      )}>
        {attachment.title || attachment.type}
      </span>
    </div>
  );

  if (isLink) {
    return (
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="no-underline">
        {content}
      </a>
    );
  }

  return content;
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
  const { language } = useLanguage();

  const typeConfig = POST_TYPE_CONFIG[post.postType] ?? POST_TYPE_CONFIG.share;
  const TypeIcon = typeConfig.icon;

  // Show translated content if available for user's language
  const localizedContent =
    language !== "English" && post.translations?.[language]
      ? post.translations[language]
      : post.content;

  const needsTruncation = localizedContent.length > READ_MORE_THRESHOLD;
  const displayContent =
    needsTruncation && !expanded
      ? localizedContent.slice(0, READ_MORE_THRESHOLD) + "..."
      : localizedContent;

  const initials = post.authorName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
  });

  function handleLike() {
    onLike?.(post.id);
  }

  return (
    <Card className="rounded-xl border border-border transition-shadow hover:shadow-soft">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <Avatar
            className="h-10 w-10 cursor-pointer"
            onClick={() => router.push(`/profile/${post.authorUid}`)}
          >
            <AvatarImage src={post.authorPhotoURL ?? undefined} />
            <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm">
              <button
                onClick={() => router.push(`/profile/${post.authorUid}`)}
                className="truncate font-semibold text-foreground hover:underline"
              >
                {post.authorName}
              </button>
              {groupName && (
                <>
                  <span className="text-muted-foreground/60">&middot;</span>
                  <span className="truncate text-muted-foreground">{groupName}</span>
                </>
              )}
              <span className="text-muted-foreground/60">&middot;</span>
              <span className="shrink-0 text-muted-foreground/60">{timeAgo}</span>
            </div>
          </div>
        </div>

        {/* Post type badge */}
        <div className="mt-3">
          <Badge
            variant="secondary"
            className={cn(
              "gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
              typeConfig.bg,
              typeConfig.text
            )}
          >
            <TypeIcon className="h-3 w-3" />
            {typeConfig.label}
          </Badge>
        </div>

        {/* Content */}
        <div className="mt-3">
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/80">
            {displayContent}
          </p>
          {needsTruncation && (
            <button
              onClick={() => setExpanded((prev) => !prev)}
              className="mt-1 text-sm font-medium text-primary hover:text-primary/80"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>

        {/* Attachments */}
        {(post.attachments?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {post.attachments?.map((att, i) => (
              <AttachmentCard key={i} attachment={att} />
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <span>{post.likesCount} likes</span>
          <span>{post.commentsCount} comments</span>
        </div>

        {/* Actions */}
        <div className="mt-2 flex items-center gap-1 border-t border-border pt-2">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "gap-1.5 text-muted-foreground hover:bg-muted/60",
              isLiked && "text-red-500 hover:text-red-600"
            )}
            onClick={handleLike}
          >
            <Heart
              className={cn("h-4 w-4", isLiked && "fill-current")}
            />
            Like
          </Button>

          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:bg-muted/60">
            <MessageCircle className="h-4 w-4" />
            Comment
          </Button>

          {connectionStatus === "none" && onConnect && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto gap-1.5 rounded-full border-primary/20 bg-primary/10 text-primary hover:bg-primary/20"
              onClick={() => onConnect(post.authorUid)}
            >
              <UserPlus className="h-4 w-4" />
              Connect
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
