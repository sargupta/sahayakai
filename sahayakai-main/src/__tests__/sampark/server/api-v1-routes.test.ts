/** @jest-environment node */
/**
 * The three /api/sampark-api/v1 route handlers, run as handlers: real shell, real schemas, real
 * calling service on the in-memory repos (Practice mode: no network). Only the two things a
 * handler cannot have in a unit test are replaced: the key database / limiter, and where the
 * service's repositories come from.
 *
 * (The jest.setup Response polyfill keeps a response's status but not NextResponse.json's body
 * or headers, so handlers are checked by status and by what they left in the repositories.)
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import type { ApiV1Deps, DailyCapEntry } from '@/server/sampark/api-v1';
import type { RiyaDeps } from '@/server/sampark/conversation';

const runtime: { deps: ApiV1Deps | null; riya: RiyaDeps | null } = { deps: null, riya: null };

jest.mock('@/server/sampark/api-v1-runtime', () => ({
    apiV1Deps: {
        authenticate: (headers: Headers) => runtime.deps!.authenticate(headers),
        rateLimit: (keyId: string, kind: 'place' | 'read') => runtime.deps!.rateLimit(keyId, kind),
        get dailyCap() { return runtime.deps!.dailyCap; },
        get env() { return runtime.deps!.env; },
    },
}));
jest.mock('@/server/sampark/http', () => ({ ...jest.requireActual('@/server/sampark/http'), samparkContext: async () => ({}) }));
jest.mock('@/server/sampark/conversation', () => ({ ...jest.requireActual('@/server/sampark/conversation'), riyaDeps: async () => runtime.riya }));

import crypto from 'node:crypto';

import { mintApiKey } from '@/lib/mcp/api-keys';
import { authenticateMcpRequest, resetLastUsedThrottleForTests, type McpAuthDb } from '@/lib/mcp/auth';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import { RIYA_PURPOSES } from '@/lib/sampark/conversation/riya-purposes';
import { encryptPhone, hashPhone } from '@/lib/sampark/phone';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { apiActor, SAMPARK_API_SCOPE } from '@/server/sampark/api-v1';
import { previewRiyaCall } from '@/server/sampark/conversation';
import { GET as readCall } from '@/app/api/sampark-api/v1/calls/[callId]/route';
import { POST as previewCall } from '@/app/api/sampark-api/v1/calls/preview/route';
import { POST as startCall } from '@/app/api/sampark-api/v1/calls/route';

import { guardian, prefs, school, student, testClock } from '../engine/_fixtures';
import { setPhoneEnv } from './_helpers';

const PEPPER = 'test-pepper-test-pepper-test-pepper-0123';
const ORG = 'hillview-demo';
const NOW = new Date('2026-10-07T05:30:00Z'); // Wednesday 11:00 IST
const PHONE = '+919811111111';
const FLAGS = { SAMPARK_ENABLED: 'true', SAMPARK_ELEVENLABS_ENABLED: 'true', SAMPARK_API_V1_ENABLED: 'true' };
const PTM = { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: { purpose: 'ptm_invitation', date: '2026-10-10', time: { hour: 10, minute: 0 } } } as const;

const key = mintApiKey({ orgId: ORG, label: 'school ERP', scopes: ['sampark'], createdBy: 'cli', pepper: PEPPER, now: NOW });
const plannerKey = mintApiKey({ orgId: ORG, label: 'LMS', scopes: ['lesson-planner'], createdBy: 'cli', pepper: PEPPER, now: NOW });

const http = (apiKey: string | null, body?: unknown) => ({
    headers: new Map(Object.entries(apiKey ? { authorization: `Bearer ${apiKey}` } : {})),
    json: async () => { if (body === undefined) throw new Error('no body'); return body; },
}) as unknown as Request;

const saved = { ...process.env };
let calls: ReturnType<typeof createMemoryConversationRepo>;
let limiter: jest.Mock;

beforeEach(async () => {
    process.env.MCP_API_KEY_PEPPER = PEPPER;
    resetLastUsedThrottleForTests();
    setPhoneEnv();
    const repo = createMemorySamparkRepo();
    calls = createMemoryConversationRepo();
    await repo.upsertSchool(school({ mode: 'practice' }));
    await repo.upsertStudents(ORG, [student('s1', { spokenFirstName: { English: 'Asha' }, guardianIds: ['g1'] })]);
    await repo.upsertGuardians(ORG, [guardian('g1', { phoneEnc: encryptPhone(PHONE), phoneHash: hashPhone(PHONE), phoneLast4: '1111', phoneClass: 'mobile', crmLanguage: 'English', studentIds: ['s1'] })]);
    await repo.upsertPreferences([prefs('g1', { notices: 'granted', progress: 'granted', recorded_conversation: 'granted' })]);
    runtime.riya = { repo, calls, clock: testClock(NOW), env: { SAMPARK_ENABLED: 'true', SAMPARK_ELEVENLABS_ENABLED: 'true', SAMPARK_RIYA_PURPOSES: RIYA_PURPOSES.join(',') } };
    const records: Record<string, unknown> = { [key.keyId]: { ...key.record }, [plannerKey.keyId]: { ...plannerKey.record } };
    limiter = jest.fn(async () => undefined);
    const capBuckets = new Map<string, DailyCapEntry[]>();
    runtime.deps = {
        dailyCap: { transact: async (bucket, update) => { capBuckets.set(bucket, update(capBuckets.get(bucket) ?? [])); } },
        env: { ...FLAGS },
        rateLimit: limiter,
        authenticate: (headers) => authenticateMcpRequest(headers, SAMPARK_API_SCOPE, {
            now: () => NOW,
            getDb: async () => ({
                collection: (name: string) => ({
                    doc: (id: string) => ({
                        get: async () => (name === 'organizations' ? { exists: id === ORG, data: () => ({}) } : { exists: id in records, data: () => records[id] }),
                        update: async () => undefined,
                    }),
                }),
            }) as unknown as McpAuthDb,
        }),
    };
});
afterEach(() => {
    process.env = { ...saved };
});

async function startBody(over: Record<string, unknown> = {}) {
    const preview = await previewRiyaCall(runtime.riya!, ORG, PTM);
    return { ...PTM, idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: preview.announcement, ...over };
}
const params = (callId: string) => ({ params: Promise.resolve({ callId }) });

describe('POST /api/sampark-api/v1/calls', () => {
    it('201 places one call as the key; the same idempotency key again is 200 and places nothing new', async () => {
        const body = await startBody();
        expect((await startCall(http(key.apiKey, body))).status).toBe(201);
        expect((await startCall(http(key.apiKey, body))).status).toBe(200);
        const placed = await calls.listCalls(ORG, 10);
        expect(placed.length).toBe(1);
        expect(placed[0].createdBy).toBe(apiActor({ keyId: key.keyId }));
        expect(limiter).toHaveBeenCalledWith(key.keyId, 'place');
    });

    it('404 while the API flag is off, and nothing is placed', async () => {
        runtime.deps!.env = { ...FLAGS, SAMPARK_API_V1_ENABLED: undefined };
        expect((await startCall(http(key.apiKey, await startBody()))).status).toBe(404);
        expect((await calls.listCalls(ORG, 10)).length).toBe(0);
    });

    it('401 without a key, 403 with a key that lacks the sampark scope, and nothing is placed', async () => {
        const body = await startBody();
        expect((await startCall(http(null, body))).status).toBe(401);
        expect((await startCall(http(plannerKey.apiKey, body))).status).toBe(403);
        expect((await calls.listCalls(ORG, 10)).length).toBe(0);
    });

    it('400 for a body that names a phone number, a school, a Practice scenario, or is not JSON', async () => {
        for (const extra of [{ phone: '+919800000001' }, { orgId: 'other-school' }, { scenario: 'happy_path' }]) {
            expect((await startCall(http(key.apiKey, await startBody(extra)))).status).toBe(400);
        }
        expect((await startCall(http(key.apiKey))).status).toBe(400);
        expect((await calls.listCalls(ORG, 10)).length).toBe(0);
    });

    it('409 when the announcement is not the previewed one, and when the family does not exist it is 404', async () => {
        expect((await startCall(http(key.apiKey, await startBody({ confirmedAnnouncement: 'Not what was previewed.' })))).status).toBe(409);
        expect((await startCall(http(key.apiKey, await startBody({ guardianId: 'nobody' })))).status).toBe(404);
        expect((await calls.listCalls(ORG, 10)).length).toBe(0);
    });

    it('429 when the key is over its budget, 503 when the limiter fails, and nothing is placed either way', async () => {
        const body = await startBody();
        limiter.mockRejectedValueOnce(new Error('Rate limit exceeded. Please wait 2 minutes.'));
        expect((await startCall(http(key.apiKey, body))).status).toBe(429);
        limiter.mockRejectedValueOnce(new Error('UNAVAILABLE'));
        expect((await startCall(http(key.apiKey, body))).status).toBe(503);
        expect((await calls.listCalls(ORG, 10)).length).toBe(0);
    });
});

describe('POST /api/sampark-api/v1/calls: the per-key daily budget', () => {
    it('refuses with 409 once the key has made its daily requests; a refused request uses a slot too', async () => {
        runtime.deps!.env = { ...FLAGS, SAMPARK_API_KEY_DAILY_CAP: '2' };
        // Slots are never given back (a second request with the same key could otherwise free a
        // slot still in use), so this refusal (unknown family) uses one.
        expect((await startCall(http(key.apiKey, await startBody({ guardianId: 'nobody' })))).status).toBe(404);
        expect((await startCall(http(key.apiKey, await startBody()))).status).toBe(201);
        expect((await startCall(http(key.apiKey, await startBody()))).status).toBe(409);
        expect((await calls.listCalls(ORG, 10)).length).toBe(1);
    });

    it('two requests with the same key, one refused, cannot free the other\'s slot', async () => {
        runtime.deps!.env = { ...FLAGS, SAMPARK_API_KEY_DAILY_CAP: '1' };
        const good = await startBody();
        const bad = { ...good, guardianId: 'nobody' };
        const [a, b] = await Promise.all([startCall(http(key.apiKey, good)), startCall(http(key.apiKey, bad))]);
        expect([a.status, b.status].sort()).toEqual(expect.arrayContaining([201]));
        // Whatever the order, the slot stays used: a new call is refused.
        expect((await startCall(http(key.apiKey, await startBody()))).status).toBe(409);
        expect((await calls.listCalls(ORG, 10)).length).toBe(1);
    });

    it('a retry of an existing call reserves nothing: it is answered even when the budget store is down', async () => {
        const body = await startBody();
        expect((await startCall(http(key.apiKey, body))).status).toBe(201);
        runtime.deps!.dailyCap = { transact: async () => { throw new Error('UNAVAILABLE'); } };
        expect((await startCall(http(key.apiKey, body))).status).toBe(200);
        expect((await calls.listCalls(ORG, 10)).length).toBe(1);
    });

    it('a retry of a placed call is still 200 when the key is at its cap', async () => {
        runtime.deps!.env = { ...FLAGS, SAMPARK_API_KEY_DAILY_CAP: '1' };
        const body = await startBody();
        expect((await startCall(http(key.apiKey, body))).status).toBe(201);
        expect((await startCall(http(key.apiKey, body))).status).toBe(200);
        expect((await calls.listCalls(ORG, 10)).length).toBe(1);
    });

    it('a broken budget store means no call (503), never an unmetered one', async () => {
        runtime.deps!.dailyCap = { transact: async () => { throw new Error('UNAVAILABLE'); } };
        expect((await startCall(http(key.apiKey, await startBody()))).status).toBe(503);
        expect((await calls.listCalls(ORG, 10)).length).toBe(0);
    });
});

describe('POST /api/sampark-api/v1/calls/preview', () => {
    it('200 for a valid request and dials nothing; 400 for an unknown field', async () => {
        expect((await previewCall(http(key.apiKey, PTM))).status).toBe(200);
        expect((await previewCall(http(key.apiKey, { ...PTM, phone: '+919800000001' }))).status).toBe(400);
        expect((await calls.listCalls(ORG, 10)).length).toBe(0);
        expect(limiter).toHaveBeenCalledWith(key.keyId, 'place');
    });
});

describe('GET /api/sampark-api/v1/calls/[callId]', () => {
    it('200 for a call the API placed; 404 for an unknown id; 400 for a malformed id; uses the read budget', async () => {
        await startCall(http(key.apiKey, await startBody()));
        const [placed] = await calls.listCalls(ORG, 10);
        limiter.mockClear();
        expect((await readCall(http(key.apiKey), params(placed.id))).status).toBe(200);
        expect(limiter).toHaveBeenCalledWith(key.keyId, 'read');
        expect((await readCall(http(key.apiKey), params('no-such-call'))).status).toBe(404);
        expect((await readCall(http(key.apiKey), params('../etc'))).status).toBe(400);
        expect((await readCall(http(null), params(placed.id))).status).toBe(401);
    });
});
