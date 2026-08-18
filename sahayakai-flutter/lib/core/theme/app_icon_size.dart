/// The ONLY sanctioned icon sizes (DESIGN_RUBRIC §13).
///
/// The rubric asks for "a single default stroke width and size token … in
/// app_theme. One family, one weight, everywhere." Before this existed the app
/// had drifted to seven sizes (18, 20, 28, 16, 24, 14, 32) and rendered the SAME
/// `checkCircle` confirmation glyph at 16, 18 and 24 on different screens.
class AppIconSize {
  AppIconSize._();

  /// Paired with text on the same line: chevrons, meta rows, button glyphs.
  static const double inline = 20;

  /// Carries its own line or leads a state block: empty/error/offline glyphs.
  static const double standalone = 24;

  /// The glyph inside an [IconWell] — NOT the well itself, which is [wellBox].
  static const double well = inline;

  /// The well's own box (the web's `tool-icon-wrap`).
  static const double wellBox = 48;
}
