# Feature flags

This project uses a **Firestore-based** feature flag system implemented in [`src/lib/feature-flags.ts`](../src/lib/feature-flags.ts). Source of truth is the Firestore document `system_config/feature_flags`.

## Architecture

- **Server-side reads only.** All flag reads go through `firebase-admin` (uses `getDb()`).
- **5-minute in-memory cache.** Concurrent reads are deduplicated.
- **Sticky rollout via `uid` bucketing** (deterministic hash → 0–99 bucket).
- **Allowlist / blocklist** per-user override on top of the global enabled flag.
- **Fail-safe defaults.** Firestore outage → `FALLBACK_CONFIG` (everything free, all sidecars OFF, kill switches ON).

For client-side flag checks, the canonical pattern is: server emits the flag value via an API response (e.g., `/api/feature-flags?feature=X`) or via a Firestore listener on the same `system_config/feature_flags` document. Direct client-side reads of Admin SDK are not possible — that's by design.

## The Firestore document — `system_config/feature_flags`

Shape: see `FeatureFlagsConfig` interface in `src/lib/feature-flags.ts`. Three buckets of flags:

### 1. Global switches
- `billingKillSwitch` — if `true`, ALL plan checks return "free" (the master kill switch).
- `maintenanceMode` + `maintenanceMessage` — show banner, skip billing flows.

### 2. Sidecar dispatch (per-agent, four-mode contract)
Each of the 14+ agents (parent-call, lesson-plan, VIDYA, quiz, exam-paper, visual-aid, worksheet, rubric, teacher-training, virtual-field-trip, instant-answer, parent-message, video-storyteller, avatar, voice-to-text) has:
- `<agent>SidecarMode`: `'off' | 'shadow' | 'canary' | 'full'`
- `<agent>SidecarPercent`: `0..100` rollout % (sticky on `callSid` or `uid`)

`off` is the safe default — Genkit alone, sidecar untouched. `canary` and `full` serve from the sidecar with Genkit fallback on error.

### 3. Per-feature toggles — `features: Record<string, FeatureToggle>`
```ts
{ enabled: boolean, allowlist?: string[], blocklist?: string[] }
```

**Features NOT listed default to ENABLED.** This means you only add an entry to *disable* a feature, not to enable it. Wrapping an existing feature in a flag is a no-op until you explicitly flip it OFF.

## How to flip a flag

### Via Firebase Console

1. Open https://console.firebase.google.com/project/sahayakai-b4248/firestore/data/system_config/feature_flags
2. Find the field (e.g., `features.communityPersonas.enabled`)
3. Edit value → Save

Effect: server caches refresh within 5 minutes. To force-refresh immediately, call `invalidateConfigCache()` (admin endpoint not exposed yet — restart Cloud Run revision for instant pickup).

### Via the update-flags script

```bash
npx tsx src/scripts/update-flags.ts --kill-switch true
```

(See script for full flag options.)

## Adding a feature gate

1. Add a feature gate in your code:
   ```ts
   import { isFeatureEnabled } from '@/lib/feature-flags';

   const { enabled, reason } = await isFeatureEnabled('myFeature', userId);
   if (!enabled) {
     return NextResponse.json(
       { error: 'Feature disabled', reason },
       { status: 503 },
     );
   }
   ```
2. Document the feature key in the **Wrapped features** table below.
3. To kill it in prod: add `{ enabled: false }` to `system_config/feature_flags.features.myFeature` in Firestore.
4. The default (no entry in Firestore) is ENABLED — wrapping is non-breaking.

## Wrapped features

| Feature key | Where it gates | Default | Kill effect | PR |
|---|---|---|---|---|
| `communityPersonas` | `POST /api/community/persona-pulse` | enabled | New persona-pulse messages stop. Existing seeded messages remain (filter on `community_chat` where `isDemoPersona: true` would be needed for full hide). | #53 |
| `assessmentScannerDemoMode` | `POST /api/ai/assessment-scanner` page-cap check | enabled (cap = 3) | DISABLED bumps server cap to 15 (schema ceiling). Client UI still enforces 3 today — full bump needs client-side flag plumbing (Task 15a). Server-side flag still useful as a kill switch / for API-direct callers. | #58 |
| `ncertChapterValidation` | `src/ai/flows/exam-paper-generator.ts` soft validation block | enabled | Skips chapter validation entirely. Useful when the NCERT chapter seed is stale and the teacher's correct chapter triggers a false-positive warning. | #58 |
| `geminiFlash2_0` | `src/lib/ai-models.ts` (`getActiveGeminiModel()`) | enabled | DISABLED falls back from `gemini-2.0-flash` to `gemini-2.5-pro`. **Resolver only landed in this PR** — individual flow wraps follow incrementally. Until each call site is wrapped, that site keeps using `2.0-flash` unconditionally. `.prompt` YAML frontmatter (used by `ai.prompt()` calls) cannot read the flag and stays on `FLASH_2_0` — those need runtime model override (`prompt.generate({ model: ... })`) to participate. | #61 |

To kill `communityPersonas` in prod (e.g., once real-teacher volume on `/community` warrants):

```json
// system_config/feature_flags
{
  "features": {
    "communityPersonas": { "enabled": false }
  }
}
```

The next `/api/community/persona-pulse` request returns `503 { error: "Feature disabled", reason: "feature_disabled" }`. The `useCommunityLivePulse` hook treats 503 as a stop-polling signal (see hook implementation).

## Sidecar flags (separate Phase J.5 system)

Sidecar flags (`parentCallSidecarMode`, `lessonPlanSidecarMode`, etc.) live as top-level fields on the same doc, NOT in the `features` map. They use the four-mode contract documented in `FeatureFlagsConfig`. See `src/lib/sidecar/*.ts` dispatchers for how they read these.

## Removing a flag

When a flag has been at its final value for ≥ 30 days:

1. Inline the chosen behavior at all call sites (remove the `isFeatureEnabled` check).
2. Remove the entry from `system_config/feature_flags.features.<key>` in Firestore.
3. PR with `chore(flag): remove communityPersonas — settled to <enabled|disabled>` and link to the decision.

## Failure modes — flag system MUST NOT break the app

- Firestore unreachable → `FALLBACK_CONFIG` returned. Kill switches default ON (safe), feature toggles default to "not in fallback" → default ENABLED.
- `getDb()` throws → caught, fallback returned, error logged.
- Stale cache (5+ min old) — refreshed on next read; concurrent reads deduplicated.

If a flag MUST be respected (e.g., legal compliance), do not rely solely on this system. Hard-code the behavior or use a deploy-time guard. Example: DPDP consent notice (`consentNoticeEnabled`) defaults OFF in `FALLBACK_CONFIG` because shipping un-translated consent text to users would be worse than no consent at all.

## SSR / client mismatch

`isFeatureEnabled` is server-only. SSR pages get the live flag value at request time. Client-side React components that need to know a flag's state should:
- Receive it as a prop from a server component / RSC, OR
- Hit an API endpoint that wraps `isFeatureEnabled`, OR
- Subscribe to the Firestore `system_config/feature_flags` document directly (client Firestore SDK can read this if the security rules allow).

For most demo gates (Community Personas, Assessment Scanner cap), wrapping the server endpoint is enough — client-rendered content remains, but new server-side writes stop.

## Env-var flags (process-start, not Firestore)

A small set of gates read `process.env` directly — they change only on deploy/restart, independent of `system_config/feature_flags`:

- `ONBOARDING_GATE_ENABLED` — onboarding completion gate in `src/middleware.ts`. **Stays OFF in prod** (2026-06-08 lockout incident, PR #68).
- `DEMO_CALL_ENABLED` — public "Hear the Call" lead-magnet endpoint (`/api/demo-call`, page `/try-call`). Default OFF. Before enabling, provision `DEMO_CALL_PEPPER` (required in prod), review `DEMO_CALL_DAILY_CAP` / `DEMO_CALL_IP_DAILY_LIMIT` / `DEMO_CALL_PHONE_COOLDOWN_DAYS`, and optionally `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `DEMO_CALL_ENC_KEY`. Spec: `docs/PARENT_CALL_DEMO_SPEC.md`.
- `SAMPARK_ENABLED` — Sampark school-to-parent calling (`docs/sampark/SAMPARK_PLAN.md`). Every `/api/sampark/**` route and the `/api/jobs/sampark-render` / `/api/jobs/sampark-dispatch` jobs return 404 unless it is exactly `'true'`; the check runs before authentication so a disabled deployment reveals nothing. **Declared `false` in both regional deploy blocks of `cloudbuild.yaml`**, so turning it on is one reviewed PR and the region-parity test sees it. Never `NEXT_PUBLIC_`, never a Firestore flag (those default ON when missing).
- `SAMPARK_LIVE_DIAL_ENABLED` — whether Sampark may construct a non-simulated carrier (`src/server/sampark/carrier.ts`). Unset or anything but `'true'` means practice mode only: every call goes to the simulated carrier, and switching a school to `test` or `live` mode returns 409 `LIVE_DIAL_DISABLED`. Declared `false` in both regions alongside `SAMPARK_ENABLED`. With it `'true'` (and the two settings below), a school may switch to **Test** mode, where the Vobiz notice carrier rings only the school's own test phone (`docs/sampark/PHASE2A_CONTRACT.md`); the voice webhooks under `/api/webhooks/sampark-voice/` return a bare `<Hangup/>` unless it is `'true'`. **Live** mode (real parents) is refused (409 `LIVE_MODE_NOT_AVAILABLE`) whatever this says.
- `SAMPARK_PUBLIC_BASE_URL` — the https origin Vobiz calls back on for Sampark (answer, keypad, status, audio). Every callback and `<Play>` URL is built from this, never from a request's Host header. Missing or not a bare https origin → Test mode unavailable (`PUBLIC_BASE_URL_MISSING`). Not declared in `cloudbuild.yaml`: production has no Test mode until a reviewed PR sets it. Locally, a `cloudflared` quick tunnel to the dev server.
- Sampark reuses `VOBIZ_AUTH_ID` / `VOBIZ_AUTH_TOKEN` / `VOBIZ_FROM_NUMBER` / `VOBIZ_BASE_URL` (missing → `CARRIER_UNCONFIGURED`) and signs its webhook URLs with `SAHAYAKAI_REQUEST_SIGNING_KEY` under Sampark-only token domains (`src/lib/sampark/voice/tokens.ts`).
