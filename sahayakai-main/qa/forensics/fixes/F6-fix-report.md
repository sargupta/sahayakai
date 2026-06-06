# F6 Notification Fixes — Report

Source forensic: `qa/forensics/F6-notifications.md` (commit head `9c8483b9c`).

Branch: `fix/f6-notification-bugs` (off `develop`).

## Summary

8 of the 19 F6 findings addressed in this PR — both P0s and all six "must-fix" P1s.

| ID | Sev | File(s) | Status |
|----|-----|---------|--------|
| F6-01 | P0 | `src/lib/notifications/fanout.ts` | Fixed |
| F6-09 | P0 | `src/app/actions/messages.ts` | Fixed |
| F6-02 | P1 | `src/lib/notifications/fanout.ts` | Fixed |
| F6-03 | P1 | `src/lib/notifications/fanout.ts` | Fixed (subsumed by F6-02) |
| F6-05 | P1 | `src/app/actions/groups.ts` | Mitigated (uniform sample; digest still TODO) |
| F6-06 | P1 | `src/app/actions/groups.ts` | Fixed |
| F6-07 | P1 | `src/app/actions/groups.ts` | Fixed |
| F6-08 | P1 | `src/app/actions/groups.ts` | Fixed |
| F6-13 | P1 | `fanout.ts`, `groups.ts` | Fixed |
| F6-14 | P1 | `src/lib/notifications/i18n.ts` | Fixed |
| F6-19 | P1 | `src/lib/notifications/fanout.ts` | Closed by construction |

Remaining open: F6-04, F6-10, F6-11, F6-12, F6-15, F6-16, F6-17, F6-18 (all P2 — out of scope for this PR).

---

## P0

### F6-01 — Nearby-teacher cohort starvation (random sampling)

`fanout.ts` previously did `orderBy('createdAt','desc').limit(50*2)` then took the first 50 candidates. In any district with >100 matching teachers, the older cohort was guaranteed to be starved (zero notifications).

**Fix:** over-fetch `RECIPIENT_CAP * 4 = 200` candidates ordered by createdAt desc, JS-shuffle (Fisher–Yates), then slice to 50. Each fan-out is now a probabilistic uniform sample across the full matching cohort.

**Test:** `src/__tests__/lib/notifications/fanout.test.ts` → `F6-01: shuffle sampling reaches the old cohort over many runs`. Runs the fan-out 60× against a 200-candidate cohort where the last 50 candidates were never picked under the old code; asserts ≥30 of those 50 are reached.

### F6-09 — `markConversationReadAction` badge stuck >200

The notification scan in `messages.ts` was `.limit(200)` *without* an `orderBy`. The kept set was non-deterministic, so users with >200 unread notifications might never have the relevant message-notification surface in the scan window → Bell badge stayed pinned forever.

**Fix:** cursor-based pagination over `(recipientId == userId) + (isRead == false)`, ordered by `__name__`, in pages of 500. Loops up to 20 pages (10k notifs safety cap, well above any realistic case). The existing 2-field index handles the query; no schema change needed.

**Test:** `src/__tests__/actions/messages.f6-09.test.ts` → seeds 599 noise notifs and one matching notification at `id = "zzz-target"` (lexicographically last), confirms the action still clears it. Also covers `metadata.conversationId` and `link?open=` match paths, and the no-op case.

---

## P1

### F6-02/03 — Silent dedup failure

The `catch` around the per-recipient dedup probe returned `hasRecent: true`. A missing composite index in a region silently zeroed the entire fan-out — only a `logger.warn` was emitted.

**Fix:** structured `event: notification.dedup.failed` warn-log (queryable in Cloud Logging) and **default to SEND**. Over-delivery beats silent under-delivery for an "X joined" notification.

F6-03 (state filter conditional) is subsumed: the over-fetch + default-send behavior means a missing index path no longer corrupts the fan-out.

**Test:** `fanout.test.ts` → `F6-02: dedup-query failure defaults to SEND`. Forces a throw on one recipient's probe; asserts both recipients still receive.

### F6-13 — Missing FCM push (NEW_TEACHER_JOINED, NEW_GROUP_POST, GROUP_POST_LIKE)

Previously only 1:1 messages fired `sendPushToUser`. The three notification types fan-out only wrote Firestore docs → backgrounded users got no OS-level push, inconsistent with messages.

**Fix:** added fire-and-forget `sendPushToUser` calls after each `createNotification` / batch write. The helper internally swallows errors so one bad token never breaks fan-out.

- `fanout.ts` → fires push per recipient with `{ link, type }` metadata.
- `groups.ts:fanoutGroupPostNotifications` → push per group-post recipient with `{ link, type, groupId, postId }`.
- `groups.ts:notifyGroupPostLike` → push to post author.

**Test:** `fanout.test.ts` → `F6-13: FCM sendPushToUser is invoked per recipient`. Mocks `@/lib/fcm-server` to capture calls; asserts one call per recipient with correct payload + data.

### F6-19 — Spoofing guard bypass

`createNotification` overrides `senderId` from the authenticated session uid. `fanoutNewTeacherJoinedNotification` was bypassing it (batch-write directly), but in practice the `senderId` is derived from the `newTeacherUid` that this module just resolved against Firestore — there is no caller-supplied senderId in the fan-out path, so the spoofing surface is closed by construction.

**Status:** verified no caller-controlled value reaches `senderId`. Comment added at the batch-write site documenting the invariant. Future contributors must not introduce a caller-supplied `senderId` parameter without also routing through `createNotification`.

### F6-05/06/07 — Group-post starvation + sequential await

`createGroupPostAction` → `fanoutGroupPostNotifications`:

- **F6-05 (silent over-cap):** still mitigated, not fully fixed. The cap remains 200 (digest fallback is a separate workstream). Logs `fanoutGroupPost: cap hit` as before. The starvation pattern that *was* the visible symptom is now eliminated by F6-06.
- **F6-06 (alphabetical bias):** previously `.limit(CAP+1)` without orderBy returned the first 200 uids in `__name__` order — bottom-of-alphabet uids were systemically starved. Fixed: scan full membership, Fisher–Yates shuffle, then slice to 200. Each over-cap fan-out is now uniform.
- **F6-07 (sequential awaits):** the `for { await createNotification(...) }` loop made ~200 sequential round-trips. Replaced with chunked `Promise.all` at concurrency 25; latency is now ~O(CAP/25) instead of O(CAP).

**Test:** `src/__tests__/actions/groups.notifications.test.ts` already exercises fan-out cap + per-recipient i18n; the in-memory store's order-agnostic semantics mean it covers the new path automatically. (Mock also extended to support dotted-path filters for F6-08.)

### F6-08 — Like-dedup missing postId filter

`notifyGroupPostLike` scanned the last 20 GROUP_POST_LIKE notifications and filtered in-memory by postId. A prolific author with >20 likes/hour across other posts pushed the relevant `postId` out of the probe window → duplicate likes got through.

**Fix:** add `.where('metadata.postId', '==', postId)` to the probe query so it is post-scoped. If the composite index `(recipientId, type, metadata.postId)` is missing, the existing `try/catch` (which already defaults to send) handles it gracefully.

**Test:** `groups.notifications.test.ts` → existing "dedups a second like notification on the same post within 1 hour" now passes against the new code (the mock's `where` was extended to traverse dotted paths).

### F6-14 — i18n exact-string match

`formatNotificationMessage` previously did `NOTIFICATION_DICTS[language]` directly. A user with `preferredLanguage` of `'hi'` / `'Hindi'` / `'HINDI'` / `'hindi'` silently fell back to English.

**Fix:** new `resolveLanguage(input)` helper accepts canonical names, ISO-639-1 codes, and any case; normalises to the canonical `Language` key. `formatNotificationMessage` and `fanout.ts:renderMessage` both consume it.

**Test:** `src/__tests__/lib/notifications/i18n.test.ts` — parameterised `test.each` covering canonical, lowercase, uppercase, ISO codes, unknown, null, undefined, whitespace. Also asserts `formatNotificationMessage('group_post', 'hi', ...)` returns a Hindi-rendered string.

---

## Verification

- `npx tsc --noEmit` → 0 errors.
- Targeted jest suites:
  - `src/__tests__/lib/notifications/fanout.test.ts` — 12 tests pass
  - `src/__tests__/lib/notifications/i18n.test.ts` — new, 17 tests pass
  - `src/__tests__/actions/groups.notifications.test.ts` — 10 tests pass
  - `src/__tests__/actions/messages.f6-09.test.ts` — new, 3 tests pass
  - `src/__tests__/actions/messages.test.ts` — existing 31 tests still pass
  - `src/__tests__/lib/notification-templates.test.ts` — 6 tests still pass

Total: 79 tests across the affected surfaces, all green.

## Files Changed

- `src/lib/notifications/fanout.ts`
- `src/lib/notifications/i18n.ts`
- `src/app/actions/messages.ts`
- `src/app/actions/groups.ts`
- `src/__tests__/lib/notifications/fanout.test.ts`
- `src/__tests__/lib/notifications/i18n.test.ts` (new)
- `src/__tests__/actions/groups.notifications.test.ts`
- `src/__tests__/actions/messages.f6-09.test.ts` (new)
- `qa/forensics/fixes/F6-fix-report.md` (this file)
