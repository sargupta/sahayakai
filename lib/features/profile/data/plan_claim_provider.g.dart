// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'plan_claim_provider.dart';

// **************************************************************************
// RiverpodGenerator
// **************************************************************************

String _$planBadgeHash() => r'ea630160da87114485e4bf3a7fcdcb2f47683c7f';

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
///
/// Copied from [planBadge].
@ProviderFor(planBadge)
final planBadgeProvider = AutoDisposeFutureProvider<PlanBadge>.internal(
  planBadge,
  name: r'planBadgeProvider',
  debugGetCreateSourceHash: const bool.fromEnvironment('dart.vm.product')
      ? null
      : _$planBadgeHash,
  dependencies: null,
  allTransitiveDependencies: null,
);

@Deprecated('Will be removed in 3.0. Use Ref instead')
// ignore: unused_element
typedef PlanBadgeRef = AutoDisposeFutureProviderRef<PlanBadge>;
// ignore_for_file: type=lint
// ignore_for_file: subtype_of_sealed_class, invalid_use_of_internal_member, invalid_use_of_visible_for_testing_member, deprecated_member_use_from_same_package
