import 'package:flutter/foundation.dart';

/// A teacher row in "People You May Know" / the directory
/// (`src/types/community.ts::TeacherSuggestion`). Returned by
/// `getRecommendedTeachersAction` and `getAllTeachersAction`, already
/// PII-stripped server-side (no email/phone/tokens — see the §E PII rule).
@immutable
class TeacherSuggestion {
  const TeacherSuggestion({
    required this.uid,
    required this.displayName,
    this.photoURL,
    this.initial,
    this.schoolName,
    this.subjects = const <String>[],
    this.gradeLevels = const <String>[],
    this.bio,
    this.impactScore,
    this.followersCount,
    this.recommendationReason,
  });

  final String uid;
  final String displayName;
  final String? photoURL;

  /// A single-letter avatar fallback when [photoURL] is null.
  final String? initial;
  final String? schoolName;
  final List<String> subjects;
  final List<String> gradeLevels;
  final String? bio;
  final int? impactScore;
  final int? followersCount;

  /// Why this teacher was surfaced (e.g. "Same school", "Teaches Science") —
  /// rendered as an overline/badge.
  final String? recommendationReason;

  @override
  bool operator ==(Object other) =>
      other is TeacherSuggestion &&
      other.uid == uid &&
      other.displayName == displayName &&
      other.photoURL == photoURL &&
      other.initial == initial &&
      other.schoolName == schoolName &&
      listEquals(other.subjects, subjects) &&
      listEquals(other.gradeLevels, gradeLevels) &&
      other.bio == bio &&
      other.impactScore == impactScore &&
      other.followersCount == followersCount &&
      other.recommendationReason == recommendationReason;

  @override
  int get hashCode => Object.hash(
        uid,
        displayName,
        photoURL,
        initial,
        schoolName,
        Object.hashAll(subjects),
        Object.hashAll(gradeLevels),
        bio,
        impactScore,
        followersCount,
        recommendationReason,
      );
}

/// The PII-safe public profile of another teacher
/// (`getPublicProfileAction` — `src/app/actions/profile.ts`).
///
/// **[email] is only present when the caller is the same user, an admin, or has
/// an accepted [MutualConnection]** (F10-02, enforced server-side). Flutter must
/// go through this wrapped action and NEVER read `users/*` directly, or the
/// bulk-harvest PII hole reopens (§E). The fields here are exactly the
/// server-side allowlist — nothing more can be surfaced.
@immutable
class PublicProfile {
  const PublicProfile({
    required this.id,
    required this.displayName,
    this.photoURL,
    this.bio,
    this.state,
    this.district,
    this.schoolType,
    this.schoolName,
    this.resourceLevel,
    this.subjects = const <String>[],
    this.languages = const <String>[],
    this.gradeLevels = const <String>[],
    this.qualifications = const <String>[],
    this.yearsOfExperience,
    this.verifiedStatus,
    this.careerStage,
    this.email,
  });

  final String id;
  final String displayName;
  final String? photoURL;
  final String? bio;
  final String? state;
  final String? district;
  final String? schoolType;
  final String? schoolName;
  final String? resourceLevel;
  final List<String> subjects;
  final List<String> languages;
  final List<String> gradeLevels;
  final List<String> qualifications;
  final int? yearsOfExperience;
  final String? verifiedStatus;
  final String? careerStage;

  /// PII — non-null ONLY when the caller is self/admin/mutually-connected. The
  /// Message button and email row gate on this being present.
  final String? email;

  bool get hasEmail => email != null && email!.isNotEmpty;

  @override
  bool operator ==(Object other) =>
      other is PublicProfile &&
      other.id == id &&
      other.displayName == displayName &&
      other.photoURL == photoURL &&
      other.bio == bio &&
      other.state == state &&
      other.district == district &&
      other.schoolType == schoolType &&
      other.schoolName == schoolName &&
      other.resourceLevel == resourceLevel &&
      listEquals(other.subjects, subjects) &&
      listEquals(other.languages, languages) &&
      listEquals(other.gradeLevels, gradeLevels) &&
      listEquals(other.qualifications, qualifications) &&
      other.yearsOfExperience == yearsOfExperience &&
      other.verifiedStatus == verifiedStatus &&
      other.careerStage == careerStage &&
      other.email == email;

  @override
  int get hashCode => Object.hashAll(<Object?>[
        id,
        displayName,
        photoURL,
        bio,
        state,
        district,
        schoolType,
        schoolName,
        resourceLevel,
        Object.hashAll(subjects),
        Object.hashAll(languages),
        Object.hashAll(gradeLevels),
        Object.hashAll(qualifications),
        yearsOfExperience,
        verifiedStatus,
        careerStage,
        email,
      ]);
}
