/**
 * Client-side PDF → page-image conversion for the Assessment Scanner.
 *
 * Renders each PDF page to a JPEG data URI in the browser (canvas), so the rest
 * of the scanner pipeline stays image-only — the server flow never learns about
 * PDFs. `pdfjs-dist` is loaded via a dynamic import so it is code-split out of
 * the initial bundle and never evaluated during SSR (it touches DOM globals).
 */

/** Thrown when a PDF can't be opened/rendered — carries a teacher-facing message. */
export class PdfRenderError extends Error {
    constructor(
        message: string,
        readonly cause?: unknown,
    ) {
        super(message);
        this.name = 'PdfRenderError';
    }
}

export interface RenderPdfOptions {
    /** Hard cap on pages to render (usually the remaining page-slot budget). */
    maxPages: number;
    /** Target long-edge in px for the rendered image (default 1536, matches OCR). */
    maxDimension?: number;
    /** JPEG quality 0..1 (default 0.85). */
    quality?: number;
}

export interface RenderPdfResult {
    /** JPEG data URIs, one per rendered page (length ≤ maxPages). */
    images: string[];
    /** Total pages in the PDF — may exceed images.length when capped. */
    totalPages: number;
}

/**
 * Render up to `maxPages` pages of `file` to JPEG data URIs. Throws
 * `PdfRenderError` for an unopenable (corrupt / password-protected) PDF.
 */
export async function renderPdfToImages(
    file: File,
    { maxPages, maxDimension = 1536, quality = 0.85 }: RenderPdfOptions,
): Promise<RenderPdfResult> {
    if (maxPages <= 0) return { images: [], totalPages: 0 };

    // Dynamic import: keeps pdfjs-dist out of SSR + the initial bundle.
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

    const data = new Uint8Array(await file.arrayBuffer());

    const loadingTask = pdfjsLib.getDocument({ data });
    let pdf;
    try {
        pdf = await loadingTask.promise;
    } catch (err) {
        throw new PdfRenderError(
            'Could not open this PDF — it may be corrupt or password-protected. Re-export it, or upload the pages as images instead.',
            err,
        );
    }

    try {
        const totalPages = pdf.numPages;
        const renderCount = Math.min(totalPages, maxPages);
        const images: string[] = [];

        for (let pageNum = 1; pageNum <= renderCount; pageNum++) {
            const page = await pdf.getPage(pageNum);
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
                    throw new PdfRenderError('Your browser could not render the PDF (canvas unavailable).');
                }
                // PDFs may have a transparent background — paint white so OCR sees
                // a normal white page rather than black.
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // v6 API: pass `canvas` (canvasContext is legacy). pdfjs composites
                // over the white fill we just painted, so transparent PDFs stay white.
                await page.render({ canvas, viewport }).promise;
                images.push(canvas.toDataURL('image/jpeg', quality));
            } finally {
                page.cleanup();
            }
        }

        return { images, totalPages };
    } finally {
        await loadingTask.destroy();
    }
}
