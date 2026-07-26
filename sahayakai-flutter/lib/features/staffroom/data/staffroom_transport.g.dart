// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'staffroom_transport.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$staffroomTransportHash() =>
    r'0d5afe05ee8b4cd9b24816e8dcd5aa399cabb8ba';

/// The Staffroom transport. [FirestoreStaffroomTransport] once Firebase is
/// configured **and** a real teacher is signed in; [DeferredStaffroomTransport]
/// otherwise — including a genuinely signed-out teacher, so the signed-out UI
/// (the "sign in to join the staffroom" `EmptyView`) renders exactly as it
/// does today. Mirrors `inboxTransportProvider`'s branch on
/// [authControllerProvider] (`core/auth/auth_providers.dart`) for consistency:
/// the same provider both the router and every other Block-C-adjacent surface
/// already agree is the source of truth for "is this a real signed-in
/// teacher."
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
