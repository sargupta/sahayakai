import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/settings/data/settings_dtos.dart';

/// Wire-contract gates for Settings' own endpoint, verified against the route
/// handler in the Next.js app. If someone "tidies" the field names, these fail
/// before a teacher hits a 400.
///
/// The `ProfileSettingsPatchDto` group (including the `preferredBoard` rename
/// gate) moved to `test/features/profile/profile_dtos_test.dart` with the DTO
/// itself — the Profile feature owns that wire mapping now, and Settings calls
/// its repository.
void main() {
  group('DeleteAccountRequestDto -> POST /api/user/delete-account', () {
    test('sends confirm:true and the fresh idToken', () {
      // The route 400s without a truthy `confirm`, and 401s without a string
      // `idToken` (it re-verifies the token itself; middleware forwards only
      // x-user-id).
      final json = const DeleteAccountRequestDto(
        idToken: 'fresh-token',
      ).toJson();
      expect(json, {'confirm': true, 'idToken': 'fresh-token'});
    });
  });

  group('DeleteAccountResponseDto -> domain', () {
    test('parses the documented 200 payload', () {
      final deletion = DeleteAccountResponseDto.fromJson(const {
        'status': 'deletion_scheduled',
        'message': 'Your account has been scheduled for deletion.',
        'gracePeriodEnd': '2026-08-16T10:30:00.000Z',
        'exportUrl': '/api/export',
      }).toDomain();

      expect(
        deletion.gracePeriodEnd,
        DateTime.parse('2026-08-16T10:30:00.000Z'),
      );
      expect(deletion.exportPath, '/api/export');
    });

    test('a malformed or missing grace date degrades to null, never throws', () {
      // The deletion still succeeded; the UI just omits the date. Throwing here
      // would turn a successful delete into an error state.
      for (final raw in <Object?>[null, '', '   ', 'next tuesday']) {
        final deletion = DeleteAccountResponseDto.fromJson({
          'gracePeriodEnd': raw,
        }).toDomain();
        expect(deletion.gracePeriodEnd, isNull);
      }
    });

    test('an empty payload decodes to an empty result', () {
      final deletion = DeleteAccountResponseDto.fromJson(const {}).toDomain();
      expect(deletion.gracePeriodEnd, isNull);
      expect(deletion.exportPath, isNull);
    });

    test('the re-auth window mirrors the server constant', () {
      expect(kMaxAuthAgeSeconds, 300);
    });
  });
}
