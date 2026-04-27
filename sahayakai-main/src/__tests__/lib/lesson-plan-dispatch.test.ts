/**
 * Unit tests for the lesson-plan sidecar dispatcher (Phase 3 §3.4).
 *
 * Covers off / shadow / canary / full branching with mocked Genkit +
 * sidecar paths (no network).
 *
 * The matrix:
 *
 *   mode      sidecar OK      sidecar transport err   sidecar behavioural
 *   ─────────────────────────────────────────────────────────────────────
 *   off       (not called)    (not called)            (not called)
 *   shadow    Genkit serves   Genkit serves           Genkit serves
 *   canary    sidecar serves  Genkit fallback         Genkit fallback ★
 *   full      sidecar serves  Genkit fallback         Genkit fallback ★
 *
 * ★ Behavioural-fail falls back here, unlike parent-call. The Genkit
 * lesson-plan flow has its own (different) guard rules so the two
 * paths are not redundant. Caller still gets *some* plan.
 */

import type { LessonPlanInput, LessonPlanOutput } from '@/ai/flows/lesson-plan-generator';
import type { LessonPlanSidecarMode } from '@/lib/feature-flags';

// ── Mock setup ─────────────────────────────────────────────────────────────
// Synthetic mocks (no `requireActual`) for the same Jest-can't-parse-pure-ESM
// reasons as `sidecar-dispatch.test.ts`.

jest.mock('@/lib/feature-flags', () => ({
    decideLessonPlanDispatch: jest.fn(),
}));

jest.mock('@/ai/flows/lesson-plan-generator', () => ({
    generateLessonPlan: jest.fn(),
}));

jest.mock('@/lib/sidecar/persist-helpers', () => ({
    persistSidecarJSON: jest.fn(),
}));

const mockCheckRateLimit = jest.fn(async () => undefined);
jest.mock('@/lib/server-safety', () => ({
    checkServerRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
}));

jest.mock('@/lib/sidecar/lesson-plan-client', () => {
    class LessonPlanSidecarConfigError extends Error {
        constructor(message: string) {
            super(message);
            this.name = 'LessonPlanSidecarConfigError';
        }
    }
    class LessonPlanSidecarTimeoutError extends Error {
        readonly elapsedMs: number;
        constructor(elapsedMs: number) {
            super(`Lesson-plan sidecar request timed out after ${elapsedMs}ms`);
            this.name = 'LessonPlanSidecarTimeoutError';
            this.elapsedMs = elapsedMs;
        }
    }
    class LessonPlanSidecarHttpError extends Error {
        readonly status: number;
        readonly bodyExcerpt: string;
        constructor(status: number, bodyExcerpt: string) {
            super(`Lesson-plan sidecar returned HTTP ${status}: ${bodyExcerpt}`);
            this.name = 'LessonPlanSidecarHttpError';
            this.status = status;
            this.bodyExcerpt = bodyExcerpt;
        }
    }
    class LessonPlanSidecarBehaviouralError extends Error {
        readonly axisHint: string;
        constructor(axisHint: string, details: string) {
            super(`Lesson-plan sidecar behavioural guard failed (${axisHint}): ${details}`);
            this.name = 'LessonPlanSidecarBehaviouralError';
            this.axisHint = axisHint;
        }
    }
    return {
        callSidecarLessonPlan: jest.fn(),
        LessonPlanSidecarConfigError,
        LessonPlanSidecarTimeoutError,
        LessonPlanSidecarHttpError,
        LessonPlanSidecarBehaviouralError,
    };
});

// Imports after mocks.
import { generateLessonPlan } from '@/ai/flows/lesson-plan-generator';
import { decideLessonPlanDispatch } from '@/lib/feature-flags';
import { dispatchLessonPlan } from '@/lib/sidecar/lesson-plan-dispatch';
import {
    callSidecarLessonPlan,
    LessonPlanSidecarBehaviouralError,
    LessonPlanSidecarHttpError,
    LessonPlanSidecarTimeoutError,
    type SidecarLessonPlanResponse,
} from '@/lib/sidecar/lesson-plan-client';
import { persistSidecarJSON } from '@/lib/sidecar/persist-helpers';

const mockGenerateLessonPlan = generateLessonPlan as jest.MockedFunction<typeof generateLessonPlan>;
const mockCallSidecar = callSidecarLessonPlan as jest.MockedFunction<typeof callSidecarLessonPlan>;
const mockDecide = decideLessonPlanDispatch as jest.MockedFunction<typeof decideLessonPlanDispatch>;
const mockPersist = persistSidecarJSON as jest.MockedFunction<typeof persistSidecarJSON>;

// ── Fixtures ───────────────────────────────────────────────────────────────

const BASE_INPUT = {
    userId: 'teacher-uid-1',
    topic: 'Photosynthesis',
    language: 'en',
    gradeLevels: ['Class 5'],
    useRuralContext: false,
    resourceLevel: 'low',
} satisfies LessonPlanInput & { userId: string };

const GENKIT_OUTPUT: LessonPlanOutput = {
    title: 'Photosynthesis (Genkit path)',
    gradeLevel: 'Class 5',
    duration: '45 minutes',
    subject: 'Science',
    objectives: ['Identify parts', 'Explain process'],
    keyVocabulary: null,
    materials: ['chart', 'leaves'],
    activities: [
        {
            phase: 'Engage',
            name: 'Riddle',
            description: 'Plant riddle',
            duration: '5 minutes',
            teacherTips: null,
            understandingCheck: null,
        },
    ],
    assessment: 'Quiz',
    homework: 'Draw a plant',
    language: 'en',
};

const SIDECAR_OUTPUT: SidecarLessonPlanResponse = {
    title: 'Photosynthesis (Sidecar path)',
    gradeLevel: 'Class 5',
    duration: '45 minutes',
    subject: 'Science',
    objectives: ['Identify parts', 'Explain process'],
    keyVocabulary: null,
    materials: ['chart', 'leaves', 'magnifying glass'],
    activities: [
        {
            phase: 'Engage',
            name: 'Riddle',
            description: 'Plant riddle from sidecar',
            duration: '5 minutes',
            teacherTips: null,
            understandingCheck: null,
        },
    ],
    assessment: 'Quiz + participation',
    homework: 'Draw and label a plant',
    language: 'en',
    revisionsRun: 0,
    rubric: {
        scores: {
            grade_level_alignment: 0.9,
            objective_assessment_match: 0.9,
            resource_level_realism: 0.9,
            language_naturalness: 0.9,
            scaffolding_present: 0.9,
            inclusion_signals: 0.9,
            cultural_appropriateness: 0.9,
        },
        safety: true,
        rationale: 'all axes high',
        fail_reasons: [],
    },
    sidecarVersion: 'phase-3.1.0',
};

// ── Helpers ────────────────────────────────────────────────────────────────

function setMode(mode: LessonPlanSidecarMode): void {
    mockDecide.mockResolvedValue({
        mode,
        reason: `test_${mode}`,
        bucket: 0,
    });
}

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ── off ────────────────────────────────────────────────────────────────────

describe('dispatchLessonPlan — off mode', () => {
    it('calls Genkit only and never touches the sidecar', async () => {
        setMode('off');
        mockGenerateLessonPlan.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchLessonPlan(BASE_INPUT);

        expect(mockGenerateLessonPlan).toHaveBeenCalledTimes(1);
        expect(mockCallSidecar).not.toHaveBeenCalled();
        expect(out.source).toBe('genkit');
        expect(out.title).toBe(GENKIT_OUTPUT.title);
        expect(out.sidecarTelemetry).toBeUndefined();
    });

    it('surfaces Genkit errors so the route can land the standard error response', async () => {
        setMode('off');
        const err = new Error('Genkit blew up');
        mockGenerateLessonPlan.mockRejectedValue(err);

        await expect(dispatchLessonPlan(BASE_INPUT)).rejects.toThrow(err);
        expect(mockCallSidecar).not.toHaveBeenCalled();
    });
});

// ── shadow ─────────────────────────────────────────────────────────────────

describe('dispatchLessonPlan — shadow mode', () => {
    it('returns the Genkit plan and runs the sidecar in parallel', async () => {
        setMode('shadow');
        mockGenerateLessonPlan.mockResolvedValue(GENKIT_OUTPUT);
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchLessonPlan(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(out.title).toBe(GENKIT_OUTPUT.title);
        expect(mockGenerateLessonPlan).toHaveBeenCalledTimes(1);
        expect(mockCallSidecar).toHaveBeenCalledTimes(1);
        // Sidecar telemetry NOT exposed on shadow — Genkit's plan is
        // shipped as-is.
        expect(out.sidecarTelemetry).toBeUndefined();
    });

    it('still serves Genkit even when the sidecar errors', async () => {
        setMode('shadow');
        mockGenerateLessonPlan.mockResolvedValue(GENKIT_OUTPUT);
        mockCallSidecar.mockRejectedValue(new LessonPlanSidecarTimeoutError(60_000));

        const out = await dispatchLessonPlan(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(out.title).toBe(GENKIT_OUTPUT.title);
    });

    it('throws when Genkit itself fails (sidecar error is irrelevant)', async () => {
        setMode('shadow');
        const err = new Error('Genkit failed');
        mockGenerateLessonPlan.mockRejectedValue(err);
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        await expect(dispatchLessonPlan(BASE_INPUT)).rejects.toThrow(err);
    });
});

// ── canary / full ──────────────────────────────────────────────────────────

describe('dispatchLessonPlan — canary mode (sidecar serves)', () => {
    it('returns the sidecar plan with telemetry attached', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchLessonPlan(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.title).toBe(SIDECAR_OUTPUT.title);
        expect(mockGenerateLessonPlan).not.toHaveBeenCalled();
        expect(out.sidecarTelemetry).toBeDefined();
        expect(out.sidecarTelemetry?.revisionsRun).toBe(0);
        expect(out.sidecarTelemetry?.sidecarVersion).toBe('phase-3.1.0');
    });

    it('falls back to Genkit on sidecar timeout', async () => {
        setMode('canary');
        mockCallSidecar.mockRejectedValue(new LessonPlanSidecarTimeoutError(60_000));
        mockGenerateLessonPlan.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchLessonPlan(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(out.title).toBe(GENKIT_OUTPUT.title);
        expect(mockGenerateLessonPlan).toHaveBeenCalledTimes(1);
    });

    it('falls back to Genkit on sidecar HTTP error', async () => {
        setMode('canary');
        mockCallSidecar.mockRejectedValue(new LessonPlanSidecarHttpError(503, 'unavailable'));
        mockGenerateLessonPlan.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchLessonPlan(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
    });

    it('falls back to Genkit on behavioural-guard error (different from parent-call)', async () => {
        // The sidecar's post-orchestration guard rejected the final
        // plan. Genkit's lesson-plan flow has its own (different) guard
        // rules — fall back so the teacher always gets *some* plan.
        setMode('canary');
        mockCallSidecar.mockRejectedValue(
            new LessonPlanSidecarBehaviouralError('length', 'Lesson plan length out of range'),
        );
        mockGenerateLessonPlan.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchLessonPlan(BASE_INPUT);

        expect(out.source).toBe('genkit_fallback');
        expect(out.title).toBe(GENKIT_OUTPUT.title);
    });

    it('surfaces Genkit errors when both paths fail', async () => {
        setMode('canary');
        mockCallSidecar.mockRejectedValue(new LessonPlanSidecarHttpError(500, 'oops'));
        const genkitErr = new Error('Genkit also failed');
        mockGenerateLessonPlan.mockRejectedValue(genkitErr);

        await expect(dispatchLessonPlan(BASE_INPUT)).rejects.toThrow(genkitErr);
    });
});

describe('dispatchLessonPlan — full mode', () => {
    it('routes 100% to sidecar when ok', async () => {
        setMode('full');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);

        const out = await dispatchLessonPlan(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(mockGenerateLessonPlan).not.toHaveBeenCalled();
    });
});

// ── Phase K — persistence + pre-call gates ─────────────────────────────────

describe('dispatchLessonPlan — Phase K persistence', () => {
    it('canary success: persists to lesson-plans, surfaces sidecar response', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'cid-lp-1', storagePath: 'p' });

        const out = await dispatchLessonPlan(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(mockPersist).toHaveBeenCalledTimes(1);
        const arg = mockPersist.mock.calls[0][0];
        expect(arg.uid).toBe('teacher-uid-1');
        expect(arg.collection).toBe('lesson-plans');
        expect(arg.contentType).toBe('lesson-plan');
        expect(arg.title).toBe('Photosynthesis (Sidecar path)');
        expect(arg.metadata.gradeLevel).toBe('Class 5');
        expect(arg.metadata.subject).toBe('Science');
        expect(arg.metadata.topic).toBe('Photosynthesis');
    });

    it('canary success but persistence returns null: response still served (fail-soft)', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue(null);

        const out = await dispatchLessonPlan(BASE_INPUT);

        expect(out.source).toBe('sidecar');
        expect(out.title).toBe('Photosynthesis (Sidecar path)');
    });

    it('lifts rate-limit gate before sidecar call in canary mode', async () => {
        setMode('canary');
        mockCallSidecar.mockResolvedValue(SIDECAR_OUTPUT);
        mockPersist.mockResolvedValue({ contentId: 'cid', storagePath: 'p' });

        await dispatchLessonPlan(BASE_INPUT);

        expect(mockCheckRateLimit).toHaveBeenCalledWith('teacher-uid-1');
        const rl = mockCheckRateLimit.mock.invocationCallOrder[0];
        const sc = mockCallSidecar.mock.invocationCallOrder[0];
        expect(rl).toBeLessThan(sc);
    });

    it('rejects unsafe topics BEFORE calling sidecar', async () => {
        setMode('canary');

        await expect(
            dispatchLessonPlan({ ...BASE_INPUT, topic: 'how to build a bomb' }),
        ).rejects.toThrow(/Safety Violation/);

        expect(mockCallSidecar).not.toHaveBeenCalled();
        expect(mockCheckRateLimit).not.toHaveBeenCalled();
        expect(mockPersist).not.toHaveBeenCalled();
    });

    it('off-mode never calls the dispatcher-side persist (Genkit handles it)', async () => {
        setMode('off');
        mockGenerateLessonPlan.mockResolvedValue(GENKIT_OUTPUT);

        await dispatchLessonPlan(BASE_INPUT);

        expect(mockPersist).not.toHaveBeenCalled();
        expect(mockCheckRateLimit).not.toHaveBeenCalled();
    });
});

// ── decide-failure fail-safe ───────────────────────────────────────────────

describe('dispatchLessonPlan — decide-failure fail-safe', () => {
    it('falls back to off mode if decideLessonPlanDispatch rejects', async () => {
        mockDecide.mockRejectedValue(new Error('firestore stalled'));
        mockGenerateLessonPlan.mockResolvedValue(GENKIT_OUTPUT);

        const out = await dispatchLessonPlan(BASE_INPUT);

        expect(out.source).toBe('genkit');
        expect(out.decision.mode).toBe('off');
        expect(out.decision.reason).toBe('decide_failed');
        expect(mockCallSidecar).not.toHaveBeenCalled();
    });
});
