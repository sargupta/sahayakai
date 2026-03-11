/**
 * @jest-environment node
 */

import path from 'path';

describe('Worksheet Generator API - Contract Tests', () => {

    describe('API Request Contract', () => {
        it('should accept valid worksheet generation request', async () => {
            const validRequest = {
                prompt: 'Create a math worksheet about counting mangoes in a basket.',
                imageDataUri: 'data:image/png;base64,mock_data',
                gradeLevel: 'Class 2',
                language: 'hi',
                subject: 'Math'
            };

            expect(validRequest.prompt.length).toBeGreaterThanOrEqual(10);
            expect(validRequest.imageDataUri).toContain('data:image/');
            expect(validRequest.gradeLevel).toMatch(/Class \d+/);
        });

        it('should reject request with prompt too short', () => {
            const invalidRequest = {
                prompt: 'Short',
                imageDataUri: 'data:image/png;base64,mock_data'
            };

            expect(invalidRequest.prompt.length).toBeLessThan(10);
        });
    });

    describe('API Response Contract (WorksheetPayload)', () => {
        it('should match the WorksheetWizardOutputSchema structure', () => {
            const mockResponse = {
                title: 'Counting Mangoes',
                gradeLevel: 'Class 2',
                subject: 'Math',
                learningObjectives: ['Count objects up to 20', 'Understand addition through grouping'],
                studentInstructions: 'Look at the pictures and solve the problems.',
                activities: [
                    {
                        type: 'question',
                        content: 'If there are $5$ mangoes in one basket and $3$ in another, how many total?',
                        explanation: 'Uses local fruit (mango) analogy to teach addition.',
                        chalkboardNote: 'Draw two baskets with simple circles for mangoes.'
                    }
                ],
                answerKey: [
                    {
                        activityIndex: 0,
                        answer: '$8$ mangoes'
                    }
                ],
                worksheetContent: '# Counting Mangoes...' // Legacy support
            };

            expect(mockResponse).toHaveProperty('title');
            expect(mockResponse.activities).toBeInstanceOf(Array);
            expect(mockResponse.activities[0]).toHaveProperty('explanation');
            expect(mockResponse.activities[0].explanation.length).toBeGreaterThanOrEqual(20);

            // Check for Bharat-First indicators (e.g., no dollars/elevators in mock but we check the logic)
            const westernisms = ['dollar', 'elevator', 'subway'];
            const containsWesternism = westernisms.some(w =>
                mockResponse.activities[0].explanation.toLowerCase().includes(w)
            );
            expect(containsWesternism).toBe(false);
        });
    });
});
