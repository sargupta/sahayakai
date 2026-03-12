# Server Actions: Community

**File:** `src/app/actions/community.ts`

All actions read `x-user-id` from request headers (injected by middleware). Never trust client-supplied identity.

---

## createPostAction(content, imageUrl?)

Creates a post in `community` collection.

```
1. Auth check (x-user-id)
2. Validate: content min 5 chars, max 500
3. Rate limit check
4. Write to community/{docId}: { content, imageUrl, authorId, authorName, authorPhotoURL, createdAt }
5. Publish analytics event
6. aggregateUserMetrics() fire-and-forget
7. revalidatePath('/community')
```

---

## followTeacherAction(followerId, followedId)

Toggle follow. Idempotent.

```
If already following → delete follows/{followerId_followedId} doc
If not following → create doc + createNotification(FOLLOW, followedId)
```

---

## getFollowingIdsAction(userId)

Returns `string[]` of UIDs that `userId` follows. Simple Firestore query on `follows` collection.

---

## getLibraryResources({ type?, language?, authorId?, limit? })

Fetches public resources for community page.

```
- If no filters: orderBy("stats.likes", "desc") — trending first
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
