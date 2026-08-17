import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:sahayakai/core/i18n/gen/app_localizations.dart';
import 'package:sahayakai/core/network/api_exception.dart';
import 'package:sahayakai/core/network/api_providers.dart';
import 'package:sahayakai/features/vidya/presentation/widgets/inline_field_mic.dart';
import 'package:sahayakai/shared/voice/audio_recorder_service.dart';
import 'package:sahayakai/shared/voice/mic_permission_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/fake_api_client.dart';
import '../../support/fake_voice.dart';

/// U-V6 — the inline field mic runs STT only and drops the transcript into the
/// hosting field. Driven entirely with fake voice services + a [FakeApiClient],
/// so nothing opens a mic or a socket; STT 401s on the real stub, so success is
/// verified here with a faked transcription.

Future<void> _pumpMic(
  WidgetTester tester, {
  required ValueChanged<String> onResult,
  required FakeApiClient client,
  required FakeAudioRecorderService recorder,
  required FakeMicPermissionService permission,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        apiClientProvider.overrideWithValue(client),
        audioRecorderServiceProvider.overrideWithValue(recorder),
        micPermissionServiceProvider.overrideWithValue(permission),
      ],
      child: MaterialApp(
        // A plain M3 theme (not AppTheme) so the runAsync leg — which drives
        // real file IO for the STT step — never triggers a google_fonts network
        // fetch. The mic only needs the ColorScheme roles, which any theme has.
        theme: ThemeData(useMaterial3: true),
        locale: const Locale('en'),
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: Scaffold(
          body: Center(child: InlineFieldMic(onResult: onResult)),
        ),
      ),
    ),
  );
  await tester.pump();
}

void main() {
  setUp(() {
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues(<String, Object>{});
  });

  testWidgets('tap → speak → tap fills the field from a fake STT result', (
    tester,
  ) async {
    final recorder = FakeAudioRecorderService();
    final permission = FakeMicPermissionService();
    final client = FakeApiClient(
      multipartResponse: {'text': 'photosynthesis', 'language': 'en'},
    );
    String? result;

    await _pumpMic(
      tester,
      onResult: (t) => result = t,
      client: client,
      recorder: recorder,
      permission: permission,
    );

    // Tap once → permission → recording (listening). Both fakes are immediate,
    // so a plain pump reaches the listening state.
    await tester.tap(find.byType(InlineFieldMic));
    await tester.pump();
    expect(recorder.startCount, 1);

    // Tap again → stop → read the captured WAV → STT → onResult. Reading the
    // recording is real file IO, so it must run under runAsync to complete in
    // the test's fake-async zone (mirrors how the controller test drives it).
    await tester.runAsync(() async {
      await tester.tap(find.byType(InlineFieldMic));
      await Future<void>.delayed(const Duration(milliseconds: 50));
    });
    await tester.pump();

    expect(result, 'photosynthesis');
    expect(recorder.stopCount, 1);
    expect(client.multiparts.single.path, '/api/ai/voice-to-text');
  });

  testWidgets('a permission denial returns quietly to idle, never a dialog', (
    tester,
  ) async {
    final recorder = FakeAudioRecorderService();
    final client = FakeApiClient(
      multipartResponse: {'text': 'ignored', 'language': 'en'},
    );
    String? result;

    await _pumpMic(
      tester,
      onResult: (t) => result = t,
      client: client,
      recorder: recorder,
      permission: FakeMicPermissionService(MicPermission.permanentlyDenied),
    );

    await tester.tap(find.byType(InlineFieldMic));
    await tester.pumpAndSettle();

    // No recording started, no field filled, no crash. This is the
    // deliberately-benign path (SPEC-adjacent): still silent, unchanged by
    // the T1-U6 fix.
    expect(recorder.startCount, 0);
    expect(result, isNull);
    expect(tester.takeException(), isNull);
    expect(find.byType(SnackBar), findsNothing);
  });

  testWidgets(
    'an unexpected STT failure (network/401/413) shows a brief snackbar, '
    'not silence',
    (tester) async {
      final recorder = FakeAudioRecorderService();
      final client = FakeApiClient(
        multipartError: const ApiException(
          ApiErrorKind.network,
          'No internet connection.',
        ),
      );
      String? result;

      await _pumpMic(
        tester,
        onResult: (t) => result = t,
        client: client,
        recorder: recorder,
        permission: FakeMicPermissionService(),
      );

      await tester.tap(find.byType(InlineFieldMic));
      await tester.pump();
      expect(recorder.startCount, 1);

      await tester.runAsync(() async {
        await tester.tap(find.byType(InlineFieldMic));
        await Future<void>.delayed(const Duration(milliseconds: 50));
      });
      await tester.pump(); // let the SnackBar animate in

      // The field mic still resets to idle and never fills the field with
      // garbage — but unlike before this fix, the teacher now sees SOMETHING.
      expect(result, isNull);
      expect(recorder.stopCount, 1);
      expect(find.byType(SnackBar), findsOneWidget);
      expect(
        find.text("Didn't catch that. Try again or type it in."),
        findsOneWidget,
      );

      // Cleanly dismiss so the timer doesn't leak into the next test.
      await tester.pumpAndSettle(const Duration(seconds: 5));
    },
  );

  testWidgets('a near-silent capture never pays for STT nor fills the field', (
    tester,
  ) async {
    final recorder = FakeAudioRecorderService(captureBytes: 500); // < 2000
    final client = FakeApiClient(
      multipartResponse: {'text': 'should not be used', 'language': 'en'},
    );
    String? result;

    await _pumpMic(
      tester,
      onResult: (t) => result = t,
      client: client,
      recorder: recorder,
      permission: FakeMicPermissionService(),
    );

    await tester.tap(find.byType(InlineFieldMic));
    await tester.pump();
    await tester.tap(find.byType(InlineFieldMic));
    await tester.pumpAndSettle();

    expect(result, isNull);
    expect(client.multiparts, isEmpty);
  });

  testWidgets('the tap target clears the 48dp accessibility floor', (
    tester,
  ) async {
    await _pumpMic(
      tester,
      onResult: (_) {},
      client: FakeApiClient(),
      recorder: FakeAudioRecorderService(),
      permission: FakeMicPermissionService(),
    );

    final size = tester.getSize(find.byType(InlineFieldMic));
    expect(size.width, greaterThanOrEqualTo(48));
    expect(size.height, greaterThanOrEqualTo(48));
  });
}
