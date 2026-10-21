// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'voice_mode_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$voiceModeControllerHash() =>
    r'82c314c4d06b3e995b8a2da86bd31964c00b0826';

/// The persisted VIDYA voice mode, same local-preference shape as
/// [LocaleController] / `NotificationPrefsController`. Kept alive so the choice
/// follows the teacher across every screen, and hydrated from
/// shared_preferences so it survives a relaunch. Defaults to
/// [VoiceMode.turnBased]: the Live surface is opt-in and the turn-based
/// pipeline is always the fallback.
///
/// Copied from [VoiceModeController].
@ProviderFor(VoiceModeController)
final voiceModeControllerProvider =
    NotifierProvider<VoiceModeController, VoiceMode>.internal(
      VoiceModeController.new,
      name: r'voiceModeControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$voiceModeControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$VoiceModeController = Notifier<VoiceMode>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
