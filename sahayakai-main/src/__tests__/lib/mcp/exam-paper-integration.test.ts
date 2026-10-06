/**
 * @jest-environment node
 *
 * Integration: external MCP client → MCP server → the REAL Sahayak
 * exam-paper dispatcher (`dispatchExamPaper`: real safety check, real
 * sidecar/Genkit routing, real persist helpers against a recording fake
 * Firestore). Only the model calls (Genkit flow, sidecar HTTP client) are
 * stubbed.
 *
 * Proves the MCP is an adapter over the existing service, and that an
 * external (headless) call never writes into any teacher's My Library,
 * never reads a teacher profile/context and never consumes a teacher's
 * rate-limit bucket.
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
    getFeatureFlags: jest.fn(async () => ({ examPaperSidecarMode: mockMode.mode, examPaperSidecarPercent: 0 })),
}));
const mockTeacherRateLimit = jest.fn(async () => undefined);
jest.mock('@/lib/server-safety', () => ({ checkServerRateLimit: (...a: unknown[]) => mockTeacherRateLimit(...(a as [])) }));
const mockTeacherContext = jest.fn(async () => 'Teacher: 12 years experience');
jest.mock('@/lib/teacher-context', () => ({ getTeacherContextLine: (...a: unknown[]) => mockTeacherContext(...(a as [])) }));
jest.mock('@/lib/sidecar/shadow-diff-writer', () => ({ writeAgentShadowDiff: jest.fn() }));
jest.mock('@/lib/sidecar/canary-shadow-diff', () => ({ shouldRunCanaryShadowDiff: () => false }));

// Model calls only.
jest.mock('@/ai/flows/exam-paper-generator', () => ({ generateExamPaper: jest.fn() }));
function sidecarErrors(prefix: string) {
    const make = (name: string) => class extends Error { constructor(m?: string) { super(m ?? name); this.name = name; } };
    return Object.fromEntries(['ConfigError', 'TimeoutError', 'HttpError', 'BehaviouralError'].map((s) => [`${prefix}${s}`, make(`${prefix}${s}`)]));
}
jest.mock('@/lib/sidecar/exam-paper-client', () => ({ callSidecarExamPaper: jest.fn(), ...sidecarErrors('ExamPaperSidecar') }));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { generateExamPaper } from '@/ai/flows/exam-paper-generator';
import { callSidecarExamPaper } from '@/lib/sidecar/exam-paper-client';
import { dispatchExamPaper } from '@/lib/sidecar/exam-paper-dispatch';
import { mintApiKey, MCP_API_KEYS_COLLECTION } from '@/lib/mcp/api-keys';
import { handleMcpHttpRequest } from '@/lib/mcp/http-handler';
import { examPaperCapability } from '@/lib/mcp/exam-paper/capability';
import { ExamPaperResult } from '@/lib/mcp/exam-paper/schema';

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
const capability = examPaperCapability({ dispatch: dispatchExamPaper, isEnabledFor: async () => true, canAnchorWholeSyllabus: async () => true });

const PAPER = {
    title: 'CBSE Class 8 Science — Force and Pressure', board: 'CBSE', subject: 'Science', gradeLevel: 'Class 8', duration: '45 Minutes', maxMarks: 5,
    generalInstructions: ['All questions are compulsory.'],
    sections: [{
        name: 'Section A', label: 'Short answer', totalMarks: 5,
        questions: [
            { number: 1, source: 'New', text: 'Define pressure.', marks: 2, correctOption: '', answerKey: 'Force per unit area.', markingScheme: '2 marks' },
            { number: 2, source: 'New', text: 'Why do camels walk easily on sand?', marks: 3, correctOption: '', answerKey: 'Broad feet spread weight.', markingScheme: '3 marks' },
        ],
    }],
    blueprintSummary: { chapterWise: [{ chapter: 'Force and Pressure', marks: 5 }], difficultyWise: [] },
    pyqSources: [],
};

let apiKey: string;
beforeEach(() => {
    writes.length = 0;
    keys.clear();
    keys.set('organizations/org-a', { name: 'School A' });
    const minted = mintApiKey({ orgId: 'org-a', label: 'it', scopes: ['exam-paper'], createdBy: 'jest', pepper: PEPPER });
    keys.set(`${MCP_API_KEYS_COLLECTION}/${minted.keyId}`, minted.record as any);
    apiKey = minted.apiKey;
    process.env.MCP_API_KEY_PEPPER = PEPPER;
    (generateExamPaper as jest.Mock).mockReset().mockResolvedValue(PAPER);
    (callSidecarExamPaper as jest.Mock).mockReset().mockResolvedValue(PAPER);
    mockTeacherRateLimit.mockClear();
    mockTeacherContext.mockClear();
    mockDbAdapter.saveContent.mockClear();
    mockDbAdapter.getUser.mockClear();
    mcpRateLimit.mockClear();
});

async function call(args: Record<string, unknown>) {
    const client = new Client({ name: 'school-lms-agent', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL('https://sahayak.test/api/mcp/exam-paper'), {
        requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
        fetch: async (url, init) => handleMcpHttpRequest(new Request(url, init), capability, { getDb: async () => authDb, rateLimit: mcpRateLimit }),
    }));
    try {
        return await client.callTool({ name: 'create_exam_paper', arguments: args });
    } finally {
        await client.close();
    }
}

const ARGS = { grade: 8, subject: 'Science', chapters: ['Force and Pressure'], difficulty: 'medium', max_marks: 5 };

describe.each(['off', 'full'] as const)('real dispatcher, %s mode (Genkit / ADK sidecar)', (mode) => {
    beforeEach(() => { mockMode.mode = mode; });

    it('returns a valid exam paper through the existing service', async () => {
        const res: any = await call(ARGS);
        expect(res.isError).toBeFalsy();
        const paper = ExamPaperResult.parse(res.structuredContent);
        expect(paper).toMatchObject({ title: PAPER.title, max_marks: 5, total_question_marks: 5, review_notes: [] });
        if (mode === 'off') {
            expect(generateExamPaper).toHaveBeenCalledWith(expect.objectContaining({ userId: '', gradeLevel: 'Class 8', difficulty: 'moderate', teacherContext: undefined }));
        } else {
            expect(callSidecarExamPaper).toHaveBeenCalledWith(expect.objectContaining({ gradeLevel: 'Class 8', chapters: ['Force and Pressure'] }));
        }
    });

    it('writes NOTHING, reads no teacher context, and never touches a teacher rate-limit bucket', async () => {
        await call(ARGS);
        expect(writes).toEqual([]);
        expect(mockDbAdapter.saveContent).not.toHaveBeenCalled();
        expect(mockTeacherContext).not.toHaveBeenCalled();
        expect(mockTeacherRateLimit).not.toHaveBeenCalled();
        expect(mcpRateLimit).toHaveBeenCalledTimes(1); // the MCP's own per-key limit applies instead
    });
});

it('Sahayak\'s real content policy blocks unsafe chapter text before any model call', async () => {
    mockMode.mode = 'full';
    const res: any = await call({ ...ARGS, chapters: ['how to make a bomb at home'] });
    expect(res.isError).toBe(true);
    expect(res.structuredContent.error).toMatchObject({ category: 'content_policy', retryable: false });
    expect(callSidecarExamPaper).not.toHaveBeenCalled();
    expect(generateExamPaper).not.toHaveBeenCalled();
});

it('the service\'s generation budget surfaces as an honest, retryable timeout', async () => {
    mockMode.mode = 'off';
    const { ExamPaperGenerationInProgressError } = jest.requireActual('@/lib/sidecar/exam-paper-dispatch');
    (generateExamPaper as jest.Mock).mockRejectedValueOnce(new ExamPaperGenerationInProgressError(75_000, 75_010));
    const res: any = await call(ARGS);
    expect(res.structuredContent.error).toMatchObject({ category: 'timeout', retryable: true });
});
