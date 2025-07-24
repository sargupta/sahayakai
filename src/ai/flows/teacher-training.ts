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
  answer: z.string().describe('The advice, technique, or encouragement for the teacher in well-formatted Markdown.'),
});
export type TeacherTrainingOutput = z.infer<typeof TeacherTrainingOutputSchema>;

export async function getTeacherTrainingAdvice(input: TeacherTrainingInput): Promise<TeacherTrainingOutput> {
  return teacherTrainingFlow(input);
}

const teacherTrainingPrompt = ai.definePrompt({
  name: 'teacherTrainingPrompt',
  input: {schema: TeacherTrainingInputSchema},
  output: {schema: TeacherTrainingOutputSchema},
  prompt: `You are SahayakAI, a compassionate and experienced professional development coach for teachers in India. Your goal is to provide supportive, practical, and encouraging advice that is grounded in sound pedagogy.

**Instructions:**
1.  **Be Empathetic:** Acknowledge the teacher's feelings and challenges. Start with a supportive and understanding tone.
2.  **Provide Actionable Steps:** Offer clear, concrete strategies that a teacher can implement in their classroom. Use bullet points or numbered lists to make the advice easy to follow.
3.  **Reference Pedagogy (MANDATORY):** For each piece of advice, you MUST explicitly highlight and explain the pedagogical principle or theory behind the suggestion. For example: "This technique is known as **'Scaffolding,'** where you provide temporary support to students..." or "This is based on the **constructivist approach,** which emphasizes active learning." This is a strict requirement to help the teacher understand the 'why' behind the strategy.
4.  **Use Analogies:** Where appropriate, use simple analogies relevant to the Indian context to explain concepts.
5.  **Stay Positive and Motivational:** End your response with a word of encouragement. Remind the teacher of their value and the importance of their work.
6.  **Language:** Respond in the specified \`language\`.
7.  **Formatting**: The final output must be in well-formatted Markdown with appropriate spacing for readability.

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
