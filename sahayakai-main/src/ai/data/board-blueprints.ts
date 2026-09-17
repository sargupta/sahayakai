/**
 * Board Exam Paper Blueprints
 *
 * Defines the exact section structure, marks distribution, and question types
 * for CBSE, ICSE, and state board exam papers.
 *
 * Source: CBSE official sample papers and blueprint guidelines
 * https://cbseacademic.nic.in/SQP_CLASSXII_2024-25.html
 */

import { StructuredLogger } from '@/lib/logger/structured-logger';

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
    /**
     * When two entries share the same section name (e.g. Section A has both
     * MCQ and Assertion-Reason sub-blocks), set subsectionOf to the parent
     * name so renderers can group them under a single section header.
     */
    subsectionOf?: string;
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
            subsectionOf: 'Section A',
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
    // Weightages scaled to sum to maxMarks (80) per CBSE curriculum distribution
    chapterWeightage: {
        'Real Numbers': 5,
        'Polynomials': 6,
        'Pair of Linear Equations in Two Variables': 7,
        'Quadratic Equations': 6,
        'Arithmetic Progressions': 6,
        'Triangles': 8,
        'Coordinate Geometry': 6,
        'Introduction to Trigonometry': 7,
        'Some Applications of Trigonometry': 5,
        'Circles': 5,
        'Areas Related to Circles': 4,
        'Surface Areas and Volumes': 6,
        'Statistics': 5,
        'Probability': 4,
    },
};

export const CBSE_CLASS10_SCIENCE: ExamBlueprint = {
    board: 'CBSE',
    gradeLevel: 'Class 10',
    subject: 'Science',
    duration: 180,
    maxMarks: 70,
    generalInstructions: [
        'This question paper contains 36 questions. All questions are compulsory.',
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
    // Weightages scaled to sum to maxMarks (70) per CBSE curriculum distribution
    chapterWeightage: {
        'Chemical Reactions and Equations': 6,
        'Acids, Bases and Salts': 6,
        'Metals and Non-metals': 6,
        'Carbon and its Compounds': 6,
        'Life Processes': 7,
        'Control and Coordination': 6,
        'How do Organisms Reproduce?': 6,
        'Heredity': 4,
        'Light — Reflection and Refraction': 7,
        'The Human Eye and the Colourful World': 4,
        'Electricity': 6,
        'Magnetic Effects of Electric Current': 4,
        'Our Environment': 2,
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
        { name: 'Section A', label: 'Assertion-Reason', questionType: { type: 'assertion_reason', marksPerQuestion: 1, internalChoice: false }, questionCount: 2, totalMarks: 2, subsectionOf: 'Section A' },
        { name: 'Section B', label: 'VSA (2 marks)', questionType: { type: 'very_short', marksPerQuestion: 2, internalChoice: true }, questionCount: 5, totalMarks: 10 },
        { name: 'Section C', label: 'SA (3 marks)', questionType: { type: 'short', marksPerQuestion: 3, internalChoice: true }, questionCount: 6, totalMarks: 18 },
        { name: 'Section D', label: 'LA (5 marks)', questionType: { type: 'long', marksPerQuestion: 5, internalChoice: true }, questionCount: 4, totalMarks: 20 },
        { name: 'Section E', label: 'Case Study (4 marks)', questionType: { type: 'case_study', marksPerQuestion: 4, internalChoice: true }, questionCount: 3, totalMarks: 12 },
    ],
    // Weightages scaled to sum to maxMarks (80) per CBSE curriculum distribution
    chapterWeightage: {
        'Number Systems': 7,
        'Polynomials': 6,
        'Coordinate Geometry': 6,
        'Linear Equations in Two Variables': 7,
        'Introduction to Euclid\'s Geometry': 6,
        'Lines and Angles': 6,
        'Triangles': 8,
        'Quadrilaterals': 7,
        'Circles': 6,
        'Heron\'s Formula': 5,
        'Surface Areas and Volumes': 6,
        'Statistics': 5,
        'Probability': 5,
    },
};

export const CBSE_CLASS9_SCIENCE: ExamBlueprint = {
    board: 'CBSE',
    gradeLevel: 'Class 9',
    subject: 'Science',
    duration: 180,
    maxMarks: 70,
    generalInstructions: [
        'This question paper contains 36 questions. All questions are compulsory.',
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
    // Weightages scaled to sum to maxMarks (70) per CBSE curriculum distribution
    chapterWeightage: {
        'Matter in Our Surroundings': 6,
        'Is Matter Around Us Pure': 6,
        'Atoms and Molecules': 6,
        'Structure of the Atom': 6,
        'The Fundamental Unit of Life': 6,
        'Tissues': 4,
        'Motion': 7,
        'Force and Laws of Motion': 7,
        'Gravitation': 6,
        'Work and Energy': 6,
        'Sound': 4,
        'Improvement in Food Resources': 4,
        'Natural Resources': 2,
    },
};

// ═══════════════════════════════════════════════════════════
// BLUEPRINT LOOKUP
// ═══════════════════════════════════════════════════════════

// Bundled blueprints — the fallback when Firestore is empty/unavailable.
const ALL_BLUEPRINTS: ExamBlueprint[] = [
    CBSE_CLASS10_MATH,
    CBSE_CLASS10_SCIENCE,
    CBSE_CLASS9_MATH,
    CBSE_CLASS9_SCIENCE,
];

/**
 * Firestore doc id for a blueprint: normalized {board}_{gradeLevel}_{subject}
 * (lowercased, spaces → hyphens), e.g. `cbse_class-10_science`.
 * Shared with src/scripts/seed-blueprints.ts so seed and lookup can't drift.
 */
export function blueprintDocId(board: string, gradeLevel: string, subject: string): string {
    const n = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-');
    return `${n(board)}_${n(gradeLevel)}_${n(subject)}`;
}

// ─── In-memory cache (server-side, 5-min TTL) — mirrors feature-flags.ts ──────
const BLUEPRINT_CACHE_TTL_MS = 5 * 60 * 1000;
let cachedBlueprints: Map<string, ExamBlueprint> | null = null;
let blueprintCacheTimestamp = 0;
let blueprintFetchPromise: Promise<Map<string, ExamBlueprint>> | null = null;

function fallbackMap(): Map<string, ExamBlueprint> {
    const map = new Map<string, ExamBlueprint>();
    for (const bp of ALL_BLUEPRINTS) {
        map.set(blueprintDocId(bp.board, bp.gradeLevel, bp.subject), bp);
    }
    return map;
}

/**
 * Load the `exam_blueprints` collection into a docId→blueprint Map, cached for
 * 5 min with single-in-flight dedup. On Firestore error/empty, falls back to the
 * bundled TS constants so lookups never hard-fail.
 */
async function loadBlueprints(): Promise<Map<string, ExamBlueprint>> {
    const now = Date.now();
    if (cachedBlueprints && now - blueprintCacheTimestamp < BLUEPRINT_CACHE_TTL_MS) {
        return cachedBlueprints;
    }
    if (blueprintFetchPromise) return blueprintFetchPromise;

    blueprintFetchPromise = (async () => {
        try {
            const { getDb } = await import('@/lib/firebase-admin');
            const db = await getDb();
            const snap = await db.collection('exam_blueprints').get();
            const map = new Map<string, ExamBlueprint>();
            for (const doc of snap.docs) {
                map.set(doc.id, doc.data() as ExamBlueprint);
            }
            if (map.size === 0) {
                StructuredLogger.warn('[Blueprints] exam_blueprints empty — using TS-constant fallback', {
                    service: 'board-blueprints',
                    operation: 'loadBlueprints',
                });
                cachedBlueprints = fallbackMap();
            } else {
                cachedBlueprints = map;
            }
            blueprintCacheTimestamp = Date.now();
            return cachedBlueprints;
        } catch (err) {
            StructuredLogger.error('[Blueprints] Failed to read exam_blueprints', {
                service: 'board-blueprints',
                operation: 'loadBlueprints',
            }, err instanceof Error ? err : new Error(String(err)));
            if (cachedBlueprints) return cachedBlueprints; // stale beats nothing
            return fallbackMap(); // not cached — retry next call
        } finally {
            blueprintFetchPromise = null;
        }
    })();

    return blueprintFetchPromise;
}

/**
 * Find a blueprint by board, grade, and subject (Firestore-first, cached).
 * Returns undefined if no match exists in Firestore or the bundled fallback.
 */
export async function findBlueprint(board: string, gradeLevel: string, subject: string): Promise<ExamBlueprint | undefined> {
    const map = await loadBlueprints();
    const hit = map.get(blueprintDocId(board, gradeLevel, subject));
    if (hit) return hit;
    // Per-key fallback: DB may hold some blueprints but not this one.
    const norm = (s: string) => s.trim().toLowerCase();
    return ALL_BLUEPRINTS.find(
        bp =>
            norm(bp.board) === norm(board) &&
            norm(bp.gradeLevel) === norm(gradeLevel) &&
            norm(bp.subject) === norm(subject)
    );
}

/** All blueprints (full objects), Firestore-first + cached. For the API route. */
export async function getAllBlueprints(): Promise<ExamBlueprint[]> {
    const map = await loadBlueprints();
    return [...map.values()];
}

/** Get the bundled blueprint combinations synchronously for UI consumers. */
export function getAvailableBlueprints(): { board: string; gradeLevel: string; subject: string }[] {
    return ALL_BLUEPRINTS.map(bp => ({
        board: bp.board,
        gradeLevel: bp.gradeLevel,
        subject: bp.subject,
    }));
}
