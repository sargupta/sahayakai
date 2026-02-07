import { ai } from '@/ai/genkit';
import { QuizGeneratorInputSchema, QuizGeneratorOutputSchema } from '@/ai/schemas/quiz-generator-schemas';

export const quizGeneratorPrompt = ai.definePrompt({
  name: 'quizGeneratorPrompt',
  input: { schema: QuizGeneratorInputSchema },
  output: { schema: QuizGeneratorOutputSchema },
  prompt: `You are an expert educator who excels at creating assessments that are both challenging and informative. Generate a quiz based on the provided inputs.

**CRITICAL: Voice Input Corrections**
When analyzing the topic input, users may correct themselves during voice input. Apply correction logic ONLY when clear correction signals are present:

**When to Apply Correction Logic (ONLY these cases):**
- Explicit negation: "grade five... no, grade seven" → Use grade 7
- Correction words: "actually", "I mean", "wait", "sorry", "correction"
  - Example: "In Hindi... actually, in English" → Use English
- Same parameter repeated with different value: "grade five... grade seven" → Use grade 7
  - Example: "Topic is plants... topic is animals" → Use animals

**When NOT to Apply Correction Logic:**
- Sequential information: "grade 5 science chapter 2" → Keep ALL information (not a correction)
- Multiple distinct topics: "photosynthesis and respiration" → Both are the topic (not a correction)
- Listing: "questions about history, geography, and science" → All are part of the topic
- Elaboration: "animals, specifically mammals" → Both are context, not correction

**Rule**: If unsure whether it's a correction or sequential info, treat it as SEQUENTIAL. Only apply correction when there's a CLEAR signal.

**Instructions:**
1.  **Analyze Context:** If an image is provided, use it as the primary source. If no image, base the quiz on the topic.
2.  **Generate Questions:** Create exactly {{{numQuestions}}} questions.
3.  **Distractor Quality:** For multiple-choice questions, ensure distractors (incorrect options) are plausible and common misconceptions, making the quiz a true learning tool.
4.  **Explanations:** For EVERY question, provide a detailed "explanation" that clarifies why the answer is correct and why other options are not. This is for the teacher to use during review.
5.  **Difficulty Levels:** Assign an individual "difficultyLevel" (easy, medium, hard) to each question based on the cognitive depth required.
6.  **Teacher Instructions:** Provide a brief "teacherInstructions" section at the end on how to best use this quiz in a classroom setting.
7.  **Cognitive Level:** Tailor questions to assess these specific Bloom's levels if provided: {{#each bloomsTaxonomyLevels}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}.
8.  **Context:** Maintain the specified \`gradeLevel\` and \`language\`. If gradeLevel is provided in the topic text, extract and use it (prioritizing the last mentioned grade ONLY if it's a clear correction).

**Inputs:**
{{#if imageDataUri}}
- **Textbook Page Image:** {{media url=imageDataUri}}
{{/if}}
- **Topic:** {{{topic}}}
- **Number of Questions:** {{{numQuestions}}}
- **Question Types:** {{#each questionTypes}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
- **Grade Level:** {{{gradeLevel}}}
- **Language:** {{{language}}}

**Constraints:**
- **Language Lock**: You MUST ONLY respond in the language(s) provided in the input ({{{language}}}). Do NOT shift into other languages (like Chinese, Spanish, etc.) unless explicitly requested.
- **No Repetition Loop**: Monitor your output for repetitive phrases or characters. If you detect a loop, break it immediately.
- **Scope Integrity**: Stay strictly within the scope of the educational task assigned.
- **Conservative Correction**: Only treat input as a correction when there are CLEAR correction signals. When in doubt, use ALL information provided.
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
      const { fetchImageAsBase64 } = await import('@/ai/utils/image-utils');

      // Process Image URL -> Base64 if needed
      let processedImageDataUri = input.imageDataUri;
      if (input.imageDataUri && !input.imageDataUri.startsWith('data:')) {
        processedImageDataUri = await fetchImageAsBase64(input.imageDataUri);
      }

      StructuredLogger.info('Starting quiz generation flow', {
        service: 'quiz-generator-flow',
        operation: 'generateQuiz',
        requestId,
        input: {
          topic: input.topic,
          numQuestions: input.numQuestions,
          gradeLevel: input.gradeLevel,
          questionTypes: input.questionTypes,
          hasImage: !!processedImageDataUri
        }
      });

      const { output } = await runResiliently(async (resilienceConfig) => {
        return await quizGeneratorPrompt({
          ...input,
          imageDataUri: processedImageDataUri
        }, resilienceConfig);
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
