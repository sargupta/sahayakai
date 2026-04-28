/**
 * Rubric-generator dispatcher (Phase D.1).
 * Same off / shadow / canary / full pattern as parent-message.
 */
import {
    generateRubric,
    type RubricGeneratorInput,
    type RubricGeneratorOutput,
} from '@/ai/flows/rubric-generator';
import { getFeatureFlags } from '@/lib/feature-flags';
import {
    callSidecarRubric,
    RubricSidecarBehaviouralError,
    RubricSidecarConfigError,
    RubricSidecarHttpError,
    RubricSidecarTimeoutError,
    type SidecarRubricRequest,
    type SidecarRubricResponse,
} from './rubric-client';
import { persistSidecarJSON } from './persist-helpers';
import { writeAgentShadowDiff } from './shadow-diff-writer';
import { withTimeout } from './with-timeout';

// Mirrors `TIMEOUT_MS` in rubric-client.ts. Phase J.2 hot-fix (P0 #7) —
// caps the Genkit fallback to the same budget as the sidecar.
const FALLBACK_TIMEOUT_MS = 12_000;

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

// Phase J.5 — flag plane consolidation. See feature-flags.ts.
async function readMode(): Promise<RubricSidecarMode> {
    const flags = await getFeatureFlags();
    return flags.rubricSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.rubricSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideRubricDispatch(uid: string): Promise<RubricSidecarDecision> {
    const mode = await readMode();
    const bucket = userBucketForRubric(uid);

    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket };
    const percent = await readPercent();
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
        const out = await withTimeout(
            generateRubric(input),
            FALLBACK_TIMEOUT_MS,
            'rubric genkit fallback',
        );
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
    // Phase K — pre-call rate-limit gate. Lifted out of the Genkit flow
    // so the sidecar canary/full path enforces it too. AIQuotaExhaustedError
    // (and the legacy "Rate limit exceeded" plain Error) propagate to the
    // route handler which maps them to 429/503.
    // Note: validateTopicSafety is intentionally skipped — RubricGeneratorInputSchema
    // has no `topic` field; assignmentDescription is free-form and Gemini's
    // built-in safety filters apply at generation time.
    const { checkServerRateLimit } = await import('@/lib/server-safety');
    await checkServerRateLimit(input.userId);

    const decision = await decideRubricDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await withTimeout(
            generateRubric(input),
            FALLBACK_TIMEOUT_MS,
            'rubric genkit fallback',
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
            sidecarErrorType: sidecar.ok ? undefined : sidecar.error.name,
        });
        // Phase M.5 — persist (genkit, sidecar) pair for offline parity.
        void writeAgentShadowDiff({
            agent: 'rubric',
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
            sidecarVersion: sidecar.res.sidecarVersion,
        });
        const dispatched = sidecarToDispatched(sidecar.res, decision);
        // Phase K — persist sidecar output to Storage + Firestore so it
        // shows up in My Library, mirroring the Genkit flow's behaviour.
        // Fail-soft: any persistence error is swallowed (the user has
        // already received the response; persistence is a side effect).
        // persistSidecarJSON is fail-soft internally (returns null on error,
        // logs at WARN). Outer try/catch is belt-and-braces in case the
        // helper itself ever throws synchronously.
        try {
            await persistSidecarJSON({
                uid: input.userId,
                collection: 'rubrics',
                contentType: 'rubric',
                title: dispatched.title || `Rubric: ${input.assignmentDescription}`,
                output: {
                    title: dispatched.title,
                    description: dispatched.description,
                    criteria: dispatched.criteria,
                    gradeLevel: dispatched.gradeLevel,
                    subject: dispatched.subject,
                },
                metadata: {
                    gradeLevel: dispatched.gradeLevel || input.gradeLevel || 'Class 5',
                    subject: input.subject || dispatched.subject || 'General',
                    topic: input.assignmentDescription,
                    language: input.language || 'English',
                },
            });
        } catch (persistErr) {
            // eslint-disable-next-line no-console
            console.warn(JSON.stringify({
                event: 'rubric.persist_failed',
                uid: input.userId,
                error: persistErr instanceof Error ? persistErr.message : String(persistErr),
            }));
        }
        return dispatched;
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

    const out = await withTimeout(
        generateRubric(input),
        FALLBACK_TIMEOUT_MS,
        'rubric genkit fallback',
    );
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
