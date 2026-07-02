# SahayakAI Design Review Board — Consolidated Packet

*14 specialists, one brief: make SahayakAI a fantastic-looking, teacher-comfort, first-principles platform. Each reviewed the real code and wrote a proposal. This is the synthesis.*

---

## The one-line verdict

**SahayakAI already has the bones of an excellent design system — it just isn't wired up.** The tokens, primitives, motion vars, Indic fonts, saffron ramp, `ResultShell`, `PageShell`, and 11-language progress hints all exist. Adoption is ~30%. The product looks like **three design systems stitched together** (a premium marketing island, a utilitarian admin island, a half-finished in-app core) because raw values were used instead of the system that was already built.

> The redesign is less "invent a new look" and more **"finish and enforce the one you have, then elevate it."** That's great news: high impact, lower risk.

---

## 🔴 Cross-cutting consensus (found independently by multiple agents)

| # | Finding | Flagged by | Severity |
|---|---|---|---|
| 1 | **Half-adopted token system.** `rounded-surface-*` used 6× vs ~200 raw radii; `type-h*` 5× vs `font-headline` 129×; `PageShell` built, used by ~0 pages. | Inventory, North-Star, Taste, Frontend, UI | **Root cause** |
| 2 | **Saffron `#FF9933` fails contrast (2.51:1 as text)** — primary CTA labels are unreadable. Fix: `#F08A2E`/`saffron-700` for text, keep flag saffron for logo only. | UI **and** A11y (independently) | **P0** |
| 3 | **~15 generator tools duplicate one state machine in 3 drifting dialects.** Unify into a `useGenerator` hook + `GeneratorPage` shell → a redesign applies to all at once. | Frontend, UX, Taste, Inventory | **Highest leverage** |
| 4 | **i18n is fragmented + shallow.** Flat 1495-key dict + per-file translation tables + `.indic-text` used in only 5 files → tall scripts render at Latin line-height; raw English leaks on-screen. | i18n, UX, Content, Taste, Frontend | High |
| 5 | **Fully-built assets are orphaned** (rendered nowhere): `sample-output-section`, `demo-interaction` (marketing), the SSE streaming routes (client fakes progress with `setTimeout`). | Marketing, Perceived-Perf | Quick win |
| 6 | **Dashboard is the #1 redesign target** — textbook AI-slop (centered hero + grid of equal tinted-icon cards). | Taste, Inventory, UX, North-Star | High |
| 7 | **Loading/empty states inconsistent** — `RotatingProgressHint` + skeletons + `EmptyState` exist, but 60 files use raw `Loader2`; only 5/47 pages use `EmptyState`; no `loading.tsx`. | Perceived-Perf, Motion, UX | Medium |

---

## The unanimous first move

Every strategic agent landed on the same starting point:

> **Ratify the design tokens → add a CI lint that fails on new raw `hex` / `px` / `orange-*` / off-scale opacity → migrate the two hub screens (dashboard + one generator) as the reference implementation.**

This freezes the drift, makes the system self-enforcing, and turns every later redesign into a small, safe change.

---

## Phased roadmap (from `00-north-star`)

- **Phase 0 — Foundations:** ratify tokens, fix saffron contrast, self-host fonts (kills Indic CLS), token CI lint, vectorize the logo.
- **Phase 1 — Core loop:** redesign the dashboard + teacher home; "generate-then-refine" (generate immediately, refine with chips; demote the big form).
- **Phase 2 — Tools:** collapse the ~15 generators onto the shared `GeneratorPage` primitive + wire real SSE streaming + tool chaining ("make a quiz from this plan").
- **Phase 3 — Community/social:** feed, library, messages.
- **Phase 4 — Marketing:** activate orphaned trust components, rebrand the Indic SEO pages, illustration set.
- **Throughout (acceptance gates, not a cleanup phase):** a11y (contrast, 48px targets, aria-live results, ReadAloudButton), i18n (per-script line-heights, `.indic-text` default), illustration ("Warm Chalk-Line Editorial" as decorative accent, never instruction).

**Design personality:** *a calm, competent colleague in your phone* — warm, confident, rooted, uncluttered. Recommended aesthetic = utility chassis + editorial warmth + rooted-craft illustration skin.

---

## The proposals

| File | Specialist | Headline |
|---|---|---|
| `00-north-star-and-roadmap.md` | Design Director | Philosophy, 7 principles, phased roadmap, conflict-resolution ladder |
| `01-ux-product.md` | UX/Product | Generate-then-refine; tool chaining; intent-first IA |
| `02-ui-designsystem.md` | UI/Design System | Saffron ramp, warm shadows, self-host fonts, `#F08A2E` text |
| `03-motion.md` | Motion | Shimmer skeletons, section-stagger reveal, reduced-motion, no new deps |
| `04-taste-audit.md` | Taste Enforcer | Kill the equal-card grid; one radius scale; ban-list |
| `05-frontend-arch.md` | Frontend Eng | `useGenerator` hook + `GeneratorPage` shell + `TOOLS` registry |
| `06-marketing-landing.md` | Marketing | Activate orphaned proof; rebrand Indic pages; narrative spine |
| `07-mobile-pwa.md` | Mobile/PWA | Fix two-FAB collision; 48px targets; sticky generate/export |
| `08-perceived-performance.md` | Perf UX | Wire real SSE; `loading.tsx`; `<ResultImage>` |
| `09-brand-illustration.md` | Brand/Illustration | "Warm Chalk-Line Editorial"; vectorize logo; Spot Icons |
| `10-i18n-design.md` | Localization | Per-script line-heights; `.indic-text` by default; unify surfaces |
| `11-accessibility.md` | A11y | Contrast, aria-live results, `ReadAloudButton`, Assist Mode |
| `12-ux-content.md` | UX Writer | Voice guide; stop calling teachers "Teacher"; rename tools |
| `13-current-state-inventory.md` | Design Ops | Page-by-page map; token adoption evidence; top-8 targets |

---

## Decision menu (for your review)

1. **Greenlight Phase 0** (foundations + token CI lint + saffron contrast fix) — lowest risk, unblocks everything.
2. **Pick the aesthetic direction** — the board recommends *utility-chassis + editorial-warmth + rooted-craft illustration*; you choose.
3. **Approve the `GeneratorPage` primitive** — the single highest-leverage structural bet.
4. **Prioritize the dashboard redesign** as the visible flagship.
5. **Approve the illustration direction** (or request alternatives).

Assign any of the above and the relevant specialists implement it (with `design-review` + visual QA before ship). Nothing has been changed in the app — these are proposals only.
