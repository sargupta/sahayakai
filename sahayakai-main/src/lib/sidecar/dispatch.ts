/**
 * Parent-call reply dispatcher.
 *
 * Wraps `generateAgentReply` (Genkit) and `callSidecarReply` (Python
 * ADK sidecar) under one entry point so the TwiML route at
 * `app/api/attendance/twiml/route.ts` does not embed routing logic.
 * Centralising the dispatch here keeps it unit-testable and makes the
 * failure-mode matrix legible in one place.
 *
 * Modes (selected by `decideParentCallDispatch` from feature-flags):
 *
 * - `off`    — Genkit only. Zero overhead added vs. the legacy path.
 * - `shadow` — Genkit serves the response. Sidecar runs in parallel,
 *              fire-and-forget; both replies land in the
 *              `agent_shadow_diffs` collection for offline parity
 *              scoring. Sidecar errors do NOT affect the response.
 * - `canary` / `full` — Sidecar serves. Fallbacks:
 *              * `SidecarConfigError`, `SidecarTimeoutError`,
 *                `SidecarHttpError` → fall back to Genkit, then to the
 *                canned safe wrap-up the route already handles via its
 *                outer try/catch.
 *              * `SidecarBehaviouralError` (502 from the sidecar's
 *                fail-closed guard) → DO NOT fall back to Genkit
 *                (Genkit would likely produce the same suspect output);
 *                rethrow so the route returns the canned safe wrap-up.
 *
 * Round-2 audit reference: P0 BEHAV-1, TRANSPORT-1, PARITY-1.
 */

import { generateAgentReply, type AgentReplyInput, type AgentReplyOutput } from '@/ai/flows/parent-call-agent';

import { decideParentCallDispatch, type ParentCallSidecarDecision } from '@/lib/feature-flags';

import {
    callSidecarReply,
    SidecarBehaviouralError,
    SidecarConfigError,
    SidecarHttpError,
    SidecarTimeoutError,
    type SidecarReplyRequest,
    type SidecarReplyResponse,
} from './parent-call-client';
import { writeShadowDiff } from './shadow-diff';

export type DispatchSource = 'genkit' | 'sidecar' | 'genkit_fallback';

export interface DispatchedReply {
    reply: string;
    shouldEndCall: boolean;
    followUpQuestion: string | null;
    source: DispatchSource;
    /** Sidecar dispatch decision for this turn. Useful for structured logs. */
    decision: ParentCallSidecarDecision;
}

export interface DispatchInput extends AgentReplyInput {
    /** Twilio call SID — used for both the sidecar `callSid` field and
     *  the dispatch bucket. Required even in `off` mode for telemetry
     *  consistency.
     */
    callSid: string;
}

function toSidecarRequest(input: DispatchInput): SidecarReplyRequest {
    // Filter the transcript to the role/text the sidecar contract
    // expects — the Next.js side carries timestamps that the sidecar
    // doesn't need (it persists its own `createdAt`).
    //
    // `parentLanguage` is typed as `string` upstream (Genkit
    // `z.string()`); the codegen narrows it to the BCP-47-ish 11-way
    // union the sidecar enforces. The cast is safe because the Twilio
    // route validates the language before reaching here.
    return {
        callSid: input.callSid,
        turnNumber: input.turnNumber,
        studentName: input.studentName,
        className: input.className,
        subject: input.subject,
        reason: input.reason,
        teacherMessage: input.teacherMessage,
        teacherName: input.teacherName,
        schoolName: input.schoolName,
        parentLanguage: input.parentLanguage as SidecarReplyRequest['parentLanguage'],
        transcript: input.transcript,
        parentSpeech: input.parentSpeech,
        performanceSummary: input.performanceSummary,
    };
}

function genkitOutputToReply(out: AgentReplyOutput, source: DispatchSource, decision: ParentCallSidecarDecision): DispatchedReply {
    return {
        reply: out.reply,
        shouldEndCall: out.shouldEndCall,
        followUpQuestion: out.followUpQuestion ?? null,
        source,
        decision,
    };
}

function sidecarResponseToReply(res: SidecarReplyResponse, decision: ParentCallSidecarDecision): DispatchedReply {
    return {
        reply: res.reply,
        shouldEndCall: res.shouldEndCall,
        // Codegen's `followUpQuestion` is optional + nullable; coerce
        // undefined to null so the dispatched shape stays bivariant
        // with the Genkit return.
        followUpQuestion: res.followUpQuestion ?? null,
        source: 'sidecar',
        decision,
    };
}

/**
 * Run Genkit and capture an explicit `result | error` value so the
 * caller can pass either into the shadow-diff writer without throwing.
 *
 * Round-2 audit P0 ABORT-1 fix (30-agent review, group B1):
 * `AbortError` (e.g. Twilio request cancelled mid-flight) used to be
 * swallowed and turned into a phantom reply on a dead connection.
 * Now: rethrow AbortError so the caller can short-circuit cleanly
 * instead of writing a shadow-diff for a request the parent already
 * hung up on.
 */
async function runGenkitSafe(
    input: AgentReplyInput,
): Promise<{ ok: true; out: AgentReplyOutput } | { ok: false; error: Error }> {
    try {
        const out = await generateAgentReply(input);
        return { ok: true, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e };
    }
}

/**
 * Run the sidecar and capture timing + error so the same data can land
 * in shadow-diff regardless of outcome. Round-2 audit P0 ABORT-1: same
 * `AbortError` rethrow as `runGenkitSafe`.
 */
async function runSidecarSafe(
    request: SidecarReplyRequest,
): Promise<
    | { ok: true; res: SidecarReplyResponse; latencyMs: number }
    | { ok: false; error: Error; latencyMs: number }
> {
    const startedAt = Date.now();
    try {
        const res = await callSidecarReply(request);
        return { ok: true, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return {
            ok: false,
            error: e,
            latencyMs: Date.now() - startedAt,
        };
    }
}

function logDispatch(
    decision: ParentCallSidecarDecision,
    payload: Record<string, unknown>,
): void {
    // Single structured log line per dispatch decision. The Cloud
    // Logging filter for the Track D dashboards keys off
    // `event="parent_call.dispatch"`.
    console.log(
        JSON.stringify({
            event: 'parent_call.dispatch',
            mode: decision.mode,
            reason: decision.reason,
            bucket: decision.bucket,
            ...payload,
        }),
    );
}

/**
 * Round-2 audit P0 DECIDE-1 fix (30-agent review, group B1):
 * `decideParentCallDispatch` reads Firestore. If Firestore hangs (e.g.
 * regional outage, connection-pool exhaustion), the entire call hangs
 * indefinitely with no signal. Bound the read with a 1.5 s race so a
 * Firestore stall falls back to `off` mode (the safe default per
 * `FALLBACK_CONFIG`) instead of blocking the dispatcher.
 */
const DECIDE_DISPATCH_TIMEOUT_MS = 1_500;

async function decideDispatchWithTimeout(
    callSid: string,
): Promise<ParentCallSidecarDecision> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            decideParentCallDispatch(callSid),
            new Promise<ParentCallSidecarDecision>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error('decideParentCallDispatch timed out')),
                    DECIDE_DISPATCH_TIMEOUT_MS,
                );
            }),
        ]);
    } catch (err) {
        // Fail safe: any error reading the flag → off mode.
        console.warn(
            JSON.stringify({
                event: 'parent_call.dispatch.decide_failed',
                callSid,
                error: err instanceof Error ? err.message : String(err),
            }),
        );
        return { mode: 'off', reason: 'decide_failed', bucket: 0 };
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}

/**
 * Dispatcher entry point. Always returns a usable reply or throws — the
 * route's outer try/catch then lands the canned safe wrap-up.
 */
export async function dispatchParentCallReply(input: DispatchInput): Promise<DispatchedReply> {
    const decision = await decideDispatchWithTimeout(input.callSid);

    // ── off ────────────────────────────────────────────────────────────
    if (decision.mode === 'off') {
        const out = await generateAgentReply(input);
        logDispatch(decision, { source: 'genkit', callSid: input.callSid, turnNumber: input.turnNumber });
        return genkitOutputToReply(out, 'genkit', decision);
    }

    // ── shadow ─────────────────────────────────────────────────────────
    if (decision.mode === 'shadow') {
        const sidecarReq = toSidecarRequest(input);
        // Kick off both in parallel; we still return Genkit's reply on
        // success. Sidecar latency / errors land in shadow-diff but
        // never block the response.
        const [genkit, sidecar] = await Promise.all([
            runGenkitSafe(input),
            runSidecarSafe(sidecarReq),
        ]);

        // Fire-and-forget shadow-diff write (never awaited).
        void writeShadowDiff({
            callSid: input.callSid,
            turnNumber: input.turnNumber,
            parentLanguage: input.parentLanguage,
            genkitReply: genkit.ok ? genkit.out.reply : '',
            sidecarReply: sidecar.ok ? sidecar.res.reply : null,
            sidecarError: sidecar.ok
                ? undefined
                : {
                      type: sidecar.error.name,
                      message: sidecar.error.message,
                      elapsedMs:
                          sidecar.error instanceof SidecarTimeoutError
                              ? sidecar.error.elapsedMs
                              : undefined,
                  },
            sidecarLatencyMs: sidecar.latencyMs,
        });

        logDispatch(decision, {
            source: 'genkit',
            callSid: input.callSid,
            turnNumber: input.turnNumber,
            sidecarOk: sidecar.ok,
            sidecarLatencyMs: sidecar.latencyMs,
        });

        // Genkit serves. If Genkit itself failed, surface the error
        // (the route's outer catch handles fallback to canned wrap-up).
        if (!genkit.ok) throw genkit.error;
        return genkitOutputToReply(genkit.out, 'genkit', decision);
    }

    // ── canary / full ──────────────────────────────────────────────────
    // Sidecar serves; fall back to Genkit on transport errors only.
    const sidecarReq = toSidecarRequest(input);
    const sidecar = await runSidecarSafe(sidecarReq);

    if (sidecar.ok) {
        logDispatch(decision, {
            source: 'sidecar',
            callSid: input.callSid,
            turnNumber: input.turnNumber,
            sidecarLatencyMs: sidecar.latencyMs,
        });
        return sidecarResponseToReply(sidecar.res, decision);
    }

    // Behavioural guard 502 → DO NOT fall back to Genkit. Genkit would
    // likely produce the same suspect output (model issue, not transport).
    // Rethrow so the route's outer catch returns the canned safe wrap-up.
    if (sidecar.error instanceof SidecarBehaviouralError) {
        logDispatch(decision, {
            source: 'sidecar_behavioural_fail',
            callSid: input.callSid,
            turnNumber: input.turnNumber,
            axis: sidecar.error.axis,
            sidecarLatencyMs: sidecar.latencyMs,
        });
        throw sidecar.error;
    }

    // Transport error class → fall back to Genkit, then surface failure.
    if (
        sidecar.error instanceof SidecarConfigError ||
        sidecar.error instanceof SidecarTimeoutError ||
        sidecar.error instanceof SidecarHttpError
    ) {
        logDispatch(decision, {
            source: 'genkit_fallback',
            callSid: input.callSid,
            turnNumber: input.turnNumber,
            sidecarErrorType: sidecar.error.name,
            sidecarLatencyMs: sidecar.latencyMs,
        });
        const out = await generateAgentReply(input);
        return genkitOutputToReply(out, 'genkit_fallback', decision);
    }

    // Unknown error class — be conservative and fall back. The dispatcher
    // logs the type so we can refine the policy later.
    logDispatch(decision, {
        source: 'genkit_fallback',
        callSid: input.callSid,
        turnNumber: input.turnNumber,
        sidecarErrorType: sidecar.error.name,
        sidecarErrorMessage: sidecar.error.message,
        sidecarLatencyMs: sidecar.latencyMs,
    });
    const out = await generateAgentReply(input);
    return genkitOutputToReply(out, 'genkit_fallback', decision);
}
