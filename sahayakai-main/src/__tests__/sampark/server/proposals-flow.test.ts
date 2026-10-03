/** @jest-environment node */
/**
 * Slice 2 end to end on the in-memory repos, through the service the routes
 * call: adopt → run rules → proposals routed to the right role → approve →
 * intents → the EXISTING dispatcher places simulated calls only inside the
 * window, at most once, never Fri/Sat for concern purposes, never past a
 * sensitive flag, never more than two fee calls per due; A2 paging.
 * Practice mode only: the only carrier here is the simulated/scripted one.
 */

jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

import { runImport } from '@/lib/sampark/crm/import';
import { runDispatchTick, type DispatchDeps } from '@/lib/sampark/dispatch/dispatcher';
import { istInstant } from '@/lib/sampark/policy/ist';
import type { CrmSource } from '@/lib/sampark/ports';
import { createMemorySamparkRepo } from '@/lib/sampark/repo/memory';
import { createMemoryRulesRepo } from '@/lib/sampark/rules/memory-repo';
import type { CrmSignals } from '@/lib/sampark/rules/signals';
import { RULE_IDS } from '@/lib/sampark/rules/types';
import { DEFAULT_THRESHOLDS } from '@/lib/sampark/rules/thresholds';
import { dispatchJob } from '@/server/sampark/jobs';
import { enableSchool } from '@/server/sampark/school';
import {
    acknowledgePage,
    adoptRule,
    approveProposal,
    backtestSchool,
    confirmClassAbsences,
    dismissProposal,
    grantRole,
    handleProposalMyself,
    listProposalViews,
    listRules,
    previewRules,
    processAbsencePages,
    runRules,
    withdrawRule,
    type ProposalCtx,
} from '@/server/sampark/proposals';
import type { Intent } from '@/types/sampark';

import { scriptedCarrier } from '../engine/_fixtures';
import { due, marks, note, schoolDays, score, signals as sig } from '../rules/_build';
import { ADMIN, CRM_SCHOOL, crmConsent, crmGuardian, crmStudent, ORG, setPhoneEnv, testClock } from './_helpers';

beforeAll(setPhoneEnv);

const SPOKEN = { English: 'Hillview School', Hindi: 'हिलव्यू स्कूल', Bengali: 'হিলভিউ স্কুল', Nepali: 'हिलभ्यू स्कूल' };
const MON = new Date('2026-10-05T05:30:00Z'); // Mon 11:00 IST
const DAYS = schoolDays(10, '2026-10-05');
const PRINCIPAL = { uid: ADMIN, isOrgAdmin: true };
const T7B = { uid: 't7b', isOrgAdmin: false };
const T4A = { uid: 't4a', isOrgAdmin: false };
const ACCT = { uid: 'acct', isOrgAdmin: false };
const COORD = { uid: 'coord', isOrgAdmin: false };
const NOBODY = { uid: 'nobody', isOrgAdmin: false };

const consent = { notices: crmConsent('granted'), progress: crmConsent('granted'), recordedConversation: null, hpcInput: null };
const link = (g: string) => [{ guardianId: g, isPrimary: true, isGuardianOfRecord: true }];

function crm(): CrmSource {
    const student = (id: string, over: Record<string, unknown> = {}) => crmStudent(id, { section: 'B', guardians: link(`g-${id}`), ...over });
    const students = [
        student('s-abs'), // A1 streak + A2 absent today
        student('s-acad'), // A3 sustained drop
        student('s-cond'), // A4
        student('s-fee'), // C1
        student('s-over'), // C2
        student('s-flag', { sensitiveFlags: ['counsellor_referral'] }), // would trip everything; suppressed
        student('s-rte', { feeCategory: 'rte' }),
        student('s-other', { section: 'A' }), // 7A: a different class teacher
        student('s-noname', { spokenFirstName: { en: 'Noor', hi: 'नूर' } }), // no Nepali name
    ];
    const guardians = students.map((s) =>
        crmGuardian(`g-${s.id as string}`, { preferredLanguage: s.id === 's-noname' ? 'ne' : s.id === 's-acad' ? 'hi' : 'ne', consent }),
    );
    return { kind: 'rest', fetchSchool: async () => CRM_SCHOOL, fetchStudents: async () => students, fetchGuardians: async () => guardians };
}

function signalsFor(): CrmSignals {
    const attendance = [
        ...marks('s-abs', DAYS, (i) => (i >= 6 ? 'absent' : 'present')), // 4 days absent ending today (Mon 10-05)
        ...marks('s-flag', DAYS, (i) => (i >= 6 ? 'absent' : 'present')),
        ...marks('s-other', DAYS, (i) => (i >= 6 ? 'absent' : 'present')),
        ...marks('s-noname', DAYS, (i) => (i >= 6 ? 'absent' : 'present')),
        ...['s-acad', 's-cond', 's-fee', 's-over', 's-rte'].flatMap((id) => marks(id, DAYS, () => 'present')),
    ];
    return sig({
        attendance,
        assessments: [
            ...['s-acad', 's-flag', 's-noname'].flatMap((id) => [score(id, 'PT1', '2026-07-20', 83), score(id, 'PT2', '2026-08-20', 60), score(id, 'HY', '2026-09-20', 39)]),
        ],
        hpc: [
            note('c1', 's-cond', { sentiment: 'concern', observedOn: '2026-10-01', note: 'pushed juniors in the lunch queue' }),
            note('c2', 's-cond', { sentiment: 'concern', respondentType: 'bus_attendant', observedOn: '2026-10-02', note: 'second incident on the bus' }),
            note('k1', 's-flag', { respondentType: 'counsellor', confidential: true, note: null, reasonCode: 'counselling_session' }),
        ],
        feeDues: [
            due('d-fee', 's-fee', '2026-10-09'), // due in 4 days → C1
            due('d-over', 's-over', '2026-10-01'), // 4 days overdue → C2
            due('d-rte', 's-rte', '2026-10-09'),
            due('d-flag', 's-flag', '2026-10-09'),
        ],
    });
}

async function setup(start: Date = MON, signals: CrmSignals = signalsFor()) {
    const clock = testClock(start);
    const repo = createMemorySamparkRepo();
    const rules = createMemoryRulesRepo();
    const ctx: ProposalCtx = { repo, rules, clock, loadSignals: async () => ({ signals, rejected: [] }) };
    await enableSchool({ repo, clock }, ORG, ADMIN, { displayName: 'Hillview Demo School', isDemo: true, spokenName: SPOKEN });
    expect((await runImport({ repo, clock }, ORG, crm(), ADMIN)).status).toBe('succeeded');
    await grantRole(ctx, ORG, { uid: 't7b', role: 'class_teacher', sections: [{ grade: 7, section: 'B' }], displayName: 'Mrs Rai' }, ADMIN);
    await grantRole(ctx, ORG, { uid: 't4a', role: 'class_teacher', sections: [{ grade: 4, section: 'A' }], displayName: 'Mr Lama' }, ADMIN);
    await grantRole(ctx, ORG, { uid: 'coord', role: 'coordinator', sections: [], displayName: 'Coordinator' }, ADMIN);
    await grantRole(ctx, ORG, { uid: 'acct', role: 'accounts', sections: [], displayName: 'Accounts' }, ADMIN);
    return { clock, repo, rules, ctx };
}
type Env = Awaited<ReturnType<typeof setup>>;

async function adoptAll(env: Env, which: readonly string[] = RULE_IDS) {
    for (const rule of which) {
        await adoptRule(env.ctx, ORG, rule, { thresholds: DEFAULT_THRESHOLDS[rule as keyof typeof DEFAULT_THRESHOLDS], adopterName: 'The Principal', acknowledged: true }, PRINCIPAL);
    }
}

/** The existing dispatcher, with a scripted simulated carrier. */
function dispatchDeps(env: Env, fate: Parameters<typeof scriptedCarrier>[0] = () => 'full') {
    const carrier = scriptedCarrier(fate);
    const deps: DispatchDeps = {
        repo: env.repo,
        clock: env.clock,
        holder: 'test',
        carrierFor: () => carrier,
        destinationFor: async () => '+915000000000',
        audioSecondsFor: async () => 30,
    };
    return { carrier, tick: () => runDispatchTick(deps, { maxDialsPerSchoolPerTick: 50, maxInFlightPerSchool: 50, leaseMs: 120_000 }) };
}

async function proposalFor(env: Env, studentId: string, purpose: string) {
    const all = await env.rules.listProposals(ORG);
    return all.find((p) => p.studentId === studentId && p.purpose === purpose);
}
const intentsOf = async (env: Env, proposalId: string): Promise<Intent[]> => {
    const p = (await env.rules.getProposal(ORG, proposalId))!;
    return (await Promise.all(p.intentIds.map((id) => env.repo.getIntent(ORG, id)))).filter((i): i is Intent => !!i);
};

describe('adoption: rules ship off, and the school adopts each with thresholds in writing', () => {
    it('nothing is proposed until a rule is adopted', async () => {
        const env = await setup();
        const run = await runRules(env.ctx, ORG);
        expect(run).toMatchObject({ created: 0, evaluated: [] });
        expect(run.inert).toHaveLength(7);
        expect(await env.rules.listProposals(ORG)).toEqual([]);
        const { rules } = await listRules(env.ctx, ORG);
        expect(rules.every((r) => !r.adopted)).toBe(true);
        expect(rules.map((r) => r.approver)).toEqual(['class_teacher', 'class_teacher', 'class_teacher', 'coordinator', 'class_teacher', 'accounts', 'accounts']);
    });

    it('stores who, when and with what thresholds, as an append-only history', async () => {
        const env = await setup();
        const a = await adoptRule(env.ctx, ORG, 'attendance_talk', { thresholds: { ...DEFAULT_THRESHOLDS.attendance_talk, minConsecutiveAbsentDays: 4 }, adopterName: ' Dr Rai ', acknowledged: true }, PRINCIPAL);
        expect(a).toMatchObject({ ruleId: 'attendance_talk', version: 1, status: 'adopted', adoptedBy: ADMIN, adopterName: 'Dr Rai', statementVersion: 'v1' });
        expect(a.thresholds).toMatchObject({ minConsecutiveAbsentDays: 4 });
        expect(Date.parse(a.adoptedAt)).toBe(MON.getTime());
        const b = await adoptRule(env.ctx, ORG, 'attendance_talk', { thresholds: DEFAULT_THRESHOLDS.attendance_talk, adopterName: 'Dr Rai', acknowledged: true }, PRINCIPAL);
        expect(b.version).toBe(2);
        expect((await env.rules.listAdoptionHistory(ORG)).map((x) => x.version)).toEqual([1, 2]);
        expect((await listRules(env.ctx, ORG)).rules.find((r) => r.ruleId === 'attendance_talk')).toMatchObject({ adopted: true, version: 2 });
        expect((await env.repo.listSchools()).length).toBe(1);
    });

    it('refuses an adoption that is not the principal\'s, not acknowledged, unnamed, or looser than the plan floors', async () => {
        const env = await setup();
        const ok = { thresholds: DEFAULT_THRESHOLDS.attendance_talk, adopterName: 'P', acknowledged: true };
        await expect(adoptRule(env.ctx, ORG, 'attendance_talk', ok, COORD)).rejects.toMatchObject({ code: 'ADOPTION_FORBIDDEN', status: 403 });
        await expect(adoptRule(env.ctx, ORG, 'attendance_talk', { ...ok, acknowledged: false }, PRINCIPAL)).rejects.toMatchObject({ code: 'ADOPTION_NOT_ACKNOWLEDGED' });
        await expect(adoptRule(env.ctx, ORG, 'attendance_talk', { ...ok, adopterName: '  ' }, PRINCIPAL)).rejects.toMatchObject({ code: 'ADOPTER_NAME_REQUIRED' });
        await expect(adoptRule(env.ctx, ORG, 'attendance_talk', { ...ok, thresholds: { ...DEFAULT_THRESHOLDS.attendance_talk, minConsecutiveAbsentDays: 2 } }, PRINCIPAL)).rejects.toMatchObject({ code: 'INVALID_THRESHOLDS', message: 'Consecutive school days absent cannot be below 3' });
        await expect(adoptRule(env.ctx, ORG, 'not_a_rule', ok, PRINCIPAL)).rejects.toMatchObject({ code: 'UNKNOWN_RULE' });
        expect(await env.rules.listAdoptionHistory(ORG)).toEqual([]);
    });

    it('withdrawing a rule makes it inert and expires what was waiting on it', async () => {
        const env = await setup();
        await adoptAll(env, ['academic_talk']);
        await runRules(env.ctx, ORG);
        expect((await proposalFor(env, 's-acad', 'academic_talk'))?.status).toBe('pending');
        await withdrawRule(env.ctx, ORG, 'academic_talk', PRINCIPAL);
        expect((await proposalFor(env, 's-acad', 'academic_talk'))).toMatchObject({ status: 'expired', decisionNote: 'The rule was withdrawn.' });
        expect(await runRules(env.ctx, ORG)).toMatchObject({ created: 0, evaluated: [] });
    });
});

describe('proposals: routed to the right person, each with evidence', () => {
    it('creates one proposal per child and rule, with evidence, routing and no intents yet', async () => {
        const env = await setup();
        await adoptAll(env);
        const run = await runRules(env.ctx, ORG);
        expect(run.created).toBeGreaterThanOrEqual(6);
        const byKey = Object.fromEntries((await env.rules.listProposals(ORG)).map((p) => [`${p.purpose}:${p.studentId}`, p]));
        expect(Object.keys(byKey)).toEqual(expect.arrayContaining(['attendance_talk:s-abs', 'academic_talk:s-acad', 'conduct_talk:s-cond', 'fee_due:s-fee', 'fee_overdue:s-over']));
        for (const p of Object.values(byKey)) {
            expect(p.status).toBe('pending');
            expect(p.evidence.length).toBeGreaterThan(0);
            expect(p.intentIds).toEqual([]);
            expect(p.adoptionVersion).toBe(1);
        }
        expect(byKey['conduct_talk:s-cond'].approverRole).toBe('coordinator');
        expect(byKey['conduct_talk:s-cond'].evidence.map((e) => e.text).join(' ')).toMatch(/pushed juniors in the lunch queue/);
        expect(byKey['fee_due:s-fee']).toMatchObject({ approverRole: 'accounts', facts: { kind: 'fee', amountRupees: 12500, dueDate: '2026-10-09' } });
        // 7A has no class teacher beyond t7b/t4a: routed to the principal with a plain note
        expect(byKey['attendance_talk:s-other'].routingNote).toBe('No class teacher is assigned for 7A; this is routed to the principal.');
        expect(await env.repo.listDueIntents(ORG, MON, 100)).toEqual([]);
    });

    it('is idempotent: running again creates nothing new', async () => {
        const env = await setup();
        await adoptAll(env);
        const first = await runRules(env.ctx, ORG);
        const second = await runRules(env.ctx, ORG);
        expect(second.created).toBe(0);
        expect(second.existing).toBe(first.created);
        expect(await env.rules.listProposals(ORG)).toHaveLength(first.created);
    });

    it('every excluded child comes back with a plain reason: flagged, RTE, no confirmation yet', async () => {
        const env = await setup();
        await adoptAll(env);
        const run = await runRules(env.ctx, ORG);
        const reasons = new Map(run.excluded.map((e) => [`${e.purpose}:${e.studentId}`, e]));
        expect(reasons.get('academic_talk:s-flag')).toMatchObject({ code: 'sensitive_flag', studentName: 'Student s-flag' });
        expect(reasons.get('academic_talk:s-flag')!.plain).toMatch(/counsellor referral/);
        expect(reasons.get('fee_due:s-rte')).toMatchObject({ code: 'fee_category_rte' });
        expect(reasons.get('absence_today:s-abs')).toMatchObject({ code: 'awaiting_class_confirmation' });
        for (const e of run.excluded) expect(e.plain.length).toBeGreaterThan(20);
        // and nothing was proposed for the flagged child, at all
        expect((await env.rules.listProposalsForStudent(ORG, 's-flag'))).toEqual([]);
        const preview = await previewRules(env.ctx, ORG);
        expect(preview.excluded.length).toBe(run.excluded.length);
    });

    it('a person sees only their own queue', async () => {
        const env = await setup();
        await adoptAll(env);
        await runRules(env.ctx, ORG);
        const names = async (who: { uid: string; isOrgAdmin: boolean }) => (await listProposalViews(env.ctx, ORG, who)).map((v) => `${v.proposal.purpose}:${v.proposal.studentId}`).sort();
        expect(await names(T7B)).toEqual(['academic_talk:s-acad', 'academic_talk:s-noname', 'attendance_talk:s-abs', 'attendance_talk:s-noname']);
        expect(await names(T4A)).toEqual([]);
        expect(await names(ACCT)).toEqual(['fee_due:s-fee', 'fee_overdue:s-over']);
        expect(await names(COORD)).toEqual(['conduct_talk:s-cond']);
        expect(await names(NOBODY)).toEqual([]);
        expect((await names(PRINCIPAL)).length).toBeGreaterThanOrEqual(7);
    });

    it('shows the approver what the parent will hear, in four languages, listener check first', async () => {
        const env = await setup();
        await adoptAll(env, ['academic_talk']);
        await runRules(env.ctx, ORG);
        const [view] = await listProposalViews(env.ctx, ORG, T7B);
        expect(view.previews.map((p) => p.language)).toEqual(['English', 'Hindi', 'Bengali', 'Nepali']);
        for (const p of view.previews) {
            expect(p.problem).toBeNull();
            expect(p.clips![0].kind).toBe('listener_check');
            expect(p.clips![1].kind).toBe('message');
        }
        expect(view.previews[0].clips![1].text).not.toMatch(/\b(marks|score|fell|drop|fail|low)\b/i);
    });
});

describe('approval: who may approve, then intents the existing dispatcher dials', () => {
    it('only the section\'s class teacher, or the principal, may approve; others get a plain 403', async () => {
        const env = await setup();
        await adoptAll(env, ['academic_talk']);
        await runRules(env.ctx, ORG);
        const p = (await proposalFor(env, 's-acad', 'academic_talk'))!;
        for (const who of [T4A, COORD, ACCT, NOBODY]) {
            await expect(approveProposal(env.ctx, ORG, p.id, who)).rejects.toMatchObject({ code: 'APPROVAL_FORBIDDEN', status: 403 });
        }
        expect((await env.rules.getProposal(ORG, p.id))!.status).toBe('pending');
        const out = await approveProposal(env.ctx, ORG, p.id, T7B);
        expect(out.proposal).toMatchObject({ status: 'approved', decidedBy: 't7b' });
        expect(out.dialable).toBe(1);
        await expect(approveProposal(env.ctx, ORG, p.id, T7B)).rejects.toMatchObject({ code: 'PROPOSAL_NOT_PENDING', status: 409 });
    });

    it('creates ONE create-only intent per guardian of record, tied to the proposal, never a campaign', async () => {
        const env = await setup();
        await adoptAll(env, ['academic_talk']);
        await runRules(env.ctx, ORG);
        const p = (await proposalFor(env, 's-acad', 'academic_talk'))!;
        await approveProposal(env.ctx, ORG, p.id, T7B);
        const [intent] = await intentsOf(env, p.id);
        expect(intent).toMatchObject({ purpose: 'academic_talk', campaignId: null, proposalId: p.id, guardianId: 'g-s-acad', studentIds: ['s-acad'], language: 'Hindi', status: 'approved', maxAttempts: 3, expiresAt: p.expiresAt });
        // re-materialising can never duplicate it (create-only)
        expect(await env.repo.createIntentIfAbsent({ ...intent, status: 'cancelled' })).toBe(false);
    });

    it('the dispatcher places the simulated call inside the window, once, and records it', async () => {
        const env = await setup();
        await adoptAll(env, ['academic_talk']);
        await runRules(env.ctx, ORG);
        const p = (await proposalFor(env, 's-acad', 'academic_talk'))!;
        await approveProposal(env.ctx, ORG, p.id, T7B);
        const { carrier, tick } = dispatchDeps(env, () => 'key1');
        const report = await tick();
        expect(report).toMatchObject({ dialed: 1, errors: [] });
        expect(carrier.requests).toHaveLength(1);
        expect(carrier.requests[0].call).toMatchObject({ purpose: 'academic_talk', carrier: 'simulated', language: 'Hindi', campaignId: null });
        expect(carrier.requests[0].call.carrier).toBe('simulated');
        const again = await tick();
        expect(again.dialed).toBe(0);
        expect(carrier.requests).toHaveLength(1); // at most once
        expect(await env.repo.listCalls(ORG, { limit: 10 })).toHaveLength(1);
    });

    it('the production job path (dispatchJob with the real simulated carrier) places proposal intents too, and only simulated', async () => {
        const env = await setup();
        await adoptAll(env, ['academic_talk', 'fee_due']);
        await runRules(env.ctx, ORG);
        for (const [studentId, purpose, who] of [['s-acad', 'academic_talk', T7B], ['s-fee', 'fee_due', ACCT]] as const) {
            await approveProposal(env.ctx, ORG, (await proposalFor(env, studentId, purpose))!.id, who);
        }
        const report = await dispatchJob({ repo: env.repo, clock: env.clock });
        expect(report).toMatchObject({ dialed: 2, errors: [] });
        const calls = await env.repo.listCalls(ORG, { limit: 10 });
        expect(calls.map((c) => c.purpose).sort()).toEqual(['academic_talk', 'fee_due']);
        for (const c of calls) {
            expect(c.carrier).toBe('simulated');
            expect(c.campaignId).toBeNull();
            expect(['completed', 'no_answer', 'busy', 'failed']).toContain(c.state);
        }
        // and the school is in practice mode: a non-practice mode makes the same intents unreachable
        const school = (await env.repo.getSchool(ORG))!;
        await env.repo.upsertSchool({ ...school, mode: 'live' });
        expect((await dispatchJob({ repo: env.repo, clock: env.clock })).dialed).toBe(0);
    });

    it('a crash right after the claim never produces a second dial', async () => {
        const clock = testClock(MON);
        const repo = createMemorySamparkRepo({ faults: { failAfterClaim: () => true } });
        const rules = createMemoryRulesRepo();
        const ctx: ProposalCtx = { repo, rules, clock, loadSignals: async () => ({ signals: signalsFor(), rejected: [] }) };
        await enableSchool({ repo, clock }, ORG, ADMIN, { displayName: 'Hillview', isDemo: true, spokenName: SPOKEN });
        await runImport({ repo, clock }, ORG, crm(), ADMIN);
        await grantRole(ctx, ORG, { uid: 't7b', role: 'class_teacher', sections: [{ grade: 7, section: 'B' }], displayName: 'T' }, ADMIN);
        await adoptRule(ctx, ORG, 'academic_talk', { thresholds: DEFAULT_THRESHOLDS.academic_talk, adopterName: 'P', acknowledged: true }, PRINCIPAL);
        await runRules(ctx, ORG);
        const p = (await rules.listProposals(ORG))[0];
        await approveProposal(ctx, ORG, p.id, T7B);
        const env = { repo, rules, clock, ctx } as Env;
        const { carrier, tick } = dispatchDeps(env);
        await tick();
        clock.advance(10 * 60_000);
        await tick();
        clock.advance(60 * 60_000);
        await tick();
        expect(carrier.requests).toHaveLength(0); // the carrier was never contacted twice; here not even once
        const calls = await repo.listCalls(ORG, { limit: 10 });
        expect(calls.length).toBe(1); // exactly one claimed attempt, handed to a person
    });

    it('the gate refuses a rule-driven intent that does not come from an approved proposal', async () => {
        const env = await setup();
        await adoptAll(env, ['academic_talk']);
        const forged: Intent = {
            id: 'forged-intent', dedupeKey: 'forged', orgId: ORG, campaignId: null, purpose: 'academic_talk', guardianId: 'g-s-acad', studentIds: ['s-acad'],
            language: 'Hindi', status: 'approved', blockReason: null, attempts: 0, maxAttempts: 3, notBefore: null, expiresAt: '2026-12-31T00:00:00.000Z', lastCallId: null,
            createdAt: MON.toISOString(), updatedAt: MON.toISOString(),
        };
        await env.repo.createIntentIfAbsent(forged);
        const { carrier, tick } = dispatchDeps(env);
        expect(await tick()).toMatchObject({ dialed: 0, blocked: 1 });
        expect(carrier.requests).toHaveLength(0);
        expect(await env.repo.getIntent(ORG, 'forged-intent')).toMatchObject({ status: 'blocked', blockReason: 'purpose_not_available' });
    });

    it('dismiss and "I\'ll call myself" close a proposal for good: running the rules again cannot resurrect it', async () => {
        const env = await setup();
        await adoptAll(env, ['attendance_talk', 'academic_talk']);
        await runRules(env.ctx, ORG);
        const a = (await proposalFor(env, 's-abs', 'attendance_talk'))!;
        const b = (await proposalFor(env, 's-acad', 'academic_talk'))!;
        expect((await dismissProposal(env.ctx, ORG, a.id, T7B, 'not now')).status).toBe('dismissed');
        expect((await handleProposalMyself(env.ctx, ORG, b.id, T7B)).status).toBe('handled_by_person');
        const rerun = await runRules(env.ctx, ORG);
        expect(rerun.created).toBe(0);
        expect((await env.rules.getProposal(ORG, a.id))!.status).toBe('dismissed');
        await expect(approveProposal(env.ctx, ORG, a.id, T7B)).rejects.toMatchObject({ code: 'PROPOSAL_NOT_PENDING' });
        expect(await env.repo.listDueIntents(ORG, MON, 100)).toEqual([]);
    });

    it('every approval is audited with who, what and by what route', async () => {
        const env = await setup();
        await adoptAll(env, ['conduct_talk']);
        await runRules(env.ctx, ORG);
        const p = (await proposalFor(env, 's-cond', 'conduct_talk'))!;
        const audit = jest.spyOn(env.repo, 'appendAudit');
        await approveProposal(env.ctx, ORG, p.id, PRINCIPAL); // principal override of the coordinator's work
        const entry = audit.mock.calls.map((c) => c[1]).find((e) => e.action === 'proposal.approve')!;
        expect(entry).toMatchObject({ actor: ADMIN, target: `proposal/${p.id}`, detail: { purpose: 'conduct_talk', studentId: 's-cond', via: 'org_admin_override', intents: 1 } });
        expect(entry.detail?.evidence).toEqual(['note', 'note']);
        expect(await env.rules.getProposal(ORG, p.id)).toMatchObject({ status: 'approved', decidedBy: ADMIN });
    });
});

describe('concern purposes are never scheduled on a Friday or Saturday (IST)', () => {
    it('approved on a Friday, the call waits for Monday 10:00 and nothing is dialled on Friday or Saturday', async () => {
        const env = await setup();
        await adoptAll(env, ['academic_talk']);
        await runRules(env.ctx, ORG); // Monday
        const p = (await proposalFor(env, 's-acad', 'academic_talk'))!;
        env.clock.set(istInstant('2026-10-09', 11, 0)); // Friday 11:00 IST, inside the proposal's 7 days
        const out = await approveProposal(env.ctx, ORG, p.id, T7B);
        const [intent] = await intentsOf(env, p.id);
        expect(intent.notBefore).toBe(istInstant('2026-10-12', 10, 0).toISOString());
        expect(out.proposal.notBefore).toBe(intent.notBefore);
        const { carrier, tick } = dispatchDeps(env);
        expect((await tick()).dialed).toBe(0); // Friday 11:00
        env.clock.set(istInstant('2026-10-10', 12, 0)); // Saturday
        expect((await tick()).dialed).toBe(0);
        env.clock.set(istInstant('2026-10-11', 12, 0)); // Sunday (off-day)
        expect((await tick()).dialed).toBe(0);
        env.clock.set(istInstant('2026-10-12', 10, 30)); // Monday
        expect((await tick()).dialed).toBe(0 + 1);
        expect(carrier.requests).toHaveLength(1);
    });
    it('even a school with no off-day never gets a concern call on Fri/Sat', async () => {
        const env = await setup();
        const school = (await env.repo.getSchool(ORG))!;
        await env.repo.upsertSchool({ ...school, callingWindow: { startHour: 10, endHour: 20, offDays: [] } });
        await adoptAll(env, ['attendance_talk']);
        await runRules(env.ctx, ORG);
        const p = (await proposalFor(env, 's-abs', 'attendance_talk'))!;
        env.clock.set(istInstant('2026-10-09', 11, 0));
        await approveProposal(env.ctx, ORG, p.id, T7B);
        const { carrier, tick } = dispatchDeps(env);
        for (const day of ['2026-10-09', '2026-10-10']) {
            for (const hour of [10, 12, 15, 19]) {
                env.clock.set(istInstant(day, hour, 15));
                await tick();
            }
        }
        expect(carrier.requests).toHaveLength(0);
        env.clock.set(istInstant('2026-10-11', 10, 15)); // Sunday is open for this school
        await tick();
        expect(carrier.requests).toHaveLength(1);
    });
});

describe('sensitive flags and consent hold at the gate even when a proposal exists', () => {
    it('a proposal forced in for a flagged child yields blocked intents and a plain "please phone" note', async () => {
        const env = await setup();
        await adoptAll(env, ['academic_talk']);
        await runRules(env.ctx, ORG);
        // Bypass the rule layer on purpose: a stale proposal for a child flagged AFTER it was made.
        const stale = (await proposalFor(env, 's-acad', 'academic_talk'))!;
        const students = await env.repo.listStudents(ORG);
        await env.repo.upsertStudents(ORG, students.filter((s) => s.id === 's-acad').map((s) => ({ ...s, sensitiveFlags: ['custody_restriction' as const] })));
        const out = await approveProposal(env.ctx, ORG, stale.id, T7B);
        expect(out.dialable).toBe(0);
        expect(out.proposal.status).toBe('needs_attention');
        expect(out.needsAttention).toMatch(/No parent can be called automatically\./);
        expect(out.needsAttention).toMatch(/belongs to a child with a sensitive flag/);
        expect(out.needsAttention).toMatch(/Please phone the family\./);
        const { carrier, tick } = dispatchDeps(env);
        await tick();
        expect(carrier.requests).toHaveLength(0);
    });
    it('a child with no reviewed spoken name in the parent\'s language needs a person, and no intent exists', async () => {
        const env = await setup();
        await adoptAll(env, ['academic_talk']);
        await runRules(env.ctx, ORG);
        const p = (await proposalFor(env, 's-noname', 'academic_talk'))!;
        const out = await approveProposal(env.ctx, ORG, p.id, PRINCIPAL);
        expect(out.proposal.status).toBe('needs_attention');
        expect(out.needsAttention).toMatch(/no reviewed spoken first name for this child in Nepali/);
        expect(out.proposal.intentIds).toEqual([]);
    });
    it('a guardian who has not consented to progress calls is blocked with a plain reason', async () => {
        const env = await setup();
        await adoptAll(env, ['academic_talk']);
        await runRules(env.ctx, ORG);
        const p = (await proposalFor(env, 's-acad', 'academic_talk'))!;
        const prefs = (await env.repo.getPreferences(ORG, ['g-s-acad'])).get('g-s-acad')!;
        await env.repo.upsertPreferences([{ ...prefs, consent: { ...prefs.consent, progress: { ...prefs.consent.progress, status: 'denied' } } }]);
        const out = await approveProposal(env.ctx, ORG, p.id, T7B);
        expect(out.proposal.status).toBe('needs_attention');
        expect(out.blocked[0].plain).toBe('Guardian g-s-acad has said no to these calls.');
    });
});

describe('fees: the accounts role, the 10:00-19:00 window and two calls per due', () => {
    it('C1 goes to accounts and is dialled only between 10:00 and 19:00 IST', async () => {
        const env = await setup();
        await adoptAll(env, ['fee_due']);
        await runRules(env.ctx, ORG);
        const p = (await proposalFor(env, 's-fee', 'fee_due'))!;
        await expect(approveProposal(env.ctx, ORG, p.id, T7B)).rejects.toMatchObject({ status: 403 });
        await approveProposal(env.ctx, ORG, p.id, ACCT);
        const { carrier, tick } = dispatchDeps(env);
        env.clock.set(istInstant('2026-10-05', 19, 30));
        expect((await tick()).dialed).toBe(0);
        // deferred to the next opening (Tuesday 10:00): nothing before it, the call after it
        env.clock.set(istInstant('2026-10-06', 9, 45));
        expect((await tick()).dialed).toBe(0);
        env.clock.set(istInstant('2026-10-06', 18, 30));
        expect((await tick()).dialed).toBe(1);
        expect(carrier.requests[0].call.purpose).toBe('fee_due');
    });
    it('never more than two automated calls per due, across C1 and C2', async () => {
        const env = await setup();
        await adoptAll(env, ['fee_due', 'fee_overdue']);
        // The same due is "due in 4 days" on Monday and "overdue" a fortnight later.
        const signals = signalsFor();
        signals.feeDues = [due('d-x', 's-fee', '2026-10-09')];
        (env.ctx as { loadSignals: ProposalCtx['loadSignals'] }).loadSignals = async () => ({ signals, rejected: [] });
        await runRules(env.ctx, ORG);
        const c1 = (await proposalFor(env, 's-fee', 'fee_due'))!;
        await approveProposal(env.ctx, ORG, c1.id, ACCT);
        const [intent] = await intentsOf(env, c1.id);
        expect(intent.maxAttempts).toBe(2);
        const { carrier, tick } = dispatchDeps(env, () => 'no_answer');
        await tick(); // attempt 1
        env.clock.advance(3 * 3_600_000); // after the retry wait
        await tick(); // attempt 2
        env.clock.advance(3 * 3_600_000);
        await tick();
        expect(carrier.requests).toHaveLength(2);
        expect((await env.repo.getIntent(ORG, intent.id))).toMatchObject({ status: 'done', attempts: 2 });
        // the due is now overdue; C2 is not even proposed (budget spent), and says why
        env.clock.set(istInstant('2026-10-14', 11, 0));
        const run = await runRules(env.ctx, ORG);
        expect(await proposalFor(env, 's-fee', 'fee_overdue')).toBeUndefined();
        expect(run.excluded.find((e) => e.purpose === 'fee_overdue' && e.studentId === 's-fee')).toMatchObject({ code: 'fee_call_budget_spent' });
    });
    it('C2 approved after one C1 call leaves exactly one call for the due', async () => {
        const env = await setup();
        await adoptAll(env, ['fee_due', 'fee_overdue']);
        const signals = signalsFor();
        signals.feeDues = [due('d-y', 's-fee', '2026-10-09')];
        (env.ctx as { loadSignals: ProposalCtx['loadSignals'] }).loadSignals = async () => ({ signals, rejected: [] });
        await runRules(env.ctx, ORG);
        const c1 = (await proposalFor(env, 's-fee', 'fee_due'))!;
        await approveProposal(env.ctx, ORG, c1.id, ACCT);
        const { tick } = dispatchDeps(env, () => 'no_answer');
        await tick(); // C1 attempt 1 rings out; the intent waits to retry (reserving its second call)
        env.clock.set(istInstant('2026-10-14', 11, 0));
        // reserved capacity counts: the due has spent/held its two calls, so C2 cannot be set up
        await runRules(env.ctx, ORG);
        expect(await proposalFor(env, 's-fee', 'fee_overdue')).toBeUndefined();
    });
});

describe('A2: same-day absence, the class teacher\'s tap, and paging', () => {
    async function absenceEnv(fate: Parameters<typeof scriptedCarrier>[0]) {
        const env = await setup();
        await adoptAll(env, ['absence_today']);
        expect((await runRules(env.ctx, ORG)).created).toBe(0); // nothing without the confirmation
        expect(await env.repo.listDueIntents(ORG, MON, 10)).toEqual([]);
        const tap = await confirmClassAbsences(env.ctx, ORG, { grade: 7, section: 'B' }, T7B);
        expect(tap.confirmed).toBe(true);
        const d = dispatchDeps(env, fate);
        return { env, ...d };
    }

    it('only the class teacher of that class (or the principal) can confirm, and only once the rule is adopted', async () => {
        const env = await setup();
        await expect(confirmClassAbsences(env.ctx, ORG, { grade: 7, section: 'B' }, T7B)).rejects.toMatchObject({ code: 'RULE_NOT_ADOPTED' });
        await adoptAll(env, ['absence_today']);
        await expect(confirmClassAbsences(env.ctx, ORG, { grade: 7, section: 'B' }, T4A)).rejects.toMatchObject({ status: 403 });
        await expect(confirmClassAbsences(env.ctx, ORG, { grade: 7, section: 'B' }, NOBODY)).rejects.toMatchObject({ status: 403 });
    });

    it('the tap IS the approval: proposals for that class are approved, 7A\'s are not created, and a second tap changes nothing', async () => {
        const { env } = await absenceEnv(() => 'key1');
        const p = (await proposalFor(env, 's-abs', 'absence_today'))!;
        expect(p).toMatchObject({ status: 'approved', decidedBy: 't7b' });
        expect(await proposalFor(env, 's-other', 'absence_today')).toBeUndefined(); // 7A was not confirmed
        expect(await proposalFor(env, 's-flag', 'absence_today')).toBeUndefined(); // flagged child: never
        const again = await confirmClassAbsences(env.ctx, ORG, { grade: 7, section: 'B' }, T7B);
        expect(again.confirmed).toBe(false);
        expect(again.summary.created).toBe(0);
        expect(await intentsOf(env, p.id)).toHaveLength(1);
    });

    it('key 1 (the child is with me) is a note only: no page, no leave record', async () => {
        const { env, tick } = await absenceEnv(() => 'key1');
        await tick();
        const created = await processAbsencePages(env.ctx, ORG);
        expect(created.created).toBe(0);
        expect(await env.rules.listPages(ORG)).toEqual([]);
    });

    it('key 2 (I did not know) pages the class teacher AND the principal at once', async () => {
        const { env, tick } = await absenceEnv(() => 'key2');
        await tick();
        expect((await processAbsencePages(env.ctx, ORG)).created).toBe(1);
        const [page] = await env.rules.listPages(ORG);
        expect(page).toMatchObject({ reason: 'parent_said_did_not_know', targets: ['class_teacher', 'principal'], status: 'open', studentId: 's-abs' });
        expect((await processAbsencePages(env.ctx, ORG)).created).toBe(0); // idempotent
        await expect(acknowledgePage(env.ctx, ORG, page.id, NOBODY)).rejects.toMatchObject({ status: 403 });
        expect(await acknowledgePage(env.ctx, ORG, page.id, T7B)).toMatchObject({ status: 'acknowledged', acknowledgedBy: 't7b' });
    });

    it('no answer at all also pages, immediately, before any retry', async () => {
        const { env, tick } = await absenceEnv(() => 'no_answer');
        await tick();
        expect((await processAbsencePages(env.ctx, ORG)).created).toBe(1);
        expect((await env.rules.listPages(ORG))[0]).toMatchObject({ reason: 'no_answer', targets: ['class_teacher', 'principal'] });
    });
});

describe('the backtest through the service', () => {
    it('reports per rule without any adoption and writes nothing', async () => {
        const env = await setup();
        const bt = await backtestSchool(env.ctx, ORG, { weeks: 3, endDate: '2026-10-05' });
        expect(bt.results.map((r) => r.ruleId)).toEqual(['attendance_talk', 'academic_talk', 'conduct_talk', 'recognition', 'fee_due', 'fee_overdue']);
        expect(bt.results.find((r) => r.ruleId === 'attendance_talk')!.children.map((c) => c.studentId)).toContain('s-abs');
        expect(await env.rules.listProposals(ORG)).toEqual([]);
        expect(await env.rules.listAdoptionHistory(ORG)).toEqual([]);
    });
});
