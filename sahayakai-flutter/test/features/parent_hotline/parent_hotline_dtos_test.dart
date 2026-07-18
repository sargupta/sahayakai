import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/parent_hotline/data/dto/outreach_dtos.dart';
import 'package:sahayakai/features/parent_hotline/domain/call_summary.dart';
import 'package:sahayakai/features/parent_hotline/domain/parent_outreach.dart';

/// Golden-decode + request-shape pinning for the Parent Hotline DTOs. Pure DTO
/// logic — no network. Every wire shape mirrors the four `/api/attendance/*`
/// routes in `sahayakai-main`, and the enum tolerance mirrors the
/// `VidyaFlow.fromWire` guard (unknown → a safe default, never a throw).
void main() {
  // A full `GET /api/attendance/call-summary` 200 body, as the route emits it.
  Map<String, dynamic> callSummaryBody() => {
        'callStatus': 'completed',
        'callDurationSeconds': 132,
        'answeredBy': 'human',
        'turnCount': 4,
        'transcript': [
          {
            'role': 'agent',
            'text': 'Namaste, this is an important message from school.',
            'timestamp': '2026-07-18T10:00:00.000Z',
          },
          {
            'role': 'parent',
            'text': 'Haan ji, boliye.',
            'timestamp': '2026-07-18T10:00:12.000Z',
          },
        ],
        'callSummary': {
          'parentResponse': 'The parent was grateful and engaged.',
          'parentConcerns': ['Child struggles with fractions'],
          'parentCommitments': ['Will ensure a daily study time'],
          'actionItemsForTeacher': ['Share extra fraction worksheets'],
          'guidanceGiven': ['Suggested 20 minutes of daily practice'],
          'parentSentiment': 'grateful',
          'callQuality': 'productive',
          'followUpNeeded': true,
          'followUpSuggestion': 'Call again in two weeks',
          'generatedAt': '2026-07-18T10:03:00.000Z',
        },
      };

  group('CreateOutreachResponseDto — POST /api/attendance/outreach 200', () {
    test('decodes { outreachId }', () {
      final dto = CreateOutreachResponseDto.fromJson({'outreachId': 'o-123'});
      expect(dto.outreachId, 'o-123');
      expect(dto.id, 'o-123');
    });

    test('a missing / blank id yields an empty id (repo treats as malformed)',
        () {
      expect(CreateOutreachResponseDto.fromJson(<String, dynamic>{}).id, '');
      expect(CreateOutreachResponseDto.fromJson({'outreachId': '  '}).id, '');
    });
  });

  group('PlaceCallResponseDto — POST /api/attendance/call 200', () {
    test('decodes { callSid }', () {
      final dto = PlaceCallResponseDto.fromJson({'callSid': 'CA-abc'});
      expect(dto.callSid, 'CA-abc');
      expect(dto.sid, 'CA-abc');
    });
  });

  group('CallResultDto — GET /api/attendance/call-summary 200 (golden)', () {
    test('decodes the full call result into the domain projection', () {
      final result = CallResultDto.fromJson(callSummaryBody()).toDomain();

      expect(result.callStatus, CallStatus.completed);
      expect(result.callDurationSeconds, 132);
      expect(result.answeredBy, 'human');
      expect(result.turnCount, 4);
      expect(result.isTerminal, isTrue);
      expect(result.hadConversation, isTrue);

      expect(result.transcript, hasLength(2));
      expect(result.transcript.first.role, TranscriptRole.agent);
      expect(result.transcript.first.text,
          'Namaste, this is an important message from school.');
      expect(result.transcript.first.timestamp, '2026-07-18T10:00:00.000Z');
      expect(result.transcript.last.role, TranscriptRole.parent);

      final s = result.callSummary!;
      expect(s.parentResponse, 'The parent was grateful and engaged.');
      expect(s.parentConcerns, ['Child struggles with fractions']);
      expect(s.parentCommitments, ['Will ensure a daily study time']);
      expect(s.actionItemsForTeacher, ['Share extra fraction worksheets']);
      expect(s.guidanceGiven, ['Suggested 20 minutes of daily practice']);
      expect(s.parentSentiment, ParentSentiment.grateful);
      expect(s.callQuality, CallQuality.productive);
      expect(s.followUpNeeded, isTrue);
      expect(s.followUpSuggestion, 'Call again in two weeks');
      expect(s.generatedAt, '2026-07-18T10:03:00.000Z');
    });

    test('an in-flight call (no summary yet) decodes with the server defaults',
        () {
      // The route sends `turnCount ?? 0`, `transcript ?? []`,
      // `callSummary ?? null` while the call is still `initiated`.
      final result = CallResultDto.fromJson({
        'callStatus': 'initiated',
        'callDurationSeconds': null,
        'answeredBy': null,
        'turnCount': 0,
        'transcript': <dynamic>[],
        'callSummary': null,
      }).toDomain();

      expect(result.callStatus, CallStatus.initiated);
      expect(result.callStatus.isInFlight, isTrue);
      expect(result.isTerminal, isFalse);
      expect(result.callDurationSeconds, isNull);
      expect(result.turnCount, 0);
      expect(result.hadConversation, isFalse);
      expect(result.transcript, isEmpty);
      expect(result.callSummary, isNull);
    });
  });

  group('LatestOutreachDto — GET /api/attendance/outreach-latest 200', () {
    test('a resumable outreach carries the id + the same call projection', () {
      final json = {'outreachId': 'o-777', ...callSummaryBody()};
      final latest = LatestOutreachDto.fromJson(json).toDomain();

      expect(latest, isNotNull);
      expect(latest!.outreachId, 'o-777');
      expect(latest.result.callStatus, CallStatus.completed);
      expect(latest.result.callSummary?.parentSentiment,
          ParentSentiment.grateful);
    });

    test('{ outreachId: null } → null (nothing to resume)', () {
      expect(LatestOutreachDto.fromJson({'outreachId': null}).toDomain(),
          isNull);
    });

    test('a blank id is also treated as nothing to resume', () {
      expect(LatestOutreachDto.fromJson({'outreachId': '   '}).toDomain(),
          isNull);
    });
  });

  group('CallSummaryDto — tolerant decode of model-generated content', () {
    test('an unknown sentiment / quality fall back to safe defaults', () {
      final s = CallSummaryDto.fromJson({
        'parentResponse': 'ok',
        'parentSentiment': 'ecstatic', // not in the enum
        'callQuality': 'legendary', // not in the enum
      }).toDomain();

      expect(s.parentSentiment, ParentSentiment.indifferent);
      expect(s.callQuality, CallQuality.brief);
    });

    test('an empty actionItems array is tolerated (server guarantees >=1)', () {
      final s = CallSummaryDto.fromJson({
        'parentResponse': 'ok',
        'actionItemsForTeacher': <dynamic>[],
      }).toDomain();
      expect(s.actionItemsForTeacher, isEmpty);
    });

    test('stray nulls / non-strings inside a list are dropped, not a crash',
        () {
      final s = CallSummaryDto.fromJson({
        'parentResponse': 'ok',
        'parentConcerns': ['real concern', null, '', 42, '  trimmed  '],
      }).toDomain();
      expect(s.parentConcerns, ['real concern', 'trimmed']);
    });

    test('a completely empty summary decodes to safe defaults', () {
      final s = CallSummaryDto.fromJson(<String, dynamic>{}).toDomain();
      expect(s.parentResponse, '');
      expect(s.parentConcerns, isEmpty);
      expect(s.actionItemsForTeacher, isEmpty);
      expect(s.parentSentiment, ParentSentiment.indifferent);
      expect(s.callQuality, CallQuality.brief);
      expect(s.followUpNeeded, isFalse);
      expect(s.followUpSuggestion, isNull);
    });
  });

  group('Enum tolerant fromWire (unknown → safe default, never throws)', () {
    test('OutreachReason', () {
      expect(OutreachReason.fromWire('poor_performance'),
          OutreachReason.poorPerformance);
      expect(OutreachReason.fromWire('made_up'),
          OutreachReason.consecutiveAbsences);
      expect(OutreachReason.fromWire(null), OutreachReason.consecutiveAbsences);
    });

    test('CallStatus (null + unknown → failed)', () {
      expect(CallStatus.fromWire('no_answer'), CallStatus.noAnswer);
      expect(CallStatus.fromWire('ringing'), CallStatus.failed);
      expect(CallStatus.fromWire(null), CallStatus.failed);
    });

    test('DeliveryMethod', () {
      expect(DeliveryMethod.fromWire('whatsapp_copy'),
          DeliveryMethod.whatsappCopy);
      expect(DeliveryMethod.fromWire('carrier_pigeon'),
          DeliveryMethod.twilioCall);
    });

    test('ParentSentiment', () {
      expect(ParentSentiment.fromWire('upset'), ParentSentiment.upset);
      expect(ParentSentiment.fromWire('meh'), ParentSentiment.indifferent);
    });

    test('CallQuality', () {
      expect(CallQuality.fromWire('difficult'), CallQuality.difficult);
      expect(CallQuality.fromWire('epic'), CallQuality.brief);
    });

    test('TranscriptRole (unknown → agent, never mis-attributes to parent)',
        () {
      expect(TranscriptRole.fromWire('parent'), TranscriptRole.parent);
      expect(TranscriptRole.fromWire('system'), TranscriptRole.agent);
      expect(TranscriptRole.fromWire(null), TranscriptRole.agent);
    });

    test('the wire tokens mirror src/types/attendance.ts name-for-name', () {
      expect(OutreachReason.values.map((r) => r.wire).toList(), [
        'consecutive_absences',
        'poor_performance',
        'behavioral_concern',
        'positive_feedback',
      ]);
      expect(CallStatus.values.map((s) => s.wire).toList(), [
        'initiated',
        'completed',
        'failed',
        'no_answer',
        'busy',
        'manual',
      ]);
      expect(DeliveryMethod.values.map((m) => m.wire).toList(),
          ['twilio_call', 'whatsapp_copy']);
      expect(ParentSentiment.values.map((s) => s.wire).toList(), [
        'cooperative',
        'concerned',
        'grateful',
        'upset',
        'indifferent',
        'confused',
      ]);
      expect(CallQuality.values.map((q) => q.wire).toList(),
          ['productive', 'brief', 'difficult', 'unanswered']);
      expect(TranscriptRole.values.map((r) => r.wire).toList(),
          ['agent', 'parent']);
    });
  });

  group('CreateOutreachRequestDto.toJson — POST /api/attendance/outreach body',
      () {
    test('carries the exact field names incl. deliveryMethod + wire enums', () {
      final json = CreateOutreachRequestDto.build(
        classId: 'c1',
        className: 'Class 6A',
        studentId: 's1',
        studentName: 'Asha',
        parentLanguage: 'Kannada',
        reason: OutreachReason.consecutiveAbsences,
        generatedMessage: 'Namaste...',
        deliveryMethod: DeliveryMethod.twilioCall,
      ).toJson();

      expect(json, {
        'classId': 'c1',
        'className': 'Class 6A',
        'studentId': 's1',
        'studentName': 'Asha',
        'parentLanguage': 'Kannada',
        'reason': 'consecutive_absences',
        'generatedMessage': 'Namaste...',
        'deliveryMethod': 'twilio_call',
      });
    });

    test('NEVER includes parentPhone (F9-001 — server sources the phone)', () {
      final json = CreateOutreachRequestDto.build(
        classId: 'c1',
        className: 'Class 6A',
        studentId: 's1',
        studentName: 'Asha',
        parentLanguage: 'Kannada',
        reason: OutreachReason.poorPerformance,
        generatedMessage: 'msg',
        deliveryMethod: DeliveryMethod.whatsappCopy,
      ).toJson();
      expect(json.containsKey('parentPhone'), isFalse);
      expect(json['deliveryMethod'], 'whatsapp_copy');
      expect(json['reason'], 'poor_performance');
    });

    test('omits the optional teacherNote / subject / performanceContext when '
        'blank', () {
      final json = CreateOutreachRequestDto.build(
        classId: 'c1',
        className: 'Class 6A',
        studentId: 's1',
        studentName: 'Asha',
        parentLanguage: 'Hindi',
        reason: OutreachReason.behavioralConcern,
        generatedMessage: 'msg',
        deliveryMethod: DeliveryMethod.twilioCall,
        teacherNote: '   ',
        subject: null,
        performanceContext: const {},
      ).toJson();

      expect(json.containsKey('teacherNote'), isFalse);
      expect(json.containsKey('subject'), isFalse);
      expect(json.containsKey('performanceContext'), isFalse);
    });

    test('includes the optional fields when present', () {
      final json = CreateOutreachRequestDto.build(
        classId: 'c1',
        className: 'Class 6A',
        studentId: 's1',
        studentName: 'Asha',
        parentLanguage: 'Hindi',
        reason: OutreachReason.positiveFeedback,
        generatedMessage: 'msg',
        deliveryMethod: DeliveryMethod.twilioCall,
        teacherNote: 'Great improvement',
        subject: 'Mathematics',
        performanceContext: const {'latestPercentage': 82},
      ).toJson();

      expect(json['teacherNote'], 'Great improvement');
      expect(json['subject'], 'Mathematics');
      expect(json['performanceContext'], {'latestPercentage': 82});
    });
  });

  group('PlaceCallRequestDto.toJson — POST /api/attendance/call body', () {
    test('sends ONLY { outreachId, parentLanguage } — NEVER parentPhone '
        '(F9-001)', () {
      final json = const PlaceCallRequestDto(
        outreachId: 'o-123',
        parentLanguage: 'Kannada',
      ).toJson();

      expect(json, {'outreachId': 'o-123', 'parentLanguage': 'Kannada'});
      expect(json.containsKey('parentPhone'), isFalse);
      expect(json.keys, hasLength(2));
    });
  });
}
