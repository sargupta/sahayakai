'use server';

/**
 * @fileOverview The main agent router for the application.
 * This file acts as a server component to determine intent and route requests.
 */

import { instantAnswer } from './instant-answer';
import { agentRouterFlow, AgentRouterInput, AgentRouterOutput } from './agent-definitions';

export async function processAgentRequest(input: AgentRouterInput): Promise<AgentRouterOutput> {
  const { type: intent } = await agentRouterFlow(input);

  let result: any;

  switch (intent) {
    case 'lessonPlan':
      result = { action: 'NAVIGATE', url: `/lesson-plan?topic=${encodeURIComponent(input.prompt)}` };
      break;
    case 'quiz':
      result = { action: 'NAVIGATE', url: `/quiz-generator?topic=${encodeURIComponent(input.prompt)}` };
      break;
    case 'visualAid':
      result = { action: 'NAVIGATE', url: `/visual-aid-designer?topic=${encodeURIComponent(input.prompt)}` };
      break;
    case 'worksheet':
      result = { action: 'NAVIGATE', url: `/worksheet-wizard?topic=${encodeURIComponent(input.prompt)}` };
      break;
    case 'virtualFieldTrip':
      result = { action: 'NAVIGATE', url: `/virtual-field-trip?topic=${encodeURIComponent(input.prompt)}` };
      break;
    case 'teacherTraining':
      result = { action: 'NAVIGATE', url: `/teacher-training?topic=${encodeURIComponent(input.prompt)}` };
      break;
    case 'rubric':
      result = { action: 'NAVIGATE', url: `/rubric-generator?topic=${encodeURIComponent(input.prompt)}` };
      break;
    case 'instantAnswer':
      // Direct call to instantAnswer, skipping extra instrumentation wrapper for now to avoid import issues
      const answer = await instantAnswer({
        question: input.prompt,
        language: input.language,
        userId: input.userId,
      });
      // The instantAnswer flow returns an object. We'll pass the text answer.
      result = { action: 'ANSWER', content: answer.answer, videoUrl: answer.videoSuggestionUrl };
      break;
    default:
      // Fallback
      result = { error: "I'm not sure how to help with that. Please try rephrasing your request." };
      break;
  }

  return {
    type: intent,
    result: result,
  };
}

export type { AgentRouterInput, AgentRouterOutput };
