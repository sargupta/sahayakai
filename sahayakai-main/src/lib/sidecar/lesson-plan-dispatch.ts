/**
 * Lesson-plan dispatcher.
 *
 * Wraps `generateLessonPlan` (Genkit) and `callSidecarLessonPlan`
 * (Phase-3 Python ADK sidecar with writer→evaluator→reviser loop)
 * under one entry point so the API route at
 * `app/api/ai/lesson-plan/route.ts` does not embed routing logic.
 *
 * Modes (selected by `decideLessonPlanDispatch` from feature-flags):
 *
 * - `off`    — Genkit only. Zero overhead vs. legacy.
 * - `shadow` — Genkit serves the response. Sidecar runs in parallel
 *              fire-and-forget; output is logged for offline parity
 *              analysis but NOT written to a shadow-diff collection
 *              yet — that lands in the follow-up observability PR.
 * - `canary` / `full` — Sidecar serves. On ANY sidecar error the
 *              dispatcher falls back to Genkit (which has its own
 *              behavioural guard with different rules — the two paths
 *              are not redundant).  This differs from parent-call where
 *              behavioural-fail rethrows; lesson plan generation is not
 *              voice-bound and a failed sidecar plan is no worse than
 *              no sidecar plan, so the legacy Genkit path is the right
 *              fallback.
 *
 * Phase 3 §3.4.
 */

import {
    generateLessonPlan,
    type LessonPlanInput,
    type LessonPlanOutput,
} from '@/ai/flows/lesson-plan-generator';

import {
    decideLessonPlanDispatch,
    type LessonPlanSidecarDecision,
} from '@/lib/feature-flags';

import {
    callSidecarLessonPlan,
    LessonPlanSidecarBehaviouralError,
    LessonPlanSidecarConfigError,
    LessonPlanSidecarHttpError,
    LessonPlanSidecarTimeoutError,
    type SidecarLessonPlanRequest,
    type SidecarLessonPlanResponse,
} from './lesson-plan-client';
import { withTimeout } from './with-timeout';

// Mirrors `TIMEOUT_MS` in lesson-plan-client.ts. Phase J.2 hot-fix
// (P0 #7) — caps the Genkit fallback to the same budget as the sidecar.
const FALLBACK_TIMEOUT_MS = 60_000;

export type LessonPlanDispatchSource =
    | 'genkit'
    | 'sidecar'
    | 'genkit_fallback';

export interface DispatchedLessonPlan extends LessonPlanOutput {
    /** Which path produced this plan. */
    source: LessonPlanDispatchSource;
    /** Lesson-plan dispatch decision. Useful for structured logs. */
    decision: LessonPlanSidecarDecision;
    /**
     * When `source === 'sidecar'`, the Phase-3 telemetry from the
     * sidecar's evaluator. Undefined on Genkit paths so callers can
     * tell the two apart for observability.
     */
    sidecarTelemetry?: {
        revisionsRun: number;
        rubric: SidecarLessonPlanResponse['rubric'];
        sidecarVersion: string;
    };
}

export interface LessonPlanDispatchInput extends LessonPlanInput {
    /** Required by the dispatcher even in `off` mode for telemetry. */
    userId: string;
}

function toSidecarRequest(input: LessonPlanDispatchInput): SidecarLessonPlanRequest {
    return {
        topic: input.topic,
        language: input.language,
        gradeLevels: input.gradeLevels,
        useRuralContext: input.useRuralContext,
        ncertChapter: input.ncertChapter,
        resourceLevel: input.resourceLevel,
        difficultyLevel: input.difficultyLevel,
        subject: input.subject,
        teacherContext: input.teacherContext,
        // Phase J.4 hot-fix (B3 inconsistency): forward userId on the
        // wire so the sidecar's contract matches every other agent.
        userId: input.userId,
    };
}

function sidecarToLessonPlan(
    res: SidecarLessonPlanResponse,
    decision: LessonPlanSidecarDecision,
): DispatchedLessonPlan {
    return {
        title: res.title,
        gradeLevel: res.gradeLevel,
        duration: res.duration,
        subject: res.subject,
        objectives: res.objectives,
        keyVocabulary: res.keyVocabulary,
        materials: res.materials,
        activities: res.activities.map((a) => ({
            phase: a.phase,
            name: a.name,
            description: a.description,
            duration: a.duration,
            teacherTips: a.teacherTips,
            understandingCheck: a.understandingCheck,
        })),
        assessment: res.assessment,
        homework: res.homework,
        language: res.language,
        source: 'sidecar',
        decision,
        sidecarTelemetry: {
            revisionsRun: res.revisionsRun,
            rubric: res.rubric,
            sidecarVersion: res.sidecarVersion,
        },
    };
}

function genkitToLessonPlan(
    out: LessonPlanOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: LessonPlanSidecarDecision,
): DispatchedLessonPlan {
    return {
        ...out,
        source,
        decision,
    };
}

async function runGenkitSafe(
    input: LessonPlanInput,
): Promise<{ ok: true; out: LessonPlanOutput } | { ok: false; error: Error }> {
    try {
        const out = await withTimeout(
            generateLessonPlan(input),
            FALLBACK_TIMEOUT_MS,
            'lesson-plan genkit fallback',
        );
        return { ok: true, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e };
    }
}

async function runSidecarSafe(
    request: SidecarLessonPlanRequest,
): Promise<
    | { ok: true; res: SidecarLessonPlanResponse; latencyMs: number }
    | { ok: false; error: Error; latencyMs: number }
> {
    const startedAt = Date.now();
    try {
        const res = await callSidecarLessonPlan(request);
        return { ok: true, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(
    decision: LessonPlanSidecarDecision,
    payload: Record<string, unknown>,
): void {
    // Single structured log line per dispatch. Cloud Logging filter
    // keys off `event="lesson_plan.dispatch"`.
    console.log(
        JSON.stringify({
            event: 'lesson_plan.dispatch',
            mode: decision.mode,
            reason: decision.reason,
            bucket: decision.bucket,
            ...payload,
        }),
    );
}

const DECIDE_DISPATCH_TIMEOUT_MS = 1_500;

async function decideDispatchWithTimeout(
    uid: string,
): Promise<LessonPlanSidecarDecision> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            decideLessonPlanDispatch(uid),
            new Promise<LessonPlanSidecarDecision>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error('decideLessonPlanDispatch timed out')),
                    DECIDE_DISPATCH_TIMEOUT_MS,
                );
            }),
        ]);
    } catch (err) {
        console.warn(
            JSON.stringify({
                event: 'lesson_plan.dispatch.decide_failed',
                uid,
                error: err instanceof Error ? err.message : String(err),
            }),
        );
        return { mode: 'off', reason: 'decide_failed', bucket: 0 };
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}

/**
 * Dispatcher entry point. Returns a usable plan or throws — the API
 * route's outer try/catch turns thrown errors into the standard 4xx/5xx
 * response shape via `handleAIError`.
 */
export async function dispatchLessonPlan(
    input: LessonPlanDispatchInput,
): Promise<DispatchedLessonPlan> {
    const decision = await decideDispatchWithTimeout(input.userId);

    // ── off ────────────────────────────────────────────────────────────
    if (decision.mode === 'off') {
        const out = await withTimeout(
            generateLessonPlan(input),
            FALLBACK_TIMEOUT_MS,
            'lesson-plan genkit fallback',
        );
        logDispatch(decision, { source: 'genkit', uid: input.userId });
        return genkitToLessonPlan(out, 'genkit', decision);
    }

    // ── shadow ─────────────────────────────────────────────────────────
    if (decision.mode === 'shadow') {
        const sidecarReq = toSidecarRequest(input);
        const [genkit, sidecar] = await Promise.all([
            runGenkitSafe(input),
            runSidecarSafe(sidecarReq),
        ]);

        // Log both outcomes so offline parity scoring can be assembled
        // from log queries until the shadow-diff collection lands.
        logDispatch(decision, {
            source: 'genkit',
            uid: input.userId,
            sidecarOk: sidecar.ok,
            sidecarLatencyMs: sidecar.latencyMs,
            sidecarErrorType: sidecar.ok ? undefined : sidecar.error.name,
            sidecarRevisionsRun: sidecar.ok ? sidecar.res.revisionsRun : undefined,
        });

        if (!genkit.ok) throw genkit.error;
        return genkitToLessonPlan(genkit.out, 'genkit', decision);
    }

    // ── canary / full ──────────────────────────────────────────────────
    const sidecarReq = toSidecarRequest(input);
    const sidecar = await runSidecarSafe(sidecarReq);

    if (sidecar.ok) {
        logDispatch(decision, {
            source: 'sidecar',
            uid: input.userId,
            sidecarLatencyMs: sidecar.latencyMs,
            revisionsRun: sidecar.res.revisionsRun,
            sidecarVersion: sidecar.res.sidecarVersion,
        });
        return sidecarToLessonPlan(sidecar.res, decision);
    }

    // Sidecar failed in any way — fall back to Genkit. Unlike
    // parent-call, behavioural-fail also falls back here because the
    // Genkit lesson-plan flow has its own (different) guard rules.
    const errorClass =
        sidecar.error instanceof LessonPlanSidecarBehaviouralError
            ? 'behavioural'
            : sidecar.error instanceof LessonPlanSidecarTimeoutError
              ? 'timeout'
              : sidecar.error instanceof LessonPlanSidecarHttpError
                ? 'http'
                : sidecar.error instanceof LessonPlanSidecarConfigError
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
        generateLessonPlan(input),
        FALLBACK_TIMEOUT_MS,
        'lesson-plan genkit fallback',
    );
    return genkitToLessonPlan(out, 'genkit_fallback', decision);
}
