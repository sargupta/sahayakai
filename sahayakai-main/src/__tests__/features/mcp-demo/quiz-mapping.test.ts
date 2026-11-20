import { toMcpArguments, type QuizFormValues } from '@/features/mcp-demo/quiz/mapping';
import { CreateQuizInput } from '@/lib/mcp/quiz/schema';

const BASE: QuizFormValues = {
    topic: '  Fractions ', grade: 7, subject: ' Mathematics ', numQuestions: 5, difficulty: 'medium',
    questionTypes: ['multiple_choice'], bloomsLevels: ['Remember', 'Apply'], language: 'Hindi',
};

describe('Quiz MCP demo form mapping', () => {
    it('maps the visible form fields onto valid create_quiz arguments', () => {
        const args = toMcpArguments(BASE);
        expect(args).toEqual({
            topic: 'Fractions', grade: 7, subject: 'Mathematics', num_questions: 5,
            question_types: ['multiple_choice'], difficulty: 'medium', blooms_levels: ['Remember', 'Apply'], language: 'Hindi',
        });
        expect(CreateQuizInput.safeParse(args).success).toBe(true);
    });

    it('"all" levels omits difficulty and an empty subject is left out', () => {
        const args = toMcpArguments({ ...BASE, difficulty: 'all', subject: '  ' });
        expect(args).not.toHaveProperty('difficulty');
        expect(args).not.toHaveProperty('subject');
        expect(CreateQuizInput.safeParse(args).success).toBe(true);
    });
});
