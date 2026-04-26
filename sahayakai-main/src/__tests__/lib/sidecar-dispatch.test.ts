/**
 * Unit tests for the parent-call sidecar dispatcher.
 *
 * Covers the off / shadow / canary / full branching matrix with mocked
 * Genkit + sidecar paths so the test runs without network calls.
 *
 * The matrix:
 *
 *   mode      sidecar OK      sidecar transport err   sidecar behavioural
 *   ─────────────────────────────────────────────────────────────────────
 *   off       (not called)    (not called)            (not called)
 *   shadow    Genkit serves   Genkit serves           Genkit serves
 *             diff written    diff written            diff written
 *   canary    sidecar serves  Genkit fallback         RETHROW
 *   full      sidecar serves  Genkit fallback         RETHROW
 *
 * The behavioural-error rethrow is the safety-critical case: Genkit
 * fallback would likely produce the same suspect output (model issue,
 * not transport), so we land the canned safe wrap-up via the route's
 * outer try/catch instead.
 *
 * Round-2 audit reference: P0 BEHAV-1.
 */

import type { AgentReplyInput, AgentReplyOutput } from '@/ai/flows/parent-call-agent';
import type { ParentCallSidecarMode } from '@/lib/feature-flags';

// ── Mock setup ─────────────────────────────────────────────────────────────
//
// Full synthetic mocks (no `requireActual`) because the real
// `@/lib/feature-flags` and `@/lib/sidecar/parent-call-client` modules
// transitively import `firebase-admin` and `google-auth-library`. The
// former pulls in `jose`'s pure-ESM build via `jwks-rsa` which Jest's
// CJS transformer cannot parse without a custom `transformIgnorePatterns`
// entry. Synthetic mocks side-step that entirely; we only need the
// dispatcher's contract surface here.

// `@/lib/feature-flags`: only `decideParentCallDispatch` is referenced
// by the dispatcher, plus the `ParentCallSidecarMode` type (erased at
// runtime so the mock does not need to export it).
jest.mock('@/lib/feature-flags', () => ({
    decideParentCallDispatch: jest.fn(),
}));

jest.mock('@/ai/flows/parent-call-agent', () => ({
    generateAgentReply: jest.fn(),
}));

jest.mock('@/lib/sidecar/shadow-diff', () => ({
    writeShadowDiff: jest.fn().mockResolvedValue(undefined),
}));

// `@/lib/sidecar/parent-call-client`: re-implement the four error
// classes inline so `instanceof` checks in the dispatcher still work.
// Keeping the names byte-aligned with the production module.
jest.mock('@/lib/sidecar/parent-call-client', () => {
    class SidecarConfigError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'SidecarConfigError';
        }
    }
    class SidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`Sidecar request timed out after ${elapsedMs}ms`);
            this.name = 'SidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class SidecarHttpError extends Error {
        readonly status: number;
        readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) {
            super(`Sidecar returned HTTP ${status}: ${bodyExcerpt}`);
            this.name = 'SidecarHttpError';
            this.status = status;
            this.bodyExcerpt = bodyExcerpt;
        }
    }
    class SidecarBehaviouralError extends Error {
        readonly axis: string;
        constructor(axis: string, details: string) {
            super(`Sidecar behavioural guard failed (${axis}): ${details}`);
            this.name = 'SidecarBehaviouralError';
            this.axis = axis;
        }
    }
    return {
        callSidecarReply: jest.fn(),
        SidecarConfigError,
        SidecarTimeoutError,
        SidecarHttpError,
        SidecarBehaviouralError,
    };
});

// Imports come AFTER the mocks so the dispatcher picks them up.
import { generateAgentReply } from '@/ai/flows/parent-call-agent';
import { decideParentCallDispatch } from '@/lib/feature-flags';
import { dispatchParentCallReply } from '@/lib/sidecar/dispatch';
import {
    callSidecarReply,
    SidecarBehaviouralError,
    SidecarHttpError,
    SidecarTimeoutError,
    type SidecarReplyResponse,
} from '@/lib/sidecar/parent-call-client';
import { writeShadowDiff } from '@/lib/sidecar/shadow-diff';

const mockGenerateAgentReply = generateAgentReply as jest.MockedFunction<typeof generateAgentReply>;
const mockCallSidecarReply = callSidecarReply as jest.MockedFunction<typeof callSidecarReply>;
const mockWriteShadowDiff = writeShadowDiff as jest.MockedFunction<typeof writeShadowDiff>;
const mockDecideDispatch = decideParentCallDispatch as jest.MockedFunction<typeof decideParentCallDispatch>;

// ── Fixtures ───────────────────────────────────────────────────────────────

const BASE_INPUT = {
    callSid: 'CAtest1234',
    studentName: 'Arav',
    className: 'Class 5',
    subject: 'Science',
    reason: 'Homework follow-up',
    teacherMessage: 'Please ensure homework is done daily.',
    teacherName: 'Mrs. Sharma',
    schoolName: 'Sunrise Public',
    parentLanguage: 'en',
    transcript: [],
    parentSpeech: 'Yes, I will check.',
    turnNumber: 1,
} satisfies AgentReplyInput & { callSid: string };

const GENKIT_REPLY: AgentReplyOutput = {
    reply: 'Thank you for taking the call. Please check his homework tonight.',
    shouldEndCall: false,
    followUpQuestion: undefined,
};

const SIDECAR_REPLY: SidecarReplyResponse = {
    reply: 'Thanks for picking up. Reading 10 minutes a day at home will help.',
    shouldEndCall: false,
    followUpQuestion: null,
    sessionId: 'CAtest1234',
    turnNumber: 1,
    latencyMs: 850,
    modelUsed: 'gemini-2.5-flash',
    cacheHitRatio: 0.32,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function setMode(mode: ParentCallSidecarMode, percent = 100): void {
    mockDecideDispatch.mockResolvedValue({
        mode,
        reason: `test_${mode}`,
        bucket: 0,
    });
    void percent; // bucket pre-resolved by mock; percent kept for symmetry
}

beforeEach(() => {
    jest.clearAllMocks();
    // Silence the dispatcher's structured log lines so test output stays
    // readable. Each test re-asserts behaviour, not log presence.
    jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ── off ────────────────────────────────────────────────────────────────────

describe('dispatchParentCallReply — off mode', () => {
    it('calls Genkit only and never touches the sidecar', async () => {
        setMode('off');
        mockGenerateAgentReply.mockResolvedValue(GENKIT_REPLY);

        const out = await dispatchParentCallReply(BASE_INPUT);

        expect(mockGenerateAgentReply).toHaveBeenCalledTimes(1);
        expect(mockCallSidecarReply).not.toHaveBeenCalled();
        expect(mockWriteShadowDiff).not.toHaveBeenCalled();
        expect(out.source).toBe('genkit');
        expect(out.reply).toBe(GENKIT_REPLY.reply);
        expect(out.followUpQuestion).toBeNull();
    });

    it('surfaces Genkit errors so the route can land the safe wrap-up', async () => {
        setMode('off');
        const err = new Error('Genkit blew up');
        mockGenerateAgentReply.mockRejectedValue(err);

        await expect(dispatchParentCallReply(BASE_INPUT)).rejects.toThrow(err);
        expect(mockCallSidecarReply).not.toHaveBeenCalled();
    });
});

// ── shadow ─────────────────────────────────────────────────────────────────

describe('dispatchParentCallReply — shadow mode', () => {
    it('returns the Genkit reply and writes a shadow-diff with both sides', async () => {
        setMode('shadow');
        mockGenerateAgentReply.mockResolvedValue(GENKIT_REPLY);
        mockCallSidecarReply.mockResolvedValue(SIDECAR_REPLY);

        const out = await dispatchParentCallReply(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(out.reply).toBe(GENKIT_REPLY.reply);
        expect(mockGenerateAgentReply).toHaveBeenCalledTimes(1);
        expect(mockCallSidecarReply).toHaveBeenCalledTimes(1);

        // shadow-diff is fire-and-forget; the dispatcher kicks it off
        // synchronously even though it does not await. The mock has
        // already been invoked at the moment dispatch returns.
        expect(mockWriteShadowDiff).toHaveBeenCalledTimes(1);
        const diffArg = mockWriteShadowDiff.mock.calls[0][0];
        expect(diffArg.callSid).toBe('CAtest1234');
        expect(diffArg.genkitReply).toBe(GENKIT_REPLY.reply);
        expect(diffArg.sidecarReply).toBe(SIDECAR_REPLY.reply);
        expect(diffArg.sidecarError).toBeUndefined();
        expect(diffArg.sidecarLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('records a sidecar error in the shadow-diff but still serves Genkit', async () => {
        setMode('shadow');
        mockGenerateAgentReply.mockResolvedValue(GENKIT_REPLY);
        mockCallSidecarReply.mockRejectedValue(new SidecarTimeoutError(3500));

        const out = await dispatchParentCallReply(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(out.reply).toBe(GENKIT_REPLY.reply);

        const diffArg = mockWriteShadowDiff.mock.calls[0][0];
        expect(diffArg.sidecarReply).toBeNull();
        expect(diffArg.sidecarError).toBeDefined();
        expect(diffArg.sidecarError?.type).toBe('SidecarTimeoutError');
        expect(diffArg.sidecarError?.elapsedMs).toBe(3500);
    });

    it('still rethrows Genkit failures (sidecar success cannot rescue)', async () => {
        setMode('shadow');
        mockGenerateAgentReply.mockRejectedValue(new Error('Genkit failed'));
        mockCallSidecarReply.mockResolvedValue(SIDECAR_REPLY);

        await expect(dispatchParentCallReply(BASE_INPUT)).rejects.toThrow('Genkit failed');

        // Diff still written so we can see Genkit failure mode in shadow data.
        expect(mockWriteShadowDiff).toHaveBeenCalledTimes(1);
        const diffArg = mockWriteShadowDiff.mock.calls[0][0];
        expect(diffArg.genkitReply).toBe(''); // empty because Genkit failed
        expect(diffArg.sidecarReply).toBe(SIDECAR_REPLY.reply);
    });
});

// ── canary / full ──────────────────────────────────────────────────────────

describe.each(['canary', 'full'] as const)('dispatchParentCallReply — %s mode', (mode) => {
    it('returns the sidecar reply when the sidecar succeeds (no Genkit call)', async () => {
        setMode(mode);
        mockCallSidecarReply.mockResolvedValue(SIDECAR_REPLY);

        const out = await dispatchParentCallReply(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.reply).toBe(SIDECAR_REPLY.reply);
        expect(out.shouldEndCall).toBe(false);
        expect(out.followUpQuestion).toBeNull();
        expect(mockCallSidecarReply).toHaveBeenCalledTimes(1);
        expect(mockGenerateAgentReply).not.toHaveBeenCalled();
        expect(mockWriteShadowDiff).not.toHaveBeenCalled();
    });

    it('falls back to Genkit on SidecarTimeoutError', async () => {
        setMode(mode);
        mockCallSidecarReply.mockRejectedValue(new SidecarTimeoutError(3500));
        mockGenerateAgentReply.mockResolvedValue(GENKIT_REPLY);

        const out = await dispatchParentCallReply(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(out.reply).toBe(GENKIT_REPLY.reply);
        expect(mockGenerateAgentReply).toHaveBeenCalledTimes(1);
    });

    it('falls back to Genkit on SidecarHttpError', async () => {
        setMode(mode);
        mockCallSidecarReply.mockRejectedValue(new SidecarHttpError(503, 'Service unavailable'));
        mockGenerateAgentReply.mockResolvedValue(GENKIT_REPLY);

        const out = await dispatchParentCallReply(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockGenerateAgentReply).toHaveBeenCalledTimes(1);
    });

    it('rethrows SidecarBehaviouralError WITHOUT calling Genkit', async () => {
        setMode(mode);
        mockCallSidecarReply.mockRejectedValue(
            new SidecarBehaviouralError('forbidden_phrase', 'matched "I am an AI"'),
        );

        await expect(dispatchParentCallReply(BASE_INPUT)).rejects.toThrow(SidecarBehaviouralError);
        // Critical: Genkit MUST NOT be called as a fallback on
        // behavioural errors — same model bias would likely produce
        // the same suspect output. Route's outer catch lands the canned
        // safe wrap-up instead.
        expect(mockGenerateAgentReply).not.toHaveBeenCalled();
    });

    it('falls back to Genkit conservatively on unknown errors', async () => {
        setMode(mode);
        mockCallSidecarReply.mockRejectedValue(new Error('Some weird new error'));
        mockGenerateAgentReply.mockResolvedValue(GENKIT_REPLY);

        const out = await dispatchParentCallReply(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(mockGenerateAgentReply).toHaveBeenCalledTimes(1);
    });

    it('surfaces a Genkit-fallback failure so the route lands the safe wrap-up', async () => {
        setMode(mode);
        mockCallSidecarReply.mockRejectedValue(new SidecarTimeoutError(3500));
        mockGenerateAgentReply.mockRejectedValue(new Error('Genkit also failed'));

        await expect(dispatchParentCallReply(BASE_INPUT)).rejects.toThrow('Genkit also failed');
    });
});

// ── decision plumbing ──────────────────────────────────────────────────────

describe('dispatchParentCallReply — decision plumbing', () => {
    it('passes the dispatch decision through to the caller', async () => {
        mockDecideDispatch.mockResolvedValue({
            mode: 'off',
            reason: 'flag_off',
            bucket: 17,
        });
        mockGenerateAgentReply.mockResolvedValue(GENKIT_REPLY);

        const out = await dispatchParentCallReply(BASE_INPUT);

        expect(out.decision.mode).toBe('off');
        expect(out.decision.reason).toBe('flag_off');
        expect(out.decision.bucket).toBe(17);
    });

    it('uses callSid (not turnNumber) as the bucket input', async () => {
        // Just verifies the decideDispatch call sees the callSid;
        // the percent-bucket math itself lives in feature-flags.test
        // (TODO when those tests land).
        mockDecideDispatch.mockResolvedValue({ mode: 'off', reason: 'r', bucket: 0 });
        mockGenerateAgentReply.mockResolvedValue(GENKIT_REPLY);

        await dispatchParentCallReply(BASE_INPUT);

        expect(mockDecideDispatch).toHaveBeenCalledWith('CAtest1234');
    });
});

// ── Wave 5 fix 2: dispatcher robustness ─────────────────────────────────────

describe('dispatchParentCallReply — robustness paths', () => {
    it('falls back to off mode when decideParentCallDispatch rejects', async () => {
        // Round-2 audit P0 DECIDE-1 regression: a Firestore stall must
        // fail safe to off, never block the call.
        mockDecideDispatch.mockRejectedValue(new Error('Firestore unreachable'));
        mockGenerateAgentReply.mockResolvedValue(GENKIT_REPLY);

        const out = await dispatchParentCallReply(BASE_INPUT);

        // Verifies the fallback mode is off + reason mentions failure.
        expect(out.decision.mode).toBe('off');
        expect(out.decision.reason).toBe('decide_failed');
        expect(out.source).toBe('genkit');
        expect(out.reply).toBe(GENKIT_REPLY.reply);
        // Sidecar never called because decision was off.
        expect(mockCallSidecarReply).not.toHaveBeenCalled();
    });

    it('falls back to off mode when decideParentCallDispatch hangs (1.5s race)', async () => {
        // Use real timers + fake timers to verify the timeout actually fires.
        jest.useFakeTimers();
        try {
            // decideDispatch never resolves — must time out.
            mockDecideDispatch.mockImplementation(() => new Promise(() => {}));
            mockGenerateAgentReply.mockResolvedValue(GENKIT_REPLY);

            const promise = dispatchParentCallReply(BASE_INPUT);
            // Advance past the 1.5s ceiling.
            await jest.advanceTimersByTimeAsync(1_600);

            const out = await promise;
            expect(out.decision.mode).toBe('off');
            expect(out.decision.reason).toBe('decide_failed');
        } finally {
            jest.useRealTimers();
        }
    });

    it('rethrows AbortError from runGenkitSafe (off mode)', async () => {
        // Round-2 audit P0 ABORT-1 regression: AbortError on the
        // Genkit path must propagate, not be swallowed into a phantom
        // reply on a dead Twilio connection.
        setMode('off');
        const abort = new Error('aborted');
        abort.name = 'AbortError';
        mockGenerateAgentReply.mockRejectedValue(abort);

        await expect(dispatchParentCallReply(BASE_INPUT)).rejects.toThrow('aborted');
        await expect(dispatchParentCallReply(BASE_INPUT)).rejects.toMatchObject({
            name: 'AbortError',
        });
    });

    it('rethrows AbortError from runSidecarSafe (canary mode)', async () => {
        // Round-2 audit P0 ABORT-1 regression on the sidecar path.
        setMode('canary');
        const abort = new Error('aborted');
        abort.name = 'AbortError';
        mockCallSidecarReply.mockRejectedValue(abort);

        await expect(dispatchParentCallReply(BASE_INPUT)).rejects.toThrow('aborted');
        // Critical: Genkit fallback NOT invoked on AbortError — caller
        // already gave up, no point doing more work.
        expect(mockGenerateAgentReply).not.toHaveBeenCalled();
    });

    it('handles 50 concurrent dispatches without mock state bleed', async () => {
        // Smoke test the dispatcher under concurrent load. Real Cloud
        // Run will hit this regularly. Each call should resolve with
        // its own decision attached.
        setMode('off');
        mockGenerateAgentReply.mockResolvedValue(GENKIT_REPLY);

        const promises = Array.from({ length: 50 }, (_, i) =>
            dispatchParentCallReply({ ...BASE_INPUT, callSid: `CAtest${i}` }),
        );
        const results = await Promise.all(promises);

        expect(results).toHaveLength(50);
        for (const r of results) {
            expect(r.source).toBe('genkit');
            expect(r.reply).toBe(GENKIT_REPLY.reply);
        }
        expect(mockGenerateAgentReply).toHaveBeenCalledTimes(50);
    });
});
