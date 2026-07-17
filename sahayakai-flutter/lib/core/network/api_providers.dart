import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import 'api_client.dart';
import 'auth_interceptor.dart';

part 'api_providers.g.dart';

/// The bearer-token source the dio auth interceptor reads.
///
/// foundation-v1 STUB: returns null (signed-out; no token attached).
/// TODO(P0.2): return the Firebase ID token, e.g.
///   final user = ref.read(firebaseAuthProvider).currentUser;
///   return user?.getIdToken(forceRefresh);
@Riverpod(keepAlive: true)
TokenProvider tokenProvider(Ref ref) {
  return ({bool forceRefresh = false}) async => null;
}

/// The single configured [ApiClient] used by every repository.
@Riverpod(keepAlive: true)
ApiClient apiClient(Ref ref) {
  return ApiClient(tokenProvider: ref.watch(tokenProviderProvider));
}
