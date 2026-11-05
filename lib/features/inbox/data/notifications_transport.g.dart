// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notifications_transport.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$notificationsTransportHash() =>
    r'42ced0e16b3f2963132bc97baf42d0c74de89065';

/// The bound notifications transport. Always the Firebase-free
/// [DeferredNotificationsTransport]: no screen reads the server's social
/// notification feed yet (the Updates tab is the on-device
/// `notificationsProvider`), and a live binding must not be half-wired. It
/// previously THREW whenever Firebase was configured — i.e. on every real
/// launch — which would crash the first widget to read it; returning the
/// deferred seam keeps any reader safe until a live implementation exists.
///
/// Copied from [notificationsTransport].
@ProviderFor(notificationsTransport)
final notificationsTransportProvider =
    Provider<NotificationsTransport>.internal(
      notificationsTransport,
      name: r'notificationsTransportProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$notificationsTransportHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef NotificationsTransportRef = ProviderRef<NotificationsTransport>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
