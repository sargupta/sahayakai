# SahayakAI — World-Class Execution Plan (July 2026)

*Source of truth for the hardening + redesign program. Derived from `docs/FABLE5_CRITICAL_REVIEW_2026-07-03.md` (21 findings), `docs/security/BUG_AUDIT_2026-07-02.md` (deferred items), and `docs/design/proposals/INDEX.md` (14-specialist board). Ratified decisions below were made by the founder on 2026-07-03.*

---

## Ratified decisions (do not re-litigate)

| Decision | Choice |
|---|---|
| Core loop | **Lesson-prep copilot** — plan → worksheet → quiz → export/share. Generators are the spine; attendance/community are supporting. |
| Backend boundary | **API routes** (`/api/*` + typed client + Zod). Server actions migrate out; lint blocks new ones. |
| Non-core features | **Aggressive park** behind a `labs` feature flag (hidden from nav, URLs work, reversible). |
| WIP files | Rescued to `fix/wip-forensic-i18n-checkpoint` (pushed). i18n gate must pass before it merges to develop. |

**Core tool set (the spine, gets the deep redesign):** lesson-plan · worksheet-wizard · quiz-generator · exam-paper · rubric-generator · instant-answer.
**Parked to Labs (flag-hidden):** video-storyteller · virtual-field-trip · teacher-training · assessment-scanner · assess-assignment · content-creator · visual-aid-designer · api-playground/api-docs (public) · impact-dashboard. *(Attendance + community + messages stay in nav as supporting features — not parked, not spine.)*

---

## Tranche 1 — Freeze the bleeding *(branch `fix/hardening-tranche-1`)*
- [x] Delete `visual-aid-creator` "coming soon" stub route (+ `scripts/test-langchain.ts`).
- [x] Remove dead deps: `langchain`, `@langchain/core`, `@langchain/google-genai` (−386 lockfile lines). Lockfile regenerated **inside `node:20-alpine`** (container npm 10.8.2) and `npm ci` validated there — this is the process H16 lacked.
- [x] `engines` pinned in package.json (`node >=20 <21`); root CI matrix dropped EOL node 18.
- [x] **CI resurrection** (found during execution — review finding 13 upgraded):
  - `sahayakai-main/.github/workflows/` was **inert** (GitHub reads root only) — quality gates + AI evals had never run. `quality-gates.yml` + `genkit-eval.yml` moved to root with paths fixed; inert push-triggered `cloud-run.yml` deleted (would race safe-deploy if enabled).
  - Root `test.yml`'s `| tee` pipe swallowed jest's exit code — 50 failing tests / 16 suites were green on develop. Pipe removed.
  - All 16 failing suites repaired (root causes: test mocks predating security fixes; stale harnesses; NOT source bugs — each verified against forensic specs before touching assertions).
- [x] Secret hygiene: Twilio SID redacted from forensic doc; live QA refresh-token fixture (`qa/fixtures/demo-video-state.json`) untracked + gitignored (caught by GitHub push protection).

## Tranche 2 — Labs park + IA refocus
- `labs` feature flag in `src/lib/feature-flags.ts`; parked tools hidden from `app-sidebar` + dashboard; direct URLs still render (with a Labs banner).
- Sidebar/IA reorganized around the prep loop (design board proposal 01).
- Kill-or-finish decisions surfaced: **dark mode** (finish token-level or remove toggle) and **omni-orb/“Jarvis”** (flagship or freeze) — founder call, then execute.

## Tranche 3 — i18n infrastructure (the 7,467-line fix)
- Split `language-context.tsx`: per-locale JSON dictionaries, load only the active locale (dynamic import), stable snake_case keys (not English sentences), server-provided initial locale.
- Migration codemod for `t("English sentence")` call sites; missing-key CI report (extend `scripts/i18n-missing-keys.json` flow).
- Unblocks design proposal 10 (per-script line-heights, `.indic-text` default).
- **Budget check:** first-load JS before/after measured and recorded here.

## Tranche 4 — AI eval harness (the moat)
- Golden datasets for **all 25 flows**, each × English + top-2 Indic languages (Bengali, Tamil first per user base).
- Remove `continue-on-error` from `genkit-eval.yml`; evals **block** PRs touching `src/ai/**`.
- Wire `actions/feedback.ts` teacher feedback into dataset growth.
- Per-flow cost budget assertions (video-storyteller first — pairs with its quota gate, below).

## Tranche 5 — Backend boundary migration
- Inventory the 14 `src/app/actions/*` modules → map each to an `/api/*` route with Zod validation + the standard Bearer→`x-user-id` auth path.
- Typed client (`src/lib/api-client.ts`) generated from Zod schemas.
- ESLint rule: no new files in `src/app/actions/`.
- Order: `community.ts` + `groups.ts` first (biggest, riskiest), then the rest.

## Tranche 6 — Design Phase 0 → 2 (the board's plan, now behind gates)
- Phase 0: ratify tokens, saffron `#FF9933`→`#F08A2E` for text, token CI lint (raw hex/px/`orange-*`), self-host fonts (kills Indic CLS + removes the Google-Fonts runtime-cache), vectorize logo.
- Phase 1: dashboard + teacher-home redesign around the prep loop (now possible — core loop is decided).
- Phase 2: `useGenerator` hook + `GeneratorPage` shell; migrate the 6 spine tools; wire the real SSE streaming (delete the `setTimeout` fakes).
- God-file decomposition rides along: each spine tool moves into `src/features/<tool>/` as it's migrated.

## Tranche 7 — Trust, safety, revenue integrity
- **Block/report/moderation** (systemic gap; sales blocker for orgs/govt).
- **DPDP data story**: retention policy, deletion story, data-processing register (children's attendance/marks/parent phone numbers).
- **H21**: payment amount↔plan binding + idempotency ledger.
- **video-storyteller quota**: `GatedFeature` + per-tier pricing (needs founder pricing call).
- **H8**: signed URLs / access-checked proxy for voice DMs + shared images.
- **F1-04**: move Twilio creds from plaintext Cloud Run env → Secret Manager `secretKeyRef` (safe-deploy process).
- CSP Report-Only → enforcing; App Check on (after violation review).
- Prompt-injection delimiter framing across ~18 flows (after eval harness exists to catch quality regressions — sequencing matters).

## Housekeeping found during execution
- **Zombie Cloudflare Pages integration** fails on every PR (this repo deploys via Cloud Run, not CF Pages) — red noise that trains people to ignore red. Disconnect it in the Cloudflare dashboard (founder has CF access) or scope it out of PR checks.
- i18n pre-commit gate flags jest-mock JSX in `__tests__/` — exempt test files in the audit script.
- **console.log burn-down: 299 sites** (Gate 5's first live run caught the backlog; gate converted to a changed-files ratchet so PRs stay honest while the debt burns down). Migrate to `lib/logger`. Priority within the backlog: `src/ai/genkit.ts` logs **API-key fingerprints** (`substring(0,8)`) — kill those lines first, they don't belong in Cloud Logging at any severity.

## Continuous gates (added as they land, never removed)
- Perf budget CI: first-load JS ≤200KB on dashboard, Lighthouse CI on PR (Fast-3G LCP target).
- Playwright smoke (login → generate → export) in PR gates.
- Per-path coverage bars: 80% on quota/billing/auth/AI-schemas (global 40% stays until caught up).
- npm audit clean-up (H16) — now unblocked: regenerate audit fixes inside `node:20-alpine` exactly as Tranche 1 did.
- `next-pwa` → `serwist` migration before more offline work (Phase T.2).

---

## Founder-only queue (nobody else can do these)
1. **Rotate `.env.local` keys (C3)** — Firebase SA, Twilio, Sarvam, Tavily, Gemini.
2. **Test mobile account deletion** (redirect re-auth flow).
3. Pricing call for video-storyteller tier (blocks its quota gate).
4. Dark-mode and omni-orb kill-or-finish calls (Tranche 2).

## Sequencing logic
1→2 are days and unblock everything. 3 (i18n split) before 6 (redesign) so redesigned components are built on the new dictionary. 4 (evals) before any prompt work in 7. 5 runs parallel to 6 (different files). 7 before the first org/government sales conversation.
