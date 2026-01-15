'use server';

/**
 * @fileOverview The main agent router for the application.
 * This file acts as a server component to determine intent and route requests.
 */

import { generateLessonPlan } from './lesson-plan-generator';
import { generateQuiz } from './quiz-generator';
import { instantAnswer } from './instant-answer';
import { agentRouterFlow, AgentRouterInput, AgentRouterOutput } from './agent-definitions';
import { instrument } from '@genkit-ai/core';

export async function processAgentRequest(input: AgentRouterInput): Promise<AgentRouterOutput> {
  const { type: intent } = await agentRouterFlow(input);

  let result: any;

  switch (intent) {
    case 'lessonPlan':
      result = await instrument('lesson-plan-generator', async () => {
        return await generateLessonPlan({
          topic: input.prompt,
          language: input.language,
          gradeLevels: input.gradeLevels,
          imageDataUri: input.imageDataUri,
          userId: input.userId,
        });
      });
      break;
    case 'quiz':
      result = await instrument('quiz-generator', async () => {
        return await generateQuiz({
          topic: input.prompt,
          language: input.language,
          gradeLevels: input.gradeLevels,
          numQuestions: 5, // Default, can be customized
          questionTypes: ['multiple_choice'], // Default
          userId: input.userId,
        });
      });
      break;
    case 'instantAnswer':
      result = await instrument('instant-answer', async () => {
        return await instantAnswer({
          question: input.prompt,
          language: input.language,
          userId: input.userId,
        });
      });
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

export type { AgentRouterInput, AgentRouterOutput };
