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
import { getFeatureFlags } from '@/lib/feature-flags';

import {
    callSidecarInstantAnswer,
    InstantAnswerSidecarBehaviouralError,
    InstantAnswerSidecarConfigError,
    InstantAnswerSidecarHttpError,
    InstantAnswerSidecarTimeoutError,
    type SidecarInstantAnswerRequest,
    type SidecarInstantAnswerResponse,
} from './instant-answer-client';
import { withTimeout } from './with-timeout';

// Mirrors `TIMEOUT_MS` in instant-answer-client.ts. Phase J.2 hot-fix
// (P0 #7) — caps the Genkit fallback to the same budget as the sidecar.
const FALLBACK_TIMEOUT_MS = 10_000;

// ─── Firestore-backed dispatch decision (Phase J.5 migration) ──────────────
//
// Forensic audit P0 #3: this dispatcher previously read
// `SAHAYAKAI_INSTANT_ANSWER_MODE` / `_PERCENT` from process.env. The
// auto-abort Cloud Function only writes Firestore, so an env-flagged
// agent could not be rolled back by the same flip that demotes the
// other 14 sidecar flags. The agent now reads from
// `system_config/feature_flags.instantAnswerSidecarMode/Percent` via
// `getFeatureFlags()`, sharing the 5-min in-memory cache with the
// other Firestore-backed flags.

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

async function readMode(): Promise<InstantAnswerSidecarMode> {
    const flags = await getFeatureFlags();
    return flags.instantAnswerSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.instantAnswerSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideInstantAnswerDispatch(
    uid: string,
): Promise<InstantAnswerSidecarDecision> {
    const mode = await readMode();
    const bucket = userBucketForInstantAnswer(uid);

    if (mode === 'off') {
        return { mode: 'off', reason: 'flag_off', bucket };
    }
    if (mode === 'full') {
        return { mode: 'full', reason: 'flag_full', bucket };
    }
    const percent = await readPercent();
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
        const out = await withTimeout(
            instantAnswer(input),
            FALLBACK_TIMEOUT_MS,
            'instant-answer genkit fallback',
        );
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

// Phase J.5 — `decideInstantAnswerDispatch` is async (Firestore-backed).
// `getFeatureFlags()` has its own 5-min in-memory cache and falls back
// to safe defaults on read failure, so it never throws or blocks the
// route. The first read on a cold lambda costs one Firestore RTT
// (~30ms); subsequent reads are O(1) until cache expiry.

/**
 * Dispatcher entry point. Returns a usable answer or throws — the
 * route's outer try/catch turns thrown errors into the standard
 * `/api/ai/instant-answer` error response.
 */
export async function dispatchInstantAnswer(
    input: InstantAnswerDispatchInput,
): Promise<DispatchedInstantAnswer> {
    const decision = await decideInstantAnswerDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    // ── off ────────────────────────────────────────────────────────────
    if (decision.mode === 'off') {
        const out = await withTimeout(
            instantAnswer(input),
            FALLBACK_TIMEOUT_MS,
            'instant-answer genkit fallback',
        );
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

    const out = await withTimeout(
        instantAnswer(input),
        FALLBACK_TIMEOUT_MS,
        'instant-answer genkit fallback',
    );
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
