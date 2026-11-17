/**
 * @jest-environment jsdom
 */
/**
 * renderPdfToImages — the browser half of multi-page PDF support.
 *
 * pdfjs is faked (jsdom has no canvas); each fake page "draws" its page number
 * so the test can prove image i came from PDF page i. The real pdfjs path is
 * exercised by scripts/assessment-scanner/verify-pdf-render.mjs in Chromium.
 *
 * Class gates:
 *   - every page 1..N is rendered, in order (no first-N truncation);
 *   - a PDF bigger than the remaining slots is rejected BEFORE rendering;
 *   - a failure on page k names page k and returns nothing (no partial PDF);
 *   - the LEGACY pdfjs build is used (the modern one needs
 *     Map.prototype.getOrInsertComputed: Chrome ≥145 / Safari ≥26.2 only).
 */
const mockGetDocument = jest.fn();
const mockWorkerOptions: { workerSrc?: string } = {};

jest.mock(
    'pdfjs-dist/legacy/build/pdf.mjs',
    () => ({ getDocument: (...a: unknown[]) => mockGetDocument(...a), GlobalWorkerOptions: mockWorkerOptions }),
    { virtual: true },
);
jest.mock('pdfjs-dist', () => {
    throw new Error('the modern pdfjs build must not be imported (no polyfills)');
});

import { renderPdfToImages, PdfRenderError } from '@/app/assessment-scanner/pdf-to-images';
import { ASSESSMENT_MAX_PDF_BYTES } from '@/ai/schemas/assessment-scanner-constants';

// Fake canvas: toDataURL reports the last page number "drawn" on it.
let lastDrawn = 0;
beforeAll(() => {
    jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
        () => ({ fillRect: jest.fn(), fillStyle: '' }) as unknown as CanvasRenderingContext2D,
    );
    jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(
        () => `data:image/jpeg;base64,PAGE${lastDrawn}`,
    );
});

function fakePdf(numPages: number, opts: { failRenderOn?: number; failGetOn?: number } = {}) {
    const getPage = jest.fn(async (n: number) => {
        if (n === opts.failGetOn) throw new Error('bad xref');
        return {
            getViewport: ({ scale }: { scale: number }) => ({ width: 600 * scale, height: 800 * scale }),
            render: () => ({
                promise: (async () => {
                    if (n === opts.failRenderOn) throw new Error('render failed');
                    lastDrawn = n;
                })(),
            }),
            cleanup: jest.fn(),
        };
    });
    const destroy = jest.fn().mockResolvedValue(undefined);
    mockGetDocument.mockReturnValue({ promise: Promise.resolve({ numPages, getPage }), destroy });
    return { getPage, destroy };
}

const file = (bytes = 10) => {
    const f = new File([new Uint8Array(bytes)], 'synthetic.pdf', { type: 'application/pdf' });
    // jsdom's File lacks arrayBuffer() in some versions.
    if (!(f as { arrayBuffer?: unknown }).arrayBuffer) {
        Object.defineProperty(f, 'arrayBuffer', { value: async () => new ArrayBuffer(bytes), configurable: true });
    }
    return f;
};

beforeEach(() => {
    mockGetDocument.mockReset();
    lastDrawn = 0;
});

describe('every page, in order', () => {
    it.each([1, 3, 4, 5, 10])('%i-page PDF → %i images, page i in slot i', async (n) => {
        const { getPage, destroy } = fakePdf(n);
        const progress: Array<[number, number]> = [];
        const out = await renderPdfToImages(file(), {
            maxPages: 10,
            onProgress: (d, t) => progress.push([d, t]),
        });
        expect(out.totalPages).toBe(n);
        expect(out.images).toEqual(Array.from({ length: n }, (_, i) => `data:image/jpeg;base64,PAGE${i + 1}`));
        expect(getPage.mock.calls.map((c) => c[0])).toEqual(Array.from({ length: n }, (_, i) => i + 1));
        expect(progress).toEqual(Array.from({ length: n }, (_, i) => [i + 1, n]));
        expect(destroy).toHaveBeenCalled();
    });

    it('uses the legacy (polyfilled) pdfjs build and its matching worker', async () => {
        fakePdf(1);
        await renderPdfToImages(file(), { maxPages: 10 });
        expect(mockWorkerOptions.workerSrc).toMatch(/pdfjs-dist\/legacy\/build\/pdf\.worker\.min\.mjs$/);
    });
});

describe('rejections — whole PDF, never a partial set', () => {
    it('more pages than slots → PDF_TOO_MANY_PAGES before any page is rendered', async () => {
        const { getPage, destroy } = fakePdf(11);
        await expect(renderPdfToImages(file(), { maxPages: 10 })).rejects.toMatchObject({
            code: 'PDF_TOO_MANY_PAGES',
            details: { totalPages: 11, maxPages: 10 },
        });
        expect(getPage).not.toHaveBeenCalled();
        expect(destroy).toHaveBeenCalled();
    });

    it('respects the REMAINING slots, not just the cap (4 pages into 3 free slots)', async () => {
        fakePdf(4);
        await expect(renderPdfToImages(file(), { maxPages: 3 })).rejects.toMatchObject({
            code: 'PDF_TOO_MANY_PAGES',
        });
    });

    it.each([
        ['render', { failRenderOn: 4 }],
        ['getPage', { failGetOn: 4 }],
    ])('a %s failure on page 4 of 6 → PDF_PAGE_RENDER_FAILED naming page 4', async (_l, opts) => {
        fakePdf(6, opts);
        const err = await renderPdfToImages(file(), { maxPages: 10 }).catch((e) => e);
        expect(err).toBeInstanceOf(PdfRenderError);
        expect(err.code).toBe('PDF_PAGE_RENDER_FAILED');
        expect(err.details.pageNumber).toBe(4);
    });

    it('a 0-page PDF → PDF_EMPTY', async () => {
        fakePdf(0);
        await expect(renderPdfToImages(file(), { maxPages: 10 })).rejects.toMatchObject({ code: 'PDF_EMPTY' });
    });

    it('a password-protected PDF → PDF_PASSWORD_PROTECTED', async () => {
        mockGetDocument.mockReturnValue({
            promise: Promise.reject(Object.assign(new Error('No password given'), { name: 'PasswordException' })),
            destroy: jest.fn().mockResolvedValue(undefined),
        });
        await expect(renderPdfToImages(file(), { maxPages: 10 })).rejects.toMatchObject({
            code: 'PDF_PASSWORD_PROTECTED',
        });
    });

    it('a corrupt PDF → PDF_UNREADABLE', async () => {
        mockGetDocument.mockReturnValue({
            promise: Promise.reject(Object.assign(new Error('Invalid PDF structure'), { name: 'InvalidPDFException' })),
            destroy: jest.fn().mockResolvedValue(undefined),
        });
        await expect(renderPdfToImages(file(), { maxPages: 10 })).rejects.toMatchObject({ code: 'PDF_UNREADABLE' });
    });

    it('an oversized file is rejected before its bytes are read or pdfjs is loaded', async () => {
        const f = new File([new Uint8Array(1)], 'big.pdf', { type: 'application/pdf' });
        Object.defineProperty(f, 'size', { value: ASSESSMENT_MAX_PDF_BYTES + 1 });
        const readSpy = jest.fn();
        Object.defineProperty(f, 'arrayBuffer', { value: readSpy, configurable: true });
        await expect(renderPdfToImages(f, { maxPages: 10 })).rejects.toMatchObject({ code: 'PDF_TOO_LARGE' });
        expect(readSpy).not.toHaveBeenCalled();
        expect(mockGetDocument).not.toHaveBeenCalled();
    });
});
