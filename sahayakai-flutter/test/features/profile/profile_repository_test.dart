import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/profile/data/plan_claim_provider.dart';
import 'package:sahayakai/features/profile/data/profile_doc_source.dart';
import 'package:sahayakai/features/profile/data/profile_repository.dart';
import 'package:sahayakai/features/profile/domain/plan_badge.dart';
import 'package:sahayakai/features/profile/domain/profile_settings.dart';
import 'package:sahayakai/features/profile/domain/teacher_profile.dart';
import 'package:sahayakai/features/profile/presentation/profile_controller.dart';
import 'package:sahayakai/shared/domain/picker_options.dart';

import 'profile_fixtures.dart';

/// Data-layer gates: what the read turns a document into, which lane each field
/// leaves by, and how the plan claim is resolved.
///
/// Both sources are doubles. That is not only for speed: the real [ApiClient]
/// opens a real socket, so an un-faked save in a unit test fires a live PATCH
/// at production.
void main() {
  ProviderContainer containerWith(List<Override> overrides) {
    final container = ProviderContainer(overrides: overrides);
    addTearDown(container.dispose);
    return container;
  }

  group('ProfileRepository.fetchProfile', () {
    test('turns a document into the domain profile', () async {
      final source = FakeProfileDocSource(doc: teacherDoc());
      final container = containerWith([docSourceOverride(source)]);

      final profile =
          await container.read(profileRepositoryProvider).fetchProfile();

      expect(profile.displayName, 'Lakshmi Iyer');
      expect(profile.settings.administrativeRole, AdministrativeRole.hod);
      expect(profile.isEmpty, isFalse);
    });

    test('a missing document is an EMPTY profile, not an error', () async {
      // The production onboarding gate is OFF, so a teacher can sign in and
      // land here before anything has ever been written for them. Throwing
      // would show a failure for a perfectly normal first visit.
      final source = FakeProfileDocSource(doc: null);
      final container = containerWith([docSourceOverride(source)]);

      final profile =
          await container.read(profileRepositoryProvider).fetchProfile();

      expect(profile, const TeacherProfile());
      expect(profile.isEmpty, isTrue);
    });

    test('an empty document is an empty profile', () async {
      final source = FakeProfileDocSource(doc: <String, dynamic>{});
      final container = containerWith([docSourceOverride(source)]);

      final profile =
          await container.read(profileRepositoryProvider).fetchProfile();

      expect(profile.isEmpty, isTrue);
    });

    test('a source failure surfaces as the typed exception', () async {
      final source = FakeProfileDocSource(readError: kUnauthorized);
      final container = containerWith([docSourceOverride(source)]);

      expect(
        () => container.read(profileRepositoryProvider).fetchProfile(),
        throwsA(
          isA<ApiException>()
              .having((e) => e.kind, 'kind', ApiErrorKind.unauthorized),
        ),
      );
    });
  });

  group('ProfileRepository.saveProfile', () {
    test('splits the profile across the two lanes, each getting its own half',
        () async {
      final source = FakeProfileDocSource(doc: teacherDoc());
      final client = FakeApiClient();
      final container = containerWith([
        docSourceOverride(source),
        apiClientOverride(client),
      ]);

      await container.read(profileRepositoryProvider).saveProfile(
            const TeacherProfile(
              displayName: 'Lakshmi Iyer',
              state: 'Karnataka',
              subjects: ['Science'],
              preferredLanguage: AppLocale.kn,
              settings: ProfileSettings(
                educationBoard: 'CBSE',
                administrativeRole: AdministrativeRole.hod,
              ),
            ),
          );

      // The document lane carries what REST strips (state) and what REST would
      // clobber (name, subjects).
      expect(source.merges.single, {
        'displayName': 'Lakshmi Iyer',
        'state': 'Karnataka',
        'subjects': ['Science'],
        'gradeLevels': <String>[],
        'preferredLanguage': 'Kannada',
      });

      // The PATCH lane carries what firestore.rules protects (administrative
      // role) plus the board, under its renamed key.
      expect(client.patches.single.path, '/api/user/profile');
      expect(client.patches.single.data, {
        'preferredBoard': 'CBSE',
        'qualifications': <String>[],
        'administrativeRole': 'hod',
      });
    });

    test('a failed document write does not reach the PATCH lane', () async {
      // Fail-fast: if the document merge is rejected, firing the REST call too
      // would leave the profile half-saved with no way for the teacher to tell.
      final source = FakeProfileDocSource(writeError: kUnauthorized);
      final client = FakeApiClient();
      final container = containerWith([
        docSourceOverride(source),
        apiClientOverride(client),
      ]);

      await expectLater(
        container
            .read(profileRepositoryProvider)
            .saveProfile(const TeacherProfile(displayName: 'Lakshmi')),
        throwsA(isA<ApiException>()),
      );

      expect(source.merges, hasLength(1));
      expect(client.patches, isEmpty);
    });

    test('a failed PATCH surfaces, even though the document lane succeeded',
        () async {
      final source = FakeProfileDocSource(doc: teacherDoc());
      final client = FakeApiClient(error: kUnauthorized);
      final container = containerWith([
        docSourceOverride(source),
        apiClientOverride(client),
      ]);

      await expectLater(
        container
            .read(profileRepositoryProvider)
            .saveProfile(const TeacherProfile(displayName: 'Lakshmi')),
        throwsA(isA<ApiException>()),
      );

      // Both merges are idempotent, so tapping Save again recovers; what must
      // not happen is a partial save reported as success.
      expect(source.merges, hasLength(1));
      expect(client.patches, hasLength(1));
    });

    test('savePatchableSlice is the exact lane Settings shares', () async {
      final client = FakeApiClient();
      final container = containerWith([apiClientOverride(client)]);

      await container.read(profileRepositoryProvider).savePatchableSlice(
            const ProfileSettings(educationBoard: 'CBSE', qualifications: ['B.Ed']),
          );

      expect(client.patches.single.path, '/api/user/profile');
      expect(client.patches.single.data, {
        'preferredBoard': 'CBSE',
        'qualifications': ['B.Ed'],
      });
    });

    test('a save never carries the qualifications it did not edit away', () async {
      // The Profile screen has no qualifications editor (Settings owns it), so
      // the fetched value must round-trip. If it did not, saving a phone
      // number here would silently wipe the B.Ed set in Settings — the PATCH
      // DTO sends an empty list as a deliberate "clear".
      final source = FakeProfileDocSource(doc: teacherDoc());
      final container = containerWith([docSourceOverride(source)]);
      final repository = container.read(profileRepositoryProvider);

      final fetched = await repository.fetchProfile();
      final edited = fetched.copyWith(phoneNumber: '9000000000');

      expect(edited.settings.qualifications, ['B.Ed']);
      expect(
        edited.patchableSlice.qualifications,
        ['B.Ed'],
        reason: 'the PATCH body must resend the qualifications it did not edit',
      );
    });
  });

  group('ProfileFormSaveController', () {
    test('a successful save leaves the read state showing the saved values',
        () async {
      final container = containerWith([
        docSourceOverride(FakeProfileDocSource(doc: teacherDoc())),
        apiClientOverride(FakeApiClient()),
      ]);
      await container.read(profileControllerProvider.future);

      const edited = TeacherProfile(displayName: 'Lakshmi R Iyer');
      final ok = await container
          .read(profileFormSaveControllerProvider.notifier)
          .save(edited);

      expect(ok, isTrue);
      expect(container.read(profileControllerProvider).value, edited);
      expect(container.read(profileFormSaveControllerProvider).hasError, isFalse);
    });

    test('a failed save reports the error and does NOT touch the read state',
        () async {
      // The teacher is still looking at (and editing) the profile. Blowing the
      // read state away on a failed write would throw their work off screen.
      final container = containerWith([
        docSourceOverride(FakeProfileDocSource(doc: teacherDoc())),
        apiClientOverride(FakeApiClient(error: kUnauthorized)),
      ]);
      final loaded = await container.read(profileControllerProvider.future);

      final ok = await container
          .read(profileFormSaveControllerProvider.notifier)
          .save(const TeacherProfile(displayName: 'Lakshmi R Iyer'));

      expect(ok, isFalse);
      expect(container.read(profileFormSaveControllerProvider).hasError, isTrue);
      expect(container.read(profileControllerProvider).value, loaded);
    });
  });

  group('the signed-out document source (the pre-Firebase binding)', () {
    test('is what is bound by default', () {
      final container = containerWith(const []);
      expect(
        container.read(profileDocSourceProvider),
        isA<SignedOutProfileDocSource>(),
      );
    });

    test('reports no identity as the same typed 401 the API client raises', () {
      const source = SignedOutProfileDocSource();
      final matcher = throwsA(
        isA<ApiException>()
            .having((e) => e.kind, 'kind', ApiErrorKind.unauthorized)
            .having((e) => e.statusCode, 'statusCode', 401),
      );

      expect(source.read, matcher);
      expect(() => source.merge(const {}), matcher);
    });
  });

  group('planBadge (the token claim)', () {
    test('no token means UNKNOWN, never a fabricated "free"', () async {
      // This is today's runtime state: tokenProvider is the P0.2 stub. A
      // teacher on the Pro plan must not be told they are on Free just because
      // the app cannot see their token.
      final container = containerWith([tokenOverride(null)]);

      expect(await container.read(planBadgeProvider.future), PlanBadge.unknown);
    });

    test('an empty token means unknown', () async {
      final container = containerWith([tokenOverride('')]);
      expect(await container.read(planBadgeProvider.future), PlanBadge.unknown);
    });

    test('a token carrying the claim resolves to that plan', () async {
      final container =
          containerWith([tokenOverride(fakeJwt({'sub': 'u1', 'planType': 'gold'}))]);

      expect(await container.read(planBadgeProvider.future), PlanBadge.gold);
    });

    test('a verified token with NO claim is free, as middleware resolves it', () {
      // New and pre-migration users have no claim yet, and the server meters
      // them as free. Unlike the no-token case, this IS a known answer.
      final container = containerWith([tokenOverride(fakeJwt({'sub': 'u1'}))]);

      expect(container.read(planBadgeProvider.future), completion(PlanBadge.free));
    });

    test('the legacy institution claim reads as premium', () {
      final container = containerWith([
        tokenOverride(fakeJwt({'planType': 'institution'})),
      ]);

      expect(
        container.read(planBadgeProvider.future),
        completion(PlanBadge.premium),
      );
    });

    test('a malformed token is unknown rather than a crash', () async {
      for (final bad in ['not-a-jwt', 'a.b', 'a.b.c.d', 'x.!!!not-base64!!!.z']) {
        final container = containerWith([tokenOverride(bad)]);
        expect(
          await container.read(planBadgeProvider.future),
          PlanBadge.unknown,
          reason: '"$bad" must not throw inside a profile render',
        );
      }
    });
  });

  group('decodeJwtClaims', () {
    test('decodes an unpadded payload, which is what Firebase sends', () {
      final claims = decodeJwtClaims(fakeJwt({'planType': 'pro', 'sub': 'abc'}));
      expect(claims, {'planType': 'pro', 'sub': 'abc'});
    });

    test('rejects anything that is not a three-segment JWT', () {
      expect(decodeJwtClaims(''), isNull);
      expect(decodeJwtClaims('one.two'), isNull);
      expect(decodeJwtClaims('one.two.three.four'), isNull);
    });

    test('rejects a payload that is not a JSON object', () {
      expect(decodeJwtClaims(fakeJwtRaw('"just-a-string"')), isNull);
      expect(decodeJwtClaims(fakeJwtRaw('[1,2,3]')), isNull);
      expect(decodeJwtClaims(fakeJwtRaw('not json at all')), isNull);
    });
  });
}
