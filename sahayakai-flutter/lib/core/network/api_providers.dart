import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../firebase/firebase_init.dart';
import 'api_client.dart';
import 'auth_interceptor.dart';

part 'api_providers.g.dart';

/// The bearer-token source the dio auth interceptor reads: the real Firebase
/// ID token, or null when signed out. [forceRefresh] backs the interceptor's
/// one-retry-on-401 (a locally-cached token can be stale even though the
/// teacher is genuinely signed in).
///
/// Guarded on [FirebaseInit.isConfigured] for the same reason
/// `AuthController` is (core/auth/auth_providers.dart): `FirebaseAuth.instance`
/// throws with no default app registered, and a widget test never runs
/// `main()`'s `Firebase.initializeApp()`.
@Riverpod(keepAlive: true)
TokenProvider tokenProvider(Ref ref) {
  return ({bool forceRefresh = false}) async {
    if (!FirebaseInit.isConfigured) return null;
    final user = FirebaseAuth.instance.currentUser;
    return user?.getIdToken(forceRefresh);
  };
}

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
@Riverpod(keepAlive: true)
AppCheckTokenProvider appCheckTokenProvider(Ref ref) {
  return () async {
    if (!FirebaseInit.isConfigured) return null;
    return FirebaseAppCheck.instance.getToken();
  };
}

/// The single configured [ApiClient] used by every repository.
@Riverpod(keepAlive: true)
ApiClient apiClient(Ref ref) {
  return ApiClient(
    tokenProvider: ref.watch(tokenProviderProvider),
    appCheckTokenProvider: ref.watch(appCheckTokenProviderProvider),
  );
}
