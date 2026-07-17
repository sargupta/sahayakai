import 'package:flutter/foundation.dart';

import '../../../shared/domain/picker_options.dart';

/// The slice of the teacher's profile that `PATCH /api/user/profile` accepts:
/// education board, qualifications, and administrative role.
///
/// Lives in the Profile feature (which owns `users/<uid>`) and is imported by
/// Settings (P0.7), which edits this same slice from its own screen. ONE
/// definition, one wire mapping, two consumers — a second copy in Settings
/// would be a second place for the `preferredBoard` rename below to rot.
///
/// This is also the ONLY lane for [administrativeRole]: `firestore.rules` lists
/// it in `protectedUserFields()`, so a direct client-SDK write of it is denied
/// and it must travel through this Admin-SDK-backed route.
///
/// Every field is optional — a teacher who has not told us their board is not
/// an invalid teacher, and the endpoint only writes the keys it receives.
@immutable
class ProfileSettings {
  const ProfileSettings({
    this.educationBoard,
    this.qualifications = const <String>[],
    this.administrativeRole,
  });

  /// One of [kEducationBoards]; null means "not set".
  ///
  /// NAMING: the field is `educationBoard` here (and in `users/<uid>`) but it
  /// is sent to the API as `preferredBoard` — see [ProfileSettingsPatchDto].
  final String? educationBoard;

  /// A subset of [kQualifications]. Multi-select: a teacher can hold a B.Ed
  /// and an M.A and a NET.
  final List<String> qualifications;

  /// null means "not set", which is distinct from [AdministrativeRole.none]
  /// ("I am a teacher and hold no administrative role") — the first is an
  /// unanswered question, the second is an answer.
  final AdministrativeRole? administrativeRole;

  ProfileSettings copyWith({
    String? educationBoard,
    List<String>? qualifications,
    AdministrativeRole? administrativeRole,
    bool clearEducationBoard = false,
    bool clearAdministrativeRole = false,
  }) {
    return ProfileSettings(
      educationBoard:
          clearEducationBoard ? null : (educationBoard ?? this.educationBoard),
      qualifications: qualifications ?? this.qualifications,
      administrativeRole: clearAdministrativeRole
          ? null
          : (administrativeRole ?? this.administrativeRole),
    );
  }

  @override
  bool operator ==(Object other) =>
      other is ProfileSettings &&
      other.educationBoard == educationBoard &&
      listEquals(other.qualifications, qualifications) &&
      other.administrativeRole == administrativeRole;

  @override
  int get hashCode => Object.hash(
        educationBoard,
        Object.hashAll(qualifications),
        administrativeRole,
      );
}
