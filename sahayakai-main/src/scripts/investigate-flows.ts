
// Mock server-only before any imports
const Module = require('module');
const originalLoad = Module._load;
Module._load = function (request: string, parent: any, isMain: boolean) {
    if (request === 'server-only') {
        return {};
    }
    return originalLoad(request, parent, isMain);
};

import { instantAnswer } from '@/ai/flows/instant-answer';
import { generateLessonPlan } from '@/ai/flows/lesson-plan-generator';
import { generateVisualAid } from '@/ai/flows/visual-aid-designer';
import { config } from 'dotenv';

// Load env vars
config({ path: '.env.local' });

async function runTests() {
    console.log('--- STARTING DIAGNOSTIC TESTS (Bypassing Server Context) ---');

    // Test 1: Instant Answer
    console.log('\n[TEST 1] Testing Instant Answer...');
    try {
        const start = Date.now();
        const result = await instantAnswer({
            question: "Why do plants need sunlight?",
            gradeLevel: "Class 5",
            language: "English",
            userId: "anonymous_user"
        });
        console.log('✅ Instant Answer Success:', { hasAnswer: !!result.answer, duration: Date.now() - start });
    } catch (error: any) {
        console.error('❌ Instant Answer Failed:', {
            message: error.message,
            code: error.errorCode || error.code,
            stack: error.stack,
            detail: JSON.stringify(error.detail || {}, null, 2),
            errorId: error.errorId
        });
    }

    // Test 2: Visual Aid
    console.log('\n[TEST 2] Testing Visual Aid...');
    try {
        const start = Date.now();
        const result = await generateVisualAid({
            prompt: "Structure of a flower",
            gradeLevel: "Class 5",
            language: "English",
            userId: "anonymous_user"
        });
        console.log('✅ Visual Aid Success:', { hasImage: !!result.imageDataUri, duration: Date.now() - start });
    } catch (error: any) {
        console.error('❌ Visual Aid Failed:', {
            message: error.message,
            code: error.errorCode || error.code,
            detail: JSON.stringify(error.detail || {}, null, 2),
            errorId: error.errorId
        });
    }

    // Test 3: Lesson Plan
    console.log('\n[TEST 3] Testing Lesson Plan...');
    try {
        const start = Date.now();
        const result = await generateLessonPlan({
            topic: "Photosynthesis",
            gradeLevels: ["Class 5"],
            language: "English",
            resourceLevel: "low",
            userId: "anonymous_user"
        });
        console.log('✅ Lesson Plan Success:', { hasTitle: !!result.title, duration: Date.now() - start });
    } catch (error: any) {
        console.error('❌ Lesson Plan Failed:', {
            message: error.message,
            code: error.errorCode || error.code,
            detail: JSON.stringify(error.detail || {}, null, 2),
            errorId: error.errorId
        });
    }
}

runTests().catch(console.error);
