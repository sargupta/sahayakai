import type { BLOOMS_LEVELS, CreateQuizInput, QUIZ_QUESTION_TYPES } from '@/lib/mcp/quiz/schema';

export type QuizDifficultyChoice = 'easy' | 'medium' | 'hard' | 'all';

export interface QuizFormValues {
    topic: string;
    grade: number;
    subject: string;
    numQuestions: number;
    difficulty: QuizDifficultyChoice;
    questionTypes: Array<typeof QUIZ_QUESTION_TYPES[number]>;
    bloomsLevels: Array<typeof BLOOMS_LEVELS[number]>;
    language: string;
}

/** Visible form → `create_quiz` arguments. "all" omits `difficulty`, which returns easy, medium and hard. */
export function toMcpArguments(values: QuizFormValues): CreateQuizInput {
    const subject = values.subject.trim();
    return {
        topic: values.topic.trim(),
        grade: values.grade,
        ...(subject ? { subject } : {}),
        num_questions: values.numQuestions,
        question_types: values.questionTypes,
        ...(values.difficulty !== 'all' ? { difficulty: values.difficulty } : {}),
        blooms_levels: values.bloomsLevels,
        language: values.language as CreateQuizInput['language'],
    };
}
