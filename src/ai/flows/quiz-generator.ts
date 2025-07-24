
'use server';

/**
 * @fileOverview Creates quizzes based on a topic, context from an image, and user-specified parameters.
 *
 * - generateQuiz - A function that returns a structured quiz with an answer key.
 * - QuizGeneratorInput - The input type for the generateQuiz function.
 * - QuizGeneratorOutput - The return type for the generateQuiz function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const QuestionSchema = z.object({
  questionText: z.string().describe('The full text of the question.'),
  questionType: z.enum(['multiple_choice', 'true_false', 'short_answer']).describe('The type of the question.'),
  options: z.array(z.string()).optional().describe('For multiple-choice questions, the list of possible answers.'),
  correctAnswer: z.string().describe('The correct answer. For short answer, this can be a model answer.'),
});

export const QuizGeneratorInputSchema = z.object({
  topic: z.string().describe('The topic of the quiz.'),
  imageDataUri: z.string().optional().describe(
    "An optional photo of a textbook page, as a data URI that must include a MIME type and use Base64 encoding. This will be the primary context for the quiz."
  ),
  numQuestions: z.number().default(5).describe('The number of questions to generate.'),
  questionTypes: z.array(z.enum(['multiple_choice', 'true_false', 'short_answer'])).describe('The types of questions to include.'),
  gradeLevel: z.string().optional().describe('The grade level for which the quiz is intended.'),
  language: z.string().optional().describe('The language for the quiz.'),
});
export type QuizGeneratorInput = z.infer<typeof QuizGeneratorInputSchema>;

export const QuizGeneratorOutputSchema = z.object({
  title: z.string().describe('A suitable title for the quiz.'),
  questions: z.array(QuestionSchema).describe('The list of generated quiz questions.'),
});
export type QuizGeneratorOutput = z.infer<typeof QuizGeneratorOutputSchema>;

export async function generateQuiz(input: QuizGeneratorInput): Promise<QuizGeneratorOutput> {
  return quizGeneratorFlow(input);
}

const quizGeneratorPrompt = ai.definePrompt({
  name: 'quizGeneratorPrompt',
  input: {schema: QuizGeneratorInputSchema},
  output: {schema: QuizGeneratorOutputSchema},
  prompt: `You are an expert educator who excels at creating assessments. Generate a quiz based on the provided inputs.

**Instructions:**
1.  **Analyze Context:** If an image is provided ({{#if imageDataUri}}yes{{else}}no{{/if}}), use it as the primary source of information. The topic should guide the focus of the quiz. If no image is provided, base the quiz solely on the topic.
2.  **Generate Questions:** Create exactly {{{numQuestions}}} questions.
3.  **Question Types:** The questions should be a mix of the following types: {{#each questionTypes}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}.
4.  **Content:**
    *   For **multiple_choice**, provide 3-4 plausible options and specify the single correct answer.
    *   For **true_false**, the correct answer should be 'True' or 'False'.
    *   For **short_answer**, provide a model correct answer.
5.  **Tailor Content:** Adjust the complexity and vocabulary for the specified \`gradeLevel\`.
6.  **Language:** Generate the entire quiz (title, questions, options, answers) in the specified \`language\`.
7.  **Output Format:** You MUST conform strictly to the required JSON output format.

**Inputs:**
{{#if imageDataUri}}
-   **Textbook Page Image:** {{media url=imageDataUri}}
{{/if}}
-   **Topic:** {{{topic}}}
-   **Number of Questions:** {{{numQuestions}}}
-   **Question Types:** {{#each questionTypes}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
-   **Grade Level:** {{{gradeLevel}}}
-   **Language:** {{{language}}}

`,
});

const quizGeneratorFlow = ai.defineFlow(
  {
    name: 'quizGeneratorFlow',
    inputSchema: QuizGeneratorInputSchema,
    outputSchema: QuizGeneratorOutputSchema,
  },
  async input => {
    const {output} = await quizGeneratorPrompt(input);
    return output!;
  }
);
