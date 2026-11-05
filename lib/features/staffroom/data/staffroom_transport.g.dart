// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'staffroom_transport.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$staffroomTransportHash() =>
    r'829dc8807e134ea9a2b0ddcf171e40369bd05e1b';

/// The Staffroom transport. [FirestoreStaffroomTransport] once Firebase is
/// configured **and** a real teacher is signed in; [DeferredStaffroomTransport]
/// otherwise — including a genuinely signed-out teacher, so the signed-out UI
/// renders. Mirrors `inboxTransportProvider`'s branch on
/// [authControllerProvider] (`core/auth/auth_providers.dart`).
///
/// Copied from [staffroomTransport].
@ProviderFor(staffroomTransport)
final staffroomTransportProvider = Provider<StaffroomTransport>.internal(
  staffroomTransport,
  name: r'staffroomTransportProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$staffroomTransportHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef StaffroomTransportRef = ProviderRef<StaffroomTransport>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
