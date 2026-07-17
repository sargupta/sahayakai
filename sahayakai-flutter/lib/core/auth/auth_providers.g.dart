// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$isSignedInHash() => r'dd40f6d87f221b1c13dfa0855f91167a40a33ae5';

/// Convenience sync snapshot: is a user currently signed in.
///
/// Copied from [isSignedIn].
@ProviderFor(isSignedIn)
final isSignedInProvider = AutoDisposeProvider<bool>.internal(
  isSignedIn,
  name: r'isSignedInProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$isSignedInHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef IsSignedInRef = AutoDisposeProviderRef<bool>;
String _$appBootstrapHash() => r'c2dc482a228589b54d09670751cd45f5e33cf530';

/// Simulates first-run bootstrap (what will become Firebase.initializeApp +
/// FirebaseAppCheck.activate + the first auth snapshot). While this future is
/// loading, the router parks on /splash.
///
/// TODO(P0.2): perform the real Firebase init + App Check activation here.
///
/// Copied from [appBootstrap].
@ProviderFor(appBootstrap)
final appBootstrapProvider = FutureProvider<void>.internal(
  appBootstrap,
  name: r'appBootstrapProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$appBootstrapHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef AppBootstrapRef = FutureProviderRef<void>;
String _$authControllerHash() => r'db2e707abd3e0a6e8705a8a238033be4ae2bc7e4';

/// STUB auth controller. The router redirect guard and the "am I signed in"
/// UI read this. Real Firebase auth lands in the NEXT unit (P0.2), which is
/// handoff-gated (needs `flutterfire configure` against the Firebase console).
///
/// TODO(P0.2): replace this with a Firebase-backed provider, e.g.
/// `@Riverpod(keepAlive: true) Stream<User?> authState(Ref ref) =>`
/// `ref.watch(firebaseAuthProvider).authStateChanges();`
///
/// Copied from [AuthController].
@ProviderFor(AuthController)
final authControllerProvider =
    NotifierProvider<AuthController, AuthStatus>.internal(
      AuthController.new,
      name: r'authControllerProvider',
      debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
          ? null
          : _$authControllerHash,
      dependencies: null,
      allTransitiveDependencies: null,
    );

typedef _$AuthController = Notifier<AuthStatus>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
