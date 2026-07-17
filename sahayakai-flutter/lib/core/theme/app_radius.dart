import 'package:flutter/widgets.dart';

/// Corner radius scale. Buttons/inputs = 10 (md); cards/sheets = 12 (lg).
/// Two distinct radii on purpose — see THEME_SPEC.md §3.
class AppRadius {
  AppRadius._();

  static const double sm = 8; // chips, tight tags
  static const double md = 10; // buttons, inputs, small menus
  static const double lg = 12; // cards, sheets, dialogs (= web --radius)
  static const double xl = 16; // large media tiles
  static const double hero = 20; // hero surfaces only

  static const BorderRadius rSm = BorderRadius.all(Radius.circular(sm));
  static const BorderRadius rMd = BorderRadius.all(Radius.circular(md));
  static const BorderRadius rLg = BorderRadius.all(Radius.circular(lg));
  static const BorderRadius rXl = BorderRadius.all(Radius.circular(xl));
  static const BorderRadius rHero = BorderRadius.all(Radius.circular(hero));
}
