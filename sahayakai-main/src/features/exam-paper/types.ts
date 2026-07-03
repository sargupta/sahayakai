// ── Types for the generated board exam paper ─────────────────────────────
// Moved verbatim from src/app/exam-paper/page.tsx during the
// generator-spine migration.

export interface GeneratedQuestion {
    // Flow returns `number`, not `questionNumber`
    number?: number;
    questionNumber?: number;
    text: string;
    options?: string[];
    marks: number;
    // Flow embeds answer per-question as `answerKey` (string), not `answer`
    answerKey?: string;
    answer?: string;
    markingScheme?: string;
    internalChoice?: string;
    source?: string;
}

export interface GeneratedSection {
    name: string;
    label: string;
    instructions?: string;
    questions: GeneratedQuestion[];
    totalMarks: number;
}

export interface GeneratedPaper {
    title: string;
    board: string;
    gradeLevel: string;
    subject: string;
    duration: string | number; // Flow returns string e.g. "3 Hours"
    maxMarks: number;
    generalInstructions: string[];
    sections: GeneratedSection[];
    answerKey?: GeneratedQuestion[]; // Not in flow output — derived from sections
    blueprintSummary?:
        | {
              chapterWise: { chapter: string; marks: number }[];
              difficultyWise: { level: string; percentage: number }[];
          }
        | string;
}

/** The plain-state form values the exam-paper tool submits. */
export interface ExamPaperFormValues {
    board: string;
    gradeLevel: string;
    subject: string;
    chapters: string[];
    difficulty: string;
    language: string;
    includeAnswerKey: boolean;
    includeMarkingScheme: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────

export const GRADE_OPTIONS = ["Class 9", "Class 10"] as const;
export const DIFFICULTY_OPTIONS = ["easy", "moderate", "hard", "mixed"] as const;
