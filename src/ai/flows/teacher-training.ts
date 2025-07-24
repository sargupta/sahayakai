
'use server';

/**
 * @fileOverview Provides professional development advice and encouragement for teachers.
 *
 * - getTeacherTrainingAdvice - A function that takes a question and returns personalized advice.
 * - TeacherTrainingInput - The input type for the getTeacherTrainingAdvice function.
 * - TeacherTrainingOutput - The return type for the getTeacherTrainingAdvice function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TeacherTrainingInputSchema = z.object({
  question: z.string().describe("The teacher's question or request for advice."),
  language: z.string().optional().describe('The language for the response.'),
});
export type TeacherTrainingInput = z.infer<typeof TeacherTrainingInputSchema>;

const TeacherTrainingOutputSchema = z.object({
  introduction: z.string().describe("A brief, empathetic introduction acknowledging the teacher's question."),
  advice: z.array(z.object({
    strategy: z.string().describe("A clear, actionable strategy or technique the teacher can use."),
    pedagogy: z.string().describe("The name of the core pedagogical principle behind the strategy (e.g., 'Constructivism', 'Scaffolding')."),
    explanation: z.string().describe("A simple explanation of the pedagogical principle and why it works, including a relevant analogy."),
  })).describe("A list of advice points."),
  conclusion: z.string().describe("A final, encouraging and motivational closing statement for the teacher."),
});
export type TeacherTrainingOutput = z.infer<typeof TeacherTrainingOutputSchema>;

export async function getTeacherTrainingAdvice(input: TeacherTrainingInput): Promise<TeacherTrainingOutput> {
  return teacherTrainingFlow(input);
}

const teacherTrainingPrompt = ai.definePrompt({
  name: 'teacherTrainingPrompt',
  input: {schema: TeacherTrainingInputSchema},
  output: {schema: TeacherTrainingOutputSchema, format: 'json'},
  prompt: `You are SahayakAI, a compassionate and experienced professional development coach for teachers in India. Your goal is to provide supportive, practical, and encouraging advice that is grounded in sound pedagogy.

**Instructions:**
1.  **Empathy First:** Start with a supportive and understanding introduction that acknowledges the teacher's specific challenge.
2.  **Actionable Strategies:** Provide a list of clear, concrete strategies. Each strategy should be a separate item in the 'advice' array.
3.  **MANDATORY Pedagogy Connection:** For EACH strategy, you MUST identify the core pedagogical principle at play. Put the name of this principle in the \`pedagogy\` field.
4.  **Explain the 'Why':** In the \`explanation\` field, briefly explain what the pedagogical principle means and why the strategy is effective. Use simple, relevant analogies (especially from an Indian context) to make the concept easier to understand.
5.  **Encouraging Conclusion:** End with a warm, motivational closing statement to remind the teacher of their value.
6.  **Language:** Respond entirely in the specified \`language\`.
7.  **JSON Output:** You MUST conform strictly to the required JSON output format.

**Teacher's Request:**
-   **Question/Concern:** {{{question}}}
-   **Language:** {{{language}}}
`,
});

const teacherTrainingFlow = ai.defineFlow(
  {
    name: 'teacherTrainingFlow',
    inputSchema: TeacherTrainingInputSchema,
    outputSchema: TeacherTrainingOutputSchema,
  },
  async input => {
    const {output} = await teacherTrainingPrompt(input);
    return output!;
  }
);
