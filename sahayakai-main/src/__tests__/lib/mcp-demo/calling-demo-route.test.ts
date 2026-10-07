/**
 * @jest-environment node
 *
 * /api/mcp-demo/calling → official MCP SDK client → Streamable HTTP → the REAL
 * MCP handler (key auth, `calling` scope, rate limit) → callingCapability.
 * The capability's downstream Contact-flow routes are stubbed here (they are
 * exercised for real in src/__tests__/lib/mcp/calling-mcp.test.ts). Only the
 * network hop (global fetch) is in-process. No phone call can be placed.
 */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/logger/structured-logger', () => ({ StructuredLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { mintApiKey, MCP_API_KEYS_COLLECTION } from '@/lib/mcp/api-keys';
import { handleMcpHttpRequest } from '@/lib/mcp/http-handler';
import { callingCapability } from '@/lib/mcp/calling/capability';
import { getCallingDemoConfig } from '@/lib/mcp-demo/calling-client';

const realFetchApi = jest.requireActual('whatwg-fetch');
const stubbed = { Headers: global.Headers, Request: global.Request, Response: global.Response, fetch: global.fetch };
beforeAll(() => Object.assign(global, { Headers: realFetchApi.Headers, Request: realFetchApi.Request, Response: realFetchApi.Response }));
afterAll(() => Object.assign(global, stubbed));

const PEPPER = 'calling-demo-pepper-0123456789-abcdefg';
const MCP_URL = 'http://127.0.0.1:3000/api/mcp/calling';
const docs = new Map<string, Record<string, any>>();
const snap = (p: string) => ({ id: p.split('/').pop()!, exists: docs.has(p), data: () => docs.get(p) });
const coll = (p: string): any => ({
    doc: (id: string) => ({ get: async () => snap(`${p}/${id}`), collection: (c: string) => coll(`${p}/${id}/${c}`) }),
    get: async () => ({ docs: [...docs.keys()].filter((k) => k.startsWith(`${p}/`) && !k.slice(p.length + 1).includes('/')).map(snap) }),
    orderBy: () => coll(p),
    where: (_f: string, _op: string, v: string[]) => ({ get: async () => ({ docs: [...docs.keys()].filter((k) => k.startsWith('classes/') && k.split('/').length === 2 && v.includes(docs.get(k)!.teacherUid)).map(snap) }) }),
});
const fakeDb = { collection: (c: string) => coll(c) };

const json = (b: unknown, status = 200) => new realFetchApi.Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
const routes = {
    parentMessage: jest.fn(async () => json({ message: 'Dear parent, Ravi has been absent…', spokenScript: 'Namaste…' })),
    outreach: jest.fn(async () => json({ outreachId: 'out-secret-1' })),
    call: jest.fn(async () => json({ callSid: 'CA-secret-sid' })),
};
const capability = callingCapability({
    getDb: async () => fakeDb as any, routes, callbackBaseUrl: 'https://app.sahayak.example',
    checkCallingWindow: () => ({ allowed: true, istHour: 11, istTime: '11:00', reason: '', nextAllowedAt: null }),
});
const mcpRequests: Request[] = [];
let apiKey = '';
const env = process.env as Record<string, string | undefined>;

beforeEach(() => {
    docs.clear();
    docs.set('organizations/org-a', { name: 'School A' });
    docs.set('organizations/org-a/members/teacher-a', { role: 'teacher' });
    docs.set('users/teacher-a', { planType: 'gold' });
    docs.set('classes/class-6a', { teacherUid: 'teacher-a', name: 'Class 6A', subject: 'Science' });
    docs.set('classes/class-6a/students/stu-1', { name: 'Ravi', rollNumber: 1, parentPhone: '+919876543210', parentLanguage: 'Hindi' });
    const minted = mintApiKey({ orgId: 'org-a', label: 'demo', scopes: ['calling'], createdBy: 'jest', pepper: PEPPER });
    docs.set(`${MCP_API_KEYS_COLLECTION}/${minted.keyId}`, minted.record as any);
    apiKey = minted.apiKey;
    env.MCP_API_KEY_PEPPER = PEPPER;
    env.MCP_CALLING_DEMO_API_KEY = apiKey;
    env.MCP_CALLING_DEMO_SERVER_URL = MCP_URL;
    Object.values(routes).forEach((r) => r.mockClear());
    mcpRequests.length = 0;
    (global as any).fetch = async (url: string, init?: RequestInit) => {
        const req = new Request(String(url), init);
        mcpRequests.push(req.clone());
        return handleMcpHttpRequest(req, capability, { getDb: async () => fakeDb as any, rateLimit: async () => undefined });
    };
});
afterEach(() => { delete env.MCP_CALLING_DEMO_API_KEY; delete env.MCP_CALLING_DEMO_SERVER_URL; });

import { GET, POST } from '@/app/api/mcp-demo/calling/route';
const signedIn = (body?: unknown) => new Request('http://localhost/api/mcp-demo/calling', {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-user-id': 'teacher-a', 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const CALL = { action: 'call', class_id: 'class-6a', student_id: 'stu-1', reason: 'consecutive_absences' };

it('GET: MCP status from initialize + tools/list', async () => {
    expect(await (await GET(signedIn())).json()).toEqual({
        configured: true, connected: true,
        server: { name: 'sahayak-parent-calling', version: '1.0.0', tool: 'initiate_parent_call', protocol: 'Streamable HTTP' },
    });
});

it('list → list_parent_contacts through MCP, masked', async () => {
    const res = await POST(signedIn({ action: 'list' }));
    const body = await res.json();
    expect(body.result.classes[0]).toMatchObject({ class_id: 'class-6a', students: [{ student_id: 'stu-1', parent_phone_last4: '3210' }] });
    expect(JSON.stringify(body)).not.toContain('9876543210');
});

it('call → initiate_parent_call through the MCP endpoint with the server key; nothing secret reaches the browser', async () => {
    const res = await POST(signedIn(CALL));
    expect(res.status).toBe(200);
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.result).toMatchObject({ status: 'call_initiated', student_name: 'Ravi', parent_phone_last4: '3210' });
    expect(body.mcp).toMatchObject({ name: 'sahayak-parent-calling', tool: 'initiate_parent_call', protocol: 'Streamable HTTP' });
    expect(routes.call).toHaveBeenCalledTimes(1);
    expect(mcpRequests.every((r) => r.url === MCP_URL && r.headers.get('authorization') === `Bearer ${apiKey}`)).toBe(true);
    for (const s of [apiKey, MCP_URL, '9876543210', 'out-secret-1', 'CA-secret-sid', 'teacher-a', PEPPER]) expect(text).not.toContain(s);
});

it('requires a signed-in Sahayak user (not an open telephony proxy)', async () => {
    expect((await POST(new Request('http://localhost/x', { method: 'POST', body: JSON.stringify(CALL) }))).status).toBe(401);
    expect((await GET(new Request('http://localhost/x'))).status).toBe(401);
    expect(mcpRequests).toHaveLength(0);
});

it('rejects phone numbers, tenant fields and unknown actions before calling MCP', async () => {
    for (const bad of [{ ...CALL, phone_number: '+911111111111' }, { ...CALL, org_id: 'org-z' }, { action: 'dial', to: '+911111111111' }]) {
        const res = await POST(signedIn(bad));
        expect(res.status).toBe(400);
    }
    expect(mcpRequests).toHaveLength(0);
    expect(routes.call).not.toHaveBeenCalled();
});

it('maps MCP errors (foreign class → 404 not_found)', async () => {
    const res = await POST(signedIn({ ...CALL, class_id: 'class-zz' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error.category).toBe('not_found');
});

it('the MCP URL never comes from the request; dev key only under next dev', () => {
    expect(getCallingDemoConfig({ MCP_CALLING_DEMO_API_KEY: 'k' })!.url).toBe('http://127.0.0.1:3000/api/mcp/calling');
    expect(getCallingDemoConfig({ NODE_ENV: 'production', MCP_LOCAL_DEV_API_KEY: 'dev' })).toBeNull();
    expect(getCallingDemoConfig({ NODE_ENV: 'development', MCP_LOCAL_DEV_API_KEY: 'dev' })!.apiKey).toBe('dev');
});
