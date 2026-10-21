import 'package:flutter/foundation.dart';

/// The teacher's VIDYA profile — the `jarvis` sub-object on the user doc.
///
/// Read/written by `GET/POST /api/vidya/profile` and sent as `teacherProfile`
/// on `/api/assistant`. The profile route validates a **strict** Zod schema
/// (`.strict()`, unknown keys 400), so [toJson] emits only these keys and drops
/// nulls (the route also drops null before the Firestore merge).
///
/// PROFILE-POISONING GUARD (SPEC §A.7): `preferredLanguage` here is the app's
/// deliberate language, NOT the language of a one-off utterance. The controller
/// (U-V3) must never persist a spoken utterance's detected language into this
/// profile — a Kannada question must not flip the whole app to Kannada.
@immutable
class VidyaProfile {
  const VidyaProfile({
    this.preferredGrade,
    this.preferredSubject,
    this.preferredLanguage,
    this.preferredBoard,
    this.schoolContext,
    this.lastActiveAt,
  });

  final String? preferredGrade;
  final String? preferredSubject;
  final String? preferredLanguage;
  final String? preferredBoard;
  final String? schoolContext;
  final int? lastActiveAt;

  bool get isEmpty =>
      preferredGrade == null &&
      preferredSubject == null &&
      preferredLanguage == null &&
      preferredBoard == null &&
      schoolContext == null &&
      lastActiveAt == null;

  Map<String, dynamic> toJson() => {
        if (preferredGrade != null) 'preferredGrade': preferredGrade,
        if (preferredSubject != null) 'preferredSubject': preferredSubject,
        if (preferredLanguage != null) 'preferredLanguage': preferredLanguage,
        if (preferredBoard != null) 'preferredBoard': preferredBoard,
        if (schoolContext != null) 'schoolContext': schoolContext,
        if (lastActiveAt != null) 'lastActiveAt': lastActiveAt,
      };

  /// Parses the `profile` object from `GET /api/vidya/profile`. A null / absent
  /// object (`{ "profile": null }`, the first-visit case) returns null.
  static VidyaProfile? fromJson(Map<String, dynamic>? json) {
    if (json == null) return null;
    final profile = VidyaProfile(
      preferredGrade: _s(json['preferredGrade']),
      preferredSubject: _s(json['preferredSubject']),
      preferredLanguage: _s(json['preferredLanguage']),
      preferredBoard: _s(json['preferredBoard']),
      schoolContext: _s(json['schoolContext']),
      lastActiveAt: json['lastActiveAt'] is int ? json['lastActiveAt'] as int : null,
    );
    return profile;
  }

  @override
  bool operator ==(Object other) =>
      other is VidyaProfile &&
      other.preferredGrade == preferredGrade &&
      other.preferredSubject == preferredSubject &&
      other.preferredLanguage == preferredLanguage &&
      other.preferredBoard == preferredBoard &&
      other.schoolContext == schoolContext &&
      other.lastActiveAt == lastActiveAt;

  @override
  int get hashCode => Object.hash(preferredGrade, preferredSubject,
      preferredLanguage, preferredBoard, schoolContext, lastActiveAt);
}

String? _s(Object? v) {
  if (v is! String) return null;
  final t = v.trim();
  return t.isEmpty ? null : t;
}
