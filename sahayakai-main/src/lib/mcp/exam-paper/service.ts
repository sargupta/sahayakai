import 'server-only';
import type { DispatchedExamPaper, ExamPaperDispatchInput } from '@/lib/sidecar/exam-paper-dispatch';
import { McpCapabilityError } from '../errors';
import type { McpPrincipal } from '../auth';
import { gradeLabel } from '../shared/schema';
import { EXAM_DIFFICULTY_ALIASES, type CreateExamPaperInput, type ExamPaperResult } from './schema';

/**
 * Adapter between the public MCP contract and Sahayak's EXISTING exam-paper
 * service (`dispatchExamPaper`: board blueprints, previous-year-question
 * retrieval, safety check, marks reconciliation, answer-key backfill,
 * Genkit / ADK sidecar). No new AI logic.
 *
 * Headless caller: the exam-paper service treats an EMPTY userId as "no
 * teacher" — every side effect (profile read, teacher context, per-teacher
 * rate limit, Library write, content id) is behind `if (userId)`. So an MCP
 * call writes nothing into any Sahayak account. Per-key rate limiting,
 * tenancy and logging are done by the shared MCP layer instead.
 */
export const HEADLESS_EXAM_PAPER_CALLER = '';

export interface ExamPaperServiceDeps {
    dispatch: (input: ExamPaperDispatchInput) => Promise<DispatchedExamPaper>;
    /** Sahayak's kill switch for this capability (feature flag `examPaperEnabled`). */
    isEnabledFor: (subject: string) => Promise<boolean>;
    /** Whether the whole syllabus can be anchored (board blueprint or NCERT chapter list). */
    canAnchorWholeSyllabus: (board: string, gradeLevel: string, subject: string) => Promise<boolean>;
}

/** Same rule as the app's /api/ai/exam-paper route: no chapters needs a blueprint or NCERT cell. */
export async function defaultCanAnchorWholeSyllabus(board: string, gradeLevel: string, subject: string): Promise<boolean> {
    const { findBlueprint } = await import('@/ai/data/board-blueprints');
    if (await findBlueprint(board, gradeLevel, subject)) return true;
    const { canonicaliseGrade, canonicaliseSubject, getChaptersForCell } = await import('@/ai/data/ncert-chapters');
    const grade = canonicaliseGrade(gradeLevel);
    const canonicalSubject = canonicaliseSubject(subject);
    return grade != null && !!canonicalSubject && getChaptersForCell(grade, canonicalSubject).length > 0;
}

export function toDispatchInput(input: CreateExamPaperInput): ExamPaperDispatchInput {
    const difficulty = input.difficulty in EXAM_DIFFICULTY_ALIASES
        ? EXAM_DIFFICULTY_ALIASES[input.difficulty as keyof typeof EXAM_DIFFICULTY_ALIASES]
        : (input.difficulty as Exclude<CreateExamPaperInput['difficulty'], 'medium'>);
    return {
        userId: HEADLESS_EXAM_PAPER_CALLER,
        board: input.board,
        gradeLevel: gradeLabel(input.grade),
        subject: input.subject,
        chapters: input.chapters,
        language: input.language,
        difficulty,
        includeAnswerKey: input.include_answer_key,
        includeMarkingScheme: input.include_marking_scheme,
        ...(input.max_marks !== undefined ? { maxMarks: input.max_marks } : {}),
        ...(input.duration_minutes !== undefined ? { duration: input.duration_minutes } : {}),
        ...(input.pyq_percent !== undefined ? { pyqRatio: input.pyq_percent } : {}),
    };
}

/** Run the existing service for an authenticated MCP principal. */
export async function createExamPaper(
    input: CreateExamPaperInput,
    principal: McpPrincipal,
    deps: ExamPaperServiceDeps,
): Promise<ExamPaperResult> {
    if (!(await deps.isEnabledFor(`mcp:${principal.orgId}`))) {
        throw new McpCapabilityError('capability_disabled', 'Exam paper generation is currently switched off by Sahayak. Try again later.');
    }
    if (input.chapters.length === 0 && !(await deps.canAnchorWholeSyllabus(input.board, gradeLabel(input.grade), input.subject))) {
        throw new McpCapabilityError(
            'invalid_input',
            `Sahayak has no blueprint or syllabus for ${input.board} Class ${input.grade} ${input.subject}. List the chapters to cover in "chapters".`,
        );
    }
    let paper: DispatchedExamPaper;
    try {
        paper = await deps.dispatch(toDispatchInput(input));
    } catch (err) {
        const name = (err as { name?: string } | null)?.name;
        const code = (err as { errorCode?: string } | null)?.errorCode;
        if (name === 'ExamPaperGenerationInProgressError') {
            throw new McpCapabilityError(
                'timeout',
                'The exam paper took longer than Sahayak\'s generation budget (about 75 seconds). Retry; fewer chapters or lower max_marks generate faster.',
            );
        }
        if (name === 'SchemaValidationError' || code === 'AI-SCHEMA-001') {
            throw new McpCapabilityError(
                'generation_failed',
                'Sahayak could not produce a well-structured paper for this request. Retry, or use fewer chapters or lower max_marks.',
            );
        }
        throw err; // safety, rate-limit, provider errors → shared classifier
    }
    return toExamPaperResult(paper, input);
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);

/** "1 Hour", "45 Minutes", "1 hour 30 minutes", "3 Hrs", "90 min" → minutes; null if unrecognised. */
export function durationMinutes(display: string): number | null {
    const hours = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b/i.exec(display);
    const minutes = /(\d+)\s*(?:minutes?|mins?|m)\b/i.exec(display);
    if (!hours && !minutes) return null;
    return Math.round((hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0));
}

/**
 * Map the service result to the public shape. Only exam content is copied;
 * internal fields (dispatch source/decision, sidecar telemetry, content id,
 * PYQ document ids, self-repair telemetry) are dropped by construction.
 */
export function toExamPaperResult(paper: DispatchedExamPaper, input: CreateExamPaperInput): ExamPaperResult {
    const sections = (Array.isArray(paper.sections) ? paper.sections : []).map((s) => ({
        name: text(s?.name) ?? '',
        label: text(s?.label) ?? '',
        total_marks: num(s?.totalMarks),
        questions: (Array.isArray(s?.questions) ? s.questions : [])
            .filter((q) => q && text(q.text))
            .map((q) => {
                const source = text(q.source);
                return {
                    number: num(q.number),
                    text: text(q.text)!,
                    marks: num(q.marks),
                    origin: source && /^pyq\b/i.test(source) ? 'previous_year' as const : 'new' as const,
                    source_note: source && /^pyq\b/i.test(source) ? source : null,
                    options: Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === 'string' && o.trim() !== '') : [],
                    correct_option: Array.isArray(q.options) && q.options.length > 0 ? text(q.correctOption) : null,
                    internal_choice: text(q.internalChoice),
                    answer_key: input.include_answer_key ? text(q.answerKey) : null,
                    marking_scheme: input.include_marking_scheme ? text(q.markingScheme) : null,
                };
            }),
    })).filter((s) => s.questions.length > 0);

    const total = sections.reduce((sum, s) => sum + s.questions.reduce((a, q) => a + q.marks, 0), 0);
    const notes: string[] = [];
    for (const w of Array.isArray(paper.validationWarnings) ? paper.validationWarnings : []) {
        if (!w?.invalid || !text(w.message)) continue;
        const chapter = text(w.input?.chapter);
        notes.push(chapter
            ? `Chapter "${chapter}" was not found in the Class ${input.grade} ${input.subject} syllabus. ${text(w.message)}`
            : text(w.message)!);
    }
    const placeholders = num(paper.answerKeyCompleteness?.filledByPlaceholder);
    if (placeholders > 0) {
        notes.push(`${placeholders} answer${placeholders === 1 ? '' : 's'} or marking scheme${placeholders === 1 ? '' : 's'} could not be generated reliably and need${placeholders === 1 ? 's' : ''} teacher review.`);
    }
    const questions = sections.flatMap((s) => s.questions);
    const missingAnswers = input.include_answer_key ? questions.filter((q) => !q.answer_key).length : 0;
    if (missingAnswers > 0) notes.push(`${missingAnswers} question${missingAnswers === 1 ? ' has' : 's have'} no answer key; add ${missingAnswers === 1 ? 'it' : 'them'} before use.`);
    const maxMarks = num(paper.maxMarks, input.max_marks ?? total);
    if (total !== maxMarks) notes.push(`Question marks add up to ${total}, not ${maxMarks}; adjust before use.`);
    if (input.max_marks !== undefined && maxMarks !== input.max_marks) {
        notes.push(`The paper is set for ${maxMarks} marks, not the requested ${input.max_marks}.`);
    }
    const printedDuration = text(paper.duration);
    const printedMinutes = printedDuration ? durationMinutes(printedDuration) : null;
    if (input.duration_minutes !== undefined && printedMinutes !== null && printedMinutes !== input.duration_minutes) {
        notes.push(`The paper header says "${printedDuration}", not the requested ${input.duration_minutes} minutes; adjust before use.`);
    }

    return {
        title: text(paper.title) ?? `${input.board} Class ${input.grade} ${input.subject}`,
        board: text(paper.board) ?? input.board,
        grade: input.grade,
        subject: text(paper.subject) ?? input.subject,
        language: input.language,
        duration: text(paper.duration) ?? (input.duration_minutes ? `${input.duration_minutes} minutes` : ''),
        max_marks: maxMarks,
        total_question_marks: total,
        general_instructions: (Array.isArray(paper.generalInstructions) ? paper.generalInstructions : []).map(text).filter((s): s is string => s !== null),
        sections,
        blueprint: {
            chapter_marks: (paper.blueprintSummary?.chapterWise ?? []).filter((c) => text(c?.chapter)).map((c) => ({ chapter: text(c.chapter)!, marks: num(c.marks) })),
            difficulty_mix: (paper.blueprintSummary?.difficultyWise ?? []).filter((d) => text(d?.level)).map((d) => ({ level: text(d.level)!, percentage: num(d.percentage) })),
        },
        previous_year_sources: (Array.isArray(paper.pyqSources) ? paper.pyqSources : []).map((p) => ({
            year: typeof p?.year === 'number' ? p.year : null,
            set: text(p?.set),
            chapter: text(p?.chapter),
        })),
        review_notes: notes,
    };
}

/** Compact Markdown rendering for clients that only read `content`. */
export function renderExamPaperText(paper: ExamPaperResult): string {
    const lines = [`# ${paper.title}`, `${paper.board} · Class ${paper.grade} · ${paper.subject} · ${paper.duration} · ${paper.max_marks} marks`];
    if (paper.general_instructions.length) lines.push('', '## General instructions', ...paper.general_instructions.map((i) => `- ${i}`));
    for (const s of paper.sections) {
        lines.push('', `## ${s.name}${s.label ? ` — ${s.label}` : ''} (${s.total_marks} marks)`);
        for (const q of s.questions) {
            lines.push(`${q.number}. ${q.text} [${q.marks}]`);
            for (const o of q.options) lines.push(`   ${o}`);
            if (q.internal_choice) lines.push(`   OR ${q.internal_choice}`);
        }
    }
    if (paper.review_notes.length) lines.push('', '## Review notes', ...paper.review_notes.map((n) => `- ${n}`));
    return lines.join('\n');
}
