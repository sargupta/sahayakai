import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/i18n/app_locale.dart';
import 'package:sahayakai/features/profile/data/profile_dtos.dart';
import 'package:sahayakai/features/profile/domain/profile_settings.dart';
import 'package:sahayakai/features/profile/domain/teacher_profile.dart';
import 'package:sahayakai/shared/domain/picker_options.dart';

import 'profile_fixtures.dart';

/// Wire-contract gates. These pin the exact JSON each lane accepts and returns,
/// verified against `src/app/api/user/profile/route.ts`, `firestore.rules` and
/// the web's own `updateProfileAction`. If someone "tidies" a field name, these
/// fail before a teacher's save silently changes nothing.
void main() {
  group('ProfileSettingsPatchDto -> PATCH /api/user/profile', () {
    test('educationBoard is sent as preferredBoard, NOT educationBoard', () {
      // The single most breakable thing in this feature. The route's allowlist
      // only accepts `preferredBoard` and mirrors it into `educationBoard`
      // server-side; sending `educationBoard` is silently dropped, so the save
      // would appear to succeed and change nothing.
      final json = ProfileSettingsPatchDto.fromDomain(
        const ProfileSettings(educationBoard: 'CBSE'),
      ).toJson();

      expect(json['preferredBoard'], 'CBSE');
      expect(json.containsKey('educationBoard'), isFalse);
    });

    test('a fully-populated profile serializes to the exact body', () {
      final json = ProfileSettingsPatchDto.fromDomain(
        const ProfileSettings(
          educationBoard: 'Karnataka State Board (KSEEB)',
          qualifications: ['B.Ed', 'NET'],
          administrativeRole: AdministrativeRole.examController,
        ),
      ).toJson();

      expect(json, {
        'preferredBoard': 'Karnataka State Board (KSEEB)',
        'qualifications': ['B.Ed', 'NET'],
        // The wire token, not the Dart enum name (`examController`).
        'administrativeRole': 'exam_controller',
      });
    });

    test('unset fields are omitted, never sent as null', () {
      // The route validates any key it receives, so an explicit null board
      // would 400 the whole request instead of leaving the field alone.
      final json =
          ProfileSettingsPatchDto.fromDomain(const ProfileSettings()).toJson();

      expect(json.containsKey('preferredBoard'), isFalse);
      expect(json.containsKey('administrativeRole'), isFalse);
    });

    test('an empty qualification list is sent, because clearing is an intent', () {
      // Distinct from "unset": the teacher deselected every chip and wants that
      // persisted. The route accepts any array whose members are all valid.
      final json =
          ProfileSettingsPatchDto.fromDomain(const ProfileSettings()).toJson();
      expect(json['qualifications'], isEmpty);
    });

    test('AdministrativeRole.none serializes as the "none" answer', () {
      // "I hold no administrative role" is an answer and must reach the server;
      // it is not the same as never having been asked.
      final json = ProfileSettingsPatchDto.fromDomain(
        const ProfileSettings(administrativeRole: AdministrativeRole.none),
      ).toJson();
      expect(json['administrativeRole'], 'none');
    });

    test('the body carries ONLY the four keys the route allowlists', () {
      // The handler reads exactly `yearsOfExperience`, `administrativeRole`,
      // `qualifications` and `preferredBoard` off the body and ignores the
      // rest. Anything extra here would be dead weight that reads as supported.
      final json = ProfileSettingsPatchDto.fromDomain(
        const ProfileSettings(
          educationBoard: 'CBSE',
          administrativeRole: AdministrativeRole.hod,
        ),
      ).toJson();
      expect(
        json.keys.toSet().difference(
          {'yearsOfExperience', 'administrativeRole', 'qualifications', 'preferredBoard'},
        ),
        isEmpty,
      );
    });
  });

  group('TeacherProfileDto -> domain (the users/<uid> read)', () {
    test('parses a full document', () {
      final profile = TeacherProfileDto.fromJson(teacherDoc()).toDomain();

      expect(profile.displayName, 'Lakshmi Iyer');
      expect(profile.schoolName, 'Government Higher Primary School');
      expect(profile.state, 'Karnataka');
      expect(profile.district, 'Mysuru');
      expect(profile.subjects, ['Mathematics', 'Science']);
      expect(profile.gradeLevels, ['Class 6', 'Class 7']);
      expect(profile.preferredLanguage, AppLocale.kn);
      expect(profile.phoneNumber, '9845012345');
      expect(profile.pincode, '570001');
      expect(profile.settings.educationBoard, 'Karnataka State Board (KSEEB)');
      expect(profile.settings.qualifications, ['B.Ed']);
      expect(profile.settings.administrativeRole, AdministrativeRole.hod);
    });

    test('an empty document decodes to an empty profile, never throws', () {
      // A teacher who signed in and never onboarded. The production onboarding
      // gate is OFF, so this is a real and common document.
      final profile = TeacherProfileDto.fromJson(const {}).toDomain();

      expect(profile.isEmpty, isTrue);
      expect(profile.subjects, isEmpty);
      expect(profile.gradeLevels, isEmpty);
      expect(profile.preferredLanguage, isNull);
      expect(profile.settings.administrativeRole, isNull);
    });

    test('every field being explicitly null decodes to an empty profile', () {
      final profile = TeacherProfileDto.fromJson(const {
        'displayName': null,
        'schoolName': null,
        'state': null,
        'district': null,
        'subjects': null,
        'gradeLevels': null,
        'preferredLanguage': null,
        'phoneNumber': null,
        'pincode': null,
        'preferredBoard': null,
        'educationBoard': null,
        'qualifications': null,
        'administrativeRole': null,
      }).toDomain();

      expect(profile.isEmpty, isTrue);
    });

    test('blank strings read as not-set, not as a name of one space', () {
      final profile = TeacherProfileDto.fromJson(const {
        'displayName': '   ',
        'schoolName': '',
      }).toDomain();

      expect(profile.displayName, isNull);
      expect(profile.schoolName, isNull);
      expect(profile.isEmpty, isTrue);
    });

    test('preferredBoard wins over the legacy educationBoard mirror', () {
      // The route mirrors preferredBoard INTO educationBoard, so when they
      // disagree the typed column is the newer write.
      final profile = TeacherProfileDto.fromJson(const {
        'preferredBoard': 'CBSE',
        'educationBoard': 'ICSE / ISC',
      }).toDomain();

      expect(profile.settings.educationBoard, 'CBSE');
    });

    test('a document with only the legacy educationBoard still reads', () {
      // Written before the typed field existed; the teacher must still see
      // their board.
      final profile = TeacherProfileDto.fromJson(const {
        'educationBoard': 'UP Board (UPMSP)',
      }).toDomain();

      expect(profile.settings.educationBoard, 'UP Board (UPMSP)');
    });

    test('teachingGradeLevels is honoured as the legacy grade alias', () {
      // `POST /api/user/profile` reads grades from `teachingGradeLevels`, so
      // documents written through it can carry either key.
      final profile = TeacherProfileDto.fromJson(const {
        'teachingGradeLevels': <String>['Class 9'],
      }).toDomain();

      expect(profile.gradeLevels, ['Class 9']);
    });

    test('gradeLevels wins when a document carries both keys', () {
      final profile = TeacherProfileDto.fromJson(const {
        'gradeLevels': <String>['Class 3'],
        'teachingGradeLevels': <String>['Class 9'],
      }).toDomain();

      expect(profile.gradeLevels, ['Class 3']);
    });

    group('unknown-enum tolerance (the document is server-authored)', () {
      test('an unknown administrative role reads as not-set', () {
        final profile = TeacherProfileDto.fromJson(const {
          'administrativeRole': 'headmaster',
        }).toDomain();

        expect(profile.settings.administrativeRole, isNull);
      });

      test('an unknown language reads as not-set', () {
        final profile = TeacherProfileDto.fromJson(const {
          'preferredLanguage': 'Klingon',
        }).toDomain();

        expect(profile.preferredLanguage, isNull);
      });

      test('a legacy BCP-47 language code still resolves', () {
        final profile =
            TeacherProfileDto.fromJson(const {'preferredLanguage': 'ta'}).toDomain();

        expect(profile.preferredLanguage, AppLocale.ta);
      });

      test('an unknown board is preserved verbatim, not dropped', () {
        // A board this build has not heard of is still the teacher's board.
        // Dropping it would silently re-save their profile without it.
        final profile = TeacherProfileDto.fromJson(const {
          'preferredBoard': 'Some New State Board (2027)',
        }).toDomain();

        expect(profile.settings.educationBoard, 'Some New State Board (2027)');
      });

      test('a list carrying junk contributes nothing rather than throwing', () {
        final profile = TeacherProfileDto.fromJson(const {
          'subjects': <dynamic>['Science', null, 42, '', '  ', 'Hindi'],
        }).toDomain();

        expect(profile.subjects, ['Science', 'Hindi']);
      });
    });
  });

  group('TeacherProfileDocPatch -> the users/<uid> merge write', () {
    test('carries the fields REST cannot, and only those', () {
      final json = TeacherProfileDocPatch(
        const TeacherProfile(
          displayName: 'Lakshmi Iyer',
          schoolName: 'GHPS',
          state: 'Karnataka',
          district: 'Mysuru',
          subjects: ['Mathematics'],
          gradeLevels: ['Class 6'],
          preferredLanguage: AppLocale.kn,
          phoneNumber: '9845012345',
          pincode: '570001',
          settings: ProfileSettings(
            educationBoard: 'CBSE',
            administrativeRole: AdministrativeRole.hod,
          ),
        ),
      ).toJson();

      expect(json, {
        'displayName': 'Lakshmi Iyer',
        'schoolName': 'GHPS',
        'state': 'Karnataka',
        'district': 'Mysuru',
        'phoneNumber': '9845012345',
        'pincode': '570001',
        'subjects': ['Mathematics'],
        'gradeLevels': ['Class 6'],
        // The full English name, matching what the web writes and what the AI
        // flows read back as their `language` param.
        'preferredLanguage': 'Kannada',
      });
    });

    test('never writes administrativeRole: firestore.rules forbids it', () {
      // `administrativeRole` is in the rules' protectedUserFields(), so a
      // client-SDK write carrying it is REJECTED — and the rejection would
      // take the whole merge (name, school, location) down with it. It travels
      // the PATCH lane instead.
      final json = TeacherProfileDocPatch(
        const TeacherProfile(
          displayName: 'Lakshmi Iyer',
          settings: ProfileSettings(administrativeRole: AdministrativeRole.principal),
        ),
      ).toJson();

      expect(json.containsKey('administrativeRole'), isFalse);
    });

    test('never writes a server-owned field', () {
      // planType, impactScore, contentSharedCount, badges, email, uid... all in
      // protectedUserFields(). This is the gate that stops a profile save from
      // downgrading a paying teacher — the exact bug that
      // `POST /api/user/profile` has (its Zod defaults write planType: 'free').
      final json = TeacherProfileDocPatch(
        TeacherProfileDto.fromJson(teacherDoc()).toDomain(),
      ).toJson();

      for (final forbidden in const [
        'planType',
        'plan',
        'planTier',
        'impactScore',
        'contentSharedCount',
        'badges',
        'verifiedStatus',
        'followersCount',
        'followingCount',
        'email',
        'uid',
        'role',
        'isAdmin',
        'organizationId',
        'createdAt',
      ]) {
        expect(
          json.containsKey(forbidden),
          isFalse,
          reason: '$forbidden is Admin-SDK-only; writing it fails the rule',
        );
      }
    });

    test('never writes boardCategory, which nothing persists', () {
      final json = TeacherProfileDocPatch(
        const TeacherProfile(settings: ProfileSettings(educationBoard: 'CBSE')),
      ).toJson();

      expect(json.containsKey('boardCategory'), isFalse);
    });

    test('never writes the board: preferredBoard is the PATCH lane\'s field', () {
      // Writing it here too would give one field two writers racing on one
      // save, and the doc lane cannot mirror it into `educationBoard` the way
      // the route does.
      final json = TeacherProfileDocPatch(
        const TeacherProfile(settings: ProfileSettings(educationBoard: 'CBSE')),
      ).toJson();

      expect(json.containsKey('preferredBoard'), isFalse);
      expect(json.containsKey('educationBoard'), isFalse);
    });

    test('unset text fields are omitted: a merge-null would DELETE them', () {
      final json = TeacherProfileDocPatch(const TeacherProfile()).toJson();

      expect(json.containsKey('displayName'), isFalse);
      expect(json.containsKey('schoolName'), isFalse);
      expect(json.containsKey('state'), isFalse);
      expect(json.containsKey('district'), isFalse);
      expect(json.containsKey('phoneNumber'), isFalse);
      expect(json.containsKey('pincode'), isFalse);
      expect(json.containsKey('preferredLanguage'), isFalse);
    });

    test('blank text is omitted rather than saved as an empty value', () {
      final json = TeacherProfileDocPatch(
        const TeacherProfile(displayName: '   ', district: ''),
      ).toJson();

      expect(json.containsKey('displayName'), isFalse);
      expect(json.containsKey('district'), isFalse);
    });

    test('text is trimmed before it is written', () {
      final json = TeacherProfileDocPatch(
        const TeacherProfile(displayName: '  Lakshmi Iyer  '),
      ).toJson();

      expect(json['displayName'], 'Lakshmi Iyer');
    });

    test('empty lists ARE written, because deselecting everything is an intent',
        () {
      // Distinct from "unset": a teacher who stopped teaching Science must be
      // able to say so, and a merge that omitted the key would leave the old
      // list standing.
      final json = TeacherProfileDocPatch(const TeacherProfile()).toJson();

      expect(json['subjects'], isEmpty);
      expect(json['gradeLevels'], isEmpty);
    });

    group('U15: a DELIBERATELY-cleared field is sent as an explicit clear', () {
      test('erasing a field that HAD a value emits the clear marker, not silence',
          () {
        // The bug: with only the new profile, a blank field is indistinguishable
        // from "never set", so the old code omitted it — the server kept the
        // stale value and it reappeared on the next fetch, though "Saved" was
        // shown. Diffing against the loaded profile restores the distinction.
        final json = TeacherProfileDocPatch(
          const TeacherProfile(schoolName: ''), // teacher erased the school
          previous: const TeacherProfile(schoolName: 'Govt HPS Mysuru'),
        ).toJson();

        expect(json.containsKey('schoolName'), isTrue);
        expect(json['schoolName'], same(kProfileFieldClear));
      });

      test('a never-touched blank field is still OMITTED (server untouched)', () {
        // Both empty → the teacher never filled it in; sending anything would
        // risk clobbering a value another surface owns.
        final json = TeacherProfileDocPatch(
          const TeacherProfile(schoolName: ''),
          previous: const TeacherProfile(schoolName: ''),
        ).toJson();

        expect(json.containsKey('schoolName'), isFalse);
      });

      test('changing a value to a new one sends the value, not a clear', () {
        final json = TeacherProfileDocPatch(
          const TeacherProfile(schoolName: 'New School'),
          previous: const TeacherProfile(schoolName: 'Old School'),
        ).toJson();

        expect(json['schoolName'], 'New School');
      });

      test('clearing the board deletes BOTH columns the read falls back across',
          () {
        // The board's SET travels the PATCH lane, but PATCH cannot CLEAR it (an
        // empty/null preferredBoard fails its enum check and 400s). Neither
        // board column is protected, so the clear is a merge delete of both —
        // otherwise `preferredBoard ?? educationBoard` would resurrect the old
        // value from the un-deleted column.
        final json = TeacherProfileDocPatch(
          const TeacherProfile(), // board now null
          previous: const TeacherProfile(
            settings: ProfileSettings(educationBoard: 'CBSE'),
          ),
        ).toJson();

        expect(json['preferredBoard'], same(kProfileFieldClear));
        expect(json['educationBoard'], same(kProfileFieldClear));
      });

      test('a board left unchanged (or newly set) writes NO board key here', () {
        // Regression guard for the two-writers race: only a CLEAR uses this lane.
        final unchanged = TeacherProfileDocPatch(
          const TeacherProfile(
            settings: ProfileSettings(educationBoard: 'CBSE'),
          ),
          previous: const TeacherProfile(
            settings: ProfileSettings(educationBoard: 'CBSE'),
          ),
        ).toJson();

        expect(unchanged.containsKey('preferredBoard'), isFalse);
        expect(unchanged.containsKey('educationBoard'), isFalse);
      });

      test('with no previous snapshot nothing is cleared (onboarding first save)',
          () {
        // A brand-new profile has nothing to clear, so the marker never appears
        // and the behavior reduces to the old omit-blanks path.
        final json = TeacherProfileDocPatch(const TeacherProfile()).toJson();

        expect(json.values, isNot(contains(same(kProfileFieldClear))));
      });
    });
  });

  group('the picker lists mirror the backend', () {
    test('INDIAN_STATES carries all 36 entries, unique', () {
      // 28 states + 8 UTs, counted off the web app's src/types/index.ts.
      // NOT the 35 that SCREEN_INVENTORY §0's heading claims: its own printed
      // list has 36 too, so the heading is simply miscounted. The backend
      // array wins.
      expect(kIndianStates, hasLength(36));
      expect(kIndianStates.first, 'Andhra Pradesh');
      expect(kIndianStates, contains('Ladakh'));
      expect(kIndianStates, contains('Dadra and Nagar Haveli and Daman and Diu'));
      // Duplicates would break DropdownButton value equality at runtime.
      expect(kIndianStates.toSet(), hasLength(kIndianStates.length));
    });
  });
}
