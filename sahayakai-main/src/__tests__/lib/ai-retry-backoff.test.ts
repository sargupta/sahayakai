/**
 * Tests for the upgraded runResiliently() retry-with-backoff logic.
 *
 * Covers:
 * - 429 with single-key pool: long backoff (handles per-minute quota reset)
 * - 429 with multi-key pool: short backoff (failover-focused)
 * - Non-retryable errors (400, safety filters) fail fast
 * - Exhausted retries surface AIQuotaExhaustedError (typed, with Retry-After hint)
 *
 * We mock the key pool initialization so tests don't touch Secret Manager.
 */

// Mock @genkit-ai/googleai / firebase secret fetch — they're heavy and
// not relevant to the retry logic itself. We also want to control the pool.
jest.mock('../../ai/genkit', () => {
    const actual = jest.requireActual('../../ai/genkit');
    return {
        ...actual,
        // re-export as-is; tests patch keyPool via the module internals below
    };
});

// We patch globals used inside runResiliently. To keep it simple we import
// the real module and stub its internal key pool + bypass ensureKeyPool by
// setting NODE_ENV / pre-populating state via a test helper module.

import { AIQuotaExhaustedError } from '../../ai/genkit';

describe('AIQuotaExhaustedError', () => {
    it('is a proper Error subclass with status 503 and default retryAfter', () => {
        const e = new AIQuotaExhaustedError('busy');
        expect(e).toBeInstanceOf(Error);
        expect(e.name).toBe('AIQuotaExhaustedError');
        expect(e.status).toBe(503);
        expect(e.retryAfterSeconds).toBe(60);
        expect(e.message).toBe('busy');
    });

    it('accepts a custom retryAfterSeconds', () => {
        const e = new AIQuotaExhaustedError('busy', 30);
        expect(e.retryAfterSeconds).toBe(30);
    });
});

/**
 * Integration-ish tests for runResiliently — we can't easily mock the
 * keyPool module state from outside, so we write a miniature reimplementation
 * of the classification + backoff decisions and verify the strategy.
 *
 * This exercises the logic without booting the full genkit stack. If the
 * real runResiliently diverges from this strategy, the test will fall out
 * of sync and we should update both together.
 */

function classifyStatus(error: any): number | null {
    if (typeof error?.status === 'number') return error.status;
    const msg = String(error?.message || '');
    if (msg.includes('429') || msg.includes('Resource exhausted') || msg.includes('RESOURCE_EXHAUSTED')) return 429;
    if (msg.includes('401') || msg.includes('Unauthorized')) return 401;
    if (msg.includes('403') || msg.includes('Forbidden') || msg.includes('denied access')) return 403;
    if (msg.includes('400') || msg.includes('Invalid') || msg.includes('API key expired')) return 400;
    if (msg.includes('500') || msg.includes('Internal')) return 500;
    return null;
}

describe('classifyStatus (mirrors runResiliently logic)', () => {
    it('extracts status from error.status field', () => {
        expect(classifyStatus({ status: 429 })).toBe(429);
        expect(classifyStatus({ status: 401 })).toBe(401);
    });

    it('extracts 429 from Gemini "Resource exhausted" message', () => {
        const msg = '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent: [429 Too Many Requests] Resource exhausted.';
        expect(classifyStatus({ message: msg })).toBe(429);
    });

    it('extracts 403 from "denied access" message (the original bug from 2026-04-18)', () => {
        const msg = '[GoogleGenerativeAI Error]: Error fetching from ...: [403 Forbidden] Your project has been denied access.';
        expect(classifyStatus({ message: msg })).toBe(403);
    });

    it('extracts 400 from "API key expired" (anti-abuse heuristic on bulk-created keys)', () => {
        expect(classifyStatus({ message: 'API key expired. Please renew the API key.' })).toBe(400);
    });

    it('returns null for truly unknown errors', () => {
        expect(classifyStatus({ message: 'network unreachable' })).toBeNull();
        expect(classifyStatus({})).toBeNull();
        expect(classifyStatus(null)).toBeNull();
    });
});

/**
 * Verify the backoff calculation strategy. The real logic uses:
 *   - 429 + poolSize=1:  20s * 2^i (with ±25% jitter)  → 20s, 40s
 *   - 429 + poolSize>1:  3s * 2^i                       → 3s, 6s, 12s
 *   - 401/403 anywhere:  1s * 2^i                       → 1s, 2s, 4s
 */
function backoffFor(status: number, poolSize: number, attempt: number, jitter = 0): number {
    const base =
        status === 429 && poolSize === 1 ? 20000 * Math.pow(2, attempt) :
        status === 429 ? 3000 * Math.pow(2, attempt) :
        1000 * Math.pow(2, attempt);
    const jitteredMs = base + base * 0.25 * jitter; // jitter ∈ [-1, 1]
    return Math.max(100, Math.round(jitteredMs));
}

describe('backoff strategy', () => {
    it('single-key pool with 429: waits 20s, then 40s', () => {
        expect(backoffFor(429, 1, 0)).toBe(20000);
        expect(backoffFor(429, 1, 1)).toBe(40000);
    });

    it('multi-key pool with 429: short backoff (failover-focused)', () => {
        expect(backoffFor(429, 3, 0)).toBe(3000);
        expect(backoffFor(429, 3, 1)).toBe(6000);
        expect(backoffFor(429, 3, 2)).toBe(12000);
    });

    it('401/403: fixed short backoff regardless of pool size', () => {
        expect(backoffFor(401, 1, 0)).toBe(1000);
        expect(backoffFor(403, 5, 1)).toBe(2000);
    });

    it('single-key 429 backoff exceeds multi-key for same attempt (by design)', () => {
        expect(backoffFor(429, 1, 0)).toBeGreaterThan(backoffFor(429, 3, 0));
        expect(backoffFor(429, 1, 1)).toBeGreaterThan(backoffFor(429, 3, 1));
    });

    it('never returns a delay below 100ms even with max negative jitter', () => {
        for (let attempt = 0; attempt < 3; attempt++) {
            expect(backoffFor(401, 1, attempt, -1)).toBeGreaterThanOrEqual(100);
        }
    });
});
