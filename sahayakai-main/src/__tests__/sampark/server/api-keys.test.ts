/** @jest-environment node */
/**
 * Integrations: the school's MCP API keys (Sampark + MCP integration brief, Step 1A).
 *
 *   - Any school admin (owner or members/{uid}.role === 'admin') can create, list and
 *     revoke keys (decision 3); everyone else gets 403 from every route, and nothing is written.
 *   - Only lesson-planner / exam-paper / quiz can be granted; `calling` is refused (decision 1).
 *   - Create and revoke are audited (api_key.created / api_key.revoked) with key id and label.
 *   - A revoked key fails its very next MCP request.
 *   - authenticateMcpRequest writes lastUsedAt at most once a minute per key, also under concurrency.
 *
 * CLASS GATE — "the full key appears exactly once": every route response, every stored
 * document, every audit entry and every logger call made in this file is recorded, and
 * the key's secret may appear in exactly one place: the body of the create response.
 */

jest.mock('server-only', () => ({}));
const mockLog = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
jest.mock('@/lib/logger', () => ({ get logger() { return mockLog; } }));
jest.mock('@/lib/logger/structured-logger', () => ({ get StructuredLogger() { return mockLog; } }));

// ── fake Firestore: organizations (+members) and mcp_api_keys ───────────────
const mockDocs = new Map<string, Record<string, any>>();
const mockWrites: { op: string; path: string; data: unknown }[] = [];
const mockFailUpdates = { on: false };
function mockDocRef(path: string): any {
    const snap = () => ({ id: path.split('/').pop()!, exists: mockDocs.has(path), data: () => (mockDocs.has(path) ? { ...mockDocs.get(path) } : undefined) });
    return {
        get: async () => snap(),
        create: async (data: Record<string, unknown>) => {
            if (mockDocs.has(path)) throw new Error('ALREADY_EXISTS');
            mockWrites.push({ op: 'create', path, data });
            mockDocs.set(path, { ...data });
        },
        update: async (data: Record<string, unknown>) => {
            if (mockFailUpdates.on) throw new Error('UNAVAILABLE');
            if (!mockDocs.has(path)) throw new Error('NOT_FOUND');
            mockWrites.push({ op: 'update', path, data });
            mockDocs.set(path, { ...mockDocs.get(path), ...data });
        },
        collection: (c: string) => mockColl(`${path}/${c}`),
    };
}
function mockColl(path: string): any {
    const children = () => [...mockDocs.keys()].filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes('/'));
    return {
        doc: (id: string) => mockDocRef(`${path}/${id}`),
        where: (field: string, _op: string, value: unknown) => ({
            limit: (n: number) => ({
                get: async () => ({
                    docs: children().filter((k) => mockDocs.get(k)![field] === value).slice(0, n)
                        .map((k) => ({ id: k.split('/').pop()!, data: () => ({ ...mockDocs.get(k) }) })),
                }),
            }),
        }),
    };
}
const mockDb = { collection: (c: string) => mockColl(c) };
jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => mockDb, initializeFirebase: async () => undefined }));

import { NextResponse } from 'next/server';

import { authenticateMcpRequest, LAST_USED_WRITE_INTERVAL_MS, resetLastUsedThrottleForTests } from '@/lib/mcp/auth';
import { handleMcpHttpRequest } from '@/lib/mcp/http-handler';
import { lessonPlannerCapability } from '@/lib/mcp/lesson-planner/capability';
import { MCP_API_KEYS_COLLECTION, parseApiKey } from '@/lib/mcp/api-keys';
import type { AuditEntry } from '@/lib/sampark/ports';
import { setSamparkClockForTests, setSamparkRepoForTests } from '@/lib/sampark/repo/factory';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { enableSchool } from '@/server/sampark/school';
import { CONSOLE_SCOPES } from '@/server/sampark/api-keys';
import { ADMIN, MON_11_IST, ORG, recordingRepo, setPhoneEnv, testClock, type TestClock } from './_helpers';

// jest.setup stubs the fetch API globals; the MCP handler needs real ones (only while it runs).
const realFetchApi = jest.requireActual('whatwg-fetch');
async function withRealFetchApi<T>(fn: () => Promise<T>): Promise<T> {
    const stubbed = { Headers: global.Headers, Request: global.Request, Response: global.Response };
    Object.assign(global, { Headers: realFetchApi.Headers, Request: realFetchApi.Request, Response: realFetchApi.Response });
    try {
        return await fn();
    } finally {
        Object.assign(global, stubbed);
    }
}

const PEPPER = 'api-keys-test-pepper-0123456789-abcdef';
const MEMBER_ADMIN = 'member-admin';
const TEACHER = 'teacher-1';
const OTHER_ORG = 'other-school';

// ── route harness (captures every response body) ────────────────────────────
const jsonSpy = jest.spyOn(NextResponse, 'json');
const responses: { route: string; status: number; body: any }[] = [];
type Handler = (req: unknown, ctx: { params: Promise<Record<string, string>> }) => Promise<unknown>;

async function call(route: 'list' | 'create' | 'revoke', opts: { uid?: string | null; orgId?: string; body?: unknown; keyId?: string } = {}) {
    const uid = opts.uid === undefined ? ADMIN : opts.uid;
    const req = { headers: { get: (k: string) => (k.toLowerCase() === 'x-user-id' ? uid : null) }, json: async () => opts.body };
    const params = Promise.resolve({ orgId: opts.orgId ?? ORG, keyId: opts.keyId ?? '' });
    jsonSpy.mockClear();
    if (route === 'revoke') {
        const { POST } = (await import('@/app/api/sampark/[orgId]/api-keys/[keyId]/revoke/route')) as unknown as { POST: Handler };
        await POST(req, { params });
    } else {
        const mod = (await import('@/app/api/sampark/[orgId]/api-keys/route')) as unknown as { GET: Handler; POST: Handler };
        await (route === 'list' ? mod.GET : mod.POST)(req, { params });
    }
    const last = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1];
    const res = { route, status: (last[1] as { status?: number } | undefined)?.status ?? 200, body: last[0] as any };
    responses.push(res);
    return res;
}

let repo: ReturnType<typeof recordingRepo>;
let clock: TestClock;
const audits = (action?: string) =>
    repo.writes.filter((w) => w.method === 'appendAudit').map((w) => w.args[1] as AuditEntry).filter((a) => !action || a.action === action);
const allAudits: AuditEntry[] = [];
const issuedSecrets: string[] = [];

beforeAll(() => {
    setPhoneEnv();
    process.env.MCP_API_KEY_PEPPER = PEPPER;
});
beforeEach(async () => {
    process.env.SAMPARK_ENABLED = 'true';
    mockDocs.clear();
    mockWrites.length = 0;
    mockFailUpdates.on = false;
    resetLastUsedThrottleForTests();
    mockDocs.set(`organizations/${ORG}`, { name: 'Hillview Demo School', adminUserId: ADMIN });
    mockDocs.set(`organizations/${ORG}/members/${MEMBER_ADMIN}`, { userId: MEMBER_ADMIN, role: 'admin' });
    mockDocs.set(`organizations/${ORG}/members/${TEACHER}`, { userId: TEACHER, role: 'teacher' });
    mockDocs.set(`organizations/${OTHER_ORG}`, { name: 'Other School', adminUserId: 'other-admin' });
    repo = recordingRepo(createMemorySamparkRepo());
    clock = testClock(MON_11_IST);
    setSamparkRepoForTests(repo);
    setSamparkClockForTests(clock);
    await enableSchool({ repo, clock }, ORG, ADMIN, { displayName: 'Hillview Demo School', isDemo: true });
});
afterEach(() => {
    allAudits.push(...audits());
});
afterAll(() => {
    setSamparkRepoForTests(null);
    setSamparkClockForTests(null);
});

async function create(body: unknown = { label: 'School LMS', scopes: ['lesson-planner', 'quiz'] }, uid: string = ADMIN) {
    const res = await call('create', { body, uid });
    if (res.status === 201) issuedSecrets.push(parseApiKey(res.body.apiKey)!.secret);
    return res;
}
const mcpHeaders = (apiKey: string) => new realFetchApi.Headers({ Authorization: `Bearer ${apiKey}` }) as Headers;
const auth = (apiKey: string, scope: 'lesson-planner' | 'quiz' | 'exam-paper' = 'lesson-planner') =>
    authenticateMcpRequest(mcpHeaders(apiKey), scope, { getDb: async () => mockDb as any, now: () => clock.now() });
const keyUpdates = (keyId: string) => mockWrites.filter((w) => w.op === 'update' && w.path === `${MCP_API_KEYS_COLLECTION}/${keyId}`);

describe('create, list and revoke', () => {
    it('an admin creates a key: 201 with the full key once, the record stores only the hash, and it is audited', async () => {
        const res = await create();
        expect(res.status).toBe(201);
        const parsed = parseApiKey(res.body.apiKey)!;
        expect(parsed).not.toBeNull();
        expect(res.body.key).toEqual({
            keyId: parsed.keyId, displayKey: `sk_sahayak_${parsed.keyId}_…`, label: 'School LMS', scopes: ['lesson-planner', 'quiz'],
            status: 'active', createdAt: MON_11_IST.toISOString(), createdBy: ADMIN, lastUsedAt: null, revokedAt: null, revokedBy: null,
        });
        const stored = mockDocs.get(`${MCP_API_KEYS_COLLECTION}/${parsed.keyId}`)!;
        expect(stored).toMatchObject({ orgId: ORG, label: 'School LMS', status: 'active', createdBy: ADMIN });
        expect(stored.secretHash).toMatch(/^[0-9a-f]{64}$/);
        expect(audits('api_key.created')).toEqual([
            { at: MON_11_IST.toISOString(), actor: ADMIN, action: 'api_key.created', target: `api_key/${parsed.keyId}`, detail: { keyId: parsed.keyId, label: 'School LMS', scopes: ['lesson-planner', 'quiz'] } },
        ]);
        // the key works for its scopes and not for others
        await expect(auth(res.body.apiKey, 'quiz')).resolves.toMatchObject({ keyId: parsed.keyId, orgId: ORG });
        await expect(auth(res.body.apiKey, 'exam-paper')).rejects.toMatchObject({ category: 'authorization' });
    });

    it('any school admin may manage keys — a members/{uid}.role admin as well as the owner (decision 3)', async () => {
        const res = await create(undefined, MEMBER_ADMIN);
        expect(res.status).toBe(201);
        expect(res.body.key.createdBy).toBe(MEMBER_ADMIN);
        expect((await call('revoke', { uid: MEMBER_ADMIN, keyId: res.body.key.keyId })).status).toBe(200);
    });

    it('lists the school\'s keys newest first, never another school\'s, never a key or hash', async () => {
        const first = await create({ label: 'First', scopes: ['quiz'] });
        clock.advance(60_000);
        const second = await create({ label: 'Second', scopes: ['exam-paper'] });
        mockDocs.set(`${MCP_API_KEYS_COLLECTION}/feedfacefeedface`, { orgId: OTHER_ORG, label: 'Theirs', scopes: ['quiz'], secretHash: 'ab'.repeat(32), status: 'active', createdAt: '2026-10-01T00:00:00Z', createdBy: 'x' });
        const res = await call('list');
        expect(res.status).toBe(200);
        expect(res.body.keys.map((k: any) => k.keyId)).toEqual([second.body.key.keyId, first.body.key.keyId]);
        const wire = JSON.stringify(res.body);
        expect(wire).not.toMatch(/secretHash|apiKey|feedfacefeedface/);
        expect(wire).not.toContain(mockDocs.get(`${MCP_API_KEYS_COLLECTION}/${first.body.key.keyId}`)!.secretHash);
    });

    it('revoke: confirms status, revokedAt and revokedBy, audits once, and a second revoke changes nothing', async () => {
        const created = await create();
        const keyId = created.body.key.keyId;
        clock.advance(5 * 60_000);
        const res = await call('revoke', { keyId });
        expect(res.status).toBe(200);
        expect(res.body.key).toMatchObject({ keyId, status: 'revoked', revokedAt: clock.now().toISOString(), revokedBy: ADMIN });
        expect(mockDocs.get(`${MCP_API_KEYS_COLLECTION}/${keyId}`)).toMatchObject({ status: 'revoked', revokedAt: clock.now().toISOString(), revokedBy: ADMIN });
        expect(audits('api_key.revoked')).toEqual([expect.objectContaining({ actor: ADMIN, target: `api_key/${keyId}`, detail: { keyId, label: 'School LMS' } })]);

        expect((await call('revoke', { keyId })).status).toBe(200);
        expect(audits('api_key.revoked')).toHaveLength(1);
    });

    it('a revoked key fails its very next MCP request — auth and a real MCP endpoint', async () => {
        const created = await create({ label: 'LMS', scopes: ['lesson-planner'] });
        const apiKey = created.body.apiKey;
        const listTools = () => withRealFetchApi(() => handleMcpHttpRequest(
            new Request('https://sahayak.test/api/mcp/lesson-planner', {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
            }),
            lessonPlannerCapability(jest.fn() as any),
            { getDb: async () => mockDb as any, rateLimit: async () => undefined },
        ));
        await expect(auth(apiKey)).resolves.toBeTruthy();
        expect((await listTools()).status).toBe(200);

        await call('revoke', { keyId: created.body.key.keyId });

        await expect(auth(apiKey)).rejects.toMatchObject({ category: 'authentication' });
        expect((await listTools()).status).toBe(401);
    });

    it('another school\'s key id is not found, and is left untouched', async () => {
        mockDocs.set(`${MCP_API_KEYS_COLLECTION}/feedfacefeedface`, { orgId: OTHER_ORG, label: 'Theirs', scopes: ['quiz'], secretHash: 'ab'.repeat(32), status: 'active', createdAt: 'x', createdBy: 'x' });
        expect((await call('revoke', { keyId: 'feedfacefeedface' })).status).toBe(404);
        expect(mockDocs.get(`${MCP_API_KEYS_COLLECTION}/feedfacefeedface`)!.status).toBe('active');
        expect(audits('api_key.revoked')).toHaveLength(0);
    });

    it.each([
        [{ label: 'X', scopes: ['calling'] }, 'calling is not grantable (decision 1)'],
        [{ label: 'X', scopes: [] }, 'no scope'],
        [{ label: '   ', scopes: ['quiz'] }, 'blank label'],
        [{ label: 'x'.repeat(81), scopes: ['quiz'] }, 'label too long'],
        [{ label: 'X', scopes: ['quiz'], orgId: OTHER_ORG }, 'unknown field'],
        [{ label: 'X', scopes: ['quiz'], createdBy: 'someone' }, 'client-set creator'],
    ])('400 for %j (%s), nothing stored', async (body) => {
        expect((await create(body)).status).toBe(400);
        expect(mockWrites).toHaveLength(0);
    });

    it('the console offers exactly lesson-planner, exam-paper and quiz', () => {
        expect([...CONSOLE_SCOPES]).toEqual(['lesson-planner', 'exam-paper', 'quiz']);
    });
});

describe('authorization on every route', () => {
    it.each([
        ['a teacher of the school', TEACHER],
        ['an admin of another school', 'other-admin'],
        ['a stranger', 'stranger'],
    ])('%s gets 403 from GET, POST and revoke; nothing is written', async (_who, uid) => {
        const created = await create();
        mockWrites.length = 0;
        const before = audits().length;
        expect((await call('list', { uid })).status).toBe(403);
        expect((await call('create', { uid, body: { label: 'Mine', scopes: ['quiz'] } })).status).toBe(403);
        expect((await call('revoke', { uid, keyId: created.body.key.keyId })).status).toBe(403);
        expect(mockWrites).toHaveLength(0);
        expect(audits()).toHaveLength(before);
        expect(mockDocs.get(`${MCP_API_KEYS_COLLECTION}/${created.body.key.keyId}`)!.status).toBe('active');
    });

    it('signed out → 401; Sampark switched off → 404 before auth', async () => {
        expect((await call('list', { uid: null })).status).toBe(401);
        expect((await call('create', { uid: null, body: { label: 'X', scopes: ['quiz'] } })).status).toBe(401);
        delete process.env.SAMPARK_ENABLED;
        expect((await call('list')).status).toBe(404);
        expect((await call('revoke', { keyId: 'feedfacefeedface' })).status).toBe(404);
    });

    it('no pepper configured → create refused, nothing stored', async () => {
        const pepper = process.env.MCP_API_KEY_PEPPER;
        delete process.env.MCP_API_KEY_PEPPER;
        try {
            const res = await create();
            expect(res.status).toBe(409);
            expect(res.body.error).toBe('MCP_NOT_CONFIGURED');
            expect(mockWrites).toHaveLength(0);
        } finally {
            process.env.MCP_API_KEY_PEPPER = pepper;
        }
    });
});

describe('lastUsedAt is written at most once a minute per key', () => {
    it('sequential and concurrent requests within a minute write once; the next minute writes again', async () => {
        const created = await create();
        const keyId = created.body.key.keyId;
        mockWrites.length = 0;

        await Promise.all(Array.from({ length: 8 }, () => auth(created.body.apiKey)));
        await auth(created.body.apiKey);
        expect(keyUpdates(keyId)).toEqual([{ op: 'update', path: `${MCP_API_KEYS_COLLECTION}/${keyId}`, data: { lastUsedAt: MON_11_IST.toISOString() } }]);

        clock.advance(LAST_USED_WRITE_INTERVAL_MS - 1);
        await auth(created.body.apiKey);
        expect(keyUpdates(keyId)).toHaveLength(1);

        clock.advance(1);
        await auth(created.body.apiKey);
        expect(keyUpdates(keyId)).toHaveLength(2);
        expect((await call('list')).body.keys[0].lastUsedAt).toBe(clock.now().toISOString());
    });

    it('another instance (fresh throttle) still skips the write when the stored lastUsedAt is recent', async () => {
        const created = await create();
        await auth(created.body.apiKey);
        resetLastUsedThrottleForTests();
        clock.advance(10_000);
        await auth(created.body.apiKey);
        expect(keyUpdates(created.body.key.keyId)).toHaveLength(1);
    });

    it('a failed lastUsedAt write never fails the request, and only lastUsedAt is ever written by auth', async () => {
        const created = await create();
        mockFailUpdates.on = true;
        await expect(auth(created.body.apiKey)).resolves.toMatchObject({ orgId: ORG });
        mockFailUpdates.on = false;
        await auth(created.body.apiKey);
        const writes = keyUpdates(created.body.key.keyId);
        expect(writes).toHaveLength(1);
        expect(Object.keys(writes[0].data as object)).toEqual(['lastUsedAt']);
    });
});

describe('CLASS GATE: the full key appears exactly once, in the create response', () => {
    it('no secret issued in this file appears in any other response, stored document, write, audit entry or log call', async () => {
        // one more full lifecycle so this test stands alone too
        const created = await create({ label: 'Gate', scopes: ['exam-paper'] });
        await call('list');
        await auth(created.body.apiKey, 'exam-paper');
        await call('revoke', { keyId: created.body.key.keyId });
        await expect(auth(created.body.apiKey, 'exam-paper')).rejects.toBeTruthy();
        allAudits.push(...audits());

        expect(issuedSecrets.length).toBeGreaterThan(5);
        const createResponses = responses.filter((r) => r.route === 'create' && r.status === 201);
        const elsewhere = JSON.stringify({
            otherResponses: responses.filter((r) => !createResponses.includes(r)),
            createResponseKeyViews: createResponses.map((r) => r.body.key),
            stored: [...mockDocs.entries()],
            writes: mockWrites,
            audits: allAudits,
            logs: Object.values(mockLog).map((fn) => fn.mock.calls),
        });
        for (const secret of issuedSecrets) {
            expect(elsewhere).not.toContain(secret);
            expect(createResponses.filter((r) => JSON.stringify(r.body).includes(secret))).toHaveLength(1);
        }
        // and a create response carries the key in `apiKey` only
        for (const r of createResponses) expect(Object.keys(r.body).sort()).toEqual(['apiKey', 'key']);
    });
});
