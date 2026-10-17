# Riya on your machine — local runbook (Windows, PowerShell)

How to run Sahayak with Sampark and the Riya calls tab locally against the Firestore emulator, rehearse calls in **Practice** mode, test the webhook without a call, and what is needed before the one authorised **Test** call.

**Status markers.**

- **[verified]** — run by Claude, end to end, on a Linux copy of this exact branch (headless Chromium for the browser steps).
- **[verified-windows]** — run on your Windows laptop. Nothing carries this marker yet: Claude's shell on your laptop did not start in this session.
- **[unverified]** — not run anywhere. Report the first failure.

Nothing here touches production. You never need a production key.

---

## 0. What you need

| Tool | Version | Notes |
|---|---|---|
| Node.js | **20.20.2**, the portable copy in `E:\sargvision\riya-tools\` | `package.json` requires `>=20 <21`. Do **not** change your global Node. |
| Java | 11 or newer (17 is fine) | The Firestore emulator is a Java program. |
| Branch | `integration/riya-elevenlabs-squashed` in `E:\sargvision\riya-wt` | With the v6 commit or later. |
| Dependencies | `npm ci` once in `sahayakai-main` | |
| Network | npm registry; `storage.googleapis.com` the first time only | The emulator JAR (about 60 MB) downloads once into `%USERPROFILE%\.cache\firebase\emulators`. |

## 1. One command  [launcher verified on Linux; PowerShell wrapper unverified]

```powershell
cd E:\sargvision\riya-wt\sahayakai-main
powershell -ExecutionPolicy Bypass -File scripts\sampark\Start-Riya-Local.ps1
```

The wrapper puts the portable Node 20 first on PATH **for that window only**, checks Java, and runs `scripts/sampark/riya-local.mjs`, which:

1. checks Node and Java;
2. writes a Firestore-only Firebase config to `%TEMP%\riya-local\firebase.riya-emulator.json` (outside the repository — see §2 for why);
3. starts the emulator for project `demo-sahayakai` and waits for a real TCP connection on `127.0.0.1:8080`;
4. generates a disposable PII key, phone pepper and webhook secret **in memory only** and gives the same values to the seed and the app;
5. seeds `hillview-demo`, starts `next dev`, waits until `/sampark/hillview-demo/riya` answers, and opens `http://localhost:3000/sampark`;
6. if it is outside 10:00–20:00 IST, starts the app's Sampark clock at 11:00 IST today (emulator only, see §8) so Practice calls are not refused at night; `-RealClock` turns that off;
7. waits at a menu: **f** add the synthetic family, **w** run the signed webhook checks, **s** status, **q** quit (stops the app and the emulator).

Options: `-ReuseEmulator` (use an emulator you already started on 8080), `-RealClock`, `-NoOpen`, `-Port 3001`, `-ToolsDir <folder with node.exe>`.
If the window is closed instead of using **q**: `powershell -ExecutionPolicy Bypass -File scripts\sampark\Start-Riya-Local.ps1 -Stop`.

What Claude ran (Linux, Node 22, same branch; exit 0):

```
== 2. Firestore emulator … TCP 127.0.0.1:8080 accepts connections  ok
== 4. Seed hillview-demo … organizations/hillview-demo (admin dev-user-123, isDemoData true)
== 5. Sahayak (next dev) … GET /sampark/hillview-demo/riya → HTTP 200
[f] … synthetic family "Meena Demo (synthetic)" → "Asha Demo"
[w] bad 401 · stale 401 · other agent 200 · authentic 200 · duplicate 200 · late failure 200
[q] Stopping the app and the emulator…  (port 3000 closed afterwards)
```

Then do §6–§9 in the browser.

## 2. The emulator, by hand  [config fix verified on Linux]

**Why `firebase emulators:start --only firestore` failed with "Cannot emulate a web framework because the experiment webframeworks is not enabled".** The repository's `firebase.json` declares **Hosting** with `"source": "."` and `frameworksBackend` (a Next.js web-framework deployment). `emulators:start` validates the Hosting framework from that file before it looks at `--only`, so even a Firestore-only start stops there. Claude reproduced exactly this message with `firebase-tools@13.35.1`.

**Fix (no repo or global change):** point the CLI at a Firestore-only config that lives outside the repository. Do not enable the `webframeworks` experiment and do not edit `firebase.json`.

```powershell
$cfgDir = Join-Path $env:TEMP 'riya-local'; New-Item -ItemType Directory -Force $cfgDir | Out-Null
@'
{
  "firestore": {},
  "emulators": {
    "firestore": { "host": "127.0.0.1", "port": 8080 },
    "ui": { "enabled": false },
    "singleProjectMode": true
  }
}
'@ | Set-Content -Encoding ascii (Join-Path $cfgDir 'firebase.riya-emulator.json')

$env:npm_config_cache = Join-Path $env:LOCALAPPDATA 'npm-cache-riya-firestore'   # the clean cache that fixed "Cannot find module 'async'"
npx -y firebase-tools@13 emulators:start --only firestore --project demo-sahayakai --config (Join-Path $cfgDir 'firebase.riya-emulator.json')
```

- **Verified:** with this config the CLI passes the Hosting check and goes on to download and start the Firestore emulator (Claude's sandbox then stopped at the download, which its network blocks; your laptop can reach it).
- **Rules:** the config omits `firestore.rules`; the emulator then allows everything. Sampark only uses the Admin SDK, which ignores rules anyway.
- **Ready check (a real TCP check, not a process check):** `Test-NetConnection 127.0.0.1 -Port 8080` → `TcpTestSucceeded : True`.
- **Project id:** `demo-sahayakai` is a `demo-` id; it can never resolve to a real Google Cloud project.
- **If the JAR download fails:** the error says `download failed`. That is network or proxy access to `storage.googleapis.com`, nothing else. Allow it once; the JAR is then cached.

## 3. Disposable local values (manual path only)

The launcher does this for you. By hand, terminals 2 and 3 need the **same** values (the seed encrypts the demo phone; the app decrypts it):

```powershell
$env:SAMPARK_PII_KEY = [Convert]::ToBase64String((1..32 | ForEach-Object { [byte](Get-Random -Maximum 256) }))
$env:SAMPARK_PHONE_PEPPER = "local-dev-pepper"
$env:SAMPARK_PII_KEY   # copy into the other terminal as: $env:SAMPARK_PII_KEY = "<value>"
```

They live only in the shell session. Never put them in a file in the repository.

## 4. Seed the demo school (manual path)  [verified]

```powershell
cd E:\sargvision\riya-wt\sahayakai-main
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"; $env:GCLOUD_PROJECT = "demo-sahayakai"
# plus §3
npx tsx scripts/sampark/seed-emulator.ts
```

- Creates `organizations/hillview-demo` with `dev-user-123` as admin, plus that user's profile. Refuses to run without `FIRESTORE_EMULATOR_HOST`.
- Uses the same project id rule as the app (`GCLOUD_PROJECT`, else `demo-sahayakai`), so both see the same data.
- **After §7** run it again with `--riya-demo-family` to add "Meena Demo (synthetic)" → "Asha Demo" (English; notices and recorded-conversation consent; phone `+915000000101`, a reserved synthetic number that is never dialled — Practice uses the simulator only). If Sampark is not enabled yet it says so and exits with code **3**.

## 5. Start Sahayak (manual path)  [verified]

```powershell
cd E:\sargvision\riya-wt\sahayakai-main
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"; $env:GCLOUD_PROJECT = "demo-sahayakai"
$env:SAMPARK_ENABLED = "true"; $env:SAMPARK_ELEVENLABS_ENABLED = "true"; $env:SAMPARK_RIYA_PURPOSES = "ptm_invitation"
# plus §3 (same values), and for §9:
$env:ELEVENLABS_WEBHOOK_SECRET = "local-disposable-secret"; $env:ELEVENLABS_API_KEY = "local-placeholder-not-a-key"
$env:ELEVENLABS_AGENT_ID = "agent_localtestlocaltestlocaltest0"; $env:ELEVENLABS_AGENT_PHONE_NUMBER_ID = "phnum_localtestlocaltestlocaltest0"
$env:ELEVENLABS_SOURCE_AGENT_ID = "agent_sourcesourcesourcesource0000"
# optional at night (emulator only): $env:SAMPARK_DEV_NOW = "2026-10-17T11:00:00+05:30"
node node_modules\next\dist\bin\next dev
```

`node node_modules\next\dist\bin\next dev` is what `npm run dev` runs; calling it directly avoids `cmd.exe` mis-reading the script's forward-slash path.

The log shows `Initialized for the local Firestore emulator (development only)`; no service-account key is read and Secret Manager is not called. Ignorable warnings: `MISSING FIREBASE_SERVICE_ACCOUNT_KEY` (generic startup check), `GOOGLE_GENAI_API_KEY`, Twilio, Sentry, and `/api/health` returning 503 (it probes services the emulator does not provide).

## 6. Sign in with the development login  [verified, including in your browser pane]

1. Open `http://localhost:3000/sampark`.
2. DevTools (F12) → Console: `document.cookie = "auth-token=dev-token; path=/"`, then reload.

In development only, the middleware maps that cookie to `dev-user-123` (the seeded school admin); `SamparkAuthGate` keeps it in place. It is refused outside development and compiled out of production builds.

**If you are also signed in with Google in the same browser** (fixed in v7). The API client used to attach your Google user's Firebase token to every request, and the middleware prefers that token over the cookie, so the console ran as your Google account (not an admin of Hillview) and the school routes answered **403**. Your Google account is correctly not an admin of the demo school, so the server was right. Now, in development only, for same-origin `/api/sampark/...` requests while the exact `auth-token=dev-token` cookie is set, the client sends no Bearer and the browser sends the cookie (`src/lib/api/client.ts`, `fetchAudioBlob` too). Auth-context also no longer overwrites that exact cookie with the Google token on page load (`src/lib/dev-login.ts`), which caused a 403 on first load. Production, other paths, and browsers without the dev cookie are unchanged. The server's admin check is untouched: the same browser with the Google Bearer still gets `403` on `/api/sampark/hillview-demo/school`.

## 7. Enable Sampark for the demo school  [verified]

On `/sampark`, **Hillview Demo School → Enable school calls**. You land on `/sampark/hillview-demo`, in **Practice** mode. Then add the family: launcher **f**, or `npx tsx scripts/sampark/seed-emulator.ts --riya-demo-family` (with §3/§4 variables).

## 8. Practice a Riya call  [verified]

1. Open `http://localhost:3000/sampark/hillview-demo/riya` (Sampark navigation → **Riya calls**).
2. **What is the call about?** → PTM invitation; **Family** → Meena Demo (synthetic) — Asha Demo (7B).
3. A **future date** and a time → **Preview what Riya will say**. Observed:
   - To: Meena Demo (synthetic) (Mother) about Asha Demo
   - Rings: phone ending 0101 (simulated, nothing rings)
   - "Hello, this is Riya, calling from Hillview Demo School, with an important update. Is this a good time to talk?"
   - "I'm calling to invite you to the parent-teacher meeting for your child's class, Seven, section B, on Wednesday, the twenty-first of October at ten o'clock in the morning."
4. Optional: a **Practice: what happens on the call** scenario.
5. **Run practice call** → confirm in the dialog. Observed under **Recent Riya calls**: *PTM invitation · Meena Demo (synthetic) (Asha Demo) · Phone ending 0101 · Simulated · 48 s · Conversation ended · Good time to talk: Yes · Coming to the meeting: Can attend*. **Details** shows the announcement and "No transcript is kept for this call."

No ElevenLabs or telephone request left the browser (checked) or the server (the simulator is in-process; `riya-panel.test.tsx` asserts no fetch).

**Calling hours.** Practice obeys the same 10:00–20:00 IST window as real calls; at night the preview says "Outside the school calling hours." `SAMPARK_DEV_NOW` (set automatically by the launcher at night) starts the app's Sampark clock at that instant and lets it run forward. It is ignored unless `FIRESTORE_EMULATOR_HOST` is set and `NODE_ENV` is not production. Webhook signature freshness always uses the real clock (fixed in this version; it used to follow the rehearsal clock).

## 9. Test the webhook without a call  [verified]

Launcher: **w** (after one Practice call). By hand, with the §5 variables:

```powershell
npx tsx scripts/sampark/seed-riya-webhook-fixture.ts --conversation conv_local_test_1   # emulator only
node scripts/sampark/send-test-riya-webhook.mjs --conversation conv_local_test_1 --bad-signature
node scripts/sampark/send-test-riya-webhook.mjs --conversation conv_local_test_1 --stale
node scripts/sampark/send-test-riya-webhook.mjs --conversation conv_local_test_1 --agent agent_otherotherotherotherother000
node scripts/sampark/send-test-riya-webhook.mjs --conversation conv_local_test_1
node scripts/sampark/send-test-riya-webhook.mjs --conversation conv_local_test_1               # duplicate
node scripts/sampark/send-test-riya-webhook.mjs --conversation conv_local_test_1 --type failure  # out of order
node scripts/sampark/send-test-riya-webhook.mjs --conversation conv_never_linked_x
```

`seed-riya-webhook-fixture.ts` copies the newest Practice call into a record shaped like an **accepted Test call** (provider elevenlabs, state initiated, that conversation id, linked create-only). It dials nothing and refuses to run unless the emulator is on this machine.

| Event | Observed (Linux, dev server + emulator) |
|---|---|
| Bad signature | `HTTP 401 {"ok":false,"error":"unauthorized"}` |
| Stale (1 h old) | `HTTP 401` |
| Another agent | `HTTP 200 {"ok":true}`; record unchanged (still initiated) |
| Authentic post-call | `HTTP 200`; record → completed, 12 s, success, `ptm_attendance: can_attend` |
| Duplicate | `HTTP 200`; no second application |
| Late `call_initiation_failure` | `HTTP 200`; state stays completed (no regression) |
| Unlinked, young | `HTTP 503 {"ok":false,"error":"not yet linked"}` (ElevenLabs retries) |
| Non-local `--url` | refused by the tool |

Firestore afterwards: `state completed`, `appliedEvents [post_call, initiation_failure]`, `transcript null` (transcripts are not stored unless `SAMPARK_RIYA_STORE_TRANSCRIPTS=true`). The Riya tab shows the call as *Test phone · 12 s · Conversation ended · Coming to the meeting: Can attend*, and Details shows the masked agent/number ids and the conversation id.

## 10. How the pieces fit

```
Browser (Riya tab) ──record ids only──▶ /api/sampark/[orgId]/riya         (org admin + flags)
                                          │  previewRiyaCall / startRiyaCall (src/server/sampark/conversation.ts)
                                          │  Sampark records → gate (consent, hours, pause, suppression…) → facts → variables
                                          │  practice: simulator │ test: ElevenLabs outbound-call, to the school TEST phone only
                                          ▼
                                 ElevenLabs agent (the clone) ──SIP (Vobiz trunk)──▶ phone
ElevenLabs post-call webhook ──HMAC──▶ /api/webhooks/elevenlabs-riya ──▶ link conversation→call ──▶ reducer ──▶ Firestore
Console "Check status" ──▶ /riya/[callId]/reconcile ──▶ GET /v1/convai/conversations/{id} (read-only)
```

- The API key and webhook secret are server-side only; no `NEXT_PUBLIC_` ElevenLabs variable exists (a test enforces it).
- A 200 from the outbound call means only "initiated". The final state comes only from the webhook or a reconcile. Unknown outcomes are never redialled. Live mode is refused in this release.

## 11. Test mode and the single authorised test call  [BLOCKED: needs your read-only check and approvals]

### 11.1 Verify the clone and its number (read-only; run on your laptop)

Claude cannot reach ElevenLabs from its environment and holds no key. Run this yourself; it only sends GET requests and never prints the key, SIP username or password:

```powershell
cd E:\sargvision\riya-wt\sahayakai-main
$sec = Read-Host -AsSecureString "ElevenLabs API key (input hidden)"
$env:ELEVENLABS_API_KEY = [System.Net.NetworkCredential]::new('', $sec).Password
node scripts/sampark/verify-riya-clone.mjs --phone-number-id phnum_8101m535s90df9qa3jy6mdh2b864 `
  --source-file E:\sargvision\sahayakcallagentvarunesh.txt --out $env:TEMP\riya-clone-report.md
Remove-Item Env:ELEVENLABS_API_KEY; Remove-Variable sec
notepad $env:TEMP\riya-clone-report.md
```

- It first reads the number and prints **which agent and branch it is assigned to**, then verifies that agent. Pass `--target <agent id>` to check a specific agent instead.
- The source agent id is read from the export and fetched with GET only (checks 2 and 11g). Nothing is written to ElevenLabs.
- The key lives only in that PowerShell session (`NetworkCredential` works in Windows PowerShell 5.1 and PowerShell 7); the report contains no key, SIP username or password, and is written outside the repository.
- If check 1 fails with the target equal to the source, the number is still assigned to Varunesh's agent: stop there.


What the report must show before a call:

| Check | Needed |
|---|---|
| 1, 3, 10 | target fetched; it is not the source; the expected branch |
| 5d | the preview opening equals the agent's first message word for word; if the clone now opens with an AI disclosure (12e), update `RIYA_OPENING_TEMPLATE` in `riya-purposes.ts` to the exact text the report prints |
| 7, 8a–8e | six branches; every `{{variable}}` is one of Sahayak's 14 |
| 11a + 1 | `phnum_8101…b864` is assigned to an agent that is **not** Varunesh's (when you pass `--target`, it must be that agent) |
| 11b, 11d, 11e, 11f | SIP trunk, outbound enabled, TCP/TLS, outbound credentials configured |
| 11g | Varunesh's agent still has its own number (source read from the export automatically) |
| 12a, 12h | audio recording and transcript retention, each checked separately |
| 12b–12g | auth on, post-call webhook set, call limits, AI disclosure, overrides locked, fallback edge |

What Claude established offline: `phnum_8101…b864` is **not** the phone-number resource in Varunesh's export, but it has the **same DID (…3645), outbound host and SIP username**. It is therefore a second ElevenLabs resource for the same Vobiz number. Whether it is assigned to the clone, and whether ElevenLabs and Vobiz accept two resources for one DID, is exactly what checks 11a–11g and the first call will show. The source agent's variables, from the export, are exactly Sahayak's 14 (none missing, none extra).

### 11.2 Remaining prerequisites (the variables come from `src/server/sampark/conversation.ts` and `elevenlabs-client.ts`)

1. **A public HTTPS URL for the webhook** on an authorised non-production deployment, the workspace post-call webhook pointing at `/api/webhooks/elevenlabs-riya` (created with your approval), and its secret stored server-side only.
2. **The test phone** saved in the demo school's Settings (a phone you own), and the mode set to **Test**.
3. **Server environment** on that deployment (values from the authorised owner; never in a file in the repo):
   - `SAMPARK_ENABLED=true`, `SAMPARK_ELEVENLABS_ENABLED=true`, `SAMPARK_LIVE_DIAL_ENABLED=true`, `SAMPARK_RIYA_PURPOSES=ptm_invitation`
   - `SAMPARK_FIRESTORE_DATABASE=sampark-nonprod` (a real Riya call refuses to run without it)
   - `SAMPARK_PII_KEY`, `SAMPARK_PHONE_PEPPER` (that deployment's own)
   - `SAMPARK_RIYA_TEST_DAILY_CAP=1` for the first call (default 5; 0–20 accepted), so a second Test call that day is refused
   - Leave `SAMPARK_RIYA_RECORDING_OFF_CONFIRMED` unset unless the verifier shows recording off and transcripts not retained (12a/12h); while it is unset, the call needs recorded-conversation consent
   - `SAMPARK_RIYA_STORE_TRANSCRIPTS` unset (no transcript is stored in Sahayak)
   - `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID` (the verified clone), `ELEVENLABS_AGENT_BRANCH_ID`, `ELEVENLABS_AGENT_PHONE_NUMBER_ID` (`phnum_8101…b864` once 11a passes), `ELEVENLABS_SOURCE_AGENT_ID` (Varunesh's; refused as a target), `ELEVENLABS_WEBHOOK_SECRET`
4. **Set your own phone as the school Test phone** on `/sampark/hillview-demo/settings` → Test phone → Save (only the last four digits are shown afterwards). Never edit the synthetic family's phone. Then switch the school to **Test — my phone only** (available only when the deployment has `SAMPARK_LIVE_DIAL_ENABLED=true`).
5. **Your go-ahead with the destination named.** The server then dials **only** the school test phone, one call in flight, under the daily cap, inside calling hours, with no automatic retry. If the outcome is unclear, use **Check status** (read-only) before anything else.

## 12. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Cannot emulate a web framework because the experiment webframeworks is not enabled` | The CLI read the repo's `firebase.json` (Hosting). Use the `--config` file from §2 or the launcher. |
| `Cannot find module 'async'` from `npx firebase-tools` | A damaged npm cache. Use the separate cache in §2 (`npm_config_cache`). |
| `download failed` starting the emulator | No access to `storage.googleapis.com` (proxy/firewall). Needed once. |
| `Firebase Init Failed: FIREBASE_SERVICE_ACCOUNT_KEY not found` | `FIRESTORE_EMULATOR_HOST` or `NODE_ENV=development` is missing. Use `next dev`, not `start`. |
| `FIRESTORE_EMULATOR_HOST must be a local address` | Use `127.0.0.1:8080`. |
| `14 UNAVAILABLE … ECONNREFUSED 127.0.0.1:8080` | The emulator isn't running. |
| Page stays on a spinner the first time | `next dev` compiles each page on first visit (10–30 s). Wait or reload. |
| Page asks for Google sign-in | The dev cookie isn't set, or you are not on `next dev` (§6). |
| "Only administrators of this school…" | The seed ran against another emulator, or `GCLOUD_PROJECT` differs between seed and app. |
| Family missing in the Riya picker | Sampark wasn't enabled before `--riya-demo-family` (exit code 3), or the PII key differs between seed and app. |
| "Outside the school calling hours." | 10:00–20:00 IST only. Use the launcher at night, or `SAMPARK_DEV_NOW` (§8). |
| Webhook 401 | Secret differs between app and sender, or the signature is over 30 minutes old (real clock). |
| Webhook 503 `not yet linked` | Normal for an unknown conversation under 15 minutes old. |
| `ELEVENLABS_AGENT_ID_IS_SOURCE_EXPORT` | You configured Varunesh's agent. Use the clone. |
| `NONPROD_DATABASE_REQUIRED` | A real call needs `SAMPARK_FIRESTORE_DATABASE=sampark-nonprod`. |

## 13. Stop and clean up

- Launcher: **q**, or `Start-Riya-Local.ps1 -Stop` if the window was closed.
- By hand: Ctrl+C in each terminal. The emulator keeps no data after it stops.
- `%TEMP%\riya-local` holds only the emulator config, process ids and logs (no secrets). Nothing to delete in the repository.

## 14. Never during local development

- Never point the app at production Firestore (Sampark refuses outside production without the emulator anyway), and never use the production service-account key.
- Never touch Varunesh's original agent; never buy, detach or reassign numbers; never create a webhook or rotate Vobiz credentials without approval.
- Never expose the dev server through a tunnel.
- Never commit any key, secret, `.env` file or agent backup.
- Never turn on Live mode, and never call any number that isn't the approved test phone.
