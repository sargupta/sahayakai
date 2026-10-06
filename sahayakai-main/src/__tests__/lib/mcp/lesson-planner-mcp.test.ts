/**
 * @jest-environment node
 *
 * Sahayak Lesson Planner MCP — tested from the outside, the way an external
 * school's AI agent uses it: the OFFICIAL MCP SDK client speaks real
 * Streamable HTTP (JSON-RPC over HTTP) to the real route handler; only the
 * network hop is replaced by an in-process fetch.
 *
 *   SDK Client → Streamable HTTP → handleMcpHttpRequest → auth (API key)
 *     → create_lesson_plan → Sahayak lesson-plan service (stubbed here; see
 *       lesson-planner-integration.test.ts for the real dispatcher)
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
import { handleMcpHttpRequest, MAX_MCP_REQUEST_BYTES, type McpHandlerDeps } from '@/lib/mcp/http-handler';
import { lessonPlannerCapability } from '@/lib/mcp/lesson-planner/capability';
import { LessonPlanResult } from '@/lib/mcp/lesson-planner/schema';
import type { DispatchedLessonPlan } from '@/lib/sidecar/lesson-plan-dispatch';

// jest.setup.ts stubs Request/Response/Headers globally (Headers = Map) for
// the rest of the suite. The real MCP transports need the genuine Fetch API,
// so this file installs whatwg-fetch's full implementations for itself only.
const realFetchApi = jest.requireActual('whatwg-fetch');
const stubbedFetchApi = { Headers: global.Headers, Request: global.Request, Response: global.Response };
beforeAll(() => {
    Object.assign(global, { Headers: realFetchApi.Headers, Request: realFetchApi.Request, Response: realFetchApi.Response });
});
afterAll(() => {
    Object.assign(global, stubbedFetchApi);
});

const PEPPER = 'test-pepper-0123456789-abcdefghijklmnop';
const URL_ = 'https://sahayak.test/api/mcp/lesson-planner';

// ── fake Firestore holding orgs + API keys ─────────────────────────────────
const docs = new Map<string, Record<string, unknown>>();
const fakeDb = {
    collection: (c: string) => ({
        doc: (id: string) => ({
            get: async () => ({ exists: docs.has(`${c}/${id}`), data: () => docs.get(`${c}/${id}`) }),
        }),
    }),
};
function issue(orgId: string, scopes: McpScope[], status: 'active' | 'revoked' = 'active') {
    const { apiKey, keyId, record } = mintApiKey({ orgId, label: 'test', scopes, createdBy: 'jest', pepper: PEPPER });
    docs.set(`${MCP_API_KEYS_COLLECTION}/${keyId}`, { ...record, status });
    return { apiKey, keyId };
}

// ── the existing Sahayak service, as the dispatcher returns it ─────────────
const SERVICE_PLAN = {
    title: 'Understanding Fractions',
    gradeLevel: 'Class 5',
    duration: '45 minutes',
    subject: 'Mathematics',
    objectives: ['Identify numerator and denominator', 'Compare simple fractions'],
    keyVocabulary: [{ term: 'Numerator', meaning: 'The top number of a fraction' }],
    materials: ['Chalkboard', 'Paper strips'],
    activities: [
        { phase: 'Engage', name: 'Roti sharing', description: 'Share a roti among 4 friends.', duration: '5 minutes', teacherTips: 'Use a real roti if possible.', understandingCheck: 'How much did each friend get?' },
        { phase: 'Explore', name: 'Paper folding', description: 'Fold strips into halves and quarters.', duration: '10 minutes', teacherTips: null, understandingCheck: null },
        { phase: 'Explain', name: 'Naming parts', description: 'Introduce numerator and denominator.', duration: '10 minutes' },
        { phase: 'Elaborate', name: 'Market maths', description: 'Fractions of a kilo of rice.', duration: '10 minutes' },
        { phase: 'Evaluate', name: 'Exit ticket', description: 'Three quick questions.', duration: '10 minutes' },
    ],
    assessment: 'Exit ticket with three questions.',
    homework: 'Find fractions at home.',
    language: 'English',
    validationWarning: null,
    // internal fields that must NEVER reach an external client:
    source: 'sidecar',
    decision: { mode: 'full', reason: 'flag_full', bucket: 42 },
    sidecarTelemetry: { sidecarVersion: 'phase-3.1.0', revisionsRun: 1, rubric: { scores: {} } },
} as unknown as DispatchedLessonPlan;

const dispatch = jest.fn<Promise<DispatchedLessonPlan>, [unknown]>();
const rateLimit = jest.fn<Promise<void>, [string]>();
const deps: McpHandlerDeps = { getDb: async () => fakeDb, rateLimit };
const capability = lessonPlannerCapability(dispatch as any);
const callServer = (req: Request) => handleMcpHttpRequest(req, capability, deps);

async function connect(apiKey: string, extraHeaders: Record<string, string> = {}) {
    const client = new Client({ name: 'external-school-agent', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(URL_), {
        requestInit: { headers: { Authorization: `Bearer ${apiKey}`, ...extraHeaders } },
        fetch: async (url, init) => callServer(new Request(url, init)),
    });
    await client.connect(transport);
    return client;
}
const rawPost = (headers: Record<string, string>, body: unknown = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) =>
    callServer(new Request(URL_, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers }, body: JSON.stringify(body) }));

const VALID = { topic: 'Fractions', grade: 5, subject: 'Mathematics', language: 'English' };
let keyA: { apiKey: string; keyId: string };

beforeEach(() => {
    docs.clear();
    docs.set('organizations/org-a', { name: 'School A' });
    docs.set('organizations/org-b', { name: 'School B' });
    keyA = issue('org-a', ['lesson-planner']);
    process.env.MCP_API_KEY_PEPPER = PEPPER;
    dispatch.mockReset().mockResolvedValue(SERVICE_PLAN);
    rateLimit.mockReset().mockResolvedValue(undefined);
    logInfo.mockReset();
    logWarn.mockReset();
});

describe('discovery — what an external agent sees', () => {
    it('identifies itself and exposes exactly one, well-described tool', async () => {
        const client = await connect(keyA.apiKey);
        expect(client.getServerVersion()).toMatchObject({ name: 'sahayak-lesson-planner', version: '1.0.0' });
        expect(client.getInstructions()).toMatch(/lesson plans/i);

        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name)).toEqual(['create_lesson_plan']);
        const tool = tools[0];
        expect(tool.description).toMatch(/Use it when a teacher needs a structured plan/);
        expect(tool.description).toMatch(/not for a quick explanation, a quiz or a worksheet/);
        expect(tool.inputSchema.required).toEqual(['topic', 'grade']);
        expect(tool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false });
        expect(Object.keys(tool.inputSchema.properties ?? {})).toEqual(
            ['topic', 'grade', 'subject', 'language', 'classroom_resources', 'difficulty', 'use_local_context', 'ncert_chapter'],
        );
        expect((tool.inputSchema.properties as any).grade).toMatchObject({ type: 'integer', minimum: 1, maximum: 12 });
        expect(tool.outputSchema).toBeDefined();
        expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
        await client.close();
    });

    it('listing tools does not consume the rate limit', async () => {
        const client = await connect(keyA.apiKey);
        await client.listTools();
        expect(rateLimit).not.toHaveBeenCalled();
        await client.close();
    });
});

describe('create_lesson_plan — success path', () => {
    it('returns a structured, validated lesson plan and calls the existing service headlessly', async () => {
        const client = await connect(keyA.apiKey);
        const res = await client.callTool({ name: 'create_lesson_plan', arguments: { ...VALID, classroom_resources: 'medium' } });

        expect(res.isError).toBeFalsy();
        const plan = LessonPlanResult.parse(res.structuredContent);
        expect(plan).toMatchObject({ title: 'Understanding Fractions', grade: 5, subject: 'Mathematics', duration: '45 minutes', curriculum_note: null });
        expect(plan.activities.map((a) => a.phase)).toEqual(['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate']);
        expect(plan.activities[0]).toMatchObject({ teacher_tips: 'Use a real roti if possible.', understanding_check: 'How much did each friend get?' });
        expect((res.content as any)[0].text).toMatch(/^# Understanding Fractions \(Class 5, Mathematics, 45 minutes\)/);

        expect(dispatch).toHaveBeenCalledTimes(1);
        expect(dispatch.mock.calls[0][0]).toMatchObject({
            userId: 'anonymous_user', // the service's headless caller: no Library writes, no teacher profile
            topic: 'Fractions', gradeLevels: ['Class 5'], language: 'English', subject: 'Mathematics',
            resourceLevel: 'medium', difficultyLevel: 'standard', useRuralContext: true,
        });
        expect(rateLimit).toHaveBeenCalledWith(`mcp_${keyA.keyId}`);
        await client.close();
    });

    it('never exposes internal service fields', async () => {
        const client = await connect(keyA.apiKey);
        const res = await client.callTool({ name: 'create_lesson_plan', arguments: VALID });
        const wire = JSON.stringify(res);
        for (const internal of ['sidecar', 'decision', 'bucket', 'telemetry', 'rubric', 'revisionsRun', 'phase-3.1.0']) {
            expect(wire).not.toContain(internal);
        }
        await client.close();
    });

    it('maps an NCERT chapter mismatch to curriculum_note', async () => {
        dispatch.mockResolvedValueOnce({ ...SERVICE_PLAN, validationWarning: { invalid: true, lenient: true, message: 'Chapter 4 is not in the Class 5 syllabus.' } } as any);
        const client = await connect(keyA.apiKey);
        const res = await client.callTool({ name: 'create_lesson_plan', arguments: { ...VALID, ncert_chapter: { number: 4, title: 'Parts and Wholes', learning_outcomes: ['Identify halves'] } } });
        expect((res.structuredContent as any).curriculum_note).toBe('Chapter 4 is not in the Class 5 syllabus.');
        expect(dispatch.mock.calls[0][0]).toMatchObject({ ncertChapter: { number: 4, title: 'Parts and Wholes', learningOutcomes: ['Identify halves'] } });
        await client.close();
    });
});

describe('create_lesson_plan — errors an agent can act on', () => {
    const errorOf = (res: any) => ({ text: JSON.stringify(res.content ?? res), sc: res.structuredContent });

    it.each([
        [{ ...VALID, grade: 13 }, 'Invalid grade. Expected an integer between 1 and 12.'],
        [{ ...VALID, grade: 4.5 }, 'Invalid grade. Expected an integer between 1 and 12.'],
        [{ topic: 'Fractions' }, 'Missing grade. Expected an integer between 1 and 12.'],
        [{ ...VALID, topic: 'ab' }, 'Topic is too short.'],
        [{ ...VALID, language: 'French' }, 'Unsupported language. Use one of: English, Hindi'],
        [{ ...VALID, difficulty: 'expert' }, 'Invalid difficulty.'],
        [{ ...VALID, org_id: 'org-b' }, 'org_id'],
    ])('rejects %j with a clear message and never calls the service', async (args, expected) => {
        const client = await connect(keyA.apiKey);
        let message = '';
        try {
            const res = await client.callTool({ name: 'create_lesson_plan', arguments: args as any });
            expect(res.isError).toBe(true);
            message = errorOf(res).text;
        } catch (e) {
            message = String((e as Error).message); // SDK may surface invalid params as an MCP error
        }
        expect(message).toContain(expected);
        expect(dispatch).not.toHaveBeenCalled();
        await client.close();
    });

    it.each([
        ['Safety Violation: Topic contains restricted content', 'content_policy', false],
        ['Rate limit exceeded. Please wait 7 minutes.', 'rate_limited', true],
        ['429 RESOURCE_EXHAUSTED from model provider', 'upstream_unavailable', true],
        ['The operation was aborted due to timeout', 'timeout', true],
    ])('service failure "%s" → %s', async (thrown, category, retryable) => {
        dispatch.mockRejectedValueOnce(new Error(thrown));
        const client = await connect(keyA.apiKey);
        const res: any = await client.callTool({ name: 'create_lesson_plan', arguments: VALID });
        expect(res.isError).toBe(true);
        expect(res.structuredContent.error).toMatchObject({ category, retryable });
        if (category === 'rate_limited') expect(res.structuredContent.error.retry_after_seconds).toBe(420);
        await client.close();
    });

    it('an unexpected internal error leaks no internals (no stack, paths, hosts or secrets)', async () => {
        dispatch.mockRejectedValueOnce(Object.assign(new TypeError("Cannot read properties of undefined (reading 'x')"), {
            stack: 'TypeError: ...\n    at /srv/app/src/lib/sidecar/lesson-plan-dispatch.ts:301:9 (key=AIzaSyFAKEFAKE)',
        }));
        const client = await connect(keyA.apiKey);
        const res: any = await client.callTool({ name: 'create_lesson_plan', arguments: VALID });
        const wire = JSON.stringify(res);
        expect(res.structuredContent.error).toMatchObject({ category: 'internal', retryable: true });
        for (const leak of ['TypeError', 'undefined', '/srv', 'lesson-plan-dispatch', 'AIza', 'stack']) expect(wire).not.toContain(leak);
        await client.close();
    });

    it('a rate-limited key gets a structured, retryable error before the service runs', async () => {
        rateLimit.mockRejectedValueOnce(new Error('Rate limit exceeded. Please wait 3 minutes.'));
        const client = await connect(keyA.apiKey);
        const res: any = await client.callTool({ name: 'create_lesson_plan', arguments: VALID });
        expect(res.structuredContent.error).toMatchObject({ category: 'rate_limited', retry_after_seconds: 180 });
        expect(dispatch).not.toHaveBeenCalled();
        await client.close();
    });
});

describe('security', () => {
    const bodyOf = async (r: Response) => ({ status: r.status, text: await r.text(), wwwAuth: r.headers.get('www-authenticate') });

    it('rejects a request with no API key (401 + WWW-Authenticate)', async () => {
        const r = await bodyOf(await rawPost({}));
        expect(r.status).toBe(401);
        expect(r.wwwAuth).toMatch(/^Bearer/);
        expect(r.text).toContain('Missing API key');
        await expect(connect('')).rejects.toThrow();
    });

    it.each([
        ['malformed', () => 'not-a-key'],
        ['unknown key id', () => `sk_sahayak_0123456789abcdef_${'A'.repeat(43)}`],
        ['right id, wrong secret', () => `sk_sahayak_${keyA.keyId}_${'B'.repeat(43)}`],
        ['Firebase-style bearer token', () => 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1In0.c2ln'],
    ])('rejects a %s credential with the same generic 401', async (_label, make) => {
        const r = await bodyOf(await rawPost({ Authorization: `Bearer ${make()}` }));
        expect(r.status).toBe(401);
        expect(r.text).toContain('Invalid or revoked API key.');
    });

    it('rejects a revoked key and a key whose organisation no longer exists', async () => {
        const revoked = issue('org-a', ['lesson-planner'], 'revoked');
        expect((await rawPost({ Authorization: `Bearer ${revoked.apiKey}` })).status).toBe(401);
        const orphan = issue('org-gone', ['lesson-planner']);
        expect((await rawPost({ Authorization: `Bearer ${orphan.apiKey}` })).status).toBe(401);
    });

    it('rejects a valid key without the lesson-planner scope (403) — capability isolation', async () => {
        const other = issue('org-b', [] as McpScope[]);
        const r = await bodyOf(await rawPost({ Authorization: `Bearer ${other.apiKey}` }));
        expect(r.status).toBe(403);
        expect(JSON.parse(r.text).error.message).toContain('not enabled for the "lesson-planner" capability');
        expect(dispatch).not.toHaveBeenCalled();
    });

    it('fails closed (503) when the server pepper is not configured', async () => {
        delete process.env.MCP_API_KEY_PEPPER;
        expect((await rawPost({ Authorization: `Bearer ${keyA.apiKey}` })).status).toBe(503);
    });

    it('tenant comes only from the key: client-supplied org headers are ignored', async () => {
        const client = await connect(keyA.apiKey, { 'X-Org-Id': 'org-b', 'X-User-Id': 'teacher-of-org-b' });
        await client.callTool({ name: 'create_lesson_plan', arguments: VALID });
        const call = logInfo.mock.calls.find(([msg]) => msg === 'MCP tool call')!;
        expect(call[1].metadata).toMatchObject({ orgId: 'org-a', keyId: keyA.keyId });
        expect(dispatch.mock.calls[0][0]).toMatchObject({ userId: 'anonymous_user' });
        await client.close();
    });

    it('two schools are isolated: separate rate-limit buckets and attribution', async () => {
        const keyB = issue('org-b', ['lesson-planner']);
        for (const k of [keyA, keyB]) {
            const client = await connect(k.apiKey);
            await client.callTool({ name: 'create_lesson_plan', arguments: VALID });
            await client.close();
        }
        expect(rateLimit.mock.calls.map(([b]) => b)).toEqual([`mcp_${keyA.keyId}`, `mcp_${keyB.keyId}`]);
        const orgs = logInfo.mock.calls.filter(([m]) => m === 'MCP tool call').map(([, c]) => c.metadata.orgId);
        expect(orgs).toEqual(['org-a', 'org-b']);
    });

    it('never returns or logs secrets, keys or the teacher\'s topic', async () => {
        const client = await connect(keyA.apiKey);
        const res = await client.callTool({ name: 'create_lesson_plan', arguments: { ...VALID, topic: 'Secret topic about Ramesh in 5B' } });
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

    describe('local-development key (npm run mcp:dev-key)', () => {
        const env = process.env as Record<string, string | undefined>;
        const originalNodeEnv = env.NODE_ENV;
        const devKey = mintApiKey({ orgId: 'x', label: 'dev', scopes: ['lesson-planner'], createdBy: 'jest', pepper: PEPPER }).apiKey;
        beforeEach(() => { env.MCP_LOCAL_DEV_API_KEY = devKey; delete env.MCP_LOCAL_DEV_SCOPES; });
        afterEach(() => { env.NODE_ENV = originalNodeEnv; delete env.MCP_LOCAL_DEV_API_KEY; delete env.MCP_LOCAL_DEV_SCOPES; });

        it('works under `next dev` (NODE_ENV=development) without any Firestore key record', async () => {
            env.NODE_ENV = 'development';
            const client = await connect(devKey);
            const res: any = await client.callTool({ name: 'create_lesson_plan', arguments: VALID });
            expect(res.isError).toBeFalsy();
            const call = logInfo.mock.calls.find(([m]) => m === 'MCP tool call')!;
            expect(call[1].metadata.orgId).toBe('local-dev-org');
            await client.close();
        });

        it.each(['production', 'test'])('is NEVER accepted when NODE_ENV=%s', async (nodeEnv) => {
            env.NODE_ENV = nodeEnv;
            expect((await rawPost({ Authorization: `Bearer ${devKey}` })).status).toBe(401);
        });

        it('a near-miss of the dev key is rejected', async () => {
            env.NODE_ENV = 'development';
            const nearMiss = `${devKey.slice(0, -1)}${devKey.endsWith('A') ? 'B' : 'A'}`;
            expect((await rawPost({ Authorization: `Bearer ${nearMiss}` })).status).toBe(401);
        });

        it('honours MCP_LOCAL_DEV_SCOPES so the 403 path can be shown locally', async () => {
            env.NODE_ENV = 'development';
            env.MCP_LOCAL_DEV_SCOPES = 'some-other-capability';
            expect((await rawPost({ Authorization: `Bearer ${devKey}` })).status).toBe(403);
        });
    });

    it('a single raw JSON-RPC POST (the README curl example) works without an SDK or initialize', async () => {
        const res = await rawPost(
            { Authorization: `Bearer ${keyA.apiKey}` },
            { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'create_lesson_plan', arguments: { topic: 'Fractions', grade: 5 } } },
        );
        expect(res.status).toBe(200);
        expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
        const body = await res.json();
        expect(body.result.structuredContent).toMatchObject({ title: 'Understanding Fractions', grade: 5 });
    });

    it('rejects a body that is not JSON with a JSON-RPC parse error', async () => {
        const res = await callServer(new Request(URL_, { method: 'POST', headers: { Authorization: `Bearer ${keyA.apiKey}`, 'Content-Type': 'application/json' }, body: '{not json' }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toMatchObject({ code: -32700 });
    });

    it('only POST is served; oversized bodies are refused before parsing', async () => {
        const get = await callServer(new Request(URL_, { method: 'GET', headers: { Authorization: `Bearer ${keyA.apiKey}` } }));
        expect(get.status).toBe(405);
        expect(get.headers.get('allow')).toBe('POST');
        const big = await rawPost({ Authorization: `Bearer ${keyA.apiKey}`, 'Content-Length': String(MAX_MCP_REQUEST_BYTES + 1) });
        expect(big.status).toBe(413);
    });
});
