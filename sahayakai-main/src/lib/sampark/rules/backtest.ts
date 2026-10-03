/**
 * The backtest (plan §2A "Rules ship switched off"): before any rule goes live,
 * run it over one anonymised term of the school's own data and say "these 23
 * children would have been flagged last term; your teachers already knew about
 * 9". The report tunes the thresholds and is the strongest demo the product has.
 *
 * Pure. It evaluates each rule on PROPOSED thresholds (the defaults, or the
 * school's draft values), at noon IST on each sample date, and counts DISTINCT
 * children per rule. It never creates a proposal and never needs an adoption:
 * that is exactly what a backtest is for. Because it calls the evaluators
 * directly, this module is one of the two files the "inert until adopted" gate
 * allows to do so (the other is the engine).
 *
 * Limits, said plainly in the output:
 *  - A2 (same-day absence) depends on the class teacher's confirmation and the
 *    time of day, so it is not replayed; its volume is shown as the number of
 *    unexplained same-day absences (an upper bound on the confirmations asked).
 *  - "Already knew" uses the CURRENT open meeting requests, not those open on
 *    each past date, so it can overstate slightly.
 *  - The CRM export holds a limited window of attendance (30 school days in the
 *    mock); the report names the window it actually saw.
 */

import { istInstant, addDays, weekdayOf } from '@/lib/sampark/policy/ist';
import type { SamparkStudent } from '@/types/sampark';

import { evaluateRule } from './engine';
import type { RuleContext } from './evaluate-progress';
import { approverRoleFor } from './roles';
import type { CrmSignals } from './signals';
import { DEFAULT_THRESHOLDS } from './thresholds';
import { RULE_IDS, type ExcludedChild, type ExclusionCode, type RuleId, type ThresholdsByRule } from './types';

export interface BacktestInput {
    students: readonly SamparkStudent[];
    signals: CrmSignals;
    /** YYYY-MM-DD sample dates, each evaluated at 12:00 IST. */
    asOfDates: readonly string[];
    /** Proposed thresholds; anything missing uses the plan defaults. */
    thresholds?: { [R in RuleId]?: ThresholdsByRule[R] };
    rules?: readonly RuleId[];
}

export interface BacktestChild {
    studentId: string;
    displayName: string;
    section: string;
    firstFlaggedOn: string;
    lastFlaggedOn: string;
    summary: string;
    /** The evidence lines that triggered it (staff words, for the principal only). */
    reasons: string[];
    alreadyKnown: boolean;
}

export interface BacktestRuleResult {
    ruleId: RuleId;
    thresholds: ThresholdsByRule[RuleId];
    /** Distinct children who would have been flagged at least once. */
    flaggedChildren: number;
    /** Of those, children with an open meeting request for the same reason: teachers already knew. */
    alreadyKnown: number;
    /** Distinct children who triggered the rule but were suppressed, by plain reason code. */
    excludedByCode: Partial<Record<ExclusionCode, number>>;
    excluded: ExcludedChild[];
    children: BacktestChild[];
    /** Distinct children first flagged on each sample date. */
    newPerDate: Record<string, number>;
    note: string | null;
}

export interface BacktestWeek {
    /** Monday of the week (YYYY-MM-DD). */
    weekStart: string;
    byPurpose: Partial<Record<RuleId, number>>;
    /** Expected approvals this week, per approver role. */
    byApprover: Record<string, number>;
}

export interface Backtest {
    asOfDates: string[];
    attendanceWindow: { from: string; to: string } | null;
    results: BacktestRuleResult[];
    weeks: BacktestWeek[];
    /** A2: unexplained same-day absence marks (student-days) seen in the data. */
    unexplainedAbsenceDays: number;
    headlines: string[];
}

/** Every Wednesday-style weekly sample date ending on `end`, oldest first. */
export function weeklyDates(end: string, weeks: number): string[] {
    const out: string[] = [];
    for (let i = weeks - 1; i >= 0; i--) out.push(addDays(end, -7 * i));
    return out;
}

function mondayOf(date: string): string {
    const wd = weekdayOf(date); // 0 = Sunday
    return addDays(date, -((wd + 6) % 7));
}

export function runBacktest(input: BacktestInput): Backtest {
    const rules = (input.rules ?? RULE_IDS).filter((r) => r !== 'absence_today');
    const dates = [...new Set(input.asOfDates)].sort();
    const byId = new Map(input.students.map((s) => [s.id, s]));
    const results: BacktestRuleResult[] = [];
    const firstSeen = new Map<string, string>(); // `${rule}|${dedupeKey}` → first date, for the weekly volume

    for (const rule of rules) {
        const thresholds = (input.thresholds?.[rule] ?? DEFAULT_THRESHOLDS[rule]) as ThresholdsByRule[RuleId];
        const children = new Map<string, BacktestChild>();
        const excluded = new Map<string, ExcludedChild>();
        const newPerDate: Record<string, number> = {};

        for (const date of dates) {
            const asOf = istInstant(date, 12, 0);
            const ctx: RuleContext = { asOf, today: date, students: input.students, signals: input.signals };
            const out = evaluateRule(rule, ctx, thresholds as never, { feeCallsUsed: new Map() });
            for (const d of out.drafts) {
                const key = `${rule}|${d.dedupeKey}`;
                if (!firstSeen.has(key)) firstSeen.set(key, date);
                const existing = children.get(d.studentId);
                const s = byId.get(d.studentId);
                if (existing) {
                    existing.lastFlaggedOn = date;
                    continue;
                }
                newPerDate[date] = (newPerDate[date] ?? 0) + 1;
                children.set(d.studentId, {
                    studentId: d.studentId,
                    displayName: s?.displayName ?? d.studentId,
                    section: s ? `${s.grade}${s.section}` : '',
                    firstFlaggedOn: date,
                    lastFlaggedOn: date,
                    summary: d.summary,
                    reasons: d.evidence.map((e) => e.text),
                    alreadyKnown: d.alreadyKnown,
                });
            }
            for (const e of out.excluded) excluded.set(`${e.studentId}|${e.code}`, e);
        }

        const excludedByCode: Partial<Record<ExclusionCode, number>> = {};
        for (const e of excluded.values()) excludedByCode[e.code] = (excludedByCode[e.code] ?? 0) + 1;
        const list = [...children.values()].sort((a, b) => a.studentId.localeCompare(b.studentId));
        results.push({
            ruleId: rule,
            thresholds,
            flaggedChildren: list.length,
            alreadyKnown: list.filter((c) => c.alreadyKnown).length,
            excludedByCode,
            excluded: [...excluded.values()].sort((a, b) => a.studentId.localeCompare(b.studentId) || a.code.localeCompare(b.code)),
            children: list,
            newPerDate,
            note:
                (rule === 'fee_due' || rule === 'fee_overdue') && input.signals.feeDues.length === 0
                    ? 'The CRM export has no fee dues, so this rule could not be replayed.'
                    : null,
        });
    }

    // Expected approvals per week, per purpose and per approver (plan §4⑤).
    const weekMap = new Map<string, BacktestWeek>();
    for (const [key, date] of firstSeen) {
        const rule = key.split('|')[0] as RuleId;
        const weekStart = mondayOf(date);
        const week = weekMap.get(weekStart) ?? { weekStart, byPurpose: {}, byApprover: {} };
        week.byPurpose[rule] = (week.byPurpose[rule] ?? 0) + 1;
        const approver = String(approverRoleFor(rule));
        week.byApprover[approver] = (week.byApprover[approver] ?? 0) + 1;
        weekMap.set(weekStart, week);
    }

    const attendanceDates = input.signals.attendance.map((a) => a.date).sort();
    const unexplainedAbsenceDays = input.signals.attendance.filter((a) => a.status === 'absent' && !a.leaveNote).length;
    const total = results.reduce((n, r) => n + r.flaggedChildren, 0);
    const known = results.reduce((n, r) => n + r.alreadyKnown, 0);
    const headlines = results.map((r) => {
        const base = `${r.ruleId}: ${r.flaggedChildren} ${r.flaggedChildren === 1 ? 'child' : 'children'} would have been flagged`;
        return r.alreadyKnown > 0 ? `${base}; teachers already knew about ${r.alreadyKnown}.` : `${base}.`;
    });
    headlines.unshift(`${total} flags across ${results.length} rules over ${dates.length} sample dates; teachers already knew about ${known}.`);

    return {
        asOfDates: dates,
        attendanceWindow: attendanceDates.length ? { from: attendanceDates[0], to: attendanceDates[attendanceDates.length - 1] } : null,
        results,
        weeks: [...weekMap.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
        unexplainedAbsenceDays,
        headlines,
    };
}
