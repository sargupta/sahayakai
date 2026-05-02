/**
 * Exam paper generator dispatcher (Phase E.2).
 */
import {
    generateExamPaper,
    type ExamPaperInput,
    type ExamPaperOutput,
} from '@/ai/flows/exam-paper-generator';
import {
    callSidecarExamPaper,
    ExamPaperSidecarBehaviouralError,
    ExamPaperSidecarConfigError,
    ExamPaperSidecarHttpError,
    ExamPaperSidecarTimeoutError,
    type SidecarExamPaperRequest,
    type SidecarExamPaperResponse,
} from './exam-paper-client';

export type ExamPaperSidecarMode = 'off' | 'shadow' | 'canary' | 'full';

export interface ExamPaperSidecarDecision {
    mode: ExamPaperSidecarMode;
    reason: string;
    bucket: number;
}

function userBucket(uid: string): number {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    return Math.abs(hash) % 100;
}

function readMode(): ExamPaperSidecarMode {
    const raw = (process.env.SAHAYAKAI_EXAM_PAPER_MODE ?? '').toLowerCase();
    if (raw === 'shadow' || raw === 'canary' || raw === 'full') return raw;
    return 'off';
}

function readPercent(): number {
    const raw = process.env.SAHAYAKAI_EXAM_PAPER_PERCENT;
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
}

export function decideExamPaperDispatch(uid: string): ExamPaperSidecarDecision {
    const mode = readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = readPercent();
    if (bucket < percent) return { mode, reason: `bucket_${bucket}_under_${percent}`, bucket };
    return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket };
}

export type ExamPaperDispatchSource = 'genkit' | 'sidecar' | 'genkit_fallback';

export interface DispatchedExamPaper extends ExamPaperOutput {
    source: ExamPaperDispatchSource;
    decision: ExamPaperSidecarDecision;
    sidecarTelemetry?: { sidecarVersion: string; latencyMs: number; modelUsed: string };
}

export interface ExamPaperDispatchInput extends ExamPaperInput {
    userId: string;
}

function inputToSidecarRequest(input: ExamPaperDispatchInput): SidecarExamPaperRequest {
    return {
        board: input.board,
        gradeLevel: input.gradeLevel,
        subject: input.subject,
        chapters: input.chapters ?? [],
        duration: input.duration ?? null,
        maxMarks: input.maxMarks ?? null,
        language: input.language ?? 'English',
        difficulty: input.difficulty ?? 'mixed',
        includeAnswerKey: input.includeAnswerKey ?? true,
        includeMarkingScheme: input.includeMarkingScheme ?? true,
        teacherContext: input.teacherContext ?? null,
        userId: input.userId,
    };
}

function sidecarToDispatched(
    res: SidecarExamPaperResponse,
    decision: ExamPaperSidecarDecision,
): DispatchedExamPaper {
    return {
        title: res.title,
        board: res.board,
        subject: res.subject,
        gradeLevel: res.gradeLevel,
        duration: res.duration,
        maxMarks: res.maxMarks,
        generalInstructions: res.generalInstructions,
        sections: res.sections.map((s) => ({
            name: s.name,
            label: s.label,
            totalMarks: s.totalMarks,
            questions: s.questions.map((q) => ({
                number: q.number,
                text: q.text,
                marks: q.marks,
                options: q.options ?? undefined,
                internalChoice: q.internalChoice ?? undefined,
                answerKey: q.answerKey ?? undefined,
                markingScheme: q.markingScheme ?? undefined,
                source: q.source,
            })),
        })),
        blueprintSummary: res.blueprintSummary,
        pyqSources: res.pyqSources?.map((p) => ({
            id: p.id,
            year: p.year ?? undefined,
            chapter: p.chapter ?? undefined,
        })) ?? undefined,
        source: 'sidecar',
        decision,
        sidecarTelemetry: {
            sidecarVersion: res.sidecarVersion,
            latencyMs: res.latencyMs,
            modelUsed: res.modelUsed,
        },
    };
}

function genkitToDispatched(
    out: ExamPaperOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: ExamPaperSidecarDecision,
): DispatchedExamPaper {
    return { ...out, source, decision };
}

async function runGenkitSafe(input: ExamPaperInput) {
    try {
        const out = await generateExamPaper(input);
        return { ok: true as const, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e };
    }
}

async function runSidecarSafe(request: SidecarExamPaperRequest) {
    const startedAt = Date.now();
    try {
        const res = await callSidecarExamPaper(request);
        return { ok: true as const, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(decision: ExamPaperSidecarDecision, payload: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
        event: 'exam_paper.dispatch',
        mode: decision.mode,
        reason: decision.reason,
        bucket: decision.bucket,
        ...payload,
    }));
}

export async function dispatchExamPaper(
    input: ExamPaperDispatchInput,
): Promise<DispatchedExamPaper> {
    const decision = decideExamPaperDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await generateExamPaper(input);
        logDispatch(decision, { source: 'genkit', uid: input.userId });
        return genkitToDispatched(out, 'genkit', decision);
    }

    if (decision.mode === 'shadow') {
        const [genkit, sidecar] = await Promise.all([
            runGenkitSafe(input),
            runSidecarSafe(sidecarRequest),
        ]);
        logDispatch(decision, {
            source: 'genkit',
            uid: input.userId,
            sidecarOk: sidecar.ok,
            sidecarLatencyMs: sidecar.latencyMs,
        });
        if (!genkit.ok) throw genkit.error;
        return genkitToDispatched(genkit.out, 'genkit', decision);
    }

    const sidecar = await runSidecarSafe(sidecarRequest);
    if (sidecar.ok) {
        logDispatch(decision, { source: 'sidecar', uid: input.userId, sidecarLatencyMs: sidecar.latencyMs });
        return sidecarToDispatched(sidecar.res, decision);
    }

    const errorClass =
        sidecar.error instanceof ExamPaperSidecarBehaviouralError ? 'behavioural'
        : sidecar.error instanceof ExamPaperSidecarTimeoutError ? 'timeout'
        : sidecar.error instanceof ExamPaperSidecarHttpError ? 'http'
        : sidecar.error instanceof ExamPaperSidecarConfigError ? 'config'
        : 'unknown';

    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.userId,
        sidecarErrorClass: errorClass,
        sidecarLatencyMs: sidecar.latencyMs,
    });

    const out = await generateExamPaper(input);
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
