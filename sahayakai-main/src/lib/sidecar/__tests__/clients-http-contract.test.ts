/**
 * Parameterised HTTP-contract tests for ALL 17 sidecar clients +
 * parent-call. Every client follows the same template (signing, OIDC
 * token, App Check header, AbortController timeout) — these tests pin
 * the shared invariants exactly once per client without re-asserting
 * agent-specific schemas.
 *
 * Per-client coverage:
 *   1. Successful HTTP 200 response → parsed JSON returned.
 *   2. Config error when NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL is unset.
 *   3. Config error when SAHAYAKAI_AGENTS_AUDIENCE is unset.
 *   4. HTTP 4xx → typed HTTP error thrown (status preserved).
 *   5. HTTP 5xx → typed HTTP error thrown.
 *   6. AbortError → typed timeout error.
 *   7. Body digest signing matches `signing.ts` (X-Content-Digest +
 *      X-Request-Timestamp headers present and well-formed).
 *   8. OIDC bearer token forwarded from token client.
 *   9. App Check header forwarded when present, omitted when null.
 *  10. Behavioural-guard 502 → typed behavioural error (where applicable).
 */

import crypto from 'node:crypto';

const SECRET_VALUE = 'k'.repeat(48);
jest.mock('@/lib/secrets', () => ({
    getSecret: jest.fn().mockResolvedValue('k'.repeat(48)),
}));

jest.mock('@/lib/firebase-app-check', () => ({
    getFirebaseAppCheckToken: jest.fn().mockResolvedValue(null),
}));

const mockGetRequestHeaders = jest.fn(async () => ({
    Authorization: 'Bearer fake-oidc-token',
}));
const mockGetIdTokenClient = jest.fn(async (_audience: string) => ({
    getRequestHeaders: mockGetRequestHeaders,
}));
jest.mock('google-auth-library', () => ({
    GoogleAuth: jest.fn().mockImplementation(() => ({
        getIdTokenClient: (audience: string) => mockGetIdTokenClient(audience),
    })),
}));

beforeEach(() => {
    process.env.NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL = 'https://sidecar.example';
    process.env.SAHAYAKAI_AGENTS_AUDIENCE = 'https://sidecar.example';
    jest.clearAllMocks();
    mockGetRequestHeaders.mockResolvedValue({
        Authorization: 'Bearer fake-oidc-token',
    });
});

afterEach(() => {
    jest.restoreAllMocks();
});

interface ClientSpec {
    name: string;
    modulePath: string;
    callFn: string;
    urlPath: string;
    errors: {
        config: string;
        timeout: string;
        http: string;
        behavioural?: string;
    };
    request: unknown;
    response: unknown;
    resetFn?: string;
}

const CLIENTS: readonly ClientSpec[] = [
    {
        name: 'quiz',
        modulePath: '../quiz-client',
        callFn: 'callSidecarQuiz',
        urlPath: '/v1/quiz/generate',
        errors: {
            config: 'QuizSidecarConfigError',
            timeout: 'QuizSidecarTimeoutError',
            http: 'QuizSidecarHttpError',
            behavioural: 'QuizSidecarBehaviouralError',
        },
        request: { topic: 't', numQuestions: 1, gradeLevel: 'C5', language: 'en' },
        response: { easy: null, medium: null, hard: null },
        resetFn: '_resetQuizTokenCacheForTest',
    },
    {
        name: 'lesson-plan',
        modulePath: '../lesson-plan-client',
        callFn: 'callSidecarLessonPlan',
        urlPath: '/v1/lesson-plan/generate',
        errors: {
            config: 'LessonPlanSidecarConfigError',
            timeout: 'LessonPlanSidecarTimeoutError',
            http: 'LessonPlanSidecarHttpError',
        },
        request: { topic: 't', gradeLevel: 'C5', language: 'en' },
        response: { plan: { title: 't' } },
    },
    {
        name: 'instant-answer',
        modulePath: '../instant-answer-client',
        callFn: 'callSidecarInstantAnswer',
        urlPath: '/v1/instant-answer/answer',
        errors: {
            config: 'InstantAnswerSidecarConfigError',
            timeout: 'InstantAnswerSidecarTimeoutError',
            http: 'InstantAnswerSidecarHttpError',
        },
        request: { question: 'q', language: 'en' },
        response: { answer: 'a' },
    },
    {
        name: 'rubric',
        modulePath: '../rubric-client',
        callFn: 'callSidecarRubric',
        urlPath: '/v1/rubric/generate',
        errors: {
            config: 'RubricSidecarConfigError',
            timeout: 'RubricSidecarTimeoutError',
            http: 'RubricSidecarHttpError',
        },
        request: { task: 't', gradeLevel: 'C5', language: 'en' },
        response: { criteria: [] },
    },
    {
        name: 'teacher-training',
        modulePath: '../teacher-training-client',
        callFn: 'callSidecarTeacherTraining',
        urlPath: '/v1/teacher-training/advise',
        errors: {
            config: 'TeacherTrainingSidecarConfigError',
            timeout: 'TeacherTrainingSidecarTimeoutError',
            http: 'TeacherTrainingSidecarHttpError',
        },
        request: { topic: 't', language: 'en' },
        response: { advice: 'a' },
    },
    {
        name: 'exam-paper',
        modulePath: '../exam-paper-client',
        callFn: 'callSidecarExamPaper',
        urlPath: '/v1/exam-paper/generate',
        errors: {
            config: 'ExamPaperSidecarConfigError',
            timeout: 'ExamPaperSidecarTimeoutError',
            http: 'ExamPaperSidecarHttpError',
        },
        request: { subject: 's', gradeLevel: 'C5', language: 'en' },
        response: { sections: [] },
    },
    {
        name: 'video-storyteller',
        modulePath: '../video-storyteller-client',
        callFn: 'callSidecarVideoStoryteller',
        urlPath: '/v1/video-storyteller/recommend-queries',
        errors: {
            config: 'VideoStorytellerSidecarConfigError',
            timeout: 'VideoStorytellerSidecarTimeoutError',
            http: 'VideoStorytellerSidecarHttpError',
        },
        request: { topic: 't', language: 'en' },
        response: { queries: [] },
    },
    {
        name: 'visual-aid',
        modulePath: '../visual-aid-client',
        callFn: 'callSidecarVisualAid',
        urlPath: '/v1/visual-aid/generate',
        errors: {
            config: 'VisualAidSidecarConfigError',
            timeout: 'VisualAidSidecarTimeoutError',
            http: 'VisualAidSidecarHttpError',
        },
        request: { topic: 't', language: 'en' },
        response: { svg: '<svg/>' },
    },
    {
        name: 'voice-to-text',
        modulePath: '../voice-to-text-client',
        callFn: 'callSidecarVoiceToText',
        urlPath: '/v1/voice-to-text/transcribe',
        errors: {
            config: 'VoiceToTextSidecarConfigError',
            timeout: 'VoiceToTextSidecarTimeoutError',
            http: 'VoiceToTextSidecarHttpError',
        },
        request: { audio: 'b64', language: 'en' },
        response: { transcript: 't' },
    },
    {
        name: 'worksheet',
        modulePath: '../worksheet-client',
        callFn: 'callSidecarWorksheet',
        urlPath: '/v1/worksheet/generate',
        errors: {
            config: 'WorksheetSidecarConfigError',
            timeout: 'WorksheetSidecarTimeoutError',
            http: 'WorksheetSidecarHttpError',
        },
        request: { topic: 't', gradeLevel: 'C5', language: 'en' },
        response: { worksheet: {} },
    },
    {
        name: 'virtual-field-trip',
        modulePath: '../virtual-field-trip-client',
        callFn: 'callSidecarVirtualFieldTrip',
        urlPath: '/v1/virtual-field-trip/plan',
        errors: {
            config: 'VirtualFieldTripSidecarConfigError',
            timeout: 'VirtualFieldTripSidecarTimeoutError',
            http: 'VirtualFieldTripSidecarHttpError',
        },
        request: { destination: 'd', gradeLevel: 'C5', language: 'en' },
        response: { stops: [] },
    },
    {
        name: 'vidya',
        modulePath: '../vidya-client',
        callFn: 'callSidecarVidya',
        urlPath: '/v1/vidya/orchestrate',
        errors: {
            config: 'VidyaSidecarConfigError',
            timeout: 'VidyaSidecarTimeoutError',
            http: 'VidyaSidecarHttpError',
        },
        request: { message: 'hi', language: 'en' },
        response: { response: 'hello' },
    },
    {
        name: 'parent-message',
        modulePath: '../parent-message-client',
        callFn: 'callSidecarParentMessage',
        urlPath: '/v1/parent-message/generate',
        errors: {
            config: 'ParentMessageSidecarConfigError',
            timeout: 'ParentMessageSidecarTimeoutError',
            http: 'ParentMessageSidecarHttpError',
        },
        request: { topic: 't', language: 'en' },
        response: { message: 'm' },
    },
    {
        name: 'avatar-generator',
        modulePath: '../avatar-generator-client',
        callFn: 'callSidecarAvatar',
        urlPath: '/v1/avatar-generator/generate',
        errors: {
            config: 'AvatarSidecarConfigError',
            timeout: 'AvatarSidecarTimeoutError',
            http: 'AvatarSidecarHttpError',
        },
        request: { prompt: 'p' },
        response: { dataUri: 'data:image/png;base64,xx' },
    },
    {
        name: 'assessment-scanner',
        modulePath: '../assessment-scanner-client',
        callFn: 'callSidecarAssessmentScanner',
        urlPath: '/v1/assessment-scanner/grade',
        errors: {
            config: 'AssessmentScannerSidecarConfigError',
            timeout: 'AssessmentScannerSidecarTimeoutError',
            http: 'AssessmentScannerSidecarHttpError',
        },
        request: { imageBase64: 'xx', subject: 's', gradeLevel: 'C5', language: 'en' },
        response: { score: 80 },
    },
    {
        name: 'assignment-assessor',
        modulePath: '../assignment-assessor-client',
        callFn: 'callSidecarAssignmentAssessor',
        urlPath: '/v1/assignment-assessor/assess',
        errors: {
            config: 'AssignmentAssessorSidecarConfigError',
            timeout: 'AssignmentAssessorSidecarTimeoutError',
            http: 'AssignmentAssessorSidecarHttpError',
        },
        request: { submission: 's', rubric: {}, language: 'en' },
        response: { feedback: 'good' },
    },
    {
        name: 'community-persona-message',
        modulePath: '../community-persona-message-client',
        callFn: 'callSidecarCommunityPersonaMessage',
        urlPath: '/v1/community-persona-message/generate',
        errors: {
            config: 'CommunityPersonaMessageSidecarConfigError',
            timeout: 'CommunityPersonaMessageSidecarTimeoutError',
            http: 'CommunityPersonaMessageSidecarHttpError',
        },
        request: { persona: 'p', topic: 't', language: 'en' },
        response: { message: 'm' },
    },
    {
        name: 'parent-call',
        modulePath: '../parent-call-client',
        callFn: 'callSidecarReply',
        urlPath: '/v1/parent-call/reply',
        errors: {
            config: 'SidecarConfigError',
            timeout: 'SidecarTimeoutError',
            http: 'SidecarHttpError',
            behavioural: 'SidecarBehaviouralError',
        },
        request: { call_sid: 'CA1', transcript: 't' },
        response: { reply: 'r' },
        resetFn: '_resetTokenCacheForTest',
    },
];

interface FetchCallShape {
    url: string;
    init: {
        method: string;
        headers: Record<string, string>;
        body: string;
        signal: AbortSignal;
    };
}

function makeResponse(status: number, body: unknown): Response {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => text,
        json: async () => JSON.parse(text),
    } as unknown as Response;
}

function makeAbortError(): Error {
    const err = new Error('aborted');
    err.name = 'AbortError';
    return err;
}

describe.each(CLIENTS)('$name client', (spec) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mod: any;
    let signingMod: typeof import('../signing');

    beforeAll(async () => {
        mod = await import(spec.modulePath);
        signingMod = await import('../signing');
    });

    beforeEach(() => {
        signingMod._resetSigningKeyCacheForTest();
        if (spec.resetFn && typeof mod[spec.resetFn] === 'function') {
            mod[spec.resetFn]();
        }
    });

    it('returns parsed JSON on HTTP 200', async () => {
        const fetchImpl = jest.fn(async () =>
            makeResponse(200, spec.response),
        ) as unknown as typeof fetch;
        const out = await mod[spec.callFn](spec.request, { fetchImpl });
        expect(out).toEqual(spec.response);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it('hits the documented URL path', async () => {
        const calls: FetchCallShape[] = [];
        const fetchImpl = jest.fn(async (url: string, init: unknown) => {
            calls.push({ url, init: init as FetchCallShape['init'] });
            return makeResponse(200, spec.response);
        }) as unknown as typeof fetch;
        await mod[spec.callFn](spec.request, { fetchImpl });
        expect(calls[0].url).toBe(`https://sidecar.example${spec.urlPath}`);
        expect(calls[0].init.method).toBe('POST');
    });

    it('attaches Authorization, X-Content-Digest, X-Request-Timestamp, X-Request-ID', async () => {
        const calls: FetchCallShape[] = [];
        const fetchImpl = jest.fn(async (url: string, init: unknown) => {
            calls.push({ url, init: init as FetchCallShape['init'] });
            return makeResponse(200, spec.response);
        }) as unknown as typeof fetch;
        await mod[spec.callFn](spec.request, { fetchImpl, requestId: 'req-fixed-id' });
        const h = calls[0].init.headers;
        expect(h.Authorization).toBe('Bearer fake-oidc-token');
        expect(h['X-Content-Digest']).toMatch(/^sha256=[A-Za-z0-9+/=]+$/);
        expect(h['X-Request-Timestamp']).toMatch(/^\d+$/);
        expect(h['X-Request-ID']).toBe('req-fixed-id');
        expect(h['Content-Type']).toBe('application/json');
        expect(h['X-Firebase-AppCheck']).toBeUndefined();
    });

    it('digest matches HMAC of `<ts>:<rawBody>` using the signing secret', async () => {
        const calls: FetchCallShape[] = [];
        const fetchImpl = jest.fn(async (url: string, init: unknown) => {
            calls.push({ url, init: init as FetchCallShape['init'] });
            return makeResponse(200, spec.response);
        }) as unknown as typeof fetch;
        await mod[spec.callFn](spec.request, { fetchImpl });
        const h = calls[0].init.headers;
        const ts = h['X-Request-Timestamp'];
        const body = calls[0].init.body;
        const expected = crypto
            .createHmac('sha256', SECRET_VALUE)
            .update(`${ts}:`, 'utf8')
            .update(body, 'utf8')
            .digest('base64');
        expect(h['X-Content-Digest']).toBe(`sha256=${expected}`);
    });

    it('forwards App Check token when explicitly provided', async () => {
        const calls: FetchCallShape[] = [];
        const fetchImpl = jest.fn(async (url: string, init: unknown) => {
            calls.push({ url, init: init as FetchCallShape['init'] });
            return makeResponse(200, spec.response);
        }) as unknown as typeof fetch;
        await mod[spec.callFn](spec.request, {
            fetchImpl,
            appCheckToken: 'ac-token-xyz',
        });
        expect(calls[0].init.headers['X-Firebase-AppCheck']).toBe('ac-token-xyz');
    });

    it('omits App Check header when explicitly null', async () => {
        const calls: FetchCallShape[] = [];
        const fetchImpl = jest.fn(async (url: string, init: unknown) => {
            calls.push({ url, init: init as FetchCallShape['init'] });
            return makeResponse(200, spec.response);
        }) as unknown as typeof fetch;
        await mod[spec.callFn](spec.request, { fetchImpl, appCheckToken: null });
        expect(calls[0].init.headers['X-Firebase-AppCheck']).toBeUndefined();
    });

    // Token-cache test only runs for clients that expose a test-only
    // reset hook. Without the reset, the module-level cache from earlier
    // suites poisons the spy assertion.
    (spec.resetFn ? it : it.skip)(
        'caches the IdTokenClient across calls (same audience)',
        async () => {
            const fetchImpl = jest.fn(async () =>
                makeResponse(200, spec.response),
            ) as unknown as typeof fetch;
            await mod[spec.callFn](spec.request, { fetchImpl });
            await mod[spec.callFn](spec.request, { fetchImpl });
            expect(mockGetIdTokenClient).toHaveBeenCalledTimes(1);
        },
    );

    it('throws config error when NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL is unset', async () => {
        delete process.env.NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL;
        await expect(
            mod[spec.callFn](spec.request, {
                fetchImpl: jest.fn() as unknown as typeof fetch,
            }),
        ).rejects.toMatchObject({ name: spec.errors.config });
    });

    it('throws config error when SAHAYAKAI_AGENTS_AUDIENCE is unset', async () => {
        delete process.env.SAHAYAKAI_AGENTS_AUDIENCE;
        await expect(
            mod[spec.callFn](spec.request, {
                fetchImpl: jest.fn() as unknown as typeof fetch,
            }),
        ).rejects.toMatchObject({ name: spec.errors.config });
    });

    it('throws typed HTTP error on 4xx (status preserved)', async () => {
        const fetchImpl = jest.fn(async () =>
            makeResponse(400, 'bad request'),
        ) as unknown as typeof fetch;
        await expect(
            mod[spec.callFn](spec.request, { fetchImpl }),
        ).rejects.toMatchObject({ name: spec.errors.http, status: 400 });
    });

    it('throws typed HTTP error on 5xx (status preserved)', async () => {
        const fetchImpl = jest.fn(async () =>
            makeResponse(503, 'unavailable'),
        ) as unknown as typeof fetch;
        await expect(
            mod[spec.callFn](spec.request, { fetchImpl }),
        ).rejects.toMatchObject({ name: spec.errors.http, status: 503 });
    });

    it('throws typed timeout error when fetch aborts', async () => {
        const fetchImpl = jest.fn(async () => {
            throw makeAbortError();
        }) as unknown as typeof fetch;
        await expect(
            mod[spec.callFn](spec.request, { fetchImpl, timeoutMs: 50 }),
        ).rejects.toMatchObject({ name: spec.errors.timeout });
    });

    if (spec.errors.behavioural) {
        it('throws typed behavioural error on 502 with "behavioural guard" body', async () => {
            const fetchImpl = jest.fn(async () =>
                makeResponse(502, 'behavioural guard tripped (safety)'),
            ) as unknown as typeof fetch;
            await expect(
                mod[spec.callFn](spec.request, { fetchImpl }),
            ).rejects.toMatchObject({ name: spec.errors.behavioural });
        });
    }
});
