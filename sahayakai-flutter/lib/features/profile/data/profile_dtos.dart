import 'package:json_annotation/json_annotation.dart';

import '../../../core/i18n/app_locale.dart';
import '../../../shared/domain/picker_options.dart';
import '../domain/profile_settings.dart';
import '../domain/teacher_profile.dart';

part 'profile_dtos.g.dart';

/// Serializes the editable profile slice into the exact
/// `PATCH /api/user/profile` body. `includeIfNull: false` drops the fields the
/// teacher never set, because that route only writes the keys it receives —
/// sending an explicit null would be validated as an invalid board/role and
/// 400 the whole request.
///
/// FIELD NAME DEVIATION (deliberate, verified against the route handler):
/// SCREEN_INVENTORY calls this field `educationBoard`, but the API's writable
/// key is **`preferredBoard`**. The handler mirrors it into both columns
/// server-side (`partialData.educationBoard = body.preferredBoard`). Sending
/// `educationBoard` directly is silently dropped by the route's allowlist, so
/// the domain keeps the inventory's name and the wire uses the API's.
@JsonSerializable(includeIfNull: false, createFactory: false)
class ProfileSettingsPatchDto {
  const ProfileSettingsPatchDto({
    this.preferredBoard,
    this.qualifications,
    this.administrativeRole,
  });

  factory ProfileSettingsPatchDto.fromDomain(ProfileSettings settings) {
    return ProfileSettingsPatchDto(
      preferredBoard: settings.educationBoard,
      // An empty list is meaningful ("I cleared my qualifications"), so it is
      // sent; the route accepts any array whose members are all valid.
      qualifications: settings.qualifications,
      administrativeRole: settings.administrativeRole?.wire,
    );
  }

  final String? preferredBoard;
  final List<String>? qualifications;
  final String? administrativeRole;

  Map<String, dynamic> toJson() => _$ProfileSettingsPatchDtoToJson(this);
}

/// Decodes the `users/<uid>` Firestore document.
///
/// Every field is nullable and every parse is tolerant: this document is
/// server-authored, six years of migrations deep, and shared with a web app
/// that writes legacy aliases. A profile screen that throws on an unexpected
/// value would lock a teacher out of their own account, so anything
/// unrecognized degrades to "not set" and the teacher can simply re-pick it.
@JsonSerializable(createToJson: false)
class TeacherProfileDto {
  const TeacherProfileDto({
    this.displayName,
    this.schoolName,
    this.state,
    this.district,
    this.subjects,
    this.gradeLevels,
    this.teachingGradeLevels,
    this.preferredLanguage,
    this.phoneNumber,
    this.pincode,
    this.preferredBoard,
    this.educationBoard,
    this.qualifications,
    this.administrativeRole,
  });

  factory TeacherProfileDto.fromJson(Map<String, dynamic> json) =>
      _$TeacherProfileDtoFromJson(json);

  final String? displayName;
  final String? schoolName;
  final String? state;
  final String? district;
  final List<dynamic>? subjects;
  final List<dynamic>? gradeLevels;

  /// Legacy alias for [gradeLevels]. `POST /api/user/profile` reads this key
  /// and writes `gradeLevels`, so pre-existing documents can carry either.
  final List<dynamic>? teachingGradeLevels;

  /// The full English language name (e.g. "Kannada"), matching `AppLocale.aiName`.
  final String? preferredLanguage;
  final String? phoneNumber;
  final String? pincode;

  /// The canonical typed board. The route mirrors every write into
  /// [educationBoard] too, so [preferredBoard] is preferred on read and the
  /// legacy free-string column is the fallback for documents written before
  /// the typed field existed.
  final String? preferredBoard;
  final String? educationBoard;

  final List<dynamic>? qualifications;
  final String? administrativeRole;

  TeacherProfile toDomain() {
    return TeacherProfile(
      displayName: _clean(displayName),
      schoolName: _clean(schoolName),
      state: _clean(state),
      district: _clean(district),
      subjects: _strings(subjects),
      gradeLevels: _strings(gradeLevels ?? teachingGradeLevels),
      preferredLanguage: _language(preferredLanguage),
      phoneNumber: _clean(phoneNumber),
      pincode: _clean(pincode),
      settings: ProfileSettings(
        educationBoard: _clean(preferredBoard) ?? _clean(educationBoard),
        qualifications: _strings(qualifications),
        // Tolerant by construction: an unknown role reads as "not set".
        administrativeRole: AdministrativeRole.fromWire(_clean(administrativeRole)),
      ),
    );
  }
}

/// Builds the `users/<uid>` merge-write map for the fields that CANNOT travel
/// over REST, and only those.
///
/// WHY THIS EXISTS RATHER THAN A `POST /api/user/profile` CALL — verified
/// against `src/app/api/user/profile/route.ts`, which is unsafe for a profile
/// editor on three counts:
///   1. It Zod-parses the body through `UserProfileSchema`, which has no
///      `state`, `district` or `pincode` key. Zod strips unknown keys, so the
///      three location fields this screen exists to edit would be dropped
///      silently — the save would "succeed" and change nothing.
///   2. The schema's defaults are applied on EVERY call and written straight
///      through `dbAdapter.createUser` (a `set(merge: true)` that, unlike
///      `updateUser`, does NOT pass the client allowlist). A body without
///      `planType` therefore writes `planType: 'free'`, plus `impactScore: 0`
///      and `contentSharedCount: 0` — saving a display name would downgrade a
///      paying teacher and zero their impact score.
///   3. It reads grades from `teachingGradeLevels` only, so sending the
///      document's own `gradeLevels` key wipes them to `[]`.
/// A direct owner-scoped document merge has none of those problems, and
/// `firestore.rules` explicitly allows it: `allow update: if isOwner(userId) &&
/// isSafeUserUpdate()`. Every key below is checked against that rule's
/// `protectedUserFields()` list and none of them appear in it.
///
/// `administrativeRole` is deliberately absent — it IS in `protectedUserFields()`
/// and travels down the PATCH lane instead ([ProfileSettingsPatchDto]).
class TeacherProfileDocPatch {
  const TeacherProfileDocPatch(this._profile);

  final TeacherProfile _profile;

  /// Only keys the teacher actually has a value for are emitted. A merge write
  /// of an explicit null would DELETE the server's value, turning "I did not
  /// fill this in" into "erase what you knew about me".
  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{};
    void put(String key, String? value) {
      final trimmed = value?.trim();
      if (trimmed != null && trimmed.isNotEmpty) json[key] = trimmed;
    }

    put('displayName', _profile.displayName);
    put('schoolName', _profile.schoolName);
    put('state', _profile.state);
    put('district', _profile.district);
    put('phoneNumber', _profile.phoneNumber);
    put('pincode', _profile.pincode);

    // Lists are always sent, empty included: deselecting every subject is an
    // intent ("I do not teach those any more"), not an absence.
    json['subjects'] = _profile.subjects;
    // The document key is `gradeLevels`; `teachingGradeLevels` is the legacy
    // alias the REST route reads and is intentionally not written here.
    json['gradeLevels'] = _profile.gradeLevels;

    final language = _profile.preferredLanguage;
    if (language != null) {
      // The full English name ("Kannada"), which is what the web writes and
      // what the AI flows read back as their `language` param.
      json['preferredLanguage'] = language.aiName;
    }
    return json;
  }
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

/// Keeps only the non-blank strings. A list carrying a number, a null or a
/// stray empty string (all seen in real documents) contributes nothing rather
/// than throwing.
List<String> _strings(List<dynamic>? raw) {
  if (raw == null) return const <String>[];
  return <String>[
    for (final item in raw)
      if (item is String && item.trim().isNotEmpty) item.trim(),
  ];
}

/// Matches the stored full English name back to an [AppLocale]. Unknown or
/// absent reads as null, which the UI shows as "follows the app language".
AppLocale? _language(String? raw) {
  final name = _clean(raw);
  if (name == null) return null;
  for (final locale in AppLocale.values) {
    if (locale.aiName == name) return locale;
    // Documents written by older clients stored the BCP-47 code instead.
    if (locale.code == name) return locale;
  }
  return null;
}
