import 'package:json_annotation/json_annotation.dart';

import '../domain/lesson_plan.dart';

part 'lesson_plan_dtos.g.dart';

/// Serializes a [LessonPlanRequest] into the exact `POST /api/ai/lesson-plan`
/// body. `includeIfNull: false` drops the optional fields the teacher left
/// blank so the server applies its own defaults.
@JsonSerializable(includeIfNull: false, createFactory: false)
class LessonPlanRequestDto {
  const LessonPlanRequestDto({
    required this.topic,
    this.gradeLevels,
    this.subject,
    this.language,
    this.resourceLevel,
    this.difficultyLevel,
    this.useRuralContext,
    this.imageDataUri,
  });

  factory LessonPlanRequestDto.fromDomain(LessonPlanRequest request) {
    final grades = request.gradeLevels
        .where((g) => g.trim().isNotEmpty)
        .toList(growable: false);
    final subject = request.subject?.trim();
    return LessonPlanRequestDto(
      topic: _topicWithEmphasis(request.topic.trim(), request.includes),
      gradeLevels: grades.isEmpty ? null : grades,
      subject: (subject == null || subject.isEmpty) ? null : subject,
      language: request.language,
      resourceLevel: request.resourceLevel.wire,
      difficultyLevel: request.difficultyLevel.wire,
      useRuralContext: request.useRuralContext,
      imageDataUri: request.imageDataUri,
    );
  }

  final String topic;
  final List<String>? gradeLevels;
  final String? subject;
  final String? language;
  final String? resourceLevel;
  final String? difficultyLevel;
  final bool? useRuralContext;
  final String? imageDataUri;

  Map<String, dynamic> toJson() => _$LessonPlanRequestDtoToJson(this);
}

/// Folds the teacher's chosen "Include" components (v3 05) into the topic the
/// model reads, as one plain emphasis line. The endpoint has no dedicated field
/// for them, so this is the honest channel — the model genuinely acts on it.
/// When nothing is selected the topic is returned untouched, so a plain
/// generation is byte-for-byte what it always was (no behaviour change, no
/// interference with the server-side NCERT chapter match).
String _topicWithEmphasis(String topic, Set<LessonInclude> includes) {
  if (includes.isEmpty) return topic;
  // Emit in a stable order so the wire body is deterministic (and testable),
  // regardless of the set's iteration order.
  final clauses = LessonInclude.values
      .where(includes.contains)
      .map((i) => i.emphasis)
      .join('; ');
  return '$topic\n\nPlease include: $clauses.';
}

/// The `/api/ai/lesson-plan` 200 payload. Every field is nullable/defensive
/// because the plan is model-generated; [toDomain] normalizes it into the
/// non-null render model.
@JsonSerializable(createToJson: false)
class LessonPlanResponseDto {
  const LessonPlanResponseDto({
    this.title,
    this.gradeLevel,
    this.duration,
    this.subject,
    this.objectives,
    this.keyVocabulary,
    this.materials,
    this.activities,
    this.assessment,
    this.homework,
    this.language,
    this.validationWarning,
  });

  factory LessonPlanResponseDto.fromJson(Map<String, dynamic> json) =>
      _$LessonPlanResponseDtoFromJson(json);

  final String? title;
  final String? gradeLevel;
  final String? duration;
  final String? subject;
  final List<String>? objectives;
  final List<VocabularyDto>? keyVocabulary;
  final List<String>? materials;
  final List<ActivityDto>? activities;
  final String? assessment;
  final String? homework;
  final String? language;
  final ValidationWarningDto? validationWarning;

  /// [raw] is the verbatim response body. The live generate path passes it, so
  /// a later "Save to Library" persists the model's own object; the Library's
  /// re-render path (`library_result_mapper.dart`) leaves it null, because a
  /// saved item is already saved and offers no Save action to feed.
  LessonPlan toDomain({Map<String, dynamic>? raw}) {
    return LessonPlan(
      raw: raw,
      title: _clean(title) ?? '',
      language: _clean(language) ?? 'English',
      gradeLevel: _clean(gradeLevel),
      duration: _clean(duration),
      subject: _clean(subject),
      objectives: _cleanList(objectives),
      keyVocabulary: (keyVocabulary ?? const <VocabularyDto>[])
          .map((v) => v.toDomain())
          .where((v) => v.term.isNotEmpty)
          .toList(growable: false),
      materials: _cleanList(materials),
      activities: (activities ?? const <ActivityDto>[])
          .map((a) => a.toDomain())
          .where((a) => a.name.isNotEmpty || a.description.isNotEmpty)
          .toList(growable: false),
      assessment: _clean(assessment),
      homework: _clean(homework),
      validationWarning: validationWarning?.toDomain(),
    );
  }
}

@JsonSerializable(createToJson: false)
class VocabularyDto {
  const VocabularyDto({this.term, this.meaning});

  factory VocabularyDto.fromJson(Map<String, dynamic> json) =>
      _$VocabularyDtoFromJson(json);

  final String? term;
  final String? meaning;

  VocabularyTerm toDomain() =>
      VocabularyTerm(term: _clean(term) ?? '', meaning: _clean(meaning) ?? '');
}

@JsonSerializable(createToJson: false)
class ActivityDto {
  const ActivityDto({
    this.phase,
    this.name,
    this.description,
    this.duration,
    this.teacherTips,
    this.understandingCheck,
  });

  factory ActivityDto.fromJson(Map<String, dynamic> json) =>
      _$ActivityDtoFromJson(json);

  final String? phase;
  final String? name;
  final String? description;
  final String? duration;
  final String? teacherTips;
  final String? understandingCheck;

  LessonActivity toDomain() => LessonActivity(
    phase: _clean(phase) ?? '',
    name: _clean(name) ?? '',
    description: _clean(description) ?? '',
    duration: _clean(duration),
    teacherTips: _clean(teacherTips),
    understandingCheck: _clean(understandingCheck),
  );
}

@JsonSerializable(createToJson: false)
class ValidationWarningDto {
  const ValidationWarningDto({this.invalid, this.lenient, this.message});

  factory ValidationWarningDto.fromJson(Map<String, dynamic> json) =>
      _$ValidationWarningDtoFromJson(json);

  final bool? invalid;
  final bool? lenient;
  final String? message;

  /// Only a warning that carries a message is worth surfacing.
  ValidationWarning? toDomain() {
    final text = _clean(message);
    if (text == null) return null;
    return ValidationWarning(message: text);
  }
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
