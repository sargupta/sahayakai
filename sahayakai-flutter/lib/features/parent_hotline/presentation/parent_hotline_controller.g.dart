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
    r'c79a9e1561b28671bec2373783bc144ffb2d31aa';

/// The Parent Hotline brain (SPEC §B.3): the staged flow + the exact web poll
/// discipline + resume.
///
/// **Poll safety (the #1 correctness requirement).** Polling is a self-
/// rescheduling [Timer] (not `Timer.periodic`) so the cadence can vary (3s → 5s
/// → 3s). Two mechanisms guarantee no state is ever emitted after the flow moved
/// on or the screen died:
///   1. a generation counter [_pollGen] captured when a poll session starts and
///      compared after every `await` — a `_stopPolling` / leave / re-bind bumps
///      it, orphaning any in-flight poll continuation;
///   2. a [_disposed] flag set in `ref.onDispose`, checked before every state
///      write ([_set] is a no-op once disposed) and after every `await`.
/// The timer is cancelled in `ref.onDispose` AND whenever the flow leaves
/// `calling`. Leaving `calling` stops polling ONLY — it never cancels the
/// server-side call (SPEC §B.5.5); re-opening resumes via `latestForStudent`.
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
