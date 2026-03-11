'use server';

/**
 * @fileOverview The main agent router for the application.
 * This file acts as a server component to determine intent and route requests.
 */

import { instantAnswer } from './instant-answer';
import { agentRouterFlow, AgentRouterInput, AgentRouterOutput } from './agent-definitions';

export async function processAgentRequest(input: AgentRouterInput): Promise<AgentRouterOutput> {
  const {
    type: intent,
    topic: extractedTopic,
    gradeLevel: extractedGrade,
    subject: extractedSubject,
    language: detectedLanguage
  } = await agentRouterFlow(input);

  // Use extracted topic if prompt is generic, otherwise use prompt
  const finalTopic = extractedTopic || input.prompt;
  const finalLanguage = detectedLanguage || input.language || 'en';

  let result: any;
  const queryParams = new URLSearchParams();
  queryParams.set('topic', finalTopic);
  if (extractedGrade) queryParams.set('gradeLevel', extractedGrade);
  if (extractedSubject) queryParams.set('subject', extractedSubject);
  if (finalLanguage) queryParams.set('language', finalLanguage);

  const queryString = queryParams.toString();

  switch (intent) {
    case 'lessonPlan':
      result = { action: 'NAVIGATE', url: `/lesson-plan?${queryString}` };
      break;
    case 'quiz':
      result = { action: 'NAVIGATE', url: `/quiz-generator?${queryString}` };
      break;
    case 'visualAid':
      result = { action: 'NAVIGATE', url: `/visual-aid-designer?${queryString}` };
      break;
    case 'worksheet':
      result = { action: 'NAVIGATE', url: `/worksheet-wizard?${queryString}` };
      break;
    case 'virtualFieldTrip':
      result = { action: 'NAVIGATE', url: `/virtual-field-trip?${queryString}` };
      break;
    case 'teacherTraining':
      result = { action: 'NAVIGATE', url: `/teacher-training?${queryString}` };
      break;
    case 'rubric':
      result = { action: 'NAVIGATE', url: `/rubric-generator?${queryString}` };
      break;
    case 'videoStoryteller':
      result = { action: 'NAVIGATE', url: `/video-storyteller?${queryString}` };
      break;
    case 'instantAnswer':
      // Direct call to instantAnswer
      const answer = await instantAnswer({
        question: input.prompt,
        language: finalLanguage,
        userId: input.userId,
      });
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
