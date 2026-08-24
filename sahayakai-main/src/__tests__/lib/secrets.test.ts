/**
 * Class gate for the 2026-08-24 billing-secret outage.
 *
 * WHAT HAPPENED
 * `getSecret()` built the Secret Manager resource path from the caller's name
 * verbatim — `projects/<p>/secrets/RAZORPAY_KEY_ID/versions/latest`. Most
 * secrets in this project are named for their env var (`GOOGLE_GENAI_API_KEY`),
 * but the Razorpay pair was created by hand in lower-kebab
 * (`razorpay-key-secret`). Nothing bridged the two conventions, so every
 * lookup threw and billing reconciliation failed 6x/day for 30+ days.
 *
 * WHAT THIS GATE CATCHES
 * Not "RAZORPAY_KEY_ID resolves" — that is the instance, and that secret's
 * value still has to be created by a human. The class is: a caller asking by
 * env-var name must reach a secret stored in either convention, and resolution
 * must not silently stop at the first miss. A future secret added in either
 * naming style is covered without touching this file.
 */

import { secretIdCandidates } from '@/lib/secrets';

describe('Secret id resolution (class gate)', () => {
    it('tries the literal env-var name first', () => {
        // Ordering matters: the env-var convention is the project default, and
        // a same-named secret must win over a kebab twin if both exist.
        expect(secretIdCandidates('RAZORPAY_KEY_ID')[0]).toBe('RAZORPAY_KEY_ID');
    });

    it('also tries the lower-kebab form for UPPER_SNAKE names', () => {
        expect(secretIdCandidates('RAZORPAY_KEY_ID')).toEqual([
            'RAZORPAY_KEY_ID',
            'razorpay-key-id',
        ]);
    });

    it('covers every Razorpay secret the billing path asks for', () => {
        // The three names billing actually requests. Each must offer the kebab
        // id, because that is how they exist in Secret Manager today.
        expect(secretIdCandidates('RAZORPAY_KEY_SECRET')).toContain('razorpay-key-secret');
        expect(secretIdCandidates('RAZORPAY_WEBHOOK_SECRET')).toContain('razorpay-webhook-secret');
        expect(secretIdCandidates('RAZORPAY_KEY_ID')).toContain('razorpay-key-id');
    });

    it('never emits the same candidate twice', () => {
        // A wasted duplicate lookup is a slow failure path, and for an
        // already-kebab name it would be the *only* lookup, doubled.
        expect(secretIdCandidates('razorpay-key-secret')).toEqual(['razorpay-key-secret']);
        for (const name of ['CRON', 'RAZORPAY_KEY_ID', 'razorpay-key-secret', 'a-b']) {
            const candidates = secretIdCandidates(name);
            expect(new Set(candidates).size).toBe(candidates.length);
        }
    });

    it('never returns an empty candidate list', () => {
        // Guards the loop in getSecret(): zero candidates would fall straight
        // through to the throw with no lookup attempted at all.
        for (const name of ['A', 'A_B', 'a-b', 'MIXED_Case_Name']) {
            expect(secretIdCandidates(name).length).toBeGreaterThan(0);
        }
    });
});
