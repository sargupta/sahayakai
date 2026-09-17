/**
 * @jest-environment node
 *
 * Contract for `regenerateExamQuestion`: a single-question regen must never
 * return a REQUESTED answer key / marking scheme empty (invariant #2), and must
 * keep the question's marks fixed (invariant #1 — the caller relies on this so
 * the paper's sum===maxMarks can't drift). No Gemini calls: the prompt is a spy.
 *
 * The genkit mock returns the SAME promptSpy for the prompt; successive calls
 * are distinguished by mockResolvedValueOnce order (call[0] = first attempt,
 * call[1] = the single retry).
 */

jest.mock('@/ai/genkit', () => {
  const flowSpy = jest.fn();
  const promptSpy = jest.fn();
  return {
    __promptSpy: promptSpy,
    ai: {
      definePrompt: jest.fn(() => promptSpy),
      defineFlow: (_config: unknown, fn: (input: unknown) => unknown) => {
        flowSpy.mockImplementation(fn as (input: unknown) => unknown);
        return flowSpy;
      },
      generate: jest.fn(),
    },
    runResiliently: jest.fn(async (fn: (cfg: unknown) => unknown) => fn({ config: {} })),
  };
});

jest.mock('@/ai/soul', () => ({
  SAHAYAK_SOUL_PROMPT: '',
  STRUCTURED_OUTPUT_OVERRIDE: '',
}));

jest.mock('@/lib/logger/structured-logger', () => ({
  StructuredLogger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(() => 'error-id') },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const genkit = require('@/ai/genkit') as { __promptSpy: jest.Mock };
import { regenerateExamQuestion } from '@/ai/flows/regenerate-exam-question';

const baseInput = {
  board: 'CBSE',
  gradeLevel: 'Class 10',
  subject: 'Mathematics',
  language: 'English',
  chapters: ['Real Numbers', 'Polynomials'],
  marks: 3,
  includeAnswerKey: true,
  includeMarkingScheme: true,
  optionCount: 4,
};

beforeEach(() => genkit.__promptSpy.mockReset());

test('MCQ: answer key is stamped deterministically from correctOption even when the model leaves it empty', async () => {
  genkit.__promptSpy.mockResolvedValueOnce({
    output: {
      text: 'Which of these is irrational?',
      options: ['1/2', '0.75', '√2', '3'],
      correctOption: 'c',
      answerKey: '',       // model dropped it — stamp must fill
      markingScheme: '',
      chapterUsed: 'Real Numbers',
    },
  });

  const out = await regenerateExamQuestion({ ...baseInput, isMcq: true, originalQuestionText: 'Is 0.5 rational?' });

  expect(out.answerKey.trim()).not.toBe('');
  expect(out.answerKey).toContain('(c)');   // stamped from correctOption
  expect(out.markingScheme.trim()).not.toBe('');
  expect(genkit.__promptSpy).toHaveBeenCalledTimes(1); // stamp filled → no retry needed
});

test('subjective: a requested field empty on BOTH attempts falls to the placeholder floor (never empty)', async () => {
  const empty = {
    output: {
      text: 'Prove that √5 is irrational.',
      correctOption: '',
      answerKey: '',
      markingScheme: '',   // model omits both times
      chapterUsed: 'Real Numbers',
    },
  };
  genkit.__promptSpy.mockResolvedValueOnce(empty).mockResolvedValueOnce(empty);

  const out = await regenerateExamQuestion({ ...baseInput, isMcq: false, originalQuestionText: 'Prove √2 irrational.' });

  expect(genkit.__promptSpy).toHaveBeenCalledTimes(2);       // one retry fired
  expect(out.answerKey.trim()).not.toBe('');                 // placeholder floor
  expect(out.markingScheme.trim()).not.toBe('');
});

test('does not fabricate an answer key when it was not requested', async () => {
  genkit.__promptSpy.mockResolvedValueOnce({
    output: {
      text: 'Prove that √5 is irrational.',
      correctOption: '',
      answerKey: '',
      markingScheme: '',
      chapterUsed: 'Real Numbers',
    },
  });

  const out = await regenerateExamQuestion({
    ...baseInput,
    isMcq: false,
    includeAnswerKey: false,
    includeMarkingScheme: false,
    originalQuestionText: 'Prove √2 irrational.',
  });

  expect(out.answerKey).toBe('');       // not requested → stays empty, no floor
  expect(out.markingScheme).toBe('');
  expect(genkit.__promptSpy).toHaveBeenCalledTimes(1); // nothing missing → no retry
});
