'use server';

/**
 * @fileOverview The main agent router for the application.
 * This flow determines the user's intent and routes the request to the appropriate sub-agent (e.g., lesson plan generator, quiz generator).
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { generateLessonPlan, LessonPlanInputSchema, LessonPlanOutputSchema } from './lesson-plan-generator';
import { generateQuiz, QuizInputSchema, QuizOutputSchema } from './quiz-generator';
import { getInstantAnswer, InstantAnswerInputSchema, InstantAnswerOutputSchema } from './instant-answer';

// Define the possible agent types
const AgentTypeSchema = z.enum(['lessonPlan', 'quiz', 'instantAnswer', 'unknown']);

// Input schema for the router
export const AgentRouterInputSchema = z.object({
  prompt: z.string().describe('The user\'s request.'),
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
export const agentRouter = ai.defineFlow(
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
        prompt: `Analyze the user\'s prompt and determine which tool is most appropriate.\n\n        - If the user is asking to create a lesson, lesson plan, or similar educational activity, choose 'lessonPlan'.\n        - If the user is asking to create a quiz, test, or set of questions, choose 'quiz'.\n        - If the user is asking a direct question or seeking information, choose 'instantAnswer'.\n        - If the intent is unclear, choose 'unknown'.\n\n        Prompt: {{{prompt}}}\n        `,
      }
    );

    const { output: intentOutput } = await intentPrompt({ prompt: input.prompt });
    const intent = intentOutput?.intent || 'unknown';

    let result: any;

    // 2. Route to the appropriate agent
    switch (intent) {
      case 'lessonPlan':
        result = await generateLessonPlan({
          topic: input.prompt,
          language: input.language,
          gradeLevels: input.gradeLevels,
          imageDataUri: input.imageDataUri,
          userId: input.userId,
        });
        break;
      case 'quiz':
        result = await generateQuiz({
          topic: input.prompt,
          language: input.language,
          gradeLevels: input.gradeLevels,
          numQuestions: 5, // Default, can be customized
          questionType: 'multiple-choice', // Default
          userId: input.userId,
        });
        break;
      case 'instantAnswer':
        result = await getInstantAnswer({
          question: input.prompt,
          language: input.language,
        });
        break;
      default:
        result = { error: "I\'m not sure how to help with that. Please try rephrasing your request." };
        break;
    }

    return {
      type: intent,
      result: result,
    };
  }
);