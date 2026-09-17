/**
 * @jest-environment node
 *
 * Pins `sanitizePyqSourceTags`. Real bug (2026-07-19): the old regex only
 * recognized a "Set N" suffix, so it silently stripped every set value shaped
 * like a CBSE series code (e.g. "30/1/1") — which is most of the current
 * Class 10 Maths corpus — down to a bare "PYQ <year>", losing the set even
 * though the model tagged it correctly.
 */

// ── Mocks (must come before importing the SUT) ─────────────────────────────

jest.mock('@/ai/genkit', () => ({
  ai: { definePrompt: jest.fn(() => jest.fn()), defineFlow: jest.fn(() => jest.fn()) },
  runResiliently: jest.fn(),
}));

jest.mock('@/ai/soul', () => ({
  SAHAYAK_SOUL_PROMPT: '',
  STRUCTURED_OUTPUT_OVERRIDE: '',
}));

import { sanitizePyqSourceTags } from '@/ai/flows/exam-paper-generator';

function paperWithSource(source: string) {
  return {
    sections: [{ questions: [{ source }] }],
  } as any;
}

describe('sanitizePyqSourceTags', () => {
  it('keeps a "Set N" suffix', () => {
    const output = paperWithSource('PYQ 2023 Set 1 (CBSE) | CBSE_mathematics_c10_11572e4c');
    sanitizePyqSourceTags(output);
    expect(output.sections[0].questions[0].source).toBe('PYQ 2023 Set 1');
  });

  it('keeps a CBSE series-code set like "30/1/1" (the corpus-majority format)', () => {
    const output = paperWithSource('PYQ 2023 30/1/1 (CBSE) | CBSE_mathematics_c10_abc123');
    sanitizePyqSourceTags(output);
    expect(output.sections[0].questions[0].source).toBe('PYQ 2023 30/1/1');
  });

  it('keeps a letter-based set like "Set A"', () => {
    const output = paperWithSource('PYQ 2022 Set A (CBSE)');
    sanitizePyqSourceTags(output);
    expect(output.sections[0].questions[0].source).toBe('PYQ 2022 Set A');
  });

  it('drops board/id noise when there is no set', () => {
    const output = paperWithSource('PYQ 2024 (CBSE) | CBSE_mathematics_c10_deadbeef');
    sanitizePyqSourceTags(output);
    expect(output.sections[0].questions[0].source).toBe('PYQ 2024');
  });

  it('leaves "New" questions untouched', () => {
    const output = paperWithSource('New');
    sanitizePyqSourceTags(output);
    expect(output.sections[0].questions[0].source).toBe('New');
  });

  it('falls back to bare "PYQ" for an unparseable tag', () => {
    const output = paperWithSource('PYQ garbled nonsense');
    sanitizePyqSourceTags(output);
    expect(output.sections[0].questions[0].source).toBe('PYQ');
  });
});
