
// Mock server-only before any imports
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request: string, parent: any, isMain: boolean) {
    if (request === 'server-only') {
        return {};
    }
    return originalLoad(request, parent, isMain);
};

import { config } from 'dotenv';
import { generateLessonPlan } from '../ai/flows/lesson-plan-generator';
import { generateQuiz } from '../ai/flows/quiz-generator';
import { generateWorksheet } from '../ai/flows/worksheet-wizard';
import { generateVisualAid } from '../ai/flows/visual-aid-designer';
import { generateRubric } from '../ai/flows/rubric-generator';
import { planVirtualFieldTrip } from '../ai/flows/virtual-field-trip';
import { instantAnswer } from '../ai/flows/instant-answer';
import { getTeacherTrainingAdvice } from '../ai/flows/teacher-training';
import { SaveContentSchema } from '../ai/schemas/content-schemas';
import * as fs from 'fs';
import * as path from 'path';

// Load env vars
config({ path: '.env.local' });

const TEST_USER_ID = 'qa-validation-user';

interface TestResult {
    name: string;
    success: boolean;
    duration: number;
    error?: string;
    schemaValidation?: any;
}

const results: TestResult[] = [];

async function runValidation(name: string, fn: () => Promise<any>, type: string) {
    console.log(`\n[RUNNING] ${name}...`);
    const start = Date.now();
    try {
        const output = await fn();
        const duration = Date.now() - start;

        // Validate against SaveContentSchema
        // We simulate a DB save payload
        const validationPayload = {
            id: '00000000-0000-4000-8000-000000000000', // Dummy UUID
            type: type,
            title: 'QA Test Content',
            gradeLevel: 'Class 6',
            subject: 'Science',
            topic: 'QA Validation',
            language: 'English',
            isPublic: false,
            isDraft: false,
            data: output
        };

        const validation = SaveContentSchema.safeParse(validationPayload);

        if (validation.success) {
            console.log(`✅ ${name} Passed (Duration: ${duration}ms)`);
            results.push({ name, success: true, duration });
        } else {
            console.error(`❌ ${name} Schema Validation Failed:`, JSON.stringify(validation.error.format(), null, 2));
            results.push({
                name,
                success: false,
                duration,
                error: 'Schema Validation Failed',
                schemaValidation: validation.error.format()
            });
        }
    } catch (error: any) {
        const duration = Date.now() - start;
        console.error(`❌ ${name} Executed with Error:`, error.message);
        results.push({ name, success: false, duration, error: error.message });
    }
}

async function main() {
    console.log('🚀 Starting SahayakAI Production-Grade QA Validation Suite');
    console.log('========================================================');

    // 1. Lesson Plan
    await runValidation('Lesson Plan Generator', () => generateLessonPlan({
        topic: 'Water Cycle',
        gradeLevels: ['Class 6'],
        language: 'English',
        userId: TEST_USER_ID
    }), 'lesson-plan');

    // 2. Quiz
    await runValidation('Quiz Generator', () => generateQuiz({
        topic: 'Photosynthesis',
        questionTypes: ['multiple_choice'],
        numQuestions: 2,
        userId: TEST_USER_ID
    }), 'quiz');

    // 3. Worksheet (Minimal input, usually needs image but we test basic prompt)
    // Note: Worksheet might fail if imageDataUri is strictly required by the internal prompt logic
    // We'll provide a dummy base64 if needed, but let's try just prompt first.
    await runValidation('Worksheet Wizard', () => generateWorksheet({
        prompt: 'Basics of Algebra',
        imageDataUri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
        userId: TEST_USER_ID
    }), 'worksheet');

    // 4. Visual Aid
    await runValidation('Visual Aid Designer', () => generateVisualAid({
        prompt: 'A simple diagram of an atom',
        userId: TEST_USER_ID
    }), 'visual-aid');

    // 5. Rubric
    await runValidation('Rubric Generator', () => generateRubric({
        assignmentDescription: 'Write an essay on Indian Independence',
        userId: TEST_USER_ID
    }), 'rubric');

    // 6. Virtual Field Trip
    await runValidation('Virtual Field Trip', () => planVirtualFieldTrip({
        topic: 'Ancient Rome',
        userId: TEST_USER_ID
    }), 'virtual-field-trip');

    // 7. Instant Answer
    await runValidation('Instant Answer', () => instantAnswer({
        question: 'What are the three laws of motion?',
        userId: TEST_USER_ID
    }), 'instant-answer');

    // 8. Teacher Training
    await runValidation('Teacher Training', () => getTeacherTrainingAdvice({
        question: 'How to motivate students for science?',
        userId: TEST_USER_ID
    }), 'teacher-training');

    console.log('\n\n========================================================');
    console.log('📊 FINAL QA SUMMARY');
    console.log('========================================================');
    const total = results.length;
    const passed = results.filter(r => r.success).length;
    console.log(`Total Tests: ${total}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${total - passed}`);

    const reportPath = path.join(process.cwd(), 'sahayakai-qa-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\nReport saved to: ${reportPath}`);

    if (passed < total) {
        process.exit(1);
    }
}

main().catch(error => {
    console.error('CRITICAL FATAL QA ERROR:', error);
    process.exit(1);
});
