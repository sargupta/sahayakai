/**
 * School / chain pricing — the public per-teacher norm (2026-09).
 *
 * Confirmed by founder as the standard structure:
 *   - Annual  : ₹10,000 / teacher / year  (the standard institutional rate)
 *   - Monthly : ₹1,600  / teacher / month (month-to-month, no annual commit)
 *   - Parent calls : ₹4 / minute, sized by the school from student count
 *     (students × calls per student per year × average call length).
 *
 * Chains and large schools negotiate a further discount off the annual rate;
 * that is deliberately NOT modelled here — it is set in the written quote, so
 * this estimator never publishes a discount ladder it cannot commit to.
 *
 * This is the source of truth for the /school-pricing estimator and is unit
 * tested. It is intentionally separate from the Razorpay tier config in
 * plan-config.ts (self-serve tiers, currently hidden while pricing is quoted);
 * see the note there. Amounts here are indicative for on-page estimates — the
 * binding figure is always the written quote.
 */

export const SCHOOL_PRICING = {
    /** ₹ per teacher per year, billed annually. The standard institutional rate. */
    annualPerTeacher: 10000,
    /** ₹ per teacher per month, billed monthly (no annual commitment). */
    monthlyPerTeacher: 1600,
    /** ₹ per minute for AI parent calls (usage-based). */
    parentCallRatePerMin: 4,
    /** GST added on top of the estimate (services, India). */
    gstRate: 0.18,
} as const;

export type Billing = 'annual' | 'monthly';

export interface SchoolPricingInput {
    teachers: number;
    billing: Billing;
    includeParentCalls: boolean;
    students: number;
    callsPerStudentPerYear: number;
    avgMinutesPerCall: number;
}

export interface SchoolPricingResult {
    teachers: number;
    /** Per-teacher/year rate implied by the chosen cadence (monthly is ×12). */
    perTeacherPerYear: number;
    /** Teacher subscription cost per year for the chosen cadence. */
    teacherSubtotal: number;
    /** Teacher cost per year if billed annually (for the saving comparison). */
    teacherAnnual: number;
    /** Teacher cost per year if billed monthly (annualised). */
    teacherMonthlyAnnualised: number;
    /** ₹/year saved by paying annually vs month-to-month (0 when none). */
    annualSavingVsMonthly: number;
    parentCallMinutesPerYear: number;
    parentCallCostPerYear: number;
    /** Estimate before GST. */
    subtotalPerYear: number;
    gst: number;
    /** Estimate including GST. */
    totalPerYearInclGst: number;
}

const nonNegInt = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
const nonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function estimateSchoolCost(input: SchoolPricingInput): SchoolPricingResult {
    const teachers = nonNegInt(input.teachers);
    const teacherAnnual = teachers * SCHOOL_PRICING.annualPerTeacher;
    const teacherMonthlyAnnualised = teachers * SCHOOL_PRICING.monthlyPerTeacher * 12;
    const teacherSubtotal = input.billing === 'annual' ? teacherAnnual : teacherMonthlyAnnualised;
    const perTeacherPerYear =
        input.billing === 'annual'
            ? SCHOOL_PRICING.annualPerTeacher
            : SCHOOL_PRICING.monthlyPerTeacher * 12;

    const students = nonNegInt(input.students);
    const calls = nonNegInt(input.callsPerStudentPerYear);
    const avg = nonNeg(input.avgMinutesPerCall);
    const parentCallMinutesPerYear = input.includeParentCalls ? students * calls * avg : 0;
    const parentCallCostPerYear = parentCallMinutesPerYear * SCHOOL_PRICING.parentCallRatePerMin;

    const subtotalPerYear = teacherSubtotal + parentCallCostPerYear;
    const gst = subtotalPerYear * SCHOOL_PRICING.gstRate;

    return {
        teachers,
        perTeacherPerYear,
        teacherSubtotal,
        teacherAnnual,
        teacherMonthlyAnnualised,
        annualSavingVsMonthly: Math.max(0, teacherMonthlyAnnualised - teacherAnnual),
        parentCallMinutesPerYear,
        parentCallCostPerYear,
        subtotalPerYear,
        gst,
        totalPerYearInclGst: subtotalPerYear + gst,
    };
}
