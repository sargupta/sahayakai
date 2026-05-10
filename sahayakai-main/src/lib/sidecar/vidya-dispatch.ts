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

import { getFirebaseAppCheckToken } from '@/lib/firebase-app-check';
import {
    decideVidyaDispatch,
    type VidyaSidecarDecision,
} from '@/lib/feature-flags';

import { writeAgentShadowDiff } from './shadow-diff-writer';
import {
    callSidecarVidya,
    VidyaSidecarBehaviouralError,
    VidyaSidecarConfigError,
    VidyaSidecarHttpError,
    VidyaSidecarTimeoutError,
    type SidecarVidyaAction,
    type SidecarVidyaRequest,
    type SidecarVidyaResponse,
} from './vidya-client';
import { withTimeout } from './with-timeout';

// Bumped from 8s — VIDYA orchestrator includes intent classification +
// optional sub-agent delegation, often pushing total latency to 10–14s
// for compound intents. 15s leaves p99 headroom; the supervisor's own
// per-call budget on the sidecar is 12s.
const FALLBACK_TIMEOUT_MS = 15_000;

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
    /**
     * Phase N.1 — typed planned-action queue propagated from the
     * sidecar's compound-intent orchestrator. Up to 3 ordered
     * `VidyaAction`s the supervisor authored for a "lesson plan AND a
     * rubric" style request. The OmniOrb client renders each entry as
     * a one-tap chip the teacher can opt into; the supervisor never
     * auto-executes follow-ups. Undefined on Genkit paths (the legacy
     * Genkit flow only emits a single `action`).
     */
    plannedActions?: SidecarVidyaAction[];
}

export interface VidyaDispatchInput {
    /** Required for percent-bucket evaluation. */
    uid: string;
    /** Common request shape — same one OmniOrb sends today. */
    request: AssistantInput;
}

function inputToSidecarRequest(
    input: AssistantInput,
    userId: string,
): SidecarVidyaRequest {
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
        // Phase L.2 — forward the authenticated uid so the sidecar's
        // instant-answer delegation attributes the call to the real
        // teacher (was hard-coded `vidya-supervisor` placeholder).
        userId,
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
        action: (res.action ?? null) as AssistantOutput['action'],
        source: 'sidecar',
        decision,
        sidecarTelemetry: {
            intent: res.intent,
            sidecarVersion: res.sidecarVersion,
            latencyMs: res.latencyMs,
        },
        // Phase N.1 — propagate the typed planned-action queue. The
        // OmniOrb client renders one chip per entry; the legacy
        // `action` field above is `plannedActions[0]` for v0.3 client
        // compatibility. Undefined when the sidecar emits no compound
        // plan (single-step / instant-answer / unknown).
        plannedActions: res.plannedActions ?? undefined,
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
        // Phase N.1 + Phase U.epsilon — Genkit-side agent-router now
        // also emits `plannedActions[]` (parity with the Python sidecar).
        // Forward when present so the OmniOrb client renders chips
        // regardless of which path serves the response.
        plannedActions: out.plannedActions as SidecarVidyaAction[] | undefined,
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
    appCheckToken: string | null,
): Promise<
    | { ok: true; res: SidecarVidyaResponse; latencyMs: number }
    | { ok: false; error: Error; latencyMs: number }
> {
    const startedAt = Date.now();
    try {
        // Phase R.2 + Phase U.delta: forward the dispatcher-resolved
        // App Check token. Passing `null` (rather than leaving the
        // option `undefined`) avoids the client's auto-fetch path on
        // server-rendered routes that have already negotiated the
        // header upstream — the token comes from `/api/assistant`'s
        // request headers, not a fresh reCAPTCHA challenge.
        const res = await callSidecarVidya(request, { appCheckToken });
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
    const sidecarRequest = inputToSidecarRequest(input.request, input.uid);

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

    // Phase R.2 + Phase U.delta: resolve App Check token ONCE per
    // dispatch — both shadow's parallel sidecar call and canary/full's
    // serving sidecar call share the same attestation. On Cloud Run
    // SSR `getFirebaseAppCheckToken()` returns null; on browser-driven
    // server actions the next/server runtime forwards the header and
    // the App Check helper picks it up.
    const appCheckToken = await getFirebaseAppCheckToken();

    // ── shadow ─────────────────────────────────────────────────────────
    if (decision.mode === 'shadow') {
        const shadowStartedAt = Date.now();
        const [genkit, sidecar] = await Promise.all([
            runGenkitSafe(input.request),
            runSidecarSafe(sidecarRequest, appCheckToken),
        ]);
        const genkitLatencyMs = Date.now() - shadowStartedAt;

        logDispatch(decision, {
            source: 'genkit',
            uid: input.uid,
            sidecarOk: sidecar.ok,
            sidecarLatencyMs: sidecar.latencyMs,
            sidecarErrorType: sidecar.ok ? undefined : sidecar.error.name,
            sidecarIntent: sidecar.ok ? sidecar.res.intent : undefined,
        });

        // Phase M.5 — also persist the (genkit, sidecar) pair to
        // Firestore so the offline aggregator can score parity before
        // the canary flip. Fire-and-forget; never blocks the response.
        void writeAgentShadowDiff({
            agent: 'vidya',
            uid: input.uid,
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

    // ── canary / full ──────────────────────────────────────────────────
    const sidecar = await runSidecarSafe(sidecarRequest, appCheckToken);

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
