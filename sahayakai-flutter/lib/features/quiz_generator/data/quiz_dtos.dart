import 'package:json_annotation/json_annotation.dart';

import '../domain/quiz.dart';

part 'quiz_dtos.g.dart';

/// Serializes a [QuizRequest] into the exact `POST /api/ai/quiz` body.
/// `includeIfNull: false` drops the optional fields the teacher left blank so
/// the server applies its own defaults. `userId` is injected server-side from
/// the verified token and is never sent from the client.
@JsonSerializable(includeIfNull: false, createFactory: false)
class QuizRequestDto {
  const QuizRequestDto({
    required this.topic,
    required this.questionTypes,
    required this.numQuestions,
    this.gradeLevel,
    this.subject,
    this.language,
    this.targetDifficulty,
    this.bloomsTaxonomyLevels,
    this.imageDataUri,
  });

  factory QuizRequestDto.fromDomain(QuizRequest request) {
    final blooms = request.bloomsTaxonomyLevels
        .map((b) => b.trim())
        .where((b) => b.isNotEmpty)
        .toList(growable: false);
    return QuizRequestDto(
      topic: request.topic.trim(),
      questionTypes: request.questionTypes
          .map((t) => t.wire)
          .toList(growable: false),
      numQuestions: request.numQuestions,
      gradeLevel: _blankToNull(request.gradeLevel),
      subject: _blankToNull(request.subject),
      language: _blankToNull(request.language),
      targetDifficulty: request.targetDifficulty?.wire,
      bloomsTaxonomyLevels: blooms.isEmpty ? null : blooms,
      imageDataUri: request.imageDataUri,
    );
  }

  final String topic;
  final List<String> questionTypes;
  final int numQuestions;
  final String? gradeLevel;
  final String? subject;
  final String? language;
  final String? targetDifficulty;
  final List<String>? bloomsTaxonomyLevels;
  final String? imageDataUri;

  Map<String, dynamic> toJson() => _$QuizRequestDtoToJson(this);
}

/// The `/api/ai/quiz` 200 payload — three nullable difficulty variants plus
/// shared metadata. Every field is defensive because the quiz is
/// model-generated; [toDomain] normalizes it into the render model.
@JsonSerializable(createToJson: false)
class QuizResponseDto {
  const QuizResponseDto({
    this.easy,
    this.medium,
    this.hard,
    this.id,
    this.gradeLevel,
    this.subject,
    this.topic,
    this.isSaved,
    this.validationWarning,
  });

  factory QuizResponseDto.fromJson(Map<String, dynamic> json) =>
      _$QuizResponseDtoFromJson(json);

  final QuizVariantDto? easy;
  final QuizVariantDto? medium;
  final QuizVariantDto? hard;
  final String? id;
  final String? gradeLevel;
  final String? subject;
  final String? topic;
  final bool? isSaved;
  final QuizValidationWarningDto? validationWarning;

  /// [raw] is the verbatim response body. Pass it on the live generate path so
  /// a later Save persists the exact object the flow persists; omit it when
  /// decoding an already-saved item, which has nothing left to save.
  Quiz toDomain({Map<String, dynamic>? raw}) {
    final variants = <QuizVariant>[];
    for (final entry in <QuizDifficulty, QuizVariantDto?>{
      QuizDifficulty.easy: easy,
      QuizDifficulty.medium: medium,
      QuizDifficulty.hard: hard,
    }.entries) {
      final variant = entry.value?.toDomain(entry.key);
      // A variant with no questions is not worth a tab.
      if (variant != null && variant.questions.isNotEmpty) {
        variants.add(variant);
      }
    }
    return Quiz(
      variants: List<QuizVariant>.unmodifiable(variants),
      id: _clean(id),
      gradeLevel: _clean(gradeLevel),
      subject: _clean(subject),
      topic: _clean(topic),
      isSaved: isSaved ?? false,
      validationWarning: validationWarning?.toDomain(),
      raw: raw,
    );
  }
}

@JsonSerializable(createToJson: false)
class QuizVariantDto {
  const QuizVariantDto({
    this.title,
    this.questions,
    this.teacherInstructions,
    this.gradeLevel,
    this.subject,
  });

  factory QuizVariantDto.fromJson(Map<String, dynamic> json) =>
      _$QuizVariantDtoFromJson(json);

  final String? title;
  final List<QuestionDto>? questions;
  final String? teacherInstructions;
  final String? gradeLevel;
  final String? subject;

  QuizVariant toDomain(QuizDifficulty difficulty) => QuizVariant(
    difficulty: difficulty,
    title: _clean(title) ?? '',
    questions: (questions ?? const <QuestionDto>[])
        .map((q) => q.toDomain())
        .where((q) => q.questionText.isNotEmpty)
        .toList(growable: false),
    teacherInstructions: _clean(teacherInstructions),
    gradeLevel: _clean(gradeLevel),
    subject: _clean(subject),
  );
}

@JsonSerializable(createToJson: false)
class QuestionDto {
  const QuestionDto({
    this.questionText,
    this.questionType,
    this.options,
    this.correctAnswer,
    this.explanation,
    this.difficultyLevel,
  });

  factory QuestionDto.fromJson(Map<String, dynamic> json) =>
      _$QuestionDtoFromJson(json);

  final String? questionText;
  final String? questionType;
  final List<String>? options;
  final String? correctAnswer;
  final String? explanation;
  final String? difficultyLevel;

  Question toDomain() => Question(
    questionText: _clean(questionText) ?? '',
    correctAnswer: _clean(correctAnswer) ?? '',
    questionType: QuestionType.fromWire(questionType),
    options: _cleanList(options),
    explanation: _clean(explanation),
    difficultyLevel: QuizDifficulty.fromWire(difficultyLevel),
  );
}

@JsonSerializable(createToJson: false)
class QuizValidationWarningDto {
  const QuizValidationWarningDto({this.invalid, this.lenient, this.message});

  factory QuizValidationWarningDto.fromJson(Map<String, dynamic> json) =>
      _$QuizValidationWarningDtoFromJson(json);

  final bool? invalid;
  final bool? lenient;
  final String? message;

  /// Only a warning that carries a message is worth surfacing.
  QuizValidationWarning? toDomain() {
    final text = _clean(message);
    if (text == null) return null;
    return QuizValidationWarning(message: text);
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

String? _blankToNull(String? value) => _clean(value);
