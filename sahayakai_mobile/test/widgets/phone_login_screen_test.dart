import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/auth/data/auth_repository.dart';
import 'package:sahayakai_mobile/src/features/auth/presentation/providers/auth_provider.dart';
import 'package:sahayakai_mobile/src/features/auth/presentation/screens/phone_login_screen.dart';
import '../helpers/test_utils.dart';

class MockAuthRepository extends Mock implements AuthRepository {}

void main() {
  late MockAuthRepository mockAuthRepo;

  setUp(() {
    mockAuthRepo = MockAuthRepository();
  });

  group('PhoneLoginScreen', () {
    testWidgets('renders phone input and buttons', (tester) async {
      await pumpTestApp(
        tester,
        const PhoneLoginScreen(),
        overrides: [
          authRepositoryProvider.overrideWithValue(mockAuthRepo),
        ],
      );

      expect(find.text('SahayakAI'), findsOneWidget);
      expect(find.text('+91'), findsOneWidget);
      expect(find.text('Send OTP'), findsOneWidget);
      expect(find.text('Sign in with Google'), findsOneWidget);
      expect(find.text('OR'), findsOneWidget);
    });

    testWidgets('shows validation error for short number', (tester) async {
      await pumpTestApp(
        tester,
        const PhoneLoginScreen(),
        overrides: [
          authRepositoryProvider.overrideWithValue(mockAuthRepo),
        ],
      );

      // Enter 5-digit number (too short)
      await tester.enterText(
        find.byType(TextFormField),
        '12345',
      );

      // Tap Send OTP
      await tester.tap(find.text('Send OTP'));
      await tester.pumpAndSettle();

      expect(find.text('Please enter a valid 10-digit number'), findsOneWidget);
    });

    testWidgets('accepts valid 10-digit number', (tester) async {
      await pumpTestApp(
        tester,
        const PhoneLoginScreen(),
        overrides: [
          authRepositoryProvider.overrideWithValue(mockAuthRepo),
        ],
      );

      await tester.enterText(
        find.byType(TextFormField),
        '9876543210',
      );

      // Validation should pass (no error shown before submit)
      await tester.pump();
      expect(find.text('Please enter a valid 10-digit number'), findsNothing);
    });
  });
}
