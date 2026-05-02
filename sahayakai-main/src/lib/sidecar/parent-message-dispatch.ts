/**
 * Parent-message dispatcher.
 *
 * Same off / shadow / canary / full pattern as instant-answer.
 * Self-contained env-var-driven decision (avoids feature-flags.ts
 * for the same reasons documented in instant-answer-dispatch.ts).
 *
 * Phase C §C.5.
 */

import {
    generateParentMessage,
    type ParentMessageInput,
    type ParentMessageOutput,
} from '@/ai/flows/parent-message-generator';

import {
    callSidecarParentMessage,
    ParentMessageSidecarBehaviouralError,
    ParentMessageSidecarConfigError,
    ParentMessageSidecarHttpError,
    ParentMessageSidecarTimeoutError,
    type SidecarParentMessageRequest,
    type SidecarParentMessageResponse,
} from './parent-message-client';

// ─── Self-contained dispatch decision ──────────────────────────────────────

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

function readMode(): ParentMessageSidecarMode {
    const raw = (process.env.SAHAYAKAI_PARENT_MESSAGE_MODE ?? '').toLowerCase();
    if (raw === 'shadow' || raw === 'canary' || raw === 'full') return raw;
    return 'off';
}

function readPercent(): number {
    const raw = process.env.SAHAYAKAI_PARENT_MESSAGE_PERCENT;
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) return 0;
    return Math.max(0, Math.min(100, n));
}

export function decideParentMessageDispatch(
    uid: string,
): ParentMessageSidecarDecision {
    const mode = readMode();
    const bucket = userBucketForParentMessage(uid);

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
        const out = await generateParentMessage(input);
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
    const decision = decideParentMessageDispatch(input.userId);
    const sidecarRequest = inputToSidecarRequest(input);

    if (decision.mode === 'off') {
        const out = await generateParentMessage(input);
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

    const out = await generateParentMessage(input);
    return genkitToDispatched(out, 'genkit_fallback', decision);
}
