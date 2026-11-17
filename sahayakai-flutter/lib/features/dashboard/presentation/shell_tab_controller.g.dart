// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'shell_tab_controller.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$shellTabControllerHash() =>
    r'df42bd1bed334dd2b94846ff3d73aa7647cfafa0';

/// The signed-in shell's current tab.
///
/// The four tabs share one route (`/`), so the route alone cannot say which
/// destination the teacher is on. The VIDYA overlay reads this to keep the
/// orb off Home only (where the Seal Mic is the mic) and on every other tab —
/// creation lives on the orb now that the tab bar has no Create slot.
///
/// Copied from [ShellTabController].
@ProviderFor(ShellTabController)
final shellTabControllerProvider =
    NotifierProvider<ShellTabController, AppTab>.internal(
      ShellTabController.new,
      name: r'shellTabControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$shellTabControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$ShellTabController = Notifier<AppTab>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
