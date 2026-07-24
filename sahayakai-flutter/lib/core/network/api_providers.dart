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

/// The single configured [ApiClient] used by every repository.
@Riverpod(keepAlive: true)
ApiClient apiClient(Ref ref) {
  return ApiClient(tokenProvider: ref.watch(tokenProviderProvider));
}
