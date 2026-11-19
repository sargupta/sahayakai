/** @jest-environment node */
/**
 * Class gate: the Assessment Scanner must never again tell teachers a page limit
 * the code doesn't enforce. The banner said "up to 3 pages per scan" in every
 * language for weeks after the cap was raised to 10, because the number was
 * baked into the string instead of read from ASSESSMENT_DEMO_PAGE_CAP.
 *
 *  1. No scanner UI source hard-codes a page count in user-visible copy.
 *  2. Every t() key the scanner page / upload messages use exists in all ten
 *     locale files, with the same {{placeholders}}.
 *  3. Every upload-error code maps to a filled-in message (no raw {{tokens}}).
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { pdfErrorMessage, scanRequestTooLargeMessage } from '@/app/assessment-scanner/scan-messages';
import { PdfRenderError, type PdfRenderErrorCode } from '@/app/assessment-scanner/pdf-to-images';

const ROOT = process.cwd();
const SOURCES = [
    'src/app/assessment-scanner/page.tsx',
    'src/app/assessment-scanner/scan-messages.ts',
    'src/components/assessment-scanner/assessment-result-card.tsx',
];
const LOCALE_DIR = join(ROOT, 'src/locales');
const locales = readdirSync(LOCALE_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ name: f, dict: JSON.parse(readFileSync(join(LOCALE_DIR, f), 'utf8')) as Record<string, string> }));

function tKeys(src: string): string[] {
    const keys = new Set<string>();
    // t("…") / t('…') with a single string-literal argument (possibly multi-line).
    for (const m of src.matchAll(/\bt\(\s*(["'])((?:\\.|(?!\1).)*?)\1\s*[,)]/gs)) {
        keys.add(m[2].replace(/\\(["'])/g, '$1'));
    }
    return [...keys];
}
const placeholders = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort();

describe('scanner copy', () => {
    it.each(SOURCES)('%s has no hard-coded page-count claim in user-visible strings', (file) => {
        const src = readFileSync(join(ROOT, file), 'utf8');
        for (const key of tKeys(src)) {
            expect(key).not.toMatch(/\b(up to|max(imum)?|limit)\s+\d+\s+pages?\b/i);
        }
    });

    it('found the scanner t() keys (sanity check on the extractor)', () => {
        const keys = SOURCES.flatMap((f) => tKeys(readFileSync(join(ROOT, f), 'utf8')));
        expect(keys).toContain('Now supporting six subject families, up to {{cap}} pages per scan');
        expect(keys).toContain('Reading PDF page {{done}} of {{total}}…');
        expect(keys.length).toBeGreaterThan(40);
    });

    const NEW_KEYS = SOURCES.flatMap((f) => tKeys(readFileSync(join(ROOT, f), 'utf8'))).filter((k) =>
        k.includes('{{'),
    );
    it.each(locales.map((l) => [l.name, l.dict] as const))(
        '%s translates every placeholder string the scanner uses, keeping its {{placeholders}}',
        (_name, dict) => {
            for (const key of NEW_KEYS) {
                expect(dict[key]).toBeDefined();
                expect(placeholders(dict[key])).toEqual(placeholders(key));
            }
        },
    );

    it('every upload error code yields a filled-in message', () => {
        const codes: PdfRenderErrorCode[] = [
            'PDF_TOO_LARGE',
            'PDF_UNREADABLE',
            'PDF_PASSWORD_PROTECTED',
            'PDF_EMPTY',
            'PDF_TOO_MANY_PAGES',
            'PDF_PAGE_RENDER_FAILED',
            'PDF_CANVAS_UNAVAILABLE',
        ];
        const identity = (s: string) => s;
        const messages = codes.map((code) =>
            pdfErrorMessage(
                new PdfRenderError('x', code, {
                    totalPages: 12,
                    maxPages: 7,
                    pageNumber: 4,
                    fileBytes: 60 * 1024 * 1024,
                    maxBytes: 50 * 1024 * 1024,
                }),
                identity,
                10,
            ),
        );
        for (const m of messages) expect(m).not.toMatch(/\{\{/);
        expect(new Set(messages).size).toBe(codes.length);
        expect(messages[0]).toContain('60.0 MB');
        expect(messages[4]).toContain('12 pages, but only 7 more');
        expect(messages[5]).toMatch(/^Page 4 /);
        expect(scanRequestTooLargeMessage(12 * 1024 * 1024, identity)).toMatch(/12\.0 MB .* 9\.1 MB/);
    });
});
