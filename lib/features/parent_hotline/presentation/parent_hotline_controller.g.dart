// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'parent_hotline_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$callabilityPolicyHash() => r'97e802219ac9bd5b17ddef2cdc17c0c45e380cc0';

/// See also [callabilityPolicy].
@ProviderFor(callabilityPolicy)
final callabilityPolicyProvider =
    AutoDisposeProvider<CallabilityPolicy>.internal(
      callabilityPolicy,
      name: r'callabilityPolicyProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$callabilityPolicyHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef CallabilityPolicyRef = AutoDisposeProviderRef<CallabilityPolicy>;
String _$parentHotlineControllerHash() =>
    r'e7957cf20e91eff43ce8cb6431c64b2099832192';

/// The Parent Hotline brain (SPEC §B.3): the staged flow + the exact web poll
/// discipline + resume.
///
/// **Poll safety.** Polling is a self-rescheduling [Timer] guarded by a
/// generation counter ([_pollGen]) and a [_disposed] flag, both checked after
/// every `await`. Leaving `calling` stops polling ONLY — it never cancels the
/// server-side call (SPEC §B.5.5); re-opening resumes via `latestForStudent`.
///
/// **One action at a time.** Every action method returns early while
/// [ParentHotlineState.isBusy] is set; the flag is raised synchronously, before
/// the first `await`, so a double-tap in one frame places one call.
///
/// **Per-student state.** The controller is keepAlive, so every student
/// switch (an [init], a [selectStudent]) resets EVERY per-student field — the
/// note, evidence, draft, spoken script, outreach, call result — and bumps
/// [_flowGen], which orphans any in-flight draft/create/call continuation.
///
/// Copied from [ParentHotlineController].
@ProviderFor(ParentHotlineController)
final parentHotlineControllerProvider =
    NotifierProvider<ParentHotlineController, ParentHotlineState>.internal(
      ParentHotlineController.new,
      name: r'parentHotlineControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$parentHotlineControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$ParentHotlineController = Notifier<ParentHotlineState>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
