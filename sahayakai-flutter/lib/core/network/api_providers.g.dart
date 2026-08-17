// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'api_providers.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$tokenProviderHash() => r'29bf7ec460f935327a3e933df572a69d5d405f8c';

/// The bearer-token source the dio auth interceptor reads: the real Firebase
/// ID token, or null when signed out. [forceRefresh] backs the interceptor's
/// one-retry-on-401 (a locally-cached token can be stale even though the
/// teacher is genuinely signed in).
///
/// Guarded on [FirebaseInit.isConfigured] for the same reason
/// `AuthController` is (core/auth/auth_providers.dart): `FirebaseAuth.instance`
/// throws with no default app registered, and a widget test never runs
/// `main()`'s `Firebase.initializeApp()`.
///
/// Copied from [tokenProvider].
@ProviderFor(tokenProvider)
final tokenProviderProvider = Provider<TokenProvider>.internal(
  tokenProvider,
  name: r'tokenProviderProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$tokenProviderHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef TokenProviderRef = ProviderRef<TokenProvider>;
String _$appCheckTokenProviderHash() =>
    r'8f8ed9491d7d7c5e33dc21ac57766ee2c269aae3';

/// The App Check attestation source the dio auth interceptor reads for the
/// `X-Firebase-AppCheck` header. Deliberately the same shape as
/// [tokenProvider] — a plain function behind a provider — so a test overrides
/// it with a fake and no test ever calls into Play Integrity.
///
/// Guarded on [FirebaseInit.isConfigured] for the same reason [tokenProvider]
/// is: `FirebaseAppCheck.instance` needs a registered default app, and a widget
/// test never runs `main()`'s `Firebase.initializeApp()`.
///
/// This returns the raw future without a try/catch on purpose. Swallowing here
/// too would put the best-effort rule in two places and let one of them drift;
/// `AuthInterceptor._appCheckToken` owns it — throw, null, and timeout all mean
/// "send the request without the header".
///
/// Copied from [appCheckTokenProvider].
@ProviderFor(appCheckTokenProvider)
final appCheckTokenProviderProvider = Provider<AppCheckTokenProvider>.internal(
  appCheckTokenProvider,
  name: r'appCheckTokenProviderProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$appCheckTokenProviderHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef AppCheckTokenProviderRef = ProviderRef<AppCheckTokenProvider>;
String _$apiClientHash() => r'757c7b1dfcee6333b6f27152181fe17fcb315ec7';

/// The single configured [ApiClient] used by every repository.
///
/// Copied from [apiClient].
@ProviderFor(apiClient)
final apiClientProvider = Provider<ApiClient>.internal(
  apiClient,
  name: r'apiClientProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$apiClientHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef ApiClientRef = ProviderRef<ApiClient>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
