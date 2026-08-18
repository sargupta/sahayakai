import 'dart:math' as math;

import 'package:flutter/foundation.dart';

/// What the grader should do with the photo. The [wire] values are the exact
/// enum members `/api/ai/assess-assignment` accepts
/// (`AssessAssignmentInputSchema.mode`, `z.enum(['full','transcribe','score'])`,
/// default `full`). Never localize the wire value; only the surrounding label
/// is localized.
///
///   - [full]        — transcribe, then score against the rubric (all 5 stages).
///   - [transcribe]  — return only the literal transcript stage.
///   - [score]       — grade the [AssessAssignmentRequest.editedTranscript] the
///                     teacher pasted instead of re-reading the image.
enum AssessmentMode {
  full('full'),
  transcribe('transcribe'),
  score('score');

  const AssessmentMode(this.wire);

  final String wire;

  /// Tolerant parse — an unknown or absent value degrades to [full] (the
  /// backend default) rather than throwing.
  static AssessmentMode fromWire(String? wire) {
    for (final m in AssessmentMode.values) {
      if (m.wire == wire) return m;
    }
    return AssessmentMode.full;
  }
}

/// One performance level of a rubric criterion. Mirrors the backend
/// `RubricGeneratorOutputSchema` level shape (`{ name, description, points }`);
/// `points` is `z.number()`, so it is a [num] (a decimal is legal).
@immutable
class AssessmentRubricLevel {
  const AssessmentRubricLevel({
    required this.name,
    this.description,
    this.points,
  });

  final String name;
  final String? description;
  final num? points;
}

/// One criterion of the rubric applied to the work.
@immutable
class AssessmentRubricCriterion {
  const AssessmentRubricCriterion({
    required this.name,
    this.description,
    this.levels = const <AssessmentRubricLevel>[],
  });

  final String name;
  final String? description;
  final List<AssessmentRubricLevel> levels;
}

/// A rubric to grade against, matching the backend `RubricGeneratorOutput`
/// shape. It is BOTH the optional object a teacher may attach to a request AND
/// the rubric the server echoes back in the result (so the teacher can see what
/// the grade was measured against). When omitted from a request the server
/// grades against its own general 4-criterion rubric.
@immutable
class AssessmentRubric {
  const AssessmentRubric({
    required this.title,
    this.description,
    this.criteria = const <AssessmentRubricCriterion>[],
    this.gradeLevel,
    this.subject,
  });

  final String title;
  final String? description;
  final List<AssessmentRubricCriterion> criteria;
  final String? gradeLevel;
  final String? subject;

  /// Serializes to the exact wire object `AssessAssignmentInputSchema`'s
  /// `rubricSnapshot` (= `RubricGeneratorOutputSchema`) expects. Levels carry
  /// `points` verbatim; `gradeLevel`/`subject` are nullable.
  Map<String, dynamic> toJson() => <String, dynamic>{
    'title': title,
    'description': description ?? '',
    'criteria': [
      for (final c in criteria)
        <String, dynamic>{
          'name': c.name,
          'description': c.description ?? '',
          'levels': [
            for (final l in c.levels)
              <String, dynamic>{
                'name': l.name,
                'description': l.description ?? '',
                if (l.points != null) 'points': l.points,
              },
          ],
        },
    ],
    'gradeLevel': gradeLevel,
    'subject': subject,
  };
}

/// Immutable input the teacher assembles on the form.
///
/// `imageDataUri` is REQUIRED by the backend schema (a student-work photo). The
/// server injects `userId` and `teacherContext` from the verified token, and it
/// STRIPS `studentName` before the model, so none of those are modelled here.
/// No student name or handle is sent at all — grading needs none. Verified
/// against `AssessAssignmentInputSchema` in `sahayakai-main`.
@immutable
class AssessAssignmentRequest {
  const AssessAssignmentRequest({
    required this.imageDataUri,
    this.mode = AssessmentMode.full,
    this.language,
    this.rubric,
    this.editedTranscript,
  });

  /// A `data:image/<jpeg|png|webp>;base64,<data>` URI. Required; the endpoint
  /// caps it at 14 MB AND rejects any mime other than jpeg/png/webp (see
  /// `kMaxImageDataUriBytes` + docs/flutter/HANDOFF.md).
  final String imageDataUri;

  /// What to do with the photo. Always sent (default [AssessmentMode.full]).
  final AssessmentMode mode;

  /// Full English language name the endpoint expects (e.g. `Kannada`), sourced
  /// from [AppLocale.aiName]. Optional; the server falls back to the profile.
  final String? language;

  /// An optional rubric to grade against. Omitted by the current form (there is
  /// no saved-rubric picker yet — see docs/flutter/HANDOFF.md); the plumbing is
  /// ready so a picker can attach one without a contract change.
  final AssessmentRubric? rubric;

  /// A teacher-corrected transcript to grade instead of re-reading the image;
  /// only meaningful for [AssessmentMode.score]. Optional (capped 50k server).
  final String? editedTranscript;
}

/// One criterion's score row. Mirrors the backend `PerCriterionScoreSchema`
/// (`{ criterionName, level, points, maxPoints, feedback, confidence }`).
/// `points`/`maxPoints` are [num] (`z.number()`); `confidence` is 0.0–1.0 and a
/// value below [lowConfidenceThreshold] surfaces a warning per the schema.
@immutable
class CriterionScore {
  const CriterionScore({
    required this.criterionName,
    this.level,
    this.points,
    this.maxPoints,
    this.feedback,
    this.confidence,
  });

  final String criterionName;
  final String? level;
  final num? points;
  final num? maxPoints;
  final String? feedback;
  final double? confidence;

  /// The schema's rule: a per-criterion confidence below 0.5 is surfaced as a
  /// warning in the UI.
  static const double lowConfidenceThreshold = 0.5;

  bool get isLowConfidence =>
      confidence != null && confidence! < lowConfidenceThreshold;
}

/// The full `/api/ai/assess-assignment` result — a scorecard. Field names match
/// `AssessAssignmentOutputSchema` exactly. Every field is defensive because the
/// output is model-generated and, in `transcribe` mode, the score-side fields
/// may be empty even though the schema nominally requires them: the render
/// treats an empty score / empty criteria as "no score to show" and leads with
/// the transcript. See docs/flutter/HANDOFF.md.
@immutable
class Assessment {
  const Assessment({
    this.rawTranscript,
    this.editedTranscript,
    this.overallScore,
    this.pointsEarned,
    this.pointsPossible,
    this.perCriterionScores = const <CriterionScore>[],
    this.strengths = const <String>[],
    this.improvements = const <String>[],
    this.nextSteps = const <String>[],
    this.teacherNote,
    this.confidenceOverall,
    this.warnings = const <String>[],
    this.rubric,
    this.language,
    this.raw,
  });

  /// The verbatim `/api/ai/assess-assignment` response body, kept so a later
  /// "Save to Library" persists EXACTLY the object the server-side flow
  /// persists as `data` (`src/ai/flows/assignment-assessor.ts`) rather than a
  /// re-serialized domain object that would quietly drop any field this app
  /// does not model (`assessmentId`, `createdAtIso`, `studentId`, …). Null for
  /// an assessment that did not come from a live run (a Library item re-rendered
  /// read-only, or a test fixture) — and the Save action is withheld in exactly
  /// that case.
  final Map<String, dynamic>? raw;

  /// The literal transcription of the student's handwriting. May carry
  /// `[BLANK]` / `[???]` markers verbatim from the model.
  final String? rawTranscript;
  final String? editedTranscript;

  /// 0–100. Present whenever the work was scored.
  final num? overallScore;
  final num? pointsEarned;
  final num? pointsPossible;
  final List<CriterionScore> perCriterionScores;
  final List<String> strengths;
  final List<String> improvements;
  final List<String> nextSteps;

  /// One short paragraph the teacher can read aloud to the student.
  final String? teacherNote;

  /// Overall self-rated model confidence, 0.0–1.0.
  final double? confidenceOverall;

  /// Machine-readable advisories: `page_appears_blank` | `low_contrast` |
  /// `partial_writing` | `language_mismatch`.
  final List<String> warnings;

  /// The rubric the grade was measured against (echoed by the server).
  final AssessmentRubric? rubric;
  final String? language;

  /// True when a numeric grade is worth showing (a scored result, not a
  /// transcribe-only pass).
  bool get hasScore =>
      overallScore != null ||
      perCriterionScores.isNotEmpty ||
      (pointsPossible != null && pointsPossible! > 0);

  /// The transcript to display: the teacher's edit wins over the raw reading.
  String? get displayTranscript {
    final edited = editedTranscript?.trim();
    if (edited != null && edited.isNotEmpty) return edited;
    final raw = rawTranscript?.trim();
    if (raw != null && raw.isNotEmpty) return raw;
    return null;
  }

  /// True when the model returned nothing worth rendering — the view shows a
  /// dignified empty state rather than a blank card.
  bool get isEmpty =>
      !hasScore &&
      displayTranscript == null &&
      strengths.isEmpty &&
      improvements.isEmpty &&
      nextSteps.isEmpty &&
      (teacherNote == null || teacherNote!.trim().isEmpty) &&
      warnings.isEmpty;

  /// The overall score clamped to 0–100 and rounded for display, or null.
  int? get scorePercent {
    final value = overallScore;
    if (value == null) return null;
    return value.clamp(0, 100).round();
  }

  /// The overall confidence as a 0–100 percentage, or null.
  int? get confidencePercent => _asPercent(confidenceOverall);

  static int? _asPercent(double? value) {
    if (value == null) return null;
    return (value.clamp(0.0, 1.0) * 100).round();
  }

  /// The widest criterion max, used only for defensive bar scaling.
  num get maxCriterionPoints =>
      perCriterionScores.fold<num>(0, (m, c) => math.max(m, c.maxPoints ?? 0));
}
