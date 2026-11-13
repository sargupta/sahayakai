/**
 * @jest-environment node
 *
 * Class gate (2026-11-13, reproduced on the emulator): a retry inside an AI
 * call must never outlive the timeout its caller is wrapped in.
 *
 * VIDYA's reply runs inside the dispatcher's 15 s `withTimeout`. A Vertex 429
 * made `runResiliently` start its single-key 20–40 s quota wait, so the
 * teacher got `WithTimeoutError` → 500 ("vidya genkit fallback timed out
 * after 15002ms") while the orphaned retry kept spending quota.
 *
 * These tests run the REAL `runResiliently`; only the model call is faked.
 * A change to the retry strategy that lets a wait outrun the caller fails
 * here, whichever flow it is in.
 */

import fs from 'fs';
import path from 'path';

// ── Mocks (before importing the code under test) ───────────────────────────

const mockGenerate = jest.fn();
jest.mock('genkit', () => ({
    // Lazy arrow: `mockGenerate` is read at call time, not at mock time.
    genkit: () => ({ generate: (...args: unknown[]) => mockGenerate(...args) }),
}));
jest.mock('@genkit-ai/googleai', () => ({ googleAI: () => ({}) }));
jest.mock('@genkit-ai/google-genai', () => ({ vertexAI: () => ({}) }));
jest.mock('@/lib/secrets', () => ({ getSecret: jest.fn() }));
jest.mock('@/lib/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

import { runResiliently, DEFAULT_RETRY_BUDGET_MS } from '@/ai/genkit';
import { MODELS } from '@/ai/models';
import { runGenkitVidya, VIDYA_RETRY_BUDGET_MS } from '@/ai/flows/vidya-assistant';
import { withTimeout } from '@/lib/sidecar/with-timeout';

/** The dispatcher's timeout around the VIDYA reply, read from its source. */
function vidyaDispatchTimeoutMs(): number {
    const src = fs.readFileSync(
        path.join(__dirname, '../../lib/sidecar/vidya-dispatch.ts'),
        'utf8',
    );
    const m = src.match(/const FALLBACK_TIMEOUT_MS = ([\d_]+);/);
    if (!m) {
        throw new Error(
            'FALLBACK_TIMEOUT_MS not found in vidya-dispatch.ts: update this gate to read the new timeout.',
        );
    }
    return Number(m[1].replace(/_/g, ''));
}

/** A Vertex quota error, shaped as the SDK raises it. */
function quota429(): Error {
    return Object.assign(
        new Error('[429 Too Many Requests] RESOURCE_EXHAUSTED: Resource exhausted.'),
        { status: 429 },
    );
}

const replyJson = (response: string) => ({
    text: JSON.stringify({ response, action: null }),
});

/** Settle a promise into a value so fake timers never see an unhandled rejection. */
function settle<T>(p: Promise<T>) {
    return p.then(
        (value) => ({ ok: true as const, value, at: Date.now() }),
        (error: Error) => ({ ok: false as const, error, at: Date.now() }),
    );
}

beforeEach(() => {
    mockGenerate.mockReset();
    jest.useFakeTimers({ now: 0 });
});

afterEach(() => {
    jest.useRealTimers();
});

describe('runResiliently: the retry budget', () => {
    it('never starts a wait that would run past budgetMs', async () => {
        const fn = jest.fn(async () => {
            throw quota429();
        });
        const result = settle(runResiliently(fn, 'test', { budgetMs: 8_000 }));
        await jest.advanceTimersByTimeAsync(60_000);
        const r = await result;

        expect(r.ok).toBe(false);
        expect(!r.ok && r.error.name).toBe('AIQuotaExhaustedError');
        // The single-key quota wait is 15–25 s: more than the budget, so it
        // is skipped and the typed error comes straight back.
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('keeps the long single-key quota wait when the caller has room', async () => {
        let calls = 0;
        const fn = jest.fn(async () => {
            calls++;
            if (calls === 1) throw quota429();
            return 'ok';
        });
        const result = settle(runResiliently(fn, 'test'));
        await jest.advanceTimersByTimeAsync(DEFAULT_RETRY_BUDGET_MS);
        const r = await result;

        expect(r).toMatchObject({ ok: true, value: 'ok' });
        expect(fn).toHaveBeenCalledTimes(2);
    });

    it('always makes the first attempt, even with no budget left', async () => {
        const fn = jest.fn(async () => 'ok');
        await expect(runResiliently(fn, 'test', { budgetMs: 0 })).resolves.toBe('ok');
    });
});

describe('VIDYA reply: always answers or fails cleanly inside the dispatcher timeout', () => {
    const timeoutMs = vidyaDispatchTimeoutMs();

    it('leaves room in the dispatcher timeout for the retry budget plus a last model call', () => {
        // ~5 s covers one no-thinking reply on the lite model.
        expect(VIDYA_RETRY_BUDGET_MS + 5_000).toBeLessThanOrEqual(timeoutMs);
    });

    it('answers with the lite model when the main model is out of quota', async () => {
        mockGenerate.mockImplementation(async (req: { model: string }) => {
            if (req.model === MODELS.flash) throw quota429();
            return replyJson('Opening the quiz maker.');
        });

        const result = settle(
            withTimeout(
                runGenkitVidya({ message: 'quiz on fractions for class 5' }),
                timeoutMs,
                'vidya genkit fallback',
            ),
        );
        await jest.advanceTimersByTimeAsync(timeoutMs);
        const r = await result;

        expect(r.ok && r.value.response).toBe('Opening the quiz maker.');
        expect(mockGenerate.mock.calls.map(([req]) => req.model)).toEqual([
            MODELS.flash,
            MODELS.flashLite,
        ]);
    });

    it('returns the typed quota error, not a timeout, when both models are out of quota', async () => {
        mockGenerate.mockImplementation(async () => {
            throw quota429();
        });

        const result = settle(
            withTimeout(
                runGenkitVidya({ message: 'quiz on fractions for class 5' }),
                timeoutMs,
                'vidya genkit fallback',
            ),
        );
        await jest.advanceTimersByTimeAsync(timeoutMs);
        const r = await result;

        expect(r.ok).toBe(false);
        // AIQuotaExhaustedError → a clean 503 + Retry-After at the route;
        // WithTimeoutError was the 500 the teacher saw.
        expect(!r.ok && r.error.name).toBe('AIQuotaExhaustedError');
        expect(r.at).toBeLessThan(timeoutMs);
    });

    it('asks the model for its reply without thinking', async () => {
        mockGenerate.mockResolvedValue(replyJson('Namaste!'));

        await runGenkitVidya({ message: 'hello' });

        // Thinking made replies take 4.5–11 s against the 15 s cap.
        expect(mockGenerate.mock.calls[0][0].config.thinkingConfig).toEqual({
            thinkingBudget: 0,
        });
    });
});
