/**
 * Settling a finished call (plan §4⑦⑧): the ONE place a call's terminal state
 * is turned into consequences — the intent moves on (done | retry_wait |
 * expired), a keypad opt-out becomes a suppression, a number the carrier
 * reports dead becomes one too, and the campaign's counts and completion are
 * brought up to date.
 *
 * Two callers reach it:
 *   - the dispatcher, straight after the simulated carrier returned the whole
 *     lifecycle inside the tick;
 *   - the Vobiz hangup webhook, minutes later, for a real call.
 *
 * Webhooks are retried (Vobiz retries a non-200 callback up to three times)
 * and can race the dispatcher's sweep, so settling is idempotent: it acts only
 * on a terminal call that has not been settled, whose intent is still waiting
 * on exactly this call. `settledAt` on the call records that it happened. A
 * retried or duplicated hangup therefore never schedules a second retry or
 * writes a second suppression.
 *
 * Hardening (7 Oct 2026, EDGE_CASES.md §3):
 *   - H1: nothing a rehearsal does touches a real record. A simulated (Practice)
 *     or test-phone (Test) call never writes a suppression; it only audits.
 *   - H7: the carrier's hangup cause decides retry and number health through
 *     HANGUP_CAUSE_TABLE: a non-retryable cause ends the intent, and a dead,
 *     invalid or changed number is suppressed for every purpose (scope 'all',
 *     office to verify) so no campaign dials it again.
 *   - H7: a carrier refusal for capacity (a 429) is settled through the requeue
 *     path: the intent goes back to 'retry_wait' a minute or so later WITHOUT
 *     spending the family's attempt, and the next dial gets a new call id
 *     (callIdFor's requeue). After MAX_CARRIER_REQUEUES such refusals within one
 *     attempt, the next is an ordinary retryable failure and spends the attempt.
 *     The requeue moves the intent with the same compare-and-set as any other
 *     settlement, so a duplicated settlement can never requeue twice.
 */

import { purposeSpec, type PurposeSpec } from '@/lib/sampark/catalogue';
import { isTerminalIntent, recomputeCampaignCounts } from '@/lib/sampark/dispatch/counts';
import { isTerminal } from '@/lib/sampark/dispatch/state';
import { hashId, MAX_CARRIER_REQUEUES } from '@/lib/sampark/intents';
import type { Clock, SamparkRepo } from '@/lib/sampark/ports';
import { hangupCauseRule } from '@/lib/sampark/voice/vobiz-events';
import type { Campaign, Intent, SamparkCall, Suppression } from '@/types/sampark';

export { MAX_CARRIER_REQUEUES } from '@/lib/sampark/intents';

/** Campaign statuses whose intents may still be dialled (and so can still complete). */
const DISPATCHABLE_CAMPAIGN: ReadonlySet<Campaign['status']> = new Set(['scheduled', 'dispatching']);

export interface SettleDeps {
    repo: SamparkRepo;
    clock: Clock;
}

export interface SettleOptions {
    /** False when the carrier refused the call for a reason a retry cannot fix. Default true. */
    retryable?: boolean;
    /**
     * Recompute the campaign's counts and completion now. Default true. The dispatcher
     * passes false and recomputes once per campaign at the end of its tick.
     */
    recompute?: boolean;
    /**
     * The carrier refused for capacity and nothing rang (PlaceCallResult.requeue): requeue the
     * intent without spending its attempt, unless this attempt has already been requeued
     * MAX_CARRIER_REQUEUES times. Default false.
     */
    requeue?: boolean;
}

/** Earliest and latest delay before a requeued intent is due again. */
export const REQUEUE_MIN_MS = 60_000;
export const REQUEUE_MAX_MS = 90_000;

/**
 * The intent patch for a call that has ended. Pure. The attempt is spent, so the carrier
 * requeue count starts again at 0. A hangup cause the table marks not retryable (a dead
 * number, an incompatible destination) ends the intent like a refusal that cannot be retried.
 */
export function settleIntentPatch(call: SamparkCall, intent: Intent, spec: PurposeSpec, now: Date, retryable: boolean): Partial<Intent> {
    const patch: Partial<Intent> = { attempts: call.attempt, lastCallId: call.id, carrierRequeues: 0, updatedAt: now.toISOString() };
    const reached = call.state === 'completed' && (call.outcome.heard === 'full' || call.outcome.digits.length > 0);
    const causeRetryable = hangupCauseRule(call.hangupCause)?.retryable ?? true;
    if (reached || !retryable || !causeRetryable || call.attempt >= intent.maxAttempts) {
        patch.status = 'done';
        return patch;
    }
    const retryAt = new Date(now.getTime() + spec.retryAfterMinutes * 60_000);
    if (retryAt.getTime() > Date.parse(intent.expiresAt)) {
        patch.status = 'expired';
        return patch;
    }
    patch.status = 'retry_wait';
    patch.notBefore = retryAt.toISOString();
    return patch;
}

/**
 * The intent patch for a call the carrier refused for capacity, when the refusal does not spend
 * the attempt (H7). Pure. `attempts` goes back to what it was before this call was claimed (the
 * claim set it to `call.attempt`), so the next claim dials the same attempt again, under the call
 * id of the next requeue. The delay is 60–90 s, jittered deterministically from the call id so a
 * burst of refusals does not come back as one burst.
 */
export function requeueIntentPatch(call: SamparkCall, now: Date): Partial<Intent> {
    const jitter = parseInt(hashId(`requeue:${call.id}`).slice(0, 8), 16) % (REQUEUE_MAX_MS - REQUEUE_MIN_MS + 1);
    return {
        status: 'retry_wait',
        attempts: call.attempt - 1,
        carrierRequeues: (call.requeue ?? 0) + 1,
        notBefore: new Date(now.getTime() + REQUEUE_MIN_MS + jitter).toISOString(),
        lastCallId: call.id,
        updatedAt: now.toISOString(),
    };
}

/**
 * Key 9 → a routine suppression (office verifies within two school days, plan §5.1).
 * Never weakens or re-dates an effective suppression; the one allowed change is
 * upgrading an unconfirmed keypad opt-out to a confirmed one.
 *
 * A rehearsal never suppresses anyone (H1): a 9 pressed on a simulated (Practice) call was
 * pressed by nobody, and one pressed on the school's test phone was not pressed by a parent.
 * Both are only audited.
 */
export async function recordOptOut(repo: SamparkRepo, call: SamparkCall, now: Date, actor = 'dispatcher'): Promise<void> {
    if (call.outcome.optOut === 'none') return;
    if (call.carrier === 'simulated') {
        // The simulated carrier presses 9 on a share of answered calls by design; none of it is real.
        await repo.appendAudit(call.orgId, {
            at: now.toISOString(),
            actor,
            action: 'practice_call.opt_out_pressed',
            target: `call/${call.id}`,
            detail: { optOut: call.outcome.optOut },
        });
        return;
    }
    if (call.destination === 'test_phone') {
        // A 9 pressed on the school's own test phone is a rehearsal: it must never suppress a parent
        // (the call is not recorded against the parent's number) nor list the test phone as an opt-out.
        await repo.appendAudit(call.orgId, {
            at: now.toISOString(),
            actor,
            action: 'test_call.opt_out_pressed',
            target: `call/${call.id}`,
            detail: { optOut: call.outcome.optOut },
        });
        return;
    }
    const source: Suppression['source'] = call.outcome.optOut === 'confirmed' ? 'keypad' : 'keypad_unconfirmed';
    const existing = await repo.getSuppression(call.orgId, call.phoneHash);
    if (existing && existing.officeVerification !== 'reversed') {
        // An effective suppression already exists (this can only happen on an emergency call, which a
        // routine suppression does not stop).
        const upgrade = existing.scope === 'routine' && existing.source === 'keypad_unconfirmed' && source === 'keypad';
        if (!upgrade) return;
    }
    const nowIso = now.toISOString();
    await repo.upsertSuppression({
        orgId: call.orgId,
        phoneHash: call.phoneHash,
        phoneLast4: call.phoneLast4,
        scope: 'routine',
        source,
        officeVerification: 'pending',
        createdAt: nowIso,
        callId: call.id,
    });
    await repo.appendAudit(call.orgId, {
        at: nowIso,
        actor,
        action: 'suppression.add',
        target: `suppression/${call.phoneHash}`,
        detail: { callId: call.id, source, scope: 'routine' },
    });
}

/**
 * The carrier reported the number dead, invalid or changed (HANGUP_CAUSE_TABLE, H7): suppress it
 * for every purpose (scope 'all'), pending the office's check, so no campaign dials it again until
 * the office corrects the number. Only for a guardian's number on a real carrier; a rehearsal
 * (simulated, or the school's test phone) only audits.
 *
 * Never weakens or replaces an effective suppression: the existing record (an opt-out, or the
 * office's own entry) carries the family's decision, and overwriting it with a flag the office
 * may later reverse could lose that decision. It is audited either way.
 */
export async function recordInvalidNumber(repo: SamparkRepo, call: SamparkCall, now: Date, actor = 'carrier'): Promise<void> {
    if (!hangupCauseRule(call.hangupCause)?.invalidNumber) return;
    const nowIso = now.toISOString();
    const destination = call.destination ?? 'guardian';
    if (call.carrier === 'simulated' || destination === 'test_phone') {
        await repo.appendAudit(call.orgId, {
            at: nowIso,
            actor,
            action: 'number.flagged_invalid',
            target: `call/${call.id}`,
            detail: { callId: call.id, hangupCause: call.hangupCause, destination, carrier: call.carrier, suppressed: false },
        });
        return;
    }
    const existing = await repo.getSuppression(call.orgId, call.phoneHash);
    const effective = !!existing && existing.officeVerification !== 'reversed';
    if (!effective) {
        await repo.upsertSuppression({
            orgId: call.orgId,
            phoneHash: call.phoneHash,
            phoneLast4: call.phoneLast4,
            scope: 'all',
            source: 'carrier_invalid_number',
            officeVerification: 'pending',
            createdAt: nowIso,
            callId: call.id,
        });
    }
    await repo.appendAudit(call.orgId, {
        at: nowIso,
        actor,
        action: 'number.flagged_invalid',
        target: `suppression/${call.phoneHash}`,
        detail: {
            callId: call.id,
            guardianId: call.guardianId,
            hangupCause: call.hangupCause,
            suppressed: !effective,
            ...(effective && existing ? { kept: { source: existing.source, scope: existing.scope } } : {}),
        },
    });
}

/** Recompute counts from records; mark a dispatchable campaign 'completed' once every intent is terminal. */
export async function finishCampaign(repo: SamparkRepo, orgId: string, campaignId: string, now: Date): Promise<void> {
    await recomputeCampaignCounts(repo, orgId, campaignId);
    const campaign = await repo.getCampaign(orgId, campaignId);
    if (!campaign || !DISPATCHABLE_CAMPAIGN.has(campaign.status)) return;
    const intents = await repo.listIntentsByCampaign(orgId, campaignId);
    if (intents.every((i) => isTerminalIntent(i.status))) {
        await repo.updateCampaign(orgId, campaignId, { status: 'completed', updatedAt: now.toISOString() });
    }
}

/**
 * Idempotent: a no-op ('noop') unless the call is terminal, `settledAt` is unset, and its
 * intent is still 'dialing' on exactly this call. The intent moves by compare-and-set
 * (`updateIntentIf`), so two settlements racing on the same call (a retried hangup and the
 * repair sweep) can never both move it, schedule two retries, requeue twice or write two
 * opt-outs. Then records a keypad opt-out and a dead number, stamps `settledAt`, and (unless
 * told not to) refreshes the campaign. With `requeue`, a capacity refusal within the requeue
 * allowance moves the intent through requeueIntentPatch instead of spending the attempt.
 * If the process dies between the intent update and the stamp, the repair sweep
 * (`repairUnsettledCall`) finds the call and closes it without acting twice.
 */
export async function settleCall(deps: SettleDeps, orgId: string, callId: string, opts: SettleOptions = {}): Promise<'settled' | 'noop'> {
    const { repo, clock } = deps;
    const call = await repo.getCall(orgId, callId);
    if (!call || !isTerminal(call.state) || call.settledAt) return 'noop';
    const intent = await repo.getIntent(orgId, call.intentId);
    if (!intent || intent.status !== 'dialing' || intent.lastCallId !== call.id) return 'noop';

    const now = clock.now();
    const requeued = opts.requeue === true && (call.requeue ?? 0) + 1 <= MAX_CARRIER_REQUEUES;
    let patch: Partial<Intent>;
    if (requeued) {
        patch = requeueIntentPatch(call, now);
    } else {
        try {
            patch = settleIntentPatch(call, intent, purposeSpec(call.purpose), now, opts.retryable ?? true);
        } catch {
            // A purpose that no longer exists cannot be retried: close the intent.
            patch = { status: 'done', attempts: call.attempt, lastCallId: call.id, carrierRequeues: 0, updatedAt: now.toISOString() };
        }
    }
    const moved = await repo.updateIntentIf(orgId, intent.id, { status: 'dialing', lastCallId: call.id }, patch);
    if (!moved) return 'noop';

    const actor = call.carrier === 'simulated' ? 'dispatcher' : 'carrier';
    await recordOptOut(repo, call, now, actor);
    await recordInvalidNumber(repo, call, now, actor);
    await stampSettled(repo, orgId, call.id, now);
    if (call.campaignId && (opts.recompute ?? true)) await finishCampaign(repo, orgId, call.campaignId, now);
    return 'settled';
}

/** Sets settledAt once, on a terminal call; never overwrites an earlier stamp. */
async function stampSettled(repo: SamparkRepo, orgId: string, callId: string, now: Date): Promise<void> {
    await repo.mutateCall(orgId, callId, (current) =>
        current.settledAt || !isTerminal(current.state) ? null : { ...current, settledAt: now.toISOString() },
    );
}

/** How long after a call ended the repair sweep waits, so it never races a hangup webhook still settling it. */
export const SETTLE_REPAIR_GRACE_MS = 5 * 60_000;

/**
 * The repair sweep for one ended-but-unsettled call: settle it now if its intent is still
 * waiting on it ('settled'); otherwise its intent already moved on — the settlement got as far
 * as the intent and then failed, or a person or the sweep took over — so only the stamp is
 * missing ('closed'). Either way the call is never listed again.
 */
export async function repairUnsettledCall(deps: SettleDeps, orgId: string, callId: string): Promise<'settled' | 'closed' | 'noop'> {
    const settled = await settleCall(deps, orgId, callId, { recompute: false });
    if (settled === 'settled') return 'settled';
    const call = await deps.repo.getCall(orgId, callId);
    if (!call || !isTerminal(call.state) || call.settledAt) return 'noop';
    await stampSettled(deps.repo, orgId, callId, deps.clock.now());
    return 'closed';
}
