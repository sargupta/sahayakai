/**
 * Deterministic ids for intents and calls (plan §4③⑦, class gates 3 and 13).
 *
 * An intent's id is the hash of its dedupe key and is written create-only, so
 * the same key can never produce two intents and a rejected intent can never
 * be resurrected by re-running materialisation. A call's id is the hash of
 * (intent id, attempt), so a second dispatcher that races to claim the same
 * attempt collides on the call record and loses the claim.
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

export function callIdFor(intentId: string, attempt: number): string {
    return hashId(`${intentId}#${attempt}`);
}
