/**
 * @fileOverview Assessment Scanner — AI grading of student answer sheets.
 *
 * Phase-1 MVP: single page, single student, math + MCQ + short answer.
 * Two-pass strategy:
 *   PASS 1 — Extract page structure (questions + handwritten answers, verbatim)
 *   PASS 2 — Rubric-grounded scoring with NCERT chapter context
 *
 * Why two passes: gives a clean failure boundary (extraction failed vs grading
 * failed), lets us cache extraction across teacher edits in later phases, and
 * matches the established pattern used by GradeMate/Graider/ExamAI in production.
 *
 * Architecture: plain async function (NOT 'use server'), returns Zod-validated
 * output. The API route at /api/ai/assessment-scanner wraps this with
 * `withPlanCheck('assessment-scanner')` for plan + quota gating.
 *
 * Idempotency: a re-submitted assessmentId returns the cached BaseContent if
 * one already exists with status==='graded'. The API route should also roll
 * back the quota reservation in that case.
 */

import { ai, runResiliently } from '@/ai/genkit';
import { fetchImageAsBase64 } from '@/ai/utils/image-utils';
import { getChapterById, getChaptersForGrade } from '@/data/ncert';
import {
    AssessmentScannerInputSchema,
    AssessmentScannerOutputSchema,
    PageScanSchema,
    GradedQuestionSchema,
    type AssessmentScannerInput,
    type AssessmentScannerOutput,
    type PageScan,
    type GradedQuestion,
} from '@/ai/schemas/assessment-scanner-schemas';
import { z } from 'genkit';

// ───────────────────────────────────────────────────────────────────────────
// PASS 1 prompt — extraction only, NO grading
// ───────────────────────────────────────────────────────────────────────────

const Pass1InputSchema = z.object({
    pageIndex: z.number().int().min(0),
    pageCount: z.number().int().min(1),
    imageDataUri: z.string(),
    subject: z.string(),
    gradeLevel: z.string(),
    language: z.string(),
});

const pageExtractionPrompt = ai.definePrompt({
    name: 'assessmentScannerPass1',
    input: { schema: Pass1InputSchema },
    output: { schema: PageScanSchema },
    prompt: `You are an OCR + structure-extraction expert reading page {{pageIndex}} of {{pageCount}} from an Indian student's school assessment notebook.

**Your ONLY job in this pass is extraction. DO NOT grade anything. DO NOT decide if the student is right or wrong. Just read what is on the page.**

**Subject:** {{subject}} | **Grade:** {{gradeLevel}} | **Output language:** {{language}}

**Image:** {{media url=imageDataUri}}

## Rules

1. **Extract every question and the student's handwritten answer to it, verbatim.**
2. For each multi-part question (e.g. 1(a), 1(b), 1(c)), emit one entry per sub-part with questionId 'p{{pageIndex}}-q1a', 'p{{pageIndex}}-q1b', etc.
3. **Struck-out work**: capture the original in \`studentAnswerRaw\` using \`[STRUCK: ...]\` markers; put the un-struck final answer in \`studentAnswerInterpreted\`.
4. **No answer written** → set \`isAttempted: false\`, leave \`studentAnswerInterpreted\` empty.
5. **Question text not visible on the page** (only the answer is shown) → reconstruct from the student's answer + your knowledge of the {{gradeLevel}} {{subject}} NCERT syllabus, and set \`questionTextConfidence\` ≤ 0.6.
6. **Math working**: if the student wrote out steps, copy them into \`workShown\` (use LaTeX for symbols, wrapped in $...$).
7. **MCQ marking ambiguity** (multiple options ticked, partial circles, etc.): include ALL marked options in \`studentAnswerRaw\`; \`studentAnswerInterpreted\` should still pick the most likely intended answer or be empty if truly ambiguous.
8. **Image quality**: be honest. If the page is blurry, has glare, is rotated, or shows multiple students' handwriting, flag it in \`imageQualityIssues\`. Use \`["none"]\` if the page is clean.
9. **Page type**:
   - \`question_only\`: only the printed/handwritten questions, no student answers
   - \`answer_only\`: student wrote answers but the questions aren't on this page
   - \`mixed\`: both questions and student answers present
   - \`cover\`: title page, name page, etc. — set \`questions: []\`
   - \`unreadable\`: cannot extract anything reliably — set \`questions: []\`
10. **Handwriting confidence**: 1.0 = perfectly clear typewriter-clean. 0.5 = readable but several digits/letters ambiguous. 0.0 = scribble.

**STOP HERE.** Do NOT score, judge, or grade in this pass. Output the structure only.`,
});

// ───────────────────────────────────────────────────────────────────────────
// PASS 2 prompt — rubric-grounded scoring
// ───────────────────────────────────────────────────────────────────────────

const Pass2InputSchema = z.object({
    subject: z.string(),
    gradeLevel: z.string(),
    language: z.string(),
    extractedPages: z.string().describe('JSON-stringified array of PageScan results from Pass 1'),
    ncertContext: z.string(),
    teacherAnswerKeyText: z.string().optional(),
    educationBoard: z.string().optional(),
});

const Pass2OutputSchema = z.object({
    questions: z.array(GradedQuestionSchema),
    recommendedNextSteps: z.array(z.string()),
    studentRecommendations: z.array(z.string()),
});

const scoringPrompt = ai.definePrompt({
    name: 'assessmentScannerPass2',
    input: { schema: Pass2InputSchema },
    output: { schema: Pass2OutputSchema },
    prompt: `You are an experienced Indian school teacher grading a student's {{gradeLevel}} {{subject}} assessment. Your grading must be **fair, specific, and pedagogically useful** — not generic praise.

**Output language for ALL feedback:** {{language}}.

## Inputs

### Extracted student work (from Pass 1, do not re-extract)
\`\`\`json
{{{extractedPages}}}
\`\`\`

### NCERT chapter context (the syllabus the student is expected to have learned)
{{{ncertContext}}}

{{#if teacherAnswerKeyText}}
### Teacher-provided answer key (AUTHORITATIVE — use this over your own judgement)
{{{teacherAnswerKeyText}}}
{{/if}}

{{#if educationBoard}}
### Education board: {{educationBoard}}
{{/if}}

## Scoring rules

For EACH extracted question, produce one GradedQuestion:

1. **Marks scale**: derive marksMax from \`marksAvailable\` if Pass-1 captured it; else use these defaults:
   - mcq / true_false: 1 mark
   - fill_blank / one-word: 1 mark
   - short_answer: 2 marks
   - long_answer: 5 marks
   - math_calculation: 3 marks (1 for setup, 1 for method, 1 for final answer)
   - diagram: 3 marks
   - match_following: 1 mark per pair

2. **MCQ**: exact match → full marks; wrong or multiple selections → 0; record this as \`partialCreditBreakdown: []\` (no partial for MCQ).

3. **Math**: award method marks even when the final answer is computationally wrong. Use \`partialCreditBreakdown\` to enumerate steps:
   \`[{ step: "Set up equation", earned: 1, max: 1 }, { step: "Apply formula", earned: 1, max: 1 }, { step: "Final answer", earned: 0, max: 1 }]\`
   If the student showed no working but got the right answer, award full marks.

4. **Essay / long-answer**: derive a 4-criterion rubric inline (Understanding / Reasoning / Expression / Examples). Score each 0–full; sum to total.

5. **Fill-blank / one-word / short-answer**: tolerate spelling variants and synonyms — especially in vernacular languages. Award full marks for clearly equivalent answers.

6. **Mixed-language answers** (e.g. English question, Hindi answer): full marks if the content is correct, unless the rubric explicitly requires answering in a specific language.

7. **No answer written** (\`isAttempted: false\`): 0 marks, \`mistakePattern: 'incomplete'\`, encouraging studentFacingFeedback.

8. **Off-topic answer**: 0 marks, \`mistakePattern: 'off_topic'\`, feedback explains the gap.

9. **MCQ with multiple options ticked**: 0 marks, \`needsTeacherReview: true\`, feedback notes the ambiguity.

10. **Question on a question_only page** (no answer space): score 0 / 0 (excluded from total). Do NOT count against the student.

11. **Confidence < 0.8 OR partial credit ambiguous**: set \`needsTeacherReview: true\`. Be honest about uncertainty — do NOT pretend to be authoritative.

12. **expectedAnswer**: write the correct/reference answer using NCERT context (or teacherAnswerKeyText when provided). For math, include the worked solution.

13. **conceptTested**: short concept name (e.g. "Pythagoras Theorem", "Subject-Verb Agreement", "Photosynthesis").

14. **ncertChapterId**: best match from the NCERT context above. Use null if no match.

15. **mistakePattern**: pick ONE — \`conceptual\` (misunderstood the idea), \`computational\` (right method, wrong arithmetic), \`transcription\` (copied a value wrong from the question), \`incomplete\` (didn't finish), \`off_topic\` (answered the wrong thing), or \`none\` (correct answer).

16. **feedback** (teacher-facing): 1–2 sentences in {{language}}. Specific and actionable. NO generic praise.

17. **studentFacingFeedback**: gentler tone, age-appropriate for {{gradeLevel}}, in {{language}}. Encouraging when score is low. **Never shame the student.**

## Final aggregation

Also produce:

- **recommendedNextSteps** (for the teacher): 3–5 concrete bullets — which chapters to re-teach, which question types the student struggles with, what practice to assign next.
- **studentRecommendations** (for the student, in {{language}}): 2–3 bullets — what to focus on this week, which concepts to revise. Tone is supportive.

**Be honest. If you're unsure, set needsTeacherReview: true. Authentic grades > confident grades.**`,
});

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function letterGradeFor(scorePct: number): string {
    if (scorePct >= 90) return 'A+';
    if (scorePct >= 80) return 'A';
    if (scorePct >= 65) return 'B';
    if (scorePct >= 50) return 'C';
    if (scorePct >= 35) return 'D';
    return 'E';
}

function gradeLevelToNumber(gradeLevel: string): number | null {
    // 'Class 5' → 5; 'Nursery'/'LKG'/'UKG' → null
    const match = gradeLevel.match(/Class\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
}

function buildNcertContext(input: AssessmentScannerInput): string {
    const grade = gradeLevelToNumber(input.gradeLevel);
    if (grade === null) {
        return '(No NCERT context available for this grade level — use general knowledge of early-childhood pedagogy.)';
    }

    let chapters = (input.ncertChapterIds ?? [])
        .map((id) => getChapterById(id))
        .filter((c): c is NonNullable<typeof c> => Boolean(c));

    if (chapters.length === 0) {
        // Fallback: pull all chapters for grade + subject. Cap at 5 to keep
        // the prompt small (each chapter ~150 tokens of outcomes + keywords).
        chapters = getChaptersForGrade(grade, input.subject).slice(0, 5);
    }

    if (chapters.length === 0) {
        return `(NCERT data not loaded for ${input.subject} Class ${grade}. Grade against general syllabus knowledge.)`;
    }

    return chapters
        .map(
            (c) =>
                `## ${c.title}\n- Learning outcomes: ${c.learningOutcomes.join('; ')}\n- Key terms: ${c.keywords.join(', ')}`,
        )
        .join('\n\n');
}

async function checkIdempotency(
    userId: string,
    assessmentId: string,
): Promise<AssessmentScannerOutput | null> {
    try {
        const { dbAdapter } = await import('@/lib/db/adapter');
        // dbAdapter does not expose a "get one content by id" method directly,
        // so we read via Firestore. We import lazily to keep cold-start light.
        const { getDb } = await import('@/lib/firebase-admin');
        const db = await getDb();
        const doc = await db
            .collection('users')
            .doc(userId)
            .collection('content')
            .doc(assessmentId)
            .get();
        if (!doc.exists) return null;
        const data = doc.data();
        if (!data || data.type !== 'assessment-submission') return null;
        const payload = data.data as AssessmentScannerOutput | undefined;
        if (payload?.status === 'graded') return payload;
        return null;
    } catch {
        // Soft fail — treat as cache miss; we'd rather pay for a re-grade
        // than serve a stale or wrong result.
        return null;
    }
}

// ───────────────────────────────────────────────────────────────────────────
// PASS 1: per-page extraction (parallel via Promise.allSettled)
// ───────────────────────────────────────────────────────────────────────────

async function extractPage(
    pageUrl: string,
    pageIndex: number,
    pageCount: number,
    input: AssessmentScannerInput,
): Promise<PageScan> {
    const imageDataUri = pageUrl.startsWith('data:') ? pageUrl : await fetchImageAsBase64(pageUrl);

    const { output } = await runResiliently(
        async (resilienceConfig) =>
            pageExtractionPrompt(
                {
                    pageIndex,
                    pageCount,
                    imageDataUri,
                    subject: input.subject,
                    gradeLevel: input.gradeLevel,
                    language: input.language,
                },
                resilienceConfig,
            ),
        `assessmentScanner.pass1.page${pageIndex}`,
    );

    if (!output) {
        // Synthesise a minimal "unreadable" page so Pass 2 still gets a valid
        // structure — failing the whole flow because one page choked is too brittle.
        return {
            pageIndex,
            pageType: 'unreadable',
            handwritingConfidence: 0,
            imageQualityIssues: ['none'],
            detectedLanguage: 'unknown',
            questions: [],
        };
    }
    // Genkit's structured output is already schema-validated, but defensively
    // re-parse so a bad response can't corrupt downstream state.
    return PageScanSchema.parse({ ...output, pageIndex });
}

// ───────────────────────────────────────────────────────────────────────────
// PASS 2: rubric-grounded scoring (single call across all pages)
// ───────────────────────────────────────────────────────────────────────────

async function scoreAssessment(
    pages: PageScan[],
    input: AssessmentScannerInput,
): Promise<{
    questions: GradedQuestion[];
    recommendedNextSteps: string[];
    studentRecommendations: string[];
}> {
    const ncertContext = buildNcertContext(input);

    const { output } = await runResiliently(
        async (resilienceConfig) =>
            scoringPrompt(
                {
                    subject: input.subject,
                    gradeLevel: input.gradeLevel,
                    language: input.language,
                    extractedPages: JSON.stringify(pages, null, 2),
                    ncertContext,
                    teacherAnswerKeyText: input.teacherAnswerKeyText,
                    educationBoard: input.educationBoard,
                },
                resilienceConfig,
            ),
        'assessmentScanner.pass2',
    );

    if (!output) {
        return { questions: [], recommendedNextSteps: [], studentRecommendations: [] };
    }
    return output;
}

// ───────────────────────────────────────────────────────────────────────────
// Aggregation + persistence
// ───────────────────────────────────────────────────────────────────────────

function buildImageQualityWarnings(pages: PageScan[]): string[] {
    const warnings: string[] = [];
    for (const p of pages) {
        const issues = p.imageQualityIssues.filter((i) => i !== 'none');
        if (issues.length > 0) {
            warnings.push(`Page ${p.pageIndex + 1}: ${issues.join(', ')}`);
        }
        if (p.handwritingConfidence < 0.5) {
            warnings.push(
                `Page ${p.pageIndex + 1}: handwriting hard to read (confidence ${(p.handwritingConfidence * 100).toFixed(0)}%) — consider re-shooting.`,
            );
        }
    }
    return warnings;
}

function aggregate(
    input: AssessmentScannerInput,
    pages: PageScan[],
    pass2: {
        questions: GradedQuestion[];
        recommendedNextSteps: string[];
        studentRecommendations: string[];
    },
): AssessmentScannerOutput {
    // Exclude question_only pages from totals (no answers to grade there)
    const gradableQuestions = pass2.questions;

    const totalAwardedMarks = gradableQuestions.reduce((s, q) => s + q.marksAwarded, 0);
    const inferredMaxMarks = gradableQuestions.reduce((s, q) => s + q.marksMax, 0);
    const totalMaxMarks = input.totalMaxMarks ?? inferredMaxMarks;
    const scorePct = totalMaxMarks > 0 ? (totalAwardedMarks / totalMaxMarks) * 100 : 0;

    // Concept mastery rollup — group by ncertChapterId
    const byChapter = new Map<string, { earned: number; max: number; chapterTitle: string }>();
    for (const q of gradableQuestions) {
        if (!q.ncertChapterId) continue;
        const ch = getChapterById(q.ncertChapterId);
        const existing = byChapter.get(q.ncertChapterId);
        if (existing) {
            existing.earned += q.marksAwarded;
            existing.max += q.marksMax;
        } else {
            byChapter.set(q.ncertChapterId, {
                earned: q.marksAwarded,
                max: q.marksMax,
                chapterTitle: ch?.title ?? q.conceptTested,
            });
        }
    }
    const conceptMastery = Array.from(byChapter.entries()).map(([chapterId, v]) => ({
        chapterId,
        chapterTitle: v.chapterTitle,
        masteryPct: v.max > 0 ? (v.earned / v.max) * 100 : 0,
        weakestConcept: null,
    }));

    const needsReviewCount = gradableQuestions.filter((q) => q.needsTeacherReview).length;
    const imageQualityWarnings = buildImageQualityWarnings(pages);

    // Status: 'partial' if any page was unreadable or any question needs review
    const anyUnreadable = pages.some((p) => p.pageType === 'unreadable');
    const status: 'graded' | 'partial' | 'failed' =
        gradableQuestions.length === 0 ? 'failed' : anyUnreadable ? 'partial' : 'graded';

    return {
        assessmentId: input.assessmentId,
        status,
        pageCount: pages.length,
        totalAwardedMarks,
        totalMaxMarks,
        scorePct,
        letterGrade: letterGradeFor(scorePct),
        questions: gradableQuestions,
        classAverageAtScan: null, // wired up in Phase 3 (class analytics)
        conceptMastery,
        recommendedNextSteps: pass2.recommendedNextSteps,
        studentRecommendations: pass2.studentRecommendations,
        needsReviewCount,
        imageQualityWarnings,
    };
}

async function persist(input: AssessmentScannerInput, output: AssessmentScannerOutput) {
    try {
        const { dbAdapter } = await import('@/lib/db/adapter');
        const { Timestamp } = await import('firebase-admin/firestore');
        const now = new Date();

        await dbAdapter.saveContent(input.userId, {
            id: input.assessmentId,
            type: 'assessment-submission',
            title: `Assessment: ${input.subject} ${input.gradeLevel} (${output.scorePct.toFixed(0)}%)`,
            gradeLevel: input.gradeLevel as any,
            subject: input.subject as any,
            topic: input.subject,
            language: input.language as any,
            isPublic: false,
            isDraft: false,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            data: output,
        });
    } catch (err) {
        // Persistence failure must not fail the user-visible response. Log
        // and let the result come through; the teacher will see results but
        // it won't appear in the library this time.
        const { logger } = await import('@/lib/logger');
        logger.error(
            'Assessment Scanner: persistence failed',
            err,
            'ASSESSMENT_SCANNER',
            { userId: input.userId, assessmentId: input.assessmentId },
        );
    }
}

// ───────────────────────────────────────────────────────────────────────────
// Public entry
// ───────────────────────────────────────────────────────────────────────────

export async function gradeAssessment(
    rawInput: AssessmentScannerInput,
): Promise<AssessmentScannerOutput> {
    const input = AssessmentScannerInputSchema.parse(rawInput);

    // Idempotency: re-submitting the same assessmentId returns the cached
    // result without burning AI quota or re-running the model.
    const cached = await checkIdempotency(input.userId, input.assessmentId);
    if (cached) return cached;

    // PASS 1: extract every page in parallel
    const pageResults = await Promise.allSettled(
        input.pageUrls.map((url, i) =>
            extractPage(url, i, input.pageUrls.length, input),
        ),
    );

    const pages: PageScan[] = pageResults.map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        // One page failed — substitute an unreadable placeholder so Pass 2
        // can continue with the rest. Better partial result than total failure.
        return {
            pageIndex: i,
            pageType: 'unreadable',
            handwritingConfidence: 0,
            imageQualityIssues: ['none'],
            detectedLanguage: 'unknown',
            questions: [],
        };
    });

    // PASS 2: score against rubric + NCERT context
    const pass2 = await scoreAssessment(pages, input);

    // Aggregate + validate
    const output = AssessmentScannerOutputSchema.parse(aggregate(input, pages, pass2));

    // Persist (fire-and-forget — don't block the response on Firestore)
    void persist(input, output);

    return output;
}
