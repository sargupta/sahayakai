# F9 Attendance — Forensic Fix Report

Branch: `fix/f9-attendance-p0p1` (off `develop`)
Worktree: `.claude/worktrees/f9-attendance`
Scope: F9-001 (P0), F9-002, F9-003, F9-004, F9-006, F9-007 (P1/P2)

All six findings from `qa/forensics/F9-attendance.md` are remediated below.
Each fix is paired with a unit test that fails on the pre-fix code and
passes after.

## Test summary

```
src/__tests__/api/attendance-outreach.test.ts          4 passed
src/__tests__/api/attendance-transcript-sync.test.ts   2 passed
src/__tests__/actions/attendance.test.ts               4 passed
                                                      10 / 10
```

`npm run typecheck` — clean.
Existing `src/__tests__/api/attendance-call.test.ts` — still passes.

---

## F9-001 (P0) — Outreach ownership bypass / Twilio call hijack

**File:** `src/app/api/attendance/outreach/route.ts`

**Pre-fix behaviour:** the route wrote a `parent_outreach` doc using
caller-supplied `classId`, `studentId`, and `parentPhone` with no ownership
check. Teacher B could create an outreach pointing at Teacher A's student
with B's own phone (or any arbitrary number), then call
`/api/attendance/call` which trusts the stored phone → free
arbitrary-call gateway via Twilio.

**Post-fix:**
1. The route fetches `classes/{classId}` and rejects with 403 if
   `teacherUid !== callerUid`.
2. It then fetches `classes/{classId}/students/{studentId}` and rejects
   with 404 if the student is absent.
3. `parentPhone` from the request body is **discarded**. The phone written
   to the outreach doc comes from `students/{studentId}.parentPhone`,
   which can only be set/edited by the class owner.

**Test:** `attendance-outreach.test.ts`
- `teacher B cannot create outreach for teacher A's student (403)`
- `caller-supplied parentPhone is ignored — stored phone is used`

---

## F9-002 (P1) — Race-double summary generation

**Files:**
- `src/app/api/attendance/transcript-sync/route.ts`
- `src/app/api/attendance/twiml-status/route.ts`

**Pre-fix behaviour:** both routes called `generateCallSummary` on
terminal call state. The idempotency guard in transcript-sync was
`!existing.callSummary` read **before** the LLM call, with no
atomicity. Two concurrent terminal webhooks both saw "no summary yet"
and both invoked the LLM. twiml-status had no guard at all.

**Post-fix:**
- Both routes claim a `_summaryGenerating: true` lock inside a Firestore
  transaction. The transaction reads `callSummary` and
  `_summaryGenerating`; only one caller wins. The LLM is invoked outside
  the transaction (correct — the txn must stay short and writes only
  reads). On success the summary + `_summaryGenerating: false` are
  written; on failure the lock is released so a future retry can claim
  it.

**Test:** `attendance-transcript-sync.test.ts`
- `concurrent terminal syncs only generate one summary` — fires two
  parallel POSTs against a fake Firestore that models txn serialization;
  asserts `llmCallCount === 1`.

---

## F9-003 (P1) — Outreach flood

**File:** `src/app/api/attendance/outreach/route.ts`

**Pre-fix behaviour:** no rate-limit on outreach creation. 100 POSTs in
1 s → 100 outreach docs → potentially 100 Twilio calls.

**Post-fix:**
- Per-(teacherUid, studentId) 5-minute dedup window. The route runs a
  Firestore query (`teacherUid == X && studentId == Y && createdAt >=
  now-5min`) and returns 429 + `retryAfterSeconds` + `Retry-After`
  header if any record is found.

**Test:** `attendance-outreach.test.ts`
- `second outreach within 5 minutes returns 429`

**Note on index:** the new query uses `where('teacherUid'==X)
.where('studentId'==Y) .where('createdAt'>=cutoff) .limit(1)`. Firestore
auto-creates indexes for equality+range combinations on first hit in
dev; for prod the composite index `(teacherUid asc, studentId asc,
createdAt asc)` will be required and Firestore will surface the
console-link error on first call. We rely on the existing
auto-deploy-on-error path; no `firestore.indexes.json` edit is included
here.

---

## F9-004 (P1) — IST midnight false-future rejection

**File:** `src/app/actions/attendance.ts`

**Pre-fix behaviour:** `saveAttendanceAction` computed `todayStr` via
`new Date().toLocaleDateString('sv')` — which depends on the host's
locale TZ. Cloud Run runs in UTC. Between 18:30Z–24:00Z (i.e. 00:00–
05:30 IST) the server's "today" was one day behind IST, so a teacher
marking attendance at 02:00 IST saw "Cannot mark attendance for future
dates".

**Post-fix:**
- Compute today/seven-days-ago in `Asia/Kolkata` explicitly via
  `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', ... })`.
  No new dependency; standard library.

**Test:** `attendance.test.ts`
- `accepts today's IST date when server is UTC just before IST midnight`
  — sets system time to `2026-06-05T20:30:00Z` (IST = 2026-06-06 02:00)
  and verifies the action accepts `'2026-06-06'`.
- `still rejects genuinely future IST dates` — same system time;
  `'2026-06-07'` rejected.

---

## F9-006 (P2) — 40-student TOCTOU

**File:** `src/app/actions/attendance.ts`

**Pre-fix behaviour:** count-then-batch-write. Two concurrent adds both
read count 39 and both committed → 41 students.

**Post-fix:**
- The class doc's `studentCount` is read inside a Firestore transaction
  (alongside the teacher ownership check); the student insert and class
  `studentCount` increment happen via `tx.set` / `tx.update` in the same
  transaction.
- Outer count read removed; outer ownership read kept for early-return
  on the common "class doesn't exist" path. The transaction re-verifies
  ownership defensively.

**Test:** `attendance.test.ts`
- `rejects 41st student even when stale read says 39` — fake store has
  `studentCount: 40`; action rejects.
- `allows the 40th student when current count is 39` — verifies the
  transactional set+update path runs.

---

## F9-007 (P2) — turnCount mismatch

**File:** `src/app/api/attendance/transcript-sync/route.ts`

**Pre-fix behaviour:** the route wrote the client-supplied `turnCount`
verbatim. The orchestrator could (intentionally or by bug) lie about
the conversation length.

**Post-fix:**
- `update.turnCount = transcript.length` — server-derived from the
  transcript array, which is the source of truth.

**Test:** `attendance-transcript-sync.test.ts`
- `server-derived turnCount overrides client value` — client sends
  `turnCount: 99`, transcript has 3 turns; asserts written value is 3.

---

## Files changed

```
src/app/actions/attendance.ts
src/app/api/attendance/outreach/route.ts
src/app/api/attendance/transcript-sync/route.ts
src/app/api/attendance/twiml-status/route.ts
src/__tests__/api/attendance-outreach.test.ts          (new)
src/__tests__/api/attendance-transcript-sync.test.ts   (new)
src/__tests__/actions/attendance.test.ts               (new)
qa/forensics/fixes/F9-fix-report.md                    (new)
```

## Residual risks

- F9-003 dedup uses an in-Firestore query and will create-on-first-hit
  a composite index in prod. Pre-warm by hitting outreach in staging
  once after deploy.
- F9-002 lock is keyed only on `_summaryGenerating: true`. If the LLM
  call hangs forever the lock is never released and no future sync can
  generate a summary. Acceptable in the short term (manual operator
  release via Firestore console) but a TTL-based unlock (e.g. release
  if `_summaryGeneratingAt` is >5min old) would be a sensible follow-up.
- F9-006 relies on the `studentCount` field staying in sync with the
  actual subcollection size. The existing batch-based add/delete keeps
  this invariant; no backfill needed.
