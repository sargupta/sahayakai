/**
 * @jest-environment node
 */
import crypto from 'node:crypto';

import { callIdFor, campaignDedupeKey, hashId, intentIdFor } from '@/lib/sampark/intents';

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
});
