# Gemini Live — Build → Verify → Deploy Plan

**Status:** active build plan. **Last updated:** 2026-07-29.
**Scope:** ship Gemini Live voice to production across three repos — the web proxy route (`sahayakai-main`), the `vidya_voice` Python sidecar (`sahayakai-agents`), and the Flutter Live client (`sahayakai-flutter`). **Additive, behind a `voiceMode` flag; the turn-based STT→classifier→TTS pipeline stays and is the fallback — never deleted.**

Companion: `GEMINI_LIVE_AND_PARITY_PROGRAM.md` (the directive/why). This file is the concrete, ordered, executable *how*.

## Repos and canonical paths

| Role | Repo | Path |
|---|---|---|
| Web (Next.js) | `sahayakai-main` | `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main` |
| Sidecar (FastAPI) | `sahayakai-agents` | `/Users/sargupta/SahayakAIV2/sahayakai/sahayakai-agents` |
| Flutter client | `sahayakai-flutter` | `/Users/sargupta/SahayakAIV2/wt-flutter-rebuild/sahayakai-flutter` |

## Current state (verified 2026-07-29)

- Web route `POST /api/vidya-voice/start-session` **does not exist** (`src/app/api/vidya-voice/` absent). The browser spike `src/components/omni-orb-live.tsx` calls it but nothing serves it. **This is the single wire that blocks the whole path.**
- Sidecar router `POST /v1/vidya-voice/start-session` **exists and is mounted** (`main.py:229`) — but its token-mint path is very likely broken in prod (see Phase 1).
- `gcloud config` active project is **`atithi-dev-503606` (DEV)**; prod is **`sahayakai-b4248`**. Account `contact@sargvision.com`. **Set the project deliberately before any deploy.**
- Web branches: `develop` → `sahayakai-preview` (PREVIEW), `main` → `sahayakai-hotfix-resilience` (PROD), per `scripts/safe-deploy.sh`. `develop` and `main` both exist.
- Flutter worktree on `feature/flutter-rebuild`.
- `adb` at `~/Library/Android/sdk/platform-tools/adb` (not on PATH). Target device: **emulator-5554**.

## Ordering principle

The Live workstream is **independent of the Attendance/parent-call workstream** — nothing here waits on attendance. Within Live, the hard dependency chain is:
**Phase 1 (sidecar mint actually works)** → **Phase 2 (web proxy route)** → **Phase 3 (Flutter client)** → **Phase 4 (on-device verify)** → **Phase 5 (deploy, gated by the founder checkpoint)**.
Phase 0 (access + deploy-state recon) can and should run first and in parallel with Phase 3 client scaffolding — but **no production deploy happens until Phase 4 passes and the founder checkpoint is cleared.**

---

## Phase 0 — Preconditions & access recon (do first; blocks nothing else from starting)

The two biggest unknowns are *whether the Gemini key can mint Live ephemeral tokens at all* and *what the deployed sidecar actually contains*. Resolve both before writing deploy scripts.

0.1 **Confirm the sidecar's live prod revision and whether it contains the `vidya_voice` router.**
```bash
gcloud config set project sahayakai-b4248
gcloud run services describe sahayakai-agents --region=asia-southeast1 --format='value(status.latestReadyRevisionName,status.url)'
gcloud run revisions list --service=sahayakai-agents --region=asia-southeast1 --limit=5
# also the staging service, which the committed cloudbuild pipeline actually targets:
gcloud run services describe sahayakai-agents-staging --region=asia-southeast1 --format='value(status.latestReadyRevisionName)'
```
Note: the committed `deploy/cloudbuild.yaml` deploys **`-staging`** (`_STAGING_SUFFIX: -staging`), not prod. Do not assume the running prod revision was built from a commit containing the router.

0.2 **Probe Live-token access with a real call (cannot be verified statically).** Under the current prod config the mint path is expected to **502**, for two independent reasons documented in Phase 1. Run a real POST against the sidecar (through the deployed auth chain, or a local run with the prod key) and read the error body. A prior review recorded this key's project returning `403 PERMISSION_DENIED "project has been denied access"` — treat Live entitlement as **unconfirmed until a mint succeeds**.

0.3 **Cost/quota sanity.** Gemini Live bills per audio token continuously while the socket is open (materially higher than turn-based STT+TTS). Before any prod exposure, decide a per-session time cap and a daily ceiling (there is no cost guard in the sidecar today).

**Exit criteria for Phase 0:** you know (a) which revision runs in prod and whether it has the router, and (b) whether the key can mint a Live token — or exactly which of the Phase-1 fixes is required to make it.

---

## Phase 1 — Sidecar: make the ephemeral-token mint actually work (`sahayakai-agents`)

Branch from the sidecar repo's mainline (its own convention). Two fixes are almost certainly required; both are caught today and surface as a 502.

1.1 **`v1alpha` API version (ship-blocker).** `auth_tokens.create()` is v1alpha-only; the router builds the client with no `http_options`, defaulting to v1beta, so the mint raises and is caught → 502.
- **File:** `src/sahayakai_agents/agents/vidya_voice/router.py` (~line 96, inside `_mint_ephemeral_token`).
- **Change:** build the client with `http_options=genai_types.HttpOptions(api_version="v1alpha")`. `build_genai_client(api_key, **kwargs)` already forwards kwargs (`_adk_keyed_gemini.py`), so pass it through there rather than hard-coding a second client path.

1.2 **Developer API vs Vertex (ship-blocker).** Ephemeral tokens are a Gemini **Developer API** feature; Vertex does not support them. `config.py` `use_vertexai` defaults **True**, and `service.yaml` sets no override, so prod runs Vertex and `genai_keys` returns a Vertex sentinel — the real `GOOGLE_GENAI_API_KEY` secret (which *is* mounted) is never used, and the mint fails.
- **File:** `deploy/service.yaml` — add env `GOOGLE_GENAI_USE_VERTEXAI: "false"` so the mint client uses the Developer-API key. **This is security-sensitive** (changes which API surface/keys prod uses) → call it out at the founder checkpoint.
- **Verify:** `config.py` `genai_keys` returns the real key(s), non-empty (empty pool → 502 by design, `router.py:196-202`).

1.3 **(Hardening, optional but recommended for prod)** token `uses=1` gives no reconnect allowance. Consider `uses=2-3` and revisit `DEFAULT_TOKEN_TTL_SECONDS=60` (`router.py:62`). Note the `instant-answer` enum-vs-tool drift (`schemas.py` has it in `LiveAllowedFlow` but it is intentionally not a registered tool) — leave as-is unless product wants it surfaced.

1.4 **Do not change** the tool set (9 NAVIGATE_AND_FILL flows, `agent.py:76-148`), the WSS constant (`router.py:67`), or the request/response schemas — the Flutter and web sides are built against them.

**Verify locally:** run the sidecar with the prod Developer-API key + v1alpha and confirm `auth_tokens.create()` returns an `AuthToken.name`. Integration tests monkeypatch `google.genai`, so **CI green ≠ real mint works** — a real key call is the only proof.

---

## Phase 2 — Web: the missing proxy route (`sahayakai-main`)

Branch: `feature/vidya-voice-route` **from `develop`** (never `main`). A thin authenticated proxy: browser/app → this route → sidecar `POST /v1/vidya-voice/start-session`, body forwarded 1:1, response passed back verbatim.

2.1 **CREATE `src/app/api/vidya-voice/start-session/route.ts`** — Node runtime (needs `crypto`, `google-auth-library`, `firebase-admin`; **do not** mark it edge).
- Auth: middleware already protects `/api/vidya-voice/*` (not in `isPublicApi` allowlist) and injects `x-user-id` from the verified Firebase Bearer. In the handler:
  ```ts
  const uid = request.headers.get('x-user-id');
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  ```
- Forward the body **unchanged** — the sidecar schema is `extra="forbid"`; adding any field (e.g. `userId`) → 422. `uid` is used only for this route's gate/telemetry, not forwarded.
- Response: on sidecar 200, pass the JSON straight through (`{ sessionToken, wssUrl, expiresInSeconds, sessionConfig, tools, sidecarVersion, spike }`).
- Errors: 401 (missing uid), 502 (sidecar config/mint failure — log, return sanitized `{ error }`, never leak the sidecar body), 500 (unexpected). Follow `api/vidya/session/route.ts` logging convention.

2.2 **CREATE `src/lib/sidecar/vidya-voice-client.ts`** — mirror `callSidecarVidya` (`src/lib/sidecar/vidya-client.ts:151-231`) exactly, changing only the path to `/v1/vidya-voice/start-session`. The sidecar's `auth_middleware` enforces **all** of:
  1. `Authorization: Bearer <google-id-token>` via `GoogleAuth().getIdTokenClient(SAHAYAKAI_AGENTS_AUDIENCE)`.
  2. `X-Content-Digest` + `X-Request-Timestamp` from `signRequest(rawBody)` (fresh timestamp per attempt — replay guard is `(timestamp,digest)`-keyed).
  3. `X-Firebase-AppCheck` via server-side `getServerAppCheckTokenOrNull()` (required when sidecar `SAHAYAKAI_REQUIRE_APP_CHECK=true`) — mint server-side, do **not** forward the browser header.
  4. `X-Request-ID` + `Content-Type: application/json`.
  Bound with an `AbortController` (~10-12s; the sidecar mints a 60s-TTL Google token synchronously). Base URL from `NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL` (strip trailing slash).

2.3 **Feature gate (recommended).** Gate the route behind an env flag mirroring the `DEMO_CALL_ENABLED` lead-magnet pattern (e.g. `VIDYA_VOICE_ENABLED`) so the surface is not exposed in prod until intended. Default off.

2.4 **No middleware change needed.** Path is protected by default; `x-user-id` is injected upstream.

**Verify:** `npm run predeploy` (or `tsc --noEmit` + lint + the sidecar HTTP-contract test family). Add a unit test hitting the route with/without `x-user-id`.

---

## Phase 3 — Flutter: the Live client (`sahayakai-flutter`, branch `feature/flutter-rebuild`)

Additive. Everything downstream of `pendingNavigation` (the RUN verb / `VidyaNavDispatcher` / tool screens) is **reused unchanged**. **Implement the correct Live wire format — do NOT copy the web spike's framing, which is wrong** (the spike sends opus/webm binary and decodes binary output; Live requires PCM16@16k base64 inside JSON `realtimeInput.mediaChunks`, and returns base64 PCM24k inside JSON `serverContent.modelTurn.parts[].inlineData`).

### Files to ADD
- **`lib/features/vidya/data/gemini_live_client.dart`** (+ `.g.dart`) — plain class + `@riverpod` provider (overridable in tests, like `voice_to_text_repository.dart`). Transport `web_socket_channel`. Connect **directly to Google** (`wssUrl + "?access_token=<sessionToken>"`), NOT via `ApiClient`/dio (which only talks to sahayakai.com). Send `setup` (model, systemInstruction, `tools.functionDeclarations` mirroring the `VidyaFlow` wire ids), stream mic PCM up as JSON `realtimeInput.mediaChunks`, receive audio + `toolCall`. Expose streams: partial transcript, output-audio chunks, tool-calls (as `VidyaDirective`), `turnComplete`, error. After dispatching a tool-call, send `toolResponse.functionResponses` back on the socket.
- **`lib/features/settings/data/voice_mode_provider.dart`** (+ `.g.dart`) — persisted keepAlive Riverpod bool (`turnBased` default | `live`), shared_preferences, copying `NotificationPrefsController` / `LocaleController`.
- **(optional) `lib/shared/voice/live_audio_sink.dart`** — 24kHz streaming PCM playback with mid-stream flush for barge-in, if not folded into `AudioPlayerService`.

### Files to CHANGE (additively)
- **`lib/features/vidya/presentation/vidya_controller.dart`** — in `onMicTap()` (:306): if flag == `live` AND the Live client connects → run a new `_beginLive(gen)`; on flag off OR connect/socket failure → fall through to the existing `_begin()` (**the fallback**). Map Live phases onto the existing `VidyaStatus` enum so `SealMic`/captions/terminal panels need zero change. Live `toolCall{name,args}` → `VidyaFlow.fromWire(name)` + `VidyaActionParamsDto.fromJson(args).toDomain()` → set the **same** `state.pendingNavigation` (single) or ink the **same** confirm chips (compound) as `_converse` does. Tear down the Live session in the existing `cancel()` (:326), `clearConversation()` (:372), `_teardownCapture()` (:750); errors route through `_handleError()` (:720).
- **`lib/shared/voice/audio_recorder_service.dart`** — add `startStream()` to the interface + prod impl using `record`'s `AudioRecorder.startStream(RecordConfig(encoder: AudioEncoder.pcm16bits, sampleRate: 16000, numChannels: 1))` → `Stream<Uint8List>`. Keep the file `start()/stop()/cancel()` methods for the fallback.
- **`lib/shared/voice/audio_player_service.dart`** — add `playPcmStream(Stream<Uint8List>)` for raw PCM16@24k (wrap in a WAV header for a `just_audio` `StreamAudioSource`, or a dedicated queued buffer) with a flush for barge-in. Keep `playBase64Mp3()` for the fallback TTS.
- **`pubspec.yaml`** — promote `web_socket_channel` from transitive to a **direct** dependency.
- **`lib/features/settings/presentation/settings_screen.dart`** — add the voiceMode toggle.
- **Start-session fetch:** the client fetches `POST /api/vidya-voice/start-session` via the existing dio `ApiClient` (Firebase Bearer auto-attached), then opens the WS with the returned `sessionToken`. **Never embed a raw Google key in the app.**

### Do NOT change
`vidya_nav_dispatcher.dart`, `vidya_home_screen.dart`, `vidya_sheet.dart`, `app_router.dart`, `tool_prefill.dart`, or any tool screen — the tool-call/RUN-verb chain is reused as-is.

**Gate each unit:** `flutter analyze` 0, `token_guard` PASS, `flutter test --timeout 90s` green (full-suite check when shared/voice code is touched — only the known create_palette failures allowed). Commit explicit paths, no attribution, leave drifting `.g.dart` unstaged, push.

---

## Phase 4 — On-device audio round-trip verification (emulator-5554) — MANDATORY before any "works" claim

No "Gemini Live works on Android" statement is permitted without this passing on a real device. This is a multi-iteration arc, not a one-shot.

```bash
ADB=~/Library/Android/sdk/platform-tools/adb
$ADB devices                 # confirm emulator-5554 is 'device' (online)
# build + install the debug APK (project's normal flutter build/run onto emulator-5554)
$ADB -s emulator-5554 logcat -c   # clear, then tail during the test
$ADB -s emulator-5554 logcat | grep -iE "vidya|live|websocket|pcm|audio"
```

Manual round-trip on emulator-5554 (capture logcat + screenshots as proof):
1. Sign in; Settings → set voiceMode = **live**.
2. Tap mic, speak → confirm **mic PCM16@16k streams up** (WS frames outbound).
3. Confirm **Gemini audio plays back** on the device (PCM24k streamed sink), intelligible.
4. Say a tool phrase (e.g. "make a lesson plan on fractions for grade 5") → confirm a **`toolCall` fires → navigates to the Lesson Plan screen, prefills topic/grade, and auto-submits** (the RUN verb end-to-end).
5. **Barge-in:** speak over the model → playback flushes/interrupts.
6. **Fallback:** set voiceMode = turnBased (and separately, force a socket failure) → confirm the app falls back to the existing STT→classifier→TTS pipeline and still works.

**Exit criteria:** items 2-6 demonstrably pass on emulator-5554 with logcat/screenshot evidence attached. Flag any glyph/latency/back-pressure issue for the founder rather than papering over it.

---

## Phase 5 — Deploy (SAFE-DEPLOY discipline; gated by the FOUNDER CHECKPOINT)

Two separate pipelines: the web route uses `safe-deploy.sh`; the sidecar does **not** (manual `services replace`). **Set the prod project first — gcloud is currently on dev:**
```bash
gcloud config set project sahayakai-b4248
```

### 5A — Web route (`sahayakai-main`, service `sahayakai-hotfix-resilience`, DUAL-REGION)

Never raw `gcloud run deploy`. Always `audit-deployments.sh` before AND after.

1. Land the Phase-2 feature branch to `develop` via PR, `--no-ff`.
2. **Preview first** (from `develop` → `sahayakai-preview`, Singapore):
   ```bash
   git checkout develop
   bash scripts/audit-deployments.sh            # baseline
   bash scripts/safe-deploy.sh                  # → sahayakai-preview
   ```
   Verify the route on preview end-to-end (start-session returns a token; app connects).
3. **>>> FOUNDER CHECKPOINT (see below) — clear it before touching prod. <<<**
4. Promote `develop` → `main` via PR, merge (this is how code reaches `main` — never a direct commit to `main`).
5. **Prod, both regions:**
   ```bash
   git checkout main
   bash scripts/audit-deployments.sh                                  # Singapore baseline
   REGION=asia-south1 bash scripts/audit-deployments.sh               # Mumbai baseline
   bash scripts/safe-deploy.sh                                        # Singapore (asia-southeast1) PROD
   REGION=asia-south1 SERVICE=sahayakai-hotfix-resilience bash scripts/safe-deploy.sh   # Mumbai (asia-south1) PROD
   ```
   `safe-deploy.sh` defaults `--no-traffic --tag=sha-<sha>`. Then flip traffic per region:
   ```bash
   gcloud run services update-traffic sahayakai-hotfix-resilience --region=asia-southeast1 --project=sahayakai-b4248 --to-latest
   gcloud run services update-traffic sahayakai-hotfix-resilience --region=asia-south1     --project=sahayakai-b4248 --to-latest
   ```
6. **Re-audit both regions:**
   ```bash
   bash scripts/audit-deployments.sh
   REGION=asia-south1 bash scripts/audit-deployments.sh
   ```
   Reminder: `safe-deploy.sh` hits **Singapore only** by default — Mumbai must be run explicitly or it stays stale.

### 5B — Sidecar (`sahayakai-agents`, service `sahayakai-agents`, Singapore only — NOT safe-deploy)

The committed `deploy/cloudbuild.yaml` deploys **`-staging`**. For prod, apply `service.yaml` with the image substituted (staging suffix empty):
1. **Staging first:** run the committed pipeline (`gcloud builds submit --config=deploy/cloudbuild.yaml --project=sahayakai-b4248 --region=asia-southeast1 .`) → `sahayakai-agents-staging`. Smoke-test (`scripts/smoke-test-sidecar.sh`) that a real mint now succeeds with the Phase-1 fixes.
2. **>>> Same FOUNDER CHECKPOINT gates the first prod sidecar replace. <<<**
3. **Prod:** build/push the image, substitute `${IMAGE}` in `deploy/service.yaml`, then:
   ```bash
   gcloud run services replace deploy/service.yaml --region=asia-southeast1 --project=sahayakai-b4248
   ```
   (Equivalent: run the pipeline with `_STAGING_SUFFIX=""`.) If a secret version was added (e.g. audience via `scripts/hydrate-audience-secret.sh`), follow with an `update-traffic` so it takes effect.
4. Post-deploy: `scripts/post-deploy-smoke.sh` / `scripts/smoke-test-sidecar.sh`.
5. **Single-region flag:** `service.yaml` is `asia-southeast1` only — no Mumbai sidecar. The Mumbai web region will call the Singapore sidecar cross-region for the start-session mint (60s-TTL token; audio then goes browser/app → Google directly, so the cross-region hop is one small call, not the audio path). Note the added latency and the single point of failure.

---

## FOUNDER CHECKPOINT (explicit — required before the FIRST production deploy of the voice pipeline)

Gemini Live is additive behind a flag and the turn-based fallback is untouched — but the **first prod deploy of anything on the voice path (web route to `main`/prod AND the sidecar prod replace) requires an explicit founder go/no-go.** Do not proceed to Phase 5A step 5 or Phase 5B step 3 without it. Present to the founder:

1. **Preview + on-device evidence** — the Phase-4 round-trip (audio both ways, a tool-call that navigates+prefills+submits, barge-in, fallback) passing on emulator-5554, with logcat/screenshots; plus the preview deploy verified.
2. **The security-sensitive config change** — Phase 1.2 flips prod from Vertex to the Developer-API key for the mint. Confirm the founder accepts which key/project/API surface prod uses, and that its Live entitlement is confirmed (a real mint succeeded, not just CI green).
3. **Cost** — the per-session and daily ceiling from Phase 0.3, and confirmation that continuous per-audio-token billing is acceptable at the intended exposure.
4. **Token policy & data** — `uses`/TTL decision (1.3) and the DPDP audio-retention posture (audio goes browser/app→Google directly; document what is retained).
5. **Rollback** — the flag stays default-off in prod; fallback path stays green; `--no-traffic` tags allow instant revert.

---

## UNKNOWNS / RISKS (honest)

1. **Live API access is the top unknown — likely NO under the current prod config, and not statically verifiable.** Two independent blockers (Phase 1.1 v1alpha, Phase 1.2 Vertex-vs-Developer-API) each force a 502; a prior review recorded this key's project returning `403 PERMISSION_DENIED "project has been denied access"`. **Only a real mint call proves entitlement.** If the key genuinely lacks Live/ephemeral-token access, the whole path is blocked at Google's side regardless of our code — escalate to the founder to enable it on `sahayakai-b4248` (or the Developer-API project the key belongs to).
2. **Sidecar deploy state is the second top unknown.** The committed pipeline ships `-staging`, not prod; the prod path is a manual `services replace`; and whether the *currently running* prod revision even contains the `vidya_voice` router is unverified until Phase 0.1. Sidecar is single-region (Singapore) with no Mumbai counterpart.
3. **Real-time audio on Android is unproven.** PCM16@16k mic streaming (`record.startStream`), streaming PCM24k playback, and barge-in flush are all net-new with no existing analogue in the app; back-pressure and interruption behaviour must be earned on-device (Phase 4), not assumed.
4. **Wire-format correctness.** The web spike's input/output framing is wrong for Live; the Flutter client implements the correct JSON `realtimeInput.mediaChunks` / `inlineData` framing from scratch and is unverified end-to-end until a real session runs.
5. **Cost.** Continuous per-audio-token billing is materially higher than turn-based STT+TTS, with no cost/quota guard in the sidecar today — needs a session time cap + daily ceiling before prod exposure.
6. **Indic voice quality** (Aoede vs Neural2 across the 11 languages) and **token binding** (`uses=1`, no reconnect) remain open acceptance gates from the spike; verify on real Indic-language sessions before claiming parity.
