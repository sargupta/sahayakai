/**
 * The class an on-screen example prompt names: "… for Grade 5" → "Class 5", "… for 1st graders"
 * → "Class 1", "Class 8 …" → "Class 8". Null when the example names none.
 */
export function gradeFromExamplePrompt(prompt: string): string | null {
    const m =
        prompt.match(/\b(?:grades?|class(?:es)?|std\.?|standard)\s*(\d{1,2})\b/i) ??
        prompt.match(/\b(\d{1,2})(?:st|nd|rd|th)\s*(?:grade|graders?|class|std)\b/i);
    const n = m ? Number(m[1]) : NaN;
    return Number.isInteger(n) && n >= 1 && n <= 12 ? `Class ${n}` : null;
}
