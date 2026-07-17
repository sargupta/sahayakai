import 'package:flutter/foundation.dart';

import '../../../core/i18n/app_locale.dart';
import 'profile_settings.dart';

/// The teacher's `users/<uid>` document, as this app reads and writes it.
///
/// Every field is optional. A teacher who has not told us their district is not
/// an invalid teacher — the whole document is built up over time, and the web's
/// own onboarding gate is OFF in production, so a signed-in teacher can reach
/// the app with nothing but a uid.
///
/// TWO WRITE LANES (verified against the backend; see [ProfileRepository]):
///   - [patchableSlice] -> `PATCH /api/user/profile` (Admin SDK, server-side).
///   - everything else  -> a direct `users/<uid>` merge write, which
///     `firestore.rules` permits for the owner.
/// The split is not a style choice: `administrativeRole` is in the rules'
/// `protectedUserFields()` and CANNOT be written by the client SDK, while
/// `state`/`district`/`pincode` are stripped by the REST route's Zod schema and
/// CANNOT be written over REST. Each field goes down the one lane that accepts
/// it.
@immutable
class TeacherProfile {
  const TeacherProfile({
    this.displayName,
    this.schoolName,
    this.state,
    this.district,
    this.subjects = const <String>[],
    this.gradeLevels = const <String>[],
    this.preferredLanguage,
    this.phoneNumber,
    this.pincode,
    this.settings = const ProfileSettings(),
  });

  /// Free text. The teacher's own name, as they want it shown.
  final String? displayName;

  /// Free text. Also the key the web's school -> location lookup groups on.
  final String? schoolName;

  /// One of `kIndianStates`; null means "not set".
  final String? state;

  /// Free text (the web auto-fills it from the pincode or the school lookup).
  final String? district;

  /// A subset of `kSubjects`.
  final List<String> subjects;

  /// A subset of `kGradeLevels`.
  ///
  /// WIRE-NAME TRAP: on the REST `POST` route this field is read as
  /// `teachingGradeLevels`, never `gradeLevels`. This app does not use that
  /// route (see [ProfileRepository]); the Firestore document key is
  /// `gradeLevels`, which is what this maps to.
  final List<String> gradeLevels;

  /// Mirrors the app's single [AppLocale] source of truth rather than being an
  /// independently editable field — see `ProfileScreen`. Null means the
  /// document has no language yet, or carries one this build does not know.
  final AppLocale? preferredLanguage;

  /// Indian mobile number, stored as the teacher typed it (minus surrounding
  /// space). Validated at the form, not here.
  final String? phoneNumber;

  /// Six-digit Indian PIN code.
  final String? pincode;

  /// The slice that `PATCH /api/user/profile` accepts: board, qualifications,
  /// administrative role. Shared verbatim with Settings (P0.7) so one field has
  /// exactly one wire mapping.
  final ProfileSettings settings;

  /// Convenience alias: the PATCH lane's payload.
  ProfileSettings get patchableSlice => settings;

  /// True when the document carries nothing worth showing — a teacher who has
  /// signed in but never completed onboarding. Drives the empty state.
  ///
  /// [preferredLanguage] is excluded on purpose: it is mirrored from the device
  /// locale picker, so a profile whose ONLY field is a language is still, from
  /// the teacher's point of view, an empty profile.
  bool get isEmpty =>
      _blank(displayName) &&
      _blank(schoolName) &&
      _blank(state) &&
      _blank(district) &&
      _blank(phoneNumber) &&
      _blank(pincode) &&
      subjects.isEmpty &&
      gradeLevels.isEmpty &&
      settings.educationBoard == null &&
      settings.qualifications.isEmpty &&
      settings.administrativeRole == null;

  static bool _blank(String? value) => value == null || value.trim().isEmpty;

  TeacherProfile copyWith({
    String? displayName,
    String? schoolName,
    String? state,
    String? district,
    List<String>? subjects,
    List<String>? gradeLevels,
    AppLocale? preferredLanguage,
    String? phoneNumber,
    String? pincode,
    ProfileSettings? settings,
    bool clearState = false,
  }) {
    return TeacherProfile(
      displayName: displayName ?? this.displayName,
      schoolName: schoolName ?? this.schoolName,
      state: clearState ? null : (state ?? this.state),
      district: district ?? this.district,
      subjects: subjects ?? this.subjects,
      gradeLevels: gradeLevels ?? this.gradeLevels,
      preferredLanguage: preferredLanguage ?? this.preferredLanguage,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      pincode: pincode ?? this.pincode,
      settings: settings ?? this.settings,
    );
  }

  @override
  bool operator ==(Object other) =>
      other is TeacherProfile &&
      other.displayName == displayName &&
      other.schoolName == schoolName &&
      other.state == state &&
      other.district == district &&
      listEquals(other.subjects, subjects) &&
      listEquals(other.gradeLevels, gradeLevels) &&
      other.preferredLanguage == preferredLanguage &&
      other.phoneNumber == phoneNumber &&
      other.pincode == pincode &&
      other.settings == settings;

  @override
  int get hashCode => Object.hash(
        displayName,
        schoolName,
        state,
        district,
        Object.hashAll(subjects),
        Object.hashAll(gradeLevels),
        preferredLanguage,
        phoneNumber,
        pincode,
        settings,
      );
}
