/**
 * Thresholds a school adopts per rule (plan §2A).
 *
 * The defaults are the plan's numbers and are only SUGGESTIONS shown on the
 * adoption screen and used by the backtest: a rule with no adoption record is
 * inert. A school may adopt STRICTER values (fewer calls) but never looser than
 * the plan's floors, because the floors encode the plan's safety rules
 * ("never one test", "at least two notes", "≥ 3 school days"). Zod enforces
 * the floors, so an adoption that loosens them is refused with a plain message.
 */

import { z } from 'zod';

import type { RuleId, ThresholdsByRule } from './types';

export const DEFAULT_THRESHOLDS: Readonly<ThresholdsByRule> = Object.freeze({
    attendance_talk: { minConsecutiveAbsentDays: 3, minSessionDaysElapsed: 20, sessionAttendancePercentBelow: 75 },
    absence_today: { absentByHour: 10, latestProposalHour: 14 },
    academic_talk: { minAssessments: 2, averagePercentBelow: 35, dropAssessments: 2, minTotalDropPoints: 20 },
    conduct_talk: { windowDays: 14, minConcernNotes: 2 },
    recognition: { windowDays: 14, minPositiveNotes: 2, minRespondents: 2, rubricLevelUp: true, autoApprove: false },
    fee_due: { daysBeforeDue: 7 },
    fee_overdue: { overdueAfterDays: 1, stopAfterDays: 30 },
});

const int = (min: number, max: number, what: string) =>
    z.number({ invalid_type_error: `${what} must be a number` }).int(`${what} must be a whole number`).min(min, `${what} cannot be below ${min}`).max(max, `${what} cannot be above ${max}`);

export const THRESHOLD_SCHEMAS = {
    attendance_talk: z
        .object({
            minConsecutiveAbsentDays: int(3, 30, 'Consecutive school days absent'),
            minSessionDaysElapsed: int(10, 200, 'School days elapsed before session attendance counts'),
            sessionAttendancePercentBelow: int(50, 75, 'Session attendance percentage'),
        })
        .strict(),
    absence_today: z
        .object({
            absentByHour: int(10, 13, 'Absent-by hour (IST)'),
            latestProposalHour: int(11, 17, 'Latest hour for same-day proposals (IST)'),
        })
        .strict()
        .refine((v) => v.latestProposalHour > v.absentByHour, { message: 'The latest hour must be after the absent-by hour' }),
    academic_talk: z
        .object({
            minAssessments: int(2, 6, 'Assessments averaged'),
            averagePercentBelow: int(10, 35, 'Average percentage'),
            dropAssessments: int(2, 5, 'Successive falling assessments'),
            minTotalDropPoints: int(10, 80, 'Total drop in percentage points'),
        })
        .strict(),
    conduct_talk: z
        .object({
            windowDays: int(7, 14, 'Window in days'),
            minConcernNotes: int(2, 10, 'Concern notes'),
        })
        .strict(),
    recognition: z
        .object({
            windowDays: int(7, 14, 'Window in days'),
            minPositiveNotes: int(2, 10, 'Positive notes'),
            minRespondents: int(2, 5, 'Different respondents'),
            rubricLevelUp: z.boolean(),
            autoApprove: z.boolean(),
        })
        .strict(),
    fee_due: z.object({ daysBeforeDue: int(1, 14, 'Days before the due date') }).strict(),
    fee_overdue: z
        .object({
            overdueAfterDays: int(1, 30, 'Days overdue before the first overdue notice'),
            stopAfterDays: int(7, 90, 'Days overdue after which the accounts officer takes over'),
        })
        .strict()
        .refine((v) => v.stopAfterDays > v.overdueAfterDays, { message: 'The hand-over day must be after the first overdue notice' }),
} as const;

export type ThresholdParse<R extends RuleId> = { ok: true; value: ThresholdsByRule[R] } | { ok: false; message: string };

/** Validate a school's thresholds for a rule; returns the plain first problem on failure. */
export function parseThresholds<R extends RuleId>(rule: R, raw: unknown): ThresholdParse<R> {
    const parsed = THRESHOLD_SCHEMAS[rule].safeParse(raw);
    if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Invalid thresholds' };
    return { ok: true, value: parsed.data as ThresholdsByRule[R] };
}
