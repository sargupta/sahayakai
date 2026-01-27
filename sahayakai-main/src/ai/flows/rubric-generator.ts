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
});
export type RubricGeneratorOutput = z.infer<typeof RubricGeneratorOutputSchema>;

export async function generateRubric(input: RubricGeneratorInput): Promise<RubricGeneratorOutput> {
  return rubricGeneratorFlow(input);
}

const rubricGeneratorPrompt = ai.definePrompt({
  name: 'rubricGeneratorPrompt',
  input: { schema: RubricGeneratorInputSchema },
  output: { schema: RubricGeneratorOutputSchema },
  prompt: `You are an expert educator specializing in assessment and rubric design. Create a detailed, fair, and professional grading rubric.

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

**Context:**
- **Assignment**: {{{assignmentDescription}}}
- **Grade**: {{{gradeLevel}}}
- **Language**: {{{language}}}
`,
});

const rubricGeneratorFlow = ai.defineFlow(
  {
    name: 'rubricGeneratorFlow',
    inputSchema: RubricGeneratorInputSchema,
    outputSchema: RubricGeneratorOutputSchema,
  },
  async input => {
    const { output } = await rubricGeneratorPrompt(input);

    if (!output) {
      throw new Error('The AI model failed to generate a valid rubric. The returned output was null.');
    }

    if (input.userId) {
      const now = new Date();
      const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
      const contentId = uuidv4();
      const fileName = `${timestamp}-${contentId}.json`;
      const filePath = `users/${input.userId}/rubrics/${fileName}`;

      const storage = await getStorageInstance();
      const file = storage.bucket().file(filePath);

      await file.save(JSON.stringify(output), {
        contentType: 'application/json',
      });

      const db = await getDb();
      await db.collection('users').doc(input.userId).collection('content').doc(contentId).set({
        type: 'rubric',
        topic: input.assignmentDescription,
        gradeLevels: [input.gradeLevel],
        language: input.language,
        storagePath: filePath,
        createdAt: now,
        isPublic: false,
      });
    }

    return output;
  }
);
