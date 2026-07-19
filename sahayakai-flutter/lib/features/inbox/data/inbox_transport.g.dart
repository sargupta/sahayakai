// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'inbox_transport.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$inboxTransportHash() => r'1eceeaed0e74896674bd7f46ff509767df2cba61';

/// The Pro-Inbox transport. Bound to [DeferredInboxTransport] until Firebase is
/// wired; swap to `FirestoreInboxTransport` at the handoff (see the throw below —
/// it fails loudly if someone flips `FirebaseInit.isConfigured` without wiring
/// the live impl, rather than silently staying deferred).
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
