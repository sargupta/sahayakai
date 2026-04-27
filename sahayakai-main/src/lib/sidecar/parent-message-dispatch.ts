/**
 * Parent-message dispatcher.
 *
 * Same off / shadow / canary / full pattern as the other sidecar
 * agents. As of Phase J.5, dispatch decisions read from Firestore
 * via `getFeatureFlags()` so the auto-abort Cloud Function (Firestore
 * writer only) can roll this agent back without a Cloud Run redeploy.
 *
 * Phase C §C.5; Phase J.5 — flag-plane consolidation.
 *
 * Phase K (forensic audit P0 #2): parent-message output is not stored
 * in a per-user library (it is sent over SMS and the message body
 * itself is captured by the Twilio outbound record), so the
 * dispatcher does NOT persist Storage/Firestore. The pre-call
 * rate-limit gate is lifted to the dispatcher so a sidecar-routed
 * call cannot bypass `checkServerRateLimit`.
 */

import {
    generateParentMessage,
    type ParentMessageInput,
    type ParentMessageOutput,
} from '@/ai/flows/parent-message-generator';
import { getFeatureFlags } from '@/lib/feature-flags';

import {
    callSidecarParentMessage,
    ParentMessageSidecarBehaviouralError,
    ParentMessageSidecarConfigError,
    ParentMessageSidecarHttpError,
    ParentMessageSidecarTimeoutError,
    type SidecarParentMessageRequest,
    type SidecarParentMessageResponse,
} from './parent-message-client';
import { withTimeout } from './with-timeout';

// Mirrors `TIMEOUT_MS` in parent-message-client.ts. Phase J.2 hot-fix
// (P0 #7) — caps the Genkit fallback to the same budget as the sidecar.
const FALLBACK_TIMEOUT_MS = 8_000;

// ─── Firestore-backed dispatch decision (Phase J.5) ────────────────────────

export type ParentMessageSidecarMode =
    | 'off'
    | 'shadow'
    | 'canary'
    | 'full';

export interface ParentMessageSidecarDecision {
    mode: ParentMessageSidecarMode;
    reason: string;
    bucket: number;
}

function userBucketForParentMessage(uid: string): number {
    let hash = 0;
    for (let i = 0; i < uid.length; i++) {
        hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
    }
    return Math.abs(hash) % 100;
}

async function readMode(): Promise<ParentMessageSidecarMode> {
    const flags = await getFeatureFlags();
    return flags.parentMessageSidecarMode ?? 'off';
}

async function readPercent(): Promise<number> {
    const flags = await getFeatureFlags();
    const n = flags.parentMessageSidecarPercent ?? 0;
    return Math.max(0, Math.min(100, n));
}

export async function decideParentMessageDispatch(
    uid: string,
): Promise<ParentMessageSidecarDecision> {
    const mode = await readMode();
    const bucket = userBucketForParentMessage(uid);

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

// ─── Dispatcher ────────────────────────────────────────────────────────────

export type ParentMessageDispatchSource =
    | 'genkit'
    | 'sidecar'
    | 'genkit_fallback';

export interface DispatchedParentMessage extends ParentMessageOutput {
    source: ParentMessageDispatchSource;
    decision: ParentMessageSidecarDecision;
    sidecarTelemetry?: {
        sidecarVersion: string;
        latencyMs: number;
        modelUsed: string;
    };
}

export interface ParentMessageDispatchInput extends ParentMessageInput {
    /** Required for percent-bucket evaluation. */
    userId: string;
}

function inputToSidecarRequest(
    input: ParentMessageDispatchInput,
): SidecarParentMessageRequest {
    return {
        studentName: input.studentName,
        className: input.className,
        subject: input.subject,
        reason: input.reason,
        reasonContext: input.reasonContext ?? null,
        teacherNote: input.teacherNote ?? null,
        parentLanguage: input.parentLanguage as SidecarParentMessageRequest['parentLanguage'],
        consecutiveAbsentDays: input.consecutiveAbsentDays ?? null,
        teacherName: input.teacherName ?? null,
        schoolName: input.schoolName ?? null,
        performanceContext: input.performanceContext ?? null,
        performanceSummary: input.performanceSummary ?? null,
        userId: input.userId,
    };
}

function sidecarToDispatched(
    res: SidecarParentMessageResponse,
    decision: ParentMessageSidecarDecision,
): DispatchedParentMessage {
    return {
        message: res.message,
        languageCode: res.languageCode,
        wordCount: res.wordCount,
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
    out: ParentMessageOutput,
    source: 'genkit' | 'genkit_fallback',
    decision: ParentMessageSidecarDecision,
): DispatchedParentMessage {
    return { ...out, source, decision };
}

async function runGenkitSafe(
    input: ParentMessageInput,
): Promise<{ ok: true; out: ParentMessageOutput } | { ok: false; error: Error }> {
    try {
        const out = await withTimeout(
            generateParentMessage(input),
            FALLBACK_TIMEOUT_MS,
            'parent-message genkit fallback',
        );
        return { ok: true, out };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e };
    }
}

async function runSidecarSafe(
    request: SidecarParentMessageRequest,
): Promise<
    | { ok: true; res: SidecarParentMessageResponse; latencyMs: number }
    | { ok: false; error: Error; latencyMs: number }
> {
    const startedAt = Date.now();
    try {
        const res = await callSidecarParentMessage(request);
        return { ok: true, res, latencyMs: Date.now() - startedAt };
    } catch (err) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (e.name === 'AbortError') throw e;
        return { ok: false, error: e, latencyMs: Date.now() - startedAt };
    }
}

function logDispatch(
    decision: ParentMessageSidecarDecision,
    payload: Record<string, unknown>,
): void {
    // eslint-disable-next-line no-console
    console.log(
        JSON.stringify({
            event: 'parent_message.dispatch',
            mode: decision.mode,
            reason: decision.reason,
            bucket: decision.bucket,
            ...payload,
        }),
    );
}

/**
 * Dispatcher entry point.
 */
export async function dispatchParentMessage(
    input: ParentMessageDispatchInput,
): Promise<DispatchedParentMessage> {
    const decision = await decideParentMessageDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await withTimeout(
            generateParentMessage(input),
            FALLBACK_TIMEOUT_MS,
            'parent-message genkit fallback',
        );
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

    // Phase K — pre-call rate-limit gate. Parent messages are
    // SMS-bound and not saved to the user's per-personal library, so
    // the dispatcher does not persist anything. The Genkit
    // `generateParentMessage` flow does not gate today (the API route
    // does), but the route is bypassed when the sidecar serves; this
    // gate closes that gap on the canary/full path.
    if (input.userId) {
        const { checkServerRateLimit } = await import('@/lib/server-safety');
        await checkServerRateLimit(input.userId);
    }

    // canary / full
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
        sidecar.error instanceof ParentMessageSidecarBehaviouralError
            ? 'behavioural'
            : sidecar.error instanceof ParentMessageSidecarTimeoutError
              ? 'timeout'
              : sidecar.error instanceof ParentMessageSidecarHttpError
                ? 'http'
                : sidecar.error instanceof ParentMessageSidecarConfigError
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
        generateParentMessage(input),
        FALLBACK_TIMEOUT_MS,
        'parent-message genkit fallback',
    );
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
