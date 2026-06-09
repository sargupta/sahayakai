# Community Page — Phase 1-5 Reference

This document describes the contracts, conventions, and reusable utilities
introduced by the Phase 1-5 community improvement plan (April 2026). It is
the operating manual for anyone touching `/community`, the related server
actions, or any of the new helpers.

For the full plan that drove these phases, see
`/Users/sargupta/.claude/plans/prepare-a-detailed-improvement-happy-planet.md`.

---

## 1. Auth contract — every server action requires `requireAuth()`

All exported actions in `src/app/actions/community.ts`,
`src/app/actions/groups.ts`, `src/app/actions/connections.ts`, and
`src/app/actions/messages.ts` MUST begin with one of:

```ts
import { requireAuth, requireGroupMember } from '@/lib/auth-helpers';

// 1) Generic auth — most reads + all mutations
export async function someAction(...) {
  const uid = await requireAuth();
  // ...
}

// 2) Group-scoped auth — group reads + writes
export async function getGroupPostsAction(groupId: string, ...) {
  await requireGroupMember(groupId);
  // ...
}

// 3) Anonymous-friendly path (rare)
import { getAuthUserIdOrNull } from '@/lib/auth-helpers';
const uid = await getAuthUserIdOrNull();
// uid may be null; handle both cases
```

**Never** trust a client-supplied `userId` parameter. The Phase-1 sweep
removed five such parameters from `community.ts` mutations
(`createPostAction`, `toggleLikeAction`, `followTeacherAction`,
`likeResourceAction`, `saveResourceToLibraryAction`,
`publishContentToLibraryAction`). For one release, the unused positional
parameter is preserved at the type level so existing call sites compile;
delete it on the next pass.

`firestore.rules` is the second line of defence: `groups/*`, `posts/*`,
`library_resources/*` all have explicit member-only or signed-in-only
rules. Writes are server-only via the Admin SDK. See `firestore.rules`
lines 130-205 for the full ruleset.

---

## 2. Optimistic updates — use `useOptimisticToggle`

Pattern in `src/hooks/use-optimistic-toggle.ts`:

```ts
const { toggledIds, toggle } = useOptimisticToggle({
  items: feedItems,
  setItems: setFeedItems,
  getId: (item) => item.id,
  getCount: (item) => item.likesCount,
  setCount: (item, count) => ({ ...item, likesCount: count }),
  action: (id) => likeGroupPostAction(groupId, id),
  onError: () => toast({ title: 'Could not update', variant: 'destructive' }),
  initial: hydratedLikedIds,
});
```

The hook updates **both** the Set membership and the numeric count in a
single render, then reconciles with the server's authoritative count.
On error, it rolls back **both halves**. Hand-written versions kept
missing one — page.tsx, group-feed.tsx, and resource-feed.tsx all had
their own incorrect copies before Phase 2.

For server actions that return `{ isLiked, newCount }`, adapt to the
hook's expected shape `{ isToggled, newCount }`.

---

## 3. Server-side cache — `cachedPerUser`

Wrap expensive per-user actions with `cachedPerUser` from
`src/lib/server-cache.ts`:

```ts
const _expensiveFor = cachedPerUser(
  async (uid: string): Promise<MyResult> => {
    // ... real work ...
  },
  { key: 'recs', ttlSeconds: 300 },
);

export async function publicAction() {
  const uid = await requireAuth();
  return _expensiveFor(uid); // cached for 300s, tag `recs:${uid}`
}
```

To invalidate after a relevant mutation:

```ts
import { invalidateUserCache } from '@/lib/server-cache';

export async function followTeacherAction(targetId: string) {
  const followerId = await requireAuth();
  invalidateUserCache('recs', followerId); // recs depend on following list
  // ...
}
```

The `requireAuth()` call **must stay outside** the cached body. Next's
`unstable_cache` callback runs in a context where `headers()` is not
available — pass uid in explicitly.

**Live cache wrappers (Apr 2026):**
| Action | Key | TTL |
|---|---|---|
| `getRecommendedTeachersAction` | `recs` | 300s |
| `getAllTeachersAction` | `all-teachers` | 60s |

The recommendation pass dropped `Math.random()` serendipity when caching
was added — a random factor inside a cache produces the same "random"
choice for every cache hit. Sample post-cache if you want serendipity
back.

---

## 4. Pagination — cursor on `getUnifiedFeedAction`

```ts
// First page:
const items = await getUnifiedFeedAction(20);
const nextCursor = items[items.length - 1]?.timestamp;

// Next page:
const more = await getUnifiedFeedAction(20, nextCursor);
```

The cursor is the timestamp of the last item the client has. Items with
`createdAt < cursor` are returned. Stable as long as `createdAt` values
are unique enough — duplicate timestamps will re-appear, but practical
collision rate is low.

---

## 5. Liked-state hydration

`getLikedItemIdsAction()` returns
`{ groupPostIds: string[], resourceIds: string[] }` for the calling user.
Used by `src/app/community/page.tsx` to hydrate the `likedPostIds` Set on
mount so previously-liked items render with filled hearts.

The query is a single `collectionGroup('likes').where('uid', '==', uid)`.
Both `likeGroupPostAction` and (post-Phase-3) `likeResourceAction` write
a `uid` field on every new like doc. Pre-Phase-3 likes lack this field
— users with old likes will see un-filled hearts on those items until
they re-like (one-time cosmetic regression, no data loss).

Result is capped at 500 docs per call.

---

## 6. Race-resistant feed refresh

`src/app/community/page.tsx` uses a `refreshVersionRef` ref to discard
stale responses:

```ts
const refreshVersionRef = useRef(0);

const handleRefreshFeed = useCallback(async () => {
  const myVersion = ++refreshVersionRef.current;
  try {
    const feed = await getUnifiedFeedAction();
    if (myVersion === refreshVersionRef.current) {
      setFeedItems(feed);
    }
  } catch { /* silent */ }
}, []);
```

Server actions don't accept an `AbortSignal`, so true cancellation isn't
possible — but the version guard ensures a slow response can't clobber
newer data. Use the same pattern in any client component that fires
overlapping fetches (focus, visibility, interval, manual refresh).

For client components doing direct Firestore reads, prefer a
`cancelled = false` flag in the effect:

```ts
useEffect(() => {
  let cancelled = false;
  load().then((data) => { if (!cancelled) setData(data); });
  return () => { cancelled = true; };
}, [...]);
```

`teacher-directory.tsx` uses a `loadTokenRef` (numeric) for the same
purpose since `loadData` runs from a callback (not the effect itself).

---

## 7. New UX hooks

| Hook | Purpose | File |
|---|---|---|
| `useNearBottom(ref, threshold = 100)` | Returns `true` when scroll is within `threshold` px of the bottom edge. Used to gate auto-scroll in chat surfaces. | `src/hooks/use-near-bottom.ts` |
| `useClickOutside(ref, onClose, enabled)` | Calls `onClose` on mousedown outside the ref or Escape. | `src/hooks/use-click-outside.ts` |

Both are used by community surfaces but should be reused project-wide.

---

## 8. Test patterns

- **Server actions**: in-memory Firestore mock, mock `next/headers` to
  inject `x-user-id`. See `src/__tests__/actions/groups.test.ts` for the
  reference setup.
- **Auth gate regression**: `src/__tests__/actions/community-auth.test.ts`
  is a table test — every exported action is asserted to reject calls
  with no `x-user-id` header. **Add new exports to this list when you
  add new actions.**
- **Component tests**: render, fire events, assert. Mock `useToast` when
  asserting on toast side effects. Mock `useLanguage` when testing
  translation paths. `next/navigation`'s `useRouter` is mocked via the
  jest setup.
- **Hooks**: `renderHook` with a wrapper component that provides any
  React state the hook reads. See `use-optimistic-toggle.test.tsx`.

---

## 9. Phase-by-phase commit reference

| Phase | Commit (squash hash on develop) | Key files |
|---|---|---|
| 1 — Security | `262b9c876` | `src/lib/auth-helpers.ts`, `firestore.rules`, every server action |
| 2 — State integrity | `765647486` | `src/hooks/use-optimistic-toggle.ts`, `groups.ts` error paths |
| 3 — Data layer | `cb1d7e749` | `src/lib/server-cache.ts`, `getLikedItemIdsAction`, page.tsx pagination |
| 4 — UX wins | `8c2d426ca` | `src/hooks/use-near-bottom.ts`, `src/hooks/use-click-outside.ts`, FAB rewire |
| 5 — Tests + docs | (this commit) | This file + 6 new component test suites |

If you're touching the community page, read the commit message of the
phase that owns the surface you're changing — each one documents the
specific bug class it closes and the rationale.
