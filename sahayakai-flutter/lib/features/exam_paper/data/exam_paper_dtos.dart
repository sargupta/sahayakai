import 'package:json_annotation/json_annotation.dart';

import '../domain/exam_paper.dart';

part 'exam_paper_dtos.g.dart';

/// Serializes an [ExamPaperRequest] into the exact `POST /api/ai/exam-paper`
/// body. `board` / `gradeLevel` / `subject` are required; `chapters` is always
/// sent (an empty array is a valid "all chapters" signal for a blueprinted
/// combo, and the route defaults a missing/non-array field to `[]` anyway).
/// `difficulty` / `includeAnswerKey` / `includeMarkingScheme` carry the form's
/// values (the server has its own defaults if omitted, but they are never
/// blank here). `userId` and `teacherContext` are injected server-side from the
/// verified token and are never sent from the client; `duration` / `maxMarks`
/// default from the blueprint and are not sent. Pinned against
/// `ExamPaperInputSchema` in `sahayakai-main`.
@JsonSerializable(includeIfNull: false, createFactory: false)
class ExamPaperRequestDto {
  const ExamPaperRequestDto({
    required this.board,
    required this.gradeLevel,
    required this.subject,
    required this.chapters,
    required this.difficulty,
    required this.includeAnswerKey,
    required this.includeMarkingScheme,
    this.language,
  });

  factory ExamPaperRequestDto.fromDomain(ExamPaperRequest request) {
    return ExamPaperRequestDto(
      board: request.board.trim(),
      gradeLevel: request.gradeLevel.trim(),
      subject: request.subject.trim(),
      chapters: request.chapters
          .map((c) => c.trim())
          .where((c) => c.isNotEmpty)
          .toList(growable: false),
      difficulty: request.difficulty.wire,
      includeAnswerKey: request.includeAnswerKey,
      includeMarkingScheme: request.includeMarkingScheme,
      language: _blankToNull(request.language),
    );
  }

  final String board;
  final String gradeLevel;
  final String subject;
  final List<String> chapters;
  final String difficulty;
  final bool includeAnswerKey;
  final bool includeMarkingScheme;
  final String? language;

  Map<String, dynamic> toJson() => _$ExamPaperRequestDtoToJson(this);
}

/// The `/api/ai/exam-paper` 200 payload. Every field is defensive because the
/// paper is model-generated; [toDomain] normalizes it into the render model.
/// Field names mirror the route's returned object exactly.
@JsonSerializable(createToJson: false)
class ExamPaperResponseDto {
  const ExamPaperResponseDto({
    this.title,
    this.board,
    this.subject,
    this.gradeLevel,
    this.duration,
    this.maxMarks,
    this.generalInstructions,
    this.sections,
    this.blueprintSummary,
    this.pyqSources,
  });

  factory ExamPaperResponseDto.fromJson(Map<String, dynamic> json) =>
      _$ExamPaperResponseDtoFromJson(json);

  /// Decode a raw response body into the sealed [ExamPaperResult].
  ///
  /// A **202 `generation_in_progress`** body carries an `error` field and no
  /// paper; it is a SUCCESS status to Dio (< 400), so it arrives here rather
  /// than as a thrown exception. Detect it by the `error` marker and return the
  /// distinct in-progress state instead of trying to parse a paper out of it.
  /// A real 200 never carries an `error` field.
  static ExamPaperResult resultFrom(Map<String, dynamic> json) {
    if (json['error'] == 'generation_in_progress') {
      final message = _clean(json['message'] as String?);
      return ExamPaperInProgress(message: message);
    }
    return ExamPaperReady(
      paper: ExamPaperResponseDto.fromJson(json).toDomain(),
      raw: json,
    );
  }

  final String? title;
  final String? board;
  final String? subject;
  final String? gradeLevel;
  final String? duration;
  final num? maxMarks;
  final List<String>? generalInstructions;
  final List<ExamSectionDto>? sections;
  final BlueprintSummaryDto? blueprintSummary;
  final List<PyqSourceDto>? pyqSources;

  ExamPaper toDomain() {
    return ExamPaper(
      title: _clean(title) ?? '',
      board: _clean(board) ?? '',
      subject: _clean(subject) ?? '',
      gradeLevel: _clean(gradeLevel) ?? '',
      duration: _clean(duration),
      maxMarks: maxMarks,
      generalInstructions: (generalInstructions ?? const <String>[])
          .map(_clean)
          .whereType<String>()
          .toList(growable: false),
      sections: (sections ?? const <ExamSectionDto>[])
          .map((s) => s.toDomain())
          .where((s) => s.name.isNotEmpty || s.questions.isNotEmpty)
          .toList(growable: false),
      blueprintSummary: blueprintSummary?.toDomain(),
      pyqSources: (pyqSources ?? const <PyqSourceDto>[])
          .map((p) => p.toDomain())
          .whereType<PyqSource>()
          .toList(growable: false),
    );
  }
}

@JsonSerializable(createToJson: false)
class ExamSectionDto {
  const ExamSectionDto({
    this.name,
    this.label,
    this.totalMarks,
    this.questions,
  });

  factory ExamSectionDto.fromJson(Map<String, dynamic> json) =>
      _$ExamSectionDtoFromJson(json);

  final String? name;
  final String? label;
  final num? totalMarks;
  final List<ExamQuestionDto>? questions;

  ExamSection toDomain() => ExamSection(
        name: _clean(name) ?? '',
        label: _clean(label),
        totalMarks: totalMarks,
        questions: (questions ?? const <ExamQuestionDto>[])
            .map((q) => q.toDomain())
            .where((q) => q.text.isNotEmpty)
            .toList(growable: false),
      );
}

@JsonSerializable(createToJson: false)
class ExamQuestionDto {
  const ExamQuestionDto({
    this.number,
    this.text,
    this.marks,
    this.options,
    this.internalChoice,
    this.answerKey,
    this.markingScheme,
    this.source,
  });

  factory ExamQuestionDto.fromJson(Map<String, dynamic> json) =>
      _$ExamQuestionDtoFromJson(json);

  final num? number;
  final String? text;
  final num? marks;
  final List<String>? options;
  final String? internalChoice;
  final String? answerKey;
  final String? markingScheme;
  final String? source;

  ExamQuestion toDomain() => ExamQuestion(
        number: number,
        text: _clean(text) ?? '',
        marks: marks,
        options: (options ?? const <String>[])
            .map(_clean)
            .whereType<String>()
            .toList(growable: false),
        internalChoice: _clean(internalChoice),
        answerKey: _clean(answerKey),
        markingScheme: _clean(markingScheme),
        source: _clean(source),
      );
}

@JsonSerializable(createToJson: false)
class BlueprintSummaryDto {
  const BlueprintSummaryDto({this.chapterWise, this.difficultyWise});

  factory BlueprintSummaryDto.fromJson(Map<String, dynamic> json) =>
      _$BlueprintSummaryDtoFromJson(json);

  final List<ChapterWeightDto>? chapterWise;
  final List<DifficultyWeightDto>? difficultyWise;

  BlueprintSummary toDomain() => BlueprintSummary(
        chapterWise: (chapterWise ?? const <ChapterWeightDto>[])
            .map((c) => c.toDomain())
            .whereType<ChapterWeight>()
            .toList(growable: false),
        difficultyWise: (difficultyWise ?? const <DifficultyWeightDto>[])
            .map((d) => d.toDomain())
            .whereType<DifficultyWeight>()
            .toList(growable: false),
      );
}

@JsonSerializable(createToJson: false)
class ChapterWeightDto {
  const ChapterWeightDto({this.chapter, this.marks});

  factory ChapterWeightDto.fromJson(Map<String, dynamic> json) =>
      _$ChapterWeightDtoFromJson(json);

  final String? chapter;
  final num? marks;

  ChapterWeight? toDomain() {
    final name = _clean(chapter);
    if (name == null) return null;
    return ChapterWeight(chapter: name, marks: marks);
  }
}

@JsonSerializable(createToJson: false)
class DifficultyWeightDto {
  const DifficultyWeightDto({this.level, this.percentage});

  factory DifficultyWeightDto.fromJson(Map<String, dynamic> json) =>
      _$DifficultyWeightDtoFromJson(json);

  final String? level;
  final num? percentage;

  DifficultyWeight? toDomain() {
    final name = _clean(level);
    if (name == null) return null;
    return DifficultyWeight(level: name, percentage: percentage);
  }
}

@JsonSerializable(createToJson: false)
class PyqSourceDto {
  const PyqSourceDto({this.id, this.year, this.chapter});

  factory PyqSourceDto.fromJson(Map<String, dynamic> json) =>
      _$PyqSourceDtoFromJson(json);

  final String? id;
  final num? year;
  final String? chapter;

  PyqSource? toDomain() {
    final sourceId = _clean(id);
    final chapterName = _clean(chapter);
    // A source with no id and no chapter carries nothing worth a row.
    if (sourceId == null && chapterName == null) return null;
    return PyqSource(
      id: sourceId ?? '',
      year: year?.toInt(),
      chapter: chapterName,
    );
  }
}

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

String? _blankToNull(String? value) => _clean(value);
