/**
 * @fileOverview Generates board-pattern exam papers following official blueprints.
 *
 * - generateExamPaper - Generates a complete exam paper with sections, questions, answer keys, and marking schemes.
 * - ExamPaperInput - The input type for the generateExamPaper function.
 * - ExamPaperOutput - The return type for the generateExamPaper function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { SAHAYAK_SOUL_PROMPT, STRUCTURED_OUTPUT_OVERRIDE } from '@/ai/soul';
import { findBlueprint } from '@/ai/data/board-blueprints';
import type { PYQQuestion, PYQRetrievalOptions } from '@/lib/services/pyq-retrieval-service';

const ExamPaperInputSchema = z.object({
  board: z.string().describe("The education board (e.g., 'CBSE', 'ICSE')."),
  gradeLevel: z.string().describe("The grade level (e.g., 'Class 10')."),
  subject: z.string().describe("The subject (e.g., 'Mathematics')."),
  chapters: z.array(z.string()).describe("Selected chapters to cover. Empty array means cover all chapters for the subject."),
  duration: z.number().optional().describe("Exam duration in minutes. Defaults to blueprint value."),
  maxMarks: z.number().optional().describe("Maximum marks. Defaults to blueprint value."),
  language: z.string().default('English').describe("Language for the paper (e.g., 'English', 'Hindi')."),
  difficulty: z.enum(['easy', 'moderate', 'hard', 'mixed']).default('mixed').describe("Overall difficulty distribution."),
  includeAnswerKey: z.boolean().default(true).describe("Whether to generate answer keys."),
  includeMarkingScheme: z.boolean().default(true).describe("Whether to generate marking schemes."),
  userId: z.string().optional().describe("The ID of the user generating the paper."),
  teacherContext: z.string().optional().describe('Career-stage context for personalising AI output tone and depth.'),
});
export type ExamPaperInput = z.infer<typeof ExamPaperInputSchema>;

const ExamPaperQuestionSchema = z.object({
  number: z.number().describe("Question number within the section."),
  text: z.string().describe("The question text."),
  marks: z.number().describe("Marks allocated to this question."),
  options: z.array(z.string()).optional().describe("For MCQs: exactly 4 options labelled (a), (b), (c), (d)."),
  internalChoice: z.string().optional().describe("An OR alternative question, if applicable."),
  answerKey: z.string().optional().describe("The correct answer or model answer."),
  markingScheme: z.string().optional().describe("Step-wise marks breakdown for evaluation."),
  source: z.string().default('AI Generated').describe("Source tag: 'AI Generated' or 'PYQ <year>'."),
});

const ExamPaperSectionSchema = z.object({
  name: z.string().describe("Section identifier (e.g., 'Section A')."),
  label: z.string().describe("Section description (e.g., 'Multiple Choice Questions')."),
  totalMarks: z.number().describe("Total marks for this section."),
  questions: z.array(ExamPaperQuestionSchema),
});

const ExamPaperOutputSchema = z.object({
  title: z.string().describe("Full paper title (e.g., 'CBSE Class 10 Mathematics Sample Paper')."),
  board: z.string(),
  subject: z.string(),
  gradeLevel: z.string(),
  duration: z.string().describe("Duration as a display string (e.g., '3 Hours')."),
  maxMarks: z.number(),
  generalInstructions: z.array(z.string()),
  sections: z.array(ExamPaperSectionSchema),
  blueprintSummary: z.object({
    chapterWise: z.array(z.object({ chapter: z.string(), marks: z.number() })),
    difficultyWise: z.array(z.object({ level: z.string(), percentage: z.number() })),
  }),
  pyqSources: z.array(z.object({
    id: z.string(),
    year: z.number().nullable().optional(),
    chapter: z.string().optional(),
  })).optional().describe("PYQ source attributions: which prior-year questions were used or adapted."),
});
export type ExamPaperOutput = z.infer<typeof ExamPaperOutputSchema>;

export async function generateExamPaper(input: ExamPaperInput): Promise<ExamPaperOutput> {
  const uid = input.userId;
  let localizedInput = { ...input };

  if (uid) {
    if (!input.language || input.language === 'English') {
      const { dbAdapter } = await import('@/lib/db/adapter');
      const profile = await dbAdapter.getUser(uid);
      if (profile?.preferredLanguage) {
        localizedInput.language = profile.preferredLanguage;
      }
    }

    // Fetch teacher context for AI personalisation
    try {
      const { getTeacherContextLine } = await import('@/lib/teacher-context');
      localizedInput.teacherContext = await getTeacherContextLine(uid);
    } catch {
      // Non-blocking — proceed without teacher context
    }
  }

  return examPaperGeneratorFlow(localizedInput);
}

/**
 * Build a structured constraint block from the blueprint for the AI prompt.
 */
function buildBlueprintConstraint(input: ExamPaperInput): string {
  const blueprint = findBlueprint(input.board, input.gradeLevel, input.subject);

  if (!blueprint) {
    return `No official blueprint found for ${input.board} ${input.gradeLevel} ${input.subject}. Generate a reasonable exam paper with the given maxMarks and duration. Create 4-5 sections with MCQ, short answer, long answer, and case study question types.`;
  }

  const duration = input.duration || blueprint.duration;
  const maxMarks = input.maxMarks || blueprint.maxMarks;

  let constraint = `## HARD CONSTRAINT: Official ${blueprint.board} ${blueprint.gradeLevel} ${blueprint.subject} Blueprint\n`;
  constraint += `- Duration: ${duration} minutes\n`;
  constraint += `- Maximum Marks: ${maxMarks}\n\n`;

  constraint += `### General Instructions (include these verbatim):\n`;
  blueprint.generalInstructions.forEach((inst, i) => {
    constraint += `${i + 1}. ${inst}\n`;
  });

  constraint += `\n### Section Structure (MUST follow exactly):\n`;
  blueprint.sections.forEach((section, i) => {
    constraint += `${i + 1}. **${section.name} — ${section.label}**: ${section.questionCount} questions x ${section.questionType.marksPerQuestion} marks = ${section.totalMarks} marks | Type: ${section.questionType.type} | Internal Choice: ${section.questionType.internalChoice ? 'Yes (provide OR alternative)' : 'No'}\n`;
  });

  if (blueprint.chapterWeightage) {
    const selectedChapters = input.chapters;
    const relevantWeightage = Object.entries(blueprint.chapterWeightage)
      .filter(([ch]) => selectedChapters.some(sc => sc.toLowerCase() === ch.toLowerCase()));

    if (relevantWeightage.length > 0) {
      constraint += `\n### Chapter Weightage (distribute questions proportionally):\n`;
      relevantWeightage.forEach(([ch, marks]) => {
        constraint += `- ${ch}: ~${marks} marks\n`;
      });
    }
  }

  return constraint;
}

/**
 * Build the PYQ context block to inject into the AI prompt.
 * Returns an empty string when no PYQs are available so the prompt degrades
 * gracefully with no noise added.
 */
function buildPYQContext(pyqs: PYQQuestion[]): string {
  if (pyqs.length === 0) return '';

  let block = `## PREVIOUS YEAR QUESTIONS (use these as the basis for ~70% of questions — adapt, rephrase, or use directly):\n`;
  block += `Use these authentic board exam questions. Do NOT alter their factual or mathematical correctness.\n\n`;

  pyqs.forEach((q, i) => {
    const yearLabel = q.year ? `${q.year}` : 'Year N/A';
    const boardLabel = q.board ? ` (${q.board})` : '';
    block += `${i + 1}. [ID: ${q.id} | ${yearLabel}${boardLabel} | ${q.chapter} | ${q.marks} mark${q.marks !== 1 ? 's' : ''} | ${q.type}]\n`;
    block += `   Q: ${q.question}\n`;
    if (q.answer) {
      block += `   A: ${q.answer}\n`;
    }
    block += `\n`;
  });

  return block;
}

const examPaperGeneratorPrompt = ai.definePrompt({
  name: 'examPaperGeneratorPrompt',
  input: { schema: ExamPaperInputSchema.extend({ blueprintConstraint: z.string(), pyqContext: z.string() }) },
  output: { schema: ExamPaperOutputSchema },
  prompt: `${SAHAYAK_SOUL_PROMPT}${STRUCTURED_OUTPUT_OVERRIDE}
{{#if teacherContext}}{{{teacherContext}}}{{/if}}

You are an expert exam paper setter for Indian board examinations. Generate a complete, print-ready exam paper that STRICTLY follows the official blueprint provided below.

{{{blueprintConstraint}}}

## Paper Requirements:
- **Board**: {{board}}
- **Grade**: {{gradeLevel}}
- **Subject**: {{subject}}
- **Chapters to cover**: {{#each chapters}}{{this}}, {{/each}}
- **Difficulty**: {{difficulty}}
- **Language**: {{language}}
- **Include Answer Key**: {{includeAnswerKey}}
- **Include Marking Scheme**: {{includeMarkingScheme}}

{{#if pyqContext}}{{{pyqContext}}}{{/if}}

## Question Generation Rules:
1. **MCQs**: Generate exactly 4 options labelled (a), (b), (c), (d). Only one correct answer.
2. **Assertion-Reason**: Use the standard format — Assertion (A) and Reason (R) with 4 standard options.
3. **Internal Choice**: Where the blueprint says internal choice = true, provide an OR alternative question of equal difficulty and marks.
4. **Case Study**: Provide a real-world scenario/passage followed by sub-questions.
5. **Answer Keys**: If requested, provide concise correct answers for every question.
6. **Marking Scheme**: If requested, provide step-wise marks breakdown (e.g., "1 mark for formula, 1 mark for substitution, 1 mark for answer").
7. **Chapter Coverage**: Distribute questions across the selected chapters proportionally based on chapter weightage.
8. **Difficulty Distribution**: For 'mixed' difficulty, use approximately 30% easy, 40% moderate, 30% hard. For specific difficulty levels, weight 70% toward that level.
{{#if pyqContext}}9. **PYQ Usage**: Use approximately 70% of questions based on or directly adapted from the PYQs provided above. Generate 30% new questions in the same style and difficulty. Never alter the mathematical or factual correctness of any PYQ.
10. **Source Tagging**: Tag questions adapted from PYQs as "PYQ <year>" (e.g., "PYQ 2023"). Tag wholly new questions as "AI Generated".
11. **pyqSources**: In the pyqSources field, list every PYQ that was used or adapted: include its id, year, and chapter exactly as provided.
{{else}}9. **Source Tagging**: Tag all questions as "AI Generated" since no PYQ bank was available.
10. **pyqSources**: Leave pyqSources as an empty array.
{{/if}}

## Constraints:
- **Language Lock**: You MUST respond ONLY in {{language}}. Do NOT shift into other languages unless explicitly requested.
- **Blueprint Adherence**: The section structure, question counts, and marks distribution MUST match the blueprint exactly. Do NOT add or remove sections.
- **No Repetition Loop**: Monitor output for repetitive content. Break loops immediately.
- **Academic Rigor**: Questions must be at the appropriate academic level for {{gradeLevel}} {{subject}}.
- **Factual Integrity**: Do NOT fabricate facts, dates, or alter the correctness of any question — especially mathematical questions.

## blueprintSummary:
Generate a summary showing chapter-wise marks allocation and difficulty-wise percentage distribution based on the questions you created.
`,
});

const examPaperGeneratorFlow = ai.defineFlow(
  {
    name: 'examPaperGeneratorFlow',
    inputSchema: ExamPaperInputSchema,
    outputSchema: ExamPaperOutputSchema,
  },
  async input => {
    const { runResiliently } = await import('@/ai/genkit');
    const { StructuredLogger } = await import('@/lib/logger/structured-logger');
    const { FlowExecutionError, SchemaValidationError, PersistenceError } = await import('@/lib/errors');

    const { getStorageInstance } = await import('@/lib/firebase-admin');
    const { format } = await import('date-fns');
    const { v4: uuidv4 } = await import('uuid');

    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      StructuredLogger.info('Starting exam paper generation flow', {
        service: 'exam-paper-generator-flow',
        operation: 'generateExamPaper',
        userId: input.userId,
        requestId,
        input: {
          board: input.board,
          gradeLevel: input.gradeLevel,
          subject: input.subject,
          chapters: input.chapters,
          difficulty: input.difficulty,
          language: input.language,
        }
      });

      const blueprintConstraint = buildBlueprintConstraint(input);

      // --- RAG: retrieve PYQs for each chapter ---
      // Strategy:
      //   1. Try the in-memory pyq-store first (zero-latency, no network).
      //   2. If the store is empty (consolidated JSON not yet populated),
      //      fall back to the Firestore vector-search service.
      //   3. If both fail, proceed without PYQs (graceful degradation).
      let retrievedPYQs: PYQQuestion[] = [];
      try {
        const rawClass = parseInt(input.gradeLevel.replace(/\D/g, ''), 10);
        if (isNaN(rawClass)) {
          StructuredLogger.warn('Could not parse gradeLevel as number — defaulting to Class 10', {
            service: 'exam-paper-generator-flow', operation: 'retrievePYQs', requestId,
            metadata: { gradeLevel: input.gradeLevel },
          });
        }
        const classNum = (rawClass === 9 || rawClass === 10 ? rawClass : 10) as 9 | 10;

        const subjectLower = input.subject.toLowerCase();
        const PYQ_SUPPORTED_SUBJECTS = ['mathematics', 'science'] as const;
        type PYQSubject = typeof PYQ_SUPPORTED_SUBJECTS[number];
        const subjectNorm: PYQSubject | null = (PYQ_SUPPORTED_SUBJECTS as readonly string[]).includes(subjectLower)
          ? (subjectLower as PYQSubject)
          : null;

        if (!subjectNorm) {
          StructuredLogger.warn('Subject not in PYQ store — skipping PYQ retrieval', {
            service: 'exam-paper-generator-flow', operation: 'retrievePYQs', requestId,
            metadata: { subject: input.subject },
          });
          // Jump past PYQ retrieval — retrievedPYQs stays []
          throw new Error(`__NO_PYQ_SUBJECT__`);
        }

        // ── 1. In-memory store (pyq-store.ts) ──────────────────────────────
        const {
          getPYQsByChapterAndType,
          getPYQsByMarks,
          searchPYQs,
          getPYQStoreSize,
        } = await import('@/ai/data/pyq-store');

        const storeSize = getPYQStoreSize();

        if (storeSize > 0) {
          StructuredLogger.info('Using in-memory PYQ store', {
            service: 'exam-paper-generator-flow',
            operation: 'retrievePYQs',
            requestId,
            metadata: { storeSize },
          });

          const globalSeen = new Set<string>();
          const storeResults: PYQQuestion[] = [];

          for (const chapter of input.chapters) {
            const byChapter = getPYQsByChapterAndType(subjectNorm, classNum, chapter, undefined, 15);
            const byKeyword = searchPYQs(subjectNorm, classNum, [chapter], 10);
            for (const q of [...byChapter, ...byKeyword]) {
              if (!globalSeen.has(q.id)) {
                globalSeen.add(q.id);
                storeResults.push(q);
              }
            }
          }

          // Also pull by marks to ensure each mark-band has representation
          // Use blueprint-derived marks bands if available, else fall back to CBSE defaults
          const blueprint = findBlueprint(input.board, input.gradeLevel, input.subject);
          const marksBands = blueprint
            ? [...new Set(blueprint.sections.map(s => s.questionType.marksPerQuestion))]
            : [1, 2, 3, 4, 5];
          for (const marks of marksBands) {
            const byMarks = getPYQsByMarks(subjectNorm, classNum, marks, undefined, 5);
            for (const q of byMarks) {
              if (!globalSeen.has(q.id)) {
                globalSeen.add(q.id);
                storeResults.push(q);
              }
            }
          }

          retrievedPYQs = storeResults;
        } else {
          // ── 2. Firestore vector search fallback ──────────────────────────
          StructuredLogger.info('In-memory store empty — falling back to Firestore PYQ retrieval', {
            service: 'exam-paper-generator-flow',
            operation: 'retrievePYQs',
            requestId,
          });

          const { retrievePYQs, getPYQsByChapter } = await import('@/lib/services/pyq-retrieval-service');

          const retrievalResults = await Promise.all(
            input.chapters.map(async (chapter) => {
              const opts: PYQRetrievalOptions = { subject: subjectNorm, class: classNum, chapter, limit: 10 };
              const [queryResults, chapterResults] = await Promise.all([
                retrievePYQs(
                  `${input.subject} ${chapter} ${input.gradeLevel}`,
                  opts
                ),
                getPYQsByChapter(chapter, subjectNorm, classNum, 10),
              ]);
              // Deduplicate by id — chapterResults take priority
              const seen = new Set<string>();
              const merged: PYQQuestion[] = [];
              for (const q of [...chapterResults, ...queryResults]) {
                if (!seen.has(q.id)) {
                  seen.add(q.id);
                  merged.push(q);
                }
              }
              return merged;
            })
          );

          retrievedPYQs = retrievalResults.flat();
        }

        StructuredLogger.info('PYQ retrieval completed', {
          service: 'exam-paper-generator-flow',
          operation: 'retrievePYQs',
          requestId,
          metadata: { pyqCount: retrievedPYQs.length, chapters: input.chapters },
        });
      } catch (pyqError: unknown) {
        const msg = pyqError instanceof Error ? pyqError.message : String(pyqError);
        if (msg !== '__NO_PYQ_SUBJECT__') {
          StructuredLogger.warn('PYQ retrieval failed — generating without PYQs', {
            service: 'exam-paper-generator-flow',
            operation: 'retrievePYQs',
            requestId,
            metadata: { error: msg },
          });
        }
        // Graceful fallback: proceed without PYQs
      }

      // Build PYQ context block to inject into the prompt
      const pyqContext = buildPYQContext(retrievedPYQs);

      const { output } = await runResiliently(async (resilienceConfig) => {
        return await examPaperGeneratorPrompt(
          { ...input, blueprintConstraint, pyqContext },
          resilienceConfig
        );
      });

      if (!output) {
        throw new FlowExecutionError(
          'AI model returned null output',
          {
            modelUsed: 'gemini-2.0-flash',
            input: `${input.board} ${input.gradeLevel} ${input.subject}`
          }
        );
      }

      try {
        ExamPaperOutputSchema.parse(output);
      } catch (validationError: unknown) {
        const ve = validationError as { message?: string; errors?: unknown };
        throw new SchemaValidationError(
          `Schema validation failed: ${ve.message ?? String(validationError)}`,
          {
            parseErrors: ve.errors,
            rawOutput: output,
            expectedSchema: 'ExamPaperOutputSchema'
          }
        );
      }

      if (input.userId) {
        try {
          const storage = await getStorageInstance();
          const now = new Date();
          const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
          const contentId = uuidv4();
          const fileName = `${timestamp}-${contentId}.json`;
          const filePath = `users/${input.userId}/exam-papers/${fileName}`;
          const file = storage.bucket().file(filePath);

          await file.save(JSON.stringify(output), {
            contentType: 'application/json',
          });

          const { dbAdapter } = await import('@/lib/db/adapter');
          const { Timestamp } = await import('firebase-admin/firestore');

          await dbAdapter.saveContent(input.userId, {
            id: contentId,
            type: 'exam-paper' as const,
            title: output.title || `${input.board} ${input.gradeLevel} ${input.subject} Exam Paper`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            gradeLevel: (output.gradeLevel || input.gradeLevel || 'Class 10') as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            subject: (input.subject || output.subject || 'General') as any,
            topic: input.chapters.length > 0 ? input.chapters.join(', ') : input.subject,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            language: (input.language ?? 'English') as any,
            storagePath: filePath,
            isPublic: false,
            isDraft: false,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            data: output,
          });

          StructuredLogger.info('Exam paper persisted successfully', {
            service: 'exam-paper-generator-flow',
            operation: 'persistContent',
            userId: input.userId,
            requestId,
            metadata: { contentId }
          });

        } catch (persistenceError: unknown) {
          StructuredLogger.error(
            'Failed to persist exam paper',
            {
              service: 'exam-paper-generator-flow',
              operation: 'persistContent',
              userId: input.userId,
              requestId
            },
            new PersistenceError('Persistence failed', 'saveContent')
          );
        }
      }

      const duration = Date.now() - startTime;
      StructuredLogger.info('Exam paper generation flow completed successfully', {
        service: 'exam-paper-generator-flow',
        operation: 'generateExamPaper',
        requestId,
        duration,
        metadata: {
          sectionCount: output.sections.length,
          totalQuestions: output.sections.reduce((sum, s) => sum + s.questions.length, 0),
        }
      });

      return output;

    } catch (flowError: any) {
      const duration = Date.now() - startTime;

      const errorId = StructuredLogger.error(
        'Exam paper generation flow execution failed',
        {
          service: 'exam-paper-generator-flow',
          operation: 'generateExamPaper',
          requestId,
          input: {
            board: input.board,
            gradeLevel: input.gradeLevel,
            subject: input.subject,
          },
          duration,
          metadata: {
            errorType: flowError.constructor?.name,
            errorCode: flowError.errorCode
          }
        },
        flowError
      );

      if (typeof flowError === 'object' && flowError !== null) {
        flowError.errorId = errorId;
      }
      throw flowError;
    }
  }
);
