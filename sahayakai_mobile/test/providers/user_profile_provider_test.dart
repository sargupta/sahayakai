import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:sahayakai_mobile/src/features/auth/presentation/providers/auth_provider.dart';
import 'package:sahayakai_mobile/src/features/auth/presentation/providers/user_profile_provider.dart';
import 'package:sahayakai_mobile/src/features/auth/domain/user_profile_model.dart';
import 'package:sahayakai_mobile/src/core/network/api_client.dart';
import '../helpers/mocks.dart';

void main() {
  late MockUser mockUser;

  setUp(() {
    mockUser = MockUser();
    when(() => mockUser.uid).thenReturn('u-123');
    when(() => mockUser.displayName).thenReturn('Test Teacher');
    when(() => mockUser.email).thenReturn('test@example.com');
    when(() => mockUser.phoneNumber).thenReturn('+919999999999');
    when(() => mockUser.photoURL).thenReturn(null);
  });

  group('userProfileProvider', () {
    test('returns null when auth user is null', () {
      final container = ProviderContainer(
        overrides: [
          authStateProvider.overrideWith(
            (ref) => Stream.value(null),
          ),
        ],
      );
      addTearDown(container.dispose);

      // Let the stream settle.
      container.read(authStateProvider);
      final profile = container.read(userProfileProvider);

      expect(profile, isNull);
    });

    test('returns UserProfileModel when auth user exists', () async {
      final container = ProviderContainer(
        overrides: [
          authStateProvider.overrideWith(
            (ref) => Stream.value(mockUser),
          ),
        ],
      );
      addTearDown(container.dispose);

      // Wait for the stream provider to have data.
      await container.read(authStateProvider.future);

      final profile = container.read(userProfileProvider);
      expect(profile, isNotNull);
      expect(profile!.uid, 'u-123');
      expect(profile.displayName, 'Test Teacher');
      expect(profile.email, 'test@example.com');
      expect(profile.phoneNumber, '+919999999999');
      expect(profile.photoURL, isNull);
    });

    test('uses empty string when displayName is null', () async {
      when(() => mockUser.displayName).thenReturn(null);

      final container = ProviderContainer(
        overrides: [
          authStateProvider.overrideWith(
            (ref) => Stream.value(mockUser),
          ),
        ],
      );
      addTearDown(container.dispose);

      await container.read(authStateProvider.future);
      final profile = container.read(userProfileProvider);

      expect(profile, isNotNull);
      expect(profile!.displayName, '');
    });
  });

  group('fullUserProfileProvider', () {
    test('returns null when auth user is null', () async {
      final container = ProviderContainer(
        overrides: [
          authStateProvider.overrideWith(
            (ref) => Stream.value(null),
          ),
        ],
      );
      addTearDown(container.dispose);

      await container.read(authStateProvider.future);
      final profile = await container.read(fullUserProfileProvider.future);

      expect(profile, isNull);
    });

    test('returns backend profile on success', () async {
      final mocks = createMockApiClient();
      when(() => mocks.dio.get(any())).thenAnswer(
        (_) async => successResponse<Map<String, dynamic>>({
          'uid': 'u-123',
          'displayName': 'Backend Name',
          'email': 'backend@example.com',
          'planType': 'premium',
        }),
      );

      final container = ProviderContainer(
        overrides: [
          authStateProvider.overrideWith(
            (ref) => Stream.value(mockUser),
          ),
          apiClientProvider.overrideWithValue(mocks.apiClient),
        ],
      );
      addTearDown(container.dispose);

      await container.read(authStateProvider.future);
      final profile = await container.read(fullUserProfileProvider.future);

      expect(profile, isNotNull);
      expect(profile!.displayName, 'Backend Name');
      expect(profile.planType, 'premium');
    });

    test('falls back to Firebase profile on API error', () async {
      final mocks = createMockApiClient();
      when(() => mocks.dio.get(any())).thenThrow(Exception('network error'));

      final container = ProviderContainer(
        overrides: [
          authStateProvider.overrideWith(
            (ref) => Stream.value(mockUser),
          ),
          apiClientProvider.overrideWithValue(mocks.apiClient),
        ],
      );
      addTearDown(container.dispose);

      await container.read(authStateProvider.future);
      final profile = await container.read(fullUserProfileProvider.future);

      expect(profile, isNotNull);
      expect(profile!.uid, 'u-123');
      expect(profile.displayName, 'Test Teacher');
      expect(profile.planType, 'free');
    });

    test('falls back to Firebase profile on non-200 response', () async {
      final mocks = createMockApiClient();
      when(() => mocks.dio.get(any())).thenAnswer(
        (_) async => Response<Map<String, dynamic>>(
          data: null,
          statusCode: 404,
          requestOptions: RequestOptions(path: ''),
        ),
      );

      final container = ProviderContainer(
        overrides: [
          authStateProvider.overrideWith(
            (ref) => Stream.value(mockUser),
          ),
          apiClientProvider.overrideWithValue(mocks.apiClient),
        ],
      );
      addTearDown(container.dispose);

      await container.read(authStateProvider.future);
      final profile = await container.read(fullUserProfileProvider.future);

      expect(profile, isNotNull);
      expect(profile!.uid, 'u-123');
      expect(profile.displayName, 'Test Teacher');
    });
  });

  group('userPlanTypeProvider', () {
    test('defaults to free when fullUserProfileProvider has no data', () {
      final container = ProviderContainer(
        overrides: [
          fullUserProfileProvider.overrideWith(
            (ref) async => null,
          ),
        ],
      );
      addTearDown(container.dispose);

      final plan = container.read(userPlanTypeProvider);
      expect(plan, 'free');
    });

    test('returns planType from profile when available', () async {
      final container = ProviderContainer(
        overrides: [
          fullUserProfileProvider.overrideWith(
            (ref) async => const UserProfileModel(
              uid: 'u-1',
              displayName: 'Teacher',
              planType: 'premium',
            ),
          ),
        ],
      );
      addTearDown(container.dispose);

      // Wait for the future to complete.
      await container.read(fullUserProfileProvider.future);
      final plan = container.read(userPlanTypeProvider);
      expect(plan, 'premium');
    });

    test('defaults to free when profile has no planType set', () async {
      final container = ProviderContainer(
        overrides: [
          fullUserProfileProvider.overrideWith(
            (ref) async => const UserProfileModel(
              uid: 'u-1',
              displayName: 'Teacher',
              // planType defaults to 'free' in model
            ),
          ),
        ],
      );
      addTearDown(container.dispose);

      await container.read(fullUserProfileProvider.future);
      final plan = container.read(userPlanTypeProvider);
      expect(plan, 'free');
    });
  });
}
