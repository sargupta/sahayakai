# Callbacks — scheduled Riya calls

Status (27 Oct 2026): implemented; verified locally in **Practice** mode (Firestore
emulator, simulated provider, local scheduler). **Not verified** against a deployed
scheduler or the real ElevenLabs provider.

## What it does

- SamparkAI workspace → **Callbacks** (`/sampark/[orgId]/callbacks`): day / week /
  month calendar, a two-week agenda, and "Waiting for you" (parents' requests).
- A school admin schedules a callback about an earlier Riya call, at a time typed
  ("in 20 minutes", "tomorrow at 5 PM") or picked. Ambiguous text ("at 5", "tomorrow
  morning") is never guessed: the console asks.
- Every create / reschedule / confirm re-runs every Riya check **at the chosen
  instant** (calling hours, holidays, opt-out, consent, frequency cap, pause, facts
  still valid). A refused time returns the next permitted time for the person to
  choose; nothing is moved silently.
- A parent who says "call me back in 20 minutes" on a Riya call (data-collection key
  `callback_requested_time`) becomes a **proposed** callback. Proposals never run until
  an admin confirms them.

## How it runs (no browser involved)

`POST /api/jobs/sampark-dispatch` (Cloud Scheduler, every minute, `Bearer CRON_SECRET`)
now ends with `runCallbackTick`:

1. single-flight lock `sampark-callbacks`;
2. per school, `queueAt <= now` (single-field index, no composite index needed);
3. transactional claim → `running` with a 5-minute lease;
4. re-check: approver still an org admin, Practice unless real callbacks are enabled,
   every Riya check now;
5. `startRiyaCall` with idempotency key = f(callback id, version);
6. `completed` (with the Riya call id) / retry later (school busy, earlier call
   unresolved; max 4 attempts) / `failed` (any rule refusal, in words) / `missed`
   (reached more than an hour late).

A worker that dies after starting the call: the lease expires, the next tick
re-claims with the same version and `startRiyaCall` returns the existing call. Nothing
is dialled twice. A running callback cannot be cancelled or rescheduled.

Data: `sampark_schools/{orgId}/sampark_callbacks/{id}` (Admin SDK only; firestore.rules
default-deny). Code: `src/lib/sampark/callbacks/*`, `src/server/sampark/callbacks.ts`,
`src/server/sampark/callback-proposals.ts`, `src/app/api/sampark/[orgId]/callbacks/**`,
`src/components/sampark/callbacks/*`.

## Configuration

| Variable | Default | Effect |
|---|---|---|
| `SAMPARK_ENABLED`, `SAMPARK_ELEVENLABS_ENABLED` | off | Both `true` or the routes 404 and the worker does nothing |
| `CRON_SECRET` | unset | Required by the scheduler route (503 without it) |
| `SAMPARK_CALLBACKS_REAL_PROVIDER` | unset | Must be `true` before a callback may use ElevenLabs (Test mode). Unset: Practice only |

Live mode stays refused by `startRiyaCall` itself.

## Run locally

```powershell
node scripts/sampark/riya-local.mjs --port 3005 --ticker --admin <your uid> --demo-family
```

`--ticker` runs the local scheduler (every 30 s) with a disposable `CRON_SECRET`.
`--admin` makes your account an admin of the demo school and switches it on in
Practice. `--demo-family` adds the synthetic family.

## Still needed before production

1. The dispatch route is built for a per-minute Cloud Scheduler job. Confirm that job
   exists on the target project (not verified from here) and that `CRON_SECRET` is set
   on the service.
2. Add `callback_requested_time` as a data-collection field on the Riya agent
   (ElevenLabs), with the description "the time the parent asked to be called back,
   in their words".
3. Decide and set `SAMPARK_CALLBACKS_REAL_PROVIDER` only after a supervised Test-mode
   callback to the school test phone.

## The school calendar (28 Oct 2026)

SamparkAI workspace → **Calendar** (`/sampark/[orgId]/calendar`; `/callbacks` redirects)
shows every genuinely scheduled item, through one typed layer
(`src/lib/sampark/calendar/events.ts`, loaded by `src/server/sampark/calendar.ts`,
`GET /api/sampark/[orgId]/calendar?from&to`, at most 62 days, org admins only):

| Type | Source record | Date / time |
|---|---|---|
| Parent callback | `sampark_callbacks` (source `conversation`) | `scheduledAt`; requests with no time are listed under "Waiting for you" |
| Scheduled call | `sampark_callbacks` (source `staff`) | `scheduledAt` |
| Campaign calls | `sampark_campaigns` (not drafts) | `notBefore`, else approval, until `expiresAt`; families counted, never listed |
| School event | the PTM / event / closure in a campaign's facts | facts date + time (IST); one event however many campaigns announce it |
| Holiday | `school.holidays` | all day |

Each event keeps its record id; keys are unique per (type, record), and the summary
counts each key once. Callbacks are edited in place (existing dialogs and checks);
campaigns and holidays link to their own pages. Not on the calendar because they have
no future time: immediate Riya calls, attendance calls, per-family campaign intents
(inside their campaign's counts), and draft campaigns. There is no external calendar sync.

## Lifecycle, audit trail and the calendar (28 Oct 2026)

Lifecycle (`src/lib/sampark/callbacks/state.ts`). The brief's names map to these states:

| Brief | Here | Meaning |
|---|---|---|
| — | `proposed` | A parent asked on a Riya call. It **never runs** until an admin confirms it |
| scheduled | `scheduled` | Approved. `queueAt` is the due time, or a retry time |
| processing | `running` | A worker holds a 5-minute lease and is starting the call |
| completed | `completed` | The Riya call was started; its id is on the record. The call's own outcome lives on the call |
| failed | `failed` | A rule refused the call at run time, or 4 attempts ran out. A person may reschedule it |
| — | `missed` | Reached more than an hour late. Not called |
| cancelled | `cancelled` | Never runs. A running callback cannot be cancelled |

The record stores:
- the school, guardian, student and campaign ids, with no phone number (it is resolved
  at dial time);
- the UTC instant and the IANA zone;
- the source (`staff` or `conversation`) and when it was created;
- `queueAt`, `attempts`, `lease`, `lastError` and the Riya call id;
- `id = hash(orgId | requestKey)`, which is the idempotency key for creation. Each run
  also gets its own key, `f(id, version)`.

**Audit trail.** Every change and every worker step is written to the school's audit log:

| Who | Actions |
|---|---|
| A person | `callback.create`, `callback.confirm`, `callback.reschedule`, `callback.cancel` |
| Riya | `callback.proposed` |
| The worker | `callback.started` (with the Riya call id), `callback.retry`, `callback.failed`, `callback.missed` |

- `GET /api/sampark/[orgId]/callbacks/[callbackId]` returns it as `history`, newest
  first, and the callback dialog shows it under **History**.
- The audit read is a single-field equality query (`target`), so it needs no composite
  index.

**Separation from Google Calendar.**
- A Google Calendar event is not a callback. Creating, editing or deleting one never
  creates, triggers or cancels a call.
- There is no automatic link between the two. The SamparkAI calendar shows callbacks from
  their own records; the Google Calendar tab shows the school's Google events.
- Any future link (for example, a callback mirrored into Google for visibility) must stay
  one-way and visibility-only, and must be documented here first.

**Tests** (`src/__tests__/sampark/callbacks/*`, 62) cover:
- scheduling in the future and two minutes ahead; too soon, too far, holidays and
  calling hours refused;
- interpretation of IST and other zones, including DST;
- cancel and reschedule with version checks;
- execution only when due; two concurrent workers; a crashed worker recovered after its
  lease;
- transient errors (school busy, an unexpected provider exception) retried with a growing
  delay, then failed after 4 attempts;
- permanent refusals (opt-out, holiday, approver lost) failing without a call;
- no call for cancelled requests;
- tenant isolation;
- Practice only (the simulated provider, with no network calls);
- the audit trail.

All of this runs against the **simulated provider**. No real call has been placed.
