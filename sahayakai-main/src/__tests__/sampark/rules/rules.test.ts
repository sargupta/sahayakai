/**
 * @jest-environment node
 *
 * The adopted-rules engine (plan §2A): thresholds, evidence, determinism,
 * and the planted cases in the mock CRM's term of data.
 */
import { evaluateRule, runAdoptedRules } from '@/lib/sampark/rules/engine';
import { MAX_AUTOMATED_CALLS_PER_DUE, isSayableAmount } from '@/lib/sampark/rules/evaluate-fees';
import { DEFAULT_THRESHOLDS, parseThresholds } from '@/lib/sampark/rules/thresholds';
import type { ClassConfirmation } from '@/lib/sampark/rules/types';
import { RULE_IDS } from '@/lib/sampark/rules/types';
import { istDate } from '@/lib/sampark/policy/ist';

import { due, marks, note, schoolDays, score, signals, stu } from './_build';
import { ALL_ADOPTED, ANCHOR_11_IST, adoption, loadFixtureSignals, loadFixtureStudents, ORG } from './_fixture';

const NOW = ANCHOR_11_IST; // Wed 2026-09-30 11:00 IST
const ctxFor = (students: ReturnType<typeof stu>[], sig: ReturnType<typeof signals>, asOf = NOW) => ({ asOf, today: istDate(asOf), students, signals: sig });
const DAYS = schoolDays(10);

describe('A1 attendance request to talk', () => {
    const a = stu('a');
    const peer = stu('peer');
    const run = (aMarks: ReturnType<typeof marks>, th = DEFAULT_THRESHOLDS.attendance_talk) =>
        evaluateRule('attendance_talk', ctxFor([a, peer], signals({ attendance: [...aMarks, ...marks('peer', DAYS, () => 'present')] })), th);

    it('fires at exactly 3 consecutive school days absent, not at 2', () => {
        expect(run(marks('a', DAYS, (i) => (i >= 7 ? 'absent' : 'present'))).drafts).toHaveLength(1);
        expect(run(marks('a', DAYS, (i) => (i >= 8 ? 'absent' : 'present'))).drafts).toHaveLength(0);
    });
    it('a leave note makes the absence explained, and an unmarked day breaks the streak', () => {
        expect(run(marks('a', DAYS, (i) => (i >= 7 ? { status: 'absent', leaveNote: i === 8 } : 'present'))).drafts).toHaveLength(0);
        const withGap = marks('a', DAYS, (i) => (i >= 7 ? 'absent' : 'present')).filter((m) => m.date !== DAYS[8]);
        expect(run(withGap).drafts).toHaveLength(0);
    });
    it('a streak that ended earlier does not fire', () => {
        expect(run(marks('a', DAYS, (i) => (i >= 3 && i <= 6 ? 'absent' : 'present'))).drafts).toHaveLength(0);
    });
    it('session attendance below 75% fires only after the minimum days have elapsed', () => {
        const scattered = (i: number) => (i % 3 === 0 ? 'absent' : 'present') as 'absent' | 'present';
        const days30 = schoolDays(30);
        const peer30 = marks('peer', days30, () => 'present');
        const make = (n: number) => evaluateRule('attendance_talk', ctxFor([a, peer], signals({ attendance: [...marks('a', schoolDays(n), scattered), ...marks('peer', schoolDays(n), () => 'present')] })), DEFAULT_THRESHOLDS.attendance_talk);
        expect(make(15).drafts).toHaveLength(0); // 15 days < 20 elapsed
        void peer30;
        const out = make(30);
        expect(out.drafts).toHaveLength(1);
        expect(out.drafts[0].evidence[0].text).toMatch(/Present 20 of 30 marked school days \(67%\)/);
    });
    it('carries evidence naming the dates, and a dedupe key stable for the same streak', () => {
        const out = run(marks('a', DAYS, (i) => (i >= 6 ? 'absent' : 'present')));
        expect(out.drafts[0].evidence[0].text).toMatch(/Absent 4 school days in a row/);
        expect(out.drafts[0].dedupeKey).toBe(`attendance_talk:a:streak:${DAYS[6]}`);
        expect(out.drafts[0].facts).toBeNull();
    });
    it('a stricter adopted threshold fires less', () => {
        expect(run(marks('a', DAYS, (i) => (i >= 6 ? 'absent' : 'present')), { ...DEFAULT_THRESHOLDS.attendance_talk, minConsecutiveAbsentDays: 5 }).drafts).toHaveLength(0);
    });
});

describe('A3 academic request to talk', () => {
    const s = stu('a');
    const run = (rows: ReturnType<typeof score>[], th = DEFAULT_THRESHOLDS.academic_talk) => evaluateRule('academic_talk', ctxFor([s], signals({ assessments: rows })), th);

    it('never fires on one test, however bad', () => {
        expect(run([score('a', 'PT1', '2026-07-20', 5)]).drafts).toHaveLength(0);
    });
    it('fires when the rolling average of the last 2 assessments is below 35%', () => {
        const out = run([score('a', 'PT1', '2026-07-20', 30), score('a', 'PT2', '2026-08-20', 30)]);
        expect(out.drafts).toHaveLength(1);
        expect(out.drafts[0].evidence[0].text).toMatch(/Average 30% over the last 2 assessments/);
    });
    it('fires on a sustained drop across successive assessments, even when above 35%', () => {
        const out = run([score('a', 'PT1', '2026-07-20', 83), score('a', 'PT2', '2026-08-20', 60), score('a', 'HY', '2026-09-20', 39)]);
        expect(out.drafts).toHaveLength(1);
        expect(out.drafts[0].evidence[0].text).toMatch(/PT1 83% → PT2 60% → HY 39%/);
    });
    it('a single fall, or a fall of less than the adopted total, does not fire', () => {
        expect(run([score('a', 'PT1', '2026-07-20', 80), score('a', 'PT2', '2026-08-20', 60), score('a', 'HY', '2026-09-20', 70)]).drafts).toHaveLength(0);
        expect(run([score('a', 'PT1', '2026-07-20', 70), score('a', 'PT2', '2026-08-20', 65), score('a', 'HY', '2026-09-20', 60)]).drafts).toHaveLength(0);
    });
    it('a missed test is never scored as zero', () => {
        // PT1 50, PT2 missed (absent), HY 55: if the miss were a zero the average would be 35 and the drop would fire.
        const out = run([score('a', 'PT1', '2026-07-20', 50), score('a', 'PT2', '2026-08-20', null), score('a', 'HY', '2026-09-20', 55)]);
        expect(out.drafts).toHaveLength(0);
        // and a missed test alone never counts as an assessment
        expect(run([score('a', 'PT1', '2026-07-20', 20), score('a', 'PT2', '2026-08-20', null)]).drafts).toHaveLength(0);
    });
    it('exempt rows are not scored either', () => {
        const exempt = { ...score('a', 'PT2', '2026-08-20', null), status: 'exempt' as const };
        expect(run([score('a', 'PT1', '2026-07-20', 20), exempt]).drafts).toHaveLength(0);
    });
    it('says so in the evidence when it ignores missed tests', () => {
        const out = run([score('a', 'PT1', '2026-07-20', 83), score('a', 'PT2', '2026-08-20', 60), score('a', 'HY', '2026-09-20', 39)]);
        expect(out.drafts[0].evidence.some((e) => /never scored as zero/.test(e.text))).toBe(true);
    });
    it('flags alreadyKnown when an open academic meeting request exists', () => {
        const out = evaluateRule(
            'academic_talk',
            ctxFor([s], signals({ assessments: [score('a', 'PT1', '2026-07-20', 83), score('a', 'PT2', '2026-08-20', 60), score('a', 'HY', '2026-09-20', 39)], meetings: [{ studentId: 'a', reasonCode: 'academic_progress', status: 'requested' }] })),
            DEFAULT_THRESHOLDS.academic_talk,
        );
        expect(out.drafts[0].alreadyKnown).toBe(true);
    });
});

describe('A4 conduct request to talk', () => {
    const s = stu('a');
    const run = (notes: ReturnType<typeof note>[]) => evaluateRule('conduct_talk', ctxFor([s], signals({ hpc: notes })), DEFAULT_THRESHOLDS.conduct_talk);
    const concern = (id: string, who: string, date = '2026-09-28') => note(id, 'a', { respondentType: who, sentiment: 'concern', observedOn: date, note: `${who} saw something` });

    it('fires on 2 concern notes in 14 days with at least one from a teacher', () => {
        const out = run([concern('n1', 'teacher', '2026-09-24'), concern('n2', 'bus_attendant', '2026-09-26')]);
        expect(out.drafts).toHaveLength(1);
        expect(out.drafts[0].evidence).toHaveLength(2);
        expect(out.drafts[0].evidence.map((e) => e.text).join(' ')).toMatch(/bus attendant \(supporting only\)/);
    });
    it('two coordinator notes also trigger', () => {
        expect(run([concern('n1', 'coordinator'), concern('n2', 'teacher')]).drafts).toHaveLength(1);
    });
    it('non-teaching staff may support but never trigger', () => {
        expect(run([concern('n1', 'bus_attendant'), concern('n2', 'coach'), concern('n3', 'librarian')]).drafts).toHaveLength(0);
    });
    it('one note is never enough, and notes older than 14 days do not count', () => {
        expect(run([concern('n1', 'teacher')]).drafts).toHaveLength(0);
        expect(run([concern('n1', 'teacher', '2026-09-28'), concern('n2', 'teacher', '2026-09-10')]).drafts).toHaveLength(0);
    });
    it('self, peer and parent entries never count', () => {
        expect(run([concern('n1', 'teacher'), concern('n2', 'peer'), concern('n3', 'parent'), concern('n4', 'self')]).drafts).toHaveLength(0);
    });
    it('a neutral or positive teacher note does not count as a concern', () => {
        expect(run([concern('n1', 'teacher'), note('n2', 'a', { sentiment: 'positive' })]).drafts).toHaveLength(0);
    });
});

describe('A5 recognition', () => {
    const s = stu('a');
    const run = (notes: ReturnType<typeof note>[], th = DEFAULT_THRESHOLDS.recognition) => evaluateRule('recognition', ctxFor([s], signals({ hpc: notes })), th);
    const positive = (id: string, who: string, date = '2026-09-27') => note(id, 'a', { respondentType: who, sentiment: 'positive', observedOn: date, note: 'did well' });

    it('fires on 2 positive notes from 2 respondents in 14 days', () => {
        expect(run([positive('p1', 'teacher'), positive('p2', 'coach')]).drafts).toHaveLength(1);
    });
    it('two positives from ONE respondent type is not enough', () => {
        expect(run([positive('p1', 'teacher'), positive('p2', 'teacher')]).drafts).toHaveLength(0);
    });
    it('fires on a rubric level-up on the same unit and ability', () => {
        const rated = (id: string, level: 1 | 2 | 3, date: string) => note(id, 'a', { observedOn: date, unitId: 'u1', ability: 'awareness', rubric: { level, label: ['Beginner', 'Proficient', 'Advanced'][level - 1] } });
        const out = run([rated('r1', 1, '2026-08-01'), rated('r2', 2, '2026-09-27')]);
        expect(out.drafts).toHaveLength(1);
        expect(out.drafts[0].evidence[0].text).toMatch(/Moved from Beginner to Proficient/);
        expect(run([rated('r1', 1, '2026-08-01'), rated('r2', 2, '2026-09-27')], { ...DEFAULT_THRESHOLDS.recognition, rubricLevelUp: false }).drafts).toHaveLength(0);
    });
    it('a rubric level-down is not recognition', () => {
        const rated = (id: string, level: 1 | 2 | 3, date: string) => note(id, 'a', { observedOn: date, unitId: 'u1', ability: 'awareness', rubric: { level, label: 'x' } });
        expect(run([rated('r1', 3, '2026-08-01'), rated('r2', 2, '2026-09-27')]).drafts).toHaveLength(0);
    });
    it('auto-approval is only drafted when the school opted in', () => {
        const notes = [positive('p1', 'teacher'), positive('p2', 'coach')];
        expect(run(notes).drafts[0].preApprovedBy).toBeUndefined();
        expect(run(notes, { ...DEFAULT_THRESHOLDS.recognition, autoApprove: true }).drafts[0].preApprovedBy).toBe('auto');
    });
});

describe('A2 same-day unexplained absence', () => {
    const s = stu('a');
    const todayAbsent = marks('a', ['2026-09-30'], () => 'absent');
    const confirmation: ClassConfirmation = { id: 'c1', orgId: ORG, date: '2026-09-30', grade: 7, section: 'B', confirmedBy: 't7b', confirmedAt: '2026-09-30T04:40:00.000Z' };
    const run = (att = todayAbsent, confirmations: ClassConfirmation[] = [confirmation], asOf = NOW) =>
        evaluateRule('absence_today', ctxFor([s], signals({ attendance: att }), asOf), DEFAULT_THRESHOLDS.absence_today, { confirmations });

    it('only after the class teacher confirms: without it the child is reported as waiting, with no draft', () => {
        const out = run(todayAbsent, []);
        expect(out.drafts).toHaveLength(0);
        expect(out.excluded).toEqual([expect.objectContaining({ code: 'awaiting_class_confirmation', studentId: 'a' })]);
        expect(out.excluded[0].plain).toMatch(/Waiting for the class teacher of 7B to confirm/);
    });
    it('with the confirmation the draft exists and the confirmation is the approval', () => {
        const out = run();
        expect(out.drafts).toHaveLength(1);
        expect(out.drafts[0]).toMatchObject({ purpose: 'absence_today', preApprovedBy: 't7b', dedupeKey: 'absence_today:a:2026-09-30' });
    });
    it('a confirmation for another class or another day does not unlock it', () => {
        expect(run(todayAbsent, [{ ...confirmation, section: 'A' }]).drafts).toHaveLength(0);
        expect(run(todayAbsent, [{ ...confirmation, date: '2026-09-29' }]).drafts).toHaveLength(0);
    });
    it('not before 10:00 IST, and not late in the day', () => {
        expect(run(todayAbsent, [confirmation], new Date('2026-09-30T04:00:00Z')).drafts).toHaveLength(0); // 09:30 IST
        expect(run(todayAbsent, [confirmation], new Date('2026-09-30T09:30:00Z')).drafts).toHaveLength(0); // 15:00 IST
    });
    it('a leave note, or a present child, produces nothing', () => {
        expect(run(marks('a', ['2026-09-30'], () => ({ status: 'absent', leaveNote: true }))).drafts).toHaveLength(0);
        expect(run(marks('a', ['2026-09-30'], () => 'present')).drafts).toHaveLength(0);
        expect(run(marks('a', ['2026-09-30'], () => 'late')).drafts).toHaveLength(0);
    });
});

describe('C1 and C2 fee rules', () => {
    const s = stu('a');
    const c1 = (dues: ReturnType<typeof due>[], used = new Map<string, number>()) => evaluateRule('fee_due', ctxFor([s], signals({ feeDues: dues })), DEFAULT_THRESHOLDS.fee_due, { feeCallsUsed: used });
    const c2 = (dues: ReturnType<typeof due>[], used = new Map<string, number>()) => evaluateRule('fee_overdue', ctxFor([s], signals({ feeDues: dues })), DEFAULT_THRESHOLDS.fee_overdue, { feeCallsUsed: used });

    it('C1 fires from 7 days to 1 day before the due date, carrying the amount and date as typed facts', () => {
        const out = c1([due('d1', 'a', '2026-10-05')]);
        expect(out.drafts).toHaveLength(1);
        expect(out.drafts[0].facts).toEqual({ kind: 'fee', dueId: 'd1', amountRupees: 12500, dueDate: '2026-10-05' });
        expect(c1([due('d1', 'a', '2026-10-07')]).drafts).toHaveLength(1);
        expect(c1([due('d1', 'a', '2026-10-08')]).drafts).toHaveLength(0);
        expect(c1([due('d1', 'a', '2026-09-30')]).drafts).toHaveLength(0);
    });
    it('C2 fires once overdue, and hands over to the accounts officer after the adopted limit', () => {
        expect(c2([due('d1', 'a', '2026-09-25')]).drafts).toHaveLength(1);
        const late = c2([due('d1', 'a', '2026-08-01')]);
        expect(late.drafts).toHaveLength(0);
        expect(late.excluded[0]).toMatchObject({ code: 'fee_call_budget_spent' });
        expect(late.excluded[0].plain).toMatch(/accounts officer/);
    });
    it('a paid or waived due produces no call', () => {
        expect(c1([due('d1', 'a', '2026-10-05', 12500, 'paid')]).drafts).toHaveLength(0);
        expect(c1([due('d1', 'a', '2026-10-05', 12500, 'waived')]).excluded[0].code).toBe('fee_waived_due');
    });
    it('concession families (RTE, waiver, scholarship, staff ward) are excluded with a plain reason', () => {
        for (const feeCategory of ['rte', 'waived', 'scholarship', 'staff_ward'] as const) {
            const out = evaluateRule('fee_due', ctxFor([stu('a', { feeCategory })], signals({ feeDues: [due('d1', 'a', '2026-10-05')] })), DEFAULT_THRESHOLDS.fee_due);
            expect(out.drafts).toHaveLength(0);
            expect(out.excluded[0]).toMatchObject({ code: `fee_category_${feeCategory}` });
            expect(out.excluded[0].plain).toMatch(/no fee call is proposed/);
        }
    });
    it('no due gets more than two automated calls across C1 and C2', () => {
        expect(MAX_AUTOMATED_CALLS_PER_DUE).toBe(2);
        expect(c1([due('d1', 'a', '2026-10-05')], new Map([['d1', 1]])).drafts).toHaveLength(1);
        const spent = c2([due('d1', 'a', '2026-09-25')], new Map([['d1', 2]]));
        expect(spent.drafts).toHaveLength(0);
        expect(spent.excluded[0]).toMatchObject({ code: 'fee_call_budget_spent' });
    });
    it('an amount the scripts cannot say reliably is handed to accounts, not guessed', () => {
        expect(isSayableAmount(12500)).toBe(true);
        expect(isSayableAmount(12550)).toBe(false);
        expect(isSayableAmount(75000)).toBe(false);
        expect(isSayableAmount(250000)).toBe(true);
        const out = c1([due('d1', 'a', '2026-10-05', 12550)]);
        expect(out.drafts).toHaveLength(0);
        expect(out.excluded[0].code).toBe('fee_amount_not_sayable');
    });
});

describe('engine: adoption, determinism and evidence over the mock CRM term', () => {
    const students = loadFixtureStudents();
    const sig = loadFixtureSignals();

    it('flags exactly the planted children (and none of the must-not-fire ones)', () => {
        const r = runAdoptedRules({ asOf: ANCHOR_11_IST, students, signals: sig, adoptions: ALL_ADOPTED });
        const ids = (p: string) => r.drafts.filter((d) => d.purpose === p).map((d) => d.studentId);
        expect(ids('attendance_talk')).toEqual(['stu_0153', 'stu_0250']); // 4-day streak, 70% session
        expect(ids('academic_talk')).toEqual(['stu_0245']); // sustained drop 83 -> 60 -> 39
        expect(ids('academic_talk')).not.toContain('stu_0276'); // missed PT2, never scored as zero
        expect(ids('conduct_talk')).toEqual(['stu_0274']); // teacher + bus attendant
        expect(ids('conduct_talk')).not.toContain('stu_0122'); // two bus-attendant concerns only
        expect(ids('recognition')).toContain('stu_0146');
        expect(ids('fee_due')).toEqual(['stu_0128']);
        expect(ids('fee_overdue')).toEqual(['stu_0261']);
    });
    it('every proposal carries evidence and a plain summary', () => {
        const r = runAdoptedRules({ asOf: ANCHOR_11_IST, students, signals: sig, adoptions: ALL_ADOPTED });
        expect(r.drafts.length).toBeGreaterThan(5);
        for (const d of r.drafts) {
            expect(d.evidence.length).toBeGreaterThan(0);
            expect(d.summary.length).toBeGreaterThan(0);
            for (const e of d.evidence) expect(e.text.length).toBeGreaterThan(0);
        }
    });
    it('is deterministic and independent of input order', () => {
        const a = runAdoptedRules({ asOf: ANCHOR_11_IST, students, signals: sig, adoptions: ALL_ADOPTED });
        const b = runAdoptedRules({
            asOf: ANCHOR_11_IST,
            students: [...students].reverse(),
            signals: { ...sig, hpc: [...sig.hpc].reverse(), attendance: [...sig.attendance].reverse(), assessments: [...sig.assessments].reverse(), feeDues: [...sig.feeDues].reverse() },
            adoptions: [...ALL_ADOPTED].reverse(),
        });
        expect(b).toEqual(a);
    });
    it('marks the child whose teachers already knew (open meeting request) as alreadyKnown', () => {
        const r = runAdoptedRules({ asOf: ANCHOR_11_IST, students, signals: sig, adoptions: ALL_ADOPTED });
        expect(r.drafts.find((d) => d.studentId === 'stu_0245')?.alreadyKnown).toBe(true);
        expect(r.drafts.find((d) => d.studentId === 'stu_0274')?.alreadyKnown).toBe(false);
    });
});

describe('threshold floors: a school may be stricter than the plan, never looser', () => {
    it('refuses thresholds below the plan floors with a plain message', () => {
        expect(parseThresholds('attendance_talk', { ...DEFAULT_THRESHOLDS.attendance_talk, minConsecutiveAbsentDays: 2 })).toEqual({ ok: false, message: 'Consecutive school days absent cannot be below 3' });
        expect(parseThresholds('academic_talk', { ...DEFAULT_THRESHOLDS.academic_talk, minAssessments: 1 })).toMatchObject({ ok: false });
        expect(parseThresholds('academic_talk', { ...DEFAULT_THRESHOLDS.academic_talk, averagePercentBelow: 60 })).toMatchObject({ ok: false });
        expect(parseThresholds('conduct_talk', { windowDays: 14, minConcernNotes: 1 })).toMatchObject({ ok: false });
        expect(parseThresholds('conduct_talk', { windowDays: 30, minConcernNotes: 2 })).toMatchObject({ ok: false });
        expect(parseThresholds('recognition', { ...DEFAULT_THRESHOLDS.recognition, minRespondents: 1 })).toMatchObject({ ok: false });
        expect(parseThresholds('absence_today', { absentByHour: 8, latestProposalHour: 14 })).toMatchObject({ ok: false });
        expect(parseThresholds('attendance_talk', { ...DEFAULT_THRESHOLDS.attendance_talk, extra: 1 })).toMatchObject({ ok: false });
    });
    it('accepts the plan defaults and stricter values for every rule', () => {
        for (const rule of RULE_IDS) expect(parseThresholds(rule, DEFAULT_THRESHOLDS[rule])).toMatchObject({ ok: true });
        expect(parseThresholds('attendance_talk', { ...DEFAULT_THRESHOLDS.attendance_talk, minConsecutiveAbsentDays: 5 })).toMatchObject({ ok: true });
    });
});

describe('a stricter adoption changes the engine output', () => {
    it('uses the adopted thresholds, not the defaults', () => {
        const students = loadFixtureStudents();
        const sig = loadFixtureSignals();
        const strict = runAdoptedRules({ asOf: ANCHOR_11_IST, students, signals: sig, adoptions: [adoption('attendance_talk', { minConsecutiveAbsentDays: 5 })] });
        expect(strict.drafts.map((d) => d.studentId)).toEqual(['stu_0250']); // the 4-day streak no longer qualifies
    });
});
