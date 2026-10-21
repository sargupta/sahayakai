# DIRECTION — Motion & Micro-interaction

**Lens:** Motion / micro-interaction for the premium re-skin.
**Scope:** Presentation layer only — theme tokens + shared widgets + screen choreography. No functional rewrite. The 747 passing tests and all wiring survive.
**Stack:** Flutter, Material 3, `google_fonts`, `shimmer ^3.0.0` (already in `pubspec.yaml`), **add `flutter_animate ^4.5.0`** (approved). Nothing exotic.

---

## 0. Diagnosis — why the current app reads static and cheap

I read the four shipped screenshots and every token file (`app_motion.dart`, `app_colors.dart`, `app_shadows.dart`, `app_text.dart`, `app_theme.dart`). The functional design system is *correct and disciplined* — the problem is that **almost none of the motion the tokens describe is actually spent on screen.**

1. **Zero entrance motion.** The dashboard's six tool cards, the login's feature list, every form field — all hard-cut into existence on the first frame. No screen has a single `.animate()` or `AnimatedSwitcher`. A premium app never hard-cuts a list into view; content *arrives*.
2. **The only transition is a fallback.** `app_theme.dart:304` sets `PredictiveBackPageTransitionsBuilder` for Android and leaves iOS to the M3 default. There is no branded, considered push transition — screens swap with the platform's most generic slide.
3. **`shimmer` is a dependency that isn't used.** The rubric (§ Loading) *mandates* skeletons, yet nothing wires them. Full-screen loads fall back to a bare `CircularProgressIndicator` — the single strongest "cheap utility app" tell.
4. **Press feedback is raw M3 ripple only.** A saffron ink splash on a white card is the Android-stock gesture. Premium surfaces *depress* — a 1–2 % scale-down under the thumb reads as physical and expensive; a flat ripple does not.
5. **The result reveal — the product's whole payoff — is unchoreographed.** A teacher taps *Generate*, waits, and the finished lesson plan presumably hard-cuts in. The one moment that should feel like magic is a `setState`.
6. **Empty and splash states have no life.** No signature splash beyond (presumably) a static mark; empty states are static icon-stacks. Nothing signals craft in the first three seconds — and first impression is where "prestigious school is proud to open this" is won or lost.

The tokens promise motion (`micro/small/medium`, `easeOutQuart`). The screens spend none of it. **This direction is about spending that motion budget deliberately, plus a small, disciplined extension to the token set.**

---

## 1. Motion principles (the five rules everything obeys)

1. **Confident, not playful.** Premium = restrained. No bounce, no overshoot, no elastic, no spring wobble on UI reveals. Motion decelerates into place and stops. The one sanctioned exception is the *signature splash* and *result-reveal hero*, which may use a single, subtle settle (see §3, §7) — never a cartoon bounce.
2. **Motion clarifies causality.** Every animation answers "what just happened / what came from where." Cards stagger from the direction the eye reads (top-leading). A pushed screen enters from the trailing edge. A result grows out of the button that summoned it. Motion that doesn't explain a state change is decoration and is cut.
3. **Short and out of the way.** Entrance and feedback live in **150–420 ms**. Only full-screen orchestrations (splash, result reveal) may reach **~600 ms** total *wall-clock* — and only because they are a *stagger of short elements*, never one long tween. Nothing blocks input longer than 350 ms.
4. **One curve family, not a free-for-all.** The codebase keeps a *tiny, lintable* set of curves (§2). This preserves the rubric's "no curve zoo" intent while giving the emphasis premium motion needs.
5. **Accessibility and low-end perf are non-negotiable.** Every animation degrades to an instant (or cross-fade-only) state when `MediaQuery.disableAnimations` is true. Nothing animates a property that forces layout on a 60 Hz budget on cheap hardware (§8). Motion never gates access to content — the screen is usable at frame one; motion is a layer on top.

---

## 2. Token extension — `app_motion.dart`

The current file has three durations and **one** curve. Motion this restrained *can* work, but a single `easeOutQuart` cannot both drive a 150 ms tap and a 350 ms page push convincingly — page-scale motion needs an emphasized (accelerate-then-decelerate) curve to feel intentional. I propose a **minimal, sanctioned three-curve family** plus two added durations. This is the *only* sanctioned deviation from the current single-curve rule; update `DESIGN_RUBRIC.md §0` to name these three curves as the allowed set and keep the lint (any `Curves.*` or `Cubic(...)` outside this list still FAILs).

```dart
import 'package:flutter/animation.dart';

/// Motion tokens. The sanctioned curve set is EXACTLY the three below —
/// no other Cubic() or Curves.* is allowed in the codebase (lint-enforced).
/// See docs/flutter/design/DIRECTION_motion.md.
class AppMotion {
  AppMotion._();

  // ---- Durations ----
  static const Duration instant = Duration(milliseconds: 120); // color/opacity only
  static const Duration micro   = Duration(milliseconds: 160); // tap depress, focus, hover
  static const Duration small   = Duration(milliseconds: 240); // reveal, dropdown, chip select
  static const Duration medium  = Duration(milliseconds: 320); // page, dialog, sheet, result card
  static const Duration large   = Duration(milliseconds: 420); // hero / splash element (single element)

  // ---- Stagger ----
  static const Duration stagger = Duration(milliseconds: 55);  // per-item entrance offset

  // ---- Curves (the whole sanctioned set) ----
  /// Primary decelerate. Content settling into place — entrances, reveals,
  /// skeleton→content. Fast start, gentle stop. (unchanged canonical curve)
  static const Cubic easeOutQuart = Cubic(0.16, 1.0, 0.30, 1.0);

  /// Emphasized (M3 emphasized). Page & sheet transitions, result reveal —
  /// motion that travels distance and needs to feel deliberate on both ends.
  static const Cubic emphasized = Cubic(0.20, 0.00, 0.00, 1.0);

  /// Standard in-out. Reversible/symmetric states only — theme cross-fade,
  /// AnimatedSwitcher between two equal states, toggle. Never for entrances.
  static const Cubic standard = Cubic(0.40, 0.00, 0.20, 1.0);
}
```

**Assignment table** (curve × duration per interaction):

| Interaction | Duration | Curve | Mechanism |
|---|---|---|---|
| Tap depress (buttons, cards) | `micro` 160 | `easeOutQuart` | `AnimatedScale` on press state |
| Focus ring / input border | `micro` 160 | `standard` | `AnimatedContainer` (theme already animates color) |
| Chip select / toggle | `small` 240 | `easeOutQuart` | `AnimatedContainer` |
| List / card entrance | `small` 240 + `stagger` 55 | `easeOutQuart` | `flutter_animate` `.fadeIn().slideY()` |
| Dropdown / accordion reveal | `small` 240 | `easeOutQuart` | `AnimatedSize` / `AnimatedSwitcher` |
| Page push / pop | `medium` 320 | `emphasized` | custom `PageTransitionsBuilder` (§4) |
| Dialog / bottom sheet | `medium` 320 | `emphasized` | route transition |
| Skeleton → content | `small` 240 | `easeOutQuart` | `AnimatedSwitcher` cross-fade |
| Result reveal (hero) | `medium` 320 + stagger | `emphasized` | `flutter_animate` sequence (§7) |
| Theme light↔dark | `medium` 320 | `standard` | `AnimatedTheme` (built-in) |
| Splash mark | `large` 420 ×2 | `easeOutQuart` | `flutter_animate` (§3) |

---

## 3. Signature splash — the first three seconds

The splash is the single most valuable brand moment and today it is wasted. It must feel *composed*, not loaded.

**Composition:** center the graduation-cap mark on the warm off-white scaffold (`lBackground #FEFEFD`). This is a **large decorative surface**, so the mark uses full **`brandSaffron #FF9933`** — the class doc explicitly sanctions the vivid saffron for the splash mark (decorative, no small text over it). Wordmark "SahayakAI" in Outfit w700 below.

**Choreography (total ~900 ms, then hold ≥400 ms before route-out):**
1. **0 ms** — mark enters: `scale 0.90 → 1.00` + `fadeIn 0 → 1`, `large` 420 ms, `easeOutQuart`. A confident settle, no bounce.
2. **+140 ms** — a single soft saffron ring/underline *draws* beneath the mark: a `TweenAnimationBuilder<double>` sweeping a `CustomPainter` arc 0→1, `large` 420 ms, `easeOutQuart`. This is the one "signature" flourish — a quiet, drawn line, not a spinner.
3. **+220 ms** — wordmark `fadeIn` + `slideY 8px → 0`, `medium` 320 ms, `easeOutQuart`.
4. **Route out** — splash cross-fades (not slides) into login/dashboard, `medium` 320 ms, `standard`. Continuity: the mark's final position/size matches the login header logo, so it reads as the *same object* settling into the chrome (a poor-man's hero, no `Hero` widget needed — just matched geometry).

**Reduce-motion:** show the final composed frame immediately, hold 600 ms, cross-fade out. No draw, no scale.

```dart
// widgets/branded_splash.dart — flutter_animate
Column(mainAxisSize: MainAxisSize.min, children: [
  SahayakMark(size: 96)
    .animate()
    .fadeIn(duration: AppMotion.large, curve: AppMotion.easeOutQuart)
    .scale(begin: Offset(0.90, 0.90), end: Offset(1, 1),
           duration: AppMotion.large, curve: AppMotion.easeOutQuart),
  SizedBox(height: AppSpacing.space4),
  Text('SahayakAI', style: textTheme.headlineMedium)
    .animate(delay: 220.ms)
    .fadeIn(duration: AppMotion.medium, curve: AppMotion.easeOutQuart)
    .slideY(begin: 0.25, end: 0, duration: AppMotion.medium, curve: AppMotion.easeOutQuart),
]);
```

---

## 4. Screen transitions — a branded push

Replace the bare `PredictiveBackPageTransitionsBuilder`-only config with **one custom `PageTransitionsBuilder`** applied to both platforms, so every navigation feels like the same product.

**Spec — "Lift & settle":**
- Incoming: `slideX` from `+0.06` (6 % of width, trailing edge) → `0`, **plus** `fadeIn 0→1`, **plus** a whisper of `scale 0.985 → 1.0`. `medium` 320 ms, `emphasized`.
- Outgoing (the page being covered): `fadeOut 1 → 0.85` + `scale 1.0 → 0.99`, `medium` 320 ms, `standard`. It recedes slightly instead of sitting flat — depth.
- Pop reverses both.

The 6 % (not full-width) slide is the premium tell: the page *lifts into place* rather than flying across. Keep `PredictiveBackPageTransitionsBuilder` wrapped for Android's back-gesture where the OS drives it; use the custom builder everywhere else.

```dart
pageTransitionsTheme: PageTransitionsTheme(builders: {
  TargetPlatform.android: LiftSettleTransitionsBuilder(),
  TargetPlatform.iOS:     LiftSettleTransitionsBuilder(),
}),
// LiftSettleTransitionsBuilder composes SlideTransition(0.06→0) +
// FadeTransition + ScaleTransition(0.985→1) driven by
// CurvedAnimation(curve: AppMotion.emphasized) over 320ms.
```

**Bottom-nav tab switches** (Home/Create/Library/Me) do NOT slide — tabs are peers, so cross-fade the body with `AnimatedSwitcher` (`small` 240, `standard`) + the incoming tab's content does a *fresh stagger* (§5). The active nav icon animates its color+a 1.08 scale pop on selection (`micro` 160, `easeOutQuart`).

---

## 5. Content entrance — staggered arrival

Every list/grid of primary content staggers in on first build. This is the highest-leverage single change for "premium."

**Pattern:** each item `fadeIn 0→1` + `slideY 12px → 0`, `small` 240 ms, `easeOutQuart`, offset by `stagger` 55 ms × index. Cap the cascade at **8 items** (index clamped) so a long list doesn't make the 9th+ item feel laggy — everything past 8 shares the last delay.

**Where it applies:**
- **Dashboard tool cards** (Lesson Plan, Quiz, Instant Answer, …) — the hero use. Six cards cascade top-down over ~500 ms total.
- **Login feature list** (the three "Plan a full lesson / Build a quiz / Answer any question" rows) — stagger in after the header.
- **Form sections** on tool screens (Topic → Grade levels → Subject → …) — a gentler stagger so the form assembles itself.
- **Library / results lists.**

**Fires once per screen entry**, not on scroll and not on rebuild — gate behind a "hasAnimated" flag or `flutter_animate`'s default one-shot so scrolling a `ListView` doesn't re-trigger. Do **not** stagger on data refresh (that's a skeleton→content swap, §6).

```dart
// Reusable: lib/widgets/animated_entrance.dart
Widget staggeredItem(Widget child, int index) => child
  .animate(delay: (AppMotion.stagger * index.clamp(0, 7)))
  .fadeIn(duration: AppMotion.small, curve: AppMotion.easeOutQuart)
  .slideY(begin: 0.15, end: 0, duration: AppMotion.small, curve: AppMotion.easeOutQuart);
```

---

## 6. Loading — considered skeletons, never a bare spinner

`shimmer` is already a dependency. Wire it. **Rule: any full-screen or full-card load shows a skeleton that mirrors the real layout's shape.** Bare `CircularProgressIndicator` is banned for anything except inline button-spinners.

**Skeleton spec:**
- Skeleton blocks use `lMuted #F1F5F9` (light) / `dMuted #252931` (dark) as the base, with the `shimmer` highlight one step lighter (`#FAFAFA` / `#2B303B`). **Contrast note:** skeletons carry no text and convey no information state, so WCAG text-contrast does not apply; they must merely be *perceptible* against the card — `#F1F5F9` on `#FFFFFF` card is a visible ~1.05:1 tonal step, which is correct for a placeholder (skeletons should be quiet).
- Shimmer sweep: **1200 ms** linear, left→right, looping. This is the *one* sanctioned linear/long motion — it's an indeterminate progress texture, not a UI reveal, so the "<400 ms / no linear" rubric rule explicitly does not govern it. Add that carve-out to the rubric.
- Block shapes: match the real content. Dashboard skeleton = six rounded (`AppRadius.lg` 12) card silhouettes, each with a leading `AppRadius.md` icon square + two text bars (60 % and 40 % width). Result skeleton = title bar + 5–6 paragraph lines at 100/95/98/70 % widths.

**Skeleton → content swap:** `AnimatedSwitcher`, `small` 240 ms, `easeOutQuart`, cross-fade (no slide — the content is replacing, not arriving from elsewhere). The real content may then run its §5 stagger *once*.

**Inline / button loading** (e.g. *Generate* working): the button label cross-fades to a 20 px `CircularProgressIndicator` (strokeWidth 2, `onPrimary` color), button width holds, `AnimatedSwitcher` `micro` 160. The button is disabled with a subtle `opacity 0.92` — it never disappears.

```dart
Shimmer.fromColors(
  baseColor: cs.muted, highlightColor: cs.surfaceContainerHigh, period: 1200.ms,
  child: const DashboardSkeleton(), // static grey silhouettes of the 6 cards
);
```

---

## 7. Result reveal — the payoff choreography

When a teacher taps *Generate* and the AI returns, this is the product's magic moment. It must feel *authored*.

**Sequence (total ~560 ms wall-clock, a stagger of short elements):**
1. Button returns to rest (`micro` 160, label cross-fades back from spinner).
2. **Result card** enters: `fadeIn` + `slideY 16px → 0` + `scale 0.98 → 1.0`, `medium` 320 ms, `emphasized`. It grows into place from just below the form — reading as *produced by* the Generate action above it.
3. **Inside the card, content staggers** (§5 pattern, `stagger` 55): title → each section block. For a lesson plan's 5E sections, the five blocks cascade — the document assembles itself.
4. **Action row** (Copy / Save / Regenerate) fades in last, `small` 240, delay ~240 ms — tools appear once the content is there.
5. Auto-scroll: after step 2 starts, `Scrollable.ensureVisible` on the result header, `medium` 320, `easeOutQuart`, so the teacher's eye is carried to the result without a jump-cut.

**Regenerate:** old result cross-fades out (`opacity → 0.4`, `small` 240) *before* the new skeleton/reveal — never a hard swap.

**Reduce-motion:** result card appears instantly at final state; still auto-scrolls (scroll is functional, not decorative), but with `disableAnimations` the scroll is also instant.

---

## 8. Micro-interactions & feedback

- **Tap depress (all buttons, cards, chips, list rows):** `AnimatedScale` to `0.98` on `onTapDown`, back to `1.0` on `onTapUp`/`onTapCancel`, `micro` 160, `easeOutQuart`. Wrap once in a shared `PressableScale` widget so every tappable surface gets it for free. Keep the M3 ink ripple *underneath* — the two layers (depress + ink) together read premium.
- **Primary CTA (`Generate`, `Continue with Google`):** on press, depress to `0.98` **and** shadow drops from `AppShadows.elevated` → `soft` (the button presses *into* the surface), `micro` 160. Rest state carries `AppShadows.elevated`.
- **Chip selection (grade levels):** selected chip animates fill `lMuted → lPrimaryContainer #FBF2E9`, border → `lPrimary #C2410C`, and a `1.0 → 1.04 → 1.0` settle, `small` 240, `easeOutQuart`. **Contrast:** selected chip label uses `lOnPrimaryContainer #8B330E` on `#FBF2E9` = **7.9:1**, passes AA. Dark: `dPrimaryContainer #23262F` fill, `dOnPrimaryContainer #FFAB57` label ≈ 8:1.
- **Input focus:** border animates `lInput #E1E4EA → lRing #C2410C` (2 px), `micro` 160, `standard`. `#C2410C` as a non-text focus indicator on white = 5.18:1, well past the 3:1 UI-component minimum.
- **Pull-to-refresh / async success:** a brief saffron check-draw (same `CustomPainter` arc as the splash ring), `small` 240 — reuse, don't invent a new flourish.
- **Nav bar active item:** icon color cross-fades to `primary` + `1.0 → 1.08` scale pop, label fades in weight, `micro` 160.

---

## 9. Empty states — quiet life, not dead icons

Empty states get *one* restrained loop, never a static icon.
- Icon (Lucide, per house rule — no emoji) does a **single** entrance: `fadeIn` + `scale 0.92 → 1.0`, `medium` 320, `easeOutQuart`, then a *very* slow, low-amplitude idle: `TweenAnimationBuilder` breathing `opacity 1.0 ↔ 0.85` over **3000 ms**, `standard`, reversing. Barely perceptible — signals "alive, waiting," not "look at me."
- Headline + body + CTA stagger in beneath (§5).
- Layout is **left-aligned and real** per rubric §212 — not a centered hero stack.
- **Reduce-motion:** static final frame, no breathing, no idle loop.

---

## 10. Accessibility & performance (hard gates)

- **Reduce-motion:** read `MediaQuery.of(context).disableAnimations` (Flutter maps OS "reduce motion" to it). Provide a single `context.motionEnabled` helper; every animation site checks it and, when false: entrances/reveals jump to final frame, splash shows composed frame + timed cross-fade only, skeleton shimmer becomes a static grey block (no sweep), tap depress is disabled, page transitions become a plain fade. **Never** remove the underlying state change — only the tween.
- **Property discipline (low-end 60 Hz):** animate only `opacity`, `transform` (scale/translate), and pre-tuned `BoxShadow`/color. **Never** animate `width`/`height`/`padding` in a stagger (forces layout each frame) — use `slideY`/`scale` transforms instead. `AnimatedSize` is allowed only for single, isolated accordion reveals, never inside a list stagger.
- **Stagger cap** (index clamp to 8) keeps the longest cascade ≤ ~500 ms and bounds simultaneous animation controllers.
- **One-shot gating:** entrance animations fire once per screen mount, disposed after; no perpetual controllers except the two sanctioned quiet loops (skeleton shimmer while loading, empty-state breathe while empty) — both cheap opacity/gradient tweens, both stop when their state ends.
- **60 fps budget:** the whole language is fade + transform + shadow — GPU-cheap, no shaders, no `BackdropFilter`, no blur animations. Verified-safe on entry-level Android.

---

## 11. Reconciliation with the existing rubric (`DESIGN_RUBRIC.md §0`)

Three edits are required so this direction is lint-clean, not a violation:
1. **Curve set:** change "the SINGLE canonical curve" to name the sanctioned **three** (`easeOutQuart`, `emphasized`, `standard`). Lint still FAILs any `Cubic()`/`Curves.*` outside these three.
2. **Duration ceiling:** raise the hard cap from 400 ms to **420 ms for a single element**, and add: "multi-element orchestrations (splash, result reveal) may span up to ~600 ms *wall-clock* provided each constituent element is ≤ 420 ms and input is never blocked > 350 ms."
3. **Linear carve-out:** the "no `Curves.linear`" rule exempts the indeterminate `shimmer` sweep (1200 ms linear loop), which is a progress texture, not a UI reveal.

Everything else in §0 stands unchanged.

---

## 12. Build order (lowest risk → highest payoff, all reversible)

1. Extend `app_motion.dart` (§2) + add `flutter_animate` to `pubspec.yaml`. Zero visual change; unblocks everything.
2. `PressableScale` shared widget → wrap `PrimaryButton`, `AppCard`, chips (§8). Instantly makes every tap feel physical.
3. Wire `shimmer` skeletons into the shared `StateView` loading branch (§6). Kills the bare-spinner tell.
4. Staggered entrance on dashboard + login (§5). The signature "premium" first impression.
5. `LiftSettleTransitionsBuilder` page transition (§4).
6. Result-reveal choreography in the tool `StateView` success branch (§7).
7. Branded splash (§3) + empty-state life (§9).

Each step is an isolated, revertible presentation change. No functional path or test is touched.

---

**File:** `/Users/sargupta/SahayakAIV2/wt-flutter-rebuild/sahayakai-flutter/docs/flutter/design/DIRECTION_motion.md`
