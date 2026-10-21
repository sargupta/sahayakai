import 'dart:ui';

import 'package:flutter/material.dart';

import 'app_colors.dart';
import 'app_radius.dart';
import 'app_shadows.dart';

/// The glass engine — Design System v3 (canonical).
///
/// **Glass cards: 82% white (`rgba(255,255,255,.82)`) with a 1px 95%-white border,
/// sitting on the wash. Secondary tiles use 70%.**
/// Only the primary card on a screen gets the soft shadow
/// `0 8px 20px rgba(23,19,16,.06)`. Solid `#FFFDF9` is used for sheets.
///
/// Two fill families, same visual language, different cost:
///   • CHROME fill — paired with a REAL `BackdropFilter(ImageFilter.blur)`
///     on singular, floating, non-scrolling surfaces (nav bar, app bar,
///     sheets, dialog). `BackdropFilter` forces a `saveLayer` + GPU blur pass
///     per instance — fine for a handful of chrome layers.
///   • FLAT fill — no blur, just a tuned translucent/tinted [Color] composited
///     directly over the app's pastel wash background. For list-context reuse
///     (`AppCard`, chat bubbles, badges).
///
/// CONTRAST-SAFETY: verified by computing the composited colour
/// (`Color.alphaBlend`) and checking real WCAG contrast against `onSurface`,
/// INCLUDING the worst case — this fill over a plain white backdrop.
class AppGlass {
  AppGlass._();

  /// Real-blur sigma for `ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma)`.
  /// 18px matches the design spec (`blur(18px)` on web nav).
  static const double blurSigma = 18.0;

  /// Width of the gradient edge-highlight ring (1px).
  static const double borderWidth = 1.0;

  // ---------------------------------------------------------------------------
  // CHROME FILL — real blur (nav bar, app bar, sheets, dialog)
  // ---------------------------------------------------------------------------

  /// 82% milk-200 `#FBF8F3` — the design's BLUR surface: the sticky nav is
  /// `backdrop-filter: blur(18px)` over `rgba(251,248,243,.82)` (readme:
  /// "blur is used only on the sticky nav (blur(18px) over 82% milk)").
  /// Deliberately NOT the flat card fill: chrome reads as warm raised milk,
  /// cards as white, so the two families stay visually distinct at the same
  /// nominal 82% (a restyle pass that aliased them to one white token is what
  /// collapsed the pair).
  static const Color lChromeFill = Color(0xD1FBF8F3); // 0.82 * 255 ≈ 209

  /// 82% of [AppColors.dCard] `#1F1A16` — the dark counterpart of the same
  /// idea (the raised chrome tone, not the sunken ground), kept distinct from
  /// the 82%-ink [dFlatFill] so the pair never collapses the way the light one
  /// did. Still 9.6:1 for milk body text over the worst case (a white blur
  /// backdrop), far above the 4.5 floor.
  static const Color dChromeFill = Color(0xD11F1A16); // 0.82 * 255 ≈ 209

  // ---------------------------------------------------------------------------
  // FLAT FILL — no blur (lists, cards, bubbles, badges)
  // ---------------------------------------------------------------------------

  /// 82% white. Light theme — primary glass cards.
  static const Color lFlatFill = Color(0xD1FFFFFF);

  /// 70% white. Light theme — secondary tiles.
  static const Color lFlatFillSoft = Color(0xB3FFFFFF); // 0.70 * 255 = 178.5 ≈ 179

  /// 82% ink. Dark theme.
  static const Color dFlatFill = Color(0xD1171310);

  /// 70% ink. Dark theme.
  static const Color dFlatFillSoft = Color(0xB3171310);

  // ---------------------------------------------------------------------------
  // BORDERS & SHEEN
  // ---------------------------------------------------------------------------

  /// 1px 95% white edge highlight (light).
  static const Color lBorderColor = Color(0xF2FFFFFF); // 0.95 * 255 = 242

  /// 1px ~12% white edge highlight (dark).
  static const Color dBorderColor = Color(0x1FFFFFFF); // 0.12 * 255 ≈ 31

  /// Saffron-tinted diagonal sheen (light) — `rgba(201,106,40,.04)` bands.
  static const LinearGradient lSheenGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    stops: [0.0, 0.5, 1.0],
    colors: [
      Color(0x0AC96A28),
      Color(0x00C96A28),
      Color(0x0AC96A28),
    ],
  );

  /// Saffron-tinted diagonal sheen (dark) — saffron-200 bands.
  static const LinearGradient dSheenGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    stops: [0.0, 0.5, 1.0],
    colors: [
      Color(0x14FFD9AE),
      Color(0x00FFD9AE),
      Color(0x14FFD9AE),
    ],
  );

  // ---------------------------------------------------------------------------
  // GRADIENT EDGE-HIGHLIGHT — the "padding trick" ring consumed by
  // GlassSurface: an outer shape filled with this gradient, inset by
  // [borderWidth], with the real glass fill on top; the uncovered
  // [borderWidth]-wide ring reads as a soft gradient-bordered edge.
  // ---------------------------------------------------------------------------

  /// White top-left@0.40 → white bottom-right@0.10 — light glass edge highlight.
  static final LinearGradient lBorderGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Colors.white.withValues(alpha: 0.40),
      Colors.white.withValues(alpha: 0.10),
    ],
  );

  /// Analogous light-on-dark highlight, subtler (0.14 → 0.03).
  static final LinearGradient dBorderGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      Colors.white.withValues(alpha: 0.14),
      Colors.white.withValues(alpha: 0.03),
    ],
  );

  // ---------------------------------------------------------------------------
  // SHAPE HELPERS — Apple-style squircle via Flutter's built-in
  // `ContinuousRectangleBorder` (no custom painter, no package). Shared so
  // every glass surface (outer border ring + inner fill) uses identical
  // corner geometry. Lives in the token_guard-exempt theme directory because
  // callers pass a runtime `radius`.
  // ---------------------------------------------------------------------------

  /// Uniform-radius squircle.
  static ShapeBorder squircle(double radius) =>
      ContinuousRectangleBorder(borderRadius: BorderRadius.circular(radius));

  /// Per-corner squircle (e.g. a bottom sheet's top-only rounding).
  /// `ContinuousRectangleBorder` natively supports non-uniform `BorderRadius`.
  static ShapeBorder squircleFromBorderRadius(BorderRadius borderRadius) =>
      ContinuousRectangleBorder(borderRadius: borderRadius);

  /// [borderRadius] inset by [borderWidth] on every corner (clamped ≥ 0) —
  /// the inner shape of the padding-trick border ring.
  static BorderRadius insetBorderRadius(BorderRadius borderRadius) {
    Radius inset(Radius r) =>
        Radius.circular((r.x - borderWidth).clamp(0.0, double.infinity));
    return BorderRadius.only(
      topLeft: inset(borderRadius.topLeft),
      topRight: inset(borderRadius.topRight),
      bottomLeft: inset(borderRadius.bottomLeft),
      bottomRight: inset(borderRadius.bottomRight),
    );
  }

  // ---------------------------------------------------------------------------
  // BUILDERS (v3 convenience wrappers around GlassSurface-style composition)
  // ---------------------------------------------------------------------------

  /// Chrome surface with real `BackdropFilter` blur.
  /// Use for: nav bar, app bar, bottom sheets, dialogs.
  static Widget chrome({
    required Widget child,
    required BuildContext context,
    BorderRadius? borderRadius,
    List<BoxShadow>? shadows,
    bool addSheen = true,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fill = isDark ? dChromeFill : lChromeFill;
    final borderColor = isDark ? dBorderColor : lBorderColor;
    final sheen = isDark ? dSheenGradient : lSheenGradient;
    final effectiveShadows = shadows ?? (isDark ? AppShadows.cardDark : AppShadows.cardLight);

    return ClipRRect(
      borderRadius: borderRadius ?? AppRadius.rCard,
      child: Stack(
        children: [
          // Blur layer
          BackdropFilter(
            filter: ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
            child: Container(
              decoration: BoxDecoration(
                color: fill,
                borderRadius: borderRadius ?? AppRadius.rCard,
                border: Border.all(color: borderColor, width: borderWidth),
              ),
            ),
          ),
          // Sheen layer
          if (addSheen)
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: sheen,
                    borderRadius: borderRadius ?? AppRadius.rCard,
                  ),
                ),
              ),
            ),
          // Shadow carrier (behind glass)
          if (effectiveShadows.isNotEmpty)
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: borderRadius ?? AppRadius.rCard,
                    boxShadow: effectiveShadows,
                  ),
                ),
              ),
            ),
          // Content
          child,
        ],
      ),
    );
  }

  /// Flat surface — no blur, just tuned translucent fill + gradient border + sheen.
  /// Use for: AppCard, chat bubbles, badges, list items — any scrolling context.
  static Widget flat({
    required Widget child,
    required BuildContext context,
    BorderRadius? borderRadius,
    List<BoxShadow>? shadows,
    bool addSheen = true,
    bool isSecondary = false, // 70% fill for secondary tiles
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fill = isSecondary
        ? (isDark ? dFlatFillSoft : lFlatFillSoft)
        : (isDark ? dFlatFill : lFlatFill);
    final borderColor = isDark ? dBorderColor : lBorderColor;
    final sheen = isDark ? dSheenGradient : lSheenGradient;
    final effectiveShadows = shadows ?? (isDark ? AppShadows.cardDark : AppShadows.cardLight);

    return ClipRRect(
      borderRadius: borderRadius ?? AppRadius.rCard,
      child: Stack(
        children: [
          // Fill + border
          Container(
            decoration: BoxDecoration(
              color: fill,
              borderRadius: borderRadius ?? AppRadius.rCard,
              border: Border.all(color: borderColor, width: borderWidth),
            ),
          ),
          // Sheen layer
          if (addSheen)
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: sheen,
                    borderRadius: borderRadius ?? AppRadius.rCard,
                  ),
                ),
              ),
            ),
          // Shadow carrier
          if (effectiveShadows.isNotEmpty)
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: borderRadius ?? AppRadius.rCard,
                    boxShadow: effectiveShadows,
                  ),
                ),
              ),
            ),
          // Content
          child,
        ],
      ),
    );
  }

  /// Sheet surface — solid milk-50 (light) / ink-900 (dark) with top radius.
  /// Used for bottom sheets, deliver tray, voice sheet.
  static Widget sheet({
    required Widget child,
    required BuildContext context,
    BorderRadius? borderRadius,
    List<BoxShadow>? shadows,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final fill = isDark ? AppColors.ink900 : AppColors.milk50;
    final effectiveShadows = shadows ?? (isDark ? [AppShadows.dSheet] : [AppShadows.sheet]);

    return ClipRRect(
      borderRadius: borderRadius ?? AppRadius.rSheet,
      child: Stack(
        children: [
          Container(
            color: fill,
          ),
          if (effectiveShadows.isNotEmpty)
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: borderRadius ?? AppRadius.rSheet,
                    boxShadow: effectiveShadows,
                  ),
                ),
              ),
            ),
          child,
        ],
      ),
    );
  }
}