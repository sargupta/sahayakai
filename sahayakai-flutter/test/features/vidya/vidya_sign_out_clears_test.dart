import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sahayakai/core/auth/auth_providers.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/features/vidya/presentation/vidya_controller.dart';
import 'package:sahayakai/shared/voice/audio_player_service.dart';
import 'package:sahayakai/shared/voice/audio_recorder_service.dart';
import 'package:sahayakai/shared/voice/mic_permission_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../../support/fake_voice.dart';

/// U9 — a real cross-teacher data leak: [VidyaController] is `keepAlive`
/// (SPEC §C.5: it must follow a teacher across every screen), so on a shared
/// device the FIRST teacher's transcript (and learned grade/subject profile)
/// used to sit there for the NEXT teacher who signed in — `signOut()` never
/// touched it. `AuthController.signOut()` now invalidates the VIDYA provider
/// first, so the next session starts from a genuinely fresh controller.

FakeApiClient _happyClient() => FakeApiClient(
      multipartResponse: {'text': 'plan a lesson', 'language': 'en'},
      postResponsesByPath: {
        '/api/assistant': {
          'response': 'Making your Class 10 Maths lesson plan.',
          'plannedActions': [
            {
              'type': 'NAVIGATE_AND_FILL',
              'flow': 'lesson-plan',
              'params': {'topic': 'Fractions', 'gradeLevel': 'Class 10', 'subject': 'Maths'},
            },
          ],
        },
        '/api/tts': {'audioContent': 'QUJD'},
        '/api/vidya/session': {'success': true},
        '/api/vidya/profile': {'success': true},
      },
    );

void main() {
  setUp(() => SharedPreferences.setMockInitialValues(<String, Object>{}));

  test('signOut() resets VIDYA to a fresh, empty conversation', () async {
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(_happyClient()),
        audioRecorderServiceProvider
            .overrideWithValue(FakeAudioRecorderService()),
        audioPlayerServiceProvider.overrideWithValue(FakeAudioPlayerService()),
        micPermissionServiceProvider
            .overrideWithValue(FakeMicPermissionService()),
      ],
    );
    addTearDown(container.dispose);

    // A teacher has a real turn: something is now inked into the (keepAlive)
    // controller — the exact shape that must not leak to the next sign-in.
    final vidya = container.read(vidyaControllerProvider.notifier);
    await vidya.onMicTap();
    await vidya.onMicTap();

    final before = container.read(vidyaControllerProvider);
    expect(before.conversation, isNotEmpty);
    expect(before.profile?.preferredGrade, 'Class 10');

    // Firebase is never configured in a test process (FirebaseInit.isConfigured
    // stays false), so this exercises exactly what a stub-token dev build (and
    // the early-return branch every real device also takes when Firebase init
    // itself fails) does too — the VIDYA reset must not be gated behind that
    // early return.
    await container.read(authControllerProvider.notifier).signOut();

    final after = container.read(vidyaControllerProvider);
    expect(after.conversation, isEmpty);
    expect(after.chatHistory, isEmpty);
    expect(after.sessionId, isNull);
    expect(after.pendingNavigation, isNull);
    expect(after.status, VidyaStatus.idle);
    // The outgoing teacher's learned profile must not leak to the next
    // sign-in either — unlike the manual "Clear conversation" action (which
    // deliberately keeps it), a sign-out wipes it too.
    expect(after.profile, isNull);
  });

  test('signOut() on an already-empty controller is a safe no-op shape',
      () async {
    final container = ProviderContainer(
      overrides: [
        apiClientProvider.overrideWithValue(_happyClient()),
        audioRecorderServiceProvider
            .overrideWithValue(FakeAudioRecorderService()),
        audioPlayerServiceProvider.overrideWithValue(FakeAudioPlayerService()),
        micPermissionServiceProvider
            .overrideWithValue(FakeMicPermissionService()),
      ],
    );
    addTearDown(container.dispose);

    await container.read(authControllerProvider.notifier).signOut();

    final state = container.read(vidyaControllerProvider);
    expect(state.conversation, isEmpty);
    expect(state.status, VidyaStatus.idle);
  });
}
