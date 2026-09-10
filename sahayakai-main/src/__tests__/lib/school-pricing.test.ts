/**
 * Regression gate for the school/chain pricing norm (src/lib/school-pricing.ts):
 *   ₹10,000/teacher/year, ₹1,600/teacher/month, parent calls ₹4/minute, +18% GST.
 *
 * Locks the arithmetic and the input clamping so a future edit to the rates or
 * the formula fails loudly instead of silently misquoting a school.
 */
import {
    estimateSchoolCost,
    SCHOOL_PRICING,
    estimateSchoolSavings,
    SAVINGS_WEEKLY_HOURS,
    SAVINGS_HOURS_PER_TEACHER_YEAR,
    SAVINGS_CAPABILITIES,
} from '@/lib/school-pricing';

const base = {
    teachers: 25,
    billing: 'annual' as const,
    includeParentCalls: true,
    students: 400,
    callsPerStudentPerYear: 6,
    avgMinutesPerCall: 3,
};

describe('estimateSchoolCost', () => {
    it('uses the confirmed norm rates', () => {
        expect(SCHOOL_PRICING.annualPerTeacher).toBe(10000);
        expect(SCHOOL_PRICING.monthlyPerTeacher).toBe(1600);
        expect(SCHOOL_PRICING.parentCallRatePerMin).toBe(4);
        expect(SCHOOL_PRICING.gstRate).toBe(0.18);
    });

    it('prices 25 teachers annually + parent calls with GST', () => {
        const r = estimateSchoolCost(base);
        expect(r.teacherSubtotal).toBe(250000); // 25 × 10,000
        expect(r.parentCallMinutesPerYear).toBe(7200); // 400 × 6 × 3
        expect(r.parentCallCostPerYear).toBe(28800); // 7,200 × 4
        expect(r.subtotalPerYear).toBe(278800);
        expect(r.gst).toBeCloseTo(50184, 5); // 278,800 × 0.18
        expect(r.totalPerYearInclGst).toBeCloseTo(328984, 5);
    });

    it('annualised monthly costs more than annual and drives the saving', () => {
        const monthly = estimateSchoolCost({ ...base, billing: 'monthly' });
        expect(monthly.teacherSubtotal).toBe(480000); // 25 × 1,600 × 12
        expect(monthly.perTeacherPerYear).toBe(19200);
        expect(monthly.annualSavingVsMonthly).toBe(230000); // 480,000 − 250,000
    });

    it('excludes parent calls when the toggle is off', () => {
        const r = estimateSchoolCost({ ...base, includeParentCalls: false });
        expect(r.parentCallMinutesPerYear).toBe(0);
        expect(r.parentCallCostPerYear).toBe(0);
        expect(r.subtotalPerYear).toBe(250000);
    });

    it('accepts fractional average call minutes', () => {
        const r = estimateSchoolCost({ ...base, avgMinutesPerCall: 3.5 });
        expect(r.parentCallMinutesPerYear).toBe(8400); // 400 × 6 × 3.5
        expect(r.parentCallCostPerYear).toBe(33600);
    });

    it('clamps negative, NaN and fractional teacher counts to a safe integer', () => {
        expect(estimateSchoolCost({ ...base, teachers: -5 }).teacherSubtotal).toBe(0);
        expect(estimateSchoolCost({ ...base, teachers: NaN }).teacherSubtotal).toBe(0);
        expect(estimateSchoolCost({ ...base, teachers: 10.9 }).teacherSubtotal).toBe(100000); // floor(10.9)=10
    });

    it('zeroes everything at zero teachers and no calls', () => {
        const r = estimateSchoolCost({
            teachers: 0,
            billing: 'annual',
            includeParentCalls: false,
            students: 0,
            callsPerStudentPerYear: 0,
            avgMinutesPerCall: 0,
        });
        expect(r.subtotalPerYear).toBe(0);
        expect(r.gst).toBe(0);
        expect(r.totalPerYearInclGst).toBe(0);
    });
});

/**
 * Regression gate for the value/savings model (methodology v1.0). Locks the
 * itemised hours, the 410 hrs/teacher/yr total, and the published salary-band
 * values so the on-page ROI can never silently drift from the proposal.
 */
describe('estimateSchoolSavings', () => {
    it('uses the methodology hours (10.8/wk across 9 tools → 410/yr)', () => {
        expect(SAVINGS_CAPABILITIES).toHaveLength(9);
        expect(SAVINGS_WEEKLY_HOURS).toBeCloseTo(10.8, 5);
        expect(SAVINGS_HOURS_PER_TEACHER_YEAR).toBe(410);
    });

    it('reproduces the published per-teacher value bands (salary ÷ 176 × 410)', () => {
        const band = (salaryPerMonth: number) =>
            Math.round(estimateSchoolSavings({ teachers: 1, salaryPerMonth }).valuePerTeacherPerYear / 100) * 100;
        expect(band(20000)).toBe(46600);
        expect(band(30000)).toBe(69900);
        expect(band(40000)).toBe(93200);
        expect(band(50000)).toBe(116500);
        expect(band(60000)).toBe(139800);
    });

    it('computes a 30-teacher school at ₹30k against the current ₹10,000 price', () => {
        const r = estimateSchoolSavings({ teachers: 30, salaryPerMonth: 30000 });
        expect(r.hoursReclaimedSchool).toBe(12300); // 30 × 410
        expect(r.sahayakaiCostPerYear).toBe(300000); // 30 × 10,000
        expect(Math.round(r.netSavingsPerYear)).toBe(1796591); // ≈ ₹18L net
        expect(r.roiMultiple).toBeCloseTo(6.99, 1); // ~7× at the new price
        expect(r.paybackMonths).toBeCloseTo(1.72, 1);
        expect(r.fteEquivalent).toBeCloseTo(6.47, 2);
    });

    it('clamps bad input to zero (no NaN on the page)', () => {
        expect(estimateSchoolSavings({ teachers: -5, salaryPerMonth: 30000 }).valueSchoolPerYear).toBe(0);
        expect(estimateSchoolSavings({ teachers: 10, salaryPerMonth: NaN }).valuePerTeacherPerYear).toBe(0);
        expect(estimateSchoolSavings({ teachers: 10, salaryPerMonth: 0 }).roiMultiple).toBe(0);
    });
});
