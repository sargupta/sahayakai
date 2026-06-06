/**
 * F18-01 / F18-02 / F18-03 unit tests for grade-band derivation.
 */
import {
    getGradeBand,
    defaultNumQuestionsForBand,
    defaultNumQuestionsForGrade,
    getBandDisplayLabel,
    getPedagogyFrameworkBlock,
} from '@/lib/grade-bands';

describe('getGradeBand', () => {
    it('classifies Class 1-5 as primary', () => {
        expect(getGradeBand('Class 1')).toBe('primary');
        expect(getGradeBand('Class 3')).toBe('primary');
        expect(getGradeBand('Class 5')).toBe('primary');
        expect(getGradeBand('Grade 4')).toBe('primary');
        expect(getGradeBand('5th')).toBe('primary');
    });

    it('classifies Class 6-8 as middle', () => {
        expect(getGradeBand('Class 6')).toBe('middle');
        expect(getGradeBand('Class 7')).toBe('middle');
        expect(getGradeBand('Class 8')).toBe('middle');
    });

    it('classifies Class 9-10 as secondary', () => {
        expect(getGradeBand('Class 9')).toBe('secondary');
        expect(getGradeBand('Class 10')).toBe('secondary');
    });

    it('classifies Class 11-12 as senior', () => {
        expect(getGradeBand('Class 11')).toBe('senior');
        expect(getGradeBand('Class 12')).toBe('senior');
    });

    it('collapses pre-primary into primary band', () => {
        expect(getGradeBand('Nursery')).toBe('primary');
        expect(getGradeBand('LKG')).toBe('primary');
        expect(getGradeBand('UKG')).toBe('primary');
    });

    it('falls back to middle for unparseable input', () => {
        expect(getGradeBand(undefined)).toBe('middle');
        expect(getGradeBand(null)).toBe('middle');
        expect(getGradeBand('')).toBe('middle');
        expect(getGradeBand('something weird')).toBe('middle');
    });
});

describe('defaultNumQuestionsForBand', () => {
    it('returns 5 / 10 / 15 / 20 for primary / middle / secondary / senior', () => {
        expect(defaultNumQuestionsForBand('primary')).toBe(5);
        expect(defaultNumQuestionsForBand('middle')).toBe(10);
        expect(defaultNumQuestionsForBand('secondary')).toBe(15);
        expect(defaultNumQuestionsForBand('senior')).toBe(20);
    });
});

describe('defaultNumQuestionsForGrade', () => {
    it('derives count from a single label', () => {
        expect(defaultNumQuestionsForGrade('Class 3')).toBe(5);
        expect(defaultNumQuestionsForGrade('Class 7')).toBe(10);
        expect(defaultNumQuestionsForGrade('Class 10')).toBe(15);
        expect(defaultNumQuestionsForGrade('Class 12')).toBe(20);
    });

    it('uses the first label when given an array', () => {
        expect(defaultNumQuestionsForGrade(['Class 11', 'Class 12'])).toBe(20);
        expect(defaultNumQuestionsForGrade(['Class 6', 'Class 7'])).toBe(10);
    });

    it('falls back to middle default (10) for unparseable input', () => {
        expect(defaultNumQuestionsForGrade(undefined)).toBe(10);
        expect(defaultNumQuestionsForGrade(null)).toBe(10);
    });
});

describe('getBandDisplayLabel', () => {
    it('returns human-readable labels', () => {
        expect(getBandDisplayLabel('primary')).toMatch(/Primary.*1-5/);
        expect(getBandDisplayLabel('middle')).toMatch(/Middle.*6-8/);
        expect(getBandDisplayLabel('secondary')).toMatch(/Secondary.*9-10/);
        expect(getBandDisplayLabel('senior')).toMatch(/Senior.*11-12/);
    });
});

describe('getPedagogyFrameworkBlock', () => {
    it('produces band-specific pedagogy block', () => {
        const primary = getPedagogyFrameworkBlock('primary');
        expect(primary).toMatch(/Story/i);
        expect(primary).toMatch(/Primary/i);

        const middle = getPedagogyFrameworkBlock('middle');
        expect(middle).toMatch(/5E/);
        expect(middle).toMatch(/Inquiry/i);

        const secondary = getPedagogyFrameworkBlock('secondary');
        expect(secondary).toMatch(/Board/i);
        expect(secondary).toMatch(/exam/i);

        const senior = getPedagogyFrameworkBlock('senior');
        expect(senior).toMatch(/JEE|NEET|CUET|competitive/i);
    });

    it('every band still uses the 5E phase vocabulary so schema enum survives', () => {
        for (const band of ['primary', 'middle', 'secondary', 'senior'] as const) {
            const block = getPedagogyFrameworkBlock(band);
            expect(block).toMatch(/Engage/);
            expect(block).toMatch(/Explore/);
            expect(block).toMatch(/Explain/);
            expect(block).toMatch(/Elaborate/);
            expect(block).toMatch(/Evaluate/);
        }
    });
});
