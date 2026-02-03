'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { saveContent } from '@/lib/content-persistence';
import { logger, logError } from '@/lib/cloud-logging';
import { getIndianContextPrompt } from '@/lib/indian-context';

const WorksheetWizardInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "A photo of a textbook page, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'"
    ),
  prompt: z.string().describe('The user\'s request for what kind of worksheet to create.'),
  language: z.string().optional().default('English').describe('The language for the worksheet.'),
  gradeLevel: z.string().optional().default('6th Grade').describe('The grade level for which the worksheet is intended.'),
  userId: z.string().optional().describe('The ID of the user for whom the worksheet is being generated.'),
});

export type WorksheetWizardInput = z.infer<typeof WorksheetWizardInputSchema>;

const WorksheetWizardOutputSchema = z.object({
  worksheetContent: z.string().describe('The generated worksheet content in Markdown format.'),
});
export type WorksheetWizardOutput = z.infer<typeof WorksheetWizardOutputSchema>;

export async function generateWorksheet(input: WorksheetWizardInput): Promise<WorksheetWizardOutput> {
  const startTime = Date.now();
  const userId = input.userId;

  try {
    await logger.info({
      event: 'worksheet_generation_started',
      userId,
      metadata: { topic: input.prompt, gradeLevel: input.gradeLevel }
    });

    const output = await worksheetWizardFlow(input);

    const latencyMs = Date.now() - startTime;
    await logger.info({
      event: 'worksheet_generation_completed',
      userId,
      latencyMs,
      metadata: { topic: input.prompt }
    });

    if (userId) {
      await saveContent({
        userId,
        contentType: 'worksheet',
        title: input.prompt,
        content: output.worksheetContent,
        metadata: {
          gradeLevel: input.gradeLevel,
          language: input.language,
          description: `Worksheet generated from textbook image: ${input.prompt}`,
        }
      });
    }

    return output;
  } catch (error: any) {
    await logError({
      event: 'worksheet_generation_failed',
      error,
      userId,
      metadata: { topic: input.prompt }
    });
    throw error;
  }
}

const worksheetWizardPrompt = ai.definePrompt({
  name: 'worksheetWizardPrompt',
  input: { schema: WorksheetWizardInputSchema },
  output: { schema: WorksheetWizardOutputSchema },
  prompt: `You are an expert educator who creates engaging and effective worksheets for students in India.
 
 **Instructions:**
 1.  **Analyze the Image:** carefully use the textbook image as the basis for all content.
 2.  **Pedagogical Balance:** Ensure the worksheet is challenging but achievable for the specified \`gradeLevel\`.
 3.  **Cultural Relevance:** ${getIndianContextPrompt(true)}
 4.  **Strict Markdown Template:** You MUST structure the worksheet exactly like this:
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
    const { output } = await worksheetWizardPrompt(input);

    if (!output) {
      throw new Error('The AI model failed to generate a valid worksheet. The returned output was null.');
    }

    return output;
  }
);

/**
 * Smart Feature: Convert a markdown worksheet into a professional DOCX/PDF printable.
 */
export async function convertWorksheetToPrintable(worksheet: WorksheetWizardOutput, userId?: string) {
  const { SkillBridge } = await import('@/ai/utils/skill-bridge');

  await logger.info({
    event: 'worksheet_to_printable_started',
    userId
  });

  const result = await SkillBridge.generateWorksheet({ worksheet, userId });

  return result;
}
