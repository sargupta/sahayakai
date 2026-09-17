/**
 * Plain-text formatters for an AssessmentScannerOutput.
 *
 * Two audiences:
 *   - `formatParentSummary` — what the teacher copies/sends to the parent on
 *     WhatsApp. Hides internal teacher notes, low-confidence flags, image
 *     quality warnings. Focuses on the result + how the child can improve.
 *   - `formatStudentHandout` — what gets printed for the student. Includes the
 *     student-facing feedback per question (not the teacher-facing one).
 *
 * Style: plain text, no emojis, no em dashes. Per project memory:
 * `feedback_no_double_dash.md` + `feedback_teacher_tone.md`.
 */

import type { AssessmentScannerOutput } from '@/ai/schemas/assessment-scanner-schemas';
import { effectiveQuestion } from '@/ai/schemas/assessment-scanner-utils';

interface SummaryContext {
    subject?: string;
    gradeLevel?: string;
    studentName?: string;
}

export function formatParentSummary(
    result: AssessmentScannerOutput,
    ctx: SummaryContext = {},
): string {
    const lines: string[] = [];

    lines.push('Assessment Result');
    const meta: string[] = [];
    if (ctx.subject) meta.push(`Subject: ${ctx.subject}`);
    if (ctx.gradeLevel) meta.push(`Class: ${ctx.gradeLevel}`);
    if (meta.length > 0) lines.push(meta.join('  |  '));
    if (ctx.studentName) lines.push(`Student: ${ctx.studentName}`);
    lines.push('');

    if (result.teacherParentNote && result.teacherParentNote.length > 0) {
        result.teacherParentNote.forEach((point) => lines.push(`- ${point}`));
        lines.push('');
    }

    lines.push(
        `Score: ${result.scorePct.toFixed(0)}% (${result.letterGrade})`,
    );
    lines.push(
        `Marks: ${result.totalAwardedMarks.toFixed(1)} of ${result.totalMaxMarks}`,
    );

    if (result.questions.length > 0) {
        lines.push('');
        lines.push('Question-wise marks:');
        result.questions.forEach((q, i) => {
            const eff = effectiveQuestion(q);
            const short = truncate(stripQuestionLabel(latexToReadable(q.questionText)), 80);
            lines.push(
                `${i + 1}. ${short} — ${eff.marksAwarded.toFixed(1)} / ${eff.marksMax}`,
            );
        });
    }

    const weakConcepts = result.conceptMastery
        .filter((c) => c.masteryPct < 60)
        .map((c) => c.chapterTitle);
    if (weakConcepts.length > 0) {
        lines.push('');
        lines.push('Areas to practise:');
        weakConcepts.forEach((c) => lines.push(`- ${c}`));
    }

    if (result.studentRecommendations.length > 0) {
        lines.push('');
        lines.push('Suggestions for this week:');
        result.studentRecommendations.forEach((s, i) =>
            lines.push(`${i + 1}. ${s}`),
        );
    }

    lines.push('');
    lines.push('Sent from SahayakAI');

    return lines.join('\n');
}

export function formatStudentHandout(
    result: AssessmentScannerOutput,
    ctx: SummaryContext = {},
): string {
    const lines: string[] = [];

    lines.push('Your Assessment');
    if (ctx.studentName) lines.push(`Name: ${ctx.studentName}`);
    if (ctx.subject || ctx.gradeLevel) {
        const meta: string[] = [];
        if (ctx.subject) meta.push(`Subject: ${ctx.subject}`);
        if (ctx.gradeLevel) meta.push(`Class: ${ctx.gradeLevel}`);
        lines.push(meta.join('  |  '));
    }
    lines.push('');

    lines.push(`Your score: ${result.scorePct.toFixed(0)}% (${result.letterGrade})`);
    lines.push(
        `You earned ${result.totalAwardedMarks.toFixed(1)} out of ${result.totalMaxMarks} marks.`,
    );

    if (result.questions.length > 0) {
        lines.push('');
        lines.push('Your work, question by question:');
        result.questions.forEach((q, i) => {
            const eff = effectiveQuestion(q);
            lines.push('');
            lines.push(`${i + 1}. ${stripQuestionLabel(latexToReadable(q.questionText))}`);
            lines.push(`   Marks: ${eff.marksAwarded.toFixed(1)} / ${eff.marksMax}`);
            if (eff.improvementPoints.length > 0) {
                lines.push('   How to improve:');
                eff.improvementPoints.forEach((pt) =>
                    lines.push(`   - ${latexToReadable(pt)}`),
                );
            }
        });
    }

    if (result.studentRecommendations.length > 0) {
        lines.push('');
        lines.push('Next steps:');
        result.studentRecommendations.forEach((s, i) =>
            lines.push(`${i + 1}. ${s}`),
        );
    }

    return lines.join('\n');
}

/**
 * Strip a leading question label the paper already carries — "Q.", "Q1.",
 * "Q 1)", "5)", "3." etc. — so it doesn't double up with the UI's own "Q{n}."
 * prefix (and the "{n}." prefix in the parent summary / handout). Conservative:
 * only strips when the text clearly starts with a Q-form or number-form label
 * followed by a separator, so real questions like "Name: …" are left alone.
 */
export function stripQuestionLabel(text: string): string {
    if (!text) return '';
    return text.replace(
        /^\s*(?:Q(?:uestion)?\s*\.?\d*[.):\-]?|\d+[.):\-])\s+/i,
        '',
    );
}

function truncate(s: string, n: number): string {
    if (!s) return '';
    if (s.length <= n) return s;
    return s.slice(0, n - 1).trimEnd() + '…';
}

// LaTeX → plain-text lookups. Only the constructs the scanner prompts actually
// emit for Class 1–10 math (roots, fractions, powers, Greek, common operators).
const GREEK_LETTERS: Record<string, string> = {
    alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', theta: 'θ', lambda: 'λ',
    mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', phi: 'φ', omega: 'ω',
    // Uppercase Greek is case-distinct from lowercase (\Gamma ≠ \gamma).
    Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Sigma: 'Σ',
    Phi: 'Φ', Omega: 'Ω', Pi: 'Π',
};
const MATH_SYMBOLS: Record<string, string> = {
    times: '×', div: '÷', cdot: '·', pm: '±', mp: '∓',
    leq: '≤', le: '≤', geq: '≥', ge: '≥', neq: '≠', ne: '≠',
    approx: '≈', equiv: '≡', infty: '∞', degree: '°',
    ldots: '…', cdots: '…', dots: '…',
    // Arrows / relations that show up in proofs (\Rightarrow ≠ \rightarrow).
    Rightarrow: '⇒', Leftarrow: '⇐', Leftrightarrow: '⇔',
    rightarrow: '→', leftarrow: '←', leftrightarrow: '↔', to: '→',
    implies: '⇒', iff: '⇔',
    in: '∈', notin: '∉', subset: '⊂', subseteq: '⊆',
    forall: '∀', exists: '∃', neg: '¬',
};
const SUPERSCRIPTS: Record<string, string> = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶',
    '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', n: 'ⁿ', i: 'ⁱ',
};

/**
 * Multi-letter LaTeX commands that ARE their own readable form (function /
 * operator names). These are kept as a bare word; every OTHER unmapped command
 * (structural/formatting: \left \right \text \mathbf …) is dropped so it never
 * leaks a garbled token like "left(" or "textx" to a parent/student.
 */
const LATEX_OPERATORS = new Set([
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
    'sinh', 'cosh', 'tanh', 'arcsin', 'arccos', 'arctan',
    'log', 'ln', 'lg', 'exp', 'lim', 'max', 'min',
    'det', 'gcd', 'deg', 'mod',
]);

/** Wrap a fraction/root argument in parens only when it isn't a single token. */
function wrapArg(x: string): string {
    const t = x.trim();
    return /^[\w.]+$/.test(t) ? t : `(${t})`;
}

/** Map a power to Unicode superscripts when every char is representable. */
function toSuperscript(g: string): string {
    const t = g.trim();
    return [...t].every((c) => SUPERSCRIPTS[c])
        ? [...t].map((c) => SUPERSCRIPTS[c]).join('')
        : `^${t}`;
}

/**
 * Best-effort render of inline LaTeX (as emitted by the scanner prompts,
 * wrapped in `$…$`) down to readable plain text for audiences with no math
 * renderer — the WhatsApp parent summary and the printed student handout.
 * NOT a full LaTeX parser: it targets the common primary/secondary-school
 * constructs and, as a safety net, strips any leftover delimiters, command
 * backslashes and braces so raw markup never reaches a parent.
 */
export function latexToReadable(input: string): string {
    if (!input) return '';
    let s = input;
    // 1. Drop math-mode delimiters: $…$, $$…$$, \(…\), \[…\].
    s = s.replace(/\$\$?/g, '').replace(/\\[()[\]]/g, '');
    // 2. \sqrt{x} / \sqrt x  → √x  (parens only for compound args)
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (_m, g) => `√${wrapArg(g)}`);
    s = s.replace(/\\sqrt\s*(\w+)/g, (_m, g) => `√${wrapArg(g)}`);
    // 3. \frac{a}{b} (and \dfrac/\tfrac) → a/b
    s = s.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,
        (_m, a, b) => `${wrapArg(a)}/${wrapArg(b)}`);
    // 4. Powers: x^{2} then x^2 → x²
    s = s.replace(/\^\{([^{}]*)\}/g, (_m, g) => toSuperscript(g));
    s = s.replace(/\^(\w)/g, (_m, g) => toSuperscript(g));
    // 5. Subscripts: keep readable without the braces.
    s = s.replace(/_\{([^{}]*)\}/g, '_$1');
    // 6. Remaining \commands → symbol / Greek / function-name / dropped.
    //    Case-sensitive: \Rightarrow (⇒) ≠ \rightarrow (→), \Gamma (Γ) ≠ \gamma (γ).
    //    An unmapped command that isn't a known operator is DROPPED (not left as
    //    a bare word) so structural markup like \left( / \text{x} / \mathbf{x}
    //    doesn't leak "left(" / "textx" to a parent — the wrapped content (and
    //    surrounding delimiters) survives; only the command token is removed.
    s = s.replace(/\\([a-zA-Z]+)/g, (_m, name: string) => {
        return (
            MATH_SYMBOLS[name] ??
            GREEK_LETTERS[name] ??
            (LATEX_OPERATORS.has(name) ? name : '')
        );
    });
    // 7. Safety net: strip any stray braces and collapse whitespace.
    s = s.replace(/[{}]/g, '').replace(/[ \t]+/g, ' ').trim();
    return s;
}

/**
 * Build a WhatsApp deep link with the given text pre-filled. Works on web
 * (opens WhatsApp Web), iOS, and Android. The teacher picks the recipient
 * inside WhatsApp.
 */
export function whatsappDeepLink(text: string): string {
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/**
 * Best-effort native share. Falls back to a WhatsApp deep link when the
 * browser does not implement the Web Share API.
 */
export async function shareViaNativeOrWhatsapp(
    text: string,
    title = 'SahayakAI Assessment',
): Promise<void> {
    const nav = typeof navigator !== 'undefined' ? navigator : null;
    if (nav && typeof (nav as Navigator & { share?: unknown }).share === 'function') {
        try {
            await (
                nav as Navigator & {
                    share: (data: { title: string; text: string }) => Promise<void>;
                }
            ).share({ title, text });
            return;
        } catch (err) {
            // User cancellation throws AbortError — silently fall through to
            // WhatsApp only on actual failures, not on cancellation.
            if ((err as DOMException)?.name === 'AbortError') return;
        }
    }
    if (typeof window !== 'undefined') {
        window.open(whatsappDeepLink(text), '_blank', 'noopener');
    }
}
