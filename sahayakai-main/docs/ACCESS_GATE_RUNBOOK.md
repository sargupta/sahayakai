# Access gate runbook

How to switch the access gate on safely, operate it, and switch it off.
Design and API contract: [ACCESS_GATE_DESIGN.md](./ACCESS_GATE_DESIGN.md).

Deploy rules in this repository still apply (AGENTS.md): ship by pushing to
`main`, audit the new revision, flip traffic by hand. Nothing in this runbook
needs a direct `gcloud run deploy`.

## What ships switched off

Merging and deploying this work changes nothing for signed-in teachers. The
gate, the Firestore claim check and App Check enforcement are each behind
their own switch, all off by default.

Live as soon as the revision takes traffic (no switch):

- API docs, API playground, raw OpenAPI specs and service-worker source maps
  answer 404 in production.
- `llms.txt` and `llms-full.txt` carry marketing facts only.
- The video-storyteller and intent endpoints are plan-limited like the rest.
- "Get a formal quote" on `/school-pricing` is a form, not a mailto.
- Every custom-claim write merges instead of replacing.

## Why the order matters

On 2026-06-08 the onboarding gate shipped cookie-only and locked out every
existing teacher. This gate fails closed too: a token with no `access` claim
is not entitled. Three safeguards exist, and the rollout uses all of them:

1. The backfill stamps `legacy` on every existing account before enforcement.
2. `log` mode records what `enforce` would block without blocking.
3. Self-heal: on a 403 the client calls `/api/access/sync`, which derives
   `legacy` from the account's Firebase Auth creation time. A teacher the
   backfill missed loses one round trip, not their access.

`enforce` is ignored (treated as `log`, with an `access_gate_misconfigured`
error line) while `ACCESS_LEGACY_CUTOFF` is unset or does not parse as a
date. `GET /api/access/mode` reports the mode actually in effect, so check it
after every change: if it says `log` when you set `enforce`, the cutoff value
is wrong.

## Rollout

Pick T, the instant open sign-up ends. Every account created before T is
`legacy`. Use one value everywhere, with an explicit offset, for example
`2026-12-08T00:00:00+05:30`.

### Step 1. Deploy with defaults

Push to `main`, wait for the build, run `./scripts/audit-deployments.sh`,
flip traffic. Confirm:

- `curl -s https://www.sahayakai.com/api/access/mode` returns `{"mode":"off"}`
- `https://www.sahayakai.com/swagger.html` and `/api-docs` return 404
- an existing teacher can sign in and generate a lesson plan

Deploy the Firestore rules and indexes (the claim check in the rules stays
inert until step 5):

```bash
firebase deploy --only firestore:rules,firestore:indexes --project sahayakai-b4248
```

### Step 2. Backfill existing accounts

```bash
GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/backfill-access-claim.ts --cutoff=<T>            # dry run
GOOGLE_CLOUD_PROJECT=sahayakai-b4248 npx tsx scripts/backfill-access-claim.ts --cutoff=<T> --apply
```

Check the dry-run summary first: `scanned` should match the Firebase Auth
user count and `errors` should be 0. Re-running after `--apply` must report
`stampedLegacy: 0`.

### Step 3. Log mode

Set on the Cloud Run service (a config-only revision; audit and flip as usual):

```
ACCESS_LEGACY_CUTOFF=<T>
ACCESS_GATE_MODE=log
```

Create a log-based metric on `jsonPayload.message="access_gate_would_block"`.
Leave it for at least five working days. Expected: a short tail from tokens
minted before the backfill (they refresh within an hour), then nothing from
existing teachers. Any uid that keeps appearing is an account the gate would
strand: look it up before going further.

### Step 4. Enforce

At or after T:

1. Run the backfill once more with `--apply` (catches accounts created since
   step 2; all of them predate T).
2. Set `ACCESS_GATE_MODE=enforce`. Audit and flip.
3. Verify with three accounts: an existing teacher (works as before), a
   brand-new Google account (lands on `/access`, can submit a request, gets
   403 on any product API), and an admin (can open `/admin/access`).
4. The landing page now reads "Request access".

### Step 5. Firestore claim check

Once step 4 has run cleanly for a day, create the document
`system_config/access_gate` with `{ enforce: true }` in the Firebase console.
From then on a signed-in account without an entitled claim cannot read shared
collections directly through the client SDK either.

### Step 6. App Check

Set `APP_CHECK_REQUIRED=true` only after confirming in the Firebase console
that the share of verified App Check requests is high across the web app and
the Android app. This is independent of the gate and has its own rollback.

### Step 7. Schedule the expiry job

Pilots end at the edge through the `accessExp` claim regardless, so this job
is housekeeping (seat release, plan downgrade, anomaly flags), not the only
line of defence.

```bash
gcloud scheduler jobs create http sahayakai-access-expiry \
  --project=sahayakai-b4248 --location=asia-south1 \
  --schedule="30 1 * * *" --time-zone="Asia/Kolkata" \
  --uri="https://www.sahayakai.com/api/jobs/access-expiry" \
  --http-method=POST \
  --headers="Authorization=Bearer <CRON_SECRET>"
```

### Optional settings

| Variable | Default | Purpose |
|---|---|---|
| `QUOTE_DAILY_CAP` | 200 | Total quote requests accepted per day |
| `QUOTE_IP_DAILY_LIMIT` | 5 | Quote requests per IP address per day |

The quote form reuses the parent-call demo's Turnstile keys and
`DEMO_CALL_PEPPER`; in production it answers 503 if either
`TURNSTILE_SECRET_KEY` or the pepper is unset.
Each accepted quote writes a `quote_request_received` log line. There is no
email notification yet, so point a log alert at it or check
`/admin/access` daily.

## Rollback

| Symptom | Action | Takes effect |
|---|---|---|
| Teachers blocked by the gate | `ACCESS_GATE_MODE=off` (or `log`) | next revision flip |
| Client reads failing with permission-denied | set `system_config/access_gate.enforce` to `false` | within a minute |
| AI calls rejected for missing App Check | unset `APP_CHECK_REQUIRED` | next revision flip |

None of these needs a code revert. Access states and requests already
recorded stay in place and take effect again when the gate is re-enabled.

## Daily operation

All of it is at `/admin/access` (SahayakAI admins: `users/{uid}.role == "admin"`).

Verifying a school before approving:

1. Check the affiliation number against the board's own public school
   directory (CBSE: the SARAS affiliation portal; CISCE: "Locate a school"
   on the council's site). Do not rely on a link supplied by the requester.
2. Call the landline listed in that directory, not the number on the request.
3. Prefer an email on the school's own domain for the school admin.
4. Record what you checked in the verification note. It is stored with the
   organisation.

Approving:

- A school: "Pilot schools" > provision. The school admin must have signed in
  once so the account exists. Set seats and pilot length (default 14 days).
  The admin then creates a join link under Organisation > Invite teachers and
  shares it with staff. Each teacher accepts the evaluation terms on joining.
- An individual request: approve as pilot (days) or active, or reject with a
  note. Individual teachers without a school stay on the waiting list by
  default.
- Converting a pilot to paid: "convert" on the pilot school after the
  contract is signed. Members move to `active` with no expiry.
- Removing a teacher from a school: the school admin removes the member and
  should also revoke any join link that teacher received, otherwise the link
  still works while it has uses left.
- Withdrawing access: set the user to `blocked` with a reason. It applies
  within an hour (token lifetime); for immediate effect also disable the
  account in Firebase Authentication.

Quote requests from the pricing page land under "Quote requests". Treat an
unverifiable request (no school name, non-school email, inconsistent
numbers) as a lead to qualify, not a quote to send.

Flags: accounts that covered an unusually broad set of features or hit volume
limits shortly after first use. A flag never blocks anyone; review and
decide.

## Monitoring

| Log line (`jsonPayload.message`) | Meaning | Alert |
|---|---|---|
| `access_gate_would_block` | Log mode: enforce would have blocked this | chart during step 3 |
| `access_gate_misconfigured` | `enforce` set without a cutoff | alert on any |
| `access_anomaly_flagged` | Nightly job raised a flag | daily digest |
| `Access state changed` (context `ACCESS`) | Every grant, block, expiry | audit |

Every change is also written to the `access_audit` collection.

## Known limits

- SamparkAI is outside the gate (see "Scope" in the design document).

- A captured self-serve payment makes a waiting account `active` without
  school verification. The self-serve tiers are hidden while pricing is
  quoted, so this path is closed in practice; keep it in mind before
  re-opening public checkout.
- Join codes travel in the URL path (`/join/<code>`), so they appear in
  request logs. They expire, are seat-capped and can be revoked.

- A determined competitor can still pose as a school. Verification, the
  evaluation terms and the audit trail are what stand behind the gate.
- A blocked or expired account keeps working until its current token expires
  (up to one hour) unless the account is also disabled in Firebase Auth.
- The evaluation terms were drafted in-house and need review by counsel.
- `public/swagger.html` and `public/api-docs.html` remain in the repository
  (unreachable in production). Delete them in a follow-up commit.
- The terms page gained five English-only strings; `scripts/ci/i18n-baseline.json`
  was raised from 58 to 63 for them, with the reason recorded in the file.
- Cloud Storage rules are unchanged: four paths (`community-voice`,
  `users/*/uploads`, `profile-photos`, `uploads`) stay readable by any
  signed-in account. They hold user uploads, not product logic.
- While the Firestore rules are deployed, each gated client read costs one
  extra read of `system_config/access_gate` (cached within a request).
- The Firestore rules were checked structurally, not against the emulator.
  Run the emulator suite before step 5 if one is set up.
- Exported PDFs carry an "Evaluation copy" or "Licensed to" footer for pilot
  and organisation accounts. School names in non-Latin scripts are omitted
  from that footer (font limitation); the email and date remain.
- Tool screens are still viewable by signed-out visitors (interface only; no
  generation without an entitled account).
