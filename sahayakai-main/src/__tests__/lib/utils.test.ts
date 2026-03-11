import { calculateEditPercentage, cn } from '@/lib/utils';

describe('Utils Library', () => {
  describe('cn', () => {
    it('should merge tailwind classes correctly', () => {
      expect(cn('p-4', 'bg-red-500', 'p-2')).toBe('bg-red-500 p-2');
    });

    it('should handle conditional classes', () => {
      expect(cn('p-4', { 'bg-red-500': true }, { 'p-2': false })).toBe('p-4 bg-red-500');
    });
  });

  describe('calculateEditPercentage', () => {
    it('should return 0 for identical strings', () => {
      const original = 'This is the original text.';
      const modified = 'This is the original text.';
      expect(calculateEditPercentage(original, modified)).toBe(0);
    });

    it('should return 100 if the original string is empty', () => {
      const original = '';
      const modified = 'This is some new text.';
      expect(calculateEditPercentage(original, modified)).toBe(100);
    });

    it('should return 100 if the modified string is empty', () => {
      const original = 'This is the original text.';
      const modified = '';
      expect(calculateEditPercentage(original, modified)).toBe(100);
    });

    it('should return 100 for completely different strings', () => {
      const original = 'one two three';
      const modified = 'four five six';
      expect(calculateEditPercentage(original, modified)).toBe(100);
    });

    it('should calculate a percentage for partially different strings', () => {
      const original = 'this is a simple test'; // 5 words
      const modified = 'this is a complex test'; // 5 words, 1 different
      // Union: {this, is, a, simple, test, complex} -> 6 words
      // Intersection: {this, is, a, test} -> 4 words
      // Similarity = 4 / 6 = 0.666...
      // Edit Percentage = (1 - 0.666...) * 100 = 33.33... -> rounded to 33
      expect(calculateEditPercentage(original, modified)).toBe(33);
    });

    it('should be case-insensitive', () => {
      const original = 'This Is A Test';
      const modified = 'this is a test';
      expect(calculateEditPercentage(original, modified)).toBe(0);
    });

    it('should handle different spacing and newlines', () => {
      const original = 'This is a   test with extra   spacing.';
      const modified = 'This is a test \n with extra spacing.';
      // Tokenization should normalize these to be the same
      expect(calculateEditPercentage(original, modified)).toBe(0);
    });

    it('should handle a more complex change', () => {
        const original = 'The quick brown fox jumps over the lazy dog'; // 9 words
        const modified = 'A quick white cat jumps over the sleeping dog'; // 9 words
        // Union: {the, quick, brown, fox, jumps, over, lazy, dog, a, white, cat, sleeping} -> 12 words
        // Intersection: {quick, jumps, over, the, dog} -> 5 words
        // Similarity = 5 / 12 = 0.4166...
        // Edit Percentage = (1 - 0.4166...) * 100 = 58.33... -> rounded to 58
        expect(calculateEditPercentage(original, modified)).toBe(58);
    });
  });
});