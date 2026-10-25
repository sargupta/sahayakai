import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/theme/app_theme.dart';

/// Design system v2 parity gate.
///
/// The founder rejected design system v1 because the shipped app did not
/// match the canonical v3 mobile design: the Flutter tokens had drifted
/// (retired saffron #E0924D, slate neutrals, Outfit/Inter). This test is the
/// class gate for that bug. It reads the design system's own `tokens.json`
/// (vendored at `design/tokens.v2.json`, byte-identical to the published
/// artifact's `project/tokens.json`) and fails on ANY difference between it
/// and the Dart tokens: a changed value, a token the app forgot to port, or a
/// type style whose size, weight, line height or tracking moved.
///
/// To take a new design-system version: replace `design/tokens.v2.json`,
/// run this test, and port whatever it names.
void main() {
  final tokens =
      jsonDecode(File('design/tokens.v2.json').readAsStringSync())
          as Map<String, dynamic>;

  List<Map<String, dynamic>> family(String name) =>
      ((tokens[name] as Map<String, dynamic>)['tokens'] as List)
          .cast<Map<String, dynamic>>();

  group('colour', () {
    final raw = {
      for (final t in family('color'))
        t['name'] as String: t['value'] as String,
    };
    String resolve(String v) =>
        v.startsWith('{') ? resolve(raw[v.substring(1, v.length - 1)]!) : v;

    // Every app colour token, by its v2 name. Website-only tokens (web-*,
    // band-*, on-ink-*) have no Flutter surface and are not ported.
    final dart = <String, Color>{
      'milk-50': AppColors.milk50,
      'milk-100': AppColors.milk100,
      'milk-200': AppColors.milk200,
      'milk-300': AppColors.milk300,
      'milk-400': AppColors.milk400,
      'milk-500': AppColors.milk500,
      'ink-900': AppColors.ink900,
      'ink-800': AppColors.ink800,
      'ink-600': AppColors.ink600,
      'ink-500': AppColors.ink500,
      'ink-400': AppColors.ink400,
      'stone-500': AppColors.stone500,
      'stone-100': AppColors.stone100,
      'saffron-100': AppColors.saffron100,
      'saffron-200': AppColors.saffron200,
      'saffron-300': AppColors.saffron300,
      'saffron-400': AppColors.saffron400,
      'saffron-500': AppColors.saffron500,
      'saffron-600': AppColors.saffron600,
      'saffron-700': AppColors.saffron700,
      'saffron-750': AppColors.saffron750,
      'saffron-800': AppColors.saffron800,
      'leaf-100': AppColors.leaf100,
      'leaf-300': AppColors.leaf300,
      'leaf-500': AppColors.leaf500,
      'leaf-700': AppColors.leaf700,
      'indigo-100': AppColors.indigo100,
      'indigo-500': AppColors.indigo500,
      'red-500': AppColors.red500,
      'red-700': AppColors.red700,
      'amber-500': AppColors.amber500,
      'surface-page': AppColors.surfacePage,
      'surface-web': AppColors.surfaceWeb,
      'surface-band': AppColors.surfaceBand,
      'surface-card': AppColors.surfaceCard,
      'surface-glass': AppColors.surfaceGlass,
      'surface-glass-soft': AppColors.surfaceGlassSoft,
      'surface-glass-strong': AppColors.surfaceGlassStrong,
      'surface-glass-chip': AppColors.surfaceGlassChip,
      'surface-disc': AppColors.surfaceDisc,
      'surface-segment': AppColors.surfaceSegment,
      'surface-inset': AppColors.surfaceInset,
      'surface-chrome': AppColors.surfaceChrome,
      'surface-capsule': AppColors.surfaceCapsule,
      'surface-capsule-strong': AppColors.surfaceCapsuleStrong,
      'surface-float': AppColors.surfaceFloat,
      'border-glass': AppColors.borderGlass,
      'border-hairline': AppColors.borderHairline,
      'border-row': AppColors.borderRow,
      'border-strong': AppColors.borderStrong,
      'border-control': AppColors.borderControl,
      'fill-quiet': AppColors.fillQuiet,
      'fill-subtle': AppColors.fillSubtle,
      'dot-idle': AppColors.dotIdle,
      'ring-idle': AppColors.ringIdle,
      'fill-mark': AppColors.fillMark,
      'scrim': AppColors.scrim,
      'text-strong': AppColors.textStrong,
      'text-body': AppColors.textBody,
      'text-muted': AppColors.textMuted,
      'text-faint': AppColors.textFaint,
      'text-eyebrow': AppColors.textEyebrow,
      'text-on-accent': AppColors.textOnAccent,
      'text-link': AppColors.textLink,
      'text-link-hover': AppColors.textLinkHover,
      'accent': AppColors.accent,
      'accent-tint': AppColors.accentTint,
      'accent-tint-strong': AppColors.accentTintStrong,
      'accent-tint-border': AppColors.accentTintBorder,
      'accent-tint-soft': AppColors.accentTintSoft,
      'accent-tint-border-soft': AppColors.accentTintBorderSoft,
      'accent-wash': AppColors.accentWash,
      'accent-edge': AppColors.accentEdge,
      'accent-outline': AppColors.accentOutline,
      'success': AppColors.success,
      'success-tint': AppColors.successTint,
      'success-tint-strong': AppColors.successTintStrong,
      'leaf-wash': AppColors.leafWash,
      'leaf-tint-edge': AppColors.leafTintEdge,
      'leaf-tint': AppColors.leafTint,
      'leaf-tint-border': AppColors.leafTintBorder,
      'leaf-row': AppColors.leafRow,
      'leaf-row-border': AppColors.leafRowBorder,
      'info': AppColors.info,
      'info-tint': AppColors.infoTint,
      'info-tint-strong': AppColors.infoTintStrong,
      'info-tint-border': AppColors.infoTintBorder,
      'info-track': AppColors.infoTrack,
      'info-ring': AppColors.infoRing,
      'indigo-wash': AppColors.indigoWash,
      'warning': AppColors.warning,
      'amber-tint': AppColors.amberTint,
      'amber-wash': AppColors.amberWash,
      'amber-row': AppColors.amberRow,
      'amber-row-border': AppColors.amberRowBorder,
      'danger': AppColors.danger,
      'red-tint': AppColors.redTint,
      'red-row': AppColors.redRow,
      'red-row-border': AppColors.redRowBorder,
      'camera-ground': AppColors.cameraGround,
      'on-camera': AppColors.onCamera,
      'on-camera-muted': AppColors.onCameraMuted,
      'on-camera-icon': AppColors.onCameraIcon,
      'camera-glass': AppColors.cameraGlass,
      'camera-border': AppColors.cameraBorder,
      'camera-frame': AppColors.cameraFrame,
      'camera-guide': AppColors.cameraGuide,
      'scan-line': AppColors.scanLine,
    };
    bool appToken(String n) =>
        !n.startsWith('web-') &&
        !n.startsWith('band-') &&
        !n.startsWith('on-ink');

    test('every app colour token in tokens.json is ported to AppColors', () {
      final missing = raw.keys
          .where(appToken)
          .where((n) => !dart.containsKey(n));
      expect(
        missing,
        isEmpty,
        reason: 'tokens.json has colours AppColors lacks',
      );
    });

    for (final entry in dart.entries) {
      test(entry.key, () {
        final expected = _cssColor(resolve(raw[entry.key]!));
        _expectColor(entry.value, expected, entry.key);
      });
    }
  });

  group('radius', () {
    final dart = <String, double>{
      'radius-xs': AppRadius.xs,
      'radius-sm': AppRadius.sm,
      'radius-row': AppRadius.row,
      'radius-option': AppRadius.option,
      'radius-field': AppRadius.field,
      'radius-tile': AppRadius.tile,
      'radius-card': AppRadius.card,
      'radius-panel': AppRadius.panel,
      'radius-sheet': AppRadius.sheet,
      'radius-screen': AppRadius.screen,
      'radius-pill': AppRadius.pill,
      'radius-scan': AppRadius.scan,
    };
    for (final t in family('radius')) {
      final name = t['name'] as String;
      if (!dart.containsKey(name)) continue; // website / device frame only
      test(name, () => expect(dart[name], _px(t['value'] as String)));
    }
  });

  group('shadow', () {
    final dart = <String, List<BoxShadow>>{
      'shadow-float': AppShadows.float,
      'shadow-card': AppShadows.card,
      'shadow-panel': AppShadows.panel,
      'shadow-sheet': AppShadows.sheet,
      'shadow-hint': AppShadows.hint,
      'shadow-post': AppShadows.post,
      'shadow-prompt': AppShadows.prompt,
      'shadow-cta': AppShadows.cta,
      'shadow-cta-sm': AppShadows.ctaSm,
      'shadow-mic': AppShadows.mic,
      'shadow-current': AppShadows.current,
      'shadow-orb': AppShadows.orb,
    };
    final raw = {
      for (final t in family('shadow'))
        t['name'] as String: t['value'] as String,
    };
    for (final entry in dart.entries) {
      test(entry.key, () {
        // "0 8px 22px rgba(23,19,16,.1)" — x, y, blur, colour; one layer.
        final m = RegExp(
          r'^(-?[\d.]+)(?:px)? (-?[\d.]+)(?:px)? ([\d.]+)px (rgba\([^)]+\))$',
        ).firstMatch(raw[entry.key]!)!;
        expect(entry.value, hasLength(1));
        final s = entry.value.single;
        expect(s.offset, Offset(double.parse(m[1]!), double.parse(m[2]!)));
        expect(s.blurRadius, double.parse(m[3]!));
        expect(s.spreadRadius, 0);
        _expectColor(s.color, _cssColor(m[4]!), entry.key);
      });
    }
  });

  group('type', () {
    final groups = ((tokens['type'] as Map<String, dynamic>)['groups'] as List)
        .cast<Map<String, dynamic>>();
    final styles = <String, Map<String, dynamic>>{};
    final groupFamily = <String, String>{};
    for (final g in groups) {
      for (final s in (g['styles'] as List).cast<Map<String, dynamic>>()) {
        styles[s['name'] as String] = s;
        groupFamily[s['name'] as String] =
            (s['family'] ?? g['family']) as String;
      }
    }
    final scale = AppText.tokens(AppTheme.light().colorScheme, isIndic: false);
    String cssName(AppTypeToken t) =>
        'type-${t.name.replaceAllMapped(RegExp('[A-Z]'), (m) => '-${m[0]!.toLowerCase()}')}';

    test('every App titles / App text style is an AppTypeToken', () {
      final app = [
        for (final g in groups)
          if ((g['name'] as String).startsWith('App '))
            for (final s in (g['styles'] as List)) (s as Map)['name'],
      ];
      expect(AppTypeToken.values.map(cssName).toSet(), app.toSet());
    });

    for (final token in AppTypeToken.values) {
      final name = cssName(token);
      test(name, () {
        final css = styles[name]!;
        final style = scale[token]!;
        final size = _px(css['fontSize'] as String);
        expect(style.fontSize, size);
        expect(
          style.fontWeight,
          FontWeight.values[(css['fontWeight'] as int) ~/ 100 - 1],
        );
        expect(style.height, (css['lineHeight'] as num).toDouble());
        final em = double.parse(
          ((css['letterSpacing'] as String?) ?? '0em').replaceAll('em', ''),
        );
        expect(style.letterSpacing, closeTo(em * size, 1e-9));
        expect(
          style.fontFamily,
          groupFamily[name] == 'display' ? kDisplayFamily : kUiFamily,
        );
        expect(style.fontFamilyFallback, kIndicSansFallback);
      });
    }

    test('the families are the v2 faces with the Noto Sans fallbacks', () {
      final fams = (tokens['type'] as Map<String, dynamic>)['families'] as Map;
      List<String> split(String s) => s.split(', ');
      expect(split(fams['display'] as String), [
        kDisplayFamily,
        ...kIndicSansFallback,
      ]);
      expect(split(fams['ui'] as String), [kUiFamily, ...kIndicSansFallback]);
    });
  });
}

double _px(String v) => double.parse(v.replaceAll('px', ''));

/// A CSS `#rrggbb` or `rgba(r,g,b,a)` as a Color, alpha kept exact.
Color _cssColor(String v) {
  final hex = RegExp(r'^#([0-9a-fA-F]{6})$').firstMatch(v);
  if (hex != null) return Color(0xFF000000 | int.parse(hex[1]!, radix: 16));
  final m = RegExp(
    r'^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$',
  ).firstMatch(v);
  if (m == null) throw FormatException('not a colour', v);
  return Color.fromRGBO(
    int.parse(m[1]!),
    int.parse(m[2]!),
    int.parse(m[3]!),
    double.parse(m[4]!),
  );
}

void _expectColor(Color actual, Color expected, String name) {
  for (final (a, e, ch) in [
    (actual.r, expected.r, 'r'),
    (actual.g, expected.g, 'g'),
    (actual.b, expected.b, 'b'),
    (actual.a, expected.a, 'a'),
  ]) {
    expect(a, closeTo(e, 1e-6), reason: '$name channel $ch');
  }
}
