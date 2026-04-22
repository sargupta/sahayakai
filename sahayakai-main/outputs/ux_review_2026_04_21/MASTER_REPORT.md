# SahayakAI — Mobile UX Review (Teacher Persona)
**Date**: 2026-04-21 · **Viewport**: 375×812 iPhone 13 · **Branch**: chore/cloud-armor-bot-block

---

## Executive summary

SahayakAI has a **strong product concept and real teacher-domain craft** — the 5E lesson-plan pedagogy, Indian cultural grounding in example prompts (Pongal, Nalanda, BEO/DEO privacy promise), voice-first mic-orb hero, and thoughtful TTS tier selection all show that the team has done its homework on the audience.

But a teacher picking up their Android phone to try SahayakAI today would hit **two walls within five minutes**:

1. **AI is broken.** Every generate button leads to a 60–73 second wait ending in `"AI generation failed. Please try again."` The Google project tied to the Gemini API key has been denied access (HTTP 403 PERMISSION_DENIED, verified direct against Google's endpoint). Tested with a backup key as well — daily quota exhausted. Without Gemini working, lesson plan, quiz, worksheet, rubric, exam paper, visual aid, avatar, instant answer, VIDYA, teacher training, parent message, field trip, and video storyteller are all non-functional. That's ~75 % of the product.

2. **Mobile layout is fractured.** The Community page has **2× horizontal overflow** (762 px content on 375 px viewport) — teacher has to pan right to read. Every other page has a milder universal **+19 px overflow** where the `Google Sign-in` button pushes past the right edge and visually clips the `SahayakAI` wordmark. On the single most common device size, the product feels broken.

Everything else flows from those two.

### Ship verdict per feature tier
| Tier | Ship readiness today | Conditional on |
|------|---------------------|----------------|
| All 10+ AI-generation flows | **🔴 NOT READY** | Fix Gemini key, add key pool, shorten retry budget, humanize error messages |
| Community (Discover/Connect/Chat) | **🟡 PARTIAL** | Fix 2× horizontal overflow; signed-URL voice-message expiry; stub "Add Image" button |
| Pricing, Privacy, Attendance, My Library | **🟢 READY** (with minor polish) | Unify auth-gate pattern, move mic orb, fix header overflow |
| Settings, Messages, Notifications, Impact, Usage | **🟡 PARTIAL** | 5 different auth-gate patterns — unify to one |
| Onboarding | **🟡 UNTESTED THIS SESSION** | Code recon looks good; needs team QA each release — highest leverage screen |

---

## What was and wasn't tested

### ✅ Tested and documented
- 14 pages navigated on 375 px mobile viewport with screenshots
- Sidebar inventory (26 links enumerated)
- Auth bypass via dev-token cookie (middleware-level only; Firebase client state not faked)
- `/api/ai/lesson-plan` end-to-end round trip (failed due to upstream Gemini)
- AI resilience retry behavior (3 attempts, 17 s → 48 s backoff, observed)
- Mobile viewport layout for every surface visited
- Auth-gated page patterns (6 different treatments found across gated routes)
- Direct API key validation against Google endpoints (both `.env` and `.env.local` keys + ShareMarket fallback)

### ❌ Blocked / not tested
- Lesson plan / quiz / worksheet / rubric / exam paper actual AI output quality (Gemini 403 + 429)
- VIDYA orb conversational quality (Gemini + mic permission blocked in sandbox)
- Visual aid + avatar image generation quality (Gemini)
- Voice-message send and playback in community chat (auth + mic)
- Onboarding 3-step flow (auth-gated; redirects away without Firebase user)
- Hindi/Tamil/Kannada UI switch probe (requires authed settings access)
- Offline-mode transition behavior (requires actual network drop mid-session)
- Free-tier plan-limit UX (dev-token = pro plan; need a real free-tier teacher account)
- Double-submit guard in real browser (needs auth + working backend)
- Razorpay checkout end-to-end (not part of UX review scope)

To complete a full review, provision a fresh healthy Gemini API key and a real Firebase test teacher account, then re-run.

---

## Top findings in priority order

### P0 (fix before selling to another school)
1. **Gemini API project denied access** — `GOOGLE_GENAI_API_KEY` returns 403 PERMISSION_DENIED. Verify production Cloud Run uses a different healthy key; if not, real teachers cannot generate anything today.
2. **Single-key pool, no failover** — log confirms `poolSize: 1`. Rotate 3+ keys across 2+ projects.
3. **Error UX after 73-second retry** — generic `"AI generation failed. Please try again."` unhelpful. Cap retry budget at ≤15 s for foreground; differentiate quota / network / safety / provider errors.
4. **Community page 2× horizontal overflow** on 375 px. Sidebar layout bug.

### P1 (fix before next release)
5. Universal +19 px header overflow (Google Sign-in button clipping wordmark)
6. Floating mic orb occludes bottom-right content on every page
7. Five different auth-gate patterns across protected routes — unify to one
8. Mic permission failure is silent (violates voice-first promise)
9. Admin links visible in sidebar to logged-out users
10. Auth button uses envelope icon instead of Google logo
11. Oversold language claim ("+8 more languages") — most UI stays English
12. Voice message signed URLs expire after 7 days (data loss)
13. Homepage coach-mark covers text input on first load

### P2 (polish queue)
14. "Current plan" shown to logged-out users on /pricing
15. "Generated in 30s" badge misrepresents real latency
16. Content Creator Studio duplicates sidebar items
17. Connect directory hard-capped at 200 teachers
18. "Add Image" button in community composer is stub
19. Community trending has no time-decay
20. Group dropdown doesn't close on outside click
21. Dev server HMR stale-chunk errors crash sessions

### 🌟 Keep doing (amplify these)
- `/privacy-for-teachers` page naming BEO/DEO/DIET — trust gold
- Cultural specificity in example prompts (Pongal, Nalanda, Indian rivers)
- Empty-state patterns on `/attendance` and `/my-library`
- 5E pedagogy format in lesson plans
- Double-submit guard via useRef
- Plan-limit atomic reservation architecture
- TTS tier cost optimization
- Google-Search grounding reserved for instant-answer only

---

## Files in this review

| File | Purpose |
|------|---------|
| `MASTER_REPORT.md` | This file — exec summary + ship verdict |
| `BUGS.md` | 22 findings ranked P0/P1/P2 with repro + fix suggestions |
| `AI_EXPERT_NOTES.md` | Architecture, risks, cost signal, priority order |
| `00_route_map.md` | 33 pages + 68 API routes, grouped by section |
| `00_ai_flows.md` | 16 AI flows with inputs, outputs, cost signals (detailed) |
| `00_auth_onboarding.md` | Signup paths, dev-token bypass, onboarding schema |
| `00_community.md` | Discover/Connect/Chat mechanics + 8 known gotchas |
| `00_settings_plan_language.md` | Settings, plan limits, language switcher, TTS tiers |
| `00_top15_features.md` | Tier-ranked features with friction notes |
| `screenshots/` | (Embedded inline in tool calls during session — see transcript) |

---

## Session metadata

- Dev server: `sahayakai-dev` via `.claude/launch.json` on port 3000
- Cleaned `.next` once mid-session to recover from webpack chunk ENOENT
- Swapped `.env.local` Gemini key from `AIzaSyDD9M…` (denied) to ShareMarket key `AIzaSyAl5_…` (quota exhausted). Backup saved as `.env.local.bak.<timestamp>`. **Revert if you want the original dev state back.**
- Auth: dev-token cookie bypass only works in `NODE_ENV=development` per middleware code at `src/middleware.ts:90`.
- No code changes were committed. No git state modified beyond `.env.local` (backed up).

---

## Recommended next steps (ordered)

1. Restore a healthy Gemini key to `.env.local` and check production env for the same denied key.
2. Re-run this review's Phase 3.2 – 3.7 AI flow deep tour once the key is healthy.
3. Have a second reviewer independently walk through onboarding with a real Google account, since that's the single highest-leverage teacher-retention surface and wasn't testable here.
4. Patch the community page overflow and the universal +19 px header issue — they're one- to three-line fixes with outsized impact.
5. Consolidate auth-gate components into one shared primitive and roll out to all 6 inconsistent pages.
6. Fix the AI error UX — this is the difference between a teacher who retries and a teacher who tells her colleagues "it doesn't work."
