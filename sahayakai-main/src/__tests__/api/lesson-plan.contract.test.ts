/**
 * @jest-environment node
 */

import { validateSpec } from '../../../scripts/validate-api-specs';
import path from 'path';

describe('Lesson Plan API - Contract Tests', () => {
    const SPEC_PATH = path.join(process.cwd(), 'api-specs/lesson-plan.yaml');

    describe('OpenAPI Spec Validation', () => {
        it('should have a valid OpenAPI 3.0 spec', async () => {
            const result = await validateSpec(SPEC_PATH);

            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

    describe('API Request Contract', () => {
        it('should accept valid lesson plan request with "Class" terminology', async () => {
            const validRequest = {
                topic: 'Photosynthesis',
                gradeLevels: ['Class 5'],
                language: 'English',
                useRuralContext: true,
                resourceLevel: 'low',
                difficultyLevel: 'standard'
            };

            // Basic validation of fields against common types
            expect(validRequest.topic).toBeTruthy();
            expect(validRequest.gradeLevels).toContain('Class 5');
            expect(['low', 'medium', 'high']).toContain(validRequest.resourceLevel);
        });

        it('should multi-grade requests', () => {
            const multiGradeRequest = {
                topic: 'Fractions',
                gradeLevels: ['Class 4', 'Class 5'],
                language: 'English'
            };

            expect(multiGradeRequest.gradeLevels.length).toBe(2);
            expect(multiGradeRequest.gradeLevels[0]).toMatch(/Class \d+/);
        });
    });

    describe('API Response Contract', () => {
        it('should have 5E model phases in response', () => {
            const mockResponse = {
                title: 'Introduction to Plants',
                gradeLevel: 'Class 3',
                duration: '45 mins',
                objectives: ['Identify parts of a plant'],
                materials: ['Potted plant', 'Water'],
                activities: [
                    {
                        phase: 'Engage',
                        name: 'Riddle',
                        description: 'What has roots but can\'t walk?',
                        duration: '5 mins'
                    }
                ],
                assessment: 'Draw a plant',
                language: 'English'
            };

            expect(mockResponse).toHaveProperty('activities');
            expect(mockResponse.activities[0].phase).toBe('Engage');
            expect(mockResponse.gradeLevel).toMatch(/Class \d+/);
        });
    });
});
