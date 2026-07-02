# SahayakAI — Fable-5 Critical Review

*2026-07-03. First-person review, no delegated agents. Additive to `docs/security/BUG_AUDIT_2026-07-02.md` and `docs/design/proposals/` — I do not repeat those findings; I reference and extend them. Every claim below was measured against the working tree today.*

---

## The verdict

**SahayakAI is a feature museum, not yet a product.** It has world-class *breadth* — 47 pages, ~15 AI generators, 25 AI flows, 84 API routes, attendance, parent calls, community, messaging, training, an API playground — built with genuinely good instincts (offline outbox, voice-first hooks, 11 languages, cost telemetry, canary deploys). But breadth at this team size has produced a systemic disease that shows up in every layer I measured:

> **You build the right abstraction, migrate one thing to it, and ship the next feature.**

Evidence, all from today's tree:

| The right abstraction exists | Adoption |
|---|---|
| Design tokens, `PageShell`, `ResultShell` | ~30% / ~0 pages (design board's finding — confirmed) |
| `src/features/` feature-module architecture | **1 feature** (`lesson-planner`); the other ~14 tools are monolith `page.tsx` files |
| SSE streaming routes | Built; clients fake progress with `setTimeout` (11 app files) |
| Genkit eval harness + CI workflow | **3 of 25 flows** have datasets; every eval step is `continue-on-error: true` |
| Playwright E2E suite (`qa/`) | Wired into **zero** CI workflows |
| `EmptyState`, skeletons, `RotatingProgressHint` | 5/47 pages (design board — confirmed) |

World-class is not more features. It is finishing the migrations you already started, deleting what you won't finish, and putting a quality gate on the one thing you actually sell: AI output a teacher trusts, in her language, on her phone.

---

## 1 · Product focus — the CEO problem

1. **Surface area exceeds maintenance capacity by ~5×.** 153,590 LOC across 778 source files, 47 routed pages, 84 API routes, 25 AI flows — maintained to a 40% coverage bar with 165 test files. Every world-class product this team admires (Linear, Notion at launch, WhatsApp) was narrow and obsessively deep. The pitch canon says the beachhead is Tier-2 CBSE teachers; the app says "everything for everyone." Pick the 5 tools that serve the beachhead's weekly loop and make them flawless. Park the rest behind a "Labs" flag or delete them.

2. **A "coming soon" stub ships in production.** `src/app/visual-aid-creator/page.tsx` is a dead route rendering "This feature is coming soon… Stay tuned!" while `visual-aid-designer` is the real tool. Two routes, one product, one of them an apology. Nothing says "not world-class" faster than a stub page a paying teacher can land on. Delete it.

3. **The core loop is undefined.** Is SahayakAI (a) a lesson-prep copilot, (b) an attendance + parent-communication system, or (c) a teacher social network? All three are half-built. The dashboard (design board's #1 target) can't be designed well *because* the answer doesn't exist. This is a product decision, not a design one, and it's blocking the designers.

4. **The cash register is broken while the store is open.** Pricing page (861 lines) and tiers exist, but: video-storyteller — the most expensive flow — has **no quota gate**; payment amount↔plan binding (H21) is deferred; onboarding gate is off. You're pre-revenue not because teachers won't pay but because the paying path isn't finished. Finishing it costs weeks, not quarters.

5. **No block/report/moderation is a sales blocker, not a security backlog item.** The first DIET, school chain, or state pilot that runs a due-diligence pass on a teacher social network with DMs and zero abuse recourse will walk. Same for data protection: the app holds children's attendance, marks, and parents' phone numbers — there is no visible retention policy, DPDP-aligned deletion story, or data-processing register. A government CISO asks for these on day one.

---

## 2 · Architecture & boundaries — the staff-engineer problem

6. **Two backends, one team.** 14 server-action modules (`src/app/actions/` — `groups.ts` 1,106 LOC, `community.ts` 1,049 LOC) **and** 84 API route handlers coexist. Two auth paths, two validation regimes, two audit surfaces, two places for the next C1-class bug. The architecture memo already decreed "pages → `/api/ai/*` only" — the same decision has not been made for the social/CRUD half. Pick one boundary (I'd pick API routes + typed client, since mobile/Flutter is P1 and server actions are web-only), then migrate on a schedule with a lint rule that blocks new files on the losing side.

7. **Next.js 15 is being used as a static SPA host.** 35 of 47 pages are `"use client"`. No RSC data fetching, so every page pays: full client JS + client-side Firebase reads + render waterfalls — on the cheap Android / 3G devices the product exists to serve. You're paying App Router complexity tax and collecting none of the rent. Either commit to RSC for the read-heavy pages (community, library, profiles) or accept SPA and stop pretending.

8. **`language-context.tsx` is a 7,467-line client file — the single worst byte in the bundle.** The entire 11-language dictionary ships as client JS inside the root provider, on every page, to every user, including the rural-3G users the pitch is about. Split per-locale, load one locale, serve from the server. This alone is likely hundreds of KB of first-load JS. Bonus defect: keys are full English sentences (`t("This feature is coming soon…")`) — every copy edit silently orphans 10 translations.

9. **LangChain is dead weight in `package.json`.** `langchain`, `@langchain/core`, `@langchain/google-genai` are dependencies with **zero imports anywhere in `src/`**. That's megabytes of `node_modules`, real supply-chain surface (while 79 npm vulns are already stuck unfixed), and it directly contradicts the recorded decision to drop LangChain. Remove all three today; nothing can break.

10. **`next-pwa` 5.6 is abandonware carrying your offline story.** Unmaintained since ~2022, pre-App-Router design, and its runtime config caches Google Fonts CDN — fonts the design board already said must be self-hosted (Indic CLS). The offline roadmap (Phase T.1) is standing on a dead package. Replace with `serwist` (the maintained fork) before building more offline on top.

11. **God-files everywhere the framework was skipped:** `onboarding/page.tsx` 1,320 · `contact-parent-modal.tsx` 1,023 · `quiz-display.tsx` 983 · `omni-orb.tsx` 924 · `exam-paper/page.tsx` 917 · `settings/page.tsx` 875 · `daily-briefing/route.ts` 1,073 · `ai-teacher-personas.ts` 1,319. These aren't style violations; they're where the next regression hides, because nothing this size is tested (§3).

12. **Type safety is opted out where it matters:** 551 `: any` annotations and 143 `eslint-disable` comments across `src/`. The `x-user-id` auth boundary, quota logic, and payment paths deserve `unknown` + narrowing, not `any`. (Credit where due: only 4 `@ts-ignore` — the compiler is at least on.)

---

## 3 · Quality engineering — the part that decides whether "world-class" is a word or a property

13. **The unit-test suite does not gate pull requests.** `quality-gates.yml` runs 6 gates on PRs — typecheck, console.log scan, schema drift, etc. — but **not `npm test`**. Jest runs only in `cloud-run.yml`, which triggers on *push* (i.e., at deploy time). A PR with failing tests merges clean and fails at the door of production. Move `npm test` into the PR gates.

14. **E2E is theater.** A Playwright suite exists (`qa/`, `qa:e2e` script) and is referenced by nothing in `.github/workflows/`. The flows that most need machine verification — login, generate, export, pay, message — are verified by hope.

15. **A 40% coverage threshold is a confession.** 165 test files against 778 source files; the global bar is set at 40% branches/lines. For the money paths (quota, billing reconciliation, payment), auth helpers, and the 25 AI flow schemas, the bar should be 80%+ *specifically* (Jest supports per-path thresholds), even if the global bar stays low while you catch up.

16. **AI evaluation cannot fail — so it isn't evaluation.** For an AI product, model output *is* the product, and here is the entire quality gate on it: 3 datasets (quiz, lesson-plan, exam-paper) out of 25 flows, 741 total lines of eval data, every step `continue-on-error: true`, weekly cron. Nothing blocks a prompt change that degrades output. Worse: **there is not a single eval in any Indian language** — the core differentiator ("11 languages, never Hindi-only") has zero automated quality signal in Bengali, Tamil, Telugu, or any other script. Build golden sets per flow *per top-3 languages*, make regressions blocking on PRs that touch `src/ai/**` (the trigger already exists), and route real teacher feedback (`actions/feedback.ts`) into the datasets.

17. **Repo hygiene: ~140 files of uncommitted WIP sitting on a production repo** across sessions and authors. That's not version control, that's a shared desk drawer — it blocks Cloud Build (`--source=.` needs a clean tree), makes every `git add` a minefield, and means a laptop failure loses real work. WIP belongs on branches, today.

18. **The toolchain mismatch that blocked `npm audit fix` (H16) is self-inflicted:** local npm generates lockfiles the `node:20-alpine` container npm rejects. Pin the npm version (`packageManager` field / `engines` + corepack) so local and container agree, then land the fix — 79 known vulns is not a number a world-class product carries.

---

## 4 · The user's phone — performance & experience where it counts

19. **The performance budget is spent on the wrong users.** Client dictionary (§8) + 35 client pages (§7) + client-side Firestore reads mean the Tier-2 teacher on a ₹8k Android pays the maximum possible JS and network tax. The design board covered *perceived* performance (fake progress, skeletons); my addition is that *actual* performance has no budget: no bundle-size CI check, no Lighthouse CI, no `loading.tsx` route segments. Set a number (e.g., ≤200KB first-load JS on the dashboard, LCP <2.5s on Fast 3G) and enforce it in the PR gates, or it will regress forever. (Credit: jspdf/html2canvas are properly dynamic-imported.)

20. **Dark mode is configured but not designed.** `darkMode: ['class']` + theme toggle exist; 8 component files carry `dark:` variants. Either finish it (token-level, one pass) or remove the toggle — shipping a half-dark mode reads as neglect every single night.

21. **"Jarvis"/omni-orb is a second, unowned product.** A 924-line floating assistant with its own Zustand store, session memory, and screen-context tracking — ambitious, invisible in the IA, untested, and not in any roadmap doc I can find. It's exactly the kind of thing that's magical if finished and embarrassing if half-alive. Decide: flagship (name it, design it, eval it) or freeze it.

---

## 5 · Endorsements — where prior reviews already said it and I'll add only the root cause

- **Design board (14 proposals):** findings confirmed against the tree; adoption numbers check out. My addition: the root cause is **process, not design skill**. There is no Definition of Done that includes token compliance, i18n coverage, a11y, loading/empty states — so every new feature re-introduces drift the day after any cleanup. Phase 0's CI lint is the only part that makes the fix permanent; without it, don't bother with the rest.
- **Security audit:** the deployed fixes hold. The two human tasks (rotate `.env.local` keys; test mobile account deletion) remain open and are still the most important 30 minutes anyone can spend on this product.

---

## 6 · The prescription, in order

If you do these in order, each one makes the next cheaper:

1. **Declare a feature moratorium** until items 2–7 land. (Cost: discipline. Value: everything below.)
2. **Delete confidently, today:** `visual-aid-creator` stub route; `langchain` + `@langchain/*` deps; the theme toggle *or* finish dark mode.
3. **Make quality gates real:** `npm test` + Playwright smoke (login → generate → export) on PRs; per-path 80% coverage on quota/billing/auth; bundle-size + Lighthouse budget; pin npm and land H16.
4. **Split the dictionary out of the client bundle** (per-locale, server-loaded, stable keys). Biggest single perf win available, and it unblocks the i18n proposal (#10).
5. **Make AI evals blocking, multilingual, and complete** — golden sets for all 25 flows × top languages; kill `continue-on-error`. This is the moat; treat it like one.
6. **Choose one backend boundary** and migrate `actions/` or the REST surface — with a lint that blocks new files on the losing side.
7. **Greenlight design Phase 0 + `GeneratorPage`** (the board is right) — but only after 3, so the redesign lands behind gates that keep it clean.
8. **Ship block/report + a DPDP data story** before the first org/government conversation, not after.

Items 1–4 are days each. Item 5 is the only multi-week one, and it's the one that decides whether the AI is trustworthy in Bengali on a Tuesday after a model bump — which is the entire promise of the product.

---

## Closing, plainly

The talent in this codebase is obvious — the outbox pattern, the schema-drift CI gate, the cost telemetry, the canary discipline are things most seed-stage teams never build. The failure mode is equally obvious: **nothing gets finished before the next thing starts**, and quality is asserted, not enforced. World-class is a property of *systems* — gates, budgets, evals, definitions of done — not of intentions. Build the system, and the product this team is clearly capable of will stop being intermittent.
