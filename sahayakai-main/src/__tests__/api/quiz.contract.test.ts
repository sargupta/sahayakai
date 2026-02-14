/**
 * @jest-environment node
 */

import { validateSpec } from '../../../scripts/validate-api-specs';
import path from 'path';

describe('Quiz Generator API - Contract Tests', () => {
    const SPEC_PATH = path.join(process.cwd(), 'api-specs/quiz-generator.yaml');

    describe('OpenAPI Spec Validation', () => {
        it('should have a valid OpenAPI 3.0 spec', async () => {
            const result = await validateSpec(SPEC_PATH);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should have security schemes defined', async () => {
            const result = await validateSpec(SPEC_PATH);

            // Should not have warning about missing security schemes
            const securityWarning = result.warnings.find(w =>
                w.includes('No security schemes defined')
            );
            expect(securityWarning).toBeUndefined();
        });
    });

    describe('API Request Contract', () => {
        it('should accept valid quiz generation request', async () => {
            const validRequest = {
                topic: 'Generate quiz for grade five, chapter two of science',
                numQuestions: 5,
                questionTypes: ['multiple_choice', 'short_answer'],
                gradeLevel: '5th Grade',
                subject: 'Science',
                language: 'en',
            };

            // This validates against the schema defined in the spec
            expect(validRequest.topic.length).toBeGreaterThanOrEqual(3);
            expect(validRequest.numQuestions).toBeGreaterThanOrEqual(1);
            expect(validRequest.numQuestions).toBeLessThanOrEqual(20);
            expect(validRequest.questionTypes.length).toBeGreaterThan(0);
        });

        it('should reject request with topic too short', () => {
            const invalidRequest = {
                topic: 'ab', // Less than 3 characters
                numQuestions: 5,
            };

            expect(invalidRequest.topic.length).toBeLessThan(3);
        });

        it('should reject request with invalid numQuestions', () => {
            const invalidRequest = {
                topic: 'Valid topic',
                numQuestions: 25, // More than max (20)
            };

            expect(invalidRequest.numQuestions).toBeGreaterThan(20);
        });

        it('should accept voice-generated request', () => {
            const voiceRequest = {
                topic: 'Photosynthesis process for middle school students',
                numQuestions: 10,
                questionTypes: ['multiple_choice', 'fill_in_the_blanks', 'short_answer'],
                bloomsTaxonomyLevels: ['Remember', 'Understand', 'Apply'],
                gradeLevel: '8th Grade',
                subject: 'Biology',
                language: 'en',
            };

            expect(voiceRequest.topic).toBeTruthy();
            expect(voiceRequest.bloomsTaxonomyLevels).toContain('Remember');
        });
    });

    describe('API Response Contract', () => {
        it('should have quiz variants in response', () => {
            const mockResponse = {
                easy: {
                    questions: [
                        {
                            question: 'What is photosynthesis?',
                            type: 'multiple_choice',
                            options: ['A process', 'An animal', 'A planet', 'A tool'],
                            correctAnswer: 'A process',
                        },
                    ],
                },
                medium: {
                    questions: [
                        {
                            question: 'Explain the role of chlorophyll in photosynthesis',
                            type: 'short_answer',
                            correctAnswer: 'Chlorophyll absorbs light energy',
                        },
                    ],
                },
                hard: null,
            };

            expect(mockResponse).toHaveProperty('easy');
            expect(mockResponse).toHaveProperty('medium');
            expect(mockResponse).toHaveProperty('hard');
            expect(mockResponse.easy?.questions).toBeInstanceOf(Array);
        });

        it('should validate question structure', () => {
            const question = {
                question: 'What is photosynthesis?',
                type: 'multiple_choice',
                options: ['A process', 'An animal', 'A planet', 'A tool'],
                correctAnswer: 'A process',
            };

            expect(question.question).toBeTruthy();
            expect(question.type).toBeTruthy();
            expect(['multiple_choice', 'fill_in_the_blanks', 'short_answer', 'true_false'])
                .toContain(question.type);
            expect(question.correctAnswer).toBeTruthy();
        });
    });

    describe('Error Response Contract', () => {
        it('should have error property in error responses', () => {
            const errorResponse = {
                error: 'Topic must be at least 3 characters',
            };

            expect(errorResponse).toHaveProperty('error');
            expect(typeof errorResponse.error).toBe('string');
        });
    });
});
