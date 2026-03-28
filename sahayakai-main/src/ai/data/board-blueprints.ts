/**
 * Board Exam Paper Blueprints
 *
 * Defines the exact section structure, marks distribution, and question types
 * for CBSE, ICSE, and state board exam papers.
 *
 * Source: CBSE official sample papers and blueprint guidelines
 * https://cbseacademic.nic.in/SQP_CLASSXII_2024-25.html
 */

export interface QuestionTypeSpec {
    type: 'mcq' | 'very_short' | 'short' | 'long' | 'case_study' | 'assertion_reason' | 'map_based' | 'source_based';
    marksPerQuestion: number;
    internalChoice: boolean;  // Does the student get OR alternatives?
}

export interface SectionBlueprint {
    name: string;           // "Section A"
    label: string;          // "Multiple Choice Questions"
    questionType: QuestionTypeSpec;
    questionCount: number;
    totalMarks: number;
    instructions?: string;
}

export interface ExamBlueprint {
    board: string;
    gradeLevel: string;
    subject: string;
    duration: number;       // minutes
    maxMarks: number;
    generalInstructions: string[];
    sections: SectionBlueprint[];
    chapterWeightage?: Record<string, number>;  // chapter → marks allocation
}

// ═══════════════════════════════════════════════════════════
// CBSE CLASS 10 BLUEPRINTS (2024-25 pattern)
// ═══════════════════════════════════════════════════════════

export const CBSE_CLASS10_MATH: ExamBlueprint = {
    board: 'CBSE',
    gradeLevel: 'Class 10',
    subject: 'Mathematics',
    duration: 180,
    maxMarks: 80,
    generalInstructions: [
        'This question paper contains 38 questions. All questions are compulsory.',
        'This question paper is divided into FIVE sections — A, B, C, D and E.',
        'In Section A, Questions 1 to 18 are Multiple Choice Questions (MCQs) and Questions 19 & 20 are Assertion-Reason based questions of 1 mark each.',
        'In Section B, Questions 21 to 25 are Very Short Answer (VSA) type questions, carrying 2 marks each.',
        'In Section C, Questions 26 to 31 are Short Answer (SA) type questions, carrying 3 marks each.',
        'In Section D, Questions 32 to 35 are Long Answer (LA) type questions, carrying 5 marks each.',
        'In Section E, Questions 36 to 38 are Case Study based questions, carrying 4 marks each.',
        'There is no overall choice. However, internal choice has been provided in some questions.',
        'Draw neat figures wherever required. Take π = 22/7 wherever required, if not stated.',
        'Use of calculators is NOT allowed.',
    ],
    sections: [
        {
            name: 'Section A',
            label: 'Multiple Choice Questions',
            questionType: { type: 'mcq', marksPerQuestion: 1, internalChoice: false },
            questionCount: 18,
            totalMarks: 18,
        },
        {
            name: 'Section A',
            label: 'Assertion-Reason Questions',
            questionType: { type: 'assertion_reason', marksPerQuestion: 1, internalChoice: false },
            questionCount: 2,
            totalMarks: 2,
        },
        {
            name: 'Section B',
            label: 'Very Short Answer Questions',
            questionType: { type: 'very_short', marksPerQuestion: 2, internalChoice: true },
            questionCount: 5,
            totalMarks: 10,
        },
        {
            name: 'Section C',
            label: 'Short Answer Questions',
            questionType: { type: 'short', marksPerQuestion: 3, internalChoice: true },
            questionCount: 6,
            totalMarks: 18,
        },
        {
            name: 'Section D',
            label: 'Long Answer Questions',
            questionType: { type: 'long', marksPerQuestion: 5, internalChoice: true },
            questionCount: 4,
            totalMarks: 20,
        },
        {
            name: 'Section E',
            label: 'Case Study Based Questions',
            questionType: { type: 'case_study', marksPerQuestion: 4, internalChoice: true },
            questionCount: 3,
            totalMarks: 12,
        },
    ],
    chapterWeightage: {
        'Real Numbers': 6,
        'Polynomials': 7,
        'Pair of Linear Equations in Two Variables': 8,
        'Quadratic Equations': 7,
        'Arithmetic Progressions': 7,
        'Triangles': 9,
        'Coordinate Geometry': 7,
        'Introduction to Trigonometry': 7,
        'Some Applications of Trigonometry': 5,
        'Circles': 5,
        'Areas Related to Circles': 5,
        'Surface Areas and Volumes': 7,
        'Statistics': 5,
        'Probability': 5,
    },
};

export const CBSE_CLASS10_SCIENCE: ExamBlueprint = {
    board: 'CBSE',
    gradeLevel: 'Class 10',
    subject: 'Science',
    duration: 180,
    maxMarks: 80,
    generalInstructions: [
        'This question paper contains 39 questions. All questions are compulsory.',
        'This question paper is divided into FIVE sections — A, B, C, D and E.',
        'In Section A, Questions 1 to 20 are MCQs of 1 mark each.',
        'In Section B, Questions 21 to 25 are Very Short Answer (VSA) type questions, carrying 2 marks each.',
        'In Section C, Questions 26 to 31 are Short Answer (SA) type questions, carrying 3 marks each.',
        'In Section D, Questions 32 to 33 are Long Answer (LA) type questions, carrying 5 marks each.',
        'In Section E, Questions 34 to 36 are Case Study / Source based questions with sub parts, carrying 4 marks each.',
        'There is no overall choice. However, internal choice has been provided in some questions.',
        'Use of calculators is NOT allowed.',
    ],
    sections: [
        {
            name: 'Section A',
            label: 'Multiple Choice Questions',
            questionType: { type: 'mcq', marksPerQuestion: 1, internalChoice: false },
            questionCount: 20,
            totalMarks: 20,
        },
        {
            name: 'Section B',
            label: 'Very Short Answer Questions',
            questionType: { type: 'very_short', marksPerQuestion: 2, internalChoice: true },
            questionCount: 5,
            totalMarks: 10,
        },
        {
            name: 'Section C',
            label: 'Short Answer Questions',
            questionType: { type: 'short', marksPerQuestion: 3, internalChoice: true },
            questionCount: 6,
            totalMarks: 18,
        },
        {
            name: 'Section D',
            label: 'Long Answer Questions',
            questionType: { type: 'long', marksPerQuestion: 5, internalChoice: true },
            questionCount: 2,
            totalMarks: 10,
        },
        {
            name: 'Section E',
            label: 'Case Study Based Questions',
            questionType: { type: 'case_study', marksPerQuestion: 4, internalChoice: true },
            questionCount: 3,
            totalMarks: 12,
        },
    ],
    chapterWeightage: {
        'Chemical Reactions and Equations': 7,
        'Acids, Bases and Salts': 7,
        'Metals and Non-metals': 7,
        'Carbon and its Compounds': 7,
        'Life Processes': 7,
        'Control and Coordination': 7,
        'How do Organisms Reproduce?': 7,
        'Heredity': 5,
        'Light — Reflection and Refraction': 7,
        'The Human Eye and the Colourful World': 5,
        'Electricity': 7,
        'Magnetic Effects of Electric Current': 5,
        'Our Environment': 3,
    },
};

// ═══════════════════════════════════════════════════════════
// CBSE CLASS 9 BLUEPRINTS
// ═══════════════════════════════════════════════════════════

export const CBSE_CLASS9_MATH: ExamBlueprint = {
    board: 'CBSE',
    gradeLevel: 'Class 9',
    subject: 'Mathematics',
    duration: 180,
    maxMarks: 80,
    generalInstructions: [
        'This question paper contains 38 questions. All questions are compulsory.',
        'This question paper is divided into FIVE sections — A, B, C, D and E.',
        'In Section A, Questions 1 to 18 are MCQs and Questions 19 & 20 are Assertion-Reason type of 1 mark each.',
        'In Section B, Questions 21 to 25 are VSA type, carrying 2 marks each.',
        'In Section C, Questions 26 to 31 are SA type, carrying 3 marks each.',
        'In Section D, Questions 32 to 35 are LA type, carrying 5 marks each.',
        'In Section E, Questions 36 to 38 are Case Study based, carrying 4 marks each.',
        'Draw neat figures. Use of calculators is NOT allowed.',
    ],
    sections: [
        { name: 'Section A', label: 'MCQs', questionType: { type: 'mcq', marksPerQuestion: 1, internalChoice: false }, questionCount: 18, totalMarks: 18 },
        { name: 'Section A', label: 'Assertion-Reason', questionType: { type: 'assertion_reason', marksPerQuestion: 1, internalChoice: false }, questionCount: 2, totalMarks: 2 },
        { name: 'Section B', label: 'VSA (2 marks)', questionType: { type: 'very_short', marksPerQuestion: 2, internalChoice: true }, questionCount: 5, totalMarks: 10 },
        { name: 'Section C', label: 'SA (3 marks)', questionType: { type: 'short', marksPerQuestion: 3, internalChoice: true }, questionCount: 6, totalMarks: 18 },
        { name: 'Section D', label: 'LA (5 marks)', questionType: { type: 'long', marksPerQuestion: 5, internalChoice: true }, questionCount: 4, totalMarks: 20 },
        { name: 'Section E', label: 'Case Study (4 marks)', questionType: { type: 'case_study', marksPerQuestion: 4, internalChoice: true }, questionCount: 3, totalMarks: 12 },
    ],
    chapterWeightage: {
        'Number Systems': 8,
        'Polynomials': 7,
        'Coordinate Geometry': 6,
        'Linear Equations in Two Variables': 8,
        'Introduction to Euclid\'s Geometry': 6,
        'Lines and Angles': 6,
        'Triangles': 9,
        'Quadrilaterals': 8,
        'Circles': 7,
        'Heron\'s Formula': 5,
        'Surface Areas and Volumes': 7,
        'Statistics': 6,
        'Probability': 5,
    },
};

export const CBSE_CLASS9_SCIENCE: ExamBlueprint = {
    board: 'CBSE',
    gradeLevel: 'Class 9',
    subject: 'Science',
    duration: 180,
    maxMarks: 80,
    generalInstructions: [
        'This question paper contains 39 questions. All questions are compulsory.',
        'Divided into FIVE sections — A, B, C, D and E.',
        'Section A: MCQs (1 mark each). Section B: VSA (2 marks). Section C: SA (3 marks).',
        'Section D: LA (5 marks). Section E: Case Study (4 marks).',
        'Internal choice provided in some questions. No calculators.',
    ],
    sections: [
        { name: 'Section A', label: 'MCQs', questionType: { type: 'mcq', marksPerQuestion: 1, internalChoice: false }, questionCount: 20, totalMarks: 20 },
        { name: 'Section B', label: 'VSA (2 marks)', questionType: { type: 'very_short', marksPerQuestion: 2, internalChoice: true }, questionCount: 5, totalMarks: 10 },
        { name: 'Section C', label: 'SA (3 marks)', questionType: { type: 'short', marksPerQuestion: 3, internalChoice: true }, questionCount: 6, totalMarks: 18 },
        { name: 'Section D', label: 'LA (5 marks)', questionType: { type: 'long', marksPerQuestion: 5, internalChoice: true }, questionCount: 2, totalMarks: 10 },
        { name: 'Section E', label: 'Case Study (4 marks)', questionType: { type: 'case_study', marksPerQuestion: 4, internalChoice: true }, questionCount: 3, totalMarks: 12 },
    ],
    chapterWeightage: {
        'Matter in Our Surroundings': 7,
        'Is Matter Around Us Pure': 7,
        'Atoms and Molecules': 7,
        'Structure of the Atom': 7,
        'The Fundamental Unit of Life': 7,
        'Tissues': 5,
        'Motion': 7,
        'Force and Laws of Motion': 7,
        'Gravitation': 7,
        'Work and Energy': 7,
        'Sound': 5,
        'Improvement in Food Resources': 5,
        'Natural Resources': 3,
    },
};

// ═══════════════════════════════════════════════════════════
// BLUEPRINT LOOKUP
// ═══════════════════════════════════════════════════════════

const ALL_BLUEPRINTS: ExamBlueprint[] = [
    CBSE_CLASS10_MATH,
    CBSE_CLASS10_SCIENCE,
    CBSE_CLASS9_MATH,
    CBSE_CLASS9_SCIENCE,
];

/**
 * Find a blueprint by board, grade, and subject.
 * Returns undefined if no matching blueprint exists.
 */
export function findBlueprint(board: string, gradeLevel: string, subject: string): ExamBlueprint | undefined {
    return ALL_BLUEPRINTS.find(
        bp => bp.board === board && bp.gradeLevel === gradeLevel && bp.subject === subject
    );
}

/**
 * Get all available blueprint combinations for UI display.
 */
export function getAvailableBlueprints(): { board: string; gradeLevel: string; subject: string }[] {
    return ALL_BLUEPRINTS.map(bp => ({
        board: bp.board,
        gradeLevel: bp.gradeLevel,
        subject: bp.subject,
    }));
}
