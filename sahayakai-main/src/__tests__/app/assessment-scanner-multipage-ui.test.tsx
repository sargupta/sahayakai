/**
 * @jest-environment jsdom
 */
/**
 * Assessment Scanner page — multi-page upload → request → result, in the UI.
 *
 * The PDF renderer is faked (jsdom has no canvas); its real behaviour is
 * covered in pdf-to-images.test.ts and by the browser harness in
 * scripts/assessment-scanner/. What this pins is the PAGE's contract:
 *   - a 5-page PDF adds 5 pages (the counter shows 5 / 10) and shows real
 *     render progress while it works;
 *   - the request carries all 5 pages in order;
 *   - the result shows every page's questions, each labelled with its page;
 *   - a PDF that doesn't fit is rejected with nothing added (no silent cut);
 *   - an oversized request is stopped before upload with a clear message;
 *   - the banner states the real cap (it used to say "up to 3 pages").
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockRender = jest.fn();
jest.mock('@/app/assessment-scanner/pdf-to-images', () => {
    const actual = jest.requireActual('@/app/assessment-scanner/pdf-to-images');
    return { ...actual, renderPdfToImages: (...a: unknown[]) => mockRender(...a) };
});

jest.mock('@/components/image-uploader', () => ({
    ImageUploader: ({ onPdfSelected }: { onPdfSelected?: (f: File) => void }) => (
        <button
            type="button"
            onClick={() => onPdfSelected?.(new File(['%PDF'], 'synthetic.pdf', { type: 'application/pdf' }))}
        >
            pick-pdf
        </button>
    ),
}));

jest.mock('@/context/auth-context', () => ({
    useAuth: () => ({
        user: { uid: 'synthetic-teacher', displayName: 'Test Teacher', getIdToken: async () => 'token' },
        loading: false,
        requireAuth: () => true,
        openAuthModal: jest.fn(),
    }),
}));
jest.mock('@/context/language-context', () => ({
    useLanguage: () => ({ t: (s: string) => s, language: 'English' }),
}));
jest.mock('next/navigation', () => ({
    useSearchParams: () => ({ get: () => null }),
    useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
    usePathname: () => '/assessment-scanner',
}));
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: Record<string, unknown>) => <img {...(props as object)} />,
}));
jest.mock('@/components/grade-level-selector', () => ({ GradeLevelSelector: () => <div /> }));
jest.mock('@/components/language-selector', () => ({ LanguageSelector: () => <div /> }));
jest.mock('@/lib/firebase-admin', () => ({ getDb: jest.fn() }));
jest.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: jest.fn() }) }));

import AssessmentScannerPage from '@/app/assessment-scanner/page';
import { PdfRenderError } from '@/app/assessment-scanner/pdf-to-images';
import { ASSESSMENT_DEMO_PAGE_CAP } from '@/ai/schemas/assessment-scanner-constants';

const img = (n: number) => `data:image/jpeg;base64,PAGE${n}`;

function resultFor(pageCount: number) {
    return {
        assessmentId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'graded',
        pageCount,
        totalAwardedMarks: pageCount,
        totalMaxMarks: pageCount,
        scorePct: 100,
        letterGrade: 'A+',
        questions: Array.from({ length: pageCount }, (_, i) => ({
            questionId: `p${i}-q1`,
            pageIndex: i,
            questionType: 'short_answer',
            questionText: `SYNTH page ${i + 1} question`,
            studentAnswer: 'a',
            expectedAnswer: 'a',
            marksAwarded: 1,
            marksMax: 1,
            partialCreditBreakdown: [],
            feedback: 'ok',
            improvementPoints: [],
            conceptTested: 'c',
            ncertChapterId: null,
            mistakePattern: 'none',
            needsTeacherReview: false,
            confidence: 0.9,
        })),
        classAverageAtScan: null,
        conceptMastery: [],
        recommendedNextSteps: [],
        studentRecommendations: [],
        teacherParentNote: [],
        needsReviewCount: 0,
        imageQualityWarnings: [],
        skippedPageNotices: [],
    };
}

let fetchMock: jest.Mock;
beforeEach(() => {
    mockRender.mockReset();
    fetchMock = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = fetchMock;
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('states the real page cap in the banner (not the stale "up to 3")', () => {
    render(<AssessmentScannerPage />);
    expect(
        screen.getByText(`Now supporting six subject families, up to ${ASSESSMENT_DEMO_PAGE_CAP} pages per scan`),
    ).toBeInTheDocument();
    expect(screen.queryByText(/up to 3 pages/)).not.toBeInTheDocument();
});

it('5-page PDF: all pages added with progress, all sent in order, every page shown in the result', async () => {
    let finish: (v: { images: string[]; totalPages: number }) => void = () => {};
    mockRender.mockImplementation(
        (_f: File, opts: { maxPages: number; onProgress?: (d: number, t: number) => void }) => {
            expect(opts.maxPages).toBe(ASSESSMENT_DEMO_PAGE_CAP);
            opts.onProgress?.(3, 5);
            return new Promise((r) => (finish = r));
        },
    );
    render(<AssessmentScannerPage />);
    fireEvent.click(screen.getByText('pick-pdf'));
    expect(await screen.findByTestId('pdf-progress')).toHaveTextContent('Reading PDF page 3 of 5…');
    await act(async () => finish({ images: [1, 2, 3, 4, 5].map(img), totalPages: 5 }));
    expect(screen.getByText(`5 / ${ASSESSMENT_DEMO_PAGE_CAP}`)).toBeInTheDocument();

    let resolveFetch: (v: unknown) => void = () => {};
    fetchMock.mockImplementation(() => new Promise((r) => (resolveFetch = r)));
    fireEvent.click(screen.getByRole('button', { name: /Grade this assessment/ }));

    expect(await screen.findByTestId('grading-status')).toHaveTextContent(
        'Uploading and grading 5 pages. This can take up to 2 minutes.',
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/ai/assessment-scanner');
    expect(JSON.parse(init.body).pageUrls).toEqual([1, 2, 3, 4, 5].map(img));

    await act(async () =>
        resolveFetch({ ok: true, status: 200, json: async () => resultFor(5) }),
    );
    for (let p = 1; p <= 5; p++) {
        expect(await screen.findByText(new RegExp(`SYNTH page ${p} question`))).toBeInTheDocument();
    }
    // Each question is labelled with its source page (badge renders when expanded,
    // so check the accordion content count instead of visibility).
    expect(screen.getAllByText(/SYNTH page \d question/)).toHaveLength(5);
});

it('a PDF too big for the remaining slots is rejected whole — nothing added', async () => {
    mockRender.mockRejectedValue(
        new PdfRenderError('too many', 'PDF_TOO_MANY_PAGES', { totalPages: 12, maxPages: 10 }),
    );
    render(<AssessmentScannerPage />);
    fireEvent.click(screen.getByText('pick-pdf'));
    expect(
        await screen.findByText(
            `This PDF has 12 pages, but only 10 more can be added (limit ${ASSESSMENT_DEMO_PAGE_CAP} pages per scan). Nothing was added. Split the PDF, or remove pages already added.`,
        ),
    ).toBeInTheDocument();
    expect(screen.getByText(`0 / ${ASSESSMENT_DEMO_PAGE_CAP}`)).toBeInTheDocument();
});

it('a page that fails to render names the page and adds nothing', async () => {
    mockRender.mockRejectedValue(
        new PdfRenderError('x', 'PDF_PAGE_RENDER_FAILED', { pageNumber: 4, totalPages: 6 }),
    );
    render(<AssessmentScannerPage />);
    fireEvent.click(screen.getByText('pick-pdf'));
    expect(await screen.findByText(/^Page 4 of this PDF could not be read, so nothing was added/)).toBeInTheDocument();
    expect(screen.getByText(`0 / ${ASSESSMENT_DEMO_PAGE_CAP}`)).toBeInTheDocument();
});

it('an oversized request is stopped before upload with a clear message', async () => {
    // 3 × 3.3 MB ≈ 9.9 MB of page data: just over the 9.5 MB request ceiling.
    const big = 'data:image/jpeg;base64,' + 'A'.repeat(3_300_000);
    mockRender.mockResolvedValue({ images: [big, big, big], totalPages: 3 });
    render(<AssessmentScannerPage />);
    fireEvent.click(screen.getByText('pick-pdf'));
    await screen.findByText(`3 / ${ASSESSMENT_DEMO_PAGE_CAP}`, undefined, { timeout: 10_000 });
    fireEvent.click(screen.getByRole('button', { name: /Grade this assessment/ }));
    const alert = await screen.findByText(
        /^These pages add up to 9\.4 MB — a scan can upload at most 9\.1 MB/,
        undefined,
        { timeout: 10_000 },
    );
    expect(alert).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
}, 30_000);

it('a server error is shown as a failed scan with retry (not an empty result)', async () => {
    mockRender.mockResolvedValue({ images: [1, 2, 3, 4].map(img), totalPages: 4 });
    fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ code: 'PAGE_LIMIT_EXCEEDED', message: 'Up to 10 pages per scan in the current release. You sent 11.' }),
    });
    render(<AssessmentScannerPage />);
    fireEvent.click(screen.getByText('pick-pdf'));
    await screen.findByText(`4 / ${ASSESSMENT_DEMO_PAGE_CAP}`);
    fireEvent.click(screen.getByRole('button', { name: /Grade this assessment/ }));
    const failed = await screen.findByText('Scan failed');
    const box = failed.closest('[role="alert"]') as HTMLElement;
    expect(within(box).getByText(/You sent 11/)).toBeInTheDocument();
    expect(within(box).getByRole('button', { name: /Try again/ })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText(/SYNTH page/)).not.toBeInTheDocument());
});
