/**
 * Settling a finished call (plan §4⑦⑧): the ONE place a call's terminal state
 * is turned into consequences — the intent moves on (done | retry_wait |
 * expired), a keypad opt-out becomes a suppression, and the campaign's counts
 * and completion are brought up to date.
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
 */

import { purposeSpec, type PurposeSpec } from '@/lib/sampark/catalogue';
import { isTerminalIntent, recomputeCampaignCounts } from '@/lib/sampark/dispatch/counts';
import { isTerminal } from '@/lib/sampark/dispatch/state';
import type { Clock, SamparkRepo } from '@/lib/sampark/ports';
import type { Campaign, Intent, SamparkCall, Suppression } from '@/types/sampark';

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
}

/** The intent patch for a call that has ended. Pure. */
export function settleIntentPatch(call: SamparkCall, intent: Intent, spec: PurposeSpec, now: Date, retryable: boolean): Partial<Intent> {
    const patch: Partial<Intent> = { attempts: call.attempt, lastCallId: call.id, updatedAt: now.toISOString() };
    const reached = call.state === 'completed' && (call.outcome.heard === 'full' || call.outcome.digits.length > 0);
    if (reached || !retryable || call.attempt >= intent.maxAttempts) {
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
 * Key 9 → a routine suppression (office verifies within two school days, plan §5.1).
 * Never weakens or re-dates an effective suppression; the one allowed change is
 * upgrading an unconfirmed keypad opt-out to a confirmed one.
 */
export async function recordOptOut(repo: SamparkRepo, call: SamparkCall, now: Date, actor = 'dispatcher'): Promise<void> {
    if (call.outcome.optOut === 'none') return;
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
 * intent is still 'dialing' on exactly this call. Otherwise updates the intent, records a
 * keypad opt-out, stamps `settledAt`, and (unless told not to) refreshes the campaign.
 */
export async function settleCall(deps: SettleDeps, orgId: string, callId: string, opts: SettleOptions = {}): Promise<'settled' | 'noop'> {
    const { repo, clock } = deps;
    const call = await repo.getCall(orgId, callId);
    if (!call || !isTerminal(call.state) || call.settledAt) return 'noop';
    const intent = await repo.getIntent(orgId, call.intentId);
    if (!intent || intent.status !== 'dialing' || intent.lastCallId !== call.id) return 'noop';

    const now = clock.now();
    let spec: PurposeSpec;
    try {
        spec = purposeSpec(call.purpose);
    } catch {
        // A purpose that no longer exists cannot be retried: close the intent.
        await repo.updateIntent(orgId, intent.id, { status: 'done', attempts: call.attempt, lastCallId: call.id, updatedAt: now.toISOString() });
        await repo.updateCall(orgId, call.id, { settledAt: now.toISOString() });
        return 'settled';
    }

    await repo.updateIntent(orgId, intent.id, settleIntentPatch(call, intent, spec, now, opts.retryable ?? true));
    await recordOptOut(repo, call, now, call.carrier === 'simulated' ? 'dispatcher' : 'carrier');
    await repo.updateCall(orgId, call.id, { settledAt: now.toISOString() });
    if (call.campaignId && (opts.recompute ?? true)) await finishCampaign(repo, orgId, call.campaignId, now);
    return 'settled';
}
