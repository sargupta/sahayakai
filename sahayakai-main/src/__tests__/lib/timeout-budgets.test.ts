/**
 * Timeout-budget tests for the five at-risk LLM dispatchers
 * (NCERT demo hot-fix, 2026-05-19).
 *
 * Each dispatcher's `FALLBACK_TIMEOUT_MS` is read once at module load
 * from `process.env.<NAME>_TIMEOUT_MS` (or the new default). The tests
 * below pin the env var, dynamically import the dispatcher so the
 * module-load read picks up the override, then assert:
 *
 *   1. The dispatch resolves when the underlying flow takes
 *      `default - 1000` ms.
 *   2. The dispatch times out when the underlying flow takes
 *      `default + 5000` ms.
 *
 * `withTimeout` uses `setTimeout`, so fake timers give us deterministic
 * timing without burning wall-clock seconds (a real 60s + 5s quiz test
 * would gum up CI).
 *
 * Each flow's Genkit function is mocked to return a promise that
 * resolves after a controlled delay; the sidecar client is mocked so
 * the off-mode path runs straight through `withTimeout(...flow)`.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { jest } from '@jest/globals';

// Helper: create a promise that resolves after `delayMs` advanced fake
// time. We schedule the resolve inside a fake setTimeout so
// `jest.advanceTimersByTime` drives both the work and the withTimeout
// race deterministically.
function delayedResolve<T>(value: T, delayMs: number): Promise<T> {
    return new Promise<T>((resolve) => {
        setTimeout(() => resolve(value), delayMs);
    });
}

// Shared mock factories — replicate the existing dispatch tests'
// synthetic error classes so the sidecar-client `instanceof` checks
// in dispatchers still work.
function makeRubricClientMock() {
    class RubricSidecarConfigError extends Error {
        constructor(m: string) { super(m); this.name = 'RubricSidecarConfigError'; }
    }
    class RubricSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) { super(`timeout ${elapsedMs}`); this.name = 'RubricSidecarTimeoutError'; this.elapsedMs = elapsedMs; }
    }
    class RubricSidecarHttpError extends Error {
        readonly status: number; readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) { super(`http ${status}`); this.name = 'RubricSidecarHttpError'; this.status = status; this.bodyExcerpt = bodyExcerpt; }
    }
    class RubricSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) { super(`behavioural ${axisHint} ${details}`); this.name = 'RubricSidecarBehaviouralError'; this.axisHint = axisHint; }
    }
    return { callSidecarRubric: jest.fn(), RubricSidecarConfigError, RubricSidecarTimeoutError, RubricSidecarHttpError, RubricSidecarBehaviouralError };
}

function makeTeacherTrainingClientMock() {
    class TeacherTrainingSidecarConfigError extends Error {
        constructor(m: string) { super(m); this.name = 'TeacherTrainingSidecarConfigError'; }
    }
    class TeacherTrainingSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) { super(`timeout ${elapsedMs}`); this.name = 'TeacherTrainingSidecarTimeoutError'; this.elapsedMs = elapsedMs; }
    }
    class TeacherTrainingSidecarHttpError extends Error {
        readonly status: number; readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) { super(`http ${status}`); this.name = 'TeacherTrainingSidecarHttpError'; this.status = status; this.bodyExcerpt = bodyExcerpt; }
    }
    class TeacherTrainingSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) { super(`behavioural ${axisHint} ${details}`); this.name = 'TeacherTrainingSidecarBehaviouralError'; this.axisHint = axisHint; }
    }
    return { callSidecarTeacherTraining: jest.fn(), TeacherTrainingSidecarConfigError, TeacherTrainingSidecarTimeoutError, TeacherTrainingSidecarHttpError, TeacherTrainingSidecarBehaviouralError };
}

function makeQuizClientMock() {
    class QuizSidecarConfigError extends Error {
        constructor(m: string) { super(m); this.name = 'QuizSidecarConfigError'; }
    }
    class QuizSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) { super(`timeout ${elapsedMs}`); this.name = 'QuizSidecarTimeoutError'; this.elapsedMs = elapsedMs; }
    }
    class QuizSidecarHttpError extends Error {
        readonly status: number; readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) { super(`http ${status}`); this.name = 'QuizSidecarHttpError'; this.status = status; this.bodyExcerpt = bodyExcerpt; }
    }
    class QuizSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) { super(`behavioural ${axisHint} ${details}`); this.name = 'QuizSidecarBehaviouralError'; this.axisHint = axisHint; }
    }
    return { callSidecarQuiz: jest.fn(), QuizSidecarConfigError, QuizSidecarTimeoutError, QuizSidecarHttpError, QuizSidecarBehaviouralError };
}

function makeVideoStorytellerClientMock() {
    class VideoStorytellerSidecarConfigError extends Error {
        constructor(m: string) { super(m); this.name = 'VideoStorytellerSidecarConfigError'; }
    }
    class VideoStorytellerSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) { super(`timeout ${elapsedMs}`); this.name = 'VideoStorytellerSidecarTimeoutError'; this.elapsedMs = elapsedMs; }
    }
    class VideoStorytellerSidecarHttpError extends Error {
        readonly status: number; readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) { super(`http ${status}`); this.name = 'VideoStorytellerSidecarHttpError'; this.status = status; this.bodyExcerpt = bodyExcerpt; }
    }
    class VideoStorytellerSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) { super(`behavioural ${axisHint} ${details}`); this.name = 'VideoStorytellerSidecarBehaviouralError'; this.axisHint = axisHint; }
    }
    return { callSidecarVideoStoryteller: jest.fn(), VideoStorytellerSidecarConfigError, VideoStorytellerSidecarTimeoutError, VideoStorytellerSidecarHttpError, VideoStorytellerSidecarBehaviouralError };
}

function makeInstantAnswerClientMock() {
    class InstantAnswerSidecarConfigError extends Error {
        constructor(m: string) { super(m); this.name = 'InstantAnswerSidecarConfigError'; }
    }
    class InstantAnswerSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) { super(`timeout ${elapsedMs}`); this.name = 'InstantAnswerSidecarTimeoutError'; this.elapsedMs = elapsedMs; }
    }
    class InstantAnswerSidecarHttpError extends Error {
        readonly status: number; readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) { super(`http ${status}`); this.name = 'InstantAnswerSidecarHttpError'; this.status = status; this.bodyExcerpt = bodyExcerpt; }
    }
    class InstantAnswerSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) { super(`behavioural ${axisHint} ${details}`); this.name = 'InstantAnswerSidecarBehaviouralError'; this.axisHint = axisHint; }
    }
    return { callSidecarInstantAnswer: jest.fn(), InstantAnswerSidecarConfigError, InstantAnswerSidecarTimeoutError, InstantAnswerSidecarHttpError, InstantAnswerSidecarBehaviouralError };
}

// Hoisted mocks (jest hoists `jest.mock` calls — they run before the
// imports below). Each dispatcher's Genkit flow + sidecar client is
// replaced with a stub.

jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(async () => ({})),
}));

jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: jest.fn(async () => undefined),
}));

jest.mock('@/lib/sidecar/persist-helpers', () => ({
    persistSidecarJSON: jest.fn(async () => null),
}));

jest.mock('@/lib/sidecar/shadow-diff-writer', () => ({
    writeAgentShadowDiff: jest.fn(),
}));

jest.mock('@/ai/flows/rubric-generator', () => ({
    generateRubric: jest.fn(),
}));

jest.mock('@/ai/flows/teacher-training', () => ({
    getTeacherTrainingAdvice: jest.fn(),
}));

jest.mock('@/ai/flows/quiz-generator', () => ({
    generateQuiz: jest.fn(),
}));

jest.mock('@/ai/flows/video-storyteller', () => ({
    getVideoRecommendations: jest.fn(),
    getVideoCategorySearchResults: jest.fn(),
}));

jest.mock('@/ai/flows/instant-answer', () => ({
    instantAnswer: jest.fn(),
}));

jest.mock('@/lib/sidecar/rubric-client', () => makeRubricClientMock());
jest.mock('@/lib/sidecar/teacher-training-client', () => makeTeacherTrainingClientMock());
jest.mock('@/lib/sidecar/quiz-client', () => makeQuizClientMock());
jest.mock('@/lib/sidecar/video-storyteller-client', () => makeVideoStorytellerClientMock());
jest.mock('@/lib/sidecar/instant-answer-client', () => makeInstantAnswerClientMock());

// We resolve the Genkit-flow mocks lazily inside each test (via
// `require(...)`) because the `jest.mock` factories above are hoisted
// but the `import { generateRubric } from ...` form in some Next/SWC
// transforms binds to a getter that does not surface the jest.fn()
// instance synchronously at top level. `require` always hits the
// mocked module's `module.exports` object.
import { WithTimeoutError } from '@/lib/sidecar/with-timeout';

function mockForFlow(modulePath: string, exportName: string): jest.Mock {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(modulePath);
    const fn = mod[exportName];
    if (typeof fn?.mockReturnValue !== 'function') {
        throw new Error(
            `Expected ${modulePath}#${exportName} to be a jest.Mock, got ${typeof fn}. ` +
            `jest.mock() factory may not have hoisted correctly.`,
        );
    }
    return fn as jest.Mock;
}

// Minimal valid outputs — the dispatch wraps them, the shape is only
// checked for `source` so we keep the payload tiny.
const RUBRIC_OUT: any = {
    title: 't', description: 'd', criteria: [], gradeLevel: 'Class 5', subject: 'Science',
};
const TT_OUT: any = {
    introduction: 'i', advice: [], conclusion: 'c', gradeLevel: 'Class 5', subject: 'Science',
};
const QUIZ_OUT: any = {
    easy: { title: 'e', questions: [], gradeLevel: 'Class 5', subject: 'Science' },
    medium: null,
    hard: null,
    topic: 't', gradeLevel: 'Class 5', subject: 'Science',
};
const VS_OUT: any = {
    categories: { pedagogy: [], storytelling: [], govtUpdates: [], courses: [], topRecommended: [] },
    personalizedMessage: '', categorizedVideos: {}, fromCache: false, latencyScore: 0,
};
const IA_OUT: any = {
    answer: 'a', videoSuggestionUrl: null, gradeLevel: 'Class 5', subject: 'Science',
};

// Each entry: (flow, default budget, dispatcher path, dispatch input,
// Genkit flow module + export, success output).
//
// The default values match the post-bump constants in the dispatcher
// source. We intentionally do NOT pin the env var to keep the test
// honest: changing the source default without updating the test will
// surface here.
const FIVE_FLOWS = [
    {
        name: 'rubric',
        defaultMs: 30_000,
        dispatcherPath: '@/lib/sidecar/rubric-dispatch',
        exportName: 'dispatchRubric',
        flowModulePath: '@/ai/flows/rubric-generator',
        flowExportName: 'generateRubric',
        input: { assignmentDescription: 't', userId: 'u' },
        output: RUBRIC_OUT,
    },
    {
        name: 'teacher-training',
        defaultMs: 25_000,
        dispatcherPath: '@/lib/sidecar/teacher-training-dispatch',
        exportName: 'dispatchTeacherTraining',
        flowModulePath: '@/ai/flows/teacher-training',
        flowExportName: 'getTeacherTrainingAdvice',
        input: { question: 'q', userId: 'u' },
        output: TT_OUT,
    },
    {
        name: 'quiz',
        defaultMs: 60_000,
        dispatcherPath: '@/lib/sidecar/quiz-dispatch',
        exportName: 'dispatchQuiz',
        flowModulePath: '@/ai/flows/quiz-generator',
        flowExportName: 'generateQuiz',
        input: { topic: 't', numQuestions: 1, questionTypes: ['multiple_choice'], userId: 'u' },
        output: QUIZ_OUT,
    },
    {
        name: 'video-storyteller',
        defaultMs: 30_000,
        dispatcherPath: '@/lib/sidecar/video-storyteller-dispatch',
        exportName: 'dispatchVideoStoryteller',
        flowModulePath: '@/ai/flows/video-storyteller',
        flowExportName: 'getVideoRecommendations',
        input: { subject: 'Science', gradeLevel: 'Class 5', userId: 'u' },
        output: VS_OUT,
    },
    {
        name: 'instant-answer',
        defaultMs: 20_000,
        dispatcherPath: '@/lib/sidecar/instant-answer-dispatch',
        exportName: 'dispatchInstantAnswer',
        flowModulePath: '@/ai/flows/instant-answer',
        flowExportName: 'instantAnswer',
        input: { question: 'q', userId: 'u' },
        output: IA_OUT,
    },
] as const;

beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
});

describe.each(FIVE_FLOWS)(
    '$name dispatcher timeout budget',
    ({ defaultMs, dispatcherPath, exportName, flowModulePath, flowExportName, input, output }) => {
        it(`resolves when the flow takes ${defaultMs - 1000}ms (default - 1000)`, async () => {
            const flowDelayMs = defaultMs - 1000;
            const mock = mockForFlow(flowModulePath, flowExportName);
            mock.mockReturnValue(delayedResolve(output, flowDelayMs));

            // Dynamic import so the dispatcher's `process.env.<NAME>_TIMEOUT_MS`
            // module-load read picks up whatever the current env says (we
            // don't pin it — we want the default).
            const mod: any = await import(dispatcherPath);
            const dispatch = mod[exportName] as (i: any) => Promise<any>;

            const promise = dispatch(input);

            // Drive the fake clock past the flow delay but well under the
            // timeout budget.
            await jest.advanceTimersByTimeAsync(flowDelayMs + 10);

            const result = await promise;
            expect(result).toBeDefined();
            // The dispatcher's off-mode tags the source as 'genkit' (the
            // sidecar client was never called because the feature flag is
            // off in our default mock).
            expect(['genkit', 'sidecar', 'genkit_fallback']).toContain(result.source);
        });

        it(`times out when the flow takes ${defaultMs + 5000}ms (default + 5000)`, async () => {
            const flowDelayMs = defaultMs + 5000;
            const mock = mockForFlow(flowModulePath, flowExportName);
            mock.mockReturnValue(delayedResolve(output, flowDelayMs));

            const mod: any = await import(dispatcherPath);
            const dispatch = mod[exportName] as (i: any) => Promise<any>;

            const promise = dispatch(input);

            // We expect the dispatcher to throw once the timeout budget
            // elapses — assert on the rejection inside a single race
            // (advance + await).
            const assertion = expect(promise).rejects.toBeInstanceOf(WithTimeoutError);

            // Drive the fake clock past the budget so the withTimeout race
            // resolves with the rejection. We also need the underlying
            // delayedResolve to still be pending, hence we DO NOT advance
            // past `flowDelayMs` — only past `defaultMs`.
            await jest.advanceTimersByTimeAsync(defaultMs + 100);

            await assertion;
        });
    },
);
