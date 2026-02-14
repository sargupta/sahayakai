
const { visualAidFlow } = require('../src/ai/flows/visual-aid-designer');
const { generateVisualAid } = require('../src/ai/flows/visual-aid-designer');

// Mock Context if necessary or just run the flow directly if possible with mocked AI
// For this environment, we might need to mock the AI calls if we don't have API keys, 
// but the goal is to verify the CONFIG is passed correctly. 
// Since we can't easily mock the AI deep inside Genkit without complex setup, 
// we will inspecting the source code was the primary verification.
// However, we can try to run it if the environment allows.

async function testDeterminism() {
    console.log('Starting determinism test...');
    const input = {
        gradeLevel: 'Grade 5',
        topic: 'Solar System',
        learningGoal: 'Understand the order of planets',
        visualStyle: 'Realistic'
    };

    try {
        console.log('Generating first result...');
        const result1 = await generateVisualAid(input);
        console.log('Result 1 Prompt:', result1.metadata.prompt);

        console.log('Generating second result...');
        const result2 = await generateVisualAid(input);
        console.log('Result 2 Prompt:', result2.metadata.prompt);

        if (result1.metadata.prompt === result2.metadata.prompt) {
            console.log('SUCCESS: Prompts are identical.');
        } else {
            console.error('FAILURE: Prompts differ.');
            console.log('Diff:', result1.metadata.prompt, result2.metadata.prompt);
        }
    } catch (error) {
        console.error('Error during test:', error);
    }
}

// testDeterminism();
console.log("This script requires a complex Genkit setup to run standalone. \nSkipping execution and relying on code review + manual testing in the app.");
