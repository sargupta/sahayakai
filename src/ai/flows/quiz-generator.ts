
'use server';

/**
 * @fileOverview Creates quizzes based on a topic, context from an image, and user-specified parameters.
 *
 * - generateQuiz - A function that returns a structured quiz with an answer key.
 */

import {ai} from '@/ai/genkit';
import { QuizGeneratorInput, QuizGeneratorInputSchema, QuizGeneratorOutput, QuizGeneratorOutputSchema } from '@/ai/schemas/quiz-generator-schemas';
import { storage, db } from '@/lib/firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
export type { QuizGeneratorOutput } from '@/ai/schemas/quiz-generator-schemas';

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
4.  **Cognitive Level:** If Bloom's Taxonomy levels are provided ({{#if bloomsTaxonomyLevels}}yes{{else}}no{{/if}}), tailor the questions to assess those specific cognitive skills: {{#each bloomsTaxonomyLevels}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}.
5.  **Content:**
    *   For **multiple_choice**, provide 3-4 plausible options and specify the single correct answer.
    *   For **fill_in_the_blanks**, provide a sentence with a clear blank (e.g., "The capital of France is ______.") and the correct word(s) for the answer.
    *   For **short_answer**, provide a model correct answer.
6.  **Tailor Content:** Adjust the complexity and vocabulary for the specified \`gradeLevel\`.
7.  **Language:** Generate the entire quiz (title, questions, options, answers) in the specified \`language\`.
8.  **Output Format:** You MUST conform strictly to the required JSON output format.

**Inputs:**
{{#if imageDataUri}}
-   **Textbook Page Image:** {{media url=imageDataUri}}
{{/if}}
-   **Topic:** {{{topic}}}
-   **Number of Questions:** {{{numQuestions}}}
-   **Question Types:** {{#each questionTypes}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
-   **Bloom's Taxonomy Levels:** {{#each bloomsTaxonomyLevels}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
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

    if (!output) {
      throw new Error('The AI model failed to generate a valid quiz. The returned output was null.');
    }

    if (input.userId) {
      const now = new Date();
      const timestamp = format(now, 'yyyy-MM-dd-HH-mm-ss');
      const contentId = uuidv4();
      const fileName = `${timestamp}-${contentId}.json`;
      const filePath = `users/${input.userId}/quizzes/${fileName}`;
      const file = storage.bucket().file(filePath);

      await file.save(JSON.stringify(output), {
        contentType: 'application/json',
      });

      await db.collection('users').doc(input.userId).collection('content').doc(contentId).set({
        type: 'quiz',
        topic: input.topic,
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
