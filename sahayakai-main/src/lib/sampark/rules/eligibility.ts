/**
 * Sensitive-flag and eligibility suppression (plan §2E, §2C, class gates 10, 12).
 *
 * "Sensitive flags suppress everything automated, not only what they trigger."
 * A counsellor referral, a custody restriction, a "domestic issue" or "severe
 * illness" barrier, an open safeguarding matter — and, conservatively, an open
 * bullying report or wellbeing meeting, or any counsellor involvement on the
 * card — mean NO automated call about that child, for ANY purpose, except a
 * class-wide notice (audience 'class'), which names no child and so cannot
 * single them out.
 *
 * This is the rule layer's own check, applied BEFORE a proposal exists. The
 * policy gate (policy/gate.ts, rule 9) applies the same flags again when an
 * intent is materialised and when it is dialled; neither layer trusts the
 * other (principle 3: fail closed, check again at the last moment).
 *
 * Every suppression returns a PLAIN reason a class teacher or principal can
 * read. Reasons name the kind of flag, never a note, never a diagnosis: the CRM
 * sends reason codes only for confidential matters, and this module only ever
 * sees codes.
 */

import { purposeSpec } from '@/lib/sampark/catalogue';
import type { PurposeId, SamparkStudent, SensitiveFlag } from '@/types/sampark';

import type { ExcludedChild, ExclusionCode, RuleId } from './types';
import { CONFIDENTIAL_RESPONDENT_TYPES, type CrmSignals } from './signals';

/** What the principal may read about WHY, in neutral words (never the underlying detail). */
export const SENSITIVE_FLAG_PLAIN: Readonly<Record<SensitiveFlag, string>> = Object.freeze({
    counsellor_referral: 'a counsellor referral',
    custody_restriction: 'a custody restriction',
    domestic_issue: 'a sensitive family flag',
    severe_illness: 'a sensitive health flag',
    safeguarding_open: 'an open safeguarding matter',
});

/** Open incident or meeting reasons that mean a person is already handling a wellbeing matter. */
const WELLBEING_INCIDENT_CODES: readonly string[] = ['bullying_reported'];
const WELLBEING_MEETING_CODES: readonly string[] = ['wellbeing'];

export interface SuppressionResult {
    code: ExclusionCode;
    plain: string;
}

/**
 * Why NO automated call about this child may be proposed for `purpose`, or null.
 * Class-wide purposes are never suppressed by a child's flags (plan §2E); a
 * child who has left is never called about.
 */
export function suppressionFor(
    purpose: PurposeId,
    student: Pick<SamparkStudent, 'id' | 'active' | 'sensitiveFlags'>,
    signals: Pick<CrmSignals, 'hpc' | 'incidents' | 'meetings'>,
): SuppressionResult | null {
    if (purposeSpec(purpose).audience === 'class') return null;

    if (!student.active) {
        return { code: 'left_school', plain: 'This child is no longer enrolled, so no call is proposed.' };
    }
    const flags = (student.sensitiveFlags ?? []) as SensitiveFlag[];
    if (flags.length > 0) {
        const names = flags.map((f) => SENSITIVE_FLAG_PLAIN[f] ?? 'a sensitive flag').join(' and ');
        return {
            code: 'sensitive_flag',
            plain: `The school's records show ${names} for this child. No automated call goes out about this child, whatever the reason; a person decides.`,
        };
    }
    const counsellorInvolved = signals.hpc.some(
        (n) => n.studentId === student.id && (CONFIDENTIAL_RESPONDENT_TYPES as readonly string[]).includes(n.respondentType) && n.respondentType === 'counsellor',
    );
    if (counsellorInvolved) {
        return {
            code: 'counsellor_involved',
            plain: 'A counsellor is involved with this child. No automated call goes out about this child; a person decides.',
        };
    }
    const openWellbeing =
        signals.incidents.some((i) => i.studentId === student.id && i.status === 'open' && WELLBEING_INCIDENT_CODES.includes(i.reasonCode)) ||
        signals.meetings.some(
            (m) => m.studentId === student.id && (m.status === 'requested' || m.status === 'scheduled') && WELLBEING_MEETING_CODES.includes(m.reasonCode),
        );
    if (openWellbeing) {
        return {
            code: 'open_wellbeing_matter',
            plain: 'A wellbeing matter is open for this child. No automated call goes out about this child; a person is handling it.',
        };
    }
    return null;
}

/** RTE-quota and fee-waived families are excluded from fee calls (plan §2C, class gate 12). */
export function feeExclusionFor(student: Pick<SamparkStudent, 'feeCategory'>): SuppressionResult | null {
    if (student.feeCategory === 'rte' || student.feeCategory === 'waived') {
        return {
            code: 'fee_category_excluded',
            plain: 'This family is exempt from fees (RTE quota or fee waiver), so no fee call is proposed.',
        };
    }
    return null;
}

export function excluded(studentId: string, purpose: RuleId, r: SuppressionResult): ExcludedChild {
    return { studentId, purpose, code: r.code, plain: r.plain };
}
