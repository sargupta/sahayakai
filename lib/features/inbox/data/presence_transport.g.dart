// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'presence_transport.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$presenceTransportHash() => r'fd12bff83755d6328858b2985f8cd6394523af02';

/// The bound presence transport. Always the best-effort
/// [DeferredPresenceTransport] (unknown presence, no typing, no-op writes):
/// there is no RTDB presence implementation yet. It previously THREW whenever
/// Firebase was configured — i.e. on every real launch — which would crash the
/// first widget to read it; presence is a nicety, so the safe default is the
/// deferred seam until a live implementation is bound.
///
/// Copied from [presenceTransport].
@ProviderFor(presenceTransport)
final presenceTransportProvider = Provider<PresenceTransport>.internal(
  presenceTransport,
  name: r'presenceTransportProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$presenceTransportHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef PresenceTransportRef = ProviderRef<PresenceTransport>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
