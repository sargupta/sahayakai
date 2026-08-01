/**
 * Billing kill-switch — auto-trips the global AI kill-switch on a budget breach.
 *
 * Trigger: Pub/Sub topic `billing-killswitch` (wired to the GCP budget
 *   "SahayakAI spend guard"). Google publishes one message per threshold cross.
 *
 * Effect: when actual spend reaches the configured fraction of the budget,
 *   set Firestore `system_config/ai_killswitch` = { enabled: false, ... }.
 *
 * Design rules:
 *   - TRIP-ONLY. This function never re-enables AI. A human flips it back on
 *     after confirming the spend cause is understood. Auto-recovery on a cost
 *     incident is exactly how you get a second runaway bill.
 *   - IDEMPOTENT. Re-tripping an already-tripped switch is a no-op write guard.
 *   - FAIL-SAFE TO ON. The APP must treat a missing/unreadable flag as
 *     enabled:true (see handoff note below) so a Firestore blip can't take AI
 *     down. This function only ever writes enabled:false.
 *
 * Handoff (app-side, NOT in this infra scope):
 *   Every /api/ai/* route + /api/assistant must read system_config/ai_killswitch
 *   at the top and, when enabled === false, return the graceful 503 fallback
 *   (reuse src/lib/ai-error-response.ts) instead of calling Gemini. Until that
 *   read exists, this function arms the trip but the app won't honour it.
 */

const functions = require('@google-cloud/functions-framework');
const { Firestore } = require('@google-cloud/firestore');

const db = new Firestore();

// Trip when actual spend >= this fraction of the budgeted amount.
const TRIP_FRACTION = Number(process.env.TRIP_FRACTION || '1.0');

functions.cloudEvent('billingKillSwitch', async (cloudEvent) => {
  const raw = cloudEvent?.data?.message?.data;
  if (!raw) {
    console.warn('billing-killswitch: no message data');
    return;
  }

  let budget;
  try {
    budget = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  } catch (e) {
    console.error('billing-killswitch: bad payload', e);
    return;
  }

  const cost = Number(budget.costAmount || 0);
  const amount = Number(budget.budgetAmount || 0);
  const fraction = amount > 0 ? cost / amount : 0;

  console.log(
    `billing-killswitch: ${budget.budgetDisplayName} cost=${cost} ` +
      `budget=${amount} fraction=${fraction.toFixed(3)} trip@${TRIP_FRACTION}`
  );

  if (fraction < TRIP_FRACTION) return; // below trip line, do nothing

  const ref = db.doc('system_config/ai_killswitch');
  const snap = await ref.get();
  if (snap.exists && snap.get('enabled') === false) {
    console.log('billing-killswitch: already tripped, no-op');
    return;
  }

  await ref.set(
    {
      enabled: false,
      trippedBy: 'billing-killswitch',
      trippedAt: Firestore.FieldValue.serverTimestamp(),
      reason: `Budget "${budget.budgetDisplayName}" reached ${(fraction * 100).toFixed(0)}% ` +
        `(${cost} ${budget.currencyCode || ''} of ${amount}).`,
      costAmount: cost,
      budgetAmount: amount,
    },
    { merge: true }
  );

  console.error(
    `billing-killswitch: TRIPPED ai_killswitch — spend ${cost} >= ${TRIP_FRACTION * 100}% of ${amount}`
  );
});
