/**
 * @jest-environment node
 *
 * The backtest (plan §2A): "these N children would have been flagged last term;
 * your teachers already knew about K", per rule, with reasons and counts, from
 * one anonymised term of the mock CRM's data.
 */
import { runBacktest, weeklyDates } from '@/lib/sampark/rules/backtest';
import { DEFAULT_THRESHOLDS } from '@/lib/sampark/rules/thresholds';

import { loadFixtureSignals, loadFixtureStudents } from './_fixture';

const students = loadFixtureStudents();
const signals = loadFixtureSignals();
const DATES = weeklyDates('2026-09-30', 5);

describe('weeklyDates', () => {
    it('gives weekly sample dates ending on the anchor, oldest first', () => {
        expect(DATES).toEqual(['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30']);
    });
});

describe('backtest over the mock CRM term (no adoption needed, nothing written)', () => {
    const bt = runBacktest({ students, signals, asOfDates: DATES });
    const rule = (id: string) => bt.results.find((r) => r.ruleId === id)!;

    it('reports per rule how many distinct children would have been flagged, with the planted ones present', () => {
        expect(rule('attendance_talk').children.map((c) => c.studentId)).toEqual(expect.arrayContaining(['stu_0153', 'stu_0250']));
        expect(rule('academic_talk').children.map((c) => c.studentId)).toContain('stu_0245');
        expect(rule('conduct_talk').children.map((c) => c.studentId)).toEqual(['stu_0274']);
        expect(rule('recognition').children.map((c) => c.studentId)).toContain('stu_0146');
        for (const r of bt.results) expect(r.flaggedChildren).toBe(r.children.length);
    });
    it('never flags the must-not-fire cases: staff-only concerns, a missed test, flagged or exempt children', () => {
        const all = bt.results.flatMap((r) => r.children.map((c) => `${r.ruleId}:${c.studentId}`));
        expect(all).not.toContain('conduct_talk:stu_0122');
        expect(all).not.toContain('academic_talk:stu_0276');
        for (const sensitive of ['stu_0251', 'stu_0125']) expect(all.filter((a) => a.endsWith(sensitive))).toEqual([]);
    });
    it('says which children teachers already knew about (an open meeting request)', () => {
        expect(rule('academic_talk').children.find((c) => c.studentId === 'stu_0245')?.alreadyKnown).toBe(true);
        expect(rule('academic_talk').alreadyKnown).toBeGreaterThanOrEqual(1);
        expect(bt.headlines[0]).toMatch(/flags across \d+ rules over 5 sample dates; teachers already knew about \d+\./);
    });
    it('counts the suppressed children per rule with plain reasons', () => {
        const fee = rule('fee_due');
        expect(fee.excludedByCode.sensitive_flag).toBe(2); // Kunal (counsellor referral) and Kripa (custody restriction, whose due was still ahead on the earlier sample dates)
        expect(fee.excludedByCode.fee_category_rte).toBe(1);
        expect(fee.excludedByCode.fee_amount_not_sayable).toBe(1);
        for (const r of bt.results) for (const e of r.excluded) expect(e.plain.length).toBeGreaterThan(20);
    });
    it('carries the evidence behind each flag, for the principal', () => {
        const harsh = rule('attendance_talk').children.find((c) => c.studentId === 'stu_0250')!;
        expect(harsh.reasons[0]).toMatch(/Present \d+ of \d+ marked school days/);
        expect(harsh.section).toBe('7A');
    });
    it('publishes the expected approvals per week, per purpose and per approver', () => {
        expect(bt.weeks.length).toBeGreaterThan(0);
        for (const w of bt.weeks) {
            const byPurpose = Object.values(w.byPurpose).reduce((a, b) => a + (b ?? 0), 0);
            const byApprover = Object.values(w.byApprover).reduce((a, b) => a + b, 0);
            expect(byApprover).toBe(byPurpose);
        }
        expect(Object.keys(bt.weeks.flatMap((w) => Object.keys(w.byApprover))).length).toBeGreaterThan(0);
        expect(new Set(bt.weeks.flatMap((w) => Object.keys(w.byApprover)))).toEqual(new Set(['class_teacher', 'coordinator', 'accounts']));
    });
    it('does not replay A2 (it needs the class teacher and the clock) but sizes it', () => {
        expect(bt.results.find((r) => r.ruleId === 'absence_today')).toBeUndefined();
        expect(bt.unexplainedAbsenceDays).toBeGreaterThan(0);
        expect(bt.attendanceWindow).not.toBeNull();
    });
    it('is deterministic', () => {
        expect(runBacktest({ students: [...students].reverse(), signals, asOfDates: [...DATES].reverse() })).toEqual(bt);
    });
});

describe('backtest tunes thresholds', () => {
    it('stricter proposed thresholds flag fewer children than the defaults', () => {
        const base = runBacktest({ students, signals, asOfDates: DATES, rules: ['attendance_talk'] });
        const strict = runBacktest({
            students,
            signals,
            asOfDates: DATES,
            rules: ['attendance_talk'],
            thresholds: { attendance_talk: { ...DEFAULT_THRESHOLDS.attendance_talk, minConsecutiveAbsentDays: 6, sessionAttendancePercentBelow: 60 } },
        });
        expect(strict.results[0].flaggedChildren).toBeLessThan(base.results[0].flaggedChildren);
    });
    it('says so when the CRM has no fee dues, instead of reporting zero as if it were a finding', () => {
        const bt = runBacktest({ students, signals: { ...signals, feeDues: [] }, asOfDates: DATES, rules: ['fee_due'] });
        expect(bt.results[0].note).toMatch(/no fee dues/);
    });
});
