/**
 * Chooses what the homepage Community corner shows: real community posts
 * first, curated SahayakAI prompts to fill the rest.
 *
 *   2+ real posts  → the 2 newest posts + 1 prompt
 *   1 real post    → that post + 1 prompt
 *   no real posts  → 2 prompts (one featured)
 *
 * Real posts come only from the caller's own unified feed (GET
 * /api/groups/feed — posts in groups the viewer belongs to), so nothing
 * leaves the audience it was posted to. The viewer's own posts are skipped:
 * the corner is for what others are saying.
 */

import type { FeedItem, PostType } from "@/types/community";
import { promptsForDay, type CommunityPrompt } from "@/data/community-prompts";

export const CORNER_MAX_POSTS = 2;
export const CORNER_EXCERPT_CHARS = 140;

export interface CommunityPostHighlight {
  id: string;
  groupId: string;
  groupName: string;
  authorName: string;
  postType: PostType;
  excerpt: string;
  createdAt: string;
}

export interface CommunityCornerContent {
  posts: CommunityPostHighlight[];
  prompts: CommunityPrompt[];
}

/** Trim to a word boundary and add an ellipsis when the text is longer than `max`. */
export function excerpt(text: string, max = CORNER_EXCERPT_CHARS): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).replace(/[\s.,;:!?-]+$/, "")}…`;
}

export function pickCommunityHighlights(
  feedItems: readonly FeedItem[],
  { day, viewerUid, language }: { day: number; viewerUid?: string | null; language?: string },
): CommunityCornerContent {
  const posts: CommunityPostHighlight[] = [];
  for (const item of feedItems) {
    if (posts.length >= CORNER_MAX_POSTS) break;
    const post = item.type === "group_post" ? item.post : undefined;
    if (!post || !post.groupId || (viewerUid && post.authorUid === viewerUid)) continue;
    const text =
      (language && language !== "English" && post.translations?.[language]) || post.content || "";
    if (!text.trim()) continue;
    posts.push({
      id: post.id,
      groupId: post.groupId,
      groupName: item.groupName ?? "",
      authorName: post.authorName,
      postType: post.postType,
      excerpt: excerpt(text),
      createdAt: post.createdAt,
    });
  }
  return { posts, prompts: promptsForDay(day, posts.length > 0 ? 1 : 2) };
}

/** Community page URL that opens a group's conversation. */
export function communityGroupHref(groupId: string): string {
  return `/community?group=${encodeURIComponent(groupId)}`;
}
