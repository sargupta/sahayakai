# Class-Wide Batch Calling (Vobiz) — implementation report

Date: 2026-11-10 · Tree: `riya-wt/sahayakai-main` (develop) · Status: implemented, tested with mocked
Vobiz and simulated events, verified in the local app in Practice. **Uncommitted. No real batch call placed.**

## What a teacher does now

1. Open the class (demo teacher → My classes → Sargvision Class, or the console → Riya → Class-Wide Outreach).
2. **Class-Wide Outreach** → choose a reason (e.g. Holiday announcement / School closure) → enter its typed facts.
3. **Preview message and families**: totals (total students, eligible, missing phone, opted out, otherwise
   excluded), Riya's opening and announcement, the list of families (untick to remove), and the families
   not included with the reason.
4. **Start Batch Calls (N)** → confirmation (Practice: "nothing rings"; real: an extra "I confirm N real phones
   will ring" tick).
5. The campaign view shows live progress (total / completed / in progress / pending / failed-no answer,
   plus unknown, callback and do-not-call counts), Pause, Resume, Cancel pending calls, Retry unsuccessful
   (all or selected), each family's status, and each call's synopsis and answers.

## Architecture (reuse, not rebuild)

```
ClassOutreachDialog (UI)
  └─ /api/sampark/[orgId]/batch-calls[/preview|/{id}]     guardBatchRoute → canManageClass
       └─ server/sampark/batch-calls.ts                     orchestration only
            ├─ previewRiyaCall()  per family                (existing: every gate)
            └─ startRiyaCall()    per family, per attempt   (existing: record, idempotency, lock,
                                                             allow-list, caps, Vobiz dial)
                 └─ startVobizRiyaCall()                    (existing: own CallUUID, signed refs)
Vobiz hangup / bridge event → existing handlers → applyEvent() → call record
Campaign mirrors each recipient's CURRENT call (call record = source of truth)
Queue: runBatchTick() on /api/jobs/sampark-dispatch (Cloud Scheduler / local ticker),
       plus "advance" from the open campaign page; both under a per-campaign lease.
```

No new provider, no second Riya agent, no change to ElevenLabs code or to the individual call UI.

Changes to existing code (small, backward compatible):
- `conversation.ts`: `startRiyaCall(…, opts)` takes `lockSlots` (default 1 = the original single-flight
  lock, slot name unchanged) and `batch: {campaignId, recipientId}` stored on the call; locks are released
  by the slot the call holds. Idempotency also checks the batch link.
- `types.ts` (`ConversationCall`): optional `lockSlot`, `batch`.
- `riya-call-panel.tsx`: exports the facts form helpers (reused, not duplicated).
- `auth.ts`: `canManageClass` / `isSchoolStaffForOutreach`; `errors.ts`: `forbidden` (403).
- Dispatch job runs `runBatchTick` after callbacks (never fails the tick).
- Console Riya page shows the Class-Wide Outreach section; demo teacher class page has the button for the
  Sargvision class (the demo's other classes are browser-only and have no school records to call).

New files: `src/lib/sampark/batch/{reasons,types,state,repo,firestore-repo,factory}.ts`,
`src/server/sampark/batch-calls.ts`, `src/server/sampark/batch-http.ts`, three routes under
`src/app/api/sampark/[orgId]/batch-calls/`, `src/lib/api/sampark-batch.ts`,
`src/components/sampark/class-outreach.tsx`, tests `src/__tests__/sampark/batch/batch-calls.test.ts`.

Storage: `sampark_schools/{orgId}/sampark_batch_campaigns/{id}` (single-field queries only: `createdAt`,
`open`, `dedupeKey`; no composite index). Recipients (≤ 100) live on the campaign.

## Batchable vs individual reasons

| Reason | Riya workflow | Batch |
|---|---|---|
| Holiday announcement | holiday_notice | yes |
| School closure | emergency_closure | yes |
| Exam reminder | exam_schedule_notice | yes |
| School event announcement | event_invitation | yes |
| Parent-teacher meeting (general, one date/time) | ptm_invitation | yes |
| Timetable change, homework reminder, policy reminder, other | — | listed, **not available**: Riya has no approved wording; free text never reaches a parent |
| Absence, academic performance, behaviour, achievement | individual workflows | **never** (server refuses `NOT_BATCHABLE`) |
| Personal PTM slot per parent | — | stays individual (one fact per class only) |

Riya's line is the shared, typed announcement; each call's variables carry that family's child name,
class and school from records. Nothing personal is invented.

## Safeguards

- **Authority**: org admin → any class; teacher → only classes on their server-managed member record
  (`organizations/{org}/members/{uid}`, `role: 'teacher'`, `samparkClasses: ["7-A"]`; members are
  Admin-SDK-write-only). Re-checked when each queue pass dials; a creator who loses the class pauses it.
- **Every gate per call** (via `previewRiyaCall` at preview AND at dial time): consent (incl. recorded
  conversation), opt-out / suppression / CRM do-not-contact, custody & sensitive flags, frequency cap,
  language (English only), calling hours & holidays, school pause, guardian of record, number class.
- **Sargvision allow-list unchanged**: only `SAMPARK_RIYA_TEST_ALLOWED_NUMBERS` contacts can be in a real
  batch (others excluded as "Not on the real-call allow-list"); per-contact daily cap unchanged.
- **Real batches fail closed**: need `SAMPARK_BATCH_REAL_CALLS=true` (launcher `--batch-real`, off by
  default), per-contact numbers (a Test-mode school that rings one test phone is refused
  `BATCH_NEEDS_OWN_NUMBERS`), and the explicit confirmation tick. Live mode stays refused by `startRiyaCall`.
- **Provider**: the campaign records the provider at start and every call uses it. ElevenLabs selected →
  real batch refused (`BATCH_PROVIDER_NOT_SUPPORTED`), never silently routed through Vobiz. A mode/provider
  change mid-campaign pauses it (`PROVIDER_CHANGED`).
- **Throttling**: rolling scheduler, see "Rolling scheduler (2026-11-13)" below: at most 3 lines,
  ≥ 60 s between accepted launches; `SAMPARK_BATCH_DAILY_LIMIT` (200) unchanged.
- **Duplicates**: one campaign per (class, canonical facts) — `DUPLICATE_CAMPAIGN`; a repeated request key
  returns the same campaign; each attempt's idempotency key = hash(campaign, recipient, attempt), so a
  crash/retry can never dial twice; a family already reached about the same announcement (any campaign
  or individual call) is skipped; a family with any call in flight is deferred; one call per family.
- **Outcomes**: answered/completed, busy, no answer (incl. rejected/timeout causes), invalid number /
  provider refusal (failed), network/5xx (unknown — never auto-redialled), still in progress (read-only
  provider lookup after 2 min; shown `unknown` after 20 min, a late result still lands).
- **Callback requests** → the existing proposed-callback flow against that call's family; never redialled
  by the batch, not retryable. **Do-not-call** → existing suppression; not retryable; excluded from later
  batches as opted out.
- **Pause** stops new dials only; ringing calls finish and are recorded. **Resume** dials only pending
  families. **Cancel** marks pending families "not called"; in-flight results still land. **Retry** is
  explicit, only no-answer/busy/failed, never after stop/callback, max 3 attempts; an old attempt's late
  event cannot overwrite the new attempt.
- **Privacy**: each call has its own record, context (signed per-call ref), transcript and synopsis; the
  campaign and API never carry transcripts or full numbers (names + last 4 only).

## Tests

`src/__tests__/sampark/batch/batch-calls.test.ts` — 29 tests, all pass. Mocked Vobiz REST (each dial
recorded with its own CallUUID) and simulated Vobiz hangups / signed bridge events through the production
handlers. Covers the 15 scenarios: 30 eligible (Practice and Vobiz, concurrency 2, own number/context/
transcript per call), missing phones, opt-outs/no consent/language, partial progress, pause/resume,
cancel, one failure among successes + explicit retry + stale event, duplicate campaign / request key /
already-called family / crash recovery, callback request, do-not-call, individual-only reasons,
teacher/class permissions (+ creator losing access), concurrent campaigns, webhook matching out of order
with duplicates, individual Riya call unchanged; plus ElevenLabs refusal, real-call switch +
confirmation, test-phone school refusal, calling-hours wait, daily limit, audit trail.

Regression: full Sampark suite 103 suites / 1866 tests pass (12 skipped, as before). `tsc --noEmit` clean.
ESLint clean on the new files. Design-token gate passes (630 < 744).

Browser (local app on :3000, Sargvision class in Practice): configure → preview (9 students, 9 eligible,
opening + announcement, family list) → confirm → campaign completed 9/9 with per-call synopsis and
answers; phone-width layout checked. This created one practice campaign and 9 simulated calls in the
local emulator (School closure, 11 Nov, heavy rain); nothing rang.

## Rolling scheduler (2026-11-13)

Before: one call at a time (`SAMPARK_BATCH_MAX_CONCURRENCY` default 1), a fixed dial gap, advanced
only by the dispatch tick and the open page. Now: **at most 3 calls in flight per school, a new call at
most every 60 s, a freed line filled the moment both rules allow.**

| Setting (server-side only) | Default | Notes |
|---|---|---|
| `SAMPARK_BATCH_MAX_CONCURRENCY` | 3 | hard ceiling 3 in code (`BATCH_CONCURRENCY_HARD_MAX`); nothing from a browser takes part |
| `SAMPARK_BATCH_DIAL_GAP_SECONDS` | 60 | minimum gap between launches the provider **accepted** |
| `SAMPARK_VOBIZ_MAX_CONCURRENT_CALLS` | unset | verified account limit; the launcher reads it live from Vobiz with `--vobiz-call` |
| `SAMPARK_RIYA_MAX_CONCURRENT_SESSIONS` | unset | AI backend capacity (Gemini Live / ASR sessions) |

Effective concurrency = min(3, app setting, provider limit, AI capacity); the campaign records which
one won (`concurrencySource`) and the progress view says so.

**Source of truth for "active"** = the call records (`holdsLine`, `src/lib/sampark/batch/schedule.ts`):
a call holds a line until its record is terminal or Vobiz reports the line ended (`carrier_ended`). A
dial whose acceptance we never read (network/5xx/lost mid-request) holds a line until the provider
must have ended it. Nothing is kept in memory, so restarts and extra workers see the same count.

**Global 3-line limit**: (1) the record count above, re-read before every launch, across every campaign
and individual Riya call of the school; (2) the per-school lock slots `riya:{org}`, `#1`, `#2` taken
atomically by `startRiyaCall` (individual calls use slot 0). Scope: per school. The Vobiz account
limit is account-wide (shared by every school/product on the credentials); across schools only
Vobiz's 429 + our backoff protect it.

**60 s interval**: (1) from the records: the newest *accepted* batch launch of the school (any campaign),
so it survives restarts; (2) an atomic launch gate `riya-batch-launch:{org}`, a lock that lives one
interval, so two workers that both read "due" cannot both launch. A refused launch (4xx/429) returns
the gate and never starts the interval.

**Wake-ups (hybrid)**: a call reaching a final outcome, or Vobiz's hangup for an answered call, frees its
lock slot and wakes the campaign at once (`batch-wake.ts`). A wake during a running pass is never
dropped: in-process it re-runs the pass, across workers it leaves `rerunRequested` on the campaign. A
pass that ends waiting for the interval or a backoff arms a timer for exactly that moment. Pause /
resume / retry / cancel act directly; the dispatch tick (Cloud Scheduler, local `--ticker` 30 s)
remains the reconciliation fallback.

**Provider-enforced end**: every Riya Vobiz call now carries `time_limit=660` s (Vobiz default is 4 h;
the bridge already ends calls at 600 s). Hard end = 30 s ring + 660 s + 3 min = 14.5 min, below the
15-min lock lifetime.

**Stuck calls**: past the hard end the provider is asked (read-only lookup). It reports an end → recorded
through the reducer; the line ended but no bridge result → `unknown` (`no_result:carrier_ended_no_report`);
still connected → the line stays held and `batch_campaign.call_overrun` is audited once; no record /
unreachable → `unknown` (the provider's own time limit has passed), audited `batch_campaign.call_stale`.
`unknown` is never redialled; a late authentic result still lands on it.

**Rate limits**: Vobiz answers CPS, concurrency and error-budget breaches with 429. The family stays
queued and keeps its attempts (`launchFailures` gives the next launch a new idempotency key, max 5);
the school-wide backoff is computed from the records: 60 s doubling (cap 15 min), or `Retry-After` if
longer. Nothing is submitted during it.

**Webhook safety**: events are idempotent by id; settle (free the line, wake, audit, callback proposal)
runs only on the transition INTO a final outcome; a late ring failure can no longer rewrite a final
outcome (busy stays busy); a late "ringing" can't revive a finished call.

**Verified limits (2026-11-12, read-only GET of the Vobiz Account object)**: `concurrent_calls_limit` 3,
`cps_limit` 1 (base, none purchased). Docs: vobiz.ai/docs `account/account-object`, `rate-limits`,
`faq/error-429`, `call/make-call` (`time_limit`). Note `GET /Account/{id}/` (trailing slash) 307s to a
plain-http host; `/Account/{id}` works. Bridge: `VOBIZ_MAX_CONCURRENT_CALLS` 8 per process,
`VOBIZ_MAX_CALL_SECONDS` 600. **Not verified**: Vertex Live API and Speech-to-Text (chirp_2) concurrent
session quotas for the project; set `SAMPARK_RIYA_MAX_CONCURRENT_SESSIONS` once known.

Brief's timeline note: the brief's table shows Call 4 at 04:00 after Call 2 ends at 03:30, but its
own rule ("launch immediately if the 60-second interval has already elapsed", "no unnecessary extra
waiting") gives 03:30, since the last launch was 02:00. The scheduler follows the rule (03:30), and
likewise 04:30 for Call 5.

Tests: `src/__tests__/sampark/batch/rolling-scheduler.test.ts` (32: the brief's 26 + pure rules + Vobiz
client), `lifecycle-demo.test.ts` (a 9-family controlled batch through the production handlers; set
`BATCH_DEMO_OUT` to write its timeline), `batch-calls.test.ts` (29). A mutation check (launch gate
disabled) makes the race tests 17/17b fail.

## Not done / open

- **First real batch, 2026-11-13 15:28 IST** (user-approved; campaign `cc31d8f3…`, Class 10A, PTM 21 Nov
  10:30; allow-list Alyssa, Nischay, Varunesh only; preflight: 3 parallel synthetic sessions OK, replies
  p50 1.8 s / p90 2.9 s). Launches 15:28:10, 15:29:10, 15:30:11 (60 s rule held); at most 2 lines
  overlapped (Alyssa 94 s, Nischay 35 s, Varunesh 78 s), so 3 simultaneous REAL lines were not exercised.
  Nischay said he was not the guardian → Riya closed `unverified` without the details (privacy gate
  correct). Varunesh's line was freed on Vobiz's hangup (`carrier_ended`) before the bridge report.
  All 3 completed; campaign completed 15:31:49. Synopses came from the rules fallback (no model synopsis
  locally). To run again: launcher `--vobiz-call … --batch-real`, explicit confirmation per batch.
- ElevenLabs batches are refused by design in this release (the brief asked to verify Vobiz only).
- Teacher class assignments (`samparkClasses` on member records) have no admin UI yet; admins work today.
- i18n: new strings go through `t()` but have no dictionary entries yet (same as the existing Riya panel).
- Timetable / homework / policy / other reasons need approved Riya workflows (agent + bridge) first.
- A campaign closes when nothing is pending or in flight; a result that arrives after that is mirrored
  when the campaign is opened (not by the scheduler).
