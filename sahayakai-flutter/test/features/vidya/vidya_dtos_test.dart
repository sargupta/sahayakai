import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/features/vidya/data/dto/assistant_request.dart';
import 'package:sahayakai/features/vidya/data/dto/assistant_response.dart';
import 'package:sahayakai/features/vidya/data/dto/chat_message.dart';
import 'package:sahayakai/features/vidya/data/dto/transcript.dart';
import 'package:sahayakai/features/vidya/data/dto/tts_dtos.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_profile.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_session.dart';

/// Golden-decode tests: pin the exact wire shapes the VIDYA routes speak
/// (SPEC §A.2/§A.3/§A.5). No network here — pure DTO logic, especially the
/// closed-flow guard that stops a hallucinated `flow` from routing to a 404.
void main() {
  group('ChatMessage — {role, parts:[{text}]}', () {
    test('serialises to the Gemini turn shape', () {
      const msg = ChatMessage(role: ChatRole.user, text: 'hello');
      expect(msg.toJson(), {
        'role': 'user',
        'parts': [
          {'text': 'hello'},
        ],
      });
    });

    test('model role round-trips', () {
      final json = const ChatMessage(role: ChatRole.model, text: 'hi').toJson();
      final parsed = ChatMessage.fromJson(json);
      expect(parsed?.role, ChatRole.model);
      expect(parsed?.text, 'hi');
    });

    test('a shapeless / empty-text entry is dropped, not a crash', () {
      expect(ChatMessage.fromJson({'role': 'user', 'parts': []}), isNull);
      expect(ChatMessage.fromJson({'role': 'user'}), isNull);
    });
  });

  group('Transcript — POST /api/ai/voice-to-text 200', () {
    test('decodes { text, language }', () {
      final t = Transcript.fromJson({'text': 'namaste', 'language': 'hi'});
      expect(t.text, 'namaste');
      expect(t.language, 'hi');
      expect(t.isUsable, isTrue);
    });

    test('a sub-2-char transcript is not worth a VIDYA round-trip', () {
      expect(
        Transcript.fromJson({'text': 'a', 'language': 'en'}).isUsable,
        isFalse,
      );
    });
  });

  group('VidyaFlow — the closed enum guard (SPEC §A.3)', () {
    test('every known flow resolves', () {
      expect(VidyaFlow.fromWire('lesson-plan'), VidyaFlow.lessonPlan);
      expect(VidyaFlow.fromWire('quiz-generator'), VidyaFlow.quizGenerator);
      expect(VidyaFlow.fromWire('instant-answer'), VidyaFlow.instantAnswer);
    });

    test('a hallucinated flow is dropped (null), never a 404 route', () {
      expect(VidyaFlow.fromWire('made-up-flow'), isNull);
      expect(VidyaFlow.fromWire(''), isNull);
      expect(VidyaFlow.fromWire(null), isNull);
    });

    test('the wire ids match the web flow ids exactly', () {
      // U-V6 keys flow -> Routes on these; a rename here silently breaks nav.
      expect(VidyaFlow.values.map((f) => f.wire).toList(), [
        'lesson-plan',
        'quiz-generator',
        'visual-aid-designer',
        'worksheet-wizard',
        'virtual-field-trip',
        'teacher-training',
        'rubric-generator',
        'exam-paper',
        'video-storyteller',
        'instant-answer',
      ]);
    });
  });

  group('AssistantResponse.toDomain — 0/1/2-3 behaviour + guard', () {
    Map<String, dynamic> action(String flow, {String? topic}) => {
      'type': 'NAVIGATE_AND_FILL',
      'flow': flow,
      'params': {
        'topic': ?topic,
        'gradeLevel': 'Class 10',
        'subject': 'Maths',
        'language': 'hi',
      },
    };

    test('0 actions -> conversational, just speak', () {
      final turn = AssistantResponseDto.fromJson({
        'response': 'Photosynthesis is how plants make food.',
        'action': null,
        'plannedActions': <dynamic>[],
      }).toDomain();

      expect(turn.isConversational, isTrue);
      expect(turn.directives, isEmpty);
      expect(turn.response, 'Photosynthesis is how plants make food.');
    });

    test('1 valid action -> a single directive (auto-navigate)', () {
      final turn = AssistantResponseDto.fromJson({
        'response': 'Generating your Class 10 Maths lesson plan now!',
        'action': action('lesson-plan', topic: 'Quadratic Equations'),
        'plannedActions': [action('lesson-plan', topic: 'Quadratic Equations')],
      }).toDomain();

      expect(turn.isSingleAction, isTrue);
      final d = turn.directives.single;
      expect(d.flow, VidyaFlow.lessonPlan);
      expect(d.params.topic, 'Quadratic Equations');
      expect(d.params.gradeLevel, 'Class 10');
      expect(d.params.subject, 'Maths');
      expect(d.params.language, 'hi');
    });

    test('2-3 actions -> compound (confirm chips)', () {
      final turn = AssistantResponseDto.fromJson({
        'response': 'Making a quiz and a worksheet.',
        'plannedActions': [
          action('quiz-generator'),
          action('worksheet-wizard'),
        ],
      }).toDomain();

      expect(turn.isCompound, isTrue);
      expect(turn.directives.map((d) => d.flow), [
        VidyaFlow.quizGenerator,
        VidyaFlow.worksheetWizard,
      ]);
    });

    test('a hallucinated flow inside the queue is dropped', () {
      final turn = AssistantResponseDto.fromJson({
        'response': '...',
        'plannedActions': [action('lesson-plan'), action('teleport-tool')],
      }).toDomain();

      expect(turn.directives.map((d) => d.flow), [VidyaFlow.lessonPlan]);
    });

    test('plannedActions wins over the legacy singular action', () {
      final turn = AssistantResponseDto.fromJson({
        'response': '...',
        'action': action('lesson-plan'),
        'plannedActions': [action('quiz-generator')],
      }).toDomain();

      expect(turn.directives.single.flow, VidyaFlow.quizGenerator);
    });

    test('falls back to the singular action when plannedActions is empty', () {
      final turn = AssistantResponseDto.fromJson({
        'response': '...',
        'action': action('rubric-generator'),
        'plannedActions': <dynamic>[],
      }).toDomain();

      expect(turn.directives.single.flow, VidyaFlow.rubricGenerator);
    });

    test('a non-navigate singular action yields no directive', () {
      final turn = AssistantResponseDto.fromJson({
        'response': 'ok',
        'action': {'type': 'SOMETHING_ELSE', 'foo': 'bar'},
      }).toDomain();

      expect(turn.directives, isEmpty);
    });

    test('parses the ncertChapter + dependsOn + validationWarning', () {
      final turn = AssistantResponseDto.fromJson({
        'response': '...',
        'plannedActions': [
          {
            'type': 'NAVIGATE_AND_FILL',
            'flow': 'quiz-generator',
            'params': {
              'topic': 'Quadratic Equations',
              'gradeLevel': 'Class 10',
              'subject': 'Maths',
              'language': 'hi',
              'ncertChapter': {
                'number': 4,
                'title': 'Quadratic Equations',
                'learningOutcomes': ['solve by factorisation'],
              },
              'dependsOn': [0],
              'clarifyingPrompt': null,
              'validationWarning': 'Class 7 has no quadratics.',
            },
          },
        ],
      }).toDomain();

      final p = turn.directives.single.params;
      expect(p.ncertChapter?.number, 4);
      expect(p.ncertChapter?.title, 'Quadratic Equations');
      expect(p.ncertChapter?.learningOutcomes, ['solve by factorisation']);
      expect(p.dependsOn, [0]);
      expect(p.validationWarning, 'Class 7 has no quadratics.');
    });

    test('caps the queue at 3', () {
      final turn = AssistantResponseDto.fromJson({
        'response': '...',
        'plannedActions': [
          action('lesson-plan'),
          action('quiz-generator'),
          action('worksheet-wizard'),
          action('rubric-generator'),
        ],
      }).toDomain();

      expect(turn.directives, hasLength(3));
    });

    test('a missing response decodes to empty string, not null', () {
      final turn = AssistantResponseDto.fromJson(
        <String, dynamic>{},
      ).toDomain();
      expect(turn.response, '');
      expect(turn.isConversational, isTrue);
    });
  });

  group('AssistantRequest.toJson — POST /api/assistant body (SPEC §A.3)', () {
    test('a bare message omits every optional field', () {
      expect(const AssistantRequest(message: 'hi').toJson(), {'message': 'hi'});
    });

    test('carries chatHistory in the {role, parts:[{text}]} shape', () {
      final json = const AssistantRequest(
        message: 'and a quiz',
        chatHistory: [
          ChatMessage(role: ChatRole.user, text: 'lesson on fractions'),
          ChatMessage(role: ChatRole.model, text: 'Here it is.'),
        ],
      ).toJson();

      expect(json['chatHistory'], [
        {
          'role': 'user',
          'parts': [
            {'text': 'lesson on fractions'},
          ],
        },
        {
          'role': 'model',
          'parts': [
            {'text': 'Here it is.'},
          ],
        },
      ]);
    });

    test('nests currentScreenContext {path, uiState}', () {
      final json = const AssistantRequest(
        message: 'make it for class 8 instead',
        screenPath: '/lesson-plan',
        screenUiState: {'topic': 'Fractions'},
      ).toJson();

      expect(json['currentScreenContext'], {
        'path': '/lesson-plan',
        'uiState': {'topic': 'Fractions'},
      });
    });

    test('sends both detectedLanguage and the explicit uiLanguage', () {
      // uiLanguage wins server-side; the client must send it so a Bengali-UI
      // teacher gets a Bengali reply even if STT misheard the utterance.
      final json = const AssistantRequest(
        message: 'x',
        detectedLanguage: 'en',
        uiLanguage: 'bn',
      ).toJson();

      expect(json['detectedLanguage'], 'en');
      expect(json['uiLanguage'], 'bn');
    });

    test('an empty teacherProfile is not sent', () {
      final json = const AssistantRequest(
        message: 'x',
        teacherProfile: VidyaProfile(),
      ).toJson();
      expect(json.containsKey('teacherProfile'), isFalse);
    });
  });

  group('VidyaProfile — GET/POST /api/vidya/profile (strict schema)', () {
    test('toJson drops nulls (route rejects unknown keys + undefined)', () {
      const p = VidyaProfile(
        preferredGrade: 'Class 10',
        preferredSubject: 'Maths',
      );
      expect(p.toJson(), {
        'preferredGrade': 'Class 10',
        'preferredSubject': 'Maths',
      });
    });

    test('fromJson of a null profile is null (first visit)', () {
      expect(VidyaProfile.fromJson(null), isNull);
    });

    test('round-trips the saved fields', () {
      final p = VidyaProfile.fromJson({
        'preferredGrade': 'Class 10',
        'preferredSubject': 'Maths',
        'preferredLanguage': 'Hindi',
        'preferredBoard': 'CBSE',
        'schoolContext': 'rural govt school',
        'lastActiveAt': 1720000000000,
      });
      expect(p?.preferredBoard, 'CBSE');
      expect(p?.lastActiveAt, 1720000000000);
      expect(p?.isEmpty, isFalse);
    });
  });

  group('VidyaSession — GET /api/vidya/session', () {
    test('decodes sessionId + messages', () {
      final s = VidyaSession.fromJson({
        'sessionId': 'sess-1',
        'messages': [
          {
            'role': 'user',
            'parts': [
              {'text': 'hi'},
            ],
          },
        ],
      });
      expect(s.sessionId, 'sess-1');
      expect(s.messages.single.text, 'hi');
      expect(s.isEmpty, isFalse);
    });

    test('a brand-new teacher decodes to an empty session', () {
      final s = VidyaSession.fromJson({
        'sessionId': null,
        'messages': <dynamic>[],
      });
      expect(s.sessionId, isNull);
      expect(s.isEmpty, isTrue);
    });
  });

  group('TtsResult — POST /api/tts 200', () {
    test('decodes audioContent + voiceQuota', () {
      final r = TtsResult.fromJson({
        'audioContent': 'QUJD',
        'voiceQuota': {
          'used': 1.5,
          'limit': 60,
          'remaining': 58.5,
          'warning': 'none',
        },
      });
      expect(r.audioContent, 'QUJD');
      expect(r.hasAudio, isTrue);
      expect(r.voiceQuota?.used, 1.5);
      expect(r.voiceQuota?.limit, 60);
      expect(r.voiceQuota?.remaining, 58.5);
    });

    test('an unlimited plan (remaining null on the wire) does not crash', () {
      final r = TtsResult.fromJson({
        'audioContent': 'QUJD',
        'voiceQuota': {
          'used': 0,
          'limit': -1,
          'remaining': null,
          'warning': 'none',
        },
      });
      expect(r.voiceQuota?.limit, -1);
      expect(r.voiceQuota?.remaining, isNull);
    });

    test('a reply with no voiceQuota (cache hit) decodes fine', () {
      final r = TtsResult.fromJson({'audioContent': 'QUJD'});
      expect(r.voiceQuota, isNull);
      expect(r.hasAudio, isTrue);
    });
  });
}
