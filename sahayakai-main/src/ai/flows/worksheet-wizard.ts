/**
 * @fileOverview Creates worksheets from an image of a textbook page and a user prompt.
 *
 * - generateWorksheet - A function that takes an image and a prompt and returns a worksheet.
 * - WorksheetWizardInput - The input type for the generateWorksheet function.
 * - WorksheetWizardOutput - The return type for the generateWorksheet function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getStorageInstance, getDb } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { validateTopicSafety } from '@/lib/safety';
import { format } from 'date-fns';
import { LANGUAGE_CODE_MAP } from '@/types/index';
import { extractGradeFromTopic } from '@/lib/grade-utils';


const WorksheetWizardInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo of a textbook page, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  prompt: z.string().describe('The user\'s request for what kind of worksheet to create.'),
  language: z.string().optional().describe('The language for the worksheet.'),
  gradeLevel: z.string().optional().describe('The grade level for which the worksheet is intended.'),
  userId: z.string().optional().describe('The ID of the user for whom the worksheet is being generated.'),
  subject: z.string().optional().describe('The academic subject.'),
  teacherContext: z.string().optional().describe('Career-stage context for personalising AI output tone and depth.'),
});

export type WorksheetWizardInput = z.infer<typeof WorksheetWizardInputSchema>;

const WorksheetActivitySchema = z.object({
  type: z.enum(['question', 'puzzle', 'creative_task']).describe('The type of activity.'),
  content: z.string().describe('The main content of the activity (e.g., the question or task). Use LaTeX for math.'),
  explanation: z.string().describe('A Bharat-First pedagogical explanation for this activity.'),
  chalkboardNote: z.string().optional().describe('Advice for drawing or writing this on a blackboard.'),
});

const WorksheetWizardOutputSchema = z.object({
  title: z.string().describe('The title of the worksheet.'),
  gradeLevel: z.string().describe('The target grade level (Class X).'),
  subject: z.string().describe('The academic subject.'),
  learningObjectives: z.array(z.string()).describe('List of learning objectives.'),
  studentInstructions: z.string().describe('General instructions for the student.'),
  activities: z.array(WorksheetActivitySchema).describe('The sequence of activities for the student.'),
  answerKey: z.array(z.object({
    activityIndex: z.number().describe('The 0-based index of the activity.'),
    answer: z.string().describe('The correct answer and brief explanation.'),
  })).describe('Answers for the activities.'),
  // Legacy field maintained for transition/compatibility if needed by PDF logic
  worksheetContent: z.string().optional().describe('A Markdown representation of the worksheet (automatically generated if missing).'),
});
export type WorksheetWizardOutput = z.infer<typeof WorksheetWizardOutputSchema>;

export async function generateWorksheet(input: WorksheetWizardInput): Promise<WorksheetWizardOutput> {
  const uid = input.userId;
  let localizedInput = { ...input };

  if (uid) {
    // Fetch user's profile for context (language, grade)
    if (!input.language || !input.gradeLevel) {
      const { dbAdapter } = await import('@/lib/db/adapter');
      const profile = await dbAdapter.getUser(uid);

      if (!input.language && profile?.preferredLanguage) {
        localizedInput.language = profile.preferredLanguage;
      }
      if (!input.gradeLevel && profile?.teachingGradeLevels?.length) {
        localizedInput.gradeLevel = profile.teachingGradeLevels[0];
      }
    }
  }

  // BUG FIX #1: Grade Override - Extract from prompt if explicitly mentioned
  const extractedGrade = extractGradeFromTopic(input.prompt);
  if (extractedGrade) {
    localizedInput.gradeLevel = extractedGrade;
  }

  // Fetch teacher context for AI personalisation
  if (uid && uid !== 'anonymous_user') {
    try {
      const { getTeacherContextLine } = await import('@/lib/teacher-context');
      localizedInput.teacherContext = await getTeacherContextLine(uid);
    } catch {
      // Non-blocking — proceed without teacher context
    }
  }

  // Normalize input
  if (localizedInput.language) {
    localizedInput.language = LANGUAGE_CODE_MAP[localizedInput.language.toLowerCase() as keyof typeof LANGUAGE_CODE_MAP] || localizedInput.language;
  }

  return worksheetWizardFlow(localizedInput);
}

import { SAHAYAK_SOUL_PROMPT, STRUCTURED_OUTPUT_OVERRIDE } from '@/ai/soul';

const worksheetWizardPrompt = ai.definePrompt({
  name: 'worksheetWizardPrompt',
  input: { schema: WorksheetWizardInputSchema },
  output: { schema: WorksheetWizardOutputSchema },
  prompt: `${SAHAYAK_SOUL_PROMPT}${STRUCTURED_OUTPUT_OVERRIDE}
{{#if teacherContext}}{{{teacherContext}}}{{/if}}

You are an expert educator who creates engaging and effective worksheets for rural Indian classrooms.

  **Instructions:**
  1.  **Analyze the Image:** Carefully use the textbook image as the basis for ALL content.
  2.  **Bharat-First Contextualization**: YOU MUST use Indian rural contexts. Use examples from Agriculture, local geography (rivers, villages), local markets, and zero-cost resources. Avoid westernisms like "elevators", "subways", or "dollars".
  3.  **Chalk & Blackboard Awareness**: Design activities that a teacher can easily write on a blackboard. Avoid overly complex diagrams that can't be sketched by hand.
  4.  **Pedagogical Balance:** Ensure the worksheet is challenging but achievable for the specified \`gradeLevel\` (Class terminology).
  5.  **High-Fidelity Math:** 
      - Use LaTeX for ALL mathematical formulas. 
      - CRITICAL: Wrap ALL LaTeX in dollar signs: $ formula $ for inline or $$ formula $$ for blocks.
  6.  **Structured JSON Output**: You MUST return a structured JSON object matching the \`WorksheetWizardOutputSchema\`.
  7.  **Activities**: Generate a mix of questions, puzzles, and creative tasks (e.g., "Draw a paddy field and label the parts").
  8.  **Explanations**: For every activity, provide a "Bharat-First" pedagogical explanation.
  9.  **Answer Key**: Provide clear answers for all activities.
  10. **Metadata:** Identify the most appropriate \`subject\` and \`gradeLevel\`.

**Context:**
- **Textbook Image:** {{media url=imageDataUri}}
- **Request:** {{{prompt}}}
- **Grade**: {{{gradeLevel}}}
- **Language**: {{{language}}}

**Constraints:**
- **Language Lock**: You MUST ONLY respond in the language(s) provided in the input ({{{language}}}).
- **No Repetition Loop**: Monitor your output for repetitive phrases.
- **Scope Integrity**: Stay strictly within the scope of the educational task.
`,
});

const worksheetWizardFlow = ai.defineFlow(
  {
    name: 'worksheetWizardFlow',
    inputSchema: WorksheetWizardInputSchema,
    outputSchema: WorksheetWizardOutputSchema,
  },
  async input => {
    const { runResiliently } = await import('@/ai/genkit');
    const { StructuredLogger } = await import('@/lib/logger/structured-logger');
    const { FlowExecutionError, SchemaValidationError, PersistenceError } = await import('@/lib/errors');

    // Persistence imports
    const { getStorageInstance } = await import('@/lib/firebase-admin');
    const { format } = await import('date-fns');
    const { v4: uuidv4 } = await import('uuid');

    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      StructuredLogger.info('Starting worksheet generation flow', {
        service: 'worksheet-wizard-flow',
        operation: 'generateWorksheet',
        userId: input.userId,
        requestId,
        input: {
          prompt: input.prompt,
          language: input.language,
          gradeLevel: input.gradeLevel
        }
      });

      const { fetchImageAsBase64 } = await import('@/ai/utils/image-utils');

      // Process Image URL -> Base64 if needed
      let processedImageDataUri = input.imageDataUri;
      if (input.imageDataUri && !input.imageDataUri.startsWith('data:')) {
        processedImageDataUri = await fetchImageAsBase64(input.imageDataUri);
      }

      const { output } = await runResiliently(async (resilienceConfig) => {
        return await worksheetWizardPrompt({
          ...input,
          imageDataUri: processedImageDataUri
        }, resilienceConfig);
      });

      if (!output) {
        throw new FlowExecutionError(
          'AI model returned null output',
          {
            modelUsed: 'gemini-2.0-flash',
            input: input.prompt
          }
        );
      }

      // Validate and Sanitize
      let sanitizedOutput: any;
      let worksheetContent = '';
      try {
        const { validateWorksheetOutput, sanitizeWorksheetOutput } = await import('./worksheet-validation');
        sanitizedOutput = sanitizeWorksheetOutput(output);
        const validation = validateWorksheetOutput(sanitizedOutput);

        if (!validation.valid) {
          throw new SchemaValidationError(
            `Worksheet validation failed:\n - ${validation.errors.join('\n - ')}`,
            { validationErrors: validation.errors, rawOutput: sanitizedOutput }
          );
        }

        // Generate worksheetContent (Markdown) for legacy support/PDF
        if (!sanitizedOutput.worksheetContent) {
          sanitizedOutput.worksheetContent = `# ${sanitizedOutput.title}\n\n**Class**: ${sanitizedOutput.gradeLevel} | **Subject**: ${sanitizedOutput.subject}\n\n## I. Learning Objectives\n${sanitizedOutput.learningObjectives.map((o: string) => `- ${o}`).join('\n')}\n\n## II. Student Instructions\n${sanitizedOutput.studentInstructions}\n\n---\n\n## III. Activities\n${sanitizedOutput.activities.map((a: any, i: number) => `### Activity ${i + 1}\n${a.content}\n\n*${a.explanation}*`).join('\n\n')}\n\n---\n\n## IV. Answer Key\n${sanitizedOutput.answerKey.map((ak: any) => `**Activity ${ak.activityIndex + 1}**: ${ak.answer}`).join('\n')}`;
        }

        worksheetContent = sanitizedOutput.worksheetContent;
        output.worksheetContent = worksheetContent;
        WorksheetWizardOutputSchema.parse(sanitizedOutput);
      } catch (validationError: any) {
        if (validationError instanceof SchemaValidationError) throw validationError;
        throw new SchemaValidationError(
          `Schema validation failed: ${validationError.message}`,
          {
            parseErrors: validationError.errors,
            rawOutput: output,
            expectedSchema: 'WorksheetWizardOutputSchema'
          }
        );
      }

      if (input.userId) {
        try {
          const storage = await getStorageInstance();
          const now = new Date();
          const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
          const contentId = uuidv4();
          const fileName = `${timestamp}-${contentId}.md`;
          const filePath = `users/${input.userId}/worksheets/${fileName}`;
          const file = storage.bucket().file(filePath);

          await file.save(worksheetContent, {
            contentType: 'text/markdown',
          });

          const { dbAdapter } = await import('@/lib/db/adapter');
          const { Timestamp } = await import('firebase-admin/firestore');

          await dbAdapter.saveContent(input.userId, {
            id: contentId,
            type: 'worksheet',
            title: `Worksheet: ${input.prompt.substring(0, 30)}`,
            gradeLevel: (output.gradeLevel || input.gradeLevel || 'Class 5') as any,
            subject: (output.subject || 'General') as any,
            topic: input.prompt,
            language: input.language as any || 'English',
            storagePath: filePath,
            isPublic: false,
            isDraft: false,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            data: output,
          });

          StructuredLogger.info('Content persisted successfully', {
            service: 'worksheet-wizard-flow',
            operation: 'persistContent',
            userId: input.userId,
            requestId,
            metadata: { contentId }
          });

        } catch (persistenceError: any) {
          StructuredLogger.error(
            'Failed to persist worksheet',
            {
              service: 'worksheet-wizard-flow',
              operation: 'persistContent',
              userId: input.userId,
              requestId
            },
            new PersistenceError('Persistence failed', 'saveContent')
          );
        }
      }

      const duration = Date.now() - startTime;
      StructuredLogger.info('Worksheet generation flow completed successfully', {
        service: 'worksheet-wizard-flow',
        operation: 'generateWorksheet',
        requestId,
        duration,
        metadata: {
          contentLength: output.worksheetContent.length
        }
      });

      return output as WorksheetWizardOutput & { worksheetContent: string };

    } catch (flowError: any) {
      const duration = Date.now() - startTime;

      const errorId = StructuredLogger.error(
        'Worksheet generation flow execution failed',
        {
          service: 'worksheet-wizard-flow',
          operation: 'generateWorksheet',
          requestId,
          input: {
            prompt: input.prompt
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
