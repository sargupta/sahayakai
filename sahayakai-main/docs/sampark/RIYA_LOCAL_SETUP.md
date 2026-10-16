# Riya on your machine — local runbook (Windows, PowerShell)

How to run Sahayak with Sampark and the Riya calls tab locally against the Firestore emulator, rehearse calls in **Practice** mode, test the webhook without a call, and what is needed before the one authorised **Test** call.

**Status markers.** Every command is marked:

- **[verified]** — run by Claude in a Linux copy of this exact branch.
- **[verified-browser]** — checked in your browser.
- **[unverified]** — not yet run anywhere. Report the first failure.

Nothing here touches production. You never need a production key.

---

## 0. What you need

| Tool | Version | Notes |
|---|---|---|
| Node.js | **20.20.2**, the portable copy in `E:\sargvision\riya-tools\` | `package.json` requires `>=20 <21`. Do **not** change your global Node 24. |
| Java | 11 or newer | The Firestore emulator is a Java program. Check with `java -version`. |
| Branch | `integration/riya-elevenlabs-squashed` in `E:\sargvision\riya-wt` | Commit `6bb4fa0b` or later. |
| Network | npm registry; `storage.googleapis.com` the first time only | The emulator JAR downloads once. |

## 1. Select Node 20 in every terminal  [unverified]

Run this in each new terminal:

```powershell
$node = (Get-ChildItem E:\sargvision\riya-tools -Recurse -Filter node.exe | Select-Object -First 1).DirectoryName
$env:Path = "$node;$env:Path"
node -v      # must print v20.20.2
```

## 2. Terminal 1 — Firestore emulator  [unverified on Windows]

```powershell
cd E:\sargvision\riya-wt\sahayakai-main
npx -y firebase-tools@13 emulators:start --only firestore --project demo-sahayakai
```

- **Ready when** it prints `All emulators ready` and Firestore is on `127.0.0.1:8080`.
- **Check from another terminal:** `Test-NetConnection 127.0.0.1 -Port 8080` should show `TcpTestSucceeded : True`.
- **Port:** `firebase.json` has no `emulators` section, so 8080 is the default.
- **Project id:** `demo-sahayakai` is a `demo-` project id. It can never resolve to a real Google Cloud project.
- **Note:** Claude could not run this step. The emulator JAR download is blocked in its environment.

## 3. Disposable local values — every terminal that runs app code

These are throwaway values that live only in the shell session. They are not secrets, and nothing is written to a file. **Terminals 2 and 3 need the SAME values** (the seed encrypts the demo phone, the app decrypts it). Generate them once, then paste the same two lines into both terminals:

```powershell
$env:SAMPARK_PII_KEY = [Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Maximum 256) }))
$env:SAMPARK_PHONE_PEPPER = "local-dev-pepper"
$env:SAMPARK_PII_KEY   # copy this value into terminal 3 as: $env:SAMPARK_PII_KEY = "<value>"
```

## 4. Terminal 2 — seed the demo school  [unverified on Windows]

```powershell
cd E:\sargvision\riya-wt\sahayakai-main
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"; $env:GCLOUD_PROJECT = "demo-sahayakai"
# (plus the two lines from §3)
npx tsx scripts/sampark/seed-emulator.ts
```

- **Creates:** `organizations/hillview-demo`, with `dev-user-123` as admin, plus that user's profile.
- **Safety:** the script refuses to run without `FIRESTORE_EMULATOR_HOST`.
- **Second run:** after §7 (enable Sampark), run it again with `--riya-demo-family` to add one synthetic English family, "Meena Demo (synthetic)" → "Asha Demo". It has notices and recorded-conversation consent, and phone `+915000000101`, which is in the reserved synthetic range and cannot ring a real phone. Unit-tested as eligible for a Practice preview: `riya-demo-family.test.ts`.

## 5. Terminal 3 — start Sahayak  [server path verified]

```powershell
cd E:\sargvision\riya-wt\sahayakai-main
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"; $env:GCLOUD_PROJECT = "demo-sahayakai"
$env:SAMPARK_ENABLED = "true"; $env:SAMPARK_ELEVENLABS_ENABLED = "true"; $env:SAMPARK_RIYA_PURPOSES = "ptm_invitation"
# (plus the two lines from §3, SAME values as terminal 2)
npm run dev
```

**What Claude verified on Linux with the same variables:**

- The log shows `Initialized for the local Firestore emulator (development only). { projectId: 'demo-sahayakai' }`. No service-account key was read, and Secret Manager was not called.
- `/sampark/hillview-demo/riya` → 200.
- `/api/sampark/hillview-demo/riya` with the dev cookie gets past sign-in.
- Without an emulator it fails with `ECONNREFUSED 127.0.0.1:8080`, which is the expected next dependency.

**Warnings you can ignore** for Practice:

- `MISSING FIREBASE_SERVICE_ACCOUNT_KEY`. This is the generic startup check; the emulator path does not use the key.
- `GOOGLE_GENAI_API_KEY` (AI features only).
- Twilio and Sentry warnings.

## 6. Sign in with the documented development login  [unverified in your browser]

1. Open `http://localhost:3000/sampark`.
2. Open DevTools (F12) → Console, run `document.cookie = "auth-token=dev-token; path=/"`, then reload.

How it works:

- In development only, the middleware maps that cookie to `x-user-id: dev-user-123` (`src/middleware.ts`).
- `SamparkAuthGate` keeps the cookie in place on the client.
- The dev token is refused outside development, and the bypass is compiled out of production builds.

## 7. Enable Sampark for the demo school  [unverified in your browser]

1. Open `http://localhost:3000/sampark/hillview-demo` and choose **Enable** with the name "Hillview Demo School". The school starts in **Practice** mode.
2. Run the seed again with the family: in terminal 2, `npx tsx scripts/sampark/seed-emulator.ts --riya-demo-family`.

**Alternative: import a realistic CRM** (terminal 4).

```powershell
cd E:\sargvision\riya-wt\mock-school-crm; npm ci; npm start   # port 4700
```

1. Download `http://localhost:4700/v1/export/students.csv` and `.../guardians.csv` (see `mock-school-crm/README.md` for its API key header).
2. Upload both on the console's Settings → School records.
3. On **Families**, give one family the language **English** and the consents **Notices** and **Recorded conversation**.

## 8. Use the Riya tab in Practice  [verified in jsdom; unverified in your browser]

1. Open `http://localhost:3000/sampark/hillview-demo/riya`. The **Riya calls** tab is in the Sampark navigation.
2. Pick **What is the call about?** → PTM invitation, then **Family** → Meena Demo — Asha Demo.
3. Enter a **future date** and a time, then choose **Preview what Riya will say**.
4. Check what the preview shows:
   - the recipient;
   - "Rings: phone ending 0101 (simulated, nothing rings)";
   - the opening line and the exact announcement;
   - any refusal.
5. Optional: choose a **Practice: what happens on the call** scenario, such as cannot attend, wrong person, busy, or provider timeout.
6. Choose **Run practice call**, then confirm. The result appears under **Recent Riya calls**, with its state and collected answers.

Practice mode uses only the in-process simulator. No ElevenLabs or telephone request is made; the test `riya-panel.test.tsx` asserts no network request leaves the page.

## 9. Test the webhook without a call  [verified]

Run this with the app from §5 restarted with a **disposable** local secret and agent id. Never use the real secret locally.

```powershell
# terminal 3, before npm run dev:
$env:ELEVENLABS_WEBHOOK_SECRET = "local-disposable-secret"
$env:ELEVENLABS_API_KEY = "local-placeholder-not-a-key"
$env:ELEVENLABS_AGENT_ID = "agent_localtestlocaltestlocaltest0"
$env:ELEVENLABS_AGENT_PHONE_NUMBER_ID = "phnum_localtestlocaltestlocaltest0"
$env:ELEVENLABS_SOURCE_AGENT_ID = "agent_sourcesourcesourcesource0000"
# another terminal, same two ELEVENLABS_WEBHOOK_SECRET / ELEVENLABS_AGENT_ID values:
node scripts/sampark/send-test-riya-webhook.mjs                 # authentic event
node scripts/sampark/send-test-riya-webhook.mjs --bad-signature # → 401
node scripts/sampark/send-test-riya-webhook.mjs --stale         # → 401 (replay window)
node scripts/sampark/send-test-riya-webhook.mjs --agent agent_otherotherotherotherother000  # → 200, ignored
```

| Event | Observed by Claude (Linux, same branch) |
|---|---|
| Bad signature | 401 |
| Stale | 401 |
| Other agent | 200, ignored |
| Non-local `--url` | refused by the tool itself |
| Authentic event, no emulator running | 500, from `ECONNREFUSED`. ElevenLabs would retry it. |

With the emulator running, an authentic event for an unknown conversation returns **503** while it is under 15 minutes old (ElevenLabs retries), and **200** after that.

The full apply / duplicate / out-of-order / user-id-fallback behaviour is covered by `riya-service.test.ts`. Seeing it with the dev server needs a Test-mode call record, so it can only be observed after §11.

## 10. How the pieces fit

```
Browser (Riya tab) ──record ids only──▶ /api/sampark/[orgId]/riya         (org admin + flags)
                                          │  previewRiyaCall / startRiyaCall (src/server/sampark/conversation.ts)
                                          │  Sampark records → gate (consent, hours, pause, suppression…) → facts → variables
                                          │  practice: simulator │ test: ElevenLabs outbound-call, to the school TEST phone only
                                          ▼
                                 ElevenLabs agent (the clone) ──SIP──▶ phone
ElevenLabs post-call webhook ──HMAC──▶ /api/webhooks/elevenlabs-riya ──▶ link conversation→call ──▶ reducer ──▶ Firestore
Console "Check status" ──▶ /riya/[callId]/reconcile ──▶ GET /v1/convai/conversations/{id} (read-only)
```

- **Secrets stay server-side.** The API key and webhook secret are server-side only; a test enforces it, and no `NEXT_PUBLIC_` ElevenLabs variable exists.
- **Outcomes come from the provider.** A 200 from the outbound call means only "initiated". The final state comes only from the webhook or a reconcile.
- **Unknown outcomes are never redialled.**
- **Live mode is refused** in this release.

## 11. Test mode and the single authorised test call  [BLOCKED: needs approvals]

**Prerequisites. All are required and none are done:**

1. **Agent id confirmed.** Read the clone with `scripts/sampark/verify-riya-clone.mjs` (GET only).
2. **A phone number assigned to the clone.** You must approve a new number, or reassigning one. Claude will not do this.
3. **A public HTTPS URL for the webhook**, on an authorised non-production deployment. Then the workspace post-call webhook is created for it, with your approval, and its secret stored server-side only.
4. **The test phone** saved in the demo school's Settings, and mode set to **Test**.
5. **Server environment** (values from the authorised owner; never put them in a file in the repo):
   - `SAMPARK_LIVE_DIAL_ENABLED=true`
   - `SAMPARK_FIRESTORE_DATABASE=sampark-nonprod`. A real Riya call refuses to run without it. With the emulator, the emulator is used instead, but the guard still requires this value; set it.
   - `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` (the clone), `ELEVENLABS_AGENT_BRANCH_ID`, `ELEVENLABS_AGENT_PHONE_NUMBER_ID`, `ELEVENLABS_SOURCE_AGENT_ID` (Varunesh's, refused as a target), `ELEVENLABS_WEBHOOK_SECRET`.
6. **Your explicit go-ahead, with the destination named.** The server can then dial **only** the school test phone, with at most 1 call in flight, a daily cap, and no automatic retry.

## 12. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Firebase Init Failed: FIREBASE_SERVICE_ACCOUNT_KEY not found` | `FIRESTORE_EMULATOR_HOST` or `NODE_ENV=development` is missing. Use `npm run dev`, not `start`. |
| `FIRESTORE_EMULATOR_HOST must be a local address` | Use `127.0.0.1:8080`. |
| `14 UNAVAILABLE … ECONNREFUSED 127.0.0.1:8080` | The emulator isn't running (§2). |
| Page asks for Google sign-in | The dev cookie isn't set, or you're not on `npm run dev` (§6). |
| "Only administrators of this school…" | The seed didn't run against the same emulator, or `GCLOUD_PROJECT` differs between terminals 2 and 3. |
| "Not found. School calls may not be switched on…" | `SAMPARK_ENABLED` or `SAMPARK_ELEVENLABS_ENABLED` isn't `true` in terminal 3. |
| Family missing in the Riya picker | Sampark wasn't enabled before `--riya-demo-family`, or the PII key differs between the seed and the app. |
| Preview refusal "has not agreed to recorded calls" | Grant the Recorded conversation consent on Families. |
| Preview refusal "Outside the school calling hours" | Routine calls run 10:00–20:00 IST, not on off-days or holidays. |
| Webhook 401 | The secret differs between the app and the sender, or the timestamp is more than 30 minutes old. |
| Webhook 503 | The conversation isn't linked yet (normal for an event under 15 minutes old). |
| `ELEVENLABS_AGENT_ID_IS_SOURCE_EXPORT` | You configured Varunesh's agent. Use the clone. |
| `NONPROD_DATABASE_REQUIRED` | A real call needs `SAMPARK_FIRESTORE_DATABASE=sampark-nonprod`. |

## 13. Stop and clean up

- Press Ctrl+C in each terminal.
- The emulator keeps no data after it stops, unless you started it with `--export-on-exit`.
- Close the PowerShell windows to drop the disposable variables.
- Nothing to delete in the repo.

## 14. Never during local development

- Never point the app at production Firestore. Without the emulator, Sampark refuses to start outside production anyway.
- Never use the production service-account key, or let the app fetch it from Secret Manager.
- Never touch Varunesh's original agent.
- Never buy or reassign numbers, or create a webhook without approval.
- Never expose your dev server through a tunnel.
- Never commit any key, secret, `.env` file or agent backup.
- Never turn on Live mode, and never call any number that isn't the approved test phone.
