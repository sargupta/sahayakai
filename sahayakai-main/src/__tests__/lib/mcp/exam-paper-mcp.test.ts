/**
 * @jest-environment node
 *
 * Sahayak Exam Paper MCP — tested from the outside, the way an external
 * school's AI agent uses it: the OFFICIAL MCP SDK client speaks real
 * Streamable HTTP to the real shared handler; only the network hop is
 * replaced by an in-process fetch.
 *
 *   SDK Client → Streamable HTTP → handleMcpHttpRequest → auth (API key)
 *     → create_exam_paper → Sahayak exam-paper service (stubbed here; see
 *       exam-paper-integration.test.ts for the real dispatcher)
 */
jest.mock('server-only', () => ({}));
const logInfo = jest.fn();
const logWarn = jest.fn();
jest.mock('@/lib/logger/structured-logger', () => ({
    StructuredLogger: { info: (...a: unknown[]) => logInfo(...a), warn: (...a: unknown[]) => logWarn(...a), error: jest.fn() },
}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mintApiKey, MCP_API_KEYS_COLLECTION, type McpScope } from '@/lib/mcp/api-keys';
import { handleMcpHttpRequest, type McpCapabilityDefinition, type McpHandlerDeps } from '@/lib/mcp/http-handler';
import { examPaperCapability } from '@/lib/mcp/exam-paper/capability';
import { ExamPaperResult } from '@/lib/mcp/exam-paper/schema';
import { lessonPlannerCapability } from '@/lib/mcp/lesson-planner/capability';
import type { DispatchedExamPaper } from '@/lib/sidecar/exam-paper-dispatch';

const realFetchApi = jest.requireActual('whatwg-fetch');
const stubbedFetchApi = { Headers: global.Headers, Request: global.Request, Response: global.Response };
beforeAll(() => Object.assign(global, { Headers: realFetchApi.Headers, Request: realFetchApi.Request, Response: realFetchApi.Response }));
afterAll(() => Object.assign(global, stubbedFetchApi));

const PEPPER = 'test-pepper-0123456789-abcdefghijklmnop';
const URL_ = 'https://sahayak.test/api/mcp/exam-paper';

const docs = new Map<string, Record<string, unknown>>();
const fakeDb = {
    collection: (c: string) => ({
        doc: (id: string) => ({ get: async () => ({ exists: docs.has(`${c}/${id}`), data: () => docs.get(`${c}/${id}`) }) }),
    }),
};
function issue(orgId: string, scopes: McpScope[], status: 'active' | 'revoked' = 'active') {
    const { apiKey, keyId, record } = mintApiKey({ orgId, label: 'test', scopes, createdBy: 'jest', pepper: PEPPER });
    docs.set(`${MCP_API_KEYS_COLLECTION}/${keyId}`, { ...record, status });
    return { apiKey, keyId };
}

// ── the existing Sahayak service, as dispatchExamPaper returns it ───────────
const SERVICE_PAPER = {
    title: 'CBSE Class 8 Science Unit Test — Force and Pressure',
    board: 'CBSE', subject: 'Science', gradeLevel: 'Class 8', duration: '45 Minutes', maxMarks: 10,
    generalInstructions: ['All questions are compulsory.', 'Marks are shown against each question.'],
    sections: [
        {
            name: 'Section A', label: 'Multiple Choice Questions', totalMarks: 2,
            questions: [
                { number: 1, source: 'PYQ 2023 Set 1', text: 'The SI unit of pressure is', marks: 1, options: ['(a) newton', '(b) pascal', '(c) joule', '(d) watt'], correctOption: 'b', answerKey: '(b) pascal', markingScheme: '1 mark for correct option' },
                { number: 2, source: 'New', text: 'Which force acts without contact?', marks: 1, options: ['(a) friction', '(b) muscular', '(c) magnetic', '(d) tension'], correctOption: 'c', answerKey: '(c) magnetic', markingScheme: '1 mark' },
            ],
        },
        {
            name: 'Section B', label: 'Short Answer Questions', totalMarks: 8,
            questions: [
                { number: 3, source: 'New', text: 'Why are school bag straps made wide?', marks: 3, correctOption: '', answerKey: 'Wider area → less pressure on shoulders.', markingScheme: 'Area (1) + pressure relation (1) + conclusion (1)', internalChoice: 'Why does a sharp knife cut better?' },
                { number: 4, source: 'New', text: 'State two effects of force with examples.', marks: 5, correctOption: '', answerKey: 'Change in shape; change in speed/direction.', markingScheme: '2.5 marks per effect' },
            ],
        },
    ],
    blueprintSummary: { chapterWise: [{ chapter: 'Force and Pressure', marks: 10 }], difficultyWise: [{ level: 'moderate', percentage: 60 }, { level: 'easy', percentage: 40 }] },
    pyqSources: [{ id: 'pyq_doc_8f2c1', year: 2023, set: 'Set 1', chapter: 'Force and Pressure' }],
    answerKeyCompleteness: { requestedAnswerKey: true, requestedMarkingScheme: true, missingBefore: 0, filledByStamp: 0, filledByReprompt: 0, filledByPlaceholder: 0 },
    marksReconciliation: { expected: 10, actual: 10, repaired: false, attempts: 1 },
    validationWarnings: [{ invalid: false, lenient: true, message: 'ok' }],
    // internal fields that must NEVER reach an external client:
    source: 'sidecar',
    decision: { mode: 'full', reason: 'flag_full', bucket: 42, configuredMode: 'full' },
    sidecarTelemetry: { sidecarVersion: 'phase-9.2.0', latencyMs: 31337, modelUsed: 'gemini-internal' },
    contentId: 'content-uuid-should-not-leak',
} as unknown as DispatchedExamPaper;

const dispatch = jest.fn<Promise<DispatchedExamPaper>, [any]>();
const isEnabledFor = jest.fn<Promise<boolean>, [string]>();
const canAnchorWholeSyllabus = jest.fn<Promise<boolean>, [string, string, string]>();
const rateLimit = jest.fn<Promise<void>, [string]>();
const deps: McpHandlerDeps = { getDb: async () => fakeDb, rateLimit };
const capability = examPaperCapability({ dispatch, isEnabledFor, canAnchorWholeSyllabus });
const callServer = (req: Request, cap: McpCapabilityDefinition = capability) => handleMcpHttpRequest(req, cap, deps);

async function connect(apiKey: string, extraHeaders: Record<string, string> = {}) {
    const client = new Client({ name: 'external-school-agent', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL(URL_), {
        requestInit: { headers: { Authorization: `Bearer ${apiKey}`, ...extraHeaders } },
        fetch: async (url, init) => callServer(new Request(url, init)),
    }));
    return client;
}
const rawPost = (headers: Record<string, string>, body: unknown = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }, cap?: McpCapabilityDefinition) =>
    callServer(new Request(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) }), cap);

const VALID = { board: 'CBSE', grade: 8, subject: 'Science', chapters: ['Force and Pressure'], difficulty: 'medium', max_marks: 10, duration_minutes: 45 };
let keyA: { apiKey: string; keyId: string };

beforeEach(() => {
    docs.clear();
    docs.set('organizations/org-a', { name: 'School A' });
    docs.set('organizations/org-b', { name: 'School B' });
    keyA = issue('org-a', ['exam-paper']);
    process.env.MCP_API_KEY_PEPPER = PEPPER;
    dispatch.mockReset().mockResolvedValue(SERVICE_PAPER);
    isEnabledFor.mockReset().mockResolvedValue(true);
    canAnchorWholeSyllabus.mockReset().mockResolvedValue(true);
    rateLimit.mockReset().mockResolvedValue(undefined);
    logInfo.mockReset();
    logWarn.mockReset();
});

describe('discovery — what an external agent sees', () => {
    it('identifies itself and exposes exactly one, well-described tool', async () => {
        const client = await connect(keyA.apiKey);
        expect(client.getServerVersion()).toMatchObject({ name: 'sahayak-exam-paper', version: '1.0.0' });
        expect(client.getInstructions()).toMatch(/exam papers/i);
        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name)).toEqual(['create_exam_paper']);
        const tool = tools[0];
        expect(tool.description).toMatch(/not for a quick quiz or a lesson plan/);
        expect(tool.description).toMatch(/30–75 seconds/);
        expect(tool.inputSchema.required).toEqual(['grade', 'subject']);
        expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
        expect(Object.keys(tool.inputSchema.properties ?? {})).toEqual([
            'board', 'grade', 'subject', 'chapters', 'difficulty', 'language', 'max_marks', 'duration_minutes', 'pyq_percent', 'include_answer_key', 'include_marking_scheme',
        ]);
        expect(tool.outputSchema).toBeDefined();
        expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
        expect(rateLimit).not.toHaveBeenCalled();
        await client.close();
    });
});

describe('create_exam_paper — success path', () => {
    it('returns a structured, validated paper and calls the existing service headlessly', async () => {
        const client = await connect(keyA.apiKey);
        const res = await client.callTool({ name: 'create_exam_paper', arguments: VALID });
        expect(res.isError).toBeFalsy();
        const paper = ExamPaperResult.parse(res.structuredContent);
        expect(paper).toMatchObject({ board: 'CBSE', grade: 8, subject: 'Science', max_marks: 10, total_question_marks: 10, duration: '45 Minutes', review_notes: [] });
        expect(paper.sections.map((s) => s.questions.length)).toEqual([2, 2]);
        expect(paper.sections[0].questions[0]).toMatchObject({ origin: 'previous_year', source_note: 'PYQ 2023 Set 1', correct_option: 'b', options: expect.arrayContaining(['(b) pascal']) });
        expect(paper.sections[1].questions[0]).toMatchObject({ origin: 'new', source_note: null, correct_option: null, internal_choice: 'Why does a sharp knife cut better?' });
        expect(paper.previous_year_sources).toEqual([{ year: 2023, set: 'Set 1', chapter: 'Force and Pressure' }]);
        expect((res.content as any)[0].text).toMatch(/^# CBSE Class 8 Science Unit Test/);

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch.mock.calls[0][0]).toEqual({
            userId: '', // the service's headless caller: no Library write, no teacher profile/context, no teacher rate limit
            board: 'CBSE', gradeLevel: 'Class 8', subject: 'Science', chapters: ['Force and Pressure'], language: 'English',
            difficulty: 'moderate', // "medium" alias
            includeAnswerKey: true, includeMarkingScheme: true, maxMarks: 10, duration: 45,
        });
        expect(isEnabledFor).toHaveBeenCalledWith('mcp:org-a');
        expect(rateLimit).toHaveBeenCalledWith(`mcp_${keyA.keyId}`);
        await client.close();
    });

    it('never exposes internal service fields', async () => {
        const client = await connect(keyA.apiKey);
        const wire = JSON.stringify(await client.callTool({ name: 'create_exam_paper', arguments: VALID }));
        for (const internal of ['sidecar', 'decision', 'bucket', 'Telemetry', 'phase-9.2.0', 'gemini-internal', 'content-uuid', 'pyq_doc_8f2c1', 'marksReconciliation', 'answerKeyCompleteness', 'validationWarnings', 'userId']) {
            expect(wire).not.toContain(internal);
        }
        await client.close();
    });

    it('omits answers and marking schemes when not requested', async () => {
        const client = await connect(keyA.apiKey);
        const res: any = await client.callTool({ name: 'create_exam_paper', arguments: { ...VALID, include_answer_key: false, include_marking_scheme: false } });
        const qs = res.structuredContent.sections.flatMap((s: any) => s.questions);
        expect(qs.every((q: any) => q.answer_key === null && q.marking_scheme === null)).toBe(true);
        expect(dispatch.mock.calls[0][0]).toMatchObject({ includeAnswerKey: false, includeMarkingScheme: false });
        await client.close();
    });

    it('surfaces what a teacher must review (syllabus warning, placeholders, missing answers, marks drift)', async () => {
        const paper = JSON.parse(JSON.stringify(SERVICE_PAPER));
        paper.validationWarnings = [{ invalid: true, lenient: false, message: 'Did you mean "Exploring Forces"?', input: { gradeLevel: 'Class 8', subject: 'Science', chapter: 'Force and Pressure' } }];
        paper.answerKeyCompleteness.filledByPlaceholder = 2;
        delete paper.sections[1].questions[1].answerKey;
        paper.sections[1].questions[1].marks = 4;
        paper.duration = '1 Hour';
        dispatch.mockResolvedValueOnce(paper);
        const client = await connect(keyA.apiKey);
        const res: any = await client.callTool({ name: 'create_exam_paper', arguments: VALID });
        expect(res.structuredContent.review_notes).toEqual([
            'Chapter "Force and Pressure" was not found in the Class 8 Science syllabus. Did you mean "Exploring Forces"?',
            '2 answers or marking schemes could not be generated reliably and need teacher review.',
            '1 question has no answer key; add it before use.',
            'Question marks add up to 9, not 10; adjust before use.',
            'The paper header says "1 Hour", not the requested 45 minutes; adjust before use.',
        ]);
        await client.close();
    });

    it('a whole-syllabus paper (no chapters) is allowed where Sahayak can anchor it', async () => {
        const client = await connect(keyA.apiKey);
        const res: any = await client.callTool({ name: 'create_exam_paper', arguments: { grade: 10, subject: 'Mathematics' } });
        expect(res.isError).toBeFalsy();
        expect(canAnchorWholeSyllabus).toHaveBeenCalledWith('CBSE', 'Class 10', 'Mathematics');
        expect(dispatch.mock.calls[0][0]).toMatchObject({ board: 'CBSE', chapters: [], difficulty: 'mixed' });
        await client.close();
    });
});

describe('create_exam_paper — errors an agent can act on', () => {
    async function errorText(args: Record<string, unknown>) {
        const client = await connect(keyA.apiKey);
        try {
            const res: any = await client.callTool({ name: 'create_exam_paper', arguments: args });
            expect(res.isError).toBe(true);
            return JSON.stringify(res.content);
        } catch (e) {
            return String((e as Error).message);
        } finally {
            await client.close();
        }
    }

    it.each([
        [{ ...VALID, grade: 0 }, 'Invalid grade. Expected an integer between 1 and 12.'],
        [{ subject: 'Science' }, 'Missing grade.'],
        [{ grade: 8 }, 'Missing subject'],
        [{ ...VALID, board: 'Hogwarts' }, 'Unsupported board.'],
        [{ ...VALID, difficulty: 'insane' }, 'Invalid difficulty.'],
        [{ ...VALID, language: 'French' }, 'Unsupported language.'],
        [{ ...VALID, max_marks: 500 }, 'max_marks must be between 5 and 100.'],
        [{ ...VALID, duration_minutes: 5 }, 'duration_minutes must be between 10 and 180.'],
        [{ ...VALID, chapters: Array(21).fill('Force') }, 'At most 20 chapters per paper.'],
        [{ ...VALID, exam_type: 'half-yearly' }, 'exam_type'],
        [{ ...VALID, org_id: 'org-b' }, 'org_id'],
        [{ ...VALID, userId: 'teacher-of-org-b' }, 'userId'],
    ])('rejects %j with a clear message and never calls the service', async (args, expected) => {
        expect(await errorText(args)).toContain(expected);
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('a whole-syllabus request Sahayak cannot anchor asks for chapters (invalid_input)', async () => {
        canAnchorWholeSyllabus.mockResolvedValueOnce(false);
        const client = await connect(keyA.apiKey);
        const res: any = await client.callTool({ name: 'create_exam_paper', arguments: { board: 'CBSE', grade: 3, subject: 'Sanskrit' } });
        expect(res.structuredContent.error).toMatchObject({ category: 'invalid_input', retryable: false });
        expect(res.structuredContent.error.message).toContain('"chapters"');
        expect(dispatch).not.toHaveBeenCalled();
        await client.close();
    });

    it('respects Sahayak\'s kill switch for exam papers (capability_disabled)', async () => {
        isEnabledFor.mockResolvedValueOnce(false);
        const client = await connect(keyA.apiKey);
        const res: any = await client.callTool({ name: 'create_exam_paper', arguments: VALID });
        expect(res.structuredContent.error).toMatchObject({ category: 'capability_disabled', retryable: false });
        expect(dispatch).not.toHaveBeenCalled();
        await client.close();
    });

    const named = (name: string, extra: Record<string, unknown> = {}) => Object.assign(new Error('x'), { name }, extra);
    it.each([
        [named('ExamPaperGenerationInProgressError'), 'timeout', true, /75 seconds/],
        [named('SchemaValidationError', { errorCode: 'AI-SCHEMA-001' }), 'generation_failed', true, /well-structured/],
        [new Error('Safety Violation: Topic contains restricted content'), 'content_policy', false, /./],
        [new Error('Rate limit exceeded. Please wait 7 minutes.'), 'rate_limited', true, /./],
        [new Error('429 RESOURCE_EXHAUSTED from model provider'), 'upstream_unavailable', true, /./],
    ])('service failure %s → %s', async (thrown, category, retryable, msg) => {
        dispatch.mockRejectedValueOnce(thrown);
        const client = await connect(keyA.apiKey);
        const res: any = await client.callTool({ name: 'create_exam_paper', arguments: VALID });
        expect(res.isError).toBe(true);
        expect(res.structuredContent.error).toMatchObject({ category, retryable });
        expect(res.structuredContent.error.message).toMatch(msg);
        await client.close();
    });

    it('an unexpected internal error leaks no internals', async () => {
        dispatch.mockRejectedValueOnce(Object.assign(new TypeError("Cannot read properties of undefined (reading 'sections')"), {
            stack: 'TypeError: ...\n    at /srv/app/src/lib/sidecar/exam-paper-dispatch.ts:530:9 (key=AIzaSyFAKEFAKE)',
        }));
        const client = await connect(keyA.apiKey);
        const res: any = await client.callTool({ name: 'create_exam_paper', arguments: VALID });
        const wire = JSON.stringify(res);
        expect(res.structuredContent.error).toMatchObject({ category: 'internal', retryable: true });
        for (const leak of ['TypeError', 'undefined', '/srv', 'exam-paper-dispatch', 'AIza', 'stack']) expect(wire).not.toContain(leak);
        await client.close();
    });
});

describe('security', () => {
    it('rejects missing, malformed, unknown, revoked and orphaned keys (401) and fails closed without a pepper (503)', async () => {
        expect((await rawPost({})).status).toBe(401);
        expect((await rawPost({ Authorization: 'Bearer not-a-key' })).status).toBe(401);
        expect((await rawPost({ Authorization: `Bearer sk_sahayak_0123456789abcdef_${'A'.repeat(43)}` })).status).toBe(401);
        expect((await rawPost({ Authorization: `Bearer ${issue('org-a', ['exam-paper'], 'revoked').apiKey}` })).status).toBe(401);
        expect((await rawPost({ Authorization: `Bearer ${issue('org-gone', ['exam-paper']).apiKey}` })).status).toBe(401);
        delete process.env.MCP_API_KEY_PEPPER;
        expect((await rawPost({ Authorization: `Bearer ${keyA.apiKey}` })).status).toBe(503);
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('tenant comes only from the key: org/user headers are ignored and the service gets no user', async () => {
        const client = await connect(keyA.apiKey, { 'X-Org-Id': 'org-b', 'X-User-Id': 'teacher-of-org-b' });
        await client.callTool({ name: 'create_exam_paper', arguments: VALID });
        const call = logInfo.mock.calls.find(([msg]) => msg === 'MCP tool call')!;
        expect(call[1]).toMatchObject({ operation: 'create_exam_paper', metadata: { orgId: 'org-a', keyId: keyA.keyId, capability: 'exam-paper' } });
        expect(dispatch.mock.calls[0][0].userId).toBe('');
        expect(isEnabledFor).toHaveBeenCalledWith('mcp:org-a');
        await client.close();
    });

    it('two schools are isolated: separate rate-limit buckets and attribution', async () => {
        const keyB = issue('org-b', ['exam-paper']);
        for (const k of [keyA, keyB]) {
            const client = await connect(k.apiKey);
            await client.callTool({ name: 'create_exam_paper', arguments: VALID });
            await client.close();
        }
        expect(rateLimit.mock.calls.map(([b]) => b)).toEqual([`mcp_${keyA.keyId}`, `mcp_${keyB.keyId}`]);
        expect(logInfo.mock.calls.filter(([m]) => m === 'MCP tool call').map(([, c]) => c.metadata.orgId)).toEqual(['org-a', 'org-b']);
    });

    it('never returns or logs secrets, keys or the requested chapters', async () => {
        const client = await connect(keyA.apiKey);
        const res = await client.callTool({ name: 'create_exam_paper', arguments: { ...VALID, chapters: ['Ramesh in 8B special chapter'] } });
        await client.close();
        const secretPart = keyA.apiKey.split('_').pop()!;
        const storedHash = (docs.get(`${MCP_API_KEYS_COLLECTION}/${keyA.keyId}`) as any).secretHash;
        const logs = JSON.stringify([...logInfo.mock.calls, ...logWarn.mock.calls]);
        for (const s of [PEPPER, secretPart, storedHash, keyA.apiKey]) {
            expect(JSON.stringify(res)).not.toContain(s);
            expect(logs).not.toContain(s);
        }
        expect(logs).not.toContain('Ramesh');
    });
});

describe('scope isolation between Sahayak MCP servers', () => {
    const lessonPlanner = lessonPlannerCapability(jest.fn() as any);
    const scopeError = async (r: Response) => ({ status: r.status, message: (await r.json()).error?.message as string });

    it('a lesson-planner-only key cannot use the exam-paper server (403)', async () => {
        const lp = issue('org-a', ['lesson-planner']);
        const r = await scopeError(await rawPost({ Authorization: `Bearer ${lp.apiKey}` }));
        expect(r).toEqual({ status: 403, message: expect.stringContaining('not enabled for the "exam-paper" capability') });
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('an exam-paper-only key cannot use the lesson-planner server (403)', async () => {
        const r = await scopeError(await rawPost({ Authorization: `Bearer ${keyA.apiKey}` }, undefined, lessonPlanner));
        expect(r).toEqual({ status: 403, message: expect.stringContaining('not enabled for the "lesson-planner" capability') });
    });

    it('a key holding both scopes reaches both servers, each exposing only its own tool', async () => {
        const both = issue('org-a', ['lesson-planner', 'exam-paper']);
        const list = async (cap?: McpCapabilityDefinition) =>
            (await (await rawPost({ Authorization: `Bearer ${both.apiKey}` }, undefined, cap)).json()).result.tools.map((t: any) => t.name);
        expect(await list()).toEqual(['create_exam_paper']);
        expect(await list(lessonPlanner)).toEqual(['create_lesson_plan']);
    });

    it('calling another server\'s tool by name is not possible', async () => {
        const res = await rawPost({ Authorization: `Bearer ${keyA.apiKey}` }, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_lesson_plan', arguments: { topic: 'Fractions', grade: 5 } } });
        const body = await res.json();
        expect(JSON.stringify(body)).toMatch(/not found/i);
        expect(dispatch).not.toHaveBeenCalled();
    });
});
