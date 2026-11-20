import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Grounds and glows — design system v2 (`gradient` family in `tokens.json`).
///
/// App screens sit on [washScreen] with one [glowSaffron] off the top-right
/// corner (`ScreenWash` paints both under every page route). While VIDYA
/// works the ground turns [washWorking]; during a live call, [washCall].
///
/// The washes are CSS `linear-gradient(168deg, …)`: [CssAngle] reproduces
/// the CSS gradient line (its angle AND its length, which depends on the
/// box) instead of approximating it with fixed alignments.
///
/// BANNED (v2): purple or blue-violet gradients, gradient text, rainbow
/// categories. This file is exempt from token_guard.
class AppGradients {
  AppGradients._();

  static const _wash = CssAngle(168);

  /// `wash-screen`: peach, blush, sage, cream.
  static const washScreen = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    transform: _wash,
    colors: [Color(0xFFFFF3E4), Color(0xFFFDEFEE), Color(0xFFEFF4EE), Color(0xFFFFF7EC)],
    stops: [0, 0.36, 0.72, 1],
  );

  /// `wash-working`: the faint indigo ground while VIDYA writes.
  static const washWorking = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    transform: _wash,
    colors: [Color(0xFFF1F3FB), Color(0xFFEDEFF8), Color(0xFFF5F2EC), Color(0xFFFBF7F1)],
    stops: [0, 0.34, 0.70, 1],
  );

  /// `wash-call`: the faint leaf ground during a live call.
  static const washCall = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    transform: _wash,
    colors: [Color(0xFFF1F6F1), Color(0xFFEAF2EA), Color(0xFFF3F6F0), Color(0xFFF8FAF6)],
    stops: [0, 0.40, 0.74, 1],
  );

  /// `glow-saffron`: `radial-gradient(circle at 38% 32%, rgba(255,214,170,.78),
  /// rgba(201,106,40,0) 76%)` on a 214px disc (see [glowSize]).
  ///
  /// CSS interpolates in premultiplied space, so fading to a transparent stop
  /// keeps the peach hue and only drops alpha; Flutter interpolates
  /// unpremultiplied, so the end stop is written as transparent peach to land
  /// on the same pixels. The radius is the CSS `farthest-corner` distance from
  /// the centre (196.9px) over the disc's 214px side.
  static const glowSaffron = RadialGradient(
    center: Alignment(-0.24, -0.36),
    radius: 0.92,
    colors: [Color(0xC7FFD6AA), Color(0x00FFD6AA)],
    stops: [0, 0.76],
  );

  /// The glow disc's box and its offset from the screen's top-right corner
  /// (`.sk-phone__glow`: 214px, top -46, right -54).
  static const double glowSize = 214;
  static const Offset glowOffset = Offset(-54, -46);

  /// Pre-v2 name for the light ground, now the v2 screen wash.
  static const lightPaper = washScreen;

  /// Pre-v2 hero corner wash. The v2 ground already carries the saffron glow,
  /// so this is transparent rather than a second glow.
  static const lightHeroWash = RadialGradient(
    colors: [Color(0x00C96A28), Color(0x00C96A28)],
  );
}

/// A CSS `linear-gradient(<angle>deg, …)` gradient line for a Flutter
/// [LinearGradient] declared `topCenter → bottomCenter`.
///
/// CSS measures the angle clockwise from "to top" and sizes the gradient line
/// so the corners land exactly on the first and last stops:
/// `length = |W·sin a| + |H·cos a|`. This rotates the vertical line by
/// `a − 180°` about the box centre and stretches it to that length.
class CssAngle extends GradientTransform {
  const CssAngle(this.degrees);

  final double degrees;

  @override
  Matrix4 transform(Rect bounds, {TextDirection? textDirection}) {
    final a = degrees * math.pi / 180;
    final length =
        (bounds.width * math.sin(a)).abs() + (bounds.height * math.cos(a)).abs();
    final scale = bounds.height == 0 ? 1.0 : length / bounds.height;
    final c = bounds.center;
    return Matrix4.translationValues(c.dx, c.dy, 0)
      ..rotateZ(a - math.pi)
      ..scaleByDouble(1, scale, 1, 1)
      ..translateByDouble(-c.dx, -c.dy, 0, 1);
  }
}
