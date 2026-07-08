# Feature flags

> Last updated: 2026-06-10

This project uses a **Firestore-based** feature flag system implemented in [`src/lib/feature-flags.ts`](../src/lib/feature-flags.ts). Source of truth is the Firestore document `system_config/feature_flags`.

**Two flag planes:**
- **Firestore** (`system_config/feature_flags`) — billing kill switch, subscription rollout, all per-agent sidecar dispatch modes, per-feature toggles. Changeable without a deploy.
- **Env vars** (read in `src/middleware.ts` and sidecar clients) — infra gates that must be set on the Cloud Run revision: `ONBOARDING_GATE_ENABLED`, `APP_CHECK_REQUIRED`, `VOICE_PROVIDER`, `SAHAYAKAI_REQUIRE_APP_CHECK`, `GENKIT_DEFAULT_MODEL`, `NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL`. See the **Env-var gates** section below.

## Architecture

- **Server-side reads only.** All flag reads go through `firebase-admin` (uses `getDb()`).
- **5-minute in-memory cache.** Concurrent reads are deduplicated.
- **Sticky rollout via `uid` bucketing** (deterministic hash → 0–99 bucket).
- **Allowlist / blocklist** per-user override on top of the global enabled flag.
- **Fail-safe defaults.** Firestore outage → `FALLBACK_CONFIG` (everything free, all sidecars OFF, kill switches ON).

For client-side flag checks, the canonical pattern is: server emits the flag value via an API response (e.g., `/api/feature-flags?feature=X`) or via a Firestore listener on the same `system_config/feature_flags` document. Direct client-side reads of Admin SDK are not possible — that's by design.

## The Firestore document — `system_config/feature_flags`

Shape: see `FeatureFlagsConfig` interface in `src/lib/feature-flags.ts`. Buckets of flags:

### 1. Global switches (with `FALLBACK_CONFIG` defaults)
- `billingKillSwitch` (fallback `true`) — if `true`, ALL plan checks return "free" (the master kill switch). On Firestore outage it defaults ON, so everything is free.
- `maintenanceMode` (`false`) + `maintenanceMessage` (`''`) — show banner, skip billing flows.
- `consentNoticeEnabled` (`false`) — when `true`, the TwiML parent-call route plays a one-sentence DPDP consent prologue before the message. Stays OFF until all 11 languages have legally-reviewed translations (shipping untranslated consent text is worse than none).

### 2. Subscription rollout
- `subscriptionEnabled` (`false`) — subscription system live for eligible users.
- `subscriptionRolloutPercent` (`0`) — 0-100 hash-bucketed (`uid`) rollout.
- `subscriptionAllowlist` (`[]`) — UIDs always on subscription regardless of rollout %.

Order in `isSubscriptionEnabled()`: kill-switch ON → off; maintenance ON → off; `subscriptionEnabled` OFF → off; allowlist → on; else rollout-bucket check.

### 3. Sidecar dispatch (per-agent, four-mode contract)
Each agent has a `<agent>SidecarMode` (`'off' | 'shadow' | 'canary' | 'full'`) + `<agent>SidecarPercent` (`0..100`, sticky on `callSid` for parent-call, on `uid` for everything else). **All default to `off` / `0` in `FALLBACK_CONFIG`.**

Modes (from `src/lib/feature-flags.ts`):
- `off` — Genkit only (default). Sidecar untouched even if deployed.
- `shadow` — Genkit serves; sidecar called fire-and-forget for parity scoring; output ignored.
- `canary` — Sidecar serves; Genkit fallback on any sidecar error/timeout.
- `full` — Sidecar serves; same fallbacks as canary; percent treated as 100.

**17 agents wired** (original three + Phase J.5 cohort): `parentCall`, `lessonPlan`, `vidya`, `quiz`, `examPaper`, `visualAid`, `worksheet`, `rubric`, `teacherTraining`, `virtualFieldTrip`, `instantAnswer`, `parentMessage`, `videoStoryteller`, `avatar`, `voiceToText`, `assessmentScanner`, `communityPersonaMessage`, `assignmentAssessor`. Dispatchers live in `src/lib/sidecar/*-dispatch.ts` (parent-call in `dispatch.ts`). The sidecar is an external ADK-Python Cloud Run service (`sahayakai-agents`), base URL `NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL`; since all modes default `off`, default prod is pure Genkit.

### 4. Per-feature toggles — `features: Record<string, FeatureToggle>`
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
| `geminiFlash2_0` | `src/lib/ai-models.ts` (`getActiveGeminiModel()`) | enabled | ENABLED → `gemini-2.5-flash` (`GEMINI_MODELS.FLASH_2_0`, the constant name is legacy). DISABLED → `gemini-2.5-pro` (slower, higher quality, higher cost). Only call sites wired through `getActiveGeminiModel()` respect the flip; unwrapped sites and `.prompt` YAML frontmatter stay on `gemini-2.5-flash` (Genkit reads frontmatter at module load; override at runtime via `prompt.generate({ model: ... })`). | #61 |

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

## Sidecar flags (Phase J.5 system)

Sidecar flags (`parentCallSidecarMode`, `lessonPlanSidecarMode`, etc. — 17 agents total) live as **top-level fields** on the same doc, NOT in the `features` map. They use the four-mode contract documented in §3 above and in `FeatureFlagsConfig`. See `src/lib/sidecar/*-dispatch.ts` (and `dispatch.ts` for parent-call) for how they read these via `getFeatureFlags()`. All default `off`/`0`, so a single Firestore flip rolls every agent back to pure Genkit.

## Env-var gates (NOT in Firestore)

These are read from `process.env` on the Cloud Run revision, not from `system_config/feature_flags`. Changing them requires a Cloud Run env update (`gcloud run services update ... --update-env-vars`), not a Firestore edit.

| Env var | Read in | Default (code) | Effect |
|---|---|---|---|
| `ONBOARDING_GATE_ENABLED` | `src/middleware.ts` | OFF | When `'true'`, authenticated page GETs without a valid profile-complete cookie / onboarding claim redirect to `/onboarding`. **MUST stay OFF in prod** (2026-06-08 incident locked out the entire user base). |
| `APP_CHECK_REQUIRED` | `src/middleware.ts` | tolerant (off) | When `'true'`, verifies `X-Firebase-AppCheck` JWT; strict mode rejects missing token on `/api/ai/*`. |
| `VOICE_PROVIDER` | `src/app/api/attendance/call/route.ts` | `twilio` | `exotel` switches parent calls to the external `sahayakai-voice-call` streaming voicebot. |
| `SAHAYAKAI_REQUIRE_APP_CHECK` | sidecar enforcement | — | Sidecar's own App Check requirement. |
| `GENKIT_DEFAULT_MODEL` | `src/ai/genkit.ts` | `googleai/gemini-2.5-flash` | Overrides the default text model without a code change. |
| `NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL` | `src/lib/sidecar/*` | unset → `SidecarConfigError` | Base URL of the ADK-Python sidecar. |

TODO(verify: which of these env vars are actually set on the live `sahayakai-hotfix-resilience` revision — runtime env is not in the repo. Code defaults: `VOICE_PROVIDER=twilio`, onboarding gate OFF, App Check tolerant.)

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
