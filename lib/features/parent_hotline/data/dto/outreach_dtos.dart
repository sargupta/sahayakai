import 'package:json_annotation/json_annotation.dart';

import '../../domain/call_summary.dart';
import '../../domain/parent_outreach.dart';

part 'outreach_dtos.g.dart';

// ─── POST /api/attendance/outreach ───────────────────────────────────────────

/// Serialises the `POST /api/attendance/outreach` body. `includeIfNull: false`
/// drops the optional fields (`teacherNote`, `subject`, `performanceContext`)
/// so the server applies its own behaviour.
///
/// **F9-001 — no `parentPhone`.** The SPEC's illustrative body carries a
/// `parentPhone` "for shape only", but the route *ignores* it and always reads
/// the phone from `students/{id}.parentPhone` server-side. Sending a client-
/// chosen number does nothing and only muddies the trust boundary, so this DTO
/// omits it entirely — matching the `parent_message` convention of never
/// sending server-trusted / server-injected fields (`userId`, `teacherName`,
/// `schoolName` are likewise back-filled server-side and never sent).
///
/// Pinned against `src/app/api/attendance/outreach/route.ts` in `sahayakai-main`.
@JsonSerializable(includeIfNull: false, createFactory: false)
class CreateOutreachRequestDto {
  const CreateOutreachRequestDto({
    required this.classId,
    required this.className,
    required this.studentId,
    required this.studentName,
    required this.parentLanguage,
    required this.reason,
    required this.generatedMessage,
    required this.deliveryMethod,
    this.teacherNote,
    this.subject,
    this.performanceContext,
  });

  /// Typed builder — maps the domain enums to their wire tokens and trims the
  /// string fields, mirroring `ParentMessageRequestDto.fromDomain`. U-PH3 calls
  /// this with [OutreachReason] / [DeliveryMethod] rather than raw strings.
  factory CreateOutreachRequestDto.build({
    required String classId,
    required String className,
    required String studentId,
    required String studentName,
    required String parentLanguage,
    required OutreachReason reason,
    required String generatedMessage,
    required DeliveryMethod deliveryMethod,
    String? teacherNote,
    String? subject,
    Map<String, dynamic>? performanceContext,
  }) {
    return CreateOutreachRequestDto(
      classId: classId.trim(),
      className: className.trim(),
      studentId: studentId.trim(),
      studentName: studentName.trim(),
      parentLanguage: parentLanguage.trim(),
      reason: reason.wire,
      generatedMessage: generatedMessage.trim(),
      deliveryMethod: deliveryMethod.wire,
      teacherNote: _clean(teacherNote),
      subject: _clean(subject),
      performanceContext:
          (performanceContext != null && performanceContext.isNotEmpty)
              ? performanceContext
              : null,
    );
  }

  final String classId;
  final String className;
  final String studentId;
  final String studentName;

  /// Full language name (e.g. `"Kannada"`).
  final String parentLanguage;

  /// `OutreachReason` wire token.
  final String reason;
  final String generatedMessage;

  /// `DeliveryMethod` wire token (`twilio_call` | `whatsapp_copy`).
  final String deliveryMethod;
  final String? teacherNote;

  /// Subject name for the streaming voicebot greeting personalization.
  final String? subject;

  /// Opaque passthrough of the recent-marks snapshot (populated by U-PH3's
  /// evidence panel). Kept as raw JSON — a full `PerformanceContext` DTO is out
  /// of scope for the data layer and the server treats it as an optional blob.
  final Map<String, dynamic>? performanceContext;

  Map<String, dynamic> toJson() => _$CreateOutreachRequestDtoToJson(this);
}

/// Decodes the create route's `{ outreachId }` reply.
@JsonSerializable(createToJson: false)
class CreateOutreachResponseDto {
  const CreateOutreachResponseDto({this.outreachId});

  factory CreateOutreachResponseDto.fromJson(Map<String, dynamic> json) =>
      _$CreateOutreachResponseDtoFromJson(json);

  final String? outreachId;

  /// The trimmed id, or empty string when absent — the repository treats an
  /// empty id as a malformed success and throws.
  String get id => outreachId?.trim() ?? '';
}

// ─── POST /api/attendance/call ───────────────────────────────────────────────

/// Serialises the `POST /api/attendance/call` body — **exactly**
/// `{ outreachId, parentLanguage }` and nothing else.
///
/// **F9-001 (critical):** there is deliberately no `parentPhone` field. The
/// server re-reads the trusted phone off the outreach doc; a client that sent
/// its own could dial an arbitrary number. This is pinned by a test.
///
/// Pinned against `src/app/api/attendance/call/route.ts` in `sahayakai-main`.
@JsonSerializable(createFactory: false)
class PlaceCallRequestDto {
  const PlaceCallRequestDto({
    required this.outreachId,
    required this.parentLanguage,
  });

  final String outreachId;

  /// Full language name (e.g. `"Kannada"`) — the route validates it against
  /// `TWILIO_LANGUAGE_MAP`.
  final String parentLanguage;

  Map<String, dynamic> toJson() => _$PlaceCallRequestDtoToJson(this);
}

/// Decodes the call route's `{ callSid }` reply (the provider normalizes its
/// own id to `callSid` server-side).
@JsonSerializable(createToJson: false)
class PlaceCallResponseDto {
  const PlaceCallResponseDto({this.callSid});

  factory PlaceCallResponseDto.fromJson(Map<String, dynamic> json) =>
      _$PlaceCallResponseDtoFromJson(json);

  final String? callSid;

  String get sid => callSid?.trim() ?? '';
}

// ─── Shared call-result DTOs ─────────────────────────────────────────────────

/// One transcript turn on the wire: `{ role, text, timestamp }`. Every field is
/// nullable + tolerantly decoded — the transcript is telephony/model-written.
@JsonSerializable(createToJson: false)
class TranscriptTurnDto {
  const TranscriptTurnDto({this.role, this.text, this.timestamp});

  factory TranscriptTurnDto.fromJson(Map<String, dynamic> json) =>
      _$TranscriptTurnDtoFromJson(json);

  final String? role;
  final String? text;
  final String? timestamp;

  TranscriptTurn toDomain() => TranscriptTurn(
        role: TranscriptRole.fromWire(role),
        text: text?.trim() ?? '',
        timestamp: timestamp?.trim() ?? '',
      );
}

/// The AI `CallSummary` on the wire. All fields nullable/defensive — the
/// summary is model-generated, so a missing field or a stray null inside a list
/// must degrade gracefully, never crash the sheet. The list fields are typed
/// `List<dynamic>?` and cleaned to non-empty strings.
@JsonSerializable(createToJson: false)
class CallSummaryDto {
  const CallSummaryDto({
    this.parentResponse,
    this.parentConcerns,
    this.parentCommitments,
    this.actionItemsForTeacher,
    this.guidanceGiven,
    this.parentSentiment,
    this.callQuality,
    this.followUpNeeded,
    this.followUpSuggestion,
    this.generatedAt,
  });

  factory CallSummaryDto.fromJson(Map<String, dynamic> json) =>
      _$CallSummaryDtoFromJson(json);

  final String? parentResponse;
  final List<dynamic>? parentConcerns;
  final List<dynamic>? parentCommitments;
  final List<dynamic>? actionItemsForTeacher;
  final List<dynamic>? guidanceGiven;
  final String? parentSentiment;
  final String? callQuality;
  final bool? followUpNeeded;
  final String? followUpSuggestion;
  final String? generatedAt;

  CallSummary toDomain() => CallSummary(
        parentResponse: parentResponse?.trim() ?? '',
        parentConcerns: _cleanList(parentConcerns),
        parentCommitments: _cleanList(parentCommitments),
        actionItemsForTeacher: _cleanList(actionItemsForTeacher),
        guidanceGiven: _cleanList(guidanceGiven),
        parentSentiment: ParentSentiment.fromWire(parentSentiment),
        callQuality: CallQuality.fromWire(callQuality),
        followUpNeeded: followUpNeeded ?? false,
        followUpSuggestion: _clean(followUpSuggestion),
        generatedAt: _clean(generatedAt),
      );
}

/// Decodes `GET /api/attendance/call-summary?outreachId=…`:
/// `{ callStatus, callDurationSeconds, answeredBy, turnCount, transcript[],
/// callSummary? }`. The server sends `callStatus ?? null`, `turnCount ?? 0`,
/// `transcript ?? []`, `callSummary ?? null`.
@JsonSerializable(createToJson: false)
class CallResultDto {
  const CallResultDto({
    this.callStatus,
    this.callDurationSeconds,
    this.answeredBy,
    this.turnCount,
    this.transcript,
    this.callSummary,
  });

  factory CallResultDto.fromJson(Map<String, dynamic> json) =>
      _$CallResultDtoFromJson(json);

  final String? callStatus;
  final num? callDurationSeconds;
  final String? answeredBy;
  final num? turnCount;
  final List<TranscriptTurnDto>? transcript;
  final CallSummaryDto? callSummary;

  CallResult toDomain() => CallResult(
        callStatus: CallStatus.fromWire(callStatus),
        callDurationSeconds: callDurationSeconds?.toInt(),
        answeredBy: _clean(answeredBy),
        turnCount: turnCount?.toInt() ?? 0,
        transcript: (transcript ?? const <TranscriptTurnDto>[])
            .map((t) => t.toDomain())
            .toList(growable: false),
        callSummary: callSummary?.toDomain(),
      );
}

/// Decodes `GET /api/attendance/outreach-latest?studentId=…`: either
/// `{ outreachId: null }` (nothing to resume) or `{ outreachId, callStatus,
/// callDurationSeconds, answeredBy, turnCount, transcript[], callSummary? }`
/// (the same projection as [CallResultDto] plus the id to re-bind polling to).
@JsonSerializable(createToJson: false)
class LatestOutreachDto {
  const LatestOutreachDto({
    this.outreachId,
    this.callStatus,
    this.callDurationSeconds,
    this.answeredBy,
    this.turnCount,
    this.transcript,
    this.callSummary,
  });

  factory LatestOutreachDto.fromJson(Map<String, dynamic> json) =>
      _$LatestOutreachDtoFromJson(json);

  final String? outreachId;
  final String? callStatus;
  final num? callDurationSeconds;
  final String? answeredBy;
  final num? turnCount;
  final List<TranscriptTurnDto>? transcript;
  final CallSummaryDto? callSummary;

  /// The call-result projection carried alongside the id.
  CallResult toResult() => CallResult(
        callStatus: CallStatus.fromWire(callStatus),
        callDurationSeconds: callDurationSeconds?.toInt(),
        answeredBy: _clean(answeredBy),
        turnCount: turnCount?.toInt() ?? 0,
        transcript: (transcript ?? const <TranscriptTurnDto>[])
            .map((t) => t.toDomain())
            .toList(growable: false),
        callSummary: callSummary?.toDomain(),
      );

  /// null when the route reported nothing resumable (`{ outreachId: null }` or
  /// a blank id).
  LatestOutreach? toDomain() {
    final id = outreachId?.trim();
    if (id == null || id.isEmpty) return null;
    return LatestOutreach(outreachId: id, result: toResult());
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

String? _clean(String? value) {
  final trimmed = value?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return trimmed;
}

/// Keeps only the non-empty string entries of a model-generated array, trimmed.
/// Tolerates nulls / non-strings so a malformed summary list never crashes.
List<String> _cleanList(List<dynamic>? raw) {
  if (raw == null) return const <String>[];
  return raw
      .whereType<String>()
      .map((e) => e.trim())
      .where((e) => e.isNotEmpty)
      .toList(growable: false);
}
