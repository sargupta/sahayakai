# Each school chooses its calling provider (ElevenLabs or Vobiz)

Status: built 2026-11-15 on `feat/sampark-school-provider-choice` (from `develop` `9245a62`). Not deployed.
Full design, feature-parity matrix and review: the "Sampark: each school chooses ElevenLabs or Vobiz" doc.

## What changed

- **The school owns its provider.** `SamparkSchool.conversationProvider` is chosen when the school switches
  on calls (workspace → "Enable school calls" → choice step) and changed by an admin in Settings → Calling
  provider. Every change is audited (`school.conversation_provider`). Missing = ElevenLabs, as before.
- **Every path follows it.** `selectedProvider()` ignores a per-request choice (session cookie, a batch's
  campaign provider, a callback's source-call provider) unless the internal demo chooser is on
  (`SAMPARK_PROVIDER_CHOOSER`). So single calls, class-wide batches and scheduled callbacks all use the
  school's provider; a school that switches mid-batch pauses the batch (`PROVIDER_CHANGED`).
- **Budget.** The choice cards show the deployment's all-in price per connected minute
  (`SAMPARK_PRICE_INR_PER_MIN_ELEVENLABS`, `SAMPARK_PRICE_INR_PER_MIN_VOBIZ`, `SAMPARK_PRICE_AS_OF`) and a
  monthly estimate = families × calls per family × minutes per call × price. No price → "Price not set yet".
- **Parity gaps closed.** ElevenLabs class-wide batches (behind `SAMPARK_BATCH_ELEVENLABS_ENABLED`, held to
  min(Vobiz trunk, ElevenLabs plan) via `SAMPARK_ELEVENLABS_MAX_CONCURRENT_CALLS`, stuck-call recovery on
  `SAMPARK_ELEVENLABS_MAX_CALL_SECONDS`); recorded-call consent per provider (`recordingConsentRequired`;
  Vobiz exempt only with `SAMPARK_VOBIZ_NOT_RECORDED_CONFIRMED`).
- **Demo chooser kept, off by default.** `SAMPARK_PROVIDER_CHOOSER` (server) + `NEXT_PUBLIC_SAMPARK_PROVIDER_CHOOSER`
  (link only). The local launcher should set both to keep today's flow.

## APIs

| Route | Who | What |
|---|---|---|
| `GET /api/sampark/[orgId]/riya/provider` | school admin (Riya on) | provider, chosen?, options (available, price, differences), estimate defaults |
| `PUT /api/sampark/[orgId]/riya/provider` `{provider}` | school admin | change; 409 `PROVIDER_NOT_AVAILABLE`; audited |
| `POST /api/sampark/[orgId]/enable` `{…, conversationProvider?}` | school admin | create with the chosen provider; 409 when not set up |
| `GET /api/sampark/provider` | signed-in user | deployment options with prices (enable step) + demo session choice |

## Tests

`src/__tests__/sampark/conversation/school-provider-choice.test.ts` (setting, audit, refusal, enable, pricing,
ElevenLabs batch limits, consent per provider), `provider-choice.test.ts` (routing with the chooser off and on),
`riya-provider-setting.test.tsx` (Settings card), `batch-calls.test.ts` (ElevenLabs batch switched on).

## Before a school uses it

1. Set the two prices and the as-of date on the deployment.
2. One live ElevenLabs batch on an allow-listed roster before `SAMPARK_BATCH_ELEVENLABS_ENABLED=true`.
3. A decision on `SAMPARK_VOBIZ_NOT_RECORDED_CONFIRMED` (owner).
4. The local launcher (`scripts/sampark/riya-local.mjs`) sets both demo chooser flags if the team still wants it.
