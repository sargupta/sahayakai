import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the possible agent types
const AgentTypeSchema = z.enum(['lessonPlan', 'quiz', 'instantAnswer', 'unknown']);

// Input schema for the router
export const AgentRouterInputSchema = z.object({
  prompt: z.string().describe('The user request.'),
  language: z.string().optional().describe('The language of the request.'),
  gradeLevels: z.array(z.string()).optional().describe('The grade levels for the content.'),
  imageDataUri: z.string().optional().describe('An optional image data URI.'),
  userId: z.string().optional().describe('The ID of the user.'),
});
export type AgentRouterInput = z.infer<typeof AgentRouterInputSchema>;

// Output schema for the router
export const AgentRouterOutputSchema = z.object({
  type: AgentTypeSchema.describe('The type of agent that handled the request.'),
  result: z.any().describe('The output from the selected agent.'),
});
export type AgentRouterOutput = z.infer<typeof AgentRouterOutputSchema>;


// The main router flow
export const agentRouterFlow = ai.defineFlow(
  {
    name: 'agentRouter',
    inputSchema: AgentRouterInputSchema,
    outputSchema: AgentRouterOutputSchema,
  },
  async (input) => {
    // 1. Determine the user's intent
    const intentPrompt = ai.definePrompt(
      {
        name: 'intentClassifier',
        input: { schema: z.object({ prompt: z.string() }) },
        output: { schema: z.object({ intent: AgentTypeSchema }) },
        prompt: `Analyze the user prompt and determine which tool is most appropriate.

        - If the user is asking to create a lesson, lesson plan, or similar educational activity, choose 'lessonPlan'.
        - If the user is asking to create a quiz, test, or set of questions, choose 'quiz'.
        - If the user is asking a direct question or seeking information, choose 'instantAnswer'.
        - If the intent is unclear, choose 'unknown'.

        Prompt: {{{prompt}}}
        `,
      }
    );

    const { output: intentOutput } = await intentPrompt({ prompt: input.prompt });
    const intent = intentOutput?.intent || 'unknown';

    // The actual calls to generateLessonPlan, generateQuiz, and instantAnswer
    // will be handled in the server component (agent-router.ts) which imports this flow.
    // This file only defines the flow structure and intent routing logic.
    let result: any;
    switch (intent) {
      case 'lessonPlan':
        result = { /* Placeholder for lesson plan result */ };
        break;
      case 'quiz':
        result = { /* Placeholder for quiz result */ };
        break;
      case 'instantAnswer':
        result = { /* Placeholder for instant answer result */ };
        break;
      default:
        result = { error: "I'm not sure how to help with that. Please try rephrasing your request." };
        break;
    }

    return {
      type: intent,
      result: result,
    };
  }
);