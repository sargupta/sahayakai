import 'package:json_annotation/json_annotation.dart';

import '../domain/parent_message.dart';

part 'parent_message_dtos.g.dart';

/// Serializes a [ParentMessageRequest] into the exact
/// `POST /api/ai/parent-message` body. `includeIfNull: false` drops the
/// optional fields the teacher left blank so the server applies its own
/// behaviour (it back-fills `teacherName` / `schoolName` from the profile).
///
/// The five required keys (`studentName`, `className`, `subject`, `reason`,
/// `parentLanguage`) are always present — the form validated them — so this
/// body can never trip the route's 400 `Missing required fields`. `userId`,
/// `performanceContext` and `performanceSummary` are server-injected and are
/// never sent. Pinned against `ParentMessageInputSchema` in `sahayakai-main`.
@JsonSerializable(includeIfNull: false, createFactory: false)
class ParentMessageRequestDto {
  const ParentMessageRequestDto({
    required this.studentName,
    required this.className,
    required this.subject,
    required this.reason,
    required this.parentLanguage,
    this.reasonContext,
    this.teacherNote,
    this.consecutiveAbsentDays,
    this.teacherName,
    this.schoolName,
  });

  factory ParentMessageRequestDto.fromDomain(ParentMessageRequest request) {
    // The absent-days count only belongs on an absence message; the backend
    // ignores it otherwise, so it is never sent for another reason.
    final absentDays =
        request.reason.isAbsence ? request.consecutiveAbsentDays : null;

    return ParentMessageRequestDto(
      studentName: request.studentName.trim(),
      className: request.className.trim(),
      subject: request.subject.trim(),
      reason: request.reason.wire,
      parentLanguage: request.parentLanguage.trim(),
      reasonContext: _clean(request.reasonContext),
      teacherNote: _clean(request.teacherNote),
      consecutiveAbsentDays: absentDays,
      teacherName: _clean(request.teacherName),
      schoolName: _clean(request.schoolName),
    );
  }

  final String studentName;
  final String className;
  final String subject;
  final String reason;
  final String parentLanguage;
  final String? reasonContext;
  final String? teacherNote;
  final int? consecutiveAbsentDays;
  final String? teacherName;
  final String? schoolName;

  Map<String, dynamic> toJson() => _$ParentMessageRequestDtoToJson(this);
}

/// The `/api/ai/parent-message` 200 payload: `{ message, languageCode,
/// wordCount }`. Every field is decoded defensively because the message body is
/// model-generated, so [toDomain] normalizes into the render model.
@JsonSerializable(createToJson: false)
class ParentMessageResponseDto {
  const ParentMessageResponseDto({
    this.message,
    this.languageCode,
    this.wordCount,
  });

  factory ParentMessageResponseDto.fromJson(Map<String, dynamic> json) =>
      _$ParentMessageResponseDtoFromJson(json);

  final String? message;
  final String? languageCode;

  /// The backend types this as a `number`; a tolerant `num` read copes with a
  /// `180.0` and floors it to an int.
  final num? wordCount;

  ParentMessage toDomain() {
    return ParentMessage(
      message: message?.trim() ?? '',
      languageCode: _clean(languageCode),
      wordCount: wordCount?.toInt(),
    );
  }
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}
