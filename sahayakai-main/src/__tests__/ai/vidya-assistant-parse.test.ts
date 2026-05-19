/**
 * @jest-environment node
 *
 * Pins the `runGenkitVidya` parse-and-normalise contract.
 *
 * The voice-to-action chain was reported as "voices captured, but those
 * are not converting into actions" before this fix. Root cause: when
 * Gemini Flash emitted a JSON-with-prose preamble or a markdown-fenced
 * JSON blob, the greedy `match(/\{[\s\S]*\}/)` parser silently
 * mis-matched and the route returned the SAFE_FALLBACK
 * (`response: "...recalibrating..."`, `action: null`). The OmniOrb
 * client played the apology TTS and never navigated — the founder's
 * exact symptom.
 *
 * These tests stub `ai.generate` to inject the realistic noisy LLM
 * outputs we saw in prod logs and assert the parser:
 *   1. Returns a populated `action` (so the client can navigate)
 *   2. Synthesises a single-entry `plannedActions` for the v0.4+
 *      iteration surface
 *
 * Covers the three demo languages: Hindi (Devanagari), English, and
 * Kannada (Kannada script). Each case proves the response field is
 * not stripped to empty (the silent-failure mode) and the action's
 * `flow` is one of the 9 routable kebab-case ids the OmniOrb client
 * knows how to navigate to.
 */

// ── Mocks (must come before importing the SUT) ─────────────────────────────

jest.mock('@/ai/genkit', () => ({
    ai: {
        generate: jest.fn(),
    },
    // Pass-through resilience helper so the test doesn't need a real
    // API key pool. The Genkit flow calls fn({ config: {} }) → fn returns
    // the mocked ai.generate result.
    runResiliently: jest.fn(async (fn: (cfg: { config: Record<string, unknown> }) => Promise<unknown>) => {
        return fn({ config: {} });
    }),
}));

import { ai } from '@/ai/genkit';
import { runGenkitVidya } from '@/ai/flows/vidya-assistant';

const mockGenerate = ai.generate as unknown as jest.Mock;

function lessonPlanJson(language: 'en' | 'hi' | 'kn', response: string): string {
    return JSON.stringify({
        response,
        action: {
            type: 'NAVIGATE_AND_FILL',
            flow: 'lesson-plan',
            label: 'Class 5 · Science · Gravity',
            params: {
                topic: 'Gravity',
                subject: 'Science',
                gradeLevel: 'Class 5',
                language,
            },
        },
    });
}

const BASE_INPUT = {
    message: 'lesson plan on gravity for class 5',
    chatHistory: [],
    currentScreenContext: { path: '/dashboard', uiState: null },
    teacherProfile: { preferredGrade: 'Class 5', preferredSubject: 'Science' },
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

describe('runGenkitVidya — parse and normalise the model output', () => {
    it('parses a clean JSON output in English and emits a NAVIGATE_AND_FILL action', async () => {
        mockGenerate.mockResolvedValue({
            text: lessonPlanJson('en', "Generating a Class 5 Science lesson plan on Gravity for you now!"),
        });

        const out = await runGenkitVidya(BASE_INPUT);

        expect(out.response).toContain('Gravity');
        expect(out.action).toBeTruthy();
        expect(out.action?.type).toBe('NAVIGATE_AND_FILL');
        expect((out.action as { flow: string }).flow).toBe('lesson-plan');
        expect(out.plannedActions).toHaveLength(1);
        expect(out.plannedActions?.[0]?.flow).toBe('lesson-plan');
    });

    it('parses a clean JSON output in Hindi and preserves the action', async () => {
        const hindiResponse = "कक्षा 5 के लिए गुरुत्वाकर्षण पर पाठ योजना तैयार कर रहा हूँ।";
        mockGenerate.mockResolvedValue({
            text: lessonPlanJson('hi', hindiResponse),
        });

        const out = await runGenkitVidya({ ...BASE_INPUT, detectedLanguage: 'hi-IN', message: 'मुझे कक्षा 5 के लिए गुरुत्वाकर्षण पर पाठ योजना चाहिए' });

        expect(out.response).toBe(hindiResponse);
        expect((out.action as { flow: string }).flow).toBe('lesson-plan');
        expect(out.plannedActions?.[0]?.params.language).toBe('hi');
    });

    it('parses a clean JSON output in Kannada and preserves the action', async () => {
        const kannadaResponse = "ತರಗತಿ 5 ರ ಗುರುತ್ವಾಕರ್ಷಣೆ ಪಾಠ ಯೋಜನೆಯನ್ನು ತಯಾರಿಸುತ್ತಿದ್ದೇನೆ।";
        mockGenerate.mockResolvedValue({
            text: lessonPlanJson('kn', kannadaResponse),
        });

        const out = await runGenkitVidya({ ...BASE_INPUT, detectedLanguage: 'kn-IN', message: 'ನನಗೆ ತರಗತಿ 5 ಗುರುತ್ವಾಕರ್ಷಣೆ ಪಾಠ ಯೋಜನೆ ಬೇಕು' });

        expect(out.response).toBe(kannadaResponse);
        expect((out.action as { flow: string }).flow).toBe('lesson-plan');
        expect(out.plannedActions?.[0]?.params.language).toBe('kn');
    });

    it('extracts JSON wrapped in a markdown ```json``` code fence (real Gemini failure mode)', async () => {
        const inner = lessonPlanJson('en', 'Generating now!');
        mockGenerate.mockResolvedValue({
            text: '```json\n' + inner + '\n```',
        });

        const out = await runGenkitVidya(BASE_INPUT);

        expect(out.action).toBeTruthy();
        expect((out.action as { flow: string }).flow).toBe('lesson-plan');
    });

    it('extracts JSON after a leading prose preamble (another real Gemini failure mode)', async () => {
        const inner = lessonPlanJson('en', 'Generating now!');
        mockGenerate.mockResolvedValue({
            text: 'Sure! Here is the JSON response:\n' + inner,
        });

        const out = await runGenkitVidya(BASE_INPUT);

        expect(out.action).toBeTruthy();
        expect((out.action as { flow: string }).flow).toBe('lesson-plan');
    });

    it('extracts the FIRST balanced JSON object, not the universe between first/last brace', async () => {
        // The previous greedy regex `\{[\s\S]*\}` matched everything between
        // the first `{` and the LAST `}`, so a JSON object followed by stray
        // braces (e.g. in a prose epilogue with example JSON) parsed to a
        // mangled blob that failed `JSON.parse`. The balanced-walk extractor
        // returns the first complete object.
        const inner = lessonPlanJson('en', 'Generating now!');
        mockGenerate.mockResolvedValue({
            text: inner + '\n\nNote: this is an example output { "stray": true }',
        });

        const out = await runGenkitVidya(BASE_INPUT);

        expect(out.action).toBeTruthy();
        expect((out.action as { flow: string }).flow).toBe('lesson-plan');
    });

    it('falls back to SAFE_FALLBACK when the model emits unparseable garbage (logs the raw output)', async () => {
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        mockGenerate.mockResolvedValue({
            text: 'I cannot help with that request because it is unclear.',
        });

        const out = await runGenkitVidya(BASE_INPUT);

        // SAFE_FALLBACK preserves a response so the user hears the apology
        // (better than silence) AND emits action=null so the client routes
        // through the "no action" branch instead of crashing.
        expect(out.response).toMatch(/recalibrating/i);
        expect(out.action).toBeNull();
        expect(out.plannedActions).toEqual([]);
        // The structured error log is the demo-day diagnostic. Without it,
        // founders cannot tell from Cloud Run logs WHY VIDYA misfired.
        expect(errorSpy).toHaveBeenCalled();
        const logged = errorSpy.mock.calls[0][0];
        expect(typeof logged === 'string' && logged).toContain('vidya.genkit.parse_failed');
    });

    it('handles a "instant-answer" style conversational response with action:null', async () => {
        // Conversational replies set action=null. Critical: the response
        // field must still be populated — empty response with no action was
        // the "voice captured, nothing happens" symptom.
        mockGenerate.mockResolvedValue({
            text: JSON.stringify({
                response: 'Photosynthesis is how plants make food from sunlight. How do you usually explain this to your students?',
                action: null,
            }),
        });

        const out = await runGenkitVidya({ ...BASE_INPUT, message: 'what is photosynthesis?' });

        expect(out.response.length).toBeGreaterThan(20);
        expect(out.action).toBeNull();
        expect(out.plannedActions).toEqual([]);
    });
});
