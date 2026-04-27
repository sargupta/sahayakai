/**
 * Teacher-training dispatcher (Phase D.2).
 */
import {
    getTeacherTrainingAdvice,
    type TeacherTrainingInput,
    type TeacherTrainingOutput,
} from '@/ai/flows/teacher-training';
import {
    callSidecarTeacherTraining,
    TeacherTrainingSidecarBehaviouralError,
    TeacherTrainingSidecarConfigError,
    TeacherTrainingSidecarHttpError,
    TeacherTrainingSidecarTimeoutError,
    type SidecarTeacherTrainingRequest,
    type SidecarTeacherTrainingResponse,
} from './teacher-training-client';

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

function readMode(): TeacherTrainingSidecarMode {
    const raw = (process.env.SAHAYAKAI_TEACHER_TRAINING_MODE ?? '').toLowerCase();
    if (raw === 'shadow' || raw === 'canary' || raw === 'full') return raw;
    return 'off';
}

function readPercent(): number {
    const raw = process.env.SAHAYAKAI_TEACHER_TRAINING_PERCENT;
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, n));
}

export function decideTeacherTrainingDispatch(
    uid: string,
): TeacherTrainingSidecarDecision {
    const mode = readMode();
    const bucket = userBucket(uid);
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = readPercent();
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
        const out = await getTeacherTrainingAdvice(input);
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
    const decision = decideTeacherTrainingDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await getTeacherTrainingAdvice(input);
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
        logDispatch(decision, {
            source: 'sidecar',
            uid: input.userId,
            sidecarLatencyMs: sidecar.latencyMs,
        });
        return sidecarToDispatched(sidecar.res, decision);
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

    const out = await getTeacherTrainingAdvice(input);
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
