// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$googleSignInHash() => r'1348319e14d65c0c9e91482e18a743301479534e';

/// The shared [GoogleSignIn] instance. A provider (not a bare singleton) so a
/// test can override it with a fake and never touch a real Google account —
/// `google_sign_in`'s own platform channel throws in the widget-test
/// environment if invoked for real.
///
/// Copied from [googleSignIn].
@ProviderFor(googleSignIn)
final googleSignInProvider = Provider<GoogleSignIn>.internal(
  googleSignIn,
  name: r'googleSignInProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$googleSignInHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef GoogleSignInRef = ProviderRef<GoogleSignIn>;
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

/// First-run bootstrap: `main()` already awaited `FirebaseInit
/// .ensureInitialized()` before `runApp`, so by the time this provider builds
/// Firebase is already up — this is a deliberate minimum splash dwell (a
/// beat to read the brand mark), not a simulation of anything still pending.
/// While this future is loading, the router parks on /splash.
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
String _$authControllerHash() => r'e276a137aba12e2583b0128a65bfe29649e15875';

/// The real auth controller. State mirrors `FirebaseAuth.instance
/// .authStateChanges()` — the single source of truth both the router and the
/// backend token exchange ([tokenProvider] in `core/network/api_providers.dart`)
/// agree on, which is what makes them consistent (the foundation-v1 stub had
/// two independent flags — a local one here, a real-backend one from VIDYA's
/// own 401 — that could disagree; that inconsistency was the actual cause of
/// a "Sign in" button silently bouncing back to Home instead of navigating,
/// fixed by removing the stub rather than working around it).
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
