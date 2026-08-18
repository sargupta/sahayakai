import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/features/profile/domain/board_category.dart';
import 'package:sahayakai/features/profile/domain/plan_badge.dart';
import 'package:sahayakai/features/profile/domain/profile_settings.dart';
import 'package:sahayakai/features/profile/domain/teacher_profile.dart';
import 'package:sahayakai/shared/domain/picker_options.dart';

/// Domain-layer gates: pure logic, pinned exhaustively here so the widget suite
/// only has to prove the UI is wired to it.
void main() {
  // Moved verbatim from test/features/settings/settings_domain_test.dart when
  // ProfileSettings moved to the feature that owns the users/<uid> document.
  group('ProfileSettings', () {
    test('defaults to nothing set', () {
      const settings = ProfileSettings();
      expect(settings.educationBoard, isNull);
      expect(settings.qualifications, isEmpty);
      expect(settings.administrativeRole, isNull);
    });

    test('copyWith updates one field and leaves the rest', () {
      const base = ProfileSettings(
        educationBoard: 'CBSE',
        qualifications: ['B.Ed'],
        administrativeRole: AdministrativeRole.principal,
      );
      final next = base.copyWith(qualifications: ['B.Ed', 'M.A']);
      expect(next.educationBoard, 'CBSE');
      expect(next.administrativeRole, AdministrativeRole.principal);
      expect(next.qualifications, ['B.Ed', 'M.A']);
    });

    test('clear flags reset a field back to not-set', () {
      // copyWith(x: null) cannot express "clear" (null means "unchanged"), so
      // the explicit flags are the only way to unset a board or a role.
      const base = ProfileSettings(
        educationBoard: 'CBSE',
        administrativeRole: AdministrativeRole.hod,
      );
      expect(base.copyWith(clearEducationBoard: true).educationBoard, isNull);
      expect(
        base.copyWith(clearAdministrativeRole: true).administrativeRole,
        isNull,
      );
      // ... and clearing one leaves the other alone.
      expect(
        base.copyWith(clearEducationBoard: true).administrativeRole,
        AdministrativeRole.hod,
      );
    });

    test('equality is by value, including the qualification list', () {
      const a = ProfileSettings(qualifications: ['B.Ed', 'NET']);
      const b = ProfileSettings(qualifications: ['B.Ed', 'NET']);
      const c = ProfileSettings(qualifications: ['NET', 'B.Ed']);
      expect(a, b);
      expect(a.hashCode, b.hashCode);
      expect(a, isNot(c)); // order is the teacher's; treat it as significant
    });
  });

  group('TeacherProfile', () {
    test('a fresh profile is empty', () {
      expect(const TeacherProfile().isEmpty, isTrue);
    });

    test('any one real field makes it non-empty', () {
      expect(const TeacherProfile(displayName: 'A').isEmpty, isFalse);
      expect(const TeacherProfile(schoolName: 'A').isEmpty, isFalse);
      expect(const TeacherProfile(state: 'Kerala').isEmpty, isFalse);
      expect(const TeacherProfile(district: 'Kannur').isEmpty, isFalse);
      expect(const TeacherProfile(phoneNumber: '9845012345').isEmpty, isFalse);
      expect(const TeacherProfile(pincode: '570001').isEmpty, isFalse);
      expect(const TeacherProfile(subjects: ['Science']).isEmpty, isFalse);
      expect(const TeacherProfile(gradeLevels: ['Class 6']).isEmpty, isFalse);
      expect(
        const TeacherProfile(
          settings: ProfileSettings(educationBoard: 'CBSE'),
        ).isEmpty,
        isFalse,
      );
      expect(
        const TeacherProfile(
          settings: ProfileSettings(
            administrativeRole: AdministrativeRole.none,
          ),
        ).isEmpty,
        isFalse,
      );
    });

    test('blank text does not count as filled in', () {
      expect(const TeacherProfile(displayName: '   ').isEmpty, isTrue);
    });

    test('a language alone is still an empty profile', () {
      // The language is mirrored from the device picker, not something the
      // teacher told us about their teaching. Counting it would hide the empty
      // state from every teacher who merely opened the app.
      expect(
        const TeacherProfile(preferredLanguage: AppLocale.bn).isEmpty,
        isTrue,
      );
    });

    test('copyWith leaves the untouched fields alone', () {
      const base = TeacherProfile(
        displayName: 'Lakshmi',
        subjects: ['Science'],
        settings: ProfileSettings(educationBoard: 'CBSE'),
      );
      final next = base.copyWith(district: 'Mysuru');

      expect(next.displayName, 'Lakshmi');
      expect(next.subjects, ['Science']);
      expect(next.settings.educationBoard, 'CBSE');
      expect(next.district, 'Mysuru');
    });

    test(
      'clearState unsets the state, which copyWith(null) cannot express',
      () {
        const base = TeacherProfile(state: 'Karnataka');
        expect(base.copyWith(clearState: true).state, isNull);
        expect(base.copyWith().state, 'Karnataka');
      },
    );

    test('equality is by value across the lists and the nested slice', () {
      const a = TeacherProfile(
        subjects: ['Science'],
        settings: ProfileSettings(educationBoard: 'CBSE'),
      );
      const b = TeacherProfile(
        subjects: ['Science'],
        settings: ProfileSettings(educationBoard: 'CBSE'),
      );
      const c = TeacherProfile(
        subjects: ['Science'],
        settings: ProfileSettings(educationBoard: 'ICSE / ISC'),
      );

      expect(a, b);
      expect(a.hashCode, b.hashCode);
      expect(a, isNot(c));
    });
  });

  group('PlanBadge', () {
    test('claims map to the tiers the backend mints', () {
      expect(PlanBadge.fromClaim('free'), PlanBadge.free);
      expect(PlanBadge.fromClaim('pro'), PlanBadge.pro);
      expect(PlanBadge.fromClaim('gold'), PlanBadge.gold);
      expect(PlanBadge.fromClaim('premium'), PlanBadge.premium);
    });

    test(
      'the legacy institution claim maps to premium, as middleware does',
      () {
        expect(PlanBadge.fromClaim('institution'), PlanBadge.premium);
      },
    );

    test('an unrecognized claim resolves to free, matching the server', () {
      // Middleware resolves anything outside VALID_PLANS to 'free' and meters
      // the teacher as free. The badge must not promise more than that.
      expect(PlanBadge.fromClaim('enterprise'), PlanBadge.free);
      expect(PlanBadge.fromClaim(''), PlanBadge.free);
      expect(PlanBadge.fromClaim(42), PlanBadge.free);
      expect(PlanBadge.fromClaim(null), PlanBadge.free);
    });

    test('fromClaim never returns unknown: it is not a claim value', () {
      // "unknown" means "no token to read a claim from", which is a decision
      // made above this function, not a value the server can send.
      for (final raw in <Object?>[null, '', 'free', 'nonsense', 42]) {
        expect(PlanBadge.fromClaim(raw), isNot(PlanBadge.unknown));
      }
    });

    test('only the paid tiers are paid', () {
      expect(PlanBadge.free.isPaid, isFalse);
      expect(PlanBadge.unknown.isPaid, isFalse);
      expect(PlanBadge.pro.isPaid, isTrue);
      expect(PlanBadge.gold.isPaid, isTrue);
      expect(PlanBadge.premium.isPaid, isTrue);
    });
  });

  group('BoardCategory (UI-only, never persisted)', () {
    test('every board belongs to exactly one category', () {
      for (final board in kEducationBoards) {
        final category = BoardCategory.ofBoard(board);
        expect(category, isNotNull, reason: '$board has no category');
        expect(category!.boards, contains(board));
      }
    });

    test('the categories partition the whole board list', () {
      final covered = <String>{
        for (final category in BoardCategory.values) ...category.boards,
      };
      expect(covered, kEducationBoards.toSet());
    });

    test('the two national boards are their own categories', () {
      expect(BoardCategory.ofBoard('CBSE'), BoardCategory.cbse);
      expect(BoardCategory.ofBoard('ICSE / ISC'), BoardCategory.icse);
      expect(BoardCategory.cbse.boards, ['CBSE']);
      expect(BoardCategory.icse.boards, ['ICSE / ISC']);
    });

    test('a state board resolves to the state category', () {
      expect(
        BoardCategory.ofBoard('Karnataka State Board (KSEEB)'),
        BoardCategory.stateBoard,
      );
      expect(BoardCategory.stateBoard.boards, hasLength(27));
      expect(BoardCategory.stateBoard.boards, isNot(contains('CBSE')));
    });

    test('an unknown or absent board has no category, rather than a guess', () {
      expect(BoardCategory.ofBoard(null), isNull);
      expect(BoardCategory.ofBoard('Hogwarts Board'), isNull);
      expect(BoardCategory.ofBoard(''), isNull);
    });
  });
}
