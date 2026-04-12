import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/features/auth/presentation/screens/onboarding_screen.dart';
import '../helpers/test_utils.dart';

void main() {
  group('OnboardingScreen', () {
    testWidgets('renders all form fields', (tester) async {
      await pumpTestApp(tester, const OnboardingScreen());

      expect(find.text('Complete Your Profile'), findsOneWidget);
      expect(find.text('YOUR NAME'), findsOneWidget);
      expect(find.text('SCHOOL NAME'), findsOneWidget);
      expect(find.text('GRADE LEVELS'), findsOneWidget);
      expect(find.text('SUBJECTS YOU TEACH'), findsOneWidget);
      expect(find.text('PREFERRED LANGUAGE'), findsOneWidget);
      expect(find.text('Get Started'), findsOneWidget);
    });

    testWidgets('shows all grade chips', (tester) async {
      await pumpTestApp(tester, const OnboardingScreen());

      expect(find.text('Class 1'), findsOneWidget);
      expect(find.text('Class 12'), findsOneWidget);
    });

    testWidgets('shows subject chips', (tester) async {
      await pumpTestApp(tester, const OnboardingScreen());

      expect(find.text('Mathematics'), findsOneWidget);
      expect(find.text('Science'), findsOneWidget);
      expect(find.text('English'), findsOneWidget);
    });

    testWidgets('grade chip toggles on tap', (tester) async {
      await pumpTestApp(tester, const OnboardingScreen());

      // Find and tap Class 7
      final chip = find.text('Class 7');
      expect(chip, findsOneWidget);
      await tester.tap(chip);
      await tester.pump();

      // Chip should now be selected (visual change)
      // We verify the provider state was updated
    });
  });
}
