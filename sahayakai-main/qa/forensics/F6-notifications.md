# F6 — Notifications + Fan-out Forensics

**Scope:** nearby-teacher fan-out (commit 47e09a700), group post + like (commit 164ec1aa5), AI persona-to-human (persona-pulse), message badge + deep-link / `markConversationReadAction`.
**Method:** static code audit of `src/lib/notifications/`, `src/app/actions/{groups,messages,notifications}.ts`, `src/app/api/user/profile/route.ts`, `src/app/api/community/persona-pulse/route.ts`, `src/hooks/use-community-live-pulse.ts`, `firestore.indexes.json`, and existing unit tests. Live preview writes intentionally **not** executed — repro steps for synthetic teachers are provided below for the QA Admin SDK harness.
**Auth:** gcloud impersonation flow; test UIDs `forensic-notif-<n>`.

---

## Findings summary

| ID | Severity | Area | One-liner |
|----|----------|------|-----------|
| F6-01 | **P0** | nearby-teacher | Recipients are **older** teachers, not "most recent" — `orderBy('createdAt', 'desc')` + `limit(50)` skips early-adopter recipients in any district with >50 teachers. Spec says "ALL 5 receive" — at scale this is "newest 50 receive". |
| F6-02 | **P1** | nearby-teacher / fanout | If the dedup composite index `(recipientId, type, createdAt)` ever **misses** the `>=` predicate (e.g. mismatched index, regional rollout), the code **silently treats every recipient as already-notified** (`hasRecent: true` in the catch). The first-day rollout in a new region would deliver zero notifications and log a warn — no fail-loud signal, no metric. |
| F6-03 | **P1** | nearby-teacher | `state` filter is conditional (`if (state)`) but Firestore composite index requires it. A teacher saved without `state` will have query shape `(district, subjects, createdAt)` — index is `(state, district, subjects, createdAt)`. Query fails → catch swallows → silent no-fanout. |
| F6-04 | **P2** | nearby-teacher | Deep-link `/community?tab=connect&highlight=<uid>` is **not implemented** on the community page. `src/app/community/page.tsx` does not read `searchParams`, `tab`, or `highlight`. Recipient lands on default tab; no scroll, no highlight. The unit test asserts the link string but no consumer parses it. |
| F6-05 | **P1** | group post | `GROUP_POST_FANOUT_CAP = 200` cap is enforced, but the "digest fallback (X new posts)" is a **TODO** — over-cap members get **nothing**, not even a digest. Logged via `logger.warn` only. For `community_general` / `daily_briefing` / popular school groups with >200 members this is silent under-delivery. |
| F6-06 | **P1** | group post fan-out | Recipient sampling for over-cap is `.limit(GROUP_POST_FANOUT_CAP + 1)` against `groups/{id}/members` with **no orderBy** → Firestore returns docs in `__name__` (uid) order. The first 200 uids alphabetically always win; the bottom half of the alphabet never gets group-post notifications in any group >200 members. Comment ("insertion ≈ join order") is wrong — Firestore default ordering on a subcollection is by document ID, not insertion. |
| F6-07 | **P1** | group post fan-out | Per-recipient `createNotification` calls run **sequentially** in a `for (const recipientId of recipients)` loop with `await` each. 200 sequential round-trips per post → ~10–40 s on cold paths. Marked fire-and-forget so caller doesn't notice, but a popular group → tail of recipients waits a minute. Should be `Promise.all`-batched or a single `db.batch()`. |
| F6-08 | **P1** | group like dedup | `notifyGroupPostLike` dedup probe reads last **20** GROUP_POST_LIKE notifications for the author (no postId filter) and matches in code. On an author who gets ≥20 likes/hour across **other** posts, the probe never contains the current postId → dedup misses and a 2nd like on the same post within an hour produces a 2nd notification. Spam path. |
| F6-09 | **P0** | message badge | `markConversationReadAction` scans only the **first 200** unread notifications (`.limit(200)`). A user with >200 unread notifs and a message buried past row 200 will mark the conversation read but the **message-badge count never clears**. The "lingering badge" bug commit history references is partially re-introduced for high-unread users. |
| F6-10 | **P2** | message badge | `markConversationReadAction` runs `.limit(50)` on the messages subcollection to mark `readBy`. Reading the 51st-oldest unread message via "jump to" or scroll-up leaves it `readBy`-unset — re-entering the conversation reasserts `readBy` only for the last 50 messages. Cross-device unread state drifts. |
| F6-11 | **P1** | persona-pulse / spam | `useCommunityLivePulse` has **no cross-tab guard**. Two tabs of `/community` open = two independent 3-5 min timers → roughly 2× the LLM calls and 2× the chat writes. Server has no rate-limit on `/api/community/persona-pulse` per uid either (no `checkServerRateLimit` call), so a misbehaving client can hammer it. The role brief asks "no spam, dedup" — neither is enforced. |
| F6-12 | **P2** | persona-pulse | No notification doc is written for persona messages — they reach humans only via the realtime `community_chat` Firestore listener. That's fine for the demo, but a user **not on /community** at the time has zero record the message happened. Acceptable for demo seeder; flag if persona system becomes production. |
| F6-13 | **P1** | FCM coverage | `NEW_TEACHER_JOINED`, `NEW_GROUP_POST`, `GROUP_POST_LIKE` write Firestore notification docs but **never call `sendPushToUser`**. Only 1:1 / group messages fire FCM push. A user with the PWA backgrounded gets a real OS push for a DM but not for a nearby-teacher join or a like — inconsistent UX, and the user has to open the tab to see the badge. |
| F6-14 | **P1** | i18n recipient lang | `fanoutGroupPostNotifications` reads `preferredLanguage` per recipient — good. But `formatNotificationMessage` checks `NOTIFICATION_DICTS[language as string]` where `language` is whatever string is in Firestore. There is no normalization (case, "hi" vs "Hindi", "english" vs "English"). A user whose `preferredLanguage` is stored as the BCP-47 code or lowercase will silently fall back to English. The 11-language dict only matches the exact strings `English`, `Hindi`, `Kannada`, … |
| F6-15 | **P2** | i18n fallback in nearby-teacher | `fanout.ts` uses `MESSAGE_TEMPLATES[(lang as Language) ?? 'English']` — `??` only catches `undefined`/`null`. If `preferredLanguage` is an unknown non-null string (e.g. "Konkani"), the lookup is `undefined` and then `?? MESSAGE_TEMPLATES.English` rescues it. OK, but the `lang as Language` cast hides the bug class — recommend explicit `if (!(lang in MESSAGE_TEMPLATES))`. |
| F6-16 | **P2** | test-account filter | `looksLikeTestAccount` regex matches `\b(dev|qa|test|impersonat|sample|dummy|placeholder)\b` against `displayName`. A legitimate teacher named "Devraj" / "Devi" / "Testa" gets blocked? — `\b` makes the `dev` token-bounded, so "Devraj" matches (`dev` is a leading bounded token). Production risk: real teachers with names starting in "Dev"/"Test"/"Sam" never get fanout notifications and are silently excluded as senders too. Repro: `forensic-notif-devraj` would be matched. |
| F6-17 | **P0/PII** | leak vector — investigated, **not** reproduced | `fanoutNewTeacherJoinedNotification` stamps `metadata: { newTeacherUid, school, district }` and `senderName` = new teacher's `displayName`. Recipient inbox renders these — i.e. the new teacher's full name, school, and district are pushed to up-to-50 unrelated teachers in the same district. Not a leak per spec (this is the feature), but worth flagging: a teacher who created a profile and immediately wants to delete it cannot un-fanout. There is no `delete-fanout` reversal helper. |
| F6-18 | **P2** | dedup window inconsistency | nearby-teacher dedup window is 24 h; group-like dedup is 1 h; group-post has **no per-recipient dedup at all** (a member who muted/un-muted gets every post). No single source of truth — three different windows in three different files. Recommend a central constants module. |
| F6-19 | **P1** | senderId integrity | `createNotification` overrides `senderId` with the authenticated session uid when present — good defense against client spoofing. But `fanoutNewTeacherJoinedNotification` bypasses `createNotification` (it writes via `db.batch()` directly with `senderId: newTeacherUid` and **does not** consult the session uid). A direct call to the exported helper from a malicious server action could stamp any uid as sender. Helper is not exported from a route, but it IS an `export` in a server-module file — protect with an internal-only guard or move under `dbAdapter`. |

---

## Playbook results

### 1. Create 5 synthetic teachers + 6th signs up → all 5 notified within 90 s

**Code path verified:** `POST /api/user/profile` (isNewUser branch) → `fanoutNewTeacherJoinedNotification(uid)` (fire-and-forget, no await).
**Expected fail modes flagged:**
- F6-03 if `state` not stamped on synthetic teachers.
- F6-02 if the composite index `(recipientId, type, createdAt)` is regional-rolled out unevenly.
- F6-13: even on success, no FCM push — user must have the tab open to see the badge.

**Repro:**
```ts
// scripts/forensic/F6-fanout-repro.ts
import * as admin from 'firebase-admin';
admin.initializeApp({ projectId: 'sahayakai-b4248' });
const db = admin.firestore();

const peers = Array.from({ length: 5 }, (_, i) => ({
  uid: `forensic-notif-peer-${i}`,
  displayName: `Peer ${i}`,
  state: 'Karnataka',
  district: 'Mandya',
  subjects: ['Mathematics'],
  preferredLanguage: ['English','Hindi','Kannada','Tamil','Telugu'][i],
  createdAt: new Date(Date.now() - (i+1)*86400000).toISOString(),
}));
await Promise.all(peers.map(p => db.collection('users').doc(p.uid).set(p)));

// Then call POST /api/user/profile with newTeacher = forensic-notif-new
// And read users/forensic-notif-peer-0..4/notifications-style query:
const snap = await db.collection('notifications')
  .where('recipientId','in', peers.map(p => p.uid))
  .where('type','==','NEW_TEACHER_JOINED').get();
console.log(snap.docs.map(d => ({id: d.id, ...d.data()})));
```

### 2. Same teacher signs up AGAIN within 24 h → dedup

The 24 h dedup is `>= dedupCutoffIso` (string compare on ISO). Works because ISO-8601 lex order = chronological. **Risk:** if any notification's `createdAt` is written as a Firestore `Timestamp` (not a string), the string comparison silently returns "no match" → dedup misses. F6-02 catch-arm then drops the candidate. Inspection shows `fanout.ts` writes `createdAt: now` (ISO string) — but `createNotification` (used elsewhere) also writes ISO. Consistent. **OK** — but the schema lacks a strict invariant.

### 3. Group create + post → all members notified

Verified the canonical store is `groups/{id}/members` (good — uses subcollection, not the lagging `users.groupIds` cache). Issues: F6-05 (over-cap silent drop), F6-06 (no ordering → bottom-of-alphabet starved at scale), F6-07 (sequential awaits), F6-13 (no FCM).

### 4. Like a post — author notified, self-likes skipped

Self-like check is in **both** `likeGroupPostAction` (skip dispatch) and `notifyGroupPostLike` (defense-in-depth). Good. But F6-08: dedup probe scans last 20 with no postId filter — can miss.

### 5. 1:1 message + markConversationRead → badge clears

Critical bug F6-09: 200-row scan cap. Repro:
```ts
// Seed >200 unread SYSTEM notifications for forensic-notif-user-A
for (let i = 0; i < 220; i++) {
  await db.collection('notifications').add({
    recipientId: 'forensic-notif-user-A', type: 'SYSTEM',
    title: 'noise', message: 'noise', isRead: false,
    createdAt: new Date(Date.now() - i*1000).toISOString(),
  });
}
// Then send a 1:1 message → notification has metadata.conversationId
// Then call markConversationReadAction(convId, 'forensic-notif-user-A')
// Verify the message notification — older than the 200 newest noise — is NOT marked read.
```
Note also: the 200-row scan has **no `orderBy`** so the kept 200 rows are not deterministic (Firestore default may be by `__name__` for this composite). The message notification might survive even when the user has 50 unread total, if the index returns it past row 200 in `__name__` order.

### 6. 200 messages in a single group post

Spec line "200 messages in single group post" interpreted as "200-member group, single post". Cap hits exactly at 200; over-cap path is the F6-05 silent-drop. No digest fallback exists.

### 7. AI persona-to-human

Persona-pulse writes to `community_chat` (or `community_chat_preview` if `DEMO_MODE=true`). No notification doc, no FCM. F6-11 (no cross-tab guard, no server rate-limit per uid) is the only spam path. Realtime listener is the delivery channel.

### 8. Message badge `metadata.conversationId` stamping

Verified: `sendMessageAction` stamps `metadata: { conversationId }` on every recipient notification. `markConversationReadAction` matches via metadata **OR** legacy link string (`open=<convId>`). Good design — legacy notifications without metadata still clear. **But** F6-09 (200-row cap) defeats this for any heavy user.

---

## Recommended fixes (prioritized)

1. **F6-09**: change `markConversationReadAction` to either (a) loop with cursor over all unread notifs, or (b) add an explicit composite index `(recipientId, isRead, metadata.conversationId)` and query directly, abandoning the "scan + filter" fallback once the index is rolled out everywhere.
2. **F6-01 + F6-06**: replace `orderBy('createdAt','desc').limit(N)` (nearby-teacher) and the no-orderBy members scan (group post) with random sampling or "active in last 30d" ordering — alphabetical / chronological bias starves whole cohorts.
3. **F6-05**: ship the digest fallback. Even a "X new posts in Community today" daily-rollup notification beats silent drop for cap-hit groups.
4. **F6-02 + F6-03**: turn the silent catch into a metric/sentry event; fail-loud on missing-index / missing-state so a regional rollout doesn't silently zero out fanout.
5. **F6-13**: wire `sendPushToUser` into the group / nearby-teacher / like fanouts — at least a coarsened version (one push per fanout, not per recipient).
6. **F6-11**: add `checkServerRateLimit(uid)` to `/api/community/persona-pulse` and a localStorage cross-tab token to the hook.
7. **F6-14 + F6-15**: normalize `preferredLanguage` on read (lowercase → canonical), or migrate the dict keys to BCP-47.
8. **F6-16**: tighten the test-account regex — require the string to be the entire token or a clear prefix like `qa_` / `test_` / `forensic_`, not a `\b` substring that matches "Devraj".
9. **F6-07**: batch the group fanout writes (`db.batch()` x 500/chunk).
10. **F6-08**: include `metadata.postId` in the dedup probe by either adding a composite index or fetching the last N for the recipient and filtering in code with N≥(per-author hourly like volume).
11. **F6-19**: gate `fanoutNewTeacherJoinedNotification` behind an internal-only call site assertion (e.g. require a server-only `internalCall: true` flag, or move to a non-`export` module entry).

---

## Files inspected

- `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/src/lib/notifications/fanout.ts`
- `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/src/lib/notifications/i18n.ts`
- `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/src/lib/notifications/types.ts`
- `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/src/app/actions/groups.ts`
- `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/src/app/actions/messages.ts`
- `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/src/app/actions/notifications.ts`
- `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/src/app/api/user/profile/route.ts`
- `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/src/app/api/community/persona-pulse/route.ts`
- `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/src/hooks/use-community-live-pulse.ts`
- `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/src/app/community/page.tsx`
- `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/firestore.indexes.json`
- `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/src/__tests__/lib/notifications/fanout.test.ts`
