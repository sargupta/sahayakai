/** @jest-environment node */
import { gradeFromExamplePrompt } from '@/lib/example-grade';

describe('gradeFromExamplePrompt', () => {
    it.each([
        ['A quiz on the major organs of the human body for Grade 5.', 'Class 5'],
        ['A simple quiz on addition and subtraction for 1st graders.', 'Class 1'],
        ['Fractions for Class 8 students', 'Class 8'],
        ['A quiz about the planets in our solar system.', null],
        ['Grade 15 nonsense', null],
    ])('%s → %s', (p, g) => expect(gradeFromExamplePrompt(p)).toBe(g));
});
