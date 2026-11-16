/**
 * Homepage Community corner: real posts first, curated SahayakAI prompts to
 * fill. Also gates the curated content itself so it can never pass as a
 * teacher's post (no author / time / count fields) and stays stable per day.
 */

import {
  COMMUNITY_PROMPTS,
  COMMUNITY_PROMPT_KIND_LABEL,
  communityComposeHref,
  getCommunityPrompt,
  invitingPromptForDay,
  promptsForDay,
} from '@/data/community-prompts';
import { communityGroupHref, excerpt, pickCommunityHighlights } from '@/lib/community-highlights';
import type { FeedItem, PostType } from '@/types/community';

const post = (id: string, authorUid = `a-${id}`, content = `Post ${id}`, postType: PostType = 'share'): FeedItem => ({
  id: `gp_${id}`,
  type: 'group_post',
  groupId: 'g1',
  groupName: 'Class 8 Science',
  timestamp: '2026-11-01T10:00:00.000Z',
  post: {
    id, groupId: 'g1', authorUid, authorName: `Author ${id}`, authorPhotoURL: null, content, postType,
    attachments: [], likesCount: 3, commentsCount: 0, createdAt: '2026-11-01T10:00:00.000Z',
  },
});

describe('pickCommunityHighlights', () => {
  it('shows the 2 newest real posts and 1 prompt when there is activity', () => {
    const r = pickCommunityHighlights([post('1'), post('2'), post('3')], { day: 0 });
    expect(r.posts.map((p) => p.id)).toEqual(['1', '2']);
    expect(r.prompts).toHaveLength(1);
  });

  it('pairs a single real post with one prompt', () => {
    const r = pickCommunityHighlights([post('1')], { day: 0 });
    expect(r.posts).toHaveLength(1);
    expect(r.prompts).toHaveLength(1);
  });

  it('falls back to two prompts when there are no posts', () => {
    const r = pickCommunityHighlights([], { day: 0 });
    expect(r.posts).toHaveLength(0);
    expect(r.prompts).toHaveLength(2);
  });

  it("skips the viewer's own posts, empty posts and non-post feed items", () => {
    const items: FeedItem[] = [
      post('mine', 'viewer'),
      post('blank', 'x', '   '),
      { id: 'cs', type: 'connection_suggestion', timestamp: '', connectionSuggestion: { uid: 'u', displayName: 'U', reason: 'r' } },
      { id: 'rs', type: 'resource_share', timestamp: '', resource: { id: 'r', title: 'T', type: 'quiz', authorName: 'A', authorUid: 'a', likes: 0, language: 'English' } },
      post('ok'),
    ];
    const r = pickCommunityHighlights(items, { day: 0, viewerUid: 'viewer' });
    expect(r.posts.map((p) => p.id)).toEqual(['ok']);
  });

  it('uses the translation for the viewer language when there is one', () => {
    const item = post('1');
    item.post!.translations = { Hindi: 'नमस्ते' };
    expect(pickCommunityHighlights([item], { day: 0, language: 'Hindi' }).posts[0].excerpt).toBe('नमस्ते');
    expect(pickCommunityHighlights([item], { day: 0, language: 'Tamil' }).posts[0].excerpt).toBe('Post 1');
  });

  it('carries only what the post itself has — real author, group and type', () => {
    const [p] = pickCommunityHighlights([post('1', 'a', 'Hi', 'ask_help')], { day: 0 }).posts;
    expect(p).toMatchObject({ authorName: 'Author 1', groupId: 'g1', groupName: 'Class 8 Science', postType: 'ask_help' });
  });

  it('links a post to its group conversation on the Community page', () => {
    expect(communityGroupHref('g 1')).toBe('/community?group=g%201');
  });
});

describe('excerpt', () => {
  it('keeps short text and collapses whitespace', () => {
    expect(excerpt('  a\n\nb  ')).toBe('a b');
  });
  it('cuts long text at a word boundary with an ellipsis', () => {
    const out = excerpt('word '.repeat(60), 40);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(41);
    expect(out).not.toMatch(/\s…$/);
  });
});

describe('curated community prompts', () => {
  it('has 10–15 unique prompts with unique ids', () => {
    expect(COMMUNITY_PROMPTS.length).toBeGreaterThanOrEqual(10);
    expect(COMMUNITY_PROMPTS.length).toBeLessThanOrEqual(15);
    expect(new Set(COMMUNITY_PROMPTS.map((p) => p.id)).size).toBe(COMMUNITY_PROMPTS.length);
    expect(new Set(COMMUNITY_PROMPTS.map((p) => p.text)).size).toBe(COMMUNITY_PROMPTS.length);
  });

  it('never carries author, time or engagement fields', () => {
    const allowed = new Set(['id', 'kind', 'text', 'postType']);
    for (const p of COMMUNITY_PROMPTS) {
      for (const key of Object.keys(p)) expect(allowed.has(key)).toBe(true);
      expect(COMMUNITY_PROMPT_KIND_LABEL[p.kind]).toBeTruthy();
    }
  });

  it('is deterministic per day and moves forward one prompt per day', () => {
    expect(promptsForDay(5, 2)).toEqual(promptsForDay(5, 2));
    expect(promptsForDay(6, 1)[0]).toBe(promptsForDay(5, 2)[1]);
    expect(promptsForDay(-1, 1)[0]).toBe(COMMUNITY_PROMPTS[COMMUNITY_PROMPTS.length - 1]);
  });

  it('never shows the same kind twice in a row', () => {
    for (let day = 0; day < COMMUNITY_PROMPTS.length; day++) {
      const [a, b] = promptsForDay(day, 2);
      expect(a.kind).not.toBe(b.kind);
    }
  });

  it('header prompt always invites a post, and compose links round-trip the id', () => {
    for (let day = 0; day < 20; day++) expect(invitingPromptForDay(day).postType).toBeTruthy();
    const p = COMMUNITY_PROMPTS[0];
    const href = communityComposeHref(p.id);
    expect(getCommunityPrompt(new URL(href, 'http://x').searchParams.get('prompt'))).toBe(p);
    expect(communityComposeHref()).toBe('/community?compose=1');
    expect(getCommunityPrompt('nope')).toBeUndefined();
  });
});
