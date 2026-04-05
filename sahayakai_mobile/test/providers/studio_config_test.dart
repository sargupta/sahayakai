import 'package:flutter/animation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/core/theme/studio_theme_resolver.dart';
import 'package:sahayakai_mobile/src/core/theme/providers/studio_config_provider.dart';

void main() {
  late ProviderContainer container;

  setUp(() {
    container = ProviderContainer();
  });

  tearDown(() => container.dispose());

  group('studioConfigProvider', () {
    test('wizard profile has easeOutCubic pageCurve', () {
      final profile = container.read(studioConfigProvider(StudioType.wizard));

      expect(profile.pageCurve, Curves.easeOutCubic);
      expect(profile.transition, const Duration(milliseconds: 450));
      expect(profile.thinkingCurve, Curves.easeInOut);
      expect(profile.focusScale, 1.05);
      expect(profile.bloomIntensity, 0.6);
    });

    test('director profile has easeInOutCubicEmphasized pageCurve', () {
      final profile = container.read(studioConfigProvider(StudioType.director));

      expect(profile.pageCurve, Curves.easeInOutCubicEmphasized);
      expect(profile.transition, const Duration(milliseconds: 700));
      expect(profile.thinkingCurve, Curves.linearToEaseOut);
      expect(profile.focusScale, 1.02);
      expect(profile.bloomIntensity, 0.3);
    });

    test('default/standard profile has easeInOut pageCurve', () {
      final profile = container.read(studioConfigProvider(StudioType.standard));

      expect(profile.pageCurve, Curves.easeInOut);
      expect(profile.transition, const Duration(milliseconds: 400));
      expect(profile.thinkingCurve, Curves.easeInOut);
      expect(profile.focusScale, 1.0);
      expect(profile.bloomIntensity, 0.0);
    });

    test('gameMaster falls through to default profile', () {
      final profile =
          container.read(studioConfigProvider(StudioType.gameMaster));

      expect(profile.pageCurve, Curves.easeInOut);
      expect(profile.transition, const Duration(milliseconds: 400));
      expect(profile.focusScale, 1.0);
      expect(profile.bloomIntensity, 0.0);
    });

    test('artStudio falls through to default profile', () {
      final profile =
          container.read(studioConfigProvider(StudioType.artStudio));

      expect(profile.pageCurve, Curves.easeInOut);
      expect(profile.bloomIntensity, 0.0);
    });

    test('notebook falls through to default profile', () {
      final profile =
          container.read(studioConfigProvider(StudioType.notebook));

      expect(profile.pageCurve, Curves.easeInOut);
    });

    test('grid falls through to default profile', () {
      final profile = container.read(studioConfigProvider(StudioType.grid));

      expect(profile.pageCurve, Curves.easeInOut);
    });

    test('professional falls through to default profile', () {
      final profile =
          container.read(studioConfigProvider(StudioType.professional));

      expect(profile.pageCurve, Curves.easeInOut);
    });

    test('academy falls through to default profile', () {
      final profile =
          container.read(studioConfigProvider(StudioType.academy));

      expect(profile.pageCurve, Curves.easeInOut);
    });

    test('community falls through to default profile', () {
      final profile =
          container.read(studioConfigProvider(StudioType.community));

      expect(profile.pageCurve, Curves.easeInOut);
    });

    test('different studios return different instances', () {
      final wizard = container.read(studioConfigProvider(StudioType.wizard));
      final director =
          container.read(studioConfigProvider(StudioType.director));

      expect(wizard.focusScale, isNot(director.focusScale));
      expect(wizard.bloomIntensity, isNot(director.bloomIntensity));
      expect(wizard.transition, isNot(director.transition));
    });
  });

  group('aiProcessingProvider', () {
    test('defaults to false', () {
      expect(container.read(aiProcessingProvider), false);
    });

    test('can be toggled', () {
      container.read(aiProcessingProvider.notifier).state = true;
      expect(container.read(aiProcessingProvider), true);

      container.read(aiProcessingProvider.notifier).state = false;
      expect(container.read(aiProcessingProvider), false);
    });
  });
}
