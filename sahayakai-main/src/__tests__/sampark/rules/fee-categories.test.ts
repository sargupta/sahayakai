/**
 * CLASS GATE (standing law 2): every fee category must be DECIDED — callable, or
 * in the explicit excluded set with a reason code and plain English. Adding a
 * category (to the FeeCategory type or to the CRM schema enum) without deciding
 * here fails this file; so does any excluded category yielding a fee proposal.
 */

import { CrmStudentSchema } from '@/lib/sampark/crm/schema';
import { feeExclusionFor } from '@/lib/sampark/rules/eligibility';
import { evaluateRule, runAdoptedRules } from '@/lib/sampark/rules/engine';
import { FEE_CALL_EXCLUDED_CATEGORIES, FEE_CATEGORY_POLICY, isFeeCallable } from '@/lib/sampark/rules/fee-categories';
import { DEFAULT_THRESHOLDS } from '@/lib/sampark/rules/thresholds';
import { istDate } from '@/lib/sampark/policy/ist';
import type { FeeCategory } from '@/types/sampark';

import { due, signals, stu } from './_build';
import { ALL_ADOPTED, ANCHOR_11_IST } from './_fixture';


/** Every category the system can carry: the CRM schema's enum is the wire-level source of truth. */
const ALL_CATEGORIES = [...CrmStudentSchema.shape.feeCategory.options] as FeeCategory[];

/** The founder's decision, written out. Changing it is a deliberate edit here AND in fee-categories.ts. */
const EXPECTED_EXCLUDED: ReadonlySet<FeeCategory> = new Set(['rte', 'waived', 'scholarship', 'staff_ward']);
const EXPECTED_CALLABLE: ReadonlySet<FeeCategory> = new Set(['regular']);

const NOW = ANCHOR_11_IST;
const ctxFor = (students: ReturnType<typeof stu>[], sig: ReturnType<typeof signals>) => ({ asOf: NOW, today: istDate(NOW), students, signals: sig });

describe('class gate: every fee category is decided', () => {
    it('the policy table covers exactly the categories the CRM schema allows', () => {
        expect(Object.keys(FEE_CATEGORY_POLICY).sort()).toEqual([...ALL_CATEGORIES].sort());
    });

    it.each(ALL_CATEGORIES)('%s is either callable or excluded with a reason code and plain English', (category) => {
        const policy = FEE_CATEGORY_POLICY[category];
        expect(policy).toBeDefined();
        if (policy.callable) {
            expect(EXPECTED_CALLABLE.has(category)).toBe(true);
            expect(feeExclusionFor(stu('x', { feeCategory: category }))).toBeNull();
        } else {
            expect(EXPECTED_EXCLUDED.has(category)).toBe(true);
            expect(policy.code).toMatch(/^fee_category_[a-z_]+$/);
            expect(policy.plain.length).toBeGreaterThan(30);
            expect(policy.plain).toMatch(/no fee call is proposed/);
            expect(feeExclusionFor(stu('x', { feeCategory: category }))).toEqual({ code: policy.code, plain: policy.plain });
        }
    });

    it('callable and excluded sets are disjoint and together cover every category', () => {
        const excluded = new Set(FEE_CALL_EXCLUDED_CATEGORIES);
        for (const c of ALL_CATEGORIES) expect(excluded.has(c) !== isFeeCallable(c)).toBe(true);
        expect([...excluded].sort()).toEqual([...EXPECTED_EXCLUDED].sort());
    });

    it('reason codes are unique per excluded category (the school can tell them apart)', () => {
        const codes = FEE_CALL_EXCLUDED_CATEGORIES.map((c) => (FEE_CATEGORY_POLICY[c] as { code: string }).code);
        expect(new Set(codes).size).toBe(codes.length);
    });

    it('an unknown category fails closed', () => {
        expect(isFeeCallable('mystery' as FeeCategory)).toBe(false);
        expect(feeExclusionFor(stu('x', { feeCategory: 'mystery' as FeeCategory }))).toMatchObject({ code: 'fee_category_unknown' });
    });
});

describe('property: an excluded category never yields a fee proposal', () => {
    const AMOUNTS = [100, 12_500, 25_000, 150_000];
    // due dates from far overdue to far ahead, around NOW (2026-09-30)
    const DUE_DATES = ['2026-08-01', '2026-09-01', '2026-09-20', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-05', '2026-10-07', '2026-10-14', '2026-11-30'];
    const USED = [0, 1, 2];

    for (const category of EXPECTED_EXCLUDED) {
        it(`${category}: no draft from C1, C2 or the full engine across amounts, due dates and calls used`, () => {
            let checkedExclusions = 0;
            for (const amount of AMOUNTS) {
                for (const dueDate of DUE_DATES) {
                    for (const used of USED) {
                        const child = stu('a', { feeCategory: category });
                        const sig = signals({ feeDues: [due('d1', 'a', dueDate, amount)] });
                        const callsUsed = new Map([['d1', used]]);
                        for (const rule of ['fee_due', 'fee_overdue'] as const) {
                            const out = evaluateRule(rule, ctxFor([child], sig), DEFAULT_THRESHOLDS[rule], { feeCallsUsed: callsUsed });
                            expect(out.drafts.filter((d) => d.facts.kind === 'fee')).toEqual([]);
                            for (const e of out.excluded) {
                                expect(e.code).toBe((FEE_CATEGORY_POLICY[category] as { code: string }).code);
                                checkedExclusions++;
                            }
                        }
                        const run = runAdoptedRules({ asOf: NOW, students: [child], signals: sig, adoptions: ALL_ADOPTED, feeCallsUsed: callsUsed });
                        expect(run.drafts.filter((d) => d.purpose === 'fee_due' || d.purpose === 'fee_overdue')).toEqual([]);
                    }
                }
            }
            // the exclusion is visible, not silent: at least some dues fell inside C1/C2 windows and were reported
            expect(checkedExclusions).toBeGreaterThan(0);
        });
    }

    it('control: a regular family in the same windows DOES get a fee draft (the property is not vacuous)', () => {
        const out = evaluateRule('fee_due', ctxFor([stu('a')], signals({ feeDues: [due('d1', 'a', '2026-10-05')] })), DEFAULT_THRESHOLDS.fee_due);
        expect(out.drafts).toHaveLength(1);
    });
});
