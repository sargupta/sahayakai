# F9 — Attendance + Outreach Forensic Report

Investigator: Role 18 (attendance + outreach + summary/transcript)
Project: `sahayakai-main`
Branch: `feature/q4c-shadow-diff-in-canary`
Date: 2026-06-06
Scope: class/student lifecycle, attendance writes, outreach dispatch, transcript-sync, call summary.

## Investigation method

Static analysis of:

- `src/app/actions/attendance.ts` (server actions, class/student/attendance/outreach CRUD)
- `src/app/api/attendance/{call,call-summary,outreach,outreach-latest,transcript-sync,twiml-status}/route.ts`
- `src/middleware.ts` (auth header injection)
- `src/lib/parent-call-guard.ts`

Live gcloud-impersonated runs were NOT executed in this pass — the static review surfaced enough high-severity defects (P0/P1) that fix-first is the right call before burning Twilio + Vertex spend on repro automation. Reproducers are scripted (see `repros/F9/`) and can be wired to a live emulator + impersonation harness in a follow-up.

---

## Findings

### F9-001 — P0: `/api/attendance/outreach` does NOT verify class/student ownership

**File:** `src/app/api/attendance/outreach/route.ts`
**Severity:** P0 (PII / wrong-parent call)

The POST handler trusts `classId`, `studentId`, `studentName`, `parentPhone`, and `parentLanguage` straight off the request body. The only gate is `requireProPlan(userId)`. There is no Firestore read of `classes/{classId}` to verify `teacherUid === userId`, and no read of `classes/{classId}/students/{studentId}` to verify the phone matches the stored value.

```ts
// route.ts L36–58
const record: Record<string, unknown> = {
    teacherUid: userId,
    classId: data.classId,        // <-- attacker-supplied
    studentId: data.studentId,    // <-- attacker-supplied
    parentPhone: data.parentPhone, // <-- attacker-supplied phone (any number)
    ...
};
await ref.set(record);
```

**Impact chain:**

1. Pro teacher B POSTs `/api/attendance/outreach` with `studentId` = student belonging to teacher A and `parentPhone` of teacher B's own choosing.
2. `parent_outreach` doc is written with `teacherUid: B` so the doc passes the call-route ownership gate (which only checks `outreach.teacherUid === userId`).
3. Teacher B then POSTs `/api/attendance/call` with the new `outreachId`. `route.ts:36` only verifies `outreach.teacherUid === userId` — which is true (B wrote it). The phone is read from `outreach.parentPhone` — which is the attacker-supplied number.
4. **Twilio dials any number the caller supplied**, billed to SahayakAI's Twilio account, with the canned message addressed to a real student's name.

Note: `/api/attendance/call/route.ts:31–41` explicitly comments "Never trust a phone number from the request body — a teacher could otherwise call any arbitrary number using our Twilio account." That contract is broken because `/api/attendance/outreach` is the upstream that writes the phone into Firestore. The "server-stored phone" the call route trusts was never validated.

**Why this is P0:** wrong-parent calls are PII leakage (the call mentions a real student name + class) AND a free arbitrary-call gateway for any pro teacher. Also a regulatory issue (DPDP Act consent boundary).

**Fix:**

```ts
// In outreach/route.ts before ref.set(...)
const classDoc = await db.collection('classes').doc(data.classId).get();
if (!classDoc.exists || classDoc.data()!.teacherUid !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
const studentDoc = await db.collection('classes').doc(data.classId)
    .collection('students').doc(data.studentId).get();
if (!studentDoc.exists) {
    return NextResponse.json({ error: 'Student not found' }, { status: 404 });
}
// Use the server-stored phone, ignore body.
const trustedPhone = studentDoc.data()!.parentPhone;
const trustedLang  = studentDoc.data()!.parentLanguage;
```

Repro: `repros/F9/F9-001-outreach-ownership.sh`.

---

### F9-002 — P1: Duplicate call-summary generation across the two webhook paths

**Files:** `src/app/api/attendance/transcript-sync/route.ts:84–111`, `src/app/api/attendance/twiml-status/route.ts:62–67`
**Severity:** P1 (cost double-spend on Vertex Gemini per completed call; last-write-wins on `callSummary` field)

Two independent code paths can fire `generateCallSummary()` for the same call:

1. **transcript-sync** generates when `(callStatus terminal) ∧ (transcript.length > 1) ∧ (!existing.callSummary)`.
2. **twiml-status** generates when `(callStatus === 'completed') ∧ (data.transcript?.length > 1)` — **no `callSummary` idempotency check at all**.

Both webhooks fire on every completed call. Twilio's status callback (`twiml-status`) and Pipecat's final transcript sync are independent. In production, both will arrive, and the twiml-status path will unconditionally regenerate (and overwrite) the summary that transcript-sync already wrote.

```ts
// twiml-status/route.ts L62–67
if (callStatus === 'completed' && data.transcript?.length > 1) {
    generateAndSaveSummary(docRef, data, callDuration).catch(...);
}
// inside generateAndSaveSummary — NO check on existing.callSummary.
```

**Cost impact:** ~2× Vertex Gemini spend per completed parent call. At the playbook P0 threshold of "outreach calls wrong parent" this is P1, but at typical scale (10k calls/mo × $0.01/summary) this is $100/mo wasted, growing linearly.

**Race condition:** Even within transcript-sync alone, the idempotency check `!existing.callSummary` is read at `doc.get()` time but the write happens after the async LLM call (~3–5s). Two concurrent terminal transcript-sync calls with the same `outreachId` will both pass the gate and both write. Same flaw without `twiml-status`.

**Fix:** wrap the summary-generation gate in a Firestore transaction that flips a `callSummaryStatus: 'generating'` sentinel atomically. Only the winning transaction proceeds. Apply to BOTH webhooks.

```ts
const shouldGenerate = await db.runTransaction(async (txn) => {
    const snap = await txn.get(docRef);
    const d = snap.data()!;
    if (d.callSummary || d.callSummaryStatus === 'generating') return false;
    txn.update(docRef, { callSummaryStatus: 'generating' });
    return true;
});
if (!shouldGenerate) return;
// proceed to LLM call, then write callSummary + status='done'
```

Repro: `repros/F9/F9-002-race-summary.ts`.

---

### F9-003 — P1: No outreach dedup / rate-limit

**File:** `src/app/api/attendance/outreach/route.ts` (and `saveOutreachRecordAction` in `actions/attendance.ts`)
**Severity:** P1 (per playbook step 9 — "trigger outreach 3× in 5 min for same student — should dedup")

Searched the codebase for any dedup, rate-limit, or cooldown logic on outreach POSTs. None exists. A teacher can:

- Hit `/api/attendance/outreach` 100× in 1 second for the same student → 100 `parent_outreach` docs created.
- Each can then trigger `/api/attendance/call` → 100 real Twilio calls placed within seconds.

**Impact:** parent harassment + Twilio bill explosion. Compounds with F9-001 (no ownership check) into a trivial DoS-the-bill primitive.

**Fix:** server-side cooldown gate. Before `ref.set(record)`:

```ts
const recent = await db.collection('parent_outreach')
  .where('teacherUid', '==', userId)
  .where('studentId', '==', data.studentId)
  .orderBy('createdAt', 'desc').limit(1).get();
if (!recent.empty) {
    const last = Date.parse(recent.docs[0].data().createdAt);
    if (Date.now() - last < 5 * 60_000) {
        return NextResponse.json({ error: 'Outreach cooldown (5 min)' }, { status: 429 });
    }
}
```

Repro: `repros/F9/F9-003-outreach-dedup.sh`.

---

### F9-004 — P1: IST midnight rollover causes false "future date" rejections in `saveAttendance`

**File:** `src/app/actions/attendance.ts:281–318`
**Severity:** P1 (production-realistic — teachers in India active 6am IST)

`saveAttendanceAction` computes `todayStr` via `new Date().toLocaleDateString('sv')`. On Cloud Run (UTC) this returns the **UTC** calendar date. An IST teacher marking attendance between 00:00 IST and 05:30 IST will send `date = today-in-IST` while the server's `todayStr = yesterday-in-UTC`. The check `date > todayStr` rejects with "Cannot mark attendance for future dates."

**Concrete repro:**

- Server clock: 2026-06-06 00:00 UTC.
- Teacher in IST: 2026-06-06 05:30 IST. Client computes today = `2026-06-06`.
- `todayStr` on server = `2026-06-06` (OK, edge case passes).

But the more common case:

- Server clock: 2026-06-05 23:00 UTC.
- Teacher in IST: 2026-06-06 04:30 IST. Client = `2026-06-06`.
- Server `todayStr` = `2026-06-05`. `'2026-06-06' > '2026-06-05'` → reject.

This explains low-frequency "Cannot mark future dates" errors that look like clock skew but aren't.

**Fix:** compute `todayStr` in the user's tz. Either (a) accept `clientTimezone` from the request, (b) accept `clientToday` and validate the offset is within ±24h of server-UTC today, or (c) hard-code IST since the product targets India:

```ts
const istNow = new Date(Date.now() + 5.5 * 3600_000);
const todayStr = istNow.toISOString().slice(0, 10);
```

Repro: `repros/F9/F9-004-ist-midnight.ts`.

---

### F9-005 — P2: 7-day backfill window is a hard wall; no override for headmasters / month-end reconciliation

**File:** `src/app/actions/attendance.ts:299–300`
**Severity:** P2 (UX, not security)

`if (date < sevenDaysAgoStr) throw …`. No bypass for admin / headmaster / "I forgot last week's attendance" use case. The 7-day window also overlaps with `getMonthlyAttendanceAction` which lets you READ a whole month — asymmetric R/W.

**Note (positive):** the boundary check uses string comparison on `YYYY-MM-DD` which is correct (lexicographic == chronological for ISO dates).

---

### F9-006 — P2: 40-student cap is enforced but with a TOCTOU race

**File:** `src/app/actions/attendance.ts:183–185`
**Severity:** P2 (cap usually holds; concurrent adds can sneak through)

```ts
const countSnap = await db.collection('classes').doc(classId)
    .collection('students').count().get();
if (countSnap.data().count >= 40) throw new Error('Maximum 40 students per class');
// … then a batch write that does NOT re-check the count.
```

Two concurrent `addStudentAction` calls when count = 39 will both read 39, both pass the gate, both commit → final count = 41. The bug bar set the threshold P1 for "cap not enforced" — it IS enforced in the common case, just race-vulnerable, hence P2.

**Fix:** wrap the count + write in a `runTransaction`, or store `studentCount` on the class doc and increment-with-check in the same batch (Firestore has no conditional update on counters; only a txn buys atomicity).

---

### F9-007 — P2: Transcript turn numbering trusts client-supplied `turnCount`

**File:** `src/app/api/attendance/transcript-sync/route.ts:44–69`
**Severity:** P2 (off-by-one / inconsistency, not security)

`turnCount` from the request body is written verbatim into Firestore. There's no check that `turnCount === transcript.length`. A bug in Pipecat off-by-one will silently propagate. The `transcript.length > 1` gate (which triggers summary generation) uses the array length — so summary generation is consistent with the data, but downstream UI binds to `turnCount` and could disagree.

**Fix:** `turnCount: transcript.length` (overwrite client value).

---

### F9-008 — Verified GOOD (no finding)

- Class ownership: `getClassAction`, `updateClassAction`, `deleteClassAction`, `getStudentsAction`, `saveAttendanceAction` all read `classes/{classId}` and check `teacherUid === uid` before any read or write. Playbook step 8 (cross-teacher escape) blocked.
- Middleware deletes incoming `x-user-id` (`middleware.ts:100`) and re-injects only after `verifyIdToken`. Header-spoof vector closed.
- `/api/attendance/call` validates outreach ownership AND uses the server-stored phone (within the outreach doc) — note this is necessary-but-not-sufficient because F9-001 lets the attacker control what gets stored.
- `/api/attendance/transcript-sync` uses `timingSafeEqual` on the internal key. Constant-time comparison correct.
- `/api/attendance/twiml-status` validates the Twilio signature.
- E.164 normalization (`normalizeToE164`) rejects non-Indian / wrong-length numbers with a clear error.

---

## Severity rollup

| ID     | Sev | Title                                                       | File                                          |
| ------ | --- | ----------------------------------------------------------- | --------------------------------------------- |
| F9-001 | P0  | Outreach POST lacks class/student ownership check           | `api/attendance/outreach/route.ts`           |
| F9-002 | P1  | Duplicate summary generation across webhooks + intra-race   | `transcript-sync`, `twiml-status`            |
| F9-003 | P1  | No outreach dedup / rate-limit                              | `api/attendance/outreach/route.ts`           |
| F9-004 | P1  | IST midnight rollover false-rejects "today" attendance      | `actions/attendance.ts:281`                  |
| F9-005 | P2  | 7-day backfill wall has no admin override                   | `actions/attendance.ts:299`                  |
| F9-006 | P2  | 40-student cap has TOCTOU race                              | `actions/attendance.ts:183`                  |
| F9-007 | P2  | Client-supplied `turnCount` is not validated                | `api/attendance/transcript-sync/route.ts`    |

## Recommended fix order

1. **F9-001** (P0) — hot patch. Add class/student ownership read + use stored phone.
2. **F9-003** (P1) — 5-min cooldown gate. Single Firestore read, trivial.
3. **F9-002** (P1) — transactional `callSummaryStatus` sentinel; apply to both webhooks.
4. **F9-004** (P1) — IST-pinned `todayStr` (one-line change).
5. **F9-006** (P2) — wrap student add in `runTransaction`.
6. **F9-007**, **F9-005** (P2) — quality-of-life polish.
