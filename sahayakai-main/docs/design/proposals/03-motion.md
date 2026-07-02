# Motion & Micro-Interactions — Design Review Proposal

**Lens:** Interaction / Motion Design · **Reviewer:** Design Review Board
**Scope:** transitions, loading choreography, feedback, route motion, low-end budget
**Stack confirmed:** Next.js 15 + Tailwind + `tailwindcss-animate`. `motion` (Framer) v12 is installed but imported in **only 2 landing files**; the app is otherwise 100% CSS-keyframe / utility-class driven. Motion tokens already exist and are the right foundation.

---

## 1. Current-state assessment

**What is already good (build on it, don't replace):**

- Real motion tokens exist in `globals.css` / `tailwind.config.ts`: `--motion-micro 150ms`, `--motion-small 250ms`, `--motion-medium 350ms`, and one canonical curve `--ease-out-quart` (`cubic-bezier(0.16,1,0.3,1)`). This is a genuine design-system asset — most of the fix is *using it consistently*, not inventing new motion.
- The AI wait is already treated as an emotional moment: `RotatingProgressHint` cycles teacher-language phases every 6s, `LessonPlanLoadingOverlay` pairs it with a shape-matched skeleton + Cancel. This is above-average work.
- `MicrophoneInput` renders a live waveform while recording — the single best micro-interaction in the app.

**What feels flat or janky:**

- **Inconsistent easing/duration.** Cards use `duration-micro ease-out-quart` (good), but many surfaces use bare `transition-colors`, `transition-opacity`, `transition-all` with the browser default `ease` (`cubic-bezier(0.25,0.1,0.25,1)`) — a different, springier curve. Two curves in one viewport reads as "unfinished."
- **Skeletons use `animate-pulse` (opacity throb), not a directional shimmer.** Pulse reads as "stalled/disabled"; a left-to-right shimmer reads as "working." Emotionally opposite during a 20–30s wait.
- **Result reveal is a single block.** `LessonPlanDisplay` has **zero** internal stagger — the whole 5E plan appears in one `fade-in slide-in-from-bottom-8`. The payoff moment lands flat; nothing draws the eye down the page.
- **Feedback is binary (`active:scale-95` on ~12 elements only).** Most Quick-Action cards animate `box-shadow`/`opacity` on hover — invisible on touch, where there is no hover. Rural teachers on phones get almost no tap acknowledgement.
- **No route transition.** Next App Router swaps trees instantly; navigating tool→tool is a hard cut.
- **`prefers-reduced-motion` honored in exactly one file** (`omni-orb`). Everything else animates unconditionally.

---

## 2. Loading choreography for AI generation (the key moment)

Goal: make 20–30s *feel* like ~10s and feel deliberate, not stuck. Keep the existing overlay; upgrade its texture.

1. **Skeleton shimmer, not pulse.** Add a `shimmer` keyframe (translateX a `--muted → --muted/60 → --muted` gradient, 1.6s linear infinite) and swap `animate-pulse` for it in `Skeleton`. Directional = "in progress." Cost: one keyframe, GPU-composited `transform`.
2. **Staged skeleton reveal — progressive disclosure.** Don't paint all five 5E rows at once. Reveal them top-down with a 90ms stagger (`animation-delay` per index) so the skeleton *assembles*, mirroring how the plan builds. Feels like the AI is laying down sections.
3. **Tie progress storytelling to a real arc, in the teacher's language.** The 5 phrases already exist per language and rotate on a timer. Upgrade the *visual*: prefix each with a thin saffron determinate-ish bar that advances in discrete steps (20→40→60→80%) as phrases change — honest "phase N of 5," not a fake spinner-to-100%. Hold at ~90% until the real response lands, then snap to 100% + checkmark. Reuses `DEFAULT_HINTS_BY_LANG` verbatim.
4. **Handoff, not hard swap.** When content arrives, cross-fade skeleton→content over `--motion-medium` and let the first real section inherit the skeleton's position (shape-matched already, so no layout jump) — then run the §3 stagger.

---

## 3. Micro-interactions (polish, ~zero runtime cost — all compositor-only)

- **Universal tap feedback.** Promote `active:scale-[0.97]` + `transition-transform duration-micro` to `Button` base and every `Card`-as-link (Quick Action, Suggestion). Touch users finally feel presses. `transform` only — no reflow.
- **Card hover → also lift.** Add `hover:-translate-y-0.5` alongside the existing shadow bump; on `md:` only (pointer devices), so touch scroll never jitters.
- **Result stagger (the payoff).** Wrap `LessonPlanDisplay` sections in a container that reveals children with a 60–80ms cascade (`fade-in slide-in-from-bottom-2`). The eye rides down the finished plan.
- **Toast.** Radix slide-in already present; standardize its curve to `--ease-out-quart` and add a thin auto-dismiss progress line so teachers see time remaining. Success toast: 400ms checkmark draw.
- **Voice input = the signature moment.** Add a soft saffron pulsing ring (`box-shadow` scale, ~2s) around the mic between tap and first waveform frame, so the ~300ms STT init never feels dead. This is the one place to spend a little extra delight.
- **Number/usage counters.** `UsageRemainingBadge` should count up rather than snap — 500ms ease-out.

---

## 4. Page / route transitions

Add a single shared route wrapper: fade + 8px rise over `--motion-medium` on `pathname` change (Framer `AnimatePresence` is already a dependency — no new package). Outgoing content should NOT fully fade before incoming (overlap ~50%) to avoid a white flash on low-end screens. One wrapper in the app shell; every tool page benefits. Keep it *subtle* — this is a utility app, not a portfolio.

---

## 5. Performance-safe motion budget (mid-range Android is the target)

**Hard rules — encode as lint/review checklist:**

- **Animate only `transform` and `opacity`.** Never `width/height/top/left/box-shadow`-as-layout, never `filter: blur` in loops. (Current shadow-on-hover is acceptable — pointer-only, not per-frame.)
- **Budget: ≤3 concurrently animating element groups per viewport.** The result stagger self-terminates; nothing infinite except the one active skeleton shimmer and the mic ring.
- **Every non-essential animation gates on `prefers-reduced-motion`.** Add a global `@media (prefers-reduced-motion: reduce){ *{animation-duration:.01ms!important;transition-duration:.01ms!important} }` base rule + a `useReducedMotion` hook for JS paths. Extend the `omni-orb` precedent app-wide.
- **Respect Save-Data / low network.** The `useNetworkAware` hook exists — on constrained connections, drop route transitions and the mic ring, keep only functional state changes.
- **No JS-driven `requestAnimationFrame` loops** except the existing waveform. Everything else is CSS/compositor so it survives a busy main thread mid-generation.

---

## 6. Quick wins vs big bets

**Quick wins (hours, high impact):**
1. Swap skeleton `animate-pulse` → `shimmer` keyframe.
2. Global `prefers-reduced-motion` reset rule.
3. `active:scale-[0.97]` + `hover:-translate-y-0.5` on `Button` + link-cards.
4. Normalize stray `transition-*` to `ease-out-quart` + a `duration-*` token.
5. Stagger `LessonPlanDisplay` sections.

**Big bets (design + build):**
1. Staged skeleton assembly + honest phase-progress bar in the loading overlay (biggest perceived-wait win; reuses existing i18n strings).
2. Shared route-transition wrapper via `AnimatePresence`.
3. Mic pulse-ring + success-checkmark motion language, applied across all generators.

**Sequencing:** ship the quick wins first (they touch shared primitives, so every page improves at once and de-risks the big bets), then the loading choreography, then routes. No new dependencies required.
