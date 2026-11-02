import 'package:flutter/foundation.dart';

import '../../core/i18n/app_locale.dart';

/// A neutral, tool-agnostic prefill payload threaded from a VIDYA
/// NAVIGATE_AND_FILL directive into a tool form ("I speak in Kannada → it opens
/// the tool with the fields filled").
///
/// It lives in `shared/` — NOT the vidya feature — so a tool screen depends on
/// this small value object rather than on a VIDYA DTO; the VIDYA nav dispatcher
/// builds it from a `VidyaDirective`. Every field is optional (the classifier
/// fills only what the teacher's sentence implied), so a screen seeds the fields
/// it recognises and ignores the rest.
///
/// [language] is a normalised ISO-2 code (e.g. `kn`), so it lines up with each
/// tool's language picker (`AppLocale.code`) — half the fix for the "form shows
/// English, output Hindi" bug (SPEC §A.8); the other half is the controller
/// never persisting an utterance's language to the profile.
@immutable
class ToolPrefill {
  const ToolPrefill({
    this.topic,
    this.gradeLevel,
    this.subject,
    this.language,
    this.questionCount,
    this.difficulty,
    this.autoSubmit = false,
  });

  /// The primary text field's seed (a lesson-plan / quiz topic, or an
  /// instant-answer question).
  final String? topic;

  /// A grade the classifier resolved (e.g. `Class 10`). A screen applies it only
  /// when it is one of its known grades, so an unrecognised value never crashes
  /// a strict dropdown.
  final String? gradeLevel;

  /// A subject the classifier resolved (e.g. `Science`). Applied only when known.
  final String? subject;

  /// The prefill language as a normalised ISO-2 code (or null), matching the
  /// tool's language picker.
  final String? language;

  /// How many questions a quiz request asked for ("ten-question quiz"). A quiz
  /// applies it only inside its own bounds.
  final int? questionCount;

  /// The difficulty a request named, as `easy`, `medium` or `hard`. Applied only
  /// by a tool that offers that choice.
  final String? difficulty;

  /// The voice path's RUN verb: when true, a tool screen that receives this
  /// prefill and finds its required field populated auto-runs generation (no
  /// finger on Generate) — the last inch of "speak → result". The VIDYA nav
  /// dispatcher sets it on every voice-originated directive; a manual tool-grid
  /// open passes no prefill (or one with this `false`), so a teacher who tapped
  /// a tile is never surprised by an auto-generation. It is a *dispatch intent*,
  /// not extracted field data, so it is deliberately excluded from [isEmpty] (a
  /// fieldless prefill is still empty and carries nothing to auto-run on).
  final bool autoSubmit;

  /// This prefill with the fields it leaves out taken from [base]: a spoken
  /// change to an open tool ("make it for Class 5") keeps the rest of what was
  /// asked. A new topic is a new request, so only the class and the language
  /// carry over to it.
  ToolPrefill over(ToolPrefill base) {
    final newTopic = topic != null && topic != base.topic;
    return ToolPrefill(
      topic: topic ?? base.topic,
      gradeLevel: gradeLevel ?? base.gradeLevel,
      subject: subject ?? (newTopic ? null : base.subject),
      language: language ?? base.language,
      questionCount: questionCount ?? (newTopic ? null : base.questionCount),
      difficulty: difficulty ?? (newTopic ? null : base.difficulty),
      autoSubmit: autoSubmit,
    );
  }

  /// The filled fields, as VIDYA's screen context sends them (`uiState`), so a
  /// follow-up is understood against what the open tool is making.
  Map<String, Object> toUiState() => {
    'topic': ?topic,
    'gradeLevel': ?gradeLevel,
    'subject': ?subject,
    'language': ?language,
    'questionCount': ?questionCount,
    'difficulty': ?difficulty,
  };

  /// True when no field was extracted — the screen then behaves exactly as an
  /// un-prefilled open, so existing call sites and tests are unaffected.
  /// [autoSubmit] is intentionally not part of this: an intent to run with no
  /// data to run on is still empty.
  bool get isEmpty =>
      topic == null &&
      gradeLevel == null &&
      subject == null &&
      language == null &&
      questionCount == null &&
      difficulty == null;

  @override
  bool operator ==(Object other) =>
      other is ToolPrefill &&
      other.topic == topic &&
      other.gradeLevel == gradeLevel &&
      other.subject == subject &&
      other.language == language &&
      other.questionCount == questionCount &&
      other.difficulty == difficulty &&
      other.autoSubmit == autoSubmit;

  @override
  int get hashCode => Object.hash(
    topic,
    gradeLevel,
    subject,
    language,
    questionCount,
    difficulty,
    autoSubmit,
  );
}

/// The [AppLocale] a prefill's ISO-2 [code] maps to, or null when [code] is null
/// or not one of the 11 supported languages. Unlike [AppLocale.fromCode] (which
/// defaults unknowns to English) this returns null so a tool leaves its current
/// language untouched rather than silently switching to English.
AppLocale? prefillLocale(String? code) {
  if (code == null) return null;
  for (final locale in AppLocale.values) {
    if (locale.code == code) return locale;
  }
  return null;
}
