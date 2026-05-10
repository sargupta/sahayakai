/**
 * Exam paper generator dispatcher (Phase E.2).
 *
 * Phase K (P0 #2): canary/full mode now mirrors the Genkit flow's
 * post-call persistence (Storage + Firestore content doc) and the
 * server-side rate limiter. Before Phase K, sidecar-served exam papers
 * silently bypassed the user's library and the daily rate limit.
 *
 * Note: the Genkit `generateExamPaper` does not call `validateTopicSafety`
 * (the topic is structured: board / grade / subject / chapters), so the
 * dispatcher only lifts the rate-limit gate, not the topic-safety gate.
 */
import {
    generateExamPaper,
    type ExamPaperInput,
    type ExamPaperOutput,
} from '@/ai/flows/exam-paper-generator';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    callSidecarExamPaper,
    ExamPaperSidecarBehaviouralError,
    ExamPaperSidecarConfigError,
    ExamPaperSidecarHttpError,
    ExamPaperSidecarTimeoutError,
    type SidecarExamPaperRequest,
    type SidecarExamPaperResponse,
} from './exam-paper-client';
import { persistSidecarJSON } from './persist-helpers';
import { writeAgentShadowDiff } from './shadow-diff-writer';
import { withTimeout } from './with-timeout';

// Mirrors `TIMEOUT_MS` in exam-paper-client.ts. Phase J.2 hot-fix (P0
// #7) — caps the Genkit fallback to the same budget as the sidecar.
const FALLBACK_TIMEOUT_MS = 30_000;

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

// Phase J.5 — flag plane consolidation. See feature-flags.ts.
async function readMode(): Promise<ExamPaperSidecarMode> {
    const flags = await getFeatureFlags();
    return flags.examPaperSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.examPaperSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideExamPaperDispatch(uid: string): Promise<ExamPaperSidecarDecision> {
    const mode = await readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = await readPercent();
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
                // Codegen marks `source` optional; the Genkit-shaped
                // `ExamPaperOutput` requires it. Default to the same
                // tag the Pydantic model uses when the sidecar omits it.
                source: q.source ?? 'AI Generated',
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
        const out = await withTimeout(
            generateExamPaper(input),
            FALLBACK_TIMEOUT_MS,
            'exam-paper genkit fallback',
        );
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
    const decision = await decideExamPaperDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await withTimeout(
            generateExamPaper(input),
            FALLBACK_TIMEOUT_MS,
            'exam-paper genkit fallback',
        );
        logDispatch(decision, { source: 'genkit', uid: input.userId });
        return genkitToDispatched(out, 'genkit', decision);
    }

    if (decision.mode === 'shadow') {
        const shadowStartedAt = Date.now();
        const [genkit, sidecar] = await Promise.all([
            runGenkitSafe(input),
            runSidecarSafe(sidecarRequest),
        ]);
        const genkitLatencyMs = Date.now() - shadowStartedAt;
        logDispatch(decision, {
            source: 'genkit',
            uid: input.userId,
            sidecarOk: sidecar.ok,
            sidecarLatencyMs: sidecar.latencyMs,
        });
        // Phase M.5 — persist (genkit, sidecar) pair for offline parity.
        void writeAgentShadowDiff({
            agent: 'exam-paper',
            uid: input.userId,
            genkit: genkit.ok ? genkit.out : null,
            sidecar: sidecar.ok ? sidecar.res : null,
            genkitLatencyMs,
            sidecarLatencyMs: sidecar.latencyMs,
            sidecarOk: sidecar.ok,
            sidecarError: sidecar.ok ? undefined : sidecar.error.message,
        });
        if (!genkit.ok) throw genkit.error;
        return genkitToDispatched(genkit.out, 'genkit', decision);
    }

    // Phase K — rate limit gate that the Genkit flow's wrapper enforces
    // via the route-level layers. Lifted here so canary/full doesn't blow
    // through the user's daily quota.
    if (input.userId) {
        const { checkServerRateLimit } = await import('@/lib/server-safety');
        await checkServerRateLimit(input.userId);
    }

    const sidecar = await runSidecarSafe(sidecarRequest);
    if (sidecar.ok) {
        // Phase K — persist the exam paper to the user's library so it is
        // available regardless of which AI path served the request.
        const topicForLibrary =
            input.chapters && input.chapters.length > 0
                ? input.chapters.join(', ')
                : input.subject;
        const titleForLibrary =
            sidecar.res.title ||
            `${input.board} ${input.gradeLevel} ${input.subject} Exam Paper`.trim();
        const persistResult = input.userId
            ? await persistSidecarJSON({
                  uid: input.userId,
                  collection: 'exam-papers',
                  contentType: 'exam-paper',
                  title: titleForLibrary,
                  output: sidecar.res,
                  metadata: {
                      gradeLevel:
                          sidecar.res.gradeLevel || input.gradeLevel || 'Class 10',
                      subject: input.subject || sidecar.res.subject || 'General',
                      topic: topicForLibrary,
                      language: input.language || 'English',
                  },
              })
            : null;
        logDispatch(decision, {
            source: 'sidecar',
            uid: input.userId,
            sidecarLatencyMs: sidecar.latencyMs,
            contentId: persistResult?.contentId,
            persisted: persistResult !== null,
        });
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

    const out = await withTimeout(
        generateExamPaper(input),
        FALLBACK_TIMEOUT_MS,
        'exam-paper genkit fallback',
    );
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
