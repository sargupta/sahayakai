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
/// `userId` is deliberately NOT modelled: the route reads it from the verified
/// token. `performanceSummary` is not modelled either — the route derives it
/// itself from [performanceContext]. [performanceContext] IS sent, but only by
/// the Parent Hotline, which fills it from the student's real assessment
/// records (the same snapshot the web's Contact-Parent modal sends); the
/// standalone composer never invents one. Verified against
/// `parent-message/route.ts` + `ParentMessageInputSchema` in `sahayakai-main`.
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
    this.performanceContext,
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

  /// The recent-assessment snapshot (`PerformanceContext` in
  /// `src/types/attendance.ts`: `{ recentAssessmentIds?, latestPercentage?,
  /// isAtRisk?, subjectBreakdown? }`) the route turns into the one-line
  /// "Recent academic results" the prompt may cite. Only ever built from real
  /// records; null when there are none.
  final Map<String, dynamic>? performanceContext;
}

/// The fully-decoded `/api/ai/parent-message` result. Field names match the
/// route handler's returned object exactly: `{ message, spokenScript,
/// languageCode, wordCount }`. Verified against `parent-message/route.ts` +
/// `ParentMessageOutputSchema` in `sahayakai-main`.
///
/// The [message] is the parent-facing text, WRITTEN IN [languageCode]'s
/// language — its script (Tamil, Bengali, ...) may differ from the app's UI
/// locale, so it is always rendered through the Indic-safe prose metrics.
@immutable
class ParentMessage {
  const ParentMessage({
    required this.message,
    this.spokenScript,
    this.languageCode,
    this.wordCount,
  });

  /// The ready-to-send message body, in the parent's language (<= 250 words).
  final String message;

  /// The phone-call rendition of [message] (<= 100 words, no salutation and no
  /// sign-off), in the same language. The Parent Hotline sends it on the
  /// outreach so the voice call speaks THIS rather than reading the written
  /// letter aloud. Null when the route returned none.
  final String? spokenScript;

  /// BCP-47 language code the model wrote in, e.g. `ta-IN`. May be absent.
  final String? languageCode;

  /// Approximate word count of the message. May be absent.
  final int? wordCount;

  /// The model can return an empty completion (a safety block surfaces as a
  /// 500, but a blank string is still possible); the view shows a dignified
  /// empty state rather than an empty card.
  bool get isEmpty => message.trim().isEmpty;
}
