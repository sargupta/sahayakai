import 'package:flutter/material.dart';

import 'app_colors.dart';

/// The depth engine — Design System v3 + PREMIUM_DESIGN_SPEC.md §2.3 (LOCKED).
///
/// **Warm, low and diffuse, tinted with ink `rgba(23,19,16,.)`.** v3 keeps the
/// five-level light/dark structure but retints the base to warm ink
/// (`AppColors.lShadowBase` = `#171310`, never a cool slate).
///
/// Brand elements (CTA, orb) cast a **saffron-tinted** shadow:
/// CTA `0 10px 26px rgba(201,106,40,.34)`, orb `0 10px 26px rgba(201,106,40,.42)`.
/// Working orb: indigo `0 8px 20px rgba(42,59,143,.34)`.
/// Ready orb: leaf `0 8px 20px rgba(44,95,45,.34)`.
/// Listen ring: `0 0 0 8px rgba(201,106,40,.14)`.
/// Drag ring: `0 0 0 12px rgba(201,106,40,.14)`.
/// No inner shadows.
///
/// Two naming families coexist by design:
///   • **legacy lists** (`e1…e4`, `dKey`, `ctaGlowLight`, `soft`…) — the
///     original `List<BoxShadow>` contract consumed across the app.
///   • **v3 singles** (`card`, `cta`, `orb`, `orbWorking`…) — single
///     [BoxShadow] tokens for the redesigned components.
class AppShadows {
  AppShadows._();

  static const _l = AppColors.lShadowBase; // warm ink #171310 (v3)

  // ---------------------------------------------------------------------------
  // LEGACY LIST CONTRACT (List<BoxShadow>) — retinted to warm ink
  // ---------------------------------------------------------------------------

  // e1 — resting card / list tile / input
  static final List<BoxShadow> e1 = [
    BoxShadow(color: _l.withValues(alpha: 0.04), offset: const Offset(0, 1), blurRadius: 3),
    BoxShadow(color: _l.withValues(alpha: 0.06), offset: const Offset(0, 2), blurRadius: 6, spreadRadius: -1),
  ];

  // e2 — raised / hover / the one focal card / result masthead
  static final List<BoxShadow> e2 = [
    BoxShadow(color: _l.withValues(alpha: 0.05), offset: const Offset(0, 2), blurRadius: 6),
    BoxShadow(color: _l.withValues(alpha: 0.09), offset: const Offset(0, 8), blurRadius: 20, spreadRadius: -4),
  ];

  // e3 — dialog / menu / floating CTA bar / floating nav (`0 8px 22px rgba(23,19,16,.10)`)
  static final List<BoxShadow> e3 = [
    BoxShadow(color: _l.withValues(alpha: 0.06), offset: const Offset(0, 4), blurRadius: 10),
    BoxShadow(color: _l.withValues(alpha: 0.14), offset: const Offset(0, 16), blurRadius: 40, spreadRadius: -8),
  ];

  // e4 — bottom sheet / modal
  static final List<BoxShadow> e4 = [
    BoxShadow(color: _l.withValues(alpha: 0.08), offset: const Offset(0, 8), blurRadius: 16),
    BoxShadow(color: _l.withValues(alpha: 0.20), offset: const Offset(0, 28), blurRadius: 64, spreadRadius: -12),
  ];

  // Dark: floating key shadow (sheets/dialogs only) + 1px top highlight border.
  static final List<BoxShadow> dKey = [
    BoxShadow(color: Colors.black.withValues(alpha: 0.45), offset: const Offset(0, 16), blurRadius: 48, spreadRadius: -12),
  ];
  static final Border dTopHighlight =
      Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.05), width: 1));

  /// Signature saffron glow — CTA only: `0 10px 26px rgba(201,106,40,.34)` (v3).
  static final List<BoxShadow> ctaGlowLight = [
    BoxShadow(color: AppColors.saffron500.withValues(alpha: 0.34), offset: const Offset(0, 10), blurRadius: 26),
  ];
  static final List<BoxShadow> dSaffronGlow = [
    BoxShadow(color: AppColors.saffron500.withValues(alpha: 0.40), offset: const Offset(0, 10), blurRadius: 26),
  ];

  // Back-compat aliases so existing call sites keep compiling during migration.
  static final List<BoxShadow> soft = e1;
  static final List<BoxShadow> elevated = e2;
  static final List<BoxShadow> floating = e3;

  // ---------------------------------------------------------------------------
  // V3 SINGLES — exact values from the design spec
  // ---------------------------------------------------------------------------

  /// Floating card (primary): `0 8px 20px rgba(23,19,16,.06)`
  static const BoxShadow card = BoxShadow(
    color: Color(0x0F171310),
    blurRadius: 20,
    offset: Offset(0, 8),
  );

  /// Raised / float (floating nav): `0 8px 22px rgba(23,19,16,.10)`
  static const BoxShadow float = BoxShadow(
    color: Color(0x1A171310),
    blurRadius: 22,
    offset: Offset(0, 8),
  );

  /// Screen frame: `0 22px 54px rgba(23,19,16,.16)`
  static const BoxShadow screen = BoxShadow(
    color: Color(0x29171310),
    blurRadius: 54,
    offset: Offset(0, 22),
  );

  /// Panel / dialog: `0 10px 30px rgba(23,19,16,.06)`
  static const BoxShadow panel = BoxShadow(
    color: Color(0x0F171310),
    blurRadius: 30,
    offset: Offset(0, 10),
  );

  /// Bottom sheet (rises from bottom): `0 -14px 40px rgba(23,19,16,.18)`
  static const BoxShadow sheet = BoxShadow(
    color: Color(0x2E171310),
    blurRadius: 40,
    offset: Offset(0, -14),
  );

  /// Modal sheet, dark: `0 -14px 40px rgba(0,0,0,.4)`
  static const BoxShadow dSheet = BoxShadow(
    color: Color(0x66000000),
    blurRadius: 40,
    offset: Offset(0, -14),
  );

  /// CTA button: saffron-tinted `0 10px 26px rgba(201,106,40,.34)`
  static const BoxShadow cta = BoxShadow(
    color: Color(0x57C96A28),
    blurRadius: 26,
    offset: Offset(0, 10),
  );

  /// Orb resting/listening: saffron-tinted `0 10px 26px rgba(201,106,40,.42)`
  static const BoxShadow orb = BoxShadow(
    color: Color(0x6BC96A28),
    blurRadius: 26,
    offset: Offset(0, 10),
  );

  /// Orb working: indigo `0 8px 20px rgba(42,59,143,.34)`
  static const BoxShadow orbWorking = BoxShadow(
    color: Color(0x572A3B8F),
    blurRadius: 20,
    offset: Offset(0, 8),
  );

  /// Orb ready: leaf `0 8px 20px rgba(44,95,45,.34)`
  static const BoxShadow orbReady = BoxShadow(
    color: Color(0x572C5F2D),
    blurRadius: 20,
    offset: Offset(0, 8),
  );

  /// Listen ring: `0 0 0 8px rgba(201,106,40,.14)`
  static const BoxShadow ringOrbListen = BoxShadow(
    color: Color(0x24C96A28),
    blurRadius: 0,
    spreadRadius: 8,
  );

  /// Drag ring: `0 0 0 12px rgba(201,106,40,.14)`
  static const BoxShadow ringOrbDrag = BoxShadow(
    color: Color(0x24C96A28),
    blurRadius: 0,
    spreadRadius: 12,
  );

  /// Dragging orb lifted: `0 16px 34px rgba(23,19,16,.28)`
  static const BoxShadow orbDraggingLifted = BoxShadow(
    color: Color(0x47171310),
    blurRadius: 34,
    offset: Offset(0, 16),
  );

  /// Listening orb pulse: `0 6px 18px rgba(201,106,40,.40)`
  static const BoxShadow orbListeningPulse = BoxShadow(
    color: Color(0x66C96A28),
    blurRadius: 18,
    offset: Offset(0, 6),
  );

  // ---------------------------------------------------------------------------
  // COMPOSED LISTS (used by GlassSurface / theme defaults)
  // ---------------------------------------------------------------------------

  /// Two-layer warm shadow for elevated cards (light).
  static final List<BoxShadow> cardLight = [
    card,
    BoxShadow(color: _l.withValues(alpha: 0.03), offset: const Offset(0, 1), blurRadius: 4),
  ];

  /// Key shadow + catch-light for elevated cards (dark).
  static final List<BoxShadow> cardDark = [
    ...dKey,
    BoxShadow(color: Colors.white.withValues(alpha: 0.05), offset: const Offset(0, -1), blurRadius: 0),
  ];

  /// Floating bottom nav (light) — `0 8px 22px rgba(23,19,16,.10)`.
  static const BoxShadow navFloatLight = float;

  /// Floating bottom nav (dark).
  static const BoxShadow navFloatDark = BoxShadow(
    color: Color(0x73000000),
    blurRadius: 24,
    offset: Offset(0, 8),
  );
}
