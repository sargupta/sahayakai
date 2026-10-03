/**
 * Which fee categories may receive an automated fee call (C1 / C2).
 *
 * Founder decision (2026-10-03): ALL four concession categories — RTE quota,
 * fee waiver, scholarship, staff ward — are excluded from fee calls. The school
 * may not want a machine reminding these families, so they are never proposed;
 * but each excluded child stays VISIBLE with a plain reason, so the school can
 * see it and ask for a change.
 *
 * This table is typed `Record<FeeCategory, ...>`: adding a category to the
 * FeeCategory type without deciding here is a compile error, and the class gate
 * (rules/fee-categories.test.ts) fails at runtime too. Decide callable or
 * excluded, with a reason; there is no third option.
 */

import type { FeeCategory } from '@/types/sampark';

export interface FeeCategoryCallable {
    callable: true;
}
export interface FeeCategoryExcluded {
    callable: false;
    /** Stable reason code, surfaced as the exclusion code in proposals, backtest and console. */
    code: 'fee_category_rte' | 'fee_category_waived' | 'fee_category_scholarship' | 'fee_category_staff_ward';
    /** Plain English for the school; names the category, never a diagnosis. */
    plain: string;
}
export type FeeCategoryPolicy = FeeCategoryCallable | FeeCategoryExcluded;

export const FEE_CATEGORY_POLICY: Readonly<Record<FeeCategory, FeeCategoryPolicy>> = Object.freeze({
    regular: { callable: true },
    rte: {
        callable: false,
        code: 'fee_category_rte',
        plain: 'This child is in the RTE quota, so no fee call is proposed. The school can ask for this to change.',
    },
    waived: {
        callable: false,
        code: 'fee_category_waived',
        plain: 'This child has a fee waiver, so no fee call is proposed. The school can ask for this to change.',
    },
    scholarship: {
        callable: false,
        code: 'fee_category_scholarship',
        plain: 'This child is on a scholarship, so no fee call is proposed. The school can ask for this to change.',
    },
    staff_ward: {
        callable: false,
        code: 'fee_category_staff_ward',
        plain: "This child is a staff member's ward, so no fee call is proposed. The school can ask for this to change.",
    },
});

/** The categories that never receive a fee call. Derived from the table, never hand-listed. */
export const FEE_CALL_EXCLUDED_CATEGORIES: readonly FeeCategory[] = Object.freeze(
    (Object.keys(FEE_CATEGORY_POLICY) as FeeCategory[]).filter((c) => !FEE_CATEGORY_POLICY[c].callable),
);

/** Unknown categories fail closed: not callable. */
export function isFeeCallable(category: FeeCategory): boolean {
    return FEE_CATEGORY_POLICY[category]?.callable === true;
}
