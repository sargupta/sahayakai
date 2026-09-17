/**
 * @fileOverview Regenerates a SINGLE exam-paper question in place via the LLM.
 *
 * - regenerateExamQuestion — produce a fresh replacement for one question,
 *   locked to the original's chapter, marks, type, and language.
 * - RegenerateQuestionInput / RegenerateQuestionOutput — exported types.
 *
 * Scope contract (see tasks/CONTRACT-exam-paper-generation.md): this is a
 * per-question refinement of already-generated content, NOT whole-paper
 * generation. It deliberately keeps `marks` FIXED so the paper's hard
 * `sum(marks) === maxMarks` invariant cannot drift (the caller replaces only
 * text/options/answerKey/markingScheme). Chapter is held at the same
 * SOFT / model-best-effort level the main generator provides — the paper
 * carries no per-question chapter tag anywhere, so we anchor the model with
 * the paper's chapter list + the original question text and let it stay in the
 * inferred chapter. Mirrors the narrow examPaperKeyBackfillPrompt pattern in
 * exam-paper-generator.ts rather than the whole-paper flow.
 */

import { ai, runResiliently } from '@/ai/genkit';
import { z } from 'genkit';
import { SAHAYAK_SOUL_PROMPT, STRUCTURED_OUTPUT_OVERRIDE } from '@/ai/soul';
import { normalizeLanguage } from '@/ai/lib/normalize-language';
import { stampObjectiveKeys, getExamPaperTemplates } from '@/ai/flows/exam-paper-generator';
import { StructuredLogger } from '@/lib/logger/structured-logger';

const RegenerateQuestionInputSchema = z.object({
  board: z.string().max(100).describe("The education board (e.g., 'CBSE')."),
  gradeLevel: z.string().max(50).describe("The grade level (e.g., 'Class 10')."),
  subject: z.string().max(100).describe("The subject (e.g., 'Mathematics')."),
  language: z.string().max(50).default('English').describe("Language the replacement question and its keys must be written in."),
  chapters: z.array(z.string().max(300)).max(50).describe("Candidate chapter list for the paper. The replacement MUST come from whichever of these the original question belongs to."),
  originalQuestionText: z.string().max(4000).describe("The current question being replaced — used to infer the chapter and question style."),
  marks: z.number().int().min(0).max(50).describe("Marks the replacement MUST be worth (unchanged — preserves the paper's marks total)."),
  isMcq: z.boolean().describe("True when the original is an MCQ/objective question (produce exactly 4 options + a correct option)."),
  optionCount: z.number().int().min(2).max(6).default(4).describe("How many options to produce for an MCQ."),
  includeAnswerKey: z.boolean().default(true).describe("Whether to produce an answer key."),
  includeMarkingScheme: z.boolean().default(true).describe("Whether to produce a marking scheme."),
  internalChoice: z.boolean().optional().describe("True when the original offered an OR alternative — produce one too."),
});
export type RegenerateQuestionInput = z.infer<typeof RegenerateQuestionInputSchema>;

// Single-question output — the per-question subset of ExamPaperOutputSchema's
// question shape. answerKey/markingScheme are REQUIRED (not .optional()) for the
// same reason `correctOption` is required in the main schema: Gemini silently
// drops optional fields under the thinking cap, but never required ones. When a
// field wasn't requested the model returns ''; the flow enforces non-empty for
// the ones that WERE requested (stamp → retry → placeholder floor).
const RegenerateQuestionOutputSchema = z.object({
  text: z.string().describe("The new question text, in the paper's language, from the same chapter as the original."),
  options: z.array(z.string()).optional().describe("For MCQs: the options labelled (a), (b), (c), (d). Omit for non-objective questions."),
  correctOption: z.string().describe("For MCQ/objective: the correct option's letter (a/b/c/d). Empty string for non-objective questions."),
  answerKey: z.string().describe("The correct/model answer when requested, else an empty string."),
  markingScheme: z.string().describe("Step-wise marks breakdown summing to the question's marks when requested, else an empty string."),
  internalChoice: z.string().optional().describe("An OR alternative question when the original had one."),
  chapterUsed: z.string().describe("Which chapter (from the provided list) this replacement was written for. Echoed for verification."),
});
export type RegenerateQuestionOutput = z.infer<typeof RegenerateQuestionOutputSchema>;

const regenerateQuestionPrompt = ai.definePrompt({
  name: 'regenerateExamQuestionPrompt',
  input: { schema: RegenerateQuestionInputSchema },
  output: { schema: RegenerateQuestionOutputSchema },
  // Slightly warm so the replacement genuinely differs from the original the
  // teacher rejected, but low enough to keep it on-syllabus and well-formed.
  config: { temperature: 0.5, topP: 0.9 },
  prompt: `${SAHAYAK_SOUL_PROMPT}${STRUCTURED_OUTPUT_OVERRIDE}

You are an expert exam paper setter for Indian board examinations. A teacher wants to REPLACE one question with a fresh one of the same kind. Produce exactly ONE new question.

## Paper context
- Board: {{board}}
- Grade: {{gradeLevel}}
- Subject: {{subject}}
- Chapters in this paper:
{{#each chapters}}  - {{this}}
{{/each}}

## The question being replaced
"{{originalQuestionText}}"

## Rules (follow every one)
1. **Same chapter (mandatory):** Identify which chapter from the list above the ORIGINAL question belongs to, and write the new question from that SAME chapter. Do NOT drift to another chapter — chapter balance must stay intact. Return that chapter name in \`chapterUsed\`.
2. **Different question:** The new question must be genuinely different from the original (not a reword or number-swap), but of the same academic level and style.
3. **Marks are FIXED:** the new question is worth exactly {{marks}} mark(s). Do NOT change the marks or split them differently.
4. **Type:** {{#if isMcq}}This is an MCQ — produce exactly {{optionCount}} options labelled (a), (b), (c), (d) with only ONE correct answer, and set \`correctOption\` to the correct letter. This is mandatory and non-negotiable.{{else}}This is a written-answer question — do NOT produce options, and set \`correctOption\` to an empty string.{{/if}}
{{#if internalChoice}}5. **Internal choice:** provide an OR alternative of equal difficulty and marks in \`internalChoice\`.{{/if}}
6. **Answer key:** {{#if includeAnswerKey}}Produce a concise correct/model \`answerKey\`.{{else}}Return an empty string for \`answerKey\`.{{/if}}
7. **Marking scheme:** {{#if includeMarkingScheme}}Produce a step-wise \`markingScheme\` (e.g. "1 mark for formula, 1 mark for substitution, 1 mark for answer") whose marks sum to {{marks}}.{{else}}Return an empty string for \`markingScheme\`.{{/if}}
8. **Language Lock (ABSOLUTE):** write the question, options, answer key, and marking scheme ONLY in {{language}}. Do not mix in other languages or scripts.
9. **Factual integrity:** never fabricate facts or alter mathematical correctness. The answer key must be correct for the question you wrote.
`,
});

const regenerateQuestionFlow = ai.defineFlow(
  {
    name: 'regenerateExamQuestionFlow',
    inputSchema: RegenerateQuestionInputSchema,
    outputSchema: RegenerateQuestionOutputSchema,
  },
  async (input) => {
    const language = normalizeLanguage(input.language);
    const promptInput = { ...input, language };

    // A requested field is "missing" when the model left it empty. Used to
    // decide the single retry and the placeholder backstop below.
    const missingRequested = (q: RegenerateQuestionOutput) =>
      (input.includeAnswerKey && !q.answerKey?.trim()) ||
      (input.includeMarkingScheme && !q.markingScheme?.trim());

    const callOnce = async (): Promise<RegenerateQuestionOutput> => {
      // runResiliently injects the Gemini key-pool key — calling the prompt
      // directly 401s (see parent-message-generator.ts note).
      const result = await runResiliently(
        (overrideConfig) => regenerateQuestionPrompt(promptInput, overrideConfig),
        'examQuestion.regenerate',
      );
      if (!result.output) {
        throw new Error('Question regeneration returned no output (likely a safety block or empty completion).');
      }
      const q = result.output;
      // MCQ answer key is stamped deterministically from correctOption + options
      // (language-neutral "(b) text" form) rather than trusted from the model —
      // same reasoning as the main flow's stampObjectiveKeys. Only fills EMPTY
      // requested fields, so it never clobbers a good model-provided key.
      if (input.isMcq) {
        // stampObjectiveKeys needs `marks` and mutates in place; the output
        // schema has no `marks` (it's fixed on the input), so stamp a shim
        // carrying the fixed marks and copy the filled keys back onto `q`.
        const shim = {
          marks: input.marks,
          options: q.options,
          correctOption: q.correctOption,
          answerKey: q.answerKey,
          markingScheme: q.markingScheme,
        };
        stampObjectiveKeys(
          { sections: [{ questions: [shim] }] },
          { includeAnswerKey: input.includeAnswerKey, includeMarkingScheme: input.includeMarkingScheme },
          language,
        );
        q.answerKey = shim.answerKey ?? q.answerKey;
        q.markingScheme = shim.markingScheme ?? q.markingScheme;
      }
      return q;
    };

    let out = await callOnce();
    // One cheap retry if the model dropped a requested field (single question →
    // affordable). Keeps the invariant-#2 guarantee without the whole-paper
    // backfill machinery.
    if (missingRequested(out)) {
      StructuredLogger.warn('Regenerated question missing a requested field — retrying once', {
        service: 'regenerate-exam-question-flow',
        operation: 'regenerateExamQuestion',
        metadata: { subject: input.subject, marks: input.marks, isMcq: input.isMcq },
      });
      out = await callOnce();
    }

    // Placeholder floor — last-resort guarantee that a requested field is never
    // empty (invariant #2). Language-templated so it matches the paper's own
    // language lock (H1), never an English leak into a non-English paper.
    if (missingRequested(out)) {
      const templates = getExamPaperTemplates(language);
      if (input.includeAnswerKey && !out.answerKey?.trim()) out.answerKey = templates.placeholderAnswer;
      if (input.includeMarkingScheme && !out.markingScheme?.trim()) {
        out.markingScheme = templates.placeholderMarkingScheme(input.marks);
      }
    }

    return out;
  },
);

export async function regenerateExamQuestion(input: RegenerateQuestionInput): Promise<RegenerateQuestionOutput> {
  return regenerateQuestionFlow(input);
}
