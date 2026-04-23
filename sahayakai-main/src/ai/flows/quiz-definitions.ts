import { ai } from '@/ai/genkit';
import { SAHAYAK_SOUL_PROMPT, STRUCTURED_OUTPUT_OVERRIDE } from '@/ai/soul';
import { UsageTracker } from '@/lib/usage-tracker';
import { QuizGeneratorInputSchema, QuizGeneratorOutputSchema } from '@/ai/schemas/quiz-generator-schemas';

export const quizGeneratorPrompt = ai.definePrompt({
  name: 'quizGeneratorPrompt',
  input: { schema: QuizGeneratorInputSchema },
  output: { schema: QuizGeneratorOutputSchema },
  prompt: `${SAHAYAK_SOUL_PROMPT}${STRUCTURED_OUTPUT_OVERRIDE}
{{#if teacherContext}}{{{teacherContext}}}{{/if}}

**ABSOLUTE LANGUAGE LOCK — OVERRIDES EVERYTHING ABOVE**
The quiz MUST be written entirely in **{{{language}}}**. This rule overrides any
"Hinglish", "multilingual scaffolding", or "home language" instruction elsewhere
in this prompt. Every field — title, questionText, options, correctAnswer,
explanation, AND teacherInstructions — is in {{{language}}}. No mixing.
- If {{{language}}} is "English": NO Hindi, Tamil, Kannada, or any other
  script. No Devanagari characters anywhere. No transliterated Hindi words
  (like "shiksha", "pradhan") either. Pure English.
- If {{{language}}} is "Hindi": every word in Devanagari. No English except
  well-established loanwords that cannot be rendered in Devanagari (e.g.
  "quiz", "AI", proper nouns).
- Teacher instructions go in the SAME language as the quiz. Do not slip into
  Hindi for the teacher and English for the students.

You are an expert educator who excels at creating assessments that are both challenging and informative. Generate a quiz based on the provided inputs.

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
2.  **Bharat-First Contextualization**: You MUST use Indian rural contexts for all questions and explanations. Use examples from Agriculture, local geography (rivers like Ganga, Kaveri), local markets (mandis), and zero-cost resources. Avoid westernisms like "elevators", "subways", "snowing" (unless in Himalayas), or "dollars".
3.  **Chalk & Blackboard Awareness**: Design questions that are easy for a teacher to write on a physical blackboard. Keep "questionText" concise but meaningful.
4.  **Generate Questions:** Create exactly {{{numQuestions}}} questions.
5.  **Distractor Quality:** For multiple-choice questions, ensure distractors (incorrect options) are plausible and common misconceptions, making the quiz a true learning tool.
6.  **Explanations**: For EVERY question, provide a detailed "explanation" that clarifies why the answer is correct. Use a simple, Bharat-context analogy (e.g., "Just like how a farmer selects seeds...") to help the teacher explain.
7.  **Difficulty Levels:**
    {{#if targetDifficulty}}
    **CRITICAL**: You MUST generate ALL questions at the **{{{targetDifficulty}}}** difficulty level. Do not mix levels.
    {{else}}
    Assign an individual "difficultyLevel" (easy, medium, hard) to each question based on the cognitive depth required.
    {{/if}}
8.  **Teacher Instructions**: Provide a brief "teacherInstructions" section at the end on how to conduct this quiz in a resource-constrained classroom (e.g., "Write the MCQs on the left side of the board").
9.  **Cognitive Level**: Tailor questions to assess these specific Bloom's levels if provided: {{#each bloomsTaxonomyLevels}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}.
10. **Context**: Maintain the specified \`gradeLevel\` (use "Class" terminology) and \`language\`.
11. **Metadata**: Identify the most appropriate \`subject\` (e.g., Science, Math) and \`gradeLevel\` if not explicitly provided.
12. **Descriptive Title**: You MUST generate a descriptive, engaging title for the quiz based on the topic or chapter provided (e.g., "Photosynthesis & Plant Life Quiz" instead of "Chapter Two Quiz"). Do NOT use generic titles like "Chapter [Number] Quiz" or just "Quiz".

**Inputs:**
{{#if imageDataUri}}
- **Textbook Page Image:** {{media url=imageDataUri}}
{{/if}}
- **Topic:** {{{topic}}}
- **Number of Questions:** {{{numQuestions}}}
- **Question Types:** {{#each questionTypes}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
- **Grade Level:** {{{gradeLevel}}}
- **Language:** {{{language}}}
{{#if targetDifficulty}}
- **Target Difficulty:** {{{targetDifficulty}}}
{{/if}}

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

      const result = await runResiliently(async (resilienceConfig) => {
        return await quizGeneratorPrompt({
          ...input,
          imageDataUri: processedImageDataUri
        }, resilienceConfig);
      }, 'quiz.generate');
      const output = result.output;

      if (input.userId && (result as any).usage) {
        UsageTracker.trackGemini(input.userId, (result as any).usage.totalTokens || 0, 'gemini-2.0-flash');
      }

      if (!output) {
        throw new FlowExecutionError(
          'AI model returned null output',
          {
            modelUsed: 'gemini-2.0-flash',
            input: input.topic
          }
        );
      }

      // Validate schema explicitly with enhanced diagnostics
      try {
        const { validateQuizOutput, sanitizeQuizOutput } = await import('./quiz-definitions-enhanced-validation');

        // First, sanitize the output to fix common AI mistakes
        const sanitized = sanitizeQuizOutput(output);

        // Then validate with detailed error messages
        const validation = validateQuizOutput(sanitized);

        if (!validation.valid) {
          const detailedErrors = validation.errors.join('\n  - ');

          StructuredLogger.error('Quiz schema validation failed - detailed errors', {
            service: 'quiz-generator-flow',
            operation: 'generateQuiz',
            requestId,
            metadata: {
              validationErrors: validation.errors,
              rawOutput: JSON.stringify(sanitized, null, 2)
            }
          });

          throw new SchemaValidationError(
            `Quiz output failed schema validation:\n  - ${detailedErrors}`,
            {
              validationErrors: validation.errors,
              rawOutput: sanitized,
              expectedSchema: 'QuizGeneratorOutputSchema',
              hint: 'The AI model may need prompt adjustments or the schema may be too strict'
            }
          );
        }

        QuizGeneratorOutputSchema.parse(sanitized);
      } catch (validationError: any) {
        if (validationError instanceof SchemaValidationError) {
          throw validationError;
        }

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
