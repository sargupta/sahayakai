# SahayakAI Community Redesign — Detailed Implementation Plan

> **Last updated: 2026-06-10. STATUS: LARGELY SHIPPED.** Verified against
> `src/app/community/page.tsx`, `src/components/community/**`,
> `src/app/actions/groups.ts`, and `src/types/community.ts`. Plan text below is
> preserved; per-section status callouts mark what is live.
>
> Summary:
> - 3-tab architecture (Discover/Connect/Chat) **removed** — no `Tabs` in
>   `community/page.tsx`. Replaced by the unified feed. **[SHIPPED]**
> - `GroupList`, `ShareComposer`, `UnifiedFeed`, `GroupsSidebar`, `FeedPost`,
>   `GroupCard`, `GroupFeed`, `ContextualConnect`, `FeedSkeleton`,
>   `ChatPreviewBanner` all exist. **[SHIPPED]**
> - `src/types/community.ts` and `src/app/actions/groups.ts` exist with the
>   planned action set (`getUnifiedFeedAction`, `ensureUserGroupsAction`, etc.).
>   **[SHIPPED]**
> - `community-chat.tsx` accepts a `collectionPath` prop; `group-feed.tsx`
>   passes `groups/${group.id}/chat`. **[SHIPPED]**
> - The standalone **`GroupChat` wrapper (`group-chat.tsx`) was NOT built** — the
>   `collectionPath`-parameterized `community-chat.tsx` covers that role directly.
>   **[NOT BUILT — superseded]**
> - `ensureUserGroupsAction` is invoked from `community/page.tsx` on mount, **not**
>   from a post-login auth hook as Phase 1 step 3 proposed. **[PARTIAL]**

**Design Philosophy**: Facebook India 2012-2014 — Groups-first, activity-driven, belonging over browsing.

**Scope**: Complete redesign of `/community` page — Discover, Connect, and Chat tabs merged into a unified, groups-based social experience.

---

## Part 1: Architecture & Data Layer

### 1.1 New Firestore Collections

**`groups/{groupId}`** — Auto-created groups based on teacher profiles (subject+grade, school, region, interest).

```
{
  name: string                    // "Class 8 Science — CBSE"
  description: string             // Auto-generated contextual description
  type: 'subject_grade' | 'school' | 'region' | 'interest'
  coverColor: string              // Deterministic gradient from group name hash
  memberCount: number             // Denormalized, incremented on join
  autoJoinRules: {                // Rules engine for auto-membership
    subjects?: string[]
    grades?: string[]
    board?: string
    school?: string
    state?: string
  }
  lastActivityAt: ISO string      // Updated on every post/chat — drives group ranking
  createdAt: ISO string
  createdBy: 'system' | uid
}
```

**`groups/{groupId}/members/{uid}`** — Membership tracking.

```
{ joinedAt: ISO string, role: 'member' | 'moderator' }
```

**`groups/{groupId}/posts/{postId}`** — Group-scoped feed posts (the core content unit).

```
{
  authorUid: string
  authorName: string              // Denormalized from user profile
  authorPhotoURL: string | null
  content: string                 // The teacher's narrative ("I tried this...")
  postType: 'share' | 'ask_help' | 'celebrate' | 'resource'
  attachments: [{                 // Optional linked resources
    type: 'lesson-plan' | 'quiz' | 'worksheet' | 'image' | 'audio' | ...
    resourceId?: string           // Links to library_resources if applicable
    url?: string                  // Direct URL for images/audio
    title?: string
  }]
  likesCount: number
  commentsCount: number
  createdAt: Timestamp (server)
}
```

**`groups/{groupId}/chat/{messageId}`** — Per-group real-time chat (replaces single global `community_chat`).

```
{
  text: string
  audioUrl?: string
  authorId: string
  authorName: string
  authorPhotoURL?: string
  createdAt: Timestamp (server)
}
```

**`users/{uid}/feed/{feedItemId}`** — Fan-out-on-write personal feed (Phase 2 optimization — not in initial launch). For v1, we aggregate from groups client-side.

### 1.2 New TypeScript Types (`src/types/community.ts`)

- `Group`, `GroupMember`, `GroupPost`, `PostType`, `PostAttachment`
- `GroupChatMessage` (reuses existing `ChatMessage` shape with groupId context)
- `FeedItem` — union type wrapping group posts, connection suggestions, chat highlights
- `ShareTemplate` — structured post creation templates

### 1.3 New Server Actions (`src/app/actions/groups.ts`)

| Action | Purpose |
|--------|---------|
| `getMyGroupsAction()` | Fetch groups where current user is a member, ordered by lastActivityAt |
| `getGroupAction(groupId)` | Single group with metadata |
| `joinGroupAction(groupId)` | Add membership, increment memberCount |
| `leaveGroupAction(groupId)` | Remove membership, decrement memberCount |
| `getGroupPostsAction(groupId, cursor?)` | Paginated posts for a group feed (20 per page) |
| `createGroupPostAction(groupId, post)` | Create post in group, update lastActivityAt |
| `likeGroupPostAction(groupId, postId)` | Toggle like on a group post |
| `getGroupChatMessagesAction(groupId)` | Initial load for group chat (not real-time — real-time via Firestore listener) |
| `sendGroupChatMessageAction(groupId, text, audioUrl?)` | Send message to group chat with rate limiting |
| `discoverGroupsAction()` | Groups the user is NOT in, ranked by relevance (shared subjects/grades/region) |
| `ensureUserGroupsAction(uid)` | Auto-join user to matching groups on login/profile-update (idempotent) |
| `getUnifiedFeedAction(cursor?)` | Aggregate posts from all user's groups, sorted by recency, paginated |

### 1.4 Enhanced Connection Actions (`src/app/actions/connections.ts` — extend existing)

| Action | Purpose |
|--------|---------|
| `getContextualConnectionSuggestions(context)` | Given a post/resource interaction, suggest the author + related teachers |

No structural changes to the existing connection request/accept/decline/disconnect flow — it works well. We're changing WHERE suggestions surface, not HOW connections work.

---

## Part 2: Component Architecture

### 2.1 New Components

> **STATUS [SHIPPED, one exception].** All files below exist under
> `src/components/community/` EXCEPT `group-chat.tsx`, which was not built — the
> reusable `community-chat.tsx` (now taking a `collectionPath` prop) serves per-group
> chat directly. Note `unified-feed.tsx` and `groups-sidebar.tsx` also shipped (they
> are in the File Manifest in Part 5).

| Component | File | Purpose |
|-----------|------|---------|
| **`FeedPost`** | `src/components/community/feed-post.tsx` | Single post card — shows author, narrative, attachments, like/comment counts, contextual connect button if not connected |
| **`ShareComposer`** | `src/components/community/share-composer.tsx` | Inline composer with template buttons (I Tried This, Share Resource, Ask for Help, Celebrate). Replaces `CreatePostDialog` as the primary input. Always visible at top of feed — no modal |
| **`GroupCard`** | `src/components/community/group-card.tsx` | Compact card showing group name, member count, last activity, join/open button |
| **`GroupFeed`** | `src/components/community/group-feed.tsx` | Full group view — header + post feed + inline chat toggle |
| **`GroupChat`** | `src/components/community/group-chat.tsx` | Per-group real-time chat (adapted from existing CommunityChat, parameterized by groupId) |
| **`GroupList`** | `src/components/community/group-list.tsx` | Horizontal scrollable list of user's groups (like WhatsApp group chips) |
| **`ContextualConnect`** | `src/components/community/contextual-connect.tsx` | Inline "Connect with [author]" prompt that appears after saving/liking a resource |
| **`FeedSkeleton`** | `src/components/community/feed-skeleton.tsx` | Loading skeleton for the unified feed |
| **`ChatPreviewBanner`** | `src/components/community/chat-preview-banner.tsx` | "12 messages in Math Teachers today" banner in the feed |

### 2.2 Refactored Components

| Component | Changes |
|-----------|---------|
| **`community/page.tsx`** | Complete rewrite — single unified feed replacing 3-tab architecture. Groups rail on right (desktop) / horizontal chips on top (mobile). Inline composer. No more Tabs |
| **`teacher-directory.tsx`** | Kept as a sub-view accessible from "Find Teachers" link, but no longer a primary tab. Connection buttons reused in FeedPost and ContextualConnect |
| **`community-chat.tsx`** | Refactored to accept `collectionPath` prop (default: `community_chat`, or `groups/{id}/chat`). Becomes the reusable chat engine for all group chats + the legacy global "Staff Room" |
| **`create-post-dialog.tsx`** | Kept as fallback for desktop "New Post" button, but ShareComposer is the primary input |

### 2.3 Page Layout (New Community Page)

```
┌──────────────────────────────────────────────────────────────┐
│  Header: "Community" + notification bell                      │
├──────────────────────────────────────────────────────────────┤
│  [Group chips: horizontal scroll] "Math 8" "My School" "All" │
├────────────────────────────┬─────────────────────────────────┤
│                            │                                  │
│  ShareComposer (inline)    │  My Groups (sidebar, desktop)    │
│  "What did you try today?" │  ┌─────────────────────────┐    │
│  [I Tried] [Resource]      │  │ Class 8 Science — CBSE  │    │
│  [Ask Help] [Celebrate]    │  │ 24 members · 3 new      │    │
│                            │  ├─────────────────────────┤    │
│  ── Feed ──────────────    │  │ GHS Raichur Teachers    │    │
│  ┌────────────────────┐    │  │ 8 members · 1 new       │    │
│  │ Priya (Math, CBSE) │    │  ├─────────────────────────┤    │
│  │ "Tried fraction     │    │  │ Karnataka Educators     │    │
│  │  cutting with       │    │  │ 142 members · 12 new    │    │
│  │  chapati — worked!" │    │  └─────────────────────────┘    │
│  │ ♥ 12  💬 3  [Connect]│   │                                  │
│  └────────────────────┘    │  Discover Groups                 │
│                            │  ┌─────────────────────────┐    │
│  ┌────────────────────┐    │  │ Hindi Literature Club   │    │
│  │ Chat: "5 msgs in   │    │  │ 56 members [Join]       │    │
│  │  Math Teachers"     │    │  └─────────────────────────┘    │
│  │ [Open Chat →]       │    │                                  │
│  └────────────────────┘    │  People You May Know             │
│                            │  ┌─────────────────────────┐    │
│  ┌────────────────────┐    │  │ Ravi · Math · Same Dist │    │
│  │ Shared: Quiz on    │    │  │ [Connect]               │    │
│  │  Photosynthesis     │    │  └─────────────────────────┘    │
│  │ by Anita            │    │                                  │
│  │ ♥ 8  [Save] [Use]  │    │  Staff Room (global chat)        │
│  └────────────────────┘    │  "Live · 4 online"               │
│                            │                                  │
│  [Load more...]            │                                  │
├────────────────────────────┴─────────────────────────────────┤
│  Mobile: FAB for ShareComposer (bottom-right)                 │
└──────────────────────────────────────────────────────────────┘
```

**Mobile**: Right sidebar collapses. Group chips become the primary navigation. Tapping a group chip filters the feed to that group. "All" shows the unified feed.

---

## Part 3: Implementation Phases

### Phase 1 — Data Layer (No UI changes yet)
1. Create `src/types/community.ts` with all new types
2. Create `src/app/actions/groups.ts` with all group server actions
3. Add `ensureUserGroupsAction` call to auth flow (post-login hook)
4. Extend `connections.ts` with `getContextualConnectionSuggestions`
5. Refactor `community-chat.tsx` to accept `collectionPath` prop

### Phase 2 — New Components (Can be built in parallel)
Build all 9 new components listed in 2.1 above. Each is self-contained with its own props interface. All components use existing UI primitives (Card, Avatar, Badge, Button from `components/ui/`).

### Phase 3 — Page Rewrite
1. Rewrite `community/page.tsx` with new unified layout
2. Wire ShareComposer → `createGroupPostAction`
3. Wire group chips → feed filtering
4. Integrate ContextualConnect into FeedPost and resource save flows
5. Add "Staff Room" global chat as a group (migrated from `community_chat`)
6. Keep TeacherDirectory accessible via "Find Teachers" link in sidebar

### Phase 4 — Verification
1. `npm run predeploy` (typecheck + build)
2. Manual smoke test of all flows
3. Ensure no regressions in existing connection/notification/chat functionality

---

## Part 4: Key Design Decisions

### What We're NOT Changing
- **Connection system**: request/accept/decline/disconnect stays identical. We're changing where/when suggestions appear, not the underlying protocol.
- **Notification system**: All existing notification types stay. We add group-related notifications later.
- **1:1 messaging** (`/messages`): Untouched. We make it more accessible from the community page.
- **Resource publishing** (`publishContentToLibraryAction`): Untouched. Resources can now be attached to group posts.
- **Voice recorder**: Reused as-is in group chats.

### What We're Removing
- **3-tab architecture** (Discover/Connect/Chat as separate tabs) → replaced by unified feed
- **Global community_chat as the only chat** → replaced by per-group chats + "Staff Room"
- **Static teacher directory as a tab** → moved to sidebar + contextual suggestions
- **Browse-first resource discovery** → replaced by social-proof-driven feed

### What We're Adding
- **Groups** (auto-created, auto-joined based on profile)
- **Structured sharing** (template-based composer)
- **Unified feed** (interleaved posts, resources, chat highlights, connection suggestions)
- **Per-group chat** (each group has its own real-time chat)
- **Contextual connection prompts** (appear after meaningful interactions)

### Migration Path
- Existing `community_chat` messages are preserved — the global chat becomes the "Staff Room" group
- Existing `library_resources` continue to work — they appear in the feed when shared/liked
- Existing `connection_requests` and `connections` are untouched
- No Firestore data migration needed — new collections are additive

---

## Part 5: File Manifest

> **STATUS [SHIPPED].** Every file in the manifest below exists EXCEPT
> `src/components/community/group-chat.tsx` (not built — see note in 2.1).

### New Files (13)
```
src/types/community.ts                           — Types & schemas
src/app/actions/groups.ts                         — Group server actions
src/components/community/feed-post.tsx            — Post card
src/components/community/share-composer.tsx        — Inline composer
src/components/community/group-card.tsx            — Group card
src/components/community/group-feed.tsx            — Group detail view
src/components/community/group-chat.tsx            — Per-group chat wrapper
src/components/community/group-list.tsx            — Horizontal group chips
src/components/community/contextual-connect.tsx    — Inline connect prompt
src/components/community/feed-skeleton.tsx         — Feed loading skeleton
src/components/community/chat-preview-banner.tsx   — Chat activity teaser
src/components/community/unified-feed.tsx          — Feed aggregation + rendering
src/components/community/groups-sidebar.tsx        — Desktop right sidebar
```

### Modified Files (4)
```
src/app/community/page.tsx                        — Complete rewrite
src/components/community/community-chat.tsx       — Add collectionPath prop
src/app/actions/connections.ts                    — Add contextual suggestions
src/types/index.ts                                — Re-export community types
```

### Preserved Files (3) — No changes
```
src/components/community/teacher-directory.tsx    — Kept, moved to sub-route
src/components/community/create-post-dialog.tsx   — Kept as fallback
src/app/actions/community.ts                      — All existing actions preserved
```
