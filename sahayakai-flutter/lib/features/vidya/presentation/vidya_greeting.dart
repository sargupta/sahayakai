import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/i18n/locale_provider.dart';
import '../../../shared/voice/tts_speaker.dart';

/// Whether the mother-tongue greeting has already been spoken this app session.
/// A plain (kept-alive) provider, so it survives home rebuilds / tab switches and
/// resets only on a full restart — the greeting plays at most once per launch.
final vidyaSessionGreetedProvider = StateProvider<bool>((ref) => false);

/// Speaks a brief mother-tongue welcome ONCE per session on the voice home, in
/// the teacher's current language ([localeControllerProvider]) through the
/// existing TTS ([ttsSpeakerProvider]) — the same stack that is also the Gemini
/// Live fallback (never deleted). Reuses `speak()`, so the cost cap, last-clip
/// cache and non-overlap guards all apply.
///
/// Guards: skipped under reduce-motion ([motionEnabled] == false — no surprise
/// audio), and skipped once it has greeted. Fire-and-forget: an empty or failed
/// greeting must never surface — the home is already on screen.
///
/// **The trigger is a FOUNDER UX call.** This is the auto-on-open default the
/// founder asked for ("audio should start from greetings on their mother
/// tongue"); switching to tap-to-hear is a one-line move — stop calling this in
/// the home's initState and call it from a "listen" control instead.
void maybeSpeakVidyaGreeting(
  WidgetRef ref, {
  required bool motionEnabled,
  required String greeting,
}) {
  if (!motionEnabled) return;
  if (ref.read(vidyaSessionGreetedProvider)) return;
  ref.read(vidyaSessionGreetedProvider.notifier).state = true;
  final language = ref.read(localeControllerProvider).aiName;
  unawaited(
    ref
        .read(ttsSpeakerProvider)
        .speak(greeting, language: language)
        .catchError((_) => null),
  );
}
