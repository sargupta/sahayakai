/**
 * Campaign tallies, recomputed from intent and call RECORDS (never from
 * counters a lost event could freeze — plan §4⑦). Counts are per guardian
 * (one intent per guardian per campaign), not per attempt, and are separate
 * metrics rather than a partition:
 *
 *   guardians        intents in the campaign
 *   blocked          intents a gate refused
 *   queued           intents waiting to be dialled ('approved' or 'retry_wait')
 *   inFlight         intents claimed and not yet settled ('dialing')
 *   heardKeyFact     intents with an answered call that heard the whole message or pressed a key
 *   confirmedYes     intents where the parent pressed 1 (on a menu that offers it)
 *   declinedOrOther  intents where the parent pressed 2 and never 1
 *   noAnswer         intents not yet reached whose latest call rang out or was busy
 *   failed           intents not yet reached whose latest call failed or was lost ('unknown'), or needs review
 *   optOuts          intents on which the parent pressed 9 (confirmed or not)
 */

import { MAX_CARRIER_REQUEUES } from '@/lib/sampark/intents';
import type { SamparkRepo } from '@/lib/sampark/ports';
import type { CampaignCounts, Intent, IntentStatus, SamparkCall } from '@/types/sampark';

export const TERMINAL_INTENT_STATUSES: readonly IntentStatus[] = ['done', 'blocked', 'needs_review', 'expired', 'cancelled'];

export function isTerminalIntent(status: IntentStatus): boolean {
    return TERMINAL_INTENT_STATUSES.includes(status);
}

export function emptyCounts(): CampaignCounts {
    return {
        guardians: 0,
        blocked: 0,
        queued: 0,
        inFlight: 0,
        heardKeyFact: 0,
        confirmedYes: 0,
        declinedOrOther: 0,
        noAnswer: 0,
        failed: 0,
        optOuts: 0,
    };
}

export function heardKeyFact(call: SamparkCall): boolean {
    return call.state === 'completed' && (call.outcome.heard === 'full' || call.outcome.digits.length > 0);
}

/** Pure tally, exported for callers that already hold the records. */
export function tallyCampaign(intents: Intent[], calls: SamparkCall[]): CampaignCounts {
    const counts = emptyCounts();
    const callsByIntent = new Map<string, SamparkCall[]>();
    for (const c of calls) {
        const list = callsByIntent.get(c.intentId) ?? [];
        list.push(c);
        callsByIntent.set(c.intentId, list);
    }

    for (const intent of intents) {
        counts.guardians += 1;
        if (intent.status === 'blocked') counts.blocked += 1;
        if (intent.status === 'approved' || intent.status === 'retry_wait') counts.queued += 1;
        if (intent.status === 'dialing') counts.inFlight += 1;

        // Within one attempt, a carrier requeue (H7) dials again later: the highest requeue is the latest call.
        const own = (callsByIntent.get(intent.id) ?? []).slice().sort((a, b) => a.attempt - b.attempt || (a.requeue ?? 0) - (b.requeue ?? 0));
        const reached = own.some(heardKeyFact);
        if (reached) counts.heardKeyFact += 1;
        const confirmed = own.some((c) => c.outcome.confirmed);
        if (confirmed) counts.confirmedYes += 1;
        else if (own.some((c) => c.outcome.declined)) counts.declinedOrOther += 1;
        if (own.some((c) => c.outcome.optOut !== 'none')) counts.optOuts += 1;

        const latest = own[own.length - 1];
        if (!reached) {
            if (latest && (latest.state === 'no_answer' || latest.state === 'busy')) counts.noAnswer += 1;
            else if (intent.status === 'needs_review' || (latest && (latest.state === 'failed' || latest.state === 'unknown'))) {
                counts.failed += 1;
            }
        }
    }
    return counts;
}

/** Recompute a campaign's counts from its records and store them on the campaign. */
export async function recomputeCampaignCounts(repo: SamparkRepo, orgId: string, campaignId: string): Promise<CampaignCounts> {
    const intents = await repo.listIntentsByCampaign(orgId, campaignId);
    // Every attempt may carry up to MAX_CARRIER_REQUEUES refused dials besides the one that counted.
    const limit = Math.max(1000, intents.reduce((n, i) => n + Math.max(1, i.attempts) * (1 + MAX_CARRIER_REQUEUES), 0) + 100);
    const calls = await repo.listCalls(orgId, { campaignId, limit });
    const counts = tallyCampaign(intents, calls);
    const campaign = await repo.getCampaign(orgId, campaignId);
    // Counts are derived data: updatedAt is left to the transitions that change the campaign itself.
    if (campaign) await repo.updateCampaign(orgId, campaignId, { counts });
    return counts;
}
