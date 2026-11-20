/** @jest-environment node */
/**
 * School pause (hardening H3, contract C6): the service and its route.
 *
 *   - Pausing records who, when, why and the scope, audits `school.pause`, and hangs
 *     up ringing calls: every one for scope 'all', all but emergency closures for
 *     scope 'routine'. A hang-up failure never undoes or fails the pause.
 *   - Asking again for the same pause changes nothing and audits nothing (it still
 *     asks for ringing calls to be hung up); a new reason or scope replaces it.
 *   - Resuming clears it and audits `school.resume`; resuming twice changes nothing.
 *   - PUT /api/sampark/[orgId]/pause runs the shared guard (404 dark → 401 → 400 → 403),
 *     validates the body, and answers with the school view only.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const mockHangup = jest.fn(async (..._args: unknown[]) => ({ attempted: 0, hungUp: 0, stillSpeaking: 0 }));
jest.mock('@/server/sampark/hangup', () => ({ hangupRingingCalls: (...args: unknown[]) => mockHangup(...args) }));

import { fakeOrgDb, ADMIN, ORG, MON_11_IST, recordingRepo, setPhoneEnv, testClock } from './_helpers';

const mockOrgDb = fakeOrgDb(
    {
        [ORG]: { name: 'Hillview Demo School', adminUserId: ADMIN, isDemoData: true, members: { teacher: { userId: 'teacher', role: 'teacher' } } },
        'other-school': { name: 'Other School', adminUserId: 'someone-else' },
    },
    { [ADMIN]: { organizationId: ORG } },
);
jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => mockOrgDb, initializeFirebase: async () => undefined }));

import { NextResponse } from 'next/server';

import type { AuditEntry } from '@/lib/sampark/ports';
import { setSamparkClockForTests, setSamparkRepoForTests } from '@/lib/sampark/repo/factory';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import type { SamparkCtx } from '@/server/sampark/http';
import { getOverview } from '@/server/sampark/overview';
import { enableSchool, PauseSchema, pauseHangupFilter, schoolView, setSchoolPause } from '@/server/sampark/school';
import type { PurposeId, SamparkCall } from '@/types/sampark';

beforeAll(setPhoneEnv);
beforeEach(() => mockHangup.mockClear());

async function setup() {
    const repo = recordingRepo(createMemorySamparkRepo());
    const clock = testClock(MON_11_IST);
    const ctx: SamparkCtx = { repo, clock };
    await enableSchool(ctx, ORG, ADMIN, { displayName: 'Hillview Demo School', isDemo: true });
    const audits = (action?: string) =>
        repo.writes.filter((w) => w.method === 'appendAudit').map((w) => w.args[1] as AuditEntry).filter((a) => !action || a.action === action);
    return { repo, clock, ctx, audits, stored: async () => (await repo.getSchool(ORG))! };
}

const callFor = (purpose: PurposeId) => ({ purpose }) as SamparkCall;

describe('setSchoolPause', () => {
    it('pausing records who, when, why and the scope (default all), audits it, and hangs up every ringing call', async () => {
        const env = await setup();
        const school = await setSchoolPause(env.ctx, ORG, ADMIN, { paused: true, reason: '  Bereavement in the school community ' });
        const pause = { at: MON_11_IST.toISOString(), by: ADMIN, reason: 'Bereavement in the school community', scope: 'all' };
        expect(school.pause).toEqual(pause);
        expect((await env.stored()).pause).toEqual(pause);
        expect(env.audits('school.pause')).toEqual([
            expect.objectContaining({ actor: ADMIN, target: `school/${ORG}`, detail: { scope: 'all', reason: 'Bereavement in the school community', previous: null } }),
        ]);

        expect(mockHangup).toHaveBeenCalledTimes(1);
        const [ctxArg, orgArg, opts] = mockHangup.mock.calls[0] as [SamparkCtx, string, { reason: string; actor: string; include: (c: SamparkCall) => boolean; campaignId?: string }];
        expect(ctxArg).toBe(env.ctx);
        expect(orgArg).toBe(ORG);
        expect(opts).toMatchObject({ reason: 'school_paused', actor: ADMIN });
        expect(opts.campaignId).toBeUndefined(); // the whole school, not one campaign
        expect(opts.include(callFor('emergency_closure'))).toBe(true);
        expect(opts.include(callFor('ptm_invite'))).toBe(true);
    });

    it('a routine pause leaves emergency closures ringing and hangs up everything else', async () => {
        const env = await setup();
        await setSchoolPause(env.ctx, ORG, ADMIN, { paused: true, reason: 'Exam week', scope: 'routine' });
        const opts = mockHangup.mock.calls[0][2] as { include: (c: SamparkCall) => boolean };
        expect(opts.include(callFor('emergency_closure'))).toBe(false);
        for (const purpose of ['ptm_invite', 'event_invite', 'fee_due'] as const) expect(opts.include(callFor(purpose))).toBe(true);
        expect(pauseHangupFilter('routine')(callFor('emergency_closure'))).toBe(false);
        expect(pauseHangupFilter('all')(callFor('emergency_closure'))).toBe(true);
    });

    it('is idempotent: the same pause again changes nothing and audits nothing, but still hangs up ringing calls', async () => {
        const env = await setup();
        const first = await setSchoolPause(env.ctx, ORG, ADMIN, { paused: true, reason: 'Exam week', scope: 'routine' });
        env.clock.advance(60_000);
        const again = await setSchoolPause(env.ctx, ORG, 'vice-principal', { paused: true, reason: 'Exam week', scope: 'routine' });
        expect(again.pause).toEqual(first.pause);
        expect(env.audits('school.pause')).toHaveLength(1);
        expect(mockHangup).toHaveBeenCalledTimes(2);

        // A new scope (or reason) replaces the pause, and is audited with what it replaced.
        const wider = await setSchoolPause(env.ctx, ORG, 'vice-principal', { paused: true, reason: 'Exam week', scope: 'all' });
        expect(wider.pause).toMatchObject({ by: 'vice-principal', scope: 'all', at: new Date(MON_11_IST.getTime() + 60_000).toISOString() });
        expect(env.audits('school.pause')).toHaveLength(2);
        expect(env.audits('school.pause')[1].detail).toMatchObject({ scope: 'all', previous: { at: MON_11_IST.toISOString(), scope: 'routine' } });
    });

    it('resuming clears the pause and audits it; resuming again changes nothing', async () => {
        const env = await setup();
        await setSchoolPause(env.ctx, ORG, ADMIN, { paused: true, reason: 'Exam week' });
        mockHangup.mockClear();
        const resumed = await setSchoolPause(env.ctx, ORG, 'vice-principal', { paused: false });
        expect(resumed.pause).toBeNull();
        expect((await env.stored()).pause).toBeNull();
        expect(env.audits('school.resume')).toEqual([
            expect.objectContaining({ actor: 'vice-principal', detail: { pausedAt: MON_11_IST.toISOString(), pausedBy: ADMIN, scope: 'all' } }),
        ]);
        const writes = env.repo.writes.length;
        await setSchoolPause(env.ctx, ORG, ADMIN, { paused: false });
        expect(env.repo.writes.length).toBe(writes);
        expect(mockHangup).not.toHaveBeenCalled();
    });

    it('a hang-up failure is logged; the pause still stands and is returned', async () => {
        const env = await setup();
        mockHangup.mockRejectedValueOnce(new Error('firestore unavailable'));
        const school = await setSchoolPause(env.ctx, ORG, ADMIN, { paused: true, reason: 'Carrier complaint' });
        expect(school.pause).toMatchObject({ reason: 'Carrier complaint' });
        expect((await env.stored()).pause).toMatchObject({ reason: 'Carrier complaint' });
    });

    it('refuses a school that has not enabled Sampark', async () => {
        const ctx: SamparkCtx = { repo: createMemorySamparkRepo(), clock: testClock() };
        await expect(setSchoolPause(ctx, 'nobody', ADMIN, { paused: true, reason: 'x' })).rejects.toMatchObject({ status: 404 });
    });

    it('the school view and the overview carry the pause (null when not paused)', async () => {
        const env = await setup();
        expect(schoolView(await env.stored()).pause).toBeNull();
        expect((await getOverview(env.ctx, ORG)).pause).toBeNull();
        await setSchoolPause(env.ctx, ORG, ADMIN, { paused: true, reason: 'Exam week', scope: 'routine' });
        const pause = { at: MON_11_IST.toISOString(), by: ADMIN, reason: 'Exam week', scope: 'routine' };
        expect(schoolView(await env.stored()).pause).toEqual(pause);
        expect((await getOverview(env.ctx, ORG)).pause).toEqual(pause);
    });
});

describe('PauseSchema', () => {
    it('needs a reason of 1–200 characters to pause; resuming needs nothing else', () => {
        expect(PauseSchema.safeParse({ paused: true, reason: 'Exam week' }).success).toBe(true);
        expect(PauseSchema.safeParse({ paused: true, reason: 'Exam week', scope: 'routine' }).success).toBe(true);
        expect(PauseSchema.safeParse({ paused: false }).success).toBe(true);
        expect(PauseSchema.safeParse({ paused: true }).success).toBe(false);
        expect(PauseSchema.safeParse({ paused: true, reason: '   ' }).success).toBe(false);
        expect(PauseSchema.safeParse({ paused: true, reason: 'x'.repeat(201) }).success).toBe(false);
        expect(PauseSchema.safeParse({ paused: true, reason: 'x', scope: 'some' }).success).toBe(false);
        expect(PauseSchema.safeParse({ paused: true, reason: 'x', by: 'someone' }).success).toBe(false); // strict
        expect(PauseSchema.safeParse({ reason: 'x' }).success).toBe(false);
    });
});

// ── The route ───────────────────────────────────────────────────────────────

const jsonSpy = jest.spyOn(NextResponse, 'json');
type Handler = (req: unknown, ctx: { params: Promise<Record<string, string>> }) => Promise<unknown>;

async function put(body: unknown, opts: { uid?: string | null; orgId?: string } = {}): Promise<{ status: number; body: any }> {
    const { PUT } = (await import('@/app/api/sampark/[orgId]/pause/route')) as unknown as { PUT: Handler };
    const uid = opts.uid === undefined ? ADMIN : opts.uid;
    const req = {
        headers: { get: (k: string) => (k.toLowerCase() === 'x-user-id' ? uid : null) },
        json: async () => body,
    };
    jsonSpy.mockClear();
    await PUT(req, { params: Promise.resolve({ orgId: opts.orgId ?? ORG }) });
    const last = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1];
    return { status: (last[1] as { status?: number } | undefined)?.status ?? 200, body: last[0] };
}

describe('PUT /api/sampark/[orgId]/pause', () => {
    const ORIGINAL = process.env.SAMPARK_ENABLED;
    let repo: ReturnType<typeof createMemorySamparkRepo>;

    beforeEach(async () => {
        process.env.SAMPARK_ENABLED = 'true';
        repo = createMemorySamparkRepo();
        setSamparkRepoForTests(repo);
        setSamparkClockForTests(testClock(MON_11_IST));
        await enableSchool({ repo, clock: testClock(MON_11_IST) }, ORG, ADMIN, { displayName: 'Hillview Demo School', isDemo: true });
    });
    afterAll(() => {
        if (ORIGINAL === undefined) delete process.env.SAMPARK_ENABLED;
        else process.env.SAMPARK_ENABLED = ORIGINAL;
        setSamparkRepoForTests(null);
        setSamparkClockForTests(null);
    });

    const PAUSE = { paused: true, reason: 'Exam week' };

    it('404 when SAMPARK_ENABLED is not "true", before auth', async () => {
        delete process.env.SAMPARK_ENABLED;
        expect(await put(PAUSE, { uid: null })).toMatchObject({ status: 404 });
        expect((await repo.getSchool(ORG))!.pause ?? null).toBeNull();
    });

    it('401 without x-user-id', async () => {
        expect(await put(PAUSE, { uid: null })).toMatchObject({ status: 401 });
    });

    it('403 for a teacher of the school, an admin of another school, and an unknown school', async () => {
        expect(await put(PAUSE, { uid: 'teacher' })).toMatchObject({ status: 403 });
        expect(await put(PAUSE, { orgId: 'other-school' })).toMatchObject({ status: 403 });
        expect(await put(PAUSE, { orgId: 'no-such-org' })).toMatchObject({ status: 403 });
        expect((await repo.getSchool(ORG))!.pause ?? null).toBeNull();
    });

    it('400 for a malformed orgId or body, including a pause without a reason', async () => {
        expect(await put(PAUSE, { orgId: 'bad id/..' })).toMatchObject({ status: 400, body: { error: 'INVALID_REQUEST' } });
        expect(await put({ paused: true })).toMatchObject({ status: 400, body: { error: 'INVALID_REQUEST', message: expect.stringMatching(/^reason: /) } });
        expect(await put(undefined)).toMatchObject({ status: 400 });
    });

    it('pauses and resumes for an org admin, answering with the school view only', async () => {
        const paused = await put({ ...PAUSE, scope: 'routine' });
        expect(paused.status).toBe(200);
        expect(paused.body.pause).toEqual({ at: MON_11_IST.toISOString(), by: ADMIN, reason: 'Exam week', scope: 'routine' });
        expect(paused.body).not.toHaveProperty('testPhoneEnc');
        expect(paused.body).not.toHaveProperty('testPhoneHash');
        expect(paused.body).toHaveProperty('liveDialAvailable');

        const resumed = await put({ paused: false });
        expect(resumed).toMatchObject({ status: 200, body: { pause: null } });
        expect((await repo.getSchool(ORG))!.pause).toBeNull();
    });
});
