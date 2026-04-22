# AI Flow Tour Results — resumed after fresh Gemini key
**Date**: 2026-04-22 · **Key prefix**: `AIzaSyCUHrrN4PF…` · **Model**: `gemini-2.5-flash` (via `GENKIT_DEFAULT_MODEL` env override)

Picked up where the 2026-04-21 review stalled when every Gemini call returned 403/429. The new key also hits 429 on `gemini-2.0-flash` (shares AI Studio project quota with other sibling-project keys), but succeeds on `gemini-2.5-flash`. Routed the app to 2.5-flash via the new `GENKIT_DEFAULT_MODEL` env override in `src/ai/genkit.ts`.

---

## What works (live-tested via `/api/ai/*`)

| Flow | Status | Latency | Notes |
|------|--------|---------|-------|
| `lesson-plan` (English) | ✅ 200 | 79.8 s | 5E structure, 3 SWBAT objectives, 6 materials including Neem/Mango/Tulsi (Indian cultural context) |
| `lesson-plan` (Hindi) | ✅ 200 | 86.2 s | Title + objectives + activity names in native Devanagari. Phase labels stay English in the data (client t() translates at render) |
| `instant-answer` | ✅ 200 | 5.6 s | Rayleigh scattering explanation, pedagogically sound for Class 7 |
| `quiz` | ✅ 200 | 15.9 s | 3 MCQ on photosynthesis, analogies ("tiny solar panels", "baker needs flour"), difficulty tiers included |
| `visual-aid` (image gen) | ✅ 200 | 31.8 s | Returns JPEG base64 data URI. Image generation functional. |

## What failed on my test payloads (schema mismatches, not app bugs)

| Flow | Why | Finding |
|------|-----|---------|
| `quiz` first attempt | Sent `"multiple-choice"`, schema expects `"multiple_choice"` | Route returned 500 for a Zod validation error — **should be 400** with `{error: "INVALID_ARGUMENT", details}` so the client knows it's a schema issue, not a provider outage |
| `rubric` | My payload likely missing required field | Same 500-for-Zod anti-pattern |
| `teacher-training` | Missing required field | `500 INVALID_ARGUMENT: Schema validation failed` — the message body is more helpful than the status, but 400 would be correct |
| `worksheet` | `Cannot read properties of undefined (reading 'matc…')` | Looks like a real null-safety bug in the route, worth a dedicated repro |

## Lesson plan output quality — sample

Input: `{topic: "Photosynthesis for Class 7", language: "English"}`

Output highlights:
- **Title**: "Photosynthesis: How Plants Make Their Food"
- **Objectives**:
  - SWBAT define photosynthesis and identify its key components (sunlight, water, carbon dioxide, chlorophyll)
  - SWBAT explain the importance of photosynthesis for plants and other living organisms
  - SWBAT describe the process of how plants prepare their own food
- **Materials**: Green plant leaves (Neem, Mango, Tulsi), small potted plant for observation, whiteboard, chalk/markers, student notebooks, photosynthesis diagram
- **Activities**: 5-phase 5E (Engage → Explore → Explain → Elaborate → Evaluate)
- First activity: "The Plant's Secret Kitchen" — opens with the question "Where do we get our food from?" → bridges to plants

AI expert note: this is a well-crafted plan for an Indian classroom. SWBAT language is Bloom-aligned (what trained Indian teachers learned in B.Ed programs). The Indian plant choices (Neem, Tulsi, Mango) are teacher-thoughtful — available in any school garden. 79 seconds is too long for a teacher mid-class, but the quality is defensible for a lesson-prep workflow.

## Hindi output quality — sample

Input: `{topic: "प्रकाश संश्लेषण कक्षा 7", language: "Hindi"}`

Output highlights:
- **Title**: "प्रकाश संश्लेषण: पौधों का भोजन बनाने का रहस्य" (Photosynthesis: The secret of how plants make food — natural-sounding Hindi phrasing)
- **First objective**: "छात्र प्रकाश संश्लेषण की प्रक्रिया को परिभाषित कर सकेंगे।" (Students will be able to define the process of photosynthesis)
- **First activity**: "पौधों का भोजन और हमारा भोजन" (Plant's food and our food)
- **Phase labels stay English** in the payload (`"Engage"`, `"Explore"`, etc.) — the pass-3 onboarding i18n translates these at render time via `t()`. If the lesson-plan DISPLAY screen doesn't do the same, the render will show mixed language. Worth a follow-up to confirm the lesson-plan render component runs phase labels through `t()`.

## Key + model side-effects to know

1. **2.0-flash is 429 on this account's free tier until Pacific midnight.** Key works fine for 2.5-flash; switching back to 2.0-flash before then will fail.
2. **`gemini-2.5-flash` is ~3× input cost, ~6× output cost vs 2.0-flash.** For local dev / review this is fine. For production, the `GENKIT_DEFAULT_MODEL` env variable stays unset so Cloud Run continues using 2.0-flash as before — no production cost surprise.
3. **The `.env.local.bak.<timestamp>` backup still exists** with the previous (broken) key in case anyone wants to diff.

## Still not tested this session

- `exam-paper/stream` (SSE stream flow — needs EventSource client, not curl)
- `lesson-plan/stream` (same)
- VIDYA OmniOrb (needs mic permission, real browser — and the preview sandbox silently blocked getUserMedia earlier)
- Voice message send/receive in chat
- Rubric / teacher-training / worksheet / parent-message (payload shape figured out via route inspection would unblock, but schema-mismatch-500 finding already logged)
- Plan-limit UX on free tier (dev-token = pro plan)
- Razorpay subscription checkout

## Bugs discovered during the tour (for BUGS.md pass 5 update)

- **P1 NEW**: AI routes return HTTP 500 for Zod validation errors. Should be 400 with structured `{error, details}` so clients can distinguish request bugs from provider outages. Observed on `/api/ai/quiz`, `/api/ai/rubric`, `/api/ai/teacher-training`.
- **P1 NEW**: `/api/ai/worksheet` throws `Cannot read properties of undefined (reading 'matc…')` — looks like a null-safety bug in the route. Needs a dedicated repro.
- **P2 NEW**: Lesson plan phase labels stay English even in Hindi output payload. Onboarding handles this via `t()` at render; verify the main lesson-plan display screen does the same.
- **Confirmation of P0-2 from original review**: `poolSize: 1` in the resilience log was real. The new key is still a single-key pool. If this key hits 429, no failover. **Action**: rotate ≥ 3 keys across ≥ 2 Google projects before prod launch.
- **Infrastructure note**: giving Google AI Studio a single-account/single-project key is fragile. The three sibling keys (`AIzaSyDD9M`, `AIzaSyAl5_`, `AIzaSyCUHrrN`) appear to share a quota pool for 2.0-flash. Spinning up keys in separate Google accounts would isolate quotas properly.
