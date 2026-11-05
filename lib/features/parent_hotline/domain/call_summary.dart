import 'package:flutter/foundation.dart';

/// How the parent came across on the call, as classified by the summary AI
/// flow (`src/ai/flows/parent-call-agent.ts`). Wire values mirror
/// `src/types/attendance.ts` → `CallSummary.parentSentiment` EXACTLY:
///
///   'cooperative' | 'concerned' | 'grateful' | 'upset' | 'indifferent' |
///   'confused'
///
/// The value is model-generated, so [fromWire] is tolerant: an unrecognised or
/// null token resolves to NULL — "not known" — rather than throwing or being
/// silently relabelled. The summary must never fail to render because the model
/// coined a new adjective, and it must never tell the teacher a parent was
/// "reserved" when nothing said so; an unknown sentiment is simply not shown.
enum ParentSentiment {
  cooperative('cooperative'),
  concerned('concerned'),
  grateful('grateful'),
  upset('upset'),
  indifferent('indifferent'),
  confused('confused');

  const ParentSentiment(this.wire);

  /// The exact token the backend writes for this sentiment.
  final String wire;

  /// Tolerant decode: null / unknown → null (not known; hidden). Never throws.
  static ParentSentiment? fromWire(String? wire) {
    for (final s in ParentSentiment.values) {
      if (s.wire == wire) return s;
    }
    return null;
  }
}

/// The overall texture of the call, from the same summary flow. Wire values
/// mirror `CallSummary.callQuality` EXACTLY:
///
///   'productive' | 'brief' | 'difficult' | 'unanswered'
///
/// Tolerant [fromWire]: null / unknown → null. An unrecognised quality is not
/// known, so it is not reported — not even as the mildest member.
enum CallQuality {
  productive('productive'),
  brief('brief'),
  difficult('difficult'),
  unanswered('unanswered');

  const CallQuality(this.wire);

  final String wire;

  /// Tolerant decode: null / unknown → null. Never throws.
  static CallQuality? fromWire(String? wire) {
    for (final q in CallQuality.values) {
      if (q.wire == wire) return q;
    }
    return null;
  }
}

/// Who spoke a transcript turn. The wire uses `'agent'` for the AI school
/// representative and `'parent'` for the parent (`TranscriptTurn.role` in
/// `src/types/attendance.ts`).
enum TranscriptRole {
  agent('agent'),
  parent('parent');

  const TranscriptRole(this.wire);

  final String wire;

  /// Tolerant decode: null / unknown → null. An unattributable line is shown
  /// without a speaker rather than credited to either side: crediting it to the
  /// AI would misreport what the school said, and to the parent would put
  /// words in their mouth. Never throws.
  static TranscriptRole? fromWire(String? wire) {
    for (final r in TranscriptRole.values) {
      if (r.wire == wire) return r;
    }
    return null;
  }
}

/// One line of the call transcript. Mirrors `src/types/attendance.ts` →
/// `TranscriptTurn`: `{ role: 'agent' | 'parent', text, timestamp }`.
@immutable
class TranscriptTurn {
  const TranscriptTurn({
    required this.role,
    required this.text,
    required this.timestamp,
  });

  /// Who spoke, or null when the transcript did not say.
  final TranscriptRole? role;
  final String text;

  /// ISO-8601 timestamp string, as written server-side. Kept as the raw string
  /// (no `DateTime` parse) — it is display/ordering metadata, and the summary
  /// text itself already arrives localized.
  final String timestamp;

  @override
  bool operator ==(Object other) =>
      other is TranscriptTurn &&
      other.role == role &&
      other.text == text &&
      other.timestamp == timestamp;

  @override
  int get hashCode => Object.hash(role, text, timestamp);
}

/// The structured AI summary of a completed parent call — the payload the
/// premium `DocumentSheet` renders. Mirrors `src/types/attendance.ts` →
/// `CallSummary` name-for-name.
///
/// The list fields are decoded defensively: the backend guarantees
/// [actionItemsForTeacher] has at least one item, but the DTO layer tolerates
/// an empty array (a malformed summary should degrade to an empty section, not
/// crash the sheet). The prose fields arrive already localized to the teacher's
/// language and are rendered as-is (never re-translated).
@immutable
class CallSummary {
  const CallSummary({
    required this.parentResponse,
    this.parentConcerns = const [],
    this.parentCommitments = const [],
    this.actionItemsForTeacher = const [],
    this.guidanceGiven = const [],
    this.parentSentiment,
    this.callQuality,
    this.followUpNeeded = false,
    this.followUpSuggestion,
    this.generatedAt,
  });

  /// 1–2 sentence recap, in the TEACHER's language.
  final String parentResponse;
  final List<String> parentConcerns;
  final List<String> parentCommitments;

  /// The teacher's to-dos. The server guarantees ≥1; the client tolerates 0.
  final List<String> actionItemsForTeacher;
  final List<String> guidanceGiven;

  /// How the parent came across, or null when the summary did not say (or used
  /// a word the app does not know). Null is hidden, never guessed.
  final ParentSentiment? parentSentiment;

  /// The texture of the call, or null when not known.
  final CallQuality? callQuality;
  final bool followUpNeeded;
  final String? followUpSuggestion;

  /// ISO-8601 string of when the summary was generated. May be absent.
  final String? generatedAt;

  @override
  bool operator ==(Object other) =>
      other is CallSummary &&
      other.parentResponse == parentResponse &&
      listEquals(other.parentConcerns, parentConcerns) &&
      listEquals(other.parentCommitments, parentCommitments) &&
      listEquals(other.actionItemsForTeacher, actionItemsForTeacher) &&
      listEquals(other.guidanceGiven, guidanceGiven) &&
      other.parentSentiment == parentSentiment &&
      other.callQuality == callQuality &&
      other.followUpNeeded == followUpNeeded &&
      other.followUpSuggestion == followUpSuggestion &&
      other.generatedAt == generatedAt;

  @override
  int get hashCode => Object.hash(
        parentResponse,
        Object.hashAll(parentConcerns),
        Object.hashAll(parentCommitments),
        Object.hashAll(actionItemsForTeacher),
        Object.hashAll(guidanceGiven),
        parentSentiment,
        callQuality,
        followUpNeeded,
        followUpSuggestion,
        generatedAt,
      );
}
