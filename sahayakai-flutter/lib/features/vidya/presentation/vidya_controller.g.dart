// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'vidya_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$vidyaControllerHash() => r'977a4b0130a19b8aea892ca3c2f470291c91eb5d';

/// The single VIDYA brain: the coupled capture + conversation state machine
/// (SPEC §A.6) that the home mic and every inline mic feed.
///
/// One mic press runs `capture → STT → VIDYA → TTS → navigate/persist`. Every
/// `await` is guarded by a generation counter ([_stale]) so a cancel or a fresh
/// tap abandons an in-flight trip instead of applying a stale result. Errors are
/// typed: 401 → [VidyaStatus.signedOut] (expected on the stub token until real
/// auth), 429 → [VidyaStatus.limitReached], network/timeout/server →
/// [VidyaStatus.failed].
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
