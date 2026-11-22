# Sampark Calling API v1

How another system asks Sampark to place a call: the school's own software, or another
SARGVISION product. This is Step 3 of the Sampark + MCP integration brief ("calls requested
through the school's own systems"), as a plain REST API.

**Status: built, switched off.** `SAMPARK_API_V1_ENABLED` is unset everywhere, so every route
returns 404. No key with the `sampark` scope exists and the console cannot issue one.

## What it is, and is not

It is a thin shell over the service the Sampark console already uses
(`previewRiyaCall`, `startRiyaCall`, `getRiyaCall` in `src/server/sampark/conversation.ts`).
It adds no calling logic. A call asked for through the API goes through the same purpose list,
the same gate (opt-outs, suppression, do-not-contact, the frequency cap, calling hours), the
same approved-announcement check, the same idempotency, per-school lock, Test-mode caps and
audit log as a call a person starts from the console.

It does **not** make Live calls possible (Live mode is still refused by `startRiyaCall`), it
does not add purposes, and it does not accept a phone number: a call names a guardian and a
student by Sampark record id, and Sampark looks up the number.

## Requests

All requests: `Authorization: Bearer sk_sahayak_<keyId>_<secret>` with the `sampark` scope.
The school is the key's. There is no school id in any request.

| Route | Does |
| --- | --- |
| `POST /api/sampark-api/v1/calls/preview` | Says whether the call may be placed and what Riya would say. Dials nothing. |
| `POST /api/sampark-api/v1/calls` | Places one call. |
| `GET /api/sampark-api/v1/calls/{callId}` | State and outcome of a call an integration placed. |

Preview body: `{ purpose, guardianId, studentId, facts | campaignId }`.
Start body: the same, plus `idempotencyKey` (a UUID the caller makes up, one per intended
call) and `confirmedAnnouncement` (the `announcement` the preview returned). Both bodies are
strict: an unknown field is a 400.

Start returns `201 { call, duplicate: false }`, or `200 { call, duplicate: true }` when that
idempotency key already placed this call; nothing new is dialled. A retry after a timeout is
therefore always safe with the same key.

## Responses and errors

`call` carries: `id`, `state`, `purpose`, `guardianId`, `studentId`, `language`, `mode`,
`destination`, `phoneLast4`, `createdAt`, `updatedAt`, `endedAt`, `durationSeconds`,
`failureReason`, `callSuccessful`, `answers`, `stopRequested`, `synopsis`, `reviewed`.
Never the phone number, the transcript, the announcement, the facts given to the agent, or
any provider or agent id. The list is fixed in `toApiCall` and a test fails if a field is added
without being named.

| Status | `error` | Meaning |
| --- | --- | --- |
| 404 | `Not found` | The API is off on this deployment. |
| 401 | `UNAUTHENTICATED` | No key, or a bad, unknown or revoked one (all read the same). |
| 403 | `SCOPE_REQUIRED` | A real key without the `sampark` scope. |
| 429 | `RATE_LIMITED` | Too many requests for this key; see `retry-after`. |
| 503 | `NOT_CONFIGURED` | Keys cannot be checked, or the rate limiter's or the daily call budget's store is down. The API has its own limiter that fails closed; it does not use the app's shared one, which fails open. |
| 400 | `INVALID_REQUEST` | The body is not the schema, or the call id is malformed. |
| 404 | `RECIPIENT_NOT_FOUND` | No such guardian or student in this school. |
| 404 | `CALL_NOT_FOUND` | Unknown id, another school's call, or a call staff placed from the console. |
| 409 | `API_KEY_DAILY_CAP_REACHED` | This key has used its daily call budget (see Rate limits). |
| 409 | the console's codes | `GATE_BLOCKED`, `OUTSIDE_CALLING_HOURS`, `SCHOOL_PAUSED`, `UNRESOLVED_PREVIOUS_CALL`, `ANNOUNCEMENT_CHANGED`, `RIYA_CALL_IN_PROGRESS`, `TEST_CALL_CAP_REACHED`, `IDEMPOTENCY_KEY_REUSED`, `LIVE_MODE_NOT_AVAILABLE`, … |

A call with state `unknown` has no confirmed outcome. It is never redialled by a machine, and
a new call about the same thing to the same family is refused (`UNRESOLVED_PREVIOUS_CALL`)
until a person reviews it in the console.

## Rate limits

Per key, in a sliding 10-minute window: 30 preview-or-start requests, and separately 120 reads
(`API_RATE_LIMITS` in `src/server/sampark/api-v1.ts`). Polling an outcome never uses up the
budget for placing a call. These are request limits only. What bounds real dialling today is
the calling service itself: Live mode is refused, Test mode rings only the allow-listed test
phone, at most `SAMPARK_RIYA_TEST_DAILY_CAP` real calls a day per school, one call in flight
per school. An integration shares that daily cap and that single slot with the school's staff.
Each API key also has its own daily call budget: `SAMPARK_API_KEY_DAILY_CAP` new call requests
(default 20; above 200 it is 200) in any 24 hours, refused with `409 API_KEY_DAILY_CAP_REACHED`.
A slot is reserved atomically before the calling service runs, keyed by the request's
idempotency key. A slot is never given back, so a request the service then refuses (outside
hours, a gate refusal) still uses one: an integration should preview first. A retry of a call
that already exists reserves nothing, so it is never refused by this budget. If the budget
cannot be checked, no call starts (503).

## Who the caller is

The call's `createdBy` and the audit actor are `api-key:<keyId>`, so an integration's calls
are told apart from a person's in the audit log. A key reads only calls placed by a key
(any `sampark` key of the same school, including one since revoked).

An idempotency key belongs to the API key that first used it. After rotating to a new API key,
retrying an old request returns `409 IDEMPOTENCY_KEY_REUSED`; read the call with GET instead.

Under `next dev`, the local development key (`MCP_LOCAL_DEV_API_KEY`) is granted every scope
by default, so it now includes `sampark`, for the organisation `local-dev-org`.

## Turning it on (not done by this change)

1. Set `SAMPARK_API_V1_ENABLED=true` on the deployment (with `SAMPARK_ENABLED` and
   `SAMPARK_ELEVENLABS_ENABLED`). Start on staging, with the school in Test mode.
2. Issue a key with the `sampark` scope using `scripts/mcp/create-api-key.ts`. The console
   deliberately cannot grant this scope yet (`CONSOLE_SCOPES` in `src/server/sampark/api-keys.ts`).
3. Preview, then start, one call to the school's test phone; read it back with GET.

## Known limits (follow-ups, in order)

1. **School purposes only.** Every purpose needs a guardian and a student. A hotel guest call
   (AtithiVani) cannot be expressed until Sampark has a product-neutral contact and purposes
   for it. That is the next change, and it is a change to the calling service itself.
2. **No outcome webhooks.** A caller polls `GET /calls/{id}`. Signed outcome events come next.
3. **The teacher "Contact" button** (`/api/attendance/call`) and the MCP `initiate_parent_call`
   tool are still their own paths. Moving them onto this API is the migration, done last.
4. **Spend.** No per-school minute budget yet; the per-key daily cap bounds an integration's calls, not their length.
5. **Calls view source.** `CallSource` has `integration` reserved; the Calls view does not yet
   label API calls. They are identifiable by `createdBy`.

## Tests

`src/__tests__/sampark/server/api-v1.test.ts`: the shell's order, key and scope handling,
the API's own rate limiter (separate budgets, failing closed), the school and caller coming only from the key, idempotency,
the gate, tenancy, and response contents. Class gates in the same file: every route under
`/api/sampark-api/v1/` runs the shell first and never reads `x-user-id`; no request schema has a
phone or school field; and no prefix under `/api/sampark/` is public in the middleware. The API
has its own tree (`/api/sampark-api/`) because `/api/sampark/v1/...` would be read by Next.js as
the private `[orgId]` routes with `orgId = "v1"`.

`src/__tests__/sampark/server/api-v1-routes.test.ts` runs the three handlers themselves against
the real calling service on in-memory repositories (Practice mode): 201 then 200 for a repeated
idempotency key, 404 with the flag off, 401, 403, 400 for a phone number, school or scenario in
the body, 409, 429 and 503, each with a check that nothing was placed.

Not covered yet: a Test-mode (real provider) call through the API. That needs staging.
