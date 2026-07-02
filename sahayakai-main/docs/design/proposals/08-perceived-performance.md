# 08 — Perceived Performance & Loading Experience

**Lens:** perceived performance (design side). **Context:** mid-range Android, patchy
networks, AI generations of 15–30s. **Constraints:** Lucide icons only, saffron-forward.

## 1. Current-state assessment

The primitives are strong; adoption is thin and inconsistent.

**What works.** `RotatingProgressHint` (`skeletons/lesson-plan-loading.tsx`) cycles
teacher-language progress copy every 6s across all 11 languages, framed around value
("Adding hyperlocal examples") not internals — exactly right. Shape-matched skeletons
exist (`LessonPlanResultSkeleton`, `CommunityFeedSkeleton`, `LessonPlanFormSkeleton`) and
mirror final layout, so content swaps without layout jump. `ResultShell` unifies output
chrome and already exposes `loading` on actions with `aria-busy`. `EmptyState` is
well-designed — an "Example" ribbon over a sample card rather than a literal illustration
(good call for rural literacy). Cache hits fire instant-load toasts; a Cancel button and
network-aware guard (`useNetworkAware`) round it out.

**Where it breaks down.**
- **Coverage gap.** 60 files render a raw `Loader2` spinner; only 12 import a skeleton and
  only 5 pages use `EmptyState` (out of 47 pages). Most tools still show a centered
  spinner during their multi-second generation — the pattern the lesson-plan page
  explicitly moved away from, un-propagated.
- **Orphaned streaming.** `/api/ai/lesson-plan/stream` and `/api/ai/exam-paper/stream`
  implement clean SSE progress events (`status` → `complete`), but **no client consumes
  them.** `use-lesson-plan.ts` calls the blocking `/api/ai/lesson-plan` and fakes progress
  with a hardcoded `setTimeout(800)` "UX pause." Real server phase signals are being
  thrown away.
- **No route-level shells.** Zero `loading.tsx` files exist. Every `"use client"` page
  boots to blank until hydration; only lesson-plan wraps a `<Suspense>` skeleton.
- **Image loading is unmanaged.** Generated images render `<Image unoptimized>` with no
  placeholder, blur, or fade — on a slow link the 512px frame sits empty then pops.
  Exactly one `priority` usage exists app-wide.

## 2. A coherent loading-state system

Promote the lesson-plan patterns to a shared vocabulary every tool draws from.

- **Skeleton = final layout, always.** Ban standalone centered spinners for content
  regions. Each generator ships a `*ResultSkeleton` matching its output (extend the
  existing per-tool convention). Spinners survive only as inline button cues.
- **Staged reveal.** Render `ResultShell` chrome (title, meta badges, action bar) the
  instant a request fires, with a skeleton body — so the frame is present in <100ms and
  only the body resolves. Reuse the `animate-in fade-in slide-in-from-bottom` already on
  the result card.
- **Streaming choreography (biggest single win).** Add a `useProgressStream` hook that
  consumes the existing SSE routes: map each `status` event to a checklist step that
  ticks from pulsing → checked, driven by *real* server phases instead of `setTimeout`.
  Feed `RotatingProgressHint` from server messages when present, fall back to local copy.
- **Teacher-language progress.** `RotatingProgressHint` + `SUBTITLE_BY_LANG` are the
  template; every long op reuses them. Keep the "typical 15–30s, output appears here"
  expectation-setting subtitle — it converts a scary wait into a bounded one.

## 3. Image & asset loading for low bandwidth

- Add a reusable `<ResultImage>` wrapping `next/image` with an `aspect-*` box, a
  saffron-tinted skeleton underlay, and `onLoad` fade-in — so the frame reserves space and
  never pops. (The visual-aid frame already reserves `aspect-square`; add the underlay +
  fade.)
- Use `placeholder="blur"` for stored/remote images; keep `unoptimized` only for inline
  data-URIs (already correct — data URIs can't be optimized).
- `priority` only for the single above-the-fold hero per page; everything below stays
  lazy (Next default). Audit the near-total absence of `priority` — the hero avatar/logo
  should have it.
- Gate heavy generated media behind `useNetworkAware` (already gates AI): on `2g`/save-data
  offer a "tap to load image" affordance instead of auto-fetching.

## 4. Empty-state & first-run

- Roll `EmptyState` to every list/gallery/dashboard that can render zero rows (library,
  community, messages, org dashboard, usage). Never show a bare blank region.
- First-run: seed each tool's empty result area with its `sample` preview so a brand-new
  teacher sees *what the output will look like* before generating — the app never looks
  dead on first open.
- Skeletons on first paint (via `loading.tsx`, see §6) mean even a cold, un-hydrated route
  shows structure, not white.

## 5. Instant-feedback patterns

- **Optimistic UI** for cheap mutations — save/share/like/feedback should flip state
  immediately and reconcile on response (community actions, `QuickShareButton`), matching
  the instant-load cache toast pattern already in place.
- **Pending states** everywhere a spinner lives now: disable the trigger, swap label to the
  active verb ("Generating…"), set `aria-busy`. `ResultShell` actions do this — extend to
  loose buttons. Keep the double-submit ref guard (`submittingRef`) as the standard.
- **Tactile submit:** on tap, immediately scroll the skeleton into view so the teacher sees
  a reaction within one frame, before any network round-trip.

## 6. Quick wins vs big bets

**Quick wins (days).**
1. Add `loading.tsx` route skeletons for the top ~10 tool pages — instant structure on
   navigation, zero logic.
2. Replace content-region `Loader2` spinners with the matching skeleton in the 5–8
   highest-traffic tools.
3. Ship `<ResultImage>` (skeleton underlay + fade) and adopt in visual-aid / assessment.
4. Add `priority` to the hero image/avatar; confirm everything else lazy-loads.

**Big bets (1–2 sprints).**
1. **Wire the streaming routes.** `useProgressStream` + a staged checklist turns the
   flagship 15–30s waits from a rotating guess into live, server-truthful progress. Highest
   perceived-speed ROI in the app.
2. **Design-system loading contract.** A `<Loadable>`/`ResultShell` convention (skeleton +
   staged reveal + streamed progress + empty state) that every new tool inherits by
   default, so coverage never regresses.
3. Save-data / `2g` media deferral tied into `useNetworkAware`.
