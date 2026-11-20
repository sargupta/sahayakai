/**
 * What the homepage's floating Community Messages panel rotates through.
 *
 * Source: the viewer's own unified feed (GET /api/groups/feed), which only
 * holds posts, shared resources and chat activity from groups the viewer
 * belongs to — so nothing leaves the audience it was posted to, and no direct
 * messages are ever read here. The viewer's own posts are left out: the panel
 * is for what other teachers are saying.
 *
 * Pure (no React, no fetch) so the selection and links are unit-tested.
 */

import type { FeedItem, PostType } from "@/types/community";
import { excerpt } from "@/lib/community-highlights";
import { COMMUNITY_PROMPTS, COMMUNITY_PROMPT_KIND_LABEL } from "@/data/community-prompts";
import { SAMPLE_CONVERSATIONS } from "@/data/community-sample-conversations";

export const TICKER_MAX_ITEMS = 12;
export const TICKER_EXCERPT_CHARS = 320;

export type TickerKind = "post" | "resource" | "chat";

export interface TickerItem {
  /** Stable key: the feed item's id. */
  key: string;
  kind: TickerKind;
  /** Post type for posts; "resource" for shared resources; null for chat activity. */
  postType: PostType | null;
  groupId: string;
  groupName: string;
  authorName: string | null;
  authorPhotoURL: string | null;
  text: string;
  /** ISO time the item was posted; "" when unknown. */
  createdAt: string;
  likes: number | null;
  replies: number | null;
  /** Messages in a group chat highlight. */
  messages: number | null;
  href: string;
  /** A SahayakAI standard message (prompt / example), not a real teacher's post. */
  standard?: boolean;
}

/**
 * The standard messages the floating panel scrolls through while the teacher's groups have
 * nothing yet (or they are signed out): the SahayakAI community prompts and the example
 * conversations, interleaved so neighbours differ. They carry no likes, counts or times, are
 * labelled as SahayakAI's, and link to starting a post. `t` translates the English keys.
 */
export function standardTickerItems(t: (s: string) => string = (s) => s): TickerItem[] {
  const prompts: TickerItem[] = COMMUNITY_PROMPTS.map((p) => ({
    key: `std-prompt-${p.id}`,
    kind: "post",
    postType: p.postType ?? "share",
    groupId: "",
    groupName: t(COMMUNITY_PROMPT_KIND_LABEL[p.kind]),
    authorName: t("SahayakAI community prompts"),
    authorPhotoURL: null,
    text: t(p.text),
    createdAt: "",
    likes: null,
    replies: null,
    messages: null,
    href: "/community?compose=1",
    standard: true,
  }));
  const examples: TickerItem[] = SAMPLE_CONVERSATIONS.map((c) => ({
    key: `std-example-${c.id}`,
    kind: "post",
    postType: c.postType,
    groupId: "",
    groupName: `${t("Example")} · ${t(c.topic)}`,
    authorName: t(c.persona),
    authorPhotoURL: null,
    text: c.reply ? `${t(c.text)}\n\n${t(c.reply.persona)}: ${t(c.reply.text)}` : t(c.text),
    createdAt: "",
    likes: null,
    replies: null,
    messages: null,
    href: "/community",
    standard: true,
  }));
  const out: TickerItem[] = [];
  for (let i = 0; i < Math.max(prompts.length, examples.length); i++) {
    if (prompts[i]) out.push(prompts[i]);
    if (examples[i]) out.push(examples[i]);
  }
  return out;
}

/** Community page URL that opens a group and, given a post id, scrolls to that post. */
export function communityPostHref(groupId: string, postId?: string): string {
  const params = new URLSearchParams({ group: groupId });
  if (postId) params.set("post", postId);
  return `/community?${params.toString()}`;
}

function positiveOrNull(n: unknown): number | null {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

export function pickTickerItems(
  feedItems: readonly FeedItem[],
  { viewerUid, language, max = TICKER_MAX_ITEMS }: { viewerUid?: string | null; language?: string; max?: number },
): TickerItem[] {
  const out: TickerItem[] = [];
  for (const item of feedItems) {
    if (out.length >= max) break;

    if (item.type === "group_post" && item.post) {
      const post = item.post;
      if (!post.groupId || (viewerUid && post.authorUid === viewerUid)) continue;
      const raw = (language && language !== "English" && post.translations?.[language]) || post.content || "";
      if (!raw.trim()) continue;
      out.push({
        key: item.id,
        kind: "post",
        postType: post.postType,
        groupId: post.groupId,
        groupName: item.groupName ?? "",
        authorName: post.authorName || null,
        authorPhotoURL: post.authorPhotoURL || null,
        text: excerpt(raw, TICKER_EXCERPT_CHARS),
        createdAt: post.createdAt || item.timestamp || "",
        likes: positiveOrNull(post.likesCount),
        replies: positiveOrNull(post.commentsCount),
        messages: null,
        href: communityPostHref(post.groupId, post.id),
      });
      continue;
    }

    if (item.type === "resource_share" && item.resource) {
      const r = item.resource;
      if (viewerUid && r.authorUid === viewerUid) continue;
      if (!r.title?.trim()) continue;
      out.push({
        key: item.id,
        kind: "resource",
        postType: "resource",
        groupId: item.groupId ?? "",
        groupName: item.groupName ?? "",
        authorName: r.authorName || null,
        authorPhotoURL: null,
        text: excerpt(r.title, TICKER_EXCERPT_CHARS),
        createdAt: item.timestamp || "",
        likes: positiveOrNull(r.likes),
        replies: null,
        messages: null,
        // Shared resources live in the community library, not in a group's posts.
        href: item.groupId ? communityPostHref(item.groupId) : "/community-library",
      });
      continue;
    }

    if (item.type === "chat_highlight" && item.chatHighlight) {
      const c = item.chatHighlight;
      if (!c.groupId) continue;
      const latest = c.latestMessage?.trim();
      out.push({
        key: item.id,
        kind: "chat",
        postType: null,
        groupId: c.groupId,
        groupName: c.groupName ?? item.groupName ?? "",
        authorName: null,
        authorPhotoURL: null,
        text: latest ? excerpt(latest, TICKER_EXCERPT_CHARS) : "",
        createdAt: item.timestamp || "",
        likes: null,
        replies: null,
        messages: positiveOrNull(c.messageCount),
        href: communityPostHref(c.groupId),
      });
    }
    // connection and group suggestions are recommendations, not conversations: skipped.
  }
  return out;
}

/** Newest createdAt among the items, in ms; 0 when none parse. */
export function newestTimestamp(items: readonly TickerItem[]): number {
  let newest = 0;
  for (const it of items) {
    const ms = Date.parse(it.createdAt);
    if (Number.isFinite(ms) && ms > newest) newest = ms;
  }
  return newest;
}

/** Number of items posted after `seenMs` (the unread indicator). */
export function countNewerThan(items: readonly TickerItem[], seenMs: number): number {
  return items.filter((it) => {
    const ms = Date.parse(it.createdAt);
    return Number.isFinite(ms) && ms > seenMs;
  }).length;
}
