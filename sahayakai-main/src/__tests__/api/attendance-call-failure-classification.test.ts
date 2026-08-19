/**
 * Class gate for the 2026-08-18 parent-call outage.
 *
 * WHAT HAPPENED
 * A rotated Twilio auth token made every attendance call fail with
 * `20003 Authenticate`. The route returned `502 Failed to initiate call` for
 * that — and for every other Twilio failure. 502 reads as transient, so the
 * client retried; the retry hit the outreach route's 5-minute per-student
 * dedup window and came back 429, locking the teacher out of calling that
 * parent for five minutes over a failure that never reached the parent.
 *
 * WHAT THIS GATE CATCHES
 * Not "20003 returns 503" — that is the instance. The class is:
 *   - a provider/credential failure must never be reported as retryable,
 *   - a destination failure must never be reported as our outage,
 *   - and a dead attempt must release the dedup window.
 * The table below is exhaustive over the codes we classify, so adding a code
 * to the wrong bucket, or letting a new one silently fall back to 502-retry,
 * fails here.
 */

import {
    classifyTwilioFailure,
    releasesDedupWindow,
    type TwilioFailureCategory,
} from '@/lib/twilio-errors';

describe('Twilio failure classification (class gate)', () => {
    // code, expected category. Exhaustive over every code we claim to know.
    const CASES: Array<[number, TwilioFailureCategory]> = [
        // Our account / credentials / number — operator action.
        [20003, 'provider_unconfigured'],
        [20005, 'provider_unconfigured'],
        [20404, 'provider_unconfigured'],
        [21210, 'provider_unconfigured'],
        [21215, 'provider_unconfigured'],
        [21606, 'provider_unconfigured'],
        [21659, 'provider_unconfigured'],
        // The parent's number — the teacher can fix this.
        [13223, 'destination_unreachable'],
        [13224, 'destination_unreachable'],
        [21211, 'destination_unreachable'],
        [21214, 'destination_unreachable'],
        [21217, 'destination_unreachable'],
        [21219, 'destination_unreachable'],
        // Twilio itself.
        [20429, 'provider_transient'],
        [20500, 'provider_transient'],
        [20503, 'provider_transient'],
    ];

    it.each(CASES)('code %i classifies as %s', (code, expected) => {
        expect(classifyTwilioFailure(code, 400).category).toBe(expected);
    });

    it('the exact production failure (20003) is a non-retryable 503, not a 502', () => {
        const f = classifyTwilioFailure(20003, 401);
        expect(f.status).toBe(503);
        expect(f.retryable).toBe(false);
        expect(f.code).toBe('CALL_PROVIDER_UNCONFIGURED');
    });

    describe('the invariants, not the table', () => {
        it('NO credential/config failure is ever marked retryable', () => {
            // This is the bug: 502 invited a retry that could never succeed.
            const configCodes = CASES.filter(([, c]) => c === 'provider_unconfigured');
            expect(configCodes.length).toBeGreaterThan(0);
            for (const [code] of configCodes) {
                const f = classifyTwilioFailure(code, 401);
                expect(f.retryable).toBe(false);
                expect(f.status).toBe(503);
            }
        });

        it('NO destination failure is reported as our outage', () => {
            const destCodes = CASES.filter(([, c]) => c === 'destination_unreachable');
            expect(destCodes.length).toBeGreaterThan(0);
            for (const [code] of destCodes) {
                const f = classifyTwilioFailure(code, 400);
                // 4xx — the caller can act. Never 5xx, which blames us.
                expect(f.status).toBeGreaterThanOrEqual(400);
                expect(f.status).toBeLessThan(500);
                expect(f.retryable).toBe(false);
            }
        });

        it('every non-retryable failure releases the dedup window', () => {
            // The lockout is the part the teacher actually felt.
            for (const [code] of CASES) {
                const f = classifyTwilioFailure(code, 400);
                expect(releasesDedupWindow(f)).toBe(!f.retryable);
            }
        });

        it('a retryable failure does NOT release the window', () => {
            // Twilio being busy might still have placed the call; releasing
            // here could double-dial a parent.
            const f = classifyTwilioFailure(20429, 429);
            expect(f.retryable).toBe(true);
            expect(releasesDedupWindow(f)).toBe(false);
        });

        it('no classification leaks Twilio internals to the client', () => {
            for (const [code] of CASES) {
                const f = classifyTwilioFailure(code, 401);
                // Never echo the numeric provider code or provider name.
                expect(f.error).not.toMatch(/twilio/i);
                expect(f.error).not.toContain(String(code));
                expect(f.code).not.toContain(String(code));
            }
        });
    });

    describe('unknown and malformed input', () => {
        it('an unrecognised code stays a 502 rather than guessing', () => {
            const f = classifyTwilioFailure(99999, 400);
            expect(f.category).toBe('unknown');
            expect(f.status).toBe(502);
        });

        it('a 401 with NO parsable code is still treated as our auth', () => {
            // The body failed to parse — but 401 is unambiguous about ownership,
            // and this is the shape the outage would take if Twilio changed its
            // error body.
            const f = classifyTwilioFailure(undefined, 401);
            expect(f.category).toBe('provider_unconfigured');
            expect(f.retryable).toBe(false);
        });

        it('a 5xx with no code is transient, not a config failure', () => {
            expect(classifyTwilioFailure(undefined, 503).category).toBe('provider_transient');
        });

        it('does not throw on a non-numeric code', () => {
            expect(() => classifyTwilioFailure('20003', 401)).not.toThrow();
            expect(() => classifyTwilioFailure(null, undefined)).not.toThrow();
        });

        it('a string code is NOT silently treated as its number', () => {
            // Twilio sends a number. If it ever sends a string we want the
            // conservative fallback, not a coincidental match.
            expect(classifyTwilioFailure('20003', 400).category).toBe('unknown');
        });
    });
});
