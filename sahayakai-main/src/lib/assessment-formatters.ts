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
            const short = truncate(q.questionText, 80);
            lines.push(
                `${i + 1}. ${short} — ${eff.marksAwarded.toFixed(1)} / ${q.marksMax}`,
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
            lines.push(`${i + 1}. ${q.questionText}`);
            lines.push(`   Marks: ${eff.marksAwarded.toFixed(1)} / ${q.marksMax}`);
            if (eff.studentFacingFeedback) {
                lines.push(`   ${eff.studentFacingFeedback}`);
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

function truncate(s: string, n: number): string {
    if (!s) return '';
    if (s.length <= n) return s;
    return s.slice(0, n - 1).trimEnd() + '…';
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
