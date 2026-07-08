# Server Actions: Community

**File:** `src/app/actions/community.ts`
**Verified:** 2026-06-10

All actions resolve the caller's uid from the middleware-injected `x-user-id` header. Never trust client-supplied identity. Most actions take no userId argument (or ignore a passed one).

---

## createPostAction(content, visibility = 'public', imageUrl?)

Creates a doc in the `posts` collection (NOTE: `posts`, not `community_posts`).

```
1. caller = x-user-id
2. Validate content length; rate limit check
3. Fetch author profile server-side (name/photo never trusted from client)
4. Write posts/{docId} with { content, visibility, imageUrl?, authorId, ..., createdAt }
5. revalidatePath('/community')
```

## getProfilesAction(uids)

Batch-fetch sanitized public profiles for a list of UIDs (used to hydrate post/teacher cards).

## getPosts(filters?)

Reads `posts` with optional `{ language, limit, gradeLevels, subjects }` filters.

## getFollowingPosts()

Posts authored by users the caller follows.

---

## toggleLikeAction(postId)

Toggle a like on a `community_posts` doc for the authenticated caller (atomic).

---

## followTeacherAction(followingId)

Toggle follow for the authenticated caller. Idempotent. Rejects self-follow.

```
followerId = x-user-id
docId = `${followerId}_${followingId}`   // DIRECTIONAL, not sorted
Writes to the `connections` collection: { followingId, ... }
On new follow → createNotification(FOLLOW, followingId)
Invalidates the caller's cached recommendations.
```

NOTE: follow docs are stored in the `connections` collection with a directional `${follower}_${following}` id and a `followingId` field. This is distinct from the mutual-connection docs created by `connections.ts` (which use a SORTED pairId and a `uids` array). Both share the collection name; they are differentiated by their fields.

---

## getFollowingIdsAction()

Returns `string[]` of UIDs the authenticated caller follows - queries `connections` for the caller's follow docs and maps `data().followingId`. No argument.

---

## getLibraryResources({ type?, language?, authorId?, limit? })

Fetches public resources for community page.

```
- If no filters: orderBy("stats.likes", "desc") - trending first
- If filters: in-memory sort (Firestore can't combine where + orderBy on different fields without composite index)
- Returns max 100 items
- Sanitized output (no internal fields)
```

---

## trackDownloadAction(resourceId)

Increments `stats.downloads` on `library_resources/{resourceId}`. Publishes analytics event.

---

## getRecommendedTeachersAction(userId)

Multi-tier scoring algorithm. Returns top 5 recommended teachers.

**Scoring:**
| Factor | Points |
|---|---|
| Same school | +30 |
| Each matching subject | +20 |
| Each matching grade level | +5 |
| High impact score | +15 |
| Random serendipity | +0–5 |

Returns teachers sorted by score, with `recommendationReason` field (e.g., "Same school", "Teaches Mathematics").

---

## getAllTeachersAction()

Returns all teachers (max 200), sorted by displayName. Used by TeacherDirectory and NewConversationPicker. Sanitized output (no sensitive fields).

---

## likeResourceAction(userId, resourceId)

Toggle like. Atomic Firestore transaction.

```
If liked → decrement stats.likes, remove from user's likes
If not liked → increment stats.likes, add to user's likes
Create LIKE notification for resource author (if not self-like)
aggregateUserMetrics(authorId) fire-and-forget
```

---

## saveResourceToLibraryAction(userId, resourceId)

Idempotent save. Copies resource to user's content.

```
1. Check if already saved (user's library subcollection)
2. If not: increment stats.saves on library_resource
3. Copy resource data to users/{userId}/content/{newId}
4. Create RESOURCE_SAVED notification for author
```

---

## publishContentToLibraryAction(userId, contentId)

Promotes user's private content to public community library.

```
1. Load content from users/{userId}/content/{contentId}
2. Create library_resources/{newId} doc with same data + authorId/authorName
3. Mark original content as isPublic=true
4. Publish analytics event
5. aggregateUserMetrics() fire-and-forget
6. revalidatePath('/community')
```

---

## sendChatMessageAction(text, audioUrl?)

Post to community chat. Rate-limited. Server-side author verification.

```
1. Auth check (x-user-id)
2. Validate: text ≤ 500 chars OR audioUrl present
3. checkServerRateLimit(authorId)
4. Fetch author profile server-side (NEVER trust client-supplied name/photo)
5. Write community_chat doc with serverTimestamp()
```
