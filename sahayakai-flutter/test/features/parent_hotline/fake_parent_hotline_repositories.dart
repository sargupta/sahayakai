import 'dart:async';

import 'package:sahayakai/features/parent_hotline/data/dto/outreach_dtos.dart';
import 'package:sahayakai/features/parent_hotline/data/parent_hotline_repository.dart';
import 'package:sahayakai/features/parent_hotline/domain/parent_outreach.dart';
import 'package:sahayakai/features/parent_message/data/parent_message_repository.dart';
import 'package:sahayakai/features/parent_message/domain/parent_message.dart';

import '../../support/fake_api_client.dart';

/// A hand-written [ParentHotlineRepository] that never opens a socket. It
/// subclasses the real repository (passing an unused [FakeApiClient] to `super`)
/// and overrides all four routes so the U-PH2 controller can be driven under
/// fake time. Every call is recorded so a test can assert on the built
/// [CreateOutreachRequestDto] (F9-001), the exact `placeCall` arguments, and the
/// poll cadence.
class FakeParentHotlineRepository extends ParentHotlineRepository {
  FakeParentHotlineRepository({
    List<CallResult> pollResults = const [],
    this.latest,
    this.createError,
    this.placeCallError,
    this.latestError,
    this.pollGate,
    String outreachId = 'o-1',
    String callSid = 'CA-1',
  }) : _pollResults = pollResults,
       _outreachId = outreachId,
       _callSid = callSid,
       super(FakeApiClient());

  /// Poll projections returned in sequence; the last one repeats once exhausted.
  final List<CallResult> _pollResults;
  final String _outreachId;
  final String _callSid;

  /// The resumable outreach `latestForStudent` returns (null = nothing to
  /// resume). Mutable so a test can arm a resume after the fact.
  LatestOutreach? latest;

  /// Thrown by `createOutreach` when set. Mutable so a test can clear it between
  /// calls (the dedup-then-succeed path).
  Object? createError;

  /// Thrown by `placeCall` when set.
  Object? placeCallError;

  /// Thrown by `latestForStudent` when set.
  Object? latestError;

  /// When set, the NEXT `pollSummary` awaits this gate before returning — so a
  /// test can hold exactly one poll IN FLIGHT (suspended after `pollCount` was
  /// bumped, before the result resolves) while it disposes the container. This
  /// is what makes the `_disposed`/gen guard in `_poll` load-bearing: the gated
  /// poll's continuation runs only after dispose, and must NOT reschedule or
  /// emit. The gate self-clears after arming one poll.
  Completer<void>? pollGate;

  // ── recorders ──
  final List<CreateOutreachRequestDto> createRequests = [];
  final List<({String outreachId, String parentLanguage})> placeCalls = [];
  final List<String> latestQueries = [];
  int pollCount = 0;

  @override
  Future<String> createOutreach(CreateOutreachRequestDto req) async {
    createRequests.add(req);
    final err = createError;
    if (err != null) throw err;
    return _outreachId;
  }

  @override
  Future<String> placeCall({
    required String outreachId,
    required String parentLanguage,
  }) async {
    placeCalls.add((outreachId: outreachId, parentLanguage: parentLanguage));
    final err = placeCallError;
    if (err != null) throw err;
    return _callSid;
  }

  @override
  Future<CallResult> pollSummary(String outreachId) async {
    final index = pollCount;
    pollCount++; // "a poll started" — observable even while gated in flight
    final gate = pollGate;
    if (gate != null) {
      pollGate = null; // gate only this one poll
      await gate.future;
    }
    if (_pollResults.isEmpty) {
      return const CallResult(callStatus: CallStatus.initiated);
    }
    return index < _pollResults.length
        ? _pollResults[index]
        : _pollResults.last;
  }

  @override
  Future<LatestOutreach?> latestForStudent(String studentId) async {
    latestQueries.add(studentId);
    final err = latestError;
    if (err != null) throw err;
    return latest;
  }
}

/// A hand-written [ParentMessageRepository] fake: the controller delegates the
/// message-draft step to it (SPEC forbids re-implementing the draft). Returns a
/// canned message; records the requests; can throw to model a draft failure.
class FakeParentMessageRepository extends ParentMessageRepository {
  FakeParentMessageRepository({
    this.message = 'Namaste, Asha ke bare mein baat karni thi.',
    this.error,
  }) : super(FakeApiClient());

  final String message;
  Object? error;
  final List<ParentMessageRequest> requests = [];

  @override
  Future<ParentMessage> draft(ParentMessageRequest request) async {
    requests.add(request);
    final err = error;
    if (err != null) throw err;
    return ParentMessage(message: message);
  }
}
