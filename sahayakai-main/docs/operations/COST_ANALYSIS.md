# SahayakAI — API & Cost Analysis

> Last updated: March 2026
> Based on: full codebase audit (32 API routes, 17 AI flows)

---

## 1. Complete API Surface Map

### AI Generation Endpoints (13)

| Route | Flow | Model(s) | Google Search | Notes |
|---|---|---|---|---|
| `POST /api/assistant` | VIDYA soul prompt | `gemini-2.0-flash` | ✗ | 2-tier cache (L1 in-memory 1h, L2 Firestore 24h) |
| `POST /api/ai/instant-answer` | instant-answer | `gemini-2.0-flash` | ✅ | Most expensive per-call due to grounding |
| `POST /api/ai/lesson-plan` | lesson-plan-generator | `gemini-2.0-flash` (×2) | ✅ | 2 LLM calls: generation + materials audit |
| `POST /api/ai/quiz` | quiz-definitions | `gemini-2.0-flash` | ✗ | Structured JSON output with validation pass |
| `POST /api/ai/worksheet` | worksheet-wizard | `gemini-2.0-flash` | ✗ | Multimodal: accepts textbook image |
| `POST /api/ai/virtual-field-trip` | virtual-field-trip | `gemini-2.0-flash` | ✗ | Generates Google Earth itinerary |
| `POST /api/ai/rubric` | rubric-generator | `gemini-2.0-flash` | ✗ | Grading criteria generation |
| `POST /api/ai/teacher-training` | teacher-training | `gemini-2.0-flash` | ✗ | Pedagogical advice |
| `POST /api/ai/visual-aid` | visual-aid-designer | `gemini-3-pro-image-preview` + `gemini-2.5-flash` | ✗ | 2 LLM calls: image gen + metadata |
| `POST /api/ai/avatar` | avatar-generator | `gemini-2.5-flash-image` | ✗ | Profile avatar image generation |
| `POST /api/ai/voice-to-text` | voice-to-text | `gemini-2.0-flash` (audio) | ✗ | Multimodal audio → text, detects language |
| `POST /api/ai/video-storyteller` | video-storyteller | `gemini-2.0-flash` + RSS | ✗ | Query gen via LLM; data from YouTube RSS |
| `POST /api/ai/intent` | agent-definitions | `gemini-2.0-flash` | ✗ | Intent classification only (routing) |

### TTS & Voice Endpoint (1)

| Route | Service | Voice Tiers |
|---|---|---|
| `POST /api/tts` | Google Cloud TTS v1 | Neural2 (hi, en) · Wavenet (bn, ta, kn, ml, gu, pa) · Standard (te) |

### Content Management (5)

`GET /api/content/list` · `POST /api/content/save` · `GET /api/content/get` · `GET /api/content/download` · `DELETE /api/content/delete`

→ Firestore reads/writes + Cloud Storage reads/writes

### Infrastructure/Auth/Analytics (13)

`/api/health` · `/api/metrics` · `/api/teacher-activity` · `/api/feedback` · `/api/auth/profile-check` · `/api/user/profile` · `/api/vidya/profile` · `/api/vidya/session` · `/api/analytics/seed` · `/api/analytics/teacher-health/[userId]` · `/api/migrate-ncert` · `/api/jobs/storage-cleanup` · `/api/ai/quiz/health`

→ Pure Firestore; no LLM or external paid APIs

---

## 2. External Paid Services

| Service | Used By | Billing Unit |
|---|---|---|
| **Google Gemini 2.0 Flash** | 11 of 13 AI flows | Per token (input + output) |
| **Google Gemini 2.5 Flash** | visual-aid metadata + lesson-plan audit | Per token |
| **Gemini Image Generation** (`gemini-3-pro-image-preview`, `gemini-2.5-flash-image`) | visual-aid, avatar | Per image |
| **Gemini Audio Input** | voice-to-text | Per minute of audio |
| **Google Cloud TTS Neural2** | TTS (hi-IN, en-IN) | Per character synthesized |
| **Google Cloud TTS Wavenet** | TTS (bn, ta, kn, ml, gu, pa) | Per character synthesized |
| **Google Cloud TTS Standard** | TTS (te-IN) | Per character synthesized |
| **Google Search Grounding** | instant-answer, lesson-plan | Per grounding request |
| **Firebase Firestore** | All routes | Per read/write/delete |
| **Cloud Storage (GCS)** | All content-saving flows | Per GB storage + operations |
| **Firebase App Hosting (Cloud Run)** | Entire app | Per vCPU-second + memory |
| **YouTube Data API** | video-storyteller (fallback) | Per quota unit (10K units/day free) |

---

## 3. Pricing Reference (Google AI, March 2026)

> ⚠️ Prices change. Always verify at [ai.google.dev/pricing](https://ai.google.dev/pricing) before budgeting.

### Gemini API

| Model | Input (text) | Output (text) | Audio input | Image input |
|---|---|---|---|---|
| gemini-2.0-flash | $0.075 / 1M tokens | $0.30 / 1M tokens | $0.02 / min | ~$0.001 / image |
| gemini-2.5-flash | $0.15 / 1M tokens | $0.60 / 1M tokens | — | — |
| gemini image gen (preview) | — | — | — | ~$0.03–0.05 / image |
| **Google Search grounding** | — | — | — | **$35 / 1,000 requests** |

> Free tier: 15 RPM / 1M tokens per day on gemini-2.0-flash (Google AI Studio plan)

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

| Driver | Share of Total | Controllable? |
|---|---|---|
| Google Search Grounding | ~35% | ✅ Can cache results or reduce usage |
| Image Generation (visual-aid + avatar) | ~30% | ✅ Add per-user monthly limit |
| Voice-to-text (audio minutes) | ~25% | ✅ Limit audio length, cache transcriptions |
| Gemini text tokens | ~8% | Mostly fixed |
| Infrastructure (Firestore, GCS, Cloud Run) | ~2% | Scales linearly |

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
- Replace `gemini-2.0-flash` with `gemini-2.0-flash-lite` (cheaper) for:
  - Rubric generator (simple structured output)
  - Teacher training (single-turn Q&A)
  - Virtual field trip (structured itinerary)
- Estimated savings: ~50% on those flows

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

*Generated from codebase audit of 32 API routes, 17 AI flows, and 4 external service integrations.*
