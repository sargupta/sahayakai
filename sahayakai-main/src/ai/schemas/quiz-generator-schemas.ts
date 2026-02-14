
import { z } from 'genkit';

const QuestionSchema = z.object({
  questionText: z.string().describe('The full text of the question.'),
  questionType: z.enum(['multiple_choice', 'fill_in_the_blanks', 'short_answer', 'true_false']).describe('The type of the question.'),
  options: z.array(z.string()).optional().describe('For multiple-choice questions, the list of possible answers.'),
  correctAnswer: z.string().describe('The correct answer.'),
  explanation: z.string().describe('A clear explanation of why the answer is correct and why other options are incorrect.'),
  difficultyLevel: z.enum(['easy', 'medium', 'hard']).describe('The difficulty level of this specific question.'),
});

export const QuizGeneratorInputSchema = z.object({
  topic: z.string().describe('The topic of the quiz.'),
  imageDataUri: z.string().optional().describe(
    "An optional photo of a textbook page, as a data URI that must include a MIME type and use Base64 encoding. This will be the primary context for the quiz."
  ),
  numQuestions: z.number().default(5).describe('The number of questions to generate.'),
  questionTypes: z.array(z.enum(['multiple_choice', 'fill_in_the_blanks', 'short_answer', 'true_false'])).describe('The types of questions to include.'),
  gradeLevel: z.string().optional().describe('The grade level for which the quiz is intended.'),
  language: z.string().optional().describe('The language for the quiz.'),
  bloomsTaxonomyLevels: z.array(z.string()).optional().describe("A list of Bloom's Taxonomy levels to target."),
  userId: z.string().optional().describe('The ID of the user for whom the quiz is being generated.'),
  targetDifficulty: z.enum(['easy', 'medium', 'hard']).optional().describe('The specific difficulty level to generate.'),
  subject: z.string().optional().describe('The academic subject of the quiz.'),
});
export type QuizGeneratorInput = z.infer<typeof QuizGeneratorInputSchema>;

export const QuizGeneratorOutputSchema = z.object({
  title: z.string().describe('A suitable title for the quiz.'),
  questions: z.array(QuestionSchema).describe('The list of generated quiz questions.'),
  teacherInstructions: z.string().optional().describe('Advice for the teacher on how to conduct this quiz and interpret results.'),
  gradeLevel: z.string().nullable().optional().describe('The target grade level.'),
  subject: z.string().nullable().optional().describe('The academic subject.'),
});
export type QuizGeneratorOutput = z.infer<typeof QuizGeneratorOutputSchema>;

export const QuizVariantsOutputSchema = z.object({
  easy: QuizGeneratorOutputSchema.nullable().describe("The easy version of the quiz."),
  medium: QuizGeneratorOutputSchema.nullable().describe("The medium version of the quiz."),
  hard: QuizGeneratorOutputSchema.nullable().describe("The hard version of the quiz."),
  gradeLevel: z.string().nullable().optional().describe('The target grade level.'),
  subject: z.string().nullable().optional().describe('The academic subject.'),
  topic: z.string().nullable().optional().describe('The main topic.'),
});
export type QuizVariantsOutput = z.infer<typeof QuizVariantsOutputSchema>;
