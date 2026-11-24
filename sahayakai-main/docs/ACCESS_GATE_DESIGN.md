# Access gate design

Status: implemented behind flags, default off. Date: 2026-11-24.
Operational steps live in [ACCESS_GATE_RUNBOOK.md](./ACCESS_GATE_RUNBOOK.md).

## Purpose

Until now any Google account could sign in to SahayakAI and use the free plan.
The product is sold to schools at a quoted per-teacher rate, so open sign-in
gave competitors and the curious a free walkthrough and cost cloud spend
without producing school revenue. The gate replaces open sign-in with three
tiers: public (marketing, the parent-call demo, the pricing estimator),
qualified pilot (a verified school, time-boxed, seat-capped), and paid.

The gate does not make the product uncopiable. Its aims are to raise the cost
of getting in, to create contractual recourse (evaluation terms), and to make
misuse detectable (audit trail, anomaly flags, watermarked exports).

## Scope

The gate covers SahayakAI. SamparkAI (its own host, the `/sampark` route
tree and the `/api/sampark*` APIs) has its own entry rules and is exempt in
the middleware. A SamparkAI user who is not entitled to SahayakAI is still
refused by SahayakAI's own APIs; decide separately whether SamparkAI needs
the same gate.

## Access states

| State | Meaning | Entitled |
|---|---|---|
| `legacy` | Account existed before `ACCESS_LEGACY_CUTOFF` | yes |
| `pending` | Signed in, not approved | no |
| `pilot` | Time-boxed evaluation, must carry an expiry | until expiry |
| `active` | Approved or paying seat, optional expiry | yes |
| `blocked` | Withdrawn by an administrator | no |

Source of truth: `users/{uid}.accessState` and `accessExpiresAt` (Admin SDK
only; listed in `protectedUserFields()` in `firestore.rules`).
Cache: custom claims `access` and `accessExp` (epoch seconds), read by the
middleware with no I/O. A token with no `access` claim is not entitled; the
client repairs it through `POST /api/access/sync`.

All claim writes go through `mergeCustomClaims()` in
`src/lib/access/access-admin.ts`. A bare `setCustomUserClaims(uid, {...})`
replaces the whole claim set and would silently drop `access`.

## Rollout switches

| Variable | Values | Effect |
|---|---|---|
| `ACCESS_GATE_MODE` | `off` (default), `log`, `enforce` | Middleware behaviour |
| `ACCESS_LEGACY_CUTOFF` | ISO-8601 instant | Accounts created before it are `legacy`. `enforce` degrades to `log` while unset |
| `system_config/access_gate.enforce` | boolean (Firestore) | Turns on the claim check in `firestore.rules` |
| `APP_CHECK_REQUIRED` | `true` | Existing switch; rejects AI calls without an App Check token |
| `ALLOW_DEV_SURFACES` | `true` | Serves API docs and playground on a non-production-like build |

## Enforcement points

1. `src/middleware.ts`: every `/api/*` call and every page request. Not
   entitled: API and mutating requests get `403 {code:"ACCESS_REQUIRED"}`,
   page reads redirect to `/access`. Allowlists are in
   `src/lib/access/access-state.ts`.
2. `firestore.rules`: collections readable by "any signed-in user" also
   require an entitled claim once `system_config/access_gate.enforce` is true.
3. Token expiry: `accessExp` ends a pilot at the edge even if the expiry job
   has not run.

## Data model

- `access_requests/{uid}`: one per account. Fields: `uid, email, displayName,
  schoolName, role, board, affiliationNumber, city, state, phone,
  teacherCount, message, termsVersion, termsAcceptedAt, status
  (pending|approved|rejected), createdAt, updatedAt, decidedAt, decidedBy,
  decisionNote, grantedState, grantedExpiresAt`.
- `quote_requests/{autoId}`: public quote form. Fields: `schoolName,
  contactName, role, email, phone, board, affiliationNumber, city, state,
  estimate{teachers,billing,includeParentCalls,students,
  callsPerStudentPerYear,avgMinutesPerCall,totalPerYearInclGst}, status
  (new|contacted|qualified|closed), createdAt, ipHash`.
- `organizations/{orgId}` gains `status (pilot|active|expired)`; absent means
  `active`. Also `pilotEndsAt`, `verification{board, affiliationNumber,
  method, note, verifiedBy, verifiedAt}`.
- `organizations/{orgId}/joinLinks/{linkId}`: `tokenHash (sha256), createdBy,
  createdAt, expiresAt, maxUses, uses, revoked`.
- `organizations/{orgId}/members/{uid}` gains `termsVersion, termsAcceptedAt`.
- `access_audit/{autoId}`: append-only record of every state change.
- `access_flags/{uid}`: anomaly flags raised by the nightly job.

## API contract

All JSON. Errors are `{ error: string, code?: string }`.

Public:
- `GET /api/access/mode` -> `{ mode: "off"|"log"|"enforce" }`
- `POST /api/access/quote` body `{ schoolName, contactName, role, email,
  phone, board?, affiliationNumber?, city, state, estimate, turnstileToken }`
  -> `{ ok: true, id }`. 400 on validation, 429 on rate limit.

Signed in (allowed while not entitled):
- `GET /api/access/status` -> `{ mode, state, verdict, entitled,
  expiresAt|null, request: { status, createdAt } | null }`. `verdict` equals
  `state` except for `expired` (an entitled state past its expiry).
- `POST /api/access/sync` -> `{ state, entitled, expiresAt|null,
  claimChanged }`. The client must call `getIdToken(true)` when
  `claimChanged` is true.
- `GET /api/access/request` -> `{ request | null }`
- `POST /api/access/request` body `{ schoolName, role, board,
  affiliationNumber?, city, state, phone, teacherCount?, message?,
  acceptTerms: true }` -> `{ ok: true, status: "pending" }`. 409 when a
  decision has already been made.
- `POST /api/organizations/join` body `{ code, acceptTerms: true }` ->
  `{ ok: true, orgId, orgName, state, expiresAt|null }`. 404 invalid or
  revoked, 410 expired, 409 no seats or already a member of another school.

School admin or SahayakAI admin:
- `GET /api/organizations/{orgId}/join-links` -> `{ links: [{ id, createdAt,
  expiresAt, maxUses, uses, revoked }] }`
- `POST /api/organizations/{orgId}/join-links` body `{ maxUses?,
  expiresInDays? }` -> `{ id, code, url, expiresAt, maxUses }`. The code is
  shown once; only its hash is stored.
- `DELETE /api/organizations/{orgId}/join-links?id=` -> `{ ok: true }`

SahayakAI admin only (`isAdmin`):
- `GET /api/admin/access/requests?status=pending|approved|rejected` ->
  `{ requests: [...] }`
- `POST /api/admin/access/requests/{uid}` body `{ decision:
  "approve"|"reject", state?: "pilot"|"active", expiresInDays?, note? }` ->
  `{ ok: true }`
- `GET /api/admin/access/quotes?status=` -> `{ quotes: [...] }`
- `PATCH /api/admin/access/quotes` body `{ id, status }` -> `{ ok: true }`
- `GET /api/admin/access/users?q=<email or uid>` -> `{ users: [{ uid, email,
  displayName, accessState, accessExpiresAt, organizationId, createdAt }] }`
- `POST /api/admin/access/users` body `{ uid, state, expiresInDays?, reason }`
  -> `{ ok: true }`
- `GET /api/admin/access/flags` -> `{ flags: [...] }`
- `GET /api/admin/access/pilot-orgs` -> `{ organizations: [{ id, name, type,
  status, plan, totalSeats, usedSeats, pilotEndsAt, createdAt }] }`
- `POST /api/admin/access/pilot-orgs` body `{ name, type, adminEmail, seats,
  pilotDays, plan?, verification }` -> `{ orgId }`
- `POST /api/admin/access/pilot-orgs/{orgId}` body `{ action:
  "extend"|"convert"|"expire", days? }` -> `{ ok: true }`

Scheduler:
- `POST /api/jobs/access-expiry` (CRON_SECRET bearer): expires pilots past
  their end date, returns members to their base state, raises anomaly flags.

## Evaluation terms

`EVALUATION_TERMS_VERSION` in `src/lib/access/terms.ts`. Acceptance is
recorded with the access request and with each school join. The text needs
review by counsel before enforcement.
