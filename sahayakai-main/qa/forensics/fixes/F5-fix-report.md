# F5 Race-Condition Fix Report

Branch: `fix/f5-race-conditions` (forked off `develop`)
Worktree: `.claude/worktrees/f5-race-fixes/`
Reference forensic: `qa/forensics/F5-race-concurrency.md`

All six findings closed. Six regression tests added under
`src/__tests__/race-conditions/`. All tests pass; `tsc --noEmit` reports
zero new type errors on the touched files.

---

## F5-002 (P0) — `toggleLikeAction` / `likeGroupPostAction` TOCTOU

**Bug.** The pre-read of `likeRef.exists` decided "like vs. unlike" outside
the write. N concurrent toggles from the same user could all observe
`!exists`, all set the like-doc (idempotent), and all fire
`FieldValue.increment(+1)`, inflating `likesCount` by N while only one
like-doc landed.

**Fix.** Wrapped the read-decide-write in `db.runTransaction(...)`:

- `src/app/actions/community.ts` — `toggleLikeAction`
- `src/app/actions/groups.ts` — `likeGroupPostAction`

The transaction snapshots `likeRef` and atomically deletes/sets the
like-doc and updates the counter. Firestore retries the closure if any
read doc changed between snapshot and commit — final state is always one
like-doc and a delta of +1 or 0.

**Regression test.** `src/__tests__/race-conditions/f5-002-toggle-like-toctou.test.ts`
fires 10 concurrent `toggleLikeAction` calls from the same user against
an in-memory Firestore mock with faithful optimistic-locking semantics.
Asserts `likesCount === 0 or 1` and `likeDocs === likesCount`.

---

## F5-001 (P1, CRITICAL — gates Q4C) — shadow-diff doc-id collision

**Bug.** `src/lib/sidecar/shadow-diff-writer.ts` used
`${uid}__${Date.now()}` as the Firestore doc-id. Same-millisecond bursts
collided — 200 same-ms calls produced one unique id and 199 silent
`.set()` overwrites. Q4C parity rollups were lossy and the canary→full
promotion gate could not be trusted.

**Fix.** Doc id is now
`${uid}__${Date.now()}__${crypto.randomUUID().slice(0,8)}`. 8 hex chars
(4 bytes of entropy) is more than enough to disambiguate thousand-per-ms
bursts.

**Regression test.** `f5-001-shadow-diff-doc-id-unique.test.ts` freezes
`Date.now()` and fires 200 same-uid calls; asserts 200 unique doc-ids
and that every id matches `^user-1__\d+__[0-9a-f]{8}$`.

---

## F5-003 (P1) — community resource save TOCTOU

**Bug.** `saveResourceToLibraryAction` had the same pattern as F5-002 —
pre-read `saveRef.exists`, then a separate `saveRef.set` and
`resRef.update({'stats.saves': increment(1)})`. Concurrent saves inflated
`stats.saves`.

**Fix.** Wrapped the existence check + counter increment in a
transaction; downstream side-effects (library copy, notification, pubsub)
are short-circuited via the returned `alreadySaved` flag.

**Regression test.** `f5-003-save-resource-toctou.test.ts` fires 10
concurrent saves from one user. Asserts `stats.saves === 1` and exactly
one save-doc exists.

---

## F5-004 (P1) — profile fanout N× under double-submit

**Bug.** Profile route POST could be double-submitted (form retry or
parallel `useEffect`s). Each call fanned out
`fanoutNewTeacherJoinedNotification`, blasting the same nearby teachers
N times.

**Fix.** Added a `newTeacherFanoutCompleted` boolean marker on the user
doc, read+set inside a transaction at the very top of
`fanoutNewTeacherJoinedNotification`. The second caller observes
`marker === true` and returns before the candidate query / batch write.

**Regression test.** `f5-004-profile-fanout-once.test.ts` fires 5
concurrent fanout calls for the same teacher; asserts the marker is set
and the batch-commit hook fires at most once.

---

## F5-006 (P1) — Twilio twiml retry race

**Bug.** Twilio retries webhooks on 5xx/timeout. The handler did
`transcript: TranscriptTurn[] = data.transcript`, pushed a new turn, and
wrote back the whole array. A retried turn re-pushed itself; concurrent
turns silently overwrote each other via last-write-wins.

**Fix.** Added `appendTurnAtomically(outreachRef, callSid, turnNumber,
role, turn)` helper in `src/app/api/attendance/twiml/route.ts`. It:

1. Writes the turn to `parent_outreach/{outreachId}/turns/{callSid}__{turn:04d}__{role}`
   (deterministic doc-id → retries collapse to an idempotent set).
2. Inside the same `runTransaction`, snapshots `transcript` from the
   parent doc, appends the turn, and writes back. Concurrent transactions
   abort on a stale read and retry.
3. If the per-turn sub-doc already exists, the closure short-circuits
   without mutating the parent.

Both the parent and agent turn writes in POST plus the opening agent
turn write in GET now flow through this helper.

**Regression test.** `f5-006-twiml-append-only.test.ts` fires 3 parallel
"Twilio retry" appends of the same `(callSid, turn, role)`; asserts the
transcript array contains the turn exactly once and the `turns`
subcollection holds a single deterministic doc.

---

## F5-005 (P2) — Razorpay failed→processing CAS

**Bug.** Latent: two parallel webhook retries of a `status=failed` event
could both observe `failed`, both flip to `processing`, and both run the
side-effect pipeline. Today's effects are idempotent; any future
non-idempotent step (e.g. a credit grant) would double up.

**Fix.** Wrapped the status flip in `db.runTransaction(...)` in
`src/app/api/webhooks/razorpay/route.ts`. Exactly one retrier wins the
`failed → processing` transition; everyone else observes the new state
and returns `already_processed`.

**Regression test.** `f5-005-razorpay-cas.test.ts` fires 3 concurrent
flip attempts; asserts exactly one wins and the final status is
`processing`.

---

## Test results

```
PASS src/__tests__/race-conditions/f5-001-shadow-diff-doc-id-unique.test.ts
PASS src/__tests__/race-conditions/f5-002-toggle-like-toctou.test.ts
PASS src/__tests__/race-conditions/f5-003-save-resource-toctou.test.ts
PASS src/__tests__/race-conditions/f5-004-profile-fanout-once.test.ts
PASS src/__tests__/race-conditions/f5-005-razorpay-cas.test.ts
PASS src/__tests__/race-conditions/f5-006-twiml-append-only.test.ts

Test Suites: 6 passed, 6 total
Tests:       6 passed, 6 total
```

Pre-existing tests verified green: `community-likes.test.ts`,
`groups.test.ts`.

## Files changed

- `src/app/actions/community.ts`
- `src/app/actions/groups.ts`
- `src/lib/sidecar/shadow-diff-writer.ts`
- `src/lib/notifications/fanout.ts`
- `src/app/api/attendance/twiml/route.ts`
- `src/app/api/webhooks/razorpay/route.ts`
- `src/__tests__/race-conditions/f5-001…f5-006*.test.ts` (new)
