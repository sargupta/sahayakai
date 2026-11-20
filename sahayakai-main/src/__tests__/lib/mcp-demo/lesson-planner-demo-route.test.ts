/**
 * @jest-environment node
 *
 * The MCP demo backend, end to end in-process:
 *
 *   /api/mcp-demo/lesson-planner (route) → official MCP SDK client
 *     → Streamable HTTP → the REAL MCP handler (handleMcpHttpRequest, API-key
 *       auth, scope, rate limit) → create_lesson_plan → lesson-plan service (stub)
 *
 * Only the network hop (global fetch) is routed in-process. Proves the demo
 * really goes through the MCP endpoint with the server-held key, maps the
 * result, and never leaks the key or internals to the browser.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/logger/structured-logger', () => ({ StructuredLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { mintApiKey, MCP_API_KEYS_COLLECTION } from '@/lib/mcp/api-keys';
import { handleMcpHttpRequest } from '@/lib/mcp/http-handler';
import { lessonPlannerCapability } from '@/lib/mcp/lesson-planner/capability';
import { createLessonPlanViaMcp, getMcpDemoConfig } from '@/lib/mcp-demo/lesson-planner-client';
import type { DispatchedLessonPlan } from '@/lib/sidecar/lesson-plan-dispatch';

const realFetchApi = jest.requireActual('whatwg-fetch');
const stubbed = { Headers: global.Headers, Request: global.Request, Response: global.Response, fetch: global.fetch };
beforeAll(() => Object.assign(global, { Headers: realFetchApi.Headers, Request: realFetchApi.Request, Response: realFetchApi.Response }));
afterAll(() => Object.assign(global, stubbed));

const PEPPER = 'demo-pepper-0123456789-abcdefghijklmnop';
const MCP_URL = 'http://127.0.0.1:3000/api/mcp/lesson-planner';
const docs = new Map<string, Record<string, unknown>>();
const authDb = { collection: (c: string) => ({ doc: (id: string) => ({ get: async () => ({ exists: docs.has(`${c}/${id}`), data: () => docs.get(`${c}/${id}`) }) }) }) };

const SERVICE_PLAN = {
    title: 'Photosynthesis', gradeLevel: 'Class 7', duration: '45 minutes', subject: 'Science', language: 'English',
    objectives: ['Explain how plants make food'], keyVocabulary: [{ term: 'Chlorophyll', meaning: 'Green pigment' }], materials: ['Leaves'],
    activities: ['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate'].map((phase) => ({ phase, name: phase, description: 'd', duration: '8 minutes' })),
    assessment: 'Quiz', homework: 'Observe a plant', validationWarning: null,
    source: 'sidecar', decision: { mode: 'full', bucket: 7 }, sidecarTelemetry: { sidecarVersion: 'secret-version' },
} as unknown as DispatchedLessonPlan;
const dispatch = jest.fn<Promise<DispatchedLessonPlan>, [any]>();
const mcpRateLimit = jest.fn(async () => undefined);
const capability = lessonPlannerCapability(dispatch);
const mcpServerRequests: Request[] = [];

let apiKey: string;
let keyId: string;
const env = process.env as Record<string, string | undefined>;

beforeEach(() => {
    docs.clear();
    docs.set('organizations/org-demo', { name: 'Sahayak demo' });
    const minted = mintApiKey({ orgId: 'org-demo', label: 'demo ui', scopes: ['lesson-planner'], createdBy: 'jest', pepper: PEPPER });
    docs.set(`${MCP_API_KEYS_COLLECTION}/${minted.keyId}`, minted.record as any);
    ({ apiKey, keyId } = minted);
    env.MCP_API_KEY_PEPPER = PEPPER;
    env.MCP_DEMO_API_KEY = apiKey;
    env.MCP_DEMO_SERVER_URL = MCP_URL;
    dispatch.mockReset().mockResolvedValue(SERVICE_PLAN);
    mcpRateLimit.mockClear();
    mcpServerRequests.length = 0;
    // The network: anything sent to the MCP URL is served by the real MCP handler.
    (global as any).fetch = async (url: string | URL, init?: RequestInit) => {
        const req = new Request(String(url), init);
        mcpServerRequests.push(req.clone());
        return handleMcpHttpRequest(req, capability, { getDb: async () => authDb, rateLimit: mcpRateLimit });
    };
});
afterEach(() => { delete env.MCP_DEMO_API_KEY; delete env.MCP_DEMO_SERVER_URL; });

// Import the route after module mocks are set up.
import { GET, POST } from '@/app/api/mcp-demo/lesson-planner/route';
const signedIn = (init: RequestInit = {}) => ({ ...init, headers: { 'x-user-id': 'teacher-1', 'Content-Type': 'application/json', ...(init.headers as any) } });
const DEMO_ARGS = { topic: 'Photosynthesis', grade: 7, subject: 'Science', language: 'English', difficulty: 'medium' };

describe('route: /api/mcp-demo/lesson-planner', () => {
    it('POST generates THROUGH the MCP endpoint (initialize → tools/call create_lesson_plan, with the server key)', async () => {
        const res = await POST(new Request('http://localhost/api/mcp-demo/lesson-planner', signedIn({ method: 'POST', body: JSON.stringify(DEMO_ARGS) })));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.plan).toMatchObject({ title: 'Photosynthesis', grade: 7, subject: 'Science', key_vocabulary: [{ term: 'Chlorophyll', meaning: 'Green pigment' }] });
        expect(body.plan.activities.map((a: any) => a.phase)).toEqual(['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate']);
        expect(body.mcp).toMatchObject({ name: 'sahayak-lesson-planner', version: '1.0.0', tool: 'create_lesson_plan', protocol: 'Streamable HTTP' });

        // Every hop went to the MCP server URL, authenticated with the server-held key.
        expect(mcpServerRequests.length).toBeGreaterThanOrEqual(2);
        expect(mcpServerRequests.every((r) => r.url === MCP_URL && r.headers.get('authorization') === `Bearer ${apiKey}`)).toBe(true);
        const methods = await Promise.all(mcpServerRequests.map(async (r) => { const t = await r.text(); return t ? JSON.parse(t).method : r.method; }));
        expect(methods).toEqual(expect.arrayContaining(['initialize', 'tools/call']));
        // ...and the MCP layer applied its own controls (per-key rate limit) before the service ran.
        expect(mcpRateLimit).toHaveBeenCalledWith(`mcp_${keyId}`);
        expect(dispatch.mock.calls[0][0]).toMatchObject({ userId: 'anonymous_user', topic: 'Photosynthesis', gradeLevels: ['Class 7'], difficultyLevel: 'standard' });
    });

    it('never returns the API key, the MCP URL or service internals to the browser', async () => {
        const res = await POST(new Request('http://localhost/x', signedIn({ method: 'POST', body: JSON.stringify(DEMO_ARGS) })));
        const text = await res.text();
        for (const secret of [apiKey, apiKey.split('_').pop()!, keyId, PEPPER, MCP_URL, '127.0.0.1', 'sidecar', 'secret-version', 'bucket', 'anonymous_user']) {
            expect(text).not.toContain(secret);
        }
        const status = await (await GET(new Request('http://localhost/x', signedIn()))).text();
        for (const secret of [apiKey, keyId, MCP_URL]) expect(status).not.toContain(secret);
    });

    it('GET reports MCP status with initialize + tools/list only (no generation)', async () => {
        const res = await GET(new Request('http://localhost/x', signedIn()));
        expect(await res.json()).toEqual({
            configured: true, connected: true,
            server: { name: 'sahayak-lesson-planner', version: '1.0.0', tool: 'create_lesson_plan', protocol: 'Streamable HTTP' },
        });
        expect(dispatch).not.toHaveBeenCalled();
        expect(mcpRateLimit).not.toHaveBeenCalled();
    });

    it('requires a signed-in Sahayak user (not an open proxy for the server key)', async () => {
        expect((await POST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(DEMO_ARGS) }))).status).toBe(401);
        expect((await GET(new Request('http://localhost/x'))).status).toBe(401);
        expect(mcpServerRequests).toHaveLength(0);
    });

    it('maps MCP tool errors to clean, categorised errors', async () => {
        // The lesson-plan service's own safety check (stubbed here) throws this; the MCP layer maps it.
        dispatch.mockRejectedValueOnce(new Error('Safety Violation: Content Policy Violation'));
        const res = await POST(new Request('http://localhost/x', signedIn({ method: 'POST', body: JSON.stringify({ ...DEMO_ARGS, topic: 'Photosynthesis' }) })));
        expect(res.status).toBe(422);
        expect((await res.json()).error).toMatchObject({ category: 'content_policy', retryable: false });

        dispatch.mockRejectedValueOnce(new Error('429 RESOURCE_EXHAUSTED'));
        const busy = await POST(new Request('http://localhost/x', signedIn({ method: 'POST', body: JSON.stringify(DEMO_ARGS) })));
        expect(busy.status).toBe(502);
        expect((await busy.json()).error).toMatchObject({ category: 'upstream_unavailable', retryable: true });
    });

    it('rejects invalid input against the public MCP schema before calling MCP (incl. tenant fields)', async () => {
        for (const bad of [{ ...DEMO_ARGS, grade: 13 }, { ...DEMO_ARGS, org_id: 'other-school' }, 'not json']) {
            const res = await POST(new Request('http://localhost/x', signedIn({ method: 'POST', body: typeof bad === 'string' ? bad : JSON.stringify(bad) })));
            expect(res.status).toBe(400);
            expect((await res.json()).error.category).toBe('invalid_input');
        }
        expect(mcpServerRequests).toHaveLength(0);
    });

    it('a revoked or wrong server key surfaces as "MCP unavailable", not as a crash or a key leak', async () => {
        env.MCP_DEMO_API_KEY = `sk_sahayak_${keyId}_${'A'.repeat(43)}`;
        const res = await POST(new Request('http://localhost/x', signedIn({ method: 'POST', body: JSON.stringify(DEMO_ARGS) })));
        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.error).toMatchObject({ category: 'mcp_unavailable', retryable: true });
        expect(JSON.stringify(body)).not.toContain(keyId);
    });

    it('503 when no MCP key is configured', async () => {
        delete env.MCP_DEMO_API_KEY;
        const res = await POST(new Request('http://localhost/x', signedIn({ method: 'POST', body: JSON.stringify(DEMO_ARGS) })));
        expect(res.status).toBe(503);
        expect(await (await GET(new Request('http://localhost/x', signedIn()))).json()).toEqual({ configured: false, connected: false });
    });
});

describe('config', () => {
    it('the MCP URL is never taken from the request (Host header) — only from server config or loopback', () => {
        expect(getMcpDemoConfig({ MCP_DEMO_API_KEY: 'k' })).toEqual({ apiKey: 'k', url: 'http://127.0.0.1:3000/api/mcp/lesson-planner' });
        expect(getMcpDemoConfig({ MCP_DEMO_API_KEY: 'k', PORT: '3100' })!.url).toBe('http://127.0.0.1:3100/api/mcp/lesson-planner');
        expect(getMcpDemoConfig({ MCP_DEMO_API_KEY: 'k', MCP_DEMO_SERVER_URL: 'https://mcp.example/x' })!.url).toBe('https://mcp.example/x');
    });

    it('the local dev key is used only under next dev', () => {
        expect(getMcpDemoConfig({ NODE_ENV: 'development', MCP_LOCAL_DEV_API_KEY: 'dev' })!.apiKey).toBe('dev');
        expect(getMcpDemoConfig({ NODE_ENV: 'production', MCP_LOCAL_DEV_API_KEY: 'dev' })).toBeNull();
        expect(getMcpDemoConfig({ NODE_ENV: 'development', MCP_LOCAL_DEV_API_KEY: 'dev', MCP_DEMO_API_KEY: 'real' })!.apiKey).toBe('real');
    });

    it('client module can be driven with an explicit fetch (no global state needed)', async () => {
        const res = await createLessonPlanViaMcp(DEMO_ARGS, { url: MCP_URL, apiKey }, (global as any).fetch);
        expect(res.ok).toBe(true);
    });
});
