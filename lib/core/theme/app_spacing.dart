import 'package:flutter/widgets.dart';

/// Spacing scale — Design System v3 layered on the app's legacy 4dp contract.
///
/// **Legacy `spaceN` keeps its original values** (4/8/12/16/20/24/32/40/48…)
/// — ~900 call sites across the app depend on that scale, and silently
/// retightening it would shrink card padding app-wide.
///
/// **v3 semantic names** carry the exact design values from
/// `tokens/spacing.css` and are what the redesigned screens use:
/// `--screen-pad-x: 20px`, `--screen-pad-bottom: 96px`, `--cta-height: 52px`,
/// `--tab-size: 42px`, `--composer-height: 54px`, orb park `right:16 /
/// left:18 / bottom:100 (172 over a CTA)`, gaps 14 (card rhythm) / 9 (grid).
class AppSpacing {
  AppSpacing._();

  // ---------------------------------------------------------------------------
  // LEGACY 4DP SCALE (original values — do not retune)
  // ---------------------------------------------------------------------------

  static const double space1 = 4; // icon <-> label gap
  static const double space2 = 8; // tight internal
  static const double space3 = 12; // internal card gap
  static const double space4 = 16; // default card padding, form rows
  static const double space5 = 20; // card-section (tablet)
  static const double space6 = 24; // card padding (tablet), block gap
  static const double space8 = 32; // section gap
  static const double space10 = 40; // page top/bottom (tablet)
  static const double space12 = 48; // page section break
  static const double space16 = 64;
  static const double space20 = 80;
  static const double space24 = 96;
  static const double space32 = 128;

  /// Legacy page section break (32).
  static const double sectionGap = space8;

  static const EdgeInsets pagePadding = EdgeInsets.symmetric(horizontal: space4, vertical: space6);
  static const EdgeInsets pagePaddingTablet = EdgeInsets.symmetric(horizontal: space6, vertical: space10);

  // ---------------------------------------------------------------------------
  // V3 ADDITIVE STEPS (names absent from the legacy scale)
  // ---------------------------------------------------------------------------

  static const double space7 = 14; // v3 vertical gap between cards
  static const double space9 = 20; // v3 screen gutter (also space5 — same value)
  static const double space11 = 26; // v3 section break

  // ---------------------------------------------------------------------------
  // V3 SEMANTIC CONSTANTS — exact design values (literals, independent of scale)
  // ---------------------------------------------------------------------------

  // Screen
  static const double screenWidth = 360;
  static const double screenHeight = 760;
  static const double screenGutter = 20; // horizontal page padding
  static const double verticalGap = 14; // card rhythm
  static const double gridGap = 9; // 2×2 tile grid gap
  static const double bottomPad = 96; // clears the floating tab bar
  static const double bottomPadWithCTA = 172; // clears orb + full-width CTA

  // Cards / fields / chips
  static const double cardPadding = 16;
  static const double cardGap = 12;
  static const EdgeInsets cardPaddingDefault = EdgeInsets.all(16);
  static const EdgeInsets cardPaddingTight = EdgeInsets.all(9);
  static const EdgeInsets fieldPadding = EdgeInsets.symmetric(horizontal: 16, vertical: 10);
  static const EdgeInsets chipPadding = EdgeInsets.symmetric(horizontal: 12, vertical: 8);
  static const EdgeInsets tilePadding = EdgeInsets.all(13); // 2×2 home tile

  // Components
  static const double ctaHeight = 52; // primary saffron CTA
  static const double composerHeight = 54;
  static const double tabSize = 42; // circular tab target
  static const double tabBarBottom = 18; // bar sits 18px above screen bottom
  static const double tabBarPadding = 7;
  static const double tabBarGap = 6;
  static const double statusBarHeight = 36;

  // Orb geometry (v3: the orb is 56px, colour is its state)
  static const double orbSize = 56;
  static const double orbDraggingSize = 64;
  static const double orbListeningSize = 46;
  static const double orbParkBottom = 100; // default perch (sphere bottom edge)
  static const double orbParkBottomCTA = 172; // perch over a full-width CTA
  static const double orbParkRight = 16; // right-handed teacher
  static const double orbParkLeft = 18; // left-handed teacher

  // Sheets
  static const EdgeInsets sheetPadding = EdgeInsets.fromLTRB(18, 14, 18, 20);
}
