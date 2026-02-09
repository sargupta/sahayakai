'use server';

/**
 * @fileOverview Creates detailed grading rubrics for assignments.
 *
 * - generateRubric - A function that takes an assignment description and returns a structured rubric.
 * - RubricGeneratorInput - The input type for the generateRubric function.
 * - RubricGeneratorOutput - The return type for the generateRubric function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getStorageInstance, getDb } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { SAHAYAK_SOUL_PROMPT } from '@/ai/soul';
import { extractGradeFromTopic } from '@/lib/grade-utils';

const RubricGeneratorInputSchema = z.object({
  assignmentDescription: z.string().describe("A description of the assignment for which to create a rubric."),
  gradeLevel: z.string().optional().describe('The grade level for which the rubric is intended.'),
  language: z.string().optional().describe('The language for the rubric.'),
  userId: z.string().optional().describe('The ID of the user for whom the rubric is being generated.'),
});
export type RubricGeneratorInput = z.infer<typeof RubricGeneratorInputSchema>;

const RubricGeneratorOutputSchema = z.object({
  title: z.string().describe("The title of the rubric (e.g., 'Science Project Rubric')."),
  description: z.string().describe("A brief, one-sentence description of the assignment this rubric is for."),
  criteria: z.array(z.object({
    name: z.string().describe("The name of the criterion (e.g., 'Research and Content')."),
    description: z.string().describe("A brief description of what this criterion evaluates."),
    levels: z.array(z.object({
      name: z.string().describe("The name of the performance level (e.g., 'Exemplary', 'Proficient', 'Developing', 'Beginning')."),
      description: z.string().describe("A detailed description of what performance at this level looks like for this criterion."),
      points: z.number().describe("The points awarded for this level."),
    })).describe("A list of performance levels for the criterion, from highest to lowest score."),
  })).describe("An array of criteria for evaluating the assignment."),
  gradeLevel: z.string().nullable().optional().describe('The target grade level.'),
  subject: z.string().nullable().optional().describe('The academic subject.'),
});
export type RubricGeneratorOutput = z.infer<typeof RubricGeneratorOutputSchema>;

export async function generateRubric(input: RubricGeneratorInput): Promise<RubricGeneratorOutput> {
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

  // BUG FIX #1: Grade Override - Extract from assignmentDescription if explicitly mentioned
  const extractedGrade = extractGradeFromTopic(input.assignmentDescription);
  if (extractedGrade) {
    localizedInput.gradeLevel = extractedGrade;
  }

  return rubricGeneratorFlow(localizedInput);
}

const rubricGeneratorPrompt = ai.definePrompt({
  name: 'rubricGeneratorPrompt',
  input: { schema: RubricGeneratorInputSchema },
  output: { schema: RubricGeneratorOutputSchema },
  prompt: `${SAHAYAK_SOUL_PROMPT}

You are an expert educator specializing in assessment and rubric design. Create a detailed, fair, and professional grading rubric.

**Standardized Structure:**
1. **Title & Description**: Clear title and one-sentence goal.
2. **Criteria**: Identify 4-5 core evaluation areas.
3. **Mandatory Levels**: Use these 4 levels for every criterion:
    - **Exemplary (4 pts)**: Exceeds all expectations.
    - **Proficient (3 pts)**: Meets all standard expectations.
    - **Developing (2 pts)**: Shows some understanding but lacks consistency.
    - **Beginning (1 pt)**: Minimal evidence of the required skill.
4. **Precision**: Descriptions MUST be objective and measurable (e.g., "Contains 0-1 errors" instead of "Few errors").
5. **Teacher Guidance**: Add a note on how the teacher should use this specific rubric to provide feedback.
6. **Metadata**: Identify the most appropriate \`subject\` (e.g., English, Science) and \`gradeLevel\` if not explicitly provided.

**Context:**
- **Assignment**: {{{assignmentDescription}}}
- **Grade**: {{{gradeLevel}}}
- **Language**: {{{language}}}

**Constraints:**
- **Language Lock**: You MUST ONLY respond in the language(s) provided in the input ({{{language}}}). Do NOT shift into other languages (like Chinese, Spanish, etc.) unless explicitly requested.
- **No Repetition Loop**: Monitor your output for repetitive phrases or characters. If you detect a loop, break it immediately.
- **Scope Integrity**: Stay strictly within the scope of the educational task assigned.
`,
});

const rubricGeneratorFlow = ai.defineFlow(
  {
    name: 'rubricGeneratorFlow',
    inputSchema: RubricGeneratorInputSchema,
    outputSchema: RubricGeneratorOutputSchema,
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
      StructuredLogger.info('Starting rubric generation flow', {
        service: 'rubric-generator-flow',
        operation: 'generateRubric',
        userId: input.userId,
        requestId,
        input: {
          assignmentDescription: input.assignmentDescription,
          language: input.language,
          gradeLevel: input.gradeLevel
        }
      });

      const { output } = await runResiliently(async (resilienceConfig) => {
        return await rubricGeneratorPrompt(input, resilienceConfig);
      });

      if (!output) {
        throw new FlowExecutionError(
          'AI model returned null output',
          {
            modelUsed: 'gemini-2.0-flash',
            input: input.assignmentDescription
          }
        );
      }

      // Validate schema explicitly
      try {
        RubricGeneratorOutputSchema.parse(output);
      } catch (validationError: any) {
        throw new SchemaValidationError(
          `Schema validation failed: ${validationError.message}`,
          {
            parseErrors: validationError.errors,
            rawOutput: output,
            expectedSchema: 'RubricGeneratorOutputSchema'
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
          const filePath = `users/${input.userId}/rubrics/${fileName}`;
          const file = storage.bucket().file(filePath);

          await file.save(JSON.stringify(output), {
            contentType: 'application/json',
          });

          const { dbAdapter } = await import('@/lib/db/adapter');
          const { Timestamp } = await import('firebase-admin/firestore');

          await dbAdapter.saveContent(input.userId, {
            id: contentId,
            type: 'rubric',
            title: output.title || `Rubric: ${input.assignmentDescription}`,
            gradeLevel: (output.gradeLevel || input.gradeLevel || 'Class 5') as any,
            subject: (output.subject || 'General') as any,
            topic: input.assignmentDescription,
            language: input.language as any || 'English',
            storagePath: filePath,
            isPublic: false,
            isDraft: false,
            createdAt: Timestamp.fromDate(now),
            updatedAt: Timestamp.fromDate(now),
            data: output,
          });

          StructuredLogger.info('Content persisted successfully', {
            service: 'rubric-generator-flow',
            operation: 'persistContent',
            userId: input.userId,
            requestId,
            metadata: { contentId }
          });

        } catch (persistenceError: any) {
          StructuredLogger.error(
            'Failed to persist rubric',
            {
              service: 'rubric-generator-flow',
              operation: 'persistContent',
              userId: input.userId,
              requestId
            },
            new PersistenceError('Persistence failed', 'saveContent')
          );
        }
      }

      const duration = Date.now() - startTime;
      StructuredLogger.info('Rubric generation flow completed successfully', {
        service: 'rubric-generator-flow',
        operation: 'generateRubric',
        requestId,
        duration,
        metadata: {
          criteriaCount: output.criteria.length
        }
      });

      return output;

    } catch (flowError: any) {
      const duration = Date.now() - startTime;

      const errorId = StructuredLogger.error(
        'Rubric generation flow execution failed',
        {
          service: 'rubric-generator-flow',
          operation: 'generateRubric',
          requestId,
          input: {
            assignment: input.assignmentDescription
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
