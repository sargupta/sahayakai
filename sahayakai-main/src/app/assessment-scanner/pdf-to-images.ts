/**
 * Client-side PDF → page-image conversion for the Assessment Scanner.
 *
 * Renders each PDF page to a JPEG data URI in the browser (canvas), so the rest
 * of the scanner pipeline stays image-only — the server flow never learns about
 * PDFs. `pdfjs-dist` is loaded via a dynamic import so it is code-split out of
 * the initial bundle and never evaluated during SSR (it touches DOM globals).
 *
 * Multi-page contract (2026-10):
 *   - The page count is read BEFORE anything is rendered. A PDF with more pages
 *     than `maxPages` is REJECTED (`PDF_TOO_MANY_PAGES`) — never silently cut to
 *     its first N pages, because grading 10 of 12 pages produces a wrong total.
 *   - Every page 1..N is rendered in document order; a page that fails to render
 *     fails the whole PDF with the page number (`PDF_PAGE_RENDER_FAILED`), so a
 *     partial document can never be submitted as if it were complete.
 *   - The file size is checked before the bytes are read into memory.
 *
 * Browser support: the `legacy` pdfjs build is used on purpose. The modern build
 * of pdfjs-dist 6.x calls `Map.prototype.getOrInsertComputed`, which only exists
 * in Chrome/Edge ≥145, Firefox ≥144 and Safari ≥26.2 (absent from Samsung
 * Internet and older Android Chrome). On those browsers every PDF failed at the
 * first page. The legacy build ships the polyfills.
 */
import { ASSESSMENT_MAX_PDF_BYTES } from '@/ai/schemas/assessment-scanner-constants';

export type PdfRenderErrorCode =
    | 'PDF_TOO_LARGE'
    | 'PDF_UNREADABLE'
    | 'PDF_PASSWORD_PROTECTED'
    | 'PDF_EMPTY'
    | 'PDF_TOO_MANY_PAGES'
    | 'PDF_PAGE_RENDER_FAILED'
    | 'PDF_CANVAS_UNAVAILABLE';

/** Thrown when a PDF can't be used — carries a code + teacher-facing English message. */
export class PdfRenderError extends Error {
    constructor(
        message: string,
        readonly code: PdfRenderErrorCode = 'PDF_UNREADABLE',
        readonly details: {
            totalPages?: number;
            maxPages?: number;
            pageNumber?: number;
            fileBytes?: number;
            maxBytes?: number;
        } = {},
        readonly cause?: unknown,
    ) {
        super(message);
        this.name = 'PdfRenderError';
    }
}

export interface RenderPdfOptions {
    /** Most pages this PDF may contribute (usually the remaining page-slot budget). */
    maxPages: number;
    /** Largest accepted file, in bytes (default ASSESSMENT_MAX_PDF_BYTES). */
    maxBytes?: number;
    /** Target long-edge in px for the rendered image (default 1536, matches OCR). */
    maxDimension?: number;
    /** JPEG quality 0..1 (default 0.85). */
    quality?: number;
    /** Called after each page is rendered: (pagesRendered, totalPages). */
    onProgress?: (rendered: number, total: number) => void;
}

export interface RenderPdfResult {
    /** JPEG data URIs, one per PDF page, in document order (length === totalPages). */
    images: string[];
    /** Total pages in the PDF. */
    totalPages: number;
}

const MB = 1024 * 1024;

/**
 * Render EVERY page of `file` to a JPEG data URI, in order. Throws
 * `PdfRenderError` (with a `code`) for an oversized, unopenable, empty or
 * over-the-limit PDF, or for a page that cannot be rendered.
 */
export async function renderPdfToImages(
    file: File,
    {
        maxPages,
        maxBytes = ASSESSMENT_MAX_PDF_BYTES,
        maxDimension = 1536,
        quality = 0.85,
        onProgress,
    }: RenderPdfOptions,
): Promise<RenderPdfResult> {
    if (file.size > maxBytes) {
        throw new PdfRenderError(
            `This PDF is ${(file.size / MB).toFixed(1)} MB — the limit is ${Math.round(maxBytes / MB)} MB. Re-export it at a lower resolution, or upload the pages as photos.`,
            'PDF_TOO_LARGE',
            { fileBytes: file.size, maxBytes },
        );
    }

    // Dynamic import: keeps pdfjs-dist out of SSR + the initial bundle. Legacy
    // build: see the module comment (polyfills for pre-2026 browsers).
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
        import.meta.url,
    ).toString();

    const data = new Uint8Array(await file.arrayBuffer());

    const loadingTask = pdfjsLib.getDocument({ data });
    let pdf;
    try {
        pdf = await loadingTask.promise;
    } catch (err) {
        await loadingTask.destroy().catch(() => undefined);
        const isPassword = (err as { name?: string } | null)?.name === 'PasswordException';
        throw new PdfRenderError(
            isPassword
                ? 'This PDF is password-protected. Remove the password (or print it to a new PDF), then upload it again.'
                : 'Could not open this PDF — it may be corrupt. Re-export it, or upload the pages as images instead.',
            isPassword ? 'PDF_PASSWORD_PROTECTED' : 'PDF_UNREADABLE',
            {},
            err,
        );
    }

    try {
        const totalPages = pdf.numPages;
        if (totalPages === 0) {
            throw new PdfRenderError('This PDF has no pages.', 'PDF_EMPTY', { totalPages });
        }
        if (totalPages > maxPages) {
            throw new PdfRenderError(
                `This PDF has ${totalPages} pages, but only ${maxPages} more can be added to this scan. Split it into smaller PDFs, or remove pages already added.`,
                'PDF_TOO_MANY_PAGES',
                { totalPages, maxPages },
            );
        }

        const images: string[] = [];
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            let page;
            try {
                page = await pdf.getPage(pageNum);
            } catch (err) {
                throw new PdfRenderError(
                    `Page ${pageNum} of this PDF could not be read. Re-export the PDF, or upload that page as a photo.`,
                    'PDF_PAGE_RENDER_FAILED',
                    { pageNumber: pageNum, totalPages },
                    err,
                );
            }
            // cleanup() must run even if render()/toDataURL() throws mid-page, or
            // the page's resources leak until the whole document is destroyed.
            try {
                const unscaled = page.getViewport({ scale: 1 });
                const longEdge = Math.max(unscaled.width, unscaled.height) || 1;
                // Scale toward the target long edge; never upscale past 2× so a
                // scanned-image PDF isn't blown up into a blurry mess.
                const scale = Math.min(2, Math.max(0.2, maxDimension / longEdge));
                const viewport = page.getViewport({ scale });

                const canvas = document.createElement('canvas');
                canvas.width = Math.ceil(viewport.width);
                canvas.height = Math.ceil(viewport.height);
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    throw new PdfRenderError(
                        'Your browser could not render the PDF (canvas unavailable).',
                        'PDF_CANVAS_UNAVAILABLE',
                    );
                }
                // PDFs may have a transparent background — paint white so OCR sees
                // a normal white page rather than black.
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // v6 API: pass `canvas` (canvasContext is legacy). pdfjs composites
                // over the white fill we just painted, so transparent PDFs stay white.
                await page.render({ canvas, viewport }).promise;
                images.push(canvas.toDataURL('image/jpeg', quality));
                // Release the bitmap now rather than holding N full canvases.
                canvas.width = 0;
                canvas.height = 0;
            } catch (err) {
                if (err instanceof PdfRenderError) throw err;
                throw new PdfRenderError(
                    `Page ${pageNum} of this PDF could not be read. Re-export the PDF, or upload that page as a photo.`,
                    'PDF_PAGE_RENDER_FAILED',
                    { pageNumber: pageNum, totalPages },
                    err,
                );
            } finally {
                page.cleanup();
            }
            onProgress?.(pageNum, totalPages);
        }

        return { images, totalPages };
    } finally {
        await loadingTask.destroy();
    }
}
