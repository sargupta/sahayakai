/**
 * @jest-environment node
 *
 * Integration: external MCP client → MCP server → the REAL Sahayak
 * lesson-plan dispatcher (`dispatchLessonPlan`, real safety check, real
 * persist helpers, real Firestore adapter against a recording fake).
 * Only the model calls (Genkit flow, sidecar HTTP client) are stubbed.
 *
 * Proves the MCP is an adapter over the existing service, and that an
 * external (headless) call never writes into any teacher's My Library and
 * never consumes a teacher's rate-limit bucket.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/logger/structured-logger', () => ({ StructuredLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(), startTimer: () => ({ end: jest.fn() }) } }));

// Recording Firestore + Storage: every write lands here.
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
jest.mock('@/lib/usage-tracker', () => ({ UsageTracker: { trackGemini: jest.fn(), track: jest.fn(), increment: jest.fn() } }));

const mockMode = { mode: 'off' as 'off' | 'full' };
jest.mock('@/lib/feature-flags', () => ({
    decideLessonPlanDispatch: jest.fn(async () => ({ mode: mockMode.mode, reason: 'test', bucket: 0 })),
}));
const mockTeacherRateLimit = jest.fn(async () => undefined);
jest.mock('@/lib/server-safety', () => ({ checkServerRateLimit: (...a: unknown[]) => mockTeacherRateLimit(...(a as [])) }));
jest.mock('@/lib/sidecar/shadow-diff-writer', () => ({ writeAgentShadowDiff: jest.fn() }));
jest.mock('@/lib/sidecar/canary-shadow-diff', () => ({ shouldRunCanaryShadowDiff: () => false }));

// Model calls only.
jest.mock('@/ai/flows/lesson-plan-generator', () => ({ generateLessonPlan: jest.fn() }));
function sidecarErrors(prefix: string) {
    const make = (name: string) => class extends Error { constructor(m?: string) { super(m ?? name); this.name = name; } };
    return Object.fromEntries(['ConfigError', 'TimeoutError', 'HttpError', 'BehaviouralError'].map((s) => [`${prefix}${s}`, make(`${prefix}${s}`)]));
}
jest.mock('@/lib/sidecar/lesson-plan-client', () => ({ callSidecarLessonPlan: jest.fn(), ...sidecarErrors('LessonPlanSidecar') }));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { toolErrorOf } from '@/lib/mcp/errors';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { generateLessonPlan } from '@/ai/flows/lesson-plan-generator';
import { callSidecarLessonPlan } from '@/lib/sidecar/lesson-plan-client';
import { dispatchLessonPlan } from '@/lib/sidecar/lesson-plan-dispatch';
import { mintApiKey, MCP_API_KEYS_COLLECTION } from '@/lib/mcp/api-keys';
import { handleMcpHttpRequest } from '@/lib/mcp/http-handler';
import { lessonPlannerCapability } from '@/lib/mcp/lesson-planner/capability';
import { LessonPlanResult } from '@/lib/mcp/lesson-planner/schema';

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
const capability = lessonPlannerCapability(dispatchLessonPlan);

const PLAN = {
    title: 'Photosynthesis', gradeLevel: 'Class 7', duration: '40 minutes', subject: 'Science',
    objectives: ['Explain how plants make food'], keyVocabulary: [{ term: 'Chlorophyll', meaning: 'Green pigment' }],
    materials: ['Leaves', 'Chalkboard'],
    activities: ['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate'].map((phase) => ({ phase, name: `${phase} step`, description: `${phase} description`, duration: '8 minutes', teacherTips: null, understandingCheck: null })),
    assessment: 'Label a leaf diagram.', homework: 'Observe a plant at home.', language: 'English',
};

let apiKey: string;
beforeEach(() => {
    writes.length = 0;
    keys.clear();
    keys.set('organizations/org-a', { name: 'School A' });
    const minted = mintApiKey({ orgId: 'org-a', label: 'it', scopes: ['lesson-planner'], createdBy: 'jest', pepper: PEPPER });
    keys.set(`${MCP_API_KEYS_COLLECTION}/${minted.keyId}`, minted.record as any);
    apiKey = minted.apiKey;
    process.env.MCP_API_KEY_PEPPER = PEPPER;
    (generateLessonPlan as jest.Mock).mockReset().mockResolvedValue(PLAN);
    (callSidecarLessonPlan as jest.Mock).mockReset().mockResolvedValue({ ...PLAN, revisionsRun: 0, sidecarVersion: 'phase-3.1.0', rubric: { scores: {}, safety: true, rationale: 'ok', fail_reasons: [] } });
    mockTeacherRateLimit.mockClear();
    mcpRateLimit.mockClear();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

async function call(args: Record<string, unknown>) {
    const client = new Client({ name: 'school-lms-agent', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL('https://sahayak.test/api/mcp/lesson-planner'), {
        requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
        fetch: async (url, init) => handleMcpHttpRequest(new Request(url, init), capability, { getDb: async () => authDb, rateLimit: mcpRateLimit }),
    }));
    // Like real MCP clients, list tools first: this arms the SDK client's output-schema
    // validation, so an error result carrying non-conforming structuredContent fails here.
    await client.listTools();
    try {
        return await client.callTool({ name: 'create_lesson_plan', arguments: args });
    } finally {
        await client.close();
    }
}

describe.each(['off', 'full'] as const)('real dispatcher, %s mode (Genkit / ADK sidecar)', (mode) => {
    beforeEach(() => { mockMode.mode = mode; });

    it('returns a valid lesson plan through the existing service', async () => {
        const res: any = await call({ topic: 'Photosynthesis', grade: 7, subject: 'Science', language: 'English' });
        expect(res.isError).toBeFalsy();
        const plan = LessonPlanResult.parse(res.structuredContent);
        expect(plan.title).toBe('Photosynthesis');
        expect(plan.activities).toHaveLength(5);
        if (mode === 'off') {
            expect(generateLessonPlan).toHaveBeenCalledWith(expect.objectContaining({ userId: 'anonymous_user', topic: 'Photosynthesis', gradeLevels: ['Class 7'] }));
        } else {
            expect(callSidecarLessonPlan).toHaveBeenCalledWith(expect.objectContaining({ topic: 'Photosynthesis', gradeLevels: ['Class 7'] }));
        }
    });

    it('writes NOTHING to any teacher Library and never touches a teacher rate-limit bucket', async () => {
        await call({ topic: 'Photosynthesis', grade: 7 });
        expect(writes.filter((w) => /\/content\/|storage:users\//.test(w))).toEqual([]);
        expect(mockTeacherRateLimit).not.toHaveBeenCalled();
        expect(mcpRateLimit).toHaveBeenCalledTimes(1); // the MCP's own per-key limit applies instead
    });
});

it('Sahayak\'s real content policy blocks an unsafe topic before any model call', async () => {
    mockMode.mode = 'full';
    const res: any = await call({ topic: 'how to make a bomb', grade: 9 });
    expect(res.isError).toBe(true);
    expect(toolErrorOf(res)).toMatchObject({ category: 'content_policy', retryable: false });
    expect(callSidecarLessonPlan).not.toHaveBeenCalled();
});
