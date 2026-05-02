/**
 * VIDYA orchestrator dispatcher.
 *
 * Wraps `runGenkitVidya` (the Genkit/SAHAYAK_SOUL_PROMPT path) and
 * `callSidecarVidya` (the Phase-5 Python ADK sidecar) under one entry
 * point so `/api/assistant/route.ts` does not embed routing logic.
 *
 * The L1+L2 cache stays in the route (wraps THIS dispatcher), so a
 * cache hit short-circuits both Genkit and sidecar — saves both paths
 * money on identical fresh queries.
 *
 * Modes (selected by `decideVidyaDispatch` from feature-flags):
 *
 * - `off`    — Genkit only. Default in FALLBACK_CONFIG.
 * - `shadow` — Genkit serves; sidecar runs in parallel fire-and-forget.
 *              Output logged; not yet persisted to a shadow-diff
 *              collection (lands in a follow-up observability PR).
 * - `canary` / `full` — Sidecar serves. On ANY sidecar error fall
 *              back to Genkit so the teacher always gets *some*
 *              response. Same fall-back-on-behavioural-fail policy as
 *              lesson-plan, different from parent-call.
 *
 * Phase 5 §5.7.
 */

import {
    runGenkitVidya,
    type AssistantInput,
    type AssistantOutput,
} from '@/ai/flows/vidya-assistant';

import {
    decideVidyaDispatch,
    type VidyaSidecarDecision,
} from '@/lib/feature-flags';

import {
    callSidecarVidya,
    VidyaSidecarBehaviouralError,
    VidyaSidecarConfigError,
    VidyaSidecarHttpError,
    VidyaSidecarTimeoutError,
    type SidecarVidyaRequest,
    type SidecarVidyaResponse,
} from './vidya-client';
import { withTimeout } from './with-timeout';

// Mirrors `TIMEOUT_MS` in vidya-client.ts. Phase J.2 hot-fix (P0 #7) —
// caps the Genkit fallback to the same budget as the sidecar.
const FALLBACK_TIMEOUT_MS = 8_000;

export type VidyaDispatchSource = 'genkit' | 'sidecar' | 'genkit_fallback';

/**
 * Wire shape returned by `dispatchVidya`. Same `{response, action}`
 * shape as `AssistantOutput` plus telemetry.
 */
export interface DispatchedVidyaResponse extends AssistantOutput {
    source: VidyaDispatchSource;
    decision: VidyaSidecarDecision;
    /**
     * When `source === 'sidecar'`, the sidecar's classification +
     * version. Undefined on Genkit paths so callers can tell the two
     * apart for observability.
     */
    sidecarTelemetry?: {
        intent: string;
        sidecarVersion: string;
        latencyMs: number;
    };
}

export interface VidyaDispatchInput {
    /** Required for percent-bucket evaluation. */
    uid: string;
    /** Common request shape — same one OmniOrb sends today. */
    request: AssistantInput;
}

function inputToSidecarRequest(input: AssistantInput): SidecarVidyaRequest {
    return {
        message: input.message,
        chatHistory: (input.chatHistory ?? [])
            .map((m) => {
                if (m.role && m.parts) {
                    return {
                        role: m.role,
                        parts: m.parts.map((p) => ({ text: p.text })),
                    };
                }
                // VoiceAssistant-shape entries get serialised as a
                // single user/model turn each so the sidecar prompt
                // sees the same context the Genkit prompt sees.
                if (m.user) {
                    return {
                        role: 'user' as const,
                        parts: [{ text: m.user }],
                    };
                }
                if (m.ai) {
                    return {
                        role: 'model' as const,
                        parts: [{ text: m.ai }],
                    };
                }
                return null;
            })
            .filter((m): m is { role: 'user' | 'model'; parts: { text: string }[] } => m !== null),
        currentScreenContext: {
            path: input.currentScreenContext?.path ?? '/',
            uiState:
                input.currentScreenContext?.uiState
                    ? Object.fromEntries(
                          Object.entries(input.currentScreenContext.uiState).map(
                              ([k, v]) => [k, String(v ?? '')],
                          ),
                      )
                    : null,
        },
        teacherProfile: input.teacherProfile ?? {},
        detectedLanguage: input.detectedLanguage ?? null,
    };
}

function sidecarToDispatched(
    res: SidecarVidyaResponse,
    decision: VidyaSidecarDecision,
): DispatchedVidyaResponse {
    return {
        response: res.response,
        // Sidecar action shape mirrors the legacy `{type, flow, params}`
        // shape Genkit returns. Cast through `AssistantAction` since
        // the dispatched response uses the legacy union.
        action: res.action as AssistantOutput['action'],
        source: 'sidecar',
        decision,
        sidecarTelemetry: {
            intent: res.intent,
            sidecarVersion: res.sidecarVersion,
            latencyMs: res.latencyMs,
        },
    };
}

function genkitToDispatched(
    out: AssistantOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: VidyaSidecarDecision,
): DispatchedVidyaResponse {
    return {
        response: out.response,
        action: out.action ?? null,
        source,
        decision,
    };
}

async function runGenkitSafe(
    input: AssistantInput,
): Promise<{ ok: true; out: AssistantOutput } | { ok: false; error: Error }> {
    try {
        const out = await withTimeout(
            runGenkitVidya(input),
            FALLBACK_TIMEOUT_MS,
            'vidya genkit fallback',
        );
        return { ok: true, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e };
    }
}

async function runSidecarSafe(
    request: SidecarVidyaRequest,
): Promise<
    | { ok: true; res: SidecarVidyaResponse; latencyMs: number }
    | { ok: false; error: Error; latencyMs: number }
> {
    const startedAt = Date.now();
    try {
        const res = await callSidecarVidya(request);
        return { ok: true, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(
    decision: VidyaSidecarDecision,
    payload: Record<string, unknown>,
): void {
    // eslint-disable-next-line no-console
    console.log(
        JSON.stringify({
            event: 'vidya.dispatch',
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
): Promise<VidyaSidecarDecision> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            decideVidyaDispatch(uid),
            new Promise<VidyaSidecarDecision>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error('decideVidyaDispatch timed out')),
                    DECIDE_DISPATCH_TIMEOUT_MS,
                );
            }),
        ]);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
            JSON.stringify({
                event: 'vidya.dispatch.decide_failed',
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
 * Dispatcher entry point. Returns a usable response or throws — the
 * route's outer try/catch turns thrown errors into the standard
 * `/api/assistant` 500 / 503 response.
 */
export async function dispatchVidya(
    input: VidyaDispatchInput,
): Promise<DispatchedVidyaResponse> {
    const decision = await decideDispatchWithTimeout(input.uid);
    const sidecarRequest = inputToSidecarRequest(input.request);

    // ── off ────────────────────────────────────────────────────────────
    if (decision.mode === 'off') {
        const out = await withTimeout(
            runGenkitVidya(input.request),
            FALLBACK_TIMEOUT_MS,
            'vidya genkit fallback',
        );
        logDispatch(decision, { source: 'genkit', uid: input.uid });
        return genkitToDispatched(out, 'genkit', decision);
    }

    // ── shadow ─────────────────────────────────────────────────────────
    if (decision.mode === 'shadow') {
        const [genkit, sidecar] = await Promise.all([
            runGenkitSafe(input.request),
            runSidecarSafe(sidecarRequest),
        ]);

        logDispatch(decision, {
            source: 'genkit',
            uid: input.uid,
            sidecarOk: sidecar.ok,
            sidecarLatencyMs: sidecar.latencyMs,
            sidecarErrorType: sidecar.ok ? undefined : sidecar.error.name,
            sidecarIntent: sidecar.ok ? sidecar.res.intent : undefined,
        });

        if (!genkit.ok) throw genkit.error;
        return genkitToDispatched(genkit.out, 'genkit', decision);
    }

    // ── canary / full ──────────────────────────────────────────────────
    const sidecar = await runSidecarSafe(sidecarRequest);

    if (sidecar.ok) {
        logDispatch(decision, {
            source: 'sidecar',
            uid: input.uid,
            sidecarLatencyMs: sidecar.latencyMs,
            intent: sidecar.res.intent,
            sidecarVersion: sidecar.res.sidecarVersion,
        });
        return sidecarToDispatched(sidecar.res, decision);
    }

    // Sidecar failed — fall back to Genkit. Behavioural-fail also
    // falls back here (different from parent-call) because Genkit's
    // SAHAYAK_SOUL prompt has its own non-redundant safety pass.
    const errorClass =
        sidecar.error instanceof VidyaSidecarBehaviouralError
            ? 'behavioural'
            : sidecar.error instanceof VidyaSidecarTimeoutError
              ? 'timeout'
              : sidecar.error instanceof VidyaSidecarHttpError
                ? 'http'
                : sidecar.error instanceof VidyaSidecarConfigError
                  ? 'config'
                  : 'unknown';

    logDispatch(decision, {
        source: 'genkit_fallback',
        uid: input.uid,
        sidecarErrorClass: errorClass,
        sidecarErrorType: sidecar.error.name,
        sidecarLatencyMs: sidecar.latencyMs,
    });

    const out = await withTimeout(
        runGenkitVidya(input.request),
        FALLBACK_TIMEOUT_MS,
        'vidya genkit fallback',
    );
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
