/**
 * @jest-environment node
 *
 * Sahayak Parent Calling MCP — end to end, in-process:
 *
 *   official MCP SDK client → Streamable HTTP → handleMcpHttpRequest (API key, scope, rate limit)
 *     → initiate_parent_call → the REAL existing route handlers:
 *         POST /api/ai/parent-message  → POST /api/attendance/outreach → POST /api/attendance/call
 *
 * MOCKED (no real side effects): Firestore (in-memory fake below), the AI
 * message model (dispatchParentMessage), the plan-quota HOF (withPlanCheck →
 * pass-through), quiet hours (controllable), and the Twilio REST call (global
 * fetch). No phone call can be placed by this test.
 */
jest.mock('server-only', () => ({}));
const logInfo = jest.fn();
const logWarn = jest.fn();
jest.mock('@/lib/logger/structured-logger', () => ({
    StructuredLogger: { info: (...a: unknown[]) => logInfo(...a), warn: (...a: unknown[]) => logWarn(...a), error: jest.fn() },
}));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

// ── in-memory Firestore ─────────────────────────────────────────────────────
const store = new Map<string, Record<string, any>>();
let autoId = 0;
type Filter = { field: string; op: string; value: any };
function snapOf(path: string) {
    const data = store.get(path);
    return { id: path.split('/').pop()!, exists: data !== undefined, data: () => (data ? { ...data } : undefined), ref: { path } };
}
function query(col: string, filters: Filter[] = [], lim = Infinity, order?: string): any {
    const run = () => [...store.keys()]
        .filter((p) => p.startsWith(`${col}/`) && !p.slice(col.length + 1).includes('/'))
        .map(snapOf)
        .filter((s) => filters.every(({ field, op, value }) => {
            const v = s.data()![field];
            return op === '==' ? v === value : op === '>=' ? v >= value : op === 'in' ? value.includes(v) : false;
        }))
        .sort((a, b) => (order ? (a.data()![order] ?? 0) - (b.data()![order] ?? 0) : 0))
        .slice(0, lim);
    return {
        where: (field: string, op: string, value: any) => query(col, [...filters, { field, op, value }], lim, order),
        limit: (n: number) => query(col, filters, n, order),
        orderBy: (field: string) => query(col, filters, lim, field),
        get: async () => { const docs = run(); return { docs, empty: docs.length === 0, size: docs.length }; },
        doc: (id?: string) => docRef(`${col}/${id ?? `auto${++autoId}`}`),
    };
}
function docRef(path: string): any {
    return {
        id: path.split('/').pop(),
        path,
        get: async () => snapOf(path),
        set: async (data: any) => { store.set(path, { ...data }); },
        update: async (data: any) => { if (!store.has(path)) throw new Error('no doc'); store.set(path, { ...store.get(path), ...data }); },
        collection: (c: string) => query(`${path}/${c}`),
    };
}
const fakeDb = { collection: (c: string) => query(c), doc: (p: string) => docRef(p) };
jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => fakeDb }));
jest.mock('@/lib/db/adapter', () => ({ dbAdapter: { getUser: async (uid: string) => store.get(`users/${uid}`) ?? null } }));

// ── model / quota / clock / pipeline ────────────────────────────────────────
const mockDispatch = jest.fn();
jest.mock('@/lib/sidecar/parent-message-dispatch', () => ({ dispatchParentMessage: (...a: unknown[]) => mockDispatch(...a) }));
const mockPlanFeatures: string[] = [];
jest.mock('@/lib/plan-guard', () => ({ withPlanCheck: (feature: string) => (h: any) => (req: any) => { mockPlanFeatures.push(feature); return h(req); } }));
const mockWindow = { allowed: true };
jest.mock('@/lib/calling-hours', () => ({
    checkCallingWindow: () => (mockWindow.allowed
        ? { allowed: true, istHour: 11, istTime: '11:00', reason: '', nextAllowedAt: null }
        : { allowed: false, istHour: 23, istTime: '23:00', reason: 'Calls to parents are only placed between 9 AM and 9 PM IST.', nextAllowedAt: new Date(Date.now() + 3600_000) }),
}));
jest.mock('@/lib/voice-pipeline/health', () => ({ getEffectiveMode: async () => 'batch' }));
// The existing routes answer with NextResponse.json(); in this jsdom-flavoured Jest setup NextResponse
// subclasses a stubbed Response, so produce standard Responses instead (route logic is untouched).
jest.mock('next/server', () => ({
    ...jest.requireActual('next/server'),
    NextResponse: {
        json: (data: unknown, init: ResponseInit = {}) => {
            const R = jest.requireActual('whatwg-fetch').Response;
            return new R(JSON.stringify(data), { ...init, headers: { 'content-type': 'application/json', ...(init.headers as any) } });
        },
    },
}));

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { toolErrorOf } from '@/lib/mcp/errors';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { mintApiKey, MCP_API_KEYS_COLLECTION, type McpScope } from '@/lib/mcp/api-keys';
import { handleMcpHttpRequest, type McpCapabilityDefinition } from '@/lib/mcp/http-handler';
import { callingCapability } from '@/lib/mcp/calling/capability';
import { ParentCallResult, ParentContactsResult } from '@/lib/mcp/calling/schema';
import { lessonPlannerCapability } from '@/lib/mcp/lesson-planner/capability';
import { checkCallingWindow } from '@/lib/calling-hours';
import { POST as parentMessageRoute } from '@/app/api/ai/parent-message/route';
import { POST as outreachRoute } from '@/app/api/attendance/outreach/route';
import { POST as callRoute } from '@/app/api/attendance/call/route';

const realFetchApi = jest.requireActual('whatwg-fetch');
const stubbed = { Headers: global.Headers, Request: global.Request, Response: global.Response, fetch: global.fetch };
beforeAll(() => Object.assign(global, { Headers: realFetchApi.Headers, Request: realFetchApi.Request, Response: realFetchApi.Response }));
afterAll(() => Object.assign(global, stubbed));

// NextResponse (used by the existing routes) captured the stubbed Response at import; give the
// routes' responses a standard json()/ok/status via a thin normaliser.
const normalise = (h: (r: any) => Promise<any>) => async (req: Request) => {
    const res = await h(req);
    const body = await res.text();
    return new realFetchApi.Response(body, { status: res.status, headers: { 'content-type': 'application/json' } });
};

const PEPPER = 'calling-pepper-0123456789-abcdefghijkl';
const CALLBACK_BASE = 'https://app.sahayak.example';
const PHONE = '+919876543210';
const twilioCalls: Array<{ url: string; body: URLSearchParams }> = [];
let twilioReply: () => { status: number; body: unknown } = () => ({ status: 201, body: { sid: 'CA_secret_sid_123' } });

const deps = () => ({
    getDb: async () => fakeDb as any,
    routes: { parentMessage: normalise(parentMessageRoute), outreach: normalise(outreachRoute), call: normalise(callRoute) },
    callbackBaseUrl: CALLBACK_BASE as string | null,
    checkCallingWindow: () => checkCallingWindow(),
});
let capDeps = deps();
const capability = () => callingCapability(capDeps);
const mcpRateLimit = jest.fn(async () => undefined);
const callServer = (req: Request, cap: McpCapabilityDefinition = capability()) =>
    handleMcpHttpRequest(req, cap, { getDb: async () => fakeDb as any, rateLimit: mcpRateLimit });

function issue(orgId: string, scopes: McpScope[]) {
    const { apiKey, keyId, record } = mintApiKey({ orgId, label: 'test', scopes, createdBy: 'jest', pepper: PEPPER });
    store.set(`${MCP_API_KEYS_COLLECTION}/${keyId}`, record as any);
    return { apiKey, keyId };
}
async function connect(apiKey: string) {
    const client = new Client({ name: 'school-sis', version: '1.0.0' });
    await client.connect(new StreamableHTTPClientTransport(new URL('https://sahayak.test/api/mcp/calling'), {
        requestInit: { headers: { Authorization: `Bearer ${apiKey}`, 'X-Org-Id': 'org-b' } },
        fetch: async (url, init) => callServer(new Request(url, init)),
    }));
    // Like real MCP clients, list tools first: this arms the SDK client's output-schema
    // validation, so an error result carrying non-conforming structuredContent fails here.
    await client.listTools();
    return client;
}
async function callTool(apiKey: string, name: string, args: Record<string, unknown>): Promise<any> {
    const client = await connect(apiKey);
    try {
        return await client.callTool({ name, arguments: args });
    } catch (e) {
        return { isError: true, thrown: String((e as Error).message) };
    } finally {
        await client.close();
    }
}

const outreachDocs = () => [...store.keys()].filter((k) => k.startsWith('parent_outreach/')).map((k) => store.get(k)!);
const CALL = { class_id: 'class-6a', student_id: 'stu-1', reason: 'consecutive_absences', teacher_note: 'Absent since Monday' };
let keyA: { apiKey: string; keyId: string };

beforeEach(() => {
    store.clear();
    twilioCalls.length = 0;
    mockPlanFeatures.length = 0;
    mockWindow.allowed = true;
    capDeps = deps();
    twilioReply = () => ({ status: 201, body: { sid: 'CA_secret_sid_123' } });
    process.env.MCP_API_KEY_PEPPER = PEPPER;
    Object.assign(process.env, { TWILIO_ACCOUNT_SID: 'ACtest', TWILIO_AUTH_TOKEN: 'tok', TWILIO_PHONE_NUMBER: '+15550001111' });
    delete process.env.VOICE_PROVIDER;
    delete process.env.TWILIO_TEST_OVERRIDE_NUMBER;
    // School A: teacher-a owns class-6a with two students; teacher-x (another school) owns class-x.
    store.set('organizations/org-a', { name: 'School A' });
    store.set('organizations/org-a/members/teacher-a', { role: 'teacher' });
    store.set('organizations/org-b', { name: 'School B' });
    store.set('users/teacher-a', { planType: 'gold', displayName: 'Mrs Rao', schoolName: 'School A' });
    store.set('users/teacher-x', { planType: 'gold' });
    store.set('classes/class-6a', { teacherUid: 'teacher-a', name: 'Class 6A', subject: 'Science', gradeLevel: 'Class 6' });
    store.set('classes/class-6a/students/stu-1', { name: 'Ravi Kumar', rollNumber: 1, parentPhone: PHONE, parentLanguage: 'Hindi' });
    store.set('classes/class-6a/students/stu-2', { name: 'Asha', rollNumber: 2, parentPhone: '', parentLanguage: 'English' });
    store.set('classes/class-x', { teacherUid: 'teacher-x', name: 'Class X', subject: 'Mathematics' });
    store.set('classes/class-x/students/stu-x', { name: 'Other', rollNumber: 1, parentPhone: '+919000000001', parentLanguage: 'English' });
    keyA = issue('org-a', ['calling']);
    mockDispatch.mockReset().mockResolvedValue({ message: 'Namaste, Ravi has been absent since Monday…', spokenScript: 'Namaste ji, main Sahayak se bol rahi hoon…', languageCode: 'hi-IN', wordCount: 40 });
    (global as any).fetch = async (url: string, init: RequestInit) => {
        if (String(url).includes('twilio.com')) {
            twilioCalls.push({ url: String(url), body: new URLSearchParams(String(init.body)) });
            const r = twilioReply();
            return new realFetchApi.Response(JSON.stringify(r.body), { status: r.status });
        }
        throw new Error(`unexpected network call: ${url}`);
    };
});

describe('discovery', () => {
    it('exposes list_parent_contacts and initiate_parent_call; no phone-number input exists', async () => {
        const client = await connect(keyA.apiKey);
        expect(client.getServerVersion()).toMatchObject({ name: 'sahayak-parent-calling', version: '1.0.0' });
        const { tools } = await client.listTools();
        expect(tools.map((t) => t.name)).toEqual(['list_parent_contacts', 'initiate_parent_call']);
        const call = tools.find((t) => t.name === 'initiate_parent_call')!;
        expect(call.inputSchema).toMatchObject({ additionalProperties: false, required: ['class_id', 'student_id', 'reason'] });
        expect(Object.keys(call.inputSchema.properties ?? {})).toEqual(['class_id', 'student_id', 'reason', 'teacher_note', 'subject']);
        expect(JSON.stringify(call.inputSchema)).not.toMatch(/phone_number|"to"|destination/i);
        expect(call.annotations).toMatchObject({ readOnlyHint: false, openWorldHint: true });
        expect(tools[0].annotations).toMatchObject({ readOnlyHint: true });
        await client.close();
    });
});

describe('initiate_parent_call — through the real Contact flow', () => {
    it('places one provider call to the STORED parent number, as the class teacher, and returns a clean result', async () => {
        const res = await callTool(keyA.apiKey, 'initiate_parent_call', CALL);
        expect(res.isError).toBeFalsy();
        const out = ParentCallResult.parse(res.structuredContent);
        expect(out).toMatchObject({ status: 'call_initiated', student_name: 'Ravi Kumar', class_name: 'Class 6A', parent_language: 'Hindi', parent_phone_last4: '3210', reason: 'consecutive_absences' });
        expect(out.spoken_script).toMatch(/Namaste ji/);

        // existing routes ran as teacher-a: message (plan-gated), outreach record, Twilio dial
        expect(mockPlanFeatures).toEqual(['parent-message']);
        expect(mockDispatch).toHaveBeenCalledWith(expect.objectContaining({ userId: 'teacher-a', studentName: 'Ravi Kumar', className: 'Class 6A', subject: 'Science', reason: 'consecutive_absences', parentLanguage: 'Hindi', teacherNote: 'Absent since Monday' }));
        const [rec] = outreachDocs();
        expect(rec).toMatchObject({ teacherUid: 'teacher-a', studentId: 'stu-1', parentPhone: PHONE, callStatus: 'initiated', callSid: 'CA_secret_sid_123', deliveryMethod: 'twilio_call', teacherName: 'Mrs Rao' });
        expect(twilioCalls).toHaveLength(1);
        expect(twilioCalls[0].body.get('To')).toBe(PHONE);
        // provider callbacks point at the CONFIGURED Sahayak host, not the MCP caller's Host header
        expect(twilioCalls[0].body.get('Url')).toMatch(/^https:\/\/app\.sahayak\.example\/api\/attendance\/twiml\?outreachId=/);

        const wire = JSON.stringify(res);
        for (const leak of [PHONE, '9876543210', 'CA_secret_sid_123', 'teacher-a', 'auto', 'ACtest']) expect(wire).not.toContain(leak);
        expect(mcpRateLimit).toHaveBeenCalledWith(`mcp_${keyA.keyId}`);
    });

    it('honours the existing test-override number (no real parent dialled)', async () => {
        process.env.TWILIO_TEST_OVERRIDE_NUMBER = '+15550009999';
        await callTool(keyA.apiKey, 'initiate_parent_call', CALL);
        expect(twilioCalls[0].body.get('To')).toBe('+15550009999');
    });

    it.each([
        [{ ...CALL, phone_number: '+911234567890' }, 'phone_number'],
        [{ ...CALL, parentPhone: '+911234567890' }, 'parentPhone'],
        [{ ...CALL, org_id: 'org-x' }, 'org_id'],
        [{ ...CALL, teacher_uid: 'teacher-x' }, 'teacher_uid'],
        [{ ...CALL, class_id: '../classes/class-x' }, 'Invalid class_id'],
        [{ ...CALL, reason: 'debt_collection' }, 'Invalid reason'],
        [{ ...CALL, teacher_note: 'x'.repeat(501) }, 'at most 500'],
        [{ class_id: 'class-6a', reason: 'positive_feedback' }, 'student_id'],
    ])('rejects %j before anything runs', async (args, expected) => {
        const res = await callTool(keyA.apiKey, 'initiate_parent_call', args as any);
        expect(res.isError).toBe(true);
        expect(JSON.stringify(res)).toContain(expected);
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(twilioCalls).toHaveLength(0);
        expect(outreachDocs()).toHaveLength(0);
    });
});

describe('tenant isolation and authorization', () => {
    it('a class whose teacher is not in the key\'s organisation is invisible (not_found), nothing happens', async () => {
        const res = await callTool(keyA.apiKey, 'initiate_parent_call', { ...CALL, class_id: 'class-x', student_id: 'stu-x' });
        expect(toolErrorOf(res)).toMatchObject({ category: 'not_found' });
        expect(twilioCalls).toHaveLength(0);
        expect(outreachDocs()).toHaveLength(0);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    it('another school\'s key cannot reach School A, and gets the same message as a missing class', async () => {
        const keyB = issue('org-b', ['calling']);
        const forbidden = await callTool(keyB.apiKey, 'initiate_parent_call', CALL);
        const missing = await callTool(keyB.apiKey, 'initiate_parent_call', { ...CALL, class_id: 'no-such-class' });
        expect(toolErrorOf(forbidden)).toEqual(toolErrorOf(missing));
        expect(twilioCalls).toHaveLength(0);
    });

    it('unknown student → not_found; student without a phone → invalid_input; neither dials', async () => {
        expect(toolErrorOf(await callTool(keyA.apiKey, 'initiate_parent_call', { ...CALL, student_id: 'nobody' }))?.category).toBe('not_found');
        expect(toolErrorOf(await callTool(keyA.apiKey, 'initiate_parent_call', { ...CALL, student_id: 'stu-2' }))?.category).toBe('invalid_input');
        expect(twilioCalls).toHaveLength(0);
    });

    it('the class teacher\'s plan still gates calling (existing PREMIUM_REQUIRED rule)', async () => {
        store.set('users/teacher-a', { planType: 'free' });
        const res = await callTool(keyA.apiKey, 'initiate_parent_call', CALL);
        expect(toolErrorOf(res)).toMatchObject({ category: 'authorization' });
        expect(twilioCalls).toHaveLength(0);
    });
});

describe('existing safety rules hold over MCP', () => {
    it('quiet hours: refused before any model call or record is written', async () => {
        mockWindow.allowed = false;
        const res = await callTool(keyA.apiKey, 'initiate_parent_call', CALL);
        expect(toolErrorOf(res)).toMatchObject({ category: 'outside_allowed_hours', retryable: true });
        expect(toolErrorOf(res)?.retry_after_seconds).toBeGreaterThan(0);
        expect(mockDispatch).not.toHaveBeenCalled();
        expect(outreachDocs()).toHaveLength(0);
    });

    it('quiet hours are still enforced by the existing call route itself (defence in depth)', async () => {
        capDeps.checkCallingWindow = () => ({ allowed: true, istHour: 11, istTime: '11:00', reason: '', nextAllowedAt: null });
        mockWindow.allowed = false; // the route's own check
        const res = await callTool(keyA.apiKey, 'initiate_parent_call', CALL);
        expect(toolErrorOf(res)?.category).toBe('outside_allowed_hours');
        expect(twilioCalls).toHaveLength(0);
    });

    it('5-minute dedup: a second call to the same parent is refused with retry_after', async () => {
        await callTool(keyA.apiKey, 'initiate_parent_call', CALL);
        const again = await callTool(keyA.apiKey, 'initiate_parent_call', CALL);
        expect(toolErrorOf(again)).toMatchObject({ category: 'rate_limited', retryable: true });
        expect(toolErrorOf(again)?.retry_after_seconds).toBeGreaterThan(0);
        expect(twilioCalls).toHaveLength(1);
    });

    it('transient provider failure → retryable upstream_unavailable; dedup kept (existing rule); no internals leaked', async () => {
        twilioReply = () => ({ status: 500, body: { code: 20500, message: 'internal twilio account AC999 detail' } });
        const res = await callTool(keyA.apiKey, 'initiate_parent_call', CALL);
        expect(toolErrorOf(res)).toMatchObject({ category: 'upstream_unavailable', retryable: true });
        expect(JSON.stringify(res)).not.toMatch(/AC999|twilio account/i);
        expect(outreachDocs()[0].callStatus).toBe('initiated');
    });

    it('Twilio refuses the request itself (trial parameter limit, code 0) → not_configured, NOT retryable; record marked failed', async () => {
        twilioReply = () => ({ status: 400, body: { code: 0, message: 'Invalid or disallowed parameters provided - trial accounts have limited parameter access, upgrade your account to unlock full functionality' } });
        const res = await callTool(keyA.apiKey, 'initiate_parent_call', CALL);
        expect(toolErrorOf(res)).toMatchObject({ category: 'not_configured', retryable: false });
        expect(JSON.stringify(res)).not.toMatch(/trial accounts|upgrade your account/i);
        expect(twilioCalls).toHaveLength(1);
        expect(outreachDocs()[0]).toMatchObject({ callStatus: 'failed', callFailureCategory: 'provider_unconfigured' });
    });

    it('Create Call keeps answering-machine detection, GET TwiML and the full status callback', async () => {
        await callTool(keyA.apiKey, 'initiate_parent_call', CALL);
        const body = twilioCalls[0].body;
        expect(body.get('MachineDetection')).toBe('DetectMessageEnd');
        expect(body.get('Method')).toBe('GET');
        expect(body.get('StatusCallback')).toBe(`${CALLBACK_BASE}/api/attendance/twiml-status`);
        expect(body.get('StatusCallbackEvent')).toBe('initiated ringing answered completed');
    });

    it('unreachable parent number → invalid_input; record marked failed so dedup is released (existing rule)', async () => {
        twilioReply = () => ({ status: 400, body: { code: 21211, message: 'Invalid To number +919876543210' } });
        const res = await callTool(keyA.apiKey, 'initiate_parent_call', CALL);
        expect(toolErrorOf(res)).toMatchObject({ category: 'invalid_input', retryable: false });
        expect(toolErrorOf(res)?.message).toMatch(/could not be reached/);
        expect(JSON.stringify(res)).not.toContain('9876543210');
        expect(outreachDocs()[0].callStatus).toBe('failed');
    });

    it('provider not configured → not_configured, nothing dialled', async () => {
        delete process.env.TWILIO_AUTH_TOKEN;
        const res = await callTool(keyA.apiKey, 'initiate_parent_call', CALL);
        expect(toolErrorOf(res)).toMatchObject({ category: 'not_configured', retryable: false });
        expect(twilioCalls).toHaveLength(0);
    });

    it('no callback base URL configured → not_configured before anything runs', async () => {
        capDeps.callbackBaseUrl = null;
        const res = await callTool(keyA.apiKey, 'initiate_parent_call', CALL);
        expect(toolErrorOf(res)?.category).toBe('not_configured');
        expect(outreachDocs()).toHaveLength(0);
    });

    it('logs never contain the phone number or the message', async () => {
        await callTool(keyA.apiKey, 'initiate_parent_call', CALL);
        const logs = JSON.stringify([...logInfo.mock.calls, ...logWarn.mock.calls]);
        expect(logs).toContain('initiate_parent_call');
        for (const s of [PHONE, 'Namaste', 'Ravi']) expect(logs).not.toContain(s);
    });
});

describe('list_parent_contacts', () => {
    it('lists only the organisation\'s classes, with masked phones', async () => {
        const res = await callTool(keyA.apiKey, 'list_parent_contacts', {});
        const out = ParentContactsResult.parse(res.structuredContent);
        expect(out.classes.map((c) => c.class_id)).toEqual(['class-6a']);
        expect(out.classes[0].students).toEqual([
            { student_id: 'stu-1', name: 'Ravi Kumar', roll_number: 1, parent_language: 'Hindi', parent_reachable: true, parent_phone_last4: '3210' },
            { student_id: 'stu-2', name: 'Asha', roll_number: 2, parent_language: 'English', parent_reachable: false, parent_phone_last4: '' },
        ]);
        expect(JSON.stringify(res)).not.toContain('9876543210');
        expect(JSON.stringify(res)).not.toContain('teacher-a');
    });

    it('a foreign class_id is not_found', async () => {
        expect(toolErrorOf(await callTool(keyA.apiKey, 'list_parent_contacts', { class_id: 'class-x' }))?.category).toBe('not_found');
    });
});

describe('auth and scope isolation', () => {
    const rawList = (headers: Record<string, string>, cap?: McpCapabilityDefinition) => callServer(new Request('https://sahayak.test/api/mcp/calling', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    }), cap);

    it('missing / invalid key → 401', async () => {
        expect((await rawList({})).status).toBe(401);
        expect((await rawList({ Authorization: `Bearer sk_sahayak_0123456789abcdef_${'A'.repeat(43)}` })).status).toBe(401);
    });

    it('a key without the calling scope → 403; a calling key cannot use other MCP servers', async () => {
        const lp = issue('org-a', ['lesson-planner', 'exam-paper', 'quiz']);
        expect((await rawList({ Authorization: `Bearer ${lp.apiKey}` })).status).toBe(403);
        expect((await rawList({ Authorization: `Bearer ${keyA.apiKey}` }, lessonPlannerCapability(jest.fn() as any))).status).toBe(403);
    });
});
