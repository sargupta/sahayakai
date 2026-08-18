import 'package:json_annotation/json_annotation.dart';

import '../../domain/teacher.dart';
import 'dto_helpers.dart';

part 'teacher_dto.g.dart';

/// Decodes a `TeacherSuggestion` (`src/types/community.ts::TeacherSuggestion`)
/// from `getRecommendedTeachersAction` / `getAllTeachersAction`. Already
/// PII-stripped server-side.
@JsonSerializable(createToJson: false)
class TeacherSuggestionDto {
  const TeacherSuggestionDto({
    this.uid,
    this.displayName,
    this.photoURL,
    this.initial,
    this.schoolName,
    this.subjects,
    this.gradeLevels,
    this.bio,
    this.impactScore,
    this.followersCount,
    this.recommendationReason,
  });

  factory TeacherSuggestionDto.fromJson(Map<String, dynamic> json) =>
      _$TeacherSuggestionDtoFromJson(json);

  final String? uid;
  final String? displayName;
  final String? photoURL;
  final String? initial;
  final String? schoolName;
  final List<dynamic>? subjects;
  final List<dynamic>? gradeLevels;
  final String? bio;
  final num? impactScore;
  final num? followersCount;
  final String? recommendationReason;

  TeacherSuggestion toDomain() => TeacherSuggestion(
        uid: uid?.trim() ?? '',
        displayName: displayName?.trim() ?? '',
        photoURL: cleanString(photoURL),
        initial: cleanString(initial),
        schoolName: cleanString(schoolName),
        subjects: stringList(subjects),
        gradeLevels: stringList(gradeLevels),
        bio: cleanString(bio),
        impactScore: impactScore?.toInt(),
        followersCount: followersCount?.toInt(),
        recommendationReason: cleanString(recommendationReason),
      );
}

/// Decodes the `getPublicProfileAction` reply
/// (`{ profile: {...} | null, certifications: [...] }`) into a [PublicProfile].
/// **`email` is only present when the caller is self/admin/mutually-connected**
/// (server-enforced) — the DM/email gate reads [PublicProfile.hasEmail].
@JsonSerializable(createToJson: false)
class PublicProfileResponseDto {
  const PublicProfileResponseDto({this.profile});

  factory PublicProfileResponseDto.fromJson(Map<String, dynamic> json) =>
      _$PublicProfileResponseDtoFromJson(json);

  final Map<String, dynamic>? profile;

  /// null when the target profile does not exist (`{ profile: null }`).
  PublicProfile? toDomain() {
    final p = profile;
    if (p == null) return null;
    final id = (p['id'] as String?)?.trim() ?? (p['uid'] as String?)?.trim();
    if (id == null || id.isEmpty) return null;
    return PublicProfile(
      id: id,
      displayName: (p['displayName'] as String?)?.trim() ?? '',
      photoURL: cleanString(p['photoURL'] as String?),
      bio: cleanString(p['bio'] as String?),
      state: cleanString(p['state'] as String?),
      district: cleanString(p['district'] as String?),
      schoolType: cleanString(p['schoolType'] as String?),
      schoolName: cleanString(p['schoolName'] as String?),
      resourceLevel: cleanString(p['resourceLevel'] as String?),
      subjects: stringList(p['subjects']),
      languages: stringList(p['languages']),
      gradeLevels: stringList(p['gradeLevels']),
      qualifications: stringList(p['qualifications']),
      yearsOfExperience: asInt(p['yearsOfExperience']),
      verifiedStatus: cleanString(p['verifiedStatus']?.toString()),
      careerStage: cleanString(p['careerStage'] as String?),
      email: cleanString(p['email'] as String?),
    );
  }
}
