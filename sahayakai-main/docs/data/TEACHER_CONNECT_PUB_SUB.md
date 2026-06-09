# TeacherConnect: Pub/Sub & Feed Architecture

**Last updated:** 2026-06-10
**Status:** ASPIRATIONAL / partially implemented. This document describes a planned event-driven design. The sections below are largely NOT yet built; see the reality check.

## Reality check (verified 2026-06-10)

What actually exists in code (`src/lib/pubsub.ts`, `src/app/api/jobs/**`):
- The only live Pub/Sub topic is **`sahayakai-storage-cleanup`** (`TOPICS.STORAGE_CLEANUP`), used to clean up orphaned Cloud Storage objects after content deletion. Consumed by `/api/jobs/storage-cleanup` (OIDC-verified push).
- There is **no** `teacher-connect-events` topic, no Pub/Sub-driven feed fan-out, and no Pub/Sub-driven FCM fan-out in code today.
- **Feed**: assembled at read time, not via a precomputed `activity_feed` (`src/components/community/unified-feed.tsx`, `src/lib/aggregator.ts`).
- **Notifications**: written directly to the `notifications` Firestore collection by server actions (`src/app/actions/notifications.ts`); FCM push is sent directly via `src/lib/fcm-server.ts`, not through Pub/Sub.
- **Search**: no Algolia / search-extension indexer is wired; discovery is Firestore queries + client-side filtering.

Everything below is the original design intent, retained for reference.

---

## 1. Event Flow: Post Creation

When a teacher submits a new post:
1.  **Client Application**: Calls a Server Action `createPost`.
2.  **Firestore**: Writes the initial post document to the `posts` collection.
3.  **Pub/Sub Producer**: The `createPost` action publishes a message to the `teacher-connect-events` topic.
    *   **Payload**: `{ "type": "NEW_POST", "postId": "...", "authorId": "...", "timestamp": "..." }`

## 2. Event Processing (Consumers)

The following subscribers handle the background logic:

### A. Feed Generator (Subscriber)
- **Action**: Fan-out strategy. 
- **Mechanism**:
  - Fetch list of followers for `authorId`.
  - For each follower, update a cached `activity_feed` (either in Firestore or Redis) to include the new `postId`.
  - *Optimization*: For "celebrity" teachers (large followings), we use a "Pull on Read" model instead of "Push on Write".

### B. Notification Engine (Subscriber)
- **Action**: Real-time push notifications.
- **Mechanism**:
  - Filter followers who have opted-in to mobile notifications.
  - Trigger **Firebase Cloud Messaging (FCM)** to send a ping: *"Mr. Sharma shared a new lesson plan on Biology!"*.

### C. Search Indexer (Subscriber)
- **Action**: Updates a search index (e.g., Algolia or Firestore Search Extension).
- **Mechanism**: Extracts tags and keywords from the post for global discovery.

---

## 3. Real-time Interactions (Likes & Comments)

- **Likes**: Handled via Firestore `onSnapshot` for immediate UI feedback.
- **Comments**: 
  - Immediate write to sub-collection.
  - Pub/Sub message triggered to notify the post author: `USER_COMMENTED`.

---

## 4. Why Pub/Sub?
- **User Latency**: The teacher doesn't have to wait for 1,000 followers' feeds to update before their screen refreshes. They get success as soon as the post is in Firestore and the message is published.
- **Retry Logic**: If a notification fails to send, Pub/Sub automatically retries, ensuring no alerts are lost.
- **Decoupling**: We can add a "Bad Word Filter" or "AI Content Review" later just by adding a new subscriber, without changing the core posting code.
