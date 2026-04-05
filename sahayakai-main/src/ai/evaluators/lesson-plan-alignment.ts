/**
 * @fileOverview Evaluator for lesson plan quality.
 *
 * Measures three sub-scores:
 *   1. ncertAlignment  (0-1, LLM judge) - how well objectives/activities address reference learning outcomes
 *   2. fiveEStructure  (0-1, heuristic)  - coverage of the 5E instructional phases
 *   3. languageAdherence (0-1, LLM judge) - whether content language matches the requested language
 *
 * Composite score = ncertAlignment * 0.4 + fiveEStructure * 0.3 + languageAdherence * 0.3
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// ── Schemas ──────────────────────────────────────────────────────────────────

const LessonPlanAlignmentResponseSchema = z.object({
  ncertAlignment: z
    .number()
    .min(0)
    .max(1)
    .describe('How well the lesson plan addresses the reference learning outcomes (0-1).'),
  fiveEStructure: z
    .number()
    .min(0)
    .max(1)
    .describe('Fraction of the 5E phases covered by activities (0-1).'),
  languageAdherence: z
    .number()
    .min(0)
    .max(1)
    .describe('Whether the output language matches the requested language (0-1).'),
  composite: z
    .number()
    .min(0)
    .max(1)
    .describe('Weighted composite score: ncertAlignment*0.4 + fiveEStructure*0.3 + languageAdherence*0.3'),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const FIVE_E_PHASES = ['Engage', 'Explore', 'Explain', 'Elaborate', 'Evaluate'] as const;

/**
 * Heuristic: count how many of the 5 phases are present in the activities array.
 */
function computeFiveEScore(output: Record<string, unknown>): number {
  const activities = output.activities as Array<{ phase?: string }> | undefined;
  if (!Array.isArray(activities) || activities.length === 0) return 0;

  const phasesPresent = new Set(
    activities
      .map((a) => a.phase)
      .filter(Boolean)
      .map((p) => (p as string).trim()),
  );

  const covered = FIVE_E_PHASES.filter((phase) => phasesPresent.has(phase)).length;
  return covered / FIVE_E_PHASES.length;
}

/**
 * LLM judge: evaluate how many reference learning outcomes are addressed.
 * Returns a score between 0 and 1.
 */
async function judgeNcertAlignment(
  output: Record<string, unknown>,
  learningOutcomes: string[],
): Promise<number> {
  if (!learningOutcomes || learningOutcomes.length === 0) {
    // No reference outcomes provided — return neutral score
    return 0.7;
  }

  const objectives = Array.isArray(output.objectives)
    ? (output.objectives as string[]).join('\n- ')
    : '';

  const activitiesText = Array.isArray(output.activities)
    ? (output.activities as Array<{ name?: string; description?: string }>)
        .map((a) => `${a.name ?? ''}: ${a.description ?? ''}`)
        .join('\n')
    : '';

  const outcomesText = learningOutcomes.map((o, i) => `${i + 1}. ${o}`).join('\n');

  const result = await ai.generate({
    model: 'googleai/gemini-2.0-flash',
    prompt: `You are an education evaluator.

Given the following NCERT learning outcomes:
${outcomesText}

And the lesson plan's objectives:
- ${objectives}

And the lesson plan's activities:
${activitiesText}

Score how well the lesson plan addresses the learning outcomes.
Count how many of the ${learningOutcomes.length} outcomes are meaningfully covered by the objectives or activities.
Return ONLY a JSON object: { "covered": <number>, "total": ${learningOutcomes.length}, "score": <number between 0 and 1> }
The score should be covered / total, rounded to 2 decimal places.`,
    config: { temperature: 0.1, responseMimeType: 'application/json' },
  });

  try {
    const parsed = JSON.parse(result.text);
    const score = Number(parsed.score);
    return Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : 0.7;
  } catch {
    return 0.7;
  }
}

/**
 * LLM judge: verify the output language matches the requested language.
 * Samples the first 200 chars of objectives + first activity description.
 */
async function judgeLanguageAdherence(
  output: Record<string, unknown>,
  requestedLanguage: string | undefined,
): Promise<number> {
  if (!requestedLanguage) {
    // No language requirement — assume adherence
    return 1.0;
  }

  // Build a sample from objectives and first activity
  let sample = '';

  if (Array.isArray(output.objectives)) {
    sample += (output.objectives as string[]).join(' ');
  }

  const activities = output.activities as Array<{ description?: string }> | undefined;
  if (Array.isArray(activities) && activities.length > 0 && activities[0].description) {
    sample += ' ' + activities[0].description;
  }

  sample = sample.trim().slice(0, 200);

  if (!sample) {
    return 0;
  }

  const result = await ai.generate({
    model: 'googleai/gemini-2.0-flash',
    prompt: `You are a language identification expert.

Identify the primary language of the following text sample:
"${sample}"

The expected language is: ${requestedLanguage}

Return ONLY a JSON object: { "detectedLanguage": "<language name>", "matches": <true or false>, "confidence": <number 0-1> }
Set "matches" to true if the detected language matches "${requestedLanguage}" (be lenient with variant names like "Hindi" vs "हिन्दी").`,
    config: { temperature: 0.1, responseMimeType: 'application/json' },
  });

  try {
    const parsed = JSON.parse(result.text);
    if (parsed.matches === true) {
      return typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 1.0;
    }
    return 0;
  } catch {
    return 0.5;
  }
}

// ── Evaluator Definition ─────────────────────────────────────────────────────

export const lessonPlanAlignmentEvaluator = ai.defineEvaluator(
  {
    name: 'lessonPlan/alignment',
    displayName: 'Lesson Plan Alignment',
    definition:
      'Evaluates lesson plan quality across NCERT alignment, 5E structure coverage, and language adherence.',
    isBilled: true,
  },
  async (datapoint) => {
    const output =
      typeof datapoint.output === 'string'
        ? JSON.parse(datapoint.output)
        : (datapoint.output as Record<string, unknown>);

    const reference = (datapoint.reference ?? {}) as Record<string, unknown>;
    const input = (datapoint.input ?? {}) as Record<string, unknown>;

    // Extract reference learning outcomes (from eval dataset)
    const learningOutcomes = Array.isArray(reference.learningOutcomes)
      ? (reference.learningOutcomes as string[])
      : [];

    // Extract requested language from input
    const requestedLanguage =
      typeof input.language === 'string'
        ? input.language
        : typeof output.language === 'string'
          ? (output.language as string)
          : undefined;

    // 1. NCERT Alignment (LLM judge)
    const ncertAlignment = await judgeNcertAlignment(output, learningOutcomes);

    // 2. 5E Structure (heuristic)
    const fiveEStructure = computeFiveEScore(output);

    // 3. Language Adherence (LLM judge)
    const languageAdherence = await judgeLanguageAdherence(output, requestedLanguage);

    // Composite
    const composite =
      Math.round(
        (ncertAlignment * 0.4 + fiveEStructure * 0.3 + languageAdherence * 0.3) * 1000,
      ) / 1000;

    return {
      testCaseId: datapoint.testCaseId,
      evaluation: [
        { id: 'ncertAlignment', score: ncertAlignment },
        { id: 'fiveEStructure', score: fiveEStructure },
        { id: 'languageAdherence', score: languageAdherence },
        {
          id: 'composite',
          score: composite,
          details: {
            reasoning: JSON.stringify({
              ncertAlignment,
              fiveEStructure,
              languageAdherence,
            }),
          },
        },
      ],
    };
  },
);
