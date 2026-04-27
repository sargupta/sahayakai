/**
 * Rubric-generator dispatcher (Phase D.1).
 * Same off / shadow / canary / full pattern as parent-message.
 */
import {
    generateRubric,
    type RubricGeneratorInput,
    type RubricGeneratorOutput,
} from '@/ai/flows/rubric-generator';
import {
    callSidecarRubric,
    RubricSidecarBehaviouralError,
    RubricSidecarConfigError,
    RubricSidecarHttpError,
    RubricSidecarTimeoutError,
    type SidecarRubricRequest,
    type SidecarRubricResponse,
} from './rubric-client';

export type RubricSidecarMode = 'off' | 'shadow' | 'canary' | 'full';

export interface RubricSidecarDecision {
    mode: RubricSidecarMode;
    reason: string;
    bucket: number;
}

function userBucketForRubric(uid: string): number {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 100;
}

function readMode(): RubricSidecarMode {
    const raw = (process.env.SAHAYAKAI_RUBRIC_MODE ?? '').toLowerCase();
    if (raw === 'shadow' || raw === 'canary' || raw === 'full') return raw;
    return 'off';
}

function readPercent(): number {
    const raw = process.env.SAHAYAKAI_RUBRIC_PERCENT;
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, n));
}

export function decideRubricDispatch(uid: string): RubricSidecarDecision {
    const mode = readMode();
    const bucket = userBucketForRubric(uid);

    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = readPercent();
    if (bucket < percent) {
        return { mode, reason: `bucket_${bucket}_under_${percent}`, bucket };
    }
    return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket };
}

export type RubricDispatchSource = 'genkit' | 'sidecar' | 'genkit_fallback';

export interface DispatchedRubric extends RubricGeneratorOutput {
    source: RubricDispatchSource;
    decision: RubricSidecarDecision;
    sidecarTelemetry?: {
        sidecarVersion: string;
        latencyMs: number;
        modelUsed: string;
    };
}

export interface RubricDispatchInput extends RubricGeneratorInput {
    userId: string;
}

function inputToSidecarRequest(input: RubricDispatchInput): SidecarRubricRequest {
    return {
        assignmentDescription: input.assignmentDescription,
        gradeLevel: input.gradeLevel ?? null,
        subject: input.subject ?? null,
        language: input.language ?? null,
        teacherContext: input.teacherContext ?? null,
        userId: input.userId,
    };
}

function sidecarToDispatched(
    res: SidecarRubricResponse,
    decision: RubricSidecarDecision,
): DispatchedRubric {
    return {
        title: res.title,
        description: res.description,
        criteria: res.criteria,
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
    out: RubricGeneratorOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: RubricSidecarDecision,
): DispatchedRubric {
    return { ...out, source, decision };
}

async function runGenkitSafe(
    input: RubricGeneratorInput,
): Promise<{ ok: true; out: RubricGeneratorOutput } | { ok: false; error: Error }> {
    try {
        const out = await generateRubric(input);
        return { ok: true, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e };
    }
}

async function runSidecarSafe(
    request: SidecarRubricRequest,
): Promise<
    | { ok: true; res: SidecarRubricResponse; latencyMs: number }
    | { ok: false; error: Error; latencyMs: number }
> {
    const startedAt = Date.now();
    try {
        const res = await callSidecarRubric(request);
        return { ok: true, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(
    decision: RubricSidecarDecision,
    payload: Record<string, unknown>,
): void {
    // eslint-disable-next-line no-console
    console.log(
        JSON.stringify({
            event: 'rubric.dispatch',
            mode: decision.mode,
            reason: decision.reason,
            bucket: decision.bucket,
            ...payload,
        }),
    );
}

export async function dispatchRubric(
    input: RubricDispatchInput,
): Promise<DispatchedRubric> {
    const decision = decideRubricDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await generateRubric(input);
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
            sidecarErrorType: sidecar.ok ? undefined : sidecar.error.name,
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
            sidecarVersion: sidecar.res.sidecarVersion,
        });
        return sidecarToDispatched(sidecar.res, decision);
    }

    const errorClass =
        sidecar.error instanceof RubricSidecarBehaviouralError
            ? 'behavioural'
            : sidecar.error instanceof RubricSidecarTimeoutError
              ? 'timeout'
              : sidecar.error instanceof RubricSidecarHttpError
                ? 'http'
                : sidecar.error instanceof RubricSidecarConfigError
                  ? 'config'
                  : 'unknown';

    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.userId,
        sidecarErrorClass: errorClass,
        sidecarErrorType: sidecar.error.name,
        sidecarLatencyMs: sidecar.latencyMs,
    });

    const out = await generateRubric(input);
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
