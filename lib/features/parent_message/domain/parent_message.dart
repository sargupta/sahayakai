import 'package:flutter/foundation.dart';

/// Why the teacher is reaching out to the parent. The wire values match the
/// backend's `ParentMessageInputSchema.reason` enum EXACTLY — verified against
/// `src/ai/flows/parent-message-generator.ts` in `sahayakai-main`:
///
///   z.enum(['consecutive_absences', 'poor_performance',
///           'behavioral_concern', 'positive_feedback'])
///
/// The label is teacher-facing prose (localized via `AppLocalizations`); the
/// [wire] token is the API enum value. `reason` is REQUIRED by the route (it
/// 400s without it), so there is no "not set" member — the form validates a
/// selection before it can submit.
enum ParentMessageReason {
  consecutiveAbsences('consecutive_absences'),
  poorPerformance('poor_performance'),
  behavioralConcern('behavioral_concern'),
  positiveFeedback('positive_feedback');

  const ParentMessageReason(this.wire);

  /// The exact token `POST /api/ai/parent-message` expects for `reason`.
  final String wire;

  /// The absent-days count is only meaningful for an absence message; the form
  /// shows that numeric field only when this is the selected reason.
  bool get isAbsence => this == ParentMessageReason.consecutiveAbsences;
}

/// The message the teacher assembles on the form.
///
/// The five fields the route requires (`studentName`, `className`, `subject`,
/// `reason`, `parentLanguage`) are non-nullable here — the form validates them
/// before building this — so a request that reaches the wire can never trip the
/// backend's 400 `Missing required fields`. The rest are optional.
///
/// Server-injected fields are deliberately NOT modelled: the route reads
/// `userId` from the verified token, and `performanceContext` /
/// `performanceSummary` are populated by the web's Contact-Parent modal from a
/// class's assessment records, not by this composer. A client that sent its own
/// would be both wrong and a trust-boundary hole. Verified against
/// `parent-message/route.ts` + `ParentMessageInputSchema` in `sahayakai-main`.
/// See docs/flutter/HANDOFF.md.
@immutable
class ParentMessageRequest {
  const ParentMessageRequest({
    required this.studentName,
    required this.className,
    required this.subject,
    required this.reason,
    required this.parentLanguage,
    this.reasonContext,
    this.teacherNote,
    this.consecutiveAbsentDays,
    this.teacherName,
    this.schoolName,
  });

  /// The student the message is about. Required.
  final String studentName;

  /// The class, e.g. "Class 6A". Required.
  final String className;

  /// The subject the teacher teaches. Required.
  final String subject;

  /// Why the teacher is writing. Required (drives the whole message tone).
  final ParentMessageReason reason;

  /// The language the MESSAGE is written in — the parent's language, the full
  /// English name the endpoint expects (e.g. `Tamil`), sourced from
  /// [AppLocale.aiName]. Required, and deliberately DISTINCT from the app's UI
  /// locale: a teacher using the app in English still drafts a Tamil message
  /// for a Tamil-speaking parent.
  final String parentLanguage;

  /// Free-text context for the situation.
  ///
  /// CONTRACT NOTE (see docs/flutter/HANDOFF.md): the route does NOT require
  /// this, and the default (Genkit) production path OVERWRITES it server-side
  /// with a reason-derived template, so it only influences the output on the
  /// sidecar path. Kept as an optional field the teacher can fill; a blank
  /// value is omitted from the request.
  final String? reasonContext;

  /// An optional note from the teacher with specific details. Unlike
  /// [reasonContext], the default path DOES cite this in the message.
  final String? teacherNote;

  /// Consecutive absent days — only meaningful when [reason] is an absence.
  final int? consecutiveAbsentDays;

  /// The teacher's name for the sign-off. Optional: the server back-fills it
  /// from the profile when absent.
  final String? teacherName;

  /// The school name for context. Optional: server back-fills from the profile.
  final String? schoolName;
}

/// The fully-decoded `/api/ai/parent-message` result. Field names match the
/// route handler's returned object exactly: `{ message, languageCode,
/// wordCount }`. Verified against `parent-message/route.ts` +
/// `ParentMessageOutputSchema` in `sahayakai-main`.
///
/// The [message] is the parent-facing text, WRITTEN IN [languageCode]'s
/// language — its script (Tamil, Bengali, ...) may differ from the app's UI
/// locale, so it is always rendered through the Indic-safe prose metrics.
@immutable
class ParentMessage {
  const ParentMessage({
    required this.message,
    this.languageCode,
    this.wordCount,
  });

  /// The ready-to-send message body, in the parent's language (<= 250 words).
  final String message;

  /// BCP-47 language code the model wrote in, e.g. `ta-IN`. May be absent.
  final String? languageCode;

  /// Approximate word count of the message. May be absent.
  final int? wordCount;

  /// The model can return an empty completion (a safety block surfaces as a
  /// 500, but a blank string is still possible); the view shows a dignified
  /// empty state rather than an empty card.
  bool get isEmpty => message.trim().isEmpty;
}
