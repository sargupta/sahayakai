import 'package:flutter/foundation.dart';

/// How well-equipped the classroom is. The AI tailors the materials list and
/// activity design to what the teacher actually has on hand.
enum ResourceLevel {
  low('low'),
  medium('medium'),
  high('high');

  const ResourceLevel(this.wire);

  /// The exact enum member the `/api/ai/lesson-plan` endpoint expects.
  final String wire;
}

/// The cognitive stretch the plan should aim for.
enum DifficultyLevel {
  remedial('remedial'),
  standard('standard'),
  advanced('advanced');

  const DifficultyLevel(this.wire);

  /// The exact enum member the `/api/ai/lesson-plan` endpoint expects.
  final String wire;
}

/// Immutable input the teacher assembles on the form. The repository turns
/// this into the request DTO; `userId`, `state` and `district` are injected by
/// the server from the profile and are deliberately NOT part of this model.
@immutable
class LessonPlanRequest {
  const LessonPlanRequest({
    required this.topic,
    required this.language,
    this.gradeLevels = const <String>[],
    this.subject,
    this.resourceLevel = ResourceLevel.low,
    this.difficultyLevel = DifficultyLevel.standard,
    this.useRuralContext = true,
    this.imageDataUri,
  });

  final String topic;

  /// Full English language name the endpoint expects (e.g. `Kannada`), sourced
  /// from [AppLocale.aiName].
  final String language;
  final List<String> gradeLevels;
  final String? subject;
  final ResourceLevel resourceLevel;
  final DifficultyLevel difficultyLevel;
  final bool useRuralContext;

  /// Optional photo of a textbook page, as a `data:<mime>;base64,<data>` URI.
  /// When present the flow treats it as the primary content to plan from (the
  /// rural "photograph the page" path); omitted from the request when null.
  final String? imageDataUri;
}

/// A single vocabulary term and its plain-language meaning.
@immutable
class VocabularyTerm {
  const VocabularyTerm({required this.term, required this.meaning});

  final String term;
  final String meaning;
}

/// One step of the 5E instructional model (Engage, Explore, Explain,
/// Elaborate, Evaluate).
@immutable
class LessonActivity {
  const LessonActivity({
    required this.phase,
    required this.name,
    required this.description,
    this.duration,
    this.teacherTips,
    this.understandingCheck,
  });

  final String phase;
  final String name;
  final String description;
  final String? duration;
  final String? teacherTips;
  final String? understandingCheck;
}

/// A lenient safety/validation note the model attaches when it proceeded on a
/// borderline topic. Shown as an informational banner, never a hard error.
@immutable
class ValidationWarning {
  const ValidationWarning({required this.message});

  final String message;
}

/// The fully-rendered lesson plan the result view draws.
@immutable
class LessonPlan {
  const LessonPlan({
    required this.title,
    required this.language,
    this.gradeLevel,
    this.duration,
    this.subject,
    this.objectives = const <String>[],
    this.keyVocabulary = const <VocabularyTerm>[],
    this.materials = const <String>[],
    this.activities = const <LessonActivity>[],
    this.assessment,
    this.homework,
    this.validationWarning,
    this.raw,
  });

  final String title;
  final String language;
  final String? gradeLevel;
  final String? duration;
  final String? subject;
  final List<String> objectives;
  final List<VocabularyTerm> keyVocabulary;
  final List<String> materials;
  final List<LessonActivity> activities;
  final String? assessment;
  final String? homework;
  final ValidationWarning? validationWarning;

  /// The verbatim `/api/ai/lesson-plan` response body, kept so a later "Save to
  /// Library" can persist EXACTLY the object the server-side flow persists as
  /// `data` (`LessonPlanOutputSchema`, see
  /// `sahayakai-main/src/ai/flows/lesson-plan-generator.ts`) rather than a
  /// re-serialized domain object that would quietly drop any field this app
  /// does not model. Null for a plan that did not come from a live generation
  /// (a Library item re-rendered read-only, or a test fixture) — and the Save
  /// action is withheld in exactly that case.
  final Map<String, dynamic>? raw;
}
