/**
 * Quiz generator dispatcher (Phase E.1) — 3-variant + multimodal.
 */
import {
    generateQuiz,
    type QuizGeneratorOutput,
    type QuizVariantsOutput,
} from '@/ai/flows/quiz-generator';
import type { QuizGeneratorInput } from '@/ai/schemas/quiz-generator-schemas';
import {
    callSidecarQuiz,
    QuizSidecarBehaviouralError,
    QuizSidecarConfigError,
    QuizSidecarHttpError,
    QuizSidecarTimeoutError,
    type SidecarQuizRequest,
    type SidecarQuizResponse,
    type SidecarQuizVariant,
} from './quiz-client';

export type QuizSidecarMode = 'off' | 'shadow' | 'canary' | 'full';

export interface QuizSidecarDecision {
    mode: QuizSidecarMode;
    reason: string;
    bucket: number;
}

function userBucket(uid: string): number {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    return Math.abs(hash) % 100;
}

function readMode(): QuizSidecarMode {
    const raw = (process.env.SAHAYAKAI_QUIZ_MODE ?? '').toLowerCase();
    if (raw === 'shadow' || raw === 'canary' || raw === 'full') return raw;
    return 'off';
}

function readPercent(): number {
    const raw = process.env.SAHAYAKAI_QUIZ_PERCENT;
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
}

export function decideQuizDispatch(uid: string): QuizSidecarDecision {
    const mode = readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = readPercent();
    if (bucket < percent) return { mode, reason: `bucket_${bucket}_under_${percent}`, bucket };
    return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket };
}

export type QuizDispatchSource = 'genkit' | 'sidecar' | 'genkit_fallback';

export interface DispatchedQuiz extends QuizVariantsOutput {
    source: QuizDispatchSource;
    decision: QuizSidecarDecision;
    sidecarTelemetry?: {
        sidecarVersion: string;
        latencyMs: number;
        modelUsed: string;
        variantsGenerated: number;
    };
}

export interface QuizDispatchInput extends QuizGeneratorInput {
    userId: string;
}

function inputToSidecarRequest(input: QuizDispatchInput): SidecarQuizRequest {
    return {
        topic: input.topic,
        imageDataUri: input.imageDataUri ?? null,
        numQuestions: input.numQuestions,
        questionTypes: input.questionTypes,
        gradeLevel: input.gradeLevel ?? null,
        language: input.language ?? null,
        bloomsTaxonomyLevels: input.bloomsTaxonomyLevels ?? null,
        targetDifficulty: input.targetDifficulty ?? null,
        subject: input.subject ?? null,
        teacherContext: input.teacherContext ?? null,
        userId: input.userId,
    };
}

function variantToGenkit(
    v: SidecarQuizVariant | null,
): QuizGeneratorOutput | null {
    if (!v) return null;
    return {
        title: v.title,
        questions: v.questions.map((q) => ({
            questionText: q.questionText,
            questionType: q.questionType,
            options: q.options ?? undefined,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation,
            difficultyLevel: q.difficultyLevel,
        })),
        teacherInstructions: v.teacherInstructions ?? undefined,
        gradeLevel: v.gradeLevel,
        subject: v.subject,
    };
}

function sidecarToDispatched(
    res: SidecarQuizResponse,
    decision: QuizSidecarDecision,
): DispatchedQuiz {
    return {
        easy: variantToGenkit(res.easy),
        medium: variantToGenkit(res.medium),
        hard: variantToGenkit(res.hard),
        topic: res.topic,
        gradeLevel: res.gradeLevel,
        subject: res.subject,
        isSaved: false,
        source: 'sidecar',
        decision,
        sidecarTelemetry: {
            sidecarVersion: res.sidecarVersion,
            latencyMs: res.latencyMs,
            modelUsed: res.modelUsed,
            variantsGenerated: res.variantsGenerated,
        },
    };
}

function genkitToDispatched(
    out: QuizVariantsOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: QuizSidecarDecision,
): DispatchedQuiz {
    return { ...out, source, decision };
}

async function runGenkitSafe(input: QuizDispatchInput) {
    try {
        const out = await generateQuiz(input);
        return { ok: true as const, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e };
    }
}

async function runSidecarSafe(request: SidecarQuizRequest) {
    const startedAt = Date.now();
    try {
        const res = await callSidecarQuiz(request);
        return { ok: true as const, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false as const, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(decision: QuizSidecarDecision, payload: Record<string, unknown>): void {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
        event: 'quiz.dispatch',
        mode: decision.mode,
        reason: decision.reason,
        bucket: decision.bucket,
        ...payload,
    }));
}

export async function dispatchQuiz(input: QuizDispatchInput): Promise<DispatchedQuiz> {
    const decision = decideQuizDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await generateQuiz(input);
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
            sidecarVariantsGenerated: sidecar.ok ? sidecar.res.variantsGenerated : undefined,
        });
        if (!genkit.ok) throw genkit.error;
        return genkitToDispatched(genkit.out, 'genkit', decision);
    }

    const sidecar = await runSidecarSafe(sidecarRequest);
    if (sidecar.ok) {
        logDispatch(decision, {
            source: 'sidecar',
            uid: input.userId,
            sidecarLatencyMs: sidecar.latencyMs,
            variantsGenerated: sidecar.res.variantsGenerated,
        });
        return sidecarToDispatched(sidecar.res, decision);
    }

    const errorClass =
        sidecar.error instanceof QuizSidecarBehaviouralError ? 'behavioural'
        : sidecar.error instanceof QuizSidecarTimeoutError ? 'timeout'
        : sidecar.error instanceof QuizSidecarHttpError ? 'http'
        : sidecar.error instanceof QuizSidecarConfigError ? 'config'
        : 'unknown';

    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.userId,
        sidecarErrorClass: errorClass,
        sidecarLatencyMs: sidecar.latencyMs,
    });

    const out = await generateQuiz(input);
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
