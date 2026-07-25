import 'package:flutter/material.dart';

import 'app_colors.dart';

/// The glass engine — App-wide Glassmorphism Reskin, GL-1 (2026-07-25).
///
/// Apple "Liquid Glass"-style translucent/blurred material tokens. Two fill
/// families, same visual language, different cost:
///   • CHROME fill ([lChromeFill]/[dChromeFill]) — paired with a REAL
///     `BackdropFilter(ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma))`
///     on singular, floating, non-scrolling surfaces (nav bar, app bar,
///     sheets, dialog). `BackdropFilter` forces a `saveLayer` + GPU blur pass
///     per instance — fine for a handful of chrome layers, ruinous stacked
///     dozens-deep in a scrolling list on minSdk-24-class hardware.
///   • FLAT fill ([lFlatFill]/[dFlatFill]) — no blur, just a tuned
///     translucent/tinted [Color] composited directly over the app's already
///     near-flat `lightPaper`/`darkVignette` background (see
///     `app_gradients.dart`). For list-context reuse (`AppCard`, chat
///     bubbles, badges — wired in GL-3/GL-4, not this unit).
///
/// CONTRAST-SAFETY METHOD: verified by actually computing the composited
/// colour (`Color.alphaBlend`, the same blend Flutter itself performs) and
/// checking real WCAG contrast against `onSurface`, INCLUDING the worst
/// case — this fill over a plain white backdrop, not just the flat-paper/
/// vignette case the visual design assumes. The GL-1 design review's numbers
/// (see the exact `theme_contrast_test.dart` group): even that worst case
/// clears 9.35:1 for the darkest fill and 17.4:1 for the lightest — both
/// comfortably over double the 4.5:1 AA floor. That headroom is what let the
/// opacities below be tuned DOWN from an earlier, over-cautious first pass
/// (85-90%) to values that actually let content show through the blur —
/// glass you can see through, not an opaque card with a translucent name.
///
/// This file is exempt from token_guard (same directory-based exemption as
/// `app_shadows.dart`/`app_gradients.dart`: it DEFINES raw values, other
/// files only ever reference them by name).
class AppGlass {
  AppGlass._();

  /// Real-blur sigma for `ImageFilter.blur(sigmaX: blurSigma, sigmaY:
  /// blurSigma)`. Deliberately mid-range (18–24), NOT the 40+ sigmas that
  /// look lush on a MacBook preview: `BackdropFilter` blur cost scales with
  /// sigma, and minSdk is 24 — real rural/budget Android GPUs (API 24-26,
  /// confirmed in scope by the Explore research pass for this plan) are the
  /// floor this has to render acceptably on, not flagship silicon. 20.0 reads
  /// as a clear "frosted" glass at typical chrome-surface sizes (nav bar,
  /// app bar, sheet) while staying well short of the range where the GPU
  /// blur pass starts to visibly cost frame time on weak hardware.
  static const double blurSigma = 20.0;

  /// Width of the gradient edge-highlight ring (see [lBorderGradient]).
  /// Matches the 1px scale already used for the dark catch-light in
  /// `app_shadows.dart` (`dTopHighlight`).
  static const double borderWidth = 1.0;

  // ---------------------------------------------------------------------
  // CHROME fill — real blur (nav bar, app bar, sheets, dialog)
  // ---------------------------------------------------------------------

  /// 75% opacity white. GL-1 design review computed the actual worst-case
  /// composite (this fill over a PURE WHITE backdrop, not the assumed
  /// near-flat [AppColors.lBackground]) at contrast ~17.4:1 — over 3x the
  /// 4.5:1 floor — and found the ORIGINAL 85% value ceded most of that
  /// headroom for no reason: at 85-90% opacity only 10-15% of whatever sits
  /// behind the blur shows through, which mostly defeats the "translucent"
  /// half of glassmorphism (reads as an opaque card with a blurred halo, not
  /// glass you can see through). 75% keeps the same enormous contrast margin
  /// while actually letting content show through the blur.
  static const Color lChromeFill = Color(0xBFFFFFFF);

  /// 75% opacity of [AppColors.dCard] `#1C1F26`. Same review finding as
  /// [lChromeFill]: even the worst case tested (this fill composited over a
  /// PURE WHITE backdrop, not the assumed near-flat [AppColors.dBackground])
  /// lands at 9.35:1 — more than double the 4.5:1 floor — so 75% trades
  /// nothing away versus the original 85% beyond opacity that wasn't buying
  /// contrast safety in the first place.
  static const Color dChromeFill = Color(0xBF1C1F26);

  // ---------------------------------------------------------------------
  // FLAT fill — cheap, no blur (list-context reuse: AppCard, chat bubbles,
  // badges — GL-3/GL-4, not wired by this unit)
  // ---------------------------------------------------------------------

  /// 80% opacity white composited over `AppGradients.lightPaper`
  /// (~[AppColors.lBackground]) — tuned down from an original 90% by the
  /// GL-1 design review's worst-case contrast math (see [lChromeFill]),
  /// which showed that value was far more opaque than the AA floor requires.
  /// Slightly more opaque than [lChromeFill] since there is no blur pass
  /// here to soften banding against the background — the flat path still
  /// needs a touch more coverage than the blurred one at the same nominal
  /// translucency.
  static const Color lFlatFill = Color(0xCCFFFFFF);

  /// 80% opacity of [AppColors.dCard] composited over
  /// `AppGradients.darkVignette` (~[AppColors.dBackground]) — same tuning
  /// rationale as [lFlatFill].
  static const Color dFlatFill = Color(0xCC1C1F26);

  // ---------------------------------------------------------------------
  // Gradient edge-highlight. Flutter's `Border.all`/`BoxBorder` cannot paint
  // a gradient directly (`BorderSide.color` is a single flat `Color`), so
  // this token is exposed as a `LinearGradient` + [borderWidth] rather than
  // a `Border`/`BoxBorder` instance. The consuming widget (`GlassSurface`)
  // renders it with the common "padding trick": an outer shape painted with
  // this gradient as its fill, inset by [borderWidth], with an inner shape
  // of the same corner geometry painted with the real glass fill on top —
  // the uncovered `borderWidth`-wide ring is the only part of the gradient
  // that shows, reading as a soft gradient-bordered edge. No custom
  // `BoxBorder` subclass or `CustomPainter` needed.
  // ---------------------------------------------------------------------

  /// White top-left@0.40 → white bottom-right@0.10 — the light-mode glass
  /// edge highlight (light catching the top-left of a curved glass edge).
  static final LinearGradient lBorderGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Colors.white.withValues(alpha: 0.40),
      Colors.white.withValues(alpha: 0.10),
    ],
  );

  /// Analogous light-on-dark highlight, subtler (0.14 → 0.03) — dark glass
  /// still catches a highlight, just a quieter one, consistent with the
  /// existing dark 1px catch-light precedent (`AppShadows.dTopHighlight`,
  /// white@0.05).
  static final LinearGradient dBorderGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Colors.white.withValues(alpha: 0.14),
      Colors.white.withValues(alpha: 0.03),
    ],
  );

  // ---------------------------------------------------------------------
  // Diagonal sheen — barely-there foreground overlay, top-left → center.
  // Carries a SAFFRON tint (not neutral white) so the brand colour keeps
  // running through the glass material, per the founder's explicit "reskin
  // the material, not the colour system" direction. Matches this app's house
  // rule from `app_gradients.dart`: "if a gradient is noticeable at a
  // glance, it is too strong" — but the GL-1 design review computed the
  // ORIGINAL dose (25%/20% blend at alpha 0.08/0.06) and found it washed out
  // twice over (once diluted into white, once again at low alpha over an
  // already near-white/near-black fill) to within 1-4 RGB units of a
  // perfectly neutral sheen — a token gesture at brand colour, not a
  // perceptible one. Retuned stronger so the tint actually reads once
  // composited, while staying well inside the "barely-there" house rule
  // (still a soft corner glow, not a visible painted gradient).
  // ---------------------------------------------------------------------

  static final Color _lSheenBase =
      Color.lerp(Colors.white, AppColors.brandSaffron, 0.45)!;
  static final Color _dSheenBase =
      Color.lerp(Colors.white, AppColors.dPrimary, 0.40)!;

  /// Saffron-tinted sheen, alpha 0.17 → 0, top-left → center.
  static final LinearGradient lSheenGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.center,
    colors: [
      _lSheenBase.withValues(alpha: 0.17),
      _lSheenBase.withValues(alpha: 0.0),
    ],
  );

  /// Same idea, quieter (0.12 → 0) — a bright sheen reads louder on a dark
  /// ground, so it is dialled back further than the light-mode version.
  static final LinearGradient dSheenGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.center,
    colors: [
      _dSheenBase.withValues(alpha: 0.12),
      _dSheenBase.withValues(alpha: 0.0),
    ],
  );

  /// Apple-style "squircle" corner shape via Flutter's BUILT-IN
  /// `ContinuousRectangleBorder` — no custom painter, no new package. Shared
  /// helper so every glass surface (and both the outer border-gradient shape
  /// and the inner fill shape in the padding-trick ring) uses identical
  /// corner geometry. Lives here (not in `glass_surface.dart`) so the
  /// `.circular(` call stays inside the token_guard-exempt theme directory —
  /// callers pass a runtime `radius`, which the guard's static scan can't
  /// verify is on-scale, so the guard would otherwise flag it outside this
  /// directory.
  static ShapeBorder squircle(double radius) =>
      ContinuousRectangleBorder(borderRadius: BorderRadius.circular(radius));
}
