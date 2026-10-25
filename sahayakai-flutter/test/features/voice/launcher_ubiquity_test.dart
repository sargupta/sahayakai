import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// One VIDYA entry per screen (design system v2 Orb: "one orb per screen").
///
/// VIDYA is reached from the floating orb ([VidyaOverlay], mounted once above
/// the Navigator, so it is on every pushed route) and, on Home, from the hero
/// orb. Pre-v2 screens also carried an app-bar launcher, which put two VIDYA
/// entries on one screen. This gate fails if any file other than the overlay
/// and the VIDYA feature itself opens the VIDYA sheet: a second launcher on any
/// screen would have to call it.
void main() {
  test('only the VIDYA overlay opens the VIDYA sheet', () {
    const allowed = {
      'lib/features/vidya/presentation/vidya_sheet.dart',
      'lib/features/vidya/presentation/vidya_overlay.dart',
    };
    final offenders = <String>[];
    for (final f in Directory('lib').listSync(recursive: true)) {
      if (f is! File || !f.path.endsWith('.dart')) continue;
      final path = f.path.replaceAll(r'\', '/');
      if (allowed.contains(path)) continue;
      final lines = f.readAsLinesSync();
      for (var i = 0; i < lines.length; i++) {
        final line = lines[i].trimLeft();
        if (line.startsWith('//')) continue;
        if (line.contains('showVidyaSheet(') ||
            line.contains('VidyaAppBarAction')) {
          offenders.add('$path:${i + 1}: ${lines[i].trim()}');
        }
      }
    }
    expect(
      offenders,
      isEmpty,
      reason:
          'a second VIDYA entry point; the floating orb is the one launcher',
    );
  });
}
