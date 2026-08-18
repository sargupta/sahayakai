// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'mic_permission_service.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$micPermissionServiceHash() =>
    r'8d693c4bc8659bc97b3590bd953a72e28b5db266';

/// The injectable permission gate. Override in tests with a fake so the machine
/// never touches the OS. Kept alive so it follows VIDYA across navigation.
///
/// Copied from [micPermissionService].
@ProviderFor(micPermissionService)
final micPermissionServiceProvider = Provider<MicPermissionService>.internal(
  micPermissionService,
  name: r'micPermissionServiceProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$micPermissionServiceHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef MicPermissionServiceRef = ProviderRef<MicPermissionService>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
