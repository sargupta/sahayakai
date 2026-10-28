# Architecture review request: Intern bot and Plox

**Not sent.** This session had no configured way to message the Intern bot or Plox: the
only reachable agent was an unrelated local session. Please forward these questions
yourself and compare the answers with the code before acting on them.

Branch under review: `feat/sampark-google-calendar-vidya-callbacks` (local, not pushed).
Docs:
- [CALENDAR_VIDYA_CALLBACKS.md](CALENDAR_VIDYA_CALLBACKS.md)
- [GOOGLE_CALENDAR.md](GOOGLE_CALENDAR.md)
- [CALLBACKS.md](CALLBACKS.md)
- [../VIDYA_ORB.md](../VIDYA_ORB.md)

## For Plox (please share the existing system architecture)

1. Is there an existing **Google Calendar or Google OAuth** service, design or
   credential store for SahayakAI or SamparkAI that this should reuse?
   - In particular: a Google Cloud OAuth client, a Secret Manager layout, or a token
     encryption key convention.
   - The repo had none, so this adds `SAMPARK_GCAL_TOKEN_KEY` and per-school
     connections in `sampark_gcal_connections`.
2. Should a calendar connection belong to the **school** (as implemented: one per
   `orgId`, org admins only), to each admin, or to each teacher?
3. Which **public HTTPS origin** should receive Google push notifications? Can Cloud
   Run expose `/api/sampark/google-calendar/notifications` there?
4. Is **Cloud Scheduler** the agreed scheduler for new jobs, or is a Cloud Tasks queue
   preferred? Callbacks today use the existing per-minute `sampark-dispatch` job.
5. Any planned **calendar event or tenant data model** this should align with?

## For the Intern bot (implementation review)

1. **Service boundaries:** route shell → service → port → Firestore. Are any boundaries
   wrong for the deployment?
2. **OAuth:**
   - authorization code with PKCE (S256);
   - state stored hashed, single use, 10 minutes, bound to the uid;
   - the admin re-checked on the callback;
   - both scopes required, and a partial grant revoked;
   - tokens AES-256-GCM with the orgId as associated data.

   Any gap?
3. **Sync:**
   - `syncToken` incremental sync; a 410 triggers a full sync;
   - notifications validated by channel id, token hash, resource id, expiry, current
     channel and message number, then reconciled by sync;
   - a 500 on sync failure so Google retries;
   - a 15-minute fallback sync on the scheduler.

   Is this right for Cloud Run (concurrent instances)?
4. **Callbacks:**
   - Firestore leases (5 minutes) and a single-flight lock;
   - an idempotency key per (callback, version);
   - 4 attempts with a growing delay;
   - missed after an hour;
   - an audit trail read by an equality query on `target`.

   Any race left?
5. **VIDYA:**
   - the WebGL shader orb, with states from the mic status, the request in flight and
     the `tts` speaking signal;
   - hidden while Radix overlays are open.

   Is the performance acceptable on low-end Android? Any conflict with the Live voice
   path (`omni-orb-live.tsx`)?
6. **Deployment and configuration risks:**
   - consent-screen verification for sensitive scopes;
   - rotating `SAMPARK_GCAL_TOKEN_KEY` forces every school to reconnect;
   - mock mode is locked to development plus the emulator.
7. **Tests** you would add before the PR.

## Decisions still open
- Calendar ownership (school vs admin vs teacher).
- The public webhook origin.
- Whether SamparkAI's own schedule should ever be written to Google (it is not now).
- Whether to verify the OAuth app for production or keep it in testing with listed
  users.
