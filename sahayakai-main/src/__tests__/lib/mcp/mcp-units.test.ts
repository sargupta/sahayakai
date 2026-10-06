/**
 * @jest-environment node
 *
 * Unit tests for the shared MCP building blocks (keys, errors) and the
 * lesson-planner adapter (schema + mapping), independent of transport.
 */
jest.mock('server-only', () => ({}));

import { hashSecret, mintApiKey, parseApiKey, secretMatches } from '@/lib/mcp/api-keys';
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
            structuredContent: { error: { category: 'rate_limited', message: 'Slow down.', retryable: true, retry_after_seconds: 90 } },
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
