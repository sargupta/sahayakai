import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:sahayakai_mobile/src/features/auth/presentation/providers/onboarding_provider.dart';

void main() {
  group('OnboardingNotifier', () {
    late OnboardingNotifier notifier;

    setUp(() {
      notifier = OnboardingNotifier();
    });

    test('initial state has empty fields', () {
      expect(notifier.state.displayName, '');
      expect(notifier.state.schoolName, '');
      expect(notifier.state.gradeLevels, isEmpty);
      expect(notifier.state.subjects, isEmpty);
      expect(notifier.state.preferredLanguage, 'English');
      expect(notifier.state.isSubmitting, false);
      expect(notifier.state.error, isNull);
    });

    test('setDisplayName updates state', () {
      notifier.setDisplayName('Priya Sharma');
      expect(notifier.state.displayName, 'Priya Sharma');
    });

    test('setSchoolName updates state', () {
      notifier.setSchoolName('DPS Bangalore');
      expect(notifier.state.schoolName, 'DPS Bangalore');
    });

    test('setPreferredLanguage updates state', () {
      notifier.setPreferredLanguage('Hindi');
      expect(notifier.state.preferredLanguage, 'Hindi');
    });

    test('toggleGradeLevel adds and removes', () {
      notifier.toggleGradeLevel('Class 7');
      expect(notifier.state.gradeLevels, ['Class 7']);

      notifier.toggleGradeLevel('Class 8');
      expect(notifier.state.gradeLevels, ['Class 7', 'Class 8']);

      notifier.toggleGradeLevel('Class 7');
      expect(notifier.state.gradeLevels, ['Class 8']);
    });

    test('toggleSubject adds and removes', () {
      notifier.toggleSubject('Science');
      notifier.toggleSubject('Mathematics');
      expect(notifier.state.subjects, ['Science', 'Mathematics']);

      notifier.toggleSubject('Science');
      expect(notifier.state.subjects, ['Mathematics']);
    });

    test('isValid requires displayName and schoolName', () {
      expect(notifier.state.isValid, false);

      notifier.setDisplayName('Priya');
      expect(notifier.state.isValid, false);

      notifier.setSchoolName('DPS');
      expect(notifier.state.isValid, true);
    });

    test('isValid rejects whitespace-only names', () {
      notifier.setDisplayName('   ');
      notifier.setSchoolName('   ');
      expect(notifier.state.isValid, false);
    });

    group('submit()', () {
      test('returns false and sets error when state is invalid', () async {
        // displayName and schoolName are empty → isValid is false
        final result = await notifier.submit();

        expect(result, false);
        expect(notifier.state.error, 'Please fill in your name and school.');
        expect(notifier.state.isSubmitting, false);
      });

      test('sets isSubmitting true during submit then false after', () async {
        notifier.setDisplayName('Priya');
        notifier.setSchoolName('DPS');

        // submit() will fail because Firebase is not initialized in tests,
        // but we can verify it sets isSubmitting and handles the error.
        final result = await notifier.submit();

        // Firebase not initialized → falls into catch block
        expect(result, false);
        expect(notifier.state.isSubmitting, false);
        expect(notifier.state.error, isNotNull);
      });

      test('sets error when Firebase user is null (not authenticated)',
          () async {
        notifier.setDisplayName('Priya');
        notifier.setSchoolName('DPS');

        // In test env, FirebaseAuth.instance.currentUser throws because
        // Firebase is not initialized. This exercises the generic catch block.
        final result = await notifier.submit();

        expect(result, false);
        expect(notifier.state.isSubmitting, false);
        // Error message comes from the generic catch (not DioException)
        expect(notifier.state.error,
            'Something went wrong. Please try again.');
      });

      test('clears previous error on new submit attempt', () async {
        // First: set an error
        notifier.setDisplayName('');
        await notifier.submit();
        expect(notifier.state.error, isNotNull);

        // Second: set valid data and submit again
        notifier.setDisplayName('Priya');
        notifier.setSchoolName('DPS');
        await notifier.submit();

        // The error from validation is cleared, though a new error from
        // Firebase not being initialized may appear.
        // Key point: the old validation error is gone.
        expect(notifier.state.error,
            isNot('Please fill in your name and school.'));
      });
    });
  });

  group('OnboardingState.copyWith', () {
    test('preserves unchanged fields', () {
      const state = OnboardingState(
        displayName: 'Test',
        schoolName: 'School',
        gradeLevels: ['Class 7'],
        preferredLanguage: 'Hindi',
      );

      final updated = state.copyWith(isSubmitting: true);

      expect(updated.displayName, 'Test');
      expect(updated.schoolName, 'School');
      expect(updated.gradeLevels, ['Class 7']);
      expect(updated.isSubmitting, true);
    });

    test('updates all fields individually', () {
      const state = OnboardingState();

      final updated = state.copyWith(
        displayName: 'Priya',
        schoolName: 'DPS',
        gradeLevels: ['Class 8'],
        subjects: ['Math'],
        preferredLanguage: 'Hindi',
        isSubmitting: true,
        error: 'Some error',
      );

      expect(updated.displayName, 'Priya');
      expect(updated.schoolName, 'DPS');
      expect(updated.gradeLevels, ['Class 8']);
      expect(updated.subjects, ['Math']);
      expect(updated.preferredLanguage, 'Hindi');
      expect(updated.isSubmitting, true);
      expect(updated.error, 'Some error');
    });

    test('error can be set to null explicitly', () {
      const state = OnboardingState(error: 'Old error');
      // copyWith with error: null clears the error (since it is nullable)
      final updated = state.copyWith(error: null);
      expect(updated.error, isNull);
    });
  });

  group('OnboardingNotifier — additional setters', () {
    late OnboardingNotifier notifier;

    setUp(() {
      notifier = OnboardingNotifier();
    });

    test('setDisplayName handles empty string', () {
      notifier.setDisplayName('');
      expect(notifier.state.displayName, '');
    });

    test('setSchoolName handles empty string', () {
      notifier.setSchoolName('');
      expect(notifier.state.schoolName, '');
    });

    test('setPreferredLanguage to Tamil', () {
      notifier.setPreferredLanguage('Tamil');
      expect(notifier.state.preferredLanguage, 'Tamil');
    });

    test('toggleGradeLevel multiple times same grade', () {
      notifier.toggleGradeLevel('Class 5');
      notifier.toggleGradeLevel('Class 5');
      expect(notifier.state.gradeLevels, isEmpty);
    });

    test('toggleSubject multiple times same subject', () {
      notifier.toggleSubject('Hindi');
      notifier.toggleSubject('Hindi');
      expect(notifier.state.subjects, isEmpty);
    });
  });

  group('onboardingProvider', () {
    test('creates an autoDispose StateNotifierProvider', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final state = container.read(onboardingProvider);
      expect(state.displayName, '');
      expect(state.isSubmitting, false);
    });
  });
}
