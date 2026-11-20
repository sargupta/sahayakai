import 'server-only';
import type { QuizGeneratorOutput } from '@/ai/schemas/quiz-generator-schemas';
import type { DispatchedQuiz, QuizDispatchInput } from '@/lib/sidecar/quiz-dispatch';
import { McpCapabilityError } from '../errors';
import { gradeLabel } from '../shared/schema';
import { QUIZ_DIFFICULTIES, QUIZ_QUESTION_TYPES, type CreateQuizInput, type QuizResult } from './schema';

/**
 * Adapter between the public MCP contract and Sahayak's EXISTING quiz
 * service (`dispatchQuiz` → `generateQuiz`: grade-aware defaults, grade-band
 * vocabulary control, NCERT topic check, three difficulty variants generated
 * in parallel, output sanitising/validation, Genkit / ADK sidecar). No new AI
 * logic.
 *
 * Headless caller: the quiz service treats an EMPTY userId as "no teacher" —
 * the profile read, teacher context, usage metering, per-teacher rate limit
 * and the Storage + Library writes are all behind `if (userId)`.
 *
 * Safety: the service runs Sahayak's topic policy (`validateTopicSafety`) only
 * on its sidecar path, so the adapter runs the same policy up front for every
 * MCP call, matching the Lesson Planner and Exam Paper MCPs.
 */
export const HEADLESS_QUIZ_CALLER = '';

export interface QuizServiceDeps {
    dispatch: (input: QuizDispatchInput) => Promise<DispatchedQuiz>;
    /** Sahayak's topic safety policy (`validateTopicSafety` from '@/lib/safety'). */
    checkTopicSafety: (text: string) => { safe: boolean; reason?: string };
}

export function toDispatchInput(input: CreateQuizInput): QuizDispatchInput {
    return {
        userId: HEADLESS_QUIZ_CALLER,
        topic: input.topic,
        gradeLevel: gradeLabel(input.grade),
        language: input.language,
        questionTypes: input.question_types,
        bloomsTaxonomyLevels: input.blooms_levels,
        // The service applies its grade-band default only when numQuestions is undefined.
        numQuestions: input.num_questions as number,
        ...(input.subject ? { subject: input.subject } : {}),
    };
}

/** Run the existing service. */
export async function createQuiz(input: CreateQuizInput, deps: QuizServiceDeps): Promise<QuizResult> {
    const safety = deps.checkTopicSafety([input.topic, input.subject].filter(Boolean).join(' \n'));
    if (!safety.safe) throw new Error(`Safety Violation: ${safety.reason ?? 'Content Policy Violation'}`);

    let quiz: DispatchedQuiz;
    try {
        quiz = await deps.dispatch(toDispatchInput(input));
    } catch (err) {
        const name = (err as { name?: string } | null)?.name;
        const message = err instanceof Error ? err.message : '';
        if (name === 'WithTimeoutError') {
            throw new McpCapabilityError('timeout', 'The quiz took longer than Sahayak\'s generation budget (about 60 seconds). Retry; fewer questions generate faster.');
        }
        if (name === 'SchemaValidationError' || /failed to generate any valid quiz variants/i.test(message)) {
            throw new McpCapabilityError('generation_failed', 'Sahayak could not produce a well-formed quiz for this topic. Retry, or rephrase the topic.');
        }
        throw err; // safety, rate-limit, provider errors → shared classifier
    }
    return toQuizResult(quiz, input);
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

function toQuestions(variant: QuizGeneratorOutput) {
    return (Array.isArray(variant.questions) ? variant.questions : [])
        .filter((q) => q && text(q.questionText) && text(q.correctAnswer))
        .map((q, i) => ({
            number: i + 1,
            type: (QUIZ_QUESTION_TYPES as readonly string[]).includes(q.questionType) ? q.questionType : 'short_answer' as const,
            question: text(q.questionText)!,
            options: Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === 'string' && o.trim() !== '').map((o) => o.trim()) : [],
            correct_answer: text(q.correctAnswer)!,
            explanation: text(q.explanation) ?? '',
        }));
}

/**
 * Map the service result to the public shape. Only quiz content is copied;
 * internal fields (dispatch source/decision, sidecar telemetry, content id,
 * isSaved) are dropped by construction.
 */
export function toQuizResult(quiz: DispatchedQuiz, input: CreateQuizInput): QuizResult {
    const wanted = input.difficulty ? [input.difficulty] : [...QUIZ_DIFFICULTIES];
    const notes: string[] = [];
    const quizzes: QuizResult['quizzes'] = [];

    for (const difficulty of wanted) {
        const variant = quiz[difficulty];
        const questions = variant ? toQuestions(variant) : [];
        if (!variant || questions.length === 0) {
            notes.push(`The ${difficulty} quiz could not be generated; call again to retry it.`);
            continue;
        }
        if (input.num_questions !== undefined && questions.length !== input.num_questions) {
            notes.push(`The ${difficulty} quiz has ${questions.length} question${questions.length === 1 ? '' : 's'}, not the requested ${input.num_questions}.`);
        }
        quizzes.push({
            difficulty,
            title: text(variant.title) ?? `${input.topic} quiz`,
            teacher_instructions: text(variant.teacherInstructions),
            questions,
        });
    }
    if (quizzes.length === 0) {
        throw new McpCapabilityError('generation_failed', 'Sahayak could not produce a well-formed quiz for this topic. Retry, or rephrase the topic.');
    }

    const warning = quiz.validationWarning;
    if (warning?.invalid && warning.autoCorrectTo?.title) {
        notes.push(`"${input.topic}" was matched to the NCERT Class ${input.grade} chapter "${warning.autoCorrectTo.title}"; the quiz covers that chapter.`);
    }

    return {
        topic: input.topic,
        grade: input.grade,
        subject: text(input.subject) ?? text(quiz.subject),
        language: input.language,
        quizzes,
        review_notes: notes,
    };
}

/** Compact Markdown rendering (questions only, no answers) for clients that only read `content`. */
export function renderQuizText(result: QuizResult): string {
    const lines: string[] = [];
    for (const q of result.quizzes) {
        lines.push(`# ${q.title} (${q.difficulty}, Class ${result.grade}${result.subject ? `, ${result.subject}` : ''})`);
        for (const item of q.questions) {
            lines.push(`${item.number}. ${item.question}`);
            for (const o of item.options) lines.push(`   ${o}`);
        }
        lines.push('');
    }
    if (result.review_notes.length) lines.push('## Review notes', ...result.review_notes.map((n) => `- ${n}`));
    return lines.join('\n').trim();
}
