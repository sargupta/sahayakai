# SahayakAI Flutter App (Phase T scaffolding)

This is the offline-capable mobile app rebuild. Uses the Firebase AI Logic
Dart SDK (`firebase_ai`). The intent is `useHybridInference: true` so
Gemini Nano runs on-device when no connectivity. **As of `firebase_ai`
2.3.0 (April 2026), the hybrid inference flag is not yet exposed by the
public Dart SDK.** The wrapper at `lib/services/sahayakai_ai.dart` ships
with the toggle wired through a constant (`_hybridInferenceAvailable`)
and a clearly marked spot to flip the flag the day it lands.

## Hybrid agents (Phase T)

- instant-answer — runs on-device for cached topics, cloud for fresh.
- vidya intent classifier — on-device for the 11-way classifier.
- voice-to-text — on-device for short utterances, cloud for long.

## Cloud-only agents (still hit sidecar)

- All 9 routable flows (lesson-plan, quiz, etc.) — too complex for Nano.
- Image gen (visual-aid, avatar) — too compute-heavy.

## Setup

1. `cd sahayakai-flutter && flutter pub get`
2. `flutterfire configure --project=sahayakai-b4248` to wire the GCP
   project and generate `firebase_options.dart`. (Requires the FlutterFire
   CLI: `dart pub global activate flutterfire_cli`.)
3. `flutter run` (Android emulator preferred for Nano support).

## Migration plan

- **Phase T.1** (this commit): scaffolding — 3 agents wired to the SDK,
  hybrid toggle staged behind `_hybridInferenceAvailable`.
- **Phase T.2**: parity tests — run a 100-prompt set on emulator,
  compare on-device vs cloud results.
- **Phase T.3**: rollout — flag-gated by feature flags, mirroring the
  sidecar ramp pattern.

## Project layout

```
sahayakai-flutter/
  pubspec.yaml             firebase_core, firebase_app_check, firebase_ai,
                           record, path_provider
  lib/
    main.dart              Firebase init + home shell
    services/
      sahayakai_ai.dart    GenerativeModel handles + hybrid toggle
    screens/
      instant_answer_screen.dart
      vidya_classifier_screen.dart
      voice_to_text_screen.dart
  test/widget_test.dart    Phase T.1 placeholder
```
