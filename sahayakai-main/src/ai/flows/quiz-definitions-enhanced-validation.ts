/**
 * Enhanced validation helper for QuizGeneratorOutputSchema
 * This provides detailed error messages for schema validation failures
 */

import { QuizGeneratorOutputSchema } from '@/ai/schemas/quiz-generator-schemas';

export function validateQuizOutput(rawOutput: any): { valid: boolean; errors: string[]; data?: any } {
    const errors: string[] = [];

    // Check for required fields
    if (!rawOutput.title || typeof rawOutput.title !== 'string') {
        errors.push('Missing or invalid "title" field (must be a non-empty string)');
    }

    if (!rawOutput.questions || !Array.isArray(rawOutput.questions)) {
        errors.push('Missing or invalid "questions" field (must be an array)');
    } else {
        // Validate each question
        rawOutput.questions.forEach((q: any, idx: number) => {
            if (!q.questionText) {
                errors.push(`Question ${idx + 1}: Missing "questionText"`);
            }

            if (!q.questionType || !['multiple_choice', 'fill_in_the_blanks', 'short_answer', 'true_false'].includes(q.questionType)) {
                errors.push(`Question ${idx + 1}: Invalid "questionType" (got: ${q.questionType})`);
            }

            if (!q.correctAnswer) {
                errors.push(`Question ${idx + 1}: Missing "correctAnswer"`);
            }

            if (!q.explanation) {
                errors.push(`Question ${idx + 1}: Missing "explanation"`);
            }

            if (!q.difficultyLevel || !['easy', 'medium', 'hard'].includes(q.difficultyLevel)) {
                errors.push(`Question ${idx + 1}: Invalid "difficultyLevel" (got: ${q.difficultyLevel})`);
            }

            // Multiple choice questions must have options
            if (q.questionType === 'multiple_choice') {
                if (!q.options || !Array.isArray(q.options) || q.options.length === 0) {
                    errors.push(`Question ${idx + 1}: Multiple choice questions must have "options" array`);
                }
            }
        });
    }

    if (errors.length > 0) {
        return { valid: false, errors };
    }

    // Now run the actual Zod validation
    try {
        const validated = QuizGeneratorOutputSchema.parse(rawOutput);
        return { valid: true, errors: [], data: validated };
    } catch (zodError: any) {
        return {
            valid: false,
            errors: zodError.errors?.map((e: any) => `${e.path.join('.')}: ${e.message}`) || ['Unknown validation error']
        };
    }
}

/**
 * Sanitize AI output before validation
 * Attempts to fix common AI mistakes
 */
export function sanitizeQuizOutput(rawOutput: any): any {
    const sanitized = { ...rawOutput };

    // Ensure questions is an array
    if (!Array.isArray(sanitized.questions)) {
        sanitized.questions = [];
    }

    // Fix common enum casing issues
    sanitized.questions = sanitized.questions.map((q: any) => {
        const fixed = { ...q };

        // Normalize questionType
        if (fixed.questionType) {
            const normalized = fixed.questionType.toLowerCase().replace(/[_\s-]+/g, '_');
            const validTypes = ['multiple_choice', 'fill_in_the_blanks', 'short_answer', 'true_false'];
            if (validTypes.includes(normalized)) {
                fixed.questionType = normalized;
            }
        }

        // Normalize difficultyLevel
        if (fixed.difficultyLevel) {
            fixed.difficultyLevel = fixed.difficultyLevel.toLowerCase();
        }

        // Ensure options is array for multiple_choice
        if (fixed.questionType === 'multiple_choice' && !Array.isArray(fixed.options)) {
            fixed.options = [];
        }

        return fixed;
    });

    return sanitized;
}
