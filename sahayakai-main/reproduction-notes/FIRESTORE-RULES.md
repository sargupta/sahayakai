# SahayakAI — Firestore Security Rules

## Helper Functions

```
isSignedIn() → request.auth != null
```

---

## Rules by Collection

### `feedbacks/{doc}`
- **Create:** Open (anyone, including unauthenticated)
- **Read/Update/Delete:** Blocked
- Rationale: Anonymous feedback allowed for low-friction reporting

### `users/{userId}`
- **Create:** Signed-in user can only create their own document
- **Read:** Owner only
- **Update:** Owner only
- **Delete:** Blocked
- Rationale: Profiles are private; no cross-user reads (profile data is denormalized where needed)

### `content/{docId}`
- **All operations:** Owner only (`resource.data.userId == request.auth.uid` on create)
- Rationale: Personal content vault

### `community/{docId}`
- **Create:** Blocked (server-side only via Admin SDK)
- **Read:** Public (anyone signed in)
- **Update/Delete:** Blocked
- Rationale: Community posts curated server-side

### `conversations/{convId}`
- **Create/Read/Update:** Participants only (`request.auth.uid in resource.data.participantIds`)
- **Delete:** Blocked
- Rationale: DMs and groups are private to their members

### `conversations/{convId}/messages/{msgId}`
- **Create:** Participants only
- **Read:** Participants only
- **Update:** Participants only BUT restricted to `readBy` field only (prevents message editing)
- **Delete:** Blocked (message history preserved)

### `community_chat/{msgId}`
- **Create:** Signed-in users; `authorId == request.auth.uid`; text ≤ 500 chars OR audioUrl is a string
- **Read:** Signed-in users
- **Update/Delete:** Blocked
- Rationale: Community chat is append-only; audio messages allowed without text

### `connection_requests/{reqId}`
- **Create:** Signed-in, `fromUid == request.auth.uid`, `fromUid != toUid` (no self-connect)
- **Read:** Either the sender (`fromUid`) or recipient (`toUid`)
- **Update:** Blocked (immutable once created)
- **Delete:** Either party (withdraw or decline)

### `connections/{connId}`
- **Create:** Blocked — only Admin SDK can create connections (server action `acceptConnectionRequestAction`)
- **Read:** Any signed-in user (needed for teacher directory connection state checks)
- **Update:** Blocked
- **Delete:** Either participant (`request.auth.uid in resource.data.uids`)

---

## Critical Design Notes

1. **Admin SDK bypasses all rules.** Server actions that use `firebase-admin` always get through regardless of what rules say. Rules only apply to client SDK calls.

2. **`connections` create is blocked** — this is intentional. The `acceptConnectionRequestAction` server action uses Admin SDK to write the connection document, ensuring the accept flow is fully server-controlled.

3. **Community chat audio** — the create rule has a special carve-out: `text.size() <= 500 OR audioUrl is string`. This allows voice-only messages with empty text field.

4. **Message `readBy` update** — only the `readBy` field is updatable on messages. This prevents any other message content modification by participants.

5. **User profiles are private by default** — profile data is accessed via server actions (Admin SDK) when needed for community features, not by direct client reads.

---

## Storage Rules (storage.rules)

Voice messages path: `voice-messages/{userId}/{filename}`
- **Read/Write:** Authenticated users can read/write their own files
- Pattern: `request.auth.uid == userId`
