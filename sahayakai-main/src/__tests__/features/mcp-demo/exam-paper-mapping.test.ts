import { toMcpArguments } from '@/features/mcp-demo/exam-paper/mapping';

describe('Exam Paper MCP demo form mapping', () => {
    it('maps the visible form fields onto the real create_exam_paper arguments', () => {
        expect(toMcpArguments({
            board: 'CBSE',
            grade: 8,
            subject: 'Science',
            chaptersText: 'Friction, Force and Pressure',
            difficulty: 'medium',
            language: 'English',
            maxMarks: 20,
            durationMinutes: 45,
            pyqPercent: '25',
            includeAnswerKey: true,
            includeMarkingScheme: false,
        })).toEqual({
            board: 'CBSE',
            grade: 8,
            subject: 'Science',
            chapters: ['Friction', 'Force and Pressure'],
            difficulty: 'medium',
            language: 'English',
            max_marks: 20,
            duration_minutes: 45,
            pyq_percent: 25,
            include_answer_key: true,
            include_marking_scheme: false,
        });
    });
});
