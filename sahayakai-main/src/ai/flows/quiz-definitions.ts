import { ai } from '@/ai/genkit';
import { QuizGeneratorInputSchema, QuizGeneratorOutputSchema } from '@/ai/schemas/quiz-generator-schemas';

export const quizGeneratorPrompt = ai.definePrompt({
  name: 'quizGeneratorPrompt',
  input: { schema: QuizGeneratorInputSchema },
  output: { schema: QuizGeneratorOutputSchema },
  prompt: `You are an expert educator who excels at creating assessments that are both challenging and informative. Generate a quiz based on the provided inputs.

**Instructions:**
1.  **Analyze Context:** If an image is provided, use it as the primary source. If no image, base the quiz on the topic.
2.  **Generate Questions:** Create exactly {{{numQuestions}}} questions.
3.  **Distractor Quality:** For multiple-choice questions, ensure distractors (incorrect options) are plausible and common misconceptions, making the quiz a true learning tool.
4.  **Explanations:** For EVERY question, provide a detailed "explanation" that clarifies why the answer is correct and why other options are not. This is for the teacher to use during review.
5.  **Difficulty Levels:** Assign an individual "difficultyLevel" (easy, medium, hard) to each question based on the cognitive depth required.
6.  **Teacher Instructions:** Provide a brief "teacherInstructions" section at the end on how to best use this quiz in a classroom setting.
7.  **Cognitive Level:** Tailor questions to assess these specific Bloom's levels if provided: {{#each bloomsTaxonomyLevels}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}.
8.  **Context:** Maintain the specified \`gradeLevel\` and \`language\`.

**Inputs:**
{{#if imageDataUri}}
- **Textbook Page Image:** {{media url=imageDataUri}}
{{/if}}
- **Topic:** {{{topic}}}
- **Number of Questions:** {{{numQuestions}}}
- **Question Types:** {{#each questionTypes}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
- **Grade Level:** {{{gradeLevel}}}
- **Language:** {{{language}}}
`,
});

export const quizGeneratorFlow = ai.defineFlow(
  {
    name: 'quizGeneratorFlow',
    inputSchema: QuizGeneratorInputSchema,
    outputSchema: QuizGeneratorOutputSchema,
  },
  async input => {
    const { runResiliently } = await import('@/ai/genkit');
    const { StructuredLogger } = await import('@/lib/logger/structured-logger');
    const { FlowExecutionError, SchemaValidationError } = await import('@/lib/errors');
    const { v4: uuidv4 } = await import('uuid');

    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      StructuredLogger.info('Starting quiz generation flow', {
        service: 'quiz-generator-flow',
        operation: 'generateQuiz',
        requestId,
        input: {
          topic: input.topic,
          numQuestions: input.numQuestions,
          gradeLevel: input.gradeLevel,
          questionTypes: input.questionTypes
        }
      });

      const { output } = await runResiliently(async (resilienceConfig) => {
        return await quizGeneratorPrompt(input, resilienceConfig);
      });

      if (!output) {
        throw new FlowExecutionError(
          'AI model returned null output',
          {
            modelUsed: 'gemini-2.0-flash',
            input: input.topic
          }
        );
      }

      // Validate schema explicitly
      try {
        QuizGeneratorOutputSchema.parse(output);
      } catch (validationError: any) {
        throw new SchemaValidationError(
          `Schema validation failed: ${validationError.message}`,
          {
            parseErrors: validationError.errors,
            rawOutput: output,
            expectedSchema: 'QuizGeneratorOutputSchema'
          }
        );
      }

      const duration = Date.now() - startTime;

      StructuredLogger.info('Quiz generation completed successfully', {
        service: 'quiz-generator-flow',
        operation: 'generateQuiz',
        requestId,
        duration,
        metadata: {
          questionsCount: output.questions?.length
        }
      });

      return output;

    } catch (flowError: any) {
      const duration = Date.now() - startTime;

      const errorId = StructuredLogger.error(
        'Quiz generation flow execution failed',
        {
          service: 'quiz-generator-flow',
          operation: 'generateQuiz',
          requestId,
          input: {
            topic: input.topic
          },
          duration,
          metadata: {
            errorType: flowError.constructor?.name,
            errorCode: flowError.errorCode
          }
        },
        flowError
      );

      if (typeof flowError === 'object' && flowError !== null) {
        flowError.errorId = errorId;
      }
      throw flowError;
    }
  }
);
