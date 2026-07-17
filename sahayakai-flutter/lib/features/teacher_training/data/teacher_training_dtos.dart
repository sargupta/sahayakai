import 'package:json_annotation/json_annotation.dart';

import '../domain/teacher_advice.dart';

part 'teacher_training_dtos.g.dart';

/// Serializes a [TeacherTrainingRequest] into the exact
/// `POST /api/ai/teacher-training` body. `includeIfNull: false` drops the
/// optional fields the teacher left blank so the server applies its own defaults
/// (the flow back-fills language from the profile).
///
/// `userId` is injected server-side from the verified token and is never sent
/// from the client. There is no `gradeLevel` key — the endpoint's input schema
/// has none. Pinned against `TeacherTrainingInputSchema` in `sahayakai-main`.
@JsonSerializable(includeIfNull: false, createFactory: false)
class TeacherTrainingRequestDto {
  const TeacherTrainingRequestDto({
    required this.question,
    this.subject,
    this.language,
  });

  factory TeacherTrainingRequestDto.fromDomain(TeacherTrainingRequest request) {
    return TeacherTrainingRequestDto(
      question: request.question.trim(),
      subject: _clean(request.subject),
      language: _clean(request.language),
    );
  }

  final String question;
  final String? subject;
  final String? language;

  Map<String, dynamic> toJson() => _$TeacherTrainingRequestDtoToJson(this);
}

/// The `/api/ai/teacher-training` 200 payload. The route returns exactly these
/// five keys (`introduction`, `advice`, `conclusion`, `gradeLevel`, `subject`);
/// every one is defensive because the advice is model-generated, so [toDomain]
/// normalizes into the render model.
@JsonSerializable(createToJson: false)
class TeacherTrainingResponseDto {
  const TeacherTrainingResponseDto({
    this.introduction,
    this.advice,
    this.conclusion,
    this.gradeLevel,
    this.subject,
  });

  factory TeacherTrainingResponseDto.fromJson(Map<String, dynamic> json) =>
      _$TeacherTrainingResponseDtoFromJson(json);

  final String? introduction;
  final List<TeacherAdvicePointDto>? advice;
  final String? conclusion;
  final String? gradeLevel;
  final String? subject;

  TeacherAdvice toDomain() {
    return TeacherAdvice(
      introduction: _clean(introduction) ?? '',
      advice: (advice ?? const <TeacherAdvicePointDto>[])
          .map((a) => a.toDomain())
          // A point with neither a strategy nor an explanation is a blank card;
          // drop it here so the list never renders one.
          .where((a) => a.hasContent)
          .toList(growable: false),
      conclusion: _clean(conclusion) ?? '',
      gradeLevel: _clean(gradeLevel),
      subject: _clean(subject),
    );
  }
}

@JsonSerializable(createToJson: false)
class TeacherAdvicePointDto {
  const TeacherAdvicePointDto({this.strategy, this.pedagogy, this.explanation});

  factory TeacherAdvicePointDto.fromJson(Map<String, dynamic> json) =>
      _$TeacherAdvicePointDtoFromJson(json);

  final String? strategy;
  final String? pedagogy;
  final String? explanation;

  TeacherAdvicePoint toDomain() => TeacherAdvicePoint(
        strategy: _clean(strategy) ?? '',
        pedagogy: _clean(pedagogy) ?? '',
        explanation: _clean(explanation) ?? '',
      );
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}
