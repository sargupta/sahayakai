/**
 * @jest-environment node
 *
 * NCERT-demo 2026-05-19 regression: pins the profile-language-fallback
 * contract in `generateLessonPlan`.
 *
 * Before the fix, `if (profile?.preferredLanguage && !input.language)`
 * fired on empty strings as well as undefined/null. That meant a form
 * which forgot to forward its dropdown value (or sent `language: ""`)
 * silently switched the output to whatever was stored on
 * `profile.preferredLanguage` — even though the teacher's dropdown
 * showed something else. The OmniOrb supervisor used to write voice-
 * detected language into the profile, so an English form was generating
 * Hindi output.
 *
 * After the fix:
 *   1. Form ALWAYS sends a non-empty language string (verified in the
 *      hook test file).
 *   2. Server fallback ONLY fires when `input.language` is truly
 *      undefined / null. An empty string is NOT enough — it surfaces
 *      to the model as-is and is caught by the language-lock prompt
 *      contract.
 *
 * This file pins (2). We test the in-process contract; no Gemini calls.
 */

// ── Mocks (must come before importing the SUT) ─────────────────────────────
// Jest hoists `jest.mock(...)` calls above all imports and `const`
// declarations, so we cannot close over module-level vars from inside
// the factory. Instead, the genkit mock factory creates the spy itself
// and we read it back via `jest.requireMock` after the SUT loads.

jest.mock('@/lib/db/adapter', () => ({
    dbAdapter: { getUser: jest.fn() },
}));

jest.mock('@/lib/teacher-context', () => ({
    getTeacherContextLine: jest.fn(async () => ''),
}));

jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: jest.fn(async () => undefined),
}));

jest.mock('@/lib/safety', () => ({
    validateTopicSafety: jest.fn().mockReturnValue({ safe: true }),
}));

// Mock the genkit `ai` so flow/prompt definitions don't try to wire up
// real models. The mock captures the flow handler so we can observe the
// input that `generateLessonPlan` passes to `lessonPlanFlow`. The factory
// also exposes the captured flow on the module export so the test body
// can reach it after the SUT registers its flow.
jest.mock('@/ai/genkit', () => {
    const flowSpy = jest.fn();
    return {
        __flowSpy: flowSpy,
        ai: {
            definePrompt: jest.fn(() => ({})),
            defineFlow: (_config: unknown, fn: (input: unknown) => unknown) => {
                flowSpy.mockImplementation(fn as (input: unknown) => unknown);
                return flowSpy;
            },
            generate: jest.fn(),
        },
        runResiliently: jest.fn(async (fn: (cfg: unknown) => unknown) => fn({ config: {} })),
    };
});

// Stub the soul prompts and other heavy imports lesson-plan-generator pulls in.
jest.mock('@/ai/soul', () => ({
    SAHAYAK_SOUL_PROMPT: '',
    STRUCTURED_OUTPUT_OVERRIDE: '',
}));

jest.mock('@/lib/indian-context', () => ({
    getIndianContextPrompt: () => '',
    renderRegionalContextBlock: () => '',
}));

jest.mock('@/lib/lesson-plan-cache', () => ({
    generateLessonPlanCacheKey: () => 'k',
    getCachedLessonPlan: jest.fn().mockResolvedValue(null),
    setCachedLessonPlan: jest.fn(),
}));

jest.mock('@/lib/firebase-admin', () => ({
    getStorageInstance: jest.fn(),
}));

jest.mock('@/lib/usage-tracker', () => ({
    UsageTracker: jest.fn(),
}));

jest.mock('@/lib/grade-utils', () => ({
    extractGradeFromTopic: () => null,
}));

// ── Import SUT AFTER mocks ─────────────────────────────────────────────────

import { generateLessonPlan } from '@/ai/flows/lesson-plan-generator';
import { dbAdapter } from '@/lib/db/adapter';

const flowSpy = (jest.requireMock('@/ai/genkit') as { __flowSpy: jest.Mock }).__flowSpy;

describe('lesson-plan-generator: profile-language fallback (NCERT-demo regression)', () => {
    const mockGetUser = dbAdapter.getUser as jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        // Default: the flow returns a minimal valid output. Tests assert
        // *what was passed in* via flowSpy.mock.calls.
        flowSpy.mockResolvedValue({
            title: 'Mock Plan',
            objectives: ['o1'],
            materials: ['m1'],
            activities: [],
        });
    });

    it('honours an explicit language even when profile.preferredLanguage differs (the demo bug)', async () => {
        mockGetUser.mockResolvedValue({ preferredLanguage: 'Hindi' });

        await generateLessonPlan({
            topic: 'Chapter 2',
            language: 'en',
            gradeLevels: ['Class 7'],
            subject: 'Science',
            userId: 'teacher-1',
        });

        expect(flowSpy).toHaveBeenCalledWith(
            expect.objectContaining({ language: 'en' }),
        );
    });

    it('does NOT silently override an explicit empty-string language with the profile language', async () => {
        // After the fix, an empty string is treated as "the caller said
        // something — respect it" (the language-lock prompt handles bad
        // input). Before the fix, `!input.language` was truthy here and
        // we leaked the profile value.
        mockGetUser.mockResolvedValue({ preferredLanguage: 'Hindi' });

        await generateLessonPlan({
            topic: 'Chapter 2',
            language: '',
            gradeLevels: ['Class 7'],
            subject: 'Science',
            userId: 'teacher-1',
        });

        expect(flowSpy).toHaveBeenCalledWith(
            expect.objectContaining({ language: '' }),
        );
    });

    it('falls back to profile.preferredLanguage only when language is truly undefined', async () => {
        // Legacy server-side callers (cron jobs, scripts) may genuinely
        // omit the field. Keep the safety net for them.
        mockGetUser.mockResolvedValue({ preferredLanguage: 'Hindi' });

        await generateLessonPlan({
            topic: 'Chapter 2',
            gradeLevels: ['Class 7'],
            subject: 'Science',
            userId: 'teacher-1',
        });

        expect(flowSpy).toHaveBeenCalledWith(
            expect.objectContaining({ language: 'Hindi' }),
        );
    });

    it('falls back to profile.preferredLanguage only when language is null', async () => {
        mockGetUser.mockResolvedValue({ preferredLanguage: 'Hindi' });

        await generateLessonPlan({
            topic: 'Chapter 2',
            language: null as unknown as undefined,
            gradeLevels: ['Class 7'],
            subject: 'Science',
            userId: 'teacher-1',
        });

        expect(flowSpy).toHaveBeenCalledWith(
            expect.objectContaining({ language: 'Hindi' }),
        );
    });
});
