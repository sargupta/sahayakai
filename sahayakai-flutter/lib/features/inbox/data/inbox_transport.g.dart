// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'inbox_transport.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$inboxTransportHash() => r'4f68ad9b12b4e741c9596dc3a87cabc14f687d82';

/// The Pro-Inbox transport. [FirestoreInboxTransport] once Firebase is
/// configured **and** a real teacher is signed in; [DeferredInboxTransport]
/// otherwise — including a genuinely signed-out teacher, so the signed-out UI
/// (the DM-gate `EmptyView`) renders exactly as it does today. Mirrors
/// `profileDocSource`'s branch on [authControllerProvider] (`core/auth/
/// auth_providers.dart`) for consistency: the same provider both the router
/// and every other Block-C-adjacent surface already agree is the source of
/// truth for "is this a real signed-in teacher."
///
/// Copied from [inboxTransport].
@ProviderFor(inboxTransport)
final inboxTransportProvider = Provider<InboxTransport>.internal(
  inboxTransport,
  name: r'inboxTransportProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$inboxTransportHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef InboxTransportRef = ProviderRef<InboxTransport>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
