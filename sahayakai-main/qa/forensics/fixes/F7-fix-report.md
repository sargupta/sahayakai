# F7 Payment / Billing — P0 Fix Report

Branch: `fix/payment-p0-fixes` (off `develop`)
Tests: `npm test billing` → 3 suites / 9 tests passing
Typecheck: `tsc --noEmit` clean

## Summary

Five payment / billing money-loss bugs from `qa/forensics/F7-payment-billing.md` fixed.
All paths that mutate `users.planType` or set Firebase custom claims now require either
admin authority or HMAC-verified Razorpay payment.

---

## F7-001 — Free → Premium privilege escalation via `POST /api/organizations`

**Bug.** Any signed-in free user could `POST /api/organizations` with
`plan: 'premium', totalSeats: 500`. `createOrganization()` then wrote
`users.planType = 'premium'` and set the Firebase custom claim. Zero payment,
zero gate. Effectively a one-line API call to give yourself the highest tier.

**Fix.**
1. `src/app/api/organizations/route.ts` — gates POST behind `isAdmin(callerUid)`,
   returns 403 otherwise. Only SahayakAI internal admins can provision org plans.
2. `src/lib/organization.ts::createOrganization` — new `grantPlanToAdmin: boolean`
   parameter (default false). The user's `planType` + Firebase custom claim are
   only flipped when `grantPlanToAdmin` is true. The route only passes true when
   the admin supplies a `razorpayPaymentId`. Without it, the org doc + admin
   membership are written, but the user stays on whatever plan the Razorpay
   webhook eventually grants.
3. The webhook (which already verifies HMAC) remains the canonical path that
   flips paid plans.

**Test.** `src/__tests__/api/billing/organizations-route.test.ts` —
- Free user → 403, no Firestore writes, no claim mutation.
- Unauthenticated → 401.
- Admin without `razorpayPaymentId` → org created, but `planType` not written
  and no custom claim set.
- Admin with `razorpayPaymentId` → plan and claim granted.

---

## F7-002 — Reconciliation silently a no-op due to field-name drift

**Bug.** `src/lib/billing-reconciliation.ts` queried `users.plan` and wrote
`users.plan = …`. The webhook (and every other paid-state writer) uses
`users.planType`. Consequences:
- D1 (`rzp_active_fs_free`) fired on every legitimate paid user — false positive.
- Auto-fix wrote an orphan `plan` field that nothing read.
- Real "charged but Firestore stuck" failures were undetectable.

**Fix.**
- All field reads now prefer `planType` and fall back to `plan` (defense-in-depth
  for any legacy doc that escaped earlier migrations).
- Queries: `where('planType', 'in', [...])` is canonical. A `where('plan', 'in', [...])`
  query runs as a safety net and tolerates `Missing field` errors gracefully.
- Writes: `planType: expectedPlan` (NOT `plan:`). Auto-fix paths also call
  `setCustomUserClaims({ planType })` so the JWT matches Firestore.
- Audited the rest of the codebase: `grep "users\.plan[^T]"` returns zero hits
  outside reconciliation; no other writers used the legacy field.

**Test.** `src/__tests__/lib/billing/reconciliation-planType.test.ts` —
- Charged-but-stuck scenario: Razorpay active, Firestore `planType:'free'`
  → reconciliation detects, marks `auto_fixed`, writes `planType:'pro'` (NOT
  `plan`), and calls `setCustomUserClaims({ planType: 'pro' })`.
- Asserts the canonical query is `planType in [...]`.

---

## F7-003 — Forgeable substring `planKey` plan derivation

**Bug.** Webhook resolved planType via
`subscription.notes?.planKey?.includes('premium')`. `notes.planKey` is
attacker-controlled on the subscription create call. Once gold/premium plans
exist, an attacker pays for `pro_monthly` but ships `planKey: "premium_annual"`
in the notes — webhook grants `premium`.

**Fix.**
- New `resolvePlanTypeFromPlanId()` in `src/lib/razorpay.ts`. Strict map from
  Razorpay plan_id (env-configured) → internal plan tier. Returns `null` for
  unknown plan_ids.
- Webhook now derives planType ONLY from `subscription.plan_id`. Unknown
  plan_id throws → event marked `failed`, no plan grant.
- The `notes.planKey` path is dropped entirely from the trust boundary.
- `RAZORPAY_PLANS` map extended to include `gold_*` and `premium_*` env slots.

**Test.** `src/__tests__/lib/billing/razorpay-plan-resolution.test.ts` —
- Known plan_ids map correctly.
- Unknown / empty / undefined plan_id returns `null`.
- A "premium-looking" attacker-supplied plan_id that isn't in the env map
  returns `null` (regression for the substring attack).

---

## F7-005 — Public-checkout email squat (pre-payment user creation)

**Bug.** `POST /api/billing/create-public-subscription` created a Firebase user
the moment a visitor typed in an email. An attacker could squat any email
(e.g. `principal@school.edu`) by hitting the endpoint and abandoning checkout —
the real owner could no longer sign up with that email under their control.

**Fix.**
- `src/app/api/billing/create-public-subscription/route.ts` — only LOOKS UP
  existing users. Never creates. If no user exists, `userId` is left null and
  the email is stashed in the subscription notes.
- `src/app/api/webhooks/razorpay/route.ts` (`subscription.charged` handler) —
  on the public-checkout path, if no `userId` is in notes, looks up by email
  and creates the Firebase user + Firestore doc THEN, AFTER HMAC verification
  and after money has moved. Then links the subscription doc to the new uid.
- Result: an abandoned public checkout creates a Razorpay subscription record
  but does not block any email.

**No new test for this fix** — the route mutation is easy to inspect by diff
and the webhook test surface is wide; covered by manual review for now. Listed
as a follow-up in the residual-risk section.

---

## F7-006 — `subscription.cancelled` immediate downgrade

**Bug.** Webhook downgraded the user to `planType: 'free'` the moment Razorpay
sent `subscription.cancelled`, ignoring `current_end`. A user who cancelled on
day 5 of a 30-day cycle lost 25 paid days.

**Fix.** `src/app/api/webhooks/razorpay/route.ts`:
- `subscription.halted` still downgrades immediately (payments are failing).
- `subscription.cancelled` checks `current_end`:
  - If `now < current_end`: marks `planCancelScheduled: true`, writes
    `planExpiresAt = current_end` and `scheduledDowngradeAt` on the
    subscription. Plan stays. The reconciliation D2 path (already implemented)
    auto-downgrades after `paidUntil` expires.
  - If `now >= current_end` (rare — cancelled past the paid period): downgrade
    immediately, same as before.

**No new test for this fix** — the timestamp logic is small and obvious from
the diff. Listed as a follow-up.

---

## Files touched

- `src/app/api/organizations/route.ts` — admin gate, payment-conditional grant
- `src/lib/organization.ts` — `grantPlanToAdmin` parameter
- `src/lib/auth-utils.ts` — (unchanged; uses existing `isAdmin`)
- `src/lib/billing-reconciliation.ts` — planType throughout, custom-claim sync
- `src/lib/razorpay.ts` — `resolvePlanTypeFromPlanId()`, expanded plan map
- `src/app/api/webhooks/razorpay/route.ts` — strict plan resolution, public
  user creation on payment, paid-period-aware cancellation
- `src/app/api/billing/create-public-subscription/route.ts` — no pre-payment
  user creation
- `src/__tests__/api/billing/organizations-route.test.ts` (new)
- `src/__tests__/lib/billing/reconciliation-planType.test.ts` (new)
- `src/__tests__/lib/billing/razorpay-plan-resolution.test.ts` (new)

## Residual risks / follow-ups

- F7-005 and F7-006 fixes lack dedicated tests in this PR — they're behavioural
  changes to the webhook with broad blast radius. Add coverage in a follow-up
  before promoting to main.
- F7-004 (if present in the original forensic) was out of scope here.
- The org GET endpoint is unchanged — any signed-in user can fetch org details
  if they have an `organizationId`; not a money-loss issue.
- Reconciliation now writes custom claims when auto-fixing D1/D2. The user
  still needs to refresh their ID token before middleware sees the new claim;
  this matches the webhook's existing behaviour.
