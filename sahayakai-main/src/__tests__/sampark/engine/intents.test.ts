/**
 * @jest-environment node
 */
import crypto from 'node:crypto';

import { callIdFor, campaignDedupeKey, hashId, intentIdFor, MAX_CARRIER_REQUEUES } from '@/lib/sampark/intents';

describe('sampark intents ids', () => {
    it('hashId is the first 32 hex chars of sha256', () => {
        const full = crypto.createHash('sha256').update('abc').digest('hex');
        expect(hashId('abc')).toBe(full.slice(0, 32));
        expect(hashId('abc')).toMatch(/^[0-9a-f]{32}$/);
    });

    it('campaignDedupeKey has the contract shape', () => {
        expect(campaignDedupeKey('c1', 'g1')).toBe('campaign:c1:guardian:g1');
    });

    it('intentIdFor is hashId of the dedupe key; stable and distinct per key', () => {
        const key = campaignDedupeKey('c1', 'g1');
        expect(intentIdFor(key)).toBe(hashId(key));
        expect(intentIdFor(key)).toBe(intentIdFor(campaignDedupeKey('c1', 'g1')));
        expect(intentIdFor(key)).not.toBe(intentIdFor(campaignDedupeKey('c1', 'g2')));
    });

    it('callIdFor differs per attempt and is hashId(`${intentId}#${attempt}`)', () => {
        const id = intentIdFor('k');
        expect(callIdFor(id, 1)).toBe(hashId(`${id}#1`));
        expect(callIdFor(id, 1)).not.toBe(callIdFor(id, 2));
    });

    it('requeue 0 is exactly the pre-H7 id, so no call id written before the hardening sprint changes', () => {
        const id = intentIdFor('k');
        // Pinned literally: sha256('<id>#1') — not recomputed through hashId, so a change to either breaks this.
        const legacy = crypto.createHash('sha256').update(`${id}#1`).digest('hex').slice(0, 32);
        expect(callIdFor(id, 1, 0)).toBe(legacy);
        expect(callIdFor(id, 1)).toBe(legacy);
    });

    it('every (attempt, requeue) pair gets its own id (no claim collides with a refused call, EDGE_CASES S23)', () => {
        const id = intentIdFor('k');
        const ids = new Set<string>();
        for (let attempt = 1; attempt <= 3; attempt++) {
            for (let requeue = 0; requeue <= MAX_CARRIER_REQUEUES; requeue++) ids.add(callIdFor(id, attempt, requeue));
        }
        expect(ids.size).toBe(3 * (MAX_CARRIER_REQUEUES + 1));
        expect(callIdFor(id, 1, 1)).not.toBe(callIdFor(intentIdFor('other'), 1, 1));
        expect(MAX_CARRIER_REQUEUES).toBe(3);
    });
});
