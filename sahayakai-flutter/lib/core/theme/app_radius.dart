import 'package:flutter/widgets.dart';

/// Corner radii — design system v2 (`radius-*` in `tokens.json`).
///
/// Everything the teacher presses is a pill ([pill]: buttons, chips, tabs,
/// the orb). Containers step up as they grow: row 12 → field 14 → tile 16 →
/// card 18 → panel 20 → sheet 26 → screen 38.
///
/// The pre-v2 names (`md`, `lg`, `control`, `well`, `xl`, `hero`) stay as
/// aliases of the v2 step they were closest to, so call sites keep compiling.
/// `scripts/token_guard.sh` allows only these values in `.circular(N)`.
class AppRadius {
  AppRadius._();

  // ---- v2 scale ----
  static const double xs = 6; // radius-xs
  static const double sm = 8; // radius-sm: letter marks, tight tags
  static const double option = 10; // radius-option
  static const double row = 12; // radius-row: list rows
  static const double field = 14; // radius-field: inset context, deliver options
  static const double tile = 16; // radius-tile: content sections, md fields
  static const double card = 18; // radius-card: cards, lg fields, tiles
  static const double panel = 20; // radius-panel: the one primary card
  static const double sheet = 26; // radius-sheet: sheets
  static const double screen = 38; // radius-screen: the device
  static const double scan = 22; // radius-scan: the scanner frame
  static const double pill = 9999; // radius-pill: everything pressable

  // ---- pre-v2 aliases ----
  static const double md = option;
  static const double lg = row;
  static const double control = row;
  static const double well = field;
  static const double xl = tile;
  static const double hero = panel;

  static const BorderRadius rXs = BorderRadius.all(Radius.circular(xs));
  static const BorderRadius rSm = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius rOption = BorderRadius.all(Radius.circular(option));
  static const BorderRadius rRow = BorderRadius.all(Radius.circular(row));
  static const BorderRadius rField = BorderRadius.all(Radius.circular(field));
  static const BorderRadius rTile = BorderRadius.all(Radius.circular(tile));
  static const BorderRadius rCard = BorderRadius.all(Radius.circular(card));
  static const BorderRadius rPanel = BorderRadius.all(Radius.circular(panel));
  static const BorderRadius rSheet = BorderRadius.all(Radius.circular(sheet));
  static const BorderRadius rPill = BorderRadius.all(Radius.circular(pill));

  static const BorderRadius rMd = rOption;
  static const BorderRadius rLg = rRow;
  static const BorderRadius rControl = rRow;
  static const BorderRadius rWell = rField;
  static const BorderRadius rXl = rTile;
  static const BorderRadius rHero = rPanel;
}
