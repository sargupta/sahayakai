/**
 * @jest-environment node
 *
 * Pins `normaliseSet` — the corpus has real drift ("Set 1" vs "Set-3"), and a
 * genuine CBSE series code (e.g. "30/1/1") must NOT be rewritten into a
 * "Set N" shape since it's already a standard, distinct format.
 */

import { normaliseSet, normaliseClass, normaliseType, validate } from '@/lib/pyq/normalize';

describe('normaliseSet', () => {
  it('canonicalises separator/case variants of "Set N" to "Set N"', () => {
    expect(normaliseSet('Set-3')).toBe('Set 3');
    expect(normaliseSet('SET 1')).toBe('Set 1');
    expect(normaliseSet('set_a')).toBe('Set A');
    expect(normaliseSet('Set   2')).toBe('Set 2');
  });

  it('passes a genuine series code through unchanged', () => {
    expect(normaliseSet('30/1/1')).toBe('30/1/1');
    expect(normaliseSet('30/1')).toBe('30/1');
  });

  it('returns null for null/undefined/empty input', () => {
    expect(normaliseSet(null)).toBeNull();
    expect(normaliseSet(undefined)).toBeNull();
    expect(normaliseSet('')).toBeNull();
    expect(normaliseSet('   ')).toBeNull();
  });
});

describe('normaliseClass', () => {
  it('accepts "9"/"10" as strings', () => {
    expect(normaliseClass('9')).toBe(9);
    expect(normaliseClass('10')).toBe(10);
  });

  it('accepts 9/10 as numbers', () => {
    expect(normaliseClass(9)).toBe(9);
    expect(normaliseClass(10)).toBe(10);
  });

  it('rejects a class outside 9/10', () => {
    expect(normaliseClass('11')).toBeNull();
    expect(normaliseClass(11)).toBeNull();
  });

  it('rejects non-numeric input', () => {
    expect(normaliseClass('abc')).toBeNull();
    expect(normaliseClass(NaN)).toBeNull();
  });

  it('rejects undefined', () => {
    expect(normaliseClass(undefined)).toBeNull();
  });
});

describe('normaliseType', () => {
  it('normalises each recognised type, case-insensitively', () => {
    expect(normaliseType('mcq')).toBe('MCQ');
    expect(normaliseType('MCQ')).toBe('MCQ');
    expect(normaliseType('vsa')).toBe('VSA');
    expect(normaliseType('sa')).toBe('SA');
    expect(normaliseType('la')).toBe('LA');
  });

  it('normalises both underscore and space variants of case study', () => {
    expect(normaliseType('CASE_STUDY')).toBe('case_study');
    expect(normaliseType('case_study')).toBe('case_study');
    expect(normaliseType('CASE STUDY')).toBe('case_study');
    expect(normaliseType('case study')).toBe('case_study');
  });

  it('trims surrounding whitespace', () => {
    expect(normaliseType('  MCQ  ')).toBe('MCQ');
  });

  it('returns null for an unrecognised type', () => {
    expect(normaliseType('ESSAY')).toBeNull();
    expect(normaliseType('case-study')).toBeNull(); // hyphen variant is not handled
  });
});

describe('validate', () => {
  const validRow = {
    question: 'What is 2 + 2?',
    subject: 'Mathematics',
    class: '10',
    chapter: 'Algebra',
    marks: 5,
    type: 'MCQ',
  };

  it('accepts a fully valid row', () => {
    expect(validate(validRow)).toEqual({ valid: true, reasons: [] });
  });

  it('flags missing/empty question text', () => {
    const { valid, reasons } = validate({ ...validRow, question: '' });
    expect(valid).toBe(false);
    expect(reasons).toContain('missing question text');
  });

  it('flags an invalid subject', () => {
    const { valid, reasons } = validate({ ...validRow, subject: 'History' });
    expect(valid).toBe(false);
    expect(reasons).toContain('invalid subject: "History"');
  });

  it('flags an invalid class', () => {
    const { valid, reasons } = validate({ ...validRow, class: '11' });
    expect(valid).toBe(false);
    expect(reasons).toContain('invalid class: "11"');
  });

  it('flags a missing chapter', () => {
    const { valid, reasons } = validate({ ...validRow, chapter: '' });
    expect(valid).toBe(false);
    expect(reasons).toContain('missing chapter');
  });

  it('flags invalid (non-numeric) marks', () => {
    const { valid, reasons } = validate({ ...validRow, marks: 'five' });
    expect(valid).toBe(false);
    expect(reasons).toContain('invalid marks: "five"');
  });

  it('flags an invalid type', () => {
    const { valid, reasons } = validate({ ...validRow, type: 'ESSAY' });
    expect(valid).toBe(false);
    expect(reasons).toContain(
      'invalid type: "ESSAY" (must be one of: MCQ, VSA, SA, LA, case_study)'
    );
  });

  it('accumulates one reason per failed check when everything is invalid', () => {
    const { valid, reasons } = validate({
      question: '',
      subject: 'History',
      class: '11',
      chapter: '',
      marks: 'five',
      type: 'ESSAY',
    });
    expect(valid).toBe(false);
    expect(reasons).toHaveLength(6);
  });
});
