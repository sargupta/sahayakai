# SahayakAI — API & Cost Analysis

> Last updated: 2026-06-10
> Based on: full codebase audit cross-checked against `src/` source (`src/ai/flows/`, `src/lib/ai-models.ts`, `src/ai/genkit.ts`).
> Default text model is `gemini-2.5-flash` everywhere (NOT 2.0-flash — see `src/ai/genkit.ts:18`,
> `src/lib/ai-models.ts:39`). `gemini-2.0-flash` is not used anywhere in the tree.

---

## 1. Complete API Surface Map

### AI Generation Endpoints (~17 flows)

Default text model = `googleai/gemini-2.5-flash` (`src/ai/genkit.ts`). Exceptions noted.

| Route | Flow | Model(s) | Google Search | Notes |
|---|---|---|---|---|
| `POST /api/assistant` | VIDYA orchestrator (`vidya-assistant.ts`) | `gemini-2.5-flash` | ✗ | OmniOrb mic entry; intent router (11 intents) |
| `POST /api/ai/intent` | `agent-definitions.ts` | `gemini-2.5-flash` | ✗ | Intent classification only (routing) |
| `POST /api/ai/instant-answer` | `instant-answer.ts` | `gemini-2.5-flash` | ✅ | Most expensive text call due to grounding |
| `POST /api/ai/lesson-plan` (+`/stream`) | `lesson-plan-generator.ts` | `gemini-2.5-flash` (×2) | ✗ | 2 LLM calls: generation + materials audit. Grounding removed for cost. |
| `POST /api/ai/quiz` | `quiz-definitions.ts` | `gemini-2.5-flash` | ✗ | 3 difficulties generated in parallel (3 calls); validation pass |
| `POST /api/ai/exam-paper` (+`/stream`) | `exam-paper-generator.ts` | `gemini-2.5-flash` | ✗ | Full exam paper |
| `POST /api/ai/worksheet` | `worksheet-wizard.ts` | `gemini-2.5-flash` | ✗ | Multimodal: accepts textbook image |
| `POST /api/ai/virtual-field-trip` | `virtual-field-trip.ts` | `gemini-2.5-flash` | ✗ | Generates Google Earth itinerary |
| `POST /api/ai/rubric` | `rubric-generator.ts` | `gemini-2.5-flash` | ✗ | Grading criteria generation |
| `POST /api/ai/teacher-training` | `teacher-training.ts` | `gemini-2.5-flash` | ✗ | Pedagogical advice |
| `POST /api/ai/visual-aid` | `visual-aid-designer.ts` | **`gemini-3-pro-image-preview`** (image) + `gemini-2.5-flash` (text) | ✗ | 2 calls: image gen + metadata |
| `POST /api/ai/avatar` | `avatar-generator.ts` | **`gemini-2.5-flash-image`** | ✗ | Profile avatar image generation |
| `POST /api/ai/assess-assignment` | `assignment-assessor.ts` | **`gemini-2.5-pro`** (`ASSESSMENT_MODEL`) | ✗ | Vision + reasoning grading |
| `POST /api/ai/assessment-scanner` | `assessment-scanner.ts` | `gemini-2.5-flash` (default) | ✗ | 2-pass: vision OCR + rubric-grounded scoring |
| `POST /api/ai/voice-to-text` | `voice-to-text.ts` | Sarvam Saaras v3 (primary); `gemini-2.5-flash` fallback | ✗ | Sarvam for mp3/wav; Gemini for webm/opus |
| `POST /api/ai/video-storyteller` | `video-storyteller.ts` | `gemini-2.5-flash` + RSS | ✗ | Query gen via LLM; data from YouTube RSS |
| `POST /api/ai/parent-message` | `parent-message-generator.ts` | `gemini-2.5-flash` | ✗ | Draft parent message |
| (TwiML webhooks) | `parent-call-agent.ts` | `gemini-2.5-flash` | ✗ | Live parent-call reply + summary |
| `POST /api/community/persona-pulse` | `community-persona-message.ts` | `gemini-2.5-flash` | ✗ | AI persona chat, 150-token cap |

> `geminiFlash2_0` feature flag (`src/lib/ai-models.ts`): ENABLED (default) → `gemini-2.5-flash`;
> DISABLED → `gemini-2.5-pro` (higher quality, higher cost). Only call sites wired through
> `getActiveGeminiModel()` respect this flip; `.prompt` frontmatter stays on `gemini-2.5-flash`.

### TTS & Voice Endpoint (1)

| Route | Service | Voice Tiers |
|---|---|---|
| `POST /api/tts` | Google Cloud TTS v1 + Sarvam | Neural2 (hi, en) · Wavenet (bn, ta, kn, ml, gu, pa) · Standard (te, mr; Odia falls back to hi-IN Standard) |

### Content Management (5)

`GET /api/content/list` · `POST /api/content/save` · `GET /api/content/get` · `GET /api/content/download` · `DELETE /api/content/delete`

→ Firestore reads/writes + Cloud Storage reads/writes

### Telephony / attendance

`POST /api/attendance/call` (Twilio REST default, Exotel via `VOICE_PROVIDER=exotel`) · `/api/attendance/twiml*` (public webhooks) · `/api/attendance/outreach*` · `/api/attendance/call-summary`

→ Twilio REST API (per-minute call billing). Exotel path delegates to external `sahayakai-voice-call` service. See ground-truth §7.

### Infrastructure/Auth/Analytics

`/api/health` · `/api/metrics` · `/api/teacher-activity` · `/api/feedback` · `/api/auth/profile-check` · `/api/user/profile` · `/api/vidya/profile` · `/api/vidya/session` · `/api/analytics/seed` · `/api/analytics/teacher-health/[userId]` · `/api/migrate-ncert` · `/api/jobs/*` · `/api/ai/quiz/health` · `/api/config/flags` · `/api/feature-flags/me` · `/api/webhooks/razorpay` · `/api/billing/*`

→ Pure Firestore / Razorpay; no LLM

---

## 2. External Paid Services

| Service | Used By | Billing Unit |
|---|---|---|
| **Google Gemini 2.5 Flash** | default for ~15 of ~17 AI flows | Per token (input + output) |
| **Google Gemini 2.5 Pro** | assignment grading (`assignment-assessor.ts`); also the `geminiFlash2_0`-disabled fallback for wrapped call sites | Per token |
| **Gemini Image Generation** (`gemini-3-pro-image-preview` for visual-aid, `gemini-2.5-flash-image` for avatar) | visual-aid, avatar | Per image |
| **Gemini Audio Input** | voice-to-text Gemini fallback (webm/opus) | Per minute of audio |
| **Sarvam AI (Saaras v3)** | voice-to-text primary (mp3/wav); TTS option; external Exotel voicebot | Per minute / per char |
| **Google Cloud TTS Neural2** | TTS (hi-IN, en-IN) | Per character synthesized |
| **Google Cloud TTS Wavenet** | TTS (bn, ta, kn, ml, gu, pa) | Per character synthesized |
| **Google Cloud TTS Standard** | TTS (te-IN, mr-IN, Odia fallback) | Per character synthesized |
| **Google Search Grounding** | instant-answer (lesson-plan grounding removed for cost) | Per grounding request |
| **Twilio** | attendance parent calls (REST API, default path) | Per call minute |
| **Razorpay** | subscription billing / webhooks | Per transaction fee |
| **Firebase Firestore** | All routes | Per read/write/delete |
| **Cloud Storage (GCS)** | All content-saving flows | Per GB storage + operations |
| **Firebase App Hosting (Cloud Run)** | Entire app | Per vCPU-second + memory |
| **ADK-Python sidecar (Cloud Run)** | per-agent sidecar dispatch when mode ≠ `off` (all default `off`) | Per vCPU-second + memory; TODO(verify: sidecar Cloud Run cost — service is `sahayakai-agents`, source not in this repo, all dispatch modes default off so $0 in current prod) |
| **YouTube Data API** | video-storyteller (fallback) | Per quota unit (10K units/day free) |

---

## 3. Pricing Reference (Google AI)

> ⚠️ Prices change. Always verify at [ai.google.dev/pricing](https://ai.google.dev/pricing) before budgeting.
> NOTE: the production default is now `gemini-2.5-flash`, not `gemini-2.0-flash`. The per-call
> cost figures in §4 were originally computed against 2.0-flash pricing and are flagged for re-derivation.

### Gemini API

| Model | Input (text) | Output (text) | Audio input | Image |
|---|---|---|---|---|
| gemini-2.5-flash (default) | TODO(verify: 2.5-flash input $/1M tokens at ai.google.dev/pricing) | TODO(verify: 2.5-flash output $/1M tokens) | TODO(verify: 2.5-flash audio $/min) | — |
| gemini-2.5-pro (grading + flag-off fallback) | TODO(verify: 2.5-pro input $/1M tokens) | TODO(verify: 2.5-pro output $/1M tokens) | — | — |
| gemini-3-pro-image-preview (visual-aid) | — | — | — | TODO(verify: per-image $) |
| gemini-2.5-flash-image (avatar) | — | — | — | TODO(verify: per-image $) |
| **Google Search grounding** | — | — | — | **$35 / 1,000 requests** (verify) |

> Free tier limits vary by model; verify current RPM/TPD at ai.google.dev/pricing.

### Google Cloud TTS

| Voice Tier | Price | Free Monthly |
|---|---|---|
| Standard | $4 / 1M chars | 4M chars |
| Wavenet | $16 / 1M chars | 1M chars |
| Neural2 | $16 / 1M chars | 1M chars |

### Google Cloud Firestore (Blaze plan)

| Operation | Price | Free Daily |
|---|---|---|
| Reads | $0.06 / 100K | 50K |
| Writes | $0.18 / 100K | 20K |
| Deletes | $0.02 / 100K | 20K |
| Storage | $0.108 / GB/month | 1 GB |

### Cloud Storage (GCS)

| | Price |
|---|---|
| Storage | $0.020 / GB/month |
| Read operations | $0.004 / 10K |
| Write operations | $0.05 / 10K |
| Egress (to internet) | $0.12 / GB |

### Firebase App Hosting / Cloud Run

| | Price |
|---|---|
| CPU | $0.000048 / vCPU-second |
| Memory | $0.0000054 / GiB-second |
| Requests | $0.40 / 1M requests |
| Minimum billing | 100 ms per request |

---

## 4. Per-Feature Cost Breakdown (Single Use)

> TODO(verify: ALL dollar amounts in §4 and §5-6 were derived from gemini-2.0-flash pricing.
> The default model is now gemini-2.5-flash — re-derive every per-call cost once §3 pricing is
> confirmed. Token-count estimates below remain valid; only the $ conversions are stale.)
>
> Additional flows not yet costed here: exam-paper, assess-assignment (gemini-2.5-pro — likely the
> most expensive text call), assessment-scanner (2-pass vision), parent-message, parent-call (Twilio
> per-minute), community persona-pulse. TODO(verify: add per-call costs for these).

Token estimates are based on actual prompt templates + schema sizes in the codebase.

### 4a. VIDYA OmniOrb — one voice interaction

| Step | Tokens / Units | Cost |
|---|---|---|
| Voice-to-text (30s audio) | 0.5 min | $0.010 |
| Assistant LLM (800 in + 400 out) | 1,200 tokens | $0.000180 |
| TTS response (~200 chars, Neural2) | 200 chars | $0.0000032 |
| **Subtotal per voice turn** | | **~$0.010** |
| Typical session (5 voice turns) | | **~$0.050** |

> **Biggest cost: voice-to-text audio ($0.02/min).** A 30-second clip costs $0.01.

### 4b. Instant Answer

| Step | Tokens / Units | Cost |
|---|---|---|
| LLM (800 in + 400 out) | 1,200 tokens | $0.000180 |
| Google Search grounding | 1 request | $0.035 |
| TTS of answer (~400 chars, Neural2) | 400 chars | $0.0000064 |
| **Subtotal** | | **~$0.035** |

> **Google Search grounding dominates.** Even though the LLM call is cheap, 1 grounding request = $0.035.

### 4c. Lesson Plan

| Step | Tokens / Units | Cost |
|---|---|---|
| LLM main call (4,000 in + 4,500 out) | 8,500 tokens | $0.001650 |
| Google Search grounding | 1 request | $0.035 |
| Materials audit LLM (1,000 in + 500 out) | 1,500 tokens | $0.000225 |
| **Subtotal** | | **~$0.037** |

### 4d. Quiz Generator

| Step | Tokens / Units | Cost |
|---|---|---|
| LLM (2,000 in + 3,000 out) | 5,000 tokens | $0.001050 |
| Validation pass | — | $0 |
| **Subtotal** | | **~$0.001** |

### 4e. Worksheet Wizard

| Step | Tokens / Units | Cost |
|---|---|---|
| LLM + image input (5,000 in + 3,000 out) | 8,000 tokens | $0.001500 |
| Validation pass | — | $0 |
| **Subtotal** | | **~$0.002** |

### 4f. Visual Aid Designer (most expensive feature)

| Step | Tokens / Units | Cost |
|---|---|---|
| Image generation (gemini-3-pro-image-preview) | 1 image | ~$0.040 |
| Metadata (gemini-2.5-flash, 800 in + 300 out) | 1,100 tokens | $0.000300 |
| **Subtotal** | | **~$0.040** |

> **Single most expensive feature.** One visual aid = ~$0.04.

### 4g. Virtual Field Trip

| Step | Tokens / Units | Cost |
|---|---|---|
| LLM (800 in + 3,000 out) | 3,800 tokens | $0.000960 |
| **Subtotal** | | **~$0.001** |

### 4h. Rubric Generator

| Step | Tokens / Units | Cost |
|---|---|---|
| LLM (800 in + 1,500 out) | 2,300 tokens | $0.000510 |
| **Subtotal** | | **~$0.0005** |

### 4i. Teacher Training

| Step | Tokens / Units | Cost |
|---|---|---|
| LLM (700 in + 2,000 out) | 2,700 tokens | $0.000653 |
| **Subtotal** | | **~$0.0007** |

### 4j. Video Storyteller

| Step | Tokens / Units | Cost |
|---|---|---|
| LLM query gen (500 in + 200 out) | 700 tokens | $0.000105 |
| YouTube RSS fetch | free | $0 |
| Firestore cache write | 1 write | $0.0000018 |
| **Subtotal (cache miss)** | | **~$0.0001** |
| **Subtotal (cache hit, 6h TTL)** | | **~$0** |

### 4k. Avatar Generation

| Step | Tokens / Units | Cost |
|---|---|---|
| Image generation (gemini-2.5-flash-image) | 1 image | ~$0.040 |
| **Subtotal** | | **~$0.040** |

---

## 5. Full Session Cost (All Features Used Once)

A teacher who exercises every feature in one session:

| Feature | Cost |
|---|---|
| VIDYA voice assistant (5 turns) | $0.050 |
| Instant Answer | $0.035 |
| Lesson Plan | $0.037 |
| Visual Aid | $0.040 |
| Avatar (one-time) | $0.040 |
| Quiz Generator | $0.001 |
| Worksheet Wizard | $0.002 |
| Virtual Field Trip | $0.001 |
| Rubric Generator | $0.001 |
| Teacher Training | $0.001 |
| Video Storyteller | $0.000 |
| **Cloud Run compute** (2 min at 1 vCPU) | $0.006 |
| **Firestore** (~60 reads, 25 writes) | $0.000 |
| **Cloud Storage** (~10 files, 5 MB) | $0.000 |
| **TTS total** (~2,000 chars Neural2) | $0.000 |
| **TOTAL** | **~$0.214** |

**One full session = ~21 US cents**

---

## 6. Monthly Cost Projections by Scale

Assumptions:
- Average session: teacher uses **3 features** per day (realistic — not all features every day)
- Average features used: Lesson Plan + Quiz + VIDYA voice (5 turns)
- Per-day cost per active user: ~$0.037 + $0.001 + $0.050 = **$0.088/user/day**

With caching effects (VIDYA L1/L2 cache gives ~25% hit rate on fresh queries):

| Scale | DAU | Monthly AI Cost | Monthly Infra | Total Monthly |
|---|---|---|---|---|
| **Seed** | 50 | ~$110 | ~$30 | **~$140** |
| **Early** | 200 | ~$440 | ~$60 | **~$500** |
| **Growth** | 1,000 | ~$2,200 | ~$200 | **~$2,400** |
| **Scale** | 5,000 | ~$11,000 | ~$800 | **~$11,800** |
| **Series A** | 20,000 | ~$44,000 | ~$2,500 | **~$46,500** |

> **Per-user monthly cost (at 200 DAU): ~$2.50/user/month**

---

## 7. Cost Driver Analysis

> TODO(verify: share-of-total percentages below predate the lesson-plan grounding removal and the
> 2.5-flash default. Re-derive once §3 pricing is confirmed. Grounding now applies to instant-answer
> only, so its share is lower than the figure shown.)

| Driver | Share of Total | Controllable? |
|---|---|---|
| Google Search Grounding (instant-answer only) | ~35% (stale) | ✅ Can cache results or reduce usage |
| Image Generation (visual-aid + avatar) | ~30% (stale) | ✅ Add per-user monthly limit |
| Voice-to-text (audio minutes) | ~25% (stale) | ✅ Use Sarvam (cheaper), limit audio length, cache transcriptions |
| Twilio parent calls | TODO(verify: per-minute share) | ✅ Cap call length |
| Gemini text tokens | ~8% (stale) | Mostly fixed |
| Infrastructure (Firestore, GCS, Cloud Run) | ~2% (stale) | Scales linearly |

---

## 8. Recommendations

### 8a. 🔴 High Priority — Immediate Savings

**1. Cache Instant Answer + Lesson Plan grounding results**
- Cost today: $0.035 per grounding call
- Same question asked by multiple teachers → serve from Firestore cache
- The VIDYA intent cache already does this for the assistant. Apply the same pattern to instant-answer.
- Potential savings: 40-60% on grounding costs

**2. Limit image generation to paid/verified teachers**
- Visual Aid + Avatar = $0.04 per call each
- Add a free-tier cap: 5 visual aids/month free, then premium
- This alone can cut 30% of total costs at scale

**3. Compress audio before voice-to-text**
- Most recordings are sent as raw WebM (large)
- Already using `audio/ogg;codecs=opus` when supported
- Add client-side pre-processing to trim silence before sending → reduce audio minutes billed

### 8b. 🟡 Medium Priority — Architecture Changes

**4. Switch to Vertex AI for committed use discounts**
- Google offers 10-50% discounts on Vertex AI for committed monthly spend
- Also enables: usage dashboards, quota controls, cost allocation by user/feature
- Migration effort: ~1 week (change AI provider config in `genkit.ts`)

**5. Add Gemini context caching for long system prompts**
- Lesson plan flow has a large context prompt (Indian context + schema + NCERT)
- Gemini context caching: pay once to cache the prompt, then $0.0000375/1K cached tokens per request
- Estimated savings: 30-40% on lesson plan costs

**6. Tier models by complexity**
- The default is already `gemini-2.5-flash`. Consider a cheaper/lighter Gemini variant (verify availability/pricing) for:
  - Rubric generator (simple structured output)
  - Teacher training (single-turn Q&A)
  - Virtual field trip (structured itinerary)
- Conversely, keep `gemini-2.5-pro` confined to assignment grading where reasoning quality matters.
- Estimated savings: TODO(verify: depends on lighter-model pricing)

**7. Lazy-load voice-to-text (text fallback first)**
- Currently the mic button is prominent everywhere
- Most teachers type faster than they speak for short inputs
- Make text the default, mic optional — reduces audio billing by 40-60%

### 8c. 🟢 Low Priority — Long-term

**8. Self-host a quantized Whisper model for voice transcription**
- Replace Gemini audio (at $0.02/min) with a hosted Whisper endpoint
- Cost at 1,000 DAU: $0.02/min × 5 voice turns × 0.5 min × 1,000 users × 30 days = $1,500/month
- Self-hosted Whisper on a $200/month GPU instance → 87% savings at this scale
- Viable at 500+ DAU

**9. YouTube RSS + local vector search for video storyteller**
- Already uses RSS (free). Good.
- Replace the LLM query-generation step with a keyword-based search
- Eliminates the $0.0001 LLM call per video request

**10. Introduce usage-based pricing tiers for users**
- Free tier: 30 AI generations/month
- Pro (₹199/month): unlimited text, limited images
- Premium (₹499/month): unlimited everything
- This aligns user value with your cost structure

---

## 9. Current Optimizations Already In Place

✅ **VIDYA L1+L2 cache** — identical assistant queries served from cache (0 LLM cost)
✅ **TTS audio cache** — repeated phrases served from memory (0 TTS cost)
✅ **TTS access token cache** — reused for 55 min (eliminates 100-300ms latency + token refresh cost)
✅ **Google cert cache** — middleware caches certs for 5h (eliminates per-request network call)
✅ **Video storyteller cache** — 6h Firestore TTL per subject+grade (0 LLM cost on hit)
✅ **Server-side rate limiting** — 15 req/10 min per user (prevents runaway costs)
✅ **Client-side rate limiting** — local token bucket (extra protection)
✅ **Audio fallback** — Web Speech API fallback if cloud transcription fails (saves retry cost)

---

## 10. Monitoring Recommendations

Set up cost alerts for these specific thresholds:

| Metric | Alert Threshold | Action |
|---|---|---|
| Daily Gemini API spend | > $50 | Investigate unusual traffic |
| Daily TTS character count | > 5M chars | Check for TTS abuse |
| Daily image generation calls | > 500 | Enable per-user cap |
| Daily Google Search grounding calls | > 1,000 | Check caching hit rate |
| Cloud Run CPU utilization | > 80% sustained | Scale out |
| Firestore write rate | > 10K/day | Check for write storms |

Use **Google Cloud Billing Alerts** + **Firebase Crash-Free Rate** + the existing `/api/metrics` endpoint to build a real-time cost dashboard.

---

*Generated from codebase audit of `src/ai/flows/` (~17 AI flows). Last updated 2026-06-10.*
