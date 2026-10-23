import 'server-only';
import type { McpCapabilityDefinition } from '../http-handler';
import { CreateQuizInput, QuizResult } from './schema';
import { createQuiz, renderQuizText, type QuizServiceDeps } from './service';

/**
 * Sahayak Quiz Generator — public MCP capability #3.
 * Scope: `quiz`. One tool: `create_quiz`.
 */
export const QUIZ_VERSION = '1.0.0';

export const CREATE_QUIZ_DESCRIPTION =
    'Creates a short classroom quiz for Indian schools (Class 1–12) on one topic: multiple-choice, true/false, ' +
    'fill-in-the-blank and short-answer questions, each with the correct answer and a student-friendly explanation, ' +
    'plus tips for running it in a chalk-and-board classroom. Returns one difficulty level, or easy, medium and hard ' +
    'versions of the same quiz for differentiated teaching. Use it for a quick check of understanding or practice — ' +
    'not for a full board-pattern exam paper or a lesson plan. Usually 15–40 seconds; nothing is saved on Sahayak.';

export function quizCapability(deps: QuizServiceDeps): McpCapabilityDefinition {
    return {
        scope: 'quiz',
        serverInfo: { name: 'sahayak-quiz', title: 'Sahayak Quiz Generator', version: QUIZ_VERSION },
        instructions:
            'Sahayak Quiz Generator creates short, grade-appropriate quizzes with answers and explanations for Indian ' +
            'classrooms (Class 1–12, 11 languages). Call create_quiz once per topic; it returns the quiz as structured data.',
        register(server, ctx) {
            server.registerTool(
                'create_quiz',
                {
                    title: 'Create quiz',
                    description: CREATE_QUIZ_DESCRIPTION,
                    inputSchema: CreateQuizInput,
                    outputSchema: QuizResult,
                    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: false },
                },
                async (args) => ctx.run(
                    'create_quiz',
                    () => createQuiz(args as CreateQuizInput, deps),
                    renderQuizText,
                ),
            );
        },
    };
}
