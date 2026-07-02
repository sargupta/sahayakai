# F5 — Race Conditions & Concurrency Forensic

**Date**: 2026-06-06
**Auth**: gcloud impersonate; test UIDs `forensic-race-<n>`
**Hard rules**: preview-only writes; prod reads only.
**Scope**: dispatcher bucket races, Firestore transaction races, shadow-diff doc-id collisions, webhook idempotency (Razorpay + Twilio), double-submit forms.

---

## Severity Tally

| Severity | Count | IDs |
|----------|-------|-----|
| **P0**   | 1     | F5-002 |
| **P1**   | 4     | F5-001, F5-003, F5-004, F5-006 |
| **P2**   | 1     | F5-005 |

---

## P0 — F5-002 — toggleLike TOCTOU inflates likesCount

**Files**:
- `src/app/actions/community.ts:83`  `toggleLikeAction`
- `src/app/actions/groups.ts:535`    `toggleGroupPostLikeAction`

**Code**:
```ts
const likeDoc = await likeRef.get();             // T1
if (likeDoc.exists) {
    await Promise.all([likeRef.delete(), postRef.update({ likesCount: FieldValue.increment(-1) })]);
} else {
    await Promise.all([likeRef.set(...), postRef.update({ likesCount: FieldValue.increment(1) })]);
}
```

**Race**: Two concurrent likes from the same UID both read `exists=false`, both fall into the `else` branch, both run `set()` (idempotent — one like-doc lands) AND both run `increment(+1)` → counter inflated by 2 with only one like-doc.

The comment at line 92 is **misleading**: it claims the change to `FieldValue.increment` made the toggle atomic. It made the *delta* atomic, but the *direction* decision (like vs unlike) is still a non-atomic read.

**Trigger in the wild**:
- User double-taps the heart on slow network
- React 18 strict-mode in dev fires server actions twice
- Bot/scraper spam

**Repro**: `qa/forensics/repros/F5-002-like-toggle-toctou.mjs`

**Fix**: wrap read+set+increment in `db.runTransaction`:

```ts
await db.runTransaction(async (tx) => {
    const snap = await tx.get(likeRef);
    if (snap.exists) {
        tx.delete(likeRef);
        tx.update(postRef, { likesCount: FieldValue.increment(-1) });
    } else {
        tx.set(likeRef, { uid: userId, createdAt: new Date().toISOString() });
        tx.update(postRef, { likesCount: FieldValue.increment(1) });
    }
});
```

---

## P1 — F5-001 — Shadow-diff doc-ID collides under same-millisecond bursts

**File**: `src/lib/sidecar/shadow-diff-writer.ts:100`

```ts
const id = `${sample.uid}__${Date.now()}`;
await db.collection('agent_shadow_diffs').doc(date)
        .collection(sample.agent).doc(id).set(payload);
```

**Vector**: 17 dispatchers (vidya, quiz, lesson-plan, exam-paper, instant-answer, rubric, teacher-training, video-storyteller, virtual-field-trip, visual-aid, voice-to-text, worksheet, parent-message, avatar-generator, assessment-scanner, assignment-assessor, community-persona-message) write here.

Q4C canary-observation (active per `SHADOW_DIFF_IN_CANARY_OBSERVATION = true` in `canary-shadow-diff.ts`) now fires **both** a sidecar primary AND a parallel Genkit shadow per request from the **same** UID. Two shadow_diff writes for one logical request frequently land in the same millisecond → second write silently overwrites first via `.set()`.

**Synthetic repro confirms** (`F5-001-shadow-diff-doc-collision.mjs`):
```
{ writes: 200, uniqueIds: 1, collisions: 199 }
```

**Impact**: Q4C promotion gate evaluates parity rollups against a lossy denominator. Regressions can slip past canary→full because their evidence row was overwritten.

**Fix**:
```ts
import { randomUUID } from 'node:crypto';
const id = `${sample.uid}__${Date.now()}__${randomUUID().slice(0, 8)}`;
```

(Alternative: `collection.add()` for auto-id. UUID-suffix is preferred — keeps the deterministic uid/ts prefix that backfill scripts already grep.)

**Compare to parent-call writer** (`shadow-diff.ts:70`): uses `${callSid}__${turnNumber:04d}` — deterministic by design, safe from this race. Only fails under twiml retry (F5-006).

---

## P1 — F5-003 — saveResource TOCTOU inflates stats.saves

**File**: `src/app/actions/community.ts:582` `saveCommunityResourceAction`

Same pattern as F5-002: `saveRef.get()` → branch → `set()` + `increment(+1)`. Concurrent saves inflate `stats.saves`. The user's personal-library copy is safe (deterministic `contentId`), so the only damage is the public counter.

**Repro**: `qa/forensics/repros/F5-003-save-resource-toctou.mjs`

**Fix**: `runTransaction` around read+set+increment; leave `dbAdapter.saveContent` outside (its own idempotent path).

---

## P1 — F5-004 — Profile double-submit duplicates new-teacher fanout

**File**: `src/app/api/user/profile/route.ts:85-129`

```ts
const existingProfile = await dbAdapter.getUser(requestingUserId);   // T1
const isNewUser = !existingProfile;
...
await dbAdapter.createUser(profile);                                  // T2 (set merge — idempotent)
if (isNewUser) {
    void fanoutNewTeacherJoinedNotification(profile.uid);              // T3 — SIDE EFFECT
}
```

Two concurrent first-save requests both observe `existingProfile=null` → both call `fanoutNewTeacherJoinedNotification`, which sends FCM + writes notification docs to every nearby teacher (same district + primary subject).

**Effects**:
- FCM quota doubles
- Receiving teachers see N notifications for one join
- Trust erosion in the directory

**Repro**: `qa/forensics/repros/F5-004-profile-double-submit-fanout.mjs`

**Fix**: gate the fanout on `.create()` of a guard doc:

```ts
if (isNewUser) {
    try {
        await db.collection('welcome_fanout_sent').doc(profile.uid)
                .create({ at: FieldValue.serverTimestamp() });
        void fanoutNewTeacherJoinedNotification(profile.uid).catch(...);
    } catch (err) {
        if (!isAlreadyExistsError(err)) throw err;
        // already fanned out — skip
    }
}
```

---

## P1 — F5-006 — Twilio twiml retry duplicates transcript + collides shadow-diff

**File**: `src/app/api/attendance/twiml/route.ts:170-274`

Read-modify-write of `(turnCount, transcript)` with no per-turn idempotency lock. Twilio retries slow webhooks; the AI dispatcher already burns several seconds (sidecar + Gemini), so the retry window IS reachable in tail latency.

**Race**:
1. A: read `turnCount=3`, `transcript=[...3]`
2. B: read `turnCount=3`, `transcript=[...3]`
3. A: dispatch → reply A → push(parent, agent A) → update(turnCount=4, transcript=5 entries)
4. B: dispatch → reply B → push(parent, agent B) → update(turnCount=4, transcript=5 entries — **OVERWRITES A**)

**Effects**:
- Transcript divergence — Firestore stores reply B; the **parent heard reply A**
- Shadow-diff collision on `${callSid}__${turnNumber:04d}` → one parity row lost
- 2× Gemini + 2× sidecar spend per retry
- Post-call summary shown to teacher uses the wrong agent branch

**Repro**: `qa/forensics/repros/F5-006-twiml-retry-transcript-double.mjs`

**Fix**: claim a per-turn lock with `.create()`:

```ts
const newTurnCount = turnCount + 1;
const lockRef = outreachRef.collection('turn_locks').doc(`${newTurnCount}`);
try {
    await lockRef.create({ callSid, claimedAt: FieldValue.serverTimestamp() });
} catch (err) {
    if (isAlreadyExistsError(err)) {
        // Return the TwiML we cached on the lock doc, OR a no-op gather
        const cached = (await lockRef.get()).data()?.twiml;
        if (cached) return new Response(cached, { headers: { 'Content-Type': 'text/xml' } });
    }
    throw err;
}
// proceed with dispatch, then write twiml back to the lock doc
```

---

## P2 — F5-005 — Razorpay 'failed' retry CAS window

**File**: `src/app/api/webhooks/razorpay/route.ts:54-67`

```ts
if (existingStatus === 'failed') {
    await eventRef.update({ status: 'processing', retriedAt: new Date() });
}
```

Two retries of a previously-failed event both read `status='failed'` and both flip to `'processing'` without atomic CAS. Both handlers run.

**Today**: no double-charge. All handler payloads are idempotent at the value level:
- `subscription.charged` → updates `planType` to same value
- `subscription.cancelled` → flips to `'free'` (idempotent)
- `setCustomUserClaims` → idempotent
- `pendingSignInLinks/{userId}` → deterministic doc id, `set merge: true`

**Latent risk**: a future non-idempotent side-effect (e.g. send referral bonus, fire analytics event, post to Slack) would double-fire.

**Repro**: `qa/forensics/repros/F5-005-razorpay-failed-retry-window.mjs`

**Fix**: CAS in a transaction:

```ts
await db.runTransaction(async (tx) => {
    const snap = await tx.get(eventRef);
    if (snap.data()?.status !== 'failed') {
        throw new AlreadyClaimed();
    }
    tx.update(eventRef, { status: 'processing', retriedAt: new Date() });
});
```

---

## Non-Findings (verified safe)

| ID    | Surface                                                  | Verdict |
|-------|----------------------------------------------------------|---------|
| F5-N1 | `src/lib/sidecar/shadow-diff.ts` parent-call writer       | `callSid__turnNumber:04d` — deterministic, safe (except via F5-006). |
| F5-N2 | `groups.ts:341-403` join/leave group                      | Wrapped in `runTransaction`. Safe. |
| F5-N3 | `messages.ts:233` unread counter                          | Inside same `runTransaction` as message write. Safe. |
| F5-N4 | `groups.ts:117-118` auto-join subject-grade group         | `.create()` claims membership; ALREADY_EXISTS skips increment. Safe. |
| F5-N5 | `razorpay/route.ts:47` initial event idempotency          | `eventRef.create()` atomically fails on duplicate. Safe on first delivery; only retry-window has F5-005. |
| F5-N6 | `usage-counters.ts:99` `incrementUsageCounter`            | Pure `FieldValue.increment`. Atomic. Safe. |

---

## Recommended Fix Order

1. **F5-002** (P0) — wrap toggleLike in `runTransaction` in both `community.ts` and `groups.ts`. One file each, narrow blast radius.
2. **F5-001** (P1, blast radius = 17 dispatchers) — one-line fix in `shadow-diff-writer.ts`. Add UUID suffix to doc-id. Unlocks Q4C promotion-gate accuracy.
3. **F5-006** (P1, customer-trust) — turn-lock pattern in twiml route.
4. **F5-004** (P1, cost + trust) — guard doc for new-teacher fanout.
5. **F5-003** (P1, cosmetic counter) — `runTransaction` around save flow.
6. **F5-005** (P2, latent) — CAS the failed→processing flip.

---

## Repros

```
qa/forensics/repros/F5-001-shadow-diff-doc-collision.mjs       node-runnable (synthetic; confirms 199/200 collisions)
qa/forensics/repros/F5-002-like-toggle-toctou.mjs              preview-env required
qa/forensics/repros/F5-003-save-resource-toctou.mjs            preview-env required
qa/forensics/repros/F5-004-profile-double-submit-fanout.mjs    preview-env required
qa/forensics/repros/F5-005-razorpay-failed-retry-window.mjs    preview-env required
qa/forensics/repros/F5-006-twiml-retry-transcript-double.mjs   preview-env required
```
