# SahayakAI - Firestore Security Rules

> Refreshed 2026-06-10 against `firestore.rules` (rules_version '2').

## Helper Functions

```
isSignedIn()        -> request.auth != null
isOwner(userId)     -> request.auth.uid == userId
isOrgAdmin(orgId)   -> isSignedIn() && get(organizations/{orgId}/members/{uid}).data.role == 'admin'
isGroupMember(grp)  -> isSignedIn() && exists(groups/{grp}/members/{uid})
```

---

## Rules by Collection

### `feedbacks/{document}`
- **Create:** signed-in users only (`isSignedIn()`). (Note: NOT open/anonymous.)
- Read/update/delete: denied.

### `users/{userId}`
- **Read / Update / Create:** owner only (`isOwner(userId)`).
- Delete: denied.

### `content/{documentId}` (top-level)
- **Read / Update / Delete:** `request.auth.uid == resource.data.userId`.
- **Create:** `request.auth.uid == request.resource.data.userId`.

### `community/{communityContentId}`
- **Read:** public (`if true`).
- **Write:** denied (server/Admin SDK only).

### `notifications/{notifId}`
- **Read:** recipient only (`resource.data.recipientId == auth.uid`).
- **Create / Update / Delete:** denied (Admin SDK via server actions only).

### `conversations/{convId}`
- **Read / Update:** participants (`auth.uid in resource.data.participantIds`).
- **Create:** `auth.uid in request.resource.data.participantIds`.
- Delete: denied.

#### `conversations/{convId}/messages/{msgId}`
- **Read:** participants (via `get()` on parent conversation).
- **Create:** participants AND `senderId == auth.uid` AND `text.size() <= 1000`.
- **Update:** participants (no field restriction in the current rule - any participant may update; note the prior doc's "readBy-only" claim is NOT enforced at the rules layer).
- **Delete:** denied.

### `community_chat/{messageId}`
- **Read:** signed-in.
- **Create:** signed-in AND `authorId == auth.uid` AND (`text.size() <= 500` OR `audioUrl is string`).
- **Update / Delete:** denied.

### `connection_requests/{reqId}`
- **Create:** signed-in, `fromUid == auth.uid`, `fromUid != toUid`.
- **Read / Delete:** sender (`fromUid`) or recipient (`toUid`).
- **Update:** denied (immutable).

### `connections/{connId}`
- **Read:** any signed-in user (teacher-directory state checks).
- **Create:** denied (Admin SDK only - `acceptConnectionRequestAction`).
- **Delete:** participant only (`auth.uid in resource.data.uids`).
- **Update:** denied.

---

## Community: Groups, Posts, Library

All writes flow through server actions (Admin SDK, bypassing rules); client reads are gated.

### `groups/{groupId}`
- **Read:** signed-in (Discover Groups). **Write:** denied.
- `groups/{groupId}/posts/{postId}` - read: `isGroupMember`; write: denied.
  - `.../likes/{likerId}` - read/write: `isOwner(likerId) && isGroupMember`.
- `groups/{groupId}/members/{memberId}` - read: `isGroupMember`; write: denied.
- `groups/{groupId}/chat/{messageId}` - read: `isGroupMember`; create: `isGroupMember` AND `authorId == auth.uid` AND (`text.size() <= 500` OR `audioUrl is string`); update/delete: denied.

### `posts/{postId}` (top-level public feed)
- **Read:** signed-in. **Write:** denied (`createPostAction`, Admin SDK).
- `.../likes/{likerId}` - read/write: `isOwner(likerId)`.

### `library_resources/{resourceId}`
- **Read:** signed-in. **Write:** denied (`publishContentToLibraryAction` / jobs).
- `.../likes/{likerId}`, `.../saves/{saverId}` - owner-only.

---

## Billing & Organization

### `credit_ledger/{userId}`
- **Read:** owner. **Write:** denied (Admin SDK billing logic).

### `organizations/{orgId}`
- **Read:** org admins only (`isOrgAdmin`). **Write:** denied.
- `organizations/{orgId}/members/{memberId}` - read: `isOwner(memberId) || isOrgAdmin`; write: denied.

### `webhook_events/{eventId}`
- Read/write: denied (Razorpay idempotency, backend-only).

### `config/plans`
- **Read:** signed-in. **Write:** denied.

### `usageCounters/{userId}`
- **Read:** owner. **Write:** denied.

### `subscriptions/{subId}`
- **Read:** `resource.data.userId == auth.uid`. **Write:** denied.

### `system_config/{docId}`
- **Read:** signed-in AND `docId.matches('^public_.*')` - operator state (rollout flags, kill-switch, sidecar modes), including `feature_flags`, is Admin-SDK-only (Round-2 audit P0 SYSCONF-1: prevents leaking rollout strategy / model toggles to clients).
- **Write:** denied.

---

## Sahayakai-Agents Parent-Call Sidecar (Admin-SDK-only)

Every sidecar collection is fully denied to clients (a leaked `callSid` would otherwise let an attacker harvest transcripts; Round-2 audit P0 RULES-1):

- `agent_sessions/{callSid}` + `.../turns/{turnId}` - read/write denied. TTL via `expireAt` (24h after call).
- `agent_shadow_diffs/{dateDoc}` + `.../shadow_calls/{callId}` - read/write denied. Subcollection renamed `calls` -> `shadow_calls` (P0 TTL-2: collection-group TTL scoping). TTL 14d.
- `agent_voice_sessions/{callSid}` - read/write denied (Phase 2 placeholder).
- `agent_auto_abort_seen/{incidentId}` - read/write denied. TTL via `expireAt` (24h).

---

## Critical Design Notes

1. **Admin SDK bypasses all rules.** Server actions using `firebase-admin` always get through; rules only constrain client SDK calls.
2. **`connections` create is denied** - `acceptConnectionRequestAction` writes via Admin SDK so the accept flow is fully server-controlled.
3. **Community chat / group chat audio carve-out** - `text.size() <= 500 OR audioUrl is string` allows voice-only messages with empty text.
4. **`feedbacks` create requires sign-in** (current rule), not anonymous.
5. **Default deny** - any unmatched path is denied (explicit comment in the rules file documents the intent).

---

## Storage Rules (`storage.rules`, `service firebase.storage`)

- `voice-messages/{uid}/{file}` - owner-write, signed-in read, `<5 MB`, `audio/.*`; owner delete.
- `users/{uid}/uploads/{file=**}` - owner-write, signed-in read, `<10 MB`; owner delete.
- `profile-photos/{uid}/{file=**}` - owner-write, signed-in read, `<5 MB`, `image/.*`; owner delete.
- `uploads/{uid}/{file=**}` - legacy owner-write fallback.
