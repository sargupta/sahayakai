// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'vidya_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$vidyaControllerHash() => r'610e0b56994b6daaf9143c06fc1e940c14e9bc0b';

/// The single VIDYA brain: the coupled capture + conversation state machine
/// (SPEC §A.6) that the home mic and every inline mic feed.
///
/// One mic press runs `capture → STT → VIDYA → TTS → navigate/persist`. Every
/// `await` is guarded by a generation counter ([_stale]) so a cancel or a fresh
/// tap abandons an in-flight trip instead of applying a stale result. Errors are
/// typed: 401 → [VidyaStatus.signedOut] (expected on the stub token until real
/// auth), 429 → [VidyaStatus.limitReached], network/timeout/server →
/// [VidyaStatus.failed]. The same [VidyaStatus.failed] dignified state (a
/// title, body copy and a Retry action — see `vidya_status_ui.dart`) is also
/// where an UNEXPECTED capture-side failure lands: the permission plugin
/// throwing, the recorder failing to start, or the recorder failing to stop.
/// None of those are the expected "permission denied" outcome (that is a
/// [MicPermission] return value, handled below and left exactly as-is) — they
/// are plugin hiccups, and silently resetting to [VidyaStatus.idle] for them
/// would be indistinguishable from the pre-tap state (SPEC-adjacent bug class:
/// see `b9a961e3c`/`114bd3d47`, "silently bounced back").
///
/// Copied from [VidyaController].
@ProviderFor(VidyaController)
final vidyaControllerProvider =
    NotifierProvider<VidyaController, VidyaState>.internal(
      VidyaController.new,
      name: r'vidyaControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$vidyaControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$VidyaController = Notifier<VidyaState>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
