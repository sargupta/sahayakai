# F7 — Payment & Billing Forensic Audit
**Role 14**: Razorpay webhook, subscription lifecycle, plan transition, reconciliation
**Date**: 2026-06-06
**Branch**: feature/q4c-shadow-diff-in-canary
**Scope**: `src/app/api/webhooks/razorpay/`, `src/app/api/billing/*`, `src/app/api/jobs/billing-reconciliation/`, `src/lib/razorpay.ts`, `src/lib/billing-reconciliation.ts`, `src/lib/organization.ts`, `src/app/api/organizations/`

---

## Executive Summary

Webhook HMAC + idempotency + plan-grant-on-charge core is **correctly designed** (post `9309c25fe`). The serious money-on-the-line failure is **not in the webhook** — it is in a **non-payment plan-grant side-channel** (`POST /api/organizations`). One additional **P1 idempotency edge** affects per-cycle dedup when Razorpay re-fires `subscription.charged` for the same `payment.id`. Reconciliation is conservative (never auto-refunds) but has a **field-name schema drift** between the webhook writer (`users.planType`) and the reconciler (queries `users.plan`) that **completely defeats the safety net**.

| Sev | Finding | File / Line |
|-----|---------|-------------|
| P0 | Free user can grant themselves `gold`/`premium` plan with zero payment via org-create endpoint | `src/app/api/organizations/route.ts:32`, `src/lib/organization.ts:83-96` |
| P0 | Reconciliation cannot detect "paid in Razorpay but free in Firestore" — queries wrong field name | `src/lib/billing-reconciliation.ts:196-209` vs `src/app/api/webhooks/razorpay/route.ts:101-104` |
| P1 | Webhook idempotency uses `event + paymentId` but `subscription.charged` carries the same payment.id only for the active cycle — replay of an OLD webhook for a recurring sub with the same payment.id is correctly blocked, but stale event with `Date.now()` fallback (no payment / subscription id) is **never deduped** | `src/app/api/webhooks/razorpay/route.ts:37-39` |
| P1 | `planType` inference from `notes.planKey` uses loose substring match — `notes.planKey="pro_monthly_gold"` upgrades user to `gold` while Razorpay only collected pro pricing | `src/app/api/webhooks/razorpay/route.ts:85-86` |
| P1 | `create-subscription` accepts arbitrary `planKey` from client but only validates against `RAZORPAY_PLANS` keys — fine today, but the route also passes `planKey` straight into `subscription.notes` without sanitisation, feeding the loose-match inference above | `src/app/api/billing/create-subscription/route.ts:30-34` |
| P1 | Public-checkout endpoint creates Firebase users with **no email verification** before payment — attacker can squat email addresses they don't own and the magic-link is sent only after charge | `src/app/api/billing/create-public-subscription/route.ts:58-72` |
| P1 | Reconciliation auto-downgrade of users with terminal Razorpay state queries `users.plan` (does not exist) — net effect: no auto-downgrade ever runs in prod | `src/lib/billing-reconciliation.ts:328-368` |
| P2 | `subscription.cancelled` webhook downgrades to free immediately, ignoring `current_end` — paying user loses the rest of paid cycle (contradicts cancel-at-end-of-cycle UX in `/api/billing/cancel`) | `src/app/api/webhooks/razorpay/route.ts:166-191` |
| P2 | Callback signature compares `paymentId|subscriptionId` to header — Razorpay's documented format for redirect-callback is `payment_id|subscription_id` but the **secret used is `RAZORPAY_KEY_SECRET`** rather than `RAZORPAY_WEBHOOK_SECRET`; this is correct per Razorpay docs but inconsistent with webhook path — flag for confirmation against current Razorpay spec | `src/app/api/billing/callback/route.ts:24-27` |
| P2 | Webhook on `CLAIM_SET_FAILED` throws AFTER Firestore plan upgrade has already committed → the user has plan in Firestore, JWT is stale, event marked `failed`. Razorpay will retry. On retry, idempotency dedup sees `status==='failed'` and re-runs the **entire** branch, including a second `tx.update` and a second magic-link generation. Re-trying claim is safe; re-issuing magic link to public buyer is also safe but generates a fresh link and overwrites Firestore record (forgotten links). | `src/app/api/webhooks/razorpay/route.ts:55-63, 112-118, 129-149` |

---

## Detailed findings

### F7-001 (P0) — Free → premium via `POST /api/organizations`

`src/app/api/organizations/route.ts`:

```ts
export async function POST(request: Request) {
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // ...
    const ALLOWED_PLANS = ['gold', 'premium'];
    // ...
    const orgId = await createOrganization({
        name, type, adminUserId: userId, plan, totalSeats,
    });
```

`src/lib/organization.ts:83-96` then writes:

```ts
await db.collection('users').doc(params.adminUserId).update({
    organizationId: orgRef.id,
    planType: params.plan,    // 'gold' | 'premium'
    planSource: 'organization',
    updatedAt: new Date(),
});
const { getAuth } = await import('firebase-admin/auth');
await getAuth().setCustomUserClaims(params.adminUserId, {
    planType: params.plan,
    orgId: orgRef.id,
    orgRole: 'admin',
});
```

**No payment check. No subscription reference. No admin gate.** Any user who is signed in can `curl -X POST /api/organizations -d '{"name":"x","type":"school","plan":"premium","totalSeats":500}'` and walk away with a premium custom claim. After client calls `getIdToken(true)`, middleware injects `x-user-plan: premium` and unlocks every premium feature site-wide.

**Repro** (`qa/forensics/repros/F7-001-org-create-free-pro.sh`):
```bash
TOKEN=$(get_firebase_id_token free_user@example.com)
curl -sS -X POST https://APP/api/organizations \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"name":"Phantom School","type":"school","plan":"premium","totalSeats":500}'
# → 200 { "orgId": "..." }
# Now refresh ID token client-side; new JWT carries planType: premium
```

**Fix**: `createOrganization` must (1) require an existing `subscriptions/{id}` doc with `status==='active'` and a `planType` that matches `params.plan`, OR (2) require `adminRoles.superadmin` on the caller. The org endpoint is a B2B sales workflow — it should never be a self-service plan-grant.

---

### F7-002 (P0) — Reconciliation queries the wrong field, silently disabled

Webhook (`webhooks/razorpay/route.ts:101-104`) writes `users.planType`. Reconciler (`lib/billing-reconciliation.ts:196-209`) reads `users.plan`:

```ts
db.collection('users')
    .where('razorpaySubscriptionId', '!=', null)
    .select('plan', ...)
    .get(),
db.collection('users')
    .where('plan', 'in', ['gold', 'premium'])
    .select('plan', ...)
    .get(),
```

The user document does not have a `plan` field — it has `planType`. Therefore:

* `fetchFirestorePaidUsers()` returns the union of (users with `razorpaySubscriptionId` set) — `plan` field is `undefined`, defaulting to `'free'` at line 217 — and zero rows from the `where plan in ['gold','premium']` query (because that field doesn't exist).
* In `runReconciliation()`, the `rzp_active_fs_free` branch fires on **every** paid Razorpay user because `fsUser.plan` is `'free'` even when `planType === 'pro'`.
* The auto-fix writes `plan: expectedPlan` to Firestore (line 296-301) which adds a **new** field — `planType` stays untouched. After auto-fix, the user document now has `plan: 'gold'` AND `planType: 'pro'`. Middleware reads custom claim (`planType`), so UI is unaffected, but the reconciliation table is full of false `auto_fixed` events and Razorpay-side cancellations never propagate (the D2 branch only fires when `fsUser.plan !== 'free'`, which it never is).

Combined impact: **reconciliation is silently a no-op for the only condition that matters in production** — Razorpay charged the customer, webhook lost, Firestore plan unchanged. This is precisely the failure mode the system was built to catch. Today: undetectable.

**Fix**: replace every `plan`/`plan in […]` with `planType`/`planType in […]` and align the `FirestoreUserPlan` field name. Add a unit test that seeds a user with `planType: 'pro'` and asserts `runReconciliation()` does NOT flag them as `rzp_active_fs_free`.

---

### F7-003 (P1) — `notes.planKey` substring-match upgrades plan beyond what was paid

```ts
const planType = subscription.notes?.planKey?.includes('premium') ? 'premium'
    : subscription.notes?.planKey?.includes('gold') ? 'gold' : 'pro';
```

`notes` are echoed back by Razorpay verbatim from what was sent at subscription creation. Today only `RAZORPAY_PLANS` keys (`pro_monthly`, `pro_annual`) are accepted. The moment a `gold_monthly` / `premium_monthly` entry is added to `RAZORPAY_PLANS`, an attacker can send `planKey: "pro_monthly_premium"` to `POST /api/billing/create-subscription`, pay the pro_monthly price (whichever plan_id maps to "pro_monthly"), and have the webhook grant them `premium`. The plan-key-to-amount linkage lives in `billing-reconciliation.ts`, not in the webhook — the webhook trusts the **echoed string**, not Razorpay's resolved plan_id.

**Fix**: in the webhook, derive `planType` from `subscription.plan_id` via the same `PLAN_NAME_MAP` used in reconciliation, not from notes. Notes are user-controlled.

---

### F7-004 (P1) — Webhook idempotency falls back to `Date.now()` when both ids missing

```ts
const eventId = event.event + '_' + (paymentId || subscriptionId || Date.now());
```

If a malformed/synthetic event slips past the signature check (it won't in prod because HMAC is verified, but defence-in-depth) with neither `payment.entity.id` nor `subscription.entity.id`, every retry creates a fresh doc and re-executes the switch body. Even with valid signatures, certain Razorpay events (`subscription.pending` with no associated payment row) can have only one of the two — the current expression handles that — but events like `subscription.completed` with no payment in the payload could miss. Recommend `event.id` (the Razorpay envelope id, available at `event.id` for webhook envelopes — verify against current API) as the dedup key, not derived from payload.

---

### F7-005 (P1) — Public checkout creates Firebase users for un-verified emails before payment

```ts
const created = await auth.createUser({
    email, emailVerified: false, disabled: false,
});
```

`/api/billing/create-public-subscription` has NO auth (intentional, per comment). Anyone can POST `{email: "victim@gmail.com", planKey: "pro_monthly"}` and a Firebase user is created with the victim's email. If the victim later signs up with that email, they hit an `auth/email-already-in-use` error or get linked to the squat account. Magic-link is only generated post-charge, so the attacker never has to pay — they just enumerate emails to deny new signups.

**Fix**: lazily create the Firebase user inside the webhook (`subscription.charged`), not at checkout-init. The notes can carry only `email` until then; webhook looks up or creates the user.

---

### F7-006 (P1) — Reconciliation D2 downgrade never fires (same root cause as F7-002)

Even if we fix F7-002 and read `planType`, the auto-fix at line 335-340 writes `plan: 'free'` instead of `planType: 'free'`. Net: terminal Razorpay subscriptions are never reflected back to Firestore by reconciliation.

---

### F7-007 (P2) — `subscription.cancelled` downgrades immediately, contradicting cancel-at-cycle-end UX

`/api/billing/cancel/route.ts:38` calls `razorpay.subscriptions.cancel(id, false)` — second arg `false` means cancel at end of current billing cycle. Razorpay will then fire `subscription.cancelled` **at the cycle end**, but the webhook handler treats `cancelled` and `halted` identically and immediately writes `planType: 'free'`. If Razorpay fires the cancellation event before cycle end (e.g. user-initiated immediate cancel, or admin cancel from dashboard with `true`), the paid user loses access mid-cycle. Verify Razorpay event timing — but the safe behaviour is to compute `current_end` and only downgrade once `now > current_end`. The reconciler already has this guard (lines 328-368) but the webhook does not.

---

### F7-008 (P2) — `CLAIM_SET_FAILED` throw leaves Firestore upgraded, retry re-runs upgrade & re-mints magic-link

The `try { … } catch (claimErr) { throw … }` is post-transaction. The Firestore plan upgrade has already committed. The throw marks the event `failed`. Razorpay retries (or human triggers retry). On retry, the dedup branch at line 58 allows re-processing for `status === 'failed'` — re-running the entire switch case, which:

1. Re-runs the `runTransaction` updating subscriptions+users — idempotent, but writes a new `updatedAt`.
2. Re-tries `setCustomUserClaims` — fine.
3. For public buyers, **re-generates a NEW magic sign-in link** and overwrites `pendingSignInLinks/{userId}`. If the buyer already clicked the previous link (now invalidated by Firebase's single-use semantics? — verify), they may already be signed in; if not, the old link is lost.

Either accept the magic-link re-mint as the cost of retry safety, OR carry a separate `claimSet: true` flag and skip steps 1+3 when retry sees Firestore already up-to-date.

---

## What the webhook DOES get right (verified)

* HMAC-SHA256 with `timingSafeEqual` (`src/lib/razorpay.ts:46-54`).
* 401 on bad sig (not 5xx) — prevents Razorpay retry storm. Confirmed `9309c25fe` is in tree.
* Idempotency via Firestore `create()` — TOCTOU-safe.
* Plan + subscription update in a single `runTransaction` — atomic.
* Provisions on `subscription.charged` only (not `activated`) — handles UPI mandate registration correctly.
* CRON_SECRET gate on reconciliation, 401 (not 500) on bad bearer — confirmed.
* Reconciliation never auto-refunds; double-charge always flagged for manual review.

---

## Lifecycle simulation (test-mode walkthrough)

Documented in `qa/forensics/repros/F7-lifecycle.md` (companion file, see repros/).

Outcome under current code:

| Step | Expected | Observed (code review) |
|------|----------|------------------------|
| create subscription | 200 + shortUrl | OK |
| user pays in Razorpay test | webhook subscription.charged → planType=pro, claim set | OK |
| Razorpay retries same webhook | 200 already_processed | OK |
| user cancels (at-end) | webhook subscription.cancelled at cycle end → planType=free | **BUG F7-007**: downgrade immediately on event, ignoring current_end |
| reconciliation runs | detects paid-but-free, auto-fixes | **BUG F7-002**: cannot detect — wrong field |
| user upgrades pro → gold mid-cycle | (not implemented) | N/A; reconciliation D7 amount_mismatch flags it |

---

## Tests added / recommended

- `qa/forensics/repros/F7-001-org-create-free-pro.sh` — repro for P0 plan-grant.
- `qa/forensics/repros/F7-002-recon-field-mismatch.test.ts` — unit test that seeds `users/{uid}` with `planType: 'pro'` and asserts `fetchFirestorePaidUsers` returns `plan === 'pro'` (will fail today, proves the bug).
- `qa/forensics/repros/F7-003-notes-substring.test.ts` — fuzzes notes.planKey and asserts derived `planType` matches the plan paid for.
