/**
 * Deterministic ids for intents and calls (plan §4③⑦, class gates 3 and 13).
 *
 * An intent's id is the hash of its dedupe key and is written create-only, so
 * the same key can never produce two intents and a rejected intent can never
 * be resurrected by re-running materialisation. A call's id is the hash of
 * (intent id, attempt), so a second dispatcher that races to claim the same
 * attempt collides on the call record and loses the claim.
 *
 * A carrier refusal for capacity (a 429) does not spend the family's attempt
 * (H7): the intent is requeued with the SAME attempt number, so the next dial
 * needs a different call id or its claim would collide with the refused call's
 * record for ever (EDGE_CASES telephony S23). The requeue number is therefore
 * part of the id, and requeue 0 hashes exactly as before, so every call id
 * written before the hardening sprint is unchanged.
 */

import crypto from 'node:crypto';

/** sha256 hex of `input`, first 32 characters. */
export function hashId(input: string): string {
    return crypto.createHash('sha256').update(input, 'utf8').digest('hex').slice(0, 32);
}

/** One intent per guardian per campaign (siblings bundled). */
export function campaignDedupeKey(campaignId: string, guardianId: string): string {
    return `campaign:${campaignId}:guardian:${guardianId}`;
}

export function intentIdFor(dedupeKey: string): string {
    return hashId(dedupeKey);
}

/**
 * Carrier refusals (429, channel full) one attempt may absorb without spending it (H7). The
 * refusal after these is settled as an ordinary retryable failure, which spends the attempt,
 * so a carrier that keeps refusing cannot hold an intent in a requeue loop for ever.
 */
export const MAX_CARRIER_REQUEUES = 3;

/** Requeue 0 (every call before the hardening sprint) keeps the original `${intentId}#${attempt}` id. */
export function callIdFor(intentId: string, attempt: number, requeue = 0): string {
    return hashId(requeue === 0 ? `${intentId}#${attempt}` : `${intentId}#${attempt}#r${requeue}`);
}
