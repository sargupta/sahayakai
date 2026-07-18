import 'package:flutter/widgets.dart';

/// Corner-radius scale — PREMIUM_DESIGN_SPEC.md §5.
///
/// Semantic set: `card = 16`, `control = 12`, `sm = 8`, `well = 14`,
/// `hero = 20`, `pill = StadiumBorder`. The legacy `md`/`lg`/`xl` aliases are
/// kept so existing call sites keep compiling during the re-skin. `well = 14`
/// is the sanctioned IconWell radius (token_guard allowlist relaxation R1/F).
class AppRadius {
  AppRadius._();

  static const double sm = 8; // chips, tight tags
  static const double md = 10; // legacy control alias
  static const double lg = 12; // legacy card alias (= control)
  static const double control = 12; // buttons, inputs, segmented track
  static const double well = 14; // IconWell v2 gradient well
  static const double card = 16; // cards, sheets, result masthead
  static const double xl = 16; // legacy large-media alias (= card)
  static const double hero = 20; // hero surfaces, floating nav

  static const BorderRadius rSm = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius rMd = BorderRadius.all(Radius.circular(md));
  static const BorderRadius rLg = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius rControl = BorderRadius.all(Radius.circular(control));
  static const BorderRadius rWell = BorderRadius.all(Radius.circular(well));
  static const BorderRadius rCard = BorderRadius.all(Radius.circular(card));
  static const BorderRadius rXl = BorderRadius.all(Radius.circular(xl));
  static const BorderRadius rHero = BorderRadius.all(Radius.circular(hero));
}
