# F2 — Authorization + IDOR Forensic Report

**Date:** 2026-06-06
**Investigator:** Role 2 (Cross-tenant Firestore reads, writes, Storage IDOR, server-action allowlist, Org+Group RBAC)
**Scope:** 14 server-action files in `src/app/actions/*.ts`, 80 API route handlers in `src/app/api/**/route.ts`, `storage.rules`
**Method:** Static analysis of every authenticated action/route; ownership-invariant recomputation for each Firestore read/write that takes a caller-supplied ID; comparison of write payloads against documented allowlists; cross-check of `storage.rules` against client upload paths.

---

## Executive summary

**Posture overall: strong.** The Wave 1/2b/3 hardening referenced in code comments is real and pervasive. Almost every action derives uid from `requireAuth()` (header `x-user-id`), validates caller-supplied uids against the session, and explicitly comments the IDOR class it patched. The profile-write surface uses an enforced `PROFILE_WRITABLE_FIELDS` allowlist with a defense-in-depth `filterUserUpdate()` at the `dbAdapter.updateUser` layer; both lists exclude `adminRoles`, `plan*`, `razorpaySubscriptionId`, `fcmTokens`, `email`, `impactScore`, `badges`, etc. Storage rules at `storage.rules` correctly own-write-gate `voice-messages/{uid}`, `users/{uid}/uploads`, `profile-photos/{uid}`, and the legacy `uploads/{uid}` path; default-deny covers everything else; auth-read is intentional (recipients need playback).

**However, three findings need fixes.** One is a PII cross-tenant read that bypasses the careful `getPublicProfileAction` allowlist. Two are cross-tenant writes on conversation subdocs by callers who are not participants. Severity P0 / P1 / P2 respectively.

---

## Findings

### F2-01 — `getProfilesAction` returns FULL user profiles to any signed-in caller — P0

**File:** `src/app/actions/community.ts:14-17`

```ts
export async function getProfilesAction(uids: string[]) {
    await requireAuth();
    return await dbAdapter.getUsers(uids);
}
```

`dbAdapter.getUsers()` (`src/lib/db/adapter.ts:120-127`) does a raw `where('uid','in', uids)` and spreads the entire Firestore doc:

```ts
return snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile));
```

**Impact (cross-tenant PII read):** any signed-in user can fetch a batch (up to 10 per call, unbounded across calls) of arbitrary teacher UIDs and receive their **full Firestore user docs**, including:

- `phoneNumber` (PII — DPDP-regulated in India)
- `fcmTokens` (sending these to a recipient lets the attacker spoof FCM target devices in unrelated leaks; combined with a Firebase server key compromise, allows targeted push to any user)
- `adminRoles` / `administrativeRole` (reveals who is principal/vice_principal — useful as a phishing target list)
- `planType`, `razorpaySubscriptionId`, `razorpayPlanId`, `monthlyCredits`, `creditsUsed`, `planExpiresAt`, `adminOverride` (billing state)
- `email` (already returned by the sanitised `getPublicProfileAction` but worth noting)
- `onboardingChecklistItems`, `aiGenerationCount`, all server-computed counters
- everything else the `users/{uid}` doc carries

Compare to `getPublicProfileAction` (`src/app/actions/profile.ts:53-96`) on the same code path — that one has an explicit field whitelist with the comment *"Strip private fields that other teachers shouldn't see."* `getProfilesAction` is the same surface (callable from any signed-in browser via the Server Action wire protocol) and ignores the whitelist entirely.

The action is currently unused inside `.tsx` callers (only the auth test calls it), but as a `'use server'` export it remains a public RPC endpoint reachable via `POST /_next/...` Next-Action header from any signed-in browser tab.

**Fix:** apply the same allowlist used in `getPublicProfileAction`, or — preferred — delete the action and force callers to use `getPublicProfileAction` for the public-safe shape. If `getProfilesAction` is needed for batched profile-card rendering, replace the body with a per-uid map through the sanitiser.

**Repro:** `qa/forensics/repros/F2-01.mjs`

---

### F2-02 — `markConversationReadAction` writes `readBy` to messages in conversations the caller is not a participant in — P1

**File:** `src/app/actions/messages.ts:306-389`

```ts
export async function markConversationReadAction(conversationId: string, userId: string): Promise<void> {
    const callerId = await getAuthUserId();
    if (callerId !== userId) throw new Error('Unauthorized');
    // ...
    const convRef = db.collection('conversations').doc(conversationId);
    await convRef.update({ [`unreadCount.${userId}`]: 0 });           // (1) field-write on foreign doc
    const recentSnap = await convRef.collection('messages').orderBy('createdAt','desc').limit(50).get();  // (2) read
    if (!recentSnap.empty) {
        const batch = db.batch();
        recentSnap.docs.forEach((doc) => {
            batch.update(doc.ref, { readBy: FieldValue.arrayUnion(userId) });   // (3) write to foreign messages
        });
        await batch.commit();
    }
    // ...
}
```

The auth check guarantees `callerId === userId`, but there is **no check that `callerId` is a participant in `conversationId`**. Contrast with `sendMessageAction` 200 lines above, which explicitly enforces `if (!convData.participantIds.includes(senderId)) throw new Error('Not a participant');`.

**Impact (cross-tenant write):**

1. Attacker writes `unreadCount.<theirUid> = 0` onto a foreign conversation doc — pollution, low-risk because the recipient UI ignores foreign uids.
2. Attacker reads the **content** of the 50 most recent messages of any conversation whose ID they can guess. Conversation IDs for direct messages are `buildDirectConversationId(uidA, uidB)` (sorted join with a delimiter) — a *deterministic* function of the two participant uids. Given that **`getProfilesAction` and `getAllTeachersAction` leak the entire UID space**, an attacker can construct every (uid_self, uid_target) pairing… but `.get()` here is server-side, the data does not return to the caller, so this is a server-side read not an exfil — unless logged. Mark as latent.
3. Attacker writes `readBy: arrayUnion(<attackerUid>)` onto every recent message in any conversation. This **corrupts the read-receipt audit trail** — a target sees "Read by <attacker_name>" on their private DM with their spouse / lawyer / principal. Also breaks any future "delivered to exactly N participants" invariant.
4. Attacker can update the per-message-notification scan (lines 354-389) to clear THEIR OWN message-notification inbox even though the conversation isn't theirs — minor.

**Fix:** add the same participant check `sendMessageAction` uses:

```ts
const convDoc = await convRef.get();
if (!convDoc.exists) throw new Error('Conversation not found');
if (!convDoc.data()!.participantIds.includes(callerId)) throw new Error('Not a participant');
```

before the first `convRef.update` and the messages-subcollection batch.

**Repro:** `qa/forensics/repros/F2-02.sh`

---

### F2-03 — `acknowledgeDeliveryAction` writes `deliveredTo` to any conversation's messages without a participant check — P2

**File:** `src/app/actions/messages.ts:420-439`

```ts
export async function acknowledgeDeliveryAction(conversationId: string, messageIds: string[]): Promise<void> {
    const userId = await getAuthUserId();
    const db = await getDb();
    const { FieldValue } = await import('firebase-admin/firestore');
    const convRef = db.collection('conversations').doc(conversationId);
    const batch = db.batch();
    for (const msgId of messageIds.slice(0, 50)) {
        const msgRef = convRef.collection('messages').doc(msgId);
        batch.update(msgRef, { deliveredTo: FieldValue.arrayUnion(userId) });
    }
    await batch.commit();
}
```

No participant check, no `convRef.get()`. An attacker who learns or guesses a `(conversationId, messageId)` pair can stamp themselves as "delivered" on a message they never received. Same audit-trail-pollution class as F2-02 but lower impact because `deliveredTo` is less user-visible than `readBy`.

**Fix:** same as F2-02 — read the conversation doc, check `participantIds.includes(userId)` before the batch.

**Repro:** `qa/forensics/repros/F2-03.sh`

---

### Negative findings (verified safe)

The following were probed and found to enforce ownership correctly. Listed so the next investigator can de-duplicate effort:

- `profile.ts` — `getProfileData`, `getPublicProfileAction` (allowlisted), `addCertificationAction`, `updateProfileAction` (PROFILE_WRITABLE_FIELDS + `dbAdapter.updateUser` second filter), `markChecklistItemAction`, `getDailyCostsAction` (admin gate)
- `attendance.ts` — every action checks `classes/{classId}.teacherUid === uid` before touching the class, its students subcollection, or its attendance records. `parent_outreach` queries filter by `teacherUid == uid`. `requireProPlan` enforced on write paths.
- `connections.ts` — uid sourced from session; pairId always built from `(callerId, otherUid)` so a caller cannot operate on a connection they're not in. `acceptConnectionRequestAction` explicitly verifies `req.toUid === callerId`.
- `community.ts` (other actions) — `createPostAction`, `toggleLikeAction`, `followTeacherAction`, `likeResourceAction`, `saveResourceToLibraryAction`, `publishContentToLibraryAction`, `getRecommendedTeachersAction`, `getAllTeachersAction`, `sendChatMessageAction`, `getLikedItemIdsAction` — all derive uid from session and (where the data crosses tenant boundaries) sanitise via `cachedPerUser` + `TeacherSuggestion` projection.
- `groups.ts` — every mutating action does `groups/{groupId}/members/{uid}.exists` check; `getGroupPostsAction` uses `requireGroupMember`. `getGroupAction` returns full group meta to any signed-in caller — intentional (group discovery surface).
- `messages.ts` — `sendMessageAction` and `getOrCreateDirectConversationAction` enforce participant membership; `createGroupConversationAction` checks creator==caller. `getTotalUnreadCountAction` is bounded.
- `notifications.ts` — `markNotificationAsReadAction` verifies `data.recipientId === userId`; `markAllAsReadAction` derives uid from session.
- `content.ts` — all five actions derive uid from session and scope `dbAdapter` calls by it.
- `storage.rules` — voice-messages, user-uploads, profile-photos, legacy uploads all gated on `request.auth.uid == userId` + size cap + content-type whitelist. Default deny on `/{allPaths=**}`. Authenticated-read is intentional and documented.
- API routes: `analytics/teacher-health/[userId]` (self-or-admin gate), `performance/student/[studentId]` (verifyClassOwnership), `organizations/[orgId]/analytics` (admin or principal-of-this-org), `assessment-scanner/[id]` PATCH (dbAdapter.getContent scoped by userId), `content/save`, `content/delete`, `content/get`, `content/list`, `content/download` (all derive uid from header and scope adapter calls).

---

## Test users (not provisioned)

Per the hard rule "read-only probes on prod (use preview for writes); preview-only test users", the runtime exploitation step (Admin SDK custom-token mint for 5 distinct UIDs and live POST to the preview deployment) was **not** executed in this static pass. The static evidence is sufficient to confirm the three findings:

- F2-01: trivially reproducible by mocking the auth header and calling the action — the code path is unconditional.
- F2-02 / F2-03: same — the participant check is absent from the function body, and the symmetric `sendMessageAction` participant check confirms this is an oversight, not a deliberate design.

Hand-off to F-runtime to flip the repros against the preview deployment once preview test UIDs are seeded.

---

## Fix dispatch

| Finding | Sev | Owner | Fix |
|---|---|---|---|
| F2-01 | P0 | community.ts | Sanitise `getProfilesAction` to use the `getPublicProfileAction` allowlist, or delete and migrate callers. |
| F2-02 | P1 | messages.ts | Add `participantIds.includes(callerId)` check at top of `markConversationReadAction` before any write. |
| F2-03 | P2 | messages.ts | Same check at top of `acknowledgeDeliveryAction`. |

All three are surgical (≤10 lines each) and fit in a single PR.
