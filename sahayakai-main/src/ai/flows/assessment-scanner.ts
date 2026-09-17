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
    MISTAKE_PATTERNS,
    resolveSubjectFamily,
    type AssessmentScannerInput,
    type AssessmentScannerOutput,
    type PageScan,
    type ExtractedQuestion,
    type GradedQuestion,
    type SubjectRubricFamily,
} from '@/ai/schemas/assessment-scanner-schemas';
import { letterGradeFor } from '@/ai/schemas/assessment-scanner-utils';
import { z } from 'genkit';

// ───────────────────────────────────────────────────────────────────────────
// Typed failure boundaries — let the route map a known cause to a specific,
// actionable user message instead of a generic "AI generation failed".
// ───────────────────────────────────────────────────────────────────────────

/**
 * Thrown when a page's Storage/HTTPS URL could not be fetched + decoded (404,
 * expired download token, network error, etc.). Names the 1-based page number
 * so the teacher knows exactly which upload to re-take.
 */
export class AssessmentPageUnreadableError extends Error {
    readonly pageNumber: number;
    readonly code = 'PAGE_UNREADABLE' as const;
    constructor(pageNumber: number, cause?: unknown) {
        super(
            `Could not read uploaded page ${pageNumber} — re-upload that page and try again.`,
        );
        this.name = 'AssessmentPageUnreadableError';
        this.pageNumber = pageNumber;
        if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
    }
}

/**
 * Thrown when grading produced zero gradable questions across all pages
 * (e.g. Pass-1 extracted nothing readable, or Pass-2 returned an empty/parse-
 * failed result). Distinguishes "we ran but found nothing to grade" from a
 * provider outage.
 */
export class AssessmentEmptyExtractionError extends Error {
    readonly code = 'EMPTY_EXTRACTION' as const;
    constructor() {
        super(
            'We could not read any questions or answers from the uploaded pages. Please re-upload clearer photos and try again.',
        );
        this.name = 'AssessmentEmptyExtractionError';
    }
}

export class AssessmentBlankScanError extends Error {
    readonly code = 'BLANK_SCAN' as const;
    /** 1-based page numbers that came back blank. */
    readonly blankPages: number[];
    constructor(blankPages: number[]) {
        const list = blankPages.join(', ');
        super(
            blankPages.length === 1
                ? `Page ${list} looks blank — there's nothing to grade. Please upload the student's written answer page.`
                : `Pages ${list} look blank — there's nothing to grade. Please upload the student's written answer pages.`,
        );
        this.name = 'AssessmentBlankScanError';
        this.blankPages = blankPages;
    }
}

// ───────────────────────────────────────────────────────────────────────────
// PASS 1 prompt — extraction only, NO grading
// ───────────────────────────────────────────────────────────────────────────

const Pass1InputSchema = z.object({
    pageCount: z.number().int().min(1),
    // All page images in ONE call (single-call Pass 1). Each carries its own
    // 0-based pageIndex so the model can label its output and we can re-join by
    // index. Corrupt/undecodable images are filtered out BEFORE this call (see
    // preparePageImage), so every entry here is a validated image.
    pages: z
        .array(
            z.object({
                pageIndex: z.number().int().min(0),
                imageDataUri: z.string(),
            }),
        )
        .min(1),
    subject: z.string(),
    gradeLevel: z.string(),
    language: z.string(),
});

// Batched Pass-1 output: one PageScan per input image, returned in a single
// call. The flow re-joins by pageIndex and back-fills any page the model
// skipped with an `unreadable` placeholder (salvage-partial degradation).
const Pass1OutputSchema = z.object({
    pages: z.array(PageScanSchema),
});

const pageExtractionPrompt = ai.definePrompt({
    name: 'assessmentScannerPass1',
    input: { schema: Pass1InputSchema },
    output: { schema: Pass1OutputSchema },
    config: {
        temperature: 0,
        // Extraction is mechanical OCR, not reasoning — thinking adds sequential
        // latency for no accuracy gain (council F55). 0 disables it. Raise to
        // 256 only if a blurry/struck-out golden sheet regresses.
        thinkingConfig: { thinkingBudget: 0 },
    },
    prompt: `You are an OCR + structure-extraction expert reading {{pageCount}} page(s) from an Indian student's school assessment notebook. Every page is provided below, each labelled with its page index.

**Your ONLY job in this pass is extraction. DO NOT grade anything. DO NOT decide if the student is right or wrong. Just read what is on each page.**

**Subject:** {{subject}} | **Grade:** {{gradeLevel}} | **Output language:** {{language}}

## Pages
{{#each pages}}
--- PAGE {{this.pageIndex}} ---
{{media url=this.imageDataUri}}
{{/each}}

## Output shape
Return a \`pages\` array with **exactly one entry per page above, in the same order**, each entry's \`pageIndex\` matching that page's label. Apply the rules below to each page independently. In every \`questionId\`, use THAT page's index — \`p<pageIndex>-q1\`, \`p<pageIndex>-q2\`, … (e.g. questions on PAGE 0 use \`p0-q1\`; questions on PAGE 2 use \`p2-q1\`).

## Rules (apply per page)

1. **Extract every question and the student's handwritten answer to it, verbatim.** Put the answer in \`studentAnswerInterpreted\`. **Leave \`studentAnswerRaw\` as an empty string ("") whenever it would be identical to \`studentAnswerInterpreted\`** — i.e. a normally-written answer with no strike-outs. ONLY fill \`studentAnswerRaw\` when it genuinely differs: struck-out work (rule 3), multiple MCQ options marked (rule 7), or a cut-off answer needing \`[CONTINUES]\` (rule 15). This avoids transcribing the same answer twice.
2. For each multi-part question (e.g. 1(a), 1(b), 1(c)), emit one entry per sub-part with questionId 'p<pageIndex>-q1a', 'p<pageIndex>-q1b', etc. (using THIS page's index).
3. **Struck-out work**: capture the original in \`studentAnswerRaw\` using \`[STRUCK: ...]\` markers; put the un-struck final answer in \`studentAnswerInterpreted\`.
4. **No answer written** → set \`isAttempted: false\`, leave \`studentAnswerInterpreted\` empty. NOTE: this is for a question that IS present on the page but was left unanswered — still emit the question. Do NOT confuse it with a \`blank\` page (see rule 9), which has no questions at all.
5. **Question text not visible on the page** (only the answer is shown) → reconstruct from the student's answer + your knowledge of the {{gradeLevel}} {{subject}} NCERT syllabus, and set \`questionTextConfidence\` ≤ 0.6.
6. **Math working**: if the student wrote out steps, copy them into \`workShown\` (use LaTeX for symbols, wrapped in $...$).
7. **MCQ marking ambiguity** (multiple options ticked, partial circles, etc.): include ALL marked options in \`studentAnswerRaw\`; \`studentAnswerInterpreted\` should still pick the most likely intended answer or be empty if truly ambiguous.
8. **Image quality**: be honest. If the page is blurry, has glare, is shot in low light, is rotated, is folded/creased across the text, is partially cropped out of frame, or shows multiple students' handwriting, flag it in \`imageQualityIssues\`. Use \`["none"]\` if the page is clean.
9. **Page type**:
   - \`question_only\`: only the printed/handwritten questions, no student answers
   - \`answer_only\`: student wrote answers but the questions aren't on this page
   - \`mixed\`: both questions and student answers present
   - \`cover\`: title page, name page, etc. — set \`questions: []\`
   - \`blank\`: the page was photographed clearly but is genuinely empty — no printed questions and no handwriting (e.g. a blank answer sheet, or the empty back of a page). Set \`questions: []\`. This is NOT the same as a question the student left unanswered (that page still has the question — use \`mixed\`/\`question_only\` and rule 4). Only use \`blank\` when there is nothing on the page at all.
   - \`unreadable\`: the photo itself cannot be decoded/read (too dark, corrupt, out of focus beyond recognition) — set \`questions: []\`. Use this ONLY when the problem is the image, not an empty page.
10. **Handwriting confidence**: 1.0 = perfectly clear typewriter-clean. 0.5 = readable but several digits/letters ambiguous. 0.0 = scribble.
11. **Marks printed on the page (look carefully — this drives scoring).** Per-question mark allocations are usually printed at the END of the question line or in the RIGHT margin, in small type — e.g. "[5]", "(2)", "(2 marks)", "2M", "×2", "2m". SCAN the end of every question and the right edge for such a number and, when present, capture it in \`marksAvailable\` for that question. For a multi-part question, capture EACH sub-part's own printed marks on its own entry. If only a section/page total is printed (e.g. "Total: 20"), use it to sanity-check the per-question marks. Do NOT invent marks, and do NOT copy a teacher's awarded grade (see rule 13 — "3/5" in the margin is an award, not the allocation). Leave \`marksAvailable\` unset ONLY when no per-question allocation is printed anywhere for that question.
12. **Diagrams**: when the answer is or includes a drawing — a labelled figure, map, graph, ray diagram, etc. — briefly describe in \`workShown\` WHAT was drawn and WHICH labels are present or missing (e.g. "cell diagram; nucleus and cell wall labelled; membrane unlabelled"), so Pass 2 can grade it without seeing the image.
13. **Ignore teacher annotations (CRITICAL).** The page may already be marked by a teacher — red/green ink, ticks ✓, crosses ✗, circles, underlines, margin notes, or a handwritten grade like "3/5" or "Good". **Extract ONLY the printed question text and the STUDENT's own original handwriting.** Never treat a teacher's tick/cross as the student's answer, and never copy a teacher's written grade into \`marksAvailable\` (that field is for marks PRINTED on the paper, not a teacher's award).
14. **Transcribe exactly — DO NOT translate.** \`studentAnswerRaw\` and \`studentAnswerInterpreted\` must be the student's words in the EXACT script and language they wrote, even if it is a mix (e.g. Hinglish: "Plant apna khana photosynthesis se banata hai"). Do NOT translate or convert to {{language}} or to pure Hindi/English — {{language}} governs Pass-2 FEEDBACK, not this transcription. Preserve the student's spelling and wording.
15. **Cut-off / continued answers**: if an answer (or a math working) clearly runs off the bottom of the page or continues onto another page, append the marker \` [CONTINUES]\` to \`studentAnswerRaw\` so Pass 2 knows the answer is not truly incomplete and must not penalise it for stopping early.
16. **Count every question, extract every question, top to bottom (CRITICAL).** Before writing a page's \`questions\` array, scan the WHOLE page from top edge to bottom edge and count EVERY distinct question on it — including every sub-part (1(a), 1(b), (i), (ii), …) and questions in the lower half or bottom corner. Put that count in \`visibleQuestionCount\`. Then extract ALL of them: \`questions\` MUST contain one entry per counted question, so \`questions.length\` equals \`visibleQuestionCount\`. **NEVER stop after the first question or two on a dense page, and never skip questions near the bottom** — a page often holds several questions and all must be returned. If you genuinely cannot read a lower question, still emit an entry for it (\`isAttempted: false\`, low confidence) rather than omitting it. \`visibleQuestionCount\` is 0 only for a \`cover\`/\`blank\`/\`unreadable\` page.

## Examples (format only — do NOT copy this content into your output)

- **Struck-out**: student wrote "42" crossed out then "24" → \`studentAnswerRaw\`: "[STRUCK: 42] 24", \`studentAnswerInterpreted\`: "24".
- **Multi-part** on PAGE 3: "3(a) … 3(b) …" → two entries with questionIds \`p3-q3a\` and \`p3-q3b\`.
- **MCQ ambiguity**: both (B) and (C) ticked → \`studentAnswerRaw\`: "(B) and (C) both marked", \`studentAnswerInterpreted\`: "" (empty when truly ambiguous).

**STOP HERE.** Do NOT score, judge, or grade in this pass. Output the \`pages\` structure only.`,
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

// Pass 2 no longer re-emits `questionText` / `studentAnswer` — they're already
// captured by Pass 1 and merged back by `questionId` in aggregate() (saves
// output tokens on every question). Optional here so the model emits a value
// ONLY as a deliberate correction of a Pass-1 misread (which then forces review).
const Pass2GradedQuestionSchema = GradedQuestionSchema.partial({
    questionText: true,
    studentAnswer: true,
})
    // `teacherOverrides` is a TEACHER-only field, applied later by the
    // PATCH /api/assessment-scanner/[id] route — the AI must never emit it.
    // It was leaking into the model's structured-output schema, and Gemini
    // sometimes populated it (even an empty `{}`), which the UI reads as
    // `Boolean(teacherOverrides) === true` → a false "Edited by you" /
    // "Includes teacher edits" badge on a freshly-graded, un-edited sheet.
    .omit({ teacherOverrides: true })
    // Truncation tolerance. Gemini emits a question's fields in order and, on a
    // long response, sometimes clips the LAST question after the marks — the
    // JSON is COMPLETE and valid but the trailing scoring-metadata fields are
    // absent (observed: `questions.11: must have required property
    // 'mistakePattern'`). Because Genkit validates the whole `questions` array,
    // one missing tail field used to reject the ENTIRE scan and trigger a full
    // regrade (3× retries, ~360s, then 500). Defaulting these trailing fields
    // drops them from the schema's `required` set, so a clipped tail parses and
    // we KEEP the grade (marksAwarded/marksMax/partialCreditBreakdown stay
    // required — a question with no marks can't be salvaged and correctly falls
    // through to the truncation-retry). Content defaults are neutral (no mistake,
    // no concept/chapter/reference). But a MISSING `needsTeacherReview` /
    // `confidence` means the tail was clipped before the model emitted them —
    // genuine uncertainty — so those two default to "flag for review, zero
    // confidence" rather than silently presenting a clipped grade as fully
    // confident. A complete question always carries both, so these defaults only
    // ever bite the clipped tail.
    .extend({
        expectedAnswer: z.string().default(''),
        conceptTested: z.string().default(''),
        ncertChapterId: z.string().nullable().default(null),
        mistakePattern: z.enum(MISTAKE_PATTERNS).nullable().default(null),
        needsTeacherReview: z.boolean().default(true),
        confidence: z.number().min(0).max(1).default(0),
    });
type Pass2GradedQuestion = z.infer<typeof Pass2GradedQuestionSchema>;

export const Pass2OutputSchema = z.object({
    questions: z.array(Pass2GradedQuestionSchema),
    // recommendedNextSteps intentionally NOT requested from the model — the
    // teacher "Next steps" section was dropped to save output tokens + latency.
    // aggregate() still emits an empty array for output-schema/back-compat.
    //
    // Default [] so a response that omits it doesn't hard-fail schema validation.
    // studentRecommendations is a holistic, whole-paper field the model sometimes
    // drops (or truncates away) while still returning valid `questions` — Genkit's
    // strict structured-output parse would otherwise reject the whole response and
    // 500 the scan. The default makes the field non-required at the schema level.
    // (Mirrors teacherParentNote below.)
    studentRecommendations: z.array(z.string()).default([]),
    // Default [] so a model that omits the note doesn't fail schema parsing —
    // the teacher can still write one by hand.
    teacherParentNote: z.array(z.string()).default([]),
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
- **Showing work**: when the student wrote out steps, use \`partialCreditBreakdown\` exhaustively (setup, method, computation, answer). When the answer is correct with no working, award full marks but note in feedback that working would help future scoring.
- **Any valid method**: accept ANY mathematically sound approach, not only the textbook one — full marks if the working is valid and the answer correct, even if the method differs from the expected one.
- **Word problems**: award the setup marks for correctly translating the problem into the right equation/expression BEFORE any computation; a correct setup let down by an arithmetic slip keeps most of the marks.
- **Final form**: expect the answer simplified / in the form the question asks for, with the correct unit and (where the question demands) correct significant figures or rounding.`,

    science: `**Science rubric:**
- **Concept understanding**: does the answer demonstrate the underlying principle (not just a memorised sentence)?
- **Terminology accuracy**: scientific terms used correctly — "force" vs "energy", "weight" vs "mass", "evaporation" vs "condensation". Tolerate vernacular variants of the same term.
- **Diagram correctness** (when relevant): labels correct, proportions reasonable, arrows showing direction where applicable.
- **Application reasoning**: for "explain why" / "what would happen if" questions, the chain of cause and effect should be sound.
- **Acceptable variation**: accept paraphrases. Reward partial understanding — a student who names the right phenomenon but misses one step gets significant partial credit.
- **Numerical & derivation questions (Physics / Chemistry)**: grade these like maths — award method marks in \`partialCreditBreakdown\` for the correct formula, correct substitution, the calculation, and the final answer WITH its correct SI unit. A sound method with an arithmetic slip keeps most marks; a bare final number with no working loses the method marks. Deduct for a missing/wrong unit.
- **Definitions & laws (Class 9–12)**: expect the precise standard/NCERT definition or statement of the law; a vague paraphrase that misses the key qualifier earns only partial.
- **Point-wise breakdown required**: for descriptive answers there are no "method marks", but per universal rule 9 you MUST still enumerate the expected key points (concept named, mechanism explained, correct term used, example given, etc.) in \`partialCreditBreakdown\` for any answer worth ≥2 marks (Class 6+), and sum them into marksAwarded — so an incomplete explanation loses the marks for the points it omits.`,

    evs: `**EVS rubric (Class 1–5, Environmental Studies):**
- **Observation accuracy**: when the question asks about something the student has seen / experienced (plants in their area, family helpers, etc.), reward genuine observation over textbook-perfect answers.
- **Age-appropriate vocabulary**: a Class-3 student calling a pollinator "the bee that helps the flower" is fine; don't penalise for not saying "pollinator".
- **Classification correctness**: living vs non-living, plants vs animals, eatable vs inedible — these are the core EVS skills. Mark these strictly.
- **Drawings and labels**: accept rough drawings that show the right idea; full marks for correct labels even if the figure is shaky.
- **Be encouraging**: EVS at this age is about confidence-building. The student feedback (\`improvementPoints\`) should reinforce curiosity, never shame a wrong observation.
- **partialCreditBreakdown**: usually empty — these questions are short. Use only when the question has clearly separable parts (e.g. "name three…" — one mark per correct name).`,

    social_science: `**Social Science rubric (History / Geography / Civics):**
- **Factual accuracy**: dates, names, places, events. Mark these strictly when the question is purely factual.
- **Causal reasoning (History)**: for "why did X happen" — the chain of causes should be plausible. Reward partial chains; full marks need the key cause + one supporting cause.
- **Location accuracy (Geography)**: map references, directions, climate-zone classifications must be correct. Tolerate spelling variants of place names.
- **Constitutional accuracy (Civics)**: rights, duties, articles, three-branches structure — these have right answers; mark strictly.
- **Source-based questions**: when the question quotes a passage and asks for interpretation, reward correct comprehension over recitation.
- **Compare / difference questions**: expect distinct points of difference covering BOTH sides (a table is ideal); a one-sided answer, or one that gives fewer points than the marks require, earns only partial.
- **Map / diagram work (Geography)**: award for correct location, labelling, and direction where the question asks for them; a described-but-unlabelled feature earns partial.
- **partialCreditBreakdown**: per universal rule 9, enumerate the expected key points for any answer worth ≥2 marks (each cause/factor/feature the scheme expects — one row each) and sum them into marksAwarded, so a partial answer scores partial marks.`,

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

For **formal writing (letter / notice / application / email / report)** — these carry dedicated FORMAT marks in Indian boards, so grade format explicitly, not just content:
- **Format / layout**: the expected components must be present and correctly placed — e.g. a formal letter needs sender's address, date, receiver's address, subject line, salutation, body, complimentary close and signature; a notice needs a box/heading "NOTICE", the issuing body, date, a headline and the writer's name/designation.
- **Content coverage**: all points the question asked for are addressed.
- **Tone & expression**: appropriate register (formal vs informal) and correct grammar.
A missing or misplaced format element is a legitimate mark loss; make it an \`improvementPoint\` (e.g. "Add a subject line", "Put the date below the sender's address").

**Vernacular handwriting**: be generous on shirorekha alignment, matra placement, conjuncts — the student is writing by hand, not typing.`,

    other: `**Generic rubric (used when the subject doesn't fit a named family):**
- **Clarity**: is the answer understandable?
- **Correctness**: factually right against the question and NCERT context.
- **Completeness**: covers what the question asked for (not more, not less).
- **Presentation**: legible, organised; doesn't require deduction unless the question explicitly asked for a specific format.

This is a fallback. The rubric is intentionally generic — set \`confidence\` lower than you would for a subject-tuned rubric so the teacher knows to review. Per universal rule 9, still enumerate the expected key points in \`partialCreditBreakdown\` for any answer worth ≥2 marks and sum them into marksAwarded.`,
};

const NON_MATH_CONFIDENCE_GUIDANCE = `**Confidence guidance:** Mathematics is the only deeply-tuned rubric in this release, so on other subjects report \`confidence\` HONESTLY — do NOT deflate it just because the subject isn't Maths. **Do NOT blanket-flag questions for review.** Flagging every answer buries the few that genuinely need a human and wastes the teacher's time. Set \`needsTeacherReview: true\` ONLY when there is a SPECIFIC reason to doubt THIS grade: a weak/ambiguous Pass-1 read, a borderline partial-credit call, a possible subject mismatch, a cut-off answer, or a truly subjective long-answer you had no key/context to check. A clear answer you graded confidently — even a wrong or incomplete one — MUST be \`needsTeacherReview: false\`. Review means "I'm unsure of my grade", NOT "the student scored low".`;

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
    config: {
        temperature: 0,
        thinkingConfig: { thinkingBudget: 2048 },
    },
    prompt: `You are an experienced Indian school teacher grading a student's {{gradeLevel}} {{subject}} assessment. Your grading must be **fair, specific, and pedagogically useful** — not generic praise.

**Be concise in every text field.** Short, high-signal wording only — no padding, no restating the question. Verbose output helps no one and slows grading. **For every bulleted list (\`improvementPoints\`, \`studentRecommendations\`, \`teacherParentNote\`): include ONLY bullets that add real, distinct value — NEVER pad to reach a maximum count.** The listed counts are CEILINGS, not targets: one strong bullet beats three padded ones, and an empty/short list is correct when little genuinely applies. Never repeat the same point in different words to make a section look fuller.

**Output language for ALL feedback:** {{language}}.

**Native Script Mandate (CRITICAL):** All feedback fields MUST be in {{language}}'s native script (Devanagari for Hindi/Marathi; Bangla, Tamil, Telugu, Kannada, Malayalam, Odia, Gujarati; Gurmukhi for Punjabi) — NEVER Latin transliteration (e.g. writing "Tumi bhalo korecho" instead of "তুমি ভালো করেছ" is a critical failure). English-only metadata like \`mistakePattern\` enum values stay in English.

**Scoring is LANGUAGE-INVARIANT (CRITICAL).** {{language}} sets ONLY the wording of the feedback, NEVER the marks. Decide \`marksAwarded\`, \`marksMax\` and \`partialCreditBreakdown\` FIRST from the answer's CONTENT against the marking scheme, THEN write the feedback in {{language}}. The same answer must earn identical marks in any language — never grade more leniently or strictly because of the feedback language.

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

### Marking & feedback standard — INDIAN boards (CRITICAL)
{{#if educationBoard}}Grade to the **{{educationBoard}}** marking scheme.{{else}}No board was specified — grade to the **CBSE** marking scheme (the Indian default).{{/if}} Apply INDIAN board conventions to BOTH the marks AND the "how to improve" feedback: value-point / step-wise marking, point-wise answers, format marks for formal writing (letter/notice/application), labelled diagrams, keywords underlined, and final numeric answers stated with their SI unit. **Do NOT apply US / UK / European conventions** — no holistic letter-grade-first rubrics, no US 4-point rubric bands, no essay-style marking that ignores value points. Every \`improvementPoints\` bullet must be advice an Indian board examiner would give (e.g. "break the answer into points", "add a heading", "underline the keyword", "label the diagram", "write the final answer with its unit"), NOT Western essay-coaching (e.g. "strengthen your thesis statement", "improve topic sentences").

## Subject-specific rubric (use this — do NOT invent your own)

{{{subjectRubric}}}

{{{confidenceGuidance}}}

## Subject-mismatch guard (check this BEFORE applying the rubric)

You are grading this sheet as **{{subject}}**. First sanity-check that the extracted questions and answers actually belong to {{subject}}. If they CLEARLY belong to a different subject (e.g. you were told "Mathematics" but the page is Science, History, or a language comprehension), do NOT force the {{subject}} rubric onto unrelated content — that produces a confident-but-meaningless score. Instead:
- Set \`needsTeacherReview: true\` on EVERY question.
- Keep \`confidence\` ≤ 0.4 on every question.
- Do NOT award marks as if the content were {{subject}} (a Science short-answer has no "method marks", etc.).
- Name the likely actual subject AND give an explicit re-scan instruction in \`feedback\`, e.g. "This looks like a Science sheet, not Mathematics — re-run the scan with the correct subject selected for an accurate grade."

Only skip this guard when the content genuinely matches {{subject}}. When it matches, proceed normally with the rubric below.

## Universal scoring rules (apply to every subject)

**Grade the un-struck final answer.** For every question, score \`studentAnswerInterpreted\` — the student's intended final answer. Anything wrapped in \`[STRUCK: …]\` inside \`studentAnswerRaw\` was crossed out by the student: treat it as withdrawn — never reward or penalise struck-out work. Grade only what the student left standing. **If \`studentAnswerRaw\` is empty, it is identical to \`studentAnswerInterpreted\`** — just grade the interpreted answer normally.

**How to grade each answer (do this BEFORE assigning marks):**
1. List the key points the correct answer must contain (from the rubric + NCERT context / answer key).
2. Check which of those points the student's answer actually contains — point by point.
3. Award marks for the points hit; the points MISSED are what become the \`improvementPoints\`.
4. Do NOT reward restatement: an answer that only repeats the question or copies a definition without the asked-for content earns low marks.
5. Respect the read: if Pass-1 \`answerConfidence\` or \`handwritingConfidence\` was low, grade the most likely intended answer and set \`needsTeacherReview: true\` — never score an uncertain read as outright wrong.
6. Keep marks internally consistent: when \`partialCreditBreakdown\` is present, \`marksAwarded\` MUST equal the sum of its \`earned\` values, and must never exceed \`marksMax\`.
7. Continued answers: if \`studentAnswerRaw\` ends with \`[CONTINUES]\`, the answer ran off the page — grade what IS present and do NOT deduct for it "stopping early" or looking incomplete; set \`needsTeacherReview: true\` because the full answer wasn't captured.
8. No reference material: if BOTH \`teacherAnswerKeyText\` AND the NCERT context are empty/unavailable, grade against standard, universally-accepted facts for {{gradeLevel}} — and set \`needsTeacherReview: true\` ONLY for genuinely SUBJECTIVE/opinion answers where a fair grade could reasonably differ, NOT for factual answers you can grade confidently from general knowledge.
9. **Show the marking scheme — do NOT grade holistically (MOST IMPORTANT).** For every NON-MCQ question worth **≥ 2 marks at Class 6 and above**, you MUST populate \`partialCreditBreakdown\` with the KEY POINTS a full-mark answer requires — ONE row per expected point (\`step\` = the point, \`max\` = its marks, usually 1), and \`earned\` = what the student actually got for it. Then set \`marksAwarded\` = the SUM of \`earned\`.

   **Build the scheme from a COMPLETE model answer FIRST — before you read the student's answer — and NEVER shrink it to fit what the student wrote (this is the #1 cause of over-marking).** Write the marking scheme a board topper would be held to, then check the student against that FIXED scheme. If the student covered fewer points, or covered them more briefly, than the model answer, they lose those marks. A 5-mark answer's scheme should list enough distinct, developed points (typically 5–7) that a 3–4 line answer touching the topic CANNOT clear the bar — e.g. a full "features of the Himalayas" scheme also expects their role in monsoon/rainfall, perennial glacier-fed rivers, biodiversity, and strategic/defensive barrier, not just formation + ranges + peaks. Do not reverse-engineer 5 tidy points that happen to match the 5 sentences the student wrote. Enumerate the points a real teacher/board scheme expects. A point the student did NOT make earns 0. **A correct-but-incomplete answer therefore CANNOT get full marks** — full marks require every row earned. This mechanical breakdown replaces gut-feeling scoring. (Exception: Classes 1–5 stay lenient — a short breakdown or none is fine there.)

   **Developed, not just named (Classes 9–12).** A point earns its FULL mark only when the student both STATES and DEVELOPS it — the reason/detail a board answer expects (e.g. "black *because of iron and magnesium*", not just "black"; "cracks *which improve aeration*", not just "cracks"). A point merely name-dropped in a bare one-line list earns at most HALF its mark. So a thin answer that lists a few correct labels without explaining them should land around half marks, never full. Full marks are reserved for an answer with the depth of a model board answer.

10. **Grade to the question's COMMAND WORD.** The directive verb sets how much depth is required — expect exactly that, no more, no less:
   - *define / state / name / list / what / who / when* → a brief, precise answer is FULL marks. Do NOT demand elaboration or dock for being short.
   - *explain / describe / how / why / discuss* → requires reasons / mechanism / elaboration; a bare statement of fact earns only partial.
   - *differentiate / compare / distinguish between* → requires distinct points of difference for BOTH sides (a table is ideal); a one-sided or single-point answer earns partial.
   - *derive / prove / show that / calculate* → every step must be shown; a bare final answer loses the method marks.
   - *analyse / evaluate / justify / "to what extent"* (Class 9–12) → requires a reasoned argument with evidence, not a list of facts.

**Grade-level expectations — calibrate scoring to {{gradeLevel}}, NOT a fixed adult standard.** Judge every answer against what a fair teacher reasonably expects at THIS class:
- **Classes 1–5 (primary):** Reward correct understanding in the child's own simple words. A full-mark answer may be SHORT — even for a higher-mark question — and need NOT use headings, bullet points, examples, or technical terms unless the question explicitly asks for them. Never deduct for informal structure, plain language, or lack of "points format". Award full marks when the core idea is correct and age-appropriately complete. Any \`improvementPoints\` must be about the IDEA ("also mention the sun keeps us warm"), NEVER about format ("add a heading", "write in points").
- **Classes 6–8 (middle):** Expect the main points covered with correct key terms and a clear explanation; light structure helps but isn't required. Examples expected where the question invites them. A correct-but-thin answer earns partial, not full, marks.
- **Classes 9–10 (secondary):** Expect detailed, well-structured, point-wise answers with precise terminology and examples/diagrams where relevant, in proportion to the marks. Here, missing structure, missing examples, vague terms, or an answer too short for the marks ARE legitimate mark losses — this is how CBSE boards actually mark. Format-oriented \`improvementPoints\` (use points, add a heading, label the diagram, underline keywords) are appropriate at this level. **Full marks are the exception, not the default:** for a 5-mark answer, top marks require ~4–5 developed points with real depth — NOT a short, correct-but-thin list of 2–4 lines. A brief answer whose points are correct but under-developed should land around 3–4 out of 5, not 5. Never award full marks just because the few points present happen to be correct.
- **Classes 11–12 (senior secondary):** The strictest tier — grade like a board examiner. Require high analytical depth, exact NCERT/standard definitions, correct technical terminology, and **step-by-step derivations** in Physics/Maths/Chemistry. **The method IS assessed:** deduct for missing or skipped steps even when the final answer is correct. Enforce **standard SI units** (deduct for a missing/wrong unit) and correct significant figures where relevant. A correct-but-unjustified answer, or one lacking the expected rigour/derivation, must lose marks.

For EACH extracted question, produce one GradedQuestion (reuse its exact \`questionId\` so it maps back to the extraction — do NOT renumber or invent ids):

1. **Marks scale (per question) — decide \`marksMax\` in this priority order:**
   1. **Printed marks win.** If Pass 1 captured \`marksAvailable\` for the question, use that number as \`marksMax\` verbatim. For a multi-part question, each sub-part uses its OWN captured marks.
   2. **Not printed → READ THE QUESTION and assign a fair mark. Do NOT apply a blanket default.** Judge how much a correct answer genuinely requires from the question's COMMAND WORD (rule 10), the number of sub-parts, and the {{gradeLevel}} expectation:
      - define / state / name / list-one / fill_blank / one-word / mcq / true_false → **1**
      - a short "give one reason / explain briefly / two-word" answer → **2**
      - "explain / describe / how / why" needing a few points or a short derivation → **3** (up to **4** when it asks for several distinct points)
      - a genuinely long / essay / "discuss in detail" answer expecting ~5+ developed points → **5**
      - each sub-part (a)/(b)/(i)/(ii) gets its OWN \`marksMax\` by this same test; "name three…" earns 1 per required item
      - math_calculation → the distinct assessable steps (typically setup + method + answer ≈ 3); diagram → correct figure + each required label (≈ 3); match_following → 1 per pair
      These numbers describe the DEMAND you read in the question — they are NOT a fixed table keyed on \`questionType\`. A one-line "define" is 1 even if tagged short_answer; a multi-point "explain" is 5 even if the student wrote little. Use whole or half marks only as the marking scheme naturally divides. NEVER inflate every question to the top of its band — that is the #1 cause of a wrong (too-high) paper total.

2. **MCQ**: exact match → full marks; wrong or multiple selections → 0; record this as \`partialCreditBreakdown: []\` (no partial for MCQ).

3. **Fill-blank / one-word / short-answer**: tolerate spelling variants and synonyms — especially in vernacular languages. Award full marks for clearly equivalent answers.

4. **Mixed-language answers** (e.g. English question, Hindi answer): full marks if the content is correct, unless the rubric explicitly requires answering in a specific language.

5. **No answer written** (\`isAttempted: false\`): 0 marks, \`mistakePattern: 'incomplete'\`.

6. **Off-topic answer**: 0 marks, \`mistakePattern: 'off_topic'\`, feedback explains the gap.

7. **MCQ with multiple options ticked**: 0 marks, \`needsTeacherReview: true\`, feedback notes the ambiguity.

8. **Question on a question_only page** (no answer space): score 0 / 0 (excluded from total). Do NOT count against the student.

9. **needsTeacherReview — flag ONLY genuine uncertainty about YOUR OWN grade**, for a specific reason: a weak/ambiguous Pass-1 read, genuinely borderline partial credit, a possible subject mismatch, a cut-off (\`[CONTINUES]\`) answer, multiple MCQ options marked, or a subjective long-answer with no key/context to check against. A clear grade you are confident in — even a low or zero one — stays \`false\`. Do NOT flag a question just because the student scored poorly, or just because it isn't Maths.

10. **expectedAnswer**: Fill this ONLY for OBJECTIVE types (\`mcq\`, \`true_false\`, \`fill_blank\`) that the student got **WRONG** (marksAwarded < marksMax) — give the concise correct answer so the student learns it. Leave it **EMPTY ("")** when an objective answer is correct, and for **all descriptive types** (\`short_answer\`, \`long_answer\`, \`math_calculation\`, \`diagram\`, \`match_following\`) — an AI-written model answer for those is NOT shown to the teacher, so writing it only wastes tokens. **Stay within the NCERT context / answer key provided**: if the question falls outside the given scope, say so in \`feedback\` and set \`needsTeacherReview: true\` rather than inventing authoritative facts.

10b. **questionType**: copy the \`questionType\` from the extracted question verbatim (mcq, fill_blank, short_answer, long_answer, math_calculation, diagram, match_following, true_false). The UI uses this to decide whether to show the reference answer.

10c. **Do NOT re-print \`questionText\` or \`studentAnswer\`.** Both are already captured by the extraction and merged back automatically by \`questionId\` — leave them EMPTY ("") to save tokens. Emit a value ONLY to CORRECT a clear Pass-1 misread you can fix from context (an obvious OCR slip); when you do, your value replaces the extraction AND you MUST set \`needsTeacherReview: true\` so a human confirms the correction.

11. **conceptTested**: short concept name (e.g. "Pythagoras Theorem", "Subject-Verb Agreement", "Photosynthesis").

12. **ncertChapterId**: best match from the NCERT context above. Use null if no match.

13. **mistakePattern**: pick ONE — \`conceptual\` (misunderstood the idea), \`computational\` (right method, wrong arithmetic), \`transcription\` (copied a value wrong from the question), \`incomplete\` (didn't finish), \`off_topic\` (answered the wrong thing), or \`none\` (correct answer).

14. **feedback** (INTERNAL — NOT shown in the normal result): leave it as an empty string "" for a normal graded answer. Fill it ONLY when the subject-mismatch guard applies (put the "re-scan with the correct subject" note here).

15. **Reading level for the student-facing text** (\`improvementPoints\` — this IS the student's feedback): match {{gradeLevel}} — Class 1–6 very short, one idea, everyday words (a friendly emoji is fine); Class 7–8 a little more detail, may name the concept; Class 9–10 precise terms, may cite the NCERT chapter. Never shame the student.

16. **improvementPoints**: an array of 1–4 SHORT bullets naming exactly what was MISSING and how to earn the remaining marks. Each bullet is ONE concrete action grounded in how CBSE answers are marked — e.g. "Add one example to support your point", "Break the answer into 2–3 points instead of a paragraph", "Give the answer a short heading", "Label the diagram", "Underline the keyword: photosynthesis", "Write the final answer with its unit (e.g. 56 cm)", "This is a 5-mark question — add 2 more points; you wrote only 1." Rules: **start every bullet with a strong, actionable verb** — "Add…", "Calculate…", "Define…", "Explain…", "Label…", "Include…", "State…", "Show…" — never a vague opener like "You should have…" or "The answer needs…"; keep each bullet SHORT (roughly ≤12 words); no generic praise as a bullet; tie each bullet to marks actually lost; **scale the count to the marks lost** (a 1-mark question gets at most 1 bullet; up to 3–4 for a 5-mark answer — but ONLY for gaps that genuinely cost marks, never padded to reach that number); in {{language}}. Use an **empty array []** when the answer earned full marks. **Also use an empty array [] for OBJECTIVE question types — \`mcq\`, \`true_false\`, \`fill_blank\`, one-word, \`match_following\` — whether right or wrong.** These are all-or-nothing (full for correct, 0 for wrong) and have no "how to improve"; for a wrong one the only correction the student needs is the correct answer, which already goes in \`expectedAnswer\`. Reserve \`improvementPoints\` for answers that can be partially right — short/long answers, math working, diagrams.

17. **whyCorrect**: one short line, in {{language}}, giving the REASON the correct answer is right (the "because…"), age-appropriate for {{gradeLevel}}. Provide it ONLY when \`expectedAnswer\` is populated (i.e. a wrong objective answer) AND the reason isn't trivially obvious (e.g. one-word factual recall). Leave empty otherwise — including all descriptive types.

18. **Keep every field DISTINCT — do not repeat yourself.** \`improvementPoints\` (what to fix), \`whyCorrect\` (why the answer is right) and \`feedback\` (a private note FOR THE TEACHER, not the student) must each say something different. Never restate the same sentence across fields.

19. **Diagram answers**: grade from the description Pass 1 placed in \`workShown\`. Award marks for a correct overall figure, correct and complete labels, and any parts the question explicitly required. Missing or wrong labels are the usual mark loss — make them the \`improvementPoints\` (e.g. "Label the nucleus").

## Worked example (format only — do NOT copy this content into your output)

Question (3 marks): "Why do we have day and night?" · Student wrote: "Because the Earth moves."
- Key points required: (1) the Earth ROTATES on its axis, (2) the side facing the Sun has day, (3) the side facing away has night.
- Student hit point 1 only, vaguely → \`marksAwarded\`: 1 / 3.
- \`partialCreditBreakdown\`: [{step:"Earth rotates on its axis", earned:1, max:1}, {step:"day side faces the Sun", earned:0, max:1}, {step:"night side faces away", earned:0, max:1}].
- \`improvementPoints\`: ["Say the Earth ROTATES on its axis", "Add that the side facing the Sun has day and the other has night"].
- \`whyCorrect\`: "As the Earth spins, each side turns toward and away from the Sun, making day and night."
- \`mistakePattern\`: "incomplete".

## Worked example 2 — a thin answer is NOT full marks (Class 10, 5 marks)

Question: "Characteristics of black soil." · Student wrote: "Regur soil. Black and clayey. Found in Deccan Plateau. Good for cotton." (a bare list, no development)
- Marking scheme (5 points, 1 each): (1) name regur/black-cotton, (2) black colour AND why (iron/magnesium), (3) clayey texture AND moisture retention / cracks, (4) mineral composition (rich in lime/potash, poor in N & P), (5) suitability (cotton) + distribution (Deccan).
- Student: (1) named ✓1; (2) colour named, not explained → 0.5; (3) "clayey" only, no moisture/cracks → 0.5; (4) missing → 0; (5) cotton + Deccan ✓1.
- \`partialCreditBreakdown\`: [{step:"Names regur/black cotton", earned:1, max:1}, {step:"Colour + reason", earned:0.5, max:1}, {step:"Texture + moisture/cracks", earned:0.5, max:1}, {step:"Mineral composition", earned:0, max:1}, {step:"Cotton + distribution", earned:1, max:1}].
- \`marksAwarded\`: **3 / 5** — correct as far as it goes, but under-developed and missing composition. NOT 5/5.
- \`improvementPoints\`: ["Explain WHY it is black (iron and magnesium)", "Add its mineral composition — rich in lime and potash, poor in nitrogen", "Mention it develops cracks that aid aeration"].
(The full 7-point answer with reasons WOULD earn 5/5 — full marks require that depth.)

## Final aggregation

Also produce:

- **studentRecommendations** (for the student, in {{language}}): up to 2–3 bullets — what to focus on this week, which concepts to revise. Fewer is fine (even 1); include only what genuinely helps. Tone is supportive.
- **teacherParentNote** (from the teacher to the PARENT, in {{language}}): an ARRAY of up to 4 SHORT bullet points (as few as 1–2 is fine when that's all that applies) — each a concrete observation of the student's actual pattern, and ONLY the bullets that truly apply (no marks dump; the summary already lists marks). Draw each bullet from real evidence:
  - **Handwriting** (use the pages' \`handwritingConfidence\`): praise if neat ("Neat, clear handwriting — easy to read"), or flag if not ("Handwriting is hard to read — please help them practise writing neatly").
  - **Concept understanding** (from \`mistakePattern\` + the weak topics): "Understands the main ideas well", or "Missed key concepts in [topic] — needs revision".
  - **Answer length / completeness** (from short or incomplete answers): "Answers are too short — encourage adding 1–2 more points to each".
  - **Accuracy** (from the overall score): "Several answers in [topic] were incorrect".
  - Finish with ONE clear thing the parent can do at home.
  Plain, warm, respectful language a parent understands — no jargon.

**Be honest. If you're unsure, set needsTeacherReview: true. Authentic grades > confident grades.**`,
});

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

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
        // Fallback: pull all chapters for grade + subject. Cap at 3 to keep
        // the prompt small (each chapter ~150 tokens of outcomes + keywords).
        // 3 covers the usual 1–2 relevant chapters with a little headroom.
        chapters = getChaptersForGrade(grade, input.subject).slice(0, 3);
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
// PASS 1: ONE call over all images. Each image is fetched + validated first, so
// a corrupt/undecodable file becomes an unreadable placeholder BEFORE the model
// call — preserving per-page isolation despite the single call.
// ───────────────────────────────────────────────────────────────────────────
const MAX_OCR_IMAGE_DIMENSION = 1536;

/** Minimal "we couldn't read this page" PageScan — Pass 2 still gets valid structure. */
function unreadablePlaceholder(pageIndex: number): PageScan {
    return {
        pageIndex,
        pageType: 'unreadable',
        handwritingConfidence: 0,
        imageQualityIssues: ['none'],
        detectedLanguage: 'unknown',
        questions: [],
    };
}

/** A page image ready for the model, or flagged unreadable if it couldn't be decoded. */
type PreparedPage =
    | { pageIndex: number; imageDataUri: string }
    | { pageIndex: number; unreadable: true };

/** Lazily load sharp; returns null if the native module can't be loaded. */
async function loadSharp() {
    try {
        return (await import('sharp')).default;
    } catch {
        return null;
    }
}

/** 429/503 are transient infra, not an unreadable scan — they must propagate as-is. */
function isTransientInfraError(err: unknown): boolean {
    const e = err as { name?: string; status?: number } | null;
    return e?.name === 'AIQuotaExhaustedError' || e?.status === 503;
}

/**
 * Validate + right-size a base64 image for OCR. Returns the (possibly downscaled)
 * data URI, or `null` when the bytes cannot be decoded as an image (corrupt /
 * unsupported) — the caller turns `null` into an unreadable placeholder so a
 * single bad file never fails the whole single-call batch.
 */
async function prepareImageForOcr(dataUri: string): Promise<string | null> {
    const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,([\s\S]*)$/.exec(dataUri);
    if (!match) return dataUri; // not a base64 image data URI — pass through untouched

    const sharp = await loadSharp();
    if (!sharp) {
        // sharp unavailable → can't validate here; let the model see the original
        // rather than wrongly flagging every page unreadable.
        return dataUri;
    }
    const buffer = Buffer.from(match[1], 'base64');

    let meta;
    try {
        meta = await sharp(buffer).metadata();
    } catch {
        // sharp IS available but cannot decode → corrupt / unsupported image.
        return null;
    }
    const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
    if (longEdge === 0) return null; // decoded but no dimensions → treat as corrupt
    if (longEdge <= MAX_OCR_IMAGE_DIMENSION) return dataUri; // valid + already small enough

    try {
        const out = await sharp(buffer)
            .rotate()
            .resize(MAX_OCR_IMAGE_DIMENSION, MAX_OCR_IMAGE_DIMENSION, {
                fit: 'inside',
                withoutEnlargement: true,
            })
            .jpeg({ quality: 70 })
            .toBuffer();
        return `data:image/jpeg;base64,${out.toString('base64')}`;
    } catch {
        // Decode worked but resize failed — send the validated original.
        return dataUri;
    }
}

/**
 * Fetch (if remote) and validate one page image. A fetch failure is a known,
 * actionable error → typed AssessmentPageUnreadableError naming the 1-based page
 * so the teacher re-uploads exactly that page. A decodable-but-corrupt image is
 * flagged `unreadable` (not thrown) so the rest of the batch still grades.
 */
async function preparePageImage(
    pageUrl: string,
    pageIndex: number,
    input: AssessmentScannerInput,
): Promise<PreparedPage> {
    let imageDataUri: string;
    if (pageUrl.startsWith('data:')) {
        imageDataUri = pageUrl;
    } else {
        try {
            imageDataUri = await fetchImageAsBase64(pageUrl);
        } catch (fetchErr) {
            const { logger } = await import('@/lib/logger');
            logger.error(
                `Assessment Scanner: failed to fetch page ${pageIndex + 1}`,
                fetchErr,
                'ASSESSMENT',
                {
                    userId: input.userId,
                    assessmentId: input.assessmentId,
                    pageNumber: pageIndex + 1,
                    reason: 'page_fetch_failed',
                },
            );
            throw new AssessmentPageUnreadableError(pageIndex + 1, fetchErr);
        }
    }

    const validated = await prepareImageForOcr(imageDataUri);
    if (validated === null) return { pageIndex, unreadable: true };
    return { pageIndex, imageDataUri: validated };
}

/**
 * Extract ALL validated pages in ONE model call. Salvages partial output: any
 * page the model skips/omits is back-filled with an unreadable placeholder, so a
 * short/truncated response degrades page-by-page, not all-or-nothing. On a
 * transient infra error (429/503) the error propagates; on any other total
 * failure it returns all-unreadable placeholders plus the captured `failure`
 * (the caller rethrows it only when nothing at all was gradable).
 */
// Pages a single batched call most often under-reads are dense, contentful
// pages; how many to re-extract concurrently (kept modest to stay quota-safe
// on a single-key pool, mirroring the quiz flow's 3× parallelism).
const REEXTRACT_CONCURRENCY = 4;

// Pass-1 extraction strategy (SCANNER_SETUP doc, Decision 2 / Step 2.3).
//   'fanout' (DEFAULT) = one model call PER PAGE, run concurrently → wall-clock ≈
//               slowest page not the sum, per-page retry isolation, no dense-page
//               under-read. REQUIRED past a few pages: one batched call generates
//               ~1.3k output tokens PER PAGE serially, so ~10 pages ≈ ~13k tokens in
//               a single call ≈ well over the request budget (a 2-page batched call
//               already took ~29s). Batched simply doesn't scale to 10 pages.
//   'batched' = one multi-image call for all pages. Fine for 1–2 pages; too slow
//               beyond that because output generation is serial.
//
// CONCURRENCY: a whole scan is N Pass-1 calls + 1 Pass-2 ≈ ~11 requests at the
// 10-page cap — UNDER the ~15 RPM limit. Measured: a real 9-page scan at concurrency
// 3 ran with ZERO retries/429s (attempts:1 on every page), so there's headroom.
// Default is now 10 so all pages at the cap fire in ONE wave (fully parallel);
// ~11 requests < 15 RPM still leaves a little room for retries (the doc's "cap ~10
// for a 15-RPM tier" logic). Safe for a SINGLE in-flight scan; concurrent scans
// across users still need the Redis token bucket (plan Phase 3) before staging.
// If the logs ever show `attempts>1` / `[AI Resilience]` backoff, lower this.
const PASS1_STRATEGY: 'fanout' | 'batched' =
    process.env.ASSESSMENT_SCANNER_PASS1_STRATEGY === 'batched' ? 'batched' : 'fanout';

// Per-pass model override. Extraction (Pass 1) and grading (Pass 2) can point at
// DIFFERENT Gemini models via env, with NO code change — the two passes have
// different needs (Pass 1 = fast OCR; Pass 2 = grading reasoning). Unset => the
// genkit default model (see genkit.ts). Value is a full Genkit model ref, e.g.
// "googleai/gemini-3.1-flash-lite".
const PASS1_MODEL = process.env.ASSESSMENT_SCANNER_PASS1_MODEL || undefined;
const PASS2_MODEL = process.env.ASSESSMENT_SCANNER_PASS2_MODEL || undefined;
const PASS1_FANOUT_CONCURRENCY =
    Number(process.env.ASSESSMENT_SCANNER_PASS1_CONCURRENCY) || 10;
const CONTENTFUL_PAGE_TYPES = new Set<PageScan['pageType']>([
    'mixed',
    'question_only',
    'answer_only',
]);
function isContentfulPage(ps: PageScan): boolean {
    return CONTENTFUL_PAGE_TYPES.has(ps.pageType);
}
/**
 * A page is "under-read" when the model counted more questions than it returned
 * (`visibleQuestionCount > questions.length`) — the exact signature of the top-
 * of-page-only read that dropped page 2's Q11–Q14 — or when a page it classified
 * as contentful came back with zero questions.
 */
function isUnderReadPage(ps: PageScan): boolean {
    if (
        typeof ps.visibleQuestionCount === 'number' &&
        ps.visibleQuestionCount > ps.questions.length
    ) {
        return true;
    }
    return isContentfulPage(ps) && ps.questions.length === 0;
}

/** Run `fn` over `items` with at most `limit` in flight. */
async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>,
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let next = 0;
    async function worker() {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i]);
        }
    }
    await Promise.all(
        Array.from({ length: Math.min(limit, items.length) }, () => worker()),
    );
    return results;
}

/**
 * Extract ONE page in its own model call. The model gets full attention and a
 * generous budget on a single image — the core of both the fan-out primary path
 * (Step 3) and the batched-path salvage re-extraction. THROWS on a real error so
 * the caller can classify it; an empty model response degrades to an unreadable
 * placeholder (not an error), since a page that returns nothing is unreadable.
 */
async function extractOnePage(
    page: { pageIndex: number; imageDataUri: string },
    input: AssessmentScannerInput,
    resilienceLabel = 'assessmentScanner.pass1',
): Promise<PageScan> {
    const perPageMaxOutputTokens = 16384;
    const resp = await runResiliently(
        async (rc) =>
            pageExtractionPrompt(
                {
                    pageCount: 1,
                    pages: [page],
                    subject: input.subject,
                    gradeLevel: input.gradeLevel,
                    language: input.language,
                },
                {
                    ...(PASS1_MODEL ? { model: PASS1_MODEL } : {}),
                    config: { ...rc.config, maxOutputTokens: perPageMaxOutputTokens },
                },
            ),
        resilienceLabel,
    );
    const pagesOut = resp.output?.pages ?? [];
    if (pagesOut.length === 0) return unreadablePlaceholder(page.pageIndex);
    const raw =
        pagesOut.find(
            (p) => (p as { pageIndex?: number }).pageIndex === page.pageIndex,
        ) ?? pagesOut[0];
    return PageScanSchema.parse({ ...raw, pageIndex: page.pageIndex });
}

/**
 * Best-effort per-page re-extraction for the batched path's salvage step: on ANY
 * error (including a transient 429) it returns null and the caller keeps the
 * batch read — the under-read page is still flagged for review, so nothing is lost.
 */
async function extractSinglePage(
    page: { pageIndex: number; imageDataUri: string },
    input: AssessmentScannerInput,
): Promise<PageScan | null> {
    try {
        return await extractOnePage(page, input, 'assessmentScanner.pass1.reextract');
    } catch {
        return null;
    }
}

/**
 * Pass-1 FAN-OUT (doc Step 2.3): one model call per page, run concurrently, so
 * wall-clock ≈ the slowest single page, not the sum. Each page retries alone via
 * runResiliently — per-page isolation, so one bad page can't fail the batch.
 * Error contract mirrors extractAllPages: a purely transient TOTAL failure
 * (nothing gradable) propagates so the route returns a retry-able error; any
 * partial failure yields unreadable placeholders and the scan proceeds.
 */
async function extractPagesFanOut(
    validPages: Array<{ pageIndex: number; imageDataUri: string }>,
    input: AssessmentScannerInput,
): Promise<{ pages: PageScan[]; failure?: unknown }> {
    let transientError: unknown;
    let otherFailure: unknown;
    const results = await mapWithConcurrency(
        validPages,
        PASS1_FANOUT_CONCURRENCY,
        async (page): Promise<PageScan | null> => {
            try {
                return await extractOnePage(page, input);
            } catch (err) {
                if (isTransientInfraError(err)) transientError = err;
                else otherFailure = err;
                return null;
            }
        },
    );
    const succeeded = results.filter((r): r is PageScan => r !== null).length;
    // Nothing gradable AND every failure was transient (quota/503) → propagate so
    // the route returns "try again", matching the batched path's contract.
    if (succeeded === 0 && transientError) throw transientError;
    const pages = validPages.map(
        (p, i) => results[i] ?? unreadablePlaceholder(p.pageIndex),
    );
    return { pages, failure: otherFailure };
}

async function extractAllPages(
    validPages: Array<{ pageIndex: number; imageDataUri: string }>,
    pageCount: number,
    input: AssessmentScannerInput,
): Promise<{ pages: PageScan[]; failure?: unknown }> {
    // Output ceiling (guard, not trim): scale with page count so a many-page
    // batch can't truncate mid-JSON, floored for a single page, capped at the
    // gemini-2.5-flash max (65,536). Passed at call time so the prompt's own
    // temperature/thinkingBudget:0 are preserved (merged).
    const pass1MaxOutputTokens = Math.max(8192, Math.min(65536, 2200 * pageCount));
    let pass1Response;
    try {
        pass1Response = await runResiliently(
            async (resilienceConfig) => {
                return pageExtractionPrompt(
                    {
                        pageCount,
                        pages: validPages,
                        subject: input.subject,
                        gradeLevel: input.gradeLevel,
                        language: input.language,
                    },
                    {
                        ...(PASS1_MODEL ? { model: PASS1_MODEL } : {}),
                        config: {
                            ...resilienceConfig.config,
                            maxOutputTokens: pass1MaxOutputTokens,
                        },
                    },
                );
            },
            'assessmentScanner.pass1',
        );
    } catch (err) {
        // Transient infra (quota/503) must propagate as-is so the route returns a
        // real "try again" rather than mislabelling it as an unreadable scan.
        if (isTransientInfraError(err)) throw err;
        // Any other total failure (e.g. bad-media the validator didn't catch):
        // degrade every page to unreadable and hand the error back so the caller
        // can rethrow it when nothing was gradable.
        return {
            pages: validPages.map((p) => unreadablePlaceholder(p.pageIndex)),
            failure: err,
        };
    }

    const { output, usage: pass1Usage } = pass1Response;

    if (!output) {
        return { pages: validPages.map((p) => unreadablePlaceholder(p.pageIndex)) };
    }

    // Salvage: index returned pages by their declared pageIndex; trust a valid
    // declared index (handles reordering), else fall back to positional alignment
    // (handles a mislabel), then back-fill any missing page with a placeholder.
    const returned = output.pages ?? [];
    const byIndex = new Map<number, PageScan>();
    returned.forEach((raw, position) => {
        const declared = (raw as { pageIndex?: number })?.pageIndex;
        const pageIndex =
            typeof declared === 'number' && validPages.some((p) => p.pageIndex === declared)
                ? declared
                : validPages[position]?.pageIndex ?? position;
        // Genkit already schema-validates, but re-parse defensively with the
        // resolved pageIndex so a bad response can't corrupt downstream state.
        const parsed = PageScanSchema.parse({ ...raw, pageIndex });
        byIndex.set(parsed.pageIndex, parsed);
    });

    const initialPages = validPages.map(
        (p) => byIndex.get(p.pageIndex) ?? unreadablePlaceholder(p.pageIndex),
    );

    // ── Completeness guard ───────────────────────────────────────────────────
    // A single batched call can under-read a dense page: the model transcribes
    // the top questions and silently drops the rest (observed: a 9-page scan
    // returned only Q10 for page 2, dropping Q11–Q14). Detect such pages — via
    // the model's own `visibleQuestionCount` vs what it returned, a contentful
    // page with zero questions, or a truncated response — and RE-EXTRACT them
    // one-per-call, then keep whichever read is more complete.
    const finishReason = (pass1Response as { finishReason?: string }).finishReason;
    const truncated =
        finishReason === 'length' ||
        (typeof pass1Usage?.outputTokens === 'number' &&
            pass1Usage.outputTokens >= pass1MaxOutputTokens * 0.95);

    const validByIndex = new Map(validPages.map((p) => [p.pageIndex, p]));
    const suspects = initialPages.filter(
        (ps) => isUnderReadPage(ps) || (truncated && isContentfulPage(ps)),
    );

    if (suspects.length === 0) {
        return { pages: initialPages };
    }

    const reExtracted = await mapWithConcurrency(
        suspects,
        REEXTRACT_CONCURRENCY,
        async (ps) => ({
            pageIndex: ps.pageIndex,
            fresh: await extractSinglePage(validByIndex.get(ps.pageIndex)!, input),
        }),
    );

    const merged = new Map(initialPages.map((p) => [p.pageIndex, p]));
    for (const { pageIndex, fresh } of reExtracted) {
        const current = merged.get(pageIndex);
        // Keep the richer read: the per-page call almost always recovers the
        // dropped questions, so prefer whichever returned more.
        if (fresh && (!current || fresh.questions.length > current.questions.length)) {
            merged.set(pageIndex, fresh);
        }
    }

    return { pages: validPages.map((p) => merged.get(p.pageIndex)!) };
}

// ───────────────────────────────────────────────────────────────────────────
// PASS 2: rubric-grounded scoring (single call across all pages)
// ───────────────────────────────────────────────────────────────────────────

// Per-question thinking weight (cost model). Objective questions need almost no
// reasoning; long/essay answers need the most. Marks (when printed on the page)
// separate short vs medium vs long; unknown marks default to "medium".
const PASS2_THINKING_BASE = 600;
function pass2ThinkingWeight(q: ExtractedQuestion): number {
    if (
        q.questionType === 'mcq' ||
        q.questionType === 'true_false' ||
        q.questionType === 'fill_blank'
    ) {
        return 0.2;
    }
    const marks = q.marksAvailable ?? 3; // assume medium when no printed marks hint
    if (marks <= 2) return 0.6;
    if (marks <= 3) return 1.0;
    if (marks <= 5) return 1.6;
    return 2.4;
}

// Model token ceilings for the Pass-2 call. gemini-2.5-flash meters thinking
// tokens and visible tokens against the SAME `maxOutputTokens` budget, so the
// output ceiling must cover the thinking budget PLUS the visible JSON — sizing
// it from question count alone let an essay-heavy paper spend its whole
// allowance thinking and truncate the JSON mid-question. Pure + exported so the
// invariant (maxOutputTokens always leaves room beyond thinkingBudget) is
// unit-testable without a live model call.
export const PASS2_THINKING_BUDGET_CAP = 24576; // gemini-2.5-flash thinking ceiling
export const PASS2_OUTPUT_TOKEN_CAP = 65536; // gemini-2.5-flash output ceiling
// `thinkingBudget` is a SOFT target, not a hard cap: on a hard question the model
// can overshoot it badly (observed 16,242 thoughts against a 6,120 budget, ~2.6×).
// Because thinking shares the maxOutputTokens pool, an under-sized ceiling then
// starves the visible JSON — the model emitted only 3 of 12 questions before
// running out of room, and the chunk silently returned incomplete. So the output
// ceiling reserves room for a thinking OVERSHOOT, not just the budgeted amount.
export const PASS2_THINKING_OVERSHOOT = 3;
export function computePass2TokenBudget(pages: PageScan[]): {
    totalQuestions: number;
    thinkingBudget: number;
    maxOutputTokens: number;
} {
    const totalQuestions = pages.reduce((n, p) => n + p.questions.length, 0);
    // Content-scaled thinking budget, sized by question TYPE not raw count (cost
    // model): an MCQ needs almost no reasoning, a 10-mark essay needs a lot.
    // `BASE × Σ(per-type weight)` over-budgets nothing on an MCQ-heavy paper and
    // doesn't clip an essay-heavy one. Floored at 512, capped at the model ceiling.
    const weightedThinking = pages.reduce(
        (sum, p) => sum + p.questions.reduce((s, q) => s + pass2ThinkingWeight(q), 0),
        0,
    );
    const thinkingBudget = Math.max(
        512,
        Math.min(PASS2_THINKING_BUDGET_CAP, Math.round(PASS2_THINKING_BASE * weightedThinking)),
    );
    // Visible-JSON estimate: generous per-question, floored for a light sheet.
    const visibleOutputEstimate = Math.max(8192, 900 * totalQuestions);
    // Reserve room for a thinking overshoot PLUS the visible JSON, so a spiral
    // can't starve the answer (thinking + JSON share this ceiling); capped at the
    // model max. Chunking bounds the visible side, so this stays well under 65,536.
    const maxOutputTokens = Math.min(
        PASS2_OUTPUT_TOKEN_CAP,
        thinkingBudget * PASS2_THINKING_OVERSHOOT + visibleOutputEstimate,
    );
    return { totalQuestions, thinkingBudget, maxOutputTokens };
}

/**
 * A Genkit structured-output validation failure — the model returned JSON that
 * doesn't satisfy the schema, most often because gemini-2.5-flash TRUNCATED its
 * response mid-question. Distinct from a 429/transient error; used to retry a
 * Pass-2 call that came back incomplete.
 */
function isSchemaValidationError(err: unknown): boolean {
    const msg = err instanceof Error ? err.message : String(err);
    return /schema validation failed/i.test(msg);
}

// Pass-2 chunking threshold. A single grade call emits one long JSON response;
// past ~a dozen questions gemini-2.5-flash starts truncating it mid-stream
// (observed: `questions.15.partialCreditBreakdown.4` clipped), which costs a
// ~130s wasted attempt before the retry recovers. So a SMALL paper stays ONE
// call (≤ MAX questions — the common case, no behaviour change) and a LARGER
// paper is graded in CONCURRENT chunks of ≤ MAX questions each: shorter response
// per call ⇒ far lower truncation odds, and the calls overlap so wall-clock ≈ the
// slowest chunk, not the sum. Per-question grades are identical either way (each
// question is graded against its own rubric/context); only the holistic bullets
// are merged across chunks.
const PASS2_CHUNK_MAX_QUESTIONS =
    Number(process.env.ASSESSMENT_SCANNER_PASS2_CHUNK) || 12;
const PASS2_CHUNK_CONCURRENCY =
    Number(process.env.ASSESSMENT_SCANNER_PASS2_CONCURRENCY) || 4;

/**
 * Split pages into chunks whose total question count stays ≤ `max`. Pages are
 * never split mid-page (a question keeps its page context); a single page that
 * alone exceeds `max` becomes its own chunk.
 */
function chunkPagesByQuestions(pages: PageScan[], max: number): PageScan[][] {
    const chunks: PageScan[][] = [];
    let current: PageScan[] = [];
    let count = 0;
    for (const p of pages) {
        const q = p.questions.length;
        if (current.length > 0 && count + q > max) {
            chunks.push(current);
            current = [];
            count = 0;
        }
        current.push(p);
        count += q;
    }
    if (current.length > 0) chunks.push(current);
    return chunks;
}

/**
 * Pass 2 worker — score ONE chunk of pages in a single model call. Every question
 * is graded against its rubric/NCERT context; output-token and thinking budgets
 * scale with the chunk (computePass2TokenBudget); a truncated/invalid response is
 * retried in-place with an escalated output ceiling. `scoreAssessment` calls this
 * once for a small paper, or once per chunk (concurrently) for a large one.
 */
async function scoreChunk(
    pages: PageScan[],
    input: AssessmentScannerInput,
): Promise<{
    questions: Pass2GradedQuestion[];
    recommendedNextSteps: string[];
    studentRecommendations: string[];
    teacherParentNote: string[];
}> {
    const ncertContext = buildNcertContext(input);
    const family = resolveSubjectFamily(input.subject);
    const subjectRubric = rubricFor(family);
    const confidenceGuidance = confidenceGuidanceFor(family);

    // Content-scaled thinking + output budgets (see computePass2TokenBudget).
    // Both ceilings share gemini-2.5-flash's maxOutputTokens pool, so they're
    // computed together to guarantee the JSON always has room beyond thinking.
    const {
        totalQuestions,
        thinkingBudget: pass2ThinkingBudget,
        maxOutputTokens: pass2MaxOutputTokens,
    } = computePass2TokenBudget(pages);

    // Wall-clock start for the Pass-2 error-path latency diagnostic below.
    const pass2Start = Date.now();
    let pass2Result;
    const MAX_PASS2_PARSE_RETRIES = 2;
    // Cap thinking hard on a RETRY. Attempt 0 keeps the full content-scaled
    // thinking budget (grading quality). But a failure — a truncated parse OR an
    // incomplete result — means thinking spiralled and starved the JSON, so the
    // retry reins thinking in so it can't spiral again, freeing the whole ceiling
    // for the answer. A grade with slightly less reasoning beats a dropped
    // question (which becomes a manual-review placeholder).
    const PASS2_RETRY_THINKING_CAP = 2048;
    // Per-attempt budgets. Attempt 0: content-scaled thinking + overshoot-sized
    // ceiling. Retry: capped thinking + the whole model ceiling (65,536) — maximum
    // room, minimum spiral. Escalating (not repeating identical params) is what
    // lets the retry actually escape the failure rather than reproduce it.
    const pass2ConfigFor = (attempt: number) =>
        attempt === 0
            ? { thinkingBudget: pass2ThinkingBudget, maxOutputTokens: pass2MaxOutputTokens }
            : {
                  thinkingBudget: Math.min(pass2ThinkingBudget, PASS2_RETRY_THINKING_CAP),
                  maxOutputTokens: PASS2_OUTPUT_TOKEN_CAP,
              };
    const callPass2 = (attempt: number) => {
        const { thinkingBudget, maxOutputTokens } = pass2ConfigFor(attempt);
        return runResiliently(
            async (resilienceConfig) => {
                return scoringPrompt(
                    {
                        subject: input.subject,
                        gradeLevel: input.gradeLevel,
                        language: input.language,
                        // Drop empty-string / null fields (e.g. deduped
                        // studentAnswerRaw, unset marksAvailable) to shave input
                        // tokens — the model reads the compact JSON identically.
                        extractedPages: JSON.stringify(pages, (_k, v) =>
                            v === '' || v === null ? undefined : v,
                        ),
                        ncertContext,
                        teacherAnswerKeyText: input.teacherAnswerKeyText,
                        educationBoard: input.educationBoard,
                        subjectRubric,
                        confidenceGuidance,
                    },
                    // Override thinkingBudget + maxOutputTokens at call time (keeps
                    // the key from resilienceConfig; temperature stays from the
                    // prompt's own config).
                    {
                        ...(PASS2_MODEL ? { model: PASS2_MODEL } : {}),
                        config: {
                            ...resilienceConfig.config,
                            thinkingConfig: { thinkingBudget },
                            maxOutputTokens,
                        },
                    },
                );
            },
            `assessmentScanner.pass2.${family}`,
        );
    };
    // gemini-2.5-flash can fail a chunk two ways, both from a thinking spiral
    // eating the shared output budget: (1) it truncates the JSON mid-question →
    // Zod rejects it; (2) it returns VALID JSON but fewer graded questions than we
    // sent (it ran out of room after N questions). runResiliently does NOT retry
    // either, so we retry here with capped thinking + the full ceiling. A fresh
    // generation with room almost always returns every question. Only a persistent
    // failure falls through to the rich logging + rethrow below.
    try {
        for (let parseAttempt = 0; ; parseAttempt++) {
            try {
                const result = await callPass2(parseAttempt);
                const gradedCount = result.output?.questions.length ?? 0;
                // Incomplete (valid but short): retry if we have attempts left.
                if (
                    result.output &&
                    gradedCount < totalQuestions &&
                    parseAttempt < MAX_PASS2_PARSE_RETRIES
                ) {
                    // Incomplete (valid but short) — retry with capped thinking + max output.
                    continue;
                }
                pass2Result = result;
                break;
            } catch (retryErr) {
                if (
                    isSchemaValidationError(retryErr) &&
                    parseAttempt < MAX_PASS2_PARSE_RETRIES
                ) {
                    // Invalid/truncated JSON — retry with capped thinking + max output.
                    continue;
                }
                throw retryErr;
            }
        }
    } catch (pass2Err) {
        // BUG #3 hardening: Pass-2 scoring failed — most commonly because the
        // model returned items that don't satisfy Pass2OutputSchema (Genkit
        // re-throws a ZodError-shaped error here). Log the raw model output +
        // parse errors at ERROR with context "ASSESSMENT" so the malformed
        // shape is diagnosable from Cloud Logging without a repro. We surface
        // the failure (re-throw) so the route returns a real error rather than
        // silently grading nothing.
        const { logger } = await import('@/lib/logger');
        const e = pass2Err as {
            message?: string;
            issues?: unknown;
            detail?: {
                response?: {
                    text?: () => string;
                    output?: unknown;
                    finishReason?: string;
                    usage?: unknown;
                };
            };
        };
        // Genkit attaches the raw model response on `.detail.response` for
        // structured-output parse failures; fall back to the message.
        let rawModelOutput: unknown = null;
        try {
            const resp = e?.detail?.response;
            rawModelOutput = resp?.output ?? (typeof resp?.text === 'function' ? resp.text() : null);
        } catch {
            rawModelOutput = null;
        }
        logger.error(
            'Assessment Scanner Pass-2 scoring failed',
            pass2Err,
            'ASSESSMENT',
            {
                userId: input.userId,
                assessmentId: input.assessmentId,
                family,
                reason: 'pass2_failed',
                parseErrors: e?.issues ?? e?.message,
                rawModelOutput:
                    typeof rawModelOutput === 'string'
                        ? rawModelOutput
                        : JSON.stringify(rawModelOutput ?? null),
                // Diagnostic context: distinguishes an output-token TRUNCATION
                // (finishReason 'length'/'MAX_TOKENS', outputTokens near the cap)
                // from a genuinely malformed structured response. `thoughtsTokens`
                // vs the budget shows whether thinking is the culprit.
                latencyMs: Date.now() - pass2Start,
                finishReason: e?.detail?.response?.finishReason ?? 'unknown',
                usageMetadata: e?.detail?.response?.usage ?? null,
                pass2ThinkingBudget,
                pass2MaxOutputTokens, // attempt-0 ceiling
                // The final (failed) attempt escalated to this ceiling — if the
                // response STILL truncated with the whole model max available,
                // the failure is a genuinely malformed shape, not token starvation.
                pass2MaxOutputTokensFinalAttempt: PASS2_OUTPUT_TOKEN_CAP,
                totalQuestions,
                gradablePages: pages.length,
            },
        );
        throw pass2Err;
    }

    const { output } = pass2Result;

    if (!output) {
        return {
            questions: [],
            recommendedNextSteps: [],
            studentRecommendations: [],
            teacherParentNote: [],
        };
    }
    // recommendedNextSteps dropped from generation (saves output tokens/latency);
    // inject [] so the output schema + aggregate stay unchanged and the UI (which
    // hides an empty list) simply omits the "Next steps for the teacher" section.
    return { ...output, recommendedNextSteps: [] };
}

/**
 * Pass 2 orchestrator. Small paper (≤ PASS2_CHUNK_MAX_QUESTIONS) → ONE call,
 * behaviour identical to a plain single-call grade. Larger paper → grade in
 * CONCURRENT chunks so the long output generation overlaps and each response
 * stays short enough to avoid mid-stream truncation; merge the graded questions
 * (kept in page order) and dedupe/cap the holistic bullets across chunks.
 * Per-question grades are unaffected; totals/conceptMastery are recomputed in
 * aggregate() from the merged questions.
 */
async function scoreAssessment(
    pages: PageScan[],
    input: AssessmentScannerInput,
): Promise<{
    questions: Pass2GradedQuestion[];
    recommendedNextSteps: string[];
    studentRecommendations: string[];
    teacherParentNote: string[];
}> {
    const chunks = chunkPagesByQuestions(pages, PASS2_CHUNK_MAX_QUESTIONS);
    if (chunks.length <= 1) return scoreChunk(pages, input);

    const results = await mapWithConcurrency(chunks, PASS2_CHUNK_CONCURRENCY, (c) =>
        scoreChunk(c, input),
    );
    const dedupeCap = (arr: string[], cap: number) =>
        Array.from(new Set(arr.filter((s) => s && s.trim().length > 0))).slice(0, cap);
    return {
        questions: results.flatMap((r) => r.questions),
        recommendedNextSteps: [],
        studentRecommendations: dedupeCap(
            results.flatMap((r) => r.studentRecommendations ?? []),
            3,
        ),
        teacherParentNote: dedupeCap(
            results.flatMap((r) => r.teacherParentNote ?? []),
            4,
        ),
    };
}

// ───────────────────────────────────────────────────────────────────────────
// Aggregation + persistence
// ───────────────────────────────────────────────────────────────────────────
function hasGradableContent(p: PageScan): boolean {
    return p.questions.length > 0;
}

function isBlankPage(p: PageScan): boolean {
    // Only pages the model itself classified as empty (`blank`) or as a
    // non-answer page (`cover`) count as "blank / nothing to grade". A page it
    // classified as CONTENTFUL (question_only/answer_only/mixed) that came back
    // with zero questions is an under-read / transcription miss — NOT blank — so
    // it is surfaced as "couldn't read this page" instead of telling the teacher
    // to upload answers that are already on the sheet.
    return !hasGradableContent(p) && (p.pageType === 'blank' || p.pageType === 'cover');
}

function buildImageQualityWarnings(pages: PageScan[]): string[] {
    const warnings: string[] = [];
    for (const p of pages) {
        if (isBlankPage(p)) continue;
        // Unreadable placeholders carry synthetic values (handwritingConfidence 0,
        // imageQualityIssues ['none']) — they are an image/upload failure, not a
        // handwriting-legibility problem, and are surfaced via status 'partial'
        // + their own skippedPageNotices entry. Emitting "handwriting hard to
        // read (0%)" here would point the teacher at the wrong remediation.
        if (p.pageType === 'unreadable') continue;
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

/**
 * Shared confidence bar for the review flag, mirroring the 0.8 convention baked
 * into `GradedQuestionSchema.needsTeacherReview` ("true when confidence < 0.8 …")
 * and the Pass-2 confidence guidance. Used both ways in aggregate(): a
 * fold/partial_crop forces review only when the model was BELOW this bar (unsure),
 * and the over-flag reconciliation clears a flag only when the model was at/above
 * it (sure). One threshold, so "the model was unsure" means the same thing in
 * both directions.
 */
const REVIEW_CONFIDENCE_THRESHOLD = 0.8;

function aggregate(
    input: AssessmentScannerInput,
    pages: PageScan[],
    pass2: {
        questions: Pass2GradedQuestion[];
        recommendedNextSteps: string[];
        studentRecommendations: string[];
        teacherParentNote: string[];
    },
): AssessmentScannerOutput {
    // Merge the Q&A that Pass 2 no longer echoes: fill `questionText` /
    // `studentAnswer` from the Pass-1 extraction by `questionId`. A NON-EMPTY
    // value from Pass 2 is a deliberate correction of a misread → it wins AND
    // forces teacher review (defensive; the prompt already mandates the flag).
    const pass1ById = new Map<string, PageScan['questions'][number]>();
    for (const p of pages) for (const eq of p.questions) pass1ById.set(eq.questionId, eq);

    // Question ids where Pass 2 corrected a Pass-1 misread (see below). Tracked so
    // the final reconciliation never clears the review flag off a real correction.
    const correctedIds = new Set<string>();
    const gradableQuestions: GradedQuestion[] = pass2.questions.map((pq) => {
        // Defensive: never let an AI-produced `teacherOverrides` survive into
        // the graded output. The Pass-2 schema already omits it, but strip here
        // too so a schema/Genkit regression can't resurface the false
        // "Edited by you" badge on an un-edited sheet.
        const { teacherOverrides: _aiOverrides, ...aiQ } = pq as Pass2GradedQuestion & {
            teacherOverrides?: unknown;
        };
        const p1 = pass1ById.get(pq.questionId);
        const correctedText = !!pq.questionText && pq.questionText.trim() !== '';
        const correctedAnswer = !!pq.studentAnswer && pq.studentAnswer.trim() !== '';
        if (correctedText || correctedAnswer) correctedIds.add(pq.questionId);
        return {
            ...aiQ,
            questionText: correctedText ? pq.questionText! : (p1?.questionText ?? ''),
            studentAnswer: correctedAnswer
                ? pq.studentAnswer!
                : (p1?.studentAnswerInterpreted ?? ''),
            needsTeacherReview: pq.needsTeacherReview || correctedText || correctedAnswer,
        };
    });

    gradableQuestions.sort(
        (a, b) =>
            a.pageIndex - b.pageIndex ||
            a.questionId.localeCompare(b.questionId, undefined, { numeric: true }),
    );
    // Page-level physical issues can compromise a grade — but they must NOT
    // blanket-flag every question on the page. A single fold otherwise buries the
    // confidently-graded correct answers alongside the one answer it actually hurt,
    // and that over-flagging is exactly what drains the review flag of its signal.
    // Split the issues by what they actually threaten:
    //   • Attribution (multiple_handwriting): we may have graded the WRONG
    //     student's work. Grade-confidence can't resolve "whose answer is this",
    //     so force review unconditionally. This is rare, so it does not reintroduce
    //     mass over-flagging.
    //   • Truncation (folded / partial_crop): part of an answer MAY be hidden or
    //     cut off. But if the model still graded THIS question with high confidence,
    //     it read a complete answer and the fold/crop landed elsewhere on the page —
    //     trust it. Force review only where the model was itself unsure
    //     (confidence < REVIEW_CONFIDENCE_THRESHOLD). Either way the page issue is
    //     surfaced to the teacher via `imageQualityWarnings`.
    const ATTRIBUTION_ISSUES = ['multiple_handwriting'];
    const TRUNCATION_ISSUES = ['folded', 'partial_crop'];
    const attributionPages = new Set(
        pages
            .filter((p) => p.imageQualityIssues.some((i) => ATTRIBUTION_ISSUES.includes(i)))
            .map((p) => p.pageIndex),
    );
    const truncationPages = new Set(
        pages
            .filter((p) => p.imageQualityIssues.some((i) => TRUNCATION_ISSUES.includes(i)))
            .map((p) => p.pageIndex),
    );
    for (const q of gradableQuestions) {
        if (attributionPages.has(q.pageIndex)) {
            q.needsTeacherReview = true;
        } else if (
            truncationPages.has(q.pageIndex) &&
            q.confidence < REVIEW_CONFIDENCE_THRESHOLD
        ) {
            q.needsTeacherReview = true;
        }
    }
    const questionOnlyPages = new Set(
        pages.filter((p) => p.pageType === 'question_only').map((p) => p.pageIndex),
    );
    if (questionOnlyPages.size > 0) {
        for (const q of gradableQuestions) {
            if (questionOnlyPages.has(q.pageIndex)) {
                q.marksAwarded = 0;
                q.marksMax = 0;
            }
        }
    }

    // Completeness: a page whose model-reported `visibleQuestionCount` still
    // exceeds the questions we kept (even after per-page re-extraction) was only
    // partially read — some questions may be MISSING. That is a page-level
    // completeness gap, NOT a defect in the grades we DID produce, so it surfaces
    // as a `skippedPageNotices` entry below ("only N of about M could be read —
    // check the original"). We deliberately do NOT set `needsTeacherReview` on the
    // questions that WERE read: they were graded on their own merits, and flagging
    // them buries the correct grades without helping the teacher find the ones that
    // were missed.
    const underReadPages = new Map<number, { seen: number; read: number }>();
    for (const p of pages) {
        if (
            typeof p.visibleQuestionCount === 'number' &&
            p.visibleQuestionCount > p.questions.length
        ) {
            underReadPages.set(p.pageIndex, {
                seen: p.visibleQuestionCount,
                read: p.questions.length,
            });
        }
    }

    // Marks awarded can never exceed a question's max. The grading prompt asks
    // for this, but a model over-award would push scorePct/masteryPct past the
    // schema's .max(100) and 500 the whole scan at output validation. Clamp to
    // [0, marksMax] so the per-question output, totals, and mastery stay valid.
    for (const q of gradableQuestions) {
        q.marksAwarded = Math.min(Math.max(0, q.marksAwarded), q.marksMax);
    }

    // Reconcile model OVER-flagging. On pilot (non-Math) subjects a cautious model
    // routinely sets `needsTeacherReview: true` on answers it ALSO graded as fully
    // correct AND high-confidence — a self-contradiction (an uncertain grade cannot
    // also be a confident, full-mark, no-mistake grade). Left alone it flags every
    // question on a clean sheet ("4 questions are uncertain" on a 12/12 A+ paper),
    // which buries the few flags that genuinely need a human and trains teachers to
    // ignore the signal. When the model's OWN three signals unanimously say "correct
    // and sure" — full marks (marksMax > 0), `mistakePattern: 'none'`, and
    // confidence ≥ REVIEW_CONFIDENCE_THRESHOLD — the review flag is noise, so clear
    // it. Genuine uncertainty on a full-mark answer (a subjective long-answer with
    // no key, an ambiguous read) shows up as LOWER confidence or a non-'none'
    // pattern, so it is untouched. Deterministic triggers are never overridden here:
    // an attribution page (multiple_handwriting) and a Pass-2 correction both keep
    // their forced flag.
    for (const q of gradableQuestions) {
        const modelIsCertainAndCorrect =
            q.needsTeacherReview &&
            q.marksMax > 0 &&
            q.marksAwarded >= q.marksMax &&
            q.mistakePattern === 'none' &&
            q.confidence >= REVIEW_CONFIDENCE_THRESHOLD;
        const hasDeterministicTrigger =
            attributionPages.has(q.pageIndex) || correctedIds.has(q.questionId);
        if (modelIsCertainAndCorrect && !hasDeterministicTrigger) {
            q.needsTeacherReview = false;
        }
    }

    const totalAwardedMarks = gradableQuestions.reduce((s, q) => s + q.marksAwarded, 0);
    const inferredMaxMarks = gradableQuestions.reduce((s, q) => s + q.marksMax, 0);
    const totalMaxMarks = input.totalMaxMarks ?? inferredMaxMarks;
    // `Math.min(100, …)` guards the `input.totalMaxMarks` path, where a declared
    // total smaller than the summed awarded marks could still exceed 100%.
    const scorePct =
        totalMaxMarks > 0 ? Math.min(100, (totalAwardedMarks / totalMaxMarks) * 100) : 0;

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
        masteryPct: v.max > 0 ? Math.min(100, (v.earned / v.max) * 100) : 0,
        weakestConcept: null,
    }));

    const needsReviewCount = gradableQuestions.filter((q) => q.needsTeacherReview).length;
    const imageQualityWarnings = buildImageQualityWarnings(pages);

    const skippedPageNotices = pages.filter(isBlankPage).map((p) => {
        const kind =
            p.pageType === 'cover'
                ? 'cover/title page — nothing to grade'
                : 'blank — nothing to grade';
        return `Page ${p.pageIndex + 1}: ${kind}, so it was skipped.`;
    });
    for (const [pageIndex, { seen, read }] of underReadPages) {
        skippedPageNotices.push(
            `Page ${pageIndex + 1}: only ${read} of about ${seen} questions could be read — please check the original page for any that were missed.`,
        );
    }
    // Contentful pages (student work present) that returned zero questions and
    // weren't already flagged via visibleQuestionCount: a transcription miss,
    // NOT a blank page — surface a re-upload prompt rather than staying silent.
    for (const p of pages) {
        if (
            isContentfulPage(p) &&
            p.questions.length === 0 &&
            !underReadPages.has(p.pageIndex)
        ) {
            skippedPageNotices.push(
                `Page ${p.pageIndex + 1}: couldn't read the answers on this page — please re-upload a clearer photo.`,
            );
        }
    }
    // Unreadable pages (image unclear/corrupt): name the page so the teacher
    // knows exactly which one to re-shoot, rather than only seeing status
    // 'partial' with no per-page detail.
    for (const p of pages) {
        if (p.pageType === 'unreadable') {
            skippedPageNotices.push(
                `Page ${p.pageIndex + 1}: couldn't read this page (image unclear or corrupt) — please re-upload a clearer photo.`,
            );
        }
    }

    // Status: 'partial' only when a page was UNREADABLE — some content couldn't
    // be graded at all. A graded question flagged `needsTeacherReview` is still a
    // successful 'graded' scan: the flag surfaces per-question in the UI (and via
    // needsReviewCount) and does NOT downgrade the whole scan. 'failed' only when
    // nothing at all was gradable.
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
        teacherParentNote: pass2.teacherParentNote,
        needsReviewCount,
        imageQualityWarnings,
        skippedPageNotices,
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

    // PASS 1: fetch + validate every page in parallel (cheap I/O), then extract
    // ALL valid images in ONE model call. Validating up front means a corrupt
    // file becomes an unreadable placeholder BEFORE the call, so a single bad
    // page never fails the whole batch.
    const prepResults = await Promise.allSettled(
        input.pageUrls.map((url, i) => preparePageImage(url, i, input)),
    );

    // BUG #3 hardening: an *unreachable page URL* is a known, fixable problem —
    // surface the first such fetch failure so the route can tell the teacher
    // exactly which page to re-upload, instead of silently grading a partial scan.
    const unreadablePage = prepResults.find(
        (r): r is PromiseRejectedResult =>
            r.status === 'rejected' && r.reason instanceof AssessmentPageUnreadableError,
    );
    if (unreadablePage) {
        throw unreadablePage.reason as AssessmentPageUnreadableError;
    }
    // preparePageImage only throws AssessmentPageUnreadableError, but guard
    // defensively against any other rejection rather than swallowing it.
    const prepFailure = prepResults.find(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    if (prepFailure) {
        throw prepFailure.reason;
    }

    const prepared = prepResults.map(
        (r) => (r as PromiseFulfilledResult<PreparedPage>).value,
    );
    const validPages = prepared.filter(
        (p): p is { pageIndex: number; imageDataUri: string } => !('unreadable' in p),
    );

    // Pass-1 extraction. Default FAN-OUT: one call per page, concurrent, so
    // wall-clock ≈ slowest page not the sum (doc Step 2.3). 'batched' keeps the
    // prior single multi-image call for A/B measurement. A transient 429/503
    // propagates; any other total failure comes back as `failure` (rethrown below
    // only if nothing was gradable).
    const extraction =
        validPages.length === 0
            ? { pages: [] as PageScan[], failure: undefined as unknown }
            : PASS1_STRATEGY === 'fanout'
              ? await extractPagesFanOut(validPages, input)
              : await extractAllPages(validPages, validPages.length, input);
    const extractionFailure = extraction.failure;

    // Re-assemble the full page list in pageIndex order: extracted results for
    // valid pages + unreadable placeholders for the corrupt/undecodable ones.
    const pagesByIndex = new Map<number, PageScan>();
    for (const p of extraction.pages) pagesByIndex.set(p.pageIndex, p);
    const pages: PageScan[] = input.pageUrls.map(
        (_, i) => pagesByIndex.get(i) ?? unreadablePlaceholder(i),
    );

    const gradablePages = pages.filter(hasGradableContent);
    const blankPages = pages.filter(isBlankPage);
    const allPagesUnreadable =
        pages.length > 0 && pages.every((p) => p.pageType === 'unreadable');
    const pass2 =
        gradablePages.length > 0
            ? await scoreAssessment(gradablePages, input)
            : {
                questions: [],
                recommendedNextSteps: [],
                studentRecommendations: [],
                teacherParentNote: [],
            };

    if (pass2.questions.length === 0) {
        const { logger } = await import('@/lib/logger');

        if (extractionFailure && gradablePages.length === 0) {
            throw extractionFailure;
        }

        if (blankPages.length > 0 && !allPagesUnreadable) {
            const blankPageNumbers = blankPages.map((p) => p.pageIndex + 1);
            logger.info(
                'Assessment Scanner: all uploaded pages were blank — skipped grading',
                'ASSESSMENT',
                {
                    userId: input.userId,
                    assessmentId: input.assessmentId,
                    pageCount: pages.length,
                    blankPages: blankPageNumbers,
                    reason: 'blank_scan',
                },
            );
            throw new AssessmentBlankScanError(blankPageNumbers);
        }

        logger.error(
            'Assessment Scanner: no readable content extracted from any page',
            undefined,
            'ASSESSMENT',
            {
                userId: input.userId,
                assessmentId: input.assessmentId,
                pageCount: pages.length,
                reason: 'empty_extraction',
            },
        );
        throw new AssessmentEmptyExtractionError();
    }

    const gradedIds = new Set(pass2.questions.map((q) => q.questionId));
    const droppedQuestions: GradedQuestion[] = gradablePages.flatMap((p) =>
        p.questions
            .filter((eq) => !gradedIds.has(eq.questionId))
            .map((eq): GradedQuestion => ({
                questionId: eq.questionId,
                pageIndex: p.pageIndex,
                questionType: eq.questionType,
                questionText: eq.questionText,
                studentAnswer: eq.studentAnswerInterpreted,
                expectedAnswer: '',
                marksAwarded: 0,
                marksMax: 0,
                partialCreditBreakdown: [],
                feedback:
                    'This question was read from the page but not graded automatically. Please review and score it manually.',
                improvementPoints: [],
                conceptTested: '',
                ncertChapterId: null,
                mistakePattern: null,
                needsTeacherReview: true,
                confidence: 0,
            })),
    );
    if (droppedQuestions.length > 0) {
        const { logger } = await import('@/lib/logger');
        logger.warn(
            'Assessment Scanner: Pass 2 returned fewer questions than extracted — surfacing placeholders',
            'ASSESSMENT',
            {
                userId: input.userId,
                assessmentId: input.assessmentId,
                extracted: gradablePages.reduce((n, p) => n + p.questions.length, 0),
                graded: pass2.questions.length,
                dropped: droppedQuestions.length,
                reason: 'pass2_dropped_questions',
            },
        );
        pass2.questions.push(...droppedQuestions);
    }

    // Aggregate + validate
    const output = AssessmentScannerOutputSchema.parse(aggregate(input, pages, pass2));

    // Persist (fire-and-forget — don't block the response on Firestore)
    void persist(input, output);

    return output;
}
