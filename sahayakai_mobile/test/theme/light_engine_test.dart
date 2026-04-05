import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/theme/physics/light_engine.dart';

void main() {
  group('TimePhase enum', () {
    test('has 5 phases', () {
      expect(TimePhase.values.length, 5);
    });
  });

  group('LightConfig.fromTime', () {
    test('6 AM returns morning phase', () {
      final config = LightConfig.fromTime(DateTime(2026, 1, 1, 6, 0));
      expect(config.phase, TimePhase.morning);
      expect(config.shadowLengthMultiplier, 1.5);
      expect(config.globalLightSource, const Offset(-1.0, -0.5));
    });

    test('10 AM returns morning phase (boundary)', () {
      final config = LightConfig.fromTime(DateTime(2026, 1, 1, 10, 59));
      expect(config.phase, TimePhase.morning);
    });

    test('11 AM returns noon phase', () {
      final config = LightConfig.fromTime(DateTime(2026, 1, 1, 11, 0));
      expect(config.phase, TimePhase.noon);
      expect(config.shadowLengthMultiplier, 0.8);
      expect(config.globalLightSource, const Offset(0.0, -1.0));
    });

    test('2 PM returns noon phase', () {
      final config = LightConfig.fromTime(DateTime(2026, 1, 1, 14, 0));
      expect(config.phase, TimePhase.noon);
    });

    test('3 PM returns afternoon phase', () {
      final config = LightConfig.fromTime(DateTime(2026, 1, 1, 15, 0));
      expect(config.phase, TimePhase.afternoon);
      expect(config.shadowLengthMultiplier, 1.8);
      expect(config.globalLightSource, const Offset(1.0, -0.5));
    });

    test('5 PM returns afternoon phase', () {
      final config = LightConfig.fromTime(DateTime(2026, 1, 1, 17, 30));
      expect(config.phase, TimePhase.afternoon);
    });

    test('6 PM returns evening phase', () {
      final config = LightConfig.fromTime(DateTime(2026, 1, 1, 18, 0));
      expect(config.phase, TimePhase.evening);
      expect(config.shadowLengthMultiplier, 2.0);
      expect(config.globalLightSource, const Offset(1.0, 0.0));
    });

    test('8 PM returns evening phase', () {
      final config = LightConfig.fromTime(DateTime(2026, 1, 1, 20, 0));
      expect(config.phase, TimePhase.evening);
    });

    test('9 PM returns night phase', () {
      final config = LightConfig.fromTime(DateTime(2026, 1, 1, 21, 0));
      expect(config.phase, TimePhase.night);
      expect(config.shadowLengthMultiplier, 0.0);
      expect(config.globalLightSource, const Offset(0.0, 0.0));
    });

    test('midnight returns night phase', () {
      final config = LightConfig.fromTime(DateTime(2026, 1, 1, 0, 0));
      expect(config.phase, TimePhase.night);
    });

    test('5 AM returns night phase (before 6 AM)', () {
      final config = LightConfig.fromTime(DateTime(2026, 1, 1, 5, 59));
      expect(config.phase, TimePhase.night);
    });

    test('each phase has non-null shadow and ambient colors', () {
      final times = [
        DateTime(2026, 1, 1, 7),   // morning
        DateTime(2026, 1, 1, 12),  // noon
        DateTime(2026, 1, 1, 16),  // afternoon
        DateTime(2026, 1, 1, 19),  // evening
        DateTime(2026, 1, 1, 23),  // night
      ];
      for (final time in times) {
        final config = LightConfig.fromTime(time);
        expect(config.castShadowColor, isNotNull);
        expect(config.ambientLightColor, isNotNull);
        expect(config.shadowOffset, isNotNull);
      }
    });
  });

  group('LightConfig construction', () {
    test('stores all fields correctly', () {
      const config = LightConfig(
        phase: TimePhase.morning,
        globalLightSource: Offset(1, 1),
        shadowLengthMultiplier: 2.0,
        castShadowColor: Colors.black,
        ambientLightColor: Colors.white,
        shadowOffset: Offset(3, 3),
      );
      expect(config.phase, TimePhase.morning);
      expect(config.globalLightSource, const Offset(1, 1));
      expect(config.shadowLengthMultiplier, 2.0);
      expect(config.castShadowColor, Colors.black);
      expect(config.ambientLightColor, Colors.white);
      expect(config.shadowOffset, const Offset(3, 3));
    });
  });
}
