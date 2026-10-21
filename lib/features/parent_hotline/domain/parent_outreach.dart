import 'package:flutter/foundation.dart';

import 'call_summary.dart';

/// Why the teacher is reaching out to the parent. Wire values mirror
/// `src/types/attendance.ts` → `OutreachReason` EXACTLY:
///
///   'consecutive_absences' | 'poor_performance' | 'behavioral_concern' |
///   'positive_feedback'
///
/// (Identical to the `parent_message` feature's `ParentMessageReason`, kept as
/// a distinct enum so the hotline domain mirrors `attendance.ts` name-for-name.)
///
/// [wire] is the API token; [fromWire] is tolerant (unknown / null → the safe
/// default [consecutiveAbsences]) so a decode of a hand-edited or future doc
/// never throws — mirroring the `VidyaFlow.fromWire` guard. Note none of the
/// four hotline routes return `reason` in their responses (it is a create-
/// request field), so [fromWire] exists for symmetry + forward-compat.
enum OutreachReason {
  consecutiveAbsences('consecutive_absences'),
  poorPerformance('poor_performance'),
  behavioralConcern('behavioral_concern'),
  positiveFeedback('positive_feedback');

  const OutreachReason(this.wire);

  /// The exact token `POST /api/attendance/outreach` expects for `reason`.
  final String wire;

  /// Tolerant decode: null / unknown → [consecutiveAbsences]. Never throws.
  static OutreachReason fromWire(String? wire) {
    for (final r in OutreachReason.values) {
      if (r.wire == wire) return r;
    }
    return OutreachReason.consecutiveAbsences;
  }
}

/// The lifecycle status of the outreach call. Wire values mirror
/// `src/types/attendance.ts` → `CallStatus` EXACTLY:
///
///   'initiated' | 'completed' | 'failed' | 'no_answer' | 'busy' | 'manual'
///
/// - `initiated`  — Twilio call placed, conversation in flight (poll for more).
/// - `completed`  — call finished; a `callSummary` should follow.
/// - `failed` / `no_answer` / `busy` — terminal, no conversation.
/// - `manual`     — WhatsApp-copy path; no call was placed.
///
/// [fromWire] is tolerant: null / unknown → [failed]. A safe *terminal*
/// default is deliberate — an unrecognised status must never leave the calling
/// stage spinning forever, and a real in-flight call always carries the exact
/// `'initiated'` token, so it is never the value that gets defaulted.
enum CallStatus {
  initiated('initiated'),
  completed('completed'),
  failed('failed'),
  noAnswer('no_answer'),
  busy('busy'),
  manual('manual');

  const CallStatus(this.wire);

  final String wire;

  /// Tolerant decode: null / unknown → [failed] (safe terminal). Never throws.
  static CallStatus fromWire(String? wire) {
    for (final s in CallStatus.values) {
      if (s.wire == wire) return s;
    }
    return CallStatus.failed;
  }

  /// The call is still running; the controller keeps polling `call-summary`.
  bool get isInFlight => this == CallStatus.initiated;

  /// The WhatsApp-copy path — no phone call was ever placed.
  bool get isManual => this == CallStatus.manual;

  /// A terminal call FAILURE — the call never connected, so no conversation
  /// happened and no AI `callSummary` will ever generate (`failed` / `no_answer`
  /// / `busy`). Distinct from `completed`, which is terminal but NOT a failure:
  /// a conversation happened and its summary may still be settling, so it earns
  /// the short summary-wait. The controller uses this to leave the `calling`
  /// stage the instant a failure lands, rather than waiting out that window
  /// while the honest waiting state falsely reads "Conversation in progress".
  bool get isTerminalFailure =>
      this == CallStatus.failed ||
      this == CallStatus.noAnswer ||
      this == CallStatus.busy;
}

/// How the outreach was delivered. Wire values mirror
/// `src/types/attendance.ts` → `ParentOutreach.deliveryMethod` EXACTLY:
///
///   'twilio_call' | 'whatsapp_copy'
///
/// [fromWire] tolerant: null / unknown → [twilioCall].
enum DeliveryMethod {
  twilioCall('twilio_call'),
  whatsappCopy('whatsapp_copy');

  const DeliveryMethod(this.wire);

  /// The exact token the create route expects / the doc stores.
  final String wire;

  /// Tolerant decode: null / unknown → [twilioCall]. Never throws.
  static DeliveryMethod fromWire(String? wire) {
    for (final m in DeliveryMethod.values) {
      if (m.wire == wire) return m;
    }
    return DeliveryMethod.twilioCall;
  }
}

/// The domain view of a `parent_outreach/{outreachId}` Firestore document
/// (`src/types/attendance.ts` → `ParentOutreach`). Mirrored name-for-name so a
/// future codegen stays trivial.
///
/// NOTE: none of the four hotline routes return a *whole* `ParentOutreach` —
/// `createOutreach` returns `{ outreachId }`, `placeCall` returns `{ callSid }`,
/// and the summary/latest routes return the [CallResult] projection below. This
/// type is the canonical shape of the underlying doc (and the home of the
/// enums); the client constructs / hydrates it as later units need. Server-
/// trusted fields (`teacherUid`, `parentPhone`, `teacherName`, `schoolName`)
/// are modelled for completeness but the client never *chooses* them (F9-001).
@immutable
class ParentOutreach {
  const ParentOutreach({
    required this.id,
    required this.classId,
    required this.className,
    required this.studentId,
    required this.studentName,
    required this.parentLanguage,
    required this.reason,
    required this.generatedMessage,
    required this.deliveryMethod,
    this.teacherUid,
    this.parentPhone,
    this.teacherNote,
    this.subject,
    this.teacherName,
    this.schoolName,
    this.callSid,
    this.callStatus,
    this.transcript = const [],
    this.callSummary,
    this.answeredBy,
    this.callDurationSeconds,
    this.turnCount,
    this.createdAt,
    this.updatedAt,
  });

  /// Firestore doc id == `outreachId`, the join key for every call route.
  final String id;
  final String classId;
  final String className;
  final String studentId;
  final String studentName;

  /// The parent's language as a full name (e.g. `"Kannada"`) — drives the TTS
  /// voice, STT, and agent language server-side.
  final String parentLanguage;
  final OutreachReason reason;

  /// The AI-drafted opening message, in the parent's language.
  final String generatedMessage;
  final DeliveryMethod deliveryMethod;

  /// Server-trusted owner uid. The client never sets this.
  final String? teacherUid;

  /// E.164 parent phone — server-trusted from the student record (F9-001). The
  /// client never sends or chooses it; display is masked.
  final String? parentPhone;
  final String? teacherNote;
  final String? subject;
  final String? teacherName;
  final String? schoolName;

  /// Provider call id, set once the call is placed.
  final String? callSid;
  final CallStatus? callStatus;
  final List<TranscriptTurn> transcript;
  final CallSummary? callSummary;

  /// Twilio machine-detection result (`human`, `machine_end_beep`, …).
  final String? answeredBy;
  final int? callDurationSeconds;
  final int? turnCount;

  /// ISO-8601 strings, as written server-side.
  final String? createdAt;
  final String? updatedAt;
}

/// The polled projection of an outreach doc returned by
/// `GET /api/attendance/call-summary` and (with an id) `outreach-latest`.
/// Mirrors that response shape: `{ callStatus, callDurationSeconds, answeredBy,
/// turnCount, transcript[], callSummary? }`.
@immutable
class CallResult {
  const CallResult({
    required this.callStatus,
    this.callDurationSeconds,
    this.answeredBy,
    this.turnCount = 0,
    this.transcript = const [],
    this.callSummary,
  });

  /// The current lifecycle status. Defaulted via [CallStatus.fromWire], so it
  /// is never null even if the wire omitted it.
  final CallStatus callStatus;
  final int? callDurationSeconds;
  final String? answeredBy;

  /// Server-derived from transcript length; the wire sends `?? 0`.
  final int turnCount;
  final List<TranscriptTurn> transcript;

  /// Present once the AI summary has landed; absent while the call is in flight
  /// or if the summary never generated.
  final CallSummary? callSummary;

  /// The call has reached a terminal state (nothing more to poll for on
  /// status). `initiated` is the only non-terminal value.
  bool get isTerminal => !callStatus.isInFlight;

  /// A conversation actually happened (used to distinguish "call ended before a
  /// conversation could happen" from a real summary-worthy call).
  bool get hadConversation => turnCount >= 2;

  @override
  bool operator ==(Object other) =>
      other is CallResult &&
      other.callStatus == callStatus &&
      other.callDurationSeconds == callDurationSeconds &&
      other.answeredBy == answeredBy &&
      other.turnCount == turnCount &&
      listEquals(other.transcript, transcript) &&
      other.callSummary == callSummary;

  @override
  int get hashCode => Object.hash(
        callStatus,
        callDurationSeconds,
        answeredBy,
        turnCount,
        Object.hashAll(transcript),
        callSummary,
      );
}

/// The result of `GET /api/attendance/outreach-latest?studentId=…` when a
/// resumable outreach exists: the [outreachId] to re-bind polling to, plus the
/// same [CallResult] projection. When the route returns `{ outreachId: null }`
/// (nothing to resume) the repository returns `null` instead of this type.
@immutable
class LatestOutreach {
  const LatestOutreach({required this.outreachId, required this.result});

  final String outreachId;
  final CallResult result;

  @override
  bool operator ==(Object other) =>
      other is LatestOutreach &&
      other.outreachId == outreachId &&
      other.result == result;

  @override
  int get hashCode => Object.hash(outreachId, result);
}
