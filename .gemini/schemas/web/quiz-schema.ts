/**
 * Quiz Schema Definitions
 * 
 * Comprehensive schema for quiz generation with pedagogical rigor.
 * Supports multiple question types, distractor logic, and Bloom's taxonomy.
 * 
 * @author @LeadArchitect + @PedagogyLead
 * @version 1.0
 */

import { z } from 'zod';

// ============================================================================
// ENUMS & CONSTANTS
// ============================================================================

export const QuestionTypes = ['mcq', 'true-false', 'fill-blank', 'short-answer'] as const;
export type QuestionType = typeof QuestionTypes[number];

export const BloomsLevels = [
    'Remember',      // Recall facts
    'Understand',    // Explain concepts
    'Apply',         // Use knowledge in new situations
    'Analyze',       // Break down information
    'Evaluate',      // Make judgments
    'Create',        // Produce new ideas
] as const;
export type BloomsLevel = typeof BloomsLevels[number];

export const DifficultyLevels = ['easy', 'medium', 'hard'] as const;
export type DifficultyLevel = typeof DifficultyLevels[number];

// ============================================================================
// INPUT SCHEMA
// ============================================================================

export const QuizInputSchema = z.object({
    topic: z.string()
        .min(3, 'Topic must be at least 3 characters')
        .max(200, 'Topic too long')
        .describe('The topic/chapter to generate quiz questions for'),

    subject: z.string()
        .optional()
        .describe('Subject area (e.g., Science, Math, Social Science)'),

    gradeLevel: z.string()
        .describe('Target grade level (e.g., "7th Grade", "10th Grade")'),

    questionCount: z.number()
        .int()
        .min(1, 'Must have at least 1 question')
        .max(20, 'Maximum 20 questions per quiz')
        .default(5)
        .describe('Number of questions to generate'),

    difficulty: z.enum(DifficultyLevels)
        .default('medium')
        .describe('Overall difficulty level'),

    language: z.string()
        .default('English')
        .describe('Language for questions and answers'),

    includeImages: z.boolean()
        .default(false)
        .describe('Whether to generate diagram images for questions'),

    userId: z.string()
        .optional()
        .describe('User ID for persisting generated quiz'),

    questionTypes: z.array(z.enum(QuestionTypes))
        .optional()
        .describe('Types of questions to include'),

    bloomsTaxonomyLevels: z.array(z.enum(BloomsLevels))
        .optional()
        .describe("Target Bloom's Taxonomy levels"),
});

export type QuizInput = z.infer<typeof QuizInputSchema>;

// ============================================================================
// OUTPUT SCHEMA
// ============================================================================

const DistractorSchema = z.object({
    answer: z.string()
        .describe('Incorrect answer option'),

    rationale: z.string()
        .describe('Why this is plausible but wrong'),

    misconception: z.string()
        .optional()
        .describe('Underlying misconception'),
});

const QuestionSchema = z.object({
    questionNumber: z.number().int().describe('1-indexed number'),
    questionText: z.string().describe('The question prompt'),
    questionType: z.enum(QuestionTypes),

    options: z.array(z.string())
        .optional()
        .describe('4 options for MCQ'),

    correctAnswer: z.string().describe('The correct answer'),

    distractors: z.array(DistractorSchema)
        .optional()
        .describe('Plausible wrong answers'),

    explanation: z.string().describe('Why it is correct'),

    bloomsLevel: z.enum(BloomsLevels),

    imageUrl: z.string()
        .optional()
        .describe('Diagram URL'),

    visualPrompt: z.string()
        .optional()
        .describe('Image generation prompt'),

    difficultyRating: z.enum(DifficultyLevels).optional(),
    learningObjective: z.string().optional(),
});

export const QuizOutputSchema = z.object({
    topic: z.string()
        .describe('The topic the quiz covers'),

    gradeLevel: z.string()
        .describe('Target grade level'),

    subject: z.string()
        .describe('Subject area'),

    language: z.string()
        .describe('Language of the quiz'),

    difficulty: z.enum(DifficultyLevels)
        .describe('Overall quiz difficulty'),

    questions: z.array(QuestionSchema)
        .describe('Array of questions'),

    // Analytics metadata
    bloomsDistribution: z.object({
        Remember: z.number().int(),
        Understand: z.number().int(),
        Apply: z.number().int(),
        Analyze: z.number().int(),
        Evaluate: z.number().int(),
        Create: z.number().int(),
    }).optional()
        .describe('Distribution of questions across Bloom\'s levels'),

    estimatedTimeMinutes: z.number()
        .int()
        .optional()
        .describe('Estimated time to complete the quiz'),
});

export type QuizOutput = z.infer<typeof QuizOutputSchema>;
export type QuizQuestion = z.infer<typeof QuestionSchema>;
export type Distractor = z.infer<typeof DistractorSchema>;

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Result of quiz validation
 */
export interface QuizValidationResult {
    valid: boolean;
    score: number; // 0-100, pedagogical quality score
    errors: string[];
    warnings: string[];
    suggestions: string[];
}

/**
 * Grade-appropriate Bloom's levels
 */
export const GradeBloomsMap: Record<string, BloomsLevel[]> = {
    '1st Grade': ['Remember', 'Understand'],
    '2nd Grade': ['Remember', 'Understand'],
    '3rd Grade': ['Remember', 'Understand', 'Apply'],
    '4th Grade': ['Remember', 'Understand', 'Apply'],
    '5th Grade': ['Remember', 'Understand', 'Apply'],
    '6th Grade': ['Remember', 'Understand', 'Apply', 'Analyze'],
    '7th Grade': ['Remember', 'Understand', 'Apply', 'Analyze'],
    '8th Grade': ['Remember', 'Understand', 'Apply', 'Analyze'],
    '9th Grade': ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate'],
    '10th Grade': ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate'],
    '11th Grade': ['Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'],
    '12th Grade': ['Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'],
};

/**
 * Recommended Bloom's distribution by grade level
 */
export const RecommendedBloomsDistribution: Record<string, Record<BloomsLevel, number>> = {
    'Elementary (1-5)': {
        Remember: 40,
        Understand: 40,
        Apply: 20,
        Analyze: 0,
        Evaluate: 0,
        Create: 0,
    },
    'Middle School (6-8)': {
        Remember: 20,
        Understand: 40,
        Apply: 30,
        Analyze: 10,
        Evaluate: 0,
        Create: 0,
    },
    'High School (9-12)': {
        Remember: 10,
        Understand: 30,
        Apply: 30,
        Analyze: 20,
        Evaluate: 10,
        Create: 0,
    },
};
