import 'package:json_annotation/json_annotation.dart';

import '../domain/worksheet.dart';

part 'worksheet_dtos.g.dart';

/// Serializes a [WorksheetRequest] into the exact `POST /api/ai/worksheet`
/// body. `includeIfNull: false` drops the optional fields the teacher left
/// blank so the server applies its own defaults. `userId` and `teacherContext`
/// are injected server-side from the verified token and are never sent from the
/// client. Pinned against `WorksheetWizardInputSchema` in `sahayakai-main`.
@JsonSerializable(includeIfNull: false, createFactory: false)
class WorksheetRequestDto {
  const WorksheetRequestDto({
    required this.imageDataUri,
    required this.prompt,
    this.gradeLevel,
    this.subject,
    this.language,
  });

  factory WorksheetRequestDto.fromDomain(WorksheetRequest request) {
    return WorksheetRequestDto(
      // The data URI is sent verbatim: the server validates its exact length.
      imageDataUri: request.imageDataUri,
      prompt: request.prompt.trim(),
      gradeLevel: _blankToNull(request.gradeLevel),
      subject: _blankToNull(request.subject),
      language: _blankToNull(request.language),
    );
  }

  final String imageDataUri;
  final String prompt;
  final String? gradeLevel;
  final String? subject;
  final String? language;

  Map<String, dynamic> toJson() => _$WorksheetRequestDtoToJson(this);
}

/// The `/api/ai/worksheet` 200 payload. Every field is defensive because the
/// worksheet is model-generated; [toDomain] normalizes it into the render
/// model. Field names mirror the route's returned object exactly — in
/// particular `learningObjectives` (NOT `objectives`) and an `answerKey` of
/// `{ activityIndex, answer }` entries. See docs/flutter/HANDOFF.md.
@JsonSerializable(createToJson: false)
class WorksheetResponseDto {
  const WorksheetResponseDto({
    this.title,
    this.gradeLevel,
    this.subject,
    this.learningObjectives,
    this.studentInstructions,
    this.activities,
    this.answerKey,
  });

  factory WorksheetResponseDto.fromJson(Map<String, dynamic> json) =>
      _$WorksheetResponseDtoFromJson(json);

  final String? title;
  final String? gradeLevel;
  final String? subject;
  final List<String>? learningObjectives;
  final String? studentInstructions;
  final List<WorksheetActivityDto>? activities;
  final List<AnswerKeyEntryDto>? answerKey;

  Worksheet toDomain() {
    return Worksheet(
      title: _clean(title) ?? '',
      gradeLevel: _clean(gradeLevel),
      subject: _clean(subject),
      learningObjectives: _cleanList(learningObjectives),
      studentInstructions: _clean(studentInstructions),
      activities: (activities ?? const <WorksheetActivityDto>[])
          .map((a) => a.toDomain())
          .where((a) => a.content.isNotEmpty)
          .toList(growable: false),
      answerKey: (answerKey ?? const <AnswerKeyEntryDto>[])
          .map((a) => a.toDomain())
          .where((a) => a.answer.isNotEmpty)
          .toList(growable: false),
    );
  }
}

@JsonSerializable(createToJson: false)
class WorksheetActivityDto {
  const WorksheetActivityDto({
    this.type,
    this.content,
    this.explanation,
    this.chalkboardNote,
  });

  factory WorksheetActivityDto.fromJson(Map<String, dynamic> json) =>
      _$WorksheetActivityDtoFromJson(json);

  final String? type;
  final String? content;
  final String? explanation;
  final String? chalkboardNote;

  WorksheetActivity toDomain() => WorksheetActivity(
        content: _clean(content) ?? '',
        type: WorksheetActivityType.fromWire(type),
        explanation: _clean(explanation),
        chalkboardNote: _clean(chalkboardNote),
      );
}

@JsonSerializable(createToJson: false)
class AnswerKeyEntryDto {
  const AnswerKeyEntryDto({this.activityIndex, this.answer});

  factory AnswerKeyEntryDto.fromJson(Map<String, dynamic> json) =>
      _$AnswerKeyEntryDtoFromJson(json);

  final int? activityIndex;
  final String? answer;

  AnswerKeyEntry toDomain() => AnswerKeyEntry(
        answer: _clean(answer) ?? '',
        activityIndex: activityIndex,
      );
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

List<String> _cleanList(List<String>? values) {
  if (values == null) return const <String>[];
  return values
      .map((v) => v.trim())
      .where((v) => v.isNotEmpty)
      .toList(growable: false);
}

String? _blankToNull(String? value) => _clean(value);
