import { z } from 'zod';

/**
 * Schema building blocks shared by every public Sahayak MCP server, so each
 * capability exposes the same field names, ranges and messages.
 */

/** The 11 languages Sahayak generates in (display names, as the services expect). */
export const SAHAYAK_LANGUAGES = [
    'English', 'Hindi', 'Bengali', 'Gujarati', 'Kannada', 'Malayalam',
    'Marathi', 'Odia', 'Punjabi', 'Tamil', 'Telugu',
] as const;

export const languageField = (what: string) =>
    z.enum(SAHAYAK_LANGUAGES, {
        errorMap: () => ({ message: `Unsupported language. Use one of: ${SAHAYAK_LANGUAGES.join(', ')}.` }),
    }).default('English').describe(`Language ${what} is written in. Default English.`);

const GRADE_MESSAGE = 'Invalid grade. Expected an integer between 1 and 12.';

/** Indian school grade / class as an integer 1–12. */
export const gradeField = (describe: string) =>
    z.number({ required_error: 'Missing grade. Expected an integer between 1 and 12.', invalid_type_error: GRADE_MESSAGE })
        .int(GRADE_MESSAGE)
        .min(1, GRADE_MESSAGE)
        .max(12, GRADE_MESSAGE)
        .describe(describe);

/** "Class 7" — the grade label the Sahayak services use. */
export const gradeLabel = (grade: number): string => `Class ${grade}`;
