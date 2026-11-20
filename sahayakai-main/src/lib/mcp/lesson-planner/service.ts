import 'server-only';
import type { DispatchedLessonPlan, LessonPlanDispatchInput } from '@/lib/sidecar/lesson-plan-dispatch';
import { DIFFICULTY_ALIASES, LESSON_PHASES, type CreateLessonPlanInput, type LessonPlanResult } from './schema';

/**
 * Adapter between the public MCP contract and Sahayak's EXISTING lesson-plan
 * service (`dispatchLessonPlan`: Genkit flow or ADK sidecar, behind the same
 * safety check, cache and feature flags the web app uses). No new AI logic.
 *
 * External callers are not Sahayak teachers, so the service runs as its
 * existing headless caller (`anonymous_user`): it skips the per-teacher rate
 * limit, profile/locality lookups, usage tracking and — importantly — never
 * writes into any teacher's My Library. Per-API-key rate limiting, tenancy
 * and logging are done by the MCP layer instead.
 */

/** The service's built-in identity for callers with no teacher account. */
export const HEADLESS_SERVICE_CALLER = 'anonymous_user';

export type LessonPlanDispatcher = (input: LessonPlanDispatchInput) => Promise<DispatchedLessonPlan>;

/** "easy" / "medium" / "hard" → the service's remedial / standard / advanced. */
export function canonicalDifficulty(d: CreateLessonPlanInput['difficulty']): 'remedial' | 'standard' | 'advanced' {
    return d in DIFFICULTY_ALIASES ? DIFFICULTY_ALIASES[d as keyof typeof DIFFICULTY_ALIASES] : (d as 'remedial' | 'standard' | 'advanced');
}

export function toDispatchInput(input: CreateLessonPlanInput): LessonPlanDispatchInput {
    return {
        userId: HEADLESS_SERVICE_CALLER,
        topic: input.topic,
        gradeLevels: [`Class ${input.grade}`],
        language: input.language,
        resourceLevel: input.classroom_resources,
        difficultyLevel: canonicalDifficulty(input.difficulty),
        useRuralContext: input.use_local_context,
        ...(input.subject ? { subject: input.subject } : {}),
        ...(input.ncert_chapter
            ? {
                ncertChapter: {
                    number: input.ncert_chapter.number,
                    title: input.ncert_chapter.title,
                    learningOutcomes: input.ncert_chapter.learning_outcomes,
                    ...(input.subject ? { subject: input.subject } : {}),
                },
            }
            : {}),
    };
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const list = (v: unknown): string[] => (Array.isArray(v) ? v.map(text).filter((s): s is string => s !== null) : []);

/**
 * Map the service result to the public shape. Only lesson content is copied;
 * internal fields (`source`, `decision`, sidecar telemetry, cache metadata,
 * storage ids) are dropped by construction.
 */
export function toLessonPlanResult(plan: DispatchedLessonPlan, input: CreateLessonPlanInput): LessonPlanResult {
    const activities = (Array.isArray(plan.activities) ? plan.activities : [])
        .filter((a) => a && (LESSON_PHASES as readonly string[]).includes(a.phase))
        .map((a) => ({
            phase: a.phase,
            name: text(a.name) ?? a.phase,
            description: text(a.description) ?? '',
            duration: text(a.duration) ?? '',
            teacher_tips: text(a.teacherTips),
            understanding_check: text(a.understandingCheck),
        }));
    const vocabulary = (Array.isArray(plan.keyVocabulary) ? plan.keyVocabulary : [])
        .map((v) => ({ term: text(v?.term), meaning: text(v?.meaning) }))
        .filter((v): v is { term: string; meaning: string } => v.term !== null && v.meaning !== null);

    return {
        title: text(plan.title) ?? input.topic,
        grade: input.grade,
        subject: text(plan.subject) ?? input.subject ?? null,
        language: text(plan.language) ?? input.language,
        duration: text(plan.duration),
        learning_objectives: list(plan.objectives),
        key_vocabulary: vocabulary,
        materials: list(plan.materials),
        activities,
        assessment: text(plan.assessment),
        homework: text(plan.homework),
        // Only meaningful when the caller asked for NCERT alignment; the service also
        // checks free topics against chapter titles, which is noise for an API caller.
        curriculum_note: input.ncert_chapter && plan.validationWarning?.invalid ? text(plan.validationWarning.message) : null,
    };
}

/** Compact human-readable rendering for clients that only read `content`. */
export function renderLessonPlanText(plan: LessonPlanResult): string {
    const lines = [
        `# ${plan.title} (Class ${plan.grade}${plan.subject ? `, ${plan.subject}` : ''}${plan.duration ? `, ${plan.duration}` : ''})`,
        '',
        '## Learning objectives',
        ...plan.learning_objectives.map((o) => `- ${o}`),
    ];
    if (plan.materials.length) lines.push('', '## Materials', ...plan.materials.map((m) => `- ${m}`));
    lines.push('', '## Teaching sequence');
    for (const a of plan.activities) {
        lines.push(`### ${a.phase}: ${a.name}${a.duration ? ` (${a.duration})` : ''}`, a.description);
        if (a.understanding_check) lines.push(`Check: ${a.understanding_check}`);
    }
    if (plan.assessment) lines.push('', '## Assessment', plan.assessment);
    if (plan.homework) lines.push('', '## Homework', plan.homework);
    if (plan.curriculum_note) lines.push('', `Note: ${plan.curriculum_note}`);
    return lines.join('\n');
}
