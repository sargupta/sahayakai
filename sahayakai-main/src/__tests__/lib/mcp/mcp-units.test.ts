/**
 * @jest-environment node
 *
 * Unit tests for the shared MCP building blocks (keys, errors) and the
 * lesson-planner and exam-paper adapters (schema + mapping), independent of transport.
 */
jest.mock('server-only', () => ({}));

import { hashSecret, MCP_SCOPES, mintApiKey, parseApiKey, secretMatches } from '@/lib/mcp/api-keys';
import { CreateExamPaperInput } from '@/lib/mcp/exam-paper/schema';
import { durationMinutes, toDispatchInput as toExamPaperDispatchInput, toExamPaperResult } from '@/lib/mcp/exam-paper/service';
import { classifyError, McpCapabilityError, toToolErrorResult } from '@/lib/mcp/errors';
import { CreateLessonPlanInput } from '@/lib/mcp/lesson-planner/schema';
import { HEADLESS_SERVICE_CALLER, toDispatchInput, toLessonPlanResult } from '@/lib/mcp/lesson-planner/service';

const PEPPER = 'unit-pepper-0123456789-abcdefghijklmnopq';

describe('API keys', () => {
    it('mints sk_sahayak_<16 hex>_<43 b64url>, stores only an HMAC of the secret', () => {
        const { apiKey, keyId, record } = mintApiKey({ orgId: 'org-a', label: 'LMS', scopes: ['lesson-planner', 'lesson-planner'], createdBy: 't', pepper: PEPPER });
        expect(apiKey).toMatch(/^sk_sahayak_[0-9a-f]{16}_[A-Za-z0-9_-]{43}$/);
        const parsed = parseApiKey(apiKey)!;
        expect(parsed.keyId).toBe(keyId);
        expect(JSON.stringify(record)).not.toContain(parsed.secret);
        expect(record.secretHash).toBe(hashSecret(parsed.secret, PEPPER));
        expect(record.scopes).toEqual(['lesson-planner']); // de-duplicated
        expect(record.status).toBe('active');
    });

    it('verifies only the exact secret with the exact pepper', () => {
        const { apiKey, record } = mintApiKey({ orgId: 'o', label: 'x', scopes: ['lesson-planner'], createdBy: 't', pepper: PEPPER });
        const { secret } = parseApiKey(apiKey)!;
        expect(secretMatches(secret, record.secretHash, PEPPER)).toBe(true);
        expect(secretMatches(`${secret.slice(0, -1)}x`, record.secretHash, PEPPER)).toBe(false);
        expect(secretMatches(secret, record.secretHash, `${PEPPER}-rotated`)).toBe(false);
        expect(secretMatches(secret, '', PEPPER)).toBe(false);
        expect(secretMatches(secret, 'zz-not-hex', PEPPER)).toBe(false);
    });

    it.each(['', 'sk_sahayak_', 'sk_sahayak_XYZ_abc', `sk_sahayak_0123456789abcdef_${'a'.repeat(42)}`, `pk_sahayak_0123456789abcdef_${'a'.repeat(43)}`, `sk_sahayak_0123456789abcdef_${'a'.repeat(43)}_extra`])(
        'rejects non-key %p', (raw) => expect(parseApiKey(raw)).toBeNull(),
    );
});

describe('error classification (never leaks internals)', () => {
    it.each([
        ['Safety Violation: blocked', 'content_policy', false],
        ['Rate limit exceeded. Please wait 1 minute.', 'rate_limited', true],
        ['Gemini 503 Service Unavailable', 'upstream_unavailable', true],
        ['quota exceeded for project', 'upstream_unavailable', true],
        ['request timed out after 75000ms', 'timeout', true],
        ['Cannot read properties of undefined', 'internal', true],
    ])('%p → %s', (msg, category, retryable) => {
        const e = classifyError(new Error(msg));
        expect(e.category).toBe(category);
        expect(e.retryable).toBe(retryable);
        if (category === 'internal') expect(e.message).not.toContain('undefined');
    });

    it('passes McpCapabilityError through and renders an isError tool result', () => {
        const err = new McpCapabilityError('rate_limited', 'Slow down.', 90);
        expect(classifyError(err)).toBe(err);
        expect(toToolErrorResult(err)).toEqual({
            isError: true,
            content: [{ type: 'text', text: 'Slow down. (rate_limited)' }],
            _meta: { 'sahayak/error': { category: 'rate_limited', message: 'Slow down.', retryable: true, retry_after_seconds: 90 } },
        });
    });
});

describe('lesson-planner adapter', () => {
    const input = CreateLessonPlanInput.parse({ topic: '  Fractions ', grade: 5 });

    it('applies documented defaults and trims', () => {
        expect(input).toEqual({ topic: 'Fractions', grade: 5, language: 'English', classroom_resources: 'low', difficulty: 'standard', use_local_context: true });
    });

    it('maps onto the existing service input as the headless caller', () => {
        expect(toDispatchInput(input)).toEqual({
            userId: HEADLESS_SERVICE_CALLER, topic: 'Fractions', gradeLevels: ['Class 5'], language: 'English',
            resourceLevel: 'low', difficultyLevel: 'standard', useRuralContext: true,
        });
    });

    it('normalises messy service output into the strict public shape', () => {
        const result = toLessonPlanResult({
            title: '  ', objectives: ['A', '', null, ' B '], materials: undefined,
            keyVocabulary: [{ term: 'X', meaning: '' }, { term: 'Y', meaning: 'why' }],
            activities: [
                { phase: 'Engage', name: '', description: 'd', duration: '5 minutes', teacherTips: '  ', understandingCheck: 'q?' },
                { phase: 'Unknown', name: 'n', description: 'd', duration: '1 minute' },
            ],
            validationWarning: { invalid: false, lenient: true, message: 'ignored when valid' },
        } as any, input);
        expect(result).toMatchObject({
            title: 'Fractions', grade: 5, subject: null, language: 'English', duration: null,
            learning_objectives: ['A', 'B'], materials: [], key_vocabulary: [{ term: 'Y', meaning: 'why' }],
            activities: [{ phase: 'Engage', name: 'Engage', description: 'd', duration: '5 minutes', teacher_tips: null, understanding_check: 'q?' }],
            assessment: null, homework: null, curriculum_note: null,
        });
    });
});

describe('difficulty aliases (what agents naturally send)', () => {
    it.each([['easy', 'remedial'], ['medium', 'standard'], ['hard', 'advanced'], ['remedial', 'remedial'], ['standard', 'standard'], ['advanced', 'advanced']])(
        '%s → %s at the service', (given, canonical) => {
            const parsed = CreateLessonPlanInput.parse({ topic: 'Photosynthesis', grade: 7, difficulty: given });
            expect(toDispatchInput(parsed).difficultyLevel).toBe(canonical);
        },
    );

    it('the demo input (Photosynthesis, grade 7, Science, English, medium) is valid', () => {
        const parsed = CreateLessonPlanInput.parse({ topic: 'Photosynthesis', grade: 7, subject: 'Science', language: 'English', difficulty: 'medium' });
        expect(toDispatchInput(parsed)).toMatchObject({ topic: 'Photosynthesis', gradeLevels: ['Class 7'], subject: 'Science', language: 'English', difficultyLevel: 'standard' });
    });

    it('still rejects unknown levels', () => {
        expect(() => CreateLessonPlanInput.parse({ topic: 'Photosynthesis', grade: 7, difficulty: 'expert' })).toThrow(/Invalid difficulty/);
    });
});

describe('curriculum_note matches the documented contract', () => {
    const warning = { invalid: true, lenient: true, message: 'Chapter "Photosynthesis" not found in NCERT Class 7 Science.' };
    const plan = { title: 'P', objectives: ['o'], activities: [], validationWarning: warning } as any;

    it('is null when the caller did not ask for NCERT alignment (the service still checks topics)', () => {
        const input = CreateLessonPlanInput.parse({ topic: 'Photosynthesis', grade: 7 });
        expect(toLessonPlanResult(plan, input).curriculum_note).toBeNull();
    });

    it('is set when the given ncert_chapter does not match the syllabus', () => {
        const input = CreateLessonPlanInput.parse({ topic: 'Photosynthesis', grade: 7, ncert_chapter: { number: 1, title: 'Photosynthesis' } });
        expect(toLessonPlanResult(plan, input).curriculum_note).toBe(warning.message);
    });
});

describe('local dev key scopes (shared by every MCP server)', () => {
    const env = process.env as Record<string, string | undefined>;
    const original = { NODE_ENV: env.NODE_ENV };
    afterEach(() => { env.NODE_ENV = original.NODE_ENV; delete env.MCP_LOCAL_DEV_API_KEY; delete env.MCP_LOCAL_DEV_SCOPES; });

    it('defaults to every MCP scope and can be narrowed', () => {
        const { localDevKeyPrincipal } = jest.requireActual('@/lib/mcp/auth');
        const key = mintApiKey({ orgId: 'x', label: 'dev', scopes: ['lesson-planner'], createdBy: 'jest', pepper: PEPPER }).apiKey;
        env.NODE_ENV = 'development';
        env.MCP_LOCAL_DEV_API_KEY = key;
        expect(localDevKeyPrincipal(key).scopes).toEqual([...MCP_SCOPES]);
        env.MCP_LOCAL_DEV_SCOPES = 'exam-paper';
        expect(localDevKeyPrincipal(key).scopes).toEqual(['exam-paper']);
    });
});

describe('exam-paper adapter', () => {
    it('maps onto the existing service input as the headless caller, with documented defaults', () => {
        const input = CreateExamPaperInput.parse({ grade: 8, subject: ' Science ', chapters: ['Force and Pressure'] });
        expect(input).toMatchObject({ board: 'CBSE', difficulty: 'mixed', language: 'English', include_answer_key: true, include_marking_scheme: true });
        expect(toExamPaperDispatchInput(input)).toEqual({
            userId: '', board: 'CBSE', gradeLevel: 'Class 8', subject: 'Science', chapters: ['Force and Pressure'], language: 'English',
            difficulty: 'mixed', includeAnswerKey: true, includeMarkingScheme: true,
        });
    });

    it('accepts the agent-natural "medium" as the service\'s "moderate"', () => {
        expect(toExamPaperDispatchInput(CreateExamPaperInput.parse({ grade: 8, subject: 'Science', difficulty: 'medium' })).difficulty).toBe('moderate');
        expect(toExamPaperDispatchInput(CreateExamPaperInput.parse({ grade: 8, subject: 'Science', difficulty: 'hard', pyq_percent: 30, max_marks: 40, duration_minutes: 90 })))
            .toMatchObject({ difficulty: 'hard', pyqRatio: 30, maxMarks: 40, duration: 90 });
    });

    it.each([
        ['1 Hour', 60], ['45 Minutes', 45], ['1 hour 30 minutes', 90], ['3 Hrs', 180], ['90 min', 90], ['2.5 hours', 150], ['As per board', null],
    ])('reads the printed duration %s as %s minutes', (display, minutes) => {
        expect(durationMinutes(display)).toBe(minutes);
    });

    it('normalises messy service output and drops empty questions and sections', () => {
        const input = CreateExamPaperInput.parse({ grade: 8, subject: 'Science' });
        const out = toExamPaperResult({
            title: '  ', maxMarks: 3, duration: '30 Minutes', generalInstructions: ['', ' Attempt all. '],
            sections: [
                { name: 'A', label: '', totalMarks: 3, questions: [{ number: 1, text: ' Q1 ', marks: 3, source: 'PYQ 2019', correctOption: 'a', options: [], answerKey: 'x' }, { number: 2, text: '' }] },
                { name: 'B', label: 'empty', totalMarks: 0, questions: [] },
            ],
        } as any, input);
        expect(out.title).toBe('CBSE Class 8 Science');
        expect(out.general_instructions).toEqual(['Attempt all.']);
        expect(out.sections).toHaveLength(1);
        expect(out.sections[0].questions).toEqual([{
            number: 1, text: 'Q1', marks: 3, origin: 'previous_year', source_note: 'PYQ 2019', options: [], correct_option: null,
            internal_choice: null, answer_key: 'x', marking_scheme: null,
        }]);
        expect(out.review_notes).toEqual([]);
    });
});
