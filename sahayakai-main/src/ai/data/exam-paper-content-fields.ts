/**
 * @fileOverview Shared `dbAdapter.saveContent` field coercion for exam papers.
 *
 * Extracted so the generator's status-write path and the save route's
 * PUT handler can't drift apart on the same fallback/`as any` escapes.
 */

export interface ExamPaperContentFieldsInput {
  gradeLevel?: string;
  subject?: string;
  language?: string;
}

export function toExamPaperContentFields(fields: ExamPaperContentFieldsInput) {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gradeLevel: (fields.gradeLevel || 'Class 10') as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    subject: (fields.subject || 'General') as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    language: (fields.language ?? 'English') as any,
  };
}
