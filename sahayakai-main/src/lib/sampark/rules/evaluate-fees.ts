/**
 * The fee rules C1 (due in N days) and C2 (overdue) — owned by the accounts
 * office (plan §2C). Pure.
 *
 * Fee calls follow rules that are easy to state and easy to get wrong:
 *  - RTE-quota and fee-waived families are excluded (class gate 12);
 *  - no due receives more than TWO automated calls in total, counted across
 *    C1 and C2 together: `callsUsed` carries what earlier proposals already
 *    spent, and a due with none left is handed to the accounts officer;
 *  - the amount is only ever said AFTER the listener check (enforced where the
 *    script is built, child-render.ts) and only if the script can say it
 *    reliably (`isSayableAmount`);
 *  - a sensitive flag on the child suppresses the call like any other.
 */

import { addDays, istInstant } from '@/lib/sampark/policy/ist';

import { excluded, feeExclusionFor, suppressionFor } from './eligibility';
import { emptyOutput, type RuleContext, type RuleOutput } from './evaluate-progress';
import { daysBetween, type FeeDue } from './signals';
import type { FeeDueThresholds, FeeOverdueThresholds } from './types';

/** At most two automated calls per due, across C1 and C2 (plan §2C, class gate 12). */
export const MAX_AUTOMATED_CALLS_PER_DUE = 2;

/**
 * Amounts the four-language scripts can speak from the reviewed number lexicon
 * (0–60): whole hundreds only, a thousands part up to 60, a lakhs part up to 60.
 * Anything else is handed to the accounts officer rather than guessed at.
 */
export const MAX_SAYABLE_RUPEES = 60 * 100_000 + 60 * 1000 + 900;

export function isSayableAmount(amountRupees: number): boolean {
    if (!Number.isInteger(amountRupees) || amountRupees < 100 || amountRupees % 100 !== 0) return false;
    const lakhs = Math.floor(amountRupees / 100_000);
    const thousands = Math.floor((amountRupees % 100_000) / 1000);
    return lakhs <= 60 && thousands <= 60;
}

function endOfDay(date: string): string {
    return new Date(istInstant(addDays(date, 1), 0, 0).getTime() - 1).toISOString();
}

type FeePurpose = 'fee_due' | 'fee_overdue';

function evaluateFeeDues(
    ctx: RuleContext,
    purpose: FeePurpose,
    callsUsed: ReadonlyMap<string, number>,
    applies: (due: FeeDue, daysUntilDue: number) => 'yes' | 'no' | 'hand_over',
    handOverText: string,
    summary: (due: FeeDue, daysUntilDue: number) => string,
    expiresAt: (due: FeeDue) => string,
): RuleOutput {
    const out = emptyOutput();
    const students = new Map(ctx.students.map((s) => [s.id, s]));
    const dues = [...ctx.signals.feeDues].sort((a, b) => a.id.localeCompare(b.id));

    for (const due of dues) {
        const student = students.get(due.studentId);
        if (!student) continue;
        const until = daysBetween(ctx.today, due.dueDate);
        if (due.status === 'paid') continue;
        const decision = applies(due, until);
        if (decision === 'no') continue;

        if (due.status === 'waived') {
            out.excluded.push({ studentId: student.id, purpose, code: 'fee_waived_due', plain: 'This fee has been waived, so no fee call is proposed.' });
            continue;
        }
        const category = feeExclusionFor(student);
        if (category) {
            out.excluded.push(excluded(student.id, purpose, category));
            continue;
        }
        const suppress = suppressionFor(purpose, student, ctx.signals);
        if (suppress) {
            out.excluded.push(excluded(student.id, purpose, suppress));
            continue;
        }
        if (decision === 'hand_over') {
            out.excluded.push({ studentId: student.id, purpose, code: 'fee_call_budget_spent', plain: handOverText });
            continue;
        }
        const used = callsUsed.get(due.id) ?? 0;
        if (used >= MAX_AUTOMATED_CALLS_PER_DUE) {
            out.excluded.push({
                studentId: student.id,
                purpose,
                code: 'fee_call_budget_spent',
                plain: `Two automated calls have already been used for this fee. The accounts officer should speak with the family.`,
            });
            continue;
        }
        if (!isSayableAmount(due.amountRupees)) {
            out.excluded.push({
                studentId: student.id,
                purpose,
                code: 'fee_amount_not_sayable',
                plain: `The amount (Rs ${due.amountRupees}) cannot be spoken reliably yet (whole hundreds up to Rs ${MAX_SAYABLE_RUPEES} only). The accounts officer should phone.`,
            });
            continue;
        }
        out.drafts.push({
            dedupeKey: `${purpose}:${due.id}`,
            purpose,
            studentId: student.id,
            section: { grade: student.grade, section: student.section },
            facts: { kind: 'fee', dueId: due.id, amountRupees: due.amountRupees, dueDate: due.dueDate },
            summary: summary(due, until),
            evidence: [
                {
                    kind: 'fee',
                    date: due.dueDate,
                    text: `${due.label ?? 'Fee'} of Rs ${due.amountRupees}, due ${due.dueDate}, is still open. ${used} of ${MAX_AUTOMATED_CALLS_PER_DUE} automated calls used for this fee.`,
                },
            ],
            alreadyKnown: false,
            expiresAt: expiresAt(due),
        });
    }
    return out;
}

export function evaluateFeeDue(ctx: RuleContext, th: FeeDueThresholds, callsUsed: ReadonlyMap<string, number>): RuleOutput {
    return evaluateFeeDues(
        ctx,
        'fee_due',
        callsUsed,
        (_due, until) => (until >= 1 && until <= th.daysBeforeDue ? 'yes' : 'no'),
        '',
        (due, until) => `Fee due in ${until} day${until === 1 ? '' : 's'}`,
        (due) => endOfDay(due.dueDate),
    );
}

export function evaluateFeeOverdue(ctx: RuleContext, th: FeeOverdueThresholds, callsUsed: ReadonlyMap<string, number>): RuleOutput {
    return evaluateFeeDues(
        ctx,
        'fee_overdue',
        callsUsed,
        (_due, until) => {
            const overdue = -until;
            if (overdue < th.overdueAfterDays) return 'no';
            return overdue > th.stopAfterDays ? 'hand_over' : 'yes';
        },
        `This fee is more than the adopted limit overdue. A third or later reminder is for the accounts officer to make, not a machine.`,
        (_due, until) => `Fee overdue by ${-until} day${-until === 1 ? '' : 's'}`,
        () => endOfDay(addDays(ctx.today, 3)),
    );
}
