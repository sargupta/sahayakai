/**
 * Quiz Play-mode grading. The class of bug this pins: telling a learner a right
 * answer is wrong because the key was written differently from the option
 * ("B" vs "(b) Photosynthesis" vs "Photosynthesis"). Every spelling the model
 * uses must resolve to the same option, and an unresolvable key must grade
 * "review", never "incorrect".
 */
import { correctOptionIndex, gradeResponse, normaliseAnswer, scoreQuiz } from "@/lib/quiz-scoring";

const mcq = (correctAnswer: string, options = ["(a) Respiration", "(b) Photosynthesis", "(c) Digestion", "(d) Excretion"]) => ({
    questionType: "multiple_choice",
    options,
    correctAnswer,
});

describe("correctOptionIndex", () => {
    it.each([
        ["Photosynthesis"],
        ["photosynthesis."],
        ["B"],
        ["(b)"],
        ["b)"],
        ["Option B"],
        ["(b) Photosynthesis"],
        ["The answer is photosynthesis"],
    ])("resolves %p to option b", (key) => {
        expect(correctOptionIndex(mcq(key))).toBe(1);
    });

    it("resolves unlabelled options and True/False", () => {
        expect(correctOptionIndex(mcq("Digestion", ["Respiration", "Photosynthesis", "Digestion"]))).toBe(2);
        expect(correctOptionIndex({ questionType: "true_false", options: ["True", "False"], correctAnswer: "False" })).toBe(1);
    });

    it("returns null when it cannot tell, instead of guessing", () => {
        expect(correctOptionIndex(mcq("Something else entirely"))).toBeNull();
        expect(correctOptionIndex(mcq("E"))).toBeNull(); // letter past the options
        expect(correctOptionIndex({ questionType: "short_answer", correctAnswer: "x" })).toBeNull();
    });
});

describe("gradeResponse", () => {
    it("marks a picked option right or wrong when the key resolves", () => {
        expect(gradeResponse(mcq("B"), { optionIndex: 1 })).toBe("correct");
        expect(gradeResponse(mcq("B"), { optionIndex: 0 })).toBe("incorrect");
    });

    it("sends an unresolvable key to review, then honours the self-mark", () => {
        const q = mcq("Something else entirely");
        expect(gradeResponse(q, { optionIndex: 0 })).toBe("review");
        expect(gradeResponse(q, { optionIndex: 0, selfMark: "correct" })).toBe("correct");
    });

    it("auto-marks a typed answer only on a normalised match", () => {
        const q = { questionType: "fill_in_the_blanks", correctAnswer: "Chlorophyll" };
        expect(gradeResponse(q, { text: "  chlorophyll. " })).toBe("correct");
        expect(gradeResponse(q, { text: "the green pigment" })).toBe("review");
        expect(gradeResponse(q, { text: "the green pigment", selfMark: "incorrect" })).toBe("incorrect");
        expect(gradeResponse(q, { text: "" })).toBe("incorrect");
        expect(gradeResponse(q, undefined)).toBe("incorrect");
    });
});

describe("scoreQuiz", () => {
    it("counts each grade and rounds the percentage", () => {
        const qs = [mcq("B"), mcq("A"), { questionType: "short_answer", correctAnswer: "Sun" }];
        const s = scoreQuiz(qs, { 0: { optionIndex: 1 }, 1: { optionIndex: 2 }, 2: { text: "the sun's light" } });
        expect(s).toEqual({ correct: 1, incorrect: 1, review: 1, total: 3, percent: 33 });
        expect(scoreQuiz([], {}).percent).toBe(0);
    });
});

describe("normaliseAnswer", () => {
    it("drops labels, case, spacing and closing punctuation", () => {
        expect(normaliseAnswer("(c)   The  Sun!")).toBe("the sun");
        expect(normaliseAnswer("a) a) x")).toBe("x");
    });
});
