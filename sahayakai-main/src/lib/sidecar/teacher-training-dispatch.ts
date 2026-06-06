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
import { SHADOW_DIFF_IN_CANARY_OBSERVATION } from './canary-shadow-diff';
import { WithTimeoutError, withTimeout } from './with-timeout';
import { toIsoLanguage } from './lang';

// Bumped from 12s — comparator runs across 11 languages showed Genkit
// teacher-training latency p95 ~11s, with persist + post-processing
// pushing total over the previous 12s cap. 25s leaves headroom without
// regressing the upstream timeout discipline.
//
// NCERT demo hot-fix (2026-05-19): env-overridable via
// `TEACHER_TRAINING_TIMEOUT_MS` so production can tune without a redeploy.
// Same env var governs the sidecar client TIMEOUT_MS in
// `teacher-training-client.ts`.
const FALLBACK_TIMEOUT_MS = Number(process.env.TEACHER_TRAINING_TIMEOUT_MS) || 25_000;

export type TeacherTrainingSidecarMode =
    | 'off' | 'shadow' | 'canary' | 'full';

export interface TeacherTrainingSidecarDecision {
    mode: TeacherTrainingSidecarMode;
    reason: string;
    bucket: number;
    /** Q4C: raw flag value pre-bucket. */
    configuredMode?: TeacherTrainingSidecarMode;
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
    if (mode === 'off') return { mode: 'off', reason: 'flag_off', bucket, configuredMode: mode };
    if (mode === 'full') return { mode: 'full', reason: 'flag_full', bucket, configuredMode: mode };
    const percent = await readPercent();
    if (bucket < percent)
        return { mode, reason: `bucket_${bucket}_under_${percent}`, bucket, configuredMode: mode };
    return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket, configuredMode: mode };
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
        // Normalise language display label → ISO for uniform wire shape.
        language: input.language ? toIsoLanguage(input.language) : null,
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
    // NCERT demo hot-fix (2026-05-19): wrap entire dispatch in
    // start-time accounting so the timeout path logs a structured
    // `[teacher_training.dispatch] timeout` line (no silent 500s).
    const __dispatchStartedAt = Date.now();
    try {
        return await _dispatchTeacherTrainingInner(input, __dispatchStartedAt);
    } catch (err) {
        if (err instanceof WithTimeoutError) {
            // eslint-disable-next-line no-console
            console.error('[teacher_training.dispatch] timeout', {
                budgetMs: FALLBACK_TIMEOUT_MS,
                observedMs: Date.now() - __dispatchStartedAt,
                label: err.label,
            });
        }
        throw err;
    }
}

async function _dispatchTeacherTrainingInner(
    input: TeacherTrainingDispatchInput,
    dispatchStartedAt: number,
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
        const durationMs = Date.now() - dispatchStartedAt;
        logDispatch(decision, { source: 'genkit', uid: input.userId, durationMs });
        // eslint-disable-next-line no-console
        console.log('[teacher_training.dispatch] complete', { durationMs, source: 'genkit' });

        // Q4C — canary "bucket-overshoot" observation. When the agent
        // is mid-canary (configuredMode==='canary') but THIS teacher's
        // bucket landed >=percent (mode collapsed to 'off'), fire the
        // sidecar in the background and write a shadow_diff so the
        // promotion gate has a non-zero denominator.
        if (
            SHADOW_DIFF_IN_CANARY_OBSERVATION &&
            decision.configuredMode === 'canary'
        ) {
            void runSidecarSafe(sidecarRequest).then((sc) => {
                void writeAgentShadowDiff({
                    agent: 'teacher-training',
                    uid: input.userId,
                    genkit: out,
                    sidecar: sc.ok ? sc.res : null,
                    genkitLatencyMs: 0,
                    sidecarLatencyMs: sc.latencyMs,
                    sidecarOk: sc.ok,
                    sidecarError: sc.ok ? undefined : sc.error.message,
                });
            });
        }
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
        // eslint-disable-next-line no-console
        console.log('[teacher_training.dispatch] complete', {
            durationMs: Date.now() - dispatchStartedAt,
            source: 'genkit',
        });
        return genkitToDispatched(genkit.out, 'genkit', decision);
    }

    const sidecar = await runSidecarSafe(sidecarRequest);
    if (sidecar.ok) {
        const durationMs = Date.now() - dispatchStartedAt;
        logDispatch(decision, {
            source: 'sidecar',
            uid: input.userId,
            sidecarLatencyMs: sidecar.latencyMs,
            durationMs,
        });
        // eslint-disable-next-line no-console
        console.log('[teacher_training.dispatch] complete', { durationMs, source: 'sidecar' });
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

        // Q4C — canary/full observation: fire Genkit in the background
        // and write a shadow_diff so the promotion-gate aggregator has
        // a live (genkit, sidecar) parity signal during the rollout.
        // 2x Gemini cost while observation is on; toggle the constant
        // off post-promotion to reclaim it.
        if (SHADOW_DIFF_IN_CANARY_OBSERVATION) {
            const __q4cGenkitStartedAt = Date.now();
            void runGenkitSafe(input).then((gk) => {
                void writeAgentShadowDiff({
                    agent: 'teacher-training',
                    uid: input.userId,
                    genkit: gk.ok ? gk.out : null,
                    sidecar: sidecar.res,
                    genkitLatencyMs: Date.now() - __q4cGenkitStartedAt,
                    sidecarLatencyMs: sidecar.latencyMs,
                    sidecarOk: true,
                });
            });
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
    // eslint-disable-next-line no-console
    console.log('[teacher_training.dispatch] complete', {
        durationMs: Date.now() - dispatchStartedAt,
        source: 'genkit_fallback',
    });
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
