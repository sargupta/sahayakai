import { getContextExamples, getIndianContextPrompt, IndianContext, exampleReplacements } from '@/lib/indian-context';

describe('Indian Context Utilities', () => {

    describe('IndianContext Data', () => {
        it('should have required categories', () => {
            expect(IndianContext.food).toBeDefined();
            expect(IndianContext.agriculture).toBeDefined();
            expect(IndianContext.weather).toBeDefined();
            expect(IndianContext.festivals).toBeDefined();
        });

        it('should have items in each category', () => {
            expect(IndianContext.food.common.length).toBeGreaterThan(0);
            expect(IndianContext.agriculture.crops).toContain('wheat');
            expect(IndianContext.festivals.major).toContain('Diwali');
        });
    });

    describe('getContextExamples', () => {
        it('should return examples for Mathematics', () => {
            const examples = getContextExamples('Mathematics', 'Topic');
            expect(examples.length).toBeGreaterThan(0);
            expect(examples[0]).toContain('bigha'); // Check specific content
        });

        it('should return examples for Science', () => {
            const examples = getContextExamples('Science', 'Topic');
            expect(examples.length).toBeGreaterThan(0);
        });

        it('should handle subject case insensitivity', () => {
            const examples = getContextExamples('mAtHeMaTiCs', 'Topic');
            expect(examples.length).toBeGreaterThan(0);
        });

        it('should return empty array for unknown subject', () => {
            const examples = getContextExamples('UnknownSubject', 'Topic');
            expect(examples).toEqual([]);
        });
    });

    describe('exampleReplacements', () => {
        it('should map Western terms to Indian terms', () => {
            expect(exampleReplacements['pizza']).toBe('paratha');
            expect(exampleReplacements['$']).toBe('₹');
            expect(exampleReplacements['football']).toBe('cricket');
        });
    });

    describe('getIndianContextPrompt', () => {
        it('should return empty string if isRural is false', () => {
            const prompt = getIndianContextPrompt(false);
            expect(prompt).toBe('');
        });

        it('should return robust prompt if isRural is true', () => {
            const prompt = getIndianContextPrompt(true);
            expect(prompt).toContain('Indian Rural Context');
            expect(prompt).toContain('Avoid Western examples');
            expect(prompt).toContain('Use Indian currency');
        });
    });
});
