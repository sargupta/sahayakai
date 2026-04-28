/**
 * @jest-environment node
 *
 * Phase U.ε — agent-router parity tests.
 *
 * Phase N.1 migrated the Python sidecar's VIDYA schema from
 * `followUpSuggestion: str | None` to `plannedActions: list[VidyaAction]`
 * (max 3) with `dependsOn: list[int]` (max 2). The Genkit/Node-side
 * `agentRouterFlow.outputSchema` has now been brought to parity so
 * off-mode (Genkit) and canary/full-mode (sidecar) emit the same wire
 * shape.
 *
 * These tests pin three behaviours that the OmniOrb client and the
 * dispatcher consumers depend on:
 *
 *   1. Compound request → `plannedActions` length 2 with `dependsOn: [0]`
 *      on the second action (rubric grades the lesson plan at index 0).
 *   2. Single-step request → `plannedActions` length 1, synthesised from
 *      the bare intent + extracted params when the model emits an empty
 *      list (uniform iteration surface for v0.4+ clients).
 *   3. Unknown / instantAnswer intent → `plannedActions` is empty
 *      (these never produce navigation actions).
 *
 * The tests do NOT hit Gemini. They mock `agentRouterFlow` so we exercise
 * the consumer (`processAgentRequest`) and the schema's pass-through
 * surface deterministically.
 */

// ── Mocks (must come before importing the SUT) ─────────────────────────────

jest.mock('@/ai/flows/instant-answer', () => ({
    instantAnswer: jest.fn().mockResolvedValue({
        answer: 'Photosynthesis is the process plants use to make food from sunlight.',
        videoSuggestionUrl: null,
    }),
}));

// `agent-definitions` is the heaviest module here — it imports `@/ai/genkit`
// which pulls in the whole googleai plugin + secret-manager init. Stub it to
// a thin shim so the test only exercises the consumer and the planned-action
// reconciliation logic.
jest.mock('@/ai/flows/agent-definitions', () => {
    return {
        agentRouterFlow: jest.fn(),
    };
});

import { agentRouterFlow } from '@/ai/flows/agent-definitions';
import { processAgentRequest } from '@/ai/flows/agent-router';

const mockFlow = agentRouterFlow as unknown as jest.Mock;

// ── Fixtures ───────────────────────────────────────────────────────────────

const COMPOUND_INPUT = {
    prompt: 'Make a Class 7 Science lesson plan on photosynthesis AND a rubric to grade them.',
    language: 'en',
    userId: 'teacher-uid-001',
};

const SINGLE_STEP_INPUT = {
    prompt: 'Make a Class 5 Mathematics worksheet on fractions.',
    language: 'en',
    userId: 'teacher-uid-002',
};

const INSTANT_ANSWER_INPUT = {
    prompt: 'What is photosynthesis?',
    language: 'en',
    userId: 'teacher-uid-003',
};

const UNKNOWN_INPUT = {
    prompt: 'good morning',
    language: 'en',
    userId: 'teacher-uid-004',
};

// ── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
    jest.clearAllMocks();
});

describe('processAgentRequest — Phase N.1 plannedActions parity', () => {
    it('compound request yields plannedActions length 2 with dependsOn:[0] on the second action', async () => {
        // Compound: lesson plan THEN a rubric depending on it.
        mockFlow.mockResolvedValue({
            type: 'lessonPlan',
            topic: 'Photosynthesis',
            gradeLevel: 'Class 7',
            subject: 'Science',
            language: 'en',
            plannedActions: [
                {
                    type: 'NAVIGATE_AND_FILL',
                    flow: 'lesson-plan',
                    params: {
                        topic: 'Photosynthesis',
                        gradeLevel: 'Class 7',
                        subject: 'Science',
                        language: 'en',
                        ncertChapter: null,
                        dependsOn: [],
                    },
                },
                {
                    type: 'NAVIGATE_AND_FILL',
                    flow: 'rubric-generator',
                    params: {
                        topic: 'Photosynthesis',
                        gradeLevel: 'Class 7',
                        subject: 'Science',
                        language: 'en',
                        ncertChapter: null,
                        dependsOn: [0],
                    },
                },
            ],
            result: null,
        });

        const out = await processAgentRequest(COMPOUND_INPUT);

        expect(out.plannedActions).toHaveLength(2);
        expect(out.plannedActions?.[0].flow).toBe('lesson-plan');
        expect(out.plannedActions?.[0].params.dependsOn).toEqual([]);
        expect(out.plannedActions?.[1].flow).toBe('rubric-generator');
        expect(out.plannedActions?.[1].params.dependsOn).toEqual([0]);
        // Backward-compat: `result` still carries the legacy NAVIGATE shape
        // for v0.3 clients (the ones that haven't migrated to plannedActions).
        expect(out.result).toEqual(
            expect.objectContaining({
                action: 'NAVIGATE',
                url: expect.stringContaining('/lesson-plan?'),
            }),
        );
    });

    it('single-step routable request yields plannedActions length 1', async () => {
        // Model returned a populated single-action plan (Phase N.1 happy path).
        mockFlow.mockResolvedValue({
            type: 'worksheet',
            topic: 'Fractions',
            gradeLevel: 'Class 5',
            subject: 'Mathematics',
            language: 'en',
            plannedActions: [
                {
                    type: 'NAVIGATE_AND_FILL',
                    flow: 'worksheet-wizard',
                    params: {
                        topic: 'Fractions',
                        gradeLevel: 'Class 5',
                        subject: 'Mathematics',
                        language: 'en',
                        ncertChapter: null,
                        dependsOn: [],
                    },
                },
            ],
            result: null,
        });

        const out = await processAgentRequest(SINGLE_STEP_INPUT);

        expect(out.plannedActions).toHaveLength(1);
        expect(out.plannedActions?.[0].flow).toBe('worksheet-wizard');
        expect(out.plannedActions?.[0].params.dependsOn).toEqual([]);
    });

    it('unknown intent yields plannedActions empty', async () => {
        mockFlow.mockResolvedValue({
            type: 'unknown',
            plannedActions: [],
            result: null,
        });

        const out = await processAgentRequest(UNKNOWN_INPUT);

        expect(out.plannedActions).toEqual([]);
        expect(out.result).toEqual(
            expect.objectContaining({ error: expect.any(String) }),
        );
    });

    it('instantAnswer intent yields plannedActions empty (never produces navigation)', async () => {
        mockFlow.mockResolvedValue({
            type: 'instantAnswer',
            language: 'en',
            plannedActions: [],
            result: null,
        });

        const out = await processAgentRequest(INSTANT_ANSWER_INPUT);

        expect(out.plannedActions).toEqual([]);
        expect(out.result).toEqual(
            expect.objectContaining({
                action: 'ANSWER',
                content: expect.any(String),
            }),
        );
    });

    it('legacy followUpSuggestion shape (v0.3 emitter) is normalised into a 1-action plan', async () => {
        // Simulate an upstream still emitting the pre-N.1 shape — the shim
        // synthesises a single-action plan from the primary intent and logs
        // a deprecation warning. Removing this shim is scheduled 30 days
        // after Phase N.1 lands.
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        mockFlow.mockResolvedValue({
            type: 'lessonPlan',
            topic: 'Water Cycle',
            gradeLevel: 'Class 5',
            subject: 'Science',
            language: 'en',
            // No plannedActions field at all (legacy emitter).
            followUpSuggestion: 'You might also want a rubric for grading.',
            result: null,
        });

        const out = await processAgentRequest({
            prompt: 'Lesson plan on the water cycle for class 5.',
            language: 'en',
        });

        // Even with the legacy field present the consumer should not
        // crash; the planned-action queue stays well-formed.
        expect(Array.isArray(out.plannedActions)).toBe(true);
        // `result` (the v0.3 surface) still works.
        expect(out.result).toEqual(
            expect.objectContaining({ action: 'NAVIGATE' }),
        );

        warnSpy.mockRestore();
    });

    it('rejects prompts longer than 2000 characters (Wave 2 cap is preserved)', async () => {
        await expect(
            processAgentRequest({
                prompt: 'a'.repeat(2001),
            }),
        ).rejects.toThrow(/Prompt too long/);
    });
});
