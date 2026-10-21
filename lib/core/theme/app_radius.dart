import 'package:flutter/widgets.dart';

/// Corner-radius scale — Design System v3 (canonical).
///
/// Semantic set from `tokens/spacing.css`:
/// `row 12`, `field 14`, `tile 16`, `card 18`, `panel 20`,
/// `sheet 26`, `screen 38`, `pill = StadiumBorder (9999)`.
///
/// Everything interactive is a full pill (chips, buttons, tab bar, composer).
/// The legacy `md`/`lg`/`xl` aliases are kept so existing call sites
/// keep compiling during the re-skin.
class AppRadius {
  AppRadius._();

  // Semantic radii (exact px from design spec)
  static const double row = 12;       // list rows, inline rows
  static const double field = 14;     // input fields, segmented track
  static const double tile = 16;      // tiles (2x2 grid), cards in grids
  static const double card = 18;      // primary cards, sheets, result masthead
  static const double panel = 20;     // hero surfaces, floating nav container
  static const double sheet = 26;     // bottom sheets (top corners)
  static const double screen = 38;    // device frame, PhoneScreen
  static const double pill = 9999;    // full pill (StadiumBorder)

  // Legacy aliases (deprecated - migrate to semantic names)
  @Deprecated('Use AppRadius.row')
  static const double sm = 8;

  @Deprecated('Use AppRadius.field')
  static const double md = 10;

  @Deprecated('Use AppRadius.tile')
  static const double lg = 12;

  @Deprecated('Use AppRadius.card')
  static const double xl = 16;

  @Deprecated('Use AppRadius.panel')
  static const double hero = 20;

  @Deprecated('Use AppRadius.sheet')
  static const double control = 12; // was button/input radius

  @Deprecated('Use AppRadius.sheet')
  static const double well = 14; // IconWell

  // Pre-built BorderRadius objects
  static const BorderRadius rRow = BorderRadius.all(Radius.circular(row));
  static const BorderRadius rField = BorderRadius.all(Radius.circular(field));
  static const BorderRadius rTile = BorderRadius.all(Radius.circular(tile));
  static const BorderRadius rCard = BorderRadius.all(Radius.circular(card));
  static const BorderRadius rPanel = BorderRadius.all(Radius.circular(panel));
  static const BorderRadius rSheet = BorderRadius.vertical(
    top: Radius.circular(sheet),
  );
  static const BorderRadius rScreen = BorderRadius.all(Radius.circular(screen));
  static const BorderRadius rPill = BorderRadius.all(Radius.circular(pill));

  // Legacy BorderRadius aliases
  @Deprecated('Use AppRadius.rRow')
  static const BorderRadius rSm = BorderRadius.all(Radius.circular(sm));

  @Deprecated('Use AppRadius.rField')
  static const BorderRadius rMd = BorderRadius.all(Radius.circular(md));

  @Deprecated('Use AppRadius.rTile')
  static const BorderRadius rLg = BorderRadius.all(Radius.circular(lg));

  @Deprecated('Use AppRadius.rCard')
  static const BorderRadius rXl = BorderRadius.all(Radius.circular(xl));

  @Deprecated('Use AppRadius.rPanel')
  static const BorderRadius rHero = BorderRadius.all(Radius.circular(hero));

  @Deprecated('Use AppRadius.rField')
  static const BorderRadius rControl = BorderRadius.all(Radius.circular(control));

  @Deprecated('Use AppRadius.rWell')
  static const BorderRadius rWell = BorderRadius.all(Radius.circular(well));

  /// Sheet radius with bottom corners matching screen (38) for full-screen sheets
  static const BorderRadius rSheetFull = BorderRadius.vertical(
    top: Radius.circular(sheet),
    bottom: Radius.circular(screen),
  );

  /// Sheet with custom top radius (for partial sheets)
  static BorderRadius sheetTop(double topRadius) => BorderRadius.vertical(
    top: Radius.circular(topRadius),
  );
}