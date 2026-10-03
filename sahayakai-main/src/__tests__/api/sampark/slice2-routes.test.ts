/** @jest-environment node */
/**
 * The slice-2 routes (rules, roles, proposals, A2 confirmation, pages, backtest,
 * proposals job), through their real handlers: 404 dark before anything else,
 * 401 without a user, 403 for someone without the authority, 400 on bad bodies,
 * and a happy path on the in-memory repos. Admin routes need the org admin;
 * staff routes also admit anyone holding a Sampark role (a class teacher).
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { ADMIN, crmGuardian, crmStudent, fakeOrgDb, MON_11_IST, ORG, setPhoneEnv, testClock } from '../../sampark/server/_helpers';

const mockOrgDb = fakeOrgDb(
    {
        [ORG]: { name: 'Hillview Demo School', adminUserId: ADMIN, isDemoData: true, members: { teacher: { userId: 'teacher', role: 'teacher' } } },
    },
    { [ADMIN]: { organizationId: ORG } },
);
jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => mockOrgDb, initializeFirebase: async () => undefined }));

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { NextResponse } from 'next/server';

import { runImport } from '@/lib/sampark/crm/import';
import type { CrmSource, SamparkRepo } from '@/lib/sampark/ports';
import { setSamparkClockForTests, setSamparkRepoForTests } from '@/lib/sampark/repo/factory';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { setSamparkRulesRepoForTests } from '@/lib/sampark/rules/factory';
import { createMemoryRulesRepo } from '@/lib/sampark/rules/memory-repo';
import type { SamparkRulesRepo } from '@/lib/sampark/rules/ports';
import { DEFAULT_THRESHOLDS } from '@/lib/sampark/rules/thresholds';

const jsonSpy = jest.spyOn(NextResponse, 'json');
type Handler = (req: unknown, ctx: { params: Promise<Record<string, string>> }) => Promise<unknown>;
interface Call { uid?: string | null; body?: unknown; params?: Record<string, string>; query?: Record<string, string>; bearer?: string }

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

const R = {
    rules: () => import('@/app/api/sampark/[orgId]/rules/route'),
    rule: () => import('@/app/api/sampark/[orgId]/rules/[ruleId]/route'),
    preview: () => import('@/app/api/sampark/[orgId]/rules/preview/route'),
    run: () => import('@/app/api/sampark/[orgId]/rules/run/route'),
    backtest: () => import('@/app/api/sampark/[orgId]/rules/backtest/route'),
    roles: () => import('@/app/api/sampark/[orgId]/roles/route'),
    proposals: () => import('@/app/api/sampark/[orgId]/proposals/route'),
    approve: () => import('@/app/api/sampark/[orgId]/proposals/[id]/approve/route'),
    dismiss: () => import('@/app/api/sampark/[orgId]/proposals/[id]/dismiss/route'),
    handle: () => import('@/app/api/sampark/[orgId]/proposals/[id]/handle/route'),
    confirm: () => import('@/app/api/sampark/[orgId]/absences/confirm/route'),
    pages: () => import('@/app/api/sampark/[orgId]/pages/route'),
    ack: () => import('@/app/api/sampark/[orgId]/pages/[id]/acknowledge/route'),
    job: () => import('@/app/api/jobs/sampark-proposals/route'),
};
async function h(name: keyof typeof R, method: string): Promise<Handler> {
    const mod = (await R[name]()) as unknown as Record<string, Handler>;
    if (!mod[method]) throw new Error(`${name} has no ${method}`);
    return mod[method];
}

const SPOKEN = { English: 'Hillview School', Hindi: 'हिलव्यू स्कूल', Bengali: 'হিলভিউ স্কুল', Nepali: 'हिलभ्यू स्कूल' };
let repo: SamparkRepo;
let rules: SamparkRulesRepo;
let fixturePath: string;

const SIGNALS = {
    attendance: [],
    hpc: [],
    assessments: [
        ...[['PT1', '2026-07-20', 83], ['PT2', '2026-08-20', 60], ['HY', '2026-09-20', 39]].map(([id, date, pct]) => ({ studentId: 's0', assessmentId: id, assessmentName: id, subjectId: 'maths', date, maxMarks: 100, marks: pct, status: 'scored' })),
    ],
    meetings: [],
    incidents: [],
    feeDues: [],
};

function crm(): CrmSource {
    const students = [crmStudent('s0', { guardians: [{ guardianId: 'g0', isPrimary: true, isGuardianOfRecord: true }] })];
    const guardians = [
        crmGuardian('g0', {
            preferredLanguage: 'hi',
            consent: { notices: { status: 'granted', recordedAt: '2026-06-01T10:00:00+05:30', method: 'office', noticeVersion: 'v1' }, progress: { status: 'granted', recordedAt: '2026-06-01T10:00:00+05:30', method: 'office', noticeVersion: 'v1' }, recordedConversation: null, hpcInput: null },
        }),
    ];
    return { kind: 'rest', fetchSchool: async () => null, fetchStudents: async () => students, fetchGuardians: async () => guardians };
}

const ORIGINAL_ENV = { ...process.env };
beforeAll(setPhoneEnv);
beforeEach(async () => {
    process.env.SAMPARK_ENABLED = 'true';
    process.env.CRON_SECRET = 'cron-test-secret';
    delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    fixturePath = path.join(os.tmpdir(), `sampark-signals-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(fixturePath, JSON.stringify(SIGNALS));
    process.env.SAMPARK_SIGNALS_FIXTURE = fixturePath;
    repo = createMemorySamparkRepo();
    rules = createMemoryRulesRepo();
    setSamparkRepoForTests(repo);
    setSamparkRulesRepoForTests(rules);
    setSamparkClockForTests(testClock(MON_11_IST));
    const enable = await import('@/app/api/sampark/[orgId]/enable/route');
    const res = await invoke(enable.POST as Handler, { params: { orgId: ORG }, body: { displayName: 'Hillview Demo School', spokenName: SPOKEN } });
    expect(res.status).toBe(200);
    expect((await runImport({ repo, clock: testClock(MON_11_IST) }, ORG, crm(), ADMIN)).status).toBe('succeeded');
});
afterEach(() => fs.rmSync(fixturePath, { force: true }));
afterAll(() => {
    process.env = ORIGINAL_ENV;
    setSamparkRepoForTests(null);
    setSamparkRulesRepoForTests(null);
    setSamparkClockForTests(null);
});

interface RouteCase { name: string; route: keyof typeof R; method: string; params?: Record<string, string>; body?: unknown; staff: boolean }
const CASES: RouteCase[] = [
    { name: 'GET rules', route: 'rules', method: 'GET', staff: false },
    { name: 'PUT rule', route: 'rule', method: 'PUT', params: { ruleId: 'academic_talk' }, body: { thresholds: DEFAULT_THRESHOLDS.academic_talk, adopterName: 'P', acknowledged: true }, staff: false },
    { name: 'DELETE rule', route: 'rule', method: 'DELETE', params: { ruleId: 'academic_talk' }, staff: false },
    { name: 'GET rules/preview', route: 'preview', method: 'GET', staff: false },
    { name: 'POST rules/run', route: 'run', method: 'POST', staff: false },
    { name: 'POST rules/backtest', route: 'backtest', method: 'POST', body: {}, staff: false },
    { name: 'GET roles', route: 'roles', method: 'GET', staff: false },
    { name: 'POST roles', route: 'roles', method: 'POST', body: { uid: 'u', role: 'accounts', sections: [] }, staff: false },
    { name: 'DELETE roles', route: 'roles', method: 'DELETE', body: { uid: 'u', role: 'accounts' }, staff: false },
    { name: 'GET proposals', route: 'proposals', method: 'GET', staff: true },
    { name: 'POST approve', route: 'approve', method: 'POST', params: { id: 'p1' }, staff: true },
    { name: 'POST dismiss', route: 'dismiss', method: 'POST', params: { id: 'p1' }, body: {}, staff: true },
    { name: 'POST handle', route: 'handle', method: 'POST', params: { id: 'p1' }, staff: true },
    { name: 'POST absences/confirm', route: 'confirm', method: 'POST', body: { grade: 7, section: 'B' }, staff: true },
    { name: 'GET pages', route: 'pages', method: 'GET', staff: true },
    { name: 'POST page acknowledge', route: 'ack', method: 'POST', params: { id: 'p1' }, staff: true },
];

describe.each(CASES)('$name — guard order', ({ route, method, params, body, staff }) => {
    it('404 when SAMPARK_ENABLED is unset, even without x-user-id', async () => {
        delete process.env.SAMPARK_ENABLED;
        expect(await invoke(await h(route, method), { uid: null, params: { orgId: ORG, ...params }, body })).toMatchObject({ status: 404 });
    });
    it('401 without x-user-id', async () => {
        expect(await invoke(await h(route, method), { uid: null, params: { orgId: ORG, ...params }, body })).toMatchObject({ status: 401 });
    });
    it('403 for a user who is neither the org admin nor a role holder', async () => {
        expect(await invoke(await h(route, method), { uid: 'teacher', params: { orgId: ORG, ...params }, body })).toMatchObject({ status: 403 });
        expect(await invoke(await h(route, method), { uid: 'stranger', params: { orgId: ORG, ...params }, body })).toMatchObject({ status: 403 });
    });
    it('400 on a malformed org id', async () => {
        expect(await invoke(await h(route, method), { params: { orgId: 'bad id!', ...params }, body })).toMatchObject({ status: 400 });
    });
    it(staff ? 'a role holder (not the org admin) passes the guard' : 'a role holder is still refused an admin route', async () => {
        await rules.upsertRoleAssignment({ orgId: ORG, uid: 'acct', role: 'accounts', sections: [], displayName: 'A', grantedBy: ADMIN, grantedAt: '2026-10-01T00:00:00.000Z' });
        const res = await invoke(await h(route, method), { uid: 'acct', params: { orgId: ORG, ...params }, body });
        // The guard's own refusal is { error: 'Forbidden' }; a service-level 403 carries a specific code instead.
        if (staff) expect(res.body).not.toEqual({ error: 'Forbidden' });
        else expect(res.body).toEqual({ error: 'Forbidden' });
    });
});

describe('happy path', () => {
    it('adopt → run → class teacher sees and approves → intents for the dispatcher', async () => {
        // the principal grants the class teacher their section and adopts the academic rule
        expect((await invoke(await h('roles', 'POST'), { params: { orgId: ORG }, body: { uid: 't7b', role: 'class_teacher', sections: [{ grade: 7, section: 'B' }], displayName: 'Mrs Rai' } })).status).toBe(200);
        const adopt = await invoke(await h('rule', 'PUT'), { params: { orgId: ORG, ruleId: 'academic_talk' }, body: { thresholds: DEFAULT_THRESHOLDS.academic_talk, adopterName: 'The Principal', acknowledged: true } });
        expect(adopt).toMatchObject({ status: 200, body: { ruleId: 'academic_talk', version: 1, status: 'adopted', adopterName: 'The Principal' } });

        const list = await invoke(await h('rules', 'GET'), { params: { orgId: ORG } });
        expect(list.body.rules.filter((r: { adopted: boolean }) => r.adopted).map((r: { ruleId: string }) => r.ruleId)).toEqual(['academic_talk']);
        expect(list.body.rules).toHaveLength(7);

        const preview = await invoke(await h('preview', 'GET'), { params: { orgId: ORG } });
        expect(preview.body.wouldPropose).toHaveLength(1);
        expect(await rules.listProposals(ORG)).toEqual([]); // a preview writes nothing

        const run = await invoke(await h('run', 'POST'), { params: { orgId: ORG } });
        expect(run).toMatchObject({ status: 200, body: { created: 1, evaluated: ['academic_talk'] } });

        const queue = await invoke(await h('proposals', 'GET'), { uid: 't7b', params: { orgId: ORG } });
        expect(queue.status).toBe(200);
        expect(queue.body.proposals).toHaveLength(1);
        const view = queue.body.proposals[0];
        expect(view).toMatchObject({ studentName: 'Student s0', section: '7B', approverLabel: 'class teacher' });
        expect(view.proposal.evidence[0].text).toMatch(/Fell across 3 assessments/);
        expect(view.previews[1].language).toBe('Hindi');

        // another class teacher cannot decide it
        await rules.upsertRoleAssignment({ orgId: ORG, uid: 't4a', role: 'class_teacher', sections: [{ grade: 4, section: 'A' }], displayName: 'T', grantedBy: ADMIN, grantedAt: '2026-10-01T00:00:00.000Z' });
        expect((await invoke(await h('approve', 'POST'), { uid: 't4a', params: { orgId: ORG, id: view.proposal.id } })).status).toBe(403);
        expect((await invoke(await h('proposals', 'GET'), { uid: 't4a', params: { orgId: ORG } })).body.proposals).toEqual([]);

        const approved = await invoke(await h('approve', 'POST'), { uid: 't7b', params: { orgId: ORG, id: view.proposal.id } });
        expect(approved).toMatchObject({ status: 200, body: { dialable: 1, needsAttention: null, proposal: { status: 'approved', decidedBy: 't7b' } } });
        expect((await invoke(await h('approve', 'POST'), { uid: 't7b', params: { orgId: ORG, id: view.proposal.id } })).status).toBe(409);
        const due = await repo.listDueIntents(ORG, new Date('2026-10-05T05:30:00Z'), 10);
        expect(due).toHaveLength(1);
        expect(due[0]).toMatchObject({ purpose: 'academic_talk', proposalId: view.proposal.id, campaignId: null });
    });

    it('rejects thresholds looser than the plan with a plain 400 message, and an adoption without the acknowledgement', async () => {
        const bad = await invoke(await h('rule', 'PUT'), { params: { orgId: ORG, ruleId: 'academic_talk' }, body: { thresholds: { ...DEFAULT_THRESHOLDS.academic_talk, minAssessments: 1 }, adopterName: 'P', acknowledged: true } });
        expect(bad).toMatchObject({ status: 400, body: { error: 'INVALID_THRESHOLDS', message: 'Assessments averaged cannot be below 2' } });
        expect((await invoke(await h('rule', 'PUT'), { params: { orgId: ORG, ruleId: 'academic_talk' }, body: { thresholds: DEFAULT_THRESHOLDS.academic_talk, adopterName: 'P', acknowledged: false } })).status).toBe(400);
        expect((await invoke(await h('rule', 'PUT'), { params: { orgId: ORG, ruleId: 'nope' }, body: { thresholds: {}, adopterName: 'P', acknowledged: true } })).status).toBe(400);
        expect(await rules.listAdoptionHistory(ORG)).toEqual([]);
    });

    it('backtest needs no adoption and reports the child', async () => {
        const res = await invoke(await h('backtest', 'POST'), { params: { orgId: ORG }, body: { weeks: 2, endDate: '2026-10-05' } });
        expect(res.status).toBe(200);
        expect(res.body.results.find((r: { ruleId: string }) => r.ruleId === 'academic_talk').flaggedChildren).toBe(1);
        expect((await invoke(await h('backtest', 'POST'), { params: { orgId: ORG }, body: { thresholds: { academic_talk: { minAssessments: 1 } } } })).status).toBe(400);
        expect(await rules.listProposals(ORG)).toEqual([]);
    });

    it('roles: a class teacher needs a section; the principal can revoke', async () => {
        const bad = await invoke(await h('roles', 'POST'), { params: { orgId: ORG }, body: { uid: 'u', role: 'class_teacher', sections: [] } });
        expect(bad).toMatchObject({ status: 400, body: { error: 'INVALID_ROLE' } });
        await invoke(await h('roles', 'POST'), { params: { orgId: ORG }, body: { uid: 'u', role: 'accounts', sections: [] } });
        expect((await invoke(await h('roles', 'GET'), { params: { orgId: ORG } })).body.roles).toHaveLength(1);
        await invoke(await h('roles', 'DELETE'), { params: { orgId: ORG }, body: { uid: 'u', role: 'accounts' } });
        expect((await invoke(await h('roles', 'GET'), { params: { orgId: ORG } })).body.roles).toEqual([]);
    });

    it('rules with no CRM connected and no fixture say so plainly (409), not a 500', async () => {
        delete process.env.SAMPARK_SIGNALS_FIXTURE;
        const res = await invoke(await h('preview', 'GET'), { params: { orgId: ORG } });
        expect(res).toMatchObject({ status: 409, body: { error: 'NO_REST_CRM' } });
    });
});

describe('POST /api/jobs/sampark-proposals', () => {
    it('404 dark, 503/401 without the cron bearer, 200 with it; only schools with an adopted rule are processed', async () => {
        const job = await h('job', 'POST');
        delete process.env.SAMPARK_ENABLED;
        expect((await invoke(job, { uid: null })).status).toBe(404);
        process.env.SAMPARK_ENABLED = 'true';
        expect((await invoke(job, { uid: null, bearer: 'wrong' })).status).toBe(401);
        const none = await invoke(job, { uid: null, bearer: 'cron-test-secret' });
        expect(none).toMatchObject({ status: 200, body: { schools: 0, created: 0, pages: 0, errors: [] } });
        await invoke(await h('rule', 'PUT'), { params: { orgId: ORG, ruleId: 'academic_talk' }, body: { thresholds: DEFAULT_THRESHOLDS.academic_talk, adopterName: 'P', acknowledged: true } });
        const ran = await invoke(job, { uid: null, bearer: 'cron-test-secret' });
        expect(ran).toMatchObject({ status: 200, body: { schools: 1, created: 1, errors: [] } });
        const again = await invoke(job, { uid: null, bearer: 'cron-test-secret' });
        expect(again.body.created).toBe(0); // create-only
    });
});
