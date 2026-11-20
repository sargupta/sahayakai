/**
 * CLASS GATE — exported files never turn user content into markup or formulas.
 *
 * Bug: the HTML export interpolated titles, descriptions, tips, options … raw, and the
 * CSV export left a leading `=`/`+`/`-`/`@` live. The school-wide export packs OTHER
 * teachers' content, so a `<script>` or `=HYPERLINK(...)` ran on the admin's machine.
 * The static check fails if any `${...}` in the two HTML builders is not escaped.
 */
import fs from 'fs';
import path from 'path';

jest.mock('@/lib/firebase-admin', () => ({ getDb: jest.fn(), getStorageInstance: jest.fn() }));
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { csvCell, h, dataExportService as DataExportService } from '@/lib/services/data-export-service';

const XSS = '<img src=x onerror=alert(1)>';

describe('h()', () => {
    it('escapes markup characters', () => {
        expect(h(`<script>"a" & 'b'</script>`)).toBe('&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;&lt;/script&gt;');
        expect(h(null)).toBe('');
        expect(h(3)).toBe('3');
    });
});

describe('csvCell()', () => {
    it.each([
        ['=HYPERLINK("http://x","y")', `"'=HYPERLINK(""http://x"",""y"")"`],
        ['+1+1', `"'+1+1"`],
        ['-2', `"'-2"`],
        ['@SUM(A1)', `"'@SUM(A1)"`],
        ['\tx', `"'\tx"`],
        ['Photosynthesis', '"Photosynthesis"'],
        [undefined, '""'],
    ])('%j → %s', (v, out) => expect(csvCell(v)).toBe(out));
});

describe('HTML export builders', () => {
    const svc = DataExportService as unknown as {
        lessonPlanToHTML: (p: unknown, m: unknown) => string;
        quizToHTML: (q: unknown, m: unknown) => string;
        contentToCSV: (items: unknown[]) => string;
    };
    const meta = { title: XSS, subject: XSS, gradeLevel: XSS, language: XSS, topic: XSS };

    it('lesson plan: no user value reaches the document unescaped', () => {
        const html = svc.lessonPlanToHTML({
            title: XSS, duration: XSS, objectives: [XSS], materials: [XSS], assessment: XSS, homework: XSS,
            keyVocabulary: [{ term: XSS, meaning: XSS }],
            activities: [{ phase: XSS, name: XSS, duration: XSS, description: XSS, teacherTips: XSS }],
        }, meta);
        expect(html).not.toContain('<img');
        expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('quiz: no user value reaches the document unescaped', () => {
        const html = svc.quizToHTML({
            questions: [{ type: 'multiple-choice', text: XSS, difficulty: XSS, options: [XSS], correctAnswer: XSS, explanation: XSS }],
        }, meta);
        expect(html).not.toContain('<img');
    });

    it('CSV: a formula title is neutralised', () => {
        const csv = svc.contentToCSV([{ id: 'c1', type: 'quiz', title: '=cmd|calc', topic: 'ok', isPublic: false }]);
        expect(csv.split('\n')[1]).toContain(`"'=cmd|calc"`);
    });

    it('static gate: every interpolation in the HTML builders is escaped or a known safe fragment', () => {
        const src = fs.readFileSync(path.join(process.cwd(), 'src/lib/services/data-export-service.ts'), 'utf8');
        const start = src.indexOf('lessonPlanToHTML(');
        const end = src.indexOf('\n  },', src.indexOf('quizToHTML('));
        const body = src.slice(start, end);
        const SAFE = /^(h\(|pdfDocTitle\(|i \+ 1$|activities$|questions$|answerKey$|body$|new Date\(\)|quiz\.questions\?\.length|\(plan\.|\(q\.options|plan\.keyVocabulary|plan\.assessment \?|plan\.homework \?|a\.teacherTips \?)/;
        const bad = [...body.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1].trim()).filter((e) => !SAFE.test(e));
        expect(bad).toEqual([]);
    });
});
