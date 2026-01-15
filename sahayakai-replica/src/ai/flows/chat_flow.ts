import { z } from 'genkit';
import { ai } from '../genkit.config';
import { gemini15Flash } from '@genkit-ai/googleai';

const ChatOutputSchema = z.object({
    answer: z.string(),
    videoSuggestionUrl: z.string().optional(),
});

export const chatFlow = ai.defineFlow(
    {
        name: 'chatFlow',
        inputSchema: z.object({
            question: z.string(),
            language: z.string(),
            gradeLevel: z.string(),
            history: z.array(z.object({ role: z.enum(['user', 'model']), message: z.string() })).optional(),
        }),
        outputSchema: ChatOutputSchema,
    },
    async (input: { question: string, language: string, gradeLevel: string, history?: any[] }) => {
        const systemPrompt = `
      You are SahayakAI, a helpful educational assistant for Indian teachers and students.
      Language: ${input.language}
      Grade Level: ${input.gradeLevel}
      
      Provide a clear, age-appropriate answer.
      If relevant, suggest a YouTube video URL for further learning in the 'videoSuggestionUrl' field.
    `;

        const historyText = input.history?.map(h => `${h.role}: ${h.message}`).join('\n') || '';
        const prompt = `${systemPrompt}\n\n${historyText}\n\nuser: ${input.question}`;

        const llmResponse = await ai.generate({
            model: gemini15Flash,
            prompt: prompt,
            output: { schema: ChatOutputSchema },
        });

        if (!llmResponse.output) {
            throw new Error("AI Generation failed to produce output");
        }
        return llmResponse.output;
    }
);
