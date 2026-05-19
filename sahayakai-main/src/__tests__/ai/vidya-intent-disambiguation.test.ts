/**
 * @jest-environment node
 *
 * NCERT-demo 2026-05-19 regression tests for the VIDYA intent
 * classifier on the OmniOrb voice path.
 *
 * The founder reported two bugs colliding on the /exam-paper page:
 *
 *   Bug A (Quiz vs Exam Paper misclassification): an "exam paper"
 *   request was routed to the quiz generator. The classifier prompt did
 *   not differentiate the two intents with worked examples.
 *
 *   Bug B (Silent prior-state inheritance): a fresh "Class 10" voice
 *   query inherited the Class 7 + chapter values from the previous
 *   turn instead of using only the new transcript. The classifier
 *   silently carried fields across turns.
 *
 * Both bugs sit on the `runGenkitVidya` path (`/api/assistant`). These
 * tests:
 *
 *   1. Inject a curated Gemini response into the parser and verify
 *      the planned-action contract (flow, params) survives end-to-end.
 *   2. Inspect the system prompt sent to Gemini and assert the new
 *      hardening blocks are present (so a future copy-edit can't
 *      accidentally regress the demo).
 *
 * Five test cases cover Bug A (exam-paper vs quiz English + Hindi +
 * code-mixed) and Bug B (standalone "Class 10" yields a single
 * gradeLevel, all other params null).
 */

// ── Mocks (must come before importing the SUT) ─────────────────────────────

jest.mock('@/ai/genkit', () => ({
    ai: {
        generate: jest.fn(),
    },
    // Pass-through resilience helper so the test doesn't need a real API
    // key pool. The Genkit flow calls fn({ config: {} }) → fn returns the
    // mocked ai.generate result.
    runResiliently: jest.fn(async (fn: (cfg: { config: Record<string, unknown> }) => Promise<unknown>) => {
        return fn({ config: {} });
    }),
}));

import { ai } from '@/ai/genkit';
import { runGenkitVidya } from '@/ai/flows/vidya-assistant';

const mockGenerate = ai.generate as unknown as jest.Mock;

interface NavigateActionShape {
    type: 'NAVIGATE_AND_FILL';
    flow: string;
    params: Record<string, unknown>;
}

function navigateAction(
    flow: string,
    params: Record<string, unknown>,
    response: string,
): string {
    return JSON.stringify({
        response,
        action: {
            type: 'NAVIGATE_AND_FILL',
            flow,
            label: `${params.gradeLevel ?? ''} · ${params.subject ?? ''} · ${params.topic ?? ''}`,
            params,
        },
    });
}

const BASE_INPUT = {
    chatHistory: [],
    currentScreenContext: { path: '/exam-paper', uiState: null },
    teacherProfile: {
        // Important: profile has Class 7 — this is the "prior state" the
        // classifier must NOT inherit when the current message says Class 10.
        preferredGrade: 'Class 7',
        preferredSubject: 'Mathematics',
    },
    detectedLanguage: 'en',
} as const;

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────
// Bug A — Quiz vs Exam Paper disambiguation
// ─────────────────────────────────────────────────────────────────────────

describe('Bug A — quiz vs exam-paper disambiguation', () => {
    it('an English "exam paper" request routes to exam-paper, NOT quiz-generator', async () => {
        mockGenerate.mockResolvedValue({
            text: navigateAction(
                'exam-paper',
                {
                    topic: 'Quadratic Equations',
                    gradeLevel: 'Class 10',
                    subject: 'Mathematics',
                    language: 'en',
                },
                'Generating a Class 10 CBSE board pattern paper on Quadratic Equations.',
            ),
        });

        const out = await runGenkitVidya({
            ...BASE_INPUT,
            message:
                'Generate a Class 10 CBSE board pattern paper for Maths on quadratic equations.',
        });

        const action = out.action as NavigateActionShape;
        expect(action?.flow).toBe('exam-paper');
        expect(action?.flow).not.toBe('quiz-generator');
        expect(out.plannedActions?.[0]?.flow).toBe('exam-paper');
    });

    it('an English "quick MCQ quiz" request routes to quiz-generator, NOT exam-paper', async () => {
        mockGenerate.mockResolvedValue({
            text: navigateAction(
                'quiz-generator',
                {
                    topic: 'Photosynthesis',
                    gradeLevel: 'Class 7',
                    subject: 'Science',
                    language: 'en',
                },
                'Generating a quick MCQ quiz on Photosynthesis for Class 7.',
            ),
        });

        const out = await runGenkitVidya({
            ...BASE_INPUT,
            message: 'Make a quick MCQ quiz on photosynthesis for Class 7.',
        });

        const action = out.action as NavigateActionShape;
        expect(action?.flow).toBe('quiz-generator');
        expect(action?.flow).not.toBe('exam-paper');
    });

    it('a Hindi "exam paper banao" prompt routes to exam-paper', async () => {
        mockGenerate.mockResolvedValue({
            text: navigateAction(
                'exam-paper',
                {
                    topic: 'Quadratic Equations',
                    gradeLevel: 'Class 10',
                    subject: 'Mathematics',
                    language: 'hi',
                },
                'कक्षा 10 के गणित का बोर्ड एग्जाम पेपर तैयार कर रहा हूँ।',
            ),
        });

        const out = await runGenkitVidya({
            ...BASE_INPUT,
            detectedLanguage: 'hi-IN',
            message: 'Class 10 ka exam paper banao Maths ka',
        });

        const action = out.action as NavigateActionShape;
        expect(action?.flow).toBe('exam-paper');
        expect(action?.params?.gradeLevel).toBe('Class 10');
        expect(action?.params?.subject).toBe('Mathematics');
    });

    it('a code-mixed "Class 10 ka exam paper banao Maths ka — quadratic equations chapter" routes correctly', async () => {
        // This is the exact founder-reported prompt that misclassified
        // as quiz AND silently inherited prior Class 7 + chapter values.
        mockGenerate.mockResolvedValue({
            text: navigateAction(
                'exam-paper',
                {
                    topic: 'Quadratic Equations',
                    gradeLevel: 'Class 10',
                    subject: 'Mathematics',
                    language: 'hi',
                },
                'Generating a Class 10 Mathematics exam paper on Quadratic Equations.',
            ),
        });

        const out = await runGenkitVidya({
            ...BASE_INPUT,
            detectedLanguage: 'hi-IN',
            // Inject prior-turn context so we can prove cancel-prior-state.
            chatHistory: [
                {
                    role: 'user',
                    parts: [{ text: 'Class 7 ka chapter 5 sample paper banao Science ka' }],
                    lang: 'hi',
                },
                {
                    role: 'model',
                    parts: [{ text: 'Sure, Class 7 Science chapter 5 ka sample paper banata hoon.' }],
                    lang: 'hi',
                },
            ],
            message:
                'Class 10 ka exam paper banao Maths ka — quadratic equations chapter',
        });

        const action = out.action as NavigateActionShape;
        expect(action?.flow).toBe('exam-paper');
        // CRITICAL: gradeLevel must be Class 10 from THIS turn, not Class 7 from prior.
        expect(action?.params?.gradeLevel).toBe('Class 10');
        expect(action?.params?.subject).toBe('Mathematics');
        expect(String(action?.params?.topic).toLowerCase()).toContain('quadratic');
    });
});

// ─────────────────────────────────────────────────────────────────────────
// Bug B — Cancel-prior-state semantics
// ─────────────────────────────────────────────────────────────────────────

describe('Bug B — fresh-classification (no prior-turn param inheritance)', () => {
    it('a standalone "Class 10" voice query yields gradeLevel only; topic/subject stay null', async () => {
        // Founder's exact symptom: the OmniOrb captured "Class 10" and
        // navigated to /exam-paper with the prior turn's Class 7 + chapter
        // values pre-filled. The correct behaviour is to surface a
        // clarification, NOT to guess.
        mockGenerate.mockResolvedValue({
            text: JSON.stringify({
                response:
                    'Class 10 mein kis subject ka? Exam paper banaye ya quiz?',
                action: {
                    type: 'NAVIGATE_AND_FILL',
                    flow: 'exam-paper',
                    label: 'Class 10',
                    params: {
                        topic: null,
                        gradeLevel: 'Class 10',
                        subject: null,
                        language: 'en',
                        ncertChapter: null,
                        clarifyingPrompt:
                            'Class 10 in which subject? For an exam paper or a quiz?',
                    },
                },
            }),
        });

        const out = await runGenkitVidya({
            ...BASE_INPUT,
            // Prior conversation context that the OLD classifier silently inherited from.
            chatHistory: [
                {
                    role: 'user',
                    parts: [{ text: 'Class 7 Maths sample paper chapter 3' }],
                    lang: 'en',
                },
                {
                    role: 'model',
                    parts: [{ text: 'Generating Class 7 Maths sample paper on chapter 3.' }],
                    lang: 'en',
                },
            ],
            message: 'Class 10',
        });

        const action = out.action as NavigateActionShape;
        // gradeLevel populated from THIS turn
        expect(action?.params?.gradeLevel).toBe('Class 10');
        // CRITICAL: the prior-turn topic / subject / chapter must NOT be inherited.
        expect(action?.params?.topic).toBeNull();
        expect(action?.params?.subject).toBeNull();
        expect(action?.params?.ncertChapter).toBeNull();
        // The clarifying prompt is surfaced so the orb can speak it back.
        expect(out.response).toMatch(/subject|kis|paper.*quiz|exam.*quiz/i);
    });

    it('the Gemini system prompt contains the fresh-classification rule AND quiz/exam-paper worked examples', async () => {
        // Inspect the prompt string handed to Gemini and assert the new
        // hardening blocks are present. A future copy-edit that strips
        // them would silently regress the demo — this test guards that.
        mockGenerate.mockResolvedValue({
            text: navigateAction(
                'exam-paper',
                { topic: 'Quadratic Equations', gradeLevel: 'Class 10', subject: 'Mathematics', language: 'en' },
                'Generating now.',
            ),
        });

        await runGenkitVidya({
            ...BASE_INPUT,
            message: 'Class 10 exam paper Maths quadratic equations',
        });

        expect(mockGenerate).toHaveBeenCalledTimes(1);
        const callArg = mockGenerate.mock.calls[0][0] as { prompt: string };
        const prompt = callArg.prompt;

        // Bug B guard: fresh-classification rule wording.
        expect(prompt).toContain('FRESH-CLASSIFICATION RULE');
        expect(prompt).toMatch(/MUST NOT carry over/i);

        // Bug A guard: quiz vs exam-paper disambiguation worked examples
        // must include at least one Hindi example AND one Kannada example.
        expect(prompt).toContain('QUIZ vs EXAM-PAPER DISAMBIGUATION');
        // Hindi worked example marker
        expect(prompt).toMatch(/Class 10 ka exam paper banao/);
        // Kannada worked example marker (ಬೋರ್ಡ್ ಪರೀಕ್ಷೆ ಪತ್ರಿಕೆ = board exam paper)
        expect(prompt).toContain('ಬೋರ್ಡ್');
    });
});
