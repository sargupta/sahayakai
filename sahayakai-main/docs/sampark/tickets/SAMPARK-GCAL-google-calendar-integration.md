# Google Calendar integration for SamparkAI

**Type:** feature · **Area:** SamparkAI workspace · **Status:** implemented locally, awaiting manual test and real credentials
**Branch:** `feat/sampark-google-calendar-vidya-callbacks` (local only, not pushed)
**Design:** [../GOOGLE_CALENDAR.md](../GOOGLE_CALENDAR.md)

## Problem
School admins keep the school's events (PTMs, sports day, holidays) in Google Calendar.
SamparkAI could not show or manage them.

## Scope
- One Google connection per school, managed by its org admins:
  - connect, reconnect and disconnect, with the token revoked at Google;
  - clear connection states.
- Choose one of the account's own calendars.
- Month view of the school's events. Create, view, edit and cancel them, for one
  occurrence or the whole series. Daily, weekly, monthly and yearly repeats.
- Server-side OAuth: authorization code with PKCE, single-use state bound to the user,
  strict redirect URI, minimum scopes, encrypted tokens bound to the school.
- Incremental sync with a full-sync fallback, a validated push webhook (when a public
  URL exists), channel renewal and a fallback sync on the scheduler.

## Out of scope
- Teachers' personal calendars.
- Attendees and reminders.
- Writing SamparkAI's call schedule into Google.
- **Any link between calendar events and phone calls.**

## Acceptance criteria
- [x] Every route: 404 when Sampark is off, 401 without a user, 403 for non-admins and
      for other schools.
- [x] An invalid, expired or reused state, another user's state, a denied consent, a
      partial scope or a missing refresh token never connects.
- [x] Tokens are never returned to a browser and never stored in plaintext.
- [x] An expired or revoked grant shows "Reconnect needed", never "Connected".
- [x] A retried create makes one event.
- [x] Repeats, edits and cancellations work for one occurrence and for a whole series.
- [x] A DST-skipped time and an end before the start are refused.
- [x] Notifications are validated (channel, token hash, resource, current channel,
      message number) and reconciled by sync. Duplicates are ignored.
- [x] Rate limits and 5xx are retried with backoff, then reported as 502.
- [ ] **Manual:** connect a real Google account (needs the OAuth client) and run the
      checklist in GOOGLE_CALENDAR.md.
- [ ] **Manual:** push notifications on a public HTTPS deployment.
- [ ] Cloud Scheduler job for `/api/jobs/sampark-google-calendar`.

## Tests
`src/__tests__/sampark/google-calendar/*`: 50 tests, all against **mocked** Google.
