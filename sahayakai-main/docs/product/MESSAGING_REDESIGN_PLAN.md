# SahayakAI Messaging Redesign — WhatsApp-Inspired Implementation Plan

## Current State

The messaging system uses Firestore `conversations` collection with `messages` subcollection, server actions for all writes, real-time `onSnapshot` listeners with `limitToLast(100)`, in-app Firestore notifications (no push), no offline support, no presence/typing, no delivery states, and a flat `community_chat` collection. The `idb` and `uuid` packages are already installed. A service worker (next-pwa/Workbox) exists but handles only caching.

---

## Phase 1: Offline-First Outbox + Presence & Typing (Week 1)

### 1A. Offline-First with IndexedDB Outbox

**Problem**: Messages are lost if the network drops. Teachers in India face intermittent connectivity daily.

**Solution**: Every outgoing message is written to IndexedDB *first*, displayed optimistically, then synced to Firestore with retry. A `clientMessageId` (UUIDv4) serves as the dedup key — if the server receives the same ID twice, it's a no-op.

**Schema changes**:
- IndexedDB: extend existing `src/lib/indexed-db.ts` with two new stores:
  - `message_outbox` — `{ clientMessageId, conversationId, text, type, resource?, audioUrl?, audioDuration?, status: 'queued'|'sending'|'sent'|'failed', retryCount, createdAt }`
  - `message_cache` — local mirror of recent messages per conversation for instant rendering
- Firestore `messages` subcollection: add optional `clientMessageId: string` field. Use it as the Firestore doc ID for idempotent writes.
- `Message` type: add `clientMessageId?: string` and `deliveryStatus?: 'sending'|'sent'|'delivered'|'read'|'failed'`

**Files to create**:
- `src/lib/message-outbox.ts` — OutboxManager class: `enqueue()`, `flush()`, `getQueued()`, `markSent()`, `markFailed()`, `removeExpired()` (24h TTL)
- `src/hooks/use-message-outbox.ts` — React hook wrapping OutboxManager; merges outbox items with Firestore snapshot for display
- `src/hooks/use-online-status.ts` — Tracks `navigator.onLine` + `online`/`offline` events; triggers outbox flush on reconnect

**Files to modify**:
- `src/lib/indexed-db.ts` — Add `message_outbox` and `message_cache` stores, bump DB version
- `src/app/actions/messages.ts` — `sendMessageAction` accepts `clientMessageId`, uses it as Firestore doc ID (set with `doc(ref, clientMessageId)` instead of `addDoc`). If doc exists, return success without writing (idempotent).
- `src/components/messages/conversation-thread.tsx` — Merge outbox queue with snapshot; show clock icon for queued, retry button for failed
- `src/components/messages/message-bubble.tsx` — Add delivery status icons: ⏳ queued, ✓ sent, ✓✓ delivered, ✓✓(blue) read, ⚠️ failed+retry
- `src/types/messages.ts` — Add `clientMessageId`, `deliveryStatus`, `mediaStatus` to Message interface

### 1B. Presence and Typing Indicators

**Problem**: No way to know if the other teacher is online or typing. Messaging feels dead.

**Solution**: Firebase Realtime Database (RTDB) for ephemeral signals — Firestore is too expensive for high-frequency writes like presence.

**RTDB paths**:
- `presence/{uid}` → `{ online: boolean, lastSeen: number }`
- `typing/{conversationId}/{uid}` → `true` (auto-cleared after 3s of inactivity)

**Files to create**:
- `src/lib/firebase-rtdb.ts` — Initialize RTDB (`getDatabase()` from `firebase/database`)
- `src/hooks/use-presence.ts` — On auth, set `online: true`; register `onDisconnect` → `{ online: false, lastSeen: serverTimestamp }`. Clean up on unmount.
- `src/hooks/use-typing-indicator.ts` — Debounced (500ms) write to `typing/{convId}/{uid}` on keystroke; auto-clear after 3s idle. Returns `isOtherTyping` boolean by subscribing to the path.
- `src/components/messages/typing-indicator.tsx` — Animated "typing..." bubble with three bouncing dots
- `src/components/messages/presence-dot.tsx` — Green (online) / grey (offline) dot, shows "last seen X ago" on hover/tap

**Files to modify**:
- `src/lib/firebase.ts` — Add RTDB export alongside existing Firestore/Auth/Storage
- `src/components/messages/conversation-thread.tsx` — Mount `useTypingIndicator`, show `TypingIndicator` above input
- `src/components/messages/conversation-list.tsx` — Show `PresenceDot` next to each conversation's avatar

---

## Phase 2: FCM Push Notifications + Delivery Acknowledgment (Week 2)

### 2A. FCM Push Notifications

**Problem**: Teachers only see messages when the app is open. No background/lock-screen notifications.

**Solution**: FCM Web Push via existing Firebase setup. Server sends push after each message write.

**Files to create**:
- `src/lib/fcm-client.ts` — `requestNotificationPermission()`, `saveFcmToken(uid, token)`, `onForegroundMessage()` handler
- `src/hooks/use-fcm-registration.ts` — On auth, request permission + register token. Refresh token on each app start.
- `src/components/notifications/push-permission-banner.tsx` — Dismissible banner: "Enable notifications to never miss a message"
- `public/firebase-messaging-sw.js` — FCM service worker for background messages. Uses `importScripts` for Firebase SDK. Handles `onBackgroundMessage` with notification display.
- `src/app/api/fcm/register/route.ts` — Saves FCM token to `users/{uid}/fcm_tokens/{tokenHash}`

**Files to modify**:
- `src/app/actions/messages.ts` — After writing message, fire-and-forget call to `admin.messaging().sendEachForMulticast()` targeting recipient's FCM tokens. Payload: `{ title: senderName, body: text.slice(0,100), data: { conversationId, type } }`
- `sahayakai-main/next.config.ts` — Exclude `firebase-messaging-sw.js` from next-pwa processing

**Firestore**:
- New subcollection `users/{uid}/fcm_tokens/{tokenId}` → `{ token, platform, createdAt, updatedAt }`

### 2B. Delivery Acknowledgment (3-State Ticks)

**Problem**: `readBy` array is binary — no distinction between "message reached their device" and "they opened and read it."

**Solution**: Three delivery states matching WhatsApp: sent → delivered → read.

**Firestore messages**: add `deliveredTo: string[]` alongside existing `readBy: string[]`.

**Files to create**:
- `src/hooks/use-delivery-ack.ts` — IntersectionObserver on message bubbles. When a message from another user enters viewport, batch-acknowledge delivery (debounce 2s, then `arrayUnion` to `deliveredTo`).
- `src/components/messages/delivery-status.tsx` — Icon component: single grey tick (sent), double grey tick (delivered to all), double blue tick (read by all).

**Files to modify**:
- `src/components/messages/message-bubble.tsx` — Replace existing read receipt with `DeliveryStatus` component
- `src/components/messages/conversation-thread.tsx` — Wrap message list with delivery observer
- `src/app/actions/messages.ts` — Add `acknowledgeDeliveryAction(conversationId, messageIds[])` batch action

---

## Phase 3: Pagination + Async Media (Week 3)

### 3A. Cursor-Based Pagination with Virtualized Scroll

**Problem**: `limitToLast(100)` is a hard ceiling. No way to view older messages. All 100 render at once.

**Solution**: Load 30 messages initially. On scroll-to-top, load 30 more using cursor. Virtualize the list for performance.

**Files to create**:
- `src/hooks/use-paginated-messages.ts` — Manages two data sources: (a) real-time listener on last 30 messages, (b) static pages loaded on demand via `endBefore(cursor)`. Merges into single sorted array. Exposes `loadMore()`, `hasMore`, `isLoadingMore`.
- `src/components/messages/virtualized-message-list.tsx` — Uses `@tanstack/react-virtual` for windowed rendering. Only renders visible messages + 10 buffer. Handles scroll position preservation when prepending.

**Files to modify**:
- `src/components/messages/conversation-thread.tsx` — Replace direct Firestore listener with `usePaginatedMessages`. Add IntersectionObserver sentinel at top for infinite scroll trigger.
- `src/components/community/community-chat.tsx` — Same pagination pattern for community messages.

**Dependencies**: `@tanstack/react-virtual` (~8KB gzipped)

### 3B. Async Media Upload with Waveform

**Problem**: Voice recorder blocks UI during upload. If upload fails, the message is lost.

**Solution**: Send message immediately with `mediaStatus: 'uploading'`. Upload proceeds in background. Update message when complete.

**Files to create**:
- `src/lib/media-upload-manager.ts` — Queue-based upload manager: `enqueue(blob, metadata)`, background upload with retry, progress callbacks, IndexedDB persistence for crash recovery.
- `src/components/messages/audio-waveform.tsx` — Canvas-based waveform from `AudioContext.decodeAudioData()`. Renders compact bar visualization.

**Files to modify**:
- `src/components/messages/voice-recorder.tsx` — Decouple record from upload. On stop: create local blob URL, call `onSend` immediately with `mediaStatus: 'uploading'`, queue upload in background. On upload complete, update message doc.
- `src/components/messages/message-bubble.tsx` — Show waveform + progress bar while `mediaStatus === 'uploading'`; play button when `'ready'`.
- `src/app/actions/messages.ts` — Add `updateMediaUrlAction(conversationId, messageId, audioUrl)` to finalize upload.

---

## Phase 4: Fan-Out Inbox (Week 4, only if >1K users)

**Problem**: Inbox query `where('participantIds', 'array-contains', uid)` scans all conversations globally.

**Solution**: Per-user inbox subcollection `users/{uid}/inbox/{conversationId}` with denormalized preview. Fan out on every message send.

**Files to create**:
- `src/lib/inbox-fanout.ts` — `fanOutToInbox(conversationId, participantIds, preview)` — batch writes to each user's inbox
- Migration script: `src/scripts/migrate-inbox.ts` — reads all conversations, fans out to each participant

**Files to modify**:
- `src/app/actions/messages.ts` — Dual-write: update conversation + fan out to inbox
- `src/components/messages/conversation-list.tsx` — Read from `users/{uid}/inbox` instead of global conversations

---

## Phase 5: Community Channels (Week 5)

**Problem**: Flat `community_chat` is a single noisy stream.

**Solution**: Topic-based channels (`#nep-updates`, `#class-10-maths`, `#doubt-clearing`) with emoji reactions.

**Firestore**:
- `channels/{channelId}` → `{ name, description, type, memberCount, icon }`
- `channels/{channelId}/messages/{msgId}` → current shape + `reactions: Record<string, string[]>`

**Files to create**:
- `src/types/channels.ts`, `src/app/actions/channels.ts`, `src/components/community/channel-list.tsx`, `src/components/community/channel-thread.tsx`

**Migration**: Copy `community_chat` → `channels/general/messages`, then deprecate.

---

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Duplicate messages on retry | Medium | High | `clientMessageId` as Firestore doc ID = idempotent |
| IndexedDB quota exceeded | Low | Medium | Text-only outbox is tiny; media capped at 5MB |
| FCM token stale/rotated | Medium | Low | Refresh on every app start; catch send errors |
| RTDB not enabled in Firebase | Certain | Blocking | Must enable in Firebase Console before Phase 1B |
| Scroll position jump on pagination | Medium | Medium | `overflow-anchor: auto` + manual scrollTop adjustment |
| Fan-out write amplification | Low (DMs=2) | Low | Only implement at >1K users; groups capped at 50 |
