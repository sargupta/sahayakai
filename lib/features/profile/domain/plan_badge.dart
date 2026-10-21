/// The teacher's plan, as the app is allowed to know it.
///
/// SOURCE OF TRUTH: the `planType` **custom claim on the Firebase ID token** —
/// not the profile document. Verified end to end in the backend:
///   - `setUserPlan()` (src/lib/services/plan-service.ts) writes the claim with
///     the Admin SDK and mirrors it to Firestore,
///   - `src/middleware.ts` reads `decoded.planType` off the verified token and
///     injects it as the `x-user-plan` header every metered route trusts,
///   - `firestore.rules` lists `planType`/`plan`/`planTier` in
///     `protectedUserFields()`, so a client-SDK read of the doc is allowed but
///     a write is not — and the doc can lag the claim.
/// Reading the claim (rather than the doc) is therefore the only way to show
/// the same plan the server will actually enforce.
enum PlanBadge {
  free('free'),
  pro('pro'),
  gold('gold'),
  premium('premium'),

  /// "We cannot know your plan right now" — no token, so no claim.
  ///
  /// Deliberately NOT the same as [free]. Middleware defaults a *verified
  /// token with no claim* to `free`, and so does [fromClaim]. But a teacher
  /// with no token at all is not on the free plan; they are unidentified.
  /// Rendering "Free" there would be a fabricated fact about a paying user's
  /// account, so the badge says so instead.
  unknown('');

  const PlanBadge(this.claim);

  /// The exact claim value the backend mints.
  final String claim;

  /// Mirrors middleware's normalization EXACTLY (src/middleware.ts):
  /// legacy `institution` maps to `premium`, any other unrecognized or missing
  /// value on a *present* token resolves to `free` — because that is the plan
  /// the server will enforce for it, and the badge must not promise more than
  /// the metering will honour.
  static PlanBadge fromClaim(Object? raw) {
    if (raw is! String) return PlanBadge.free;
    if (raw == 'institution') return PlanBadge.premium;
    for (final plan in PlanBadge.values) {
      if (plan != PlanBadge.unknown && plan.claim == raw) return plan;
    }
    return PlanBadge.free;
  }

  /// True for the paid tiers, so the badge can carry the accent.
  bool get isPaid =>
      this == PlanBadge.pro || this == PlanBadge.gold || this == PlanBadge.premium;
}
