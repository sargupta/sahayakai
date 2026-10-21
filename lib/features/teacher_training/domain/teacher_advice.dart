import 'package:flutter/foundation.dart';

/// Immutable input the teacher assembles on the form.
///
/// Only `question` is required. The server injects `userId` from the verified
/// Firebase token (`TeacherTrainingInputSchema` parses `{ ...json, userId }`),
/// so it is deliberately NOT modelled here — a client that sent its own would be
/// both wrong and a trust-boundary hole. There is no `gradeLevel` field: the
/// endpoint's input schema has none (the model infers it), so the form does not
/// offer one. Verified against `TeacherTrainingInputSchema` in `sahayakai-main`.
@immutable
class TeacherTrainingRequest {
  const TeacherTrainingRequest({
    required this.question,
    this.subject,
    this.language,
  });

  /// The teacher's professional-development question. Required by the endpoint,
  /// which caps it at [kMaxTeacherTrainingQuestionLength] characters, so the
  /// form caps it first (a counter beats a rejected request).
  final String question;

  final String? subject;

  /// Full English language name the endpoint expects (e.g. `Kannada`),
  /// sourced from [AppLocale.aiName].
  final String? language;
}

/// The endpoint's input cap (`TeacherTrainingInputSchema`:
/// `question: z.string().max(2000)`). `.max()` REJECTS over-length input (it
/// does not clamp), so the field is capped at 2000 client-side.
const int kMaxTeacherTrainingQuestionLength = 2000;

/// One piece of coaching advice: a concrete strategy, the pedagogical principle
/// behind it, and an explanation of why it works. Field names match the
/// endpoint's `advice[]` objects exactly: `strategy`, `pedagogy`, `explanation`.
/// Every field is nullable-tolerant at the DTO edge because the advice is
/// model-generated.
@immutable
class TeacherAdvicePoint {
  const TeacherAdvicePoint({
    required this.strategy,
    required this.pedagogy,
    required this.explanation,
  });

  /// A clear, actionable technique the teacher can use.
  final String strategy;

  /// The name of the core pedagogical principle behind the strategy
  /// (e.g. `Constructivism`, `Scaffolding`). May be blank.
  final String pedagogy;

  /// Why the principle works, often with an analogy. May be blank.
  final String explanation;

  /// A point with neither a strategy nor an explanation carries nothing worth a
  /// card; the DTO drops it so the list never gains a blank tile.
  bool get hasContent => strategy.isNotEmpty || explanation.isNotEmpty;
}

/// The fully-decoded `/api/ai/teacher-training` result. Field names match the
/// route handler's returned object exactly: `introduction`, `advice[{ strategy,
/// pedagogy, explanation }]`, `conclusion`, `gradeLevel`, `subject`. Verified
/// against `TeacherTrainingOutputSchema` + the route handler in `sahayakai-main`.
/// See docs/flutter/HANDOFF.md.
@immutable
class TeacherAdvice {
  const TeacherAdvice({
    required this.introduction,
    this.advice = const <TeacherAdvicePoint>[],
    required this.conclusion,
    this.gradeLevel,
    this.subject,
    this.raw,
  });

  /// A brief, empathetic opener acknowledging the question.
  final String introduction;

  /// The list of advice points.
  final List<TeacherAdvicePoint> advice;

  /// A closing, encouraging statement.
  final String conclusion;

  final String? gradeLevel;
  final String? subject;

  /// The verbatim `/api/ai/teacher-training` response body, kept so a later
  /// "Save to Library" persists EXACTLY the object the server-side flow
  /// persists as `data` (`src/ai/flows/teacher-training.ts`) rather than a
  /// re-serialized domain object that would quietly drop any field this app
  /// does not model. Null for advice that did not come from a live ask (a
  /// Library item re-rendered read-only, or a test fixture) — and the Save
  /// action is withheld in exactly that case.
  final Map<String, dynamic>? raw;

  /// True when the model returned nothing worth rendering — the view shows a
  /// dignified empty state rather than a blank card.
  bool get isEmpty =>
      introduction.isEmpty && advice.isEmpty && conclusion.isEmpty;
}
