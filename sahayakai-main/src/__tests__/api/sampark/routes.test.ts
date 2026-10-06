/** @jest-environment node */
/**
 * Every Sampark route (contract §5), through its real handler:
 *   - 404 when SAMPARK_ENABLED is not 'true' — checked BEFORE auth, so a dark
 *     deployment reveals nothing (not even 401);
 *   - 401 without x-user-id;
 *   - 403 for a signed-in user who does not administer the org
 *     (requireOrgAdmin on organizations/{orgId} + members/{uid});
 *   - 400 on Zod-invalid params / bodies;
 *   - a happy path on the in-memory repo (stream B) with fake speech.
 * Job routes: 404 dark, 503/401 without the cron bearer, 200 with it.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { fakeOrgDb, ADMIN, ORG, crmGuardian, crmStudent, fakeSpeech, MON_11_IST, setPhoneEnv, testClock } from '../../sampark/server/_helpers';

const mockOrgDb = fakeOrgDb(
    {
        [ORG]: { name: 'Hillview Demo School', adminUserId: ADMIN, isDemoData: true, members: { 'vice-principal': { userId: 'vice-principal', role: 'admin' }, teacher: { userId: 'teacher', role: 'teacher' } } },
        'other-school': { name: 'Other School', adminUserId: 'someone-else' },
    },
    { [ADMIN]: { organizationId: ORG } },
);
jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => mockOrgDb, initializeFirebase: async () => undefined }));

import { NextResponse } from 'next/server';

import { runImport } from '@/lib/sampark/crm/import';
import type { CrmSource, SamparkRepo } from '@/lib/sampark/ports';
import { setSamparkClockForTests, setSamparkRepoForTests, setSpeechDepsForTests } from '@/lib/sampark/repo/factory';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { Campaign } from '@/types/sampark';

const jsonSpy = jest.spyOn(NextResponse, 'json');

type Handler = (req: unknown, ctx: { params: Promise<Record<string, string>> }) => Promise<unknown>;

interface Call {
    uid?: string | null;
    body?: unknown;
    params?: Record<string, string>;
    query?: Record<string, string>;
    bearer?: string;
}

async function invoke(handler: Handler, call: Call = {}): Promise<{ status: number; body: any }> {
    const headers = new Map<string, string>();
    const uid = call.uid === undefined ? ADMIN : call.uid;
    if (uid) headers.set('x-user-id', uid);
    if (call.bearer) headers.set('authorization', `Bearer ${call.bearer}`);
    const url = new URL('http://localhost/api/sampark');
    for (const [k, v] of Object.entries(call.query ?? {})) url.searchParams.set(k, v);
    const req = {
        headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null },
        json: async () => {
            if (call.body === undefined) throw new SyntaxError('Unexpected end of JSON input');
            return call.body;
        },
        nextUrl: url,
        url: url.toString(),
    };
    jsonSpy.mockClear();
    const res = (await handler(req, { params: Promise.resolve(call.params ?? {}) })) as { status: number };
    const last = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1];
    if (last) return { status: (last[1] as { status?: number } | undefined)?.status ?? 200, body: last[0] };
    return { status: res.status, body: null };
}

// ── Route modules ──────────────────────────────────────────────────────────

const R = {
    me: () => import('@/app/api/sampark/me/route'),
    enable: () => import('@/app/api/sampark/[orgId]/enable/route'),
    overview: () => import('@/app/api/sampark/[orgId]/overview/route'),
    school: () => import('@/app/api/sampark/[orgId]/school/route'),
    mode: () => import('@/app/api/sampark/[orgId]/mode/route'),
    imports: () => import('@/app/api/sampark/[orgId]/imports/route'),
    importsLatest: () => import('@/app/api/sampark/[orgId]/imports/latest/route'),
    guardians: () => import('@/app/api/sampark/[orgId]/guardians/route'),
    preferences: () => import('@/app/api/sampark/[orgId]/guardians/[guardianId]/preferences/route'),
    suppressions: () => import('@/app/api/sampark/[orgId]/suppressions/route'),
    campaigns: () => import('@/app/api/sampark/[orgId]/campaigns/route'),
    campaign: () => import('@/app/api/sampark/[orgId]/campaigns/[id]/route'),
    preview: () => import('@/app/api/sampark/[orgId]/campaigns/[id]/preview/route'),
    approve: () => import('@/app/api/sampark/[orgId]/campaigns/[id]/approve/route'),
    cancel: () => import('@/app/api/sampark/[orgId]/campaigns/[id]/cancel/route'),
    retryAudio: () => import('@/app/api/sampark/[orgId]/campaigns/[id]/retry-audio/route'),
    calls: () => import('@/app/api/sampark/[orgId]/calls/route'),
    audio: () => import('@/app/api/sampark/[orgId]/audio/[key]/route'),
    renderJob: () => import('@/app/api/jobs/sampark-render/route'),
    dispatchJob: () => import('@/app/api/jobs/sampark-dispatch/route'),
};

async function h(name: keyof typeof R, method: string): Promise<Handler> {
    const mod = (await R[name]()) as unknown as Record<string, Handler>;
    const fn = mod[method];
    if (!fn) throw new Error(`${name} has no ${method}`);
    return fn;
}

const PTM = {
    purpose: 'ptm_invite',
    facts: { kind: 'ptm_invite', date: '2026-10-08', time: { hour: 10, minute: 30 }, venueId: 'school_hall' },
    audience: { sections: [] },
};
const SPOKEN = { English: 'Hillview School', Hindi: 'हिलव्यू स्कूल', Bengali: 'হিলভিউ স্কুল', Nepali: 'हिलभ्यू स्कूल' };

let repo: SamparkRepo;
let speech: ReturnType<typeof fakeSpeech>;

function crm(): CrmSource {
    const langs = ['ne', 'bn', 'hi', 'en'];
    const students = langs.map((_, i) => crmStudent(`s${i}`, { guardians: [{ guardianId: `g${i}`, isPrimary: true, isGuardianOfRecord: true }] }));
    const guardians = langs.map((l, i) => crmGuardian(`g${i}`, { preferredLanguage: l }));
    return { kind: 'rest', fetchSchool: async () => null, fetchStudents: async () => students, fetchGuardians: async () => guardians };
}

async function freshState(): Promise<void> {
    repo = createMemorySamparkRepo();
    speech = fakeSpeech();
    setSamparkRepoForTests(repo);
    setSpeechDepsForTests(speech);
    setSamparkClockForTests(testClock(MON_11_IST));
}

const ORIGINAL_ENV = { ...process.env };

beforeAll(setPhoneEnv);
beforeEach(async () => {
    process.env.SAMPARK_ENABLED = 'true';
    process.env.CRON_SECRET = 'cron-test-secret';
    delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    await freshState();
});
afterAll(() => {
    process.env = ORIGINAL_ENV;
    setSamparkRepoForTests(null);
    setSpeechDepsForTests(null);
    setSamparkClockForTests(null);
});

async function enabledSchool(): Promise<void> {
    const enable = await h('enable', 'POST');
    const res = await invoke(enable, { params: { orgId: ORG }, body: { displayName: 'Hillview Demo School', spokenName: SPOKEN } });
    expect(res.status).toBe(200);
    const run = await runImport({ repo, clock: testClock(MON_11_IST) }, ORG, crm(), ADMIN);
    expect(run.status).toBe('succeeded');
}

async function draft(): Promise<Campaign> {
    const res = await invoke(await h('campaigns', 'POST'), { params: { orgId: ORG }, body: PTM });
    expect(res.status).toBe(200);
    return res.body as Campaign;
}

// ── The uniform guard, for every org route ─────────────────────────────────

interface OrgRouteCase {
    name: string;
    route: keyof typeof R;
    method: string;
    params?: Record<string, string>;
    body?: unknown;
}

const ORG_ROUTES: OrgRouteCase[] = [
    { name: 'POST enable', route: 'enable', method: 'POST', body: { displayName: 'X' } },
    { name: 'GET overview', route: 'overview', method: 'GET' },
    { name: 'GET school', route: 'school', method: 'GET' },
    { name: 'PUT school', route: 'school', method: 'PUT', body: { displayName: 'Y' } },
    { name: 'PUT mode', route: 'mode', method: 'PUT', body: { mode: 'practice' } },
    { name: 'POST imports', route: 'imports', method: 'POST', body: { source: 'rest' } },
    { name: 'GET imports/latest', route: 'importsLatest', method: 'GET' },
    { name: 'GET guardians', route: 'guardians', method: 'GET' },
    { name: 'PATCH preferences', route: 'preferences', method: 'PATCH', params: { guardianId: 'g0' }, body: { language: 'Hindi' } },
    { name: 'GET suppressions', route: 'suppressions', method: 'GET' },
    { name: 'GET campaigns', route: 'campaigns', method: 'GET' },
    { name: 'POST campaigns', route: 'campaigns', method: 'POST', body: PTM },
    { name: 'GET campaign', route: 'campaign', method: 'GET', params: { id: 'c1' } },
    { name: 'POST preview', route: 'preview', method: 'POST', params: { id: 'c1' }, body: {} },
    { name: 'POST approve', route: 'approve', method: 'POST', params: { id: 'c1' } },
    { name: 'POST cancel', route: 'cancel', method: 'POST', params: { id: 'c1' } },
    { name: 'POST retry-audio', route: 'retryAudio', method: 'POST', params: { id: 'c1' } },
    { name: 'GET calls', route: 'calls', method: 'GET' },
    { name: 'GET audio', route: 'audio', method: 'GET', params: { key: 'a'.repeat(40) } },
];

describe.each(ORG_ROUTES)('$name — guard order', ({ route, method, params, body }) => {
    it('404 when SAMPARK_ENABLED is unset, even without x-user-id', async () => {
        delete process.env.SAMPARK_ENABLED;
        const handler = await h(route, method);
        expect(await invoke(handler, { uid: null, params: { orgId: ORG, ...params }, body })).toMatchObject({ status: 404 });
        process.env.SAMPARK_ENABLED = 'false';
        expect(await invoke(handler, { params: { orgId: ORG, ...params }, body })).toMatchObject({ status: 404 });
    });

    it('401 without x-user-id', async () => {
        expect(await invoke(await h(route, method), { uid: null, params: { orgId: ORG, ...params }, body })).toMatchObject({ status: 401 });
    });

    it('403 for a teacher of the org, and for an admin of another org', async () => {
        const handler = await h(route, method);
        expect(await invoke(handler, { uid: 'teacher', params: { orgId: ORG, ...params }, body })).toMatchObject({ status: 403 });
        expect(await invoke(handler, { uid: ADMIN, params: { orgId: 'other-school', ...params }, body })).toMatchObject({ status: 403 });
        expect(await invoke(handler, { uid: ADMIN, params: { orgId: 'no-such-org', ...params }, body })).toMatchObject({ status: 403 });
    });

    it('400 for a malformed orgId', async () => {
        const res = await invoke(await h(route, method), { params: { orgId: 'bad id/..', ...params }, body });
        expect(res).toMatchObject({ status: 400, body: { error: 'INVALID_REQUEST' } });
    });

    it('404 SAMPARK_NOT_ENABLED (or the route’s own result) before the school is enabled — never a 500', async () => {
        const res = await invoke(await h(route, method), { params: { orgId: ORG, ...params }, body });
        expect(res.status).not.toBe(500);
    });
});

// ── Per-route behaviour ────────────────────────────────────────────────────

describe('GET /api/sampark/me', () => {
    it('404 dark, 401 without a user', async () => {
        const handler = await h('me', 'GET');
        delete process.env.SAMPARK_ENABLED;
        expect((await invoke(handler, { uid: null })).status).toBe(404);
        process.env.SAMPARK_ENABLED = 'true';
        expect((await invoke(handler, { uid: null })).status).toBe(401);
    });

    it('lists administered orgs with enabled state; a teacher sees none', async () => {
        const handler = await h('me', 'GET');
        expect(await invoke(handler)).toEqual({ status: 200, body: { schools: [{ orgId: ORG, displayName: 'Hillview Demo School', enabled: false }] } });
        await enabledSchool();
        expect((await invoke(handler)).body.schools[0]).toMatchObject({ orgId: ORG, enabled: true });
        expect((await invoke(handler, { uid: 'teacher' })).body).toEqual({ schools: [] });
    });
});

describe('school settings', () => {
    it('enable creates a practice-mode, demo-flagged school; a member admin may use it', async () => {
        const res = await invoke(await h('enable', 'POST'), { uid: 'vice-principal', params: { orgId: ORG }, body: { displayName: 'Hillview Demo School' } });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ orgId: ORG, mode: 'practice', isDemo: true, callingWindow: { startHour: 10, endHour: 19, offDays: [0] } });
        expect((await invoke(await h('enable', 'POST'), { params: { orgId: ORG }, body: {} })).status).toBe(400);
    });

    it('PUT school validates the window, venues and CRM secret name', async () => {
        await enabledSchool();
        const put = await h('school', 'PUT');
        const bad = [
            { callingWindow: { startHour: 9, endHour: 18, offDays: [0] } },
            { callingWindow: { startHour: 10, endHour: 21, offDays: [0] } },
            { callingWindow: { startHour: 15, endHour: 12, offDays: [0] } },
            { venues: [{ id: 'hall', names: { English: 'Hall', Hindi: 'हॉल', Bengali: 'হল' } }] },
            { crm: { kind: 'rest', baseUrl: 'http://localhost:4700', apiKeySecretName: 'FIREBASE_SERVICE_ACCOUNT_KEY' } },
            { unknownField: true },
        ];
        for (const body of bad) expect((await invoke(put, { params: { orgId: ORG }, body })).status).toBe(400);

        const ok = await invoke(put, {
            params: { orgId: ORG },
            body: {
                callingWindow: { startHour: 11, endHour: 18, offDays: [0, 6, 0] },
                crm: { kind: 'rest', baseUrl: 'http://localhost:4700', apiKeySecretName: 'MOCK_CRM_API_KEY' },
                defaultLanguage: 'Nepali',
            },
        });
        expect(ok.status).toBe(200);
        expect(ok.body).toMatchObject({ callingWindow: { startHour: 11, endHour: 18, offDays: [0, 6] }, defaultLanguage: 'Nepali', crm: { kind: 'rest', apiKeySecretName: 'MOCK_CRM_API_KEY' } });
        expect((await invoke(await h('school', 'GET'), { params: { orgId: ORG } })).body.callingWindow.startHour).toBe(11);
    });

    it('PUT school refuses a CRM URL on a private network (SSRF, on save)', async () => {
        await enabledSchool();
        const res = await invoke(await h('school', 'PUT'), {
            params: { orgId: ORG },
            body: { crm: { kind: 'rest', baseUrl: 'https://10.0.0.8/crm', apiKeySecretName: 'SAMPARK_CRM_HILLVIEW' } },
        });
        expect(res).toMatchObject({ status: 400, body: { error: 'CRM_URL_REJECTED' } });
    });

    it('PUT mode: practice is accepted; test is 409 LIVE_DIAL_DISABLED while the deployment cannot dial; live is always 409 LIVE_MODE_NOT_AVAILABLE', async () => {
        await enabledSchool();
        const put = await h('mode', 'PUT');
        expect((await invoke(put, { params: { orgId: ORG }, body: { mode: 'practice' } })).body).toMatchObject({ mode: 'practice' });
        expect(await invoke(put, { params: { orgId: ORG }, body: { mode: 'test' } })).toMatchObject({ status: 409, body: { error: 'LIVE_DIAL_DISABLED' } });
        expect(await invoke(put, { params: { orgId: ORG }, body: { mode: 'live' } })).toMatchObject({ status: 409, body: { error: 'LIVE_MODE_NOT_AVAILABLE' } });
        process.env.SAMPARK_LIVE_DIAL_ENABLED = 'true';
        expect(await invoke(put, { params: { orgId: ORG }, body: { mode: 'test' } })).toMatchObject({ status: 409, body: { error: 'PUBLIC_BASE_URL_MISSING' } });
        expect(await invoke(put, { params: { orgId: ORG }, body: { mode: 'live' } })).toMatchObject({ status: 409, body: { error: 'LIVE_MODE_NOT_AVAILABLE' } });
        expect((await invoke(put, { params: { orgId: ORG }, body: { mode: 'party' } })).status).toBe(400);
    });

    describe('test phone and Test mode, through the routes (phase 2a §5)', () => {
        const LIVE_ENV: Record<string, string> = {
            SAMPARK_LIVE_DIAL_ENABLED: 'true',
            SAMPARK_PUBLIC_BASE_URL: 'https://example.test',
            VOBIZ_AUTH_ID: 'test-auth-id',
            VOBIZ_AUTH_TOKEN: 'test-auth-token',
            VOBIZ_FROM_NUMBER: '+918000000001',
        };
        beforeEach(() => {
            for (const k of [...Object.keys(LIVE_ENV), 'VOBIZ_BASE_URL']) delete process.env[k];
        });
        afterEach(() => {
            for (const k of [...Object.keys(LIVE_ENV), 'VOBIZ_BASE_URL']) delete process.env[k];
        });

        it('PUT school { testPhone } saves an Indian mobile and answers with the last four only; bad numbers are 400 TEST_PHONE_INVALID', async () => {
            await enabledSchool();
            const put = await h('school', 'PUT');
            for (const testPhone of ['+91 33 2222 3333', '+915123456789', 'call me', '']) {
                const res = await invoke(put, { params: { orgId: ORG }, body: { testPhone } });
                expect(res.status).toBe(400);
                if (testPhone !== '') expect(res.body).toMatchObject({ error: 'TEST_PHONE_INVALID' });
            }
            const ok = await invoke(put, { params: { orgId: ORG }, body: { testPhone: '98765 43210' } });
            expect(ok).toMatchObject({ status: 200, body: { testPhoneLast4: '3210', liveDialAvailable: false, liveDialBlocker: 'LIVE_DIAL_DISABLED' } });
            expect(ok.body).not.toHaveProperty('testPhoneEnc');
            expect(ok.body).not.toHaveProperty('testPhoneHash');
            expect(JSON.stringify(ok.body)).not.toContain('9876543210');

            const got = await invoke(await h('school', 'GET'), { params: { orgId: ORG } });
            expect(got.body).toMatchObject({ testPhoneLast4: '3210' });
            expect(Object.keys(got.body)).not.toEqual(expect.arrayContaining(['testPhoneEnc']));
            expect(Object.keys(got.body)).not.toEqual(expect.arrayContaining(['testPhoneHash']));
            expect(JSON.stringify(got.body)).not.toContain('9876543210');
        });

        it('Test mode needs the deployment AND a phone; overview reports liveDialAvailable; removing the phone drops back to Practice', async () => {
            await enabledSchool();
            const mode = await h('mode', 'PUT');
            const school = await h('school', 'PUT');
            const overview = await h('overview', 'GET');
            Object.assign(process.env, LIVE_ENV);

            expect(await invoke(mode, { params: { orgId: ORG }, body: { mode: 'test' } })).toMatchObject({ status: 409, body: { error: 'TEST_PHONE_MISSING' } });
            expect((await invoke(overview, { params: { orgId: ORG } })).body.school).toMatchObject({ liveDialAvailable: true, testPhoneLast4: null });

            await invoke(school, { params: { orgId: ORG }, body: { testPhone: '+91 98765 43210' } });
            const test = await invoke(mode, { params: { orgId: ORG }, body: { mode: 'test' } });
            expect(test).toMatchObject({ status: 200, body: { mode: 'test', testPhoneLast4: '3210', liveDialAvailable: true, liveDialBlocker: null } });
            expect(test.body).not.toHaveProperty('testPhoneEnc');
            expect(await invoke(mode, { params: { orgId: ORG }, body: { mode: 'live' } })).toMatchObject({ status: 409, body: { error: 'LIVE_MODE_NOT_AVAILABLE' } });

            const o = await invoke(overview, { params: { orgId: ORG } });
            expect(o.body.school).toMatchObject({ mode: 'test', liveDialAvailable: true, testPhoneLast4: '3210' });
            expect(JSON.stringify(o.body)).not.toContain('9876543210');

            const removed = await invoke(school, { params: { orgId: ORG }, body: { testPhone: null } });
            expect(removed).toMatchObject({ status: 200, body: { mode: 'practice', testPhoneLast4: null } });
            expect((await repo.getSchool(ORG))?.mode).toBe('practice');
        });
    });

    it('GET overview', async () => {
        await enabledSchool();
        const res = await invoke(await h('overview', 'GET'), { params: { orgId: ORG } });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ school: { orgId: ORG, mode: 'practice' }, windowOpenNow: true, guardians: { total: 4 } });
    });
});

describe('imports', () => {
    it('REST import without a configured CRM → 400 CRM_NOT_CONFIGURED; bad body → 400', async () => {
        await enabledSchool();
        const post = await h('imports', 'POST');
        expect(await invoke(post, { params: { orgId: ORG }, body: { source: 'rest' } })).toMatchObject({ status: 400, body: { error: 'CRM_NOT_CONFIGURED' } });
        expect((await invoke(post, { params: { orgId: ORG }, body: { source: 'ftp' } })).status).toBe(400);
        expect((await invoke(post, { params: { orgId: ORG }, body: { source: 'csv', studentsCsv: '' } })).status).toBe(400);
    });

    it('CSV import returns the run with quarantined rows, and imports/latest returns it', async () => {
        await enabledSchool();
        const { CSV_COLUMNS } = await import('@/lib/sampark/crm/schema');
        setSamparkClockForTests(testClock(new Date(MON_11_IST.getTime() + 60_000))); // a later run than the seed import
        const res = await invoke(await h('imports', 'POST'), {
            params: { orgId: ORG },
            body: {
                source: 'csv',
                studentsCsv: `${CSV_COLUMNS.students.join(',')}\nbroken-row`,
                guardiansCsv: CSV_COLUMNS.guardians.join(','),
            },
        });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ status: 'succeeded', source: 'csv', counts: { rejected: 1 } });
        expect(res.body.rejected[0]).toMatchObject({ entity: 'student', row: 1 });
        const latest = await invoke(await h('importsLatest', 'GET'), { params: { orgId: ORG } });
        expect(latest).toMatchObject({ status: 200, body: { id: res.body.id } });
    });
});

describe('guardians, preferences, suppressions', () => {
    it('GET guardians filters by language and validates the query', async () => {
        await enabledSchool();
        const get = await h('guardians', 'GET');
        const all = await invoke(get, { params: { orgId: ORG } });
        expect(all.body.guardians).toHaveLength(4);
        expect(all.body.guardians[0]).toEqual(
            expect.objectContaining({ id: expect.any(String), phoneLast4: expect.stringMatching(/^\d{4}$/), consent: expect.objectContaining({ notices: 'granted' }) }),
        );
        expect(JSON.stringify(all.body)).not.toMatch(/phoneEnc|phoneHash|\+915/);
        const hindi = await invoke(get, { params: { orgId: ORG }, query: { language: 'Hindi' } });
        expect(hindi.body.guardians.map((g: { id: string }) => g.id)).toEqual(['g2']);
        expect((await invoke(get, { params: { orgId: ORG }, query: { language: 'Klingon' } })).status).toBe(400);
        expect((await invoke(get, { params: { orgId: ORG }, query: { limit: '0' } })).status).toBe(400);
    });

    it('PATCH preferences records an office decision; 404 for an unknown guardian; 400 for an empty patch', async () => {
        await enabledSchool();
        const patch = await h('preferences', 'PATCH');
        const ok = await invoke(patch, { params: { orgId: ORG, guardianId: 'g0' }, body: { language: 'Hindi', consent: { notices: 'denied' } } });
        expect(ok.status).toBe(200);
        expect(ok.body).toMatchObject({ guardianId: 'g0', language: 'Hindi', updatedBy: ADMIN, consent: { notices: { status: 'denied', source: 'office' } } });
        expect(await invoke(patch, { params: { orgId: ORG, guardianId: 'nobody' }, body: { language: null } })).toMatchObject({ status: 404 });
        expect((await invoke(patch, { params: { orgId: ORG, guardianId: 'g0' }, body: {} })).status).toBe(400);
        expect((await invoke(patch, { params: { orgId: ORG, guardianId: 'g0' }, body: { consent: { marketing: 'granted' } } })).status).toBe(400);
        expect((await invoke(patch, { params: { orgId: ORG, guardianId: '../x' }, body: { language: null } })).status).toBe(400);
    });

    it('GET suppressions', async () => {
        await enabledSchool();
        expect(await invoke(await h('suppressions', 'GET'), { params: { orgId: ORG } })).toEqual({ status: 200, body: { suppressions: [] } });
    });
});

describe('campaigns', () => {
    it('POST validates facts with Zod (half-hours only, strict shapes) and creates a draft', async () => {
        await enabledSchool();
        const post = await h('campaigns', 'POST');
        const badBodies = [
            { ...PTM, facts: { ...PTM.facts, time: { hour: 10, minute: 15 } } },
            { ...PTM, facts: { ...PTM.facts, date: '08-10-2026' } },
            { ...PTM, facts: { ...PTM.facts, date: '2026-02-30' } },
            { ...PTM, facts: { ...PTM.facts, freeText: 'say anything' } },
            { ...PTM, audience: { sections: [{ grade: 7, section: 'b' }] } },
            { ...PTM, notBefore: 'tomorrow' },
        ];
        for (const body of badBodies) expect((await invoke(post, { params: { orgId: ORG }, body })).status).toBe(400);
        expect(await invoke(post, { params: { orgId: ORG }, body: { ...PTM, purpose: 'fee_due' } })).toMatchObject({ status: 400, body: { error: 'PURPOSE_NOT_AVAILABLE' } });

        const created = await invoke(post, { params: { orgId: ORG }, body: PTM });
        expect(created).toMatchObject({ status: 200, body: { status: 'draft', purpose: 'ptm_invite' } });
        const list = await invoke(await h('campaigns', 'GET'), { params: { orgId: ORG } });
        expect(list.body.campaigns.map((c: Campaign) => c.id)).toEqual([created.body.id]);
    });

    it('GET campaign returns the audience dry run; unknown id → 404; bad id → 400', async () => {
        await enabledSchool();
        const c = await draft();
        const get = await h('campaign', 'GET');
        const res = await invoke(get, { params: { orgId: ORG, id: c.id } });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ campaign: { id: c.id }, audience: { guardians: 4, byLanguage: { English: 1, Hindi: 1, Bengali: 1, Nepali: 1, unknown: 0 } } });
        expect(await invoke(get, { params: { orgId: ORG, id: 'nope' } })).toMatchObject({ status: 404, body: { error: 'CAMPAIGN_NOT_FOUND' } });
        expect((await invoke(get, { params: { orgId: ORG, id: 'a b' } })).status).toBe(400);
    });

    it('POST preview returns four languages by default, or the requested ones', async () => {
        await enabledSchool();
        const c = await draft();
        const post = await h('preview', 'POST');
        const all = await invoke(post, { params: { orgId: ORG, id: c.id } });
        expect(all.status).toBe(200);
        expect(all.body.previews.map((p: { language: string }) => p.language)).toEqual(['English', 'Hindi', 'Bengali', 'Nepali']);
        const one = await invoke(post, { params: { orgId: ORG, id: c.id }, body: { languages: ['Nepali'] } });
        expect(one.body.previews).toHaveLength(1);
        expect((await invoke(post, { params: { orgId: ORG, id: c.id }, body: { languages: ['French'] } })).status).toBe(400);
    });

    it('approve → rendering (409 the second time); cancel → cancelled (409 the second time)', async () => {
        await enabledSchool();
        const c = await draft();
        const approve = await h('approve', 'POST');
        expect(await invoke(approve, { params: { orgId: ORG, id: c.id } })).toMatchObject({ status: 200, body: { status: 'rendering', approvedBy: ADMIN } });
        expect(await invoke(approve, { params: { orgId: ORG, id: c.id } })).toMatchObject({ status: 409, body: { error: 'CAMPAIGN_NOT_DRAFT' } });
        const cancel = await h('cancel', 'POST');
        expect(await invoke(cancel, { params: { orgId: ORG, id: c.id } })).toMatchObject({ status: 200, body: { status: 'cancelled' } });
        expect(await invoke(cancel, { params: { orgId: ORG, id: c.id } })).toMatchObject({ status: 409, body: { error: 'CAMPAIGN_FINISHED' } });
        // Retrying audio is only for a render that failed its check.
        const retry = await h('retryAudio', 'POST');
        expect(await invoke(retry, { params: { orgId: ORG, id: c.id } })).toMatchObject({ status: 409, body: { error: 'CAMPAIGN_AUDIO_NOT_FAILED' } });
    });
});

describe('jobs, calls and audio — the full loop through the routes', () => {
    it('job routes: 404 dark, 503 without CRON_SECRET, 401 with a wrong bearer', async () => {
        for (const name of ['renderJob', 'dispatchJob'] as const) {
            const post = await h(name, 'POST');
            delete process.env.SAMPARK_ENABLED;
            expect((await invoke(post, { uid: null, bearer: 'cron-test-secret' })).status).toBe(404);
            process.env.SAMPARK_ENABLED = 'true';
            expect((await invoke(post, { uid: null, bearer: 'wrong' })).status).toBe(401);
            expect((await invoke(post, { uid: null })).status).toBe(401);
            delete process.env.CRON_SECRET;
            expect((await invoke(post, { uid: null, bearer: 'anything' })).status).toBe(503);
            process.env.CRON_SECRET = 'cron-test-secret';
        }
    });

    it('approve → render job → dispatch job → calls → audio', async () => {
        await enabledSchool();
        const c = await draft();
        await invoke(await h('approve', 'POST'), { params: { orgId: ORG, id: c.id } });

        const render = await h('renderJob', 'POST');
        let status = 'rendering';
        for (let i = 0; i < 4 && status === 'rendering'; i++) {
            const r = await invoke(render, { uid: null, bearer: 'cron-test-secret' });
            expect(r.status).toBe(200);
            expect(r.body.errors).toEqual([]);
            status = (await repo.getCampaign(ORG, c.id))!.status;
        }
        expect(status).toBe('scheduled');

        const dispatch = await invoke(await h('dispatchJob', 'POST'), { uid: null, bearer: 'cron-test-secret' });
        expect(dispatch).toMatchObject({ status: 200, body: { dialed: 4, errors: [] } });

        const calls = await invoke(await h('calls', 'GET'), { params: { orgId: ORG }, query: { campaignId: c.id, limit: '10' } });
        expect(calls.status).toBe(200);
        expect(calls.body.calls).toHaveLength(4);
        expect(calls.body.calls[0]).toEqual(expect.objectContaining({ carrier: 'simulated', guardianDisplayName: expect.stringMatching(/^Guardian g\d$/) }));
        expect((await invoke(await h('calls', 'GET'), { params: { orgId: ORG }, query: { limit: '9999' } })).status).toBe(400);

        const preview = await invoke(await h('preview', 'POST'), { params: { orgId: ORG, id: c.id }, body: { languages: ['Bengali'] } });
        const key = preview.body.previews[0].clips.find((x: { kind: string }) => x.kind === 'message').audioKey as string;
        expect(key).toMatch(/^[0-9a-f]{40}$/);
        const audio = await h('audio', 'GET');
        expect(await invoke(audio, { params: { orgId: ORG, key } })).toMatchObject({ status: 200 });
        expect(await invoke(audio, { params: { orgId: ORG, key: 'f'.repeat(40) } })).toMatchObject({ status: 404, body: { error: 'AUDIO_NOT_FOUND' } });
        expect((await invoke(audio, { params: { orgId: ORG, key: '..%2F..%2Fetc' } })).status).toBe(400);
    });
});
