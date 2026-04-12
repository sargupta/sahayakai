import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

class AuthRepository {
  Stream<dynamic> authStateChanges() => const Stream.empty();
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository();
});
