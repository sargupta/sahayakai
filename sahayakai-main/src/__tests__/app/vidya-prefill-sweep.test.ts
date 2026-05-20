/**
 * NCERT-demo 2026-05-19 regression sweep: every form VIDYA can navigate
 * to MUST apply the normaliser + SET_OPTS + always-send-language pattern.
 *
 * The reference implementation lives in
 *   src/features/lesson-planner/hooks/use-lesson-plan.ts
 * and the bug pattern (bare `setValue` + missing language fallback + raw
 * "General" subject reaching the API) was replicated on seven other
 * forms. Rendering each page in isolation is impractical (Firebase, AI
 * flows, Zustand, microphone, etc.), so we read the source files and pin
 * the contract at the file level. Fragile to renames — exactly the
 * right kind of fragile, because a rename forces the engineer to keep
 * the contract intact.
 *
 * If this sweep starts failing on a renamed file path, update the
 * `FORMS` table — do NOT delete the assertion.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

type FormFix = {
    name: string;
    file: string;
    /** Does this form use react-hook-form (vs imperative useState)? */
    usesRhf: boolean;
    /** Does this form have a `gradeLevel` field? */
    hasGradeLevel: boolean;
    /** API endpoint substring the form POSTs to. Used to anchor the language guard. */
    apiPath: string;
};

const FORMS: FormFix[] = [
    {
        name: 'quiz-generator',
        file: 'src/app/quiz-generator/page.tsx',
        usesRhf: true,
        hasGradeLevel: true,
        apiPath: '/api/ai/quiz',
    },
    {
        name: 'worksheet-wizard',
        file: 'src/app/worksheet-wizard/page.tsx',
        usesRhf: true,
        hasGradeLevel: true,
        apiPath: '/api/ai/worksheet',
    },
    {
        name: 'visual-aid-designer',
        file: 'src/app/visual-aid-designer/page.tsx',
        usesRhf: true,
        hasGradeLevel: true,
        apiPath: '/api/ai/visual-aid',
    },
    {
        name: 'virtual-field-trip',
        file: 'src/app/virtual-field-trip/page.tsx',
        usesRhf: true,
        hasGradeLevel: true,
        apiPath: '/api/ai/virtual-field-trip',
    },
    {
        name: 'teacher-training',
        file: 'src/app/teacher-training/page.tsx',
        usesRhf: true,
        hasGradeLevel: false,
        apiPath: '/api/ai/teacher-training',
    },
    {
        name: 'rubric-generator',
        file: 'src/app/rubric-generator/page.tsx',
        usesRhf: true,
        hasGradeLevel: true,
        apiPath: '/api/ai/rubric',
    },
    {
        name: 'exam-paper',
        file: 'src/app/exam-paper/page.tsx',
        usesRhf: false,
        hasGradeLevel: true,
        apiPath: '/api/ai/exam-paper',
    },
    {
        name: 'video-storyteller',
        file: 'src/app/video-storyteller/page.tsx',
        usesRhf: false,
        hasGradeLevel: true,
        apiPath: '/api/ai/video-storyteller',
    },
];

function read(file: string): string {
    return readFileSync(resolve(__dirname, '../..', '..', file), 'utf8');
}

describe('VIDYA pre-fill sweep (NCERT-demo regression)', () => {
    describe.each(FORMS)('$name', (form) => {
        const source = read(form.file);

        it('imports normaliseVidyaLanguage from @/lib/vidya-action-normalizer', () => {
            expect(source).toMatch(
                /normaliseVidyaLanguage[^;]*from\s+['"]@\/lib\/vidya-action-normalizer['"]/,
            );
        });

        if (form.hasGradeLevel) {
            it('imports normaliseVidyaGradeLevel from @/lib/vidya-action-normalizer', () => {
                expect(source).toMatch(
                    /normaliseVidyaGradeLevel[^;]*from\s+['"]@\/lib\/vidya-action-normalizer['"]/,
                );
            });

            it('calls normaliseVidyaGradeLevel before writing gradeLevel into form state', () => {
                expect(source).toMatch(/normaliseVidyaGradeLevel\s*\(/);
            });
        }

        it('calls normaliseVidyaLanguage on the inbound language URL param', () => {
            expect(source).toMatch(/normaliseVidyaLanguage\s*\(/);
        });

        if (form.usesRhf) {
            it('passes shouldDirty/shouldTouch/shouldValidate to setValue for VIDYA pre-fill', () => {
                // The reference impl declares `const SET_OPTS = { shouldDirty: true, shouldTouch: true, shouldValidate: true }`.
                expect(source).toMatch(
                    /shouldDirty:\s*true[\s\S]*shouldTouch:\s*true[\s\S]*shouldValidate:\s*true/,
                );
            });
        }

        it('builds an explicit language for the API body (never silently falls back to profile)', () => {
            // Look for a derived value (e.g. `submittedLanguage` or inline
            // ternary with `|| 'en'`, `: 'en'`, `|| 'English'`, etc.) that
            // guarantees a non-empty language hits the wire when the form
            // was hydrated. We match both `||` (RHF forms) and ternary
            // fallback (exam-paper) syntaxes.
            const hasGuard =
                /submittedLanguage\s*=[\s\S]*?(?:\|\||:)\s*['"](en|English)['"]/.test(source) ||
                /language\s*:\s*[\s\S]*?(?:\|\||\?\s*[^:]+:)\s*['"](en|English)['"]/.test(source);
            expect(hasGuard).toBe(true);
        });

        if (form.usesRhf) {
            // The "General" placeholder strip is only meaningful for the
            // RHF forms whose default subject is "General". Imperative
            // useState forms (exam-paper, video-storyteller) have their
            // own subject defaults — they don't ship a "General" sentinel.
            it('strips the "General" subject placeholder before the API call', () => {
                // Matches either explicit `submittedSubject` derivation or
                // inline `subject !== 'General' ? ... : undefined`.
                const hasStrip =
                    /subject\s*&&\s*[^;]*!==\s*['"]General['"]/.test(source) ||
                    /['"]General['"][^;]*\?\s*undefined\s*:/.test(source);
                expect(hasStrip).toBe(true);
            });
        }

        it('POSTs to the expected AI flow endpoint', () => {
            expect(source).toContain(form.apiPath);
        });
    });
});
