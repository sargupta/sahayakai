
import {z} from 'genkit';

const QuestionSchema = z.object({
  questionText: z.string().describe('The full text of the question.'),
  questionType: z.enum(['multiple_choice', 'fill_in_the_blanks', 'short_answer']).describe('The type of the question.'),
  options: z.array(z.string()).optional().describe('For multiple-choice questions, the list of possible answers.'),
  correctAnswer: z.string().describe('The correct answer. For short answer, this can be a model answer.'),
});

export const QuizGeneratorInputSchema = z.object({
  topic: z.string().describe('The topic of the quiz.'),
  imageDataUri: z.string().optional().describe(
    "An optional photo of a textbook page, as a data URI that must include a MIME type and use Base64 encoding. This will be the primary context for the quiz."
  ),
  numQuestions: z.number().default(5).describe('The number of questions to generate.'),
  questionTypes: z.array(z.enum(['multiple_choice', 'fill_in_the_blanks', 'short_answer'])).describe('The types of questions to include.'),
  gradeLevel: z.string().optional().describe('The grade level for which the quiz is intended.'),
  language: z.string().optional().describe('The language for the quiz.'),
  bloomsTaxonomyLevels: z.array(z.string()).optional().describe("A list of Bloom's Taxonomy levels to target."),
  userId: z.string().optional().describe('The ID of the user for whom the quiz is being generated.'),
});
export type QuizGeneratorInput = z.infer<typeof QuizGeneratorInputSchema>;

export const QuizGeneratorOutputSchema = z.object({
  title: z.string().describe('A suitable title for the quiz.'),
  questions: z.array(QuestionSchema).describe('The list of generated quiz questions.'),
});
export type QuizGeneratorOutput = z.infer<typeof QuizGeneratorOutputSchema>;
