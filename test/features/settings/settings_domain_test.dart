import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/settings/domain/account_deletion.dart';
import 'package:sahayakai/shared/domain/picker_options.dart';

/// Domain-layer gates. The delete interlock is pure logic, so it is pinned here
/// exhaustively and the widget suite only has to prove the button is wired to
/// it.
///
/// The `ProfileSettings` group moved to `test/features/profile/` along with the
/// class itself (P0.8): the Profile feature now owns the `users/<uid>` document
/// and Settings imports that slice from it.
void main() {
  group('isDeleteConfirmed — the interlock', () {
    test('the exact word confirms', () {
      expect(isDeleteConfirmed('DELETE'), isTrue);
    });

    test('surrounding whitespace is tolerated', () {
      // Soft keyboards append a space; that is not a different intent.
      expect(isDeleteConfirmed('DELETE '), isTrue);
      expect(isDeleteConfirmed('  DELETE  '), isTrue);
      expect(isDeleteConfirmed('\nDELETE\n'), isTrue);
    });

    test('a wrong string never confirms', () {
      // Every one of these must fail closed. Accidental deletion is the whole
      // thing this function exists to prevent.
      const wrong = <String>[
        '',
        ' ',
        'delete', // case matters
        'Delete',
        'DELET',
        'DELETES',
        'DELETE ME',
        'D E L E T E',
        'REMOVE',
        'DELETE​s', // zero-width sneak
        'ᴅᴇʟᴇᴛᴇ', // lookalike small-caps
        'मिटाएं', // a translated word must NOT unlock the English token
      ];
      for (final value in wrong) {
        expect(
          isDeleteConfirmed(value),
          isFalse,
          reason: '"$value" must not unlock deletion',
        );
      }
    });

    test('null never confirms', () {
      expect(isDeleteConfirmed(null), isFalse);
    });

    test('the confirm word is the literal the API contract expects', () {
      expect(kDeleteConfirmWord, 'DELETE');
    });
  });

  group('AdministrativeRole', () {
    test('wire values match the API enum verbatim', () {
      // These are validated server-side against ADMINISTRATIVE_ROLES; a typo
      // here is a 400 at runtime.
      expect(AdministrativeRole.values.map((r) => r.wire).toList(), <String>[
        'hod',
        'coordinator',
        'exam_controller',
        'vice_principal',
        'principal',
        'none',
      ]);
    });

    test('fromWire round-trips every role', () {
      for (final role in AdministrativeRole.values) {
        expect(AdministrativeRole.fromWire(role.wire), role);
      }
    });

    test('an unknown or absent wire value reads as not-set', () {
      // The profile doc is server-authored: tolerate a role this build has
      // never heard of rather than throwing on someone else's profile.
      expect(AdministrativeRole.fromWire('headmaster'), isNull);
      expect(AdministrativeRole.fromWire(''), isNull);
      expect(AdministrativeRole.fromWire(null), isNull);
    });
  });

  group('picker options mirror the backend lists', () {
    test('boards and qualifications carry the full canonical set', () {
      // 29, counted off `EDUCATION_BOARDS` in the web app's src/types/index.ts.
      expect(kEducationBoards, hasLength(29));
      expect(kEducationBoards.first, 'CBSE');
      expect(kEducationBoards, contains('West Bengal State Board (WBBSE)'));
      expect(kQualifications, hasLength(10));
      expect(kQualifications, contains('D.El.Ed'));
      expect(kQualifications, contains('Other'));
    });

    test('no duplicates, which would break dropdown value equality', () {
      expect(kEducationBoards.toSet(), hasLength(kEducationBoards.length));
      expect(kQualifications.toSet(), hasLength(kQualifications.length));
    });
  });
}
