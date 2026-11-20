/**
 * @jest-environment node
 *
 * The Exam Paper and Quiz demo backends, end to end in-process:
 *
 *   /api/mcp-demo/{exam-paper,quiz} (route) → official MCP SDK client
 *     → Streamable HTTP → the REAL MCP handler (API-key auth, scope, rate limit)
 *     → create_exam_paper / create_quiz → Sahayak service (stub)
 *
 * Only the network hop (global fetch) is routed in-process. Proves each demo
 * really goes through its MCP endpoint with the server-held key, maps results
 * and errors, survives repeated calls, and never leaks the key or internals.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/logger/structured-logger', () => ({ StructuredLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { mintApiKey, MCP_API_KEYS_COLLECTION, type McpScope } from '@/lib/mcp/api-keys';
import { handleMcpHttpRequest, type McpCapabilityDefinition } from '@/lib/mcp/http-handler';
import { examPaperCapability } from '@/lib/mcp/exam-paper/capability';
import { quizCapability } from '@/lib/mcp/quiz/capability';
import type { DispatchedExamPaper } from '@/lib/sidecar/exam-paper-dispatch';
import type { DispatchedQuiz } from '@/lib/sidecar/quiz-dispatch';

const realFetchApi = jest.requireActual('whatwg-fetch');
const stubbed = { Headers: global.Headers, Request: global.Request, Response: global.Response, fetch: global.fetch };
beforeAll(() => Object.assign(global, { Headers: realFetchApi.Headers, Request: realFetchApi.Request, Response: realFetchApi.Response }));
afterAll(() => Object.assign(global, stubbed));

const PEPPER = 'demo-pepper-0123456789-abcdefghijklmnop';
const docs = new Map<string, Record<string, unknown>>();
const authDb = { collection: (c: string) => ({ doc: (id: string) => ({ get: async () => ({ exists: docs.has(`${c}/${id}`), data: () => docs.get(`${c}/${id}`) }) }) }) };
const env = process.env as Record<string, string | undefined>;
const mcpRateLimit = jest.fn(async () => undefined);
const mcpServerRequests: Request[] = [];

function serveMcp(url: string, capability: McpCapabilityDefinition, scope: McpScope) {
    docs.clear();
    docs.set('organizations/org-demo', { name: 'Sahayak demo' });
    const minted = mintApiKey({ orgId: 'org-demo', label: 'demo ui', scopes: [scope], createdBy: 'jest', pepper: PEPPER });
    docs.set(`${MCP_API_KEYS_COLLECTION}/${minted.keyId}`, minted.record as any);
    env.MCP_API_KEY_PEPPER = PEPPER;
    mcpRateLimit.mockClear();
    mcpServerRequests.length = 0;
    (global as any).fetch = async (u: string | URL, init?: RequestInit) => {
        const req = new Request(String(u), init);
        if (req.url !== url) throw new Error(`unexpected network call to ${req.url}`);
        mcpServerRequests.push(req.clone());
        return handleMcpHttpRequest(req, capability, { getDb: async () => authDb, rateLimit: mcpRateLimit });
    };
    return minted;
}
const signedIn = (init: RequestInit = {}) => ({ ...init, headers: { 'x-user-id': 'teacher-1', 'Content-Type': 'application/json', ...(init.headers as any) } });
const post = (route: { POST: (r: Request) => Promise<Response> }, body: unknown) =>
    route.POST(new Request('http://localhost/x', signedIn({ method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })));
const methodsOf = (reqs: Request[]) => Promise.all(reqs.map(async (r) => { const t = await r.text(); return t ? JSON.parse(t).method : r.method; }));

// ── Exam paper ──────────────────────────────────────────────────────────────

const PAPER = {
    title: 'CBSE Class 8 Science Unit Test — Force and Pressure', board: 'CBSE', subject: 'Science', gradeLevel: 'Class 8', duration: '45 Minutes', maxMarks: 2,
    generalInstructions: ['All questions are compulsory.'],
    sections: [{ name: 'Section A', label: 'MCQ', totalMarks: 2, questions: [
        { number: 1, source: 'PYQ 2023 Set 1', text: 'The SI unit of pressure is', marks: 1, options: ['(a) newton', '(b) pascal'], correctOption: 'b', answerKey: '(b) pascal', markingScheme: '1 mark' },
        { number: 2, source: 'New', text: 'Which force acts without contact?', marks: 1, options: ['(a) friction', '(b) magnetic'], correctOption: 'b', answerKey: '(b) magnetic', markingScheme: '1 mark' },
    ] }],
    blueprintSummary: { chapterWise: [{ chapter: 'Force and Pressure', marks: 2 }], difficultyWise: [{ level: 'moderate', percentage: 100 }] },
    pyqSources: [{ id: 'pyq_doc_secret', year: 2023, set: 'Set 1', chapter: 'Force and Pressure' }],
    validationWarnings: [], source: 'sidecar', decision: { bucket: 42 }, sidecarTelemetry: { sidecarVersion: 'secret-version' }, contentId: 'content-uuid-secret',
} as unknown as DispatchedExamPaper;
const examDispatch = jest.fn<Promise<DispatchedExamPaper>, [any]>();
const examEnabled = jest.fn(async () => true);
const examCapability = examPaperCapability({ dispatch: examDispatch, isEnabledFor: examEnabled, canAnchorWholeSyllabus: async () => true });
const EXAM_URL = 'http://127.0.0.1:3000/api/mcp/exam-paper';
const EXAM_ARGS = { board: 'CBSE', grade: 8, subject: 'Science', chapters: ['Force and Pressure'], difficulty: 'medium', language: 'English', max_marks: 5, duration_minutes: 45, include_answer_key: true, include_marking_scheme: true };

import * as examRoute from '@/app/api/mcp-demo/exam-paper/route';
import { getMcpDemoConfig as examConfig } from '@/lib/mcp-demo/exam-paper-client';

describe('route: /api/mcp-demo/exam-paper', () => {
    let minted: ReturnType<typeof mintApiKey>;
    beforeEach(() => {
        minted = serveMcp(EXAM_URL, examCapability, 'exam-paper');
        env.MCP_EXAM_PAPER_API_KEY = minted.apiKey;
        env.MCP_EXAM_PAPER_SERVER_URL = EXAM_URL;
        examDispatch.mockReset().mockResolvedValue(PAPER);
        examEnabled.mockReset().mockResolvedValue(true);
    });
    afterEach(() => { delete env.MCP_EXAM_PAPER_API_KEY; delete env.MCP_EXAM_PAPER_SERVER_URL; });

    it('POST generates THROUGH the MCP endpoint with the server key; a repeat call works too', async () => {
        for (let attempt = 0; attempt < 2; attempt++) {
            const res = await post(examRoute, EXAM_ARGS);
            expect(res.status).toBe(200);
            const body = await res.json();
            expect(body.paper).toMatchObject({ title: PAPER.title, board: 'CBSE', grade: 8, max_marks: 2, total_question_marks: 2 });
            expect(body.paper.sections[0].questions[0]).toMatchObject({ origin: 'previous_year', answer_key: '(b) pascal' });
            expect(body.mcp).toMatchObject({ name: 'sahayak-exam-paper', tool: 'create_exam_paper', protocol: 'Streamable HTTP' });
        }
        expect(examDispatch).toHaveBeenCalledTimes(2);
        expect(mcpServerRequests.every((r) => r.headers.get('authorization') === `Bearer ${minted.apiKey}`)).toBe(true);
        expect(await methodsOf(mcpServerRequests)).toEqual(expect.arrayContaining(['initialize', 'tools/call']));
        expect(mcpRateLimit).toHaveBeenCalledWith(`mcp_${minted.keyId}`);
    });

    it('never returns the API key, the MCP URL or service internals to the browser', async () => {
        const text = await (await post(examRoute, EXAM_ARGS)).text();
        for (const secret of [minted.apiKey, minted.keyId, PEPPER, EXAM_URL, '127.0.0.1', 'sidecar', 'secret-version', 'pyq_doc_secret', 'content-uuid-secret']) {
            expect(text).not.toContain(secret);
        }
    });

    it('GET reports MCP status with initialize + tools/list only', async () => {
        const res = await examRoute.GET(new Request('http://localhost/x', signedIn()));
        expect(await res.json()).toEqual({ configured: true, connected: true, server: { name: 'sahayak-exam-paper', version: '1.0.0', tool: 'create_exam_paper', protocol: 'Streamable HTTP' } });
        expect(examDispatch).not.toHaveBeenCalled();
    });

    it('MCP tool errors arrive as clean, categorised errors (not as an output-schema failure)', async () => {
        examEnabled.mockResolvedValueOnce(false);
        const off = await post(examRoute, EXAM_ARGS);
        expect(off.status).toBe(502);
        expect((await off.json()).error).toMatchObject({ category: 'capability_disabled', retryable: false, message: expect.stringContaining('switched off') });

        examDispatch.mockRejectedValueOnce(new Error('Rate limit exceeded. Please wait 3 minutes.'));
        const limited = await post(examRoute, EXAM_ARGS);
        expect(limited.status).toBe(429);
        expect((await limited.json()).error).toMatchObject({ category: 'rate_limited', retryable: true });
    });

    it('requires a signed-in user and rejects invalid input before any MCP traffic', async () => {
        expect((await examRoute.POST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(EXAM_ARGS) }))).status).toBe(401);
        expect((await examRoute.GET(new Request('http://localhost/x'))).status).toBe(401);
        for (const bad of [{ ...EXAM_ARGS, board: 'Hogwarts' }, { ...EXAM_ARGS, max_marks: 500 }, { ...EXAM_ARGS, org_id: 'x' }, 'not json']) {
            const res = await post(examRoute, bad);
            expect(res.status).toBe(400);
            expect((await res.json()).error.category).toBe('invalid_input');
        }
        expect(mcpServerRequests).toHaveLength(0);
    });

    it('config: key only from server env (dev key only under next dev); URL never from the request', () => {
        expect(examConfig({ MCP_EXAM_PAPER_API_KEY: 'k' })).toEqual({ apiKey: 'k', url: 'http://127.0.0.1:3000/api/mcp/exam-paper' });
        expect(examConfig({ NODE_ENV: 'production', MCP_LOCAL_DEV_API_KEY: 'dev' })).toBeNull();
        expect(examConfig({ NODE_ENV: 'development', MCP_LOCAL_DEV_API_KEY: 'dev' })!.apiKey).toBe('dev');
    });
});

// ── Quiz ────────────────────────────────────────────────────────────────────

const variant = (difficulty: 'easy' | 'medium' | 'hard') => ({
    title: `Fractions — ${difficulty}`, teacherInstructions: 'Use the board.', gradeLevel: 'Class 7', subject: 'Mathematics',
    questions: Array.from({ length: 5 }, (_, i) => ({
        questionText: `Q${i + 1}: What is 1/2 + 1/4?`, questionType: 'multiple_choice', options: ['1/6', '3/4', '2/6', '1/8'],
        correctAnswer: '3/4', explanation: '2/4 + 1/4 = 3/4.', difficultyLevel: difficulty,
    })),
});
const QUIZ = {
    easy: variant('easy'), medium: variant('medium'), hard: variant('hard'), topic: 'Fractions', gradeLevel: 'Class 7', subject: 'Mathematics',
    id: 'content-uuid-secret', source: 'sidecar', sidecarTelemetry: { sidecarVersion: 'secret-version' }, validationWarning: null,
} as unknown as DispatchedQuiz;
const quizDispatch = jest.fn<Promise<DispatchedQuiz>, [any]>();
const quizSafety = jest.fn((_text: string) => ({ safe: true } as { safe: boolean; reason?: string }));
const quizCap = quizCapability({ dispatch: quizDispatch, checkTopicSafety: quizSafety });
const QUIZ_URL = 'http://127.0.0.1:3000/api/mcp/quiz';
const QUIZ_ARGS = { topic: 'Fractions', grade: 7, subject: 'Mathematics', num_questions: 5, difficulty: 'medium', question_types: ['multiple_choice'], blooms_levels: ['Remember'], language: 'English' };

import * as quizRoute from '@/app/api/mcp-demo/quiz/route';
import { getMcpDemoConfig as quizConfig } from '@/lib/mcp-demo/quiz-client';

describe('route: /api/mcp-demo/quiz', () => {
    let minted: ReturnType<typeof mintApiKey>;
    beforeEach(() => {
        minted = serveMcp(QUIZ_URL, quizCap, 'quiz');
        env.MCP_QUIZ_API_KEY = minted.apiKey;
        env.MCP_QUIZ_SERVER_URL = QUIZ_URL;
        quizDispatch.mockReset().mockResolvedValue(QUIZ);
        quizSafety.mockReset().mockReturnValue({ safe: true });
    });
    afterEach(() => { delete env.MCP_QUIZ_API_KEY; delete env.MCP_QUIZ_SERVER_URL; });

    it('POST generates THROUGH the MCP endpoint with the server key (one requested level)', async () => {
        const res = await post(quizRoute, QUIZ_ARGS);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.quiz).toMatchObject({ topic: 'Fractions', grade: 7, subject: 'Mathematics', language: 'English' });
        expect(body.quiz.quizzes.map((q: any) => q.difficulty)).toEqual(['medium']);
        expect(body.quiz.quizzes[0].questions[0]).toMatchObject({ number: 1, type: 'multiple_choice', correct_answer: '3/4' });
        expect(body.mcp).toMatchObject({ name: 'sahayak-quiz', tool: 'create_quiz', protocol: 'Streamable HTTP' });
        expect(mcpServerRequests.every((r) => r.headers.get('authorization') === `Bearer ${minted.apiKey}`)).toBe(true);
        expect(await methodsOf(mcpServerRequests)).toEqual(expect.arrayContaining(['initialize', 'tools/call']));
        expect(mcpRateLimit).toHaveBeenCalledWith(`mcp_${minted.keyId}`);
    });

    it('never returns the API key, the MCP URL or service internals to the browser', async () => {
        const text = await (await post(quizRoute, QUIZ_ARGS)).text();
        for (const secret of [minted.apiKey, minted.keyId, PEPPER, QUIZ_URL, '127.0.0.1', 'sidecar', 'secret-version', 'content-uuid-secret']) {
            expect(text).not.toContain(secret);
        }
    });

    it('GET reports MCP status with initialize + tools/list only', async () => {
        const res = await quizRoute.GET(new Request('http://localhost/x', signedIn()));
        expect(await res.json()).toEqual({ configured: true, connected: true, server: { name: 'sahayak-quiz', version: '1.0.0', tool: 'create_quiz', protocol: 'Streamable HTTP' } });
        expect(quizDispatch).not.toHaveBeenCalled();
    });

    it('MCP tool errors arrive as clean, categorised errors', async () => {
        quizSafety.mockReturnValueOnce({ safe: false, reason: 'unsafe' });
        const refused = await post(quizRoute, { ...QUIZ_ARGS, topic: 'Something unsafe' });
        expect(refused.status).toBe(422);
        expect((await refused.json()).error).toMatchObject({ category: 'content_policy', retryable: false });
        expect(quizDispatch).not.toHaveBeenCalled();
    });

    it('requires a signed-in user and rejects invalid input before any MCP traffic', async () => {
        expect((await quizRoute.POST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(QUIZ_ARGS) }))).status).toBe(401);
        for (const bad of [{ ...QUIZ_ARGS, grade: 0 }, { ...QUIZ_ARGS, num_questions: 50 }, { ...QUIZ_ARGS, tenant: 'x' }, 'not json']) {
            const res = await post(quizRoute, bad);
            expect(res.status).toBe(400);
            expect((await res.json()).error.category).toBe('invalid_input');
        }
        expect(mcpServerRequests).toHaveLength(0);
    });

    it('503 when no MCP key is configured', async () => {
        delete env.MCP_QUIZ_API_KEY;
        expect((await post(quizRoute, QUIZ_ARGS)).status).toBe(503);
        expect(quizConfig({ NODE_ENV: 'production', MCP_LOCAL_DEV_API_KEY: 'dev' })).toBeNull();
        expect(quizConfig({ MCP_QUIZ_API_KEY: 'k', PORT: '3100' })!.url).toBe('http://127.0.0.1:3100/api/mcp/quiz');
    });
});
