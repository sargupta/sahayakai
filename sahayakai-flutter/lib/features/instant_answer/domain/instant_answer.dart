import 'package:flutter/foundation.dart';

/// Immutable input the teacher assembles on the form. `userId` is injected by
/// the server from the verified Firebase token (see the endpoint's
/// `InstantAnswerInputSchema`, which parses `{...json, userId}`) and is
/// deliberately NOT modelled here — a client that sent its own would be both
/// wrong and a trust-boundary hole.
@immutable
class InstantAnswerRequest {
  const InstantAnswerRequest({
    required this.question,
    this.gradeLevel,
    this.subject,
    this.language,
  });

  /// The teacher's question. Required by the endpoint; the flow rejects
  /// anything over [kMaxQuestionLength] characters, so the form caps it first.
  final String question;

  final String? gradeLevel;
  final String? subject;

  /// Full English language name the endpoint expects (e.g. `Kannada`),
  /// sourced from [AppLocale.aiName].
  final String? language;
}

/// The flow's own input cap (`src/ai/flows/instant-answer.ts`: "Question too
/// long (max 4000 characters)"). Enforced client-side so the teacher sees a
/// counter instead of a 500.
const int kMaxQuestionLength = 4000;

/// The fully-decoded `/api/ai/instant-answer` result.
///
/// [videoSuggestionUrl] is optional on the wire *and* model-generated, so it is
/// normalized to a validated http(s) [Uri] in the DTO layer — never a raw
/// string. The result view must handle the null case.
@immutable
class InstantAnswer {
  const InstantAnswer({
    required this.answer,
    this.videoSuggestionUrl,
    this.gradeLevel,
    this.subject,
  });

  /// The main body. Markdown — rendered through the app's own renderer.
  final String answer;

  /// A YouTube suggestion the model may attach. Null far more often than not.
  final Uri? videoSuggestionUrl;

  final String? gradeLevel;
  final String? subject;

  /// False when the model returned nothing usable, so the view shows the
  /// "rephrase" empty state rather than a blank card.
  bool get hasAnswer => answer.trim().isNotEmpty;
}
