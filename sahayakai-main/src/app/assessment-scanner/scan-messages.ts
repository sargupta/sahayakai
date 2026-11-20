/**
 * Teacher-facing messages for Assessment Scanner upload failures.
 *
 * Kept out of the page component so the code → message mapping is unit-testable
 * and every string goes through `t()` (placeholders filled with the repo's
 * `{{token}}` .replace() convention, since `t` has no interpolation).
 */
import type { PdfRenderError } from './pdf-to-images';
import { ASSESSMENT_MAX_REQUEST_BYTES } from '@/ai/schemas/assessment-scanner-constants';

type Translate = (key: string) => string;

const MB = 1024 * 1024;
const mb = (bytes: number) => (bytes / MB).toFixed(1);

export function pdfErrorMessage(err: PdfRenderError, t: Translate, pageCap: number): string {
    const d = err.details;
    switch (err.code) {
        case 'PDF_TOO_LARGE':
            return t('This PDF is {{size}} MB — the limit is {{limit}} MB. Re-export it at a lower resolution, or upload the pages as photos.')
                .replace('{{size}}', mb(d.fileBytes ?? 0))
                .replace('{{limit}}', String(Math.round((d.maxBytes ?? 0) / MB)));
        case 'PDF_PASSWORD_PROTECTED':
            return t('This PDF is password-protected. Remove the password (or print it to a new PDF), then upload it again.');
        case 'PDF_EMPTY':
            return t('This PDF has no pages to add.');
        case 'PDF_TOO_MANY_PAGES':
            return t('This PDF has {{total}} pages, but only {{remaining}} more can be added (limit {{cap}} pages per scan). Nothing was added. Split the PDF, or remove pages already added.')
                .replace('{{total}}', String(d.totalPages ?? 0))
                .replace('{{remaining}}', String(d.maxPages ?? 0))
                .replace('{{cap}}', String(pageCap));
        case 'PDF_PAGE_RENDER_FAILED':
            return t('Page {{page}} of this PDF could not be read, so nothing was added. Re-export the PDF, or upload that page as a photo.')
                .replace('{{page}}', String(d.pageNumber ?? 0));
        case 'PDF_CANVAS_UNAVAILABLE':
            return t('Your browser could not render the PDF. Try another browser, or upload the pages as photos.');
        case 'PDF_UNREADABLE':
        default:
            return t('Could not open this PDF — it may be corrupt. Re-export it, or upload the pages as images instead.');
    }
}

export function scanRequestTooLargeMessage(bodyBytes: number, t: Translate): string {
    return t('These pages add up to {{size}} MB — a scan can upload at most {{limit}} MB. Remove a page or two, or use smaller photos, and try again.')
        .replace('{{size}}', mb(bodyBytes))
        .replace('{{limit}}', mb(ASSESSMENT_MAX_REQUEST_BYTES));
}
