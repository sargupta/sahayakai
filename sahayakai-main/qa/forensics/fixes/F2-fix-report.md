# F2 — Authz / IDOR Fix Report

Branch: `fix/F2-pii-leak` (off `develop`)
Scope: `qa/forensics/F2-authz-idor.md` items F2-01, F2-02, F2-03.

## F2-01 (P0 — PII leak via `getProfilesAction`) — FIXED

**File:** `src/app/actions/community.ts`

**Before:** `getProfilesAction(uids)` returned raw Firestore user docs to any
signed-in caller. Leaked fields included `phoneNumber`, `fcmTokens`,
`adminRoles`, `planType`, `razorpaySubscriptionId`, `creditsUsed`,
`subscriptionStatus`, `stripeCustomerId`, `lastLoginAt`,
`onboardingChecklistItems`, `customClaims`, etc.

**Fix:**

1. Added a `PUBLIC_PROFILE_FIELDS` allowlist that mirrors the whitelist used by
   `getPublicProfileAction` in `src/app/actions/profile.ts`.
2. Added a local `stripToPublicProfile()` helper that returns a new object
   containing only allowlisted fields.
3. `getProfilesAction` now maps every result through `stripToPublicProfile()`
   before returning.

Why a local copy rather than refactoring `getPublicProfileAction`: the latter
is exported as a server action and has a different return shape (`{ profile,
certifications }`). Lifting the whitelist into a shared module is the right
long-term move; the local copy keeps this P0 patch surgical and matches the
existing pattern.

**Audit of `getProfilesAction` callers in `src/`:**

```
grep -rn "getProfilesAction" src/
src/app/actions/community.ts:14:export async function getProfilesAction(uids: string[]) {
src/__tests__/actions/community-auth.test.ts:65: ... it('getProfilesAction', ...)
```

No production UI or API path calls `getProfilesAction` today. We kept the
export rather than deleting it because the function name is generic enough
that future callers might reach for it; making it safe-by-default is better
than relying on grep-discipline. A follow-up could remove the export.

**Test:** `src/__tests__/actions/community-profiles-pii.test.ts`

- Asserts none of `phoneNumber`, `fcmTokens`, `adminRoles`, `planType`,
  `razorpaySubscriptionId`, `creditsUsed`, `creditsRemaining`,
  `subscriptionStatus`, `stripeCustomerId`, `lastLoginAt`,
  `onboardingChecklistItems`, `customClaims` are present in the response,
  for both single and batch reads.
- Asserts safe fields (`displayName`, `state`, `subjects`, …) are preserved.
- Asserts the unauthenticated path still throws.

**`getProfileData` audit (`src/app/actions/profile.ts`):** existing
`if (_userId && _userId !== userId) throw …` check confirmed. The action only
returns the caller's own profile via `dbAdapter.getUser(userId)`. No change
required.

## F2-02 (P1 — missing participant check in `markConversationReadAction`) — FIXED

**File:** `src/app/actions/messages.ts`

**Before:** any signed-in caller could call `markConversationReadAction` with
any `conversationId` and have their uid `arrayUnion`'d onto up to 50 messages'
`readBy` array (audit-trail corruption / spoofed receipts).

**Fix:** before any mutation, fetch `conversations/{conversationId}`, verify
exists, and verify `callerId in participantIds[]`. Mirrors the check that
`sendMessageAction` already performs.

Failure modes:
- conversation missing → `Conversation not found`
- caller not in `participantIds` → `Forbidden: not a participant`

## F2-03 (P2 — missing participant check in `acknowledgeDeliveryAction`) — FIXED

**File:** `src/app/actions/messages.ts`

**Before:** identical IDOR — any conversationId would let a caller stamp
`deliveredTo: arrayUnion(callerUid)` on up to 50 messages.

**Fix:** same participant-check pattern, applied before the batch is built.

## Tests

Added / updated in `src/__tests__/actions/messages.test.ts`:

- `markConversationReadAction`: existing test now seeds `participantIds`; new
  test asserts a non-participant caller is rejected with no writes; new test
  asserts missing conversation is rejected.
- `acknowledgeDeliveryAction` (new block): asserts participant succeeds,
  non-participant rejected and no `batch()` is created, missing conversation
  rejected.

Added `src/__tests__/actions/community-profiles-pii.test.ts` per F2-01 above.

## Verification

```
npx jest src/__tests__/actions/community-profiles-pii.test.ts \
         src/__tests__/actions/messages.test.ts \
         src/__tests__/actions/community-auth.test.ts \
         src/__tests__/actions/public-profile.test.ts
→ Test Suites: 4 passed, Tests: 54 passed

npx tsc --noEmit
→ clean
```

## Files changed

- `src/app/actions/community.ts` (F2-01)
- `src/app/actions/messages.ts` (F2-02, F2-03)
- `src/__tests__/actions/messages.test.ts` (updated)
- `src/__tests__/actions/community-profiles-pii.test.ts` (new)
- `qa/forensics/fixes/F2-fix-report.md` (this file)
