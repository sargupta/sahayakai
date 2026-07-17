import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../core/network/api_providers.dart';
import '../domain/plan_badge.dart';

part 'plan_claim_provider.g.dart';

/// The teacher's plan, read from the `planType` custom claim on the Firebase ID
/// token — the same claim `src/middleware.ts` verifies and turns into the
/// `x-user-plan` header that every metered route enforces. Reading the token
/// rather than the profile document means the badge cannot disagree with the
/// metering: `setUserPlan()` writes the claim first and mirrors to Firestore,
/// and `firestore.rules` makes `planType` unwritable by the client anyway.
///
/// BUILT-PENDING-FIREBASE, but only at the edges: the decode below is the real,
/// final implementation. `tokenProvider` is still the P0.2 stub and returns
/// null, so this resolves to [PlanBadge.unknown] today. When the stub is
/// replaced by `user.getIdToken()`, this provider starts returning the true
/// plan with no change here.
///
/// No signature verification, deliberately: this value only decides which
/// label to draw. The server verifies the token on every call it meters, so a
/// tampered local token buys a wrong badge and nothing else. Verifying it here
/// would need the Google public keys and would still not be a security control.
@riverpod
Future<PlanBadge> planBadge(Ref ref) async {
  final token = await ref.watch(tokenProviderProvider)();
  if (token == null || token.isEmpty) {
    // No token means no identity, which is NOT the free plan — see
    // [PlanBadge.unknown].
    return PlanBadge.unknown;
  }
  final claims = decodeJwtClaims(token);
  if (claims == null) return PlanBadge.unknown;
  // A verified token with no planType claim IS free (new and pre-migration
  // users), exactly as middleware resolves it.
  return PlanBadge.fromClaim(claims['planType']);
}

/// Decodes a JWT's payload segment. Returns null for anything that is not a
/// well-formed JWT carrying a JSON object — a malformed token is a reason to
/// say "unknown", never to throw inside a profile render.
@visibleForTesting
Map<String, dynamic>? decodeJwtClaims(String token) {
  final segments = token.split('.');
  if (segments.length != 3) return null;
  try {
    // base64Url.normalize restores the '=' padding Firebase strips.
    final payload = utf8.decode(base64Url.decode(base64Url.normalize(segments[1])));
    final decoded = jsonDecode(payload);
    return decoded is Map<String, dynamic> ? decoded : null;
  } on FormatException {
    return null;
  }
}
