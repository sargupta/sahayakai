import { z } from 'genkit';
import { ai } from '../genkit.config';
import { gemini15Flash } from '@genkit-ai/googleai';

// Define the output schema
const ActivitySchema = z.object({
    name: z.string(),
    duration: z.string(),
    description: z.string(),
});

const LessonPlanSchema = z.object({
    title: z.string(),
    subject: z.string(),
    gradeLevel: z.string(),
    duration: z.string(),
    objectives: z.array(z.string()),
    materials: z.array(z.string()),
    activities: z.array(ActivitySchema),
    assessment: z.string(),
});

export const lessonPlanFlow = ai.defineFlow(
    {
        name: 'lessonPlanFlow',
        inputSchema: z.object({
            topic: z.string(),
            gradeLevel: z.string(),
            language: z.string(),
        }),
        outputSchema: LessonPlanSchema,
    },
    async (input: { topic: string, gradeLevel: string, language: string }) => {
        const prompt = `
      Create a detailed lesson plan for:
      Topic: ${input.topic}
      Grade: ${input.gradeLevel}
      Language: ${input.language}
      
      Structure the response strictly as valid JSON.
    `;

        const llmResponse = await ai.generate({
            model: gemini15Flash,
            prompt: prompt,
            output: { schema: LessonPlanSchema },
        });

        if (!llmResponse.output) {
            throw new Error("AI Generation failed");
        }
        return llmResponse.output;
    }
);
