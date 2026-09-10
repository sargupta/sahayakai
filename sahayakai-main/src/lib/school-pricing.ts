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

/* ────────────────────────────────────────────────────────────────────────────
 * Value / savings model — "what the school gets back".
 *
 * Source of truth is the founder-approved, sourced methodology (v1.0, Jul 2026;
 * company/proposals/elevate_karnataka/methodology.md). We reproduce its numbers
 * exactly so the on-page figure and the proposal never diverge:
 *   - 9 capabilities save 10.8 hrs/teacher/week (itemised below).
 *   - × 38 teaching weeks (deliberately conservative, not 44–46) ≈ 410 hrs/yr.
 *   - Hourly cost = monthly salary ÷ 176 paid hrs (22 days × 8 hrs).
 *   - Value/teacher/yr = hours × hourly cost. At ₹30k/mo this is ~₹69,900,
 *     matching the methodology's published band (₹20k→₹46,600 … ₹60k→₹1,39,800).
 * ROI and payback are computed against the CURRENT annual price
 * (SCHOOL_PRICING.annualPerTeacher), not the methodology's older price column.
 * ──────────────────────────────────────────────────────────────────────────── */

export const SAVINGS_MODEL = {
    /** Teaching weeks per year — conservative (methodology uses 38, not 44–46). */
    weeksPerYear: 38,
    /** Paid hours per month (22 working days × 8 hrs) for the hourly rate. */
    paidHoursPerMonth: 176,
    /** Hours in one teacher-FTE-year, for the "= N full teachers" framing. */
    fteHoursPerYear: 1900,
} as const;

export interface SavingsCapability {
    /** English label (UI wraps in t()). */
    name: string;
    hoursPerWeek: number;
}

/** Hours saved per teacher per week, by capability (methodology §1). Sums to 10.8. */
export const SAVINGS_CAPABILITIES: readonly SavingsCapability[] = [
    { name: 'Lesson planning', hoursPerWeek: 3.0 },
    { name: 'Grading (assessment scanner)', hoursPerWeek: 2.5 },
    { name: 'Quizzes & worksheets', hoursPerWeek: 1.2 },
    { name: 'AI parent calls', hoursPerWeek: 1.0 },
    { name: 'Board practice sets', hoursPerWeek: 0.8 },
    { name: 'VIDYA co-teacher & visual aids', hoursPerWeek: 0.8 },
    { name: 'Professional messaging', hoursPerWeek: 0.6 },
    { name: 'Teacher community', hoursPerWeek: 0.5 },
    { name: 'Built-in AI training', hoursPerWeek: 0.4 },
] as const;

/** Total hours saved per teacher per week across all capabilities (≈ 10.8). */
export const SAVINGS_WEEKLY_HOURS = SAVINGS_CAPABILITIES.reduce((s, c) => s + c.hoursPerWeek, 0);

/** Hours reclaimed per teacher per year (≈ 410), rounded to a whole hour. */
export const SAVINGS_HOURS_PER_TEACHER_YEAR = Math.round(SAVINGS_WEEKLY_HOURS * SAVINGS_MODEL.weeksPerYear);

export interface SchoolSavingsInput {
    teachers: number;
    /** Average teacher salary per month, in ₹. */
    salaryPerMonth: number;
}

export interface SchoolSavingsResult {
    teachers: number;
    salaryPerMonth: number;
    /** ₹ per teacher-hour (salary ÷ 176). */
    hourlyCost: number;
    hoursPerTeacherPerYear: number;
    /** Total hours reclaimed across the school per year. */
    hoursReclaimedSchool: number;
    /** ₹ value of time reclaimed, per teacher per year. */
    valuePerTeacherPerYear: number;
    /** ₹ value of time reclaimed, whole school per year. */
    valueSchoolPerYear: number;
    /** ₹ the school pays SahayakAI per year (teachers × annual rate). */
    sahayakaiCostPerYear: number;
    /** ₹ value reclaimed minus what the school pays, per year. */
    netSavingsPerYear: number;
    /** value ÷ price, per teacher (how many ₹ back per ₹1 spent). */
    roiMultiple: number;
    /** Months for the reclaimed value to cover the annual price. */
    paybackMonths: number;
    /** Reclaimed hours expressed as full-time-teacher-years. */
    fteEquivalent: number;
}

/**
 * Estimate the annual value a school gets back from the time SahayakAI reclaims.
 * Pure; clamps bad input to zero so a blank field never yields NaN on the page.
 */
export function estimateSchoolSavings(input: SchoolSavingsInput): SchoolSavingsResult {
    const teachers = nonNegInt(input.teachers);
    const salaryPerMonth = nonNeg(input.salaryPerMonth);
    const hourlyCost = salaryPerMonth / SAVINGS_MODEL.paidHoursPerMonth;
    const hoursPerTeacherPerYear = SAVINGS_HOURS_PER_TEACHER_YEAR;
    const hoursReclaimedSchool = teachers * hoursPerTeacherPerYear;
    const valuePerTeacherPerYear = hoursPerTeacherPerYear * hourlyCost;
    const valueSchoolPerYear = teachers * valuePerTeacherPerYear;
    const sahayakaiCostPerYear = teachers * SCHOOL_PRICING.annualPerTeacher;
    const netSavingsPerYear = valueSchoolPerYear - sahayakaiCostPerYear;
    const roiMultiple =
        valuePerTeacherPerYear > 0 ? valuePerTeacherPerYear / SCHOOL_PRICING.annualPerTeacher : 0;
    const paybackMonths =
        valuePerTeacherPerYear > 0 ? (12 * SCHOOL_PRICING.annualPerTeacher) / valuePerTeacherPerYear : 0;
    const fteEquivalent = hoursReclaimedSchool / SAVINGS_MODEL.fteHoursPerYear;

    return {
        teachers,
        salaryPerMonth,
        hourlyCost,
        hoursPerTeacherPerYear,
        hoursReclaimedSchool,
        valuePerTeacherPerYear,
        valueSchoolPerYear,
        sahayakaiCostPerYear,
        netSavingsPerYear,
        roiMultiple,
        paybackMonths,
        fteEquivalent,
    };
}
