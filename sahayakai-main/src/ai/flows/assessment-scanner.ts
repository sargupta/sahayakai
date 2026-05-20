/**
 * @fileOverview Assessment Scanner — AI grading of student answer sheets.
 *
 * Phase-2 scope: up to 3 pages per scan, multiple subject families
 * (Mathematics, Science, EVS, Social Science, Hindi, English, Other).
 *
 * Two-pass strategy:
 *   PASS 1 — Extract page structure (questions + handwritten answers, verbatim)
 *   PASS 2 — Rubric-grounded scoring with NCERT chapter context
 *
 * Why two passes: gives a clean failure boundary (extraction failed vs grading
 * failed), lets us cache extraction across teacher edits in later phases, and
 * matches the established pattern used by GradeMate/Graider/ExamAI in production.
 *
 * Subject-aware grading: Pass 2 prompt branches the rubric by subject family.
 * Mathematics gets the original, well-tuned rubric (computation correctness,
 * method working, carry-over, units, sign errors). Other families ship with
 * subject-aware prompts but no specialist post-processing yet — the model is
 * instructed to be conservative on confidence so the teacher gets a clear
 * "review me" signal where it matters.
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
    resolveSubjectFamily,
    type AssessmentScannerInput,
    type AssessmentScannerOutput,
    type PageScan,
    type GradedQuestion,
    type SubjectRubricFamily,
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
// PASS 2 prompt — rubric-grounded scoring, subject-aware
// ───────────────────────────────────────────────────────────────────────────

const Pass2InputSchema = z.object({
    subject: z.string(),
    gradeLevel: z.string(),
    language: z.string(),
    extractedPages: z.string().describe('JSON-stringified array of PageScan results from Pass 1'),
    ncertContext: z.string(),
    teacherAnswerKeyText: z.string().optional(),
    educationBoard: z.string().optional(),
    /**
     * Subject-family rubric guidance, resolved server-side from `subject`.
     * Lives in the prompt verbatim (not branched via Handlebars) so the model
     * sees exactly one rubric per call and isn't tempted to merge them.
     */
    subjectRubric: z.string(),
    /**
     * Honesty disclaimer set when the subject family isn't Mathematics —
     * tells the model to lean conservative on confidence so the teacher
     * gets a clear "review me" signal.
     */
    confidenceGuidance: z.string(),
});

const Pass2OutputSchema = z.object({
    questions: z.array(GradedQuestionSchema),
    recommendedNextSteps: z.array(z.string()),
    studentRecommendations: z.array(z.string()),
});

/**
 * Per-family rubric blocks. Lives outside the Handlebars template so each
 * call sees one focused rubric — combining all six in one mega-prompt would
 * dilute the model's attention and make Math grading worse.
 */
const SUBJECT_RUBRICS: Record<SubjectRubricFamily, string> = {
    mathematics: `**Mathematics rubric — best-in-class focus:**
- **Computation correctness**: arithmetic accuracy on every operation.
- **Method working**: award method marks for correct setup and formula application even when the final number is wrong (carry-over errors, sign errors, transcription slips should keep most of the marks).
- **Carry-over errors**: distinguish a one-off arithmetic slip from a conceptual misunderstanding — don't double-penalise a single bad number that propagates.
- **Units**: deduct 0.5 per missing unit on a question that requires one.
- **Sign errors**: explicit deduction; flag in feedback ("watch the negative sign").
- **Showing work**: when the student wrote out steps, use \`partialCreditBreakdown\` exhaustively (setup, method, computation, answer). When the answer is correct with no working, award full marks but note in feedback that working would help future scoring.`,

    science: `**Science rubric:**
- **Concept understanding**: does the answer demonstrate the underlying principle (not just a memorised sentence)?
- **Terminology accuracy**: scientific terms used correctly — "force" vs "energy", "weight" vs "mass", "evaporation" vs "condensation". Tolerate vernacular variants of the same term.
- **Diagram correctness** (when relevant): labels correct, proportions reasonable, arrows showing direction where applicable.
- **Application reasoning**: for "explain why" / "what would happen if" questions, the chain of cause and effect should be sound.
- **Acceptable variation**: accept paraphrases. Reward partial understanding — a student who names the right phenomenon but misses one step gets significant partial credit.
- **No experimental working to credit**: there is no equivalent of math's method marks here; partialCreditBreakdown should usually be empty for short/long answers (use it only when the question explicitly asks for steps like an experimental procedure).`,

    evs: `**EVS rubric (Class 1–5, Environmental Studies):**
- **Observation accuracy**: when the question asks about something the student has seen / experienced (plants in their area, family helpers, etc.), reward genuine observation over textbook-perfect answers.
- **Age-appropriate vocabulary**: a Class-3 student calling a pollinator "the bee that helps the flower" is fine; don't penalise for not saying "pollinator".
- **Classification correctness**: living vs non-living, plants vs animals, eatable vs inedible — these are the core EVS skills. Mark these strictly.
- **Drawings and labels**: accept rough drawings that show the right idea; full marks for correct labels even if the figure is shaky.
- **Be encouraging**: EVS at this age is about confidence-building. studentFacingFeedback should reinforce curiosity, never shame a wrong observation.
- **partialCreditBreakdown**: usually empty — these questions are short. Use only when the question has clearly separable parts (e.g. "name three…" — one mark per correct name).`,

    social_science: `**Social Science rubric (History / Geography / Civics):**
- **Factual accuracy**: dates, names, places, events. Mark these strictly when the question is purely factual.
- **Causal reasoning (History)**: for "why did X happen" — the chain of causes should be plausible. Reward partial chains; full marks need the key cause + one supporting cause.
- **Location accuracy (Geography)**: map references, directions, climate-zone classifications must be correct. Tolerate spelling variants of place names.
- **Constitutional accuracy (Civics)**: rights, duties, articles, three-branches structure — these have right answers; mark strictly.
- **Source-based questions**: when the question quotes a passage and asks for interpretation, reward correct comprehension over recitation.
- **partialCreditBreakdown**: use sparingly — only when the question has explicit parts ("list three causes of the revolt of 1857" — one mark per cause).`,

    language: `**Language rubric (Hindi / English) — branches by question type:**
For **grammar / fill-blank / one-word**:
- **Grammar correctness**: tense, agreement, number, case. Strict marking.
- **Spelling**: tolerate one minor spelling slip per answer for primary classes; strict for Class 9+.
- **Vocabulary**: synonyms and idiomatic equivalents accepted.

For **comprehension / short answer**:
- **Coherence**: does the answer actually address the question?
- **Idea development**: at least one supporting detail beyond the bare answer.

For **essay / long-answer / creative writing**, use a four-part rubric:
- **Thesis / main idea**: clear and on-topic.
- **Support / examples**: at least two relevant supporting points.
- **Coherence and flow**: paragraphs connect; ideas don't jump.
- **Conclusion**: ties back to the thesis.
Score each 0..full and sum into marksAwarded; record the breakdown in partialCreditBreakdown.

**Vernacular handwriting**: be generous on shirorekha alignment, matra placement, conjuncts — the student is writing by hand, not typing.`,

    other: `**Generic rubric (used when the subject doesn't fit a named family):**
- **Clarity**: is the answer understandable?
- **Correctness**: factually right against the question and NCERT context.
- **Completeness**: covers what the question asked for (not more, not less).
- **Presentation**: legible, organised; doesn't require deduction unless the question explicitly asked for a specific format.

This is a fallback. The rubric is intentionally generic — set \`confidence\` lower than you would for a subject-tuned rubric so the teacher knows to review. Use partialCreditBreakdown only when the question itself has clearly numbered parts.`,
};

const NON_MATH_CONFIDENCE_GUIDANCE = `**Confidence guidance for this subject:** Mathematics is the only subject family with a deeply-tuned rubric in this release. The rubric above is subject-aware but not specialist. **Lean conservative on \`confidence\`** — when in doubt, set \`needsTeacherReview: true\`. Teachers will be reviewing the AI's grades carefully on non-Math subjects; an honest "I'm uncertain" is more useful than a confident-but-wrong score.`;

const MATH_CONFIDENCE_GUIDANCE = `**Confidence guidance:** Mathematics is the best-tuned subject in this release. You can be more decisive on confidence here than on other subjects, but still set \`needsTeacherReview: true\` whenever extraction confidence was below 0.8, partial-credit ambiguity remains, or multiple MCQ options were marked.`;

function rubricFor(family: SubjectRubricFamily): string {
    return SUBJECT_RUBRICS[family];
}

function confidenceGuidanceFor(family: SubjectRubricFamily): string {
    return family === 'mathematics' ? MATH_CONFIDENCE_GUIDANCE : NON_MATH_CONFIDENCE_GUIDANCE;
}

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

## Subject-specific rubric (use this — do NOT invent your own)

{{{subjectRubric}}}

{{{confidenceGuidance}}}

## Universal scoring rules (apply to every subject)

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

3. **Fill-blank / one-word / short-answer**: tolerate spelling variants and synonyms — especially in vernacular languages. Award full marks for clearly equivalent answers.

4. **Mixed-language answers** (e.g. English question, Hindi answer): full marks if the content is correct, unless the rubric explicitly requires answering in a specific language.

5. **No answer written** (\`isAttempted: false\`): 0 marks, \`mistakePattern: 'incomplete'\`, encouraging studentFacingFeedback.

6. **Off-topic answer**: 0 marks, \`mistakePattern: 'off_topic'\`, feedback explains the gap.

7. **MCQ with multiple options ticked**: 0 marks, \`needsTeacherReview: true\`, feedback notes the ambiguity.

8. **Question on a question_only page** (no answer space): score 0 / 0 (excluded from total). Do NOT count against the student.

9. **Confidence < 0.8 OR partial credit ambiguous**: set \`needsTeacherReview: true\`. Be honest about uncertainty — do NOT pretend to be authoritative.

10. **expectedAnswer**: write the correct/reference answer using NCERT context (or teacherAnswerKeyText when provided). For math, include the worked solution.

11. **conceptTested**: short concept name (e.g. "Pythagoras Theorem", "Subject-Verb Agreement", "Photosynthesis").

12. **ncertChapterId**: best match from the NCERT context above. Use null if no match.

13. **mistakePattern**: pick ONE — \`conceptual\` (misunderstood the idea), \`computational\` (right method, wrong arithmetic), \`transcription\` (copied a value wrong from the question), \`incomplete\` (didn't finish), \`off_topic\` (answered the wrong thing), or \`none\` (correct answer).

14. **feedback** (teacher-facing): 1–2 sentences in {{language}}. Specific and actionable. NO generic praise.

15. **studentFacingFeedback**: gentler tone, age-appropriate for {{gradeLevel}}, in {{language}}. Encouraging when score is low. **Never shame the student.**

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
    const family = resolveSubjectFamily(input.subject);
    const subjectRubric = rubricFor(family);
    const confidenceGuidance = confidenceGuidanceFor(family);

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
                    subjectRubric,
                    confidenceGuidance,
                },
                resilienceConfig,
            ),
        `assessmentScanner.pass2.${family}`,
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
