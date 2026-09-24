/**
 * @jest-environment node
 *
 * Contract for `buildQuestionSets`: the sets are anti-cheating VARIANTS of one
 * paper — every set must hold the same questions (nothing lost/added), no question
 * may leave its section, numbering must stay sequential per set, marks must never
 * drift, and the shuffle must be deterministic (same set = same permutation) with
 * Set A == the original.
 */
import { buildQuestionSets, setLabel } from '@/lib/exam-paper-sets';
import type { GeneratedPaper } from '@/app/exam-paper/types';

const q = (number: number, text: string, marks: number) => ({ number, text, marks });

const paper: GeneratedPaper = {
  title: 'Test Paper',
  board: 'CBSE',
  gradeLevel: 'Class 10',
  subject: 'Mathematics',
  duration: '3 Hours',
  maxMarks: 15,
  generalInstructions: [],
  sections: [
    {
      name: 'Section A',
      label: 'MCQ',
      totalMarks: 4,
      questions: [q(1, 'A-one', 1), q(2, 'A-two', 1), q(3, 'A-three', 1), q(4, 'A-four', 1)],
    },
    {
      name: 'Section B',
      label: 'Short answer',
      totalMarks: 11,
      // continuous numbering across sections (5,6,7)
      questions: [q(5, 'B-one', 3), q(6, 'B-two', 3), q(7, 'B-three', 5)],
    },
  ],
};

const texts = (p: GeneratedPaper) => p.sections.map((s) => s.questions.map((x) => x.text));
const flatSorted = (p: GeneratedPaper) => p.sections.flatMap((s) => s.questions.map((x) => x.text)).sort();

test('Set A is the original order (identity)', () => {
  const [a] = buildQuestionSets(paper, 3);
  expect(texts(a)).toEqual(texts(paper));
});

test('every set holds the same questions, none crossing sections', () => {
  const sets = buildQuestionSets(paper, 3);
  for (const s of sets) {
    // same multiset overall
    expect(flatSorted(s)).toEqual(flatSorted(paper));
    // each section keeps exactly its own questions (A-*, B-*)
    expect(s.sections[0].questions.every((x) => x.text.startsWith('A-'))).toBe(true);
    expect(s.sections[1].questions.every((x) => x.text.startsWith('B-'))).toBe(true);
  }
});

test('numbers stay sequential per set and preserve the paper convention', () => {
  const sets = buildQuestionSets(paper, 3);
  for (const s of sets) {
    expect(s.sections[0].questions.map((x) => x.number)).toEqual([1, 2, 3, 4]);
    expect(s.sections[1].questions.map((x) => x.number)).toEqual([5, 6, 7]);
  }
});

test('marks sum equals maxMarks for every set', () => {
  for (const s of buildQuestionSets(paper, 3)) {
    const sum = s.sections.flatMap((sec) => sec.questions).reduce((n, x) => n + x.marks, 0);
    expect(sum).toBe(paper.maxMarks);
  }
});

test('shuffle is deterministic — same set index gives the same order', () => {
  const first = buildQuestionSets(paper, 3);
  const second = buildQuestionSets(paper, 3);
  expect(texts(first[1])).toEqual(texts(second[1]));
  expect(texts(first[2])).toEqual(texts(second[2]));
});

test('at least one later set actually reorders a section (not a no-op)', () => {
  const sets = buildQuestionSets(paper, 3);
  const reordered = sets.slice(1).some((s) => JSON.stringify(texts(s)) !== JSON.stringify(texts(paper)));
  expect(reordered).toBe(true);
});

test('setLabel maps index to A/B/C', () => {
  expect([setLabel(0), setLabel(1), setLabel(2)]).toEqual(['A', 'B', 'C']);
});

test('a section with a single question is left untouched', () => {
  const solo: GeneratedPaper = {
    ...paper,
    sections: [{ name: 'S', label: '', totalMarks: 2, questions: [q(1, 'only', 2)] }],
  };
  for (const s of buildQuestionSets(solo, 3)) {
    expect(s.sections[0].questions.map((x) => x.text)).toEqual(['only']);
    expect(s.sections[0].questions[0].number).toBe(1);
  }
});

test('numbering falls back through questionNumber then position', () => {
  // Mix: one uses questionNumber (legacy), one has neither → positional 1..n.
  const legacy: GeneratedPaper = {
    ...paper,
    sections: [
      {
        name: 'S',
        label: '',
        totalMarks: 3,
        questions: [
          { questionNumber: 1, text: 'legacy-a', marks: 1 },
          { questionNumber: 2, text: 'legacy-b', marks: 1 },
          { text: 'no-number', marks: 1 } as any,
        ],
      },
    ],
  };
  // Renumbering happens on the shuffled sets (Set A is the untouched identity).
  for (const s of buildQuestionSets(legacy, 3).slice(1)) {
    const qs = s.sections[0].questions;
    expect(qs.map((x) => x.number)).toEqual([1, 2, 3]); // sequential regardless
    // legacy questionNumber is written back in step with number
    const legacyQ = qs.find((x) => x.text === 'legacy-a')!;
    expect(legacyQ.questionNumber).toBe(legacyQ.number);
  }
});

test('count <= 1 yields a single identity set', () => {
  expect(buildQuestionSets(paper, 1)).toHaveLength(1);
  const zero = buildQuestionSets(paper, 0); // Math.max(1, 0) === 1
  expect(zero).toHaveLength(1);
  expect(texts(zero[0])).toEqual(texts(paper));
});

test('handles missing sections / questions without throwing', () => {
  const noSections = { ...paper, sections: undefined } as any;
  expect(() => buildQuestionSets(noSections, 3)).not.toThrow();

  const noQuestions: GeneratedPaper = {
    ...paper,
    sections: [{ name: 'S', label: '', totalMarks: 0, questions: undefined } as any],
  };
  expect(() => buildQuestionSets(noQuestions, 3)).not.toThrow();
});
