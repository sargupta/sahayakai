
'use server';

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
import { format } from 'date-fns';

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
});

export type WorksheetWizardInput = z.infer<typeof WorksheetWizardInputSchema>;

const WorksheetWizardOutputSchema = z.object({
  worksheetContent: z.string().describe('The generated worksheet content in Markdown format.'),
});
export type WorksheetWizardOutput = z.infer<typeof WorksheetWizardOutputSchema>;

export async function generateWorksheet(input: WorksheetWizardInput): Promise<WorksheetWizardOutput> {
  return worksheetWizardFlow(input);
}

const worksheetWizardPrompt = ai.definePrompt({
  name: 'worksheetWizardPrompt',
  input: { schema: WorksheetWizardInputSchema },
  output: { schema: WorksheetWizardOutputSchema },
  prompt: `You are an expert educator who creates engaging and effective worksheets.
 
  **Instructions:**
  1.  **Analyze the Image:** carefully use the textbook image as the basis for all content.
  2.  **Pedagogical Balance:** Ensure the worksheet is challenging but achievable for the specified \`gradeLevel\`.
  3.  **High-Fidelity Math:** 
      - Use LaTeX for ALL mathematical formulas, equations, and symbols. 
      - CRITICAL: Wrap ALL LaTeX in dollar signs: \$ formula \$ for inline or \$\$ formula \$\$ for blocks.
      - EXAMPLE: Use \$\$ \\int x^2 dx \$\$ instead of simple text.
  4.  **Math Problems vs Questions:**
      - If the user asks for "math problems", generate CALCULATIONS and COMPUTATIONS (e.g., Solve for x, Integrate f(x)).
      - Do NOT generate history or theory questions unless explicitly asked.
  5.  **Strict Markdown Template:** You MUST structure the worksheet exactly like this:
     # [Worksheet Title]
     **Grade**: [Level] | **Subject**: [Subject]
     
     ## I. Learning Objectives
     - [Clear objective 1]
     - [Clear objective 2]
     
     ## II. Student Instructions
     [Clear, step-by-step instructions for the student]
     
     ---
     
     ## III. Activities
     [The main worksheet content: questions, puzzles, or creative tasks based on the image]
     
     ---
     
     ## IV. Teacher's Answer Key (FOR TEACHER USE ONLY)
     [Clear answers and explanations for all activities above]

**Context:**
- **Textbook Image:** {{media url=imageDataUri}}
- **Request:** {{{prompt}}}
- **Grade**: {{{gradeLevel}}}
- **Language**: {{{language}}}
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

      const { output } = await runResiliently(async (resilienceConfig) => {
        return await worksheetWizardPrompt(input, resilienceConfig);
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

      // Validate schema explicitly
      try {
        WorksheetWizardOutputSchema.parse(output);
      } catch (validationError: any) {
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

          await file.save(output.worksheetContent, {
            contentType: 'text/markdown',
          });

          const { getDb } = await import('@/lib/firebase-admin');
          const db = await getDb();
          await db.collection('users').doc(input.userId).collection('content').doc(contentId).set({
            type: 'worksheet',
            topic: input.prompt,
            gradeLevels: [input.gradeLevel],
            language: input.language,
            storagePath: filePath,
            createdAt: now,
            isPublic: false,
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

      return output;

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
