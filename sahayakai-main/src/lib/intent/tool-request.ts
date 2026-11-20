/**
 * A request that names a SahayakAI tool and asks for it ("help me generate a lesson plan",
 * "क्विज़ बनाओ") opens that tool, even when the model classifier answered `unknown` or
 * `instantAnswer`.
 *
 * Production, 17 Nov 2026: "help me generate a lesson plan" (no topic yet) was classified
 * `unknown`, and /api/ai/intent turned `unknown` into an instant answer, so VIDYA replied
 * with one ungrounded sentence instead of opening the lesson planner. Questions ABOUT a tool
 * ("what is a rubric?") have no asking verb and still get an answer.
 */

export type ToolIntent = 'lessonPlan' | 'quiz' | 'worksheet' | 'examPaper' | 'rubric' | 'visualAid';

const TOOLS: Array<[ToolIntent, RegExp]> = [
    ['lessonPlan', /lesson\s*-?\s*plan|पाठ\s*योजना|लेसन\s*प्लान|পাঠ\s*পরিকল্পনা|লেসন\s*প্ল্যান/i],
    ['examPaper', /(exam|question|test)\s*-?\s*paper|प्रश्न\s*पत्र|प्रश्नपत्र|প্রশ্ন\s*পত্র|প্রশ্নপত্র/i],
    ['quiz', /\bquiz(zes)?\b|क्विज़?|কুইজ/i],
    ['worksheet', /work\s*-?\s*sheet|वर्कशीट|ওয়ার্কশিট/i],
    ['rubric', /\brubrics?\b|रूब्रिक|রুব্রিক/i],
    ['visualAid', /visual\s*-?\s*aid|चार्ट\s*बना|diagram\s+(for|of|on)/i],
];

/** Asking verbs: create / make / generate / prepare / write / need / want / help me, in English, Hindi and Bengali. */
const ASK = /\b(create|make|generate|prepare|build|design|write|draft|need|want|give\s+me|help\s+me|can\s+you|please)\b|बनाओ|बनाइए|बनाएं|बना\s*दो|बना\s*दीजिए|तैयार\s*कर|चाहिए|দাও|তৈরি\s*কর|বানাও|বানিয়ে|চাই/i;

/** The tool this request asks for, or null when it names none or does not ask for one. */
export function toolRequested(prompt: string): ToolIntent | null {
    if (!ASK.test(prompt)) return null;
    for (const [tool, re] of TOOLS) if (re.test(prompt)) return tool;
    return null;
}
