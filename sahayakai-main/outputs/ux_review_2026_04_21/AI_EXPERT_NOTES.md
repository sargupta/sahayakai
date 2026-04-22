# SahayakAI — AI Expert Notes
**Review date**: 2026-04-21 · Context: observations from code recon + server logs during live testing (AI calls blocked by key + quota)

## Architecture

### Genkit + Google Generative AI
The app uses `@genkit-ai/googleai` wrapping `@google/generative-ai` against Gemini 2.0 Flash as the primary text model. 16 flows live under `src/ai/flows/`. The choice of Gemini 2.0 Flash is appropriate for cost and latency on Indian-context generation (Gemini family has good Indic-language grounding and `responseModalities: TEXT` costs ~$0.075/1M input tokens).

### Resilience wrapper (`src/ai/genkit.ts:141` — `runResiliently`)
3 attempts with exponential backoff (~17 s → ~48 s → fail). Correct pattern in principle. **Two flaws**:
1. `poolSize: 1` — single API key. When that key is denied or rate-limited, resilience has nothing to switch to. This is a production P0 — rotate ≥3 keys across ≥2 Google projects.
2. Total retry budget (~73 s) exceeds what any teacher in a live classroom will tolerate. Recommend split: 5 s fast-path for optimistic UI, with background retries + notification fallback if the sync window expires.

### Plan-gate + atomic quota reservation (`src/lib/plan-guard.ts:24-84`)
- `reserveQuota` + `rollbackQuota` on handler failure = correct design; prevents race-condition quota leaks.
- 60 s in-memory cache on usage counters + Firestore `FieldValue.increment` → right balance of cost and accuracy.
- Free-tier caps (lesson-plan 10/mo, visual-aid 2/mo, avatar 1/mo, parent-message 0/mo, instant-answer 20/day) are aggressively tight — reasonable for a free tier but will push teachers to upgrade within ~1 week of active use. Worth testing with real teachers.

### TTS tier selection (`src/app/api/tts/route.ts:52-65`)
| Tier | Langs | Quality | Cost |
|------|-------|---------|------|
| Neural2 | hi-IN, en-IN | Highest | $$$ |
| Wavenet | bn/ta/kn/ml/gu/pa | Mid-high | $$ |
| Standard | te | Lowest | $ |

Thoughtful cost optimization. Hindi + English get the best voices (where most of the audience is). One observation: **Telugu gets Standard-only** because Google doesn't offer Wavenet/Neural2 for te-IN — but this is real audio-quality inequality for Telugu-speaking teachers. Consider Sarvam TTS (native Indic) as fallback already wired — make it the primary for te.

## Prompt / flow quality (from code + sample output)

### Lesson Plan generator
Uses the 5E model (Engage, Explore, Explain, Elaborate, Evaluate) — the dominant pedagogy framework across CBSE and state boards. Homepage sample output is well-structured, shows NCERT alignment claim, activity + vocabulary + assessment. **Good.** Real output quality untested this session.

### Instant Answer
Uses Google Search grounding. This is correctly reserved for a flow that genuinely needs live facts (recon note confirms grounding was removed from lesson-plan earlier to save ~$0.035/call). This discipline around when to spend on grounding is a positive architectural signal — suggests the team has been cost-auditing.

### Parent Message
0 quota on free → intentional paywall. Makes sense commercially (teachers will pay for parent-comms automation) but creates a feature-gating UX surface that needs care: a free teacher clicking Generate should see "Upgrade to Pro to send parent messages" inline, not a generic 403.

### Visual Aid + Avatar (image gen)
At $0.04/image, these are the most expensive per-call features. Free tier: 2/mo visual-aid, 1/mo avatar. That's defensible but will annoy teachers who try and fail once. Consider giving new users a one-time bonus of 3 image gens in onboarding to get the wow factor without burning the monthly quota.

## Risks

### Dependency on one Gemini key = one Google project = one business account
**The most dangerous line of code in the repo is whichever one reads `GOOGLE_GENAI_API_KEY`** because right now that key's project is suspended. If production is hitting the same key, real teachers can't generate anything. This is the #1 thing to check before any other improvement.

Action items:
1. Verify prod Cloud Run env vars — which key does it actually resolve from Secret Manager?
2. Set up a key rotation across 3+ projects with a small load balancer in `runResiliently` (expand `poolSize` > 1)
3. Add a smoke-test cron (every 5 min) that hits a single Gemini call and alerts on failure — catch a project suspension within minutes, not days

### "Generated in 30s" is marketing, not measurement
The homepage shows `Generated in 30s` as aspirational social proof. Actual production measurement during this session: 60–73 s on cold path, often ending in failure. Two fixes:
- Lower the claim to "Generated in under 1 minute" (true, less setting-up-for-disappointment)
- Or invest in genuinely hitting 30 s: enable `responseMimeType: application/json` structured output, use streaming to show content as it generates, aggressively cache common prompts

### No AI observability teachers can see
When Gemini is down or rate-limited, teachers see `"AI generation failed. Please try again."` Teachers have no way to distinguish:
- "Google is having an outage — not your fault"
- "You've hit your monthly quota — upgrade"
- "Your phone's internet is flaky"
- "The prompt was blocked for safety"

Add a small `i`-info affordance on the error toast that expands to error class + recommended action. Reference OpenAI's error taxonomy for UX inspiration.

### Prompt injection surface not assessed
Couldn't test this session (AI blocked), but flag for future: the app accepts free-form teacher text as `topic`, then plugs into LLM prompts. If any flow passes teacher input unescaped into a system-role section (e.g. via string concat rather than parameterized template), prompt injection is live. Recon showed `@genkit-ai/ai/lib/prompt` templates — good if used consistently. A single `${userInput}` in a template string concat anywhere is enough to break it. Worth a focused code review by someone who thinks adversarially.

## Cost signal (estimated, from recon `00_ai_flows.md`)

Full top-15 teacher tour ≈ $0.21 per teacher (rough):
- Text flows (lesson, quiz, worksheet, rubric, exam, instant, training, parent-msg): ~$0.09 combined
- Image flows (visual-aid, avatar): $0.08 combined
- TTS playback of one lesson: ~$0.02
- Grounded flows (instant answer with Google Search): ~$0.02

For 100k active teachers/month at one full tour = $21k/month Google bill. Practical cost levers:
- Prompt caching via Gemini context caching — 50%+ savings on repeat prompts
- Response caching on deterministic flows (lesson plan for same NCERT chapter = same output 95 % of the time) — already has 24 h TTL per recon
- Move long-running flows (exam paper, long lesson plans) to batch processing with 24 h SLA for free tier, real-time for Pro — protects margin

## Recommended priority order

1. **Unstick Gemini** (P0). Fix the key, add 3-key pool, set up uptime alerting.
2. **Fix AI-error UX** (P0). Replace generic toast with class-specific messaging + retry policy shortened to <15 s for foreground paths.
3. **Fix mobile layout overflow** (P0/P1). Community 2× overflow and universal +19 px header overflow combined break the brand on the primary device.
4. **Unify auth-gate pattern** (P1). One reusable component across all gated routes.
5. **Move floating mic orb** (P1). Out of the bottom-right content zone.
6. **Translate the UI properly, or stop claiming 11 languages** (P1). Pick one.
7. **Amplify the privacy page** (do more). It's your best trust asset.
