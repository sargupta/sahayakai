/**
 * @jest-environment node
 *
 * Integration: external MCP client → MCP server → the REAL Sahayak quiz
 * dispatcher (`dispatchQuiz`) AND the real quiz service (`generateQuiz`:
 * grade defaults, NCERT check, three variants, Storage + Library
 * persistence), with real persist helpers against a recording fake
 * Firestore/Storage. Only the model calls (the Genkit prompt flow and the
 * sidecar HTTP client) are stubbed.
 *
 * Proves the MCP is an adapter over the existing service and that a headless
 * call writes nothing, reads no teacher data and meters no teacher usage.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/logger/structured-logger', () => ({ StructuredLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), startTimer: () => ({ end: jest.fn(), stop: jest.fn() }) } }));

const writes: string[] = [];
const docRef = (p: string): any => ({
    id: p.split('/').pop(),
    get: async () => ({ exists: false, data: () => undefined }),
    set: async () => { writes.push(p); },
    update: async () => { writes.push(p); },
    collection: (c: string) => colRef(`${p}/${c}`),
});
const colRef = (p: string): any => ({ doc: (id: string) => docRef(`${p}/${id}`), add: async () => { writes.push(`${p}/<auto>`); } });
jest.mock('@/lib/firebase-admin', () => ({
    getDb: async () => ({ collection: (c: string) => colRef(c) }),
    getStorageInstance: async () => ({ bucket: () => ({ file: (p: string) => ({ save: async () => { writes.push(`storage:${p}`); } }) }) }),
}));
jest.mock('firebase-admin/firestore', () => ({
    FieldValue: { serverTimestamp: () => 'TS', increment: (n: number) => n, arrayUnion: (...v: unknown[]) => v },
    Timestamp: { now: () => ({ toDate: () => new Date() }), fromDate: (d: Date) => ({ toDate: () => d }) },
}));
const mockDbAdapter = { saveContent: jest.fn(async () => { writes.push('dbAdapter.saveContent'); }), getUser: jest.fn(async () => null) };
jest.mock('@/lib/db/adapter', () => ({ dbAdapter: mockDbAdapter }));

const mockMode = { mode: 'off' as 'off' | 'full' };
jest.mock('@/lib/feature-flags', () => ({
    getFeatureFlags: jest.fn(async () => ({ quizSidecarMode: mockMode.mode, quizSidecarPercent: 0 })),
}));
const mockTeacherRateLimit = jest.fn(async () => undefined);
jest.mock('@/lib/server-safety', () => ({ checkServerRateLimit: (...a: unknown[]) => mockTeacherRateLimit(...(a as [])) }));
const mockTeacherContext = jest.fn(async () => 'Teacher: 12 years experience');
jest.mock('@/lib/teacher-context', () => ({ getTeacherContextLine: (...a: unknown[]) => mockTeacherContext(...(a as [])) }));
jest.mock('@/lib/sidecar/shadow-diff-writer', () => ({ writeAgentShadowDiff: jest.fn() }));
jest.mock('@/lib/sidecar/canary-shadow-diff', () => ({ shouldRunCanaryShadowDiff: () => false }));

// Model calls only: the Genkit prompt flow (one call per difficulty) and the sidecar client.
jest.mock('@/ai/flows/quiz-definitions', () => ({ quizGeneratorFlow: jest.fn() }));
function sidecarErrors(prefix: string) {
    const make = (name: string) => class extends Error { constructor(m?: string) { super(m ?? name); this.name = name; } };
    return Object.fromEntries(['ConfigError', 'TimeoutError', 'HttpError', 'BehaviouralError'].map((s) => [`${prefix}${s}`, make(`${prefix}${s}`)]));
}
jest.mock('@/lib/sidecar/quiz-client', () => ({ callSidecarQuiz: jest.fn(), ...sidecarErrors('QuizSidecar') }));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { toolErrorOf } from '@/lib/mcp/errors';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { quizGeneratorFlow } from '@/ai/flows/quiz-definitions';
import { callSidecarQuiz } from '@/lib/sidecar/quiz-client';
import { dispatchQuiz } from '@/lib/sidecar/quiz-dispatch';
import { validateTopicSafety } from '@/lib/safety';
import { mintApiKey, MCP_API_KEYS_COLLECTION } from '@/lib/mcp/api-keys';
import { handleMcpHttpRequest } from '@/lib/mcp/http-handler';
import { quizCapability } from '@/lib/mcp/quiz/capability';
import { QuizResult } from '@/lib/mcp/quiz/schema';

const realFetchApi = jest.requireActual('whatwg-fetch');
const stubbed = { Headers: global.Headers, Request: global.Request, Response: global.Response };
beforeAll(() => Object.assign(global, { Headers: realFetchApi.Headers, Request: realFetchApi.Request, Response: realFetchApi.Response }));
afterAll(() => Object.assign(global, stubbed));

const PEPPER = 'integration-pepper-0123456789-abcdefghij';
const keys = new Map<string, Record<string, unknown>>();
const authDb = {
    collection: (c: string) => ({ doc: (id: string) => ({ get: async () => ({ exists: keys.has(`${c}/${id}`), data: () => keys.get(`${c}/${id}`) }) }) }),
};
const mcpRateLimit = jest.fn(async () => undefined);
const capability = quizCapability({ dispatch: dispatchQuiz, checkTopicSafety: validateTopicSafety });

const variant = (difficulty: string) => ({
    title: `Fractions (${difficulty})`, teacherInstructions: 'Use the board.', gradeLevel: 'Class 7', subject: 'Mathematics',
    questions: Array.from({ length: 5 }, (_, i) => ({ questionText: `Q${i + 1}`, questionType: 'short_answer', correctAnswer: '3/4', explanation: 'Because.', difficultyLevel: difficulty })),
});

let apiKey: string;
beforeEach(() => {
    writes.length = 0;
    keys.clear();
    keys.set('organizations/org-a', { name: 'School A' });
    const minted = mintApiKey({ orgId: 'org-a', label: 'it', scopes: ['quiz'], createdBy: 'jest', pepper: PEPPER });
    keys.set(`${MCP_API_KEYS_COLLECTION}/${minted.keyId}`, minted.record as any);
    apiKey = minted.apiKey;
    process.env.MCP_API_KEY_PEPPER = PEPPER;
    (quizGeneratorFlow as unknown as jest.Mock).mockReset().mockImplementation(async (input: any) => variant(input.targetDifficulty));
    (callSidecarQuiz as jest.Mock).mockReset().mockResolvedValue({
        easy: variant('easy'), medium: variant('medium'), hard: variant('hard'), topic: 'Fractions', gradeLevel: 'Class 7', subject: 'Mathematics',
        sidecarVersion: 'v', latencyMs: 1, modelUsed: 'm', variantsGenerated: 3,
    });
    mockTeacherRateLimit.mockClear();
    mockTeacherContext.mockClear();
    mockDbAdapter.saveContent.mockClear();
    mockDbAdapter.getUser.mockClear();
    mcpRateLimit.mockClear();
});

async function call(args: Record<string, unknown>) {
    const client = new Client({ name: 'school-lms-agent', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL('https://sahayak.test/api/mcp/quiz'), {
        requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
        fetch: async (url, init) => handleMcpHttpRequest(new Request(url, init), capability, { getDb: async () => authDb, rateLimit: mcpRateLimit }),
    }));
    // Like real MCP clients, list tools first: this arms the SDK client's output-schema
    // validation, so an error result carrying non-conforming structuredContent fails here.
    await client.listTools();
    try {
        return await client.callTool({ name: 'create_quiz', arguments: args });
    } finally {
        await client.close();
    }
}

const ARGS = { topic: 'Fractions', grade: 7, subject: 'Mathematics', difficulty: 'medium', num_questions: 5 };

describe.each(['off', 'full'] as const)('real dispatcher, %s mode (Genkit / ADK sidecar)', (mode) => {
    beforeEach(() => { mockMode.mode = mode; });

    it('returns a valid quiz through the existing service', async () => {
        const res: any = await call(ARGS);
        expect(res.isError).toBeFalsy();
        const quiz = QuizResult.parse(res.structuredContent);
        expect(quiz.quizzes).toEqual([expect.objectContaining({ difficulty: 'medium', title: 'Fractions (medium)' })]);
        expect(quiz.quizzes[0].questions).toHaveLength(5);
        if (mode === 'off') {
            // The real generateQuiz ran: three variants, grade label, language, no teacher context.
            expect((quizGeneratorFlow as unknown as jest.Mock).mock.calls.map(([i]) => i.targetDifficulty)).toEqual(['easy', 'medium', 'hard']);
            expect((quizGeneratorFlow as unknown as jest.Mock).mock.calls[0][0]).toMatchObject({ userId: '', gradeLevel: 'Class 7', numQuestions: 5, language: 'English', gradeBandLabel: expect.any(String) });
            expect((quizGeneratorFlow as unknown as jest.Mock).mock.calls[0][0].teacherContext).toBeUndefined();
        } else {
            expect(callSidecarQuiz).toHaveBeenCalledWith(expect.objectContaining({ topic: 'Fractions', gradeLevel: 'Class 7', numQuestions: 5, userId: '' }));
        }
    });

    it('writes NOTHING, reads no teacher data, and never touches a teacher rate-limit bucket', async () => {
        await call(ARGS);
        expect(writes).toEqual([]);
        expect(mockDbAdapter.saveContent).not.toHaveBeenCalled();
        expect(mockDbAdapter.getUser).not.toHaveBeenCalled();
        expect(mockTeacherContext).not.toHaveBeenCalled();
        expect(mockTeacherRateLimit).not.toHaveBeenCalled();
        expect(mcpRateLimit).toHaveBeenCalledTimes(1); // the MCP's own per-key limit applies instead
    });

    it('Sahayak\'s topic safety policy blocks an unsafe topic before any model call', async () => {
        const res: any = await call({ ...ARGS, topic: 'how to make a bomb' });
        expect(toolErrorOf(res)).toMatchObject({ category: 'content_policy', retryable: false });
        expect(quizGeneratorFlow).not.toHaveBeenCalled();
        expect(callSidecarQuiz).not.toHaveBeenCalled();
    });
});

it('a teacher\'s interactive call through the same service still saves to their Library (behaviour unchanged)', async () => {
    mockMode.mode = 'off';
    await dispatchQuiz({ userId: 'teacher-123', topic: 'Fractions', gradeLevel: 'Class 7', questionTypes: ['short_answer'], numQuestions: 5 } as any);
    expect(writes).toEqual(expect.arrayContaining([expect.stringMatching(/^storage:users\/teacher-123\/quizzes\//), 'dbAdapter.saveContent']));
});
