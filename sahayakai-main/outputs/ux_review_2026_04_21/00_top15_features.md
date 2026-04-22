# Top-15 Features by Teacher Value — SahayakAI

Full feature surface = **33 pages + 16 AI flows + 68 API routes**. Ranked by teacher-value × frequency-of-use × signature-differentiation. Friction/complexity notes on ALL surfaces below top-15 retained so nothing is forgotten.

## Top 15 (tour these deeply in Phase 3)

| # | Feature | Route | Why teacher values it | Risk/complexity |
|---|---------|-------|----------------------|-----------------|
| 1 | Lesson plan generator | `/lesson-plan` | Flagship. Daily use. 5E pedagogy. Most cost-impactful. | Double-submit, caching (24h), bundled offline fallback, 11 langs, streaming UI |
| 2 | VIDYA assistant (OmniOrb) | floating on all pages | Voice-first AI partner. Multilingual voice. Differentiation. | Mic permission, TTS latency, conversation memory, tool routing |
| 3 | Instant answer | `/instant-answer` | Fast Q&A with live facts. Used in-class. | Google Search grounding, 20/day cap, hallucination risk |
| 4 | Quiz generator | `/quiz` | High teacher-freq. Variant generation. | 5/mo cap (tight), answer key accuracy |
| 5 | Worksheet wizard | `/worksheet` | Practical classroom artefact. Image-based. | 5/mo cap, PDF export quality |
| 6 | Community Discover | `/community` | Social proof, content discovery, teacher inspiration. | Trending stale w/o time-decay, filter UX |
| 7 | Community Connect | `/community` | Peer network — motivation retention. | 200-cap, connect flow clarity |
| 8 | Community Chat + Voice msg | `/community` + `/messages` | Voice-first chat for low-literacy comfort. | 7-day URL expiry bug (P1), codec fallback |
| 9 | Visual aid (image gen) | `/visual-aid` | Classroom visuals on demand. Wow-factor. | $0.04/img, 2/mo free cap, prompt quality |
| 10 | Exam paper | `/exam-paper` | Board-aligned PYQs — saves hours. | 3/mo cap, board accuracy |
| 11 | Rubric generator | `/rubric` | Assessment mandatory per NEP. | Clarity of output, mapping to subjects |
| 12 | Teacher training | `/teacher-training` | Pedagogy coaching — upskilling. | Quality vs generic AI advice, stickiness |
| 13 | Parent message | `/parent-message` | **PAYWALLED (free=0)** — test upgrade UX. | Free→paid wall, multilingual, tone |
| 14 | Onboarding (3-step) | `/onboarding` | First impression. Decides retention. | Accordion UX on mobile, skip path, aha-moment latency |
| 15 | My Library + save flow | `/my-library` + save buttons in every tool | Persistence of work — core retention hook. | Save button visibility, filtering, share-to-community |

## Tier-2 (tour lightly if time, document friction)

- **Virtual field trip** (`/virtual-field-trip`) — novel, niche. 3/mo cap.
- **Avatar generator** (`/avatar`) — 1/mo, vanity feature.
- **Attendance** (`/attendance`, `/attendance/[classId]`) — Twilio IVR backend, complex. School-adoption-dependent.
- **Impact dashboard** (`/impact`) — analytics motivator.
- **Usage stats** (`/usage`) — plan awareness.
- **Notifications** (`/notifications`) — retention driver.
- **Settings** (`/settings`) — 8 toggles; export/delete flows (delete has 30-day grace).
- **Pricing** (`/pricing`) — upgrade UX, Razorpay checkout.
- **My profile** (`/my-profile`) + public `/profile/[uid]` — social identity.
- **Content submission** (community library share flow) — content flywheel.
- **DMs** (`/messages`) — 1:1 teacher chat.

## Tier-3 (won't tour, will inspect surface only)

- `/privacy-for-teachers` — static policy page
- `/playground` — dev-only
- `/admin/*` — admin dashboards (not teacher-facing)
- Public landing `/` variants

## Features discovered but with known friction (flag BEFORE touring)

| Feature | Friction/complexity note |
|---------|--------------------------|
| Voice message in chat | Signed URL 7-day expiry → archived messages unplayable. P1 bug. |
| Discover filter | Composite Firestore index risk; client-side filter after fetch |
| Connect directory | 200-teacher hard cap |
| Image upload in posts | Button present but **stub — not wired** |
| Trending | No time-decay → old items dominate forever |
| Group dropdown | No outside-click close |
| Language switch | Only nav labels translated; 70%+ of UI still English |
| Delete account | 30-day grace period — test will need cleanup |
| Parent message | 0 free quota — gated upsell test surface |
| Offline mode | Not fully offline; toast says "offline mode" but most AI blocked |
| Razorpay flow | Redirect checkout — can't complete without real card; will screenshot checkout page only |
| Google OAuth in sandbox browser | May not complete in Claude_Preview — fallback to dev-token cookie |

## Cost estimate — full top-15 tour
Per recon AI-flows doc: full journey ~$0.21/teacher. For review with ~3 calls per flow = ~$0.60–$1.00. Well under budget.

Image gen (visual-aid + avatar) dominates: ~$0.04 × 3 = $0.12 alone.
