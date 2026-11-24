/**
 * Export watermark: text policy (src/lib/access/watermark.ts) and the PDF
 * footer helpers in src/lib/export-pdf.ts.
 */
import { buildWatermarkText } from '@/lib/access/watermark';
import { stampPdfFooter, toPdfSafeText } from '@/lib/export-pdf';

const AT = new Date('2026-11-24T10:00:00Z');

describe('buildWatermarkText', () => {
    it('marks a pilot export with organisation, email and date', () => {
        expect(
            buildWatermarkText({
                access: 'pilot',
                orgName: 'Don Bosco School',
                schoolName: 'ignored when an organisation is known',
                email: 'teacher@example.com',
                at: AT,
            }),
        ).toBe('Evaluation copy · Don Bosco School · teacher@example.com · 2026-11-24 · Not for redistribution');
    });

    it('falls back to the profile school name, then to a generic label', () => {
        expect(buildWatermarkText({ access: 'pilot', schoolName: 'St. Mary', email: 'a@b.in', at: AT }))
            .toBe('Evaluation copy · St. Mary · a@b.in · 2026-11-24 · Not for redistribution');
        expect(buildWatermarkText({ access: 'pilot', at: AT }))
            .toBe('Evaluation copy · SahayakAI pilot · 2026-11-24 · Not for redistribution');
    });

    it('marks an active school seat as licensed', () => {
        expect(buildWatermarkText({ access: 'active', orgName: 'Delhi Public School', email: 'x@y.in' }))
            .toBe('Licensed to Delhi Public School');
    });

    it.each([
        ['legacy', 'Any School'],
        ['active', null],
        ['pending', 'Any School'],
        ['blocked', 'Any School'],
        ['expired', 'Any School'],
        ['none', 'Any School'],
        [null, 'Any School'],
        [undefined, 'Any School'],
    ])('returns null for access=%s orgName=%s', (access, orgName) => {
        const org = access === 'active' ? null : orgName;
        expect(buildWatermarkText({ access, orgName: org, schoolName: 'Some School', email: 'x@y.in' })).toBeNull();
    });

    it('never marks a legacy account even when it belongs to an organisation', () => {
        expect(buildWatermarkText({ access: 'legacy', orgName: 'Some Org' })).toBeNull();
    });

    it('collapses whitespace, strips control characters and bounds each part', () => {
        const text = buildWatermarkText({
            access: 'pilot',
            orgName: `  Line\nbreak\tSchool  ${'x'.repeat(200)}`,
            email: 'a@b.in',
            at: AT,
        });
        expect(text).not.toBeNull();
        expect(text).not.toMatch(/[\n\t]/);
        const orgPart = (text as string).split(' · ')[1];
        expect(orgPart.startsWith('Line break School')).toBe(true);
        expect(orgPart.length).toBeLessThanOrEqual(80);
    });

    it('omits the date when given an invalid Date instead of printing "Invalid Date"', () => {
        const text = buildWatermarkText({ access: 'pilot', orgName: 'Org', at: new Date('nonsense') });
        expect(text).toBe('Evaluation copy · Org · Not for redistribution');
    });
});

describe('toPdfSafeText', () => {
    it('keeps Latin-1 text including the separator', () => {
        expect(toPdfSafeText('Evaluation copy · École · a@b.in')).toBe('Evaluation copy · École · a@b.in');
    });

    it('drops scripts the built-in PDF font cannot draw and tidies separators', () => {
        expect(toPdfSafeText('Evaluation copy · বিদ্যালয় · a@b.in')).toBe('Evaluation copy · a@b.in');
    });

    it('replaces the ellipsis with ASCII dots', () => {
        expect(toPdfSafeText('Long name…')).toBe('Long name...');
    });
});

describe('stampPdfFooter', () => {
    function fakePdf(pages: number) {
        return {
            getNumberOfPages: jest.fn(() => pages),
            setPage: jest.fn(),
            setFillColor: jest.fn(),
            rect: jest.fn(),
            setFont: jest.fn(),
            setFontSize: jest.fn(),
            setTextColor: jest.fn(),
            text: jest.fn(),
        };
    }

    it('stamps every page once', () => {
        const pdf = fakePdf(3);
        stampPdfFooter(pdf, 'Licensed to Org');
        expect(pdf.setPage.mock.calls.map((c) => c[0])).toEqual([1, 2, 3]);
        expect(pdf.text).toHaveBeenCalledTimes(3);
        expect(pdf.text.mock.calls[0][0]).toBe('Licensed to Org');
        expect(pdf.rect).toHaveBeenCalledTimes(3);
    });

    it('does nothing when no drawable text remains', () => {
        const pdf = fakePdf(2);
        stampPdfFooter(pdf, 'বিদ্যালয়');
        expect(pdf.text).not.toHaveBeenCalled();
        expect(pdf.setPage).not.toHaveBeenCalled();
    });
});
