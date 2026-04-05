import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/theme/culture/festival_config.dart';

void main() {
  group('FestivalConfig.fromDate', () {
    test('returns Diwali config during Nov 5-10', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 11, 8));
      expect(config.type, FestivalType.diwali);
      expect(config.greeting, 'Subh Deepawali');
      expect(config.overlayColor, const Color(0x1AFFD700));
    });

    test('returns Diwali for boundary Nov 5', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 11, 5));
      expect(config.type, FestivalType.diwali);
    });

    test('returns Diwali for boundary Nov 10', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 11, 10));
      expect(config.type, FestivalType.diwali);
    });

    test('returns Holi config during Mar 2-6', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 3, 4));
      expect(config.type, FestivalType.holi);
      expect(config.greeting, 'Happy Holi');
      expect(config.overlayColor, const Color(0x1AE91E63));
    });

    test('returns Independence Day config on Aug 15', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 8, 15));
      expect(config.type, FestivalType.independenceDay);
      expect(config.greeting, 'Jai Hind');
      expect(config.overlayColor, const Color(0x1AFF9933));
    });

    test('does not return Independence Day on Aug 14 or Aug 16', () {
      expect(FestivalConfig.fromDate(DateTime(2026, 8, 14)).type, FestivalType.none);
      expect(FestivalConfig.fromDate(DateTime(2026, 8, 16)).type, FestivalType.none);
    });

    test('returns Eid config during Mar 19-21', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 3, 20));
      expect(config.type, FestivalType.eid);
      expect(config.greeting, 'Eid Mubarak');
      expect(config.overlayColor, const Color(0x1A00695C));
    });

    test('returns Pongal/Sankranti config during Jan 14-16', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 1, 15));
      // Reuses diwali type per source comment
      expect(config.type, FestivalType.diwali);
      expect(config.greeting, 'Happy Pongal / Sankranti');
      expect(config.overlayColor, const Color(0x33FFC107));
    });

    test('returns none for a non-festival date', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 6, 15));
      expect(config.type, FestivalType.none);
      expect(config.greeting, '');
      expect(config.overlayColor, isNull);
    });

    test('returns none for Dec 25 (no Christmas in config)', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 12, 25));
      expect(config.type, FestivalType.none);
    });

    // Boundary tests for remaining date ranges
    test('returns Holi for boundary Mar 2', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 3, 2));
      expect(config.type, FestivalType.holi);
    });

    test('returns Holi for boundary Mar 6', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 3, 6));
      expect(config.type, FestivalType.holi);
    });

    test('returns none for Mar 1 (before Holi)', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 3, 1));
      expect(config.type, FestivalType.none);
    });

    test('returns Eid for boundary Mar 19', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 3, 19));
      expect(config.type, FestivalType.eid);
    });

    test('returns Eid for boundary Mar 21', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 3, 21));
      expect(config.type, FestivalType.eid);
    });

    test('returns Pongal for boundary Jan 14', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 1, 14));
      expect(config.type, FestivalType.diwali); // reuses diwali type
      expect(config.greeting, 'Happy Pongal / Sankranti');
    });

    test('returns Pongal for boundary Jan 16', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 1, 16));
      expect(config.greeting, 'Happy Pongal / Sankranti');
    });

    test('returns none for Jan 13 (before Pongal)', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 1, 13));
      expect(config.type, FestivalType.none);
    });

    test('returns none for Nov 4 (before Diwali)', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 11, 4));
      expect(config.type, FestivalType.none);
    });

    test('returns none for Nov 11 (after Diwali)', () {
      final config = FestivalConfig.fromDate(DateTime(2026, 11, 11));
      expect(config.type, FestivalType.none);
    });
  });

  group('FestivalType enum', () {
    test('has 5 values including none', () {
      expect(FestivalType.values.length, 5);
      expect(FestivalType.values, contains(FestivalType.none));
    });
  });

  group('FestivalConfig construction', () {
    test('can be constructed with all fields', () {
      const config = FestivalConfig(
        type: FestivalType.holi,
        overlayColor: Color(0xFF000000),
        greeting: 'Test',
      );
      expect(config.type, FestivalType.holi);
      expect(config.overlayColor, const Color(0xFF000000));
      expect(config.greeting, 'Test');
    });

    test('overlayColor is optional', () {
      const config = FestivalConfig(
        type: FestivalType.none,
        greeting: '',
      );
      expect(config.overlayColor, isNull);
    });
  });
}
