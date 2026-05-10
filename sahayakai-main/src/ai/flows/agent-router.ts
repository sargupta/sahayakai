/**
 * @fileOverview The main agent router for the application.
 * This file acts as a server component to determine intent and route requests.
 *
 * Phase N.1 — consumer reads `plannedActions[0]` as the primary action
 * for v0.4+ clients (OmniOrb post-δ migration); the legacy ANSWER /
 * NAVIGATE / error result shape is preserved on the `result` field for
 * backward compat with v0.3 clients still in the wild.
 */

import { instantAnswer } from './instant-answer';
import {
  agentRouterFlow,
  AgentRouterInput,
  AgentRouterOutput,
  type VidyaAction,
} from './agent-definitions';

/**
 * Phase N.1 — transitional 30-day shim.
 *
 * If the agent-router output (or any upstream consumer) hands us a
 * legacy-shape object with a `followUpSuggestion: string` field, we
 * synthesise a single-entry plan from the primary action so the v0.4+
 * iteration surface still works. We log a deprecation warning so the
 * audit dashboard surfaces any caller still emitting the old shape.
 *
 * Plan to remove this shim 30 days after Phase N.1 lands (forensic
 * audit B5 + C4 closure window).
 */
interface LegacyOutputShape {
  followUpSuggestion?: string | null;
  plannedActions?: VidyaAction[];
}

function reconcilePlannedActions(
  primary: VidyaAction | null,
  upstream: LegacyOutputShape,
): VidyaAction[] {
  // Happy path: Phase N.1+ shape — typed plan already populated.
  if (Array.isArray(upstream.plannedActions) && upstream.plannedActions.length > 0) {
    return upstream.plannedActions;
  }
  // Legacy v0.3 shape: only `followUpSuggestion` (a 300-char prose
  // blob) is set. Synthesise a minimal single-action plan from the
  // primary so chips still render on v0.4+ clients.
  if (upstream.followUpSuggestion && primary) {
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        event: 'agent_router.legacy_followup_suggestion',
        message:
          'Received legacy `followUpSuggestion` field — synthesising a 1-action plan. Remove the legacy emitter; this shim is scheduled for removal 30 days after Phase N.1.',
      }),
    );
    return [primary];
  }
  // No plan, no legacy field — single-action plan from the primary
  // (or empty for non-routable intents).
  return primary ? [primary] : [];
}

export async function processAgentRequest(input: AgentRouterInput): Promise<AgentRouterOutput> {
  // Wave 2: cap the input prompt at 2000 chars. The OmniOrb is the hot path
  // for free-form user input; without a cap an attacker (or a runaway client)
  // could stuff a giant prompt to inflate token cost on every interaction.
  if (input.prompt && input.prompt.length > 2000) {
    throw new Error('Prompt too long (max 2000 characters).');
  }

  const flowOutput = await agentRouterFlow(input);
  const {
    type: intent,
    topic: extractedTopic,
    gradeLevel: extractedGrade,
    subject: extractedSubject,
    language: detectedLanguage,
    plannedActions: rawPlannedActions,
  } = flowOutput;

  // Use extracted topic if prompt is generic, otherwise use prompt
  const finalTopic = extractedTopic || input.prompt;
  const finalLanguage = detectedLanguage || input.language || 'en';

  // Phase N.1 — primary action is `plannedActions[0]` if the
  // classifier emitted one. Falls back to the legacy intent-driven
  // switch for the navigation `result` shape so v0.3 clients keep
  // working.
  const primaryAction: VidyaAction | null = rawPlannedActions?.[0] ?? null;
  const plannedActions = reconcilePlannedActions(
    primaryAction,
    flowOutput as LegacyOutputShape,
  );

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
    case 'examPaper':
      result = { action: 'NAVIGATE', url: `/exam-paper?${queryString}` };
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
    topic: extractedTopic,
    gradeLevel: extractedGrade,
    subject: extractedSubject,
    language: detectedLanguage,
    plannedActions,
    result,
  };
}

export type { AgentRouterInput, AgentRouterOutput };
