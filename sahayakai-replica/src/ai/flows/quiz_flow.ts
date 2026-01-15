import { z } from 'genkit';
import { ai } from '../genkit.config';
import { gemini15Flash } from '@genkit-ai/googleai';

const QuestionSchema = z.object({
    question: z.string(),
    type: z.string(),
    options: z.array(z.string()),
    answer: z.string(),
    explanation: z.string(),
});

const QuizSchema = z.object({
    title: z.string(),
    questions: z.array(QuestionSchema),
});

export const quizFlow = ai.defineFlow(
    {
        name: 'quizFlow',
        inputSchema: z.object({
            topic: z.string(),
            gradeLevel: z.string(),
            language: z.string(),
            numQuestions: z.number().default(5),
            questionTypes: z.array(z.string()),
            bloomsTaxonomyLevels: z.array(z.string()),
            imageDataUri: z.string().optional(),
        }),
        outputSchema: QuizSchema,
    },
    async (input: { topic: string, gradeLevel: string, language: string, numQuestions: number, questionTypes: string[], bloomsTaxonomyLevels: string[], imageDataUri?: string }) => {
        let prompt = `
      Create a quiz for:
      Topic: ${input.topic}
      Grade: ${input.gradeLevel}
      Language: ${input.language}
      Number of Questions: ${input.numQuestions}
      Question Types: ${input.questionTypes.join(', ')}
      Blooms Taxonomy Levels: ${input.bloomsTaxonomyLevels.join(', ')}

      Structure the response strict JSON.
    `;

        // Handle Image Input (Multimodal)
        const promptContent: any[] = [{ text: prompt }];
        if (input.imageDataUri) {
            promptContent.push({ media: { url: input.imageDataUri } });
        }

        const llmResponse = await ai.generate({
            model: gemini15Flash,
            prompt: promptContent,
            output: { schema: QuizSchema },
        });

        if (!llmResponse.output) {
            throw new Error("AI Generation failed");
        }
        return llmResponse.output;
    }
);
