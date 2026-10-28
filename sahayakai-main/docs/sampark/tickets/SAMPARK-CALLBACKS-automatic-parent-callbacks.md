# Automatic parent callback scheduling and execution

**Type:** feature · **Area:** SamparkAI · Riya · **Status:** implemented locally (Practice only); audit-trail view added this round
**Branch:** `feat/sampark-google-calendar-vidya-callbacks` (local only, not pushed)
**Design:** [../CALLBACKS.md](../CALLBACKS.md)

## Problem
A parent asks Riya to "call back at 5 PM" or "in 20 minutes". The school needs that
recorded, approved and executed at the right time, once, under the school's rules,
without anyone watching a browser.

## Scope
- A tenant-scoped persistent callback with a lifecycle:
  `proposed → scheduled → running → completed | failed | missed | cancelled`.
- Idempotent creation; a per-run idempotency key.
- A durable scheduler: the existing Cloud Scheduler dispatch job claims due callbacks
  under a lease and a single-flight lock, re-checks every rule at run time, and starts
  the Riya call through the existing `startRiyaCall`.
- Bounded retries with growing delay; missed after an hour; crash recovery after the
  lease expires.
- Cancel and reschedule with version checks.
- An audit trail per callback, shown in the dialog.
- **Independent of Google Calendar.** Events never create, trigger or cancel calls.

## Acceptance criteria
- [x] Persisted before success is reported. Executes only when due, once, under
      concurrent workers.
- [x] Cancelled requests never call. A running one cannot be cancelled.
- [x] Transient errors retry up to 4 times, then the callback fails. Permanent refusals
      fail without a call.
- [x] Tenant isolation.
- [x] Practice mode uses the simulated provider; tests make no network calls.
- [x] Audit trail readable per callback.
- [ ] **Manual:** a supervised Test-mode callback to the school's test phone, before
      `SAMPARK_CALLBACKS_REAL_PROVIDER` is ever set.
- [ ] The Cloud Scheduler dispatch job confirmed on the target project.

## Tests
`src/__tests__/sampark/callbacks/*`: 62 tests, all with the simulated provider.
