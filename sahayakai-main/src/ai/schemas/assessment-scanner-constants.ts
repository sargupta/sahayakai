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
 * Pages per scan — the ONE limit the website, the API route and the dispatcher
 * share. Raised 3 → 10 for the batch-scale work: Pass 1 fans out one call per
 * page (bounded concurrency) and Pass 2 chunks large papers, so a ~10-page mixed
 * paper fits the 90 s flow budget inside the 120 s route budget. The schema
 * ceiling (15) is still the hard limit. The Python sidecar was only built and
 * timed for 3 pages, so the dispatcher sends larger scans to the Genkit flow
 * (see ASSESSMENT_SIDECAR_MAX_PAGES in assessment-scanner-dispatch.ts).
 */
export const ASSESSMENT_DEMO_PAGE_CAP = 10;

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
 * Largest PDF the browser will open for conversion (bytes). Checked BEFORE the
 * file is read into memory. 50 MB fits a 10-page colour phone scan (~2–4 MB a
 * page) with room to spare; anything larger is almost always a 600-dpi export
 * that should be re-saved smaller.
 */
export const ASSESSMENT_MAX_PDF_BYTES = 50 * 1024 * 1024;

/**
 * Largest scan request body the client will send (bytes). PDF pages travel as
 * inline JPEG data URIs, and Next.js buffers request bodies that pass through
 * middleware up to `middlewareClientMaxBodySize` (default 10 MiB) — anything
 * longer is TRUNCATED and the route answers 413. Stay safely under that so a
 * too-big scan gets a clear message before upload instead of a failed request.
 * Measured: a rendered 1536-px page is ~60 KB (typed) to ~200 KB (dense scan),
 * so 10 pages are ~0.6–2 MB — far below this ceiling.
 */
export const ASSESSMENT_MAX_REQUEST_BYTES = 9_500_000;

/**
 * Accepted page formats in `pageUrls`: an https URL (Firebase Storage upload)
 * or an inline base64 JPEG / PNG / WEBP image. A PDF (or any other data URI)
 * must be converted to page images first — sending a whole PDF as one "page"
 * would grade a multi-page document as a single page.
 */
export const ASSESSMENT_PAGE_DATA_URI_RE = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

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
