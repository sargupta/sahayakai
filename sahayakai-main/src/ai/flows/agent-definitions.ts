import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Define the possible agent types
const AgentTypeSchema = z.enum([
  'lessonPlan',
  'quiz',
  'visualAid',
  'worksheet',
  'virtualFieldTrip',
  'teacherTraining',
  'rubric',
  'instantAnswer',
  'unknown'
]);

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

        - 'lessonPlan': Creating lessons, lesson plans, unit plans.
        - 'quiz': Creating quizzes, tests, assessments, exam questions.
        - 'visualAid': finding/creating images, diagrams, flashcards, visual learning materials.
        - 'worksheet': Creating worksheets, exercises, assignments.
        - 'virtualFieldTrip': Planning virtual field trips, exploring locations, "take me to...".
        - 'teacherTraining': Professional development, classroom management advice, teaching strategies.
        - 'rubric': Creating grading rubrics, assessment criteria.
        - 'instantAnswer': Direct questions (What is...), definitions, quick facts.
        - 'unknown': If the intent is unclear or doesn't match above.

        Prompt: {{{prompt}}}
        `,
      }
    );

    const { output: intentOutput } = await intentPrompt({ prompt: input.prompt });
    const intent = intentOutput?.intent || 'unknown';

    // The actual execution or navigation logic will be handled by the server action
    // that calls this flow (or by the client using the returned type).
    // For now, this flow just returns the intent.

    return {
      type: intent,
      result: null,
    };
  }
);