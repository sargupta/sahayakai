/**
 * @fileOverview Grading for the quiz "Play" mode. Pure, no React.
 *
 * The generator stores `correctAnswer` as free text, and the model writes it
 * several ways for the same multiple-choice question: the option text
 * ("Photosynthesis"), a bare letter ("B"), a labelled option ("(b)
 * Photosynthesis") or a True/False word. `correctOptionIndex` resolves all of
 * those to the option the learner can pick; when it cannot resolve one
 * unambiguously it returns null and the question is graded "review" rather
 * than guessed, so a learner is never told a right answer was wrong.
 *
 * Typed answers (fill in the blanks, short answer) are auto-marked only when
 * they match the key after normalising case, spacing and punctuation. Anything
 * else is "review": the learner sees the key and marks themselves.
 */

export interface GradableQuestion {
    questionType: string;
    options?: string[];
    correctAnswer: string;
}

export interface QuizResponse {
    /** The option the learner picked (multiple choice / true-false). */
    optionIndex?: number;
    /** What the learner typed (fill in the blanks / short answer). */
    text?: string;
    /** The learner's own verdict on a "review" answer, after seeing the key. */
    selfMark?: "correct" | "incorrect";
}

export type QuizGrade = "correct" | "incorrect" | "review";

// One or more leading option labels: "(a) ", "a) ", "a. ", "A: ", "Option A - ".
const LABEL_RE = /^(?:\s*(?:option\s+)?(?:\(([a-h])\)|([a-h])\s*[.):-]))+\s*/i;
const BARE_LETTER_RE = /^\s*(?:option\s+)?\(?([a-h])\)?\s*[.):]?\s*$/i;

/** Lower-case, label-free, single-spaced, without trailing punctuation. */
export function normaliseAnswer(value: string): string {
    return (value ?? "")
        .replace(LABEL_RE, "")
        .toLowerCase()
        .replace(/[\s ]+/g, " ")
        .replace(/^[\s"'“”‘’]+|[\s"'“”‘’.!?,;:]+$/g, "")
        .trim();
}

function letterIndex(letter: string): number {
    return letter.toLowerCase().charCodeAt(0) - 97;
}

/** Index of the option `correctAnswer` refers to, or null when it is ambiguous. */
export function correctOptionIndex(q: GradableQuestion): number | null {
    const options = q.options ?? [];
    if (!options.length || !q.correctAnswer) return null;
    const key = normaliseAnswer(q.correctAnswer);
    const normalised = options.map(normaliseAnswer);

    // 1. The key is the option's text (labels on either side ignored).
    const exact = normalised.flatMap((o, i) => (o === key && key ? [i] : []));
    if (exact.length === 1) return exact[0];

    // 2. The key is a bare letter: "B", "(b)", "Option C".
    const bare = q.correctAnswer.match(BARE_LETTER_RE);
    if (bare) {
        const i = letterIndex(bare[1]);
        return i >= 0 && i < options.length ? i : null;
    }

    // 3. The key starts with a label: "(b) Photosynthesis".
    const labelled = q.correctAnswer.match(LABEL_RE);
    if (labelled) {
        const i = letterIndex(labelled[1] ?? labelled[2]);
        if (i >= 0 && i < options.length) return i;
    }

    // 4. One option's text appears inside the key ("The answer is mitochondria").
    const contained = normalised.flatMap((o, i) => (o && key.includes(o) ? [i] : []));
    if (contained.length === 1) return contained[0];

    return null;
}

/** Grade one response. Unanswered questions are "incorrect". */
export function gradeResponse(q: GradableQuestion, r: QuizResponse | undefined): QuizGrade {
    if (!r) return "incorrect";
    const hasOptions = !!q.options?.length;
    if (hasOptions && r.optionIndex !== undefined) {
        const right = correctOptionIndex(q);
        if (right !== null) return r.optionIndex === right ? "correct" : "incorrect";
        if (r.selfMark) return r.selfMark;
        return "review";
    }
    const typed = (r.text ?? "").trim();
    if (!typed) return "incorrect";
    if (normaliseAnswer(typed) === normaliseAnswer(q.correctAnswer)) return "correct";
    if (r.selfMark) return r.selfMark;
    return "review";
}

export interface QuizScore {
    correct: number;
    incorrect: number;
    review: number;
    total: number;
    /** Correct over total, 0–100, rounded. */
    percent: number;
}

export function scoreQuiz(questions: GradableQuestion[], responses: Record<number, QuizResponse>): QuizScore {
    const grades = questions.map((q, i) => gradeResponse(q, responses[i]));
    const correct = grades.filter((g) => g === "correct").length;
    const incorrect = grades.filter((g) => g === "incorrect").length;
    const review = grades.filter((g) => g === "review").length;
    const total = questions.length;
    return { correct, incorrect, review, total, percent: total ? Math.round((correct / total) * 100) : 0 };
}
