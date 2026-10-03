/** @jest-environment node */
/**
 * POST /api/jobs/sampark-import (R2-5): refuses unless enabled and authorised; per connected school it imports the CRM
 * and then runs the adopted rules over the fresh data; idempotent on re-run; bounded; one failing school never stops
 * the others. The route test runs the REAL REST adapter against a local fake CRM over HTTP.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { ADMIN, crmGuardian, crmStudent, fakeOrgDb, MON_11_IST, ORG, setPhoneEnv, testClock } from '../../sampark/server/_helpers';

const mockOrgDb = fakeOrgDb({ [ORG]: { name: 'Hillview Demo School', adminUserId: ADMIN, isDemoData: true, members: {} } }, { [ADMIN]: { organizationId: ORG } });
jest.mock('@/lib/firebase-admin', () => ({ getDb: async () => mockOrgDb, initializeFirebase: async () => undefined }));

import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { NextResponse } from 'next/server';

import type { CrmSource, SamparkRepo } from '@/lib/sampark/ports';
import { setSamparkClockForTests, setSamparkRepoForTests } from '@/lib/sampark/repo/factory';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { setSamparkRulesRepoForTests } from '@/lib/sampark/rules/factory';
import { createMemoryRulesRepo } from '@/lib/sampark/rules/memory-repo';
import type { SamparkRulesRepo } from '@/lib/sampark/rules/ports';
import { DEFAULT_THRESHOLDS } from '@/lib/sampark/rules/thresholds';
import { CrmFetchError } from '@/lib/sampark/crm/errors';
import type { SamparkSchool } from '@/types/sampark';
import { enableSchool } from '@/server/sampark/school';
import { importJob, IMPORT_LOCK } from '@/server/sampark/import-jobs';
import { adoptRule, type ProposalCtx } from '@/server/sampark/proposals';

const jsonSpy = jest.spyOn(NextResponse, 'json');
type Handler = (req: unknown) => Promise<unknown>;

async function post(handler: Handler, bearer?: string): Promise<{ status: number; body: any }> {
    const headers = new Map<string, string>();
    if (bearer) headers.set('authorization', `Bearer ${bearer}`);
    const req = { headers: { get: (k: string) => headers.get(k.toLowerCase()) ?? null }, nextUrl: new URL('http://localhost/api/jobs/sampark-import'), url: 'http://localhost/api/jobs/sampark-import' };
    jsonSpy.mockClear();
    const res = (await handler(req)) as { status: number };
    const last = jsonSpy.mock.calls[jsonSpy.mock.calls.length - 1];
    if (last) return { status: (last[1] as { status?: number } | undefined)?.status ?? 200, body: last[0] };
    return { status: res.status, body: null };
}

const SPOKEN = { English: 'Hillview School', Hindi: 'हिलव्यू स्कूल', Bengali: 'হিলভিউ স্কুল', Nepali: 'हिलभ्यू स्कूल' };
const GRANTED = { status: 'granted', recordedAt: '2026-06-01T10:00:00+05:30', method: 'office', noticeVersion: 'v1' };
const ASSESSMENTS = [['PT1', '2026-07-20', 83], ['PT2', '2026-08-20', 60], ['HY', '2026-09-20', 39]].map(([id, date, marks]) => ({
    studentId: 's0', assessmentId: id, assessmentName: id, subjectId: 'maths', date, maxMarks: 100, marks, status: 'scored',
}));
const STUDENTS = [crmStudent('s0', { guardians: [{ guardianId: 'g0', isPrimary: true, isGuardianOfRecord: true }] })];
const GUARDIANS = [crmGuardian('g0', { preferredLanguage: 'hi', consent: { notices: GRANTED, progress: GRANTED, recordedConversation: null, hpcInput: null } })];

/** A fake CRM speaking the REST contract; counts requests and can be switched off. */
async function startFakeCrm(): Promise<{ url: string; requests: string[]; down: { value: boolean }; close(): Promise<void> }> {
    const requests: string[] = [];
    const down = { value: false };
    const server = http.createServer((req, res) => {
        requests.push(`${req.method} ${req.url}`);
        const send = (status: number, body: unknown) => {
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify(body));
        };
        if (req.headers.authorization !== 'Bearer fake-crm-key') return send(401, { error: 'unauthorized' });
        if (down.value) return send(503, { error: 'down' });
        const path = new URL(req.url ?? '/', 'http://x').pathname;
        const page = (data: unknown[]) => send(200, { data, nextCursor: null });
        if (path === '/v1/school') return send(200, null);
        if (path === '/v1/students') return page(STUDENTS);
        if (path === '/v1/guardians') return page(GUARDIANS);
        if (path === '/v1/assessments') return page(ASSESSMENTS);
        if (['/v1/hpc/entries', '/v1/attendance', '/v1/meetings', '/v1/incidents'].includes(path)) return page([]);
        return send(404, { error: 'not found' });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    return { url: `http://127.0.0.1:${port}`, requests, down, close: () => new Promise<void>((r) => { server.closeAllConnections?.(); server.close(() => r()); }) };
}

let repo: SamparkRepo;
let rules: SamparkRulesRepo;
let ctx: ProposalCtx;
const ORIGINAL_ENV = { ...process.env };
const clock = testClock(MON_11_IST);

async function routePost(bearer?: string) {
    const mod = await import('@/app/api/jobs/sampark-import/route');
    return post(mod.POST as unknown as Handler, bearer);
}

async function addSchool(orgId: string, crm: SamparkSchool['crm']): Promise<SamparkSchool> {
    const school = await enableSchool({ repo, clock }, orgId, ADMIN, { displayName: orgId, isDemo: true, spokenName: SPOKEN });
    const withCrm = { ...school, crm };
    await repo.upsertSchool(withCrm);
    return withCrm;
}
const rest = (baseUrl: string, lastImportAt: string | null = null): SamparkSchool['crm'] => ({ kind: 'rest', baseUrl, apiKeySecretName: 'MOCK_CRM_API_KEY', lastImportAt, lastImportId: null });

beforeAll(setPhoneEnv);
beforeEach(async () => {
    process.env.SAMPARK_ENABLED = 'true';
    process.env.CRON_SECRET = 'cron-test-secret';
    process.env.MOCK_CRM_API_KEY = 'fake-crm-key';
    delete process.env.SAMPARK_LIVE_DIAL_ENABLED;
    delete process.env.SAMPARK_SIGNALS_FIXTURE;
    repo = createMemorySamparkRepo();
    rules = createMemoryRulesRepo();
    setSamparkRepoForTests(repo);
    setSamparkRulesRepoForTests(rules);
    clock.set(MON_11_IST);
    setSamparkClockForTests(clock);
    ctx = { repo, rules, clock, loadSignals: async () => { throw new Error('unused'); } };
});
afterAll(() => {
    process.env = ORIGINAL_ENV;
    setSamparkRepoForTests(null);
    setSamparkRulesRepoForTests(null);
    setSamparkClockForTests(null);
});

describe('POST /api/jobs/sampark-import — guard order', () => {
    it('404 when SAMPARK_ENABLED is unset (before anything else), 503 without CRON_SECRET, 401 on a wrong or missing bearer', async () => {
        delete process.env.SAMPARK_ENABLED;
        expect((await routePost('cron-test-secret')).status).toBe(404);
        process.env.SAMPARK_ENABLED = 'false';
        expect((await routePost('cron-test-secret')).status).toBe(404);
        process.env.SAMPARK_ENABLED = 'true';
        expect((await routePost()).status).toBe(401);
        expect((await routePost('wrong')).status).toBe(401);
        delete process.env.CRON_SECRET;
        expect((await routePost('anything')).status).toBe(503);
    });

    it('does nothing and reads no CRM when refused', async () => {
        const crm = await startFakeCrm();
        try {
            await addSchool(ORG, rest(crm.url));
            delete process.env.SAMPARK_ENABLED;
            await routePost('cron-test-secret');
            process.env.SAMPARK_ENABLED = 'true';
            await routePost('wrong');
            expect(crm.requests).toEqual([]);
            expect(await repo.getLatestImportRun(ORG)).toBeNull();
        } finally {
            await crm.close();
        }
    });
});

describe('POST /api/jobs/sampark-import — the real REST adapter end to end', () => {
    it('imports the connected school, then runs the adopted rule over the fresh data (proposal created)', async () => {
        const crm = await startFakeCrm();
        try {
            await addSchool(ORG, rest(crm.url));
            const pctx = { ...ctx, loadSignals: (await import('@/server/sampark/proposals-http')).signalsForSchool };
            await adoptRule(pctx, ORG, 'academic_talk', { thresholds: DEFAULT_THRESHOLDS.academic_talk, adopterName: 'The Principal', acknowledged: true }, { uid: ADMIN, isOrgAdmin: true });

            const res = await routePost('cron-test-secret');
            expect(res).toMatchObject({ status: 200, body: { skipped: false, schools: 1, imported: 1, failed: 0, proposalsCreated: 1, errors: [] } });
            expect((await repo.listStudents(ORG)).map((s) => s.id)).toEqual(['s0']);
            expect(await rules.listProposals(ORG)).toHaveLength(1);
            expect((await repo.getSchool(ORG))!.crm!.lastImportAt).toBe(MON_11_IST.toISOString());
            expect((await repo.getLatestImportRun(ORG))).toMatchObject({ status: 'succeeded', startedBy: 'import-job', source: 'rest' });
        } finally {
            await crm.close();
        }
    });
});

/** The imported snapshot without what legitimately changes per run (timestamp, random-IV ciphertext). */
async function snap() {
    return {
        students: (await repo.listStudents(ORG)).map((x) => ({ ...x, importedAt: undefined })),
        guardians: (await repo.listGuardians(ORG)).map((g) => ({ ...g, phoneEnc: undefined, importedAt: undefined })),
        preferences: [...(await repo.getPreferences(ORG, ['g0'])).values()].map((p) => ({ ...p, updatedAt: undefined })),
    };
}

describe('importJob', () => {
    const okSource = (students = STUDENTS, guardians = GUARDIANS): CrmSource => ({
        kind: 'rest',
        fetchSchool: async () => null,
        fetchStudents: async () => students,
        fetchGuardians: async () => guardians,
    });

    it('only schools with a connected CRM (rest or mcp) are imported; csv and no-CRM schools are counted and left alone', async () => {
        await addSchool('rest-school', rest('http://127.0.0.1:1'));
        await addSchool('mcp-school', { kind: 'mcp', baseUrl: 'http://127.0.0.1:2/mcp', apiKeySecretName: 'MOCK_CRM_API_KEY', lastImportAt: null, lastImportId: null });
        await addSchool('csv-school', { kind: 'csv', baseUrl: null, apiKeySecretName: null, lastImportAt: null, lastImportId: null });
        await addSchool('bare-school', null);
        const used: string[] = [];
        const report = await importJob(ctx, { crmSourceFor: async (s) => { used.push(`${s.orgId}:${s.crm!.kind}`); return okSource(); } });
        expect(used.sort()).toEqual(['mcp-school:mcp', 'rest-school:rest']);
        expect(report).toMatchObject({ skipped: false, schools: 2, imported: 2, noCrm: 2, failed: 0, errors: [] });
    });

    it('is idempotent: a re-run inside the interval is a no-op; a forced re-run leaves identical data and no duplicate proposals', async () => {
        await addSchool(ORG, rest('http://127.0.0.1:1'));
        const pctx = { ...ctx, loadSignals: async () => ({ signals: { attendance: [], hpc: [], assessments: ASSESSMENTS, meetings: [], incidents: [], feeDues: [] }, rejected: [] }) } as unknown as ProposalCtx;
        await adoptRule(pctx, ORG, 'academic_talk', { thresholds: DEFAULT_THRESHOLDS.academic_talk, adopterName: 'P', acknowledged: true }, { uid: ADMIN, isOrgAdmin: true });
        let pulls = 0;
        const deps = { crmSourceFor: async () => { pulls++; return okSource(); } };

        const first = await importJob(pctx, deps);
        expect(first).toMatchObject({ imported: 1, proposalsCreated: 1 });
        const before = await snap();

        const again = await importJob(pctx, deps);
        expect(again).toMatchObject({ imported: 0, notDue: 1, proposalsCreated: 0 });
        expect(pulls).toBe(1);

        clock.advance(11 * 60 * 1000); // due again
        const third = await importJob(pctx, deps);
        expect(third).toMatchObject({ imported: 1, notDue: 0, proposalsCreated: 0 }); // proposals are create-only
        expect(pulls).toBe(2);
        expect(await rules.listProposals(ORG)).toHaveLength(1);
        expect(await snap()).toEqual(before);
    });

    it('a failing school does not stop the others, its error is safe, and it is retried next run', async () => {
        const SECRET = 'sk-job-SECRET-77';
        await addSchool('a-down', rest('http://127.0.0.1:1'));
        await addSchool('b-throws', rest('http://127.0.0.1:2'));
        await addSchool('c-bad-config', rest('http://127.0.0.1:3'));
        await addSchool('d-ok', rest('http://127.0.0.1:4'));
        const behaviour: Record<string, () => Promise<CrmSource>> = {
            'a-down': async () => ({ ...okSource(), fetchStudents: async () => { throw new CrmFetchError('CRM responded 503 for /v1/students'); } }),
            'b-throws': async () => { throw new Error(`secret store exploded with ${SECRET}`); },
            'c-bad-config': async () => { const e = new Error('No CRM API key secret is configured for this school'); e.name = 'CrmUrlError'; throw e; },
            'd-ok': async () => okSource(),
        };
        const report = await importJob(ctx, { crmSourceFor: (s) => behaviour[s.orgId]!() });
        expect(report).toMatchObject({ schools: 4, imported: 1, failed: 3 });
        expect(report.errors).toHaveLength(3);
        expect(report.errors.join('\n')).not.toContain(SECRET);
        expect(report.errors).toEqual(expect.arrayContaining([
            'a-down: import failed: CRM responded 503 for /v1/students',
            'b-throws: unexpected error',
            'c-bad-config: No CRM API key secret is configured for this school',
        ]));
        expect((await repo.getSchool('d-ok'))!.crm!.lastImportAt).not.toBeNull();
        expect((await repo.getSchool('a-down'))!.crm!.lastImportAt).toBeNull(); // failure does not advance the clock

        // next run: only the schools that never succeeded are due; a-down recovered
        behaviour['a-down'] = async () => okSource();
        const next = await importJob(ctx, { crmSourceFor: (s) => behaviour[s.orgId]!() });
        expect(next).toMatchObject({ imported: 1, notDue: 1, failed: 2 });
    });

    it('a failed import does not generate proposals from stale data; a proposals failure is reported but the import stands', async () => {
        await addSchool(ORG, rest('http://127.0.0.1:1'));
        const throwing = { ...ctx, loadSignals: async () => { throw new Error('signals exploded'); } } as ProposalCtx;
        await adoptRule(throwing, ORG, 'academic_talk', { thresholds: DEFAULT_THRESHOLDS.academic_talk, adopterName: 'P', acknowledged: true }, { uid: ADMIN, isOrgAdmin: true });
        const report = await importJob(throwing, { crmSourceFor: async () => okSource() });
        expect(report).toMatchObject({ imported: 1, failed: 0, proposalsCreated: 0 });
        expect(report.errors).toEqual([`${ORG}: proposals failed: unexpected error`]);
        expect((await repo.getSchool(ORG))!.crm!.lastImportAt).not.toBeNull();
    });

    it('is single-flight: while another run holds the lease, this one does nothing', async () => {
        await addSchool(ORG, rest('http://127.0.0.1:1'));
        expect(await repo.acquireLock(IMPORT_LOCK, 'someone-else', clock.now(), 60_000)).toBe(true);
        let pulls = 0;
        const report = await importJob(ctx, { crmSourceFor: async () => { pulls++; return okSource(); } });
        expect(report.skipped).toBe(true);
        expect(pulls).toBe(0);
        clock.advance(61_000); // the lease expired
        expect((await importJob(ctx, { crmSourceFor: async () => okSource() })).skipped).toBe(false);
    });

    it('is bounded: at most maxSchoolsPerRun per run, least recently imported first, the rest deferred', async () => {
        await addSchool('s1', rest('http://127.0.0.1:1', '2026-10-05T01:00:00.000Z'));
        await addSchool('s2', rest('http://127.0.0.1:2', null)); // never imported: first
        await addSchool('s3', rest('http://127.0.0.1:3', '2026-10-04T01:00:00.000Z'));
        const order: string[] = [];
        const deps = { options: { maxSchoolsPerRun: 2 }, crmSourceFor: async (s: SamparkSchool) => { order.push(s.orgId); return okSource(); } };
        const report = await importJob(ctx, deps);
        expect(order).toEqual(['s2', 's3']);
        expect(report).toMatchObject({ imported: 2, deferred: 1 });
        const next = await importJob(ctx, deps);
        expect(order.slice(2)).toEqual(['s1']);
        expect(next).toMatchObject({ imported: 1, notDue: 2 });
    });

    it('stops starting new schools once the time budget is spent', async () => {
        await addSchool('s1', rest('http://127.0.0.1:1'));
        await addSchool('s2', rest('http://127.0.0.1:2'));
        const report = await importJob(ctx, {
            options: { timeBudgetMs: 1000 },
            crmSourceFor: async () => { clock.advance(2000); return okSource(); },
        });
        expect(report).toMatchObject({ imported: 1, deferred: 1 });
    });

    it('never places a call or builds a carrier: it only imports and proposes', async () => {
        const src = (await import('node:fs')).readFileSync(require.resolve('@/server/sampark/import-jobs'), 'utf8');
        const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        expect(/from '@\/(lib|server)\/sampark\/(dispatch|carrier)/.test(code) || /\.place\(/.test(code)).toBe(false);
    });
});
