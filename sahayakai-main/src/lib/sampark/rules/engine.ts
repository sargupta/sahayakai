/**
 * The adopted-rules engine (plan §2A "Rules ship switched off", §4③).
 *
 * `runAdoptedRules` is the ONLY production path from CRM signals to proposal
 * drafts. A rule runs only if the school's current adoption record for it has
 * status 'adopted', and it runs with THAT record's thresholds — never with
 * defaults. No adoption, or a withdrawn one, means the rule is inert: it reads
 * nothing and proposes nothing (class gate: "rules are inert until adopted").
 *
 * Pure and deterministic: students are processed in id order, rules in the
 * fixed RULE_IDS order, so the same inputs always give the same output.
 */

import { istDate } from '@/lib/sampark/policy/ist';
import type { SamparkStudent } from '@/types/sampark';

import {
    evaluateAbsenceToday,
    evaluateAcademic,
    evaluateAttendance,
    evaluateConduct,
    evaluateRecognition,
    emptyOutput,
    type RuleContext,
    type RuleOutput,
} from './evaluate-progress';
import { evaluateFeeDue, evaluateFeeOverdue } from './evaluate-fees';
import type { CrmSignals } from './signals';
import { RULE_IDS, type Adoption, type ClassConfirmation, type RuleId, type ThresholdsByRule } from './types';

export interface EngineInput {
    asOf: Date;
    students: readonly SamparkStudent[];
    signals: CrmSignals;
    /** The CURRENT adoption record per rule (any status). */
    adoptions: readonly Adoption[];
    /** A2: class-teacher confirmations (any date; the rule picks today's). */
    confirmations?: readonly ClassConfirmation[];
    /** Automated calls already spent per fee due, across C1 and C2. */
    feeCallsUsed?: ReadonlyMap<string, number>;
}

export interface EngineResult extends RuleOutput {
    /** Rules that were evaluated (adopted). */
    evaluated: RuleId[];
    /** Rules that were skipped because the school has not adopted them. */
    inert: RuleId[];
}

/**
 * Run ONE rule with explicit thresholds. Used by the engine (with adopted
 * thresholds) and by the backtest (with proposed ones). Do not call it from
 * anywhere else: a class gate scans the tree.
 */
export function evaluateRule<R extends RuleId>(
    rule: R,
    ctx: RuleContext,
    thresholds: ThresholdsByRule[R],
    extra: { confirmations?: readonly ClassConfirmation[]; feeCallsUsed?: ReadonlyMap<string, number> } = {},
): RuleOutput {
    const t = thresholds as ThresholdsByRule[RuleId];
    switch (rule) {
        case 'attendance_talk':
            return evaluateAttendance(ctx, t as ThresholdsByRule['attendance_talk']);
        case 'absence_today':
            return evaluateAbsenceToday(ctx, t as ThresholdsByRule['absence_today'], extra.confirmations ?? []);
        case 'academic_talk':
            return evaluateAcademic(ctx, t as ThresholdsByRule['academic_talk']);
        case 'conduct_talk':
            return evaluateConduct(ctx, t as ThresholdsByRule['conduct_talk']);
        case 'recognition':
            return evaluateRecognition(ctx, t as ThresholdsByRule['recognition']);
        case 'fee_due':
            return evaluateFeeDue(ctx, t as ThresholdsByRule['fee_due'], extra.feeCallsUsed ?? new Map());
        case 'fee_overdue':
            return evaluateFeeOverdue(ctx, t as ThresholdsByRule['fee_overdue'], extra.feeCallsUsed ?? new Map());
        default:
            return emptyOutput();
    }
}

export function runAdoptedRules(input: EngineInput): EngineResult {
    const ctx: RuleContext = { asOf: input.asOf, today: istDate(input.asOf), students: input.students, signals: input.signals };
    const result: EngineResult = { drafts: [], excluded: [], evaluated: [], inert: [] };

    for (const rule of RULE_IDS) {
        const adoption = input.adoptions.find((a) => a.ruleId === rule);
        if (!adoption || adoption.status !== 'adopted') {
            result.inert.push(rule);
            continue;
        }
        result.evaluated.push(rule);
        const out = evaluateRule(rule, ctx, adoption.thresholds as ThresholdsByRule[typeof rule], {
            confirmations: input.confirmations,
            feeCallsUsed: input.feeCallsUsed,
        });
        result.drafts.push(...out.drafts);
        result.excluded.push(...out.excluded);
    }
    return result;
}
