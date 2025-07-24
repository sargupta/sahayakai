'use server';

/**
 * @fileOverview Creates detailed grading rubrics for assignments.
 *
 * - generateRubric - A function that takes an assignment description and returns a structured rubric.
 * - RubricGeneratorInput - The input type for the generateRubric function.
 * - RubricGeneratorOutput - The return type for the generateRubric function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RubricGeneratorInputSchema = z.object({
  assignmentDescription: z.string().describe("A description of the assignment for which to create a rubric."),
  gradeLevel: z.string().optional().describe('The grade level for which the rubric is intended.'),
  language: z.string().optional().describe('The language for the rubric.'),
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
  input: {schema: RubricGeneratorInputSchema},
  output: {schema: RubricGeneratorOutputSchema},
  prompt: `You are an expert educator specializing in assessment design. Create a detailed, fair, and clear grading rubric based on the user's request.

**Instructions:**
1.  **Title and Description:** Create a clear title and a one-sentence description for the rubric based on the assignment.
2.  **Criteria:** Identify 4-5 key evaluation criteria from the assignment description. For each criterion, provide a brief description.
3.  **Performance Levels:** For each criterion, define four performance levels:
    -   Exemplary (highest score)
    -   Proficient
    -   Developing
    -   Beginning (lowest score)
4.  **Points:** Assign points to each level. A common scale is 4 for Exemplary, 3 for Proficient, 2 for Developing, and 1 for Beginning.
5.  **Descriptions:** Write clear, objective, and distinct descriptions for each performance level within each criterion. The descriptions should focus on observable behaviors and outcomes.
6.  **Contextualize:** Tailor the language and complexity of the rubric to the specified \`gradeLevel\` and \`language\`.
7.  **JSON Output:** You MUST conform strictly to the required JSON output format.

**User's Request:**
-   **Assignment Description:** {{{assignmentDescription}}}
-   **Grade Level:** {{{gradeLevel}}}
-   **Language:** {{{language}}}
`,
});

const rubricGeneratorFlow = ai.defineFlow(
  {
    name: 'rubricGeneratorFlow',
    inputSchema: RubricGeneratorInputSchema,
    outputSchema: RubricGeneratorOutputSchema,
  },
  async input => {
    const {output} = await rubricGeneratorPrompt(input);
    return output!;
  }
);
