import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/features/vidya/data/dto/assistant_request.dart';
import 'package:sahayakai/features/vidya/data/dto/chat_message.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_profile.dart';
import 'package:sahayakai/features/vidya/data/tts_repository.dart';
import 'package:sahayakai/features/vidya/data/vidya_profile_repository.dart';
import 'package:sahayakai/features/vidya/data/vidya_repository.dart';
import 'package:sahayakai/features/vidya/data/vidya_session_repository.dart';
import 'package:sahayakai/features/vidya/data/voice_to_text_repository.dart';

import '../../support/fake_api_client.dart';

/// The VIDYA route contracts through the repository layer. Nothing opens a
/// socket: [FakeApiClient] stands in for the real client (which reaches
/// production). A **401 on every authed route is EXPECTED** until Firebase auth
/// is wired — the last test in each group proves the typed exception surfaces.
const _unauthorized = ApiException(
  ApiErrorKind.unauthorized,
  'Please sign in again.',
  statusCode: 401,
);

void main() {
  group('VoiceToTextRepository — POST /api/ai/voice-to-text (multipart)', () {
    test('uploads WAV bytes as the `audio` field with the Sarvam MIME', () async {
      final client = FakeApiClient(
        multipartResponse: {'text': 'namaste', 'language': 'hi'},
      );
      final transcript = await VoiceToTextRepository(client).transcribe(
        audioBytes: Uint8List.fromList([1, 2, 3, 4]),
        expectedLanguage: 'hi',
      );

      expect(client.multiparts.single.path, '/api/ai/voice-to-text');

      final form = client.multiparts.single.data;
      final audio = form.files.single;
      expect(audio.key, 'audio');
      // WAV filename + audio/wav content type = the Sarvam Saaras v3 fast path.
      expect(audio.value.filename, 'recording.wav');
      expect(audio.value.contentType?.mimeType, 'audio/wav');

      // expectedLanguage rides as a text field (biases detection).
      expect(
        form.fields.firstWhere((f) => f.key == 'expectedLanguage').value,
        'hi',
      );

      expect(transcript.text, 'namaste');
      expect(transcript.language, 'hi');
    });

    test('omits expectedLanguage when not supplied', () async {
      final client = FakeApiClient(
        multipartResponse: {'text': 'hi', 'language': 'en'},
      );
      await VoiceToTextRepository(
        client,
      ).transcribe(audioBytes: Uint8List.fromList([9]));

      expect(
        client.multiparts.single.data.fields.where(
          (f) => f.key == 'expectedLanguage',
        ),
        isEmpty,
      );
    });

    test('a 401 on the stub token surfaces as the typed exception', () async {
      final client = FakeApiClient(multipartError: _unauthorized);
      expect(
        () => VoiceToTextRepository(
          client,
        ).transcribe(audioBytes: Uint8List.fromList([1])),
        throwsA(same(_unauthorized)),
      );
    });
  });

  group('VidyaRepository — POST /api/assistant', () {
    test('sends the request body and decodes a guarded turn', () async {
      final client = FakeApiClient(
        postResponse: {
          'response': 'Making your lesson plan.',
          'plannedActions': [
            {
              'type': 'NAVIGATE_AND_FILL',
              'flow': 'lesson-plan',
              'params': {'topic': 'Fractions', 'language': 'hi'},
            },
          ],
        },
      );

      final turn = await VidyaRepository(client).ask(
        const AssistantRequest(
          message: 'lesson plan on fractions',
          uiLanguage: 'hi',
          chatHistory: [ChatMessage(role: ChatRole.user, text: 'earlier')],
        ),
      );

      expect(client.posts.single.path, '/api/assistant');
      final body = client.posts.single.data as Map<String, dynamic>;
      expect(body['message'], 'lesson plan on fractions');
      expect(body['uiLanguage'], 'hi');
      expect(body['chatHistory'], isA<List<dynamic>>());

      expect(turn.response, 'Making your lesson plan.');
      expect(turn.directives.single.flow, VidyaFlow.lessonPlan);
      expect(turn.directives.single.params.topic, 'Fractions');
    });

    test('a 401 on the stub token surfaces as the typed exception', () async {
      final client = FakeApiClient(postError: _unauthorized);
      expect(
        () => VidyaRepository(client).ask(const AssistantRequest(message: 'x')),
        throwsA(same(_unauthorized)),
      );
    });
  });

  group('TtsRepository — POST /api/tts', () {
    test('sends { text, targetLang } and decodes audioContent', () async {
      final client = FakeApiClient(
        postResponse: {'audioContent': 'QUJD', 'voiceQuota': null},
      );

      final res = await TtsRepository(
        client,
      ).synthesize(text: 'Namaste', targetLang: 'hi-IN');

      expect(client.posts.single.path, '/api/tts');
      expect(client.posts.single.data, {
        'text': 'Namaste',
        'targetLang': 'hi-IN',
      });
      expect(res.audioContent, 'QUJD');
    });

    test(
      'omits targetLang when the server should detect from script',
      () async {
        final client = FakeApiClient(postResponse: {'audioContent': 'QUJD'});
        await TtsRepository(client).synthesize(text: 'কি খবর');

        expect(client.posts.single.data, {'text': 'কি খবর'});
      },
    );

    test('a 429 rate-limit surfaces as the typed exception', () async {
      const rateLimited = ApiException(
        ApiErrorKind.rateLimited,
        'You have reached your usage limit.',
        statusCode: 429,
      );
      final client = FakeApiClient(postError: rateLimited);
      expect(
        () => TtsRepository(client).synthesize(text: 'x'),
        throwsA(same(rateLimited)),
      );
    });
  });

  group('VidyaSessionRepository — GET/POST /api/vidya/session', () {
    test('GET decodes the latest session', () async {
      final client = FakeApiClient(
        getResponse: {
          'sessionId': 'sess-9',
          'messages': [
            {
              'role': 'model',
              'parts': [
                {'text': 'welcome back'},
              ],
            },
          ],
        },
      );

      final session = await VidyaSessionRepository(client).fetchLatest();
      expect(client.gets.single.path, '/api/vidya/session');
      expect(session.sessionId, 'sess-9');
      expect(session.messages.single.text, 'welcome back');
    });

    test('POST writes the turn pair + actionTriggered + isNew', () async {
      final client = FakeApiClient(postResponse: {'success': true});
      await VidyaSessionRepository(client).save(
        sessionId: 'sess-9',
        messages: const [
          ChatMessage(role: ChatRole.user, text: 'hi'),
          ChatMessage(role: ChatRole.model, text: 'hello'),
        ],
        actionTriggered: {
          'flow': 'lesson-plan',
          'params': {'topic': 'Fractions'},
        },
        screenPath: '/lesson-plan',
        isNew: true,
      );

      final body = client.posts.single.data as Map<String, dynamic>;
      expect(body['sessionId'], 'sess-9');
      expect(body['messages'] as List, hasLength(2));
      expect(body['messages'][0], {
        'role': 'user',
        'parts': [
          {'text': 'hi'},
        ],
      });
      expect(body['actionTriggered'], {
        'flow': 'lesson-plan',
        'params': {'topic': 'Fractions'},
      });
      expect(body['screenPath'], '/lesson-plan');
      expect(body['isNew'], true);
    });

    test(
      'POST omits actionTriggered / screenPath / isNew when unset',
      () async {
        final client = FakeApiClient(postResponse: {'success': true});
        await VidyaSessionRepository(client).save(
          sessionId: 'sess-9',
          messages: const [ChatMessage(role: ChatRole.user, text: 'hi')],
        );

        final body = client.posts.single.data as Map<String, dynamic>;
        expect(body.containsKey('actionTriggered'), isFalse);
        expect(body.containsKey('screenPath'), isFalse);
        expect(body.containsKey('isNew'), isFalse);
      },
    );

    test('a 401 surfaces from the GET', () async {
      final client = FakeApiClient(error: _unauthorized);
      expect(
        () => VidyaSessionRepository(client).fetchLatest(),
        throwsA(same(_unauthorized)),
      );
    });
  });

  group('VidyaProfileRepository — GET/POST /api/vidya/profile', () {
    test('GET unwraps the { profile } envelope', () async {
      final client = FakeApiClient(
        getResponse: {
          'profile': {
            'preferredGrade': 'Class 10',
            'preferredSubject': 'Maths',
          },
        },
      );

      final profile = await VidyaProfileRepository(client).fetch();
      expect(client.gets.single.path, '/api/vidya/profile');
      expect(profile?.preferredGrade, 'Class 10');
      expect(profile?.preferredSubject, 'Maths');
    });

    test('GET of a first-visit teacher decodes to null', () async {
      final client = FakeApiClient(getResponse: {'profile': null});
      expect(await VidyaProfileRepository(client).fetch(), isNull);
    });

    test('POST wraps the strict { profile } body', () async {
      final client = FakeApiClient(postResponse: {'success': true});
      await VidyaProfileRepository(client).save(
        const VidyaProfile(
          preferredGrade: 'Class 10',
          preferredLanguage: 'Hindi',
        ),
      );

      expect(client.posts.single.path, '/api/vidya/profile');
      expect(client.posts.single.data, {
        'profile': {'preferredGrade': 'Class 10', 'preferredLanguage': 'Hindi'},
      });
    });

    test('a 401 surfaces from the GET', () async {
      final client = FakeApiClient(error: _unauthorized);
      expect(
        () => VidyaProfileRepository(client).fetch(),
        throwsA(same(_unauthorized)),
      );
    });
  });
}
