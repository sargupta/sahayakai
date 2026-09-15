/**
 * @jest-environment node
 *
 * Module-load env parsing for the two Phase-1 degeneration/latency guards
 * (exam-paper-generator.ts:325-390): `EXAM_PAPER_THINKING_BUDGET` and
 * `EXAM_PAPER_MAX_OUTPUT_TOKENS`. Both share the same three-way parse — unset
 * -> default, `''`/`off`/`unbounded` -> uncapped, a numeric string -> that
 * cap, anything else -> falls back to the default — and both are read ONCE
 * at module load into `examPaperGeneratorPrompt`'s `config`. Each case below
 * needs its own `jest.resetModules()` + re-`require()` cycle to re-evaluate
 * that module-load parsing under a different env value.
 */

const ORIGINAL_ENV = { ...process.env };
const ENV_KEYS = ['EXAM_PAPER_THINKING_BUDGET', 'EXAM_PAPER_MAX_OUTPUT_TOKENS'] as const;

afterEach(() => {
    for (const k of ENV_KEYS) {
        if (ORIGINAL_ENV[k] === undefined) delete process.env[k];
        else process.env[k] = ORIGINAL_ENV[k];
    }
});

/** Fresh-load the generator module under the given env overrides and return
 *  the `config` object passed to `ai.definePrompt` for the main prompt. */
function loadPromptConfig(envOverrides: Partial<Record<typeof ENV_KEYS[number], string>>) {
    jest.resetModules();
    for (const k of ENV_KEYS) {
        const v = envOverrides[k];
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }

    jest.doMock('@/ai/genkit', () => {
        const flowSpy = jest.fn();
        const promptSpy = jest.fn();
        return {
            __flowSpy: flowSpy,
            __promptSpy: promptSpy,
            ai: {
                definePrompt: jest.fn(() => promptSpy),
                defineFlow: (_config: unknown, fn: (input: unknown) => unknown) => {
                    flowSpy.mockImplementation(fn as (input: unknown) => unknown);
                    return flowSpy;
                },
                generate: jest.fn(),
            },
            runResiliently: jest.fn(async (fn: (cfg: unknown) => unknown) => fn({ config: {} })),
        };
    });
    jest.doMock('@/ai/soul', () => ({ SAHAYAK_SOUL_PROMPT: '', STRUCTURED_OUTPUT_OVERRIDE: '' }));
    jest.doMock('@/lib/feature-flags', () => ({ isFeatureEnabled: jest.fn(async () => ({ enabled: false })) }));
    jest.doMock('@/lib/ncert/validate-chapter', () => ({ validateChapterForFlow: jest.fn(() => null) }));
    jest.doMock('@/lib/firebase-admin', () => ({ getStorageInstance: jest.fn() }));
    jest.doMock('@/lib/logger/structured-logger', () => ({
        StructuredLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(() => 'error-id') },
    }));
    jest.doMock('@/lib/services/pyq-retrieval-service', () => ({ getPYQsByChapter: jest.fn().mockResolvedValue([]) }));

    // require (not import) so this runs AFTER the env is set above — module-load
    // side effect defines examPaperGeneratorPrompt via ai.definePrompt(...).
    require('@/ai/flows/exam-paper-generator');

    const { ai } = jest.requireMock('@/ai/genkit') as { ai: { definePrompt: jest.Mock } };
    return ai.definePrompt.mock.calls[0][0].config as Record<string, unknown>;
}

describe('exam-paper-generator: EXAM_PAPER_THINKING_BUDGET parsing', () => {
    it('defaults to a 1024-token thinking cap when unset', () => {
        const config = loadPromptConfig({});
        expect(config.thinkingConfig).toEqual({ thinkingBudget: 1024 });
    });

    it('"off" disables the thinking cap entirely (unbounded, pre-Phase-1 behavior)', () => {
        const config = loadPromptConfig({ EXAM_PAPER_THINKING_BUDGET: 'off' });
        expect(config.thinkingConfig).toBeUndefined();
    });

    it('"unbounded" also disables the cap', () => {
        const config = loadPromptConfig({ EXAM_PAPER_THINKING_BUDGET: 'unbounded' });
        expect(config.thinkingConfig).toBeUndefined();
    });

    it('a numeric string sets that exact cap', () => {
        const config = loadPromptConfig({ EXAM_PAPER_THINKING_BUDGET: '2048' });
        expect(config.thinkingConfig).toEqual({ thinkingBudget: 2048 });
    });

    it('0 is a valid cap (thinking off via a numeric zero, distinct from "off")', () => {
        const config = loadPromptConfig({ EXAM_PAPER_THINKING_BUDGET: '0' });
        expect(config.thinkingConfig).toEqual({ thinkingBudget: 0 });
    });

    it('an unparseable value falls back to the 1024 default', () => {
        const config = loadPromptConfig({ EXAM_PAPER_THINKING_BUDGET: 'banana' });
        expect(config.thinkingConfig).toEqual({ thinkingBudget: 1024 });
    });
});

describe('exam-paper-generator: EXAM_PAPER_MAX_OUTPUT_TOKENS parsing', () => {
    it('defaults to a 24000-token output ceiling when unset', () => {
        const config = loadPromptConfig({});
        expect(config.maxOutputTokens).toBe(24000);
        // The newline-runaway stop-sequence guard is unconditional either way.
        expect(config.stopSequences).toEqual(['\n\n\n\n\n\n']);
    });

    it('"unbounded" removes the output ceiling (stop-sequence guard still present)', () => {
        const config = loadPromptConfig({ EXAM_PAPER_MAX_OUTPUT_TOKENS: 'unbounded' });
        expect(config.maxOutputTokens).toBeUndefined();
        expect(config.stopSequences).toEqual(['\n\n\n\n\n\n']);
    });

    it('a numeric string sets that exact ceiling', () => {
        const config = loadPromptConfig({ EXAM_PAPER_MAX_OUTPUT_TOKENS: '5000' });
        expect(config.maxOutputTokens).toBe(5000);
    });

    it('an unparseable value falls back to the 24000 default', () => {
        const config = loadPromptConfig({ EXAM_PAPER_MAX_OUTPUT_TOKENS: 'banana' });
        expect(config.maxOutputTokens).toBe(24000);
    });
});
