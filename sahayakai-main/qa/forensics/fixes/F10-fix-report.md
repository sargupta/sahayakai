# F10 — Community + Social Fix Report

**Branch:** `fix/f10-community-fixes` (off `develop`)
**Date:** 2026-06-06
**Forensic ref:** `qa/forensics/F10-community.md`

F10-01 (`getProfilesAction` PII leak) is being addressed in the F2 fix-agent and
is intentionally skipped here.

---

## F10-02 — P0 — Public profile email leak — FIXED

**File:** `src/app/actions/profile.ts`

**Before:** `getPublicProfileAction` unconditionally included `email` in the
public projection. Any signed-in teacher could harvest the entire teacher
table's emails one `/profile/[uid]` fetch at a time.

**After:**
- Caller uid captured from `requireAuth()`.
- `canSeeEmail = false` by default.
- Flipped to `true` if any of:
  - `callerUid === targetUid` (self)
  - `isAdmin(callerUid)` (admin override)
  - `connections/{pairId}` exists where
    `pairId = sorted([callerUid, targetUid]).join('_')` (accepted connection)
- `publicProfile.email` only assigned when `canSeeEmail`.
- All Firestore + admin lookups wrapped in try/catch so a transient failure
  silently fails closed (no email leak on error).
- UI in `src/components/profile/profile-view.tsx:245` already shows
  `t("Contact Hidden")` when `profile?.email` is falsy — no UI change needed.

---

## F10-03 — P1 — `sendChatMessageAction` audioUrl not validated — FIXED

**File:** `src/app/actions/community.ts`

**Before:** `sendChatMessageAction` accepted any `audioUrl` string and wrote it
directly to the `community_chat` doc. Enabled tracking-pixel audio, open
redirect, and uncapped storage abuse.

**After:** mirrors `sendGroupChatMessageAction` (`groups.ts:616-618`) and
additionally hardens with `URL` parsing:
- `audioUrl` must be a string ≤ 1024 chars.
- `new URL(audioUrl)` must succeed.
- `protocol === 'https:'`.
- `host === 'firebasestorage.googleapis.com'`.
- Any failure throws `Invalid audio URL`.

---

## F10-04 — P2 — Self-follow — FIXED

**File:** `src/app/actions/community.ts` — `followTeacherAction`

Added early `if (followingId === followerId) throw new Error('Cannot follow yourself');`
right after `requireAuth()`. Prevents follower-graph inflation and bogus
social proof.

## F10-05 — P2 — Self-like — FIXED

**Files:** `src/app/actions/community.ts`
- `toggleLikeAction` (community posts): reads the post doc, throws
  `Cannot like your own post` when `post.authorId === callerUid`.
- `likeResourceAction` (library resources): throws
  `Cannot like your own resource` when `resource.authorId === callerUid`.

Stops vanity-counter inflation and ranking pollution.

## F10-06 — P2 — `getGroupAction` non-member access — DOCUMENTED

**File:** `src/app/actions/groups.ts`

Confirmed design choice: top-level `groups/{groupId}` doc is intentionally
discoverable by non-members for browse/join. Sensitive data lives in
subcollections that have their own auth gates + Firestore rules. Added a
JSDoc block above `getGroupAction` documenting the decision and pointing to
the failure-mode trigger ("if the top-level doc ever starts carrying
member-only data, add `requireGroupMember`").

---

## Tests

**New file:** `src/__tests__/actions/f10-community-fixes.test.ts`

13 unit tests, all passing:
- F10-02 (4): non-connected hides email; connected shows email; self shows
  email; admin shows email.
- F10-03 (4): rejects http tracking pixel; rejects non-firebasestorage host;
  rejects >1024 char URL; accepts valid firebasestorage URL.
- F10-04 (2): rejects self-follow; allows following another teacher.
- F10-05 posts (2): rejects self-like; allows liking another teacher's post.
- F10-05 resources (1): rejects self-like on library resource.

Existing related tests still pass (`public-profile.test.ts`,
`community-auth.test.ts`, `community-likes.test.ts` — 28 tests).

Typecheck: `npx tsc --noEmit` clean.

---

## Files touched

- `src/app/actions/profile.ts` (F10-02)
- `src/app/actions/community.ts` (F10-03, F10-04, F10-05)
- `src/app/actions/groups.ts` (F10-06 — comment only)
- `src/__tests__/actions/f10-community-fixes.test.ts` (new)
- `qa/forensics/fixes/F10-fix-report.md` (this file)

No UI changes required — `profile-view.tsx` already handles the
`email === undefined` case via its existing "Contact Hidden" fallback.
