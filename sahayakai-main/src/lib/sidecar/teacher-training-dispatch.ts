/**
 * Teacher-training dispatcher (Phase D.2).
 */
import {
    getTeacherTrainingAdvice,
    type TeacherTrainingInput,
    type TeacherTrainingOutput,
} from '@/ai/flows/teacher-training';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    callSidecarTeacherTraining,
    TeacherTrainingSidecarBehaviouralError,
    TeacherTrainingSidecarConfigError,
    TeacherTrainingSidecarHttpError,
    TeacherTrainingSidecarTimeoutError,
    type SidecarTeacherTrainingRequest,
    type SidecarTeacherTrainingResponse,
} from './teacher-training-client';
import { persistSidecarJSON } from './persist-helpers';
import { writeAgentShadowDiff } from './shadow-diff-writer';
import { withTimeout } from './with-timeout';

// Bumped from 12s — comparator runs across 11 languages showed Genkit
// teacher-training latency p95 ~11s, with persist + post-processing
// pushing total over the previous 12s cap. 25s leaves headroom without
// regressing the upstream timeout discipline.
const FALLBACK_TIMEOUT_MS = 25_000;

export type TeacherTrainingSidecarMode =
    | 'off' | 'shadow' | 'canary' | 'full';

export interface TeacherTrainingSidecarDecision {
    mode: TeacherTrainingSidecarMode;
    reason: string;
    bucket: number;
}

function userBucket(uid: string): number {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 100;
}

// Phase J.5 — flag plane consolidation. See feature-flags.ts.
async function readMode(): Promise<TeacherTrainingSidecarMode> {
    const flags = await getFeatureFlags();
    return flags.teacherTrainingSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.teacherTrainingSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideTeacherTrainingDispatch(
    uid: string,
): Promise<TeacherTrainingSidecarDecision> {
    const mode = await readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = await readPercent();
    if (bucket < percent)
        return { mode, reason: `bucket_${bucket}_under_${percent}`, bucket };
    return {
        mode: 'off',
        reason: `bucket_${bucket}_over_${percent}`,
        bucket,
    };
}

export type TeacherTrainingDispatchSource =
    | 'genkit' | 'sidecar' | 'genkit_fallback';

export interface DispatchedTeacherTraining extends TeacherTrainingOutput {
    source: TeacherTrainingDispatchSource;
    decision: TeacherTrainingSidecarDecision;
    sidecarTelemetry?: {
        sidecarVersion: string;
        latencyMs: number;
        modelUsed: string;
    };
}

export interface TeacherTrainingDispatchInput extends TeacherTrainingInput {
    userId: string;
}

function inputToSidecarRequest(
    input: TeacherTrainingDispatchInput,
): SidecarTeacherTrainingRequest {
    return {
        question: input.question,
        language: input.language ?? null,
        subject: input.subject ?? null,
        userId: input.userId,
    };
}

function sidecarToDispatched(
    res: SidecarTeacherTrainingResponse,
    decision: TeacherTrainingSidecarDecision,
): DispatchedTeacherTraining {
    return {
        introduction: res.introduction,
        advice: res.advice,
        conclusion: res.conclusion,
        gradeLevel: res.gradeLevel,
        subject: res.subject,
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
    out: TeacherTrainingOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: TeacherTrainingSidecarDecision,
): DispatchedTeacherTraining {
    return { ...out, source, decision };
}

async function runGenkitSafe(
    input: TeacherTrainingInput,
): Promise<{ ok: true; out: TeacherTrainingOutput } | { ok: false; error: Error }> {
    try {
        const out = await withTimeout(
            getTeacherTrainingAdvice(input),
            FALLBACK_TIMEOUT_MS,
            'teacher-training genkit fallback',
        );
        return { ok: true, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e };
    }
}

async function runSidecarSafe(
    request: SidecarTeacherTrainingRequest,
): Promise<
    | { ok: true; res: SidecarTeacherTrainingResponse; latencyMs: number }
    | { ok: false; error: Error; latencyMs: number }
> {
    const startedAt = Date.now();
    try {
        const res = await callSidecarTeacherTraining(request);
        return { ok: true, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(
    decision: TeacherTrainingSidecarDecision,
    payload: Record<string, unknown>,
): void {
    // eslint-disable-next-line no-console
    console.log(
        JSON.stringify({
            event: 'teacher_training.dispatch',
            mode: decision.mode,
            reason: decision.reason,
            bucket: decision.bucket,
            ...payload,
        }),
    );
}

export async function dispatchTeacherTraining(
    input: TeacherTrainingDispatchInput,
): Promise<DispatchedTeacherTraining> {
    // Phase K — pre-call rate-limit gate. Lifted out of the Genkit flow
    // so the sidecar canary/full path enforces it too. AIQuotaExhaustedError
    // (and the legacy "Rate limit exceeded" plain Error) propagate to the
    // route handler which maps them to 429/503.
    // Note: validateTopicSafety is intentionally skipped — TeacherTrainingInputSchema
    // has no `topic` field; `question` is free-form professional-development
    // advice and Gemini's built-in safety filters apply at generation time.
    const { checkServerRateLimit } = await import('@/lib/server-safety');
    await checkServerRateLimit(input.userId);

    const decision = await decideTeacherTrainingDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await withTimeout(
            getTeacherTrainingAdvice(input),
            FALLBACK_TIMEOUT_MS,
            'teacher-training genkit fallback',
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
            agent: 'teacher-training',
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

    const sidecar = await runSidecarSafe(sidecarRequest);
    if (sidecar.ok) {
        logDispatch(decision, {
            source: 'sidecar',
            uid: input.userId,
            sidecarLatencyMs: sidecar.latencyMs,
        });
        const dispatched = sidecarToDispatched(sidecar.res, decision);
        // Phase K — persist sidecar output to Storage + Firestore so it
        // shows up in My Library, mirroring the Genkit flow's behaviour.
        // persistSidecarJSON is fail-soft internally (returns null on error,
        // logs at WARN). Outer try/catch is belt-and-braces in case the
        // helper itself ever throws synchronously.
        try {
            await persistSidecarJSON({
                uid: input.userId,
                collection: 'teacher-training',
                contentType: 'teacher-training',
                title: `Advice: ${input.question.substring(0, 50)}...`,
                output: {
                    introduction: dispatched.introduction,
                    advice: dispatched.advice,
                    conclusion: dispatched.conclusion,
                    gradeLevel: dispatched.gradeLevel,
                    subject: dispatched.subject,
                },
                metadata: {
                    gradeLevel: dispatched.gradeLevel || 'Class 5',
                    subject: input.subject || dispatched.subject || 'General',
                    topic: input.question,
                    language: input.language || 'English',
                },
            });
        } catch (persistErr) {
            // eslint-disable-next-line no-console
            console.warn(JSON.stringify({
                event: 'teacher_training.persist_failed',
                uid: input.userId,
                error: persistErr instanceof Error ? persistErr.message : String(persistErr),
            }));
        }
        return dispatched;
    }

    const errorClass =
        sidecar.error instanceof TeacherTrainingSidecarBehaviouralError
            ? 'behavioural'
            : sidecar.error instanceof TeacherTrainingSidecarTimeoutError
              ? 'timeout'
              : sidecar.error instanceof TeacherTrainingSidecarHttpError
                ? 'http'
                : sidecar.error instanceof TeacherTrainingSidecarConfigError
                  ? 'config'
                  : 'unknown';

    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.userId,
        sidecarErrorClass: errorClass,
        sidecarLatencyMs: sidecar.latencyMs,
    });

    const out = await withTimeout(
        getTeacherTrainingAdvice(input),
        FALLBACK_TIMEOUT_MS,
        'teacher-training genkit fallback',
    );
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
