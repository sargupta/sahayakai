'use server';

/**
 * @fileOverview Provides instant answers to user questions using a knowledge base augmented by Google Search.
 *
 * - instantAnswer - A function that takes a question and returns a direct answer, potentially with a video suggestion.
 * - InstantAnswerInput - The input type for the instantAnswer function.
 * - InstantAnswerOutput - The return type for the instantAnswer function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { googleSearch } from '@/ai/tools/google-search';
import { auth, db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

const InstantAnswerInputSchema = z.object({
  question: z.string().describe('The question asked by the user.'),
  language: z.string().optional().describe('The language for the answer.'),
  gradeLevel: z.string().optional().describe('The grade level the answer should be tailored for.'),
});
export type InstantAnswerInput = z.infer<typeof InstantAnswerInputSchema>;

const InstantAnswerOutputSchema = z.object({
  answer: z.string().describe('The generated answer to the question.'),
  videoSuggestionUrl: z.string().optional().describe('A URL to a relevant YouTube video.'),
});
export type InstantAnswerOutput = z.infer<typeof InstantAnswerOutputSchema>;

export async function instantAnswer(input: InstantAnswerInput): Promise<InstantAnswerOutput> {
  return instantAnswerFlow(input);
}

const instantAnswerPrompt = ai.definePrompt({
  name: 'instantAnswerPrompt',
  input: {schema: InstantAnswerInputSchema},
  output: {schema: InstantAnswerOutputSchema},
  tools: [googleSearch],
  prompt: `You are an expert educator and knowledge base. Your goal is to answer questions accurately and concisely.

**Instructions:**
1.  **Use Tools:** If the question requires current information or facts, use the \`googleSearch\` tool to get up-to-date information.
2.  **Tailor the Answer:** Adjust the complexity and vocabulary of your answer based on the provided \`gradeLevel\`. If no grade level is given, answer for a general audience.
3.  **Language:** Respond in the specified \`language\`.
4.  **Analogies:** For complex topics, use simple analogies, especially for younger grade levels.
5.  **Video Suggestions:** If the user's question implies they want a visual explanation (e.g., "show me," "explain how"), or if a video would be a great supplement, use the \`googleSearch\` tool to find a relevant educational video on YouTube and include the URL in the \`videoSuggestionUrl\` field. Otherwise, leave it blank.
6.  **Be Direct:** Provide the answer directly without conversational filler.

**User's Question:**
- **Question:** {{{question}}}
- **Grade Level:** {{{gradeLevel}}}
- **Language:** {{{language}}}
`,
});

const instantAnswerFlow = ai.defineFlow(
  {
    name: 'instantAnswerFlow',
    inputSchema: InstantAnswerInputSchema,
    outputSchema: InstantAnswerOutputSchema,
  },
  async input => {
    const {output} = await instantAnswerPrompt(input);

    if (!output) {
      throw new Error('The AI model failed to generate an instant answer. The returned output was null.');
    }

    const user = auth.currentUser;
    if (user) {
      await addDoc(collection(db, 'users', user.uid, 'content'), {
        type: 'instant-answer',
        topic: input.question,
        gradeLevels: [input.gradeLevel],
        language: input.language,
        content: output,
        createdAt: serverTimestamp(),
        isPublic: false,
      });
    }

    return output;
  }
);
