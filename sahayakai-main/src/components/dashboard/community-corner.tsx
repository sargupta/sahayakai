"use client";

/**
 * "From the Community" — the homepage's small editorial corner.
 *
 * Real posts first (from the teacher's own groups, via the same feed API the
 * Community page uses), curated SahayakAI prompts to fill the rest — see
 * src/lib/community-highlights.ts for the rule. Prompts are labelled as
 * SahayakAI prompts and never carry an author, time or count.
 *
 * Desktop (xl+) renders it in the dashboard's right column; smaller screens
 * render it inline after the prep tools (DashboardHome decides where).
 */

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Lightbulb, MessagesSquare, PenLine, Sparkles, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/context/language-context";
import { getUnifiedFeedAction } from "@/lib/api/groups";
import { POST_TYPE_CONFIG } from "@/components/community/feed-post";
import {
  communityGroupHref,
  pickCommunityHighlights,
  type CommunityCornerContent,
  type CommunityPostHighlight,
} from "@/lib/community-highlights";
import {
  COMMUNITY_PROMPT_KIND_LABEL,
  communityComposeHref,
  localDayNumber,
  type CommunityPrompt,
  type CommunityPromptKind,
} from "@/data/community-prompts";
import type { FeedItem } from "@/types/community";

const FEED_SAMPLE_SIZE = 10;

const PROMPT_ICON: Record<CommunityPromptKind, LucideIcon> = {
  tip: Lightbulb,
  idea: Sparkles,
  discussion: MessagesSquare,
  encouragement: Sparkles,
  share: PenLine,
  resource: Users,
  season: Sparkles,
};

/** Loads the teacher's feed once; `null` while loading, `[]` on error (prompts then fill in). */
export function useCommunityFeedSample(uid: string | null | undefined): FeedItem[] | null {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  useEffect(() => {
    if (!uid) {
      setItems([]);
      return;
    }
    let cancelled = false;
    setItems(null);
    getUnifiedFeedAction(FEED_SAMPLE_SIZE)
      .then((feed) => { if (!cancelled) setItems(Array.isArray(feed) ? feed : []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [uid]);
  return items;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  try {
    return formatDistanceToNow(d, { addSuffix: true });
  } catch {
    return "";
  }
}

function PostHighlight({ post }: { post: CommunityPostHighlight }) {
  const { t } = useLanguage();
  const type = POST_TYPE_CONFIG[post.postType] ?? POST_TYPE_CONFIG.share;
  const when = timeAgo(post.createdAt);
  return (
    <li>
      <Link
        href={communityGroupHref(post.groupId)}
        className="focus-ring group block rounded-surface-md border border-border bg-card p-3.5 transition-colors duration-micro ease-out-quart hover:border-primary/40"
      >
        <div className="flex items-center gap-2 text-xs">
          <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 font-medium", type.bg, type.text)}>
            <type.icon className="h-3 w-3" aria-hidden="true" />
            {t(type.label)}
          </span>
          {post.groupName && <span className="truncate text-muted-foreground">{post.groupName}</span>}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground indic-text">{post.excerpt}</p>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate font-medium text-foreground/80">{post.authorName}</span>
          {when && <><span aria-hidden="true">&middot;</span><span className="shrink-0">{when}</span></>}
          <ArrowRight className="ml-auto h-3.5 w-3.5 shrink-0 text-primary opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
        </p>
      </Link>
    </li>
  );
}

function PromptCard({ prompt, featured }: { prompt: CommunityPrompt; featured: boolean }) {
  const { t } = useLanguage();
  const Icon = PROMPT_ICON[prompt.kind];
  return (
    <li
      className={cn(
        "rounded-surface-md p-3.5",
        featured ? "border border-primary/20 bg-tint-accent-soft" : "border border-dashed border-border",
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {t(COMMUNITY_PROMPT_KIND_LABEL[prompt.kind])}
      </p>
      <p className={cn("mt-1.5 leading-relaxed text-foreground indic-text", featured ? "font-headline text-base font-semibold leading-snug" : "text-sm")}>
        {t(prompt.text)}
      </p>
      {prompt.postType && (
        <Link
          href={communityComposeHref(prompt.id)}
          className="focus-ring mt-2.5 inline-flex items-center gap-1 rounded-pill text-xs font-semibold text-primary hover:underline"
        >
          {t("Join the conversation")}
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
    </li>
  );
}

interface CommunityCornerProps {
  feedItems: FeedItem[] | null;
  viewerUid?: string | null;
  className?: string;
}

export function CommunityCorner({ feedItems, viewerUid, className }: CommunityCornerProps) {
  const { t, language } = useLanguage();
  // Rendered twice on the dashboard (right column / inline), one hidden by CSS.
  const titleId = useId();
  const day = useMemo(() => localDayNumber(new Date()), []);
  const content: CommunityCornerContent | null = useMemo(
    () => (feedItems ? pickCommunityHighlights(feedItems, { day, viewerUid, language }) : null),
    [feedItems, day, viewerUid, language],
  );

  return (
    <section
      aria-labelledby={titleId}
      className={cn("rounded-surface-lg border border-border bg-card/80 p-4 shadow-soft backdrop-blur-sm sm:p-6", className)}
    >
      <div className="flex items-center gap-3">
        <h2 id={titleId} className="flex items-center gap-2 font-headline text-base font-bold text-foreground">
          <span className="flex h-7 w-7 items-center justify-center rounded-pill bg-tint-accent">
            <Users className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          </span>
          {t("From the Community")}
        </h2>
      </div>

      {!content ? (
        <div className="mt-4 space-y-3" aria-busy="true" aria-label={t("Loading community highlights")}>
          {[0, 1].map((i) => (
            <div key={i} className="animate-pulse rounded-surface-md border border-border p-3.5">
              <div className="h-3 w-24 rounded-pill bg-muted" />
              <div className="mt-2.5 h-3 w-full rounded-pill bg-muted" />
              <div className="mt-1.5 h-3 w-4/5 rounded-pill bg-muted" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {content.posts.length > 0 && (
            <>
              <p className="mt-4 text-xs font-medium text-muted-foreground">{t("Recent in your groups")}</p>
              <ul className="mt-2 space-y-2.5">
                {content.posts.map((post) => <PostHighlight key={post.id} post={post} />)}
              </ul>
            </>
          )}

          <p className="mt-4 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {content.posts.length > 0 ? t("SahayakAI prompt") : t("SahayakAI community prompts")}
          </p>
          <ul className="mt-2 space-y-2.5">
            {content.prompts.map((prompt, i) => (
              <PromptCard key={prompt.id} prompt={prompt} featured={i === 0 && content.posts.length === 0} />
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line-hairline pt-3">
            <Link
              href="/community"
              className="focus-ring inline-flex items-center gap-1 rounded-pill text-sm font-semibold text-primary hover:underline"
            >
              {t("Explore Community")}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <Link
              href={communityComposeHref()}
              className="focus-ring inline-flex items-center gap-1.5 rounded-pill text-xs font-medium text-muted-foreground hover:text-primary"
            >
              <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
              {t("Start a discussion")}
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
