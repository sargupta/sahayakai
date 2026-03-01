
import { generateLessonPlan } from './src/ai/flows/lesson-plan-generator';
import { generateQuiz } from './src/ai/flows/quiz-generator';

async function testKannadaSupport() {
    console.log("--- Testing Kannada Support ---");

    try {
        console.log("\n1. Generating Kannada Lesson Plan (5E Model)...");
        const lessonPlan = await generateLessonPlan({
            topic: "ನೀರಿನ ಚಕ್ರ (Water Cycle)",
            language: "kn",
            gradeLevels: ["6th Grade"],
            useRuralContext: true,
            resourceLevel: "low"
        });

        console.log("✅ Lesson Plan Title:", lessonPlan.title);
        console.log("✅ Sample Phase:", lessonPlan.activities[0]?.phase, "-", lessonPlan.activities[0]?.name);
        console.log("✅ Teacher Tip Sample:", lessonPlan.activities[0]?.teacherTips);

        console.log("\n2. Generating Kannada Quiz...");
        const quiz = await generateQuiz({
            topic: "ಭಾರತದ ಇತಿಹಾಸ (Indian History)",
            language: "kn",
            numQuestions: 2,
            questionTypes: ["multiple_choice"],
            gradeLevel: "8th Grade"
        });

        console.log("✅ Quiz Title:", quiz.medium?.title);
        console.log("✅ First Question:", quiz.medium?.questions[0]?.questionText);
        console.log("✅ Explanation Sample:", quiz.medium?.questions[0]?.explanation);

        console.log("\n🚀 KANNADA VERIFICATION COMPLETE");
    } catch (error) {
        console.error("❌ Test Failed:", error);
    }
}

testKannadaSupport();
