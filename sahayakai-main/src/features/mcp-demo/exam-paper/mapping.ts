import type { CreateExamPaperInput } from '@/lib/mcp/exam-paper/schema';

export interface ExamPaperFormValues {
    board: string;
    grade: number;
    subject: string;
    chaptersText: string;
    difficulty: string;
    language: string;
    maxMarks: number;
    durationMinutes: number;
    pyqPercent: string;
    includeAnswerKey: boolean;
    includeMarkingScheme: boolean;
}

export function toMcpArguments(values: ExamPaperFormValues): CreateExamPaperInput {
    const chapters = values.chaptersText.split(',').map((chapter) => chapter.trim()).filter(Boolean);
    const pyqPercent = values.pyqPercent.trim() === '' ? undefined : Number(values.pyqPercent);
    return {
        board: values.board as CreateExamPaperInput['board'],
        grade: values.grade,
        subject: values.subject.trim(),
        chapters,
        difficulty: values.difficulty as CreateExamPaperInput['difficulty'],
        language: values.language as CreateExamPaperInput['language'],
        max_marks: values.maxMarks,
        duration_minutes: values.durationMinutes,
        ...(pyqPercent !== undefined ? { pyq_percent: pyqPercent } : {}),
        include_answer_key: values.includeAnswerKey,
        include_marking_scheme: values.includeMarkingScheme,
    };
}
