import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_controller.dart';
import 'package:sahayakai/shared/voice/audio_player_service.dart';
import 'package:sahayakai/shared/voice/audio_recorder_service.dart';
import 'package:sahayakai/shared/voice/mic_permission_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../../support/fake_voice.dart';

/// U-V7 — session persistence: restore on home load, fire-and-forget turn sync,
/// and the 401-degrades-gracefully path. Driven with fakes; the restore GETs
/// 401 on the real stub token, which is the degrade path exercised here.

const _unauthorized = ApiException(
  ApiErrorKind.unauthorized,
  'Please sign in again.',
  statusCode: 401,
);

Map<String, dynamic> _singleActionReply() => {
      'response': 'Making your Class 10 Maths lesson plan.',
      'plannedActions': [
        {
          'type': 'NAVIGATE_AND_FILL',
          'flow': 'lesson-plan',
          'params': {'topic': 'Fractions', 'gradeLevel': 'Class 10'},
        },
      ],
    };

FakeApiClient _happyClient() => FakeApiClient(
      multipartResponse: {'text': 'lesson plan on fractions', 'language': 'en'},
      postResponsesByPath: {
        '/api/assistant': _singleActionReply(),
        '/api/tts': {'audioContent': 'QUJD'},
        '/api/vidya/session': {'success': true},
        '/api/vidya/profile': {'success': true},
      },
    );

ProviderContainer _container(FakeApiClient client) {
  final container = ProviderContainer(
    overrides: [
      apiClientProvider.overrideWithValue(client),
      audioRecorderServiceProvider.overrideWithValue(FakeAudioRecorderService()),
      audioPlayerServiceProvider.overrideWithValue(FakeAudioPlayerService()),
      micPermissionServiceProvider.overrideWithValue(FakeMicPermissionService()),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  group('restore', () {
    test('restores the prior conversation, session id and profile', () async {
      final client = FakeApiClient(getResponsesByPath: {
        '/api/vidya/session': {
          'sessionId': 's1',
          'messages': [
            {
              'role': 'user',
              'parts': [
                {'text': 'plan a lesson on fractions'}
              ]
            },
            {
              'role': 'model',
              'parts': [
                {'text': 'Here is a fractions lesson.'}
              ]
            },
          ],
        },
        '/api/vidya/profile': {
          'profile': {'preferredGrade': 'Class 8', 'preferredSubject': 'Science'},
        },
      });
      final container = _container(client);
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.restoreSession();

      final state = container.read(vidyaControllerProvider);
      expect(state.conversation, hasLength(2));
      expect(state.conversation.first.role, ConversationRole.teacher);
      expect(state.conversation.first.text, 'plan a lesson on fractions');
      expect(state.conversation.last.role, ConversationRole.vidya);
      expect(state.sessionId, 's1');
      expect(state.chatHistory, hasLength(2));
      expect(state.profile?.preferredGrade, 'Class 8');
      expect(state.profile?.preferredSubject, 'Science');
      // Restore is not a busy phase — the home is ready to talk.
      expect(state.status, VidyaStatus.idle);
    });

    test('runs at most once (a relaunch restore, not on every home mount)',
        () async {
      final client = FakeApiClient(getResponsesByPath: {
        '/api/vidya/session': {'sessionId': null, 'messages': <dynamic>[]},
        '/api/vidya/profile': {'profile': null},
      });
      final container = _container(client);
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.restoreSession();
      final firstCount = client.gets.length;
      await vidya.restoreSession();

      expect(client.gets.length, firstCount, reason: 'restore is once-only');
    });
  });

  group('sync', () {
    test('a completed turn is POSTed to the session route', () async {
      final client = _happyClient();
      final container = _container(client);
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap(); // listening
      await vidya.onMicTap(); // … → idle, turn persisted

      final sessionPosts =
          client.posts.where((p) => p.path == '/api/vidya/session').toList();
      expect(sessionPosts, isNotEmpty);
      final body = sessionPosts.first.data as Map<String, dynamic>;
      expect(body['sessionId'], isNotNull);
      expect(body['messages'], hasLength(2)); // the user + VIDYA turn pair
    });
  });

  group('401 degrades gracefully', () {
    test('a 401 on the restore GETs → a fresh empty session, never a crash',
        () async {
      final client = FakeApiClient(getErrorsByPath: {
        '/api/vidya/session': _unauthorized,
        '/api/vidya/profile': _unauthorized,
      });
      final container = _container(client);
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.restoreSession();

      final state = container.read(vidyaControllerProvider);
      expect(state.conversation, isEmpty);
      expect(state.sessionId, isNull);
      // NOT a terminal signed-out state — restore degrades silently to empty.
      expect(state.status, VidyaStatus.idle);
    });

    test('restore never clobbers an in-progress conversation', () async {
      // Session restore would return an old conversation, but a turn is already
      // in flight (empty here is fine — the guard is what we assert).
      final client = _happyClient();
      final container = _container(client);
      final vidya = container.read(vidyaControllerProvider.notifier);

      // Start a live turn first.
      await vidya.onMicTap();
      await vidya.onMicTap();
      final live = container.read(vidyaControllerProvider).conversation;
      expect(live, isNotEmpty);

      // A late restore must leave the live conversation intact.
      await vidya.restoreSession();
      expect(container.read(vidyaControllerProvider).conversation, live);
    });
  });
}
