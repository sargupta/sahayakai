# Community - /community

**File:** `src/app/community/page.tsx`
**Auth:** Partial (the page renders for everyone; data loads only when `onAuthStateChanged` resolves a signed-in user, and post/connect/join actions require auth)
**Snapshot:** 2026-06-10

---

## Purpose

Social hub for teachers, organized around subject/grade/area **groups**. Teachers see a unified feed of group posts and shared resources, browse and join groups, chat in an all-teacher Staff Room, and search a teacher directory to send connection requests.

---

## Render Model (view-state-machine, NOT tabs)

The page is no longer a 3-tab (Discover/Connect/Chat) layout. It is a single component that returns one of five views based on boolean/id state flags, checked in this order:

1. **Group Detail View** - when `activeGroup` is set → `<GroupFeed group={activeGroup} ... />` with a back button that clears `activeGroup`.
2. **Teacher Directory View** - when `showTeacherDirectory` → `<TeacherDirectory />` under a "Find Teachers" header + BackButton.
3. **Staff Room View** - when `showStaffRoom` → `<CommunityChat />` under a "Staff Room" header + BackButton.
4. **Explore Groups View** - when `showExploreGroups` → `<ExploreGroups groups={suggestedGroups} ... />` + BackButton.
5. **Main Feed View** - default fall-through (none of the above flags set).

---

## Component Tree (Main Feed View)

```
CommunityPage
├── Header card (Users icon + "Community" title + subtitle)
├── Primary action tiles (grid-cols-2)
│   ├── Staff Room tile (MessageCircle) → handleOpenStaffRoom
│   └── Find Teachers tile (UserSearch) → handleOpenTeacherDirectory
├── First-visit inline hint (showFirstVisitHint, dismissable X)
├── GroupList (mobile-only, lg:hidden) - my-group chips + Explore entry
├── Cold-start empty state (no groups AND no feed) → "Browse groups"
├── Main content row (flex)
│   ├── Feed column
│   │   ├── ShareComposer (inline post composer, optimistic prepend)
│   │   ├── UnifiedFeed (group posts + resource + teacher-suggestion items)
│   │   └── ResourceFeed ("Shared Resources")
│   └── GroupsSidebar (desktop only, hidden lg:block)
├── Mobile FAB (fixed left-4, sm:hidden) → setShowCreateDialog(true)
└── CreatePostDialog (controlled by showCreateDialog)
```

---

## State

| State | Type | Initial | Purpose |
|---|---|---|---|
| `myGroups` | `Group[]` | `[]` | Groups the user belongs to |
| `suggestedGroups` | `Group[]` | `[]` | Discoverable / joinable groups |
| `feedItems` | `FeedItem[]` | `[]` | Unified feed (group_post, resource, teacher suggestion) |
| `connectionData` | `MyConnectionData` | `{connectedUids,sentRequestUids,receivedRequests}` | Connection graph for the feed |
| `teacherSuggestions` | `TeacherSuggestion[]` | `[]` | Sidebar teacher recommendations |
| `selectedGroupId` | `string \| null` | `null` | Active group chip filter (mobile) |
| `activeGroup` | `Group \| null` | `null` | Drives Group Detail View |
| `showStaffRoom` | `boolean` | `false` | Drives Staff Room View |
| `showTeacherDirectory` | `boolean` | `false` | Drives Teacher Directory View |
| `showExploreGroups` | `boolean` | `false` | Drives Explore Groups View |
| `loading` | `boolean` | `true` | Initial data fetch |
| `likedPostIds` | `Set<string>` | `new Set()` | Posts liked by current user |
| `hasMore` / `loadingMore` | `boolean` | `false` | Feed pagination |
| `showFirstVisitHint` | `boolean` | `false` | Inline welcome hint |
| `showCreateDialog` | `boolean` | `false` | Mobile FAB create-post dialog |

A `refreshVersionRef` race guard discards stale refresh responses (replaces last-write-wins).

---

## Data Flow

On `onAuthStateChanged` (signed-in only):
1. `ensureUserGroupsAction()` - auto-joins default groups first so membership is settled.
2. Reads `users/{uid}.communityIntroState` (`ready`/`none` → show first-visit hint).
3. Loads `getMyGroupsAction()`, `getUnifiedFeedAction()`, `discoverGroupsAction()`, `getMyConnectionDataAction()`, `getRecommendedTeachersAction()`, and liked ids via `getLikedItemIdsAction()`.

Signed-out: `setLoading(false)` and the feed stays empty.

---

## Key Actions

- Groups: `ensureUserGroupsAction`, `getMyGroupsAction`, `getUnifiedFeedAction`, `discoverGroupsAction`, `joinGroupAction`, `likeGroupPostAction` (`src/app/actions/groups.ts`)
- Connections: `getMyConnectionDataAction`, `sendConnectionRequestAction` (`src/app/actions/connections.ts`)
- Community: `getRecommendedTeachersAction`, `likeResourceAction`, `getLikedItemIdsAction` (`src/app/actions/community.ts`)
- Profile: `updateProfileAction`

---

## Persona Pulse (demo loop)

`useCommunityLivePulse({ frequency: 'normal', enabled: true })` (`src/hooks/use-community-live-pulse.ts`) posts one AI-generated teacher message to the `community_chat` collection every 3-5 minutes while the page is open, so the Staff Room feels active during demos. It is a no-op in production: gated by `NEXT_PUBLIC_DEMO_PERSONAS_ENABLED` (disabled when set to `'false'`).

---

## Create Post

- Inline: `ShareComposer` in the feed column (optimistically prepends a `group_post` FeedItem, then `handleRefreshFeed`).
- Mobile: FAB (`fixed left-4 sm:hidden`, pinned left to avoid colliding with the right-side OmniOrb mic) → `CreatePostDialog`.

---

## Design

- Header + action tiles: `rounded-md`, `bg-card`, `border-border`, `shadow-soft`; tiles use `bg-primary/10 text-primary` icon chips.
- Feed/sidebar: two-column `flex` on desktop; sidebar `hidden lg:block`, group chips `lg:hidden` on mobile.
- FAB: `h-14 w-14 rounded-full bg-primary` with `safe-area-inset-bottom` offset.
- Icons: Lucide only (Users, MessageCircle, UserSearch, Plus, Info, X).
