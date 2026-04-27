/**
 * Instant-answer dispatcher.
 *
 * Wraps `instantAnswer` (Genkit) and `callSidecarInstantAnswer` (Phase
 * B Python ADK agent) under one entry point so
 * `/api/ai/instant-answer/route.ts` does not embed routing logic.
 *
 * Modes (selected by `decideInstantAnswerDispatch` from feature-flags):
 *
 * - `off`    — Genkit only. Default.
 * - `shadow` — Genkit serves; sidecar runs in parallel fire-and-forget.
 *              Output logged for offline parity scoring; no shadow-diff
 *              collection write yet (lands in observability follow-up).
 * - `canary` / `full` — Sidecar serves. On ANY sidecar error fall back
 *              to Genkit so the teacher always gets *some* answer.
 *              Same fall-back-on-behavioural-fail policy as
 *              lesson-plan / vidya: the Genkit flow has its own
 *              non-redundant safety pass so it's worth retrying there.
 *
 * Phase B §B.5.
 */

import {
    instantAnswer,
    type InstantAnswerInput,
    type InstantAnswerOutput,
} from '@/ai/flows/instant-answer';

import {
    callSidecarInstantAnswer,
    InstantAnswerSidecarBehaviouralError,
    InstantAnswerSidecarConfigError,
    InstantAnswerSidecarHttpError,
    InstantAnswerSidecarTimeoutError,
    type SidecarInstantAnswerRequest,
    type SidecarInstantAnswerResponse,
} from './instant-answer-client';

// ─── Self-contained dispatch decision (no feature-flags dependency) ────────
//
// The instant-answer flag intentionally lives ONLY in this file rather
// than `feature-flags.ts` to keep the central feature-flag module
// minimal — Phase B added six new fields across three agents and the
// shared module is hot-reloaded across many request paths. New flags
// belong in their own dispatcher file by default; we only promote to
// `feature-flags.ts` if multiple call sites need to read the same flag.
//
// Operator flow:
//   1. set env var SAHAYAKAI_INSTANT_ANSWER_MODE to one of
//      'off' | 'shadow' | 'canary' | 'full' (default: 'off')
//   2. set SAHAYAKAI_INSTANT_ANSWER_PERCENT to 0-100 for shadow/canary
//      (default: 0; ignored in 'full' mode)
//
// We use env vars here rather than Firestore flags because instant-answer
// is one of the lowest-risk migrations and flipping requires only a
// Cloud Run revision push (existing CI/CD), not a Firestore document
// edit. If we need real-time flips later we promote to feature-flags.ts.

export type InstantAnswerSidecarMode = 'off' | 'shadow' | 'canary' | 'full';

export interface InstantAnswerSidecarDecision {
    mode: InstantAnswerSidecarMode;
    reason: string;
    bucket: number;
}

function userBucketForInstantAnswer(uid: string): number {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 100;
}

function readMode(): InstantAnswerSidecarMode {
    const raw = (process.env.SAHAYAKAI_INSTANT_ANSWER_MODE ?? '').toLowerCase();
    if (raw === 'shadow' || raw === 'canary' || raw === 'full') return raw;
    return 'off';
}

function readPercent(): number {
    const raw = process.env.SAHAYAKAI_INSTANT_ANSWER_PERCENT;
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, n));
}

export function decideInstantAnswerDispatch(
    uid: string,
): InstantAnswerSidecarDecision {
    const mode = readMode();
    const bucket = userBucketForInstantAnswer(uid);

    if (mode === 'off') {
        return { mode: 'off', reason: 'flag_off', bucket };
    }
    if (mode === 'full') {
        return { mode: 'full', reason: 'flag_full', bucket };
    }
    const percent = readPercent();
    if (bucket < percent) {
        return {
            mode,
            reason: `bucket_${bucket}_under_${percent}`,
            bucket,
        };
    }
    return { mode: 'off', reason: `bucket_${bucket}_over_${percent}`, bucket };
}

export type InstantAnswerDispatchSource =
    | 'genkit'
    | 'sidecar'
    | 'genkit_fallback';

export interface DispatchedInstantAnswer extends InstantAnswerOutput {
    source: InstantAnswerDispatchSource;
    decision: InstantAnswerSidecarDecision;
    /**
     * When `source === 'sidecar'`, the sidecar's grounding signal +
     * version. Undefined on Genkit paths.
     */
    sidecarTelemetry?: {
        groundingUsed: boolean;
        sidecarVersion: string;
        latencyMs: number;
        modelUsed: string;
    };
}

export interface InstantAnswerDispatchInput extends InstantAnswerInput {
    /** Required: needed for percent-bucket evaluation. */
    userId: string;
}

function inputToSidecarRequest(
    input: InstantAnswerDispatchInput,
): SidecarInstantAnswerRequest {
    return {
        question: input.question,
        language: input.language ?? null,
        gradeLevel: input.gradeLevel ?? null,
        subject: input.subject ?? null,
        userId: input.userId,
    };
}

function sidecarToDispatched(
    res: SidecarInstantAnswerResponse,
    decision: InstantAnswerSidecarDecision,
): DispatchedInstantAnswer {
    return {
        answer: res.answer,
        videoSuggestionUrl: res.videoSuggestionUrl,
        gradeLevel: res.gradeLevel,
        subject: res.subject,
        source: 'sidecar',
        decision,
        sidecarTelemetry: {
            groundingUsed: res.groundingUsed,
            sidecarVersion: res.sidecarVersion,
            latencyMs: res.latencyMs,
            modelUsed: res.modelUsed,
        },
    };
}

function genkitToDispatched(
    out: InstantAnswerOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: InstantAnswerSidecarDecision,
): DispatchedInstantAnswer {
    return {
        ...out,
        source,
        decision,
    };
}

async function runGenkitSafe(
    input: InstantAnswerInput,
): Promise<{ ok: true; out: InstantAnswerOutput } | { ok: false; error: Error }> {
    try {
        const out = await instantAnswer(input);
        return { ok: true, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e };
    }
}

async function runSidecarSafe(
    request: SidecarInstantAnswerRequest,
): Promise<
    | { ok: true; res: SidecarInstantAnswerResponse; latencyMs: number }
    | { ok: false; error: Error; latencyMs: number }
> {
    const startedAt = Date.now();
    try {
        const res = await callSidecarInstantAnswer(request);
        return { ok: true, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(
    decision: InstantAnswerSidecarDecision,
    payload: Record<string, unknown>,
): void {
    // eslint-disable-next-line no-console
    console.log(
        JSON.stringify({
            event: 'instant_answer.dispatch',
            mode: decision.mode,
            reason: decision.reason,
            bucket: decision.bucket,
            ...payload,
        }),
    );
}

// `decideInstantAnswerDispatch` reads env vars synchronously — no
// network or Firestore call to time out, no async race needed. This
// is one of the explicit benefits of keeping the flag in env vs
// Firestore (operator-flip is slower but no live failure mode).

/**
 * Dispatcher entry point. Returns a usable answer or throws — the
 * route's outer try/catch turns thrown errors into the standard
 * `/api/ai/instant-answer` error response.
 */
export async function dispatchInstantAnswer(
    input: InstantAnswerDispatchInput,
): Promise<DispatchedInstantAnswer> {
    const decision = decideInstantAnswerDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    // ── off ────────────────────────────────────────────────────────────
    if (decision.mode === 'off') {
        const out = await instantAnswer(input);
        logDispatch(decision, { source: 'genkit', uid: input.userId });
        return genkitToDispatched(out, 'genkit', decision);
    }

    // ── shadow ─────────────────────────────────────────────────────────
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
            groundingUsed: sidecar.ok ? sidecar.res.groundingUsed : undefined,
        });

        if (!genkit.ok) throw genkit.error;
        return genkitToDispatched(genkit.out, 'genkit', decision);
    }

    // ── canary / full ──────────────────────────────────────────────────
    const sidecar = await runSidecarSafe(sidecarRequest);

    if (sidecar.ok) {
        logDispatch(decision, {
            source: 'sidecar',
            uid: input.userId,
            sidecarLatencyMs: sidecar.latencyMs,
            groundingUsed: sidecar.res.groundingUsed,
            sidecarVersion: sidecar.res.sidecarVersion,
        });
        return sidecarToDispatched(sidecar.res, decision);
    }

    // Sidecar failed — fall back to Genkit. Behavioural-fail also
    // falls back here (different from parent-call) because Genkit's
    // instantAnswer flow has its own non-redundant safety pass.
    const errorClass =
        sidecar.error instanceof InstantAnswerSidecarBehaviouralError
            ? 'behavioural'
            : sidecar.error instanceof InstantAnswerSidecarTimeoutError
              ? 'timeout'
              : sidecar.error instanceof InstantAnswerSidecarHttpError
                ? 'http'
                : sidecar.error instanceof InstantAnswerSidecarConfigError
                  ? 'config'
                  : 'unknown';

    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.userId,
        sidecarErrorClass: errorClass,
        sidecarErrorType: sidecar.error.name,
        sidecarLatencyMs: sidecar.latencyMs,
    });

    const out = await instantAnswer(input);
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
