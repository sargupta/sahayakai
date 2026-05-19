/**
 * Assessment Scanner — client-safe constants.
 *
 * This module is split out from `assessment-scanner-schemas.ts` so the page UI
 * can import the subject allow-list + page cap without dragging Genkit (and
 * its Node-only telemetry / gRPC transitive deps) into the client bundle.
 *
 * The Zod-bearing schemas file re-exports these constants for server-side
 * call sites that already import the schemas. UI code should import from
 * here directly.
 *
 * Rule of thumb: anything importable from a `'use client'` page lives here.
 * Anything that needs `z` from genkit stays in the schemas file.
 */

/**
 * Demo / Phase-2 cap on pages per scan. Held to 3 (not the schema ceiling of
 * 15) for the NCERT demo so token cost + latency stay bounded.
 */
export const ASSESSMENT_DEMO_PAGE_CAP = 3;

/**
 * Back-compat alias for the old Phase-1 single-page cap. Kept exported only
 * so we don't break any external import paths until the next deprecation pass.
 *
 * @deprecated Use ASSESSMENT_DEMO_PAGE_CAP.
 */
export const PHASE_1_PAGE_CAP = ASSESSMENT_DEMO_PAGE_CAP;

/** Long-term hard cap on pages per assessment (schema-level ceiling). */
export const ASSESSMENT_MAX_PAGES = 15;

/**
 * Subjects the Assessment Scanner accepts. The grading rubric branches by
 * subject family in Pass 2 — see `assessment-scanner.ts`.
 *
 * "Other" is a catch-all that uses a generic rubric (clarity / correctness /
 * completeness / presentation). When the input doesn't fit any of the named
 * families, callers should map it to "Other" rather than fail.
 *
 * Demo-quality bar: Mathematics is best-in-class. The other five families ship
 * with subject-aware prompts but no specialist post-processing — the model is
 * instructed to be conservative on confidence so the teacher gets a clear
 * "review me" signal where it matters.
 */
export const ASSESSMENT_SUPPORTED_SUBJECTS = [
    'Mathematics',
    'Science',
    'Environmental Studies (EVS)',
    'Social Science',
    'History',
    'Geography',
    'Civics',
    'Hindi',
    'English',
    'Other',
] as const;
export type AssessmentSupportedSubject = typeof ASSESSMENT_SUPPORTED_SUBJECTS[number];

/**
 * Rubric-family classification — many UI subjects collapse onto the same
 * grading prompt. e.g. Social Science / History / Geography / Civics all share
 * the social-science rubric (factual accuracy + causal reasoning + location +
 * constitutional accuracy as applicable). Kept here, not in the prompt, so
 * the API + tests can resolve a family without re-parsing the prompt text.
 */
export type SubjectRubricFamily =
    | 'mathematics'
    | 'science'
    | 'evs'
    | 'social_science'
    | 'language'
    | 'other';

export function resolveSubjectFamily(subject: string): SubjectRubricFamily {
    const s = subject.trim().toLowerCase();
    if (s === 'mathematics' || s === 'maths' || s === 'math') return 'mathematics';
    if (s === 'science') return 'science';
    if (s.includes('environmental') || s === 'evs') return 'evs';
    if (
        s === 'social science' ||
        s === 'history' ||
        s === 'geography' ||
        s === 'civics'
    ) {
        return 'social_science';
    }
    if (s === 'english' || s === 'hindi') return 'language';
    return 'other';
}
