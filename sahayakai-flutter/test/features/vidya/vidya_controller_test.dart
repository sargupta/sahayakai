import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/features/vidya/data/dto/vidya_action.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_controller.dart';
import 'package:sahayakai/shared/voice/audio_player_service.dart';
import 'package:sahayakai/shared/voice/audio_recorder_service.dart';
import 'package:sahayakai/shared/voice/mic_permission_service.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../../support/fake_voice.dart';

/// U-V3 — the VIDYA state machine, driven end to end with fake voice services
/// and a [FakeApiClient]. Nothing opens a mic, a speaker, or a socket; a **401
/// on the authed routes is EXPECTED** on the stub token and is the signed-out
/// branch, not a failure.

const _unauthorized = ApiException(
  ApiErrorKind.unauthorized,
  'Please sign in again.',
  statusCode: 401,
);
const _rateLimited = ApiException(
  ApiErrorKind.rateLimited,
  'You have reached your usage limit.',
  statusCode: 429,
);
const _offline = ApiException(ApiErrorKind.network, 'No internet connection.');

/// A single-action assistant reply (the auto-navigate case).
Map<String, dynamic> _singleActionReply() => {
      'response': 'Making your Class 10 Maths lesson plan.',
      'plannedActions': [
        {
          'type': 'NAVIGATE_AND_FILL',
          'flow': 'lesson-plan',
          'params': {
            'topic': 'Fractions',
            'gradeLevel': 'Class 10',
            'subject': 'Maths',
            'language': 'hi',
          },
        },
      ],
    };

/// A fake wired for a full happy trip: STT → VIDYA → TTS → persist.
FakeApiClient _happyClient({Map<String, dynamic>? assistant, Duration? delay}) {
  return FakeApiClient(
    delay: delay,
    multipartResponse: {'text': 'lesson plan on fractions', 'language': 'hi'},
    postResponsesByPath: {
      '/api/assistant': assistant ?? _singleActionReply(),
      '/api/tts': {'audioContent': 'QUJD'},
      '/api/vidya/session': {'success': true},
      '/api/vidya/profile': {'success': true},
    },
  );
}

ProviderContainer _container({
  required FakeApiClient client,
  FakeAudioRecorderService? recorder,
  FakeAudioPlayerService? player,
  FakeMicPermissionService? permission,
}) {
  final container = ProviderContainer(
    overrides: [
      apiClientProvider.overrideWithValue(client),
      audioRecorderServiceProvider
          .overrideWithValue(recorder ?? FakeAudioRecorderService()),
      audioPlayerServiceProvider
          .overrideWithValue(player ?? FakeAudioPlayerService()),
      micPermissionServiceProvider
          .overrideWithValue(permission ?? FakeMicPermissionService()),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

/// True when [seq] appears inside [log] in order (allowing other phases
/// between), so the assertion is robust to any listener coalescing.
bool _hasSubsequence(List<VidyaStatus> log, List<VidyaStatus> seq) {
  var i = 0;
  for (final s in log) {
    if (i < seq.length && s == seq[i]) i++;
  }
  return i == seq.length;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  group('the happy path (idle → listening → … → speaking → idle)', () {
    test('runs the full pipeline and inks a user + VIDYA block', () async {
      final recorder = FakeAudioRecorderService();
      final player = FakeAudioPlayerService();
      final client = _happyClient();
      final container = _container(
        client: client,
        recorder: recorder,
        player: player,
      );

      final log = <VidyaStatus>[];
      container.listen(
        vidyaControllerProvider,
        (_, next) => log.add(next.status),
        fireImmediately: true,
      );
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap(); // idle → listening
      expect(container.read(vidyaControllerProvider).status,
          VidyaStatus.listening);

      await vidya.onMicTap(); // listening → … → idle

      expect(
        _hasSubsequence(log, const [
          VidyaStatus.idle,
          VidyaStatus.requestingPermission,
          VidyaStatus.listening,
          VidyaStatus.transcribing,
          VidyaStatus.thinking,
          VidyaStatus.speaking,
          VidyaStatus.idle,
        ]),
        isTrue,
        reason: 'the machine must pass through every phase in order: $log',
      );

      final state = container.read(vidyaControllerProvider);
      expect(state.status, VidyaStatus.idle);
      expect(state.conversation, hasLength(2));
      expect(state.conversation[0].role, ConversationRole.teacher);
      expect(state.conversation[0].text, 'lesson plan on fractions');
      expect(state.conversation[1].role, ConversationRole.vidya);
      expect(state.conversation[1].text, 'Making your Class 10 Maths lesson plan.');

      // The recorded WAV really was uploaded, and VIDYA spoke back.
      expect(client.multiparts.single.path, '/api/ai/voice-to-text');
      expect(player.played, ['QUJD']);
      expect(recorder.stopCount, 1);
    });

    test('a single valid action becomes the pending navigation, no chips',
        () async {
      final container = _container(client: _happyClient());
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();
      await vidya.onMicTap();

      final state = container.read(vidyaControllerProvider);
      expect(state.pendingNavigation, isNotNull);
      expect(state.pendingNavigation!.flow, VidyaFlow.lessonPlan);
      expect(state.pendingNavigation!.params.topic, 'Fractions');
      // A single action auto-navigates; the reply block carries no confirm chip.
      expect(state.conversation.last.directives, isEmpty);

      // The home consumes it and clears it.
      vidya.consumeNavigation();
      expect(container.read(vidyaControllerProvider).pendingNavigation, isNull);
    });

    test('sends uiLanguage and learns grade/subject but NEVER the language',
        () async {
      final container = _container(client: _happyClient());
      final client = container.read(apiClientProvider) as FakeApiClient;
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();
      await vidya.onMicTap();

      // STT bias + assistant both carry the explicit UI language (default en).
      expect(
        client.multiparts.single.data.fields
            .firstWhere((f) => f.key == 'expectedLanguage')
            .value,
        'en',
      );
      final assistantBody = client.posts
          .firstWhere((p) => p.path == '/api/assistant')
          .data as Map<String, dynamic>;
      expect(assistantBody['uiLanguage'], 'en');
      expect(assistantBody['message'], 'lesson plan on fractions');

      // Profile learned grade/subject from the action — but the utterance's
      // Hindi language never poisons the saved profile (SPEC §A.7).
      final profile = container.read(vidyaControllerProvider).profile;
      expect(profile?.preferredGrade, 'Class 10');
      expect(profile?.preferredSubject, 'Maths');
      expect(profile?.preferredLanguage, isNull);
    });
  });

  group('the directive branches (0 / 1 / 2–3)', () {
    test('0 actions is a speak-only turn (no chips, no navigation)', () async {
      final container = _container(
        client: _happyClient(
          assistant: {'response': 'Fractions are equal parts.', 'plannedActions': []},
        ),
      );
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();
      await vidya.onMicTap();

      final state = container.read(vidyaControllerProvider);
      expect(state.pendingNavigation, isNull);
      expect(state.conversation.last.text, 'Fractions are equal parts.');
      expect(state.conversation.last.directives, isEmpty);
    });

    test('2–3 actions render confirm chips; picking one routes + drops it',
        () async {
      final container = _container(
        client: _happyClient(
          assistant: {
            'response': 'I can make both.',
            'plannedActions': [
              {'type': 'NAVIGATE_AND_FILL', 'flow': 'lesson-plan', 'params': {'topic': 'Fractions'}},
              {'type': 'NAVIGATE_AND_FILL', 'flow': 'quiz-generator', 'params': {'topic': 'Fractions'}},
            ],
          },
        ),
      );
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();
      await vidya.onMicTap();

      var state = container.read(vidyaControllerProvider);
      // A compound intent does NOT auto-navigate; it offers chips.
      expect(state.pendingNavigation, isNull);
      expect(state.conversation.last.directives, hasLength(2));

      final chosen = state.conversation.last.directives.first;
      vidya.dispatchDirective(chosen);

      state = container.read(vidyaControllerProvider);
      expect(state.pendingNavigation, chosen);
      // The chosen chip is removed; the other remains offered.
      expect(state.conversation.last.directives, hasLength(1));
      expect(state.conversation.last.directives.single.flow, VidyaFlow.quizGenerator);
    });

    test('an unknown flow is dropped by the enum guard (no 404)', () async {
      final container = _container(
        client: _happyClient(
          assistant: {
            'response': 'Done.',
            'plannedActions': [
              {'type': 'NAVIGATE_AND_FILL', 'flow': 'teleport-machine', 'params': {}},
            ],
          },
        ),
      );
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();
      await vidya.onMicTap();

      final state = container.read(vidyaControllerProvider);
      // Guarded away → a speak-only turn, never a route to a 404.
      expect(state.pendingNavigation, isNull);
      expect(state.conversation.last.directives, isEmpty);
    });
  });

  group('typed error branches', () {
    test('a 401 on VIDYA → signed-out, keeping what the teacher said', () async {
      final container = _container(
        client: FakeApiClient(
          multipartResponse: {'text': 'plan a lesson', 'language': 'en'},
          postErrorsByPath: {'/api/assistant': _unauthorized},
        ),
      );
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();
      await vidya.onMicTap();

      final state = container.read(vidyaControllerProvider);
      expect(state.status, VidyaStatus.signedOut);
      // The teacher's words remain inked; VIDYA simply could not answer.
      expect(state.conversation.single.role, ConversationRole.teacher);
    });

    test('a 401 on STT → signed-out before anything is inked', () async {
      final container = _container(
        client: FakeApiClient(multipartError: _unauthorized),
      );
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();
      await vidya.onMicTap();

      final state = container.read(vidyaControllerProvider);
      expect(state.status, VidyaStatus.signedOut);
      expect(state.conversation, isEmpty);
    });

    test('a 429 on VIDYA → the calm limit state', () async {
      final container = _container(
        client: FakeApiClient(
          multipartResponse: {'text': 'plan a lesson', 'language': 'en'},
          postErrorsByPath: {'/api/assistant': _rateLimited},
        ),
      );
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();
      await vidya.onMicTap();

      expect(container.read(vidyaControllerProvider).status,
          VidyaStatus.limitReached);
    });

    test('a network failure → the retryable failed state', () async {
      final container = _container(
        client: FakeApiClient(
          multipartResponse: {'text': 'plan a lesson', 'language': 'en'},
          postErrorsByPath: {'/api/assistant': _offline},
        ),
      );
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();
      await vidya.onMicTap();

      expect(
          container.read(vidyaControllerProvider).status, VidyaStatus.failed);
    });
  });

  group('permission', () {
    test('a permanent denial → the dignified mic-denied state', () async {
      final container = _container(
        client: _happyClient(),
        permission: FakeMicPermissionService(MicPermission.permanentlyDenied),
      );
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();

      expect(
          container.read(vidyaControllerProvider).status, VidyaStatus.micDenied);
    });

    test('a soft denial returns to idle (the next tap can ask again)', () async {
      final container = _container(
        client: _happyClient(),
        permission: FakeMicPermissionService(MicPermission.denied),
      );
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();

      expect(container.read(vidyaControllerProvider).status, VidyaStatus.idle);
    });
  });

  group('unexpected plugin failures (silent-bounce regression, T1-U6)', () {
    test(
        'the permission plugin throwing (not a denial) lands on the '
        'dignified failed state, never a silent idle bounce', () async {
      final container = _container(
        client: _happyClient(),
        permission: FakeMicPermissionService()
          ..throwOnEnsureGranted = Exception('platform channel hiccup'),
      );
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();

      final state = container.read(vidyaControllerProvider);
      expect(state.status, VidyaStatus.failed);
      expect(state.status, isNot(VidyaStatus.idle));
    });

    test('the recorder failing to start lands on the failed state', () async {
      final recorder = FakeAudioRecorderService()
        ..throwOnStart = Exception('mic already in use');
      final container = _container(client: _happyClient(), recorder: recorder);
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();

      expect(
          container.read(vidyaControllerProvider).status, VidyaStatus.failed);
    });

    test('the recorder failing to stop/flush lands on the failed state',
        () async {
      final recorder = FakeAudioRecorderService()
        ..throwOnStop = Exception('flush failed');
      final container = _container(client: _happyClient(), recorder: recorder);
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap(); // idle → listening
      await vidya.onMicTap(); // listening → stop (throws) → failed

      expect(
          container.read(vidyaControllerProvider).status, VidyaStatus.failed);
    });

    test(
        'regression: a permanent denial and a soft denial are untouched by '
        'this fix', () async {
      final permanent = _container(
        client: _happyClient(),
        permission: FakeMicPermissionService(MicPermission.permanentlyDenied),
      );
      await permanent.read(vidyaControllerProvider.notifier).onMicTap();
      expect(permanent.read(vidyaControllerProvider).status,
          VidyaStatus.micDenied);

      final soft = _container(
        client: _happyClient(),
        permission: FakeMicPermissionService(MicPermission.denied),
      );
      await soft.read(vidyaControllerProvider.notifier).onMicTap();
      expect(soft.read(vidyaControllerProvider).status, VidyaStatus.idle);
    });
  });

  group('guards', () {
    test('a near-empty capture is rejected before paying for STT', () async {
      final recorder = FakeAudioRecorderService(captureBytes: 500); // < 2000
      final client = _happyClient();
      final container = _container(client: client, recorder: recorder);
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();
      await vidya.onMicTap();

      expect(container.read(vidyaControllerProvider).status, VidyaStatus.idle);
      expect(container.read(vidyaControllerProvider).conversation, isEmpty);
      expect(client.multiparts, isEmpty, reason: 'no STT call for silence');
    });

    test('a Gemini refusal string never becomes a fake teacher turn', () async {
      final container = _container(
        client: FakeApiClient(
          multipartResponse: {
            'text': 'I cannot transcribe this audio.',
            'language': 'en',
          },
        ),
      );
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();
      await vidya.onMicTap();

      final state = container.read(vidyaControllerProvider);
      expect(state.status, VidyaStatus.idle);
      expect(state.conversation, isEmpty);
    });

    test('cancel abandons an in-flight trip (a stale result never applies)',
        () async {
      final player = FakeAudioPlayerService();
      // A delayed STT keeps the trip in flight while we cancel it.
      final client = _happyClient(delay: const Duration(milliseconds: 60));
      final container =
          _container(client: client, player: player);
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap(); // listening
      final trip = vidya.onMicTap(); // → transcribing (STT delayed 60ms)
      await Future<void>.delayed(const Duration(milliseconds: 10));
      await vidya.cancel();
      await trip; // the delayed STT resolves stale and is discarded

      final state = container.read(vidyaControllerProvider);
      expect(state.status, VidyaStatus.idle);
      expect(state.conversation, isEmpty,
          reason: 'the abandoned utterance must not ink a block');
      expect(player.stopCount, greaterThanOrEqualTo(1));
    });
  });

  group('manual clear (U9 — the Trash2 "Clear conversation" action)', () {
    test(
        'clears the transcript/history/session/pending-nav but keeps the '
        'learned profile', () async {
      final container = _container(client: _happyClient());
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap();
      await vidya.onMicTap();

      final before = container.read(vidyaControllerProvider);
      expect(before.conversation, isNotEmpty);
      expect(before.chatHistory, isNotEmpty);
      expect(before.sessionId, isNotNull);
      expect(before.profile?.preferredGrade, 'Class 10');
      expect(before.profile?.preferredSubject, 'Maths');

      vidya.clearConversation();

      final after = container.read(vidyaControllerProvider);
      expect(after.conversation, isEmpty);
      expect(after.chatHistory, isEmpty);
      expect(after.sessionId, isNull);
      expect(after.pendingNavigation, isNull);
      expect(after.screenPath, isNull);
      expect(after.status, VidyaStatus.idle);
      // The learned profile is a teacher PREFERENCE, not conversation content
      // — the web's resetContext() deliberately keeps it across a reset, and
      // so does this.
      expect(after.profile?.preferredGrade, 'Class 10');
      expect(after.profile?.preferredSubject, 'Maths');
    });

    test('abandons an in-flight trip (a stale result never re-applies)',
        () async {
      final client = _happyClient(delay: const Duration(milliseconds: 60));
      final container = _container(client: client);
      final vidya = container.read(vidyaControllerProvider.notifier);

      await vidya.onMicTap(); // listening
      final trip = vidya.onMicTap(); // -> transcribing (STT delayed 60ms)
      await Future<void>.delayed(const Duration(milliseconds: 10));
      vidya.clearConversation();
      await trip; // the delayed STT resolves stale and is discarded

      final state = container.read(vidyaControllerProvider);
      expect(state.conversation, isEmpty);
      expect(state.status, VidyaStatus.idle);
    });

    test('is a safe no-op shape on an already-idle, empty controller',
        () async {
      final container = _container(client: _happyClient());
      final vidya = container.read(vidyaControllerProvider.notifier);

      vidya.clearConversation();

      final state = container.read(vidyaControllerProvider);
      expect(state.conversation, isEmpty);
      expect(state.status, VidyaStatus.idle);
    });
  });

  group('language mapping', () {
    test('normaliseVidyaLanguage handles aliases, names, and region tags', () {
      expect(normaliseVidyaLanguage('od'), 'or');
      expect(normaliseVidyaLanguage('Hindi'), 'hi');
      expect(normaliseVidyaLanguage('hi-IN'), 'hi');
      expect(normaliseVidyaLanguage('KANNADA'), 'kn');
      expect(normaliseVidyaLanguage('klingon'), isNull);
      expect(normaliseVidyaLanguage(null), isNull);
    });

    test('vidyaTtsBcp47: mr borrows Hindi, or falls to English', () {
      expect(vidyaTtsBcp47('mr'), 'hi-IN');
      expect(vidyaTtsBcp47('or'), 'en-IN');
      expect(vidyaTtsBcp47('ta'), 'ta-IN');
      expect(vidyaTtsBcp47('nonsense'), 'en-IN');
    });

    test('isLikelyTranscriptionRefusal is narrow', () {
      expect(isLikelyTranscriptionRefusal('cannot process the audio'), isTrue);
      expect(isLikelyTranscriptionRefusal('Plan a lesson on fractions'), isFalse);
    });
  });
}
