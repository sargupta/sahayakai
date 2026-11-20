# Calling MCP dev demo data

## Current state — 2026-10-08 real-call attempt with a Twilio trial account

**Result: no call was placed through Sahayak.** The full MCP chain reached
Twilio's Create Call API, and Twilio rejected the request.

- **Twilio Console:** the trial account placed an outbound test call ("Try out
  Voice") from its trial number to the user's verified test number. Outbound
  Voice on the account works.
- **Sahayak:** `initiate_parent_call` (via `/api/mcp-demo/calling` → MCP) ran
  `parent-message` → `outreach` → `/api/attendance/call` →
  `POST …/Calls.json`. The callback URLs (`/api/attendance/twiml`,
  `/api/attendance/twiml-status`) were publicly reachable through a
  cloudflared quick tunnel and answered 403 to unsigned requests.
- **Twilio:** HTTP 400, code 0, "Invalid or disallowed parameters provided -
  trial accounts have limited parameter access". Twilio's current trial
  limits allow Create Call only with `To`, Twilio-provided sample call
  instructions and an optional status callback. Sahayak's flow needs its own
  TwiML URL (`/api/attendance/twiml`), so a **trial account cannot run the
  custom Sahayak call**. A full end-to-end call needs an upgraded Twilio account.
  No trial-specific workaround was kept.
- **Fixed after the first attempt, verified on the second:** the Twilio 400 now
  maps to non-retryable `not_configured` (it used to be retryable
  `upstream_unavailable`), and the outreach record is set to
  `callStatus: failed` / `callFailureCategory: provider_unconfigured` (it used
  to stay `initiated`).
- The recipient for these attempts was the user's verified test number (ends
  9732), set as the seeded student's `parentPhone` and as
  `TWILIO_TEST_OVERRIDE_NUMBER`. Two attempts were made in total, each a
  single request with no retry.

Local-only configuration (never committed): `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `MCP_CALLING_CALLBACK_BASE_URL`
in `.env.local`. ngrok was removed twice by the machine's antivirus, so the
tunnel was cloudflared. A quick tunnel cannot restrict paths, so it was
stopped right after each attempt.

## Earlier state — 2026-10-08 emulator end-to-end (no call placed)

**Result:** the full MCP chain ran live on non-production data and stopped at
the provider boundary. **No phone call was placed**: no Twilio credentials are
configured, so the existing call route refused before dialling.

### Why an emulator

The only Firebase project available is `sahayakai-b4248`, which is production.
The repo has no dev or staging project and no emulator config, so the demo data
lives in a **local Firestore emulator**. Nothing was written to production.
Sign-in still uses the production Firebase Auth project; that is read-only
verification of the ID token.

### Setup (reproducible)

```bash
# 1. Firestore emulator (any folder; needs Java 17). Config used:
#    { "emulators": { "firestore": { "host": "127.0.0.1", "port": 8085 }, "ui": { "enabled": false }, "singleProjectMode": true } }
npx firebase-tools@13.29.1 emulators:start --only firestore --project sahayakai-b4248 --config <that firebase.json>

# 2. Seed (refuses to run unless FIRESTORE_EMULATOR_HOST is a local emulator)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node scripts/mcp/seed-calling-emulator.cjs   --teacher-uid <teacher uid> --teacher-name "<display name>" --phone +91XXXXXXXXXX

# 3. A calling key for the SAME org, with the repo's own script
#    (needs the react-server condition: plain tsx fails on `import 'server-only'`)
NODE_OPTIONS=--conditions=react-server FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 MCP_API_KEY_PEPPER=<from .env.local>   npx tsx scripts/mcp/create-api-key.ts --org mcp-calling-dev-org --scope calling --label "Calling MCP dev demo (emulator)" --apply

# 4. next dev against the emulator (no other next dev may share .next)
FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 PORT=3000 MCP_CALLING_DEMO_API_KEY=<key from step 3>   TWILIO_TEST_OVERRIDE_NUMBER=+91XXXXXXXXXX node node_modules/next/dist/bin/next dev -p 3000
```

Reset: `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 node scripts/mcp/seed-calling-emulator.cjs --teacher-uid <uid> --reset`
(removes the seed docs, that teacher's `parent_outreach` records and the org's keys).
Stopping the emulator also discards everything.

### Records (emulator only)

| Record | Path | Notes |
|---|---|---|
| Teacher profile | `users/Yt5XFJyz45TVlY7UKyVRgxUe8Tn1` | `planType: premium` (same as production, read-only lookup), `organizationId: mcp-calling-dev-org` |
| Organization | `organizations/mcp-calling-dev-org` | `createOrganization()` shape: name "MCP Calling Dev School", type school, plan premium |
| Membership | `organizations/mcp-calling-dev-org/members/Yt5XFJyz45TVlY7UKyVRgxUe8Tn1` | `role: admin` |
| Class | `classes/mcp-calling-demo-class-7` | "Class 7 - MCP Calling Demo", `teacherUid` = the teacher |
| Student | `classes/mcp-calling-demo-class-7/students/mcp-demo-student` | "MCP Demo Student", `parentPhone` = the user's confirmed test number (E.164, ends 1401), `parentLanguage: English` |
| MCP key | `mcp_api_keys/165a785fe50efdee` | scope `calling`, org `mcp-calling-dev-org` |

There is **no separate parent/contact document** in Sahayak's schema: the
parent contact is `parentPhone` + `parentLanguage` on the student, so "MCP Demo
Parent" has no field and was not invented. In production the teacher has no
organisation (`organizationId` is null), which is why a dev org was created.

### Live results

- `npm run mcp:calling:demo` with the org key: `list_parent_contacts` →
  "Class 7 - MCP Calling Demo", 1 student, 1 reachable (last 4 digits only). PASS.
- Signed-in browser → `GET/POST /api/mcp-demo/calling` 200 → `list_parent_contacts`
  success for key `165a785fe50efdee` / org `mcp-calling-dev-org` (server log).
- `initiate_parent_call` once, through `POST /api/mcp-demo/calling`
  (server-only MCP SDK client → `/api/mcp/calling`): `parent-message` generated
  the message as the class teacher → `outreach` wrote `parent_outreach`
  (`deliveryMethod: twilio_call`, `callStatus: initiated`, no `callSid`) → the
  call route answered 503 "Twilio not configured" → MCP `not_configured`
  (HTTP 503 to the browser). No dial.
- Separately, the app's own attendance Contact dialog on the same class
  generated a message and saved a `whatsapp_copy` record; it offered no call
  because `/api/attendance/twilio-config` reports Twilio unconfigured.

### Blocker for a real call

`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_PHONE_NUMBER` are not
configured. With them, two more things are needed: the test number must be a
Verified Caller ID if the Twilio account is a trial, and
`MCP_CALLING_CALLBACK_BASE_URL` must be a public HTTPS URL. Twilio fetches
`/api/attendance/twiml` and posts to `/api/attendance/twiml-status` on that
host. ngrok 3.25 is installed at `E:
grok
grok.exe`; restrict the tunnel to
those two paths with a traffic policy. Under `next dev`, a request without a
token is treated as a dev user, so an unrestricted tunnel would let anyone
trigger calls.

## Earlier state — 2026-10-08 finalization

Still no demo records. Nothing was written to Firestore (the connected project
`sahayakai-b4248` is production-linked), and no phone call was placed.

Live checks against `next dev` on port 3000 with the local dev key:

- `npm run mcp:calling:demo`: `initialize` → `sahayak-parent-calling` v1.0.0;
  `tools/list` → `list_parent_contacts`, `initiate_parent_call`;
  `list_parent_contacts {}` → `{ "classes": [] }` (PASS for discovery and masking).
- `initiate_parent_call` with a client-supplied `parent_phone` → rejected
  (unknown key); invalid `reason` → rejected; `class_id` `../users/x` → rejected;
  unknown class → `not_found` at the organisation/class authorization step.
  No message, outreach record or provider request was made.
- MCP endpoint without a key or with a wrong key → HTTP 401. Demo API with an
  invalid Firebase token → 401.

The demo page now waits for the Firebase session; signed out it shows "Sign in
to Sahayak to use this demo." instead of staying on "Connecting…".

The exact next action below is unchanged.

## Earlier state — 2026-10-07 authenticated-session continuation

No demo records have been seeded. The user confirmed that the local Sahayak app
is signed in. The dev server was started from the specified repo and reported
Ready, but the Codex in-app browser backend had no available IAB browser, so the
current page/session could not be inspected. The previously observed UID is not
being reused as the current UID.

- MCP key organization: `local-dev-org` (from the existing handoff/config).
- Current teacher UID: unavailable from the authenticated session because the
  Codex browser backend is unavailable. The previous-session UID and plan are
  historical only and were not reused.
- Current teacher organization ID: not available from this session.
- Membership under `organizations/local-dev-org/members/{teacherUid}`: absent
  in the preceding check. The `organizations/local-dev-org` document was also
  absent in the connected Firebase project `sahayakai-b4248`.
- Do not seed into that connected project: it is the production-linked Firebase
  project, and the expected dev organization is absent. No supported key/org
  rebinding was performed.

| Record | Created | Identifier |
| --- | --- | --- |
| Organization | No | `local-dev-org` (expected by the key; document absent) |
| Teacher membership | No | — |
| Class | No | — |
| Student | No | — |
| Parent contact / outreach | No | — |

Seed command/method: none. Reset/delete command: none; no demo data was written.

The last live MCP `list_parent_contacts` result from the earlier session was
`{ "classes": [] }`; it was not rerun. The prior safe call using unknown
class/student IDs returned `not_found` before reaching the Sahayak calling
route. No MCP call was made in this continuation; no outreach was created and
no phone call was placed.

Latest targeted validation: 6 suites, 76 tests passed; targeted ESLint passed
in the prior continuation. They were not rerun during this browser-blocked
continuation. Full typecheck was not retried because the previous attempt
exhausted memory. No commit was created.

## Exact next action

Restore the Codex IAB browser connection, inspect the authenticated local page,
and obtain the current teacher UID and organization from the existing session.
Point local development at a confirmed non-production Firebase project that
contains the intended organization, then use an existing supported calling
key for that organization and the existing Sahayak class/student helpers. Only
after org membership, class ownership, and plan checks pass should the reversible
demo class/student/contact be seeded. Record the exact seed and reset commands
and generated IDs here after a successful seed. Do not dial.

See [`CODEX_HANDOFF.md`](./CODEX_HANDOFF.md#24-restart-follow-up--2026-10-07) for
the browser, Firebase, and test details.
