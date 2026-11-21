/** @jest-environment node */
/**
 * Sampark Calling API v1 (src/server/sampark/api-v1.ts and /api/sampark-api/v1/*).
 *
 * The API adds no calling logic, so these tests cover what it does add: the order of the
 * shell (flags → key → scope → rate limit, which fails closed), that the school and the caller come only from
 * the key, that a call placed through it runs the same service as the console (gate,
 * idempotency, audit), and that nothing private leaves in a response.
 *
 * CLASS GATES (bottom of the file): every v1 route runs the shell first and never trusts
 * x-user-id; no v1 request can carry a phone number or a school id; and /api/sampark-api/v1/
 * is its own tree: nothing under /api/sampark/ (where [orgId] routes trust x-user-id) is public by prefix.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { mintApiKey } from '@/lib/mcp/api-keys';
import { authenticateMcpRequest, resetLastUsedThrottleForTests, type McpAuthDb } from '@/lib/mcp/auth';
import { createMemoryConversationRepo } from '@/lib/sampark/conversation/repo';
import { RIYA_PURPOSES } from '@/lib/sampark/conversation/riya-purposes';
import type { ConversationCallView } from '@/lib/sampark/conversation/types';
import { encryptPhone, hashPhone } from '@/lib/sampark/phone';
import type { AuditEntry } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import {
    API_ACTOR_PREFIX, API_RATE_LIMITS, apiActor, SAMPARK_API_SCOPE, ApiPreviewSchema, ApiStartSchema, apiV1Enabled, enforceApiRateLimit, getApiCall, guardApiV1,
    rateLimitWaitSeconds, toApiCall, toApiPreview, type ApiV1Deps, type RateLimitStore,
} from '@/server/sampark/api-v1';
import { getRiyaCall, previewRiyaCall, startRiyaCall, type RiyaDeps } from '@/server/sampark/conversation';
import { SamparkServiceError } from '@/server/sampark/errors';

import { guardian, prefs, school, student, testClock } from '../engine/_fixtures';
import { setPhoneEnv } from './_helpers';

const PEPPER = 'test-pepper-test-pepper-test-pepper-0123';
const ORG = 'hillview-demo';
const OTHER_ORG = 'other-school';
const WED_11_IST = new Date('2026-10-07T05:30:00Z');
const GUARDIAN_PHONE = '+919811111111';

const FLAGS = { SAMPARK_ENABLED: 'true', SAMPARK_ELEVENLABS_ENABLED: 'true', SAMPARK_API_V1_ENABLED: 'true' };

function keyDb(records: Record<string, Record<string, unknown>>, orgs: string[] = [ORG, OTHER_ORG]) {
    const updates: Record<string, unknown>[] = [];
    return {
        updates,
        db: {
            collection: (name: string) => ({
                doc: (id: string) => ({
                    get: async () => {
                        if (name === 'organizations') return { exists: orgs.includes(id), data: () => ({}) };
                        return { exists: id in records, data: () => records[id] };
                    },
                    update: async (data: Record<string, unknown>) => { updates.push(data); },
                }),
            }),
        },
    };
}

function mint(scopes: string[], orgId = ORG) {
    return mintApiKey({ orgId, label: 'test integration', scopes, createdBy: 'cli', pepper: PEPPER, now: WED_11_IST });
}

// The jest.setup Headers polyfill is a bare Map, so requests get one built from entries (lower-case names).
const request = (apiKey?: string, extra: Record<string, string> = {}) =>
    ({ headers: new Map(Object.entries({ ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}), ...extra })) as unknown as Headers });

/** The real key check (as api-v1-runtime wires it), over a fake key database. */
const authWith = (getDb: () => Promise<unknown>): ApiV1Deps['authenticate'] =>
    (headers) => authenticateMcpRequest(headers, SAMPARK_API_SCOPE, { getDb: getDb as () => Promise<McpAuthDb>, now: () => WED_11_IST });

function depsFor(records: Record<string, Record<string, unknown>>, over: Partial<ApiV1Deps> = {}): ApiV1Deps {
    return { authenticate: authWith(async () => keyDb(records).db), rateLimit: async () => undefined, env: { ...FLAGS }, ...over };
}

const saved = { ...process.env };
beforeEach(() => {
    process.env.MCP_API_KEY_PEPPER = PEPPER;
    resetLastUsedThrottleForTests();
});
afterEach(() => {
    process.env = { ...saved };
});

describe('guardApiV1: the shell', () => {
    it('404 while any of the three flags is off, before the key is even looked at', async () => {
        const k = mint(['sampark']);
        const getDb = jest.fn(async () => keyDb({ [k.keyId]: { ...k.record } }).db);
        for (const off of Object.keys(FLAGS)) {
            const g = await guardApiV1(request(k.apiKey), depsFor({}, { authenticate: authWith(getDb), env: { ...FLAGS, [off]: 'false' } }), 'place');
            expect('response' in g && g.response.status).toBe(404);
        }
        expect(getDb).not.toHaveBeenCalled();
        expect(apiV1Enabled({ ...FLAGS })).toBe(true);
        expect(apiV1Enabled({})).toBe(false);
    });

    it('401 with no key, a malformed key, an unknown key, a wrong secret and a revoked key: all read the same', async () => {
        const k = mint(['sampark']);
        const other = mint(['sampark']);
        const revoked = mint(['sampark']);
        const records = { [k.keyId]: { ...k.record }, [revoked.keyId]: { ...revoked.record, status: 'revoked' } };
        const wrongSecret = k.apiKey.slice(0, -4) + (k.apiKey.endsWith('AAAA') ? 'BBBB' : 'AAAA');
        const messages = new Set<string>();
        for (const presented of [undefined, 'not-a-key', other.apiKey, wrongSecret, revoked.apiKey]) {
            const g = await guardApiV1(request(presented), depsFor(records), 'place');
            if (!('response' in g)) throw new Error('expected a refusal');
            expect(g.response.status).toBe(401);
            if (presented) messages.add(String(((await g.response.json().catch(() => ({}))) as { message?: string }).message));
        }
        expect(messages.size).toBeLessThanOrEqual(1);
    });

    it('403 for a real key without the sampark scope — a lesson-planner or calling key cannot place calls', async () => {
        for (const scopes of [['lesson-planner'], ['calling'], ['lesson-planner', 'exam-paper', 'quiz', 'calling']]) {
            const k = mint(scopes);
            const g = await guardApiV1(request(k.apiKey), depsFor({ [k.keyId]: { ...k.record } }), 'place');
            expect('response' in g && g.response.status).toBe(403);
        }
    });

    it('503 when the server has no key pepper (keys cannot be checked, so nothing is allowed)', async () => {
        delete process.env.MCP_API_KEY_PEPPER;
        const k = mintApiKey({ orgId: ORG, label: 'x', scopes: ['sampark'], createdBy: 'cli', pepper: PEPPER, now: WED_11_IST });
        const g = await guardApiV1(request(k.apiKey), depsFor({ [k.keyId]: { ...k.record } }), 'place');
        expect('response' in g && g.response.status).toBe(503);
    });

    it('429 with retry-after when the key is over its limit; 503 (closed) when the limiter itself fails', async () => {
        const k = mint(['sampark']);
        const records = { [k.keyId]: { ...k.record } };
        const limited = await guardApiV1(request(k.apiKey), depsFor(records, { rateLimit: async () => { throw new Error('Rate limit exceeded. Please wait 3 minutes.'); } }), 'place');
        if (!('response' in limited)) throw new Error('expected a refusal');
        expect(limited.response.status).toBe(429);
        // (the jest.setup Response polyfill drops headers, so retry-after is checked at its source)
        expect(rateLimitWaitSeconds(new Error('Rate limit exceeded. Please wait 3 minutes.'))).toBe(180);
        expect(rateLimitWaitSeconds(new Error('firestore unavailable, wait 5 minutes'))).toBeNull();
        const broken = await guardApiV1(request(k.apiKey), depsFor(records, { rateLimit: async () => { throw new Error('firestore unavailable'); } }), 'place');
        expect('response' in broken && broken.response.status).toBe(503);
    });

    it('the school and the caller come from the key record only — headers naming another school or user change nothing', async () => {
        const k = mint(['sampark']);
        const limiter = jest.fn(async () => undefined);
        const g = await guardApiV1(
            request(k.apiKey, { 'x-user-id': 'someone-else', 'x-org-id': OTHER_ORG }),
            depsFor({ [k.keyId]: { ...k.record } }, { rateLimit: limiter }),
            'read',
        );
        if ('response' in g) throw new Error('expected to pass');
        expect(g.principal.orgId).toBe(ORG);
        expect(g.actor).toBe(`${API_ACTOR_PREFIX}${k.keyId}`);
        expect(limiter).toHaveBeenCalledWith(k.keyId, 'read');
    });

    it('a key whose school no longer exists is refused', async () => {
        const k = mint(['sampark'], 'deleted-school');
        const g = await guardApiV1(request(k.apiKey), depsFor({ [k.keyId]: { ...k.record } }), 'place');
        expect('response' in g && g.response.status).toBe(401);
    });
});

describe('enforceApiRateLimit: the API\'s own limiter', () => {
    function memoryStore(): RateLimitStore & { buckets: Map<string, number[]> } {
        const buckets = new Map<string, number[]>();
        return { buckets, transact: async (bucket, update) => { buckets.set(bucket, update(buckets.get(bucket) ?? [])); } };
    }
    const T0 = WED_11_IST.getTime();

    it('allows up to the limit in a window, refuses the next with the wait, and recovers when the window slides', async () => {
        const store = memoryStore();
        const { max, windowMs } = API_RATE_LIMITS.place;
        for (let i = 0; i < max; i++) await enforceApiRateLimit(store, 'k1', 'place', T0 + i);
        const refused = await enforceApiRateLimit(store, 'k1', 'place', T0 + max).catch((e: Error) => e);
        expect(rateLimitWaitSeconds(refused)).toBe(Math.ceil(windowMs / 60_000) * 60);
        await expect(enforceApiRateLimit(store, 'k1', 'place', T0 + windowMs + 1)).resolves.toBeUndefined();
    });

    it('keeps placing and reading in separate budgets, and one key\'s use never counts against another', async () => {
        const store = memoryStore();
        for (let i = 0; i < API_RATE_LIMITS.place.max; i++) await enforceApiRateLimit(store, 'k1', 'place', T0 + i);
        await expect(enforceApiRateLimit(store, 'k1', 'read', T0)).resolves.toBeUndefined();
        await expect(enforceApiRateLimit(store, 'k2', 'place', T0)).resolves.toBeUndefined();
        expect([...store.buckets.keys()].sort()).toEqual(['sampark_api_place_k1', 'sampark_api_place_k2', 'sampark_api_read_k1']);
    });

    it('does not swallow a failing store: the error reaches the shell, which answers 503', async () => {
        const broken: RateLimitStore = { transact: async () => { throw new Error('UNAVAILABLE: firestore'); } };
        const err = await enforceApiRateLimit(broken, 'k1', 'place', T0).catch((e: Error) => e);
        expect(err).toBeInstanceOf(Error);
        expect(rateLimitWaitSeconds(err)).toBeNull();
        const k = mint(['sampark']);
        const g = await guardApiV1(request(k.apiKey), depsFor({ [k.keyId]: { ...k.record } }, { rateLimit: (keyId, kind) => enforceApiRateLimit(broken, keyId, kind, T0) }), 'place');
        expect('response' in g && g.response.status).toBe(503);
    });
});

// ── The same service as the console, called as an API key ───────────────────

async function world() {
    setPhoneEnv();
    const repo = createMemorySamparkRepo();
    const calls = createMemoryConversationRepo();
    const clock = testClock(WED_11_IST);
    const env = { SAMPARK_ENABLED: 'true', SAMPARK_ELEVENLABS_ENABLED: 'true', SAMPARK_RIYA_PURPOSES: RIYA_PURPOSES.join(',') };
    await repo.upsertSchool(school({ mode: 'practice' }));
    await repo.upsertSchool(school({ orgId: OTHER_ORG, displayName: 'Other School' }));
    await repo.upsertStudents(ORG, [student('s1', { spokenFirstName: { English: 'Asha' }, guardianIds: ['g1'] })]);
    await repo.upsertGuardians(ORG, [guardian('g1', {
        phoneEnc: encryptPhone(GUARDIAN_PHONE), phoneHash: hashPhone(GUARDIAN_PHONE), phoneLast4: GUARDIAN_PHONE.slice(-4),
        phoneClass: 'mobile', crmLanguage: 'English', studentIds: ['s1'],
    })]);
    await repo.upsertPreferences([prefs('g1', { notices: 'granted', progress: 'granted', recorded_conversation: 'granted' })]);
    const audits: AuditEntry[] = [];
    const original = repo.appendAudit.bind(repo);
    repo.appendAudit = async (orgId, entry) => { audits.push(entry); await original(orgId, entry); };
    const deps: RiyaDeps = { repo, calls, clock, env };
    return { deps, repo, calls, audits };
}

const PTM = { purpose: 'ptm_invitation' as const, guardianId: 'g1', studentId: 's1', facts: { purpose: 'ptm_invitation' as const, date: '2026-10-10', time: { hour: 10, minute: 0 } } };
const ACTOR = apiActor({ keyId: '0123456789abcdef' });

async function place(deps: RiyaDeps, orgId = ORG, actor = ACTOR, idempotencyKey = crypto.randomUUID()) {
    const preview = toApiPreview(await previewRiyaCall(deps, orgId, PTM));
    return startRiyaCall(deps, orgId, actor, { ...PTM, idempotencyKey, confirmedAnnouncement: preview.announcement ?? '' });
}

async function code(p: Promise<unknown>): Promise<string> {
    try { await p; } catch (err) { if (err instanceof SamparkServiceError) return err.code; throw err; }
    throw new Error('expected a refusal');
}

describe('a call placed through the API', () => {
    it('is recorded and audited as the key, not as a person', async () => {
        const w = await world();
        const { call, duplicate } = await place(w.deps);
        expect(duplicate).toBe(false);
        expect((await w.calls.getCall(ORG, call.id))?.createdBy).toBe(ACTOR);
        expect(w.audits.some((a) => a.actor === ACTOR)).toBe(true);
    });

    it('is idempotent: the same key returns the same call and dials nothing new; another caller cannot reuse it', async () => {
        const w = await world();
        const key = crypto.randomUUID();
        const first = await place(w.deps, ORG, ACTOR, key);
        const again = await place(w.deps, ORG, ACTOR, key);
        expect(again.duplicate).toBe(true);
        expect(again.call.id).toBe(first.call.id);
        expect((await w.calls.listCalls(ORG, 10)).length).toBe(1);
        expect(await code(place(w.deps, ORG, apiActor({ keyId: 'fedcba9876543210' }), key))).toBe('IDEMPOTENCY_KEY_REUSED');
    });

    it('is refused when the announcement is not the one the preview returned', async () => {
        const w = await world();
        expect(await code(startRiyaCall(w.deps, ORG, ACTOR, { ...PTM, idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: 'Something else entirely.' }))).toBe('ANNOUNCEMENT_CHANGED');
    });

    it('goes through the gate: while the school is paused the preview says so and the call is refused and audited', async () => {
        const w = await world();
        await w.repo.upsertSchool(school({ mode: 'practice', pause: { at: WED_11_IST.toISOString(), by: 'admin-uid', reason: 'test', scope: 'all' } }));
        const preview = toApiPreview(await previewRiyaCall(w.deps, ORG, PTM));
        expect(preview.ok).toBe(false);
        expect(preview.refusals.map((r) => r.code)).toContain('SCHOOL_PAUSED');
        expect(await code(startRiyaCall(w.deps, ORG, ACTOR, { ...PTM, idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: 'anything' }))).toBe('SCHOOL_PAUSED');
        expect(w.audits.some((a) => a.actor === ACTOR && a.action === 'riya_call.refused')).toBe(true);
        expect((await w.calls.listCalls(ORG, 10)).length).toBe(0);
    });

    it('acts only in the school it is given: with the same record ids in two schools, each call rings that school\'s own family', async () => {
        const w = await world();
        const OTHER_PHONE = '+919844444444';
        await w.repo.upsertStudents(OTHER_ORG, [{ ...student('s1', { spokenFirstName: { English: 'Zoya' }, guardianIds: ['g1'] }), orgId: OTHER_ORG }]);
        await w.repo.upsertGuardians(OTHER_ORG, [{
            ...guardian('g1', { phoneEnc: encryptPhone(OTHER_PHONE), phoneHash: hashPhone(OTHER_PHONE), phoneLast4: OTHER_PHONE.slice(-4), phoneClass: 'mobile', crmLanguage: 'English', studentIds: ['s1'] }),
            orgId: OTHER_ORG,
        }]);
        const key = crypto.randomUUID();
        const here = await place(w.deps, ORG, ACTOR, key);
        expect(here.call.phoneLast4).toBe(GUARDIAN_PHONE.slice(-4));
        expect(here.call.orgId).toBe(ORG);
        // Whatever the other school's records allow, nothing about ORG's family may appear there.
        const there = await previewRiyaCall(w.deps, OTHER_ORG, PTM).then(toApiPreview, () => null);
        expect(JSON.stringify(there)).not.toContain(GUARDIAN_PHONE.slice(-4));
        expect(JSON.stringify(there)).not.toContain('Asha');
        // The same idempotency key in another school is a different call id: it can never return ORG's call.
        const other = await place(w.deps, OTHER_ORG, ACTOR, key).then((r) => r.call, () => null);
        if (other) {
            expect(other.id).not.toBe(here.call.id);
            expect(other.orgId).toBe(OTHER_ORG);
            expect(other.phoneLast4).toBe(OTHER_PHONE.slice(-4));
        }
        expect((await w.calls.listCalls(ORG, 10)).map((c) => c.id)).toEqual([here.call.id]);
    });

    it('a school with no such family is told nothing and places nothing', async () => {
        const w = await world();
        expect(await code(place(w.deps, OTHER_ORG))).toBe('RECIPIENT_NOT_FOUND');
        expect((await w.calls.listCalls(OTHER_ORG, 10)).length).toBe(0);
    });
});

describe('reading a call', () => {
    it('returns an integration\'s call, and reports a console call or another school\'s call as not found', async () => {
        const w = await world();
        const mine = await place(w.deps);
        const staff = await place(w.deps, ORG, 'admin-uid');
        const read = (orgId: string, id: string) => getApiCall(w.deps, orgId, id, () => getRiyaCall(w.deps, orgId, id));
        expect((await read(ORG, mine.call.id)).id).toBe(mine.call.id);
        expect(await code(read(ORG, staff.call.id))).toBe('CALL_NOT_FOUND');
        expect(await code(read(OTHER_ORG, mine.call.id))).toBe('CALL_NOT_FOUND');
        expect(await code(read(ORG, 'no-such-call'))).toBe('CALL_NOT_FOUND');
    });

    it('never asks the service for a call the key may not read', async () => {
        const w = await world();
        const staff = await place(w.deps, ORG, 'admin-uid');
        const load = jest.fn();
        expect(await code(getApiCall(w.deps, ORG, staff.call.id, load))).toBe('CALL_NOT_FOUND');
        expect(load).not.toHaveBeenCalled();
    });
});

describe('what leaves in a response', () => {
    const SECRETS = { phone: GUARDIAN_PHONE, agentId: 'agent_fakesecretagent000000000000', phoneId: 'phnum_fakesecretphone00000000', conv: 'conv_secret123', sip: 'sip_secret456' };

    it('toApiCall carries only its named fields — no number, provider ids, variables, announcement or transcript', async () => {
        const w = await world();
        const { call } = await place(w.deps);
        const loaded: ConversationCallView & Record<string, unknown> = {
            ...call,
            agentId: SECRETS.agentId, agentPhoneNumberId: SECRETS.phoneId,
            providerConversationId: SECRETS.conv, providerCallId: SECRETS.sip,
            transcript: [{ role: 'user', message: 'my number is ' + SECRETS.phone, timeInCallSecs: 1 }],
            phoneHash: 'hash-of-phone', somethingAddedLater: SECRETS.phone,
        };
        const out = toApiCall(loaded);
        expect(Object.keys(out).sort()).toEqual([
            'answers', 'callSuccessful', 'createdAt', 'destination', 'durationSeconds', 'endedAt', 'failureReason', 'guardianId',
            'id', 'language', 'mode', 'phoneLast4', 'purpose', 'reviewed', 'state', 'stopRequested', 'studentId', 'synopsis', 'updatedAt',
        ]);
        const text = JSON.stringify(out);
        for (const secret of [...Object.values(SECRETS), 'hash-of-phone', call.announcement]) expect(text).not.toContain(secret);
        expect(out.phoneLast4).toBe(GUARDIAN_PHONE.slice(-4));
    });

    it('toApiPreview drops the full test-phone number, agent ids and the variables the agent is given', async () => {
        const w = await world();
        const preview = await previewRiyaCall(w.deps, ORG, PTM);
        const out = toApiPreview({ ...preview, destinationE164: SECRETS.phone, agentId: SECRETS.agentId, agentPhoneNumberId: SECRETS.phoneId, agentBranchId: 'branch_secret' });
        expect(Object.keys(out).sort()).toEqual(['announcement', 'destination', 'destinationLast4', 'ok', 'opening', 'purpose', 'recipient', 'refusals']);
        const text = JSON.stringify(out);
        for (const secret of [SECRETS.phone, SECRETS.agentId, SECRETS.phoneId, 'branch_secret']) expect(text).not.toContain(secret);
        expect(out.ok).toBe(true);
        expect(out.announcement).toBe(preview.announcement);
    });
});

// ── Class gates ─────────────────────────────────────────────────────────────

const SRC = path.join(__dirname, '..', '..', '..');
const V1_DIR = path.join(SRC, 'app', 'api', 'sampark-api', 'v1');

function routeFiles(dir: string, out: string[] = []): string[] {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) routeFiles(full, out);
        else if (e.name === 'route.ts') out.push(full);
    }
    return out;
}

/** Source with comments removed, so a gate reads code, not documentation. */
const code_ = (file: string) => fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('GATE: every /api/sampark-api/v1 route is behind the shell', () => {
    const files = routeFiles(V1_DIR);

    it('there are v1 routes to check', () => {
        expect(files.length).toBeGreaterThanOrEqual(3);
    });

    it.each(files.map((f) => [path.relative(SRC, f), f]))('%s: the shell runs first in every handler, and x-user-id is never read', (_rel, file) => {
        const src = code_(file);
        expect(src).not.toMatch(/x-user-id/i);
        expect(src).not.toMatch(/requireOrgAdmin|guardOrgRoute|guardRiyaRoute/);
        const handlers = [...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/g)];
        expect(handlers.length).toBeGreaterThan(0);
        for (const h of handlers) {
            const firstStatement = h[2].trim().split('\n')[0].trim();
            expect(firstStatement).toMatch(/^const guard = await guardApiV1\(req, apiV1Deps, '(place|read)'\);$/);
            expect(h[2]).toMatch(/if \('response' in guard\) return guard\.response;/);
            // The school is the key's: every org argument comes from the principal.
            expect(h[2]).toMatch(/guard\.principal\.orgId/);
        }
    });

    it('a handler that can lead to a dial uses the stricter budget', () => {
        for (const rel of [['calls', 'route.ts'], ['calls', 'preview', 'route.ts']]) {
            expect(code_(path.join(V1_DIR, ...rel))).toMatch(/guardApiV1\(req, apiV1Deps, 'place'\)/);
        }
    });

    it('no v1 request can carry a phone number or a school id (the schemas the routes use are strict and have no such field)', () => {
        const forbidden = /phone|number|msisdn|orgId|tenant|school/i;
        const base = { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: PTM.facts };
        const start = { ...base, idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: 'x' };
        expect(ApiPreviewSchema.safeParse(base).success).toBe(true);
        expect(ApiStartSchema.safeParse(start).success).toBe(true);
        for (const [schema, good] of [[ApiPreviewSchema, base], [ApiStartSchema, start]] as const) {
            expect(Object.keys(schema.shape).filter((k) => forbidden.test(k))).toEqual([]);
            for (const extra of [{ phone: '+919800000001' }, { to: '+919800000001' }, { orgId: OTHER_ORG }, { tenantId: OTHER_ORG }]) {
                expect(schema.safeParse({ ...good, ...extra }).success).toBe(false);
            }
        }
    });

    it('the API cannot choose a Practice scenario, and the routes parse with the API schemas', () => {
        const good = { purpose: 'ptm_invitation', guardianId: 'g1', studentId: 's1', facts: PTM.facts, idempotencyKey: crypto.randomUUID(), confirmedAnnouncement: 'x' };
        expect('scenario' in ApiStartSchema.shape).toBe(false);
        expect(ApiStartSchema.safeParse({ ...good, scenario: 'happy_path' }).success).toBe(false);
        expect(code_(path.join(V1_DIR, 'calls', 'route.ts'))).toMatch(/parseApiBody\(req, ApiStartSchema\)/);
        expect(code_(path.join(V1_DIR, 'calls', 'preview', 'route.ts'))).toMatch(/parseApiBody\(req, ApiPreviewSchema\)/);
        expect(code_(path.join(V1_DIR, 'calls', 'route.ts'))).toMatch(/apiJson\(result\.duplicate \? 200 : 201, \{ call: toApiCall\(result\.call\), duplicate: result\.duplicate \}\)/);
    });
});

describe('GATE: the public API tree cannot make a private Sampark route public', () => {
    const middleware = code_(path.join(SRC, 'middleware.ts'));

    it('no prefix under /api/sampark/ is public — [orgId] routes there trust x-user-id, and "v1" would be read as an orgId', () => {
        const prefixes = [...middleware.matchAll(/pathname\.startsWith\('(\/api\/sampark\/[^']*)'\)/g)].map((m) => m[1]);
        expect(prefixes).toEqual([]);
    });

    it('the API\'s own tree is public, holds only v1 route files, and has no dynamic segment that could shadow another route', () => {
        expect(middleware).toMatch(/pathname\.startsWith\('\/api\/sampark-api\/v1\/'\)/);
        const apiRoot = path.join(SRC, 'app', 'api', 'sampark-api');
        expect(fs.readdirSync(apiRoot)).toEqual(['v1']);
        expect(routeFiles(apiRoot).map((f) => path.relative(apiRoot, f).split(path.sep).join('/')).sort())
            .toEqual(['v1/calls/[callId]/route.ts', 'v1/calls/preview/route.ts', 'v1/calls/route.ts']);
    });
});
